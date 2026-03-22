# Phase 4: Archive Browser + Full-Screen Terminal Mode - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** User session context

<domain>
## Phase Boundary

Phase 4 delivers two distinct UI features on top of existing infrastructure:

1. **Archive Browser** — a task history explorer inside the Triad Workbench app. The `.triad-workbench/` folder and SQLite DB already store all data via `project-archive.ts`. This is purely a UI layer to surface that data.

2. **Full-Screen Terminal Mode** — each agent terminal panel (TerminalPane.tsx) gets an expand button that fills the entire app window so the user can read output and type prompts comfortably. Current small panels are difficult to read and interact with.

</domain>

<decisions>
## Implementation Decisions

### Archive Browser — Locked Requirements
- Task history explorer accessible from within the app (not external file browser)
- Transcript reader — full agent conversation transcripts
- Prompt viewer — prompts that were sent to each agent
- Artifact viewer — outputs, diffs, findings from past runs
- Event timeline — chronological view of task events per run
- Filters by: agent, workflow, date, severity
- Data source is existing `.triad-workbench/` archive + SQLite DB (no new backend needed)
- Archive data surfaced via IPC from `app-controller.ts` / `project-archive.ts`

### Full-Screen Terminal Mode — Locked Requirements
- Each agent terminal panel must have a visible expand/fullscreen button
- Clicking expand opens that terminal in a full-screen overlay covering the entire app window
- Full-screen mode must properly resize the xterm instance (use FitAddon from @xterm/addon-fit)
- User can exit full-screen with: Escape key keyboard shortcut + close/minimize button in overlay
- Terminal remains fully interactive in full-screen (input/output, scrollback all work)
- Smooth visual transition when entering/exiting full-screen
- Full-screen state tracked in Zustand store (which terminal is expanded, if any)

### Claude's Discretion
- Exact visual design of the Archive Browser (layout, panels, tabs)
- Whether Archive Browser is a side panel, full tab, or modal
- Icon used for the expand button (arrows-expand or maximize icon)
- CSS transition style (fade vs slide vs instant)
- Whether multiple filters can be applied simultaneously or one at a time
- Archive Browser pagination vs infinite scroll for large history

</decisions>

<specifics>
## Specific Ideas

### Full-Screen Terminal
- TerminalPane.tsx currently uses @xterm/xterm 5.5 + node-pty
- FitAddon must be called after the overlay DOM mounts to get correct dimensions
- Zustand `expandedTerminalId: string | null` field — null = no terminal expanded
- Overlay should be `position: fixed; inset: 0; z-index: 9999` to cover everything
- Escape key listener scoped to overlay (or global with guard)

### Archive Browser
- `project-archive.ts` writes to `.triad-workbench/<project>/` directory per project
- SQLite tables: `task_runs`, `artifacts` — these are the data sources
- IPC channel needed: e.g. `ARCHIVE_LIST_TASKS`, `ARCHIVE_GET_TASK_DETAIL`
- New component: `ArchiveBrowser.tsx` as a panel or dedicated view
- Filter state: local component state (not Zustand — ephemeral UI state)

</specifics>

<deferred>
## Deferred Ideas

- Export archive data to CSV/JSON (future)
- Archive search (full-text) — Phase 6 or later
- Archive data sharing between team members — out of scope for v0.1

</deferred>

---

*Phase: 04-archive-browser*
*Context gathered: 2026-03-22 via user session*
