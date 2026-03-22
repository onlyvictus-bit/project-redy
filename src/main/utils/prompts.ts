import type { AgentId, Finding, TaskRun } from '@shared/types';

function findingsBlock(findings: Finding[]): string {
  if (!findings.length) {
    return 'No prior findings were recorded.';
  }

  return findings
    .map((finding) => {
      const location = finding.file ? ` (${finding.file}${finding.line ? `:${finding.line}` : ''})` : '';
      return `- [${finding.severity}] ${finding.title}${location}: ${finding.body}`;
    })
    .join('\n');
}

function jsonContract(sourceAgent: AgentId): string {
  return [
    'Return a concise natural-language answer, then include one machine-readable payload wrapped in <triad-json>...</triad-json>.',
    'The JSON object must contain:',
    '{"summary": "short summary", "findings": [{"severity":"low|medium|high|critical|info","title":"...","body":"...","file":"optional","line":1,"recommendedAction":"optional"}], "notes":["optional"], "recommendedRole":"optional"}.',
    `Set source-specific details from the perspective of ${sourceAgent}.`
  ].join('\n');
}

export function buildCodingPrompt(task: TaskRun): string {
  return [
    'You are the coding agent in Triad Workbench.',
    `Task brief: ${task.brief}`,
    'Work only inside the current git worktree.',
    'Make the necessary code changes, run the minimum checks you need, and explain the result.',
    jsonContract('claude')
  ].join('\n\n');
}

export function buildReviewPrompt(task: TaskRun, diff: string, reviewer: AgentId, priorContext?: string): string {
  const reviewDimensions = [
    'Review the current diff across these dimensions:',
    '1. **Correctness** — Does the implementation match the task brief? Are there logic errors or edge-case failures?',
    '2. **Security** — Any injection risks, auth bypass, unsafe I/O, exposed secrets, or OWASP Top-10 concerns?',
    '3. **Regressions** — Could this change break existing functionality? Check call sites and dependents.',
    '4. **Test gaps** — What unit, integration, or edge-case tests are missing or insufficient?',
    '5. **Spec compliance** — Does the output match the stated intent, or does it over-build / under-build?',
    '',
    'Severity guide: critical = exploitable or data-loss; high = likely defect or regression; medium = risky pattern or code smell; low = style; info = observation.',
    'Do not modify source files. If helpful, run tests or lightweight checks in this worktree.',
  ].join('\n');

  return [
    'You are the reviewer/tester in Triad Workbench.',
    `Task brief: ${task.brief}`,
    reviewDimensions,
    ...(priorContext ? [`Prior context:\n${priorContext}`] : []),
    `Current diff:\n\n${diff || 'No diff was generated.'}`,
    jsonContract(reviewer)
  ].join('\n\n');
}

export function buildFixPrompt(task: TaskRun, findings: Finding[], priorContext?: string): string {
  return [
    'You are the coding agent in Triad Workbench.',
    `Task brief: ${task.brief}`,
    'Fix the following findings without undoing unrelated work:',
    findingsBlock(findings),
    ...(priorContext ? [`Prior context:\n${priorContext}`] : []),
    jsonContract('claude')
  ].join('\n\n');
}

export function buildArchitecturePrompt(task: TaskRun, source: AgentId): string {
  return [
    'You are acting as an architecture advisor in Triad Workbench.',
    `Task brief: ${task.brief}`,
    'Provide a practical implementation approach with tradeoffs and edge cases.',
    jsonContract(source)
  ].join('\n\n');
}

export function buildMonitorPrompt(task: TaskRun): string {
  return [
    'You are in monitor mode for Triad Workbench.',
    `Watch for failures, stalls, and risky diffs for this task: ${task.brief}.`,
    'Suggest when another agent should intervene, but do not apply changes yourself.',
    jsonContract('ollama')
  ].join('\n\n');
}
