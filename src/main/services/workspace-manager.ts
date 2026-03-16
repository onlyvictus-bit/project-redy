import fs from 'node:fs';
import path from 'node:path';

import type { ProjectRef, PromotionAction, RunnerKind, TaskRun } from '@shared/types';

import { mapPathForRunner, sanitizeBranchName, windowsToWslPath } from '../utils/path-mapping';
import { ProcessRunner } from './process-runner';

export class WorkspaceManager {
  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly workspaceRoot: string
  ) {
    fs.mkdirSync(this.workspaceRoot, { recursive: true });
  }

  async inspectProject(rootPath: string, runnerPreference: RunnerKind | 'auto', resolvedRunner?: RunnerKind): Promise<ProjectRef> {
    const runner = resolvedRunner ?? (runnerPreference === 'auto' ? 'windows' : runnerPreference);
    const gitResult = await this.processRunner.run('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: rootPath,
      runner
    });
    const isGitRepo = gitResult.stdout.trim() === 'true';
    const branchResult = isGitRepo
      ? await this.processRunner.run('git', ['branch', '--show-current'], { cwd: rootPath, runner })
      : undefined;

    return {
      id: rootPath,
      name: path.basename(rootPath),
      rootPath,
      wslPath: windowsToWslPath(rootPath),
      runnerPreference,
      resolvedRunner: runner,
      isGitRepo,
      currentBranch: branchResult?.stdout.trim() || undefined,
      archivePath: path.join(rootPath, '.triad-workbench'),
      archiveEnabled: true
    };
  }

  async createTaskWorkspace(project: ProjectRef, taskId: string, brief: string): Promise<Pick<TaskRun, 'worktreePath' | 'baseBranch' | 'baseCommit' | 'branchName'>> {
    const runner = this.resolveRunner(project);
    const baseBranch = project.currentBranch || 'main';
    const baseCommit = (
      await this.processRunner.run('git', ['rev-parse', 'HEAD'], {
        cwd: project.rootPath,
        runner
      })
    ).stdout.trim();
    const branchName = `triad/${sanitizeBranchName(`${brief.slice(0, 40)}-${taskId.slice(0, 8)}`)}`;
    const worktreePath = path.join(this.workspaceRoot, taskId);

    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

    await this.processRunner.run(
      'git',
      ['worktree', 'add', '-b', branchName, mapPathForRunner(worktreePath, runner), baseBranch],
      {
        cwd: project.rootPath,
        runner
      }
    );

    return {
      worktreePath,
      baseBranch,
      baseCommit,
      branchName
    };
  }

  async getDiff(task: TaskRun, project: ProjectRef): Promise<string> {
    const runner = this.resolveRunner(project);
    const result = await this.processRunner.run('git', ['diff', task.baseCommit], {
      cwd: task.worktreePath,
      runner
    });

    return result.stdout;
  }

  async promoteTask(task: TaskRun, project: ProjectRef, action: PromotionAction): Promise<void> {
    const runner = this.resolveRunner(project);

    if (action === 'keep-worktree' || action === 'open-task-branch') {
      return;
    }

    const status = await this.processRunner.run('git', ['status', '--porcelain'], {
      cwd: project.rootPath,
      runner
    });

    if (status.stdout.trim()) {
      throw new Error('Main checkout has uncommitted changes. Clean it before applying a promoted patch.');
    }

    const diff = await this.getDiff(task, project);
    const patchFile = path.join(this.workspaceRoot, `${task.id}.patch`);
    fs.writeFileSync(patchFile, diff, 'utf8');

    await this.processRunner.run('git', ['apply', '--3way', mapPathForRunner(patchFile, runner)], {
      cwd: project.rootPath,
      runner
    });

    try {
      await this.cleanupTaskWorkspace(task, project);
    } catch (err) {
      process.stderr.write(`[WorkspaceManager] cleanup after apply-to-main failed: ${String(err)}\n`);
    }
  }

  async cleanupTaskWorkspace(task: TaskRun, project: ProjectRef): Promise<void> {
    const runner = this.resolveRunner(project);
    await this.processRunner.run('git', ['worktree', 'remove', '--force', mapPathForRunner(task.worktreePath, runner)], {
      cwd: project.rootPath,
      runner
    });
  }

  async listStaleWorktrees(project: ProjectRef): Promise<string[]> {
    try {
      if (!fs.existsSync(this.workspaceRoot)) {
        return [];
      }

      const entries = fs.readdirSync(this.workspaceRoot, { withFileTypes: true });
      const dirs = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(this.workspaceRoot, entry.name));

      if (dirs.length === 0) {
        return [];
      }

      const runner = this.resolveRunner(project);
      const result = await this.processRunner.run('git', ['worktree', 'list', '--porcelain'], {
        cwd: project.rootPath,
        runner
      });

      const registeredPaths = new Set<string>();
      for (const line of result.stdout.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('worktree ')) {
          registeredPaths.add(trimmed.slice('worktree '.length).replace(/\\/g, '/'));
        }
      }

      return dirs.filter((dir) => !registeredPaths.has(dir.replace(/\\/g, '/')));
    } catch {
      return [];
    }
  }

  async gcStaleWorktrees(project: ProjectRef, tasks: TaskRun[]): Promise<string[]> {
    const stale = await this.listStaleWorktrees(project);
    const removed: string[] = [];

    for (const stalePath of stale) {
      const matchingTask = tasks.find(
        (task) => task.worktreePath.replace(/\\/g, '/') === stalePath.replace(/\\/g, '/')
      );
      if (matchingTask && matchingTask.worktreeStatus === 'preserved') {
        continue;
      }

      try {
        const runner = this.resolveRunner(project);
        await this.processRunner.run('git', ['worktree', 'remove', '--force', mapPathForRunner(stalePath, runner)], {
          cwd: project.rootPath,
          runner
        });
        removed.push(stalePath);
      } catch {
        // git worktree remove failed — try direct fs removal as fallback
        try {
          fs.rmSync(stalePath, { recursive: true, force: true });
          removed.push(stalePath);
        } catch {
          // Skip — cannot remove this path
        }
      }
    }

    return removed;
  }

  resolveRunner(project: ProjectRef): RunnerKind {
    if (project.runnerPreference === 'auto') {
      return project.resolvedRunner ?? 'windows';
    }
    return project.runnerPreference;
  }
}
