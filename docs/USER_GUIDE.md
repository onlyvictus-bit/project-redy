# Triad Workbench User Guide

This guide explains what Triad Workbench is, how the UI works, and how to use it with both existing and new projects.

## What It Is

Triad Workbench is a local Electron desktop app for orchestrating multiple coding agents inside a controlled workflow.

Supported agents:

- Claude Code
- Codex CLI
- Gemini CLI
- Ollama

The main design goal is safety:

- create a worktree for each task
- let agents work there
- review the result
- promote only when you approve

## Main UI Areas

### Top Bar

- `Open project`
  - choose a local folder
- `Runner`
  - selects `Auto`, `Windows`, or `WSL`
- `Probe agents`
  - refreshes agent status and auth state

### Left Rail

- workflow picker
- task list
- task cancel buttons for active steps

### Center Grid

Four agent cards:

- Claude
- Codex
- Gemini
- Ollama

Each card can show:

- current status
- role or personality
- connect action
- terminal
- latest artifact summary

### Right Rail

- findings
- Ollama model selector
- project archive controls
- notifications

### Bottom Composer

- task brief
- currently selected workflow
- `Run workflow`

## Agent Status Meanings

- `Not installed`
  - tool not found on the selected runner
- `Not connected`
  - tool exists but is not ready to use
- `Needs login`
  - install is present, auth still needed
- `Ready`
  - available for workflows
- `Running`
  - actively doing work
- `Error`
  - probe or runtime problem happened

## Workflows

### Code -> Review -> Fix -> Verify

Use this first.

- Claude writes
- Codex reviews
- Claude fixes
- Codex verifies

### Code -> Gemini Compare -> Codex Review

Use when you want another opinion before the final review.

### Architecture Compare

Use before coding when the design is unclear.

### Away Monitor

Uses Ollama as a local observer/monitor workflow.

## Using An Existing Project

1. Open a git repository
2. Set the correct runner
3. Probe agents
4. Connect Claude and Codex first
5. Pick a workflow
6. Write a narrow task brief
7. Run workflow
8. Review findings and patch
9. Promote or keep the worktree

## Starting A New Project From Scratch

Create a real git repo first:

```powershell
mkdir my-small-app
cd my-small-app
git init
npm init -y
git add .
git commit -m "Initial scaffold"
```

Then open it in Triad and use a small first task.

Example:

```text
Create a TypeScript CLI todo app with add, list, and done commands.
Store data in a local JSON file.
Add Vitest tests for the main flows.
Keep the implementation simple and readable.
```

## Promotion Actions

### Apply to main

Promotes the task result back to the main checkout.

### Keep worktree

Keeps the task worktree for later manual work.

### Open task branch

Opens the task worktree folder directly.

## Archive

Each project can save runtime evidence into:

```text
<project>/.triad-workbench
```

That can include:

- snapshots
- artifacts
- prompts
- stdout / stderr logs
- diffs
- terminal transcripts
- events

## Best Practices

- keep tasks small
- use Claude + Codex first
- use Gemini for compare or architecture
- use Ollama as local support
- keep your main checkout clean
- always inspect findings before applying
