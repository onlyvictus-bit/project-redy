import { EventEmitter } from 'node:events';

import { v4 as uuid } from 'uuid';

import type { IPty } from 'node-pty';
import type { AgentId, TerminalSession } from '@shared/types';

import type { AgentConnector } from '../connectors/base';
import { ProcessRunner } from './process-runner';

export class TerminalManager extends EventEmitter {
  private readonly sessions = new Map<string, { session: TerminalSession; pty: IPty }>();

  constructor(private readonly processRunner: ProcessRunner) {
    super();
  }

  start(agentId: AgentId, connector: AgentConnector, cwd: string): TerminalSession {
    const spec = connector.getInteractiveLaunchSpec(cwd);
    return this.startRaw(agentId, spec, `${connector.profile.displayName} terminal`);
  }

  /** Start a PTY session from a raw launch spec — used for auth flows and other
   *  non-interactive agent commands that still need live terminal output. */
  startRaw(agentId: AgentId, spec: import('./process-runner').LaunchSpec, title: string): TerminalSession {
    const ptyProcess = this.processRunner.spawnInteractive(spec);
    const session: TerminalSession = {
      id: uuid(),
      agentId,
      title,
      cwd: spec.cwd,
      runner: spec.runner,
      createdAt: new Date().toISOString()
    };

    ptyProcess.onData((data) => {
      this.emit('data', { sessionId: session.id, data });
    });

    ptyProcess.onExit(() => {
      this.sessions.delete(session.id);
      this.emit('exit', { sessionId: session.id });
    });

    this.sessions.set(session.id, { session, pty: ptyProcess });
    return session;
  }

  write(sessionId: string, input: string): void {
    this.sessions.get(sessionId)?.pty.write(input);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.pty.resize(cols, rows);
  }

  stop(sessionId: string): void {
    this.sessions.get(sessionId)?.pty.kill();
    this.sessions.delete(sessionId);
  }

  stopAll(): void {
    for (const { pty } of this.sessions.values()) {
      pty.kill();
    }
    this.sessions.clear();
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId)?.session;
  }

  list(): TerminalSession[] {
    return [...this.sessions.values()].map((entry) => entry.session);
  }
}
