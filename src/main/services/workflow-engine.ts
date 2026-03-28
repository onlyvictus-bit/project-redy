import { v4 as uuid } from 'uuid';
import { KnowledgeService } from './knowledge-service';

import type {
  ActiveAgentRole,
  AgentId,
  AgentRole,
  ArtifactBundle,
  CustomWorkflowStep,
  ContinueTaskOptions,
  Finding,
  ProjectRef,
  ResumableStage,
  StartWorkflowInput,
  TaskRun,
  TaskStepRecord
} from '@shared/types';

import { buildArchitecturePrompt, buildCodingPrompt, buildFixPrompt, buildMonitorPrompt, buildReviewPrompt } from '../utils/prompts';
import { ConnectorJobError, type AgentConnector } from '../connectors/base';
import { buildHandoffContext, compressDiff } from './context-transfer';
import { WorkspaceManager } from './workspace-manager';

interface WorkflowContext {
  project: ProjectRef;
  task: TaskRun;
  updateTask: (task: TaskRun) => void;
  appendArtifact: (artifact: ArtifactBundle) => void;
  recordEvent?: (taskId: string, eventType: string, payload: Record<string, unknown>) => void;
  agentOverrides?: StartWorkflowInput['agentOverrides'];
}

const RESUMABLE_STAGE_ORDER: ResumableStage[] = ['code', 'review', 'fix', 'verify'];

export class WorkflowEngine {
  private readonly activeControllers = new Map<string, AbortController>();
  private readonly knowledgeService: KnowledgeService;

  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly connectors: () => Record<AgentId, AgentConnector>
  ) {
    this.knowledgeService = new KnowledgeService();
  }

  cancel(taskId: string): void {
    this.activeControllers.get(taskId)?.abort();
  }

  async start(project: ProjectRef, input: StartWorkflowInput, updateTask: (task: TaskRun) => void, appendArtifact: (artifact: ArtifactBundle) => void, recordEvent?: (taskId: string, eventType: string, payload: Record<string, unknown>) => void): Promise<TaskRun> {
    this.knowledgeService.setProjectRoot(project.rootPath);
    const taskId = uuid();
    const workspace = await this.workspaceManager.createTaskWorkspace(project, taskId, input.brief);
    const task: TaskRun = {
      id: taskId,
      projectId: project.id,
      workflowId: input.workflowId,
      workflowMode: input.workflowMode ?? 'orchestrate',
      baseBranch: workspace.baseBranch,
      baseCommit: workspace.baseCommit,
      worktreePath: workspace.worktreePath,
      stage: 'brief',
      brief: input.brief,
      assignedAgents: this.resolveAgents(input.workflowId, input.customWorkflowSteps),
      approvalState: 'pending',
      branchName: workspace.branchName,
      findings: [],
      artifacts: [],
      steps: [],
      worktreeStatus: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    updateTask(task);

    const context: WorkflowContext = {
      project,
      task,
      updateTask,
      appendArtifact,
      recordEvent,
      agentOverrides: input.agentOverrides
    };

    const controller = new AbortController();
    this.activeControllers.set(taskId, controller);
    try {
      switch (input.workflowId) {
        case 'code-review-fix-verify':
          await this.runCodeReviewFixVerify(context, undefined, controller.signal);
          break;
        case 'code-gemini-compare-codex-review':
          await this.runCodeGeminiCodex(context, undefined, controller.signal);
          break;
        case 'architecture-compare':
          await this.runArchitectureCompare(context, controller.signal);
          break;
        case 'away-monitor':
          await this.runAwayMonitor(context, controller.signal);
          break;
        case 'custom': {
          const steps = input.customWorkflowSteps;
          if (!steps?.length) throw new Error('Custom workflow has no steps.');
          await this.runCustomWorkflow(context, steps, 0, controller.signal);
          break;
        }
        default:
          throw new Error(`Unsupported workflow ${String(input.workflowId)}`);
      }
    } finally {
      this.activeControllers.delete(taskId);
    }

    if (context.task.stage === 'cancelled') {
      context.task.updatedAt = new Date().toISOString();
      updateTask(context.task);
      return context.task;
    }

    if (context.task.stage !== 'error' && context.task.stage !== 'done') {
      context.task.stage = 'promote';
    }
    context.task.updatedAt = new Date().toISOString();
    updateTask(context.task);
    return context.task;
  }

  async continue(
    project: ProjectRef,
    task: TaskRun,
    options: ContinueTaskOptions,
    updateTask: (task: TaskRun) => void,
    appendArtifact: (artifact: ArtifactBundle) => void,
    recordEvent?: (taskId: string, eventType: string, payload: Record<string, unknown>) => void
  ): Promise<TaskRun> {
    this.knowledgeService.setProjectRoot(project.rootPath);
    const context: WorkflowContext = {
      project,
      task,
      updateTask,
      appendArtifact,
      recordEvent,
      agentOverrides: undefined
    };

    const controller = new AbortController();
    this.activeControllers.set(task.id, controller);
    try {
      if (options.mode === 'resume') {
        switch (task.workflowId) {
          case 'code-review-fix-verify':
            await this.runCodeReviewFixVerify(context, options.fromStage, controller.signal);
            break;
          case 'code-gemini-compare-codex-review':
            await this.runCodeGeminiCodex(context, options.fromStage, controller.signal);
            break;
          case 'custom': {
            const customSteps = (task as TaskRun & { _customWorkflowSteps?: CustomWorkflowStep[] })._customWorkflowSteps;
            if (!customSteps?.length) throw new Error('Custom workflow steps not available for resume.');
            const fromIndex = typeof task.customStepIndex === 'number' ? task.customStepIndex + 1 : 0;
            await this.runCustomWorkflow(context, customSteps, fromIndex, controller.signal);
            break;
          }
          default:
            throw new Error(`Resume not supported for workflow ${task.workflowId}`);
        }
        if (context.task.stage !== 'error' && context.task.stage !== 'done' && context.task.stage !== 'cancelled') {
          context.task.stage = 'promote';
        }
      } else {
        const enforceReadOnly = options.role === 'reviewer' || options.role === 'tester' || options.role === 'monitor';
        let prompt: string;
        if (options.prompt) {
          prompt = options.prompt;
        } else {
          switch (options.stage) {
            case 'fix': {
              const priorCtx = buildHandoffContext(task.artifacts.slice(0, 3));
              const knowledgeCtx = await this.knowledgeService.getKnowledgeContext(task.errorMessage || '');
              prompt = buildFixPrompt(task, task.findings, priorCtx) + knowledgeCtx;
              break;
            }
            case 'review':
            case 'verify': {
              const diff = await this.workspaceManager.getDiff(task, project);
              const priorCtx = options.stage === 'verify'
                ? buildHandoffContext(task.artifacts.slice(0, 3))
                : undefined;
              prompt = buildReviewPrompt(task, compressDiff(diff), options.agentId, priorCtx);
              break;
            }
            case 'code':
              prompt = buildCodingPrompt(task);
              break;
            default: {
              const _exhaustive: never = options.stage;
              throw new Error(`No built-in prompt for stage ${String(_exhaustive)}`);
            }
          }
        }
        await this.runStep(context, options.stage, options.agentId, prompt, options.role, enforceReadOnly, controller.signal);
      }
    } finally {
      this.activeControllers.delete(task.id);
    }

    if (context.task.stage === 'cancelled') {
      context.task.updatedAt = new Date().toISOString();
      updateTask(context.task);
      return context.task;
    }

    context.task.updatedAt = new Date().toISOString();
    updateTask(context.task);
    return context.task;
  }

  private async runCodeReviewFixVerify(context: WorkflowContext, fromStage?: ResumableStage, signal?: AbortSignal): Promise<void> {
    const skip = fromStage ? RESUMABLE_STAGE_ORDER.indexOf(fromStage) : 0;
    const overrides = context.agentOverrides || {};

    if (skip <= 0) {
      const agentId = (Object.keys(overrides).find(k => overrides[k as AgentId] === 'coder' || overrides[k as AgentId] === 'developer') as AgentId) || 'claude';
      await this.runStep(context, 'code', agentId, buildCodingPrompt(context.task), 'coder', false, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 1) {
      const agentId = (Object.keys(overrides).find(k => overrides[k as AgentId] === 'reviewer' || overrides[k as AgentId] === 'architect') as AgentId) || 'codex';
      const diff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'review', agentId, buildReviewPrompt(context.task, compressDiff(diff), agentId), 'reviewer', true, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 2 && context.task.findings.length) {
      const agentId = (Object.keys(overrides).find(k => overrides[k as AgentId] === 'coder' || overrides[k as AgentId] === 'developer') as AgentId) || 'claude';
      const priorCtx = buildHandoffContext(context.task.artifacts.slice(0, 3));
      await this.runStep(context, 'fix', agentId, buildFixPrompt(context.task, context.task.findings, priorCtx), 'coder', false, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 3) {
      const agentId = (Object.keys(overrides).find(k => overrides[k as AgentId] === 'tester' || overrides[k as AgentId] === 'reviewer') as AgentId) || 'codex';
      const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
      const priorCtx = buildHandoffContext(context.task.artifacts.slice(0, 3));
      await this.runStep(context, 'verify', agentId, buildReviewPrompt(context.task, compressDiff(verifyDiff), agentId, priorCtx), 'tester', true, signal);
    }
  }

  private async runCodeGeminiCodex(context: WorkflowContext, fromStage?: ResumableStage, signal?: AbortSignal): Promise<void> {
    const skip = fromStage ? RESUMABLE_STAGE_ORDER.indexOf(fromStage) : 0;

    if (skip <= 0) {
      await this.runStep(context, 'code', 'claude', buildCodingPrompt(context.task), 'coder', false, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 1) {
      const diff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'review', 'gemini', buildReviewPrompt(context.task, compressDiff(diff), 'gemini'), 'architect', true, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 2 && context.task.findings.length) {
      const priorCtx = buildHandoffContext(context.task.artifacts.slice(0, 3));
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings, priorCtx), 'coder', false, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 3) {
      const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
      const priorCtx = buildHandoffContext(context.task.artifacts.slice(0, 3));
      await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, compressDiff(verifyDiff), 'codex', priorCtx), 'reviewer', true, signal);
    }
  }

  private async runArchitectureCompare(context: WorkflowContext, signal?: AbortSignal): Promise<void> {
    const agents: AgentId[] = ['claude', 'codex', 'gemini', 'ollama'];
    for (const agentId of agents) {
      // CLI agents always run as read-only planner to prevent unexpected edits during a compare workflow.
      // Ollama has no write capability so its personality role is safe to honour.
      const role: ActiveAgentRole = agentId === 'ollama'
        ? this.resolveActiveRole(this.connectors().ollama.profile.role, 'architect')
        : 'planner';
      await this.runStep(context, 'review', agentId, buildArchitecturePrompt(context.task, agentId), role, true, signal);
      if (signal?.aborted) return;
    }
    context.task.approvalState = 'not-required';
    context.task.stage = 'done';
  }

  private async runAwayMonitor(context: WorkflowContext, signal?: AbortSignal): Promise<void> {
    const role = this.resolveActiveRole(this.connectors().ollama.profile.role, 'monitor');
    await this.runStep(context, 'review', 'ollama', buildMonitorPrompt(context.task), role, false, signal);
    if (signal?.aborted) return;
    context.task.approvalState = 'not-required';
    context.task.stage = 'done';
  }

  private async runStep(
    context: WorkflowContext,
    stage: ResumableStage,
    agentId: AgentId,
    prompt: string,
    role: ActiveAgentRole,
    enforceReadOnly = false,
    signal?: AbortSignal
  ): Promise<void> {
    const connector = this.connectors()[agentId];
    const step: TaskStepRecord = {
      id: uuid(),
      stage,
      agentId,
      startedAt: new Date().toISOString(),
      status: 'running'
    };
    context.task.stage = stage;
    context.task.steps.unshift(step);
    context.task.updatedAt = new Date().toISOString();
    context.updateTask(context.task);

    context.recordEvent?.(context.task.id, 'step-started', { stage, agentId, stepId: step.id });

    try {
      // If this agent ran a prior step on the same task and supports session
      // resumption, pass that session ID so the CLI picks up where it left off
      // instead of starting a fresh context window.
      const priorSessionId = connector.profile.capabilities.supportsResume
        ? context.task.artifacts.find((a) => a.agentId === agentId && a.sessionId && a.exitCode === 0)?.sessionId
        : undefined;

      const beforeDiff = enforceReadOnly ? await this.workspaceManager.getDiff(context.task, context.project) : '';
      const artifact = await connector.runJob({
        prompt,
        cwd: context.task.worktreePath,
        runner: connector.profile.runner,
        taskId: context.task.id,
        stepId: step.id,
        role,
        signal,
        resumeSessionId: priorSessionId
      });

      // --- LEARNING LOOP ---
      if (stage === 'fix' && artifact.exitCode === 0) {
        await this.knowledgeService.saveLesson({
          taskId: context.task.id,
          agentId: agentId,
          error: context.task.errorMessage || 'Unknown Error',
          rootCause: 'Successfully resolved in fix stage.',
          solution: artifact.summary,
          files: []
        });
      }
      // --- END LEARNING LOOP ---

      const afterDiff = enforceReadOnly ? await this.workspaceManager.getDiff(context.task, context.project) : '';

      if (enforceReadOnly && beforeDiff !== afterDiff) {
        artifact.findings.unshift({
          sourceAgent: agentId,
          severity: 'high',
          title: `${connector.profile.displayName} modified the worktree during a read-only stage`,
          body: 'The agent changed files while acting as a reviewer/tester. The worktree is preserved for inspection, but promotion should be reviewed carefully.'
        });
      }

      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      step.summary = artifact.summary;
      context.task.summary = artifact.summary;
      context.task.findings = this.mergeFindings(context.task.findings, artifact.findings);
      context.task.artifacts.unshift(artifact);
      context.appendArtifact(artifact);

      // If the signal fired while this step was completing, treat the step as cancelled.
      // This closes the window where a successful exit races with an abort signal.
      if (signal?.aborted) {
        step.status = 'cancelled';
        context.task.stage = 'cancelled';
        context.task.errorMessage = 'Workflow was cancelled by the user.';
        context.recordEvent?.(context.task.id, 'step-cancelled', { stage, agentId, stepId: step.id });
      } else {
        context.recordEvent?.(context.task.id, 'step-completed', { stage, agentId, stepId: step.id, exitCode: artifact.exitCode ?? 0 });
      }
    } catch (error) {
      const wasCancelled = signal?.aborted ?? false;
      step.status = wasCancelled ? 'cancelled' : 'failed';
      step.completedAt = new Date().toISOString();
      context.task.stage = wasCancelled ? 'cancelled' : 'error';
      context.task.errorMessage = wasCancelled
        ? 'Workflow was cancelled by the user.'
        : (error instanceof Error ? error.message : String(error));
      if (error instanceof ConnectorJobError) {
        step.summary = error.artifact.summary;
        context.task.summary = error.artifact.summary;
        context.task.findings = this.mergeFindings(context.task.findings, error.artifact.findings);
        context.task.artifacts.unshift(error.artifact);
        context.appendArtifact(error.artifact);
      }
      if (wasCancelled) {
        context.recordEvent?.(context.task.id, 'step-cancelled', { stage, agentId, stepId: step.id });
      } else {
        context.recordEvent?.(context.task.id, 'step-failed', { stage, agentId, stepId: step.id, error: context.task.errorMessage ?? '' });
      }
    }

    context.task.updatedAt = new Date().toISOString();
    context.updateTask(context.task);
  }

  /**
   * Maps a connector's profile role to a valid ActiveAgentRole for a workflow step.
   * 'developer' is cosmetically distinct from 'coder' but executes identically.
   * 'off' and 'compare-only' fall back to the workflow-defined default.
   */
  private resolveActiveRole(profileRole: AgentRole, fallback: ActiveAgentRole): ActiveAgentRole {
    const active = new Set<string>(['coder', 'reviewer', 'tester', 'architect', 'planner', 'monitor']);
    if (active.has(profileRole)) return profileRole as ActiveAgentRole;
    if (profileRole === 'developer') return 'coder';
    return fallback;
  }

  private resolveAgents(workflowId: StartWorkflowInput['workflowId'], customSteps?: CustomWorkflowStep[]): AgentId[] {
    switch (workflowId) {
      case 'code-review-fix-verify':
        return ['claude', 'codex'];
      case 'code-gemini-compare-codex-review':
        return ['claude', 'gemini', 'codex'];
      case 'architecture-compare':
        return ['claude', 'codex', 'gemini', 'ollama'];
      case 'away-monitor':
        return ['ollama'];
      case 'custom': {
        if (!customSteps?.length) return [];
        const seen = new Set<AgentId>();
        const agents: AgentId[] = [];
        for (const step of customSteps) {
          if (!seen.has(step.agentId)) {
            seen.add(step.agentId);
            agents.push(step.agentId);
          }
        }
        return agents;
      }
      default:
        throw new Error(`Unsupported workflow ${String(workflowId)}`);
    }
  }

  private async runCustomWorkflow(
    context: WorkflowContext,
    steps: CustomWorkflowStep[],
    fromIndex: number,
    signal?: AbortSignal
  ): Promise<void> {
    for (let i = fromIndex; i < steps.length; i++) {
      const step = steps[i];
      const prompt = step.promptTemplate.replace('{{brief}}', context.task.brief);
      const activeRole = this.resolveActiveRole(step.role, 'coder');
      const enforceReadOnly = step.role === 'reviewer' || step.role === 'tester' || step.role === 'monitor';

      await this.runStep(context, 'code', step.agentId, prompt, activeRole, enforceReadOnly, signal);
      if (signal?.aborted) return;

      // Halt at approval gate (only if there are more steps remaining)
      if (step.requiresApproval && i < steps.length - 1) {
        context.task.stage = 'findings';
        context.task.approvalState = 'pending';
        context.task.customStepIndex = i;
        context.task.updatedAt = new Date().toISOString();
        context.updateTask(context.task);
        return;
      }
    }
  }

  private mergeFindings(existing: Finding[], incoming: Finding[]): Finding[] {
    const seen = new Set(existing.map((finding) => `${finding.sourceAgent}:${finding.title}:${finding.file ?? ''}:${finding.line ?? ''}`));
    return [
      ...existing,
      ...incoming.filter((finding) => {
        const key = `${finding.sourceAgent}:${finding.title}:${finding.file ?? ''}:${finding.line ?? ''}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
    ];
  }
}
