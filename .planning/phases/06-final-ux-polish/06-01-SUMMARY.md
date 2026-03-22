---
phase: 06-final-ux-polish
plan: "01"
subsystem: renderer-css
tags: [css, dark-theme, design-tokens, agent-identity, accessibility]
one_liner: "Complete dark CSS token system replacing all light-mode hardcoded colors with CSS variables and adding agent identity, badge, and animation rules"

dependency_graph:
  requires: []
  provides:
    - "CSS custom property token system (--bg-primary through --agent-ollama)"
    - ".expand-terminal-btn class"
    - "[data-agent] identity selectors"
    - "@keyframes slideInFromRight"
    - ".empty-state and .empty-state-icon classes"
    - ".task-card-selected with --agent-color"
  affects:
    - "All renderer components consuming styles.css"
    - "Phase 6 Wave 2 React component changes (depend on class names defined here)"

tech_stack:
  added: []
  patterns:
    - "CSS custom property token system in :root"
    - "data-agent attribute selectors for scoped --agent-color injection"
    - "rgba() dark-tinted badges instead of pastel light-mode backgrounds"

key_files:
  created: []
  modified:
    - path: "src/renderer/src/styles.css"
      summary: "Full dark theme overhaul: :root tokens, structural rules, badge colors, agent identity, animations"

decisions:
  - ":root color-scheme set to dark; background/color moved to body/#root rule"
  - "--bg-card aliased to var(--bg-surface) for WorkflowBuilder backward compat without touching Phase 5 React code"
  - "[data-agent] attribute selectors scope --agent-color variable injection — avoids per-component JS style binding"
  - "terminal-canvas padding set to 0 with .xterm { padding: 2px } override to minimize gap between header and xterm content"
  - "handoff-codex color corrected from green #059669 to blue #1955d6 (agent identity color); handoff-gemini corrected from blue #2563EB to teal #0891b2"
  - "Both plan tasks combined into single commit since both only touch styles.css with no intermediate testable state"

metrics:
  duration: "4 minutes"
  completed_date: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 6 Plan 01: Complete Dark CSS Token System Summary

Complete dark theme overhaul of `styles.css`: replaced all hardcoded light-mode colors with CSS variable references, defined the full dark token system in `:root`, added agent identity color rules via `[data-agent]` attribute selectors, tightened terminal padding, and added `slideInFromRight` animation + `empty-state` CSS classes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Define :root dark token system and replace structural light colors | b045b67 | src/renderer/src/styles.css |
| 2 | Semantic badge colors + agent identity CSS + dense terminal + empty state + task selection CSS | b045b67 | src/renderer/src/styles.css |

## What Was Built

### :root Token System
- `--bg-primary: #0d1117` through `--bg-surface-3: #2d333b` (4-level dark surface hierarchy)
- `--text-primary: #e6edf3` and `--text-muted: #8b949e`
- `--border: rgba(255,255,255,0.08)` and `--border-light`
- `--accent-blue: #1955d6` and `--accent-blue-hover`
- `--bg-card: var(--bg-surface)` and `--bg-input: var(--bg-surface-2)` for WorkflowBuilder backward compat
- `--agent-claude: #7c3aed`, `--agent-codex: #1955d6`, `--agent-gemini: #0891b2`, `--agent-ollama: #d97706`

### Agent Identity Selectors
- `[data-agent="claude|codex|gemini|ollama"]` inject `--agent-color` CSS variable
- `.agent-panel { border-left: 3px solid var(--agent-color) }`
- `[data-agent] .terminal-canvas { border-color: var(--agent-color) }`
- `[data-agent] .agent-status-dot { background: var(--agent-color) }`

### Badge / Semantic Color System
- All `.stage-*` badges: dark `rgba()` tints with bright foreground colors
- All `.approval-*` badges: dark `rgba()` tints
- All `.step-*` backgrounds: dark `rgba()` tints
- All `.finding-*` backgrounds: dark `rgba()` tints
- Diff line colors (added/removed/header): dark `rgba()` + readable foregrounds
- Exit ok/fail: dark `rgba()` green/red

### Terminal Density
- `.terminal-canvas` padding: `0` (was `0.25rem`)
- `.terminal-canvas .xterm { padding: 2px }` xterm internal override added

### New CSS Classes
- `.expand-terminal-btn` — transparent button with var(--border) border, var(--text-muted) color
- `.empty-state` — centered muted text, 1.5rem padding
- `.empty-state-icon` — 1.5rem icon slot with 0.5 opacity
- `@keyframes slideInFromRight` — opacity 0→1, translateX 12px→0, 0.2s ease
- `.detail-panel` updated with `animation: slideInFromRight 0.2s ease`

## Verification Results

- `npm run typecheck`: PASS (0 errors)
- `npm run build`: PASS (28.69 kB CSS bundle)
- `var(--bg` references: 29 (plan required 20+)
- Orphaned light-mode colors: 0
- `[data-agent]` selector lines: 7 (plan required 6+)
- `.expand-terminal-btn` class: present
- `--bg-card: var(--bg-surface)` in :root: confirmed

## Deviations from Plan

### Auto-combined task commits

**Found during:** Task 1 and Task 2 execution
**Issue:** Both tasks exclusively modify `styles.css` — there is no intermediate compilable or testable state between Task 1 (structural rules) and Task 2 (badges and animations), as both typecheck and build require a valid CSS file.
**Fix:** Combined both tasks into a single atomic commit covering the complete file rewrite.
**Rule:** Rule 1 (no bug) — practical execution decision, not a deviation from the CSS spec itself.
**Commit:** b045b67

None — plan executed exactly as written for all CSS changes.

## Self-Check: PASSED

- `src/renderer/src/styles.css` — FOUND
- Commit `b045b67` — FOUND
- `--bg-primary: #0d1117` — present in :root
- `[data-agent="claude"]` — present
- `@keyframes slideInFromRight` — present
- `.expand-terminal-btn` — present
- `.empty-state` — present
- `var(--bg` count: 29
- Orphaned light colors: 0
