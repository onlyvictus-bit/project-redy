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

// Mock child_process.spawn so connectors don't actually run CLI binaries.
// The mock captures the args passed to spawn for assertion.
const spawnCalls: Array<{ command: string; args: string[] }> = [];

vi.mock('node:child_process', () => {
  const { EventEmitter } = require('node:events');
  const { Readable, Writable } = require('node:stream');

  function mockSpawn(command: string, args: string[] = []) {
    spawnCalls.push({ command, args });
    const child = new EventEmitter();
    child.stdout = new Readable({ read() { this.push(null); } });
    child.stderr = new Readable({ read() { this.push(null); } });
    child.stdin = new Writable({ write(_c: unknown, _e: unknown, cb: () => void) { cb(); } });
    child.pid = 12345;
    process.nextTick(() => child.emit('close', 0));
    return child;
  }

  return { spawn: mockSpawn };
});

// Mock fs.writeFileSync and fs.unlinkSync used by GeminiConnector for temp files
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn()
    }
  };
});

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
    spawnCalls.length = 0;
    const runner = makeMockRunner();
    const connector = new ClaudeConnector(makeProfile('claude'), runner as never);
    await connector.runJob(makeInput());
    const call = spawnCalls.find((c) => c.args.includes('-p'));
    expect(call).toBeDefined();
    expect(call!.args).not.toContain('--resume');
  });

  it('appends --resume <id> when resumeSessionId is set', async () => {
    spawnCalls.length = 0;
    const runner = makeMockRunner();
    const connector = new ClaudeConnector(makeProfile('claude'), runner as never);
    await connector.runJob(makeInput({ resumeSessionId: 'ses_xyz789' }));
    const call = spawnCalls.find((c) => c.args.includes('-p'));
    expect(call).toBeDefined();
    const resumeIdx = call!.args.indexOf('--resume');
    expect(resumeIdx).toBeGreaterThan(-1);
    expect(call!.args[resumeIdx + 1]).toBe('ses_xyz789');
  });
});

// ---------------------------------------------------------------------------
// GeminiConnector
// ---------------------------------------------------------------------------

describe('GeminiConnector session resume', () => {
  it('does not include --resume when no resumeSessionId is provided', async () => {
    spawnCalls.length = 0;
    const runner = makeMockRunner();
    const connector = new GeminiConnector(makeProfile('gemini'), runner as never);
    await connector.runJob(makeInput());
    // Gemini spawns cmd.exe with args that include the binary name
    const call = spawnCalls.find((c) => c.args.some((a) => a === 'gemini' || a.includes('gemini')));
    expect(call).toBeDefined();
    expect(call!.args).not.toContain('--resume');
  });

  it('appends --resume <id> when resumeSessionId is set', async () => {
    spawnCalls.length = 0;
    const runner = makeMockRunner();
    const connector = new GeminiConnector(makeProfile('gemini'), runner as never);
    await connector.runJob(makeInput({ resumeSessionId: 'ses_gem456' }));
    const call = spawnCalls.find((c) => c.args.some((a) => a === 'gemini' || a.includes('gemini')));
    expect(call).toBeDefined();
    const resumeIdx = call!.args.indexOf('--resume');
    expect(resumeIdx).toBeGreaterThan(-1);
    expect(call!.args[resumeIdx + 1]).toBe('ses_gem456');
  });

  it('launches auth in screen-reader mode with Google sign-in preselected', () => {
    const runner = makeMockRunner();
    const connector = new GeminiConnector(makeProfile('gemini', 'windows'), runner as never);
    const spec = connector.getAuthLaunchSpec();
    expect(spec.args).toEqual(['--screen-reader']);
    expect(spec.env?.GEMINI_DEFAULT_AUTH_TYPE).toBe('login_with_google');
  });
});
