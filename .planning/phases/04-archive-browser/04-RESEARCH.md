# Phase 4: Archive Browser + Full-Screen Terminal Mode - Research

**Researched:** 2026-03-22
**Domain:** Electron IPC / xterm.js overlays / SQLite read queries / React component architecture
**Confidence:** HIGH (all findings come from direct inspection of the codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Archive Browser
- Task history explorer accessible from within the app (not external file browser)
- Transcript reader — full agent conversation transcripts
- Prompt viewer — prompts that were sent to each agent
- Artifact viewer — outputs, diffs, findings from past runs
- Event timeline — chronological view of task events per run
- Filters by: agent, workflow, date, severity
- Data source is existing `.triad-workbench/` archive + SQLite DB (no new backend needed)
- Archive data surfaced via IPC from `app-controller.ts` / `project-archive.ts`

#### Full-Screen Terminal Mode
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

### Deferred Ideas (OUT OF SCOPE)
- Export archive data to CSV/JSON (future)
- Archive search (full-text) — Phase 6 or later
- Archive data sharing between team members — out of scope for v0.1
</user_constraints>

---

## Summary

Phase 4 splits cleanly into two independent vertical slices: the full-screen terminal overlay (pure renderer work) and the archive browser (IPC + renderer work). Neither slice requires new npm packages — all needed libraries are already installed. The critical constraint is that both features touch four layers in a consistent order: `shared/ipc.ts` → `preload/index.ts` → `main/index.ts` → `AppController` for any new IPC, and `store.ts` → component for any new UI state.

The xterm full-screen overlay has a subtle but load-bearing constraint: `terminal.open(domElement)` is a one-time operation per Terminal instance. The current `TerminalPane` creates the Terminal and calls `terminal.open(containerRef.current)` inside a `useEffect` keyed on `sessionId`. To enter full-screen without re-initialising the PTY, the container `<div>` must stay in the DOM and move into the overlay — not be replaced. The correct pattern is to keep a single container node alive and use CSS to position it, or to mount the overlay div in place and reparent the container ref, but reparenting is fragile. The simplest correct approach is to render both the normal-position container and the overlay shell at all times, and use CSS `display:none` / `position:fixed` toggling on the **wrapper**, never unmounting the xterm canvas div.

The archive data lives in two places: (1) SQLite `task_runs` table holds `task_json` (the full `TaskRun` object) and `run_events` holds the event timeline; (2) the flat-file archive in `.triad-workbench/` holds transcripts, artifact files, and snapshot JSONs. For the Archive Browser, reading from SQLite via `PersistenceService` is the primary path — it is already structured for query by `project_id`. The flat-file transcripts (JSONL per session) supplement when the user wants to view a full terminal transcript.

**Primary recommendation:** Implement the full-screen terminal overlay first (pure renderer, zero IPC, self-contained) then implement the archive browser (requires new IPC channels and new types).

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xterm/xterm | ^5.5.0 | Terminal emulator | Already used in TerminalPane |
| @xterm/addon-fit | ^0.10.0 | Fit terminal to container size | Already used via FitAddon |
| zustand | ^5.0.8 | UI state (expandedTerminalId) | Project-wide state layer |
| better-sqlite3 | ^11.10.0 | SQLite read queries for archive | Already used in PersistenceService |
| react | ^19.1.1 | Archive Browser components | Entire renderer is React |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + @testing-library/react | ^3.2.4 / ^16.3.2 | Component tests | New components need unit tests matching project pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS overlay (position:fixed) | React Portal (ReactDOM.createPortal) | Portal renders outside the component tree but still inside the same DOM document — both work. CSS overlay is simpler and already used for modals in this codebase. Portal is only needed if z-index stacking is blocked by ancestor overflow:hidden, which is not the case here. |
| SQLite via PersistenceService (main) | Direct fs read of .triad-workbench/ JSON | SQLite is already queried; new read methods are a small addition. Flat files are a fallback only for transcripts not duplicated in SQLite. |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended File Layout for Phase 4

```
src/
├── shared/
│   ├── ipc.ts               # ADD: archive IPC channels + WorkbenchApi methods
│   └── types.ts             # ADD: ArchiveTaskSummary, ArchiveTaskDetail types
├── preload/
│   └── index.ts             # ADD: bridge entries for new archive IPC
├── main/
│   ├── index.ts             # ADD: ipcMain.handle registrations
│   ├── app-controller.ts    # ADD: listArchiveTasks(), getArchiveTaskDetail() methods
│   └── services/
│       └── persistence.ts   # ADD: loadArtifactsForTask(), loadRunEvents() already exists
├── renderer/src/
│   ├── store.ts             # ADD: expandedTerminalId state + archive actions
│   └── components/
│       ├── TerminalPane.tsx         # MODIFY: accept isFullScreen prop, CSS class change only
│       ├── TerminalOverlay.tsx      # NEW: full-screen wrapper with Escape handler
│       ├── AgentPanel.tsx           # MODIFY: add expand button, pass expandedTerminalId
│       └── ArchiveBrowser.tsx       # NEW: task history explorer
```

### Pattern 1: Full-Screen Terminal — CSS-toggle, never unmount xterm canvas

**What:** The xterm Terminal instance is created once and bound to a DOM node via `terminal.open(node)`. If that node is removed from the DOM, xterm loses its measurement context and FitAddon.fit() will compute 0 columns. The fix is to keep the xterm canvas div mounted continuously and change only its CSS context.

**When to use:** Any time a terminal needs to move between positions (normal panel vs full-screen overlay).

**Implementation approach:**

```typescript
// TerminalPane.tsx — add isFullScreen prop, apply CSS class to wrapper
// The underlying canvas div is ALWAYS mounted; the wrapper switches classes.

interface TerminalPaneProps {
  sessionId?: string;
  buffer?: string;
  isFullScreen?: boolean;    // NEW prop
}

// In render:
return (
  <div className={isFullScreen ? 'terminal-fullscreen-canvas' : 'terminal-canvas'}
       ref={containerRef} />
);
```

```typescript
// TerminalOverlay.tsx — renders the full-screen shell, rendered at App root level
// Always in DOM; visibility toggled via CSS class based on expandedTerminalId

export function TerminalOverlay() {
  const expandedTerminalId = useWorkbenchStore(s => s.expandedTerminalId);
  const collapseTerminal = useWorkbenchStore(s => s.collapseTerminal);

  useEffect(() => {
    if (!expandedTerminalId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapseTerminal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedTerminalId, collapseTerminal]);

  if (!expandedTerminalId) return null;

  return (
    <div className="terminal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <button className="overlay-close" onClick={collapseTerminal}>Close</button>
      {/* AgentPanel renders the TerminalPane in isFullScreen mode when expanded */}
    </div>
  );
}
```

**Critical: FitAddon.fit() after overlay is visible.** The overlay must be in the DOM and have real pixel dimensions before calling `fitAddon.fit()`. The ResizeObserver already attached to `containerRef` in TerminalPane will fire automatically when the container grows to full-screen size — this is the correct trigger. No manual fit() call is needed beyond what the ResizeObserver already does.

### Pattern 2: Full-Screen State in Zustand

**What:** Add `expandedTerminalId: string | null` to `WorkbenchState`. Null means no terminal is expanded.

```typescript
// store.ts additions
interface WorkbenchState {
  // ... existing fields ...
  expandedTerminalId: string | null;       // NEW
  expandTerminal: (sessionId: string) => void;   // NEW
  collapseTerminal: () => void;             // NEW
}

// In create():
expandedTerminalId: null,
expandTerminal: (sessionId) => set({ expandedTerminalId: sessionId }),
collapseTerminal: () => set({ expandedTerminalId: null }),
```

### Pattern 3: New IPC — follow the four-file contract

Every new IPC channel requires changes in exactly four files:

1. `src/shared/ipc.ts` — add to `IPC_CHANNELS` const and `WorkbenchApi` interface
2. `src/preload/index.ts` — add `ipcRenderer.invoke(...)` bridge entry
3. `src/main/index.ts` — add `ipcMain.handle(...)` registration in `wireIpc()`
4. `src/main/app-controller.ts` — implement the method

Missing any file breaks the TypeScript check (`npm run typecheck`).

### Pattern 4: Archive IPC — read from SQLite, not from flat files

**What:** The archive browser reads task history from the SQLite DB already managed by `PersistenceService`. Two new IPC calls needed:

- `archive:list-tasks` — returns `ArchiveTaskSummary[]` for the current project, filtered by agent/workflow/date/severity
- `archive:get-task-detail` — returns full `TaskRun` + `RunEvent[]` for one task ID

`PersistenceService.loadTasks(projectId)` already exists and returns `TaskRun[]`. It loads `task_json` (full object) ordered by `updated_at DESC`. This is sufficient for both list and detail.

`PersistenceService.loadRunEvents(taskId)` already exists and returns the event timeline.

`PersistenceService.appendArtifact()` stores artifacts. A `loadArtifactsForTask(taskId)` query is NOT yet present but is a simple SELECT on the `artifacts` table.

**New method needed in PersistenceService:**
```typescript
loadArtifactsForTask(taskId: string): ArtifactBundle[] {
  const rows = this.db
    .prepare('SELECT artifact_json FROM artifacts WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId) as Array<{ artifact_json: string }>;
  return rows.map(row => JSON.parse(row.artifact_json) as ArtifactBundle);
}
```

### Pattern 5: Archive Browser component structure

**What:** `ArchiveBrowser.tsx` is a standalone panel component with local filter state (not Zustand). Filter state is ephemeral UI — it dies on unmount, which is correct behaviour.

```typescript
// Local state only — no Zustand
const [agentFilter, setAgentFilter] = useState<AgentId | 'all'>('all');
const [workflowFilter, setWorkflowFilter] = useState<WorkflowId | 'all'>('all');
const [dateFilter, setDateFilter] = useState<string>('');  // ISO date string or ''
const [severityFilter, setSeverityFilter] = useState<Finding['severity'] | 'all'>('all');
const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
```

Filtering is done client-side after fetching the full task list for the project. The task list is fetched once via IPC on mount and when the project changes.

### Anti-Patterns to Avoid

- **Re-mounting xterm on expand:** Do NOT unmount and re-create the TerminalPane when entering full-screen. `terminal.open()` can only be called once per Terminal instance. Re-creation causes a PTY session disconnect.
- **Adding archive filter state to Zustand:** Archive filters are ephemeral UI state. They belong in local `useState` in `ArchiveBrowser.tsx`, not in the global store.
- **Reading flat files directly from renderer:** The renderer cannot access the filesystem directly. All file reads must go through IPC to the main process.
- **Using `isBusy` for archive IPC:** The global `isBusy` flag in the store is for workflow operations. Archive reads are cheap and should not block the UI. Use local loading state in `ArchiveBrowser.tsx` instead.
- **Calling FitAddon.fit() before container has dimensions:** If called while the overlay is hidden (display:none) or not yet in the DOM, FitAddon computes zero dimensions. The ResizeObserver already handles this correctly — don't add a manual `fit()` call on expand.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal resize on overlay open | Custom resize event / setTimeout | Existing ResizeObserver in TerminalPane | ResizeObserver already fires when container changes size; it calls fitAddon.fit() and resizeTerminal() IPC correctly |
| Terminal DOM mounting in overlay | Reparent DOM node with appendChild | CSS class toggle on the container div | DOM reparenting disconnects React's vdom tracking and breaks event handlers |
| Archive data query | Custom file reader for .triad-workbench/ JSONs | PersistenceService.loadTasks() + loadRunEvents() | SQLite already has the data in structured form |
| Full-screen keyboard shortcut | Global keydown listener in multiple components | Single listener in TerminalOverlay, scoped to when expandedTerminalId is non-null | Avoids duplicate listener registration |
| Filter logic | Complex filter pipeline | Simple array.filter() chains on the loaded TaskRun[] array | Task counts will be small (tens to hundreds); no need for SQLite-side filtering |

**Key insight:** Every expensive problem in this phase is already solved — xterm resize, SQLite queries, IPC plumbing. The work is wiring them together correctly.

---

## Common Pitfalls

### Pitfall 1: xterm terminal blank after expanding to full-screen
**What goes wrong:** The terminal canvas appears blank or shows wrong dimensions after the overlay opens.
**Why it happens:** `fitAddon.fit()` was called before the overlay container had real pixel dimensions. This happens if the overlay uses `visibility:hidden` instead of `display:none` + `null` render, or if `fit()` is manually called too early.
**How to avoid:** Rely on the ResizeObserver already attached in TerminalPane. When the container div grows to fill the overlay, ResizeObserver fires, which calls `fitAddon.fit()` and then `window.workbench.resizeTerminal()`. This is the correct path — do not add an additional manual `fit()` call.
**Warning signs:** Terminal shows 80 columns even in full-screen, or canvas is blank.

### Pitfall 2: Escape key listener fires when user types Escape in terminal
**What goes wrong:** Pressing Escape inside the full-screen terminal collapses the overlay when the user intended to send the Escape character to the terminal.
**Why it happens:** The global `keydown` listener intercepts all keystrokes, including those meant for the xterm terminal.
**How to avoid:** Attach the Escape listener only to the overlay wrapper div (`onKeyDown` on the overlay container), not to `window`. xterm absorbs keyboard events within its canvas; the overlay's own `onKeyDown` only fires for events not consumed by xterm.
**Warning signs:** Pressing Escape inside a vim session inside the terminal closes the overlay.

### Pitfall 3: Archive IPC types not threaded through all four files
**What goes wrong:** TypeScript build passes locally but `npm run typecheck` fails because `WorkbenchApi` interface is missing the new methods.
**Why it happens:** A new IPC channel was added to `IPC_CHANNELS` and `app-controller.ts` but not to the `WorkbenchApi` interface in `ipc.ts` or the preload bridge.
**How to avoid:** Follow the four-file contract strictly. `npm run typecheck` will catch this.
**Warning signs:** `Property 'listArchiveTasks' does not exist on type 'WorkbenchApi'`.

### Pitfall 4: Archive browser fetches stale data when project changes
**What goes wrong:** The archive browser shows tasks from the previous project after the user opens a new project.
**Why it happens:** The archive task list is fetched on mount and never refetched.
**How to avoid:** In `ArchiveBrowser.tsx`, key the fetch effect on `snapshot?.project?.id`. When the project ID changes, re-fetch the task list.
**Warning signs:** Archive shows tasks for project A after switching to project B.

### Pitfall 5: better-sqlite3 synchronous API used from renderer
**What goes wrong:** Attempting to import `better-sqlite3` in renderer code fails at build time.
**Why it happens:** `better-sqlite3` is a native Node.js module; it cannot run in the browser/renderer environment.
**How to avoid:** All SQLite access stays in the main process, exposed to the renderer only via IPC. This is already the project pattern — never import `better-sqlite3` in any renderer file.

### Pitfall 6: Missing `worktree_status` column in older SQLite databases
**What goes wrong:** `loadTasks()` works fine; no action needed.
**Why it happens:** `PersistenceService.migrate()` already uses `ensureColumn` to add missing columns. The `worktree_status` column was added in Phase 1. This is a known safe pattern.
**How to avoid:** Any new columns added to the schema must use `ensureColumn` (the existing pattern), not bare `ALTER TABLE`.

---

## Code Examples

Verified from direct codebase inspection:

### Current TerminalPane structure (baseline to modify)
```typescript
// Source: D:\ccgl room\src\renderer\src\components\TerminalPane.tsx
// Key facts:
// 1. Terminal + FitAddon created in useEffect keyed on sessionId
// 2. ResizeObserver on containerRef fires fitAddon.fit() + resizeTerminal() IPC
// 3. containerRef is the div that xterm mounts to — never unmount this div
// 4. terminal.open(containerRef.current) called once on mount

const observer = new ResizeObserver(() => {
  if (fitAddonRef.current && terminalRef.current) {
    fitAddonRef.current.fit();
    const { cols, rows } = terminalRef.current;
    void window.workbench.resizeTerminal(sessionId, cols, rows).catch(() => undefined);
  }
});
observer.observe(containerRef.current);
```

### Four-file IPC contract (pattern from existing channels)
```typescript
// 1. src/shared/ipc.ts — add to IPC_CHANNELS and WorkbenchApi
export const IPC_CHANNELS = {
  // ... existing ...
  listArchiveTasks: 'workbench:archive:list-tasks',
  getArchiveTaskDetail: 'workbench:archive:get-task-detail',
} as const;

export interface WorkbenchApi {
  // ... existing ...
  listArchiveTasks: (projectId: string) => Promise<TaskRun[]>;
  getArchiveTaskDetail: (taskId: string) => Promise<{ task: TaskRun; events: RunEventRecord[] }>;
}

// 2. src/preload/index.ts
listArchiveTasks: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.listArchiveTasks, projectId),
getArchiveTaskDetail: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.getArchiveTaskDetail, taskId),

// 3. src/main/index.ts — inside wireIpc()
ipcMain.handle(IPC_CHANNELS.listArchiveTasks, (_event, projectId) => nextController.listArchiveTasks(projectId));
ipcMain.handle(IPC_CHANNELS.getArchiveTaskDetail, (_event, taskId) => nextController.getArchiveTaskDetail(taskId));

// 4. src/main/app-controller.ts
listArchiveTasks(projectId: string): TaskRun[] {
  return this.persistence.loadTasks(projectId);
}
getArchiveTaskDetail(taskId: string): { task: TaskRun; events: RunEventRecord[] } {
  const tasks = this.persistence.loadTasks(this.snapshot.project?.id ?? '');
  const task = tasks.find(t => t.id === taskId);
  if (!task) throw new Error('Task not found');
  const events = this.persistence.loadRunEvents(taskId);
  return { task, events };
}
```

### Zustand expandedTerminalId (new state shape)
```typescript
// Source: store.ts (to be added)
// The store already uses this exact pattern for selectedTaskId
expandedTerminalId: null as string | null,
expandTerminal: (sessionId: string) => set({ expandedTerminalId: sessionId }),
collapseTerminal: () => set({ expandedTerminalId: null }),
```

### SQLite schema — what already exists
```sql
-- task_runs: full TaskRun as JSON, indexed by project_id
-- Columns: id, project_id, stage, workflow_id, worktree_status, task_json, updated_at
SELECT task_json FROM task_runs WHERE project_id = ? ORDER BY updated_at DESC

-- artifacts: full ArtifactBundle as JSON, indexed by task_id
-- Columns: id, task_id, step_id, agent_id, artifact_json, created_at
SELECT artifact_json FROM artifacts WHERE task_id = ? ORDER BY created_at ASC

-- run_events: event timeline per task
-- Columns: id, task_id, event_type, payload_json, recorded_at
SELECT event_type, payload_json, recorded_at FROM run_events
WHERE task_id = ? ORDER BY recorded_at ASC
```

### ArchiveBrowser filter pattern (client-side filtering)
```typescript
// Source: pattern derived from existing ArtifactViewer.tsx tab approach
// All filtering is client-side — no new SQL queries needed for filtering

const filteredTasks = tasks.filter(task => {
  if (agentFilter !== 'all' && !task.assignedAgents.includes(agentFilter)) return false;
  if (workflowFilter !== 'all' && task.workflowId !== workflowFilter) return false;
  if (dateFilter && task.createdAt.slice(0, 10) !== dateFilter) return false;
  if (severityFilter !== 'all') {
    const hasSeverity = task.findings.some(f => f.severity === severityFilter);
    if (!hasSeverity) return false;
  }
  return true;
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| xterm v4 | @xterm/xterm 5.5 (scoped package) | xterm v5.0 (2023) | Import path changed from `xterm` to `@xterm/xterm`; project already uses correct path |
| FitAddon from `xterm-addon-fit` | `@xterm/addon-fit` | xterm v5.0 | Import path changed; project already uses correct path |
| Zustand v4 (selector required) | Zustand v5 (^5.0.8) | 2024 | `create` API unchanged; selector pattern unchanged for this project |

**Deprecated/outdated:**
- `xterm` (unscoped): Replaced by `@xterm/xterm` in v5. Project already uses the correct scoped import.

---

## Open Questions

1. **Where should ArchiveBrowser appear in the UI layout?**
   - What we know: CONTEXT.md marks this as Claude's discretion; App.tsx has a left rail, center area (2x2 grid + TaskDetailPanel), and right rail.
   - What's unclear: Whether it replaces the right rail's Project Archive section, becomes a new tab/view, or opens as a panel overlay.
   - Recommendation: Place it as a dedicated section in the right rail with a "Browse history" toggle button. This avoids restructuring the existing 3-column layout (left/center/right) and matches the visual weight of the existing "Project Archive" card.

2. **Should `listArchiveTasks` return the full `TaskRun[]` or a lighter summary type?**
   - What we know: `loadTasks()` returns full `TaskRun` objects including all artifacts and steps. For a task list with 50+ entries, this could be several MB of JSON transferred over IPC.
   - What's unclear: Whether IPC serialization overhead is significant for this use case.
   - Recommendation: Use full `TaskRun[]` for now (simplest path, consistent with existing store pattern). If performance is slow, a `ArchiveTaskSummary` type with only `id`, `brief`, `workflowId`, `stage`, `createdAt`, `assignedAgents`, `findings` (summary fields only) can be introduced as a follow-up.

3. **Transcript viewer: SQLite data or flat-file JSONL?**
   - What we know: `project-archive.ts` writes transcript JSONL to `.triad-workbench/<project>/terminals/<session-id>/transcript.jsonl`. SQLite does NOT store terminal transcript data. The `task_runs` table stores task output (stdout/stderr per artifact) but not the raw PTY stream.
   - What's unclear: Whether the "transcript reader" requirement refers to the agent's structured output (available in SQLite via `artifact.stdout`) or the raw PTY stream (only in flat JSONL).
   - Recommendation: For the archive browser's transcript viewer, use `artifact.stdout` and `artifact.stderr` from the SQLite artifacts table (already surfaced in `ArtifactViewer.tsx`). The raw PTY JSONL transcript from the flat file is supplementary and requires a new flat-file IPC read path. Defer raw transcript reading to a follow-up unless the user explicitly needs it in Phase 4.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `D:\ccgl room\src\renderer\src\components\TerminalPane.tsx` — xterm mounting, FitAddon, ResizeObserver pattern
- Direct inspection of `D:\ccgl room\src\main\services\persistence.ts` — SQLite schema, all 5 tables, existing query methods
- Direct inspection of `D:\ccgl room\src\main\services\project-archive.ts` — flat-file archive structure, what IS and IS NOT in SQLite
- Direct inspection of `D:\ccgl room\src\shared\ipc.ts` — all existing IPC channels, WorkbenchApi interface
- Direct inspection of `D:\ccgl room\src\preload\index.ts` — contextBridge pattern
- Direct inspection of `D:\ccgl room\src\main\index.ts` — wireIpc pattern for new channel registration
- Direct inspection of `D:\ccgl room\src\renderer\src\store.ts` — Zustand state shape, runAction pattern
- Direct inspection of `D:\ccgl room\package.json` — exact library versions

### Secondary (MEDIUM confidence)
- xterm.js docs (knowledge from training, verified against installed version 5.5.0): `terminal.open()` is one-time per instance; FitAddon requires mounted visible container
- Zustand v5 docs (knowledge from training, verified against installed version 5.0.8): `create` + `set` API unchanged

### Tertiary (LOW confidence — not verified against live docs)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions read directly from package.json
- Architecture: HIGH — patterns derived from existing code, not from general knowledge
- Pitfalls: HIGH — xterm one-time-mount and IPC four-file contract verified from source
- Open questions: MEDIUM — architectural recommendations, not factual claims

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack; no fast-moving dependencies)
