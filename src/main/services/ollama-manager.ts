import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

import type { AgentRole, OllamaStatus } from '@shared/types';

import { ProcessRunner } from './process-runner';

export class OllamaManager {
  private status: OllamaStatus = {
    available: false,
    running: false,
    owner: 'none',
    endpoint: 'http://localhost:11434'
  };
  private managedProcess: ReturnType<typeof spawn> | undefined;

  constructor(private readonly processRunner: ProcessRunner) {}

  getStatus(): OllamaStatus {
    return this.status;
  }

  /** Restore the activeModel from a persisted agent profile after app restart. */
  restoreActiveModel(model: string): void {
    this.status = { ...this.status, activeModel: model };
  }

  async probe(): Promise<OllamaStatus> {
    const binary = await this.processRunner.probeBinary('ollama', 'windows');

    try {
      const response = await fetch(`${this.status.endpoint}/api/tags`);
      if (response.ok) {
        const data = await response.json() as { models?: { name: string }[] };
        const models = (data.models ?? []).map((m) => m.name);
        this.status = {
          ...this.status,
          available: Boolean(binary),
          running: true,
          owner: this.status.owner === 'none' ? 'external' : this.status.owner,
          availableModels: models,
          message: models.length > 0
            ? `Running — ${models.length} model${models.length === 1 ? '' : 's'} available.`
            : 'Running but no models pulled. Run `ollama pull qwen2.5-coder:7b`.'
        };
        return this.status;
      }
    } catch {
      // Ignore connectivity errors here.
    }

    this.status = {
      ...this.status,
      available: Boolean(binary),
      running: false,
      availableModels: undefined,
      owner: this.managedProcess ? 'app-managed' : 'none',
      message: binary
        ? 'Ollama is installed but not running.'
        : 'Ollama is not installed. Download from ollama.com.'
    };
    return this.status;
  }

  async ensureRunning(model?: string): Promise<OllamaStatus> {
    const probed = await this.probe();
    if (probed.running) {
      this.status = {
        ...probed,
        activeModel: model ?? probed.activeModel
      };
      return this.status;
    }

    if (!probed.available) {
      throw new Error('Ollama is not installed.');
    }

    this.managedProcess = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    // Do NOT call .unref() — we need to retain the handle to kill the process on shutdown.

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await delay(500);
      const next = await this.probe();
      if (next.running) {
        this.status = {
          ...next,
          owner: 'app-managed',
          activeModel: model ?? next.activeModel,
          message: 'Started Ollama for this project session.'
        };
        return this.status;
      }
    }

    throw new Error('Timed out while starting Ollama.');
  }

  async setRole(role: AgentRole, model?: string): Promise<OllamaStatus> {
    if (role === 'off') {
      await this.shutdownIfManaged();
      return this.status;
    }

    return this.ensureRunning(model);
  }

  async shutdownIfManaged(): Promise<OllamaStatus> {
    if (this.status.owner === 'external') {
      return this.status;
    }

    if (this.managedProcess?.pid) {
      try {
        if (process.platform === 'win32') {
          // On Windows, use taskkill to terminate the process tree reliably.
          spawn('taskkill', ['/T', '/F', '/PID', String(this.managedProcess.pid)], {
            shell: false,
            windowsHide: true
          });
        } else {
          process.kill(this.managedProcess.pid);
        }
      } catch {
        // Process may have already exited — ignore.
      }
    }

    this.managedProcess = undefined;
    this.status = {
      ...this.status,
      running: false,
      owner: 'none',
      activeModel: undefined,
      message: 'Stopped app-managed Ollama to free VRAM.'
    };
    return this.status;
  }

  /**
   * Synchronous fire-and-forget shutdown for use in the Electron `before-quit` handler.
   * Kills the app-managed Ollama process without awaiting any async cleanup.
   */
  shutdownManagedOnQuit(): void {
    if (this.status.owner !== 'app-managed' || !this.managedProcess?.pid) {
      return;
    }
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/T', '/F', '/PID', String(this.managedProcess.pid)], {
          shell: false,
          windowsHide: true,
          detached: false
        });
      } else {
        process.kill(this.managedProcess.pid);
      }
    } catch {
      // Process already gone — ignore.
    }
    this.managedProcess = undefined;
  }

  async runChat(model: string, prompt: string, systemPrompt?: string): Promise<{ raw: string; response: string }> {
    const status = await this.ensureRunning(model);
    const messages: Array<{ role: string; content: string }> = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt }
    ];
    const response = await fetch(`${status.endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}.`);
    }

    const raw = await response.text();
    const parsed = JSON.parse(raw) as { message?: { content?: string } };
    return {
      raw,
      response: parsed.message?.content ?? ''
    };
  }
}
