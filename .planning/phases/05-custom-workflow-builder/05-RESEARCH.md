# Phase 5: Custom Workflow Builder - Research

**Researched:** 2026-03-22
**Domain:** Electron IPC extension, SQLite schema migration, React form UI, WorkflowEngine integration
**Confidence:** HIGH — all findings verified directly from project source code

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Workflow step editor** — UI to add, reorder, and remove steps in a workflow
- **Agent + role selector per step** — each step assigns which agent runs and in which role (coder/reviewer/etc.)
- **Prompt template per step** — each step has an editable prompt that gets interpolated at runtime
- **Approval gate toggle per step** — each step can require user approval before the next step runs
- **Save named workflows** — completed workflow definitions are saved and appear in the workflow selector alongside the built-in ones
- **Storage:** Custom workflows stored in SQLite (same `triad-workbench.db`) via a new `custom_workflows` table
- **Loaded and merged with `WORKFLOW_DEFINITIONS` at startup** — user sees both built-ins and custom ones in the selector
- **UI Placement:** Workflow builder accessed via a "New workflow" / "+" button next to the workflow selector dropdown
- **Builder opens as a modal or dedicated panel** (Claude's discretion)
- **Built-in workflows are read-only; custom ones show an edit/delete button**

### Claude's Discretion
- Whether builder is modal overlay or a dedicated right-panel view
- Step reordering UX (drag-and-drop vs up/down buttons — prefer up/down buttons, simpler)
- Exact form field layout within each step card
- Whether prompt template uses a simple textarea or a richer editor (prefer textarea)
- Validation rules for workflow names (non-empty, unique)

### Deferred Ideas (OUT OF SCOPE)
- Sharing/exporting custom workflows to JSON file — future
- Workflow versioning/history — future
- Visual workflow diagram view — out of scope for v0.1
- Drag-and-drop step reordering — prefer simpler up/down buttons for now
</user_constraints>

---

## Summary

Phase 5 extends Triad Workbench with a user-facing workflow editor that creates, saves, and executes custom multi-step agent chains. All four layers of the app must be touched in a coordinated way: the shared types module gains two new interfaces (`CustomWorkflowStep` and `CustomWorkflow`), the IPC contract gains three new channels (list/save/delete), the SQLite persistence layer gains a new `custom_workflows` table via the existing `ensureColumn`-style migration, and the renderer gains a builder UI component plus an updated workflow selector.

The most critical architectural insight is that `WorkflowEngine` does NOT drive workflows from data — it uses a hard `switch` statement that maps `workflowId` to a specific private method. Custom workflows cannot slot in through `WorkflowId` (a string union) without modifying `WorkflowEngine` to handle a new "custom" execution path. The cleanest approach is to add a `runCustomWorkflow(context, steps, signal)` method to `WorkflowEngine` that iterates steps and calls `runStep()` with the user-supplied `agentId`, `role`, and `promptTemplate`. The `TaskRun.workflowId` field is typed as `WorkflowId` (a narrow union) — this must be widened or a companion `customWorkflowId?: string` field must be added to `TaskRun`.

The IPC 4-file contract (ipc.ts → preload/index.ts → main/index.ts → app-controller.ts) is well-established and mechanical to extend. The pattern has been applied twice before (Phase 2 and Phase 4). Every new channel requires a simultaneous change in all four files plus `dev-mock.ts` and `test-setup.ts` to keep TypeScript compiling.

**Primary recommendation:** Add a `runCustomWorkflow` path to `WorkflowEngine`, extend `TaskRun` with `customWorkflowId?: string`, implement the 3-channel IPC contract, add the `custom_workflows` SQLite table via migrate(), and build a modal WorkflowBuilder component in the renderer that reads/writes through the new IPC channels.

---

## Standard Stack

### Core (already in project — no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | existing | SQLite persistence | Already used in PersistenceService |
| Zustand | existing | Renderer state | Already used for all store actions |
| React | existing | UI components | Project standard |
| uuid (v4) | existing | UUID generation | Already used in WorkflowEngine |

### Supporting (no new dependencies needed)
This phase adds no new npm dependencies. All required libraries are already installed.

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Recommended File Locations
```
src/
├── shared/
│   ├── types.ts               # Add CustomWorkflowStep, CustomWorkflow interfaces
│   │                          # Widen WorkflowId union OR add customWorkflowId to TaskRun
│   ├── ipc.ts                 # Add 3 channels + WorkbenchApi methods
│   └── workflows.ts           # No change (built-ins stay hardcoded)
├── main/
│   ├── services/
│   │   └── persistence.ts     # Add custom_workflows table + 3 CRUD methods
│   ├── app-controller.ts      # Add listCustomWorkflows, saveCustomWorkflow, deleteCustomWorkflow
│   ├── services/
│   │   └── workflow-engine.ts # Add runCustomWorkflow(context, steps, signal) method
│   └── index.ts               # Wire 3 new ipcMain.handle entries
├── preload/
│   └── index.ts               # Add 3 new ipcRenderer.invoke entries
└── renderer/src/
    ├── components/
    │   └── WorkflowBuilder.tsx # New modal/panel component
    ├── App.tsx                 # Add "+" button + WorkflowBuilder toggle, merge custom workflows
    ├── store.ts                # Add 3 new store actions
    ├── dev-mock.ts             # Stub 3 new WorkbenchApi methods
    └── test-setup.ts          # Add 3 new vi.fn() stubs
```

### Pattern 1: IPC 4-File Contract (HIGH confidence — verified from source)
**What:** Every new IPC channel must be added in exactly 4 files simultaneously.
**When to use:** All new main-process capabilities accessible from renderer.

File 1 — `src/shared/ipc.ts`:
```typescript
// Add to WorkbenchApi interface:
listCustomWorkflows: () => Promise<CustomWorkflow[]>;
saveCustomWorkflow: (workflow: CustomWorkflow) => Promise<CustomWorkflow>;
deleteCustomWorkflow: (id: string) => Promise<void>;

// Add to IPC_CHANNELS object:
listCustomWorkflows: 'workbench:workflows:list-custom',
saveCustomWorkflow: 'workbench:workflows:save-custom',
deleteCustomWorkflow: 'workbench:workflows:delete-custom',
```

File 2 — `src/preload/index.ts`:
```typescript
listCustomWorkflows: () => ipcRenderer.invoke(IPC_CHANNELS.listCustomWorkflows),
saveCustomWorkflow: (workflow) => ipcRenderer.invoke(IPC_CHANNELS.saveCustomWorkflow, workflow),
deleteCustomWorkflow: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteCustomWorkflow, id),
```

File 3 — `src/main/index.ts` inside `wireIpc()`:
```typescript
ipcMain.handle(IPC_CHANNELS.listCustomWorkflows, () => nextController.listCustomWorkflows());
ipcMain.handle(IPC_CHANNELS.saveCustomWorkflow, (_event, workflow) => nextController.saveCustomWorkflow(workflow));
ipcMain.handle(IPC_CHANNELS.deleteCustomWorkflow, (_event, id) => nextController.deleteCustomWorkflow(id));
```

File 4 — `src/main/app-controller.ts`:
```typescript
listCustomWorkflows(): CustomWorkflow[] {
  return this.persistence.loadCustomWorkflows();
}
saveCustomWorkflow(workflow: CustomWorkflow): CustomWorkflow {
  return this.persistence.saveCustomWorkflow(workflow);
}
deleteCustomWorkflow(id: string): void {
  this.persistence.deleteCustomWorkflow(id);
}
```

### Pattern 2: SQLite Migration via ensureColumn (HIGH confidence — verified from source)
**What:** `PersistenceService.migrate()` adds new tables via `CREATE TABLE IF NOT EXISTS`. New columns on existing tables use `ensureColumn()`. New tables go directly in the `db.exec()` block.
**When to use:** Any new persistent data.

```typescript
// In migrate() — add inside the db.exec() template string:
CREATE TABLE IF NOT EXISTS custom_workflows (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

// CRUD methods on PersistenceService:
loadCustomWorkflows(): CustomWorkflow[] {
  const rows = this.db.prepare('SELECT * FROM custom_workflows ORDER BY created_at ASC').all() as ...;
  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    description: String(row.description),
    mode: row.mode as WorkflowMode,
    steps: JSON.parse(String(row.steps_json)) as CustomWorkflowStep[],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }));
}

saveCustomWorkflow(workflow: CustomWorkflow): CustomWorkflow {
  const now = new Date().toISOString();
  this.db.prepare(`
    INSERT INTO custom_workflows (id, label, description, mode, steps_json, created_at, updated_at)
    VALUES (@id, @label, @description, @mode, @stepsJson, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      description = excluded.description,
      mode = excluded.mode,
      steps_json = excluded.steps_json,
      updated_at = excluded.updated_at
  `).run({
    id: workflow.id,
    label: workflow.label,
    description: workflow.description,
    mode: workflow.mode,
    stepsJson: JSON.stringify(workflow.steps),
    createdAt: workflow.createdAt ?? now,
    updatedAt: now
  });
  return { ...workflow, updatedAt: now };
}

deleteCustomWorkflow(id: string): void {
  this.db.prepare('DELETE FROM custom_workflows WHERE id = ?').run(id);
}
```

### Pattern 3: WorkflowEngine Custom Execution Path (HIGH confidence — verified from source)
**What:** `WorkflowEngine.start()` currently uses a hard switch on `workflowId`. Custom workflows need a new execution path.
**Critical constraint:** `WorkflowId` is a narrow TypeScript union in `types.ts` — it cannot accommodate arbitrary user-generated string IDs without change.

**Two options:**
1. Add `'custom'` to the `WorkflowId` union and use `customWorkflowId` in `StartWorkflowInput` — simpler type change
2. Keep `WorkflowId` as-is, check if `workflowId === 'custom'` and look up the custom workflow by a separate field

**Recommended approach (Option 1):** Extend `WorkflowId` to include `'custom'` as a valid value, add `customWorkflowId?: string` to `StartWorkflowInput`, and handle in `WorkflowEngine.start()`:

```typescript
// In types.ts — add 'custom' to WorkflowId union:
export type WorkflowId =
  | 'code-review-fix-verify'
  | 'code-gemini-compare-codex-review'
  | 'architecture-compare'
  | 'away-monitor'
  | 'custom';

// In types.ts — extend StartWorkflowInput:
export interface StartWorkflowInput {
  brief: string;
  workflowId: WorkflowId;
  workflowMode?: WorkflowMode;
  agentOverrides?: Partial<Record<AgentId, AgentRole>>;
  customWorkflowSteps?: CustomWorkflowStep[];  // present when workflowId === 'custom'
}

// In workflow-engine.ts — add case to switch:
case 'custom':
  if (!input.customWorkflowSteps?.length) throw new Error('Custom workflow has no steps.');
  await this.runCustomWorkflow(context, input.customWorkflowSteps, controller.signal);
  break;

// New private method:
private async runCustomWorkflow(
  context: WorkflowContext,
  steps: CustomWorkflowStep[],
  signal?: AbortSignal
): Promise<void> {
  for (const step of steps) {
    const enforceReadOnly = step.role === 'reviewer' || step.role === 'tester' || step.role === 'monitor';
    const stage = this.roleToStage(step.role);  // map role to TaskStage
    await this.runStep(context, stage, step.agentId, step.promptTemplate, step.role, enforceReadOnly, signal);
    if (signal?.aborted) return;

    if (step.requiresApproval) {
      // Set task to a 'findings'-like holding state and return early.
      // User resumes via continueTask. The step index needs to be tracked.
      context.task.stage = 'findings';
      context.task.approvalState = 'pending';
      context.task.updatedAt = new Date().toISOString();
      context.updateTask(context.task);
      return;  // halts — user must approve to continue
    }
  }
}
```

**Note on approval gates:** The current `continueTask` → `WorkflowEngine.continue()` takes a `ContinueTaskOptions` which either resumes by stage name (for built-ins) or runs a single-step. Custom workflow resumption needs to know which step index to resume from. This requires either storing the current step index on `TaskRun` or using the existing `steps` array to infer position.

**Simplest approach:** Store `customStepIndex?: number` on the `TaskRun` to track which custom step was last completed. `continue` with `mode: 'resume'` picks up from `customStepIndex + 1`.

### Pattern 4: Zustand Store Action (HIGH confidence — verified from source)
**What:** All store actions follow the `runAction(set, () => window.workbench.X(), onSuccess)` pattern.

```typescript
// In store.ts — add to WorkbenchState interface:
listCustomWorkflows: () => Promise<CustomWorkflow[]>;
saveCustomWorkflow: (workflow: CustomWorkflow) => Promise<CustomWorkflow | undefined>;
deleteCustomWorkflow: (id: string) => Promise<void>;
customWorkflows: CustomWorkflow[];  // loaded at bootstrap time

// Implementation:
listCustomWorkflows: async () => {
  let result: CustomWorkflow[] = [];
  await runAction(set, () => window.workbench.listCustomWorkflows(), (workflows) => {
    result = workflows;
    set({ customWorkflows: workflows });
  });
  return result;
},
```

### Pattern 5: App.tsx Workflow Selector Integration (HIGH confidence — verified from source)
**What:** The existing workflow list (lines 122-134 of App.tsx) iterates `WORKFLOW_DEFINITIONS`. Custom workflows must be merged in at render time.

Current code (lines 122-134):
```tsx
<div className="workflow-list">
  {WORKFLOW_DEFINITIONS.map((workflow) => (
    <button key={workflow.id} ...>
```

Required change — merge built-ins with custom workflows:
```tsx
const customWorkflows = useWorkbenchStore((state) => state.customWorkflows);
const allWorkflows = [...WORKFLOW_DEFINITIONS, ...customWorkflows];

<div className="workflow-list">
  <div className="workflow-list-header">
    <span>Workflows</span>
    <button onClick={() => setShowBuilder(true)}>+</button>
  </div>
  {allWorkflows.map((workflow) => (
    <button key={workflow.id} className={workflowId === workflow.id ? 'selected' : ''}
      onClick={() => setWorkflowId(workflow.id)}>
      <strong>{workflow.label}</strong>
      <span>{workflow.description}</span>
      {/* Edit/Delete only for custom workflows */}
      {isCustomWorkflow(workflow) && (
        <span>
          <button onClick={(e) => { e.stopPropagation(); openEdit(workflow); }}>Edit</button>
          <button onClick={(e) => { e.stopPropagation(); void deleteCustomWorkflow(workflow.id); }}>Delete</button>
        </span>
      )}
    </button>
  ))}
</div>
```

**Note on `canRun` logic:** The current `canRun` switch in App.tsx (lines 75-88) does not handle `'custom'`. It must be extended:
```typescript
case 'custom':
  // Custom workflow readiness: check all agents referenced in steps are ready
  // For now: return true if project is a git repo (simpler — user chose the agents)
  return Boolean(snapshot.project?.isGitRepo);
```

### Pattern 6: WorkflowBuilder Component (Claude's Discretion — modal recommended)
**What:** A modal overlay (like TerminalOverlay pattern) for building workflows.

**Recommended structure:**
```tsx
// WorkflowBuilder.tsx — controlled by showBuilder local state in App.tsx
interface WorkflowBuilderProps {
  onClose: () => void;
  editWorkflow?: CustomWorkflow;  // undefined = new workflow
}

// Internal state:
const [label, setLabel] = useState('');
const [description, setDescription] = useState('');
const [mode, setMode] = useState<WorkflowMode>('chain');
const [steps, setSteps] = useState<CustomWorkflowStep[]>([]);

// Step card = agentId select + role select + promptTemplate textarea + requiresApproval checkbox
// Reorder = up/down buttons (not drag-and-drop per CONTEXT.md)
// Save = calls saveCustomWorkflow, closes modal
```

### Anti-Patterns to Avoid
- **Adding workflowId as arbitrary string to WorkflowId union without adding 'custom' sentinel:** The switch in `WorkflowEngine.start()` has a default `throw` — any unrecognized ID crashes the engine at runtime.
- **Storing custom workflow steps only in renderer state without persisting to SQLite:** User loses workflows on restart.
- **Not updating `resolveAgents()` in WorkflowEngine for 'custom':** `resolveAgents()` also has a hard switch with `throw` — custom workflows need a fallback that derives agents from their steps.
- **Not updating `dev-mock.ts` and `test-setup.ts`:** TypeScript will fail to compile because `WorkbenchApi` interface will have unsatisfied members. This blocked Phase 4 and is called out in STATE.md decisions.
- **Applying `canRun` read-only check at incorrect layer:** The `canRun` check in App.tsx currently hard-codes which agents are needed per workflow ID. Custom workflows need a dynamic check.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON serialization of steps | Custom serializer | `JSON.stringify` / `JSON.parse` (already used for AgentProfile, TaskRun) | Project already stores complex objects as JSON blobs in SQLite |
| UUID generation | Custom ID gen | `uuid` v4 (already imported in WorkflowEngine) | Already in project |
| Modal overlay pattern | Custom modal library | Follow TerminalOverlay CSS pattern (z-index, fixed position) | Project already has a working overlay pattern |
| Form validation | External library (e.g., react-hook-form) | Plain `useState` + inline validation | Project uses plain controlled inputs throughout; no form library installed |

**Key insight:** This phase is pure feature addition on top of existing infrastructure. Resist the temptation to introduce new libraries.

---

## Common Pitfalls

### Pitfall 1: WorkflowId Type Narrowness
**What goes wrong:** TypeScript rejects `workflowId: 'custom'` because `WorkflowId` is a union that doesn't include `'custom'`. Also, `TaskRun.workflowId: WorkflowId` would reject a user-generated UUID string entirely.
**Why it happens:** The type was designed for the 4 built-ins; no extension point was anticipated.
**How to avoid:** Add `'custom'` to the `WorkflowId` union in `types.ts`. Use `customWorkflowId?: string` on `StartWorkflowInput` and `TaskRun` for the actual UUID lookup. The `workflowId` field then carries `'custom'` as a sentinel, and `customWorkflowId` carries the actual DB row ID.
**Warning signs:** TypeScript errors on `workflowId` assignment; `WorkflowEngine.resolveAgents()` throwing at runtime.

### Pitfall 2: Approval Gate Interrupt Pattern
**What goes wrong:** Custom workflow with `requiresApproval: true` on step N halts execution. When user approves, `continueTask` is called. But the engine doesn't know where it left off in the custom step sequence — it only knows the current `TaskStage`.
**Why it happens:** The existing `continue()` path for built-in workflows uses `ResumableStage` names (code/review/fix/verify) as the resume point. Custom workflows have arbitrary steps indexed 0..N.
**How to avoid:** Store `customStepIndex: number` on `TaskRun` (add field). When `runCustomWorkflow` hits an approval gate, save the current step index before returning. When `continue()` is called with `mode: 'resume'`, pass the stored index as the start point.
**Warning signs:** Custom workflow always restarts from step 0 on continue; all steps re-execute.

### Pitfall 3: resolveAgents() Hard Switch
**What goes wrong:** `WorkflowEngine.resolveAgents(workflowId)` throws `Error: Unsupported workflow custom`. This is called during `start()` to populate `task.assignedAgents`.
**Why it happens:** `resolveAgents` also has a hard `switch` with a `default: throw`.
**How to avoid:** Add a `case 'custom': return steps.map(s => s.agentId)` branch (deduplicated). The steps need to be passed in to `resolveAgents` or computed from `input.customWorkflowSteps`.
**Warning signs:** Runtime error when attempting to start a custom workflow.

### Pitfall 4: WorkbenchApi Compile Failure
**What goes wrong:** After adding 3 new methods to `WorkbenchApi` in `ipc.ts`, TypeScript errors appear in `dev-mock.ts` and `test-setup.ts` because those files provide complete implementations of the interface.
**Why it happens:** Both files satisfy `WorkbenchApi` exhaustively — any new method breaks the compile.
**How to avoid:** Update `dev-mock.ts` (3 new async stub methods) and `test-setup.ts` (3 new `vi.fn()` stubs) in the same task or wave as the `ipc.ts` change.
**Warning signs:** `npm run typecheck` fails with "Property 'listCustomWorkflows' is missing in type...".

### Pitfall 5: Workflow Selector Shows All Workflows Including Custom in canRun
**What goes wrong:** User selects a custom workflow but `canRun` returns `false` because the switch doesn't have a `'custom'` case (falls through to `default: return false`).
**Why it happens:** `canRun` in App.tsx is a switch on `workflowId` with explicit cases for the 4 built-ins.
**How to avoid:** Add `case 'custom': return Boolean(snapshot.project?.isGitRepo)` to the switch.
**Warning signs:** "Run workflow" button always disabled when a custom workflow is selected.

### Pitfall 6: WorkbenchSnapshot Does Not Include Custom Workflows
**What goes wrong:** Custom workflows loaded at bootstrap are available for the session but not included in the snapshot pushed to the renderer via `stateChanged`. After an IPC call that pushes a new snapshot, the renderer's `customWorkflows` store state is wiped.
**Why it happens:** `WorkbenchSnapshot` in `types.ts` does not have a `customWorkflows` field. The snapshot is the authoritative state pushed by `emitState()`.
**How to avoid:** Either (a) add `customWorkflows: CustomWorkflow[]` to `WorkbenchSnapshot` and populate it in `AppController`, or (b) keep custom workflows as separate IPC state that is loaded once at bootstrap and maintained independently (not part of snapshot push). Option (a) is cleaner and consistent with how the app handles all other state.
**Warning signs:** Custom workflows disappear from the selector after any action that triggers `emitState()`.

### Pitfall 7: Step promptTemplate Interpolation
**What goes wrong:** Custom prompt templates need to reference `{{brief}}` or similar placeholders that get filled at runtime with the task brief. If interpolation is not implemented, templates are passed verbatim — potentially useful but missing key context.
**Why it happens:** Built-in prompts are built by functions in `prompts.ts` that have access to `task.brief`, `diff`, `findings` etc. Custom step templates have no equivalent mechanism unless interpolation is added.
**How to avoid:** At minimum, implement `{{brief}}` interpolation before passing the template to `runStep`. In `runCustomWorkflow`:
```typescript
const prompt = step.promptTemplate.replace('{{brief}}', context.task.brief);
```
More variables (e.g., `{{findings}}`, `{{diff}}`) can be added progressively.
**Warning signs:** Custom workflows run with template placeholder text visible to the agent.

---

## Code Examples

### WorkflowEngine.runCustomWorkflow Integration Point
```typescript
// Source: verified from src/main/services/workflow-engine.ts (lines 81-99, switch pattern)
// In WorkflowEngine.start(), add to switch:
case 'custom': {
  const steps = input.customWorkflowSteps;
  if (!steps?.length) throw new Error('Custom workflow has no steps.');
  await this.runCustomWorkflow(context, steps, 0, controller.signal);
  break;
}

// New private method (mirrors runCodeReviewFixVerify pattern):
private async runCustomWorkflow(
  context: WorkflowContext,
  steps: CustomWorkflowStep[],
  fromIndex: number,
  signal?: AbortSignal
): Promise<void> {
  for (let i = fromIndex; i < steps.length; i++) {
    const step = steps[i];
    const enforceReadOnly = step.role === 'reviewer' || step.role === 'tester' || step.role === 'monitor';
    const taskStage = this.roleToStage(step.role);
    const prompt = step.promptTemplate.replace('{{brief}}', context.task.brief);
    await this.runStep(context, taskStage, step.agentId, prompt, step.role, enforceReadOnly, signal);
    if (signal?.aborted) return;

    if (step.requiresApproval && i < steps.length - 1) {
      context.task.stage = 'findings';
      context.task.approvalState = 'pending';
      (context.task as TaskRun & { customStepIndex?: number }).customStepIndex = i;
      context.task.updatedAt = new Date().toISOString();
      context.updateTask(context.task);
      return;  // pause for user approval
    }
  }
}
```

### PersistenceService Custom Workflows Table Migration
```typescript
// Source: verified from src/main/services/persistence.ts (lines 216-266, migrate() pattern)
// In the db.exec() template string inside migrate():
CREATE TABLE IF NOT EXISTS custom_workflows (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Workflow Selector Merged List in App.tsx
```typescript
// Source: verified from src/renderer/src/App.tsx (lines 38-39, 122-134 — workflow selector pattern)
// Replace the existing WORKFLOW_DEFINITIONS.map with merged list:
const [workflowId, setWorkflowId] = useState<string>(WORKFLOW_DEFINITIONS[0].id);
const customWorkflows = useWorkbenchStore((state) => state.customWorkflows);
const allWorkflows: Array<WorkflowDefinition | CustomWorkflow> = [
  ...WORKFLOW_DEFINITIONS,
  ...customWorkflows
];
```

### dev-mock.ts and test-setup.ts Stubs
```typescript
// Source: verified from src/renderer/src/dev-mock.ts and test-setup.ts
// dev-mock.ts additions:
listCustomWorkflows: async () => [],
saveCustomWorkflow: async (workflow) => workflow,
deleteCustomWorkflow: async () => {},

// test-setup.ts additions:
listCustomWorkflows: vi.fn(async () => []),
saveCustomWorkflow: vi.fn(async (w) => w),
deleteCustomWorkflow: vi.fn(async () => undefined),
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 5 |
|--------------|------------------|--------------------|
| Hard-coded workflow switch | Must extend switch with `'custom'` sentinel | Requires `WorkflowId` type change |
| `WorkflowId` narrow union (4 values) | Widen to include `'custom'` | TaskRun.workflowId stays typed |
| No custom workflow persistence | New `custom_workflows` SQLite table | Additive migration, no data loss |
| Workflow selector iterates `WORKFLOW_DEFINITIONS` only | Merge with loaded custom workflows | Renderer loads custom list at bootstrap |

---

## Open Questions

1. **Approval gate resumption: where to store step index?**
   - What we know: `TaskRun` has no field for tracking position within a custom workflow.
   - What's unclear: Whether to add `customStepIndex?: number` to `TaskRun` (shared type change) or infer position from the `steps` array length.
   - Recommendation: Add `customStepIndex?: number` to `TaskRun` in `types.ts`. The `steps` array already records which steps ran, so index can also be inferred from `steps.length` if the custom workflow steps are stored on `TaskRun`. Either approach is valid; explicit field is clearer.

2. **WorkbenchSnapshot vs. separate IPC load for custom workflows**
   - What we know: All current state is pushed via `WorkbenchSnapshot` through `emitState()`. Custom workflows don't change on every task update.
   - What's unclear: Whether adding `customWorkflows: CustomWorkflow[]` to `WorkbenchSnapshot` is the right fit, or whether they should be loaded once and stored separately in Zustand.
   - Recommendation: Add `customWorkflows: CustomWorkflow[]` to `WorkbenchSnapshot` for consistency with how all other state is handled. Populate in `AppController` constructor and update in `listCustomWorkflows`/`saveCustomWorkflow`/`deleteCustomWorkflow`.

3. **promptTemplate variable set: just `{{brief}}` or more?**
   - What we know: Built-in prompts include task brief, diff, findings, and prior context. Custom prompts are user-written text.
   - What's unclear: How many interpolation variables to support in Phase 5 vs. deferring to future.
   - Recommendation: Implement `{{brief}}` only for Phase 5. Document that `{{diff}}` and `{{findings}}` are future work.

---

## Sources

### Primary (HIGH confidence)
All findings are directly verified from project source files:
- `src/shared/types.ts` — `WorkflowId`, `WorkflowDefinition`, `StartWorkflowInput`, `TaskRun`, `WorkbenchSnapshot`
- `src/shared/ipc.ts` — `WorkbenchApi`, `IPC_CHANNELS` — 4-file contract pattern
- `src/shared/workflows.ts` — `WORKFLOW_DEFINITIONS` — 4 built-in workflows
- `src/main/services/persistence.ts` — SQLite schema, migrate(), ensureColumn() pattern
- `src/main/services/workflow-engine.ts` — switch dispatch, runStep(), resolveAgents()
- `src/main/app-controller.ts` — startWorkflow(), listArchiveTasks() patterns
- `src/main/utils/prompts.ts` — build*Prompt() functions — prompt construction patterns
- `src/main/index.ts` — wireIpc() — ipcMain.handle registration pattern
- `src/preload/index.ts` — ipcRenderer.invoke pattern
- `src/renderer/src/App.tsx` — workflow selector, canRun switch, layout
- `src/renderer/src/store.ts` — runAction pattern, WorkbenchState shape
- `src/renderer/src/components/AgentPanel.tsx` — component UI patterns
- `src/renderer/src/dev-mock.ts` — WorkbenchApi stub pattern
- `src/renderer/src/test-setup.ts` — vi.fn() stub pattern
- `.planning/STATE.md` — history decisions (Phase 4 IPC patterns, test-setup requirement)

### Secondary (MEDIUM confidence)
- `.planning/phases/05-custom-workflow-builder/05-CONTEXT.md` — locked decisions and constraints

### Tertiary (LOW confidence)
- None — all findings are from direct code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing
- Architecture patterns: HIGH — derived from verified source code
- Pitfalls: HIGH — most pitfalls identified from direct code analysis of the switch statements, type unions, and IPC compile requirements
- WorkflowEngine integration: HIGH — full source read; execution path is clear

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable codebase; no external dependencies to track)
