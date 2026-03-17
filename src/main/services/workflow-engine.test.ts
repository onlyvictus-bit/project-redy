import { describe, expect, it, vi } from 'vitest';

import type { ArtifactBundle, ProjectRef, TaskRun } from '@shared/types';

import { ConnectorJobError } from '../connectors/base';
import { WorkflowEngine } from './workflow-engine';

function makeProject(): ProjectRef {
  return {
    id: 'project-1',
    name: 'triad',
    rootPath: 'D:\\repo',
    runnerPreference: 'windows',
    resolvedRunner: 'windows',
    isGitRepo: true,
    currentBranch: 'main',
    archivePath: 'D:\\repo\\.triad-workbench',
    archiveEnabled: true
  };
}

function makeTask(): TaskRun {
  return {
    id: 'task-1',
    projectId: 'project-1',
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc123',
    worktreePath: 'D:\\repo\\.triad\\task-1',
    stage: 'review',
    brief: 'Review the failing job',
    assignedAgents: ['claude', 'codex'],
    approvalState: 'pending',
    branchName: 'triad/task-1',
    findings: [],
    artifacts: [],
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function makeFailureArtifact(): ArtifactBundle {
  return {
    id: 'artifact-fail-1',
    taskId: 'task-1',
    stepId: 'step-1',
    agentId: 'codex',
    role: 'reviewer',
    prompt: 'Review the diff',
    stdout: 'test stdout',
    stderr: 'test stderr',
    exitCode: 1,
    structuredEvents: [],
    summary: 'Codex review failed',
    finalMessage: 'test stdout\ntest stderr',
    findings: [],
    commandRuns: [
      {
        command: 'codex exec "Review the diff"',
        exitCode: 1,
        stdout: 'test stdout',
        stderr: 'test stderr'
      }
    ],
    createdAt: new Date().toISOString()
  };
}

describe('WorkflowEngine failure diagnostics', () => {
  it('preserves the artifact and command logs when a step fails', async () => {
    const artifact = makeFailureArtifact();
    const codexConnector = {
      profile: {
        id: 'codex',
        displayName: 'Codex CLI',
        binaryOrEndpoint: 'codex',
        authMode: 'native-login',
        role: 'reviewer',
        runner: 'windows',
        status: 'ready',
        capabilities: {
          supportsInteractive: true,
          supportsStructuredOutput: true,
          supportsEditing: true,
          supportsResume: false
        }
      },
      probe: vi.fn(),
      runJob: vi.fn().mockRejectedValue(new ConnectorJobError('Codex CLI exited with code 1', artifact)),
      getInteractiveLaunchSpec: vi.fn(),
      setRole: vi.fn(),
      interrupt: vi.fn(),
      dispose: vi.fn()
    };

    const engine = new WorkflowEngine(
      {
        getDiff: vi.fn().mockResolvedValue('diff --git a/file b/file')
      } as never,
      () =>
        ({
          claude: codexConnector,
          codex: codexConnector,
          gemini: codexConnector,
          ollama: codexConnector
        }) as never
    );

    const task = makeTask();
    const updateTask = vi.fn();
    const appendArtifact = vi.fn();

    const result = await engine.continue(
      makeProject(),
      task,
      {
        mode: 'single-step',
        stage: 'review',
        agentId: 'codex',
        role: 'reviewer',
        prompt: 'Review the diff'
      },
      updateTask,
      appendArtifact
    );

    expect(result.stage).toBe('error');
    expect(result.errorMessage).toContain('Codex CLI exited with code 1');
    expect(result.artifacts[0]).toEqual(artifact);
    expect(result.artifacts[0].commandRuns[0].stderr).toBe('test stderr');
    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[0].summary).toBe('Codex review failed');
    expect(appendArtifact).toHaveBeenCalledWith(artifact);
  });
});

// ---------------------------------------------------------------------------
// WorkflowEngine.cancel — abort signal propagation
// ---------------------------------------------------------------------------

describe('WorkflowEngine.cancel', () => {
  function makeMinimalConnector() {
    return {
      profile: {
        id: 'claude' as const,
        displayName: 'Claude',
        binaryOrEndpoint: 'claude',
        authMode: 'native-login' as const,
        role: 'coder' as const,
        runner: 'windows' as const,
        status: 'ready' as const,
        capabilities: {
          supportsInteractive: true,
          supportsStructuredOutput: true,
          supportsEditing: true,
          supportsResume: true
        }
      },
      probe: vi.fn(),
      runJob: vi.fn(),
      getInteractiveLaunchSpec: vi.fn(),
      setRole: vi.fn(),
      interrupt: vi.fn(),
      dispose: vi.fn()
    };
  }

  it('aborts the active workflow so the task stage becomes cancelled', async () => {
    const connector = makeMinimalConnector();

    // runJob never resolves on its own — we use it to capture the AbortSignal
    // so we can abort it externally, simulating a long-running agent step.
    let capturedSignal: AbortSignal | undefined;
    connector.runJob.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          capturedSignal = signal;
          if (signal) {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }
        })
    );

    const engine = new WorkflowEngine(
      {
        getDiff: vi.fn().mockResolvedValue(''),
        createTaskWorkspace: vi.fn().mockResolvedValue({
          worktreePath: 'D:\\repo\\.triad\\task-cancel',
          baseBranch: 'main',
          baseCommit: 'abc123',
          branchName: 'triad/test-cancellation'
        })
      } as never,
      () =>
        ({
          claude: connector,
          codex: connector,
          gemini: connector,
          ollama: connector
        }) as never
    );

    const task = makeTask();
    const updateTask = vi.fn();
    const appendArtifact = vi.fn();

    // Start the workflow in the background — do not await yet.
    const workPromise = engine.start(
      makeProject(),
      {
        workflowId: 'code-review-fix-verify',
        workflowMode: 'orchestrate',
        brief: 'Test cancellation'
      },
      updateTask,
      appendArtifact
    );

    // Wait until the signal is captured (i.e. runJob has been called)
    await vi.waitFor(() => expect(capturedSignal).toBeDefined());

    // Now cancel the workflow — the task id is injected by start() via uuid;
    // we grab it from the first updateTask call.
    const taskIdFromUpdate = updateTask.mock.calls[0]?.[0]?.id as string;
    expect(taskIdFromUpdate).toBeDefined();
    engine.cancel(taskIdFromUpdate);

    const result = await workPromise;

    expect(result.stage).toBe('cancelled');
    expect(result.errorMessage).toMatch(/cancelled/i);
  });

  it('is a no-op when no workflow is running for that taskId', () => {
    const engine = new WorkflowEngine(
      { getDiff: vi.fn().mockResolvedValue('') } as never,
      () => ({}) as never
    );

    // Should not throw even though no workflow is registered under this id
    expect(() => engine.cancel('non-existent-task-id')).not.toThrow();
  });
});
