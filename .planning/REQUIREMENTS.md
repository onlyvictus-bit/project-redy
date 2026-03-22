# Triad Workbench Requirements

## Functional Requirements

### Agent Orchestration
- Support 4 agents: Claude Code, Codex CLI, Gemini CLI, Ollama
- Each agent has configurable roles: coder, reviewer, tester, architect, planner, monitor, compare-only, developer, off
- CLI agents execute via subprocess (node-pty for interactive, ProcessRunner for batch)
- Ollama uses local HTTP API at localhost:11434

### Workflow Engine
- Built-in workflow templates:
  - `code-review-fix-verify`: Claude codes → Codex reviews → Claude fixes → Codex verifies
  - `code-gemini-compare-codex-review`: Claude codes → Gemini reviews → Claude fixes → Codex verifies
  - `architecture-compare`: All 4 agents give architecture advice
  - `away-monitor`: Ollama monitors for stalls/failures
- Task stages: brief → code → review → findings → fix → verify → promote → done | error
- Each step produces an ArtifactBundle with prompt, stdout, stderr, findings, patch, commands

### Workspace Safety
- Every task gets its own git worktree
- Main checkout is always protected
- Promotion is explicit (apply-to-main, keep-worktree, open-task-branch)
- Reviewer/tester roles enforce read-only by diffing before/after

### Persistence
- SQLite with 4 tables: projects, agent_profiles, task_runs, artifacts
- Per-project archive in `.triad-workbench/` with JSON, logs, diffs, transcripts

### Review Center (Phase 2)
- Task detail panel with step timeline and approval controls
- Artifact viewer with 6 tabs: Overview, Prompt, Patch, Logs, Findings, Commands
- Diff viewer with line-level add/remove highlighting
- Findings panel with severity badges
- Handoff actions (disabled until task-continuation backend exists)

### Onboarding (Phase 3 — planned)
- Per-agent status states: missing, installed, needs-login, ready, running, error
- Deep auth verification per agent
- Environment-aware runner checks (Windows vs WSL)
- Ollama model discovery

### Archive Browser (Phase 4 — DONE)
- [x] Browse task history inside the app (ArchiveBrowser.tsx, 04-03)
- [x] Read transcripts, prompts, artifacts, event timelines (4-tab detail pane, 04-03)
- [x] Filter by agent, workflow, date, severity (client-side filter bar, 04-03)

### Custom Workflow Builder (Phase 5 — planned)
- User-defined agent chains
- Per-step agent, role, prompt template, approval gate toggle

### UX Polish (Phase 6 — planned)
- Dark theme, agent identity colors, dense terminal visuals
- Better empty states, smoother task selection

## Non-Functional Requirements

- Local-first: no cloud dependency except agent auth
- CLI-native: prefer subprocess execution over browser automation
- Prompt contract: natural language + `<triad-json>` structured payload
- Archive durability: all agent output preserved for inspection
