import type { AgentProfile, OllamaStatus } from '@shared/types';

import { useWorkbenchStore } from '../store';

interface SetupBannerProps {
  agents: { claude: AgentProfile; codex: AgentProfile; gemini: AgentProfile };
  ollama: OllamaStatus;
}

const REQUIRED_AGENTS: Array<{ key: 'claude' | 'codex' | 'gemini'; label: string }> = [
  { key: 'claude', label: 'Claude Code' },
  { key: 'codex', label: 'Codex CLI' },
  { key: 'gemini', label: 'Gemini CLI' }
];

function agentActionLabel(agent: AgentProfile): string {
  switch (agent.status) {
    case 'missing': return 'Install';
    case 'needs-login': return 'Connect';
    case 'installed': return 'Connect';
    default: return 'Retry';
  }
}

function agentStatusLabel(agent: AgentProfile): string {
  switch (agent.status) {
    case 'missing': return 'Not installed';
    case 'needs-login': return 'Needs login';
    case 'installed': return 'Not connected';
    case 'ready': return 'Ready';
    case 'running': return 'Running';
    case 'error': return agent.message ?? 'Error';
    default: return agent.status;
  }
}

export function SetupBanner({ agents, ollama }: SetupBannerProps) {
  const startAgentAuth = useWorkbenchStore((s) => s.startAgentAuth);
  const setOllamaRole = useWorkbenchStore((s) => s.setOllamaRole);

  const readyCount = REQUIRED_AGENTS.filter((a) => agents[a.key].status === 'ready').length;
  const totalRequired = REQUIRED_AGENTS.length;
  // Ollama sleeping is a deliberate user choice, not a setup gap — only CLI agents are required.
  const allReady = readyCount === totalRequired;

  if (allReady) return null;

  return (
    <div className="setup-banner">
      <div className="setup-banner-header">
        <strong>Get started</strong>
        <span className="setup-banner-count">{readyCount} / {totalRequired} agents ready</span>
      </div>

      <div className="setup-agent-cards">
        {REQUIRED_AGENTS.map(({ key, label }) => {
          const agent = agents[key];
          const isReady = agent.status === 'ready';
          const canConnect = agent.status === 'needs-login' || agent.status === 'installed';
          const isMissing = agent.status === 'missing';

          return (
            <div key={key} className={`setup-agent-card status-${agent.status}`}>
              <div className="setup-agent-name">{label}</div>
              <div className="setup-agent-status">{agentStatusLabel(agent)}</div>
              {isReady ? (
                <div className="setup-agent-ready">&#10003; Ready</div>
              ) : isMissing ? (
                <a
                  className="setup-agent-link"
                  href={agent.installHelpUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Install guide
                </a>
              ) : canConnect ? (
                <button
                  className="setup-agent-btn"
                  onClick={() => void startAgentAuth(agent.id)}
                >
                  {agentActionLabel(agent)}
                </button>
              ) : null}
            </div>
          );
        })}

        {/* Ollama — permanent 4th agent */}
        <div className={`setup-agent-card ${ollama.running ? 'status-ready' : 'status-installed'}`}>
          <div className="setup-agent-name">Ollama</div>
          <div className="setup-agent-status">{ollama.running ? 'Running' : ollama.available ? 'Installed, not running' : 'Not installed'}</div>
          {ollama.running ? (
            <div className="setup-agent-ready">&#10003; Running</div>
          ) : ollama.available ? (
            <button className="setup-agent-btn setup-agent-btn-secondary" onClick={() => void setOllamaRole('monitor')}>
              Wake Ollama
            </button>
          ) : (
            <a className="setup-agent-link" href="https://ollama.com/download" target="_blank" rel="noreferrer">
              Install guide
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
