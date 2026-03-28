import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import type { ArtifactBundle } from '@shared/types';
import type { LaunchSpec } from '../services/process-runner';
import { BaseConnector, ConnectorJobError, type ConnectorJobInput } from './base';
import { cleanOutput } from '../utils/agent-protocol';
import { extractPatch, extractTriadPayload, summarizeText } from '../utils/parsing';
import { v4 as uuid } from 'uuid';

export class CodexConnector extends BaseConnector {
  protected override async performDeepAuthProbe(): Promise<string> {
    if (this.profile.authMode === 'api-key') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.profile.status = 'needs-login';
        return 'Set the OPENAI_API_KEY environment variable to authenticate.';
      }
      this.profile.status = 'ready';
      return 'API key found. Ready to run.';
    }

    try {
      const result = await this.processRunner.run(
        this.profile.binaryOrEndpoint,
        ['login', 'status'],
        { runner: this.profile.runner, timeoutMs: 8_000 }
      );
      if (result.exitCode === 0) {
        this.profile.status = 'ready';
        return 'Authenticated and ready.';
      }
      const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
      if (combined.includes('login') || combined.includes('sign in') || combined.includes('unauthorized') || combined.includes('not logged')) {
        this.profile.status = 'needs-login';
        return 'Not authenticated. Run `codex login` or sign in with your ChatGPT account.';
      }
      this.profile.status = 'installed';
      return 'Installed. Run `codex login` then re-probe to confirm authentication.';
    } catch {
      this.profile.status = 'error';
      return 'Auth check timed out or failed. Verify Codex CLI is accessible on the selected runner.';
    }
  }

  getAuthLaunchSpec(): LaunchSpec {
    return {
      command: this.profile.binaryOrEndpoint,
      args: ['login'],
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
    return 180_000;
  }

  /**
   * Override runJob to pipe the prompt via stdin instead of passing as a CLI arg.
   * This avoids cmd.exe argument parsing issues with special characters,
   * embedded quotes, and the 8191-char command-line limit.
   * `codex exec -` reads the prompt from stdin.
   */
  override async runJob(input: ConnectorJobInput): Promise<ArtifactBundle> {
    const MAX_PROMPT_BYTES = 1_000_000;
    if (Buffer.byteLength(input.prompt, 'utf8') > MAX_PROMPT_BYTES) {
      throw new Error(`Prompt exceeds maximum size of ${MAX_PROMPT_BYTES / 1000}KB.`);
    }

    const timeoutMs = this.getTimeoutMs();
    const binary = this.profile.detectedPath || this.profile.binaryOrEndpoint;

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve) => {
      // Spawn codex exec - (reads from stdin) and pipe prompt via child.stdin
      const child = spawn(binary, ['exec', '-'], {
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
        if (input.signal.aborted) {
          killChild();
        } else {
          input.signal.addEventListener('abort', killChild, { once: true });
        }
      }

      child.once('close', (exitCode) => {
        if (timer) clearTimeout(timer);
        resolve({ stdout, stderr, exitCode });
      });
    });

    const cleaned = cleanOutput(`${result.stdout}\n${result.stderr}`);
    const triad = extractTriadPayload(cleaned, this.profile.id);

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
      structuredEvents: [],
      summary: triad.summary || summarizeText(cleaned) || `${this.profile.displayName} returned no output.`,
      finalMessage: cleaned,
      patch: extractPatch(cleaned),
      findings: triad.findings,
      commandRuns: [{
        command: `${binary} exec - (stdin pipe)`,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr
      }],
      createdAt: new Date().toISOString()
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
    // Fallback — not used since runJob is overridden, but required by abstract class
    return {
      command: this.profile.binaryOrEndpoint,
      args: ['exec', '--quiet', input.prompt]
    };
  }
}
