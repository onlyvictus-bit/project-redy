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

function quoteForCmd(value: string): string {
  if (value.length === 0) {
    return '""';
  }
  const escaped = value.replace(/"/g, '""');
  return /[\s"]/u.test(value) ? `"${escaped}"` : value;
}

export class ProcessRunner {
  private buildEnv(extraEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const env = {
      ...process.env,
      ...extraEnv
    };

    if (process.platform === 'win32') {
      const pathKey = Object.prototype.hasOwnProperty.call(env, 'Path') ? 'Path' : 'PATH';
      const currentPath = env[pathKey] ?? '';
      const additions = [
        process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : undefined,
        process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs') : undefined,
        process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'nodejs') : undefined
      ].filter((value): value is string => Boolean(value));

      const currentParts = currentPath.split(';').filter(Boolean);
      for (const entry of additions) {
        if (!currentParts.some((part) => part.toLowerCase() === entry.toLowerCase())) {
          currentParts.push(entry);
        }
      }
      const merged = currentParts.join(';');
      env.Path = merged;
      env.PATH = merged;
    }

    return env;
  }

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
        env: this.buildEnv(options.env),
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

      let killChild: (() => void) | undefined;

      if (options.signal) {
        killChild = (): void => {
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
        if (timer) clearTimeout(timer);
        // Remove the abort listener so it doesn't linger on the signal after the
        // child has already exited (avoids a taskkill call on a stale PID).
        if (killChild && options.signal && !options.signal.aborted) {
          options.signal.removeEventListener('abort', killChild);
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
      env: this.buildEnv(spec.env),
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
      const script = [command, ...args].map(quoteForCmd).join(' ');
      return {
        resolvedCommand: 'cmd.exe',
        resolvedArgs: ['/d', '/s', '/c', script]
      };
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
