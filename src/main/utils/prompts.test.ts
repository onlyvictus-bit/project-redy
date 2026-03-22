import { describe, expect, it } from 'vitest';

import type { Finding, TaskRun } from '@shared/types';

import { buildCodingPrompt, buildFixPrompt, buildReviewPrompt } from './prompts';

function makeTask(brief = 'Add null check to user resolver'): TaskRun {
  return {
    id: 'task-1',
    projectId: 'project-1',
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc123',
    worktreePath: '/repo/.triad/task-1',
    stage: 'code',
    brief,
    assignedAgents: ['claude', 'codex'],
    approvalState: 'pending',
    branchName: 'triad/task-1',
    findings: [],
    artifacts: [],
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function makeFinding(title: string, severity: Finding['severity'] = 'high'): Finding {
  return {
    severity,
    title,
    body: `${title} needs attention`,
    sourceAgent: 'codex',
    file: 'src/resolver.ts',
    line: 42
  };
}

// ---------------------------------------------------------------------------
// buildCodingPrompt
// ---------------------------------------------------------------------------

describe('buildCodingPrompt', () => {
  it('includes the task brief', () => {
    const prompt = buildCodingPrompt(makeTask('Fix the login bug'));
    expect(prompt).toContain('Fix the login bug');
  });

  it('includes the triad-json contract instruction', () => {
    const prompt = buildCodingPrompt(makeTask());
    expect(prompt).toContain('<triad-json>');
  });
});

// ---------------------------------------------------------------------------
// buildReviewPrompt
// ---------------------------------------------------------------------------

describe('buildReviewPrompt', () => {
  it('includes the task brief', () => {
    const prompt = buildReviewPrompt(makeTask('Add pagination'), 'diff output', 'codex');
    expect(prompt).toContain('Add pagination');
  });

  it('includes the diff', () => {
    const diff = '--- a/src/x.ts\n+++ b/src/x.ts\n+new line';
    const prompt = buildReviewPrompt(makeTask(), diff, 'gemini');
    expect(prompt).toContain(diff);
  });

  it('shows placeholder when no diff is provided', () => {
    const prompt = buildReviewPrompt(makeTask(), '', 'codex');
    expect(prompt).toContain('No diff was generated');
  });

  it('covers correctness dimension', () => {
    const prompt = buildReviewPrompt(makeTask(), 'diff', 'codex');
    expect(prompt).toMatch(/correctness/i);
  });

  it('covers security dimension', () => {
    const prompt = buildReviewPrompt(makeTask(), 'diff', 'codex');
    expect(prompt).toMatch(/security/i);
  });

  it('covers regressions dimension', () => {
    const prompt = buildReviewPrompt(makeTask(), 'diff', 'codex');
    expect(prompt).toMatch(/regressions?/i);
  });

  it('covers test gaps dimension', () => {
    const prompt = buildReviewPrompt(makeTask(), 'diff', 'codex');
    expect(prompt).toMatch(/test gaps?/i);
  });

  it('covers spec compliance dimension', () => {
    const prompt = buildReviewPrompt(makeTask(), 'diff', 'codex');
    expect(prompt).toMatch(/spec compliance/i);
  });

  it('includes severity guide', () => {
    const prompt = buildReviewPrompt(makeTask(), 'diff', 'codex');
    expect(prompt).toMatch(/severity guide/i);
  });

  it('includes prior context when provided', () => {
    const ctx = '--- Prior agent context ---\n[codex/reviewer] Found issues\n--- End context ---';
    const prompt = buildReviewPrompt(makeTask(), 'diff', 'codex', ctx);
    expect(prompt).toContain(ctx);
  });

  it('omits prior context section when not provided', () => {
    const prompt = buildReviewPrompt(makeTask(), 'diff', 'codex');
    expect(prompt).not.toContain('Prior context');
  });
});

// ---------------------------------------------------------------------------
// buildFixPrompt
// ---------------------------------------------------------------------------

describe('buildFixPrompt', () => {
  it('includes the task brief', () => {
    const prompt = buildFixPrompt(makeTask('Fix race condition'), []);
    expect(prompt).toContain('Fix race condition');
  });

  it('lists findings in the prompt', () => {
    const findings = [
      makeFinding('Null pointer dereference', 'critical'),
      makeFinding('Missing input validation', 'medium')
    ];
    const prompt = buildFixPrompt(makeTask(), findings);
    expect(prompt).toContain('Null pointer dereference');
    expect(prompt).toContain('Missing input validation');
    expect(prompt).toContain('critical');
  });

  it('includes prior context when provided', () => {
    const ctx = '--- Prior agent context ---\n[claude/coder] Refactored handler\n--- End context ---';
    const prompt = buildFixPrompt(makeTask(), [], ctx);
    expect(prompt).toContain(ctx);
  });

  it('omits prior context section when not provided', () => {
    const prompt = buildFixPrompt(makeTask(), [makeFinding('Issue A')]);
    expect(prompt).not.toContain('Prior context');
  });

  it('handles empty findings gracefully', () => {
    const prompt = buildFixPrompt(makeTask(), []);
    expect(prompt).toContain('No prior findings were recorded');
  });
});
