import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

import type { LaunchSpec } from '../services/process-runner';
import { BaseConnector, type ConnectorJobInput } from './base';

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

    // Current Gemini CLI auth is selected from the interactive `gemini` session
    // and persisted into ~/.gemini/settings.json as security.auth.selectedType.
    // There is no stable `gemini auth status` command on the installed CLI.
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
    // Gemini's Ink UI can render poorly inside embedded PTYs on Windows.
    // `--screen-reader` gives a more text-oriented experience, and setting the
    // default auth type makes a single Enter key enough for the common Google
    // sign-in path while still allowing the user to change the selection.
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
    // Gemini runs architecture and review passes; 3 minutes covers thorough analysis.
    return 180_000;
  }

  protected getScriptedCommand(input: ConnectorJobInput) {
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
