import { describe, expect, it } from 'vitest';

import { extractTriadPayload } from './parsing';

describe('extractTriadPayload', () => {
  it('parses triad JSON blocks', () => {
    const payload = extractTriadPayload(
      `review summary
<triad-json>{"summary":"Found issues","findings":[{"severity":"high","title":"Race condition","body":"Missing lock","file":"src/app.ts","line":12}]}</triad-json>`,
      'codex'
    );

    expect(payload.summary).toBe('Found issues');
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]).toMatchObject({
      sourceAgent: 'codex',
      severity: 'high',
      title: 'Race condition',
      file: 'src/app.ts',
      line: 12
    });
  });

  it('falls back to bullet extraction when JSON is missing', () => {
    const payload = extractTriadPayload(
      `- high severity issue in src/index.ts
- low style issue`,
      'gemini'
    );

    expect(payload.findings).toHaveLength(2);
    expect(payload.findings[0].sourceAgent).toBe('gemini');
  });
});
