# Triad Workbench AI Context

This document is the handoff file for any AI agent that needs to understand, continue, or review the project quickly.

The source code is the canonical implementation. This file is the high-signal map of how the system works, why it exists, what is already implemented, and what still needs to be built.

## Product Goal

Triad Workbench is a local Electron desktop app for orchestrating multiple coding agents in one workspace without relying on browser tabs.

Primary roles:

- Claude Code: main coder
- Codex CLI: reviewer and tester
- Gemini CLI: optional reviewer, architect, or coder
- Ollama: optional local monitor, tester, developer, architect, or off

Core promise:

- local-first
- CLI-native orchestration
- isolated git worktrees for safety
- explicit promotion back to the main checkout
- persistent project archive of AI output

## Current Status

Implemented:

- Electron + React + Vite shell
- agent grid UI with interactive terminals for CLI agents
- startup probing for Claude, Codex, Gemini, and Ollama
- workflow engine for built-in multi-agent flows
- task-continuation backend (`continueTask`) with resume and single-step dispatch
- isolated git worktree creation per task run
- task promotion back to main checkout
- SQLite persistence
- per-project archive folder inside `.triad-workbench`
- Ollama lifecycle reuse and shutdown behavior
- review-center renderer with task detail, artifact viewer, diff viewer, and findings panel
- review-center handoff buttons wired through `continueTask`
- renderer component tests for the review-center surface and agent panel status display
- deep auth probing per connector: Claude (`auth status`), Codex (native-login exec or `OPENAI_API_KEY`), Gemini (native-login ping or `GOOGLE_API_KEY`), Ollama (HTTP `/api/tags` with model discovery)
- `OllamaStatus.availableModels` carries discovered model list to the renderer
- internal execution-only stage params narrowed to `ResumableStage`; single-step switch exhaustive over `code | review | fix | verify`
- `ProcessRunner.checkWslAvailable()` for WSL environment detection

Partially implemented:

- approval and review UI is functional but still basic
Not yet fully implemented:

- custom workflow builder
- archive browser inside the app
- more polished dashboard styling to match the mockup closely

## Architecture Summary

### Main Process

The Electron main process owns orchestration, filesystem operations, subprocess execution, persistence, and IPC.

Main entry:

- `src/main/index.ts`

Central coordinator:

- `src/main/app-controller.ts`

Main responsibilities:

- bootstrap persisted state
- probe agent connectors
- select and inspect project folders
- create and track interactive terminals
- start workflows
- promote finished task diffs
- manage Ollama state
- save project archive snapshots and logs

### Renderer Process

The React renderer is the operator dashboard.

Main renderer files:

- `src/renderer/src/App.tsx`
- `src/renderer/src/store.ts`
- `src/renderer/src/styles.css`

Responsibilities:

- render agent panels
- show tasks, findings, notifications, and archive controls
- allow workflow execution
- display terminal streams from the main process
- allow direct terminal input for interactive CLI sessions

### Shared Contracts

The shared TypeScript definitions are the main contract between main and renderer.

Key files:

- `src/shared/types.ts`
- `src/shared/ipc.ts`
- `src/shared/workflows.ts`

Important types:

- `AgentProfile`
- `TaskRun`
- `ArtifactBundle`
- `Finding`
- `ProjectRef`
- `WorkbenchSnapshot`

## Connector System

The connector abstraction is defined in:

- `src/main/connectors/base.ts`

Concrete connectors:

- `src/main/connectors/claude-connector.ts`
- `src/main/connectors/codex-connector.ts`
- `src/main/connectors/gemini-connector.ts`
- `src/main/connectors/ollama-connector.ts`

Behavior:

- CLI agents support `probe`, `runJob`, and interactive terminal launch specs
- Ollama uses the local HTTP API instead of a PTY-based CLI flow in orchestrated mode

Connector outputs are normalized into `ArtifactBundle`, which includes:

- prompt
- role
- stdout
- stderr
- summary
- final message
- patch
- findings
- command runs

## Workflow Engine

Workflow logic lives in:

- `src/main/services/workflow-engine.ts`

Implemented workflows:

- `code-review-fix-verify`
- `code-gemini-compare-codex-review`
- `architecture-compare`
- `away-monitor`

Canonical task path:

- `brief -> code -> review -> findings -> fix -> verify -> promote`

Each workflow step:

- creates a `TaskStepRecord`
- runs one connector job
- captures an `ArtifactBundle`
- merges findings back into the task
- updates task state and persistence

## Workspace Safety Model

Workspace logic lives in:

- `src/main/services/workspace-manager.ts`

Rules:

- every workflow task gets its own git worktree
- agent changes stay inside the worktree
- promotion to the main checkout is explicit
- `apply-to-main` is blocked if the main checkout has uncommitted changes

Current archive path per project:

- `<project>/.triad-workbench`

## Project Archive System

Archive logic lives in:

- `src/main/services/project-archive.ts`

What it saves:

- `project.json`
- latest full snapshot
- agent state snapshot
- notifications snapshot
- task JSON
- per-artifact JSON
- prompts
- stdout logs
- stderr logs
- patch diffs
- terminal sessions
- terminal transcript log
- terminal transcript JSONL
- events JSONL

Archive folder structure:

```text
.triad-workbench/
  project.json
  state/
    latest-snapshot.json
    agents.json
    notifications.json
  tasks/
    <task-id>/
      task.json
      artifacts/
        <artifact-id>.json
        <artifact-id>.prompt.txt
        <artifact-id>.stdout.log
        <artifact-id>.stderr.log
        <artifact-id>.patch.diff
  terminals/
    <session-id>/
      session.json
      transcript.log
      transcript.jsonl
  events/
    events.jsonl
```

## Persistence

SQLite persistence lives in:

- `src/main/services/persistence.ts`

Current persisted entities:

- latest project
- agent profiles
- tasks
- artifacts

The project record also stores:

- runner preference
- git metadata
- archive path
- archive enabled state

## Terminal System

Interactive PTY management lives in:

- `src/main/services/terminal-manager.ts`
- `src/main/services/process-runner.ts`

Renderer display uses:

- `@xterm/xterm`
- `@xterm/addon-fit`

Terminal flow:

- main process spawns PTY
- main emits terminal data over IPC
- renderer stores terminal buffer in Zustand
- `App.tsx` renders the buffer in an xterm canvas
- user input is sent back to the PTY through IPC

The archive layer also records terminal output and user input when project archive is enabled.

## Renderer Layout

Current UI structure:

- top bar: project context, runner selector, probe action
- left rail: workflow list and task list
- center grid: one panel per agent
- right rail: findings, Ollama controls, project archive controls, notifications
- bottom dock: workflow composer

Design preview assets:

- `design-preview/index.html`
- `design-preview/styles.css`

Preview screenshot:

- `triad-workbench-preview.png`

## How To Run

Development:

- `npm install`
- `npm run dev`

Validation:

- `npm run typecheck`
- `npm test`
- `npm run build`

External tools expected on the machine or selected runner:

- `claude`
- `codex`
- `gemini`
- optionally `ollama`

## Important Implementation Invariants

- Do not let orchestrated agents write directly into the main checkout.
- Keep worktree promotion explicit.
- Preserve local-first behavior.
- Prefer CLI-native agent execution over browser automation.
- Treat the project archive as durable evidence of what the agents did.
- Use shared types as the contract between main and renderer.

## Planning Directories

- `.planning/` — canonical Claude GSD planning directory (tracked in git). Contains `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, and phase subdirectories.
- `.triad-workbench/` — per-project app archive storage (runtime data, not planning). Contains task JSON, artifact logs, terminal transcripts, event JSONL.
- `docs/superpowers/plans/` — human-readable mirror of `.planning/` phase docs, plus legacy manual plan files.

If GSD reports `[E001] .planning/ directory not found`, run `npm run planning:check`.

## Best Files To Read First

If another AI needs to continue building the project, read these first:

1. `README.md`
2. `TRIAD_WORKBENCH_AI_CONTEXT.md`
3. `src/shared/types.ts`
4. `src/main/app-controller.ts`
5. `src/main/services/workflow-engine.ts`
6. `src/main/services/workspace-manager.ts`
7. `src/main/services/project-archive.ts`
8. `src/renderer/src/App.tsx`
9. `src/renderer/src/store.ts`

## Recommended Next Work

Highest-value next block:

1. Add an archive browser inside the app (Phase 4)
2. Add a custom workflow builder (Phase 5)
3. Polish the dashboard to match the visual mockup more closely (Phase 6)

## Current Reality Check

This project is already a real working scaffold, not just a plan document.

It currently supports:

- running the desktop app
- selecting a project
- probing agents
- starting built-in workflows
- continuing existing tasks through `continueTask` handoffs
- using interactive terminals
- saving project archive data

It is not yet finished as a full production-grade workbench, but the architecture is already in place and the next steps are clear.
