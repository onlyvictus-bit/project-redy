import { randomBytes } from 'node:crypto';

export type RequestId = string;

/** Generate a unique request ID: TRIAD-<timestamp>-<8 hex chars> */
export function generateRequestId(): RequestId {
  return `TRIAD-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

// ANSI escape sequences: color codes, private-mode flags (?25l), cursor movement, OSC sequences
const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g;

// Lines that are pure terminal / spinner noise with no agent content
const NOISE_LINE_RE =
  /^(\s*[|/\-\\]\s*|\s*\[[-=|\\\/]\]\s*|[✓✗⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏].*)$|^(Scanning\s|Thinking\.\.\.|Working\.\.\.|Processing\.\.\.)/;

/**
 * Clean raw agent output:
 * 1. Strip ANSI color / cursor codes
 * 2. Remove known spinner and progress-bar noise lines
 * 3. Collapse three or more consecutive blank lines down to two
 * 4. Trim surrounding whitespace
 */
export function cleanOutput(raw: string): string {
  // 1. Strip ANSI escape sequences
  let cleaned = raw.replace(ANSI_RE, '');

  // 2. Filter spinner / noise lines
  cleaned = cleaned
    .split('\n')
    .filter((line) => !NOISE_LINE_RE.test(line))
    .join('\n');

  // 3. Collapse excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}
