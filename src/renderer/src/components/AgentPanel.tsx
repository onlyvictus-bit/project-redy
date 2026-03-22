import { useMemo, useState } from 'react';

import type { AgentProfile, AgentRole, AgentStatus } from '@shared/types';

import { TerminalPane } from './TerminalPane';
import { useWorkbenchStore } from '../store';

const ROLE_OPTIONS: AgentRole[] = ['coder', 'reviewer', 'tester', 'architect', 'planner', 'monitor', 'developer', 'compare-only', 'off'];

// Ollama personality buttons: user-facing label → backend AgentRole
const OLLAMA_PERSONALITIES: Array<{ label: string; role: AgentRole }> = [
  { label: 'Sleep', role: 'off' },
  { label: 'Guide', role: 'planner' },
  { label: 'Tester', role: 'tester' },
  { label: 'Developer', role: 'developer' },
  { label: 'Monitor', role: 'monitor' }
];

const STATUS_LABELS: Record<AgentStatus, string> = {
  missing: 'Not installed',
  installed: 'Not connected',
  'needs-login': 'Needs login',
  ready: 'Ready',
  running: 'Running',
  error: 'Error'
};

function formatStatus(agent: AgentProfile): string {
  const label = STATUS_LABELS[agent.status];
  if (agent.id === 'ollama') return label;
  return agent.version ? `${label} — ${agent.version}` : label;
}

function statusGuidance(agent: AgentProfile): string {
  if (agent.message) return agent.message;
  switch (agent.status) {
    case 'missing':
      return `${agent.displayName} was not found. Install it to continue.`;
    case 'installed':
      return `${agent.displayName} is installed but not connected. Click Connect to sign in.`;
    case 'needs-login':
      return `${agent.displayName} needs to sign in. Click Connect to authorize inside the app.`;
    case 'ready':
      return `${agent.displayName} is authenticated and ready.`;
    case 'running':
      return `${agent.displayName} is actively running a job.`;
    case 'error':
      return `${agent.displayName} reported an error. Try re-connecting or check the runner.`;
  }
}

export function AgentPanel({ agent, ollamaModel }: { agent: AgentProfile; ollamaModel?: string }) {
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const terminalBuffers = useWorkbenchStore((state) => state.terminalBuffers);
  const setAgentRole = useWorkbenchStore((state) => state.setAgentRole);
  const startAgentAuth = useWorkbenchStore((state) => state.startAgentAuth);
  const startTerminal = useWorkbenchStore((state) => state.startTerminal);
  const stopTerminal = useWorkbenchStore((state) => state.stopTerminal);
  const sendTerminalInput = useWorkbenchStore((state) => state.sendTerminalInput);
  const setOllamaRole = useWorkbenchStore((state) => state.setOllamaRole);
  const shutdownOllama = useWorkbenchStore((state) => state.shutdownOllama);
  const expandTerminal = useWorkbenchStore((state) => state.expandTerminal);
  const expandedTerminalId = useWorkbenchStore((state) => state.expandedTerminalId);
  const session = snapshot?.terminals.find((s) => s.agentId === agent.id);
  const [input, setInput] = useState('');

  const latestArtifact = useMemo(
    () => snapshot?.tasks.flatMap((task) => task.artifacts).find((artifact) => artifact.agentId === agent.id),
    [agent.id, snapshot?.tasks]
  );

  const isOllama = agent.id === 'ollama';
  const isLiveSession = agent.status === 'ready' || agent.status === 'running';
  const hasSession = Boolean(session);
  const hasAuthSession = hasSession && !isLiveSession;
  const needsConnect = !isOllama && !hasSession && (agent.status === 'needs-login' || agent.status === 'installed');
  const isMissing = !isOllama && agent.status === 'missing';
  const authHint = (() => {
    if (!hasAuthSession) return undefined;
    if (agent.id === 'gemini') {
      return 'Gemini sign-in can appear blank in the embedded terminal on Windows. Click Send Enter once to accept the default Google sign-in option, then finish sign-in in your browser.';
    }
    return `Use the controls below to continue the ${agent.displayName} sign-in flow inside the app.`;
  })();

  return (
    <section className={`agent-panel status-${agent.status}`}>
      <div className="panel-header">
        <div>
          <h3>{agent.displayName}</h3>
          <p>{formatStatus(agent)}</p>
        </div>
        {/* Ollama: no role dropdown — personality buttons below */}
        {!isOllama ? (
          <select
            value={agent.role}
            onChange={(event) => void setAgentRole(agent.id, event.target.value as AgentRole)}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="panel-body">
        <p className="panel-message">{statusGuidance(agent)}</p>

        {/* Ollama personality segmented control */}
        {isOllama ? (
          <div className="ollama-personalities">
            {OLLAMA_PERSONALITIES.map(({ label, role }) => (
              <button
                key={role}
                className={`personality-btn${agent.role === role ? ' personality-btn-active' : ''}`}
                onClick={() => {
                  if (role === 'off') {
                    void shutdownOllama();
                  } else {
                    void setOllamaRole(role, ollamaModel);
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {/* In-app connect button for CLI agents that need login */}
        {needsConnect ? (
          <button className="connect-btn" onClick={() => void startAgentAuth(agent.id)}>
            Connect {agent.displayName}
          </button>
        ) : null}

        {/* Install help link for missing agents */}
        {isMissing && agent.installHelpUrl ? (
          <a href={agent.installHelpUrl} target="_blank" rel="noreferrer" className="install-link">
            Install {agent.displayName}
          </a>
        ) : null}

        {/* Terminal controls for ready/running agents */}
        {hasSession || isLiveSession ? (
          <div className="panel-actions">
            {hasSession ? (
              <button onClick={() => void stopTerminal(session!.id)}>
                {hasAuthSession ? 'Stop connect' : 'Stop terminal'}
              </button>
            ) : agent.capabilities.supportsInteractive ? (
              <button onClick={() => void startTerminal(agent.id)}>Open terminal</button>
            ) : null}
            {hasAuthSession && session ? (
              <button onClick={() => void sendTerminalInput(session.id, '\r')}>
                Send Enter
              </button>
            ) : null}
          </div>
        ) : null}

        {authHint ? <p className="hint-text">{authHint}</p> : null}

        {/* Expand terminal to full-screen */}
        {session ? (
          <button
            className="expand-terminal-btn"
            aria-label={`Expand ${agent.displayName} terminal`}
            onClick={() => expandTerminal(session.id)}
            style={{
              marginTop: 4,
              background: 'transparent',
              border: '1px solid #3a4a5a',
              color: '#d8e1f0',
              padding: '2px 8px',
              cursor: 'pointer',
              borderRadius: 3,
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            Expand
          </button>
        ) : null}

        {/* PTY output — shown for both auth sessions and interactive terminals */}
        <TerminalPane sessionId={session?.id} buffer={session ? terminalBuffers[session.id] : ''} isFullScreen={expandedTerminalId === session?.id} />

        {session ? (
          <form
            className="terminal-input"
            onSubmit={(event) => {
              event.preventDefault();
              const payload = input ? `${input}\r` : '\r';
              void sendTerminalInput(session.id, payload);
              setInput('');
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                hasAuthSession
                  ? `Leave blank and press Send to accept defaults, or type text for ${agent.displayName}`
                  : `Leave blank and press Send for Enter, or type input for ${agent.displayName}`
              }
            />
            <button type="submit">{hasAuthSession ? 'Send input' : 'Send'}</button>
          </form>
        ) : null}

        <div className="artifact-summary">
          <strong>Latest artifact</strong>
          <p>{latestArtifact?.summary || 'No artifacts yet.'}</p>
        </div>
      </div>
    </section>
  );
}
