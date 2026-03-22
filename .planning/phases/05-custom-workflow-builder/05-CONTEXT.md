# Phase 5: Custom Workflow Builder - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Roadmap + project context

<domain>
## Phase Boundary

Phase 5 adds a UI for building and saving custom multi-step workflows. Currently, workflows are hardcoded in `src/shared/workflows.ts` as `WORKFLOW_DEFINITIONS[]`. Phase 5 lets users create their own workflows through a visual editor — defining steps, assigning agents + roles per step, writing prompt templates per step, toggling approval gates, and saving named workflows for reuse.

The new custom workflows must work with the existing `WorkflowEngine` and `AppController` infrastructure — they produce the same `WorkflowDefinition` shape the engine already understands.

</domain>

<decisions>
## Implementation Decisions

### Locked Requirements (from ROADMAP)
- **Workflow step editor** — UI to add, reorder, and remove steps in a workflow
- **Agent + role selector per step** — each step assigns which agent runs and in which role (coder/reviewer/etc.)
- **Prompt template per step** — each step has an editable prompt that gets interpolated at runtime
- **Approval gate toggle per step** — each step can require user approval before the next step runs
- **Save named workflows** — completed workflow definitions are saved and appear in the workflow selector alongside the built-in ones

### Storage
- Custom workflows stored in SQLite (same `triad-workbench.db`) via a new `custom_workflows` table
- Loaded and merged with `WORKFLOW_DEFINITIONS` at startup — user sees both built-ins and custom ones in the selector

### UI Placement
- Workflow builder accessed via a "New workflow" / "+" button next to the workflow selector dropdown
- Builder opens as a modal or dedicated panel (Claude's discretion)
- Built-in workflows are read-only; custom ones show an edit/delete button

### Claude's Discretion
- Whether builder is modal overlay or a dedicated right-panel view
- Step reordering UX (drag-and-drop vs up/down buttons — prefer up/down buttons, simpler)
- Exact form field layout within each step card
- Whether prompt template uses a simple textarea or a richer editor (prefer textarea)
- Validation rules for workflow names (non-empty, unique)

</decisions>

<specifics>
## Specific Ideas

### Data Shape
Custom workflows must satisfy the existing `WorkflowDefinition` type in `src/shared/types.ts`:
```ts
interface WorkflowDefinition {
  id: string;        // generated UUID
  label: string;     // user-provided name
  description: string;
  mode: 'orchestrate' | 'chain' | 'parallel' | 'direct';
  stages: string[];  // derived from steps
}
```
Steps need additional metadata beyond `WorkflowDefinition` — a `CustomWorkflowStep` type:
```ts
interface CustomWorkflowStep {
  id: string;
  agentId: AgentId;
  role: AgentRole;
  promptTemplate: string;
  requiresApproval: boolean;
}
```
And a `CustomWorkflow` type that extends the definition with steps.

### IPC Channels Needed
- `listCustomWorkflows` → returns `CustomWorkflow[]`
- `saveCustomWorkflow(workflow)` → upsert, returns saved workflow
- `deleteCustomWorkflow(id)` → removes from DB

### SQLite Table
```sql
CREATE TABLE custom_workflows (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL,
  steps_json TEXT NOT NULL,  -- JSON array of CustomWorkflowStep
  created_at TEXT,
  updated_at TEXT
)
```

### Integration with WorkflowEngine
When user launches a custom workflow, `AppController.startTask()` receives the `WorkflowDefinition`. The engine uses `stages` from the definition. Custom workflows need to inject their step prompt templates into the engine — the engine currently uses `src/main/utils/prompts.ts` for prompt generation; custom prompts override that per-step.

</specifics>

<deferred>
## Deferred Ideas

- Sharing/exporting custom workflows to JSON file — future
- Workflow versioning/history — future
- Visual workflow diagram view — out of scope for v0.1
- Drag-and-drop step reordering — prefer simpler up/down buttons for now

</deferred>

---

*Phase: 05-custom-workflow-builder*
*Context gathered: 2026-03-22 via roadmap + project context*
