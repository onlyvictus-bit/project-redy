import os from 'node:os';

import type { LaunchSpec } from '../services/process-runner';
import { BaseConnector, type ConnectorJobInput } from './base';

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

    // native-login: use `codex login status` — a read-only status command that
    // does not run any model request or consume usage quota.
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
      // 'auth' is intentionally excluded: 'unknown subcommand auth' would
      // match it, misclassifying an unsupported CLI version as needs-login.
      if (combined.includes('login') || combined.includes('sign in') || combined.includes('unauthorized') || combined.includes('not logged')) {
        this.profile.status = 'needs-login';
        return 'Not authenticated. Run `codex login` or sign in with your ChatGPT account.';
      }
      // Non-zero exit but no auth keyword — the subcommand may not exist on this
      // version of Codex. Report installed rather than erroring.
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
    // Codex runs review and verification passes; 3 minutes covers thorough analysis.
    return 180_000;
  }

  protected getScriptedCommand(input: ConnectorJobInput) {
    return {
      command: this.profile.binaryOrEndpoint,
      args: ['exec', '--json', input.prompt]
    };
  }
}
