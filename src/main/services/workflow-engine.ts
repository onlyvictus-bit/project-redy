import { v4 as uuid } from 'uuid';

import type {
  ActiveAgentRole,
  AgentId,
  AgentRole,
  ArtifactBundle,
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
import { WorkspaceManager } from './workspace-manager';

interface WorkflowContext {
  project: ProjectRef;
  task: TaskRun;
  updateTask: (task: TaskRun) => void;
  appendArtifact: (artifact: ArtifactBundle) => void;
  recordEvent?: (taskId: string, eventType: string, payload: Record<string, unknown>) => void;
}

const RESUMABLE_STAGE_ORDER: ResumableStage[] = ['code', 'review', 'fix', 'verify'];

export class WorkflowEngine {
  private readonly activeControllers = new Map<string, AbortController>();

  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly connectors: () => Record<AgentId, AgentConnector>
  ) {}

  cancel(taskId: string): void {
    this.activeControllers.get(taskId)?.abort();
  }

  async start(project: ProjectRef, input: StartWorkflowInput, updateTask: (task: TaskRun) => void, appendArtifact: (artifact: ArtifactBundle) => void, recordEvent?: (taskId: string, eventType: string, payload: Record<string, unknown>) => void): Promise<TaskRun> {
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
      assignedAgents: this.resolveAgents(input.workflowId),
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
      recordEvent
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
    const context: WorkflowContext = {
      project,
      task,
      updateTask,
      appendArtifact,
      recordEvent
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
            case 'fix':
              prompt = buildFixPrompt(task, task.findings);
              break;
            case 'review':
            case 'verify': {
              const diff = await this.workspaceManager.getDiff(task, project);
              prompt = buildReviewPrompt(task, diff, options.agentId);
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

    if (skip <= 0) {
      await this.runStep(context, 'code', 'claude', buildCodingPrompt(context.task), 'coder', false, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 1) {
      const diff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'review', 'codex', buildReviewPrompt(context.task, diff, 'codex'), 'reviewer', true, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 2 && context.task.findings.length) {
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings), 'coder', false, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 3) {
      const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, verifyDiff, 'codex'), 'tester', true, signal);
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
      await this.runStep(context, 'review', 'gemini', buildReviewPrompt(context.task, diff, 'gemini'), 'architect', true, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 2 && context.task.findings.length) {
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings), 'coder', false, signal);
      if (signal?.aborted) return;
    }
    if (skip <= 3) {
      const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, verifyDiff, 'codex'), 'reviewer', true, signal);
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
      const beforeDiff = enforceReadOnly ? await this.workspaceManager.getDiff(context.task, context.project) : '';
      const artifact = await connector.runJob({
        prompt,
        cwd: context.task.worktreePath,
        runner: connector.profile.runner,
        taskId: context.task.id,
        stepId: step.id,
        role,
        signal
      });
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

  private resolveAgents(workflowId: StartWorkflowInput['workflowId']): AgentId[] {
    switch (workflowId) {
      case 'code-review-fix-verify':
        return ['claude', 'codex'];
      case 'code-gemini-compare-codex-review':
        return ['claude', 'gemini', 'codex'];
      case 'architecture-compare':
        return ['claude', 'codex', 'gemini', 'ollama'];
      case 'away-monitor':
        return ['ollama'];
      default:
        throw new Error(`Unsupported workflow ${String(workflowId)}`);
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
