---
phase: 05-custom-workflow-builder
plan: "01"
subsystem: shared-types-ipc-persistence
tags: [types, ipc, persistence, sqlite, custom-workflows]
dependency_graph:
  requires: []
  provides:
    - CustomWorkflowStep type
    - CustomWorkflow type
    - WorkflowId 'custom' member
    - listCustomWorkflows IPC channel
    - saveCustomWorkflow IPC channel
    - deleteCustomWorkflow IPC channel
    - custom_workflows SQLite table
    - PersistenceService.loadCustomWorkflows()
    - PersistenceService.saveCustomWorkflow()
    - PersistenceService.deleteCustomWorkflow()
  affects:
    - src/shared/types.ts
    - src/shared/ipc.ts
    - src/preload/index.ts
    - src/main/index.ts
    - src/main/services/persistence.ts
    - src/renderer/src/dev-mock.ts
    - src/renderer/src/test-setup.ts
tech_stack:
  added: []
  patterns:
    - IPC 4-file contract (types -> ipc.ts -> preload -> main/index)
    - SQLite upsert via INSERT ON CONFLICT DO UPDATE
    - CustomWorkflow extends WorkflowDefinition via Omit<id> to allow UUID string id
key_files:
  created: []
  modified:
    - src/shared/types.ts
    - src/shared/ipc.ts
    - src/preload/index.ts
    - src/main/index.ts
    - src/main/services/persistence.ts
    - src/renderer/src/dev-mock.ts
    - src/renderer/src/test-setup.ts
decisions:
  - "CustomWorkflow.id typed as string (UUID) not WorkflowId — uses Omit<WorkflowDefinition, 'id'> pattern to override the id field while inheriting all other WorkflowDefinition fields"
  - "custom_workflows table stages stored as empty array in memory (stages field required by WorkflowDefinition, but custom workflows use steps at runtime — no redundant storage in SQLite)"
  - "main/index.ts AppController IPC handlers for custom workflows added but yield expected TS2339 errors until Plan 02 implements the three AppController methods"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-22"
  tasks_completed: 3
  files_modified: 7
---

# Phase 05 Plan 01: Custom Workflow Types, IPC Plumbing, and Persistence Summary

One-liner: Shared-type contracts (CustomWorkflowStep/CustomWorkflow interfaces, widened WorkflowId), 3-channel IPC wired across all 4 required files, and custom_workflows SQLite table with full CRUD in PersistenceService.

## What Was Built

This plan establishes the Wave 1 foundation that all downstream plans in Phase 05 depend on:

1. **Custom workflow TypeScript types** in `src/shared/types.ts`:
   - `WorkflowId` union widened with `'custom'` as fifth member
   - `CustomWorkflowStep` interface: id, agentId, role, promptTemplate, requiresApproval
   - `CustomWorkflow` interface: extends `Omit<WorkflowDefinition, 'id'>` with UUID string id, steps array, isCustom literal, createdAt/updatedAt
   - `StartWorkflowInput` extended with `customWorkflowSteps?` and `customWorkflowId?`
   - `TaskRun` extended with `customWorkflowId?` and `customStepIndex?`
   - `WorkbenchSnapshot` extended with `customWorkflows?`

2. **IPC 4-file contract** across ipc.ts, preload, main/index, and renderer stubs:
   - Three new channels: `listCustomWorkflows`, `saveCustomWorkflow`, `deleteCustomWorkflow`
   - `WorkbenchApi` method signatures added
   - `IPC_CHANNELS` constants: `workbench:workflows:list-custom`, `workbench:workflows:save-custom`, `workbench:workflows:delete-custom`
   - `preload/index.ts` wires `ipcRenderer.invoke` calls
   - `main/index.ts` registers `ipcMain.handle` calls (AppController methods pending Plan 02)
   - `dev-mock.ts` and `test-setup.ts` satisfy updated `WorkbenchApi` interface

3. **PersistenceService CRUD** in `src/main/services/persistence.ts`:
   - `custom_workflows` SQLite table created via `CREATE TABLE IF NOT EXISTS` in `migrate()`
   - `loadCustomWorkflows()`: queries ordered by created_at ASC, parses steps_json
   - `saveCustomWorkflow()`: upserts via INSERT ON CONFLICT DO UPDATE, returns with updated updatedAt
   - `deleteCustomWorkflow()`: deletes row by primary key

## Verification Results

- `npm run typecheck`: 3 expected errors only — `Property 'listCustomWorkflows/saveCustomWorkflow/deleteCustomWorkflow' does not exist on type 'AppController'` in main/index.ts (resolves in Plan 02, per plan spec)
- `npm test -- --run`: 181 passed, 5 pre-existing failures (AppController.selectProject BrowserWindow mock) — baseline unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend shared types | b502e12 | src/shared/types.ts |
| 2 | IPC 4-file contract | 1d4b8b1 | src/shared/ipc.ts, src/preload/index.ts, src/main/index.ts, src/renderer/src/dev-mock.ts, src/renderer/src/test-setup.ts |
| 3 | PersistenceService CRUD | 8bf095f | src/main/services/persistence.ts |

## Self-Check: PASSED
