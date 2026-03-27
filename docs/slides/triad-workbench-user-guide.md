# Triad Workbench User Guide

This document is the content source for the onboarding deck:

- `docs/slides/triad-workbench-user-guide.pptx`

It explains:

- what Triad Workbench is
- how the main UI is organized
- what each workflow does
- how to use it for an existing project
- how to start from scratch on a new project
- how review, promotion, and archive features work
- common limitations and best practices

## Slide 1 — Title

- CCGL / Triad Workbench
- Multi-agent coding workbench guide
- Understand the UI, workflows, and safe project flow

## Slide 2 — What It Is

- Local Electron desktop app
- Orchestrates:
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - Ollama
- CLI-native, local-first, worktree-safe

## Slide 3 — Why Use It

- Keep multiple coding agents in one place
- Use git worktrees instead of letting agents edit the main checkout directly
- Review changes before promotion
- Save a durable per-project archive of prompts, logs, artifacts, and transcripts

## Slide 4 — Core Concepts

- Agent cards:
  - status
  - role / personality
  - connect
  - terminal
- Workflows:
  - built-in agent chains
- Worktree:
  - isolated task branch + filesystem
- Review center:
  - findings
  - artifacts
  - diff
  - promotion
- Archive:
  - `.triad-workbench`

## Slide 5 — UI Tour

- Top bar:
  - open project
  - runner
  - probe agents
- Left rail:
  - workflow picker
  - task list
- Center grid:
  - Claude
  - Codex
  - Gemini
  - Ollama
- Right rail:
  - findings
  - Ollama model
  - project archive
  - notifications
- Bottom composer:
  - task brief
  - run workflow

## Slide 6 — Agents And Options

- Claude:
  - main coder
  - best for implementation and fixes
- Codex:
  - reviewer / tester
  - best for catching bugs and validating
- Gemini:
  - architect / extra reviewer
  - good for second opinion and design critique
- Ollama:
  - local model
  - good for compare / monitor / local analysis

## Slide 7 — Built-In Workflows

- Code -> Review -> Fix -> Verify
  - safest default
- Code -> Gemini Compare -> Codex Review
  - use Gemini as extra critic
- Architecture Compare
  - compare design ideas across all agents
- Away Monitor
  - Ollama watches for stalls / issues

## Slide 8 — Existing Project Flow

1. Open a git repo
2. Probe agents
3. Connect missing agents
4. Pick a workflow
5. Write a narrow brief
6. Run workflow
7. Review artifacts and findings
8. Promote or keep the worktree

## Slide 9 — New Project From Scratch

1. Create a new folder
2. Initialize git
3. Add a small scaffold
4. Make the first commit
5. Open the folder in Triad
6. Ask for a tiny first task

Recommended terminal bootstrap:

```powershell
mkdir my-small-app
cd my-small-app
git init
npm init -y
git add .
git commit -m "Initial scaffold"
```

## Slide 10 — How To Write Good Briefs

- Say exactly what to build
- Mention stack / language
- Mention constraints
- Ask for tests
- Keep the task small

Example:

```text
Create a TypeScript CLI todo app with add, list, and done commands.
Store data in a local JSON file.
Add Vitest tests for the main flows.
Keep the implementation simple and readable.
```

## Slide 11 — Review Center And Promotion

- Review:
  - summary
  - prompt
  - stdout / stderr
  - patch
  - findings
- Promotion actions:
  - Apply to main
  - Keep worktree
  - Open task branch
- Main checkout must be clean for safe apply

## Slide 12 — Archive And Evidence

- Each project can save to:
  - `<project>/.triad-workbench`
- Stores:
  - snapshots
  - task JSON
  - prompts
  - stdout / stderr
  - diffs
  - terminal transcripts
  - events
- Use:
  - Save now
  - Open folder

## Slide 13 — What To Expect Today

- Best for:
  - small to medium tasks
  - safe review-driven coding
  - comparing multiple agents
- Not ideal yet for:
  - giant one-shot app generation
  - full direct-chat experience for every agent
  - zero-review blind promotion

## Slide 14 — Best Practices

- Start with a small repo
- Keep one task per run
- Always inspect findings
- Use Claude + Codex first
- Use Gemini for compare / architecture
- Use Ollama as local support, not primary truth
- Keep your main branch clean before promotion
