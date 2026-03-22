# Current State

## Active Milestone
Milestone 1: v0.1 — Foundation to Review Center

## Phase Status
- Phase 1 (Foundation): **DONE**
- Phase 2 (Review Center): **DONE**
- Phase 3 (Onboarding Hardening): **DONE**
- Phase 4 (Archive Browser): **IN PROGRESS** (2/3 plans complete)
- Phase 5 (Custom Workflow Builder): PENDING
- Phase 6 (Final UX Polish): PENDING

## Current Focus
Phase 4 plans 01 and 02 complete. Next: 04-03-PLAN.md — ArchiveBrowser component.

## Last Validation
- `npm run typecheck`: PASS (no errors in modified files; pre-existing errors in preload/dev-mock/test-setup for archive IPC stubs unrelated to 04-01)
- `npm test`: 163 passed, 5 pre-existing failures in AppController.selectProject (BrowserWindow mock, unrelated to plan)
- `npm run build`: not run this session

## Decisions
- (04-01) Chrome-only overlay pattern: TerminalOverlay is pure chrome (z-index:9999), actual terminal uses terminal-fs CSS class (z-index:9998) — avoids creating second xterm instance
- (04-01) CSS class switching (terminal-fs vs terminal-canvas) preserves xterm Terminal instance across expand/collapse — no DOM mount/unmount
- (04-02) ArchiveTaskDetail defined in shared/ipc.ts as an exported interface alongside WorkbenchApi
- (04-02) dev-mock.ts and test-setup.ts updated with stubs to satisfy all WorkbenchApi members at compile time

## Stopped At
Last session: Completed 04-01-PLAN.md (Full-screen terminal overlay — expandedTerminalId state, TerminalOverlay chrome, expand button in AgentPanel)
