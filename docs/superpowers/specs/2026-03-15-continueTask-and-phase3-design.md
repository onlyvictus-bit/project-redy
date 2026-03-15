# Design: continueTask Backend + Phase 3 Onboarding Hardening

**Date:** 2026-03-15
**Status:** Approved (pending spec review)
**Scope:** Two independent features that share a milestone but touch different files.

---

## Feature A: continueTask — Task Continuation Backend

### Problem

Phase 2 HandoffActions buttons are disabled because they called `startWorkflow()`, which always creates a new task + worktree. The user expects "Send to Claude for fix" to continue the *selected* task in its *existing* worktree, not spawn a fresh workflow.

### Design Decision

- Keep `startWorkflow(input)` for new tasks only.
- Add `continueTask(taskId, options)` for existing tasks.
- `options` is a discriminated union with two modes:
  - `mode: 'resume'` — pick up a built-in workflow from a given stage
  - `mode: 'single-step'` — run exactly one agent step against the existing worktree

### Type Changes

#### `src/shared/types.ts`

Add new type:

```typescript
export type ContinueTaskOptions =
  | {
      mode: 'resume';
      fromStage: TaskStage;
    }
  | {
      mode: 'single-step';
      stage: TaskStage;
      agentId: AgentId;
      role: 'coder' | 'reviewer' | 'tester' | 'architect' | 'planner' | 'monitor';
      prompt?: string;
    };
```

No changes to `StartWorkflowInput`.

#### `src/shared/ipc.ts`

Add to `WorkbenchApi`:

```typescript
continueTask: (taskId: string, options: ContinueTaskOptions) => Promise<WorkbenchSnapshot>;
```

Add to `IPC_CHANNELS`:

```typescript
continueTask: 'workbench:workflow:continue'
```

### Workflow Engine Changes

#### `src/main/services/workflow-engine.ts`

Add public method:

```typescript
async continue(
  project: ProjectRef,
  task: TaskRun,
  options: ContinueTaskOptions,
  updateTask: (task: TaskRun) => void,
  appendArtifact: (artifact: ArtifactBundle) => void
): Promise<TaskRun>
```

**Resume mode behavior:**
1. Look up the workflow by `task.workflowId`
2. Build a `WorkflowContext` using the existing task (no `createTaskWorkspace`)
3. Call the appropriate workflow runner (e.g., `runCodeReviewFixVerify`)
4. Each workflow runner gets a `fromStage` parameter; it skips steps whose stage is before `fromStage` in the stage sequence
5. After all remaining steps complete, set `task.stage = 'promote'` (same as `start()`)

Stage ordering for skip logic: `['code', 'review', 'findings', 'fix', 'verify']`

**Single-step mode behavior:**
1. Build a `WorkflowContext` using the existing task
2. Build the prompt:
   - If `options.prompt` is provided, use it directly
   - Otherwise, use the appropriate built-in prompt builder based on `options.stage`:
     - `fix` stage → `buildFixPrompt(task, task.findings)`
     - `review` / `verify` stage → `buildReviewPrompt(task, diff, options.agentId)`
     - `code` stage → `buildCodingPrompt(task)`
3. Call `this.runStep(context, options.stage, options.agentId, prompt, options.role, enforceReadOnly)` once
4. Return immediately after that step (do not advance to further stages)
5. Set `task.stage` to the completed stage (not `promote`) — the user decides what to do next

**Read-only enforcement:** `enforceReadOnly` is true when `options.role` is `'reviewer'`, `'tester'`, or `'monitor'`.

### AppController Changes

#### `src/main/app-controller.ts`

Add method:

```typescript
async continueTask(taskId: string, options: ContinueTaskOptions): Promise<WorkbenchSnapshot> {
  const task = this.snapshot.tasks.find(t => t.id === taskId);
  if (!task) throw new Error('Task not found.');
  if (!this.snapshot.project) throw new Error('No project selected.');

  // Validate worktree still exists
  if (!fs.existsSync(task.worktreePath)) {
    throw new Error('Task worktree no longer exists. Cannot continue.');
  }

  const updatedTask = await this.workflowEngine.continue(
    this.snapshot.project,
    task,
    options,
    (nextTask) => this.upsertTask(nextTask),
    (artifact) => this.persistence.appendArtifact(artifact)
  );

  this.upsertTask(updatedTask);
  this.projectArchive.appendEvent(this.snapshot.project, 'task-continued', {
    taskId: updatedTask.id,
    mode: options.mode,
    stage: updatedTask.stage
  });
  this.emitState();
  return this.snapshot;
}
```

### Preload Changes

#### `src/preload/index.ts`

Add `continueTask` to the exposed API, mirroring the existing `startWorkflow` pattern.

### Renderer Changes

#### `src/renderer/src/store.ts`

Add `continueTask` action wrapping the IPC call, same pattern as `startWorkflow`.

#### `src/renderer/src/components/HandoffActions.tsx`

Re-enable buttons. Each button calls `continueTask` with the appropriate single-step options:

| Button | agentId | stage | role |
|--------|---------|-------|------|
| Send to Claude for fix | `claude` | `fix` | `coder` |
| Ask Codex to verify | `codex` | `verify` | `tester` |
| Ask Gemini for review | `gemini` | `review` | `architect` |

"Send to Claude for fix" includes a prompt override built from `formatFindingsBrief(task.id, findings)`.

"Ask Codex to verify" and "Ask Gemini for review" use no prompt override — the engine builds the prompt from the current diff and built-in prompt templates.

### Files Changed (Feature A)

| File | Change Type |
|------|------------|
| `src/shared/types.ts` | Add `ContinueTaskOptions` type |
| `src/shared/ipc.ts` | Add `continueTask` to API + channels |
| `src/main/services/workflow-engine.ts` | Add `continue()` method |
| `src/main/app-controller.ts` | Add `continueTask()` method |
| `src/main/index.ts` | Add IPC handler for `continueTask` |
| `src/preload/index.ts` | Expose `continueTask` via contextBridge |
| `src/renderer/src/store.ts` | Add `continueTask` action |
| `src/renderer/src/components/HandoffActions.tsx` | Re-enable buttons, call `continueTask` |

### Edge Cases

1. **Task worktree deleted:** `continueTask` checks `fs.existsSync(task.worktreePath)` and throws if missing.
2. **Task already in `done` or `error` state:** Allowed — user may want to retry or extend a failed/completed task.
3. **Resume from a stage the workflow doesn't have:** The skip logic silently skips all steps and sets stage to `promote`.
4. **Concurrent continuation:** Not guarded — same as `startWorkflow` today. Future work if needed.

---

## Feature B: Phase 3 — Onboarding Hardening

### Problem

First-run setup is unreliable when agents are missing, not logged in, or running under the wrong runner (Windows vs WSL). The current probes only check binary existence, not auth readiness.

### Design

Phase 3 is purely probe logic + UI messaging. No new types needed — `AgentStatus` already has the right values.

### Connector Probe Enhancements

Each connector's `probe()` method gets deeper checks:

#### Claude Connector (`claude-connector.ts`)
- Check binary exists → `missing` vs `installed`
- Run `claude auth status` (or equivalent) → `needs-login` vs `ready`
- If auth check fails with timeout → `error` with message

#### Codex Connector (`codex-connector.ts`)
- Check binary exists → `missing` vs `installed`
- Run `codex --version` to confirm working install
- Check `OPENAI_API_KEY` environment variable → `needs-login` vs `ready`

#### Gemini Connector (`gemini-connector.ts`)
- Check binary exists → `missing` vs `installed`
- Check `GOOGLE_API_KEY` or `gcloud auth` → `needs-login` vs `ready`
- Show guidance: "Set GOOGLE_API_KEY or run `gcloud auth login`"

#### Ollama Connector (`ollama-connector.ts`)
- Check HTTP endpoint reachable → `missing` vs `installed`
- Check if models are pulled (`/api/tags`) → if empty, `installed` with message "No models pulled"
- If models exist → `ready`
- Show available models in the agent panel

### Runner Detection

Add to `WorkspaceManager` or `ProcessRunner`:

```typescript
async checkWslAvailable(): Promise<boolean>
```

If project runner is set to `wsl` but WSL isn't available, show a warning in the UI.

### UI Changes

#### `AgentPanel.tsx`

Show status-specific guidance messages:

| Status | Message |
|--------|---------|
| `missing` | "Not found. Install from [link]" |
| `installed` | "Installed but not ready" |
| `needs-login` | "Run `claude login` / Set `OPENAI_API_KEY` / ..." |
| `ready` | "Ready" (green) |
| `running` | "Running" (blue pulse) |
| `error` | "Error: {message}" (red) |

#### Ollama-specific UI

- Show discovered models in a dropdown
- "No models pulled — run `ollama pull qwen2.5-coder:7b`"

### Files Changed (Feature B)

| File | Change Type |
|------|------------|
| `src/main/connectors/claude-connector.ts` | Deep auth probe |
| `src/main/connectors/codex-connector.ts` | API key check |
| `src/main/connectors/gemini-connector.ts` | Auth check + guidance |
| `src/main/connectors/ollama-connector.ts` | Model discovery |
| `src/main/services/process-runner.ts` | Optional `checkWslAvailable()` |
| `src/renderer/src/components/AgentPanel.tsx` | Status-specific messages |

### Files NOT Changed

- `src/shared/types.ts` — `AgentStatus` already covers all states
- `src/shared/ipc.ts` — no new IPC methods; existing `probeAgents` is sufficient
- `src/main/services/workflow-engine.ts` — onboarding is independent of workflows

---

## Independence

Features A and B are fully independent:

- **A (continueTask)** touches: workflow engine, app controller, IPC, store, HandoffActions
- **B (onboarding)** touches: connectors, process runner, AgentPanel

The only shared file is `src/shared/types.ts`, and they add different things (A adds `ContinueTaskOptions`, B adds nothing).

They can be implemented in parallel or in any order.

---

## Test Plan

### Feature A Tests
1. Unit test: `WorkflowEngine.continue()` in resume mode skips stages correctly
2. Unit test: `WorkflowEngine.continue()` in single-step mode runs exactly one step
3. Unit test: `continueTask` throws when task not found
4. Unit test: `continueTask` throws when worktree missing
5. Renderer test: HandoffActions buttons are enabled and call `continueTask`
6. Typecheck + build pass

### Feature B Tests
1. Unit test: Claude connector probe returns `needs-login` when auth fails
2. Unit test: Codex connector probe checks `OPENAI_API_KEY`
3. Unit test: Ollama connector discovers pulled models
4. Renderer test: AgentPanel shows correct status message per state
5. Typecheck + build pass

### Manual Smoke Test
1. Start a `code-review-fix-verify` workflow
2. After Claude codes and Codex reviews, click "Send to Claude for fix"
3. Verify Claude runs in the same worktree, not a new one
4. Click "Ask Codex to verify" — verify Codex reviews the same worktree
5. Agent panels show correct status messages for installed/missing agents
