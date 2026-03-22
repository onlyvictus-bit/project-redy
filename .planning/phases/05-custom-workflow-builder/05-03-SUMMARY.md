---
phase: 05-custom-workflow-builder
plan: 03
subsystem: ui
tags: [react, zustand, typescript, custom-workflows, modal]

# Dependency graph
requires:
  - phase: 05-custom-workflow-builder/05-01
    provides: CustomWorkflow types, IPC channels, DB persistence layer
  - phase: 05-custom-workflow-builder/05-02
    provides: WorkflowEngine custom execution path, AppController CRUD methods and snapshot hydration

provides:
  - WorkflowBuilder.tsx modal component for creating and editing custom workflows
  - store.ts customWorkflows field with listCustomWorkflows, saveCustomWorkflow, deleteCustomWorkflow actions
  - App.tsx merged workflow list (built-ins + custom), '+' button, edit/delete on custom entries
  - canRun handles 'custom' workflowId and UUID-keyed custom workflows (project.isGitRepo required)
  - Run workflow passes customWorkflowSteps + customWorkflowId enabling approval gate resume path

affects: [06-final-ux-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - WorkflowBuilder uses plain controlled React state — no form library
    - allWorkflows merged array pattern: [...WORKFLOW_DEFINITIONS, ...customWorkflows]
    - canRun switch extended with 'custom' case + UUID fallback in default branch
    - saveCustomWorkflow re-lists after save to sync store (same as deleteCustomWorkflow)

key-files:
  created:
    - src/renderer/src/components/WorkflowBuilder.tsx
  modified:
    - src/renderer/src/store.ts
    - src/renderer/src/App.tsx
    - src/renderer/src/styles.css

key-decisions:
  - "allWorkflows merged array built in App.tsx as Array<WorkflowDefinition | CustomWorkflow> — no new state layer"
  - "canRun default branch also handles UUID-keyed custom workflows (fallback for when workflowId is a UUID, not 'custom')"
  - "workflowId state typed as string (was implicit literal union) to accommodate UUID-based custom workflow IDs"
  - "CSS variables use light-theme fallbacks (--bg-card: #fff, --border: #d0d8e8) to match existing styles.css color scheme"

patterns-established:
  - "Workflow selector: isCustom discriminant check via 'isCustom' in workflow to distinguish CustomWorkflow from WorkflowDefinition"
  - "Run workflow: isCustom detected at call site; passes workflowId='custom' + customWorkflowSteps + customWorkflowId for IPC"

requirements-completed: [CUSTOM-WF-01, CUSTOM-WF-02, CUSTOM-WF-03, CUSTOM-WF-04, CUSTOM-WF-05]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 5 Plan 03: Custom Workflow Builder — Renderer UI Summary

**WorkflowBuilder modal + Zustand store actions + App.tsx wiring delivering full create/edit/delete/run UI for custom workflows**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-22T10:36:18Z
- **Completed:** 2026-03-22T10:42:27Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Zustand store extended with customWorkflows state (initialized as []), three IPC-backed actions, and bootstrap/applySnapshot hydration from snapshot
- WorkflowBuilder.tsx modal created with controlled form: workflow name, description, mode selector, step list with add/reorder/delete, per-step agent/role/prompt/approval fields, validation, and save/cancel buttons
- App.tsx wired with merged allWorkflows list, '+' button next to Workflows heading, edit/delete buttons on custom entries only, canRun 'custom' case, and Run workflow passing both customWorkflowSteps and customWorkflowId for approval gate resume

## Task Commits

Each task was committed atomically:

1. **Task 1: Zustand store — customWorkflows state + 3 actions + bootstrap hydration** - `38e8904` (feat)
2. **Task 2: WorkflowBuilder.tsx — modal component for creating and editing custom workflows** - `0e0ca97` (feat)
3. **Task 3: App.tsx — merge workflow list, '+' button, edit/delete, canRun 'custom', run with steps + customWorkflowId** - `fb38028` (feat)

## Files Created/Modified
- `src/renderer/src/components/WorkflowBuilder.tsx` - New modal component for creating/editing custom workflows (controlled form, no form library)
- `src/renderer/src/store.ts` - Added CustomWorkflow import, customWorkflows field, 3 IPC actions, bootstrap/applySnapshot hydration
- `src/renderer/src/App.tsx` - Added WorkflowBuilder import, merged workflow list, '+' button, edit/delete on custom entries, canRun 'custom' + UUID fallback, Run workflow with customWorkflowSteps + customWorkflowId
- `src/renderer/src/styles.css` - Added workflow-builder-overlay/panel/header/body/footer CSS, step-card/step-card-controls/step-card-fields, workflow-section-header/workflow-add-btn/workflow-custom-actions

## Decisions Made
- `workflowId` state typed explicitly as `string` (previously implicit literal union) to accommodate UUID-based custom workflow IDs from the merged list
- `canRun` default branch also handles UUID-keyed custom workflows with `customWorkflows.some((w) => w.id === workflowId)` — prevents needing to call setWorkflowId('custom') when selecting from the list
- CSS variables use light-theme fallbacks (`#fff`, `#d0d8e8`) rather than dark theme values from the plan spec, matching the existing styles.css light-mode color scheme

## Deviations from Plan

None — plan executed exactly as written with one minor CSS color adjustment (plan spec used dark-theme CSS variable fallbacks; adjusted to match existing light-mode color scheme without changing class names or structure).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (Custom Workflow Builder) is now fully complete: backend (05-01), engine wiring (05-02), and renderer UI (05-03)
- Phase 6 (Final UX Polish) can begin immediately
- Custom workflows are fully functional end-to-end: create, edit, delete, run with approval gate resume support

---
*Phase: 05-custom-workflow-builder*
*Completed: 2026-03-22*

## Self-Check: PASSED
- WorkflowBuilder.tsx: FOUND
- store.ts: FOUND
- App.tsx: FOUND
- SUMMARY.md: FOUND
- Commit 38e8904 (Task 1): FOUND
- Commit 0e0ca97 (Task 2): FOUND
- Commit fb38028 (Task 3): FOUND
