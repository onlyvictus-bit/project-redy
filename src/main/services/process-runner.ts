import { spawn } from 'node:child_process';
import path from 'node:path';

import pty from 'node-pty';

import type { IPty } from 'node-pty';
import type { RunnerKind } from '@shared/types';

import { mapPathForRunner } from '../utils/path-mapping';

export interface RunCommandOptions {
  cwd?: string;
  runner: RunnerKind;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface LaunchSpec {
  command: string;
  args: string[];
  cwd: string;
  runner: RunnerKind;
  env?: NodeJS.ProcessEnv;
}

function quoteForBash(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export class ProcessRunner {
  async run(command: string, args: string[], options: RunCommandOptions): Promise<CommandResult> {
    if (options.runner === 'http-local') {
      throw new Error('http-local commands cannot be executed through ProcessRunner.');
    }

    if (options.cwd && !path.isAbsolute(options.cwd)) {
      throw new Error(`ProcessRunner.run: cwd must be an absolute path, got '${options.cwd}'.`);
    }

    const { resolvedCommand, resolvedArgs } = this.prepareCommand(command, args, options);

    return await new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(resolvedCommand, resolvedArgs, {
        cwd: options.runner === 'windows' ? options.cwd : undefined,
        env: {
          ...process.env,
          ...options.env
        },
        shell: false,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | undefined;

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.once('error', reject);

      if (options.timeoutMs) {
        timer = setTimeout(() => {
          if (process.platform === 'win32' && child.pid) {
            // child.kill() on Windows only terminates the immediate process.
            // Use taskkill /T /F to kill the full process tree (covers WSL wsl.exe subtrees too).
            spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { shell: false, windowsHide: true });
          } else {
            child.kill();
          }
        }, options.timeoutMs);
      }

      if (options.signal) {
        const killChild = (): void => {
          if (timer) clearTimeout(timer);
          if (process.platform === 'win32' && child.pid) {
            spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { shell: false, windowsHide: true });
          } else {
            child.kill();
          }
        };
        if (options.signal.aborted) {
          killChild();
        } else {
          options.signal.addEventListener('abort', killChild, { once: true });
        }
      }

      child.once('close', (exitCode) => {
        if (timer) {
          clearTimeout(timer);
        }

        resolve({
          command,
          args,
          exitCode,
          stdout,
          stderr
        });
      });
    });
  }

  spawnInteractive(spec: LaunchSpec): IPty {
    if (spec.runner === 'http-local') {
      throw new Error('Cannot start an interactive PTY for http-local endpoints.');
    }

    if (spec.cwd && !path.isAbsolute(spec.cwd)) {
      throw new Error(`ProcessRunner.spawnInteractive: cwd must be an absolute path, got '${spec.cwd}'.`);
    }

    const { resolvedCommand, resolvedArgs } = this.prepareCommand(spec.command, spec.args, {
      runner: spec.runner,
      cwd: spec.cwd,
      env: spec.env
    });

    return pty.spawn(resolvedCommand, resolvedArgs, {
      cwd: spec.runner === 'windows' ? spec.cwd : process.cwd(),
      env: {
        ...process.env,
        ...spec.env
      },
      cols: 120,
      rows: 30,
      name: 'xterm-color'
    });
  }

  async checkWslAvailable(): Promise<boolean> {
    try {
      const result = await this.run('wsl', ['--status'], { runner: 'windows', timeoutMs: 5_000 });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async probeBinary(binary: string, runner: RunnerKind): Promise<string | undefined> {
    if (runner === 'http-local') {
      return undefined;
    }

    const result =
      runner === 'windows'
        ? await this.run('where.exe', [binary], { runner })
        : await this.run('bash', ['-lc', `command -v ${quoteForBash(binary)}`], { runner: 'wsl' });

    if (result.exitCode === 0) {
      const firstLine = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      return firstLine;
    }

    return undefined;
  }

  private prepareCommand(command: string, args: string[], options: RunCommandOptions): { resolvedCommand: string; resolvedArgs: string[] } {
    if (options.runner === 'windows') {
      return { resolvedCommand: command, resolvedArgs: args };
    }

    const mappedCwd = options.cwd ? mapPathForRunner(options.cwd, 'wsl') : undefined;
    const script = [
      mappedCwd ? `cd ${quoteForBash(mappedCwd)}` : undefined,
      [command, ...args].map(quoteForBash).join(' ')
    ]
      .filter(Boolean)
      .join(' && ');

    return {
      resolvedCommand: 'wsl.exe',
      resolvedArgs: ['bash', '-lc', script]
    };
  }
}
