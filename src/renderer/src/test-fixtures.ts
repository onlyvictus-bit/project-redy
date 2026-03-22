import type { ArtifactBundle, TaskRun, TaskStepRecord } from '@shared/types';

export function makeStep(overrides: Partial<TaskStepRecord> = {}): TaskStepRecord {
  return {
    id: 'step-1',
    stage: 'review',
    agentId: 'codex',
    startedAt: '2026-03-15T08:00:00.000Z',
    completedAt: '2026-03-15T08:01:00.000Z',
    status: 'completed',
    summary: 'Reviewed changes.',
    ...overrides
  };
}

export function makeArtifact(overrides: Partial<ArtifactBundle> = {}): ArtifactBundle {
  return {
    id: 'artifact-1',
    taskId: 'task-1',
    stepId: 'step-1',
    agentId: 'codex',
    role: 'reviewer',
    prompt: 'Review the latest diff.',
    stdout: 'stdout log',
    stderr: '',
    exitCode: 0,
    structuredEvents: [],
    summary: 'Artifact summary',
    finalMessage: 'Artifact final message',
    patch: 'diff --git a/src/app.ts b/src/app.ts\n@@ -1 +1 @@\n-old line\n+new line',
    findings: [],
    commandRuns: [],
    createdAt: '2026-03-15T08:05:00.000Z',
    ...overrides
  };
}

export function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  const artifact = makeArtifact();
  return {
    id: 'task-1',
    projectId: 'project-1',
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc123',
    worktreePath: 'D:\\workspace\\task-1',
    stage: 'promote',
    brief: 'Review the selected task.',
    assignedAgents: ['claude', 'codex'],
    approvalState: 'pending',
    branchName: 'triad/review-task-1',
    summary: 'Task summary',
    findings: [],
    artifacts: [artifact],
    steps: [makeStep()],
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-03-15T08:06:00.000Z',
    ...overrides
  };
}
