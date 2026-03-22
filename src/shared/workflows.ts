import type { WorkflowDefinition } from './types';

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'code-review-fix-verify',
    label: 'Code -> Review -> Fix -> Verify',
    description: 'Claude codes, Codex reviews, Claude fixes, Codex verifies inside an isolated worktree.',
    mode: 'orchestrate',
    stages: ['brief', 'code', 'review', 'findings', 'fix', 'verify', 'promote']
  },
  {
    id: 'code-gemini-compare-codex-review',
    label: 'Code -> Gemini Compare -> Codex Review',
    description: 'Claude codes first, Gemini compares or critiques, and Codex finishes the final review pass.',
    mode: 'chain',
    stages: ['brief', 'code', 'review', 'findings', 'verify', 'promote']
  },
  {
    id: 'architecture-compare',
    label: 'Architecture Compare',
    description: 'Compare architecture suggestions from Claude, Codex, Gemini, and Ollama side-by-side.',
    mode: 'parallel',
    stages: ['brief', 'review', 'done']
  },
  {
    id: 'away-monitor',
    label: 'Away Monitor',
    description: 'Keep Ollama in monitor mode for long-running work and surface issues when the session stalls.',
    mode: 'direct',
    stages: ['brief', 'review', 'done']
  }
];
