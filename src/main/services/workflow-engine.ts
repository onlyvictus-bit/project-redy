import { v4 as uuid } from 'uuid';

import type {
  ActiveAgentRole,
  AgentId,
  ArtifactBundle,
  ContinueTaskOptions,
  Finding,
  ProjectRef,
  ResumableStage,
  StartWorkflowInput,
  TaskRun,
  TaskStage,
  TaskStepRecord
} from '@shared/types';

import { buildArchitecturePrompt, buildCodingPrompt, buildFixPrompt, buildMonitorPrompt, buildReviewPrompt } from '../utils/prompts';
import type { AgentConnector } from '../connectors/base';
import { WorkspaceManager } from './workspace-manager';

interface WorkflowContext {
  project: ProjectRef;
  task: TaskRun;
  updateTask: (task: TaskRun) => void;
  appendArtifact: (artifact: ArtifactBundle) => void;
}

const RESUMABLE_STAGE_ORDER: ResumableStage[] = ['code', 'review', 'fix', 'verify'];

export class WorkflowEngine {
  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly connectors: () => Record<AgentId, AgentConnector>
  ) {}

  async start(project: ProjectRef, input: StartWorkflowInput, updateTask: (task: TaskRun) => void, appendArtifact: (artifact: ArtifactBundle) => void): Promise<TaskRun> {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    updateTask(task);

    const context: WorkflowContext = {
      project,
      task,
      updateTask,
      appendArtifact
    };

    switch (input.workflowId) {
      case 'code-review-fix-verify':
        await this.runCodeReviewFixVerify(context);
        break;
      case 'code-gemini-compare-codex-review':
        await this.runCodeGeminiCodex(context);
        break;
      case 'architecture-compare':
        await this.runArchitectureCompare(context);
        break;
      case 'away-monitor':
        await this.runAwayMonitor(context);
        break;
      default:
        throw new Error(`Unsupported workflow ${String(input.workflowId)}`);
    }

    context.task.stage = context.task.stage === 'error' ? 'error' : 'promote';
    context.task.updatedAt = new Date().toISOString();
    updateTask(context.task);
    return context.task;
  }

  async continue(
    project: ProjectRef,
    task: TaskRun,
    options: ContinueTaskOptions,
    updateTask: (task: TaskRun) => void,
    appendArtifact: (artifact: ArtifactBundle) => void
  ): Promise<TaskRun> {
    const context: WorkflowContext = {
      project,
      task,
      updateTask,
      appendArtifact
    };

    if (options.mode === 'resume') {
      switch (task.workflowId) {
        case 'code-review-fix-verify':
          await this.runCodeReviewFixVerify(context, options.fromStage);
          break;
        case 'code-gemini-compare-codex-review':
          await this.runCodeGeminiCodex(context, options.fromStage);
          break;
        default:
          throw new Error(`Resume not supported for workflow ${task.workflowId}`);
      }
      context.task.stage = context.task.stage === 'error' ? 'error' : 'promote';
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
          default:
            throw new Error(`No built-in prompt for stage ${String(options.stage)}`);
        }
      }
      await this.runStep(context, options.stage, options.agentId, prompt, options.role, enforceReadOnly);
    }

    context.task.updatedAt = new Date().toISOString();
    updateTask(context.task);
    return context.task;
  }

  private async runCodeReviewFixVerify(context: WorkflowContext, fromStage?: ResumableStage): Promise<void> {
    const skip = fromStage ? RESUMABLE_STAGE_ORDER.indexOf(fromStage) : 0;

    if (skip <= 0) {
      await this.runStep(context, 'code', 'claude', buildCodingPrompt(context.task), 'coder');
    }
    if (skip <= 1) {
      const diff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'review', 'codex', buildReviewPrompt(context.task, diff, 'codex'), 'reviewer', true);
    }
    if (skip <= 2 && context.task.findings.length) {
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings), 'coder');
    }
    if (skip <= 3) {
      const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, verifyDiff, 'codex'), 'tester', true);
    }
  }

  private async runCodeGeminiCodex(context: WorkflowContext, fromStage?: ResumableStage): Promise<void> {
    const skip = fromStage ? RESUMABLE_STAGE_ORDER.indexOf(fromStage) : 0;

    if (skip <= 0) {
      await this.runStep(context, 'code', 'claude', buildCodingPrompt(context.task), 'coder');
    }
    if (skip <= 1) {
      const diff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'review', 'gemini', buildReviewPrompt(context.task, diff, 'gemini'), 'architect', true);
    }
    if (skip <= 2 && context.task.findings.length) {
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings), 'coder');
    }
    if (skip <= 3) {
      const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, verifyDiff, 'codex'), 'reviewer', true);
    }
  }

  private async runArchitectureCompare(context: WorkflowContext): Promise<void> {
    const agents: AgentId[] = ['claude', 'codex', 'gemini', 'ollama'];
    for (const agentId of agents) {
      const role = agentId === 'ollama' ? 'architect' : 'planner';
      await this.runStep(context, 'review', agentId, buildArchitecturePrompt(context.task, agentId), role, agentId !== 'claude');
    }
    context.task.stage = 'done';
  }

  private async runAwayMonitor(context: WorkflowContext): Promise<void> {
    await this.runStep(context, 'review', 'ollama', buildMonitorPrompt(context.task), 'monitor');
    context.task.stage = 'done';
  }

  private async runStep(
    context: WorkflowContext,
    stage: TaskStage,
    agentId: AgentId,
    prompt: string,
    role: ActiveAgentRole,
    enforceReadOnly = false
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

    try {
      const beforeDiff = enforceReadOnly ? await this.workspaceManager.getDiff(context.task, context.project) : '';
      const artifact = await connector.runJob({
        prompt,
        cwd: context.task.worktreePath,
        runner: connector.profile.runner,
        taskId: context.task.id,
        stepId: step.id,
        role
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
    } catch (error) {
      step.status = 'failed';
      step.completedAt = new Date().toISOString();
      context.task.stage = 'error';
      context.task.errorMessage = error instanceof Error ? error.message : String(error);
    }

    context.task.updatedAt = new Date().toISOString();
    context.updateTask(context.task);
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
