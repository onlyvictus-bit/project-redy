<!-- Generated from .planning/phases/03-onboarding-hardening/03-01-PLAN.md -->
<!-- Do not edit here; edit the canonical .planning file -->
# Phase 3: Onboarding Hardening - Next Queued Follow-Up

**Status:** Saved for the next session

**Goal:** Start tomorrow from a clean, decision-complete checkpoint without changing runtime code today.

## Current Truth

- Public `ContinueTaskOptions.single-step.stage` already uses `ResumableStage`.
- `continueTask` is implemented and wired through IPC, preload, store, and the handoff buttons.
- The remaining gap is smaller than the older review comment suggested.

## Tomorrow's Target Behavior

- `single-step` only allows `code`, `review`, `fix`, and `verify`.
- Lifecycle-only stages (`brief`, `findings`, `promote`, `done`, `error`) are never valid step targets.

## Code Work Still Pending

- Narrow internal execution-only workflow-engine stage parameters from `TaskStage` to `ResumableStage`.
- Make the single-step prompt builder exhaustive over `code | review | fix | verify`.
- Remove any runtime fallback that assumes impossible stages can still arrive.

## Doc Work Still Pending

- Sync the Phase 3 spec and the continueTask implementation plan.
- Update AI handoff docs to reflect that `continueTask` exists and handoff buttons are enabled.
- Keep planning state accurate so this remains the next queued follow-up, not an open design question.

## Files To Touch Tomorrow

- `src/main/services/workflow-engine.ts`
- `docs/superpowers/specs/2026-03-15-continueTask-and-phase3-design.md`
- `docs/superpowers/plans/2026-03-15-continueTask-implementation.md`
- `TRIAD_WORKBENCH_AI_CONTEXT.md`
- `TRIAD_WORKBENCH_BUILD_GUIDE.md`
- `.planning/STATE.md`

## Validation To Run Tomorrow

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run planning:sync`
