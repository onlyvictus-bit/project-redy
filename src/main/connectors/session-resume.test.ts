/**
 * Session resume tests for Claude and Gemini connectors.
 *
 * Verifies that when a resumeSessionId is provided in ConnectorJobInput,
 * the connectors append --resume <id> to their CLI arguments.
 */

import { describe, expect, it, vi } from 'vitest';

import type { AgentProfile } from '@shared/types';
import { ClaudeConnector } from './claude-connector';
import { GeminiConnector } from './gemini-connector';
import type { ConnectorJobInput } from './base';

function makeProfile(id: AgentProfile['id'], runner: AgentProfile['runner'] = 'wsl'): AgentProfile {
  return {
    id,
    displayName: id,
    binaryOrEndpoint: id,
    authMode: 'native-login',
    role: 'reviewer',
    runner,
    status: 'ready',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    }
  };
}

function makeInput(overrides: Partial<ConnectorJobInput> = {}): ConnectorJobInput {
  return {
    prompt: 'review this code',
    cwd: '/tmp/worktree',
    runner: 'wsl',
    taskId: 'task-1',
    stepId: 'step-2',
    role: 'reviewer',
    ...overrides
  };
}

function makeMockRunner(stdout = '') {
  return {
    run: vi.fn().mockResolvedValue({ command: '', args: [], exitCode: 0, stdout, stderr: '' }),
    probeBinary: vi.fn()
  };
}

// ---------------------------------------------------------------------------
// ClaudeConnector
// ---------------------------------------------------------------------------

describe('ClaudeConnector session resume', () => {
  it('does not include --resume when no resumeSessionId is provided', async () => {
    const runner = makeMockRunner();
    const connector = new ClaudeConnector(makeProfile('claude'), runner as never);
    await connector.runJob(makeInput());
    const [, args] = runner.run.mock.calls[0] as [string, string[]];
    expect(args).not.toContain('--resume');
  });

  it('appends --resume <id> when resumeSessionId is set', async () => {
    const runner = makeMockRunner();
    const connector = new ClaudeConnector(makeProfile('claude'), runner as never);
    await connector.runJob(makeInput({ resumeSessionId: 'ses_xyz789' }));
    const [, args] = runner.run.mock.calls[0] as [string, string[]];
    const resumeIdx = args.indexOf('--resume');
    expect(resumeIdx).toBeGreaterThan(-1);
    expect(args[resumeIdx + 1]).toBe('ses_xyz789');
  });
});

// ---------------------------------------------------------------------------
// GeminiConnector
// ---------------------------------------------------------------------------

describe('GeminiConnector session resume', () => {
  it('does not include --resume when no resumeSessionId is provided', async () => {
    const runner = makeMockRunner();
    const connector = new GeminiConnector(makeProfile('gemini'), runner as never);
    await connector.runJob(makeInput());
    const [, args] = runner.run.mock.calls[0] as [string, string[]];
    expect(args).not.toContain('--resume');
  });

  it('appends --resume <id> when resumeSessionId is set', async () => {
    const runner = makeMockRunner();
    const connector = new GeminiConnector(makeProfile('gemini'), runner as never);
    await connector.runJob(makeInput({ resumeSessionId: 'ses_gem456' }));
    const [, args] = runner.run.mock.calls[0] as [string, string[]];
    const resumeIdx = args.indexOf('--resume');
    expect(resumeIdx).toBeGreaterThan(-1);
    expect(args[resumeIdx + 1]).toBe('ses_gem456');
  });

  it('launches auth in screen-reader mode with Google sign-in preselected', () => {
    const runner = makeMockRunner();
    const connector = new GeminiConnector(makeProfile('gemini', 'windows'), runner as never);
    const spec = connector.getAuthLaunchSpec();
    expect(spec.args).toEqual(['--screen-reader']);
    expect(spec.env?.GEMINI_DEFAULT_AUTH_TYPE).toBe('login_with_google');
  });
});
