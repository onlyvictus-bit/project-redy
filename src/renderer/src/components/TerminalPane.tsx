import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  sessionId?: string;
  buffer?: string;
}

export function TerminalPane({ sessionId, buffer }: TerminalPaneProps) {
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

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    writtenLengthRef.current = 0;

    return () => {
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

  if (!sessionId) {
    return <div className="terminal-empty">Interactive terminal is not running.</div>;
  }

  return <div ref={containerRef} className="terminal-canvas" />;
}
