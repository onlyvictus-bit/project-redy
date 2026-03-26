/**
 * FileTreeSource -- directory listing for project context.
 *
 * Uses `git ls-files` when inside a git repo (respects .gitignore),
 * falls back to a recursive fs walk with basic ignoring.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { ContextSource, ContextChunk } from '../context-sources';

const MAX_FILES = 200;
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '.next',
  '__pycache__', '.venv', 'venv', '.tox', 'coverage',
]);

export class FileTreeSource implements ContextSource {
  readonly id = 'file-tree';
  readonly name = 'File Structure';
  readonly description = 'Project directory listing (respects .gitignore)';

  async available(projectPath: string): Promise<boolean> {
    try {
      return fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory();
    } catch {
      return false;
    }
  }

  async fetch(projectPath: string, _query?: string): Promise<ContextChunk[]> {
    let files: string[];

    try {
      // Prefer git ls-files -- respects .gitignore automatically
      const stdout = execSync('git ls-files', {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 10_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      files = stdout ? stdout.split('\n').slice(0, MAX_FILES) : [];
    } catch {
      // Fallback: basic recursive walk
      files = this.walkDir(projectPath, projectPath, MAX_FILES);
    }

    if (files.length === 0) return [];

    const truncated = files.length >= MAX_FILES ? `\n... (truncated at ${MAX_FILES} files)` : '';
    return [
      {
        sourceId: this.id,
        title: 'Project File Tree',
        content: files.join('\n') + truncated,
        relevance: 0.5,
        metadata: { fileCount: files.length, truncated: files.length >= MAX_FILES },
      },
    ];
  }

  private walkDir(dir: string, root: string, limit: number): string[] {
    const result: string[] = [];

    const walk = (current: string): void => {
      if (result.length >= limit) return;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (result.length >= limit) return;

        if (entry.isDirectory()) {
          if (IGNORE_DIRS.has(entry.name)) continue;
          walk(path.join(current, entry.name));
        } else {
          result.push(path.relative(root, path.join(current, entry.name)).replace(/\\/g, '/'));
        }
      }
    };

    walk(dir);
    return result;
  }
}
