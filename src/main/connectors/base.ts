import { v4 as uuid } from 'uuid';

import type {
  AgentProfile,
  AgentRole,
  ArtifactBundle,
  ProbeResult,
  RunnerKind
} from '@shared/types';

import { cleanOutput } from '../utils/agent-protocol';
import { extractPatch, extractTriadPayload, parseJsonLines, summarizeText } from '../utils/parsing';
import type { LaunchSpec } from '../services/process-runner';
import { ProcessRunner } from '../services/process-runner';

export interface ConnectorJobInput {
  prompt: string;
  cwd: string;
  runner: RunnerKind;
  taskId: string;
  stepId: string;
  role: AgentRole;
  signal?: AbortSignal;
  /** Session ID from a prior run of the same agent on this task.
   *  When set, connectors that support resume pass it as --resume <id>
   *  so the agent retains context from the previous step. */
  resumeSessionId?: string;
}

export interface AgentConnector {
  readonly profile: AgentProfile;
  probe(deep?: boolean): Promise<ProbeResult>;
  runJob(input: ConnectorJobInput): Promise<ArtifactBundle>;
  getInteractiveLaunchSpec(cwd: string): LaunchSpec;
  /** Returns a spec for the native-login auth command (e.g. `claude auth login`).
   *  Not present on connectors that have no interactive login step (e.g. Ollama). */
  getAuthLaunchSpec?(): LaunchSpec;
  setRole(role: AgentRole): void;
  interrupt(): Promise<void>;
  dispose(): Promise<void>;
}

export class ConnectorJobError extends Error {
  constructor(
    message: string,
    public readonly artifact: ArtifactBundle
  ) {
    super(message);
    this.name = 'ConnectorJobError';
  }
}

export abstract class BaseConnector implements AgentConnector {
  protected lastProcessId: number | undefined;

  constructor(
    public readonly profile: AgentProfile,
    protected readonly processRunner: ProcessRunner
  ) {}

  setRole(role: AgentRole): void {
    this.profile.role = role;
  }

  async probe(deep = false): Promise<ProbeResult> {
    const detectedPath =
      this.profile.runner === 'http-local'
        ? this.profile.binaryOrEndpoint
        : await this.processRunner.probeBinary(this.profile.binaryOrEndpoint, this.profile.runner);

    if (!detectedPath) {
      this.profile.status = 'missing';
      this.profile.message = `${this.profile.displayName} was not found on the selected runner.`;
      return {
        profile: {
          ...this.profile,
          lastCheckedAt: new Date().toISOString()
        },
        rawOutput: ''
      };
    }

    this.profile.detectedPath = detectedPath;
    this.profile.status = 'installed';

    const versionResult = await this.getVersionInfo();
    this.profile.version = versionResult.stdout.trim() || versionResult.stderr.trim() || 'unknown';
    this.profile.message = deep
      ? await this.performDeepAuthProbe()
      : 'Installed. Run a workflow or direct chat to verify auth and runtime access.';
    this.profile.lastCheckedAt = new Date().toISOString();

    return {
      profile: { ...this.profile },
      rawOutput: `${versionResult.stdout}\n${versionResult.stderr}`
    };
  }

  async runJob(input: ConnectorJobInput): Promise<ArtifactBundle> {
    const MAX_PROMPT_BYTES = 1_000_000; // 1MB
    if (Buffer.byteLength(input.prompt, 'utf8') > MAX_PROMPT_BYTES) {
      throw new Error(`Prompt exceeds maximum size of ${MAX_PROMPT_BYTES / 1000}KB. Use a file-based prompt for large inputs.`);
    }

    const { command, args, env } = this.getScriptedCommand(input);
    const result = await this.processRunner.run(command, args, {
      cwd: input.cwd,
      runner: input.runner,
      env,
      timeoutMs: this.getTimeoutMs(),
      signal: input.signal
    });

    const cleaned = cleanOutput(`${result.stdout}\n${result.stderr}`);
    const triad = extractTriadPayload(cleaned, this.profile.id);
    const structuredEvents = parseJsonLines(result.stdout);

    // Extract session_id from the stream-json init message (Claude / Gemini).
    // The init line looks like: {"type":"system","subtype":"init","session_id":"ses_..."}
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
      commandRuns: [
        {
          command: [command, ...args].join(' '),
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr
        }
      ],
      createdAt: new Date().toISOString(),
      ...(sessionId ? { sessionId } : {})
    };

    if (result.exitCode !== 0) {
      const reason = result.exitCode === null
        ? `timed out after ${this.getTimeoutMs() / 1000}s`
        : `exited with code ${result.exitCode}`;
      throw new ConnectorJobError(`${this.profile.displayName} ${reason}. Output: ${cleaned.slice(0, 500)}`, artifact);
    }
    return artifact;
  }

  async interrupt(): Promise<void> {
    if (this.lastProcessId) {
      process.kill(this.lastProcessId);
    }
  }

  async dispose(): Promise<void> {
    await this.interrupt();
  }

  protected async performDeepAuthProbe(): Promise<string> {
    return 'Installed. Auth will be confirmed on first successful job run.';
  }

  protected getTimeoutMs(): number {
    return 60_000;
  }

  protected async getVersionInfo() {
    return this.processRunner.run(this.profile.binaryOrEndpoint, this.getVersionArgs(), {
      runner: this.profile.runner,
      timeoutMs: 10_000
    });
  }

  protected getVersionArgs(): string[] {
    return ['--version'];
  }

  abstract getInteractiveLaunchSpec(cwd: string): LaunchSpec;

  protected abstract getScriptedCommand(input: ConnectorJobInput): {
    command: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
  };
}
