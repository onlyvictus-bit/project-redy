# Phase 2: Review Center Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current dashboard into a true code-review workstation with artifact inspection, patch viewing, findings actions, and approval controls.

**Architecture:** Extract the monolithic `App.tsx` into focused components. Add a `selectedTaskId` / `selectedArtifactId` selection model in Zustand. The center area becomes a two-layer workspace: agent grid on top, task detail panel below. The right rail becomes the review rail with findings, approvals, and handoff actions.

**Tech Stack:** React 19, Zustand 5, xterm.js, TypeScript, Vite, existing IPC contract (no backend changes needed — all data already exists in `WorkbenchSnapshot`).

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `src/renderer/src/components/TerminalPane.tsx` | Extracted xterm terminal pane component |
| `src/renderer/src/components/AgentPanel.tsx` | Extracted single-agent card with terminal + artifact summary |
| `src/renderer/src/components/TaskCard.tsx` | Extracted task card with stage badge + promote actions |
| `src/renderer/src/components/TaskDetailPanel.tsx` | Full task inspection: summary, steps timeline, agent assignments |
| `src/renderer/src/components/ArtifactViewer.tsx` | Tabbed artifact viewer: Overview, Prompt, Patch, Logs, Findings, Commands |
| `src/renderer/src/components/DiffViewer.tsx` | Monospace patch/diff viewer with add/remove line highlighting |
| `src/renderer/src/components/FindingsPanel.tsx` | Rich findings list with severity icons and handoff actions |
| `src/renderer/src/components/HandoffActions.tsx` | Cross-agent handoff buttons embedded in FindingsPanel: "Send to Claude for fix", "Ask Codex to verify", "Ask Gemini for review" |

### Files to modify

| File | Changes |
|------|---------|
| `src/renderer/src/App.tsx` | Replace inline components with imports; add center detail panel; restructure layout |
| `src/renderer/src/store.ts` | Add `selectedTaskId`, `selectedArtifactId`, selection actions |
| `src/renderer/src/styles.css` | Add styles for new components (detail panel, diff viewer, tabs, severity badges) |

### Files NOT touched

All `src/main/` files remain unchanged. No backend, IPC, connector, or service changes. This is a pure renderer refactor.

---

## Chunk 1: Store Additions + Component Extraction

### Task 1: Add selection state to Zustand store

**Files:**
- Modify: `src/renderer/src/store.ts`

- [ ] **Step 1: Write the selection state additions**

Add `selectedTaskId` and `selectedArtifactId` to the store interface and create setter actions. These drive which task/artifact is shown in the detail panel.

```typescript
// Add to WorkbenchState interface:
selectedTaskId?: string;
selectedArtifactId?: string;
selectTask: (taskId: string | undefined) => void;
selectArtifact: (artifactId: string | undefined) => void;
```

```typescript
// Add to create() body:
selectedTaskId: undefined,
selectedArtifactId: undefined,
selectTask: (taskId) => set({ selectedTaskId: taskId, selectedArtifactId: undefined }),
selectArtifact: (artifactId) => set({ selectedArtifactId: artifactId }),
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/store.ts
git commit -m "feat(store): add selectedTaskId and selectedArtifactId selection state"
```

---

### Task 2: Extract TerminalPane component

**Files:**
- Create: `src/renderer/src/components/TerminalPane.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create `src/renderer/src/components/TerminalPane.tsx`**

Move the existing `TerminalPane` function component (lines 23-79 of App.tsx) into its own file with no logic changes. Export as named export.

```tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  sessionId?: string;
  buffer?: string;
}

export function TerminalPane({ sessionId, buffer }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenLengthRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const terminal = new Terminal({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      theme: {
        background: '#101826',
        foreground: '#d8e1f0'
      }
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    writtenLengthRef.current = 0;

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!terminalRef.current || !buffer) {
      return;
    }

    const delta = buffer.slice(writtenLengthRef.current);
    if (delta) {
      terminalRef.current.write(delta);
      writtenLengthRef.current = buffer.length;
    }
  }, [buffer]);

  useEffect(() => {
    fitAddonRef.current?.fit();
  }, [sessionId, buffer]);

  if (!sessionId) {
    return <div className="terminal-empty">Interactive terminal is not running.</div>;
  }

  return <div ref={containerRef} className="terminal-canvas" />;
}
```

- [ ] **Step 2: Update App.tsx to import TerminalPane**

Remove the inline `TerminalPane` function from App.tsx. Add import:

```tsx
import { TerminalPane } from './components/TerminalPane';
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify build passes**

Run: `cd "D:\ccgl room" && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/TerminalPane.tsx src/renderer/src/App.tsx
git commit -m "refactor: extract TerminalPane into its own component"
```

---

### Task 3: Extract AgentPanel component

**Files:**
- Create: `src/renderer/src/components/AgentPanel.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create `src/renderer/src/components/AgentPanel.tsx`**

Move the existing `AgentPanel` function (lines 81-167 of App.tsx) into its own file. Import `TerminalPane` from the extracted component. Include the `findTerminalSession` and `formatStatus` helpers as local functions.

```tsx
import { useMemo, useState } from 'react';

import type { AgentId, AgentProfile, AgentRole } from '@shared/types';

import { TerminalPane } from './TerminalPane';
import { useWorkbenchStore } from '../store';

const ROLE_OPTIONS: AgentRole[] = ['coder', 'reviewer', 'tester', 'architect', 'planner', 'monitor', 'developer', 'compare-only', 'off'];

function formatStatus(agent: AgentProfile): string {
  return `${agent.status}${agent.version ? ` - ${agent.version}` : ''}`;
}

export function AgentPanel({ agent }: { agent: AgentProfile }) {
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const terminalBuffers = useWorkbenchStore((state) => state.terminalBuffers);
  const setAgentRole = useWorkbenchStore((state) => state.setAgentRole);
  const startTerminal = useWorkbenchStore((state) => state.startTerminal);
  const stopTerminal = useWorkbenchStore((state) => state.stopTerminal);
  const sendTerminalInput = useWorkbenchStore((state) => state.sendTerminalInput);
  const setOllamaRole = useWorkbenchStore((state) => state.setOllamaRole);
  const session = snapshot?.terminals.find((s) => s.agentId === agent.id);
  const [input, setInput] = useState('');

  const latestArtifact = useMemo(
    () => snapshot?.tasks.flatMap((task) => task.artifacts).find((artifact) => artifact.agentId === agent.id),
    [agent.id, snapshot?.tasks]
  );

  return (
    <section className="agent-panel">
      <div className="panel-header">
        <div>
          <h3>{agent.displayName}</h3>
          <p>{formatStatus(agent)}</p>
        </div>
        <select
          value={agent.role}
          onChange={(event) => {
            const role = event.target.value as AgentRole;
            if (agent.id === 'ollama') {
              void setOllamaRole(role);
            } else {
              void setAgentRole(agent.id, role);
            }
          }}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <div className="panel-body">
        <p className="panel-message">{agent.message || 'No probe details yet.'}</p>
        {agent.installHelpUrl ? (
          <a href={agent.installHelpUrl} target="_blank" rel="noreferrer">
            Install or login help
          </a>
        ) : null}

        <div className="panel-actions">
          {agent.capabilities.supportsInteractive ? (
            session ? (
              <button onClick={() => void stopTerminal(session.id)}>Stop terminal</button>
            ) : (
              <button onClick={() => void startTerminal(agent.id)}>Start terminal</button>
            )
          ) : null}
        </div>

        <TerminalPane sessionId={session?.id} buffer={session ? terminalBuffers[session.id] : ''} />

        {session ? (
          <form
            className="terminal-input"
            onSubmit={(event) => {
              event.preventDefault();
              if (!input.trim()) {
                return;
              }
              void sendTerminalInput(session.id, `${input}\r`);
              setInput('');
            }}
          >
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Send input to ${agent.displayName}`} />
            <button type="submit">Send</button>
          </form>
        ) : null}

        <div className="artifact-summary">
          <strong>Latest artifact</strong>
          <p>{latestArtifact?.summary || 'No artifacts yet.'}</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update App.tsx to import AgentPanel**

Remove the inline `AgentPanel` function, `findTerminalSession`, `formatStatus`, and `ROLE_OPTIONS` from App.tsx. Add import:

```tsx
import { AgentPanel } from './components/AgentPanel';
```

Also remove the now-unused imports: `useMemo`, `useRef`, `Terminal`, `FitAddon`.

- [ ] **Step 3: Verify typecheck + build**

Run: `cd "D:\ccgl room" && npx tsc --noEmit && npm run build`
Expected: Both pass

- [ ] **Step 4: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/AgentPanel.tsx src/renderer/src/App.tsx
git commit -m "refactor: extract AgentPanel into its own component"
```

---

### Task 4: Extract TaskCard component

**Files:**
- Create: `src/renderer/src/components/TaskCard.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Create `src/renderer/src/components/TaskCard.tsx`**

Move the existing `TaskCard` function (lines 169-190 of App.tsx) into its own file. Add an `onClick` prop so clicking a task card selects it in the store. Add a visual `selected` state.

```tsx
import type { PromotionAction, TaskRun } from '@shared/types';

interface TaskCardProps {
  task: TaskRun;
  isSelected: boolean;
  onSelect: () => void;
  onPromote: (action: PromotionAction) => void;
}

export function TaskCard({ task, isSelected, onSelect, onPromote }: TaskCardProps) {
  return (
    <article className={`task-card${isSelected ? ' task-card-selected' : ''}`} onClick={onSelect}>
      <div className="task-card-header">
        <h4>{task.brief}</h4>
        <span className={`stage-badge stage-${task.stage}`}>{task.stage}</span>
      </div>
      <p>{task.summary || 'No summary yet.'}</p>
      <div className="task-meta">
        <span>{task.workflowId}</span>
        <span>{task.branchName}</span>
        <span>{task.findings.length} findings</span>
      </div>
      {task.stage === 'promote' ? (
        <div className="task-actions" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onPromote('apply-to-main')}>Apply to main</button>
          <button onClick={() => onPromote('keep-worktree')}>Keep worktree</button>
          <button onClick={() => onPromote('open-task-branch')}>Open task branch</button>
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 2: Update App.tsx to use extracted TaskCard**

Remove the inline `TaskCard` function. Add import and wire up selection:

```tsx
import { TaskCard } from './components/TaskCard';
```

In the task list rendering, pass `isSelected` and `onSelect`:

```tsx
<TaskCard
  key={task.id}
  task={task}
  isSelected={snapshot.tasks.indexOf(task) === 0 || task.id === selectedTaskId}
  onSelect={() => selectTask(task.id)}
  onPromote={(action) => void promoteTask(task.id, action)}
/>
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd "D:\ccgl room" && npx tsc --noEmit && npm run build`
Expected: Both pass

- [ ] **Step 4: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/TaskCard.tsx src/renderer/src/App.tsx
git commit -m "refactor: extract TaskCard with selection support"
```

---

## Chunk 2: New Review Components

### Task 5: Create DiffViewer component

**Files:**
- Create: `src/renderer/src/components/DiffViewer.tsx`

- [ ] **Step 1: Create `src/renderer/src/components/DiffViewer.tsx`**

A monospace diff viewer that highlights added/removed lines. No external dependency — just CSS class assignment per line.

```tsx
interface DiffViewerProps {
  patch: string | undefined;
}

function classifyLine(line: string): 'added' | 'removed' | 'header' | 'context' {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('@@')) {
    return 'header';
  }
  if (line.startsWith('+')) {
    return 'added';
  }
  if (line.startsWith('-')) {
    return 'removed';
  }
  return 'context';
}

export function DiffViewer({ patch }: DiffViewerProps) {
  if (!patch) {
    return <div className="diff-empty">No patch available for this artifact.</div>;
  }

  const lines = patch.split('\n');

  return (
    <div className="diff-viewer">
      <div className="diff-toolbar">
        <button
          onClick={() => {
            void navigator.clipboard.writeText(patch);
          }}
        >
          Copy diff
        </button>
        <span className="diff-stats">
          +{lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length}
          {' / '}
          -{lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length}
        </span>
      </div>
      <pre className="diff-content">
        {lines.map((line, i) => (
          <div key={i} className={`diff-line diff-line-${classifyLine(line)}`}>
            <span className="diff-line-number">{i + 1}</span>
            <span className="diff-line-text">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
```

- [ ] **Step 2: Add DiffViewer CSS to styles.css**

Append to `src/renderer/src/styles.css`:

```css
.diff-viewer {
  border: 1px solid rgba(18, 32, 51, 0.1);
  border-radius: 14px;
  overflow: hidden;
}

.diff-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #f5f7fa;
  border-bottom: 1px solid rgba(18, 32, 51, 0.08);
}

.diff-toolbar button {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
}

.diff-stats {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: #4c5f7c;
}

.diff-content {
  margin: 0;
  padding: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-x: auto;
}

.diff-line {
  display: flex;
  padding: 0 0.5rem;
}

.diff-line-number {
  width: 3rem;
  text-align: right;
  padding-right: 0.75rem;
  color: #8b9ab8;
  user-select: none;
  flex-shrink: 0;
}

.diff-line-text {
  white-space: pre;
}

.diff-line-added {
  background: #e6ffe6;
  color: #1a5c1a;
}

.diff-line-removed {
  background: #ffe6e6;
  color: #8b1a1a;
}

.diff-line-header {
  background: #eef2ff;
  color: #3d4f7c;
  font-weight: 600;
}

.diff-line-context {
  background: transparent;
}

.diff-empty {
  padding: 2rem;
  text-align: center;
  color: #4c5f7c;
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd "D:\ccgl room" && npx tsc --noEmit && npm run build`
Expected: Both pass

- [ ] **Step 4: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/DiffViewer.tsx src/renderer/src/styles.css
git commit -m "feat: add DiffViewer component with line-level add/remove highlighting"
```

---

### Task 6: Create ArtifactViewer component

**Files:**
- Create: `src/renderer/src/components/ArtifactViewer.tsx`

- [ ] **Step 1: Create `src/renderer/src/components/ArtifactViewer.tsx`**

Tabbed viewer for a single artifact. Tabs: Overview, Prompt, Patch, Logs, Findings, Commands.

```tsx
import { useState } from 'react';

import type { ArtifactBundle } from '@shared/types';

import { DiffViewer } from './DiffViewer';

type ArtifactTab = 'overview' | 'prompt' | 'patch' | 'logs' | 'findings' | 'commands';

const TABS: { id: ArtifactTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'patch', label: 'Patch' },
  { id: 'logs', label: 'Logs' },
  { id: 'findings', label: 'Findings' },
  { id: 'commands', label: 'Commands' }
];

interface ArtifactViewerProps {
  artifact: ArtifactBundle;
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  const [activeTab, setActiveTab] = useState<ArtifactTab>('overview');

  return (
    <div className="artifact-viewer">
      <div className="artifact-header">
        <span className="artifact-agent">{artifact.agentId}</span>
        <span className="artifact-role">{artifact.role}</span>
        <span className="artifact-time">{new Date(artifact.createdAt).toLocaleTimeString()}</span>
      </div>

      <div className="artifact-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`artifact-tab${activeTab === tab.id ? ' artifact-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'findings' && artifact.findings.length > 0 ? ` (${artifact.findings.length})` : ''}
          </button>
        ))}
      </div>

      <div className="artifact-tab-content">
        {activeTab === 'overview' && (
          <div className="artifact-overview">
            <h4>Summary</h4>
            <p>{artifact.summary || 'No summary available.'}</p>
            <h4>Final Message</h4>
            <pre className="artifact-pre">{artifact.finalMessage || 'No final message.'}</pre>
          </div>
        )}

        {activeTab === 'prompt' && (
          <pre className="artifact-pre">{artifact.prompt}</pre>
        )}

        {activeTab === 'patch' && (
          <DiffViewer patch={artifact.patch} />
        )}

        {activeTab === 'logs' && (
          <div className="artifact-logs">
            <h4>stdout</h4>
            <pre className="artifact-pre">{artifact.stdout || '(empty)'}</pre>
            <h4>stderr</h4>
            <pre className="artifact-pre artifact-stderr">{artifact.stderr || '(empty)'}</pre>
          </div>
        )}

        {activeTab === 'findings' && (
          <div className="artifact-findings-list">
            {artifact.findings.length === 0 ? (
              <p className="empty-state">No findings from this artifact.</p>
            ) : (
              artifact.findings.map((finding, i) => (
                <article key={i} className={`finding finding-${finding.severity}`}>
                  <h4>{finding.title}</h4>
                  <p>{finding.body}</p>
                  {finding.file ? (
                    <span className="finding-location">
                      {finding.file}
                      {finding.line ? `:${finding.line}` : ''}
                    </span>
                  ) : null}
                  {finding.recommendedAction ? (
                    <p className="finding-action">{finding.recommendedAction}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === 'commands' && (
          <div className="artifact-commands">
            {artifact.commandRuns.length === 0 ? (
              <p className="empty-state">No commands were run.</p>
            ) : (
              artifact.commandRuns.map((cmd, i) => (
                <div key={i} className="command-run">
                  <code className="command-line">$ {cmd.command}</code>
                  <span className={`command-exit ${cmd.exitCode === 0 ? 'exit-ok' : 'exit-fail'}`}>
                    exit {cmd.exitCode ?? '?'}
                  </span>
                  {cmd.stdout ? <pre className="artifact-pre">{cmd.stdout}</pre> : null}
                  {cmd.stderr ? <pre className="artifact-pre artifact-stderr">{cmd.stderr}</pre> : null}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add ArtifactViewer CSS to styles.css**

Append to `src/renderer/src/styles.css`:

```css
.artifact-viewer {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(18, 32, 51, 0.1);
  border-radius: 20px;
  overflow: hidden;
}

.artifact-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f5f7fa;
  border-bottom: 1px solid rgba(18, 32, 51, 0.08);
  font-size: 0.85rem;
}

.artifact-agent {
  font-weight: 600;
  text-transform: capitalize;
}

.artifact-role {
  background: #e0e9f5;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
  font-size: 0.75rem;
}

.artifact-time {
  color: #4c5f7c;
  margin-left: auto;
}

.artifact-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(18, 32, 51, 0.08);
  overflow-x: auto;
}

.artifact-tab {
  padding: 0.6rem 1rem;
  border-radius: 0;
  background: transparent;
  color: #4c5f7c;
  font-size: 0.85rem;
  border-bottom: 2px solid transparent;
}

.artifact-tab:hover {
  background: #f5f7fa;
  color: #122033;
}

.artifact-tab-active {
  color: #1955d6;
  border-bottom-color: #1955d6;
  background: transparent;
}

.artifact-tab-content {
  padding: 1rem;
  max-height: 500px;
  overflow-y: auto;
}

.artifact-pre {
  background: #f5f7fa;
  padding: 0.75rem;
  border-radius: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.artifact-stderr {
  background: #fff5f5;
  color: #8b1a1a;
}

.artifact-overview h4 {
  margin: 0.75rem 0 0.35rem;
}

.artifact-overview h4:first-child {
  margin-top: 0;
}

.finding-location {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #4c5f7c;
}

.finding-action {
  font-style: italic;
  color: #1955d6;
  margin: 0.25rem 0 0;
}

.command-run {
  margin-bottom: 1rem;
  border: 1px solid rgba(18, 32, 51, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.command-line {
  display: block;
  padding: 0.5rem 0.75rem;
  background: #101826;
  color: #d8e1f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
}

.command-exit {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  margin: 0.35rem 0.75rem;
  border-radius: 6px;
}

.exit-ok {
  background: #e6ffe6;
  color: #1a5c1a;
}

.exit-fail {
  background: #ffe6e6;
  color: #8b1a1a;
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd "D:\ccgl room" && npx tsc --noEmit && npm run build`
Expected: Both pass

- [ ] **Step 4: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/ArtifactViewer.tsx src/renderer/src/styles.css
git commit -m "feat: add ArtifactViewer with tabbed inspection (overview, prompt, patch, logs, findings, commands)"
```

---

### Task 7: Create FindingsPanel component

**Files:**
- Create: `src/renderer/src/components/FindingsPanel.tsx`

- [ ] **Step 1: Create `src/renderer/src/components/FindingsPanel.tsx`**

Rich findings list with severity badges and multi-agent handoff action buttons.

Also creates a `HandoffActions` component (declared in file structure) embedded at the bottom of FindingsPanel.

```tsx
import type { Finding, TaskRun, WorkflowId } from '@shared/types';

import { HandoffActions } from './HandoffActions';
import { useWorkbenchStore } from '../store';

const SEVERITY_ICONS: Record<Finding['severity'], string> = {
  critical: '\u26D4',
  high: '\u26A0\uFE0F',
  medium: '\u2139\uFE0F',
  low: '\u2022',
  info: '\u25CB'
};

interface FindingsPanelProps {
  task: TaskRun | undefined;
}

export function FindingsPanel({ task }: FindingsPanelProps) {
  const findings = task?.findings ?? [];

  if (!task) {
    return (
      <section className="card">
        <h2>Findings</h2>
        <p className="empty-state">Select a task to see findings.</p>
      </section>
    );
  }

  const criticalCount = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;

  return (
    <section className="card">
      <div className="findings-header">
        <h2>Findings ({findings.length})</h2>
        {criticalCount > 0 ? (
          <span className="findings-critical-badge">{criticalCount} critical/high</span>
        ) : null}
      </div>

      {findings.length === 0 ? (
        <p className="empty-state">No findings yet.</p>
      ) : (
        <>
          {findings.map((finding, index) => (
            <article key={`${finding.sourceAgent}-${index}`} className={`finding finding-${finding.severity}`}>
              <div className="finding-title-row">
                <span className="finding-icon">{SEVERITY_ICONS[finding.severity]}</span>
                <h4>{finding.title}</h4>
              </div>
              <p>{finding.body}</p>
              {finding.file ? (
                <span className="finding-location">
                  {finding.file}
                  {finding.line ? `:${finding.line}` : ''}
                </span>
              ) : null}
              <span className="finding-source">from {finding.sourceAgent}</span>
            </article>
          ))}

          <HandoffActions task={task} findings={findings} />
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 1b: Create `src/renderer/src/components/HandoffActions.tsx`**

Cross-agent handoff buttons. Each button creates a new workflow with a structured brief that includes the findings context.

```tsx
import type { Finding, TaskRun, WorkflowId } from '@shared/types';

import { useWorkbenchStore } from '../store';

interface HandoffActionsProps {
  task: TaskRun;
  findings: Finding[];
}

function formatFindingsBrief(taskId: string, findings: Finding[]): string {
  return `Fix these findings from task ${taskId.slice(0, 8)}:\n${findings.map((f) => `- [${f.severity}] ${f.title}: ${f.body}`).join('\n')}`;
}

export function HandoffActions({ task, findings }: HandoffActionsProps) {
  const startWorkflow = useWorkbenchStore((state) => state.startWorkflow);

  return (
    <div className="handoff-actions">
      <strong className="handoff-label">Handoff actions</strong>
      <div className="handoff-buttons">
        <button
          className="handoff-btn handoff-claude"
          onClick={() => {
            void startWorkflow({
              brief: formatFindingsBrief(task.id, findings),
              workflowId: 'code-review-fix-verify'
            });
          }}
        >
          Send to Claude for fix
        </button>
        <button
          className="handoff-btn handoff-codex"
          onClick={() => {
            void startWorkflow({
              brief: `Verify the latest changes for task ${task.id.slice(0, 8)}. Check for regressions and run tests.`,
              workflowId: 'code-review-fix-verify'
            });
          }}
        >
          Ask Codex to verify
        </button>
        <button
          className="handoff-btn handoff-gemini"
          onClick={() => {
            void startWorkflow({
              brief: `Review the architecture of task ${task.id.slice(0, 8)}: ${task.brief}\n\nFindings so far:\n${findings.map((f) => `- ${f.title}`).join('\n')}`,
              workflowId: 'code-gemini-compare-codex-review'
            });
          }}
        >
          Ask Gemini for review
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add FindingsPanel CSS to styles.css**

Append to `src/renderer/src/styles.css`:

```css
.findings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.findings-critical-badge {
  background: #ffe0e0;
  color: #8b1a1a;
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  font-weight: 600;
}

.finding-title-row {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
}

.finding-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.finding-source {
  font-size: 0.75rem;
  color: #4c5f7c;
  display: block;
  margin-top: 0.25rem;
}

.findings-actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.findings-actions button {
  font-size: 0.8rem;
  padding: 0.5rem 0.75rem;
}

.handoff-actions {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(18, 32, 51, 0.1);
}

.handoff-label {
  display: block;
  font-size: 0.8rem;
  color: #4c5f7c;
  margin-bottom: 0.5rem;
}

.handoff-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.handoff-btn {
  font-size: 0.8rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.handoff-claude { background: #7C3AED; }
.handoff-claude:hover { background: #6D28D9; }
.handoff-codex { background: #059669; }
.handoff-codex:hover { background: #047857; }
.handoff-gemini { background: #2563EB; }
.handoff-gemini:hover { background: #1D4ED8; }
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd "D:\ccgl room" && npx tsc --noEmit && npm run build`
Expected: Both pass

- [ ] **Step 4: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/FindingsPanel.tsx src/renderer/src/components/HandoffActions.tsx src/renderer/src/styles.css
git commit -m "feat: add FindingsPanel with severity badges and multi-agent handoff actions"
```

---

### Task 8: Create TaskDetailPanel component

**Files:**
- Create: `src/renderer/src/components/TaskDetailPanel.tsx`

- [ ] **Step 1: Create `src/renderer/src/components/TaskDetailPanel.tsx`**

Central detail pane showing the selected task's full information: step timeline, artifact list (clickable), and approval controls.

```tsx
import type { ArtifactBundle, TaskRun } from '@shared/types';

import { ArtifactViewer } from './ArtifactViewer';
import { useWorkbenchStore } from '../store';

interface TaskDetailPanelProps {
  task: TaskRun | undefined;
}

export function TaskDetailPanel({ task }: TaskDetailPanelProps) {
  const selectedArtifactId = useWorkbenchStore((state) => state.selectedArtifactId);
  const selectArtifact = useWorkbenchStore((state) => state.selectArtifact);
  const promoteTask = useWorkbenchStore((state) => state.promoteTask);

  if (!task) {
    return (
      <div className="detail-panel detail-panel-empty">
        <p>Select a task from the left rail to inspect it.</p>
      </div>
    );
  }

  const selectedArtifact = task.artifacts.find((a) => a.id === selectedArtifactId) ?? task.artifacts[0];

  return (
    <div className="detail-panel">
      <div className="detail-summary">
        <div className="detail-summary-header">
          <h2>{task.brief}</h2>
          <div className="detail-badges">
            <span className={`stage-badge stage-${task.stage}`}>{task.stage}</span>
            <span className={`approval-badge approval-${task.approvalState}`}>{task.approvalState}</span>
          </div>
        </div>
        <div className="detail-meta">
          <span>Workflow: {task.workflowId}</span>
          <span>Branch: {task.branchName}</span>
          <span>{task.findings.length} findings</span>
          <span>{task.artifacts.length} artifacts</span>
        </div>

        {task.stage === 'promote' ? (
          <div className="detail-promote">
            <strong>Ready to promote</strong>
            <div className="task-actions">
              <button onClick={() => void promoteTask(task.id, 'apply-to-main')}>Apply to main</button>
              <button onClick={() => void promoteTask(task.id, 'keep-worktree')}>Keep worktree</button>
              <button onClick={() => void promoteTask(task.id, 'open-task-branch')}>Open task branch</button>
            </div>
          </div>
        ) : null}

        {task.errorMessage ? (
          <p className="error-banner">{task.errorMessage}</p>
        ) : null}
      </div>

      <div className="detail-steps">
        <h3>Steps</h3>
        <div className="steps-timeline">
          {task.steps.map((step) => (
            <div key={step.id} className={`step-item step-${step.status}`}>
              <span className="step-stage">{step.stage}</span>
              <span className="step-agent">{step.agentId}</span>
              <span className="step-status">{step.status}</span>
              {step.summary ? <p className="step-summary">{step.summary}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="detail-artifacts">
        <h3>Artifacts</h3>
        <div className="artifact-list">
          {task.artifacts.map((artifact) => (
            <button
              key={artifact.id}
              className={`artifact-list-item${artifact.id === selectedArtifact?.id ? ' artifact-list-item-active' : ''}`}
              onClick={() => selectArtifact(artifact.id)}
            >
              <span className="artifact-list-agent">{artifact.agentId}</span>
              <span className="artifact-list-role">{artifact.role}</span>
              <span className="artifact-list-time">{new Date(artifact.createdAt).toLocaleTimeString()}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedArtifact ? (
        <ArtifactViewer artifact={selectedArtifact} />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Add TaskDetailPanel CSS to styles.css**

Append to `src/renderer/src/styles.css`:

```css
.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-panel-empty {
  display: grid;
  place-items: center;
  min-height: 200px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(18, 32, 51, 0.1);
  border-radius: 20px;
  color: #4c5f7c;
}

.detail-summary {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(18, 32, 51, 0.1);
  border-radius: 20px;
  padding: 1rem;
}

.detail-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.detail-badges {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.approval-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-weight: 600;
  text-transform: uppercase;
}

.approval-pending { background: #fff3e0; color: #b45309; }
.approval-approved { background: #d1fae5; color: #065f46; }
.approval-rejected { background: #ffe0e0; color: #8b1a1a; }
.approval-not-required { background: #f5f7fa; color: #4c5f7c; }

.detail-summary-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.stage-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
}

.stage-brief { background: #eef2ff; color: #3d4f7c; }
.stage-code { background: #e6f4ff; color: #0d5aa7; }
.stage-review { background: #fff3e0; color: #b45309; }
.stage-findings { background: #fff0f0; color: #8b1a1a; }
.stage-fix { background: #fef3c7; color: #92400e; }
.stage-verify { background: #e0f2fe; color: #075985; }
.stage-promote { background: #d1fae5; color: #065f46; }
.stage-done { background: #d1fae5; color: #065f46; }
.stage-error { background: #ffe0e0; color: #8b1a1a; }

.detail-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #4c5f7c;
}

.detail-promote {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #d1fae5;
  border-radius: 12px;
}

.detail-promote strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #065f46;
}

.detail-steps h3,
.detail-artifacts h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.steps-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  font-size: 0.85rem;
}

.step-completed { background: #f0fdf4; }
.step-running { background: #eff6ff; }
.step-failed { background: #fef2f2; }
.step-queued { background: #f5f7fa; }

.step-stage { font-weight: 600; min-width: 4rem; }
.step-agent { color: #4c5f7c; min-width: 4rem; }
.step-status { font-size: 0.75rem; color: #4c5f7c; }
.step-summary { margin: 0.25rem 0 0; color: #4c5f7c; font-size: 0.8rem; }

.artifact-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.artifact-list-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  background: #f5f7fa;
  text-align: left;
  font-size: 0.85rem;
  color: #122033;
}

.artifact-list-item:hover {
  background: #e8edf5;
}

.artifact-list-item-active {
  background: #dbe4f0;
  border: 1px solid #1955d6;
}

.artifact-list-agent { font-weight: 600; text-transform: capitalize; }
.artifact-list-role { color: #4c5f7c; }
.artifact-list-time { margin-left: auto; color: #4c5f7c; font-size: 0.75rem; }

.task-card-selected {
  border-color: #1955d6;
  box-shadow: 0 0 0 1px #1955d6;
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd "D:\ccgl room" && npx tsc --noEmit && npm run build`
Expected: Both pass

- [ ] **Step 4: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/components/TaskDetailPanel.tsx src/renderer/src/styles.css
git commit -m "feat: add TaskDetailPanel with step timeline, artifact list, and approval controls"
```

---

## Chunk 3: Wire Everything Into App.tsx

### Task 9: Restructure App.tsx layout to use all new components

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx with extracted components and two-layer center**

Replace the current App.tsx with the refactored version. The center area now has the agent grid on top and TaskDetailPanel below. The right rail uses FindingsPanel. All inline component definitions are gone.

```tsx
import { useEffect, useState } from 'react';

import type { AgentProfile } from '@shared/types';
import { WORKFLOW_DEFINITIONS } from '@shared/workflows';

import { AgentPanel } from './components/AgentPanel';
import { FindingsPanel } from './components/FindingsPanel';
import { TaskCard } from './components/TaskCard';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { useWorkbenchStore } from './store';

import '@xterm/xterm/css/xterm.css';
import './styles.css';

export default function App() {
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const error = useWorkbenchStore((state) => state.error);
  const isBusy = useWorkbenchStore((state) => state.isBusy);
  const selectedTaskId = useWorkbenchStore((state) => state.selectedTaskId);
  const bootstrap = useWorkbenchStore((state) => state.bootstrap);
  const applySnapshot = useWorkbenchStore((state) => state.applySnapshot);
  const appendTerminalData = useWorkbenchStore((state) => state.appendTerminalData);
  const selectProject = useWorkbenchStore((state) => state.selectProject);
  const probeAgents = useWorkbenchStore((state) => state.probeAgents);
  const setProjectRunner = useWorkbenchStore((state) => state.setProjectRunner);
  const startWorkflow = useWorkbenchStore((state) => state.startWorkflow);
  const promoteTask = useWorkbenchStore((state) => state.promoteTask);
  const selectTask = useWorkbenchStore((state) => state.selectTask);
  const setOllamaRole = useWorkbenchStore((state) => state.setOllamaRole);
  const shutdownOllama = useWorkbenchStore((state) => state.shutdownOllama);
  const setProjectArchiveEnabled = useWorkbenchStore((state) => state.setProjectArchiveEnabled);
  const saveProjectArchive = useWorkbenchStore((state) => state.saveProjectArchive);
  const openProjectArchive = useWorkbenchStore((state) => state.openProjectArchive);

  const [brief, setBrief] = useState('Add a safe, testable feature and have Codex review it for bugs.');
  const [workflowId, setWorkflowId] = useState(WORKFLOW_DEFINITIONS[0].id);
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:7b');

  useEffect(() => {
    void bootstrap();
    const unsubState = window.workbench.onState((nextSnapshot) => applySnapshot(nextSnapshot));
    const unsubTerminal = window.workbench.onTerminalData(({ sessionId, data }) => appendTerminalData(sessionId, data));
    return () => {
      unsubState();
      unsubTerminal();
    };
  }, [appendTerminalData, applySnapshot, bootstrap]);

  if (!snapshot) {
    return <div className="loading-screen">Booting Triad Workbench...</div>;
  }

  const selectedTask = snapshot.tasks.find((t) => t.id === selectedTaskId) ?? snapshot.tasks[0];

  return (
    <div className="shell">
      <header className="top-bar">
        <div>
          <h1>Triad Workbench</h1>
          <p>{snapshot.project ? `${snapshot.project.name} - ${snapshot.project.currentBranch || 'no branch'}` : 'No project selected'}</p>
        </div>
        <div className="top-actions">
          <button onClick={() => void selectProject()}>Open project</button>
          <select
            value={snapshot.project?.runnerPreference ?? 'auto'}
            onChange={(event) => void setProjectRunner(event.target.value as 'auto' | 'windows' | 'wsl')}
          >
            <option value="auto">Auto runner</option>
            <option value="windows">Windows</option>
            <option value="wsl">WSL</option>
          </select>
          <button onClick={() => void probeAgents(true)}>Probe agents</button>
        </div>
      </header>

      <main className="layout">
        <aside className="left-rail">
          <section className="card">
            <h2>Workflows</h2>
            <div className="workflow-list">
              {WORKFLOW_DEFINITIONS.map((workflow) => (
                <button
                  key={workflow.id}
                  className={workflowId === workflow.id ? 'selected' : ''}
                  onClick={() => setWorkflowId(workflow.id)}
                >
                  <strong>{workflow.label}</strong>
                  <span>{workflow.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Tasks</h2>
            {snapshot.tasks.length ? (
              snapshot.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTask?.id}
                  onSelect={() => selectTask(task.id)}
                  onPromote={(action) => void promoteTask(task.id, action)}
                />
              ))
            ) : (
              <p className="empty-state">No tasks yet.</p>
            )}
          </section>
        </aside>

        <section className="center-area">
          <div className="center-grid">
            {(Object.values(snapshot.agents) as AgentProfile[]).map((agent) => (
              <AgentPanel key={agent.id} agent={agent} />
            ))}
          </div>

          <TaskDetailPanel task={selectedTask} />
        </section>

        <aside className="right-rail">
          <FindingsPanel task={selectedTask} />

          <section className="card">
            <h2>Ollama</h2>
            <p>{snapshot.ollama.message || 'Ollama is idle.'}</p>
            <input value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)} placeholder="Model name" />
            <button onClick={() => void setOllamaRole('monitor', ollamaModel)}>Start monitor</button>
            <button onClick={() => void shutdownOllama()}>Turn off Ollama</button>
          </section>

          <section className="card">
            <h2>Project Archive</h2>
            {snapshot.project ? (
              <>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={snapshot.project.archiveEnabled}
                    onChange={(event) => void setProjectArchiveEnabled(event.target.checked)}
                  />
                  <span>Auto-save every prompt, log, task, transcript, and artifact for this project.</span>
                </label>
                <div className="archive-path">
                  <strong>Folder</strong>
                  <code>{snapshot.archive?.path || snapshot.project.archivePath}</code>
                </div>
                <p className="panel-message">
                  Triad stores snapshots, task JSON, prompts, stdout, stderr, diffs, and terminal transcripts inside this project folder.
                </p>
                <p className="archive-meta">
                  {snapshot.archive?.lastSavedAt
                    ? `Last saved ${new Date(snapshot.archive.lastSavedAt).toLocaleString()}`
                    : 'No archive snapshot has been saved yet.'}
                </p>
                <div className="panel-actions">
                  <button onClick={() => void saveProjectArchive()} disabled={!snapshot.project.archiveEnabled}>
                    Save now
                  </button>
                  <button onClick={() => void openProjectArchive()}>Open folder</button>
                </div>
              </>
            ) : (
              <p className="empty-state">Select a project to create its archive folder.</p>
            )}
          </section>

          <section className="card">
            <h2>Notifications</h2>
            {snapshot.notifications.length ? (
              snapshot.notifications.map((notification) => <p key={notification}>{notification}</p>)
            ) : (
              <p className="empty-state">No notifications yet.</p>
            )}
          </section>
        </aside>
      </main>

      <footer className="bottom-dock">
        <div className="composer">
          <div className="composer-header">
            <span>{WORKFLOW_DEFINITIONS.find((workflow) => workflow.id === workflowId)?.label}</span>
            {isBusy ? <span className="busy-indicator">Working...</span> : null}
          </div>
          <textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Describe the task for your agents." />
          <div className="composer-actions">
            <button
              onClick={() =>
                void startWorkflow({
                  brief,
                  workflowId
                })
              }
            >
              Run workflow
            </button>
          </div>
          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Update layout CSS for two-layer center**

In `src/renderer/src/styles.css`, update the `.layout` grid to use `.center-area` instead of `.center-grid` at the top level:

Find and replace the `.layout` rule:

```css
.layout {
  display: grid;
  grid-template-columns: 300px 1fr 320px;
  gap: 1rem;
  padding: 1rem 1.5rem;
  overflow-y: auto;
}

.center-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify build passes**

Run: `cd "D:\ccgl room" && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Verify tests still pass**

Run: `cd "D:\ccgl room" && npm test`
Expected: 4 tests pass (parsing + path-mapping tests unaffected)

- [ ] **Step 6: Commit**

```bash
cd "D:\ccgl room"
git add src/renderer/src/App.tsx src/renderer/src/styles.css
git commit -m "feat: wire review center layout with TaskDetailPanel, FindingsPanel, and extracted components"
```

---

### Task 10: Final verification and cleanup

**Files:**
- All new components in `src/renderer/src/components/`
- `src/renderer/src/App.tsx`
- `src/renderer/src/store.ts`
- `src/renderer/src/styles.css`

- [ ] **Step 1: Run full typecheck**

Run: `cd "D:\ccgl room" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `cd "D:\ccgl room" && npm test`
Expected: 4 tests pass

- [ ] **Step 3: Run production build**

Run: `cd "D:\ccgl room" && npm run build`
Expected: Build succeeds, output in `out/`

- [ ] **Step 4: Verify no unused imports or dead code**

Manually check each new component file has no unused imports. Check App.tsx no longer has inline component definitions.

- [ ] **Step 5: Commit final state**

```bash
cd "D:\ccgl room"
git add -A
git commit -m "chore: phase 2 review center complete - cleanup and verification"
```

---

## Summary of Deliverables

| Component | What it does |
|-----------|-------------|
| **TerminalPane** | Extracted xterm.js terminal (no logic change) |
| **AgentPanel** | Extracted agent card with terminal + role select |
| **TaskCard** | Task card with selection, stage badge, promote actions |
| **DiffViewer** | Monospace patch viewer with add/remove highlighting, copy button |
| **ArtifactViewer** | 6-tab artifact inspector (Overview, Prompt, Patch, Logs, Findings, Commands) |
| **FindingsPanel** | Rich findings list with severity icons + HandoffActions integration |
| **HandoffActions** | Cross-agent handoff buttons: Send to Claude, Ask Codex to verify, Ask Gemini for review |
| **TaskDetailPanel** | Full task inspection with step timeline, artifact list, approval state badge, approval center |
| **Store additions** | `selectedTaskId`, `selectedArtifactId`, `selectTask()`, `selectArtifact()` |
| **App.tsx refactor** | Two-layer center (grid + detail), extracted components, review rail |

**Total new files:** 8 components (TerminalPane, AgentPanel, TaskCard, DiffViewer, ArtifactViewer, FindingsPanel, HandoffActions, TaskDetailPanel)
**Modified files:** 3 (App.tsx, store.ts, styles.css)
**Backend changes:** 0
