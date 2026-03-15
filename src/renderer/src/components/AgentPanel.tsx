import { useMemo, useState } from 'react';

import type { AgentId, AgentProfile, AgentRole } from '@shared/types';

import { TerminalPane } from './TerminalPane';
import { useWorkbenchStore } from '../store';

const ROLE_OPTIONS: AgentRole[] = ['coder', 'reviewer', 'tester', 'architect', 'planner', 'monitor', 'developer', 'compare-only', 'off'];

function formatStatus(agent: AgentProfile): string {
  return `${agent.status}${agent.version ? ` - ${agent.version}` : ''}`;
}

export function AgentPanel({ agent }: { agent: AgentProfile }) {
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const terminalBuffers = useWorkbenchStore((state) => state.terminalBuffers);
  const setAgentRole = useWorkbenchStore((state) => state.setAgentRole);
  const startTerminal = useWorkbenchStore((state) => state.startTerminal);
  const stopTerminal = useWorkbenchStore((state) => state.stopTerminal);
  const sendTerminalInput = useWorkbenchStore((state) => state.sendTerminalInput);
  const setOllamaRole = useWorkbenchStore((state) => state.setOllamaRole);
  const session = snapshot?.terminals.find((s) => s.agentId === agent.id);
  const [input, setInput] = useState('');

  const latestArtifact = useMemo(
    () => snapshot?.tasks.flatMap((task) => task.artifacts).find((artifact) => artifact.agentId === agent.id),
    [agent.id, snapshot?.tasks]
  );

  return (
    <section className="agent-panel">
      <div className="panel-header">
        <div>
          <h3>{agent.displayName}</h3>
          <p>{formatStatus(agent)}</p>
        </div>
        <select
          value={agent.role}
          onChange={(event) => {
            const role = event.target.value as AgentRole;
            if (agent.id === 'ollama') {
              void setOllamaRole(role);
            } else {
              void setAgentRole(agent.id, role);
            }
          }}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <div className="panel-body">
        <p className="panel-message">{agent.message || 'No probe details yet.'}</p>
        {agent.installHelpUrl ? (
          <a href={agent.installHelpUrl} target="_blank" rel="noreferrer">
            Install or login help
          </a>
        ) : null}

        <div className="panel-actions">
          {agent.capabilities.supportsInteractive ? (
            session ? (
              <button onClick={() => void stopTerminal(session.id)}>Stop terminal</button>
            ) : (
              <button onClick={() => void startTerminal(agent.id)}>Start terminal</button>
            )
          ) : null}
        </div>

        <TerminalPane sessionId={session?.id} buffer={session ? terminalBuffers[session.id] : ''} />

        {session ? (
          <form
            className="terminal-input"
            onSubmit={(event) => {
              event.preventDefault();
              if (!input.trim()) {
                return;
              }
              void sendTerminalInput(session.id, `${input}\r`);
              setInput('');
            }}
          >
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Send input to ${agent.displayName}`} />
            <button type="submit">Send</button>
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
