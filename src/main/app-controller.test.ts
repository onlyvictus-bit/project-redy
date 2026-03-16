import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentProfile, ProjectRef, TaskRun } from '@shared/types';
import { AppController } from './app-controller';

// ---------------------------------------------------------------------------
// Shared mock state — must be declared via vi.hoisted so that vi.mock
// factories (which are hoisted before module evaluation) can reference them.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const caps = {
    supportsInteractive: true,
    supportsStructuredOutput: true,
    supportsEditing: true,
    supportsResume: true
  };

  function makeConnector(id: string) {
    const profile: AgentProfile = {
      id: id as AgentProfile['id'],
      displayName: id,
      binaryOrEndpoint: id,
      authMode: 'native-login',
      role: 'coder',
      runner: 'windows',
      status: 'installed',
      capabilities: { ...caps }
    };
    return {
      profile,
      probe: vi.fn().mockResolvedValue({ profile: { ...profile }, rawOutput: '' }),
      runJob: vi.fn(),
      getInteractiveLaunchSpec: vi.fn(),
      setRole: vi.fn(),
      interrupt: vi.fn(),
      dispose: vi.fn()
    };
  }

  const connectors = {
    claude: makeConnector('claude'),
    codex: makeConnector('codex'),
    gemini: makeConnector('gemini'),
    ollama: makeConnector('ollama')
  };

  return {
    dialog: { showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }) },
    shell: { openPath: vi.fn().mockResolvedValue('') },
    processRunner: {
      checkWslAvailable: vi.fn().mockResolvedValue(false),
      probeBinary: vi.fn().mockResolvedValue(undefined),
      run: vi.fn(),
      spawnInteractive: vi.fn()
    },
    persistence: {
      loadAgentProfiles: vi.fn().mockReturnValue([]),
      loadLatestProject: vi.fn().mockReturnValue(null),
      loadTasks: vi.fn().mockReturnValue([]),
      saveAgentProfile: vi.fn(),
      saveProject: vi.fn(),
      saveTask: vi.fn(),
      appendArtifact: vi.fn()
    },
    ollamaManager: {
      probe: vi.fn().mockResolvedValue({
        available: false,
        running: false,
        owner: 'none',
        endpoint: 'http://localhost:11434'
      }),
      getStatus: vi.fn().mockReturnValue({
        available: false,
        running: false,
        owner: 'none',
        endpoint: 'http://localhost:11434'
      }),
      setRole: vi.fn(),
      restoreActiveModel: vi.fn(),
      shutdownIfManaged: vi.fn().mockResolvedValue({
        available: false,
        running: false,
        owner: 'none',
        endpoint: 'http://localhost:11434'
      }),
      shutdownManagedOnQuit: vi.fn()
    },
    archive: {
      getArchiveSummary: vi.fn().mockReturnValue(null),
      ensureProject: vi.fn().mockReturnValue({ path: '/tmp/archive' }),
      saveSnapshot: vi.fn().mockReturnValue(null),
      appendEvent: vi.fn(),
      appendTerminalChunk: vi.fn(),
      saveTerminalSession: vi.fn(),
      saveTask: vi.fn()
    },
    terminalManager: {
      on: vi.fn(),
      off: vi.fn(),
      start: vi.fn(),
      startRaw: vi.fn().mockReturnValue({ id: 'auth-session-1', agentId: 'claude', title: 'Connect Claude Code', cwd: '/', runner: 'wsl', createdAt: '' }),
      stop: vi.fn(),
      stopAll: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      getSession: vi.fn(),
      list: vi.fn().mockReturnValue([])
    },
    workspaceManager: {
      resolveRunner: vi.fn().mockReturnValue('windows'),
      inspectProject: vi.fn(),
      createTaskWorkspace: vi.fn(),
      promoteTask: vi.fn().mockResolvedValue(undefined),
      gcStaleWorktrees: vi.fn().mockResolvedValue([])
    },
    connectors
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp/userData'), on: vi.fn() },
  dialog: mocks.dialog,
  shell: mocks.shell
}));

vi.mock('./services/process-runner', () => ({
  ProcessRunner: vi.fn().mockImplementation(() => mocks.processRunner)
}));

vi.mock('./services/persistence', () => ({
  PersistenceService: vi.fn().mockImplementation(() => mocks.persistence)
}));

vi.mock('./services/ollama-manager', () => ({
  OllamaManager: vi.fn().mockImplementation(() => mocks.ollamaManager)
}));

vi.mock('./services/project-archive', () => ({
  ProjectArchiveService: vi.fn().mockImplementation(() => mocks.archive)
}));

vi.mock('./services/terminal-manager', () => ({
  TerminalManager: vi.fn().mockImplementation(() => mocks.terminalManager)
}));

vi.mock('./services/workspace-manager', () => ({
  WorkspaceManager: vi.fn().mockImplementation(() => mocks.workspaceManager)
}));

vi.mock('./services/workflow-engine', () => ({
  WorkflowEngine: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('./connectors', () => ({
  createConnector: vi.fn().mockImplementation(
    (profile: AgentProfile) => mocks.connectors[profile.id as keyof typeof mocks.connectors]
  )
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<ProjectRef> = {}): ProjectRef {
  return {
    id: '/project',
    name: 'my-project',
    rootPath: '/project',
    runnerPreference: 'auto',
    isGitRepo: true,
    currentBranch: 'main',
    archivePath: '/project/.triad-workbench',
    archiveEnabled: true,
    ...overrides
  };
}

function makeTask(id: string, overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id,
    projectId: '/project',
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc123',
    worktreePath: '/tmp/worktrees/' + id,
    stage: 'promote',
    brief: 'Test task',
    assignedAgents: ['claude', 'codex'],
    approvalState: 'pending',
    branchName: 'triad/test',
    findings: [],
    artifacts: [],
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Restore connector runner and clear transient profile fields (tests may mutate them).
  for (const c of Object.values(mocks.connectors)) {
    c.profile.runner = 'windows';
    delete (c.profile as unknown as Record<string, unknown>).selectedModel;
    c.probe.mockResolvedValue({ profile: { ...c.profile }, rawOutput: '' });
  }

  // Restore service defaults
  mocks.processRunner.checkWslAvailable.mockResolvedValue(false);
  mocks.shell.openPath.mockResolvedValue('');
  mocks.archive.getArchiveSummary.mockReturnValue(null);
  mocks.archive.saveSnapshot.mockReturnValue(null);
  mocks.persistence.loadAgentProfiles.mockReturnValue([]);
  mocks.persistence.loadLatestProject.mockReturnValue(null);
  mocks.persistence.loadTasks.mockReturnValue([]);
  mocks.ollamaManager.probe.mockResolvedValue({
    available: false,
    running: false,
    owner: 'none',
    endpoint: 'http://localhost:11434'
  });
  mocks.ollamaManager.getStatus.mockReturnValue({
    available: false,
    running: false,
    owner: 'none',
    endpoint: 'http://localhost:11434'
  });
  mocks.terminalManager.list.mockReturnValue([]);
  mocks.terminalManager.startRaw.mockReturnValue({ id: 'auth-session-1', agentId: 'claude', title: 'Connect Claude Code', cwd: '/', runner: 'wsl', createdAt: '' });
  mocks.workspaceManager.promoteTask.mockResolvedValue(undefined);
  mocks.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
  // Reset getAuthLaunchSpec — individual tests add it when needed.
  delete (mocks.connectors.claude as Record<string, unknown>).getAuthLaunchSpec;
});

// ---------------------------------------------------------------------------
// setProjectRunner — auto runner selection
// ---------------------------------------------------------------------------

describe('AppController.setProjectRunner', () => {
  it('picks wsl for CLI connectors when auto is chosen and WSL is available', async () => {
    mocks.processRunner.checkWslAvailable.mockResolvedValue(true);
    const controller = new AppController();
    (controller as unknown as { snapshot: { project: ProjectRef } }).snapshot.project = makeProject();

    await controller.setProjectRunner('auto');

    expect(mocks.connectors.claude.profile.runner).toBe('wsl');
    expect(mocks.connectors.codex.profile.runner).toBe('wsl');
    expect(mocks.connectors.gemini.profile.runner).toBe('wsl');
  });

  it('stores resolvedRunner on snapshot.project so workspace layer uses it', async () => {
    mocks.processRunner.checkWslAvailable.mockResolvedValue(true);
    const controller = new AppController();
    const snap = controller as unknown as { snapshot: { project: ProjectRef } };
    snap.snapshot.project = makeProject();

    await controller.setProjectRunner('auto');

    expect(snap.snapshot.project.resolvedRunner).toBe('wsl');
  });

  it('picks windows for CLI connectors when auto is chosen and WSL is unavailable', async () => {
    mocks.processRunner.checkWslAvailable.mockResolvedValue(false);
    const controller = new AppController();
    (controller as unknown as { snapshot: { project: ProjectRef } }).snapshot.project = makeProject();

    await controller.setProjectRunner('auto');

    expect(mocks.connectors.claude.profile.runner).toBe('windows');
    expect(mocks.connectors.codex.profile.runner).toBe('windows');
    expect(mocks.connectors.gemini.profile.runner).toBe('windows');
  });

  it('does not change the ollama connector runner regardless of WSL state', async () => {
    mocks.processRunner.checkWslAvailable.mockResolvedValue(true);
    mocks.connectors.ollama.profile.runner = 'http-local' as never;
    const controller = new AppController();
    (controller as unknown as { snapshot: { project: ProjectRef } }).snapshot.project = makeProject();

    await controller.setProjectRunner('auto');

    expect(mocks.connectors.ollama.profile.runner).toBe('http-local');
  });

  it('uses an explicit runner when preference is not auto', async () => {
    const controller = new AppController();
    (controller as unknown as { snapshot: { project: ProjectRef } }).snapshot.project = makeProject();

    await controller.setProjectRunner('wsl');

    expect(mocks.connectors.claude.profile.runner).toBe('wsl');
    expect(mocks.processRunner.checkWslAvailable).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// bootstrap — deep probe at startup
// ---------------------------------------------------------------------------

describe('AppController.bootstrap', () => {
  it('calls probe(true) on every connector at startup', async () => {
    const controller = new AppController();
    await controller.bootstrap();

    for (const c of Object.values(mocks.connectors)) {
      expect(c.probe).toHaveBeenCalledWith(true);
    }
  });

  it('does not call probe with false at startup', async () => {
    const controller = new AppController();
    await controller.bootstrap();

    for (const c of Object.values(mocks.connectors)) {
      expect(c.probe).not.toHaveBeenCalledWith(false);
    }
  });

  it('syncs CLI connector runners from the persisted project runner preference on startup', async () => {
    mocks.processRunner.checkWslAvailable.mockResolvedValue(true);
    mocks.persistence.loadLatestProject.mockReturnValue(makeProject({ runnerPreference: 'auto', resolvedRunner: 'windows' }));

    const controller = new AppController();
    await controller.bootstrap();

    expect(mocks.connectors.claude.profile.runner).toBe('wsl');
    expect(mocks.connectors.codex.profile.runner).toBe('wsl');
    expect(mocks.connectors.gemini.profile.runner).toBe('wsl');
  });

  it('does not change the ollama connector runner during bootstrap runner sync', async () => {
    mocks.connectors.ollama.profile.runner = 'http-local' as never;
    mocks.processRunner.checkWslAvailable.mockResolvedValue(true);
    mocks.persistence.loadLatestProject.mockReturnValue(makeProject({ runnerPreference: 'auto' }));

    const controller = new AppController();
    await controller.bootstrap();

    expect(mocks.connectors.ollama.profile.runner).toBe('http-local');
  });

  it('skips runner sync when no project is persisted', async () => {
    mocks.persistence.loadLatestProject.mockReturnValue(null);

    const controller = new AppController();
    await controller.bootstrap();

    expect(mocks.processRunner.checkWslAvailable).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// promoteTask — open-task-branch and keep-worktree
// ---------------------------------------------------------------------------

describe('AppController.promoteTask', () => {
  it('open-task-branch opens the worktree folder via shell.openPath', async () => {
    mocks.shell.openPath.mockResolvedValue('');
    const controller = new AppController();
    const task = makeTask('task-abc');
    (controller as unknown as { snapshot: { project: ProjectRef; tasks: TaskRun[] } }).snapshot.project = makeProject();
    (controller as unknown as { snapshot: { project: ProjectRef; tasks: TaskRun[] } }).snapshot.tasks = [task];

    await controller.promoteTask('task-abc', 'open-task-branch');

    expect(mocks.shell.openPath).toHaveBeenCalledWith(task.worktreePath);
  });

  it('open-task-branch does not mark the task as approved or done', async () => {
    mocks.shell.openPath.mockResolvedValue('');
    const controller = new AppController();
    const task = makeTask('task-abc');
    const snap = (controller as unknown as { snapshot: { project: ProjectRef; tasks: TaskRun[] } }).snapshot;
    snap.project = makeProject();
    snap.tasks = [task];

    await controller.promoteTask('task-abc', 'open-task-branch');

    expect(task.approvalState).not.toBe('approved');
    expect(task.stage).not.toBe('done');
  });

  it('keep-worktree does not call workspaceManager.promoteTask', async () => {
    const controller = new AppController();
    const task = makeTask('task-def');
    const snap = (controller as unknown as { snapshot: { project: ProjectRef; tasks: TaskRun[] } }).snapshot;
    snap.project = makeProject();
    snap.tasks = [task];

    await controller.promoteTask('task-def', 'keep-worktree');

    expect(mocks.workspaceManager.promoteTask).not.toHaveBeenCalled();
  });

  it('keep-worktree does not mark the task as approved or done', async () => {
    const controller = new AppController();
    const task = makeTask('task-def');
    const snap = (controller as unknown as { snapshot: { project: ProjectRef; tasks: TaskRun[] } }).snapshot;
    snap.project = makeProject();
    snap.tasks = [task];

    await controller.promoteTask('task-def', 'keep-worktree');

    expect(task.approvalState).not.toBe('approved');
    expect(task.stage).not.toBe('done');
  });
});

// ---------------------------------------------------------------------------
// openProjectArchive — guard when archive folder not yet created
// ---------------------------------------------------------------------------

describe('AppController.openProjectArchive', () => {
  it('throws a clear error when archive is disabled and the folder does not exist', async () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    mocks.archive.getArchiveSummary.mockReturnValue({ path: '/project/.triad-workbench' });
    const controller = new AppController();
    (controller as unknown as { snapshot: { project: ProjectRef } }).snapshot.project =
      makeProject({ archiveEnabled: false });

    await expect(controller.openProjectArchive()).rejects.toThrow(
      'Archive folder has not been created yet'
    );

    existsSpy.mockRestore();
  });

  it('opens the folder when the archive path exists', async () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    mocks.shell.openPath.mockResolvedValue('');
    mocks.archive.getArchiveSummary.mockReturnValue({ path: '/project/.triad-workbench' });

    const controller = new AppController();
    (controller as unknown as { snapshot: { project: ProjectRef } }).snapshot.project =
      makeProject({ archiveEnabled: false });

    await controller.openProjectArchive();

    expect(mocks.shell.openPath).toHaveBeenCalledWith('/project/.triad-workbench');

    existsSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// setOllamaRole — agent panel sync
// ---------------------------------------------------------------------------

describe('AppController.setOllamaRole', () => {
  it('updates snapshot.agents.ollama via connector probe after role change', async () => {
    const updatedProfile = {
      ...mocks.connectors.ollama.profile,
      role: 'monitor' as const,
      status: 'running' as const,
      message: 'Monitoring active.'
    };
    mocks.connectors.ollama.probe.mockResolvedValue({ profile: updatedProfile, rawOutput: '' });
    mocks.ollamaManager.setRole.mockResolvedValue({
      available: true,
      running: true,
      owner: 'app-managed',
      endpoint: 'http://localhost:11434'
    });

    const controller = new AppController();
    const snap = controller as unknown as { snapshot: { agents: { ollama: typeof updatedProfile } } };

    await controller.setOllamaRole('monitor');

    expect(snap.snapshot.agents.ollama.status).toBe('running');
    expect(snap.snapshot.agents.ollama.message).toBe('Monitoring active.');
  });

  it('calls connector probe (not just profile mutation) so status/message reflect Ollama state', async () => {
    mocks.ollamaManager.setRole.mockResolvedValue({
      available: true,
      running: true,
      owner: 'app-managed',
      endpoint: 'http://localhost:11434'
    });

    const controller = new AppController();
    await controller.setOllamaRole('monitor');

    expect(mocks.connectors.ollama.probe).toHaveBeenCalled();
    expect(mocks.persistence.saveAgentProfile).toHaveBeenCalled();
  });

  it('persists the selected role on snapshot.agents.ollama even when probe does not override it', async () => {
    // Default probe mock returns profile with role: 'coder' — the fix must override it.
    mocks.ollamaManager.setRole.mockResolvedValue({
      available: true,
      running: true,
      owner: 'app-managed',
      endpoint: 'http://localhost:11434'
    });

    const controller = new AppController();
    const snap = controller as unknown as { snapshot: { agents: { ollama: AgentProfile } } };

    await controller.setOllamaRole('tester');

    expect(snap.snapshot.agents.ollama.role).toBe('tester');
  });

  it('forwards the model argument to ollamaManager.setRole', async () => {
    mocks.ollamaManager.setRole.mockResolvedValue({
      available: true,
      running: true,
      owner: 'app-managed',
      endpoint: 'http://localhost:11434'
    });

    const controller = new AppController();
    await controller.setOllamaRole('developer', 'qwen3.5:9b');

    expect(mocks.ollamaManager.setRole).toHaveBeenCalledWith('developer', 'qwen3.5:9b');
  });
});

// ---------------------------------------------------------------------------
// shutdownOllama — role stamp
// ---------------------------------------------------------------------------

describe('AppController.shutdownOllama', () => {
  it('stamps role off on snapshot.agents.ollama so Sleep personality is reflected in the UI', async () => {
    const controller = new AppController();
    const snap = controller as unknown as { snapshot: { agents: { ollama: AgentProfile } } };

    await controller.shutdownOllama();

    expect(snap.snapshot.agents.ollama.role).toBe('off');
  });

  it('saves the off-role profile to persistence so Sleep survives app restart', async () => {
    const controller = new AppController();
    await controller.shutdownOllama();

    const saved = mocks.persistence.saveAgentProfile.mock.calls.at(-1)?.[0] as AgentProfile | undefined;
    expect(saved?.role).toBe('off');
  });
});

// ---------------------------------------------------------------------------
// selectProject — runner sync to connectors
// ---------------------------------------------------------------------------

describe('AppController.selectProject', () => {
  it('syncs the resolved runner to CLI connectors when a project is selected', async () => {
    mocks.processRunner.checkWslAvailable.mockResolvedValue(true);
    mocks.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/new-project'] });
    mocks.workspaceManager.inspectProject.mockResolvedValue(
      makeProject({ rootPath: '/new-project', resolvedRunner: 'wsl' })
    );

    const controller = new AppController();
    await controller.selectProject();

    expect(mocks.connectors.claude.profile.runner).toBe('wsl');
    expect(mocks.connectors.codex.profile.runner).toBe('wsl');
    expect(mocks.connectors.gemini.profile.runner).toBe('wsl');
  });

  it('does not change the ollama connector runner when a project is selected', async () => {
    mocks.connectors.ollama.profile.runner = 'http-local' as never;
    mocks.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/new-project'] });
    mocks.workspaceManager.inspectProject.mockResolvedValue(
      makeProject({ rootPath: '/new-project', resolvedRunner: 'wsl' })
    );

    const controller = new AppController();
    await controller.selectProject();

    expect(mocks.connectors.ollama.profile.runner).toBe('http-local');
  });

  it('returns early without changing connectors when the dialog is cancelled', async () => {
    mocks.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    const controller = new AppController();
    await controller.selectProject();

    expect(mocks.workspaceManager.inspectProject).not.toHaveBeenCalled();
    expect(mocks.connectors.claude.profile.runner).toBe('windows');
  });
});

// ---------------------------------------------------------------------------
// startAgentAuth — duplicate session guard
// ---------------------------------------------------------------------------

describe('AppController.startAgentAuth', () => {
  it('returns the existing session id when an auth session is already in progress', async () => {
    (mocks.connectors.claude as Record<string, unknown>).getAuthLaunchSpec = vi.fn().mockReturnValue({
      command: 'claude', args: ['auth', 'login'], cwd: '/', runner: 'wsl'
    });
    const session = { id: 'auth-session-1', agentId: 'claude', title: 'Connect Claude Code', cwd: '/', runner: 'wsl', createdAt: '' };
    mocks.terminalManager.startRaw.mockReturnValue(session);
    mocks.terminalManager.list.mockReturnValue([session]);

    const controller = new AppController();
    const firstId = await controller.startAgentAuth('claude');
    const secondId = await controller.startAgentAuth('claude');

    expect(firstId).toBe('auth-session-1');
    expect(secondId).toBe('auth-session-1');
    expect(mocks.terminalManager.startRaw).toHaveBeenCalledTimes(1);
  });

  it('throws when an auth session is in flight and no matching terminal is listed', async () => {
    (mocks.connectors.claude as Record<string, unknown>).getAuthLaunchSpec = vi.fn().mockReturnValue({
      command: 'claude', args: ['auth', 'login'], cwd: '/', runner: 'wsl'
    });
    // list returns empty — terminal was registered then cleared before second call
    mocks.terminalManager.list.mockReturnValue([]);

    const controller = new AppController();
    await controller.startAgentAuth('claude');
    await expect(controller.startAgentAuth('claude')).rejects.toThrow('already in progress');
  });

  it('throws when the agent does not support in-app auth', async () => {
    const controller = new AppController();
    // ollama connector has no getAuthLaunchSpec
    await expect(controller.startAgentAuth('ollama')).rejects.toThrow('does not support in-app authentication');
  });

  it('clears the in-flight guard so Connect can be retried when PTY startup throws', async () => {
    (mocks.connectors.claude as Record<string, unknown>).getAuthLaunchSpec = vi.fn().mockReturnValue({
      command: 'claude', args: ['auth', 'login'], cwd: '/', runner: 'wsl'
    });
    mocks.terminalManager.startRaw.mockImplementationOnce(() => { throw new Error('node-pty spawn failed'); });
    mocks.terminalManager.startRaw.mockReturnValue({ id: 'auth-session-2', agentId: 'claude', title: 'Connect Claude Code', cwd: '/', runner: 'wsl', createdAt: '' });
    mocks.terminalManager.list.mockReturnValue([]);

    const controller = new AppController();
    await expect(controller.startAgentAuth('claude')).rejects.toThrow('node-pty spawn failed');

    // Second call should succeed — the guard was cleared on failure.
    const sessionId = await controller.startAgentAuth('claude');
    expect(sessionId).toBe('auth-session-2');
  });
});

// ---------------------------------------------------------------------------
// bootstrap — interrupted task recovery
// ---------------------------------------------------------------------------

describe('AppController.bootstrap (interrupted task recovery)', () => {
  it('marks a task as error when a step is still running on startup', async () => {
    const runningTask = makeTask('task-interrupted', {
      stage: 'code',
      steps: [
        {
          id: 'step-1',
          stage: 'code',
          agentId: 'claude',
          startedAt: new Date().toISOString(),
          status: 'running'
        }
      ]
    });
    mocks.persistence.loadLatestProject.mockReturnValue(makeProject());
    mocks.persistence.loadTasks.mockReturnValue([runningTask]);

    const controller = new AppController();
    await controller.bootstrap();

    const snap = (controller as unknown as { snapshot: { tasks: TaskRun[] } }).snapshot;
    const recovered = snap.tasks.find((t) => t.id === 'task-interrupted');
    expect(recovered?.stage).toBe('error');
    expect(recovered?.errorMessage).toMatch(/interrupted/i);
  });

  it('flips running steps to failed and stamps completedAt during recovery', async () => {
    const runningTask = makeTask('task-interrupted', {
      stage: 'review',
      steps: [
        {
          id: 'step-a',
          stage: 'code',
          agentId: 'claude',
          startedAt: new Date().toISOString(),
          status: 'completed',
          completedAt: new Date().toISOString()
        },
        {
          id: 'step-b',
          stage: 'review',
          agentId: 'codex',
          startedAt: new Date().toISOString(),
          status: 'running'
        }
      ]
    });
    mocks.persistence.loadLatestProject.mockReturnValue(makeProject());
    mocks.persistence.loadTasks.mockReturnValue([runningTask]);

    const controller = new AppController();
    await controller.bootstrap();

    const snap = (controller as unknown as { snapshot: { tasks: TaskRun[] } }).snapshot;
    const recovered = snap.tasks.find((t) => t.id === 'task-interrupted');
    const failedStep = recovered?.steps.find((s) => s.id === 'step-b');
    const completedStep = recovered?.steps.find((s) => s.id === 'step-a');
    expect(failedStep?.status).toBe('failed');
    expect(failedStep?.completedAt).toBeDefined();
    expect(completedStep?.status).toBe('completed');
  });

  it('persists the recovered task state to the DB', async () => {
    const runningTask = makeTask('task-persisted', {
      stage: 'fix',
      steps: [{ id: 'step-1', stage: 'fix', agentId: 'claude', startedAt: new Date().toISOString(), status: 'running' }]
    });
    mocks.persistence.loadLatestProject.mockReturnValue(makeProject());
    mocks.persistence.loadTasks.mockReturnValue([runningTask]);

    const controller = new AppController();
    await controller.bootstrap();

    const savedCall = mocks.persistence.saveTask.mock.calls.find(
      ([t]) => (t as TaskRun).id === 'task-persisted'
    );
    expect(savedCall).toBeDefined();
    expect((savedCall?.[0] as TaskRun).stage).toBe('error');
  });

  it('does not modify tasks that are already in a terminal stage', async () => {
    const doneTask = makeTask('task-done', { stage: 'done', steps: [] });
    const errorTask = makeTask('task-error', { stage: 'error', steps: [] });
    const promoteTask = makeTask('task-promote', { stage: 'promote', steps: [] });
    mocks.persistence.loadLatestProject.mockReturnValue(makeProject());
    mocks.persistence.loadTasks.mockReturnValue([doneTask, errorTask, promoteTask]);

    const controller = new AppController();
    await controller.bootstrap();

    // saveTask should not be called for any of these (no running steps to recover)
    const recoveryCall = mocks.persistence.saveTask.mock.calls.find(
      ([t]) => ['task-done', 'task-error', 'task-promote'].includes((t as TaskRun).id)
    );
    expect(recoveryCall).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// bootstrap — Ollama model restoration
// ---------------------------------------------------------------------------

describe('AppController.bootstrap (Ollama model restoration)', () => {
  it('restores the selected Ollama model into OllamaManager when a persisted model exists', async () => {
    mocks.persistence.loadAgentProfiles.mockReturnValue([
      { ...mocks.connectors.ollama.profile, selectedModel: 'qwen3.5:9b' }
    ]);

    const controller = new AppController();
    await controller.bootstrap();

    expect(mocks.ollamaManager.restoreActiveModel).toHaveBeenCalledWith('qwen3.5:9b');
  });

  it('does not call restoreActiveModel when no model is persisted', async () => {
    mocks.persistence.loadAgentProfiles.mockReturnValue([
      { ...mocks.connectors.ollama.profile } // no selectedModel
    ]);

    const controller = new AppController();
    await controller.bootstrap();

    expect(mocks.ollamaManager.restoreActiveModel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setOllamaRole — selectedModel persistence
// ---------------------------------------------------------------------------

describe('AppController.setOllamaRole (selectedModel persistence)', () => {
  it('persists the model when a model is provided', async () => {
    mocks.ollamaManager.setRole.mockResolvedValue({
      available: true, running: true, owner: 'app-managed', endpoint: 'http://localhost:11434'
    });

    const controller = new AppController();
    await controller.setOllamaRole('developer', 'qwen3.5:9b');

    const snap = controller as unknown as { snapshot: { agents: { ollama: AgentProfile } } };
    expect(snap.snapshot.agents.ollama.selectedModel).toBe('qwen3.5:9b');
    const saved = mocks.persistence.saveAgentProfile.mock.calls.at(-1)?.[0] as AgentProfile;
    expect(saved.selectedModel).toBe('qwen3.5:9b');
  });

  it('does not overwrite an existing selectedModel when no model is provided', async () => {
    // Simulate the connector having a selectedModel already set (e.g. from a prior setOllamaRole call).
    mocks.connectors.ollama.profile.selectedModel = 'llama3:8b';
    // Mirror production behaviour: probe returns the current profile (including selectedModel).
    mocks.connectors.ollama.probe.mockResolvedValue({
      profile: { ...mocks.connectors.ollama.profile },
      rawOutput: ''
    });
    mocks.ollamaManager.setRole.mockResolvedValue({
      available: true, running: true, owner: 'app-managed', endpoint: 'http://localhost:11434'
    });

    const controller = new AppController();
    await controller.setOllamaRole('monitor');

    const snap = controller as unknown as { snapshot: { agents: { ollama: AgentProfile } } };
    // selectedModel from the connector profile must survive the setOllamaRole call.
    expect(snap.snapshot.agents.ollama.selectedModel).toBe('llama3:8b');
  });
});
