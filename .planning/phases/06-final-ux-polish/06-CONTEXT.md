# Phase 6: Final UX Polish - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Roadmap + current codebase state

<domain>
## Phase Boundary

Phase 6 is the final visual and interaction polish pass for Milestone v0.1. The app is fully functional (Phases 1–5 complete). This phase focuses on:
1. **Dark theme** — switch `color-scheme: light` to dark, replace light background/surface tokens with dark equivalents across `styles.css`
2. **Agent identity colors** — each agent (Claude=purple, Codex=blue, Gemini=teal, Ollama=orange) gets a consistent accent color used on their panel header, terminal border, task card indicator, and status badge
3. **Dense terminal visuals** — tighten padding in terminal panels so more output is visible; reduce the gap between terminal header and xterm canvas
4. **Better empty states** — replace blank panels with helpful placeholder text/icons when no project is selected, no tasks exist, no archive history, no agent is running
5. **Smoother task selection flow** — clicking a task in the list should visually highlight it clearly; the transition between "no task selected" and "task detail view" should feel intentional

Current state: `color-scheme: light`, light blue gradient background `#f1f5fb→#dfe7f1`, `color: #122033`. All changes are CSS + small React tweaks — no IPC, no backend changes.

</domain>

<decisions>
## Implementation Decisions

### Dark Theme — Locked
- Switch `color-scheme` to `dark` in `:root`
- Background: deep navy `#0d1117` (GitHub-dark style) or equivalent dark surface
- Surface cards: `#161b22` or `#1a1f2e`
- Text: `#e6edf3` primary, `#8b949e` secondary/muted
- Borders: `rgba(255,255,255,0.08)`
- Primary button: keep `#1955d6` (blue) — works on dark
- All color tokens updated in one CSS pass — no JS theme toggle needed for Phase 6

### Agent Identity Colors — Locked
- Claude: `#7c3aed` (violet/purple)
- Codex: `#1955d6` (blue — matches existing primary)
- Gemini: `#0891b2` (teal/cyan)
- Ollama: `#d97706` (amber/orange)
- Applied as: left border accent on agent panel card, terminal container border color, colored dot/badge on status indicator, task card left border when that agent is primary
- Implemented via CSS custom properties on the agent panel wrapper: `--agent-color: #7c3aed`

### Dense Terminal Visuals — Locked
- Reduce `.terminal-canvas` padding from current value to `4px` or less
- Remove or minimize gap between the xterm header bar and the canvas div
- Compact the agent panel header height slightly
- Keep the xterm font size at 13px (do not change xterm options — layout only)

### Better Empty States — Locked
- No project selected → center-aligned message "Select or add a project to get started"
- No tasks yet → "No tasks yet — choose a workflow and run it"
- Archive browser with no history → "No task history for this project yet"
- Agent not running / not connected → existing status badges are sufficient; no new empty state needed here

### Smoother Task Selection — Locked
- Selected task in task list gets a stronger visual treatment: colored left border (`--agent-color`), slightly elevated background
- Task detail panel slides in (CSS `transition: opacity 0.2s ease, transform 0.2s ease` from slightly right)
- "No task selected" placeholder in detail area with subtle icon/text

### Claude's Discretion
- Exact shade values (within the families above)
- Whether to use a CSS variable system (`--bg-primary`, `--surface`, `--text-primary`, etc.) or direct values — prefer CSS vars for maintainability
- Exact empty state copy
- Whether task detail transition uses transform or just opacity

</decisions>

<specifics>
## Specific Ideas

### CSS Variable System
```css
:root {
  --bg-primary: #0d1117;
  --bg-surface: #161b22;
  --bg-surface-2: #21262d;
  --text-primary: #e6edf3;
  --text-muted: #8b949e;
  --border: rgba(255,255,255,0.08);
  --accent-blue: #1955d6;
  --agent-claude: #7c3aed;
  --agent-codex: #1955d6;
  --agent-gemini: #0891b2;
  --agent-ollama: #d97706;
}
```

### Agent Color Application in React
`AgentPanel.tsx` already knows the `agentId`. Add a helper:
```ts
const AGENT_COLORS: Record<AgentId, string> = {
  claude: 'var(--agent-claude)',
  codex: 'var(--agent-codex)',
  gemini: 'var(--agent-gemini)',
  ollama: 'var(--agent-ollama)',
};
```
Apply as inline style `borderLeftColor` or via a `data-agent` attribute + CSS selector.

### Files affected
- `src/renderer/src/styles.css` — primary target (dark theme + dense layout + empty states + task selection)
- `src/renderer/src/components/AgentPanel.tsx` — agent color prop/data attribute
- `src/renderer/src/components/TaskCard.tsx` — selected highlight + agent color border
- `src/renderer/src/components/TaskDetailPanel.tsx` — slide-in transition + no-task placeholder
- `src/renderer/src/App.tsx` — empty states for no-project and no-tasks

</specifics>

<deferred>
## Deferred Ideas

- Light/dark theme toggle switch — out of scope; dark-only for v0.1
- Custom accent color picker — out of scope
- Animated agent avatars — out of scope
- Font size preference — out of scope

</deferred>

---

*Phase: 06-final-ux-polish*
*Context gathered: 2026-03-22 via roadmap + codebase inspection*
