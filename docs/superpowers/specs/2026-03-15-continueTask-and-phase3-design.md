# Design: continueTask Backend + Phase 3 Onboarding Hardening

**Date:** 2026-03-15
**Status:** Approved and mostly implemented. Saved next-session follow-up: execution-stage alignment + doc sync.
**Scope:** Two independent features that share a milestone but touch different files.

---

## Saved Follow-Up Note

- `continueTask` is already implemented in the app.
- `HandoffActions` are already enabled and routed through `continueTask`.
- Public `ContinueTaskOptions.single-step.stage` already uses `ResumableStage`.
- The remaining queued follow-up for the next session is:
  - narrow internal workflow-engine execution-only stage parameters from `TaskStage` to `ResumableStage`
  - make single-step prompt selection exhaustive over `code | review | fix | verify`
  - refresh AI handoff and planning docs so they reflect the current implementation state

---

## Feature A: continueTask — Task Continuation Backend

### Problem

Historical context: Phase 2 HandoffActions buttons were disabled because they called `startWorkflow()`, which always created a new task + worktree. The user expectation was that "Send to Claude for fix" should continue the *selected* task in its *existing* worktree, not spawn a fresh workflow. That continuation path now exists; the remaining work is the narrower execution-stage alignment note above.

### Design Decision

- Keep `startWorkflow(input)` for new tasks only.
- Add `continueTask(taskId, options)` for existing tasks.
- `options` is a discriminated union with two modes:
  - `mode: 'resume'` — pick up a built-in workflow from a given stage
  - `mode: 'single-step'` — run exactly one agent step against the existing worktree

### Type Changes

#### `src/shared/types.ts`

Add new types:

```typescript
// Extract the 6 roles that can actively run agent steps.
// Used by both WorkflowEngine.runStep() and ContinueTaskOptions.
// Excludes 'compare-only', 'developer', and 'off' which are profile-level
// settings, not step-execution roles.
export type ActiveAgentRole = 'coder' | 'reviewer' | 'tester' | 'architect' | 'planner' | 'monitor';

// Resumable stages — the stages that appear as actual runStep() targets
// in built-in workflows. Terminal states (brief, promote, done, error)
// and the transition label 'findings' are not resumable.
export type ResumableStage = 'code' | 'review' | 'fix' | 'verify';

export type ContinueTaskOptions =
  | {
      mode: 'resume';
      fromStage: ResumableStage;
    }
  | {
      mode: 'single-step';
      stage: ResumableStage;       // narrowed from TaskStage — only stages with prompt builders
      agentId: AgentId;
      role: ActiveAgentRole;
      prompt?: string;
    };
```

Also update `WorkflowEngine.runStep()` signature to use `ActiveAgentRole` instead of its current inline union, keeping them in sync.

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

Stage ordering for skip logic uses the `ResumableStage` type: `['code', 'review', 'fix', 'verify']`. The `'findings'` label is not a runStep target in any existing workflow — it is excluded. Terminal stages (`'brief'`, `'promote'`, `'done'`, `'error'`) are rejected by the `ResumableStage` type at compile time.

Resume mode is supported for `code-review-fix-verify` and `code-gemini-compare-codex-review` (which share the same stage flow). The `architecture-compare` and `away-monitor` workflows do not support resume — if attempted, `continue()` throws `'Resume not supported for workflow ${workflowId}'`.

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

Add a `private readonly activeContinuations = new Set<string>();` field to `AppController`.

```typescript
async continueTask(taskId: string, options: ContinueTaskOptions): Promise<WorkbenchSnapshot> {
  const task = this.snapshot.tasks.find(t => t.id === taskId);
  if (!task) throw new Error('Task not found.');
  if (!this.snapshot.project) throw new Error('No project selected.');
  if (!this.snapshot.project.isGitRepo) throw new Error('Project is not a git repository.');

  // Concurrency guard — prevent two continuations on the same worktree
  if (this.activeContinuations.has(taskId)) {
    throw new Error('Task is already being continued. Wait for the current step to finish.');
  }
  this.activeContinuations.add(taskId);
  try {

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
} finally {
  this.activeContinuations.delete(taskId);
}
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
| Ask Gemini for review | `gemini` | `review` | `architect` | *Gemini reviews as `architect` by convention — matches `code-gemini-compare-codex-review` workflow* |

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
3. **Resume from invalid stage:** `ResumableStage` type rejects terminal stages at compile time. Non-resumable workflows (`architecture-compare`, `away-monitor`) throw at runtime.
4. **Concurrent continuation:** Guarded by `activeContinuations` Set in AppController. Second call on same taskId throws immediately.
5. **Project not a git repo:** `continueTask` checks `isGitRepo` like `startWorkflow` does.

---

## Feature B: Phase 3 — Onboarding Hardening

### Problem

First-run setup is unreliable when agents are missing, not logged in, or running under the wrong runner (Windows vs WSL). The current probes only check binary existence, not auth readiness.

### Design

Phase 3 is primarily probe logic + UI messaging. `AgentStatus` already has the right status values. One type change is needed: add `availableModels` to `OllamaStatus` to transport discovered model names to the renderer.

#### Type Change: `src/shared/types.ts`

```typescript
export interface OllamaStatus {
  available: boolean;
  running: boolean;
  owner: OllamaLifecycleOwner;
  activeModel?: string;
  availableModels?: string[];   // NEW — discovered model names from /api/tags
  endpoint: string;
  message?: string;
}
```

This is the only shared type change for Feature B.

### Connector Probe Enhancements

Each connector overrides `performDeepAuthProbe()` (protected in `BaseConnector`). The base `probe()` already handles binary detection (`missing` → `installed`). Deep probes run when `deep = true` and determine `needs-login` vs `ready`.

**Critical:** All CLI agents default to `authMode: 'native-login'` in `DEFAULT_AGENTS`. The probe strategy must match the agent's `authMode`, not assume API keys.

#### Claude Connector (`claude-connector.ts`)
- `authMode: 'native-login'` → run `claude auth status` (or a lightweight `claude -p "ping" --output-format json` with short timeout)
- If exit code 0 → `ready`; if auth error → `needs-login` with message "Run `claude login`"
- If timeout → `error` with message
- Do NOT check environment variables — Claude uses native browser-based login

#### Codex Connector (`codex-connector.ts`)
- `authMode: 'native-login'` → Codex authenticates via ChatGPT subscription (native login flow), not via `OPENAI_API_KEY`
- Run `codex --version` to confirm install
- Run a lightweight auth check: `codex exec "echo ok"` with short timeout
- If exit code 0 → `ready`; if auth error → `needs-login` with message "Run `codex login` or sign in with your ChatGPT account"
- Only fall back to `OPENAI_API_KEY` check if `authMode` is explicitly set to `'api-key'`

#### Gemini Connector (`gemini-connector.ts`)
- `authMode: 'native-login'` → Gemini CLI authenticates via Google account (browser-based login flow), not via `GOOGLE_API_KEY`
- Run a lightweight auth check: `gemini -p "ping" --output-format stream-json` with short timeout
- If exit code 0 → `ready`; if auth error → `needs-login` with message "Run `gemini login` or sign in with your Google account"
- Only fall back to `GOOGLE_API_KEY`/`gcloud auth` check if `authMode` is explicitly set to `'api-key'`
- Note: `GeminiConnector.getScriptedCommand()` already branches on `authMode === 'api-key'` for env passthrough

#### Ollama Connector (`ollama-connector.ts`)
- `authMode: 'none'` — no login needed
- `runner: 'http-local'` — check HTTP endpoint reachable via `GET http://localhost:11434/api/tags`
- If endpoint unreachable → `missing` with message "Ollama not running. Start it or install from ollama.com"
- If reachable but no models → `installed` with message "No models pulled — run `ollama pull qwen2.5-coder:7b`"
- If reachable and models exist → `ready`
- Store discovered model names in `OllamaStatus.availableModels` (new field, see type change below)

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

### Files Changed (Feature B) — additional

| File | Change Type |
|------|------------|
| `src/shared/types.ts` | Add `availableModels?: string[]` to `OllamaStatus` |

### Files NOT Changed

- `src/shared/ipc.ts` — no new IPC methods; existing `probeAgents` is sufficient
- `src/main/services/workflow-engine.ts` — onboarding is independent of workflows

---

## Independence

Features A and B are fully independent:

- **A (continueTask)** touches: workflow engine, app controller, IPC, store, HandoffActions
- **B (onboarding)** touches: connectors, process runner, AgentPanel

The shared file `src/shared/types.ts` is touched by both, but they add different things (A adds `ContinueTaskOptions`/`ActiveAgentRole`/`ResumableStage`, B adds `availableModels` to `OllamaStatus`). No conflict.

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
1. Unit test: Claude connector deep probe returns `needs-login` when native auth check fails
2. Unit test: Codex connector deep probe uses native login check (not OPENAI_API_KEY) when authMode is `native-login`
3. Unit test: Gemini connector deep probe uses native login check (not GOOGLE_API_KEY) when authMode is `native-login`
4. Unit test: Ollama connector discovers pulled models via `/api/tags` and populates `availableModels`
5. Renderer test: AgentPanel shows correct status message per state
6. Typecheck + build pass

### Manual Smoke Test
1. Start a `code-review-fix-verify` workflow
2. After Claude codes and Codex reviews, click "Send to Claude for fix"
3. Verify Claude runs in the same worktree, not a new one
4. Click "Ask Codex to verify" — verify Codex reviews the same worktree
5. Agent panels show correct status messages for installed/missing agents
