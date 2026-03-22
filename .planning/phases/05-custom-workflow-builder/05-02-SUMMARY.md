---
phase: 05-custom-workflow-builder
plan: 02
subsystem: workflow-engine
tags: [workflow, custom-workflow, electron, typescript, vitest]

# Dependency graph
requires:
  - phase: 05-custom-workflow-builder plan 01
    provides: CustomWorkflow/CustomWorkflowStep types, PersistenceService CRUD, IPC channels, TaskRun.customWorkflowId/customStepIndex fields
provides:
  - WorkflowEngine case 'custom' in start() switch calling runCustomWorkflow()
  - WorkflowEngine case 'custom' in continue() resume switch resuming from customStepIndex+1
  - WorkflowEngine resolveAgents() 'custom' branch deriving deduplicated AgentId[] from steps
  - WorkflowEngine private runCustomWorkflow() iterating steps with {{brief}} interpolation, approval gates, and step halting
  - AppController.listCustomWorkflows(), saveCustomWorkflow(), deleteCustomWorkflow() CRUD methods
  - AppController snapshot.customWorkflows initialized at startup and refreshed after CRUD
  - AppController.startWorkflow() sets task.customWorkflowId and persists it via upsertTask()
  - AppController.continueTask() injects _customWorkflowSteps for engine resume path
affects: [phase 05-custom-workflow-builder plan 03, renderer custom workflow UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runtime injection pattern: AppController injects _customWorkflowSteps onto task object before engine.continue() to avoid DB lookup inside engine"
    - "Deduplication pattern: resolveAgents('custom') uses Set<AgentId> to emit unique agent IDs from step list order"
    - "Stage sentinel: custom workflow steps use 'code' as ResumableStage for all TaskStepRecord entries"

key-files:
  created: []
  modified:
    - src/main/services/workflow-engine.ts
    - src/main/app-controller.ts
    - src/main/app-controller.test.ts

key-decisions:
  - "runCustomWorkflow uses 'code' as the ResumableStage sentinel for all custom steps — richer per-role mapping deferred to future phase"
  - "_customWorkflowSteps is a runtime-only field injected by AppController.continueTask() via type cast — avoids adding persistence fields or engine constructor coupling"
  - "snapshot.customWorkflows is refreshed by reloading from persistence after each CRUD operation (simple, correct, avoids dual state)"
  - "test mock for PersistenceService extended with loadCustomWorkflows/saveCustomWorkflow/deleteCustomWorkflow stubs to prevent all 42 tests failing"

patterns-established:
  - "Approval gate halt: sets task.stage='findings', task.approvalState='pending', task.customStepIndex=i, calls updateTask(), returns — resume picks up at index+1"
  - "Custom workflow CRUD methods always reload snapshot.customWorkflows from persistence then call emitState() — ensures renderer always sees fresh list"

requirements-completed: [CUSTOM-WF-04, CUSTOM-WF-05]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 5 Plan 02: WorkflowEngine + AppController Custom Workflow Wiring Summary

**WorkflowEngine extended with runCustomWorkflow() execution, approval gate halting, and resume logic; AppController wired with CRUD methods, snapshot initialization, and customWorkflowId persistence**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T10:24:40Z
- **Completed:** 2026-03-22T10:31:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- WorkflowEngine handles workflowId='custom' end-to-end: start, resolveAgents, continue (resume), and runCustomWorkflow private method
- AppController exposes listCustomWorkflows/saveCustomWorkflow/deleteCustomWorkflow and keeps snapshot.customWorkflows fresh at startup and after mutations
- startWorkflow() persists task.customWorkflowId enabling continueTask() to look up the workflow's steps for approval-gate resume
- npm run typecheck: 0 errors; test suite: 181 passed (5 pre-existing unrelated failures unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkflowEngine — add custom execution path** - `3dbe4c9` (feat)
2. **Task 2: AppController — CRUD methods + snapshot + wiring** - `2546996` (feat)

**Plan metadata:** to be committed with docs commit

## Files Created/Modified

- `src/main/services/workflow-engine.ts` - Added CustomWorkflowStep import, resolveAgents() 'custom' branch, start() case 'custom', continue() resume case 'custom', private runCustomWorkflow() method
- `src/main/app-controller.ts` - Added CustomWorkflow import, snapshot.customWorkflows init, listCustomWorkflows/saveCustomWorkflow/deleteCustomWorkflow methods, startWorkflow() customWorkflowId wiring, continueTask() _customWorkflowSteps injection
- `src/main/app-controller.test.ts` - Added loadCustomWorkflows/saveCustomWorkflow/deleteCustomWorkflow stubs to PersistenceService mock

## Decisions Made

- `runCustomWorkflow` uses `'code'` as the `ResumableStage` sentinel for all custom steps. A richer mapping (e.g., `'review'` for reviewer-role steps) is deferred to a future phase as the plan specified.
- `_customWorkflowSteps` uses a runtime type-cast injection pattern rather than adding a new DB column or engine constructor parameter — keeps the engine free of persistence dependencies.
- `snapshot.customWorkflows` is reloaded from persistence after each CRUD mutation (not mutated in-memory) to guarantee consistency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added PersistenceService mock stubs in app-controller.test.ts**
- **Found during:** Task 2 (AppController CRUD methods)
- **Issue:** The constructor now calls `this.persistence.loadCustomWorkflows()`. The Vitest mock for PersistenceService had no stub for this method, causing all 42 AppController tests to throw `TypeError: this.persistence.loadCustomWorkflows is not a function`.
- **Fix:** Added `loadCustomWorkflows: vi.fn().mockReturnValue([])`, `saveCustomWorkflow: vi.fn().mockImplementation((wf) => wf)`, and `deleteCustomWorkflow: vi.fn()` to the mock persistence object.
- **Files modified:** `src/main/app-controller.test.ts`
- **Verification:** Test suite returned to 181 passed, 5 pre-existing BrowserWindow failures.
- **Committed in:** `2546996` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing test stub for new persistence method)
**Impact on plan:** Essential to prevent full test suite regression. No scope creep.

## Issues Encountered

None — both files compiled cleanly on the first typecheck pass after implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WorkflowEngine and AppController are fully wired for custom workflows
- IPC channels from Plan 01 now have live implementations to call
- Plan 03 (renderer UI) can now call startWorkflow with workflowId='custom' and customWorkflowSteps, and CRUD operations via the three new IPC handlers

---
*Phase: 05-custom-workflow-builder*
*Completed: 2026-03-22*

## Self-Check: PASSED

- FOUND: src/main/services/workflow-engine.ts
- FOUND: src/main/app-controller.ts
- FOUND: .planning/phases/05-custom-workflow-builder/05-02-SUMMARY.md
- FOUND commit: 3dbe4c9 (Task 1 - WorkflowEngine)
- FOUND commit: 2546996 (Task 2 - AppController)
