# Electron 37 ESM Fix + ccg-workflow Integration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Electron 37 app launch failure (`require('electron')` returns path string in CJS mode), switch to ESM mode, integrate useful patterns from ccg-workflow (platform-aware commands, setup checker, template installer), and commit all outstanding work.

**Architecture:** Electron 37 dropped CJS `require('electron')` interception in the main process — it now falls through to the npm package which returns the executable path string. Fix: add `"type": "module"` to package.json so electron-vite 4.x builds ESM output, then change all named `import { ... } from 'electron'` to default import destructuring (`import electron from 'electron'; const { app, BrowserWindow } = electron`). `BrowserWindow` is a constructor and is NOT a named ESM export in Electron 37 — it must come from the default. From ccg-workflow, copy platform-aware command wrapping, CLI presence checking, and template command installation logic.

**Tech Stack:** Electron 37, electron-vite 4.0.1, TypeScript ESM, React 19, Zustand, better-sqlite3, node-pty, vitest

---

## Chunk 1: Fix Electron 37 Launch (CRITICAL — app cannot start without this)

### Task 1: Add `"type": "module"` to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Open package.json and verify current state**

Read `package.json`. Confirm there is NO `"type"` field currently. The `"main"` field should be `"out/main/index.js"`.

- [ ] **Step 2: Add "type": "module" after the "main" field**

In `package.json`, add `"type": "module"` after `"main": "out/main/index.js"`. The top section should look like:
```json
{
  "name": "triad-workbench",
  "version": "0.1.0",
  "private": true,
  "description": "CLI-native multi-agent coding workbench for Claude Code, Codex CLI, Gemini CLI, and Ollama.",
  "main": "out/main/index.js",
  "type": "module",
```

**Why this works:** electron-vite 4.0.1 checks `pkg.type === 'module' && supportESM()` (Electron >= 28 → true for Electron 37). When both are true, it outputs ESM format. Electron 37 supports ESM natively in the main process and `import electron from 'electron'` IS intercepted by Electron's runtime.

- [ ] **Step 3: Commit this change alone**

```bash
cd "D:\ccgl room"
git add package.json
git commit -m "fix: enable ESM mode for Electron 37 compatibility"
```

---

### Task 2: Fix electron imports in `src/main/index.ts`

**Files:**
- Modify: `src/main/index.ts`

**Root cause:** `import { BrowserWindow } from 'electron'` fails in Electron 37 ESM because `BrowserWindow` (a constructor class) is NOT a named ESM export. Only non-class value APIs are named exports. **Fix: use namespace import `import * as electron from 'electron'` and destructure.**

> **Primary approach:** `import * as electron from 'electron'` (namespace import) — more reliable in Electron 37.
> **Fallback:** `import electron from 'electron'` (default import) — try if namespace import fails.

- [ ] **Step 1: Replace the electron import and update the file**

Replace `src/main/index.ts` with:
```ts
import * as electron from 'electron';
import path from 'node:path';

import { IPC_CHANNELS } from '@shared/ipc';

import { AppController } from './app-controller';

const { app, BrowserWindow, ipcMain } = electron;

let controller: AppController | undefined;
let mainWindow: InstanceType<typeof BrowserWindow> | undefined;

function createMainWindow(): InstanceType<typeof BrowserWindow> {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    title: 'Triad Workbench',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function wireIpc(window: InstanceType<typeof BrowserWindow>, nextController: AppController): void {
  nextController.on('state', (state) => {
    window.webContents.send(IPC_CHANNELS.stateChanged, state);
  });
  nextController.on('terminal-data', (payload) => {
    window.webContents.send(IPC_CHANNELS.terminalData, payload);
  });

  ipcMain.handle(IPC_CHANNELS.bootstrap, () => nextController.bootstrap());
  ipcMain.handle(IPC_CHANNELS.selectProject, () => nextController.selectProject());
  ipcMain.handle(IPC_CHANNELS.probeAgents, (_event, deep?: boolean) => nextController.probeAgents(deep));
  ipcMain.handle(IPC_CHANNELS.setProjectRunner, (_event, runner) => nextController.setProjectRunner(runner));
  ipcMain.handle(IPC_CHANNELS.setAgentRole, (_event, agentId, role) => nextController.setAgentRole(agentId, role));
  ipcMain.handle(IPC_CHANNELS.startTerminal, (_event, agentId) => nextController.startTerminal(agentId));
  ipcMain.handle(IPC_CHANNELS.stopTerminal, (_event, sessionId) => nextController.stopTerminal(sessionId));
  ipcMain.handle(IPC_CHANNELS.sendTerminalInput, (_event, sessionId, input) => nextController.sendTerminalInput(sessionId, input));
  ipcMain.handle(IPC_CHANNELS.resizeTerminal, (_event, sessionId, cols, rows) => nextController.resizeTerminal(sessionId, cols, rows));
  ipcMain.handle(IPC_CHANNELS.startWorkflow, (_event, input) => nextController.startWorkflow(input));
  ipcMain.handle(IPC_CHANNELS.cancelWorkflow, (_event, taskId) => nextController.cancelWorkflow(taskId));
  ipcMain.handle(IPC_CHANNELS.promoteTask, (_event, taskId, action) => nextController.promoteTask(taskId, action));
  ipcMain.handle(IPC_CHANNELS.continueTask, (_event, taskId, options) => nextController.continueTask(taskId, options));
  ipcMain.handle(IPC_CHANNELS.startAgentAuth, (_event, agentId) => nextController.startAgentAuth(agentId));
  ipcMain.handle(IPC_CHANNELS.setOllamaRole, (_event, role, model) => nextController.setOllamaRole(role, model));
  ipcMain.handle(IPC_CHANNELS.shutdownOllama, () => nextController.shutdownOllama());
  ipcMain.handle(IPC_CHANNELS.setProjectArchiveEnabled, (_event, enabled) => nextController.setProjectArchiveEnabled(enabled));
  ipcMain.handle(IPC_CHANNELS.saveProjectArchive, () => nextController.saveProjectArchive());
  ipcMain.handle(IPC_CHANNELS.openProjectArchive, () => nextController.openProjectArchive());
}

app.whenReady().then(() => {
  controller = new AppController();
  mainWindow = createMainWindow();
  wireIpc(mainWindow, controller);
  controller.registerQuitHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && controller) {
      mainWindow = createMainWindow();
      wireIpc(mainWindow, controller);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

Note: `__dirname` is automatically injected by electron-vite in ESM mode. No `fileURLToPath` needed.

- [ ] **Step 2: Commit**

```bash
cd "D:\ccgl room"
git add src/main/index.ts
git commit -m "fix(main): use ESM namespace import for Electron 37 compatibility"
```

---

### Task 3: Fix electron imports in `src/main/app-controller.ts`

**Files:**
- Modify: `src/main/app-controller.ts`

- [ ] **Step 1: Find and replace the electron import**

Open `src/main/app-controller.ts`. Find:
```ts
import { app, dialog, shell } from 'electron';
```

Replace with:
```ts
import * as electron from 'electron';
const { app, dialog, shell } = electron;
```

- [ ] **Step 2: Verify no other named electron imports remain in main process**

```bash
cd "D:\ccgl room"
grep -rn "^import {.*} from 'electron'" src/main/
```

Expected: no matches (all should now use `import * as electron`).

- [ ] **Step 3: Commit**

```bash
git add src/main/app-controller.ts
git commit -m "fix(app-controller): use ESM namespace import for Electron 37"
```

---

### Task 4: Fix electron imports in `src/preload/index.ts`

**Files:**
- Modify: `src/preload/index.ts`

Note: `IpcRendererEvent` IS available as a named type export from `'electron'` (type-only imports work even when value imports fail). Only value/constructor imports need the namespace approach.

- [ ] **Step 1: Replace the electron import**

In `src/preload/index.ts`, change:
```ts
import { contextBridge, ipcRenderer } from 'electron';
```
To:
```ts
import type { IpcRendererEvent } from 'electron';
import * as electron from 'electron';
const { contextBridge, ipcRenderer } = electron;
```

- [ ] **Step 2: Update the two event type annotations**

Change `_event: Electron.IpcRendererEvent` (two occurrences) to `_event: IpcRendererEvent`.

The full updated `src/preload/index.ts`:
```ts
import type { IpcRendererEvent } from 'electron';
import * as electron from 'electron';

import { IPC_CHANNELS, type WorkbenchApi } from '@shared/ipc';

const { contextBridge, ipcRenderer } = electron;

const api: WorkbenchApi = {
  bootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.bootstrap),
  selectProject: () => ipcRenderer.invoke(IPC_CHANNELS.selectProject),
  probeAgents: (deep) => ipcRenderer.invoke(IPC_CHANNELS.probeAgents, deep),
  setProjectRunner: (runner) => ipcRenderer.invoke(IPC_CHANNELS.setProjectRunner, runner),
  setAgentRole: (agentId, role) => ipcRenderer.invoke(IPC_CHANNELS.setAgentRole, agentId, role),
  startTerminal: (agentId) => ipcRenderer.invoke(IPC_CHANNELS.startTerminal, agentId),
  stopTerminal: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.stopTerminal, sessionId),
  sendTerminalInput: (sessionId, input) => ipcRenderer.invoke(IPC_CHANNELS.sendTerminalInput, sessionId, input),
  resizeTerminal: (sessionId, cols, rows) => ipcRenderer.invoke(IPC_CHANNELS.resizeTerminal, sessionId, cols, rows),
  startWorkflow: (input) => ipcRenderer.invoke(IPC_CHANNELS.startWorkflow, input),
  cancelWorkflow: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.cancelWorkflow, taskId),
  promoteTask: (taskId, action) => ipcRenderer.invoke(IPC_CHANNELS.promoteTask, taskId, action),
  continueTask: (taskId, options) => ipcRenderer.invoke(IPC_CHANNELS.continueTask, taskId, options),
  startAgentAuth: (agentId) => ipcRenderer.invoke(IPC_CHANNELS.startAgentAuth, agentId),
  setOllamaRole: (role, model) => ipcRenderer.invoke(IPC_CHANNELS.setOllamaRole, role, model),
  shutdownOllama: () => ipcRenderer.invoke(IPC_CHANNELS.shutdownOllama),
  setProjectArchiveEnabled: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.setProjectArchiveEnabled, enabled),
  saveProjectArchive: () => ipcRenderer.invoke(IPC_CHANNELS.saveProjectArchive),
  openProjectArchive: () => ipcRenderer.invoke(IPC_CHANNELS.openProjectArchive),
  onState: (listener) => {
    const wrapped = (_event: IpcRendererEvent, state: Awaited<ReturnType<WorkbenchApi['bootstrap']>>) => listener(state);
    ipcRenderer.on(IPC_CHANNELS.stateChanged, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, wrapped);
    };
  },
  onTerminalData: (listener) => {
    const wrapped = (_event: IpcRendererEvent, payload: { sessionId: string; data: string }) => listener(payload);
    ipcRenderer.on(IPC_CHANNELS.terminalData, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.terminalData, wrapped);
    };
  }
};

contextBridge.exposeInMainWorld('workbench', api);
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "fix(preload): use ESM namespace import for Electron 37"
```

---

### Task 5: Configure electron-vite to keep output filename as `index.js`

**Files:**
- Modify: `electron.vite.config.ts`

**Why:** In ESM mode, electron-vite 4 outputs `index.mjs` for both main and preload (unless instructed otherwise). But `src/main/index.ts` hardcodes `path.join(__dirname, '../preload/index.js')` — it would fail to load `index.mjs`. Force the entry filename to stay `index.js`.

- [ ] **Step 1: Add entryFileNames to main and preload build options**

Replace `electron.vite.config.ts` with:
```ts
import { fileURLToPath } from 'node:url';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const sharedPath = fileURLToPath(new URL('./src/shared', import.meta.url));
const mainPath = fileURLToPath(new URL('./src/main', import.meta.url));
const rendererPath = fileURLToPath(new URL('./src/renderer/src', import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'index.js'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': sharedPath,
        '@main': mainPath
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'index.js'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': sharedPath
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': sharedPath,
        '@renderer': rendererPath
      }
    }
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add electron.vite.config.ts
git commit -m "fix(vite): force index.js output filename for ESM main+preload"
```

---

### Task 6: Fix Vitest mocks for ESM electron

**Files:**
- Modify: any test file that has `vi.mock('electron', ...)`

**Why:** In ESM mode, `vi.mock('electron', ...)` must return `{ default: { app, BrowserWindow, ... } }` because the tests now do `import * as electron from 'electron'` which sees all exports including `default`.

- [ ] **Step 1: Find all test files mocking electron**

```bash
cd "D:\ccgl room"
grep -rln "vi.mock.*electron" src/
```

- [ ] **Step 2: Update each mock to use namespace-compatible shape**

For each file found, update the `vi.mock('electron', ...)` call to:
```ts
vi.mock('electron', () => ({
  // Named exports (for `import type { IpcRendererEvent }` etc.)
  // Default export (for `import * as electron` — the destructured values come from here)
  default: {
    app: {
      getPath: vi.fn(() => '/tmp/test-userdata'),
      on: vi.fn(),
      whenReady: vi.fn(() => Promise.resolve()),
      quit: vi.fn(),
      getName: vi.fn(() => 'test'),
    },
    BrowserWindow: vi.fn().mockImplementation(() => ({
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      webContents: { send: vi.fn() },
    })),
    ipcMain: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
    },
    dialog: {
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: ['/test'] })),
    },
    shell: {
      openExternal: vi.fn(() => Promise.resolve()),
      openPath: vi.fn(() => Promise.resolve('')),
    },
  }
}));
```

- [ ] **Step 3: Run tests**

```bash
cd "D:\ccgl room"
npm test 2>&1 | tail -20
```

Expected: all tests pass. Fix any remaining mock errors one-by-one.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "fix(tests): update electron mocks for ESM namespace import pattern"
```

---

### Task 7: Verify app launches

- [ ] **Step 1: Run the dev server**

```bash
cd "D:\ccgl room"
npm run dev
```

Expected:
```
✓ built in Xms
build the electron main process successfully
✓ built in Xms
build the electron preload files successfully
dev server running for the electron renderer process at:
  ➜  Local:   http://localhost:5173/
start electron app...
```

Then the Triad Workbench window should open (1600×980 window).

- [ ] **Step 2: Verify UI loads**

The app should show "Booting Triad Workbench..." then the main UI. Open DevTools (Ctrl+Shift+I) — no errors should appear in the console.

- [ ] **Step 3: If namespace import fails, try default import**

If `import * as electron` fails (unlikely but possible), try:
```ts
import electron from 'electron';
```
In all three files (index.ts, app-controller.ts, preload/index.ts). The rest of the code stays the same.

---

## Chunk 2: Commit All Outstanding Work

### Task 8: Stage and commit all uncommitted files

- [ ] **Step 1: Check current status**

```bash
cd "D:\ccgl room"
git status
git log --oneline -3
```

- [ ] **Step 2: Stage all project source files (not tmp-test or design-preview)**

```bash
cd "D:\ccgl room"
git add \
  src/ \
  tsconfig.json \
  vitest.config.ts \
  package.json \
  package-lock.json \
  docs/ \
  .planning/ \
  TRIAD_WORKBENCH_AI_CONTEXT.md \
  TRIAD_WORKBENCH_BUILD_GUIDE.md \
  TRIAD_WORKBENCH_SOURCE_REFERENCE.md \
  SELF_CONTAINED_PLAN.md \
  start-preview.cjs \
  vite.preview.config.ts
```

Do NOT add `tmp-test/`, `design-preview/`, `triad-workbench-preview.png`, `.claude/`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: production hardening phases 1-9 + Electron 37 ESM fix

- Phase 1: terminal containment (stopAll, 5000-line buffer)
- Phase 2: worktree lifecycle (cleanup on promote, startup GC)
- Phase 3: workflow cancellation (AbortSignal, cancel button)
- Phase 4: Ollama lifecycle (before-quit shutdown, Windows kill)
- Phase 5: crash recovery (run events, interruption detection)
- Phase 6: failure UX (stderr first, failed artifacts sorted)
- Phase 7: path validation (bounds check, prompt size limit)
- Phase 8: release confidence tests (84 tests passing)
- Phase 9: Windows NSIS packaging config
- ESM fix: require(electron) returns path in Electron 37 CJS;
  switched to ESM mode with namespace import destructuring"
```

- [ ] **Step 4: Verify tests still pass**

```bash
cd "D:\ccgl room"
npm test
```

Expected: all tests pass. Fix any failures before continuing.

---

## Chunk 3: ccg-workflow Platform & Setup Integration

**What we're copying from ccg-workflow:** The `platform.ts` utility for Windows-aware command wrapping, and the setup-checker pattern from `installer.ts` for detecting whether agent CLIs are installed.

### Task 9: Create `src/main/utils/platform-cmd.ts`

**Files:**
- Create: `src/main/utils/platform-cmd.ts`
- Create: `src/main/utils/platform-cmd.test.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * Platform-aware command utilities.
 * Adapted from ccg-workflow (MIT) — https://github.com/fengshao1227/ccg-workflow
 */

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * On Windows, wrap CLI commands that need cmd /c to resolve PATH correctly.
 * claude, codex, gemini are installed via npm/global and need this on Windows.
 */
const WIN_WRAP_CMDS = new Set(['claude', 'codex', 'gemini', 'npx', 'npm', 'node']);

export function platformCmd(cmd: string): string {
  if (isWindows() && WIN_WRAP_CMDS.has(cmd)) {
    return `cmd /c ${cmd}`;
  }
  return cmd;
}

/** Returns the install URL for a given agent CLI. */
export function agentInstallUrl(agentId: 'claude' | 'codex' | 'gemini'): string {
  const urls: Record<string, string> = {
    claude: 'https://docs.anthropic.com/en/docs/claude-code',
    codex: 'https://github.com/openai/codex',
    gemini: 'https://github.com/google-gemini/gemini-cli'
  };
  return urls[agentId] ?? '';
}

/** Returns the npm install command for an agent CLI (platform-aware). */
export function agentInstallCmd(agentId: 'claude' | 'codex' | 'gemini'): string {
  const cmds: Record<string, string> = {
    claude: 'npm install -g @anthropic-ai/claude-code',
    codex: 'npm install -g @openai/codex',
    gemini: 'npm install -g @google/gemini-cli'
  };
  const base = cmds[agentId] ?? '';
  return isWindows() ? `cmd /c ${base}` : base;
}
```

- [ ] **Step 2: Create the test file**

```ts
import { describe, it, expect } from 'vitest';
import { platformCmd, agentInstallCmd, agentInstallUrl } from './platform-cmd';

describe('platform-cmd', () => {
  it('passes through unknown commands unchanged', () => {
    expect(platformCmd('unknown-tool')).toBe('unknown-tool');
  });

  it('returns install URL for claude', () => {
    expect(agentInstallUrl('claude')).toContain('anthropic');
  });

  it('returns install URL for codex', () => {
    expect(agentInstallUrl('codex')).toContain('openai');
  });

  it('returns install URL for gemini', () => {
    expect(agentInstallUrl('gemini')).toContain('google');
  });

  it('install command includes package name for claude', () => {
    expect(agentInstallCmd('claude')).toContain('claude-code');
  });

  it('install command includes package name for codex', () => {
    expect(agentInstallCmd('codex')).toContain('codex');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd "D:\ccgl room"
npm test -- --reporter=verbose 2>&1 | grep -E "platform-cmd|✓|✗|PASS|FAIL"
```

Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/utils/platform-cmd.ts src/main/utils/platform-cmd.test.ts
git commit -m "feat(utils): add platform-aware command utilities (adapted from ccg-workflow)"
```

---

### Task 10: Create `src/main/utils/setup-checker.ts`

**Files:**
- Create: `src/main/utils/setup-checker.ts`

- [ ] **Step 1: Add types to `src/shared/types.ts`**

Add these interfaces to `src/shared/types.ts` (near the bottom, before the last export):
```ts
export interface CliCheckResult {
  id: 'claude' | 'codex' | 'gemini';
  installed: boolean;
  version?: string;
  error?: string;
}

export interface SetupReport {
  checks: CliCheckResult[];
  allReady: boolean;
  missingCount: number;
}
```

- [ ] **Step 2: Create `src/main/utils/setup-checker.ts`**

```ts
import { execSync } from 'node:child_process';
import type { CliCheckResult, SetupReport } from '@shared/types';
import { platformCmd } from './platform-cmd';

function checkCli(id: 'claude' | 'codex' | 'gemini'): CliCheckResult {
  const cmd = platformCmd(id);
  try {
    const out = execSync(`${cmd} --version`, {
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { id, installed: true, version: out.trim().split('\n')[0] };
  } catch {
    return { id, installed: false, error: `${id} not found in PATH` };
  }
}

export function runSetupCheck(): SetupReport {
  const checks: CliCheckResult[] = [
    checkCli('claude'),
    checkCli('codex'),
    checkCli('gemini')
  ];
  const missingCount = checks.filter((c) => !c.installed).length;
  return { checks, allReady: missingCount === 0, missingCount };
}
```

- [ ] **Step 3: Add `checkSetup` IPC channel to `src/shared/ipc.ts`**

In `src/shared/ipc.ts`, add to `WorkbenchApi` interface:
```ts
checkSetup: () => Promise<SetupReport>;
```

Also add the import at the top of the interface — `SetupReport` is already imported via `'./types'` since we added it to types.ts. Verify the import includes `SetupReport`.

Add to `IPC_CHANNELS` object:
```ts
checkSetup: 'workbench:setup:check',
```

- [ ] **Step 4: Wire in `src/main/index.ts`**

Add import at top of `src/main/index.ts`:
```ts
import { runSetupCheck } from './utils/setup-checker';
```

In the `wireIpc` function, add:
```ts
ipcMain.handle(IPC_CHANNELS.checkSetup, () => runSetupCheck());
```

- [ ] **Step 5: Expose in `src/preload/index.ts`**

Add to the `api` object in `src/preload/index.ts`:
```ts
checkSetup: () => ipcRenderer.invoke(IPC_CHANNELS.checkSetup),
```

- [ ] **Step 6: Commit**

```bash
git add src/main/utils/setup-checker.ts src/shared/types.ts src/shared/ipc.ts src/main/index.ts src/preload/index.ts
git commit -m "feat(setup): add setup checker IPC for CLI detection (ccg-workflow pattern)"
```

---

## Chunk 4: Bundle ccg-workflow Template Commands

**What we're copying:** The template command installation pattern from ccg-workflow. Bundles markdown files with Triad and installs them to the user's project on demand.

### Task 11: Create template bundling infrastructure

**Files:**
- Create: `resources/templates/commands/` (markdown template files)
- Create: `src/main/utils/template-installer.ts`
- Modify: `package.json` (add extraResources for packaging)

- [ ] **Step 1: Create the resources directory**

```bash
mkdir -p 'D:\ccgl room\resources\templates\commands'
```

- [ ] **Step 2: Create essential template files**

Create `resources/templates/commands/analyze.md`:
```markdown
# /analyze

Analyze the specified code for quality, bugs, and improvements.

## Usage
`/analyze [file or description]`

## Steps
1. Read the target file(s)
2. Identify issues: bugs, performance, security, maintainability
3. Report findings with severity levels (critical/high/medium/low)
4. Suggest concrete, actionable improvements
5. Note what is working well
```

Create `resources/templates/commands/feat.md`:
```markdown
# /feat

Implement a new feature with tests.

## Usage
`/feat [feature description]`

## Steps
1. Clarify requirements if ambiguous
2. Write failing tests first (TDD)
3. Implement minimal code to pass tests
4. Refactor if needed
5. Commit with descriptive message
```

Create `resources/templates/commands/debug.md`:
```markdown
# /debug

Systematically diagnose and fix a bug.

## Usage
`/debug [bug description or error message]`

## Steps
1. Reproduce the bug with a minimal test case
2. Form a hypothesis about the root cause
3. Verify the hypothesis
4. Implement the fix
5. Confirm the bug is resolved and no regressions
```

Create `resources/templates/commands/review.md`:
```markdown
# /review

Perform a thorough code review.

## Usage
`/review [file or PR description]`

## Checks
- Correctness: does the code do what it claims?
- Security: SQL injection, XSS, auth bypass, secrets exposure
- Performance: N+1 queries, unnecessary re-renders, missing indexes
- Maintainability: naming, complexity, duplication
- Tests: coverage gaps, fragile assertions
```

Create `resources/templates/commands/test.md`:
```markdown
# /test

Write comprehensive tests for existing code.

## Usage
`/test [file or function to test]`

## Steps
1. Read the code under test
2. Identify: happy paths, edge cases, error cases
3. Write unit tests (fast, isolated)
4. Write integration tests if needed
5. Ensure all paths are covered
```

Create `resources/templates/commands/optimize.md`:
```markdown
# /optimize

Optimize code for performance or readability.

## Usage
`/optimize [file or description]`

## Steps
1. Profile first — measure before optimizing
2. Identify the bottleneck
3. Apply the targeted fix
4. Measure again to confirm improvement
5. Document why the optimization was needed
```

Create `resources/templates/commands/plan.md`:
```markdown
# /plan

Create an implementation plan before writing code.

## Usage
`/plan [feature or task description]`

## Output
- Approach options (2-3 alternatives with trade-offs)
- Recommended approach with rationale
- File-by-file breakdown of changes
- Testing strategy
- Risks and mitigations
```

Create `resources/templates/commands/commit.md`:
```markdown
# /commit

Create a well-structured git commit.

## Usage
`/commit`

## Steps
1. Review staged changes with `git diff --staged`
2. Summarize the "why", not just the "what"
3. Use conventional commit format: `type(scope): message`
4. Types: feat, fix, chore, docs, test, refactor, perf
5. Keep subject line under 72 characters
```

- [ ] **Step 3: Add `extraResources` to `package.json` for production packaging**

In `package.json`, update the `"build"` section's `"extraResources"` field from:
```json
"extraResources": [],
```
To:
```json
"extraResources": [
  { "from": "resources/templates", "to": "templates" }
],
```

- [ ] **Step 4: Create `src/main/utils/template-installer.ts`**

Note: uses `import * as electron from 'electron'` (ESM namespace import, consistent with the fix in Chunk 1).

```ts
import fs from 'node:fs';
import path from 'node:path';
import * as electron from 'electron';

const { app } = electron;

export interface TemplateInstallResult {
  installed: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Returns the path to the bundled templates directory.
 * In production: process.resourcesPath points to the unpacked extraResources.
 * In dev: falls back to the project root's resources/ folder.
 */
function getTemplatesDir(): string {
  // In production Electron, resources are extracted to process.resourcesPath/templates
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'templates', 'commands'))) {
    return path.join(process.resourcesPath, 'templates', 'commands');
  }
  // Dev fallback: relative to the app path
  return path.join(app.getAppPath(), 'resources', 'templates', 'commands');
}

/**
 * Installs bundled Claude Code command templates to <projectRoot>/.claude/commands/
 */
export async function installTemplates(
  projectRootPath: string,
  overwrite = false
): Promise<TemplateInstallResult> {
  const templatesDir = getTemplatesDir();
  const targetDir = path.join(projectRootPath, '.claude', 'commands');
  const result: TemplateInstallResult = { installed: [], skipped: [], errors: [] };

  if (!fs.existsSync(templatesDir)) {
    result.errors.push(`Templates directory not found: ${templatesDir}`);
    return result;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const src = path.join(templatesDir, file);
    const dest = path.join(targetDir, file);

    if (fs.existsSync(dest) && !overwrite) {
      result.skipped.push(file);
      continue;
    }

    try {
      fs.copyFileSync(src, dest);
      result.installed.push(file);
    } catch (err) {
      result.errors.push(`Failed to install ${file}: ${String(err)}`);
    }
  }

  return result;
}
```

- [ ] **Step 5: Add shared types for template install result**

Add to `src/shared/types.ts`:
```ts
export interface TemplateInstallResult {
  installed: string[];
  skipped: string[];
  errors: string[];
}
```

- [ ] **Step 6: Add `getSnapshot()` public method to `AppController`**

In `src/main/app-controller.ts`, add a public method to expose the snapshot:
```ts
getSnapshot(): WorkbenchSnapshot {
  return this.snapshot;
}
```

Place it right after the constructor, before other public methods.

- [ ] **Step 7: Add `installTemplates` IPC channel**

In `src/shared/ipc.ts`, add to `WorkbenchApi`:
```ts
installTemplates: (overwrite?: boolean) => Promise<TemplateInstallResult>;
```

Add to `IPC_CHANNELS`:
```ts
installTemplates: 'workbench:setup:install-templates',
```

In `src/main/index.ts`, add import:
```ts
import { installTemplates } from './utils/template-installer';
```

In `wireIpc`, add:
```ts
ipcMain.handle(IPC_CHANNELS.installTemplates, (_event, overwrite?: boolean) => {
  const projectPath = nextController.getSnapshot().project?.rootPath;
  if (!projectPath) throw new Error('No project selected');
  return installTemplates(projectPath, overwrite);
});
```

In `src/preload/index.ts`, add to `api`:
```ts
installTemplates: (overwrite) => ipcRenderer.invoke(IPC_CHANNELS.installTemplates, overwrite),
```

- [ ] **Step 8: Add "Install templates" button to the existing AgentPanel or TaskDetailPanel**

Read `src/renderer/src/components/AgentPanel.tsx` to find a suitable location for the button. The SetupBanner already handles the missing-CLI display — add a standalone "Install Claude Code templates" button near the bottom of the agent panel or in a settings section:

```tsx
// In AgentPanel.tsx or wherever fits the UI — find a good spot near the bottom:
<div className="template-install-section">
  <button
    onClick={() =>
      void window.workbench.installTemplates(false).then((result) => {
        const msg = result.errors.length > 0
          ? `Errors: ${result.errors.join(', ')}`
          : `Installed ${result.installed.length} templates (${result.skipped.length} already existed)`;
        alert(msg);
      })
    }
  >
    Install Claude Code templates to project
  </button>
</div>
```

**Do NOT replace SetupBanner.tsx** — it is already implemented and working. Only add this button to a panel component.

- [ ] **Step 9: Commit**

```bash
git add resources/ src/main/utils/template-installer.ts src/main/app-controller.ts src/shared/types.ts src/shared/ipc.ts src/main/index.ts src/preload/index.ts src/renderer/src/components/
git commit -m "feat(templates): bundle and install ccg-workflow command templates to projects"
```

---

## Chunk 5: Final Verification & Production Packaging

### Task 12: Run full test suite and verify launch

- [ ] **Step 1: Run all tests**

```bash
cd "D:\ccgl room"
npm test 2>&1
```

Expected: all tests pass (84+). If any fail due to ESM mock changes, update the mock as documented in Task 6.

- [ ] **Step 2: Typecheck**

```bash
cd "D:\ccgl room"
npm run typecheck
```

Fix all TypeScript errors before proceeding.

- [ ] **Step 3: Verify app launches**

```bash
cd "D:\ccgl room"
npm run dev
```

Confirm:
- [ ] Main window opens (1600×980 titled "Triad Workbench")
- [ ] UI renders (no blank screen)
- [ ] DevTools console (Ctrl+Shift+I) shows no errors
- [ ] "Select Project" opens a file dialog
- [ ] Agent panel shows status for claude, codex, gemini, ollama

- [ ] **Step 4: Tag working build**

```bash
cd "D:\ccgl room"
git tag v0.1.0-production-hardened
```

### Task 13: Build Windows installer

- [ ] **Step 1: Run production build**

```bash
cd "D:\ccgl room"
npm run dist:win 2>&1
```

Expected: creates `dist-electron/` folder with NSIS installer. Takes 3-5 minutes.

- [ ] **Step 2: Verify installer was created**

```bash
ls 'D:\ccgl room\dist-electron'
```

Expected: `Triad Workbench Setup 0.1.0.exe` or similar file.

- [ ] **Step 3: Final commit**

```bash
cd "D:\ccgl room"
git add -A
git diff --staged  # Should be minimal: lock files, build metadata only
git commit -m "chore: final verification, cleanup tmp-test artifacts"
```

---

## Notes for Implementer

### ESM `__dirname`
electron-vite 4.0.1 automatically injects `__dirname` and `__filename` polyfills for the main process in ESM mode. Do NOT add manual `fileURLToPath(import.meta.url)` — it's already provided.

### Vitest ESM mocks
`vi.mock('electron', factory)` in ESM must export `{ default: { app, BrowserWindow, ... } }` because `import * as electron` accesses all namespace members. The `default` key is what gets destructured as `const { app } = electron`.

### SetupBanner is already implemented
`src/renderer/src/components/SetupBanner.tsx` is already fully implemented and wired into `App.tsx`. It uses the `WorkbenchSnapshot` agent status to show missing CLIs. Do NOT replace it — only extend if needed.

### ccg-workflow License
ccg-workflow is MIT licensed. Code was adapted but attribution is not required.

### Windows PATH for CLI commands
With `platform-cmd.ts` providing `platformCmd('claude')`, consider updating `src/main/connectors/base.ts` to wrap the `binaryOrEndpoint` with `platformCmd()` when building subprocess commands. This ensures `claude`, `codex`, `gemini` resolve correctly on Windows without requiring the user to add them to PATH manually.
