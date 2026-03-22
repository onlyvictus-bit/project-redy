import { v4 as uuid } from 'uuid';

import type { AgentRole, ArtifactBundle, ProbeResult } from '@shared/types';

import { cleanOutput } from '../utils/agent-protocol';
import { extractTriadPayload } from '../utils/parsing';
import { OllamaManager } from '../services/ollama-manager';
import { BaseConnector, type ConnectorJobInput } from './base';

const DEV_PROMPT = 'You are an expert software developer. Write clean, correct, idiomatic code and explain implementation decisions clearly.';

const ROLE_SYSTEM_PROMPTS: Partial<Record<AgentRole, string>> = {
  coder: DEV_PROMPT,
  developer: DEV_PROMPT,
  planner: 'You are an expert software architect. Focus on high-level design, architectural trade-offs, and long-term maintainability.',
  tester: 'You are a strict quality assurance engineer. Identify bugs, edge cases, missing tests, and potential failure modes.',
  monitor: 'You are a passive code monitor. Observe for issues, anomalies, and stalls. Surface concerns concisely and do not modify files.'
};

export class OllamaConnector extends BaseConnector {
  constructor(
    profile: BaseConnector['profile'],
    processRunner: BaseConnector['processRunner'],
    private readonly ollamaManager: OllamaManager
  ) {
    super(profile, processRunner);
  }

  override async probe(): Promise<ProbeResult> {
    const status = await this.ollamaManager.probe();

    if (!status.available && !status.running) {
      this.profile.status = 'missing';
    } else if (status.running && status.availableModels && status.availableModels.length > 0) {
      this.profile.status = 'ready';
    } else if (status.running) {
      // Running but no models pulled yet
      this.profile.status = 'installed';
    } else {
      // Installed binary but daemon not running
      this.profile.status = 'installed';
    }

    this.profile.message = status.message;
    this.profile.lastCheckedAt = new Date().toISOString();

    return {
      profile: { ...this.profile },
      rawOutput: JSON.stringify(status)
    };
  }

  override getInteractiveLaunchSpec(): never {
    throw new Error('Ollama does not provide an interactive terminal inside Triad Workbench.');
  }

  override async runJob(input: ConnectorJobInput): Promise<ArtifactBundle> {
    if (this.profile.role === 'off') {
      throw new Error('Ollama is in Sleep mode. Set a personality to enable it.');
    }

    const model = this.ollamaManager.getStatus().activeModel ?? process.env.TRIAD_OLLAMA_MODEL ?? 'qwen2.5-coder:7b';
    const systemPrompt = ROLE_SYSTEM_PROMPTS[input.role as AgentRole];
    const result = await this.ollamaManager.runChat(model, input.prompt, systemPrompt);
    const cleaned = cleanOutput(result.response);
    const triad = extractTriadPayload(cleaned, 'ollama');

    return {
      id: uuid(),
      taskId: input.taskId,
      stepId: input.stepId,
      agentId: 'ollama',
      role: input.role,
      prompt: input.prompt,
      stdout: result.raw,
      stderr: '',
      exitCode: 0,
      structuredEvents: [],
      summary: triad.summary,
      finalMessage: cleaned,
      patch: undefined,
      findings: triad.findings,
      commandRuns: [],
      createdAt: new Date().toISOString()
    };
  }

  protected getScriptedCommand(): never {
    throw new Error('Ollama uses the local HTTP API instead of a CLI subprocess in orchestrated mode.');
  }
}
