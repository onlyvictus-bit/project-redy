import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalManager } from './terminal-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakePty() {
  let dataHandler: ((data: string) => void) | undefined;
  let exitHandler: (() => void) | undefined;

  return {
    onData: vi.fn((cb: (data: string) => void) => {
      dataHandler = cb;
    }),
    onExit: vi.fn((cb: () => void) => {
      exitHandler = cb;
    }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    // Test helpers — simulate PTY events
    _emit: {
      data: (d: string) => dataHandler?.(d),
      exit: () => exitHandler?.()
    }
  };
}

const fakeConnector = {
  profile: {
    id: 'claude' as const,
    displayName: 'Claude',
    binaryOrEndpoint: 'claude',
    authMode: 'native-login' as const,
    role: 'coder' as const,
    runner: 'windows' as const,
    status: 'ready' as const,
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    }
  },
  getInteractiveLaunchSpec: vi.fn(() => ({
    command: 'claude',
    args: [] as string[],
    cwd: '/project',
    runner: 'windows' as const
  }))
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TerminalManager', () => {
  let pty: ReturnType<typeof makeFakePty>;
  let processRunner: { spawnInteractive: ReturnType<typeof vi.fn> };
  let manager: TerminalManager;

  beforeEach(() => {
    pty = makeFakePty();
    processRunner = { spawnInteractive: vi.fn().mockReturnValue(pty) };
    manager = new TerminalManager(processRunner as never);
  });

  it('removes the session and emits exit when the PTY process exits naturally', () => {
    const exitPayloads: Array<{ sessionId: string }> = [];
    manager.on('exit', (p: { sessionId: string }) => exitPayloads.push(p));

    const session = manager.start('claude', fakeConnector as never, '/project');
    expect(manager.list()).toHaveLength(1);

    pty._emit.exit();

    expect(manager.list()).toHaveLength(0);
    expect(manager.getSession(session.id)).toBeUndefined();
    expect(exitPayloads).toHaveLength(1);
    expect(exitPayloads[0].sessionId).toBe(session.id);
  });

  it('keeps the session alive after data events', () => {
    const session = manager.start('claude', fakeConnector as never, '/project');

    pty._emit.data('some output\n');
    pty._emit.data('more output\n');

    expect(manager.getSession(session.id)).toBeDefined();
    expect(manager.list()).toHaveLength(1);
  });

  it('stop() kills the PTY and removes the session without waiting for exit event', () => {
    const exitPayloads: Array<unknown> = [];
    manager.on('exit', (p) => exitPayloads.push(p));

    const session = manager.start('claude', fakeConnector as never, '/project');
    manager.stop(session.id);

    expect(pty.kill).toHaveBeenCalled();
    expect(manager.list()).toHaveLength(0);
    // stop() removes immediately; the exit callback is NOT expected to fire
    expect(exitPayloads).toHaveLength(0);
  });

  it('multiple independent sessions each clean up on their own exit', () => {
    const pty2 = makeFakePty();
    processRunner.spawnInteractive
      .mockReturnValueOnce(pty)
      .mockReturnValueOnce(pty2);

    const s1 = manager.start('claude', fakeConnector as never, '/project');
    const s2 = manager.start('claude', fakeConnector as never, '/project');
    expect(manager.list()).toHaveLength(2);

    pty._emit.exit();
    expect(manager.list()).toHaveLength(1);
    expect(manager.getSession(s1.id)).toBeUndefined();
    expect(manager.getSession(s2.id)).toBeDefined();

    pty2._emit.exit();
    expect(manager.list()).toHaveLength(0);
  });

  it('stopAll() kills all PTYs and empties the session list', () => {
    const exitPayloads: Array<unknown> = [];
    manager.on('exit', (p) => exitPayloads.push(p));

    const pty2 = makeFakePty();
    processRunner.spawnInteractive
      .mockReturnValueOnce(pty)
      .mockReturnValueOnce(pty2);

    manager.start('claude', fakeConnector as never, '/project');
    manager.start('claude', fakeConnector as never, '/project');
    expect(manager.list()).toHaveLength(2);

    manager.stopAll();

    expect(pty.kill).toHaveBeenCalled();
    expect(pty2.kill).toHaveBeenCalled();
    expect(manager.list()).toHaveLength(0);
    expect(exitPayloads).toHaveLength(0);
  });

  it('stopAll() on an empty manager is a no-op', () => {
    expect(manager.list()).toHaveLength(0);
    expect(() => manager.stopAll()).not.toThrow();
    expect(manager.list()).toHaveLength(0);
  });
});
