import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AgentProfile, OllamaStatus } from '@shared/types';
import { SetupBanner } from './SetupBanner';

const mockStartAgentAuth = vi.fn();
const mockSetOllamaRole = vi.fn();

vi.mock('../store', () => ({
  useWorkbenchStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      startAgentAuth: mockStartAgentAuth,
      setOllamaRole: mockSetOllamaRole
    })
}));

function makeAgent(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: 'claude',
    displayName: 'Claude Code',
    binaryOrEndpoint: 'claude',
    authMode: 'native-login',
    role: 'coder',
    runner: 'wsl',
    status: 'ready',
    capabilities: { supportsInteractive: true, supportsStructuredOutput: true, supportsEditing: true, supportsResume: true },
    ...overrides
  };
}

function makeOllama(overrides: Partial<OllamaStatus> = {}): OllamaStatus {
  return { available: true, running: false, owner: 'external', endpoint: 'http://localhost:11434', ...overrides };
}

describe('SetupBanner', () => {
  it('returns null when all three CLI agents are ready', () => {
    const { container } = render(
      <SetupBanner
        agents={{ claude: makeAgent(), codex: makeAgent({ id: 'codex', displayName: 'Codex CLI' }), gemini: makeAgent({ id: 'gemini', displayName: 'Gemini CLI' }) }}
        ollama={makeOllama()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a Connect button for a needs-login agent and calls startAgentAuth on click', () => {
    render(
      <SetupBanner
        agents={{
          claude: makeAgent({ status: 'needs-login' }),
          codex: makeAgent({ id: 'codex', displayName: 'Codex CLI' }),
          gemini: makeAgent({ id: 'gemini', displayName: 'Gemini CLI' })
        }}
        ollama={makeOllama()}
      />
    );

    const connectBtn = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectBtn);
    expect(mockStartAgentAuth).toHaveBeenCalledWith('claude');
  });

  it('renders an Install guide link (not a button) for a missing agent', () => {
    render(
      <SetupBanner
        agents={{
          claude: makeAgent({ status: 'missing', installHelpUrl: 'https://example.com/install' }),
          codex: makeAgent({ id: 'codex', displayName: 'Codex CLI' }),
          gemini: makeAgent({ id: 'gemini', displayName: 'Gemini CLI' })
        }}
        ollama={makeOllama()}
      />
    );

    expect(screen.getByRole('link', { name: /install guide/i })).toHaveAttribute('href', 'https://example.com/install');
    expect(screen.queryByRole('button', { name: /connect/i })).toBeNull();
  });

  it('renders Wake Ollama button when Ollama is available but not running and calls setOllamaRole on click', () => {
    render(
      <SetupBanner
        agents={{
          claude: makeAgent({ status: 'needs-login' }),
          codex: makeAgent({ id: 'codex', displayName: 'Codex CLI', status: 'needs-login' }),
          gemini: makeAgent({ id: 'gemini', displayName: 'Gemini CLI', status: 'needs-login' })
        }}
        ollama={makeOllama({ available: true, running: false })}
      />
    );

    const wakeBtn = screen.getByRole('button', { name: /wake ollama/i });
    fireEvent.click(wakeBtn);
    expect(mockSetOllamaRole).toHaveBeenCalledWith('monitor');
  });

  it('does not render Wake Ollama button when Ollama is already running', () => {
    render(
      <SetupBanner
        agents={{
          claude: makeAgent({ status: 'needs-login' }),
          codex: makeAgent({ id: 'codex', displayName: 'Codex CLI' }),
          gemini: makeAgent({ id: 'gemini', displayName: 'Gemini CLI' })
        }}
        ollama={makeOllama({ available: true, running: true })}
      />
    );

    expect(screen.queryByRole('button', { name: /wake ollama/i })).toBeNull();
    expect(screen.getByText('✓ Running')).toBeTruthy();
  });
});
