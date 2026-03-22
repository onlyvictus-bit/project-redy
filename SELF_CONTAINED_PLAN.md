# Triad Workbench — Self-Contained UX Plan (v2, Repo-Aligned)

## Goal

User opens app → connects agents in-app → opens project → types task → clicks Run →
reviews result → approves or rejects. No terminal, no config files, no docs needed.

---

## What Is Already Done (do not redo)

| Thing | Where | Confirmed |
|---|---|---|
| `windowsHide: true` on all spawns | `process-runner.ts:53` | ✅ |
| `authMode: 'native-login'` for Claude, Codex, Gemini | `types.ts:DEFAULT_AGENTS` | ✅ |
| PTY terminal system | `terminal-manager.ts` | ✅ |
| IPC pattern (ipc.ts → main/index.ts → preload → store) | All 4 files | ✅ |
| Deep probe on bootstrap | `app-controller.ts:93` | ✅ |
| `resolvedRunner` propagation | `app-controller.ts` + `workspace-manager.ts` | ✅ |

---

## What Is NOT Done (the real work)

### Gap 1 — No in-app auth flow
`AgentPanel.tsx:88` shows a static help link when `status === 'needs-login'`.
There is no button that runs `claude auth login` inside the app.

### Gap 2 — No Windows process-tree kill
`process-runner.ts:71` calls `child.kill()` which only kills the parent process.
On Windows, child processes spawned by Claude Code keep stdout handles open → app hangs.

### Gap 3 — No guided first-run UX
App starts and shows all 4 agent panels equally, even if none are ready.
A new user has no obvious next step.

### Gap 4 — No auto-permission patch after Claude auth
After Claude Code auth, the app should write `permissions.allow` to
`~/.claude/settings.json` so Claude Code doesn't prompt for each tool use.

---

## Implementation Plan

### Step 1 — `getAuthLaunchSpec()` on connectors

**Files**: `src/main/connectors/base.ts`, `claude-connector.ts`, `codex-connector.ts`, `gemini-connector.ts`

Add one optional method to the `AgentConnector` interface:

```typescript
// base.ts — add to interface
getAuthLaunchSpec?(): LaunchSpec | undefined;
```

Implement in each CLI connector:

```typescript
// claude-connector.ts
getAuthLaunchSpec(): LaunchSpec {
  return {
    command: 'claude',
    args: ['auth', 'login'],
    cwd: os.homedir(),       // launch from $HOME, not project dir
    runner: this.profile.runner
  };
}

// codex-connector.ts
getAuthLaunchSpec(): LaunchSpec {
  return { command: 'codex', args: ['login'], cwd: os.homedir(), runner: this.profile.runner };
}

// gemini-connector.ts
getAuthLaunchSpec(): LaunchSpec {
  return { command: 'gemini', args: ['auth', 'login'], cwd: os.homedir(), runner: this.profile.runner };
}
```

Ollama has `authMode: 'none'` — does not implement this method. OllamaConnector stays unchanged.

---

### Step 2 — `startAgentAuth()` on AppController

**File**: `src/main/app-controller.ts`

```typescript
async startAgentAuth(agentId: AgentId): Promise<string> {
  const connector = this.connectors[agentId];
  const spec = connector.getAuthLaunchSpec?.();
  if (!spec) {
    throw new Error(`${agentId} does not support in-app auth.`);
  }

  // startRaw reuses the existing PTY infrastructure (see Step 3)
  const session = this.terminalManager.startRaw(spec);
  this.snapshot.terminals = this.terminalManager.list();
  this.emitState();

  // When the auth PTY exits, re-probe to update agent status
  this.terminalManager.once(`exit:${session.id}`, async () => {
    await this.probeAgents(true);
    // Optional: patch Claude permissions after successful auth
    if (agentId === 'claude') {
      this.patchClaudePermissions();
    }
  });

  return session.id;
}

private patchClaudePermissions(): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  try {
    const raw = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      : {};
    // Backup before write
    if (fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, `${settingsPath}.bak.${Date.now()}`);
    }
    raw.permissions ??= {};
    raw.permissions.allow ??= [];
    const toAdd = ['Bash(*)', 'Read(*)', 'Write(*)', 'Edit(*)'];
    for (const p of toAdd) {
      if (!raw.permissions.allow.includes(p)) raw.permissions.allow.push(p);
    }
    fs.writeFileSync(settingsPath, JSON.stringify(raw, null, 2), 'utf8');
  } catch {
    // Non-fatal: permission patching is best-effort
  }
}
```

---

### Step 3 — `startRaw()` on TerminalManager

**File**: `src/main/services/terminal-manager.ts`

The existing `start(agentId, connector, projectPath)` calls `connector.getInteractiveLaunchSpec()`.
Auth needs a different spec (the auth command, not the interactive agent).
Add a `startRaw` overload that accepts the spec directly:

```typescript
startRaw(spec: LaunchSpec): TerminalSession {
  const pty = this.processRunner.spawnInteractive(spec);
  const session: TerminalSession = {
    id: crypto.randomUUID(),
    agentId: spec.command as AgentId,  // use command name as agentId label
    title: `Auth: ${spec.command} ${spec.args.join(' ')}`,
    cwd: spec.cwd,
    runner: spec.runner,
    createdAt: new Date().toISOString()
  };
  this.sessions.set(session.id, session);
  this.wireHandlers(session.id, pty);
  return session;
}
```

The existing `wireHandlers` (which fires `exit` events) already handles cleanup.
The `startAgentAuth` in AppController listens to `terminalManager.on('exit', ...)` and
filters by sessionId.

---

### Step 4 — IPC wiring (5 files, same pattern as all existing channels)

**`src/shared/ipc.ts`** — add to `WorkbenchApi` and `IPC_CHANNELS`:

```typescript
// WorkbenchApi
startAgentAuth: (agentId: AgentId) => Promise<string>;

// IPC_CHANNELS
startAgentAuth: 'workbench:agents:start-auth',
```

**`src/main/index.ts`** — add one line inside `wireIpc()`:

```typescript
ipcMain.handle(IPC_CHANNELS.startAgentAuth, (_event, agentId) => nextController.startAgentAuth(agentId));
```

**`src/preload/index.ts`** — add one line to the `api` object:

```typescript
startAgentAuth: (agentId) => ipcRenderer.invoke(IPC_CHANNELS.startAgentAuth, agentId),
```

**`src/renderer/src/store.ts`** — add action and type:

```typescript
// in WorkbenchState interface
startAgentAuth: (agentId: AgentId) => Promise<string | undefined>;

// in create()
startAgentAuth: async (agentId) => {
  let sessionId: string | undefined;
  await runAction(set, () => window.workbench.startAgentAuth(agentId), (id) => {
    sessionId = id;
  });
  return sessionId;
},
```

---

### Step 5 — "Connect" button in AgentPanel

**File**: `src/renderer/src/components/AgentPanel.tsx`

Replace the current static help link for `needs-login` with an inline auth flow:

```typescript
// Add to imports
const startAgentAuth = useWorkbenchStore((state) => state.startAgentAuth);

// In statusGuidance(), change needs-login case:
case 'needs-login':
  return `${agent.displayName} needs to sign in. Click Connect to authorize inside the app.`;

// In panel-actions div, add before the terminal button:
{agent.status === 'needs-login' && agent.authMode === 'native-login' ? (
  <button
    className="btn-primary"
    onClick={async () => {
      const id = await startAgentAuth(agent.id);
      // The returned sessionId is already in snapshot.terminals
      // TerminalPane will render it automatically
    }}
  >
    Connect {agent.displayName}
  </button>
) : null}
```

The PTY session for auth appears in the existing `TerminalPane` at the bottom of the
`AgentPanel` because `session = snapshot?.terminals.find(s => s.agentId === agent.id)`
will match the auth session (it uses the same agentId).

After the auth PTY exits with code 0, `probeAgents(true)` fires automatically (from
Step 2), which emits a new snapshot → AgentPanel re-renders with `status: 'ready'` →
TerminalPane disappears → Connect button disappears. User sees the status flip without
doing anything.

---

### Step 6 — Windows process-tree kill

**File**: `src/main/services/process-runner.ts`

The current `child.kill()` on line 71 (timeout path) only kills the parent process.
Add a `killTree(pid)` helper and use it everywhere:

```typescript
import { execSync } from 'node:child_process';

private killTree(pid: number): void {
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /T /F /PID ${pid}`, { stdio: 'pipe', windowsHide: true });
    } catch {
      // process may have already exited
    }
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // process may have already exited
    }
  }
}
```

Replace `child.kill()` in the timeout handler with `this.killTree(child.pid ?? 0)`.

Also expose a `kill(pid)` public method so `TerminalManager.stop()` can call it for PTY
sessions (node-pty's `pty.kill()` works on Unix but misbehaves on Windows for child trees).

---

### Step 7 — Two-mode UX: Setup view vs Work view

**File**: `src/renderer/src/App.tsx`

Add a derived boolean to detect whether all needed agents are ready:

```typescript
const needsSetup = Object.values(snapshot.agents).some(
  (a) => a.id !== 'ollama' && (a.status === 'missing' || a.status === 'needs-login')
);
```

If `needsSetup` is true, show a **Setup Banner** at the top of the page:

```
┌─────────────────────────────────────────────────────────────────┐
│  Get started — connect your agents                              │
│                                                                 │
│  [● Claude Code — Connect]  [○ Codex — Missing]                │
│  [● Gemini — Ready]         [○ Ollama — Optional]              │
│                                                                 │
│  Once at least one agent is Ready, you can run workflows.       │
└─────────────────────────────────────────────────────────────────┘
```

This banner is not a separate screen — it appears above the existing layout and
disappears once all primary agents report `ready`.

For missing agents (not installed), show an "Install guide" link (current behavior).
For `needs-login`, show the "Connect" button which triggers in-app auth.

---

## Summary of All File Changes

| File | Change | Type |
|---|---|---|
| `src/main/connectors/base.ts` | Add `getAuthLaunchSpec?()` to interface | Edit |
| `src/main/connectors/claude-connector.ts` | Implement `getAuthLaunchSpec()` | Edit |
| `src/main/connectors/codex-connector.ts` | Implement `getAuthLaunchSpec()` | Edit |
| `src/main/connectors/gemini-connector.ts` | Implement `getAuthLaunchSpec()` | Edit |
| `src/main/services/terminal-manager.ts` | Add `startRaw(spec)` | Edit |
| `src/main/services/process-runner.ts` | Add `killTree(pid)`, use it in timeout + expose `kill()` | Edit |
| `src/main/app-controller.ts` | Add `startAgentAuth()`, `patchClaudePermissions()` | Edit |
| `src/shared/ipc.ts` | Add `startAgentAuth` to `WorkbenchApi` + `IPC_CHANNELS` | Edit |
| `src/main/index.ts` | Register `startAgentAuth` handler in `wireIpc()` | Edit |
| `src/preload/index.ts` | Expose `startAgentAuth` via `contextBridge` | Edit |
| `src/renderer/src/store.ts` | Add `startAgentAuth` action | Edit |
| `src/renderer/src/components/AgentPanel.tsx` | Add "Connect" button for `needs-login` state | Edit |
| `src/renderer/src/App.tsx` | Add `needsSetup` banner | Edit |

**Total: 13 file edits, 0 new files.**

---

## What Is Skipped (and why)

| Skipped | Reason |
|---|---|
| API-key flow for Codex/Gemini | All 3 CLIs are `authMode: 'native-login'` in `DEFAULT_AGENTS`. API key is a fallback the CLI itself handles. |
| `claudeSessionId` on `TaskRun` | App already has worktree-based continuation via `continueTask`. Adding CLI session IDs mixes two strategies with no current need. |
| AuthService as a separate class | The logic is small enough to live on `AppController` directly, keeping the file count low. |
| Separate `AuthModal` component | Reusing the existing `TerminalPane` inside `AgentPanel` avoids a new component and a new modal overlay. |
| CLI binary bundling | +200MB app size, complex update story. Unnecessary if auth is in-app. |

---

## Execution Order

1. Step 6 (process-runner kill) — pure backend, no UI, safe to do first
2. Step 3 (terminal-manager startRaw) — needed by Step 2
3. Step 1 (connector getAuthLaunchSpec) — needed by Step 2
4. Step 2 (app-controller startAgentAuth) — depends on 1 and 3
5. Step 4 (IPC wiring) — depends on Step 2
6. Step 5 (AgentPanel Connect button) — depends on Step 4
7. Step 7 (App.tsx setup banner) — can be done at any point, UI only
