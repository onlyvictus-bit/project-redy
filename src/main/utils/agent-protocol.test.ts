import { describe, expect, it } from 'vitest';

import { cleanOutput, generateRequestId } from './agent-protocol';

describe('generateRequestId', () => {
  it('returns a string starting with TRIAD-', () => {
    expect(generateRequestId()).toMatch(/^TRIAD-\d+-[0-9a-f]{8}$/);
  });

  it('returns unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateRequestId()));
    expect(ids.size).toBe(20);
  });
});

describe('cleanOutput', () => {
  it('strips ANSI color codes', () => {
    const raw = '\x1b[32mgreen text\x1b[0m and \x1b[1mbold\x1b[0m';
    expect(cleanOutput(raw)).toBe('green text and bold');
  });

  it('strips ANSI cursor-movement sequences', () => {
    const raw = '\x1b[2J\x1b[H\x1b[?25l some output \x1b[?25h';
    expect(cleanOutput(raw)).toBe('some output');
  });

  it('removes spinner / progress noise lines', () => {
    const raw = ['⠋ loading...', 'Scanning files', 'real output', '✓ done'].join('\n');
    expect(cleanOutput(raw)).not.toContain('⠋');
    expect(cleanOutput(raw)).not.toContain('✓ done');
    expect(cleanOutput(raw)).toContain('real output');
  });

  it('collapses three or more consecutive blank lines to two', () => {
    const raw = 'line1\n\n\n\n\nline2';
    expect(cleanOutput(raw)).toBe('line1\n\nline2');
  });

  it('trims leading and trailing whitespace', () => {
    expect(cleanOutput('\n\n  output  \n\n')).toBe('output');
  });

  it('returns empty string for blank input', () => {
    expect(cleanOutput('')).toBe('');
    expect(cleanOutput('\x1b[32m\x1b[0m')).toBe('');
  });

  it('preserves meaningful multiline output', () => {
    const raw = 'Summary: fixed bug\n\n<triad-json>{"summary":"ok","findings":[]}</triad-json>';
    const result = cleanOutput(raw);
    expect(result).toContain('Summary: fixed bug');
    expect(result).toContain('<triad-json>');
  });
});
