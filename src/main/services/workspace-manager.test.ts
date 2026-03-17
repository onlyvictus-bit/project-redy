import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectRef, TaskRun } from '@shared/types';
import { WorkspaceManager } from './workspace-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<ProjectRef> = {}): ProjectRef {
  return {
    id: '/project',
    name: 'my-project',
    rootPath: '/project',
    runnerPreference: 'windows',
    resolvedRunner: 'windows',
    isGitRepo: true,
    currentBranch: 'main',
    archivePath: '/project/.triad-workbench',
    archiveEnabled: true,
    ...overrides
  };
}

function makeTask(id: string, worktreePath: string, overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id,
    projectId: '/project',
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc123',
    worktreePath,
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

function makeProcessRunner() {
  return {
    run: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    spawnInteractive: vi.fn(),
    checkWslAvailable: vi.fn().mockResolvedValue(false),
    probeBinary: vi.fn().mockResolvedValue(undefined)
  };
}

// ---------------------------------------------------------------------------
// Tests: cleanupTaskWorkspace path traversal guard
// ---------------------------------------------------------------------------

describe('WorkspaceManager.cleanupTaskWorkspace', () => {
  let tmpDir: string;
  let processRunner: ReturnType<typeof makeProcessRunner>;
  let manager: WorkspaceManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-test-'));
    processRunner = makeProcessRunner();
    // WorkspaceManager constructor calls mkdirSync on workspaceRoot
    manager = new WorkspaceManager(processRunner as never, tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws when worktreePath is outside workspaceRoot', async () => {
    const task = makeTask('task-1', '/etc/passwd');
    const project = makeProject();

    await expect(manager.cleanupTaskWorkspace(task, project)).rejects.toThrow(
      'Refusing to clean up worktree'
    );

    expect(processRunner.run).not.toHaveBeenCalled();
  });

  it('does not throw when worktreePath is inside workspaceRoot', async () => {
    const worktreePath = path.join(tmpDir, 'task-legit');
    const task = makeTask('task-legit', worktreePath);
    const project = makeProject();

    processRunner.run.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await expect(manager.cleanupTaskWorkspace(task, project)).resolves.not.toThrow();
    expect(processRunner.run).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['worktree', 'remove', '--force']),
      expect.anything()
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: listStaleWorktrees
// ---------------------------------------------------------------------------

describe('WorkspaceManager.listStaleWorktrees', () => {
  let processRunner: ReturnType<typeof makeProcessRunner>;

  it('returns empty array when workspaceRoot does not exist', async () => {
    processRunner = makeProcessRunner();
    const nonExistentRoot = path.join(os.tmpdir(), `wm-nonexistent-${Date.now()}`);

    // Skip the mkdirSync so root truly does not exist
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    const manager = new WorkspaceManager(processRunner as never, nonExistentRoot);
    mkdirSpy.mockRestore();

    // Mock existsSync to return false for this specific root
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const result = await manager.listStaleWorktrees(makeProject());
    existsSpy.mockRestore();

    expect(result).toEqual([]);
    expect(processRunner.run).not.toHaveBeenCalled();
  });

  it('returns empty array when git worktree list throws', async () => {
    processRunner = makeProcessRunner();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-stale-'));

    try {
      const manager = new WorkspaceManager(processRunner as never, tmpDir);

      // Create a subdirectory so dirs.length > 0 (triggers git call)
      fs.mkdirSync(path.join(tmpDir, 'orphan-task'));

      // Simulate git failure
      processRunner.run.mockRejectedValue(new Error('git command failed'));

      const result = await manager.listStaleWorktrees(makeProject());
      expect(result).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns empty array when workspaceRoot has no subdirectories', async () => {
    processRunner = makeProcessRunner();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-empty-'));

    try {
      const manager = new WorkspaceManager(processRunner as never, tmpDir);
      // No subdirectories — create a file to confirm it is ignored
      fs.writeFileSync(path.join(tmpDir, 'not-a-dir.txt'), 'data');

      const result = await manager.listStaleWorktrees(makeProject());
      expect(result).toEqual([]);
      // git should not be queried if there are no dirs
      expect(processRunner.run).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: gcStaleWorktrees
// ---------------------------------------------------------------------------

describe('WorkspaceManager.gcStaleWorktrees', () => {
  let tmpDir: string;
  let processRunner: ReturnType<typeof makeProcessRunner>;
  let manager: WorkspaceManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-gc-'));
    processRunner = makeProcessRunner();
    manager = new WorkspaceManager(processRunner as never, tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skips worktrees whose matching task has worktreeStatus preserved', async () => {
    const orphanPath = path.join(tmpDir, 'task-preserved');
    fs.mkdirSync(orphanPath);

    // git worktree list returns nothing (so the dir is stale)
    processRunner.run.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const task = makeTask('task-preserved', orphanPath, { worktreeStatus: 'preserved' });
    const removed = await manager.gcStaleWorktrees(makeProject(), [task]);

    // The call to list stale worktrees uses processRunner.run (git worktree list)
    // but the git worktree remove should NOT be called for preserved tasks
    const removeCalls = processRunner.run.mock.calls.filter(
      ([, args]) => Array.isArray(args) && args.includes('remove')
    );
    expect(removeCalls).toHaveLength(0);
    expect(removed).not.toContain(orphanPath);
  });

  it('removes unregistered worktrees not tracked by any task', async () => {
    const orphanPath = path.join(tmpDir, 'task-orphan');
    fs.mkdirSync(orphanPath);

    // git worktree list returns no registered paths for tmpDir
    processRunner.run.mockImplementation(async (_cmd, args: string[]) => {
      if (args.includes('list')) {
        return { stdout: 'worktree /some/other/path\n', stderr: '', exitCode: 0 };
      }
      // worktree remove
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const removed = await manager.gcStaleWorktrees(makeProject(), []);

    expect(removed).toContain(orphanPath);
  });

  it('never throws even when git worktree remove fails and fs.rmSync also fails', async () => {
    const orphanPath = path.join(tmpDir, 'task-stubborn');
    fs.mkdirSync(orphanPath);

    processRunner.run.mockImplementation(async (_cmd, args: string[]) => {
      if (args.includes('list')) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      throw new Error('git remove failed');
    });

    const rmSyncSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => {
      throw new Error('fs.rmSync failed');
    });

    let result: string[];
    try {
      result = await manager.gcStaleWorktrees(makeProject(), []);
    } finally {
      rmSyncSpy.mockRestore();
    }

    // Should not throw and should return an empty removed list
    expect(result!).toEqual([]);
  });

  it('falls back to fs removal when git worktree remove fails and removes the orphan directory', async () => {
    const orphanPath = path.join(tmpDir, 'task-fallback');
    fs.mkdirSync(orphanPath);
    expect(fs.existsSync(orphanPath)).toBe(true);

    processRunner.run.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes('list')) {
        // Return empty so the dir is considered stale
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      // Simulate git worktree remove failure — forces fs fallback path
      throw new Error('git remove failed');
    });

    const removed = await manager.gcStaleWorktrees(makeProject(), []);

    // The orphan directory should have been removed via the fs fallback
    expect(removed).toContain(orphanPath);
    expect(fs.existsSync(orphanPath)).toBe(false);
  });
});
