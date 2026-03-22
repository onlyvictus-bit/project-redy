import { describe, expect, it } from 'vitest';

import { sanitizeBranchName, windowsToWslPath } from './path-mapping';

describe('path mapping helpers', () => {
  it('maps Windows paths to WSL mounts', () => {
    expect(windowsToWslPath('D:\\ccgl room\\project')).toBe('/mnt/d/ccgl room/project');
  });

  it('sanitizes branch names for git worktrees', () => {
    expect(sanitizeBranchName('Fix Rate Limit!! 123')).toBe('fix-rate-limit-123');
  });
});
