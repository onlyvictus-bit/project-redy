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

export class GeminiConnector extends BaseConnector {
  protected override async performDeepAuthProbe(): Promise<string> {
    if (this.profile.authMode === 'api-key') {
      const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
      if (!apiKey) {
        this.profile.status = 'needs-login';
        return 'Set the GOOGLE_API_KEY environment variable to authenticate.';
      }
      this.profile.status = 'ready';
      return 'API key found. Ready to run.';
    }

    const settingsPath = path.join(os.homedir(), '.gemini', 'settings.json');
    const envAuthConfigured =
      Boolean(process.env.GEMINI_API_KEY) ||
      Boolean(process.env.GOOGLE_API_KEY) ||
      Boolean(process.env.GOOGLE_GENAI_USE_VERTEXAI) ||
      Boolean(process.env.GOOGLE_GENAI_USE_GCA);

    if (envAuthConfigured) {
      this.profile.status = 'ready';
      return 'Authentication environment detected. Ready to run.';
    }

    try {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
          security?: { auth?: { selectedType?: string } };
        };
        if (settings.security?.auth?.selectedType) {
          this.profile.status = 'ready';
          return `Authenticated via Gemini settings (${settings.security.auth.selectedType}).`;
        }
      }
      this.profile.status = 'needs-login';
      return 'Not authenticated. Start Gemini CLI and choose Sign in with Google or configure an API key.';
    } catch {
      this.profile.status = 'installed';
      return 'Installed. Start `gemini` and complete the authentication flow, then re-probe.';
    }
  }

  getAuthLaunchSpec(): LaunchSpec {
    return {
      command: this.profile.binaryOrEndpoint,
      args: ['--screen-reader'],
      cwd: os.homedir(),
      runner: this.profile.runner,
      env: {
        ...process.env,
        GEMINI_DEFAULT_AUTH_TYPE: process.env.GEMINI_DEFAULT_AUTH_TYPE ?? 'login_with_google'
      }
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
   * Override runJob to pipe prompt via stdin to avoid cmd.exe quoting issues.
   * Gemini CLI: `echo <prompt> | gemini -p "" --output-format stream-json`
   * The -p flag triggers headless mode, stdin provides the prompt content.
   */
  override async runJob(input: ConnectorJobInput): Promise<ArtifactBundle> {
    const MAX_PROMPT_BYTES = 1_000_000;
    if (Buffer.byteLength(input.prompt, 'utf8') > MAX_PROMPT_BYTES) {
      throw new Error(`Prompt exceeds maximum size of ${MAX_PROMPT_BYTES / 1000}KB.`);
    }

    const timeoutMs = this.getTimeoutMs();
    const binary = this.profile.detectedPath || this.profile.binaryOrEndpoint;
    const resumeArgs = input.resumeSessionId ? ['--resume', input.resumeSessionId] : [];
    const approvalMode = input.role === 'coder' || input.role === 'developer' ? 'auto_edit' : 'plan';

    // Write prompt to temp file, pipe via Node stdin to gemini
    const tmpFile = path.join(os.tmpdir(), `triad-gemini-${input.stepId}.txt`);
    fs.writeFileSync(tmpFile, input.prompt, 'utf8');

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve) => {
      // Gemini reads from stdin when invoked without -p flag.
      // Use cmd.exe /c with separate args (proven to work in repro2.cjs Test B).
      const child = spawn('cmd.exe', ['/c', 'type', tmpFile, '|', binary, '--approval-mode', approvalMode, '--output-format', 'stream-json', ...resumeArgs], {
        cwd: input.cwd,
        env: { ...process.env },
        shell: false,
        windowsHide: true,
      });

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
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
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
        command: `${binary} --approval-mode ${approvalMode} --output-format stream-json (stdin pipe)`,
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
    const args = ['-p', input.prompt, '--output-format', 'stream-json'];
    if (input.resumeSessionId) {
      args.push('--resume', input.resumeSessionId);
    }
    return {
      command: this.profile.binaryOrEndpoint,
      args,
      env: this.profile.authMode === 'api-key' ? process.env : undefined
    };
  }
}
