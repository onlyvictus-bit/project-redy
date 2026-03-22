# Triad Workbench Roadmap

## Milestone 1: v0.1 — Foundation to Review Center

### Phase 1: Foundation ✅
- Electron + React + Vite shell
- Agent grid with live terminal support
- CLI connectors (Claude, Codex, Gemini, Ollama)
- Workflow engine with 4 built-in templates
- Isolated git worktree creation per task
- SQLite persistence
- Per-project `.triad-workbench` archive
- Ollama lifecycle manager
- Task promotion flow

### Phase 2: Review Center ✅
- Zustand selection state (selectedTaskId, selectedArtifactId)
- 8 extracted/new renderer components:
  - TerminalPane, AgentPanel, TaskCard
  - DiffViewer, ArtifactViewer, FindingsPanel, HandoffActions, TaskDetailPanel
- App.tsx restructured from 382 → 203 lines
- 4 new renderer component tests (11 total)
- Handoff buttons intentionally disabled until task-continuation backend exists

### Phase 3: Onboarding Hardening 🔜
- Better install detection per agent
- Deep auth verification
- Friendlier status messages
- Environment-aware runner checks (Windows vs WSL)
- Gemini auth mode guidance
- Ollama model discovery
- Per-agent states: missing → installed → needs-login → ready → running → error

### Phase 4: Archive Browser + Full-Screen Terminal ✅
**Goal:** Surface task history inside the app and make terminals comfortable to work with full-screen.
**Plans:** 3/3 complete

Plans:
- [x] 04-01-PLAN.md — Full-screen terminal overlay (expand button, CSS toggle, Zustand state)
- [x] 04-02-PLAN.md — Archive IPC plumbing (4-file contract: ipc.ts → preload → main → controller)
- [x] 04-03-PLAN.md — ArchiveBrowser component with filters, transcript/prompt/findings/timeline tabs

### Phase 5: Custom Workflow Builder
**Goal:** Users create multi-step workflows via a visual editor, save them to SQLite, and run them alongside the 4 built-in workflows.
**Plans:** 3 plans

Plans:
- [x] 05-01-PLAN.md — Types + IPC plumbing + SQLite (foundation: new types, 3 IPC channels, custom_workflows table, CRUD on PersistenceService, stubs in dev-mock/test-setup)
- [ ] 05-02-PLAN.md — WorkflowEngine + AppController (engine custom execution path, resolveAgents, runCustomWorkflow, approval gate halt/resume, AppController CRUD methods + snapshot hydration)
- [ ] 05-03-PLAN.md — UI layer (WorkflowBuilder modal, store actions, App.tsx merged list + +/edit/delete/canRun/run-with-steps)

### Phase 6: Final UX Polish
- Dark theme
- Agent identity colors
- Dense terminal visuals
- Better empty states
- Smoother task selection flow
