import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  sessionId?: string;
  buffer?: string;
  isFullScreen?: boolean;
}

export function TerminalPane({ sessionId, buffer, isFullScreen }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenLengthRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const terminal = new Terminal({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      theme: {
        background: '#101826',
        foreground: '#d8e1f0'
      }
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.focus();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    writtenLengthRef.current = 0;

    const disposable = terminal.onData((data) => {
      if (!sessionId) return;
      void window.workbench.sendTerminalInput(sessionId, data).catch(() => undefined);
    });

    const handleClick = () => terminal.focus();
    containerRef.current.addEventListener('click', handleClick);

    return () => {
      disposable.dispose();
      containerRef.current?.removeEventListener('click', handleClick);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!terminalRef.current || !buffer) {
      return;
    }

    const delta = buffer.slice(writtenLengthRef.current);
    if (delta) {
      terminalRef.current.write(delta);
      writtenLengthRef.current = buffer.length;
    }
  }, [buffer]);

  useEffect(() => {
    fitAddonRef.current?.fit();
  }, [sessionId, buffer]);

  // Keep the backend PTY dimensions in sync with the rendered terminal size.
  // Without this the PTY stays at its default column width, causing wrong line
  // wrapping and cursor positioning in interactive sessions.
  useEffect(() => {
    if (!containerRef.current || !sessionId) return;

    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRef.current;
        void window.workbench.resizeTerminal(sessionId, cols, rows).catch(() => undefined);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [sessionId]);

  if (!sessionId) {
    return <div className="terminal-empty">Interactive terminal is not running.</div>;
  }

  return <div ref={containerRef} className={isFullScreen ? 'terminal-fs' : 'terminal-canvas'} />;
}
