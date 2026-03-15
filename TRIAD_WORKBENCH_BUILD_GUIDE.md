# Triad Workbench Build Guide

This document is the execution guide for any AI or human contributor who needs to keep building Triad Workbench.

It focuses on three things:

- build roadmap
- frontend UI plan
- agent interaction protocol

Read this after:

1. `README.md`
2. `TRIAD_WORKBENCH_AI_CONTEXT.md`

## Product Intent

Triad Workbench is meant to be a local mission-control app for multiple coding agents working on the same project safely.

The app should make this loop easy:

1. Claude writes code in an isolated worktree
2. Codex reviews and tests it
3. Claude fixes findings
4. Codex verifies again
5. User promotes the result

Gemini and Ollama extend that loop:

- Gemini adds low-cost architecture or review support
- Ollama adds local monitoring, architecture thinking, or extra evaluation when the user wants a local model

## Build Roadmap

### Phase 1: Foundation

Status: mostly done

Delivered:

- Electron app shell
- React renderer
- shared IPC contract
- CLI connectors
- workflow engine
- worktree safety model
- SQLite persistence
- per-project archive folder

Files:

- `src/main/index.ts`
- `src/main/app-controller.ts`
- `src/shared/types.ts`
- `src/shared/ipc.ts`
- `src/main/services/workflow-engine.ts`
- `src/main/services/workspace-manager.ts`
- `src/main/services/persistence.ts`
- `src/main/services/project-archive.ts`

### Phase 2: Review Center

Status: done

Goal:

Turn the current dashboard into a true code-review workstation.

Needs:

- selected task detail view
- artifact timeline
- patch inspection panel
- rich findings list
- clear approval controls
- promote action center
- quick handoff actions between agents

Current state:

- selected task detail view exists
- artifact timeline exists
- patch inspection view exists
- findings panel exists
- approval controls exist
- misleading handoff buttons are intentionally disabled until a real continue-task backend exists
- renderer component coverage exists for the review-center surface

Recommended implementation:

- split right rail into:
  - active task summary
  - findings
  - artifacts
  - approvals
- add a central detail pane for the currently selected artifact
- support toggling between:
  - summary
  - prompt
  - stdout
  - stderr
  - patch
  - structured findings

### Phase 3: Onboarding Hardening

Status: next major build target

Goal:

Make first-run setup reliable even when one or more agents are missing or not logged in.

Needs:

- better install detection
- better auth verification
- friendlier status messages
- environment-aware runner checks for Windows vs WSL
- Gemini auth mode guidance
- Ollama model discovery

Desired states per agent:

- missing
- installed but not ready
- needs login
- ready
- running
- error

### Phase 4: Archive Browser

Status: pending

Goal:

Make `.triad-workbench` readable inside the app instead of only on disk.

Needs:

- task history explorer
- transcript reader
- prompt viewer
- artifact viewer
- event timeline
- filter by agent, workflow, date, or severity

### Phase 5: Custom Workflow Builder

Status: pending

Goal:

Let users define chains beyond the built-in templates.

Examples:

- `Claude -> Codex -> Claude -> Codex`
- `Gemini architect -> Claude coder -> Codex verify`
- `Claude -> Gemini compare -> Codex final review`

Needs:

- workflow step editor
- agent selector
- role selector
- prompt template per step
- approval gate toggle per step
- save named workflow

### Phase 6: Final UX Polish

Status: pending

Goal:

Make the UI match the intended mission-control visual language.

Needs:

- stronger dark theme
- richer panel styling
- clearer agent identity colors
- denser terminal visuals
- better empty states
- smoother task selection flow

## Frontend UI Plan

### Current Layout

Current structure in `src/renderer/src/App.tsx`:

- top bar
- left rail
- center agent grid
- right rail
- bottom composer

This is the correct overall layout and should be preserved.

### Target Layout

#### Top Bar

Should show:

- project name
- current branch
- runner mode
- quick agent health
- workflow status
- quick archive status

#### Left Rail

Should contain:

- active workflows
- task queue
- task filters
- workspace/project summary

Future additions:

- saved workflow chains
- archive history shortcuts

#### Center Area

Should become a two-layer workspace:

1. agent grid
2. selected task or artifact detail panel

Suggested behavior:

- clicking a task in the left rail changes the right-side detail context
- clicking an artifact inside a task shows that artifact’s details
- clicking a finding focuses the related artifact and patch

#### Right Rail

Should be the review rail.

Recommended cards:

- active task summary
- findings
- approval center
- handoff suggestions
- archive controls

#### Bottom Composer

Should remain the main entry point for:

- task brief
- workflow selection
- direct mode
- parallel mode
- future chain mode

Future additions:

- attach file paths
- quick prompt presets
- keyboard shortcut hints

### Artifact Detail View

This is the most important missing UI.

Each artifact should expose:

- source agent
- role
- stage
- created time
- summary
- prompt
- final message
- stdout
- stderr
- findings
- patch
- command runs

Recommended tabs:

- `Overview`
- `Prompt`
- `Patch`
- `Logs`
- `Findings`
- `Commands`

### Diff And Patch Plan

The app does not need a full external Git client, but it does need a usable patch viewer.

Recommended first version:

- monospace patch viewer with add/remove highlighting
- line wrapping off by default
- copy diff button
- open worktree button

Recommended later version:

- Monaco diff view
- side-by-side patch mode
- inline file navigation

## Agent Interaction Protocol

This is the intended behavior between Claude, Codex, Gemini, and Ollama.

### Core Roles

#### Claude

Default role:

- coder

Primary responsibilities:

- implement requested code changes
- fix review findings
- work only inside the task worktree

Claude should receive:

- task brief
- current findings
- relevant prior artifact summary

Claude should return:

- concise explanation
- structured `<triad-json>` payload
- code changes in the worktree

#### Codex

Default role:

- reviewer or tester

Primary responsibilities:

- inspect diffs
- run focused validation
- surface bugs, regressions, or missing tests

Codex should receive:

- task brief
- current diff
- verification context

Codex should return:

- findings
- summary
- recommended next action

Codex should not be treated as the default writer during orchestrated review stages.

#### Gemini

Default role:

- architect or optional reviewer

Primary responsibilities:

- provide alternative implementation directions
- critique design choices
- give a second review pass when wanted

Gemini is best used for:

- architecture compare workflows
- low-cost second opinion reviews
- design tradeoff analysis

#### Ollama

Default role:

- off

Optional roles:

- monitor
- tester
- developer
- architect

Primary responsibilities:

- local-only support
- monitoring stalls or failures
- offering architecture analysis
- performing optional local reasoning passes

Ollama lifecycle rules:

- if external daemon exists, reuse it
- if app starts it, app may shut it down later
- if user switches it off, free resources when possible

### Standard Workflow Protocol

#### Code -> Review -> Fix -> Verify

1. Claude receives coding brief
2. Claude edits inside worktree
3. App captures diff
4. Codex reviews diff and optionally runs checks
5. Findings are merged into the task
6. Claude receives findings-focused fix prompt
7. Codex verifies resulting diff
8. User reviews and promotes

#### Code -> Gemini Compare -> Codex Review

1. Claude codes
2. Gemini critiques or compares direction
3. Claude may fix if findings exist
4. Codex performs the final review

#### Architecture Compare

1. Claude, Codex, Gemini, and Ollama each receive an architecture prompt
2. Their outputs are stored as artifacts
3. User compares summaries and chooses a direction

#### Away Monitor

1. Ollama receives a monitoring prompt
2. It should not apply changes
3. It should only report risks, stalls, or when another agent should intervene

### Prompt Contract

Prompt builders live in:

- `src/main/utils/prompts.ts`

Current contract:

- natural-language answer first
- machine-readable payload inside `<triad-json>...</triad-json>`

The JSON payload should contain:

- `summary`
- `findings`
- `notes`
- `recommendedRole`

This contract is important because the workflow engine depends on normalized parsing rather than raw vendor-specific output.

### Handoff Rules

The app should eventually make handoffs explicit.

Recommended handoff actions:

- `Send findings to Claude`
- `Ask Codex to verify latest Claude fix`
- `Ask Gemini for architecture alternative`
- `Ask Ollama to monitor this task`

Future rule:

- handoffs should pass structured context, not entire raw transcripts unless requested

### Safety Rules

Always preserve these invariants:

- main checkout is protected
- orchestrated work happens in task worktrees
- promotion is explicit
- archive records what the agents did
- reviewer roles should be treated as read-only by policy even if the underlying CLI is capable of editing

## Planning Conventions

- `.planning/` is the canonical Claude GSD planning directory (tracked in git)
- `.triad-workbench/` is per-project app archive storage (runtime, unrelated to GSD planning)
- `docs/superpowers/plans/` is a human-readable mirror of `.planning/` phase docs, plus legacy manual files

Scripts:
- `npm run planning:check` — verify required `.planning/` files exist
- `npm run planning:sync` — regenerate mirrored phase docs in `docs/superpowers/plans/`

If GSD reports `[E001] .planning/ directory not found`, run `npm run planning:check` to verify the bootstrap is intact.

## Recommended Order For Future AI Contributors

If an AI is continuing this project, it should usually follow this order:

1. read `README.md`
2. read `TRIAD_WORKBENCH_AI_CONTEXT.md`
3. read this file
4. inspect `src/shared/types.ts`
5. inspect `src/main/app-controller.ts`
6. inspect `src/main/services/workflow-engine.ts`
7. inspect `src/renderer/src/App.tsx`

Then choose one focused task:

- review center
- onboarding hardening
- archive browser
- custom workflow builder
- visual polish
