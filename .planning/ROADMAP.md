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

### Phase 4: Archive Browser
- Task history explorer inside the app
- Transcript reader, prompt viewer, artifact viewer
- Event timeline
- Filter by agent, workflow, date, severity

### Phase 5: Custom Workflow Builder
- Workflow step editor
- Agent + role selector per step
- Prompt template per step
- Approval gate toggle per step
- Save named workflows

### Phase 6: Final UX Polish
- Dark theme
- Agent identity colors
- Dense terminal visuals
- Better empty states
- Smoother task selection flow
