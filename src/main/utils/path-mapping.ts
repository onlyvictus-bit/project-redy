import path from 'node:path';

import type { RunnerKind } from '@shared/types';

export function windowsToWslPath(inputPath: string): string {
  const normalized = path.win32.normalize(inputPath);
  const drive = normalized.slice(0, 1).toLowerCase();
  const remainder = normalized.slice(2).replace(/\\/g, '/');
  return `/mnt/${drive}${remainder}`;
}

export function mapPathForRunner(inputPath: string, runner: RunnerKind): string {
  if (runner === 'wsl') {
    return windowsToWslPath(inputPath);
  }

  return inputPath;
}

export function sanitizeBranchName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'task';
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}
