# continueTask Implementation Plan

> **Status snapshot (2026-03-15):** The core `continueTask` feature in this document is already implemented. Keep this file as historical reference for the landed work, not as the next execution checklist.
>
> **Saved next-session follow-up:**
> - finish internal workflow-engine execution-stage alignment in `src/main/services/workflow-engine.ts`
> - make single-step prompt selection exhaustive over `code | review | fix | verify`
> - sync the Phase 3 spec, AI handoff docs, and planning state
> - no runtime code changes are queued outside that narrower follow-up

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans when revisiting the remaining follow-up. The large checklist below is retained as the original implementation record.

**Goal:** Add a `continueTask(taskId, options)` IPC method that lets HandoffActions run agents against an existing task's worktree instead of spawning fresh workflows.

**Architecture:** Extend the shared types with `ActiveAgentRole`, `ResumableStage`, and `ContinueTaskOptions` (discriminated union). Add `WorkflowEngine.continue()` that reuses an existing task's worktree. Wire through IPC → preload → store → HandoffActions. No changes to `startWorkflow`.

**Tech Stack:** TypeScript 5.9, Electron IPC, Zustand 5, Vitest, existing workflow engine internals.

---

## File Structure

### New files to create

None — all changes modify existing files.

### Files to modify

| File | Responsibility |
|------|---------------|
| `src/shared/types.ts` | Add `ActiveAgentRole`, `ResumableStage`, `ContinueTaskOptions` |
| `src/shared/ipc.ts` | Add `continueTask` to `WorkbenchApi` + `IPC_CHANNELS` |
| `src/main/services/workflow-engine.ts` | Add `continue()` method, update `runStep` role type, add `fromStage` skip logic |
| `src/main/app-controller.ts` | Add `continueTask()` method with concurrency guard |
| `src/main/index.ts` | Add IPC handler for `continueTask` |
| `src/preload/index.ts` | Expose `continueTask` via contextBridge |
| `src/renderer/src/store.ts` | Add `continueTask` action |
| `src/renderer/src/components/HandoffActions.tsx` | Re-enable buttons, call `continueTask` |

### Test files

| File | Coverage |
|------|---------|
| `src/main/services/workflow-engine.test.ts` | `continue()` resume + single-step modes |
| `src/renderer/src/components/HandoffActions.test.tsx` | Buttons enabled, correct `continueTask` calls |

---

## Chunk 1: Shared Types + IPC Contract

### Task 1: Add shared types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add `ActiveAgentRole` type after `AgentRole`**

After line 11 (`| 'off';`), add:

```typescript
export type ActiveAgentRole = 'coder' | 'reviewer' | 'tester' | 'architect' | 'planner' | 'monitor';
```

- [ ] **Step 2: Add `ResumableStage` type after `TaskStage`**

After line 30 (`| 'error';`), add:

```typescript
export type ResumableStage = 'code' | 'review' | 'fix' | 'verify';
```

- [ ] **Step 3: Add `ContinueTaskOptions` type after `StartWorkflowInput`**

After line 189 (closing `}` of `StartWorkflowInput`), add:

```typescript
export type ContinueTaskOptions =
  | {
      mode: 'resume';
      fromStage: ResumableStage;
    }
  | {
      mode: 'single-step';
      stage: ResumableStage;
      agentId: AgentId;
      role: ActiveAgentRole;
      prompt?: string;
    };
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd "D:\ccgl room"
git add src/shared/types.ts
git commit -m "feat(types): add ActiveAgentRole, ResumableStage, ContinueTaskOptions"
```

---

### Task 2: Add IPC contract

**Files:**
- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: Add `ContinueTaskOptions` import**

Update the import at the top of `src/shared/ipc.ts` to include `ContinueTaskOptions`:

```typescript
import type {
  AgentId,
  AgentRole,
  ContinueTaskOptions,
  PromotionAction,
  ProjectArchiveSummary,
  ProjectRef,
  RunnerKind,
  StartWorkflowInput,
  TerminalSession,
  WorkbenchSnapshot
} from './types';
```

- [ ] **Step 2: Add `continueTask` to `WorkbenchApi`**

After the `promoteTask` line (line 24), add:

```typescript
continueTask: (taskId: string, options: ContinueTaskOptions) => Promise<WorkbenchSnapshot>;
```

- [ ] **Step 3: Add `continueTask` to `IPC_CHANNELS`**

After the `promoteTask` line (line 51), add:

```typescript
continueTask: 'workbench:workflow:continue',
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: Errors in `preload/index.ts` (missing `continueTask` implementation) — expected, will fix in Task 5.

- [ ] **Step 5: Commit**

```bash
cd "D:\ccgl room"
git add src/shared/ipc.ts
git commit -m "feat(ipc): add continueTask to WorkbenchApi and IPC_CHANNELS"
```

---

## Chunk 2: Workflow Engine + AppController

### Task 3: Add `continue()` to WorkflowEngine

**Files:**
- Modify: `src/main/services/workflow-engine.ts`

- [ ] **Step 1: Import `ActiveAgentRole`, `ContinueTaskOptions`, `ResumableStage`**

Update the import block at the top to include the new types:

```typescript
import type {
  ActiveAgentRole,
  AgentId,
  ArtifactBundle,
  ContinueTaskOptions,
  Finding,
  ProjectRef,
  ResumableStage,
  StartWorkflowInput,
  TaskRun,
  TaskStage,
  TaskStepRecord
} from '@shared/types';
```

- [ ] **Step 2: Update `runStep` role parameter type**

Change line 127 from:

```typescript
    role: 'coder' | 'reviewer' | 'tester' | 'architect' | 'planner' | 'monitor',
```

to:

```typescript
    role: ActiveAgentRole,
```

- [ ] **Step 3: Add stage ordering constant**

After the `WorkflowContext` interface (after line 23), add:

```typescript
const RESUMABLE_STAGE_ORDER: ResumableStage[] = ['code', 'review', 'fix', 'verify'];
```

- [ ] **Step 4: Add `fromStage` parameter to workflow runners**

Update `runCodeReviewFixVerify` signature to accept optional `fromStage`:

```typescript
  private async runCodeReviewFixVerify(context: WorkflowContext, fromStage?: ResumableStage): Promise<void> {
    const skip = fromStage ? RESUMABLE_STAGE_ORDER.indexOf(fromStage) : 0;

    if (skip <= 0) {
      await this.runStep(context, 'code', 'claude', buildCodingPrompt(context.task), 'coder');
    }
    if (skip <= 1) {
      const diff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'review', 'codex', buildReviewPrompt(context.task, diff, 'codex'), 'reviewer', true);
    }
    if (skip <= 2 && context.task.findings.length) {
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings), 'coder');
    }
    if (skip <= 3) {
      const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, verifyDiff, 'codex'), 'tester', true);
    }
  }
```

Do the same for `runCodeGeminiCodex`:

```typescript
  private async runCodeGeminiCodex(context: WorkflowContext, fromStage?: ResumableStage): Promise<void> {
    const skip = fromStage ? RESUMABLE_STAGE_ORDER.indexOf(fromStage) : 0;

    if (skip <= 0) {
      await this.runStep(context, 'code', 'claude', buildCodingPrompt(context.task), 'coder');
    }
    if (skip <= 1) {
      const diff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'review', 'gemini', buildReviewPrompt(context.task, diff, 'gemini'), 'architect', true);
    }
    if (skip <= 2 && context.task.findings.length) {
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings), 'coder');
    }
    if (skip <= 3) {
      const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
      await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, verifyDiff, 'codex'), 'reviewer', true);
    }
  }
```

Update the calls in `start()` to pass `undefined` for `fromStage`:

```typescript
      case 'code-review-fix-verify':
        await this.runCodeReviewFixVerify(context);
        break;
      case 'code-gemini-compare-codex-review':
        await this.runCodeGeminiCodex(context);
        break;
```

(No change needed — `fromStage` defaults to `undefined`.)

- [ ] **Step 5: Add `continue()` public method**

After the `start()` method, add:

```typescript
  async continue(
    project: ProjectRef,
    task: TaskRun,
    options: ContinueTaskOptions,
    updateTask: (task: TaskRun) => void,
    appendArtifact: (artifact: ArtifactBundle) => void
  ): Promise<TaskRun> {
    const context: WorkflowContext = {
      project,
      task,
      updateTask,
      appendArtifact
    };

    if (options.mode === 'resume') {
      switch (task.workflowId) {
        case 'code-review-fix-verify':
          await this.runCodeReviewFixVerify(context, options.fromStage);
          break;
        case 'code-gemini-compare-codex-review':
          await this.runCodeGeminiCodex(context, options.fromStage);
          break;
        default:
          throw new Error(`Resume not supported for workflow ${task.workflowId}`);
      }
      context.task.stage = context.task.stage === 'error' ? 'error' : 'promote';
    } else {
      const enforceReadOnly = options.role === 'reviewer' || options.role === 'tester' || options.role === 'monitor';
      let prompt: string;
      if (options.prompt) {
        prompt = options.prompt;
      } else {
        switch (options.stage) {
          case 'fix':
            prompt = buildFixPrompt(task, task.findings);
            break;
          case 'review':
          case 'verify': {
            const diff = await this.workspaceManager.getDiff(task, project);
            prompt = buildReviewPrompt(task, diff, options.agentId);
            break;
          }
          case 'code':
            prompt = buildCodingPrompt(task);
            break;
          default:
            throw new Error(`No built-in prompt for stage ${String(options.stage)}`);
        }
      }
      await this.runStep(context, options.stage, options.agentId, prompt, options.role, enforceReadOnly);
    }

    context.task.updatedAt = new Date().toISOString();
    updateTask(context.task);
    return context.task;
  }
```

- [ ] **Step 6: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: Errors only in `preload/index.ts` (still missing `continueTask`)

- [ ] **Step 7: Commit**

```bash
cd "D:\ccgl room"
git add src/main/services/workflow-engine.ts
git commit -m "feat(workflow): add continue() method with resume and single-step modes"
```

---

### Task 4: Add `continueTask()` to AppController

**Files:**
- Modify: `src/main/app-controller.ts`

- [ ] **Step 1: Add `fs` import and `ContinueTaskOptions` import**

Add `fs` import at the top (after existing `path` import):

```typescript
import fs from 'node:fs';
```

Update the type import to include `ContinueTaskOptions`:

```typescript
import {
  DEFAULT_AGENTS,
  type AgentId,
  type AgentRole,
  type ContinueTaskOptions,
  type PromotionAction,
  type ProjectRef,
  type RunnerKind,
  type StartWorkflowInput,
  type WorkbenchSnapshot
} from '@shared/types';
```

- [ ] **Step 2: Add `activeContinuations` field**

After line 36 (`private snapshot: WorkbenchSnapshot;`), add:

```typescript
  private readonly activeContinuations = new Set<string>();
```

- [ ] **Step 3: Add `continueTask()` method**

After the `startWorkflow()` method (after line 210), add:

```typescript
  async continueTask(taskId: string, options: ContinueTaskOptions): Promise<WorkbenchSnapshot> {
    const task = this.snapshot.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('Task not found.');
    }
    if (!this.snapshot.project?.isGitRepo) {
      throw new Error('Select a git-backed project before continuing a task.');
    }
    if (this.activeContinuations.has(taskId)) {
      throw new Error('Task is already being continued. Wait for the current step to finish.');
    }

    this.activeContinuations.add(taskId);
    try {
      if (!fs.existsSync(task.worktreePath)) {
        throw new Error('Task worktree no longer exists. Cannot continue.');
      }

      const updatedTask = await this.workflowEngine.continue(
        this.snapshot.project,
        task,
        options,
        (nextTask) => {
          this.upsertTask(nextTask);
        },
        (artifact) => {
          this.persistence.appendArtifact(artifact);
        }
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

- [ ] **Step 4: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: Errors only in `preload/index.ts`

- [ ] **Step 5: Commit**

```bash
cd "D:\ccgl room"
git add src/main/app-controller.ts
git commit -m "feat(controller): add continueTask with concurrency guard"
```

---

### Task 5: Wire IPC handler + preload

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add IPC handler in `src/main/index.ts`**

After line 51 (`ipcMain.handle(IPC_CHANNELS.promoteTask, ...)`), add:

```typescript
  ipcMain.handle(IPC_CHANNELS.continueTask, (_event, taskId, options) => nextController.continueTask(taskId, options));
```

- [ ] **Step 2: Add `continueTask` to preload API in `src/preload/index.ts`**

After line 16 (`promoteTask: ...`), add:

```typescript
  continueTask: (taskId, options) => ipcRenderer.invoke(IPC_CHANNELS.continueTask, taskId, options),
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd "D:\ccgl room"
git add src/main/index.ts src/preload/index.ts
git commit -m "feat(ipc): wire continueTask handler and preload bridge"
```

---

## Chunk 3: Renderer + Tests

### Task 6: Add store action

**Files:**
- Modify: `src/renderer/src/store.ts`

- [ ] **Step 1: Add `ContinueTaskOptions` import**

Update the type import to include `ContinueTaskOptions`:

```typescript
import type {
  AgentId,
  AgentRole,
  ContinueTaskOptions,
  PromotionAction,
  RunnerKind,
  StartWorkflowInput,
  TerminalSession,
  WorkbenchSnapshot
} from '@shared/types';
```

- [ ] **Step 2: Add `continueTask` to `WorkbenchState` interface**

After line 29 (`promoteTask: ...`), add:

```typescript
  continueTask: (taskId: string, options: ContinueTaskOptions) => Promise<void>;
```

- [ ] **Step 3: Add `continueTask` implementation**

After line 103 (`},` closing `promoteTask`), add:

```typescript
  continueTask: async (taskId, options) => {
    await runAction(set, () => window.workbench.continueTask(taskId, options), (snapshot) => set({ snapshot }));
  },
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/store.ts
git commit -m "feat(store): add continueTask action"
```

---

### Task 7: Re-enable HandoffActions

**Files:**
- Modify: `src/renderer/src/components/HandoffActions.tsx`

- [ ] **Step 1: Rewrite HandoffActions with enabled buttons**

Replace the entire file content:

```tsx
import type { Finding, TaskRun } from '@shared/types';

import { useWorkbenchStore } from '../store';

interface HandoffActionsProps {
  task: TaskRun;
  findings: Finding[];
}

function formatFindingsBrief(taskId: string, findings: Finding[]): string {
  return `Fix these findings from task ${taskId.slice(0, 8)}:\n${findings.map((f) => `- [${f.severity}] ${f.title}: ${f.body}`).join('\n')}`;
}

export function HandoffActions({ task, findings }: HandoffActionsProps) {
  const continueTask = useWorkbenchStore((state) => state.continueTask);
  const isBusy = useWorkbenchStore((state) => state.isBusy);

  return (
    <div className="handoff-actions">
      <strong className="handoff-label">Handoff actions</strong>
      <div className="handoff-buttons">
        <button
          className="handoff-btn handoff-claude"
          disabled={isBusy}
          onClick={() => {
            void continueTask(task.id, {
              mode: 'single-step',
              stage: 'fix',
              agentId: 'claude',
              role: 'coder',
              prompt: findings.length > 0 ? formatFindingsBrief(task.id, findings) : undefined
            });
          }}
        >
          Send to Claude for fix
        </button>
        <button
          className="handoff-btn handoff-codex"
          disabled={isBusy}
          onClick={() => {
            void continueTask(task.id, {
              mode: 'single-step',
              stage: 'verify',
              agentId: 'codex',
              role: 'tester'
            });
          }}
        >
          Ask Codex to verify
        </button>
        <button
          className="handoff-btn handoff-gemini"
          disabled={isBusy}
          onClick={() => {
            void continueTask(task.id, {
              mode: 'single-step',
              stage: 'review',
              agentId: 'gemini',
              role: 'architect'
            });
          }}
        >
          Ask Gemini for review
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/HandoffActions.tsx
git commit -m "feat(handoff): re-enable buttons with continueTask single-step calls"
```

---

### Task 8: Add HandoffActions test

**Files:**
- Create: `src/renderer/src/components/HandoffActions.test.tsx`

- [ ] **Step 1: Write test file**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { HandoffActions } from './HandoffActions';

import type { Finding, TaskRun } from '@shared/types';

const mockContinueTask = vi.fn();

vi.mock('../store', () => ({
  useWorkbenchStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      continueTask: mockContinueTask,
      isBusy: false
    })
}));

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    severity: 'high',
    title: 'Test finding',
    body: 'Something is wrong',
    sourceAgent: 'codex',
    ...overrides
  };
}

function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'task-1234-5678',
    projectId: 'proj-1',
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc123',
    worktreePath: '/tmp/worktree',
    stage: 'review',
    brief: 'Test task',
    assignedAgents: ['claude', 'codex'],
    approvalState: 'pending',
    branchName: 'triad/test',
    findings: [],
    artifacts: [],
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('HandoffActions', () => {
  it('renders three enabled buttons that call continueTask with correct options', () => {
    const findings = [makeFinding()];
    const task = makeTask({ findings });

    render(<HandoffActions task={task} findings={findings} />);

    const claudeBtn = screen.getByText('Send to Claude for fix');
    const codexBtn = screen.getByText('Ask Codex to verify');
    const geminiBtn = screen.getByText('Ask Gemini for review');

    expect(claudeBtn).not.toBeDisabled();
    expect(codexBtn).not.toBeDisabled();
    expect(geminiBtn).not.toBeDisabled();

    fireEvent.click(claudeBtn);
    expect(mockContinueTask).toHaveBeenCalledWith('task-1234-5678', {
      mode: 'single-step',
      stage: 'fix',
      agentId: 'claude',
      role: 'coder',
      prompt: expect.stringContaining('Test finding')
    });

    fireEvent.click(codexBtn);
    expect(mockContinueTask).toHaveBeenCalledWith('task-1234-5678', {
      mode: 'single-step',
      stage: 'verify',
      agentId: 'codex',
      role: 'tester'
    });

    fireEvent.click(geminiBtn);
    expect(mockContinueTask).toHaveBeenCalledWith('task-1234-5678', {
      mode: 'single-step',
      stage: 'review',
      agentId: 'gemini',
      role: 'architect'
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd "D:\ccgl room" && npx vitest run src/renderer/src/components/HandoffActions.test.tsx`
Expected: 1 test passing

- [ ] **Step 3: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/HandoffActions.test.tsx
git commit -m "test(handoff): verify enabled buttons call continueTask correctly"
```

---

### Task 9: Update FindingsPanel test

**Files:**
- Modify: `src/renderer/src/components/FindingsPanel.test.tsx`

The existing test checks that handoff buttons are disabled. Update it to verify they are now enabled.

- [ ] **Step 1: Read the existing test**

Read `src/renderer/src/components/FindingsPanel.test.tsx` to understand the current disabled-button assertion.

- [ ] **Step 2: Update test assertion**

Change any assertion like `expect(button).toBeDisabled()` to `expect(button).not.toBeDisabled()` or remove the disabled assertion if the test is specifically about FindingsPanel rendering (not HandoffActions).

- [ ] **Step 3: Run all tests**

Run: `cd "D:\ccgl room" && npx vitest run`
Expected: All tests pass (12+ tests, 7+ files)

- [ ] **Step 4: Run build**

Run: `cd "D:\ccgl room" && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/FindingsPanel.test.tsx
git commit -m "test(findings): update test for enabled handoff buttons"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full validation suite**

```bash
cd "D:\ccgl room"
npm run typecheck
npm test
npm run build
```

Expected: All three pass.

- [ ] **Step 2: Verify git log**

```bash
cd "D:\ccgl room" && git log --oneline -10
```

Expected: 8-9 new commits for continueTask feature.
