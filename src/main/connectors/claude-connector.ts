import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { v4 as uuid } from 'uuid';

import type { ArtifactBundle } from '@shared/types';
import type { LaunchSpec } from '../services/process-runner';
import { BaseConnector, ConnectorJobError, type ConnectorJobInput } from './base';
import { cleanOutput } from '../utils/agent-protocol';
import { extractPatch, extractTriadPayload, parseJsonLines, summarizeText } from '../utils/parsing';

export class ClaudeConnector extends BaseConnector {
  protected override async performDeepAuthProbe(): Promise<string> {
    try {
      const result = await this.processRunner.run(
        this.profile.binaryOrEndpoint,
        ['auth', 'status'],
        { runner: this.profile.runner, timeoutMs: 8_000 }
      );
      if (result.exitCode === 0) {
        this.profile.status = 'ready';
        return 'Authenticated and ready.';
      }
      const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
      if (combined.includes('login') || combined.includes('sign in') || combined.includes('unauthorized') || combined.includes('not logged')) {
        this.profile.status = 'needs-login';
        return 'Not authenticated. Run `claude login` to sign in.';
      }
      this.profile.status = 'installed';
      return 'Installed. Auth status unclear -- run `claude login` if workflows fail.';
    } catch {
      this.profile.status = 'error';
      return 'Auth check timed out or failed. Verify Claude CLI is accessible on the selected runner.';
    }
  }

  getAuthLaunchSpec(): LaunchSpec {
    return {
      command: this.profile.binaryOrEndpoint,
      args: ['auth', 'login'],
      cwd: os.homedir(),
      runner: this.profile.runner
    };
  }

  getInteractiveLaunchSpec(cwd: string): LaunchSpec {
    return {
      command: this.profile.binaryOrEndpoint,
      args: [],
      cwd,
      runner: this.profile.runner
    };
  }

  protected override getTimeoutMs(): number {
    return 300_000;
  }

  /**
   * Override runJob to pipe prompt via stdin to avoid cmd.exe quoting issues.
   * Claude CLI: `type <file> | claude -p --output-format stream-json --verbose --permission-mode ...`
   * The -p flag without a value makes Claude read from stdin.
   */
  override async runJob(input: ConnectorJobInput): Promise<ArtifactBundle> {
    const MAX_PROMPT_BYTES = 1_000_000;
    if (Buffer.byteLength(input.prompt, 'utf8') > MAX_PROMPT_BYTES) {
      throw new Error(`Prompt exceeds maximum size of ${MAX_PROMPT_BYTES / 1000}KB.`);
    }

    const timeoutMs = this.getTimeoutMs();
    const binary = this.profile.detectedPath || this.profile.binaryOrEndpoint;
    const permMode = input.role === 'coder' || input.role === 'developer' ? 'acceptEdits' : 'plan';
    const resumeArgs = input.resumeSessionId ? ['--resume', input.resumeSessionId] : [];

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve) => {
      // Spawn claude with stdin pipe — claude -p reads from stdin
      const child = spawn(binary, ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', permMode, ...resumeArgs], {
        cwd: input.cwd,
        env: { ...process.env },
        shell: true,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Write prompt to stdin then close it
      child.stdin.write(input.prompt);
      child.stdin.end();

      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | undefined;

      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      if (timeoutMs) {
        timer = setTimeout(() => {
          if (child.pid) {
            spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { shell: false, windowsHide: true });
          }
        }, timeoutMs);
      }

      if (input.signal) {
        const killChild = (): void => {
          if (timer) clearTimeout(timer);
          if (child.pid) {
            spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { shell: false, windowsHide: true });
          }
        };
        if (input.signal.aborted) killChild();
        else input.signal.addEventListener('abort', killChild, { once: true });
      }

      child.once('close', (exitCode) => {
        if (timer) clearTimeout(timer);
        resolve({ stdout, stderr, exitCode });
      });
    });

    const cleaned = cleanOutput(`${result.stdout}\n${result.stderr}`);
    const triad = extractTriadPayload(cleaned, this.profile.id);
    const structuredEvents = parseJsonLines(result.stdout);

    const sessionId = (structuredEvents as Array<Record<string, unknown>>)
      .find((e) => e['type'] === 'system' && e['subtype'] === 'init')
      ?.['session_id'] as string | undefined;

    const artifact: ArtifactBundle = {
      id: uuid(),
      taskId: input.taskId,
      stepId: input.stepId,
      agentId: this.profile.id,
      role: input.role,
      prompt: input.prompt,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      structuredEvents,
      summary: triad.summary || summarizeText(cleaned) || `${this.profile.displayName} returned no output.`,
      finalMessage: cleaned,
      patch: extractPatch(cleaned),
      findings: triad.findings,
      commandRuns: [{
        command: `${binary} -p --output-format stream-json --verbose --permission-mode ${permMode} (stdin pipe)`,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr
      }],
      createdAt: new Date().toISOString(),
      ...(sessionId ? { sessionId } : {})
    };

    if (result.exitCode !== 0) {
      const reason = result.exitCode === null
        ? `timed out after ${timeoutMs / 1000}s`
        : `exited with code ${result.exitCode}`;
      throw new ConnectorJobError(`${this.profile.displayName} ${reason}. Output: ${cleaned.slice(0, 500)}`, artifact);
    }
    return artifact;
  }

  protected getScriptedCommand(input: ConnectorJobInput) {
    // Fallback — not used since runJob is overridden
    const args = [
      '-p', input.prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--permission-mode',
      input.role === 'coder' || input.role === 'developer' ? 'acceptEdits' : 'plan'
    ];
    if (input.resumeSessionId) {
      args.push('--resume', input.resumeSessionId);
    }
    return { command: this.profile.binaryOrEndpoint, args };
  }
}
