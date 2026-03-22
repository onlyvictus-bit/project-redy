# Phase 6: Final UX Polish - Research

**Researched:** 2026-03-22
**Domain:** CSS dark theme, CSS custom properties, React inline style audit, xterm theming
**Confidence:** HIGH (all findings from direct source code inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Switch `color-scheme` to `dark` in `:root`
- Background: deep navy `#0d1117` (GitHub-dark style) or equivalent dark surface
- Surface cards: `#161b22` or `#1a1f2e`
- Text: `#e6edf3` primary, `#8b949e` secondary/muted
- Borders: `rgba(255,255,255,0.08)`
- Primary button: keep `#1955d6` (blue) — works on dark
- All color tokens updated in one CSS pass — no JS theme toggle needed for Phase 6
- Claude: `#7c3aed` (violet/purple)
- Codex: `#1955d6` (blue — matches existing primary)
- Gemini: `#0891b2` (teal/cyan)
- Ollama: `#d97706` (amber/orange)
- Applied as: left border accent on agent panel card, terminal container border color, colored dot/badge on status indicator, task card left border when that agent is primary
- Implemented via CSS custom properties on the agent panel wrapper: `--agent-color: #7c3aed`
- Reduce `.terminal-canvas` padding from current value to `4px` or less
- Remove or minimize gap between the xterm header bar and the canvas div
- Compact the agent panel header height slightly
- Keep the xterm font size at 13px (do not change xterm options — layout only)
- No project selected → center-aligned message "Select or add a project to get started"
- No tasks yet → "No tasks yet — choose a workflow and run it"
- Archive browser with no history → "No task history for this project yet"
- Agent not running / not connected → existing status badges are sufficient; no new empty state needed here
- Selected task in task list gets a stronger visual treatment: colored left border (`--agent-color`), slightly elevated background
- Task detail panel slides in (CSS `transition: opacity 0.2s ease, transform 0.2s ease` from slightly right)
- "No task selected" placeholder in detail area with subtle icon/text

### Claude's Discretion
- Exact shade values (within the families above)
- Whether to use a CSS variable system (`--bg-primary`, `--surface`, `--text-primary`, etc.) or direct values — prefer CSS vars for maintainability
- Exact empty state copy
- Whether task detail transition uses transform or just opacity

### Deferred Ideas (OUT OF SCOPE)
- Light/dark theme toggle switch — out of scope; dark-only for v0.1
- Custom accent color picker — out of scope
- Animated agent avatars — out of scope
- Font size preference — out of scope
</user_constraints>

---

## Summary

Phase 6 is a pure CSS + minimal React tweak phase. All five features (dark theme, agent identity colors, dense terminal, empty states, task selection polish) operate entirely in `src/renderer/src/styles.css` and three component files. No IPC, no backend, no new dependencies are needed.

The primary risk area is the large number of **inline styles** scattered across `ArchiveBrowser.tsx` and `AgentPanel.tsx`. ArchiveBrowser uses dark-sounding inline color values already (e.g., `#0e1a28`, `#1a2535`) which happen to look correct in dark mode, but they bypass the CSS variable system entirely. AgentPanel's "Expand" button has six inline style properties that will resist theming unless replaced with a CSS class. The planner must account for these as explicit touch points.

The second risk area is the large count of **hardcoded light-mode colors** embedded deep in styles.css — specifically finding severity backgrounds (`.finding-high`, `.finding-medium`, `.finding-low`), stage badge colors (`.stage-brief` through `.stage-error`), diff viewer line colors (`.diff-line-added`, `.diff-line-removed`), approval badges, and step status backgrounds. All of these must be updated in the dark theme pass or they will appear as harsh light blobs on a dark background.

**Primary recommendation:** Approach the dark theme as a complete CSS variable token replacement pass. Define all tokens in `:root`, then do a single search-and-replace sweep across the full ~1045-line stylesheet, then handle the inline style exceptions in React components as a separate task.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS custom properties | Native | Token system for theming | No dependencies, supported in all Electron Chromium versions |
| @xterm/xterm | Already installed | Terminal emulator | Already in use; `theme` option accepts bg/fg object |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS `transition` | Native | Task detail slide-in | opacity + transform transitions require no library |
| CSS `data-*` attributes | Native | Agent color targeting | Cleaner than per-agent class names |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS custom properties on `:root` | Tailwind dark: prefix | No Tailwind in project — adding it is out of scope |
| `data-agent` attribute | Per-agent CSS class (`.agent-claude`) | `data-agent` is more extensible; either works for this scale |
| CSS `transform` slide-in | React `framer-motion` | No animation library in project — pure CSS is correct choice |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended CSS Variable System

Define all tokens in `:root` at the top of `styles.css`, replacing the current hardcoded `:root` block:

```css
:root {
  color-scheme: dark;
  font-family: 'Segoe UI', sans-serif;

  /* Backgrounds */
  --bg-primary: #0d1117;
  --bg-surface: #161b22;
  --bg-surface-2: #21262d;
  --bg-surface-3: #2d333b;

  /* Text */
  --text-primary: #e6edf3;
  --text-muted: #8b949e;
  --text-on-dark: #d8e1f0;

  /* Borders */
  --border: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.05);

  /* Accent */
  --accent-blue: #1955d6;
  --accent-blue-hover: #123da0;

  /* Agent identity */
  --agent-claude: #7c3aed;
  --agent-codex: #1955d6;
  --agent-gemini: #0891b2;
  --agent-ollama: #d97706;

  /* Semantic — finding severities */
  --finding-critical-bg: rgba(139, 26, 26, 0.18);
  --finding-high-bg: rgba(139, 26, 26, 0.18);
  --finding-medium-bg: rgba(180, 83, 9, 0.18);
  --finding-low-bg: rgba(13, 90, 167, 0.18);
  --finding-info-bg: rgba(13, 90, 167, 0.12);

  /* Semantic — diff */
  --diff-added-bg: rgba(26, 92, 26, 0.25);
  --diff-added-text: #7ee787;
  --diff-removed-bg: rgba(139, 26, 26, 0.25);
  --diff-removed-text: #f85149;
}
```

### Pattern 1: Agent Color via data-agent Attribute

**What:** `AgentPanel.tsx` adds `data-agent={agent.id}` to the `<section>` wrapper. CSS selects on this attribute to inject the per-agent `--agent-color` variable.

**When to use:** Any element that needs the agent color without knowing which agent it is.

```typescript
// AgentPanel.tsx — add data-agent attribute
<section
  className={`agent-panel status-${agent.status}`}
  data-agent={agent.id}
>
```

```css
/* styles.css */
[data-agent="claude"]  { --agent-color: var(--agent-claude); }
[data-agent="codex"]   { --agent-color: var(--agent-codex); }
[data-agent="gemini"]  { --agent-color: var(--agent-gemini); }
[data-agent="ollama"]  { --agent-color: var(--agent-ollama); }

.agent-panel {
  border-left: 3px solid var(--agent-color, var(--border));
}
```

### Pattern 2: Task Card Agent Color

**What:** `TaskCard.tsx` receives a `task: TaskRun` which has `assignedAgents: AgentId[]`. The primary agent is `assignedAgents[0]`. Add `data-agent` to the `<article>` element.

```typescript
// TaskCard.tsx — add data-agent attribute
<article
  className={`task-card${isSelected ? ' task-card-selected' : ''}`}
  data-agent={task.assignedAgents[0]}
  onClick={onSelect}
>
```

```css
/* styles.css */
.task-card {
  border-left: 3px solid var(--agent-color, var(--border));
}

.task-card-selected {
  background: var(--bg-surface-2);
  border-left-color: var(--agent-color, var(--accent-blue));
  box-shadow: none; /* remove old blue box-shadow */
}
```

### Pattern 3: Task Detail Slide-in Transition

**What:** Wrap `TaskDetailPanel` content in a CSS transition triggered by the `task` prop presence. The component already returns different markup for `task === undefined` vs populated task.

```css
/* styles.css */
.detail-panel {
  transition: opacity 0.2s ease, transform 0.2s ease;
  opacity: 1;
  transform: translateX(0);
}

.detail-panel-entering {
  opacity: 0;
  transform: translateX(12px);
}
```

**Implementation note:** The simplest approach is a CSS animation on `.detail-panel` using `@keyframes` triggered by a remount (React `key` prop change when `task.id` changes). This avoids adding React state for animation phase.

```css
@keyframes slideInFromRight {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}

.detail-panel {
  animation: slideInFromRight 0.2s ease;
}
```

In `TaskDetailPanel.tsx`, add `key={task?.id}` to the outer `<div className="detail-panel">` so React remounts it when a new task is selected, triggering the animation.

### Pattern 4: Empty State Component Pattern

**What:** Replace bare `<p className="empty-state">` elements with a more informative placeholder.

```css
/* styles.css */
.empty-state {
  color: var(--text-muted);
  text-align: center;
  padding: 1.5rem 1rem;
  font-size: 0.9rem;
  line-height: 1.6;
}

.empty-state-icon {
  font-size: 1.5rem;
  display: block;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}
```

No new component needed — App.tsx can inline the JSX with a wrapping div:

```tsx
// In App.tsx — Tasks empty state
<div className="empty-state">
  <span className="empty-state-icon">--</span>
  No tasks yet — choose a workflow and run it
</div>
```

### Recommended File Change Scope

```
src/renderer/src/
├── styles.css              # Primary target — all dark theme tokens + layout changes
├── components/
│   ├── AgentPanel.tsx      # Add data-agent attr; replace Expand button inline styles with CSS class
│   ├── TaskCard.tsx        # Add data-agent attr based on assignedAgents[0]
│   ├── TaskDetailPanel.tsx # Add key={task?.id} for slide animation; update empty state copy
│   └── App.tsx             # Update empty state text strings (no-project, no-tasks)
```

ArchiveBrowser.tsx does NOT need changes — its inline dark styles are compatible with the dark theme, and the CONTEXT.md only calls for updating the ArchiveBrowser empty state (no-project message) which is already `<p className="empty-state">No project selected.</p>` — the CSS class update covers it.

### Anti-Patterns to Avoid

- **Replacing inline styles in ArchiveBrowser.tsx wholesale:** The inline styles are already dark-compatible. Replacing them with CSS classes would be a large refactor outside scope. Avoid.
- **Modifying xterm Terminal constructor options:** The locked decision says layout only. The existing `background: '#101826'` and `foreground: '#d8e1f0'` in TerminalPane.tsx are fine for dark mode and must not be changed.
- **Adding a new React component for empty states:** A CSS class upgrade plus JSX string changes in existing components is sufficient and stays in scope.
- **Using `!important` for dark theme overrides:** All light-mode color values in styles.css should be replaced with var() references, not overridden with `!important`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal theme | Custom CSS over xterm canvas | xterm `theme` option in constructor | xterm injects its own styles; CSS targeting the canvas internals is fragile |
| Animation timing | JS setTimeout-based transitions | CSS `@keyframes` + React `key` prop | No JS needed; React key change triggers remount which restarts the animation |
| Agent color lookup | Runtime JS color map | CSS `[data-agent]` selector | CSS handles it with zero JS; no render cost |

**Key insight:** Every problem in this phase has a pure CSS solution. The only React changes needed are attribute additions (`data-agent`) and string updates (empty state copy) — no new state, no new components, no new effects.

---

## Common Pitfalls

### Pitfall 1: Inline Styles Override CSS Variables
**What goes wrong:** Setting `--bg-surface` in `:root` but a component has `style={{ background: '#fff' }}` — the inline style wins regardless of the CSS variable.
**Why it happens:** Inline styles have higher specificity than any class selector.
**How to avoid:** Audit every component for inline color/background/border styles. There are three known locations (see "Hardcoded Color Inventory" below).
**Warning signs:** Element appears light on dark background after theme switch.

### Pitfall 2: xterm Injects Its Own Stylesheet
**What goes wrong:** `@xterm/xterm/css/xterm.css` is imported in TerminalPane.tsx. xterm adds padding inside the `.xterm` container and `.xterm-screen` div via its own CSS rules. Simply setting `padding: 0` on `.terminal-canvas` may not fully eliminate the gap.
**Why it happens:** xterm's CSS targets internal elements (`.xterm`, `.xterm-viewport`, `.xterm-screen`).
**How to avoid:** Target the xterm internal classes directly:
```css
.terminal-canvas .xterm { padding: 0; }
.terminal-canvas .xterm-viewport { overflow-y: hidden; }
```
**Warning signs:** Visual gap between panel header and terminal text persists after padding: 0 on `.terminal-canvas`.

### Pitfall 3: Stage Badge Colors Missed
**What goes wrong:** Dark background applied but `.stage-brief`, `.stage-code`, etc. still have light backgrounds (`#eef2ff`, `#e6f4ff`). These appear as jarring light chips in the task card and detail panel.
**Why it happens:** There are 9 stage variants and 4 approval badge variants and 5 step status variants — easy to miss some.
**How to avoid:** Create dark-mode semantic color variables for each category and update all variants in one block. Full list:
- Stage badges: `stage-brief`, `stage-code`, `stage-review`, `stage-findings`, `stage-fix`, `stage-verify`, `stage-promote`, `stage-done`, `stage-error`
- Approval badges: `approval-pending`, `approval-approved`, `approval-rejected`, `approval-not-required`
- Step items: `step-completed`, `step-running`, `step-failed`, `step-queued`
- Finding backgrounds: `finding-high`, `finding-critical`, `finding-medium`, `finding-low`, `finding-info`
**Warning signs:** Colored chips/badges appear white or very light on the dark card surface.

### Pitfall 4: Handoff Button Colors Don't Match Agent Colors
**What goes wrong:** `.handoff-codex { background: #059669; }` (green) and `.handoff-gemini { background: #2563EB; }` (blue) don't match the locked agent colors (Codex=`#1955d6`, Gemini=`#0891b2`).
**Why it happens:** The handoff buttons were added before the agent identity color system was defined.
**How to avoid:** When applying the agent color system, update handoff button colors to match: Claude=`#7c3aed`, Codex=`#1955d6`, Gemini=`#0891b2`. There's no Ollama handoff button.

### Pitfall 5: archive-path `<code>` Block Light Background
**What goes wrong:** `.archive-path code { background: #edf3fb; color: #173257; }` — hard light blue background on dark theme.
**Why it happens:** Hardcoded light color that won't be overridden by the `:root` change.
**How to avoid:** Update to dark-mode equivalent: `background: var(--bg-surface-2); color: var(--text-primary)`.

### Pitfall 6: detail-promote Light Green Banner
**What goes wrong:** `.detail-promote { background: #d1fae5; }` with `.detail-promote strong { color: #065f46; }` — a bright light green stripe appears in the dark task detail.
**Why it happens:** Promotion state UI uses light semantic green.
**How to avoid:** Change to a dark green tint: `background: rgba(6, 95, 70, 0.2); color: #34d399`.

### Pitfall 7: WorkflowBuilder Panel Background
**What goes wrong:** `.workflow-builder-panel { background: var(--bg-card, #fff); }` — the fallback is `#fff`. If `--bg-card` is not defined in `:root`, the modal will be white.
**Why it happens:** Phase 5 used `--bg-card` as a CSS variable with a light fallback. Phase 6 must define `--bg-card` as `var(--bg-surface)` in `:root`.
**How to avoid:** Add `--bg-card: var(--bg-surface)` and `--bg-input: var(--bg-surface-2)` to the `:root` token block. The `.workflow-builder-panel` CSS already uses these vars.

---

## Code Examples

### Complete :root Dark Token Block
```css
/* Source: CONTEXT.md locked decisions + codebase audit */
:root {
  color-scheme: dark;
  font-family: 'Segoe UI', sans-serif;

  --bg-primary:   #0d1117;
  --bg-surface:   #161b22;
  --bg-surface-2: #21262d;
  --bg-surface-3: #2d333b;

  --text-primary: #e6edf3;
  --text-muted:   #8b949e;

  --border:       rgba(255, 255, 255, 0.08);
  --border-light: rgba(255, 255, 255, 0.05);

  --accent-blue:       #1955d6;
  --accent-blue-hover: #123da0;

  /* Must define these so WorkflowBuilder fallbacks resolve correctly */
  --bg-card:  var(--bg-surface);
  --bg-input: var(--bg-surface-2);
  --text-muted-var: var(--text-muted);

  /* Agent identity */
  --agent-claude: #7c3aed;
  --agent-codex:  #1955d6;
  --agent-gemini: #0891b2;
  --agent-ollama: #d97706;
}
```

### Dark Theme body/root background
```css
/* Replace current light gradient */
body, #root {
  margin: 0;
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

### .top-bar Dark Version
```css
/* Replace rgba(255,255,255,0.8) with dark surface */
.top-bar {
  background: rgba(22, 27, 34, 0.9);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}
```

### .card / .agent-panel Dark Version
```css
/* Replace rgba(255,255,255,0.86) */
.card,
.agent-panel,
.bottom-dock .composer {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
}
```

### Agent Identity Left Border
```css
[data-agent="claude"]  { --agent-color: var(--agent-claude); }
[data-agent="codex"]   { --agent-color: var(--agent-codex); }
[data-agent="gemini"]  { --agent-color: var(--agent-gemini); }
[data-agent="ollama"]  { --agent-color: var(--agent-ollama); }

.agent-panel {
  border-left: 3px solid var(--agent-color, var(--border));
  /* Remove general border-left from .card,.agent-panel rule above */
}
```

### Dense Terminal — Target xterm Internals
```css
.terminal-canvas {
  padding: 2px;
  min-height: 180px;
  background: #101826;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--agent-color, var(--border));
}

/* xterm internal padding reduction */
.terminal-canvas .xterm {
  padding: 0;
}
.terminal-canvas .xterm-viewport {
  overflow-y: hidden;
}
```

### Dark Stage Badges
```css
.stage-brief    { background: rgba(61, 79, 124, 0.25); color: #a5b4fc; }
.stage-code     { background: rgba(13, 90, 167, 0.25); color: #60a5fa; }
.stage-review   { background: rgba(180, 83, 9, 0.25);  color: #fb923c; }
.stage-findings { background: rgba(139, 26, 26, 0.25); color: #fca5a5; }
.stage-fix      { background: rgba(146, 64, 14, 0.25); color: #fbbf24; }
.stage-verify   { background: rgba(7, 89, 133, 0.25);  color: #38bdf8; }
.stage-promote  { background: rgba(6, 95, 70, 0.25);   color: #34d399; }
.stage-done     { background: rgba(6, 95, 70, 0.25);   color: #34d399; }
.stage-error    { background: rgba(139, 26, 26, 0.25); color: #f87171; }
```

### Task Detail Slide-in Animation
```css
@keyframes slideInFromRight {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}

.detail-panel {
  animation: slideInFromRight 0.2s ease;
}
```

```tsx
// TaskDetailPanel.tsx — add key prop so React remounts on task change
<div key={task?.id ?? 'empty'} className="detail-panel">
  {/* ... */}
</div>
```

### Replacing AgentPanel Expand Button Inline Styles
```css
/* styles.css */
.expand-terminal-btn {
  margin-top: 4px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 2px 8px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 11px;
  font-family: inherit;
}

.expand-terminal-btn:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}
```

```tsx
// AgentPanel.tsx — remove the style prop entirely
<button
  className="expand-terminal-btn"
  aria-label={`Expand ${agent.displayName} terminal`}
  onClick={() => expandTerminal(session.id)}
>
  Expand
</button>
```

---

## Hardcoded Color Inventory

This is the complete list of hardcoded colors found in the React components (NOT in styles.css). These are the specific inline styles the planner must treat as explicit tasks.

### AgentPanel.tsx — Expand button (lines 172–183)
All six properties are inline style — replace with `.expand-terminal-btn` class.
```
background: 'transparent'    → var(--bg-surface) or transparent
border: '1px solid #3a4a5a'  → var(--border)
color: '#d8e1f0'              → var(--text-muted)
padding: '2px 8px'
borderRadius: 3
fontSize: 11
```

### ArchiveBrowser.tsx — Entire component is inline-styled (lines 94–289)
These colors are already dark-compatible. They do NOT need to be changed for dark mode to work. However they bypass the CSS variable system entirely. This is a known technical debt — out of scope for Phase 6 per CONTEXT.md (only the empty state text needs updating there, handled by the CSS `.empty-state` class update).

Specific ArchiveBrowser inline colors that are already dark:
- Container: `border: '1px solid #2a3a4a'` — dark border, compatible
- Task list container: `border: '1px solid #2a3a4a'` — compatible
- Loading/error text: `color: '#8a9ab0'` and `color: '#e06c6c'` — compatible
- Task row selected: `background: '#1e3050'` — compatible
- Task row unselected: `background: 'transparent'` — compatible
- Detail header: `background: '#1a2535'` — compatible
- Tab bar: `background: '#151f2e'` — compatible
- Content area: `background: '#0e1a28'` — compatible

### App.tsx — Right rail "Browse history" button (lines 232–238)
```
style={{ fontSize: 12, padding: '3px 10px' }}
```
These are layout-only, no color. Compatible with dark theme as-is (inherits button styles from global `button` rule). No action needed.

---

## Complete CSS Change Map

Every CSS rule in styles.css that needs updating for dark theme:

| CSS Selector | Current Value | Dark Value |
|---|---|---|
| `:root` background | `linear-gradient(180deg, #f1f5fb, #dfe7f1)` | Remove — move to body/html |
| `:root` color | `#122033` | `var(--text-primary)` |
| `body, #root` | no background | `background: var(--bg-primary)` |
| `.top-bar` background | `rgba(255,255,255,0.8)` | `rgba(22,27,34,0.9)` |
| `.top-bar` border-bottom | `rgba(18,32,51,0.1)` | `var(--border)` |
| `.card, .agent-panel, .composer` bg | `rgba(255,255,255,0.86)` | `var(--bg-surface)` |
| `.card, .agent-panel, .composer` border | `rgba(18,32,51,0.1)` | `var(--border)` |
| `.task-card` border | `rgba(18,32,51,0.08)` | `var(--border-light)` |
| `.panel-message, .artifact-summary p, .empty-state, .loading-screen` | `color: #4c5f7c` | `var(--text-muted)` |
| `.hint-text, .archive-meta` | `color: #4c5f7c` | `var(--text-muted)` |
| `input, select, textarea` bg | `white` | `var(--bg-surface-2)` |
| `input, select, textarea` border | `rgba(18,32,51,0.15)` | `var(--border)` |
| `input, select, textarea` color | (inherited) | `var(--text-primary)` |
| `.diff-toolbar` bg | `#f5f7fa` | `var(--bg-surface-2)` |
| `.artifact-header` bg | `#f5f7fa` | `var(--bg-surface-2)` |
| `.artifact-pre` bg | `#f5f7fa` | `var(--bg-surface-3)` |
| `.artifact-role` bg | `#e0e9f5` | `rgba(255,255,255,0.08)` |
| `.artifact-list-item` bg | `#f5f7fa` | `var(--bg-surface-2)` |
| `.artifact-list-item:hover` bg | `#e8edf5` | `var(--bg-surface-3)` |
| `.artifact-list-item-active` bg | `#dbe4f0` | `var(--bg-surface-3)` |
| `.artifact-viewer` bg | `rgba(255,255,255,0.86)` | `var(--bg-surface)` |
| `.detail-panel-empty` bg | `rgba(255,255,255,0.86)` | `var(--bg-surface)` |
| `.detail-summary` bg | `rgba(255,255,255,0.86)` | `var(--bg-surface)` |
| `.detail-promote` bg | `#d1fae5` | `rgba(6,95,70,0.2)` |
| `.detail-promote strong` color | `#065f46` | `#34d399` |
| `.archive-path code` bg | `#edf3fb` | `var(--bg-surface-2)` |
| `.archive-path code` color | `#173257` | `var(--text-primary)` |
| `.finding-high, .finding-critical` bg | `#fff0f0` | `var(--finding-high-bg)` |
| `.finding-medium` bg | `#fff8e8` | `var(--finding-medium-bg)` |
| `.finding-low, .finding-info` bg | `#eef6ff` | `var(--finding-low-bg)` |
| `.stage-*` (9 variants) | light pastels | see dark stage badges example |
| `.approval-pending` | `#fff3e0 / #b45309` | `rgba(180,83,9,0.25) / #fb923c` |
| `.approval-approved` | `#d1fae5 / #065f46` | `rgba(6,95,70,0.25) / #34d399` |
| `.approval-rejected` | `#ffe0e0 / #8b1a1a` | `rgba(139,26,26,0.25) / #f87171` |
| `.approval-not-required` | `#f5f7fa / #4c5f7c` | `var(--bg-surface-2) / var(--text-muted)` |
| `.step-completed` bg | `#f0fdf4` | `rgba(6,95,70,0.15)` |
| `.step-running` bg | `#eff6ff` | `rgba(25,85,214,0.15)` |
| `.step-failed` bg | `#fef2f2` | `rgba(139,26,26,0.15)` |
| `.step-queued` bg | `#f5f7fa` | `var(--bg-surface-2)` |
| `.diff-line-added` | `#e6ffe6 / #1a5c1a` | `var(--diff-added-bg) / var(--diff-added-text)` |
| `.diff-line-removed` | `#ffe6e6 / #8b1a1a` | `var(--diff-removed-bg) / var(--diff-removed-text)` |
| `.diff-line-header` | `#eef2ff / #3d4f7c` | `var(--bg-surface-3) / var(--text-muted)` |
| `.findings-critical-badge` | `#ffe0e0 / #8b1a1a` | `rgba(139,26,26,0.25) / #f87171` |
| `.setup-agent-card` bg | `#f5f7fa` | `var(--bg-surface-2)` |
| `.setup-agent-card.status-ready` bg | `#f0fdf4` | `rgba(6,95,70,0.15)` |
| `.setup-banner` bg | `rgba(255,255,255,0.9)` | `var(--bg-surface)` |
| `.personality-btn` bg | `#edf3fb` | `var(--bg-surface-2)` |
| `.personality-btn` color | `#122033` | `var(--text-primary)` |
| `.progress-stage-upcoming` | `#8b9ab8 / #f5f7fa` | `var(--text-muted) / var(--bg-surface-2)` |
| `.handoff-codex` | `#059669` | `var(--agent-codex)` = `#1955d6` |
| `.handoff-gemini` | `#2563EB` | `var(--agent-gemini)` = `#0891b2` |
| `.exit-ok` | `#e6ffe6 / #1a5c1a` | `rgba(26,92,26,0.25) / #34d399` |
| `.exit-fail` | `#ffe6e6 / #8b1a1a` | `rgba(139,26,26,0.25) / #f87171` |
| `.artifact-stderr` | `#fff5f5 / #8b1a1a` | `rgba(139,26,26,0.15) / #f87171` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Light theme CSS with hardcoded colors | CSS custom property tokens | Phase 6 | Single-token changes propagate everywhere |
| No agent differentiation | `data-agent` attribute + CSS var scoping | Phase 6 | Each panel/card shows identity color with zero JS |
| xterm full padding | `.xterm { padding: 0 }` targeting | Phase 6 | More terminal content visible in same space |

**Already present (no change needed):**
- `.task-card-selected` class — exists at line 760, currently uses `border-color: #1955d6; box-shadow: 0 0 0 1px #1955d6`. Will be updated to use agent color + background lift.
- `.detail-panel-empty` class — exists at line 609, already renders the empty task detail state.
- `.empty-state` class — exists at line 159, color only. Used in 5 places across App.tsx and ArchiveBrowser.tsx.
- TerminalPane xterm theme — already set to dark (`background: '#101826'`, `foreground: '#d8e1f0'`). These match the dark design. **Do not change the TerminalPane.tsx constructor options.**

---

## Open Questions

1. **xterm internal padding class names**
   - What we know: xterm injects `.xterm`, `.xterm-viewport`, `.xterm-screen` class names internally, and padding is applied via its own CSS.
   - What's unclear: Exact pixel values xterm applies. May need DevTools inspection to confirm which internal selector holds the gap.
   - Recommendation: The planner should include a verification step: after applying `.terminal-canvas .xterm { padding: 0; }`, visually confirm the header-to-canvas gap is eliminated. If not, target `.xterm-screen` as well.

2. **WorkflowBuilder CSS var `--bg-card` vs new system**
   - What we know: Phase 5 introduced `--bg-card` and `--border` as variables with light fallbacks in `.workflow-builder-panel`. The new token system uses `--bg-surface` instead of `--bg-card`.
   - What's unclear: Whether to add a `--bg-card` alias or rename the WorkflowBuilder CSS to use `--bg-surface` directly.
   - Recommendation: Add `--bg-card: var(--bg-surface)` to `:root` so the Phase 5 WorkflowBuilder CSS continues to work without touching the component. This is safer.

3. **TaskCard's `assignedAgents[0]` availability**
   - What we know: `TaskRun.assignedAgents: AgentId[]` is typed as an array. In practice the workflow engine assigns at least one agent.
   - What's unclear: Whether `assignedAgents[0]` is ever empty at render time.
   - Recommendation: The `data-agent` attribute assignment `task.assignedAgents[0]` is safe — if undefined, the attribute is omitted (React behavior) and the CSS `[data-agent]` selector simply won't match, falling back to `var(--agent-color, var(--border))`.

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection: `src/renderer/src/styles.css` (1045 lines, fully read)
- Direct source code inspection: `src/renderer/src/components/AgentPanel.tsx` — inline styles confirmed on lines 172–183
- Direct source code inspection: `src/renderer/src/components/TerminalPane.tsx` — xterm theme options confirmed on lines 27–30
- Direct source code inspection: `src/renderer/src/components/ArchiveBrowser.tsx` — inline dark styles confirmed throughout
- Direct source code inspection: `src/renderer/src/components/TaskCard.tsx` — task-card-selected class confirmed
- Direct source code inspection: `src/renderer/src/components/TaskDetailPanel.tsx` — detail-panel-empty and current empty state text confirmed
- Direct source code inspection: `src/renderer/src/App.tsx` — empty state locations confirmed
- Direct source code inspection: `src/shared/types.ts` — AgentId, TaskRun.assignedAgents type confirmed
- Direct source code inspection: `.planning/phases/06-final-ux-polish/06-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- CSS custom property browser support: universally supported in Electron Chromium — no caveats

### Tertiary (LOW confidence)
- xterm internal class names (`.xterm`, `.xterm-viewport`, `.xterm-screen`) — based on xterm/xterm.js source knowledge, not re-verified against installed version. Treat as needing DevTools confirmation during implementation.

---

## Metadata

**Confidence breakdown:**
- Dark theme token system: HIGH — all hardcoded values inventoried from source
- Agent color implementation: HIGH — component structure confirmed, data-agent pattern is straightforward
- Terminal padding: MEDIUM — xterm internal class names need runtime verification
- Empty states: HIGH — all 5 locations identified with exact JSX context
- Task selection: HIGH — task-card-selected and detail-panel classes fully documented

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable CSS domain; no dependency changes expected)
