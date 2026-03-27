# Contributing

Thanks for contributing to Triad Workbench.

## Before You Start

Read these first:

- [README.md](./README.md)
- [TRIAD_WORKBENCH_AI_CONTEXT.md](./TRIAD_WORKBENCH_AI_CONTEXT.md)
- [TRIAD_WORKBENCH_BUILD_GUIDE.md](./TRIAD_WORKBENCH_BUILD_GUIDE.md)

## Development Setup

```powershell
npm install
npm run dev
```

Validation:

```powershell
npm run typecheck
npm test
npm run build
```

## Contribution Rules

- Keep the app CLI-native
- Keep git worktree isolation intact
- Do not let workflow changes bypass review or promotion safety
- Prefer small, focused pull requests
- Avoid unrelated formatting churn
- Keep shared contracts in `src/shared/` consistent with main and renderer behavior

## Repo Conventions

- Main orchestration lives in `src/main/`
- UI lives in `src/renderer/`
- Cross-process contracts live in `src/shared/`
- `.planning/` is the canonical planning directory
- `.triad-workbench/` is runtime archive storage, not planning

## Recommended PR Shape

Good pull requests usually include:

- clear summary
- scope boundaries
- screenshots when UI changes
- test evidence
- risks or known follow-ups

## Testing Expectations

At minimum, run:

- `npm run typecheck`
- `npm test`
- `npm run build`

If you change workflow behavior, review UX, runner logic, or connectors, include extra manual notes in the PR.
