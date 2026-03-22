import os from 'node:os';

import type { LaunchSpec } from '../services/process-runner';
import { BaseConnector, type ConnectorJobInput } from './base';

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
      // Only report needs-login when the output contains a clear auth signal.
      // Avoid matching 'auth' alone — it appears in 'unknown subcommand auth'
      // on older CLI versions, which is not an auth failure.
      const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
      if (combined.includes('login') || combined.includes('sign in') || combined.includes('unauthorized') || combined.includes('not logged')) {
        this.profile.status = 'needs-login';
        return 'Not authenticated. Run `claude login` to sign in.';
      }
      this.profile.status = 'installed';
      return 'Installed. Auth status unclear — run `claude login` if workflows fail.';
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
    // Claude runs full coding tasks including file edits, test runs, and git commits.
    // 5 minutes is a reasonable ceiling for complex single-step work.
    return 300_000;
  }

  protected getScriptedCommand(input: ConnectorJobInput) {
    const args = [
      '-p',
      input.prompt,
      '--output-format',
      'stream-json',
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
