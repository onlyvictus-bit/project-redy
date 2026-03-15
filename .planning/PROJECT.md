# Triad Workbench

## What This Is

A local Electron desktop app that orchestrates multiple AI coding agents in a unified interface with isolated git worktrees.

## Core Value

Safe, local-first multi-agent coding orchestration: Claude writes → Codex reviews → Claude fixes → Codex verifies → user promotes. No cloud dependency beyond agent auth.

## Requirements

See `REQUIREMENTS.md` for full functional and non-functional requirements.

## Product Intent

Triad Workbench is a local Electron desktop app that orchestrates multiple AI coding agents (Claude Code, Codex CLI, Gemini CLI, Ollama) in a unified interface. It is designed around an isolated git-worktree workflow where Claude writes code, Codex reviews/tests it, Claude fixes findings, Codex verifies, and the user explicitly promotes the result.

## Core Promise

- Local-first, CLI-native orchestration
- Isolated git worktrees per task for safety
- Explicit promotion back to the main checkout
- Persistent per-project archive of all AI output
- Role-based agent assignment (coder, reviewer, tester, architect, planner, monitor)

## Agent Roles

- **Claude Code**: Primary coder. Implements requested changes in task worktrees.
- **Codex CLI**: Primary reviewer/tester. Inspects diffs, runs checks, surfaces findings.
- **Gemini CLI**: Optional architect or second reviewer. Low-cost design critique.
- **Ollama**: Optional local model. Monitoring, architecture analysis, or development.

## Tech Stack

- Electron 37 + React 19 + Vite (via electron-vite)
- TypeScript 5.9
- Zustand 5 for client state
- better-sqlite3 for persistence (WAL mode)
- node-pty + xterm.js for interactive agent terminals
- Git worktrees for task isolation

## Key Directories

- `src/main/` — Electron main process (orchestration, connectors, services)
- `src/renderer/` — React renderer (dashboard UI)
- `src/shared/` — Shared types and IPC contracts
- `src/preload/` — contextBridge for IPC
- `.triad-workbench/` — Per-project runtime archive (not planning)
- `.planning/` — Canonical Claude GSD planning directory
- `docs/superpowers/plans/` — Human-readable mirror of planning docs
