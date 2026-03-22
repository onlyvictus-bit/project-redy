import { describe, expect, it } from 'vitest';

import type { ArtifactBundle, Finding } from '@shared/types';

import { buildHandoffContext, compressDiff, dedupeFindings } from './context-transfer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    severity: 'medium',
    title: 'Example finding',
    body: 'Some description',
    sourceAgent: 'codex',
    ...overrides
  };
}

function makeArtifact(overrides: Partial<ArtifactBundle> = {}): ArtifactBundle {
  return {
    id: 'artifact-1',
    taskId: 'task-1',
    stepId: 'step-1',
    agentId: 'codex',
    role: 'reviewer',
    prompt: 'Review this',
    stdout: '',
    stderr: '',
    exitCode: 0,
    structuredEvents: [],
    summary: 'Found some issues',
    finalMessage: '',
    findings: [],
    commandRuns: [],
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// compressDiff
// ---------------------------------------------------------------------------

describe('compressDiff', () => {
  it('passes through a diff smaller than 50KB unchanged', () => {
    const smallDiff = 'diff --git a/foo.ts b/foo.ts\n+added line\n-removed line\n';
    expect(compressDiff(smallDiff)).toBe(smallDiff);
  });

  it('returns a summary for a diff exceeding 50KB', () => {
    // Build a diff larger than 50KB: each added line is ~60 bytes; 1000 lines = ~60KB
    const addedLines = Array.from({ length: 1000 }, (_, i) => `+added line number ${i} with padding to exceed the size threshold`);
    const removedLines = Array.from({ length: 200 }, (_, i) => `-removed line ${i}`);
    const block = [
      'diff --git a/src/big.ts b/src/big.ts',
      'index 000..111 100644',
      '--- a/src/big.ts',
      '+++ b/src/big.ts',
      ...addedLines,
      ...removedLines
    ].join('\n');

    const result = compressDiff(block);
    expect(result).toContain('[Diff truncated');
    expect(result).toContain('src/big.ts');
    expect(result).toContain(`+${addedLines.length}`);
    expect(result).toContain(`-${removedLines.length}`);
  });

  it('includes size in KB in the summary header', () => {
    const large = 'diff --git a/x.ts b/x.ts\n' + '+'.repeat(60_000);
    const result = compressDiff(large);
    expect(result).toMatch(/\d+KB/);
  });
});

// ---------------------------------------------------------------------------
// dedupeFindings
// ---------------------------------------------------------------------------

describe('dedupeFindings', () => {
  it('removes exact duplicate findings', () => {
    const f = makeFinding({ title: 'Race condition', file: 'src/a.ts', line: 10 });
    const result = dedupeFindings([f, f, f]);
    expect(result).toHaveLength(1);
  });

  it('keeps findings with different titles', () => {
    const f1 = makeFinding({ title: 'Issue A' });
    const f2 = makeFinding({ title: 'Issue B' });
    expect(dedupeFindings([f1, f2])).toHaveLength(2);
  });

  it('deduplicates case-insensitively on title', () => {
    const f1 = makeFinding({ title: 'Null dereference' });
    const f2 = makeFinding({ title: 'NULL DEREFERENCE' });
    expect(dedupeFindings([f1, f2])).toHaveLength(1);
  });

  it('sorts by severity descending (critical first)', () => {
    const findings = [
      makeFinding({ title: 'low one', severity: 'low' }),
      makeFinding({ title: 'critical one', severity: 'critical' }),
      makeFinding({ title: 'medium one', severity: 'medium' }),
      makeFinding({ title: 'high one', severity: 'high' })
    ];
    const sorted = dedupeFindings(findings);
    expect(sorted[0].severity).toBe('critical');
    expect(sorted[1].severity).toBe('high');
    expect(sorted[2].severity).toBe('medium');
    expect(sorted[3].severity).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// buildHandoffContext
// ---------------------------------------------------------------------------

describe('buildHandoffContext', () => {
  it('returns empty string for an empty artifact list', () => {
    expect(buildHandoffContext([])).toBe('');
  });

  it('includes agent id and role in output', () => {
    const artifact = makeArtifact({ agentId: 'gemini', role: 'architect', summary: 'All good' });
    const result = buildHandoffContext([artifact]);
    expect(result).toContain('gemini/architect');
    expect(result).toContain('All good');
  });

  it('includes finding bullets', () => {
    const artifact = makeArtifact({
      findings: [makeFinding({ severity: 'high', title: 'Missing null check', file: 'src/x.ts' })]
    });
    const result = buildHandoffContext([artifact]);
    expect(result).toContain('[high]');
    expect(result).toContain('Missing null check');
    expect(result).toContain('src/x.ts');
  });

  it('caps at 3 artifacts', () => {
    const artifacts = Array.from({ length: 6 }, (_, i) =>
      makeArtifact({ id: `a-${i}`, summary: `Summary ${i}` })
    );
    const result = buildHandoffContext(artifacts);
    // Only first 3 summaries should appear
    expect(result).toContain('Summary 0');
    expect(result).toContain('Summary 2');
    expect(result).not.toContain('Summary 3');
  });

  it('truncates very long summaries', () => {
    const longSummary = 'x'.repeat(3000);
    const artifact = makeArtifact({ summary: longSummary });
    const result = buildHandoffContext([artifact]);
    // Should be truncated with ellipsis
    expect(result).toContain('\u2026');
    expect(result.length).toBeLessThan(longSummary.length + 200);
  });

  it('wraps output with delimiter lines', () => {
    const result = buildHandoffContext([makeArtifact()]);
    expect(result).toContain('--- Prior agent context ---');
    expect(result).toContain('--- End context ---');
  });
});
