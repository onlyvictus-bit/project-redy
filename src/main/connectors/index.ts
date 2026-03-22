import type { AgentId, AgentProfile } from '@shared/types';

import { ClaudeConnector } from './claude-connector';
import { CodexConnector } from './codex-connector';
import { GeminiConnector } from './gemini-connector';
import { OllamaConnector } from './ollama-connector';
import type { AgentConnector } from './base';
import { OllamaManager } from '../services/ollama-manager';
import { ProcessRunner } from '../services/process-runner';

export function createConnector(profile: AgentProfile, processRunner: ProcessRunner, ollamaManager: OllamaManager): AgentConnector {
  switch (profile.id) {
    case 'claude':
      return new ClaudeConnector(profile, processRunner);
    case 'codex':
      return new CodexConnector(profile, processRunner);
    case 'gemini':
      return new GeminiConnector(profile, processRunner);
    case 'ollama':
      return new OllamaConnector(profile, processRunner, ollamaManager);
    default:
      throw new Error(`Unsupported agent ${(profile as { id: AgentId }).id}`);
  }
}
