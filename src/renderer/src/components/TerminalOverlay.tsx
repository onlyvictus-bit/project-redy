import { useWorkbenchStore } from '../store';

export function TerminalOverlay() {
  const expandedTerminalId = useWorkbenchStore((s) => s.expandedTerminalId);
  const collapseTerminal = useWorkbenchStore((s) => s.collapseTerminal);
  const snapshot = useWorkbenchStore((s) => s.snapshot);

  if (!expandedTerminalId) return null;

  const session = snapshot?.terminals.find((s) => s.id === expandedTerminalId);

  return (
    <div
      className="terminal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        opacity: 1,
        transition: 'opacity 0.15s ease',
        pointerEvents: 'none',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') collapseTerminal();
      }}
    >
      <div
        className="terminal-overlay-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#1a2535',
          pointerEvents: 'auto',
        }}
      >
        <span
          style={{
            color: '#d8e1f0',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
          }}
        >
          {session ? `${session.agentId} — ${session.title}` : 'Terminal'}
        </span>
        <button
          className="overlay-close-btn"
          onClick={collapseTerminal}
          style={{
            background: 'transparent',
            border: '1px solid #3a4a5a',
            color: '#d8e1f0',
            padding: '4px 10px',
            cursor: 'pointer',
            borderRadius: 4,
            fontFamily: 'inherit',
          }}
        >
          Close [Esc]
        </button>
      </div>
      {/* NO TerminalPane here — the existing AgentPanel TerminalPane expands via isFullScreen prop */}
    </div>
  );
}
