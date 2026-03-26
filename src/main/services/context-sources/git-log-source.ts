/**
 * GitLogSource -- recent commit history for project context.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

import type { ContextSource, ContextChunk } from '../context-sources';

export class GitLogSource implements ContextSource {
  readonly id = 'git-log';
  readonly name = 'Git History';
  readonly description = 'Recent commit messages from git log';

  async available(projectPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(projectPath, '.git');
      return fs.existsSync(gitDir);
    } catch {
      return false;
    }
  }

  async fetch(projectPath: string, _query?: string): Promise<ContextChunk[]> {
    try {
      const stdout = execSync('git log --oneline -20', {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 10_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (!stdout) return [];

      return [
        {
          sourceId: this.id,
          title: 'Recent Commits (last 20)',
          content: stdout,
          relevance: 0.6,
          metadata: { commitCount: stdout.split('\n').length },
        },
      ];
    } catch {
      return [];
    }
  }
}
