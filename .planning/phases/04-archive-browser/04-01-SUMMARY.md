---
phase: 04-archive-browser
plan: 01
subsystem: ui
tags: [react, zustand, xterm, full-screen, overlay, terminal]

# Dependency graph
requires:
  - phase: 03-onboarding-hardening
    provides: AgentPanel with TerminalPane and working xterm terminal sessions
provides:
  - Full-screen terminal overlay via expandedTerminalId Zustand state
  - TerminalOverlay chrome component (header + close button, no TerminalPane inside)
  - isFullScreen prop on TerminalPane that switches CSS class to terminal-fs (position:fixed)
  - Expand button on AgentPanel wired to expandTerminal action
  - terminal-fs CSS class for full-screen terminal positioning
affects: [05-custom-workflow-builder, 06-final-ux-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Overlay-chrome separation: TerminalOverlay is pure chrome (z-index:9999), actual terminal stays in AgentPanel with isFullScreen CSS class (z-index:9998)
    - Single TerminalPane per session: xterm Terminal instance never disposed or recreated on expand/collapse
    - Zustand expand state: expandedTerminalId string | null with expandTerminal/collapseTerminal actions

key-files:
  created:
    - src/renderer/src/components/TerminalOverlay.tsx
  modified:
    - src/renderer/src/store.ts
    - src/renderer/src/components/TerminalPane.tsx
    - src/renderer/src/components/AgentPanel.tsx
    - src/renderer/src/App.tsx
    - src/renderer/src/styles.css

key-decisions:
  - "Chrome-only overlay pattern: TerminalOverlay renders header+close button at z-index:9999, actual terminal uses terminal-fs CSS class at z-index:9998 to avoid re-creating xterm instance"
  - "CSS class switching (terminal-fs vs terminal-canvas) instead of DOM mount/unmount preserves xterm Terminal instance and avoids blank canvas on expand/collapse"
  - "ResizeObserver in TerminalPane fires fitAddon.fit() automatically when container grows to full-screen — no manual fit() call needed"

patterns-established:
  - "Overlay chrome separation: overlay component contains NO TerminalPane — one TerminalPane per session at all times"
  - "Expand state in Zustand: expandedTerminalId: string | null with expandTerminal/collapseTerminal actions"

requirements-completed: [TERM-01, TERM-02, TERM-03]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 4 Plan 01: Full-Screen Terminal Overlay Summary

**Full-screen terminal overlay using CSS class switching (terminal-fs/terminal-canvas) and chrome-only TerminalOverlay component, preserving xterm instance across expand/collapse**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T07:48:09Z
- **Completed:** 2026-03-22T07:56:09Z
- **Tasks:** 3
- **Files modified:** 5 (+ 1 created)

## Accomplishments
- expandedTerminalId Zustand state with expandTerminal/collapseTerminal actions added to WorkbenchState
- TerminalOverlay.tsx chrome component renders header (agentId + session title) and close button when expandedTerminalId is non-null, returns null otherwise
- TerminalPane accepts isFullScreen prop and switches between terminal-canvas and terminal-fs CSS classes without unmounting the xterm instance
- Expand button added to AgentPanel (visible when session is non-null) wired to expandTerminal action
- TerminalOverlay mounted at App root level after footer, covering all content

## Task Commits

Each task was committed atomically:

1. **Task 1: Add expandedTerminalId state to Zustand store** - `ce6db62` (feat)
2. **Task 2: Add isFullScreen prop to TerminalPane and create TerminalOverlay chrome** - `85ac45c` (feat)
3. **Task 3: Wire expand button in AgentPanel and mount TerminalOverlay in App** - `d5af802` (feat)

## Files Created/Modified
- `src/renderer/src/store.ts` - Added expandedTerminalId: string | null, expandTerminal, collapseTerminal to WorkbenchState
- `src/renderer/src/components/TerminalPane.tsx` - Added isFullScreen?: boolean prop, conditional CSS class on wrapper div
- `src/renderer/src/components/TerminalOverlay.tsx` - New chrome-only overlay component (header + close button, no TerminalPane)
- `src/renderer/src/components/AgentPanel.tsx` - Added expandTerminal/expandedTerminalId selectors, expand button, isFullScreen prop on TerminalPane
- `src/renderer/src/App.tsx` - Imported TerminalOverlay, mounted after footer inside shell div
- `src/renderer/src/styles.css` - Added terminal-fs CSS class (position:fixed; inset:0; z-index:9998; display:flex; flex-direction:column)

## Decisions Made
- Chrome-only overlay pattern chosen: TerminalOverlay renders at z-index:9999 with transparent background and pointer-events:none on the container (only header has pointer-events:auto). The actual terminal moves to z-index:9998 via terminal-fs class. This avoids creating a second xterm Terminal instance.
- CSS class switching (not React conditional mounting) used for isFullScreen to guarantee the xterm Terminal instance is never disposed/recreated.
- Expand button placed above the TerminalPane in AgentPanel for visibility when session is active.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The linter briefly reverted AgentPanel.tsx to an intermediate state during editing (working tree vs HEAD mismatch). Resolved by re-reading the file and applying changes to the correct version.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full-screen terminal overlay complete and ready for use
- The isFullScreen/expandedTerminalId pattern is in place for any future expansion of overlay behaviour
- Pre-existing typecheck failures in preload/index.ts and dev-mock.ts (missing listArchiveTasks, getArchiveTaskDetail) are from Phase 4 archive browser work not yet implemented — these will be resolved by the remaining Phase 4 plans

---
*Phase: 04-archive-browser*
*Completed: 2026-03-22*
