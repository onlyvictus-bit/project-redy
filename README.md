# Triad Workbench

CLI-native multi-agent coding workbench for:

- Claude Code
- Codex CLI
- Gemini CLI
- Ollama

## What It Does

Triad Workbench is a local Electron desktop app that orchestrates installed coding agents through their own CLIs or local runtime. It is designed around an isolated git-worktree workflow:

- Claude as the main coder
- Codex as reviewer/tester
- Gemini as an optional free reviewer, architect, or coder
- Ollama as a local monitor, tester, architect, developer, or off

For a full AI handoff and implementation map, read [TRIAD_WORKBENCH_AI_CONTEXT.md](./TRIAD_WORKBENCH_AI_CONTEXT.md).

## Current v0.1 Scope

- Electron + React + Vite desktop shell
- Agent grid with live terminal support for CLI agents
- Agent probing and onboarding states
- Built-in workflow templates
- Isolated worktree creation per task run
- SQLite persistence for projects, agent profiles, tasks, and artifacts
- Per-project `.triad-workbench` archive folder for snapshots, prompts, stdout/stderr logs, diffs, task JSON, and terminal transcripts
- Ollama lifecycle manager with reuse and shutdown support
- Promotion flow from task worktree back to the main checkout

## Scripts

- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Notes

- The app expects external tools like `claude`, `codex`, `gemini`, and optionally `ollama` to be installed on the machine or available in the selected runner environment.
- The default UX is `WSL-first` in concept, but the current auto runner fallback is conservative and uses Windows unless you explicitly switch the project to WSL.
- Ollama is reused if a daemon is already running. If the app starts Ollama itself, it can also stop it again to free VRAM.
- Each selected project can auto-save AI activity into `<project>/.triad-workbench`, and the UI includes `Save now` plus `Open folder` actions for that archive.

## Planning

- `.planning/` is the canonical Claude GSD planning directory (tracked in git)
- `.triad-workbench/` is per-project app archive storage (runtime, not planning)
- `docs/superpowers/plans/` is a human-readable mirror of `.planning/` phase docs

Scripts:
- `npm run planning:check` — verify required `.planning/` files exist
- `npm run planning:sync` — regenerate mirrored phase docs in `docs/superpowers/plans/`

If GSD reports `[E001] .planning/ directory not found`, run `npm run planning:check` to verify the bootstrap.

## AI Docs

- [TRIAD_WORKBENCH_AI_CONTEXT.md](./TRIAD_WORKBENCH_AI_CONTEXT.md)
- [TRIAD_WORKBENCH_BUILD_GUIDE.md](./TRIAD_WORKBENCH_BUILD_GUIDE.md)
- [TRIAD_WORKBENCH_SOURCE_REFERENCE.md](./TRIAD_WORKBENCH_SOURCE_REFERENCE.md)
