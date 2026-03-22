import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentProfile, TerminalSession } from '@shared/types';

vi.mock('./TerminalPane', () => ({
  TerminalPane: ({ sessionId }: { sessionId?: string }) => <div data-testid="terminal-pane">{sessionId ?? 'no-session'}</div>
}));

import { AgentPanel } from './AgentPanel';

// Named mocks so click-assertion tests can reference them.
const mockSetAgentRole = vi.fn();
const mockStartAgentAuth = vi.fn();
const mockStartTerminal = vi.fn();
const mockStopTerminal = vi.fn();
const mockSendTerminalInput = vi.fn();
const mockSetOllamaRole = vi.fn();
const mockShutdownOllama = vi.fn();

const baseStoreState = {
  snapshot: { tasks: [], terminals: [] as unknown[] },
  terminalBuffers: {},
  setAgentRole: mockSetAgentRole,
  startAgentAuth: mockStartAgentAuth,
  startTerminal: mockStartTerminal,
  stopTerminal: mockStopTerminal,
  sendTerminalInput: mockSendTerminalInput,
  setOllamaRole: mockSetOllamaRole,
  shutdownOllama: mockShutdownOllama
};

beforeEach(() => {
  baseStoreState.snapshot = { tasks: [], terminals: [] as unknown[] };
  baseStoreState.terminalBuffers = {};
  mockSetAgentRole.mockReset();
  mockStartAgentAuth.mockReset();
  mockStartTerminal.mockReset();
  mockStopTerminal.mockReset();
  mockSendTerminalInput.mockReset();
  mockSetOllamaRole.mockReset();
  mockShutdownOllama.mockReset();
});

vi.mock('../store', () => ({
  useWorkbenchStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(baseStoreState as unknown as Record<string, unknown>)
}));

function makeAgent(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: 'claude',
    displayName: 'Claude Code',
    binaryOrEndpoint: 'claude',
    authMode: 'native-login',
    role: 'coder',
    runner: 'wsl',
    status: 'missing',
    installHelpUrl: 'https://code.claude.com/docs/en/quickstart',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    },
    ...overrides
  };
}

// ── Existing render / label tests ─────────────────────────────────────────

describe('AgentPanel', () => {
  it('applies status CSS class to the section', () => {
    const { container } = render(<AgentPanel agent={makeAgent({ status: 'ready' })} />);
    expect(container.querySelector('.status-ready')).not.toBeNull();
  });

  it('shows ready status label and version', () => {
    render(<AgentPanel agent={makeAgent({ status: 'ready', version: '1.2.3' })} />);
    expect(screen.getByText('Ready — 1.2.3')).toBeInTheDocument();
  });

  it('shows needs-login status label', () => {
    render(<AgentPanel agent={makeAgent({ status: 'needs-login' })} />);
    expect(screen.getByText('Needs login')).toBeInTheDocument();
  });

  it('shows not-installed label for missing status', () => {
    render(<AgentPanel agent={makeAgent({ status: 'missing' })} />);
    expect(screen.getByText('Not installed')).toBeInTheDocument();
  });

  it('shows agent message when provided', () => {
    render(<AgentPanel agent={makeAgent({ status: 'needs-login', message: 'Run `claude login` to sign in.' })} />);
    expect(screen.getByText('Run `claude login` to sign in.')).toBeInTheDocument();
  });

  it('shows fallback guidance when message is absent', () => {
    render(<AgentPanel agent={makeAgent({ status: 'missing', message: undefined })} />);
    expect(screen.getByText(/was not found. Install it to continue/)).toBeInTheDocument();
  });

  it('shows install help link when installHelpUrl is set', () => {
    render(<AgentPanel agent={makeAgent({ status: 'missing' })} />);
    expect(screen.getByRole('link', { name: /Install Claude Code/ })).toBeInTheDocument();
  });

  it('shows error status label', () => {
    render(<AgentPanel agent={makeAgent({ status: 'error', message: 'Auth check timed out.' })} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Auth check timed out.')).toBeInTheDocument();
  });
});

// ── Button click tests ────────────────────────────────────────────────────

describe('AgentPanel button interactions', () => {
  it('Connect button calls startAgentAuth with the agent id', () => {
    mockStartAgentAuth.mockResolvedValue('session-1');
    render(<AgentPanel agent={makeAgent({ status: 'needs-login' })} />);
    fireEvent.click(screen.getByRole('button', { name: /connect claude code/i }));
    expect(mockStartAgentAuth).toHaveBeenCalledWith('claude');
  });

  it('Open terminal button calls startTerminal with the agent id', () => {
    mockStartTerminal.mockResolvedValue({ id: 'sess-1', agentId: 'claude', title: 'Claude', cwd: '/', runner: 'wsl', createdAt: '' });
    render(<AgentPanel agent={makeAgent({ status: 'ready' })} />);
    fireEvent.click(screen.getByRole('button', { name: /open terminal/i }));
    expect(mockStartTerminal).toHaveBeenCalledWith('claude');
  });

  it('shows auth session controls and sends Enter for an in-progress connect flow', () => {
    const session: TerminalSession = {
      id: 'sess-auth-1',
      agentId: 'gemini',
      title: 'Connect Gemini CLI',
      cwd: 'C:\\Users\\sakth',
      runner: 'windows',
      createdAt: ''
    };
    baseStoreState.snapshot = { tasks: [], terminals: [session] as unknown[] };
    baseStoreState.terminalBuffers = { 'sess-auth-1': '' };

    render(
      <AgentPanel
        agent={makeAgent({
          id: 'gemini',
          displayName: 'Gemini CLI',
          status: 'needs-login',
          role: 'architect'
        })}
      />
    );

    expect(screen.queryByRole('button', { name: /connect gemini cli/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop connect' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send Enter' }));
    expect(mockSendTerminalInput).toHaveBeenCalledWith('sess-auth-1', '\r');
    expect(screen.getByPlaceholderText(/leave blank and press send to accept defaults/i)).toBeInTheDocument();
  });

  it('treats an empty terminal input submit as Enter for active sessions', () => {
    const session: TerminalSession = {
      id: 'sess-live-1',
      agentId: 'claude',
      title: 'Claude Code terminal',
      cwd: 'D:\\ccgl room',
      runner: 'windows',
      createdAt: ''
    };
    baseStoreState.snapshot = { tasks: [], terminals: [session] as unknown[] };
    baseStoreState.terminalBuffers = { 'sess-live-1': 'prompt>' };

    render(<AgentPanel agent={makeAgent({ status: 'ready' })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(mockSendTerminalInput).toHaveBeenCalledWith('sess-live-1', '\r');
  });

  it('Ollama Sleep button calls shutdownOllama', () => {
    render(<AgentPanel agent={makeAgent({ id: 'ollama', displayName: 'Ollama', status: 'ready', capabilities: { supportsInteractive: false, supportsStructuredOutput: true, supportsEditing: false, supportsResume: false } })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sleep' }));
    expect(mockShutdownOllama).toHaveBeenCalled();
  });

  it('Ollama personality button calls setOllamaRole with the role and ollamaModel', () => {
    render(<AgentPanel agent={makeAgent({ id: 'ollama', displayName: 'Ollama', status: 'ready', capabilities: { supportsInteractive: false, supportsStructuredOutput: true, supportsEditing: false, supportsResume: false } })} ollamaModel="qwen2.5-coder:7b" />);
    fireEvent.click(screen.getByRole('button', { name: 'Monitor' }));
    expect(mockSetOllamaRole).toHaveBeenCalledWith('monitor', 'qwen2.5-coder:7b');
  });
});
