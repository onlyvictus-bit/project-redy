---
phase: 04-archive-browser
plan: 02
subsystem: ipc
tags: [electron, ipc, sqlite, typescript, preload, contextBridge]

# Dependency graph
requires:
  - phase: 04-archive-browser
    provides: plan 01 — TerminalPane and TerminalOverlay chrome components
provides:
  - IPC contract for archive task browsing — listArchiveTasks and getArchiveTaskDetail channels fully wired
  - ArchiveTaskDetail exported type in src/shared/ipc.ts
  - loadArtifactsForTask() SQLite query method on PersistenceService
affects:
  - 04-archive-browser plan 03 — ArchiveBrowser component consumes these channels
  - any plan that reads WorkbenchApi or IPC_CHANNELS

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Four-file IPC contract (shared/ipc.ts → preload/index.ts → main/index.ts → app-controller.ts)
    - loadArtifactsForTask mirrors loadRunEvents pattern in PersistenceService

key-files:
  created: []
  modified:
    - src/shared/ipc.ts
    - src/preload/index.ts
    - src/main/index.ts
    - src/main/app-controller.ts
    - src/main/services/persistence.ts
    - src/renderer/src/dev-mock.ts
    - src/renderer/src/test-setup.ts

key-decisions:
  - "Used inline ArchiveTaskDetail import via named import from @shared/ipc in app-controller.ts rather than inline import() to keep type consistent with WorkbenchApi definition"
  - "Added stub implementations for listArchiveTasks and getArchiveTaskDetail to dev-mock.ts and test-setup.ts as a Rule 2 auto-fix — WorkbenchApi implementors must satisfy all interface members for TypeScript to compile"

patterns-established:
  - "WorkbenchApi interface in src/shared/ipc.ts is the single source of truth — all implementors (preload, dev-mock, test-setup) must be updated together"

requirements-completed: [ARCH-01, ARCH-02]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 4 Plan 02: IPC Archive Channels Summary

**Two new Electron IPC channels (listArchiveTasks, getArchiveTaskDetail) wired through all four contract layers plus loadArtifactsForTask SQLite query in PersistenceService**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T07:47:55Z
- **Completed:** 2026-03-22T07:52:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ArchiveTaskDetail interface exported from src/shared/ipc.ts with correct task/events/artifacts shape
- Both IPC channels wired through all four required layers: shared type definition, preload bridge, main-process handle registration, and AppController methods
- loadArtifactsForTask() added to PersistenceService with correct SQL (SELECT artifact_json FROM artifacts WHERE task_id = ? ORDER BY created_at ASC)
- npm run typecheck passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ArchiveTaskDetail type and IPC channels to shared/ipc.ts** - `8650cee` (feat)
2. **Task 2: Wire both channels through persistence, preload, main, and controller** - `8b9f743` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/shared/ipc.ts` - Added ArchiveTaskDetail export, ArtifactBundle + TaskRun imports, two WorkbenchApi methods, two IPC_CHANNELS entries
- `src/main/services/persistence.ts` - Added loadArtifactsForTask() method
- `src/preload/index.ts` - Added listArchiveTasks and getArchiveTaskDetail bridge entries
- `src/main/index.ts` - Added two ipcMain.handle registrations inside wireIpc()
- `src/main/app-controller.ts` - Added ArchiveTaskDetail import, TaskRun import, listArchiveTasks() and getArchiveTaskDetail() public methods
- `src/renderer/src/dev-mock.ts` - Added stub implementations for two new channels (required by WorkbenchApi)
- `src/renderer/src/test-setup.ts` - Added vi.fn() stubs for two new channels (required by WorkbenchApi)

## Decisions Made
- Used a named import `import { type ArchiveTaskDetail } from '@shared/ipc'` at the top of app-controller.ts rather than an inline import() expression — cleaner and consistent with existing import patterns in the file
- Updated dev-mock.ts and test-setup.ts alongside the core four files because TypeScript enforces all WorkbenchApi members at compile time; skipping these would leave the typecheck broken

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added listArchiveTasks/getArchiveTaskDetail stubs to dev-mock.ts and test-setup.ts**
- **Found during:** Task 2 verification (typecheck run)
- **Issue:** WorkbenchApi interface is implemented in dev-mock.ts and test-setup.ts as well as preload/index.ts. Adding two new methods to WorkbenchApi caused TS2739 errors in those two files. The plan only listed the four core files but did not explicitly mention these implementors.
- **Fix:** Added `listArchiveTasks: async () => []` and `getArchiveTaskDetail: async () => { throw new Error(...) }` to dev-mock.ts; equivalent vi.fn() stubs to test-setup.ts
- **Files modified:** src/renderer/src/dev-mock.ts, src/renderer/src/test-setup.ts
- **Verification:** npm run typecheck passes with zero errors after fix
- **Committed in:** 8b9f743 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical: TypeScript interface completeness)
**Impact on plan:** Required for TypeScript compilation. No scope creep.

## Issues Encountered
- Pre-existing test failures in `AppController.selectProject` tests (5 tests, `BrowserWindow` not exported from electron mock) were already present before this plan's changes. Verified by git stash + npm test baseline check showing 17 pre-existing failures. After my changes: 5 failures — a net improvement of 12 tests that were previously broken due to the WorkbenchApi interface mismatch being fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The IPC data contract is complete: renderer can call `window.workbench.listArchiveTasks(projectId)` and `window.workbench.getArchiveTaskDetail(taskId)`
- Plan 03 (ArchiveBrowser UI component) can now be implemented against these channels
- No blockers

---
*Phase: 04-archive-browser*
*Completed: 2026-03-22*
