# Phase 3: Onboarding Hardening - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning
**Source:** PRD Express Path (docs/superpowers/plans/2026-03-17-electron37-esm-fix-and-ccg-integration.md)

<domain>
## Phase Boundary

This phase delivers a LAUNCHABLE Triad Workbench on Electron 37 by fixing the CJS→ESM module break, commits all outstanding production hardening work, and integrates ccg-workflow patterns for platform-aware commands, CLI setup detection, and template bundling.

**What ships:**
- App launches: Electron window opens, UI renders, no startup crash
- All 9 hardening phases committed to git
- Platform-aware command wrapping (Windows `cmd /c` for claude/codex/gemini)
- Setup checker IPC showing which CLIs are missing
- 8 bundled Claude Code template commands installable to any project

</domain>

<decisions>
## Implementation Decisions

### Critical: Electron 37 ESM Fix

- `"type": "module"` must be added to `package.json` — electron-vite 4.0.1 requires this to output ESM for Electron >= 28
- All `import { X } from 'electron'` named imports in main process files must become `import * as electron from 'electron'; const { X } = electron;`
- Files requiring change: `src/main/index.ts`, `src/main/app-controller.ts`, `src/preload/index.ts`
- `IpcRendererEvent` is a type-only named import — use `import type { IpcRendererEvent } from 'electron'` (types are not affected by the constructor export issue)
- electron-vite config must force `entryFileNames: 'index.js'` for main and preload to prevent `.mjs` output that breaks hardcoded preload path reference
- `__dirname` is auto-injected by electron-vite in ESM mode — no manual `fileURLToPath` needed

### Vitest Mocks for ESM

- All `vi.mock('electron', factory)` must return `{ default: { app, BrowserWindow, ... } }` shape
- The `default` key is what gets destructured as `const { app } = electron` after namespace import

### Commit Strategy

- Commit ESM fix files first (before bulk commit)
- Bulk commit includes: src/, docs/, .planning/, TRIAD_WORKBENCH_*.md, config files, package-lock.json
- Exclude: tmp-test/, design-preview/, .claude/, triad-workbench-preview.png

### ccg-workflow Patterns (adapted, MIT)

- `platform-cmd.ts`: `platformCmd('claude')` wraps with `cmd /c` on Windows; goes in `src/main/utils/`
- `setup-checker.ts`: runs `claude --version`, `codex --version`, `gemini --version` via execSync; returns `SetupReport`
- `SetupReport` and `CliCheckResult` types go in `src/shared/types.ts`
- `checkSetup` IPC channel added to `WorkbenchApi` and `IPC_CHANNELS`
- `template-installer.ts`: copies markdown files from `resources/templates/commands/` to `<project>/.claude/commands/`
- Production path: `process.resourcesPath/templates/commands` (from electron-builder extraResources)
- Dev path fallback: `app.getAppPath()/resources/templates/commands`
- `getSnapshot()` public method must be added to `AppController` to expose private `this.snapshot`
- electron-builder `extraResources`: `[{ "from": "resources/templates", "to": "templates" }]`

### SetupBanner (DO NOT REPLACE)

- `src/renderer/src/components/SetupBanner.tsx` is already implemented and wired into App.tsx
- It uses the existing `WorkbenchSnapshot` agent status — do NOT replace it
- Only addition: "Install Claude Code templates" button added to an existing panel (AgentPanel or similar)

### Claude's Discretion

- Which panel component gets the "Install templates" button (AgentPanel recommended)
- Exact placement of button within AgentPanel layout
- Whether to show install result as alert() or inline notification
- Whether platform-cmd.ts is tested on Windows-specific behavior (tests may skip on non-Windows)

</decisions>

<specifics>
## Specific Implementation Details

**ESM namespace import pattern (use in ALL new/modified main process files):**
```ts
import * as electron from 'electron';
const { app, BrowserWindow, ipcMain } = electron;
```

**ESM type import pattern (types only, no runtime value):**
```ts
import type { IpcRendererEvent } from 'electron';
```

**electron.vite.config.ts addition:**
```ts
build: {
  rollupOptions: {
    output: {
      entryFileNames: 'index.js'
    }
  }
}
```
Add to both `main` and `preload` sections.

**template-installer.ts path resolution:**
```ts
function getTemplatesDir(): string {
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'templates', 'commands'))) {
    return path.join(process.resourcesPath, 'templates', 'commands');
  }
  return path.join(app.getAppPath(), 'resources', 'templates', 'commands');
}
```

**8 template files to create in resources/templates/commands/:**
analyze.md, feat.md, debug.md, review.md, test.md, optimize.md, plan.md, commit.md

</specifics>

<deferred>
## Deferred Ideas

- Auto-install of missing CLIs (claude/codex/gemini) — deferred to Phase 4+
- Full MCP configuration UI from ccg-workflow — Phase 5+
- Windows installer testing — separate QA task
- More than 8 template commands (ccg-workflow has 31) — can be added later
- Production NSIS installer signing — out of scope for v0.1

</deferred>

---

*Phase: 03-onboarding-hardening*
*Context gathered: 2026-03-17 via PRD Express Path*
