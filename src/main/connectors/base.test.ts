import { describe, expect, it, vi } from 'vitest';

import type { AgentProfile } from '@shared/types';

import type { LaunchSpec } from '../services/process-runner';
import type { ConnectorJobInput } from './base';
import { BaseConnector, ConnectorJobError } from './base';

// Minimal concrete subclass — only implements the two abstract members.
class StubConnector extends BaseConnector {
  getInteractiveLaunchSpec(_cwd: string): LaunchSpec {
    return { command: 'stub', args: [], cwd: _cwd, runner: 'windows' };
  }

  protected getScriptedCommand(_input: ConnectorJobInput): { command: string; args: string[] } {
    return { command: 'stub', args: [] };
  }
}

function makeProfile(): AgentProfile {
  return {
    id: 'claude',
    displayName: 'Stub Agent',
    binaryOrEndpoint: 'stub',
    authMode: 'native-login',
    role: 'coder',
    runner: 'windows',
    status: 'ready',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    }
  };
}

function makeInput(): ConnectorJobInput {
  return {
    prompt: 'do something',
    cwd: '/tmp/task',
    runner: 'windows',
    taskId: 'task-1',
    stepId: 'step-1',
    role: 'coder'
  };
}

describe('BaseConnector.runJob', () => {
  it('throws when the subprocess exits with a non-zero code', async () => {
    const mockRunner = {
      run: vi.fn().mockResolvedValue({ command: 'stub', args: [], exitCode: 1, stdout: 'out', stderr: 'error detail' }),
      probeBinary: vi.fn()
    };
    const connector = new StubConnector(makeProfile(), mockRunner as never);
    await expect(connector.runJob(makeInput())).rejects.toBeInstanceOf(ConnectorJobError);
    await expect(connector.runJob(makeInput())).rejects.toThrow('exited with code 1');
  });

  it('throws with a timeout message when the process is killed (exitCode null)', async () => {
    const mockRunner = {
      run: vi.fn().mockResolvedValue({ command: 'stub', args: [], exitCode: null, stdout: '', stderr: '' }),
      probeBinary: vi.fn()
    };
    const connector = new StubConnector(makeProfile(), mockRunner as never);
    await expect(connector.runJob(makeInput())).rejects.toThrow('timed out');
  });

  it('attaches a failure artifact to connector job errors', async () => {
    const mockRunner = {
      run: vi.fn().mockResolvedValue({ command: 'stub', args: [], exitCode: 1, stdout: 'out', stderr: 'error detail' }),
      probeBinary: vi.fn()
    };
    const connector = new StubConnector(makeProfile(), mockRunner as never);

    try {
      await connector.runJob(makeInput());
      throw new Error('Expected runJob to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorJobError);
      const jobError = error as ConnectorJobError;
      expect(jobError.artifact.exitCode).toBe(1);
      expect(jobError.artifact.stdout).toBe('out');
      expect(jobError.artifact.stderr).toBe('error detail');
      expect(jobError.artifact.commandRuns[0].command).toBe('stub');
    }
  });

  it('returns an artifact bundle when the subprocess exits cleanly', async () => {
    const mockRunner = {
      run: vi.fn().mockResolvedValue({ command: 'stub', args: [], exitCode: 0, stdout: 'output text', stderr: '' }),
      probeBinary: vi.fn()
    };
    const connector = new StubConnector(makeProfile(), mockRunner as never);
    const artifact = await connector.runJob(makeInput());
    expect(artifact.exitCode).toBe(0);
    expect(artifact.agentId).toBe('claude');
  });

  it('extracts session_id from stream-json init message and stores it on the artifact', async () => {
    const initLine = JSON.stringify({ type: 'system', subtype: 'init', session_id: 'ses_abc123' });
    const mockRunner = {
      run: vi.fn().mockResolvedValue({ command: 'stub', args: [], exitCode: 0, stdout: initLine + '\n', stderr: '' }),
      probeBinary: vi.fn()
    };
    const connector = new StubConnector(makeProfile(), mockRunner as never);
    const artifact = await connector.runJob(makeInput());
    expect(artifact.sessionId).toBe('ses_abc123');
  });

  it('leaves sessionId undefined when no init message is present', async () => {
    const mockRunner = {
      run: vi.fn().mockResolvedValue({ command: 'stub', args: [], exitCode: 0, stdout: 'plain text output', stderr: '' }),
      probeBinary: vi.fn()
    };
    const connector = new StubConnector(makeProfile(), mockRunner as never);
    const artifact = await connector.runJob(makeInput());
    expect(artifact.sessionId).toBeUndefined();
  });
});
