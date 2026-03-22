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
// WorkflowEngine.continue — context compression wiring
// ---------------------------------------------------------------------------

describe('WorkflowEngine.continue context compression', () => {
  function makeConnector(agentId: 'claude' | 'codex' | 'gemini' | 'ollama') {
    return {
      profile: {
        id: agentId,
        displayName: agentId,
        binaryOrEndpoint: agentId,
        authMode: 'native-login' as const,
        role: 'reviewer' as const,
        runner: 'windows' as const,
        status: 'ready' as const,
        capabilities: {
          supportsInteractive: true,
          supportsStructuredOutput: true,
          supportsEditing: true,
          supportsResume: false
        }
      },
      probe: vi.fn(),
      runJob: vi.fn().mockResolvedValue({
        id: 'a1',
        taskId: 'task-1',
        stepId: 's1',
        agentId,
        role: 'reviewer',
        prompt: '',
        stdout: '',
        stderr: '',
        exitCode: 0,
        structuredEvents: [],
        summary: 'ok',
        finalMessage: '',
        findings: [],
        commandRuns: [],
        createdAt: new Date().toISOString()
      }),
      getInteractiveLaunchSpec: vi.fn(),
      setRole: vi.fn(),
      interrupt: vi.fn(),
      dispose: vi.fn()
    };
  }

  it('injects prior-context block into the fix prompt when artifacts are present', async () => {
    const connector = makeConnector('claude');
    const engine = new WorkflowEngine(
      { getDiff: vi.fn().mockResolvedValue('small diff') } as never,
      () => ({ claude: connector, codex: connector, gemini: connector, ollama: connector }) as never
    );

    const task = makeTask();
    task.findings = [{ severity: 'high', title: 'Bug', body: 'desc', sourceAgent: 'codex' }];
    task.artifacts = [{
      id: 'a1', taskId: task.id, stepId: 's1', agentId: 'codex', role: 'reviewer',
      prompt: '', stdout: '', stderr: '', exitCode: 0, structuredEvents: [],
      summary: 'Codex found a bug in the login handler',
      finalMessage: '', findings: task.findings, commandRuns: [],
      createdAt: new Date().toISOString()
    }];

    await engine.continue(
      makeProject(), task,
      { mode: 'single-step', stage: 'fix', agentId: 'claude', role: 'coder' },
      vi.fn(), vi.fn()
    );

    const calledPrompt: string = connector.runJob.mock.calls[0][0].prompt;
    expect(calledPrompt).toContain('Prior context');
    expect(calledPrompt).toContain('Codex found a bug in the login handler');
  });

  it('compresses large diffs for review/verify steps in continue()', async () => {
    const connector = makeConnector('codex');
    // Build a diff > 50KB
    const largeDiff = 'diff --git a/big.ts b/big.ts\n' +
      Array.from({ length: 1000 }, (_, i) =>
        `+added line ${i} with enough padding to exceed the fifty kilobyte threshold comfortably`
      ).join('\n');

    const engine = new WorkflowEngine(
      { getDiff: vi.fn().mockResolvedValue(largeDiff) } as never,
      () => ({ claude: connector, codex: connector, gemini: connector, ollama: connector }) as never
    );

    await engine.continue(
      makeProject(), makeTask(),
      { mode: 'single-step', stage: 'review', agentId: 'codex', role: 'reviewer' },
      vi.fn(), vi.fn()
    );

    const calledPrompt: string = connector.runJob.mock.calls[0][0].prompt;
    expect(calledPrompt).toContain('[Diff truncated');
    expect(calledPrompt).not.toContain('added line 0 with enough padding');
  });

  it('does not inject prior context for review (only verify)', async () => {
    const connector = makeConnector('codex');
    const engine = new WorkflowEngine(
      { getDiff: vi.fn().mockResolvedValue('small diff') } as never,
      () => ({ claude: connector, codex: connector, gemini: connector, ollama: connector }) as never
    );

    const task = makeTask();
    task.artifacts = [{
      id: 'a1', taskId: task.id, stepId: 's1', agentId: 'claude', role: 'coder',
      prompt: '', stdout: '', stderr: '', exitCode: 0, structuredEvents: [],
      summary: 'Claude wrote the code',
      finalMessage: '', findings: [], commandRuns: [],
      createdAt: new Date().toISOString()
    }];

    await engine.continue(
      makeProject(), task,
      { mode: 'single-step', stage: 'review', agentId: 'codex', role: 'reviewer' },
      vi.fn(), vi.fn()
    );

    const calledPrompt: string = connector.runJob.mock.calls[0][0].prompt;
    // Review stage does not inject prior context; verify stage does
    expect(calledPrompt).not.toContain('Prior context');
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

// ---------------------------------------------------------------------------
// WorkflowEngine session resume — prior session ID is forwarded to runJob
// ---------------------------------------------------------------------------

describe('WorkflowEngine session resume', () => {
  it('passes resumeSessionId from a prior artifact to subsequent runJob calls for the same agent', async () => {
    const capturedInputs: Array<{ resumeSessionId?: string }> = [];

    const connector = {
      profile: {
        id: 'claude' as const,
        displayName: 'Claude',
        binaryOrEndpoint: 'claude',
        authMode: 'native-login' as const,
        role: 'reviewer' as const,
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
      runJob: vi.fn().mockImplementation((input: { resumeSessionId?: string }) => {
        capturedInputs.push({ resumeSessionId: input.resumeSessionId });
        return Promise.resolve({
          id: 'artifact-1',
          taskId: 'task-1',
          stepId: 'step-1',
          agentId: 'claude',
          role: 'coder',
          prompt: '',
          stdout: '',
          stderr: '',
          exitCode: 0,
          structuredEvents: [],
          summary: 'done',
          finalMessage: '',
          findings: [],
          commandRuns: [],
          createdAt: new Date().toISOString(),
          // First call returns a session ID; second call should receive it.
          sessionId: 'ses_step1'
        });
      }),
      getInteractiveLaunchSpec: vi.fn(),
      setRole: vi.fn(),
      interrupt: vi.fn(),
      dispose: vi.fn()
    };

    const engine = new WorkflowEngine(
      { getDiff: vi.fn().mockResolvedValue('small diff') } as never,
      () => ({ claude: connector, codex: connector, gemini: connector, ollama: connector }) as never
    );

    const task = {
      id: 'task-1',
      projectId: 'project-1',
      workflowId: 'code-review-fix-verify' as const,
      workflowMode: 'orchestrate' as const,
      baseBranch: 'main',
      baseCommit: 'abc123',
      worktreePath: 'D:\\repo\\.triad\\task-1',
      stage: 'code' as const,
      brief: 'build it',
      assignedAgents: ['claude' as const],
      approvalState: 'pending' as const,
      branchName: 'triad/task-1',
      findings: [],
      artifacts: [],
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // First step: code (no prior session)
    await engine.continue(
      { id: 'p1', name: 'p', rootPath: 'D:\\repo', runnerPreference: 'windows', resolvedRunner: 'windows', isGitRepo: true, currentBranch: 'main', archivePath: 'D:\\repo\\.tw', archiveEnabled: true },
      task,
      { mode: 'single-step', stage: 'code', agentId: 'claude', role: 'coder' },
      (t) => { Object.assign(task, t); },
      vi.fn()
    );

    // Second step: fix (task now has claude artifact with sessionId from step 1)
    await engine.continue(
      { id: 'p1', name: 'p', rootPath: 'D:\\repo', runnerPreference: 'windows', resolvedRunner: 'windows', isGitRepo: true, currentBranch: 'main', archivePath: 'D:\\repo\\.tw', archiveEnabled: true },
      task,
      { mode: 'single-step', stage: 'fix', agentId: 'claude', role: 'coder' },
      (t) => { Object.assign(task, t); },
      vi.fn()
    );

    // First call had no prior session
    expect(capturedInputs[0]?.resumeSessionId).toBeUndefined();
    // Second call should carry the session ID from the first artifact
    expect(capturedInputs[1]?.resumeSessionId).toBe('ses_step1');
  });

  it('does not resume from a failed artifact even if it carries a sessionId', async () => {
    const capturedInputs: Array<{ resumeSessionId?: string }> = [];

    const connector = {
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
      runJob: vi.fn().mockImplementation((input: { resumeSessionId?: string }) => {
        capturedInputs.push({ resumeSessionId: input.resumeSessionId });
        return Promise.resolve({
          id: 'a1', taskId: 'task-1', stepId: 's1', agentId: 'claude',
          role: 'coder', prompt: '', stdout: '', stderr: '',
          exitCode: 0, structuredEvents: [], summary: 'ok', finalMessage: '',
          findings: [], commandRuns: [], createdAt: new Date().toISOString()
        });
      }),
      getInteractiveLaunchSpec: vi.fn(),
      setRole: vi.fn(),
      interrupt: vi.fn(),
      dispose: vi.fn()
    };

    const engine = new WorkflowEngine(
      { getDiff: vi.fn().mockResolvedValue('') } as never,
      () => ({ claude: connector, codex: connector, gemini: connector, ollama: connector }) as never
    );

    const task = {
      id: 'task-1', projectId: 'p1', workflowId: 'code-review-fix-verify' as const,
      workflowMode: 'orchestrate' as const, baseBranch: 'main', baseCommit: 'abc',
      worktreePath: 'D:\\repo\\.triad\\t1', stage: 'fix' as const, brief: 'x',
      assignedAgents: ['claude' as const], approvalState: 'pending' as const,
      branchName: 'triad/t1', findings: [],
      artifacts: [{
        id: 'failed-artifact', taskId: 'task-1', stepId: 'step-prev',
        agentId: 'claude' as const, role: 'coder' as const,
        prompt: '', stdout: '', stderr: '',
        exitCode: 1,                       // failed run
        sessionId: 'ses_should_not_use',   // has a session ID but run failed
        structuredEvents: [], summary: 'failed', finalMessage: '',
        findings: [], commandRuns: [], createdAt: new Date().toISOString()
      }],
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await engine.continue(
      { id: 'p1', name: 'p', rootPath: 'D:\\repo', runnerPreference: 'windows', resolvedRunner: 'windows', isGitRepo: true, currentBranch: 'main', archivePath: 'D:\\repo\\.tw', archiveEnabled: true },
      task,
      { mode: 'single-step', stage: 'fix', agentId: 'claude', role: 'coder' },
      (t) => { Object.assign(task, t); },
      vi.fn()
    );

    expect(capturedInputs[0]?.resumeSessionId).toBeUndefined();
  });

  it('does not pass resumeSessionId for agents where supportsResume is false', async () => {
    const capturedInput = { resumeSessionId: 'sentinel' };

    const codexConnector = {
      profile: {
        id: 'codex' as const,
        displayName: 'Codex',
        binaryOrEndpoint: 'codex',
        authMode: 'native-login' as const,
        role: 'reviewer' as const,
        runner: 'windows' as const,
        status: 'ready' as const,
        capabilities: {
          supportsInteractive: true,
          supportsStructuredOutput: true,
          supportsEditing: true,
          supportsResume: false   // <-- does NOT support resume
        }
      },
      probe: vi.fn(),
      runJob: vi.fn().mockImplementation((input: { resumeSessionId?: string }) => {
        capturedInput.resumeSessionId = input.resumeSessionId as string;
        return Promise.resolve({
          id: 'a1', taskId: 'task-1', stepId: 's1', agentId: 'codex',
          role: 'reviewer', prompt: '', stdout: '', stderr: '', exitCode: 0,
          structuredEvents: [], summary: 'ok', finalMessage: '',
          findings: [], commandRuns: [], createdAt: new Date().toISOString(),
          sessionId: 'ses_codex'   // even if returned, should not propagate
        });
      }),
      getInteractiveLaunchSpec: vi.fn(),
      setRole: vi.fn(),
      interrupt: vi.fn(),
      dispose: vi.fn()
    };

    const engine = new WorkflowEngine(
      { getDiff: vi.fn().mockResolvedValue('diff') } as never,
      () => ({ claude: codexConnector, codex: codexConnector, gemini: codexConnector, ollama: codexConnector }) as never
    );

    const task = {
      id: 'task-1', projectId: 'p1', workflowId: 'code-review-fix-verify' as const,
      workflowMode: 'orchestrate' as const, baseBranch: 'main', baseCommit: 'abc',
      worktreePath: 'D:\\repo\\.triad\\t1', stage: 'review' as const, brief: 'x',
      assignedAgents: ['codex' as const], approvalState: 'pending' as const,
      branchName: 'triad/t1', findings: [], artifacts: [], steps: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };

    // First call — seeds an artifact with sessionId
    await engine.continue(
      { id: 'p1', name: 'p', rootPath: 'D:\\repo', runnerPreference: 'windows', resolvedRunner: 'windows', isGitRepo: true, currentBranch: 'main', archivePath: 'D:\\repo\\.tw', archiveEnabled: true },
      task,
      { mode: 'single-step', stage: 'review', agentId: 'codex', role: 'reviewer' },
      (t) => { Object.assign(task, t); },
      vi.fn()
    );

    // Second call — supportsResume: false, so resumeSessionId must be undefined
    await engine.continue(
      { id: 'p1', name: 'p', rootPath: 'D:\\repo', runnerPreference: 'windows', resolvedRunner: 'windows', isGitRepo: true, currentBranch: 'main', archivePath: 'D:\\repo\\.tw', archiveEnabled: true },
      task,
      { mode: 'single-step', stage: 'verify', agentId: 'codex', role: 'reviewer' },
      (t) => { Object.assign(task, t); },
      vi.fn()
    );

    expect(capturedInput.resumeSessionId).toBeUndefined();
  });
});
