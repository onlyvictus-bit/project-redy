# Triad Workbench Source Reference

This file is a generated Markdown reference dump of the current Triad Workbench source and key text/config files.

Included: source, renderer, preload, shared contracts, design preview, and project docs/config.
Excluded: `node_modules`, `out`, `package-lock.json`, and binary assets like PNG files.

Generated: 2026-03-14 23:21:20 +05:30

## Included Files

- `.gitignore`
- `design-preview\index.html`
- `design-preview\styles.css`
- `electron.vite.config.ts`
- `package.json`
- `README.md`
- `src\main\app-controller.ts`
- `src\main\connectors\base.ts`
- `src\main\connectors\claude-connector.ts`
- `src\main\connectors\codex-connector.ts`
- `src\main\connectors\gemini-connector.ts`
- `src\main\connectors\index.ts`
- `src\main\connectors\ollama-connector.ts`
- `src\main\index.ts`
- `src\main\services\ollama-manager.ts`
- `src\main\services\persistence.ts`
- `src\main\services\process-runner.ts`
- `src\main\services\project-archive.ts`
- `src\main\services\terminal-manager.ts`
- `src\main\services\workflow-engine.ts`
- `src\main\services\workspace-manager.ts`
- `src\main\utils\parsing.test.ts`
- `src\main\utils\parsing.ts`
- `src\main\utils\path-mapping.test.ts`
- `src\main\utils\path-mapping.ts`
- `src\main\utils\prompts.ts`
- `src\preload\index.ts`
- `src\renderer\index.html`
- `src\renderer\src\App.tsx`
- `src\renderer\src\main.tsx`
- `src\renderer\src\store.ts`
- `src\renderer\src\styles.css`
- `src\renderer\src\vite-env.d.ts`
- `src\shared\ipc.ts`
- `src\shared\types.ts`
- `src\shared\workflows.ts`
- `TRIAD_WORKBENCH_AI_CONTEXT.md`
- `TRIAD_WORKBENCH_BUILD_GUIDE.md`
- `tsconfig.json`
- `vitest.config.ts`

## File Contents

### .gitignore

```gitignore
node_modules
dist
out
release
.vite
coverage
*.log
*.db
*.db-shm
*.db-wal
tmp

```

### design-preview\index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Triad Workbench Preview</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">T</div>
          <div>
            <div class="brand-title">Triad</div>
            <div class="brand-subtitle">Workbench</div>
          </div>
        </div>

        <div class="context-strip">
          <div class="context-pill">
            <span class="context-label">Project</span>
            <strong>browser-agent</strong>
          </div>
          <div class="context-pill accent-teal">
            <span class="context-label">Branch</span>
            <strong>main</strong>
          </div>
          <div class="context-pill accent-gold">
            <span class="context-label">Mode</span>
            <strong>Auto Orchestrate</strong>
          </div>
        </div>

        <div class="status-cluster">
          <div class="status-chip online">Claude</div>
          <div class="status-chip online">Codex</div>
          <div class="status-chip warm">Gemini</div>
          <div class="status-chip monitor">Ollama</div>
        </div>
      </header>

      <main class="dashboard">
        <aside class="left-rail">
          <section class="rail-card">
            <div class="section-title">Active Tasks</div>
            <div class="task-stack">
              <article class="task-card task-live">
                <div class="task-title-row">
                  <strong>#12 Rate Limiter</strong>
                  <span>02m</span>
                </div>
                <p>Claude coding in isolated worktree. Codex review queued.</p>
                <div class="task-tag-row">
                  <span class="mini-tag coding">coding</span>
                  <span class="mini-tag review">review next</span>
                </div>
              </article>

              <article class="task-card">
                <div class="task-title-row">
                  <strong>#13 Auth Fix</strong>
                  <span>queued</span>
                </div>
                <p>Gemini architecture compare before Claude starts implementation.</p>
              </article>

              <article class="task-card">
                <div class="task-title-row">
                  <strong>#14 Cache Strategy</strong>
                  <span>watching</span>
                </div>
                <p>Ollama monitor waiting for test failures or stalled progress.</p>
              </article>
            </div>
          </section>

          <section class="rail-card">
            <div class="section-title">Workflow Library</div>
            <button class="workflow-button selected">Code -> Review -> Fix</button>
            <button class="workflow-button">Claude -> Gemini -> Codex</button>
            <button class="workflow-button">Architecture Compare</button>
            <button class="workflow-button">Away Monitor</button>
          </section>

          <section class="rail-card">
            <div class="section-title">Workspace</div>
            <div class="workspace-tree">
              <div class="tree-folder">core/</div>
              <div class="tree-folder">auth/</div>
              <div class="tree-file active">ratelimit.py</div>
              <div class="tree-file">jwt.py</div>
              <div class="tree-folder">tests/</div>
              <div class="tree-file">monitor.py</div>
            </div>
          </section>
        </aside>

        <section class="center-grid">
          <article class="agent-panel claude">
            <div class="agent-header">
              <div>
                <div class="agent-name">Claude Code</div>
                <div class="agent-meta">Role: coder</div>
              </div>
              <div class="agent-state">live</div>
            </div>
            <div class="terminal">
              <div class="terminal-line prompt">$ claude -p "Implement rate limiting" --output-format stream-json</div>
              <div class="terminal-line gold">[Analyzing repo layout...]</div>
              <div class="terminal-line soft">[Reading auth/middleware.py]</div>
              <div class="terminal-line teal">[Editing auth/ratelimit.py +45 lines]</div>
              <div class="terminal-gap"></div>
              <div class="terminal-line success">[ok] Token bucket class created</div>
              <div class="terminal-line success">[ok] Middleware integration added</div>
              <div class="terminal-line warn">Pending approval before promote</div>
              <div class="terminal-gap"></div>
              <div class="terminal-line patch">+ class TokenBucket:</div>
              <div class="terminal-line patch">+   def acquire(self):</div>
              <div class="terminal-line patch">+     with self._lock:</div>
            </div>
          </article>

          <article class="agent-panel codex">
            <div class="agent-header">
              <div>
                <div class="agent-name">Codex CLI</div>
                <div class="agent-meta">Role: tester / reviewer</div>
              </div>
              <div class="agent-state">verifying</div>
            </div>
            <div class="terminal">
              <div class="terminal-line prompt">$ codex exec --json "Review current diff and run tests"</div>
              <div class="terminal-line soft">[Reviewing auth/ratelimit.py]</div>
              <div class="terminal-gap"></div>
              <div class="terminal-line warn">Found 3 issues</div>
              <div class="terminal-line">- Race condition in acquire() without lock</div>
              <div class="terminal-line">- Missing null guard for token state</div>
              <div class="terminal-line">- No regression test for burst exhaustion</div>
              <div class="terminal-gap"></div>
              <div class="terminal-line success">Tests: 12 / 12 passing</div>
              <div class="terminal-line teal">Structured findings ready for handoff</div>
            </div>
          </article>

          <article class="agent-panel ollama">
            <div class="agent-header">
              <div>
                <div class="agent-name">Ollama</div>
                <div class="agent-meta">Role: monitor</div>
              </div>
              <div class="agent-state">qwen2.5-coder:7b</div>
            </div>
            <div class="terminal">
              <div class="terminal-line soft">[Monitoring task #12 for stalls and failures]</div>
              <div class="terminal-gap"></div>
              <div class="terminal-line">Status: Claude active for 2m 14s</div>
              <div class="terminal-line">Progress: 2 files changed in worktree</div>
              <div class="terminal-gap"></div>
              <div class="terminal-line success">Analysis: implementation direction looks stable</div>
              <div class="terminal-line">Watching for failed verify step or branch conflicts...</div>
            </div>
          </article>

          <article class="agent-panel gemini">
            <div class="agent-header">
              <div>
                <div class="agent-name">Gemini CLI</div>
                <div class="agent-meta">Role: architect / compare</div>
              </div>
              <div class="agent-state warm-state">ready</div>
            </div>
            <div class="empty-panel">
              <div class="plus">+</div>
              <h3>Compare Design Options</h3>
              <p>Use Gemini as a free reviewer, architecture partner, or backup coder in a custom chain.</p>
            </div>
          </article>
        </section>

        <aside class="right-rail">
          <section class="rail-card handoffs">
            <div class="section-title">Cross-Agent Handoffs</div>
            <article class="handoff-card blue">
              <div>
                <strong>Codex found 3 issues</strong>
                <p>Send structured findings to Claude for fix pass.</p>
              </div>
              <span>-></span>
            </article>
            <article class="handoff-card amber">
              <div>
                <strong>Claude proposed patch</strong>
                <p>Queue Codex verify and optional Gemini compare.</p>
              </div>
              <span>-></span>
            </article>
          </section>

          <section class="rail-card approvals">
            <div class="section-title">Pending Approval</div>
            <div class="approval-card">
              <div class="approval-meta">
                <strong>auth/ratelimit.py</strong>
                <span>+12 lines / -3 lines</span>
              </div>
              <div class="diff-preview">
                <div>+ def acquire(self):</div>
                <div>+   with self._lock:</div>
                <div>+     if self.tokens is None:</div>
              </div>
              <div class="approval-actions">
                <button class="apply">Apply</button>
                <button class="reject">Reject</button>
                <button class="modify">Modify</button>
              </div>
            </div>
          </section>

          <section class="rail-card findings">
            <div class="section-title">Findings</div>
            <div class="finding-item">
              <span class="finding-icon warn-dot"></span>
              <div>
                <strong>Race condition line 23</strong>
                <p>Suggested fix: add lock around token decrement.</p>
              </div>
            </div>
            <div class="finding-item">
              <span class="finding-icon warn-dot"></span>
              <div>
                <strong>Missing null check line 45</strong>
                <p>Guard uninitialized token state before refill.</p>
              </div>
            </div>
            <div class="finding-item">
              <span class="finding-icon good-dot"></span>
              <div>
                <strong>Tests passing</strong>
                <p>12/12 checks green after current fix batch.</p>
              </div>
            </div>
          </section>

          <section class="rail-card artifacts">
            <div class="section-title">Artifacts</div>
            <div class="artifact-row">Patch v1 (Claude)</div>
            <div class="artifact-row">Review set (Codex)</div>
            <div class="artifact-row">Patch v2 (Claude fixed)</div>
            <div class="artifact-row">Monitor notes (Ollama)</div>
          </section>
        </aside>
      </main>

      <footer class="bottom-composer">
        <div class="composer-modes">
          <span class="mode selected">Orchestrate</span>
          <span class="mode">Claude</span>
          <span class="mode">Codex</span>
          <span class="mode">All</span>
          <span class="mode">Chain</span>
        </div>

        <div class="composer-bar">
          <input
            type="text"
            value="Add rate limiting to the API. Claude should code it, Codex should review race conditions, and Ollama should monitor progress."
            readonly
          />
          <button class="ghost-button">Attach Context</button>
          <button class="ghost-button">Voice</button>
          <button class="primary-button">Run Workflow</button>
        </div>
      </footer>
    </div>
  </body>
</html>

```

### design-preview\styles.css

```css
:root {
  --bg: #0b1020;
  --bg-2: #121933;
  --bg-3: #192446;
  --surface: rgba(17, 25, 51, 0.92);
  --surface-soft: rgba(24, 35, 67, 0.88);
  --border: rgba(141, 166, 214, 0.18);
  --text: #edf3ff;
  --muted: #92a2c7;
  --gold: #ffbe6b;
  --teal: #26d6c3;
  --blue: #65a9ff;
  --rose: #ff8277;
  --lime: #7ee787;
  --shadow: 0 22px 60px rgba(0, 0, 0, 0.38);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(73, 106, 255, 0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(38, 214, 195, 0.12), transparent 26%),
    linear-gradient(180deg, #0b1122 0%, #09101c 100%);
  color: var(--text);
  font-family: "Segoe UI Variable", "Segoe UI", "Trebuchet MS", sans-serif;
}

body {
  padding: 10px;
}

.app-shell {
  min-height: calc(100vh - 20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(5, 10, 23, 0.78);
  box-shadow: var(--shadow);
}

.topbar {
  display: grid;
  grid-template-columns: 220px 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 18px 22px;
  background: linear-gradient(180deg, rgba(16, 20, 43, 0.96), rgba(13, 18, 35, 0.94));
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(255, 190, 107, 0.18), rgba(255, 190, 107, 0.06));
  border: 1px solid rgba(255, 190, 107, 0.32);
  color: var(--gold);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.brand-title {
  font-size: 1.65rem;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gold);
  font-weight: 800;
}

.brand-subtitle {
  color: #b6c2dd;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.78rem;
  margin-top: 3px;
}

.context-strip,
.status-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.context-strip {
  justify-content: center;
}

.context-pill,
.status-chip {
  border-radius: 999px;
  padding: 9px 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
}

.context-pill {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.context-label {
  color: var(--muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.accent-teal strong {
  color: var(--teal);
}

.accent-gold strong {
  color: var(--gold);
}

.status-chip {
  position: relative;
  padding-left: 28px;
}

.status-chip::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 12px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translateY(-50%);
  background: currentColor;
  box-shadow: 0 0 16px currentColor;
}

.status-chip.online {
  color: var(--teal);
}

.status-chip.warm {
  color: var(--gold);
}

.status-chip.monitor {
  color: #7ce2ff;
}

.dashboard {
  display: grid;
  grid-template-columns: 300px 1fr 390px;
  gap: 18px;
  padding: 18px;
}

.left-rail,
.right-rail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.rail-card,
.agent-panel {
  background: linear-gradient(180deg, rgba(21, 31, 60, 0.94), rgba(15, 22, 43, 0.96));
  border: 1px solid rgba(117, 144, 196, 0.18);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.rail-card {
  padding: 18px;
}

.section-title {
  margin-bottom: 14px;
  color: #c8d4f0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.84rem;
  font-weight: 700;
}

.task-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.task-card {
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(133, 154, 196, 0.18);
}

.task-live {
  border-color: rgba(255, 190, 107, 0.45);
  box-shadow: inset 0 0 0 1px rgba(255, 190, 107, 0.18);
}

.task-title-row,
.task-tag-row,
.approval-meta,
.approval-actions,
.agent-header,
.composer-bar,
.composer-modes {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-card p,
.handoff-card p,
.finding-item p,
.empty-panel p {
  color: var(--muted);
  margin: 8px 0 0;
  line-height: 1.45;
}

.mini-tag {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mini-tag.coding {
  background: rgba(255, 190, 107, 0.14);
  color: var(--gold);
}

.mini-tag.review {
  background: rgba(101, 169, 255, 0.14);
  color: var(--blue);
}

.workflow-button {
  width: 100%;
  margin-top: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  padding: 14px;
  text-align: left;
}

.workflow-button.selected {
  border-color: rgba(255, 190, 107, 0.42);
  box-shadow: inset 0 0 0 1px rgba(255, 190, 107, 0.2);
}

.workspace-tree {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tree-folder,
.tree-file {
  color: #b7c5e3;
  padding-left: 18px;
  position: relative;
}

.tree-folder::before,
.tree-file::before {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
}

.tree-file.active {
  color: var(--gold);
}

.center-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.agent-panel {
  overflow: hidden;
  min-height: 390px;
}

.agent-header {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.claude .agent-header {
  background: linear-gradient(90deg, rgba(255, 190, 107, 0.17), rgba(255, 190, 107, 0.04));
}

.codex .agent-header {
  background: linear-gradient(90deg, rgba(101, 169, 255, 0.18), rgba(101, 169, 255, 0.04));
}

.ollama .agent-header {
  background: linear-gradient(90deg, rgba(38, 214, 195, 0.18), rgba(38, 214, 195, 0.04));
}

.gemini .agent-header {
  background: linear-gradient(90deg, rgba(255, 190, 107, 0.11), rgba(123, 140, 255, 0.06));
}

.agent-name {
  font-size: 1.2rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.agent-meta,
.agent-state {
  color: var(--muted);
  font-size: 0.86rem;
}

.agent-state {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.warm-state {
  color: var(--gold);
}

.terminal,
.empty-panel {
  min-height: 310px;
  padding: 20px;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.025), transparent 30%),
    #0a0f22;
  font-family: "Cascadia Code", "Consolas", monospace;
  font-size: 0.93rem;
}

.empty-panel {
  display: grid;
  place-items: center;
  text-align: center;
  font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
}

.plus {
  font-size: 4rem;
  font-weight: 200;
  color: rgba(255, 255, 255, 0.5);
}

.terminal-line {
  margin-top: 10px;
  color: #dce7ff;
}

.terminal-line.prompt {
  color: #a9b8d9;
}

.terminal-line.soft {
  color: #97a7cd;
}

.terminal-line.teal,
.artifact-row,
.terminal-line.patch {
  color: var(--teal);
}

.terminal-line.gold,
.terminal-line.warn {
  color: var(--gold);
}

.terminal-line.success {
  color: var(--lime);
}

.terminal-gap {
  height: 18px;
}

.handoff-card,
.approval-card {
  border-radius: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.handoff-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.handoff-card span {
  font-size: 1.6rem;
}

.handoff-card.blue {
  border-color: rgba(101, 169, 255, 0.45);
}

.handoff-card.amber {
  border-color: rgba(255, 190, 107, 0.45);
}

.diff-preview {
  margin-top: 12px;
  padding: 14px;
  border-radius: 14px;
  background: #0a0f22;
  color: var(--teal);
  font-family: "Cascadia Code", "Consolas", monospace;
}

.approval-actions {
  margin-top: 14px;
}

.approval-actions button,
.primary-button,
.ghost-button {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px 16px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.04);
  font-weight: 700;
}

.approval-actions .apply,
.primary-button {
  background: linear-gradient(135deg, #18c3a6, #16a78f);
  border-color: rgba(24, 195, 166, 0.5);
}

.approval-actions .reject {
  background: linear-gradient(135deg, #df5e57, #bb3c35);
  border-color: rgba(223, 94, 87, 0.45);
}

.approval-actions .modify {
  background: rgba(255, 255, 255, 0.08);
}

.finding-item {
  display: flex;
  gap: 12px;
  margin-top: 14px;
}

.finding-icon {
  margin-top: 5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.warn-dot {
  background: var(--gold);
  box-shadow: 0 0 14px rgba(255, 190, 107, 0.5);
}

.good-dot {
  background: var(--teal);
  box-shadow: 0 0 14px rgba(38, 214, 195, 0.4);
}

.artifact-row {
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.artifact-row:first-of-type {
  border-top: none;
}

.bottom-composer {
  padding: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(8, 12, 24, 0.96);
}

.composer-modes {
  justify-content: flex-start;
  margin-bottom: 14px;
}

.mode {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.82rem;
}

.mode.selected {
  color: var(--gold);
}

.composer-bar {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
}

.composer-bar input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
}

.ghost-button {
  background: rgba(255, 255, 255, 0.05);
}

@media (max-width: 1500px) {
  .dashboard {
    grid-template-columns: 280px 1fr;
  }

  .right-rail {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .topbar,
  .dashboard,
  .center-grid,
  .composer-bar {
    grid-template-columns: 1fr;
  }

  .right-rail {
    grid-template-columns: 1fr;
  }
}

```

### electron.vite.config.ts

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
    resolve: {
      alias: {
        '@shared': sharedPath,
        '@main': mainPath
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
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

### package.json

```json
{
  "name": "triad-workbench",
  "version": "0.1.0",
  "private": true,
  "description": "CLI-native multi-agent coding workbench for Claude Code, Codex CLI, Gemini CLI, and Ollama.",
  "type": "module",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "electron": "^37.2.1",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "uuid": "^11.1.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/xterm": "^5.5.0",
    "zustand": "^5.0.8",
    "node-pty": "^1.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^24.3.0",
    "@types/react": "^19.1.10",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^5.0.2",
    "electron-vite": "^4.0.0",
    "typescript": "^5.9.2",
    "vite": "^7.1.3",
    "vitest": "^3.2.4"
  }
}

```

### README.md

```md
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

## AI Docs

- [TRIAD_WORKBENCH_AI_CONTEXT.md](./TRIAD_WORKBENCH_AI_CONTEXT.md)
- [TRIAD_WORKBENCH_BUILD_GUIDE.md](./TRIAD_WORKBENCH_BUILD_GUIDE.md)

```

### src\main\app-controller.ts

```ts
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { app, dialog, shell } from 'electron';

import {
  DEFAULT_AGENTS,
  type AgentId,
  type AgentRole,
  type PromotionAction,
  type ProjectRef,
  type RunnerKind,
  type StartWorkflowInput,
  type WorkbenchSnapshot
} from '@shared/types';

import { createConnector } from './connectors';
import type { AgentConnector } from './connectors/base';
import { OllamaManager } from './services/ollama-manager';
import { PersistenceService } from './services/persistence';
import { ProcessRunner } from './services/process-runner';
import { ProjectArchiveService } from './services/project-archive';
import { TerminalManager } from './services/terminal-manager';
import { WorkflowEngine } from './services/workflow-engine';
import { WorkspaceManager } from './services/workspace-manager';

export class AppController extends EventEmitter {
  private readonly processRunner = new ProcessRunner();
  private readonly persistence = new PersistenceService(app.getPath('userData'));
  private readonly ollamaManager = new OllamaManager(this.processRunner);
  private readonly projectArchive = new ProjectArchiveService();
  private readonly workspaceManager = new WorkspaceManager(this.processRunner, path.join(app.getPath('userData'), 'worktrees'));
  private readonly connectors: Record<AgentId, AgentConnector>;
  private readonly terminalManager = new TerminalManager(this.processRunner);
  private readonly workflowEngine: WorkflowEngine;
  private snapshot: WorkbenchSnapshot;

  constructor() {
    super();

    const persistedProfiles = this.persistence.loadAgentProfiles();
    const mergedAgents = { ...DEFAULT_AGENTS };
    for (const profile of persistedProfiles) {
      mergedAgents[profile.id] = profile;
    }

    this.connectors = {
      claude: createConnector({ ...mergedAgents.claude }, this.processRunner, this.ollamaManager),
      codex: createConnector({ ...mergedAgents.codex }, this.processRunner, this.ollamaManager),
      gemini: createConnector({ ...mergedAgents.gemini }, this.processRunner, this.ollamaManager),
      ollama: createConnector({ ...mergedAgents.ollama }, this.processRunner, this.ollamaManager)
    };

    const project = this.persistence.loadLatestProject();
    this.snapshot = {
      project,
      agents: {
        claude: this.connectors.claude.profile,
        codex: this.connectors.codex.profile,
        gemini: this.connectors.gemini.profile,
        ollama: this.connectors.ollama.profile
      },
      tasks: project ? this.persistence.loadTasks(project.id) : [],
      activeWorkflowId: 'code-review-fix-verify',
      terminals: [],
      ollama: this.ollamaManager.getStatus(),
      archive: this.projectArchive.getArchiveSummary(project),
      notifications: []
    };

    this.workflowEngine = new WorkflowEngine(this.workspaceManager, () => this.connectors);

    this.terminalManager.on('data', (payload) => {
      const project = this.snapshot.project;
      const session = this.terminalManager.getSession(payload.sessionId);
      if (project && session) {
        this.projectArchive.appendTerminalChunk(project, session, payload.data, 'agent');
      }
      this.emit('terminal-data', payload);
    });
  }

  async bootstrap(): Promise<WorkbenchSnapshot> {
    await this.probeAgents();
    return this.snapshot;
  }

  async selectProject(): Promise<ProjectRef | undefined> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (result.canceled || !result.filePaths.length) {
      return this.snapshot.project;
    }

    const runnerPreference = this.snapshot.project?.runnerPreference ?? 'auto';
    const project = await this.workspaceManager.inspectProject(result.filePaths[0], runnerPreference);
    this.snapshot.project = project;
    this.snapshot.tasks = this.persistence.loadTasks(project.id);
    this.persistence.saveProject(project);
    this.snapshot.archive = project.archiveEnabled
      ? this.projectArchive.ensureProject(project)
      : this.projectArchive.getArchiveSummary(project);
    this.pushNotification(project.isGitRepo ? `Loaded ${project.name}.` : `${project.name} is not a git repository yet.`);
    this.emitState();
    return project;
  }

  async probeAgents(deep = false): Promise<WorkbenchSnapshot> {
    for (const connector of Object.values(this.connectors)) {
      const result = await connector.probe(deep);
      this.snapshot.agents[result.profile.id] = result.profile;
      this.persistence.saveAgentProfile(result.profile);
    }
    this.snapshot.ollama = await this.ollamaManager.probe();
    this.emitState();
    return this.snapshot;
  }

  async setProjectRunner(runnerPreference: RunnerKind | 'auto'): Promise<WorkbenchSnapshot> {
    if (!this.snapshot.project) {
      throw new Error('Select a project before choosing a runner.');
    }

    this.snapshot.project = {
      ...this.snapshot.project,
      runnerPreference
    };

    for (const connector of Object.values(this.connectors)) {
      if (connector.profile.id !== 'ollama') {
        connector.profile.runner = runnerPreference === 'auto' ? 'windows' : runnerPreference;
        this.persistence.saveAgentProfile(connector.profile);
      }
    }

    this.persistence.saveProject(this.snapshot.project);
    this.emitState();
    return this.snapshot;
  }

  async setAgentRole(agentId: AgentId, role: AgentRole): Promise<WorkbenchSnapshot> {
    this.connectors[agentId].setRole(role);
    this.persistence.saveAgentProfile(this.connectors[agentId].profile);

    if (agentId === 'ollama') {
      this.snapshot.ollama = await this.ollamaManager.setRole(role);
    }

    this.snapshot.agents[agentId] = this.connectors[agentId].profile;
    this.emitState();
    return this.snapshot;
  }

  startTerminal(agentId: AgentId) {
    const projectPath = this.snapshot.project?.rootPath ?? process.cwd();
    const session = this.terminalManager.start(agentId, this.connectors[agentId], projectPath);
    if (this.snapshot.project) {
      this.projectArchive.saveTerminalSession(this.snapshot.project, session);
    }
    this.snapshot.terminals = this.terminalManager.list();
    this.emitState();
    return session;
  }

  stopTerminal(sessionId: string): void {
    this.terminalManager.stop(sessionId);
    this.snapshot.terminals = this.terminalManager.list();
    this.emitState();
  }

  sendTerminalInput(sessionId: string, input: string): void {
    const project = this.snapshot.project;
    const session = this.terminalManager.getSession(sessionId);
    if (project && session) {
      this.projectArchive.appendTerminalChunk(project, session, input, 'user');
    }
    this.terminalManager.write(sessionId, input);
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    this.terminalManager.resize(sessionId, cols, rows);
  }

  async startWorkflow(input: StartWorkflowInput): Promise<WorkbenchSnapshot> {
    if (!this.snapshot.project?.isGitRepo) {
      throw new Error('Select a git-backed project before starting a workflow.');
    }

    const task = await this.workflowEngine.start(
      this.snapshot.project,
      input,
      (nextTask) => {
        this.upsertTask(nextTask);
      },
      (artifact) => {
        this.persistence.appendArtifact(artifact);
      }
    );

    this.upsertTask(task);
    this.projectArchive.appendEvent(this.snapshot.project, 'workflow-finished', {
      taskId: task.id,
      workflowId: task.workflowId,
      stage: task.stage
    });
    this.emitState();
    return this.snapshot;
  }

  async promoteTask(taskId: string, action: PromotionAction): Promise<WorkbenchSnapshot> {
    const task = this.snapshot.tasks.find((candidate) => candidate.id === taskId);
    const project = this.snapshot.project;
    if (!task || !project) {
      throw new Error('Task or project not found.');
    }

    await this.workspaceManager.promoteTask(task, project, action);
    task.approvalState = 'approved';
    task.stage = 'done';
    task.updatedAt = new Date().toISOString();
    this.upsertTask(task);
    this.projectArchive.appendEvent(project, 'task-promoted', {
      taskId: task.id,
      action
    });
    this.pushNotification(`Task ${task.id.slice(0, 8)} promoted via ${action}.`);
    this.emitState();
    return this.snapshot;
  }

  async setOllamaRole(role: AgentRole, model?: string): Promise<WorkbenchSnapshot> {
    this.snapshot.ollama = await this.ollamaManager.setRole(role, model);
    this.connectors.ollama.profile.role = role;
    this.snapshot.agents.ollama = this.connectors.ollama.profile;
    this.persistence.saveAgentProfile(this.snapshot.agents.ollama);
    this.emitState();
    return this.snapshot;
  }

  async shutdownOllama(): Promise<WorkbenchSnapshot> {
    this.snapshot.ollama = await this.ollamaManager.shutdownIfManaged();
    this.emitState();
    return this.snapshot;
  }

  async setProjectArchiveEnabled(enabled: boolean): Promise<WorkbenchSnapshot> {
    if (!this.snapshot.project) {
      throw new Error('Select a project before changing archive settings.');
    }

    this.snapshot.project = {
      ...this.snapshot.project,
      archiveEnabled: enabled
    };
    this.persistence.saveProject(this.snapshot.project);
    this.snapshot.archive = enabled
      ? this.projectArchive.ensureProject(this.snapshot.project)
      : this.projectArchive.getArchiveSummary(this.snapshot.project);
    this.pushNotification(enabled ? 'Project archive enabled.' : 'Project archive disabled.');
    this.emitState();
    return this.snapshot;
  }

  async saveProjectArchive() {
    if (!this.snapshot.project) {
      return undefined;
    }

    const archive = this.projectArchive.saveSnapshot(this.snapshot);
    this.snapshot.archive = archive;
    if (archive) {
      this.pushNotification(`Saved project archive to ${archive.path}.`);
    }
    this.emit('state', this.snapshot);
    return archive;
  }

  async openProjectArchive() {
    const project = this.snapshot.project;
    if (!project) {
      return undefined;
    }

    const archive = project.archiveEnabled
      ? this.projectArchive.ensureProject(project)
      : this.projectArchive.getArchiveSummary(project);
    if (archive) {
      const result = await shell.openPath(archive.path);
      if (result) {
        throw new Error(result);
      }
    }
    this.snapshot.archive = archive;
    this.emit('state', this.snapshot);
    return archive;
  }

  private upsertTask(task: WorkbenchSnapshot['tasks'][number]): void {
    const existingIndex = this.snapshot.tasks.findIndex((candidate) => candidate.id === task.id);
    if (existingIndex >= 0) {
      this.snapshot.tasks[existingIndex] = task;
    } else {
      this.snapshot.tasks.unshift(task);
    }
    this.persistence.saveTask(task);
    if (this.snapshot.project) {
      this.projectArchive.saveTask(this.snapshot.project, task);
    }
  }

  private pushNotification(message: string): void {
    this.snapshot.notifications = [message, ...this.snapshot.notifications].slice(0, 20);
  }

  private emitState(): void {
    this.snapshot.archive = this.snapshot.project?.archiveEnabled
      ? this.projectArchive.saveSnapshot(this.snapshot)
      : this.projectArchive.getArchiveSummary(this.snapshot.project);
    this.emit('state', this.snapshot);
  }
}

```

### src\main\connectors\base.ts

```ts
import { v4 as uuid } from 'uuid';

import type {
  AgentProfile,
  AgentRole,
  ArtifactBundle,
  ProbeResult,
  RunnerKind
} from '@shared/types';

import { extractPatch, extractTriadPayload, parseJsonLines, summarizeText } from '../utils/parsing';
import type { LaunchSpec } from '../services/process-runner';
import { ProcessRunner } from '../services/process-runner';

export interface ConnectorJobInput {
  prompt: string;
  cwd: string;
  runner: RunnerKind;
  taskId: string;
  stepId: string;
  role: AgentRole;
}

export interface AgentConnector {
  readonly profile: AgentProfile;
  probe(deep?: boolean): Promise<ProbeResult>;
  runJob(input: ConnectorJobInput): Promise<ArtifactBundle>;
  getInteractiveLaunchSpec(cwd: string): LaunchSpec;
  setRole(role: AgentRole): void;
  interrupt(): Promise<void>;
  dispose(): Promise<void>;
}

export abstract class BaseConnector implements AgentConnector {
  protected lastProcessId: number | undefined;

  constructor(
    public readonly profile: AgentProfile,
    protected readonly processRunner: ProcessRunner
  ) {}

  setRole(role: AgentRole): void {
    this.profile.role = role;
  }

  async probe(deep = false): Promise<ProbeResult> {
    const detectedPath =
      this.profile.runner === 'http-local'
        ? this.profile.binaryOrEndpoint
        : await this.processRunner.probeBinary(this.profile.binaryOrEndpoint, this.profile.runner);

    if (!detectedPath) {
      this.profile.status = 'missing';
      this.profile.message = `${this.profile.displayName} was not found on the selected runner.`;
      return {
        profile: {
          ...this.profile,
          lastCheckedAt: new Date().toISOString()
        },
        rawOutput: ''
      };
    }

    this.profile.detectedPath = detectedPath;
    this.profile.status = 'installed';

    const versionResult = await this.getVersionInfo();
    this.profile.version = versionResult.stdout.trim() || versionResult.stderr.trim() || 'unknown';
    this.profile.message = deep
      ? await this.performDeepAuthProbe()
      : 'Installed. Run a workflow or direct chat to verify auth and runtime access.';
    this.profile.lastCheckedAt = new Date().toISOString();

    return {
      profile: { ...this.profile },
      rawOutput: `${versionResult.stdout}\n${versionResult.stderr}`
    };
  }

  async runJob(input: ConnectorJobInput): Promise<ArtifactBundle> {
    const { command, args, env } = this.getScriptedCommand(input);
    const result = await this.processRunner.run(command, args, {
      cwd: input.cwd,
      runner: input.runner,
      env,
      timeoutMs: this.getTimeoutMs()
    });
    const raw = `${result.stdout}\n${result.stderr}`.trim();
    const triad = extractTriadPayload(raw, this.profile.id);

    return {
      id: uuid(),
      taskId: input.taskId,
      stepId: input.stepId,
      agentId: this.profile.id,
      role: input.role,
      prompt: input.prompt,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      structuredEvents: parseJsonLines(result.stdout),
      summary: triad.summary || summarizeText(raw),
      finalMessage: raw,
      patch: extractPatch(raw),
      findings: triad.findings,
      commandRuns: [
        {
          command: [command, ...args].join(' '),
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr
        }
      ],
      createdAt: new Date().toISOString()
    };
  }

  async interrupt(): Promise<void> {
    if (this.lastProcessId) {
      process.kill(this.lastProcessId);
    }
  }

  async dispose(): Promise<void> {
    await this.interrupt();
  }

  protected async performDeepAuthProbe(): Promise<string> {
    return 'Installed. Auth will be confirmed on first successful job run.';
  }

  protected getTimeoutMs(): number {
    return 60_000;
  }

  protected async getVersionInfo() {
    return this.processRunner.run(this.profile.binaryOrEndpoint, this.getVersionArgs(), {
      runner: this.profile.runner,
      timeoutMs: 10_000
    });
  }

  protected getVersionArgs(): string[] {
    return ['--version'];
  }

  abstract getInteractiveLaunchSpec(cwd: string): LaunchSpec;

  protected abstract getScriptedCommand(input: ConnectorJobInput): {
    command: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
  };
}

```

### src\main\connectors\claude-connector.ts

```ts
import type { LaunchSpec } from '../services/process-runner';
import { BaseConnector, type ConnectorJobInput } from './base';

export class ClaudeConnector extends BaseConnector {
  getInteractiveLaunchSpec(cwd: string): LaunchSpec {
    return {
      command: this.profile.binaryOrEndpoint,
      args: [],
      cwd,
      runner: this.profile.runner
    };
  }

  protected getScriptedCommand(input: ConnectorJobInput) {
    return {
      command: this.profile.binaryOrEndpoint,
      args: [
        '-p',
        input.prompt,
        '--output-format',
        'stream-json',
        '--permission-mode',
        input.role === 'coder' || input.role === 'developer' ? 'acceptEdits' : 'plan'
      ]
    };
  }
}

```

### src\main\connectors\codex-connector.ts

```ts
import type { LaunchSpec } from '../services/process-runner';
import { BaseConnector, type ConnectorJobInput } from './base';

export class CodexConnector extends BaseConnector {
  getInteractiveLaunchSpec(cwd: string): LaunchSpec {
    return {
      command: this.profile.binaryOrEndpoint,
      args: [],
      cwd,
      runner: this.profile.runner
    };
  }

  protected getScriptedCommand(input: ConnectorJobInput) {
    return {
      command: this.profile.binaryOrEndpoint,
      args: ['exec', '--json', input.prompt]
    };
  }
}

```

### src\main\connectors\gemini-connector.ts

```ts
import type { LaunchSpec } from '../services/process-runner';
import { BaseConnector, type ConnectorJobInput } from './base';

export class GeminiConnector extends BaseConnector {
  getInteractiveLaunchSpec(cwd: string): LaunchSpec {
    return {
      command: this.profile.binaryOrEndpoint,
      args: [],
      cwd,
      runner: this.profile.runner
    };
  }

  protected getScriptedCommand(input: ConnectorJobInput) {
    return {
      command: this.profile.binaryOrEndpoint,
      args: ['-p', input.prompt, '--output-format', 'stream-json'],
      env: this.profile.authMode === 'api-key' ? process.env : undefined
    };
  }
}

```

### src\main\connectors\index.ts

```ts
import type { AgentId, AgentProfile } from '@shared/types';

import { ClaudeConnector } from './claude-connector';
import { CodexConnector } from './codex-connector';
import { GeminiConnector } from './gemini-connector';
import { OllamaConnector } from './ollama-connector';
import type { AgentConnector } from './base';
import { OllamaManager } from '../services/ollama-manager';
import { ProcessRunner } from '../services/process-runner';

export function createConnector(profile: AgentProfile, processRunner: ProcessRunner, ollamaManager: OllamaManager): AgentConnector {
  switch (profile.id) {
    case 'claude':
      return new ClaudeConnector(profile, processRunner);
    case 'codex':
      return new CodexConnector(profile, processRunner);
    case 'gemini':
      return new GeminiConnector(profile, processRunner);
    case 'ollama':
      return new OllamaConnector(profile, processRunner, ollamaManager);
    default:
      throw new Error(`Unsupported agent ${(profile as { id: AgentId }).id}`);
  }
}

```

### src\main\connectors\ollama-connector.ts

```ts
import { v4 as uuid } from 'uuid';

import type { ArtifactBundle, ProbeResult } from '@shared/types';

import { extractTriadPayload } from '../utils/parsing';
import { OllamaManager } from '../services/ollama-manager';
import { BaseConnector, type ConnectorJobInput } from './base';

export class OllamaConnector extends BaseConnector {
  constructor(
    profile: BaseConnector['profile'],
    processRunner: BaseConnector['processRunner'],
    private readonly ollamaManager: OllamaManager
  ) {
    super(profile, processRunner);
  }

  override async probe(): Promise<ProbeResult> {
    const status = await this.ollamaManager.probe();
    this.profile.status = status.available ? (status.running ? 'ready' : 'installed') : 'missing';
    this.profile.message = status.message;
    this.profile.lastCheckedAt = new Date().toISOString();

    return {
      profile: { ...this.profile },
      rawOutput: JSON.stringify(status)
    };
  }

  override getInteractiveLaunchSpec(): never {
    throw new Error('Ollama does not provide an interactive terminal inside Triad Workbench.');
  }

  override async runJob(input: ConnectorJobInput): Promise<ArtifactBundle> {
    const model = process.env.TRIAD_OLLAMA_MODEL || 'qwen2.5-coder:7b';
    const result = await this.ollamaManager.runChat(model, input.prompt);
    const triad = extractTriadPayload(result.response, 'ollama');

    return {
      id: uuid(),
      taskId: input.taskId,
      stepId: input.stepId,
      agentId: 'ollama',
      role: input.role,
      prompt: input.prompt,
      stdout: result.raw,
      stderr: '',
      exitCode: 0,
      structuredEvents: [],
      summary: triad.summary,
      finalMessage: result.response,
      patch: undefined,
      findings: triad.findings,
      commandRuns: [],
      createdAt: new Date().toISOString()
    };
  }

  protected getScriptedCommand(): never {
    throw new Error('Ollama uses the local HTTP API instead of a CLI subprocess in orchestrated mode.');
  }
}

```

### src\main\index.ts

```ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import { IPC_CHANNELS } from '@shared/ipc';

import { AppController } from './app-controller';

let controller: AppController | undefined;
let mainWindow: BrowserWindow | undefined;

function createMainWindow(): BrowserWindow {
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

function wireIpc(window: BrowserWindow, nextController: AppController): void {
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
  ipcMain.handle(IPC_CHANNELS.promoteTask, (_event, taskId, action) => nextController.promoteTask(taskId, action));
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

### src\main\services\ollama-manager.ts

```ts
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

import type { AgentRole, OllamaStatus } from '@shared/types';

import { ProcessRunner } from './process-runner';

export class OllamaManager {
  private status: OllamaStatus = {
    available: false,
    running: false,
    owner: 'none',
    endpoint: 'http://localhost:11434'
  };
  private managedProcess: ReturnType<typeof spawn> | undefined;

  constructor(private readonly processRunner: ProcessRunner) {}

  getStatus(): OllamaStatus {
    return this.status;
  }

  async probe(): Promise<OllamaStatus> {
    const binary = await this.processRunner.probeBinary('ollama', 'windows');

    try {
      const response = await fetch(`${this.status.endpoint}/api/tags`);
      if (response.ok) {
        this.status = {
          ...this.status,
          available: Boolean(binary),
          running: true,
          owner: this.status.owner === 'none' ? 'external' : this.status.owner,
          message: 'Detected a running Ollama daemon.'
        };
        return this.status;
      }
    } catch {
      // Ignore connectivity errors here.
    }

    this.status = {
      ...this.status,
      available: Boolean(binary),
      running: false,
      owner: this.managedProcess ? 'app-managed' : 'none',
      message: binary ? 'Ollama is installed but not running.' : 'Ollama is not installed.'
    };
    return this.status;
  }

  async ensureRunning(model?: string): Promise<OllamaStatus> {
    const probed = await this.probe();
    if (probed.running) {
      return {
        ...probed,
        activeModel: model ?? probed.activeModel
      };
    }

    if (!probed.available) {
      throw new Error('Ollama is not installed.');
    }

    this.managedProcess = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    this.managedProcess.unref();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await delay(500);
      const next = await this.probe();
      if (next.running) {
        this.status = {
          ...next,
          owner: 'app-managed',
          activeModel: model ?? next.activeModel,
          message: 'Started Ollama for this project session.'
        };
        return this.status;
      }
    }

    throw new Error('Timed out while starting Ollama.');
  }

  async setRole(role: AgentRole, model?: string): Promise<OllamaStatus> {
    if (role === 'off') {
      await this.shutdownIfManaged();
      return this.status;
    }

    return this.ensureRunning(model);
  }

  async shutdownIfManaged(): Promise<OllamaStatus> {
    if (this.status.owner === 'external') {
      return this.status;
    }

    if (this.managedProcess?.pid) {
      process.kill(this.managedProcess.pid);
    }

    this.managedProcess = undefined;
    this.status = {
      ...this.status,
      running: false,
      owner: 'none',
      activeModel: undefined,
      message: 'Stopped app-managed Ollama to free VRAM.'
    };
    return this.status;
  }

  async runChat(model: string, prompt: string): Promise<{ raw: string; response: string }> {
    const status = await this.ensureRunning(model);
    const response = await fetch(`${status.endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}.`);
    }

    const raw = await response.text();
    const parsed = JSON.parse(raw) as { message?: { content?: string } };
    return {
      raw,
      response: parsed.message?.content ?? ''
    };
  }
}

```

### src\main\services\persistence.ts

```ts
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import type { AgentProfile, ArtifactBundle, ProjectRef, TaskRun } from '@shared/types';

export class PersistenceService {
  private db: Database.Database;

  constructor(private readonly userDataPath: string) {
    fs.mkdirSync(userDataPath, { recursive: true });
    this.db = new Database(path.join(userDataPath, 'triad-workbench.db'));
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  loadLatestProject(): ProjectRef | undefined {
    const row = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 1').get() as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      return undefined;
    }

    return {
      id: String(row.id),
      name: String(row.name),
      rootPath: String(row.root_path),
      wslPath: row.wsl_path ? String(row.wsl_path) : undefined,
      runnerPreference: row.runner_preference as ProjectRef['runnerPreference'],
      isGitRepo: Boolean(row.is_git_repo),
      currentBranch: row.current_branch ? String(row.current_branch) : undefined,
      archivePath: row.archive_path ? String(row.archive_path) : path.join(String(row.root_path), '.triad-workbench'),
      archiveEnabled: row.archive_enabled === undefined ? true : Boolean(row.archive_enabled)
    };
  }

  saveProject(project: ProjectRef): void {
    this.db
      .prepare(
        `INSERT INTO projects (
           id,
           name,
           root_path,
           wsl_path,
           runner_preference,
           is_git_repo,
           current_branch,
           archive_path,
           archive_enabled,
           updated_at
         )
         VALUES (
           @id,
           @name,
           @rootPath,
           @wslPath,
           @runnerPreference,
           @isGitRepo,
           @currentBranch,
           @archivePath,
           @archiveEnabled,
           CURRENT_TIMESTAMP
         )
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           root_path = excluded.root_path,
           wsl_path = excluded.wsl_path,
           runner_preference = excluded.runner_preference,
           is_git_repo = excluded.is_git_repo,
           current_branch = excluded.current_branch,
           archive_path = excluded.archive_path,
           archive_enabled = excluded.archive_enabled,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run({
        id: project.id,
        name: project.name,
        rootPath: project.rootPath,
        wslPath: project.wslPath ?? null,
        runnerPreference: project.runnerPreference,
        isGitRepo: project.isGitRepo ? 1 : 0,
        currentBranch: project.currentBranch ?? null,
        archivePath: project.archivePath,
        archiveEnabled: project.archiveEnabled ? 1 : 0
      });
  }

  loadAgentProfiles(): AgentProfile[] {
    const rows = this.db.prepare('SELECT profile_json FROM agent_profiles').all() as Array<{ profile_json: string }>;
    return rows.map((row) => JSON.parse(row.profile_json) as AgentProfile);
  }

  saveAgentProfile(profile: AgentProfile): void {
    this.db
      .prepare(
        `INSERT INTO agent_profiles (id, profile_json, updated_at)
         VALUES (@id, @profile, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           profile_json = excluded.profile_json,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run({
        id: profile.id,
        profile: JSON.stringify(profile)
      });
  }

  loadTasks(projectId: string): TaskRun[] {
    const rows = this.db
      .prepare('SELECT task_json FROM task_runs WHERE project_id = ? ORDER BY updated_at DESC')
      .all(projectId) as Array<{ task_json: string }>;
    return rows.map((row) => JSON.parse(row.task_json) as TaskRun);
  }

  saveTask(task: TaskRun): void {
    this.db
      .prepare(
        `INSERT INTO task_runs (id, project_id, stage, workflow_id, task_json, updated_at)
         VALUES (@id, @projectId, @stage, @workflowId, @taskJson, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           stage = excluded.stage,
           workflow_id = excluded.workflow_id,
           task_json = excluded.task_json,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run({
        id: task.id,
        projectId: task.projectId,
        stage: task.stage,
        workflowId: task.workflowId,
        taskJson: JSON.stringify(task)
      });
  }

  appendArtifact(artifact: ArtifactBundle): void {
    this.db
      .prepare(
        `INSERT INTO artifacts (id, task_id, step_id, agent_id, artifact_json, created_at)
         VALUES (@id, @taskId, @stepId, @agentId, @artifactJson, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           artifact_json = excluded.artifact_json`
      )
      .run({
        id: artifact.id,
        taskId: artifact.taskId,
        stepId: artifact.stepId,
        agentId: artifact.agentId,
        artifactJson: JSON.stringify(artifact)
      });
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        wsl_path TEXT,
        runner_preference TEXT NOT NULL,
        is_git_repo INTEGER NOT NULL DEFAULT 0,
        current_branch TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agent_profiles (
        id TEXT PRIMARY KEY,
        profile_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        task_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        artifact_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.ensureColumn('projects', 'archive_path', 'ALTER TABLE projects ADD COLUMN archive_path TEXT');
    this.ensureColumn('projects', 'archive_enabled', 'ALTER TABLE projects ADD COLUMN archive_enabled INTEGER NOT NULL DEFAULT 1');
  }

  private ensureColumn(tableName: string, columnName: string, alterSql: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === columnName)) {
      this.db.exec(alterSql);
    }
  }
}

```

### src\main\services\process-runner.ts

```ts
import { spawn } from 'node:child_process';

import pty from 'node-pty';

import type { IPty } from 'node-pty';
import type { RunnerKind } from '@shared/types';

import { mapPathForRunner } from '../utils/path-mapping';

export interface RunCommandOptions {
  cwd?: string;
  runner: RunnerKind;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface LaunchSpec {
  command: string;
  args: string[];
  cwd: string;
  runner: RunnerKind;
  env?: NodeJS.ProcessEnv;
}

function quoteForBash(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export class ProcessRunner {
  async run(command: string, args: string[], options: RunCommandOptions): Promise<CommandResult> {
    if (options.runner === 'http-local') {
      throw new Error('http-local commands cannot be executed through ProcessRunner.');
    }

    const { resolvedCommand, resolvedArgs } = this.prepareCommand(command, args, options);

    return await new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(resolvedCommand, resolvedArgs, {
        cwd: options.runner === 'windows' ? options.cwd : undefined,
        env: {
          ...process.env,
          ...options.env
        },
        shell: false,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | undefined;

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.once('error', reject);

      if (options.timeoutMs) {
        timer = setTimeout(() => {
          child.kill();
        }, options.timeoutMs);
      }

      child.once('close', (exitCode) => {
        if (timer) {
          clearTimeout(timer);
        }

        resolve({
          command,
          args,
          exitCode,
          stdout,
          stderr
        });
      });
    });
  }

  spawnInteractive(spec: LaunchSpec): IPty {
    if (spec.runner === 'http-local') {
      throw new Error('Cannot start an interactive PTY for http-local endpoints.');
    }

    const { resolvedCommand, resolvedArgs } = this.prepareCommand(spec.command, spec.args, {
      runner: spec.runner,
      cwd: spec.cwd,
      env: spec.env
    });

    return pty.spawn(resolvedCommand, resolvedArgs, {
      cwd: spec.runner === 'windows' ? spec.cwd : process.cwd(),
      env: {
        ...process.env,
        ...spec.env
      },
      cols: 120,
      rows: 30,
      name: 'xterm-color'
    });
  }

  async probeBinary(binary: string, runner: RunnerKind): Promise<string | undefined> {
    if (runner === 'http-local') {
      return undefined;
    }

    const result =
      runner === 'windows'
        ? await this.run('where.exe', [binary], { runner })
        : await this.run('bash', ['-lc', `command -v ${quoteForBash(binary)}`], { runner: 'wsl' });

    if (result.exitCode === 0) {
      const firstLine = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      return firstLine;
    }

    return undefined;
  }

  private prepareCommand(command: string, args: string[], options: RunCommandOptions): { resolvedCommand: string; resolvedArgs: string[] } {
    if (options.runner === 'windows') {
      return { resolvedCommand: command, resolvedArgs: args };
    }

    const mappedCwd = options.cwd ? mapPathForRunner(options.cwd, 'wsl') : undefined;
    const script = [
      mappedCwd ? `cd ${quoteForBash(mappedCwd)}` : undefined,
      [command, ...args].map(quoteForBash).join(' ')
    ]
      .filter(Boolean)
      .join(' && ');

    return {
      resolvedCommand: 'wsl.exe',
      resolvedArgs: ['bash', '-lc', script]
    };
  }
}

```

### src\main\services\project-archive.ts

```ts
import fs from 'node:fs';
import path from 'node:path';

import type {
  ArtifactBundle,
  ProjectArchiveSummary,
  ProjectRef,
  TaskRun,
  TerminalSession,
  WorkbenchSnapshot
} from '@shared/types';

type TranscriptSource = 'agent' | 'user' | 'system';

interface TranscriptEntry {
  timestamp: string;
  source: TranscriptSource;
  agentId: string;
  chunk: string;
}

export class ProjectArchiveService {
  getArchiveSummary(project?: ProjectRef): ProjectArchiveSummary | undefined {
    if (!project) {
      return undefined;
    }

    const archivePath = this.resolveArchivePath(project);
    const snapshotPath = path.join(archivePath, 'state', 'latest-snapshot.json');
    const lastSavedAt = fs.existsSync(snapshotPath) ? fs.statSync(snapshotPath).mtime.toISOString() : undefined;

    return {
      path: archivePath,
      enabled: project.archiveEnabled,
      lastSavedAt
    };
  }

  ensureProject(project: ProjectRef): ProjectArchiveSummary {
    const archivePath = this.resolveArchivePath(project);
    fs.mkdirSync(path.join(archivePath, 'state'), { recursive: true });
    fs.mkdirSync(path.join(archivePath, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(archivePath, 'terminals'), { recursive: true });
    fs.mkdirSync(path.join(archivePath, 'events'), { recursive: true });
    this.writeJson(path.join(archivePath, 'project.json'), {
      savedAt: new Date().toISOString(),
      project
    });

    return this.getArchiveSummary(project)!;
  }

  saveSnapshot(snapshot: WorkbenchSnapshot): ProjectArchiveSummary | undefined {
    const project = snapshot.project;
    if (!project || !project.archiveEnabled) {
      return this.getArchiveSummary(project);
    }

    const archive = this.ensureProject(project);
    const stateDir = path.join(archive.path, 'state');
    const savedAt = new Date().toISOString();

    this.writeJson(path.join(stateDir, 'latest-snapshot.json'), {
      savedAt,
      snapshot
    });
    this.writeJson(path.join(stateDir, 'agents.json'), {
      savedAt,
      agents: snapshot.agents
    });
    this.writeJson(path.join(stateDir, 'notifications.json'), {
      savedAt,
      notifications: snapshot.notifications
    });
    this.appendEvent(project, 'snapshot-saved', {
      savedAt,
      taskCount: snapshot.tasks.length,
      terminalCount: snapshot.terminals.length
    });

    return this.getArchiveSummary(project);
  }

  saveTask(project: ProjectRef, task: TaskRun): void {
    if (!project.archiveEnabled) {
      return;
    }

    const archive = this.ensureProject(project);
    const taskDir = path.join(archive.path, 'tasks', task.id);
    const artifactDir = path.join(taskDir, 'artifacts');
    fs.mkdirSync(artifactDir, { recursive: true });

    this.writeJson(path.join(taskDir, 'task.json'), task);
    for (const artifact of task.artifacts) {
      this.saveArtifact(taskDir, artifact);
    }
  }

  saveTerminalSession(project: ProjectRef, session: TerminalSession): void {
    if (!project.archiveEnabled) {
      return;
    }

    const archive = this.ensureProject(project);
    const sessionDir = path.join(archive.path, 'terminals', session.id);
    fs.mkdirSync(sessionDir, { recursive: true });
    this.writeJson(path.join(sessionDir, 'session.json'), session);
    this.appendEvent(project, 'terminal-started', session);
  }

  appendTerminalChunk(project: ProjectRef, session: TerminalSession, chunk: string, source: TranscriptSource): void {
    if (!project.archiveEnabled) {
      return;
    }

    const archive = this.ensureProject(project);
    const sessionDir = path.join(archive.path, 'terminals', session.id);
    fs.mkdirSync(sessionDir, { recursive: true });

    const timestamp = new Date().toISOString();
    const entry: TranscriptEntry = {
      timestamp,
      source,
      agentId: session.agentId,
      chunk
    };

    const transcriptLine = `[${timestamp}] [${source}] ${chunk}`;
    fs.appendFileSync(path.join(sessionDir, 'transcript.log'), `${transcriptLine}\n`, 'utf8');
    fs.appendFileSync(path.join(sessionDir, 'transcript.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
  }

  appendEvent(project: ProjectRef, type: string, payload: unknown): void {
    if (!project.archiveEnabled) {
      return;
    }

    const archive = this.ensureProject(project);
    fs.appendFileSync(
      path.join(archive.path, 'events', 'events.jsonl'),
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        type,
        payload
      })}\n`,
      'utf8'
    );
  }

  private saveArtifact(taskDir: string, artifact: ArtifactBundle): void {
    const artifactDir = path.join(taskDir, 'artifacts');
    this.writeJson(path.join(artifactDir, `${artifact.id}.json`), artifact);
    fs.writeFileSync(path.join(artifactDir, `${artifact.id}.prompt.txt`), artifact.prompt, 'utf8');
    fs.writeFileSync(path.join(artifactDir, `${artifact.id}.stdout.log`), artifact.stdout, 'utf8');
    fs.writeFileSync(path.join(artifactDir, `${artifact.id}.stderr.log`), artifact.stderr, 'utf8');
    if (artifact.patch) {
      fs.writeFileSync(path.join(artifactDir, `${artifact.id}.patch.diff`), artifact.patch, 'utf8');
    }
  }

  private resolveArchivePath(project: ProjectRef): string {
    return project.archivePath;
  }

  private writeJson(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  }
}

```

### src\main\services\terminal-manager.ts

```ts
import { EventEmitter } from 'node:events';

import { v4 as uuid } from 'uuid';

import type { IPty } from 'node-pty';
import type { AgentId, TerminalSession } from '@shared/types';

import type { AgentConnector } from '../connectors/base';
import { ProcessRunner } from './process-runner';

export class TerminalManager extends EventEmitter {
  private readonly sessions = new Map<string, { session: TerminalSession; pty: IPty }>();

  constructor(private readonly processRunner: ProcessRunner) {
    super();
  }

  start(agentId: AgentId, connector: AgentConnector, cwd: string): TerminalSession {
    const spec = connector.getInteractiveLaunchSpec(cwd);
    const ptyProcess = this.processRunner.spawnInteractive(spec);
    const session: TerminalSession = {
      id: uuid(),
      agentId,
      title: `${connector.profile.displayName} terminal`,
      cwd,
      runner: spec.runner,
      createdAt: new Date().toISOString()
    };

    ptyProcess.onData((data) => {
      this.emit('data', { sessionId: session.id, data });
    });

    this.sessions.set(session.id, { session, pty: ptyProcess });
    return session;
  }

  write(sessionId: string, input: string): void {
    this.sessions.get(sessionId)?.pty.write(input);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.pty.resize(cols, rows);
  }

  stop(sessionId: string): void {
    this.sessions.get(sessionId)?.pty.kill();
    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId)?.session;
  }

  list(): TerminalSession[] {
    return [...this.sessions.values()].map((entry) => entry.session);
  }
}

```

### src\main\services\workflow-engine.ts

```ts
import { v4 as uuid } from 'uuid';

import type {
  AgentId,
  ArtifactBundle,
  Finding,
  ProjectRef,
  StartWorkflowInput,
  TaskRun,
  TaskStage,
  TaskStepRecord
} from '@shared/types';

import { buildArchitecturePrompt, buildCodingPrompt, buildFixPrompt, buildMonitorPrompt, buildReviewPrompt } from '../utils/prompts';
import type { AgentConnector } from '../connectors/base';
import { WorkspaceManager } from './workspace-manager';

interface WorkflowContext {
  project: ProjectRef;
  task: TaskRun;
  updateTask: (task: TaskRun) => void;
  appendArtifact: (artifact: ArtifactBundle) => void;
}

export class WorkflowEngine {
  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly connectors: () => Record<AgentId, AgentConnector>
  ) {}

  async start(project: ProjectRef, input: StartWorkflowInput, updateTask: (task: TaskRun) => void, appendArtifact: (artifact: ArtifactBundle) => void): Promise<TaskRun> {
    const taskId = uuid();
    const workspace = await this.workspaceManager.createTaskWorkspace(project, taskId, input.brief);
    const task: TaskRun = {
      id: taskId,
      projectId: project.id,
      workflowId: input.workflowId,
      workflowMode: input.workflowMode ?? 'orchestrate',
      baseBranch: workspace.baseBranch,
      baseCommit: workspace.baseCommit,
      worktreePath: workspace.worktreePath,
      stage: 'brief',
      brief: input.brief,
      assignedAgents: this.resolveAgents(input.workflowId),
      approvalState: 'pending',
      branchName: workspace.branchName,
      findings: [],
      artifacts: [],
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    updateTask(task);

    const context: WorkflowContext = {
      project,
      task,
      updateTask,
      appendArtifact
    };

    switch (input.workflowId) {
      case 'code-review-fix-verify':
        await this.runCodeReviewFixVerify(context);
        break;
      case 'code-gemini-compare-codex-review':
        await this.runCodeGeminiCodex(context);
        break;
      case 'architecture-compare':
        await this.runArchitectureCompare(context);
        break;
      case 'away-monitor':
        await this.runAwayMonitor(context);
        break;
      default:
        throw new Error(`Unsupported workflow ${String(input.workflowId)}`);
    }

    context.task.stage = context.task.stage === 'error' ? 'error' : 'promote';
    context.task.updatedAt = new Date().toISOString();
    updateTask(context.task);
    return context.task;
  }

  private async runCodeReviewFixVerify(context: WorkflowContext): Promise<void> {
    await this.runStep(context, 'code', 'claude', buildCodingPrompt(context.task), 'coder');
    const diff = await this.workspaceManager.getDiff(context.task, context.project);
    await this.runStep(context, 'review', 'codex', buildReviewPrompt(context.task, diff, 'codex'), 'reviewer', true);
    if (context.task.findings.length) {
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings), 'coder');
    }
    const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
    await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, verifyDiff, 'codex'), 'tester', true);
  }

  private async runCodeGeminiCodex(context: WorkflowContext): Promise<void> {
    await this.runStep(context, 'code', 'claude', buildCodingPrompt(context.task), 'coder');
    const diff = await this.workspaceManager.getDiff(context.task, context.project);
    await this.runStep(context, 'review', 'gemini', buildReviewPrompt(context.task, diff, 'gemini'), 'architect', true);
    if (context.task.findings.length) {
      await this.runStep(context, 'fix', 'claude', buildFixPrompt(context.task, context.task.findings), 'coder');
    }
    const verifyDiff = await this.workspaceManager.getDiff(context.task, context.project);
    await this.runStep(context, 'verify', 'codex', buildReviewPrompt(context.task, verifyDiff, 'codex'), 'reviewer', true);
  }

  private async runArchitectureCompare(context: WorkflowContext): Promise<void> {
    const agents: AgentId[] = ['claude', 'codex', 'gemini', 'ollama'];
    for (const agentId of agents) {
      const role = agentId === 'ollama' ? 'architect' : 'planner';
      await this.runStep(context, 'review', agentId, buildArchitecturePrompt(context.task, agentId), role, agentId !== 'claude');
    }
    context.task.stage = 'done';
  }

  private async runAwayMonitor(context: WorkflowContext): Promise<void> {
    await this.runStep(context, 'review', 'ollama', buildMonitorPrompt(context.task), 'monitor');
    context.task.stage = 'done';
  }

  private async runStep(
    context: WorkflowContext,
    stage: TaskStage,
    agentId: AgentId,
    prompt: string,
    role: 'coder' | 'reviewer' | 'tester' | 'architect' | 'planner' | 'monitor',
    enforceReadOnly = false
  ): Promise<void> {
    const connector = this.connectors()[agentId];
    const step: TaskStepRecord = {
      id: uuid(),
      stage,
      agentId,
      startedAt: new Date().toISOString(),
      status: 'running'
    };
    context.task.stage = stage;
    context.task.steps.unshift(step);
    context.task.updatedAt = new Date().toISOString();
    context.updateTask(context.task);

    try {
      const beforeDiff = enforceReadOnly ? await this.workspaceManager.getDiff(context.task, context.project) : '';
      const artifact = await connector.runJob({
        prompt,
        cwd: context.task.worktreePath,
        runner: connector.profile.runner,
        taskId: context.task.id,
        stepId: step.id,
        role
      });
      const afterDiff = enforceReadOnly ? await this.workspaceManager.getDiff(context.task, context.project) : '';

      if (enforceReadOnly && beforeDiff !== afterDiff) {
        artifact.findings.unshift({
          sourceAgent: agentId,
          severity: 'high',
          title: `${connector.profile.displayName} modified the worktree during a read-only stage`,
          body: 'The agent changed files while acting as a reviewer/tester. The worktree is preserved for inspection, but promotion should be reviewed carefully.'
        });
      }

      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      step.summary = artifact.summary;
      context.task.summary = artifact.summary;
      context.task.findings = this.mergeFindings(context.task.findings, artifact.findings);
      context.task.artifacts.unshift(artifact);
      context.appendArtifact(artifact);
    } catch (error) {
      step.status = 'failed';
      step.completedAt = new Date().toISOString();
      context.task.stage = 'error';
      context.task.errorMessage = error instanceof Error ? error.message : String(error);
    }

    context.task.updatedAt = new Date().toISOString();
    context.updateTask(context.task);
  }

  private resolveAgents(workflowId: StartWorkflowInput['workflowId']): AgentId[] {
    switch (workflowId) {
      case 'code-review-fix-verify':
        return ['claude', 'codex'];
      case 'code-gemini-compare-codex-review':
        return ['claude', 'gemini', 'codex'];
      case 'architecture-compare':
        return ['claude', 'codex', 'gemini', 'ollama'];
      case 'away-monitor':
        return ['ollama'];
      default:
        throw new Error(`Unsupported workflow ${String(workflowId)}`);
    }
  }

  private mergeFindings(existing: Finding[], incoming: Finding[]): Finding[] {
    const seen = new Set(existing.map((finding) => `${finding.sourceAgent}:${finding.title}:${finding.file ?? ''}:${finding.line ?? ''}`));
    return [
      ...existing,
      ...incoming.filter((finding) => {
        const key = `${finding.sourceAgent}:${finding.title}:${finding.file ?? ''}:${finding.line ?? ''}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
    ];
  }
}

```

### src\main\services\workspace-manager.ts

```ts
import fs from 'node:fs';
import path from 'node:path';

import type { ProjectRef, PromotionAction, RunnerKind, TaskRun } from '@shared/types';

import { mapPathForRunner, sanitizeBranchName, windowsToWslPath } from '../utils/path-mapping';
import { ProcessRunner } from './process-runner';

export class WorkspaceManager {
  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly workspaceRoot: string
  ) {
    fs.mkdirSync(this.workspaceRoot, { recursive: true });
  }

  async inspectProject(rootPath: string, runnerPreference: RunnerKind | 'auto'): Promise<ProjectRef> {
    const runner = runnerPreference === 'auto' ? 'windows' : runnerPreference;
    const gitResult = await this.processRunner.run('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: rootPath,
      runner
    });
    const isGitRepo = gitResult.stdout.trim() === 'true';
    const branchResult = isGitRepo
      ? await this.processRunner.run('git', ['branch', '--show-current'], { cwd: rootPath, runner })
      : undefined;

    return {
      id: rootPath,
      name: path.basename(rootPath),
      rootPath,
      wslPath: windowsToWslPath(rootPath),
      runnerPreference,
      isGitRepo,
      currentBranch: branchResult?.stdout.trim() || undefined,
      archivePath: path.join(rootPath, '.triad-workbench'),
      archiveEnabled: true
    };
  }

  async createTaskWorkspace(project: ProjectRef, taskId: string, brief: string): Promise<Pick<TaskRun, 'worktreePath' | 'baseBranch' | 'baseCommit' | 'branchName'>> {
    const runner = this.resolveRunner(project);
    const baseBranch = project.currentBranch || 'main';
    const baseCommit = (
      await this.processRunner.run('git', ['rev-parse', 'HEAD'], {
        cwd: project.rootPath,
        runner
      })
    ).stdout.trim();
    const branchName = `triad/${sanitizeBranchName(`${brief.slice(0, 40)}-${taskId.slice(0, 8)}`)}`;
    const worktreePath = path.join(this.workspaceRoot, taskId);

    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

    await this.processRunner.run(
      'git',
      ['worktree', 'add', '-b', branchName, mapPathForRunner(worktreePath, runner), baseBranch],
      {
        cwd: project.rootPath,
        runner
      }
    );

    return {
      worktreePath,
      baseBranch,
      baseCommit,
      branchName
    };
  }

  async getDiff(task: TaskRun, project: ProjectRef): Promise<string> {
    const runner = this.resolveRunner(project);
    const result = await this.processRunner.run('git', ['diff', task.baseCommit], {
      cwd: task.worktreePath,
      runner
    });

    return result.stdout;
  }

  async promoteTask(task: TaskRun, project: ProjectRef, action: PromotionAction): Promise<void> {
    const runner = this.resolveRunner(project);

    if (action === 'keep-worktree' || action === 'open-task-branch') {
      return;
    }

    const status = await this.processRunner.run('git', ['status', '--porcelain'], {
      cwd: project.rootPath,
      runner
    });

    if (status.stdout.trim()) {
      throw new Error('Main checkout has uncommitted changes. Clean it before applying a promoted patch.');
    }

    const diff = await this.getDiff(task, project);
    const patchFile = path.join(this.workspaceRoot, `${task.id}.patch`);
    fs.writeFileSync(patchFile, diff, 'utf8');

    await this.processRunner.run('git', ['apply', '--3way', mapPathForRunner(patchFile, runner)], {
      cwd: project.rootPath,
      runner
    });
  }

  async cleanupTaskWorkspace(task: TaskRun, project: ProjectRef): Promise<void> {
    const runner = this.resolveRunner(project);
    await this.processRunner.run('git', ['worktree', 'remove', '--force', mapPathForRunner(task.worktreePath, runner)], {
      cwd: project.rootPath,
      runner
    });
  }

  resolveRunner(project: ProjectRef): RunnerKind {
    if (project.runnerPreference === 'auto') {
      return 'windows';
    }
    return project.runnerPreference;
  }
}

```

### src\main\utils\parsing.test.ts

```ts
import { describe, expect, it } from 'vitest';

import { extractTriadPayload } from './parsing';

describe('extractTriadPayload', () => {
  it('parses triad JSON blocks', () => {
    const payload = extractTriadPayload(
      `review summary
<triad-json>{"summary":"Found issues","findings":[{"severity":"high","title":"Race condition","body":"Missing lock","file":"src/app.ts","line":12}]}</triad-json>`,
      'codex'
    );

    expect(payload.summary).toBe('Found issues');
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]).toMatchObject({
      sourceAgent: 'codex',
      severity: 'high',
      title: 'Race condition',
      file: 'src/app.ts',
      line: 12
    });
  });

  it('falls back to bullet extraction when JSON is missing', () => {
    const payload = extractTriadPayload(
      `- high severity issue in src/index.ts
- low style issue`,
      'gemini'
    );

    expect(payload.findings).toHaveLength(2);
    expect(payload.findings[0].sourceAgent).toBe('gemini');
  });
});

```

### src\main\utils\parsing.ts

```ts
import { normalizeLineEndings } from './path-mapping';

import type { AgentId, Finding, ParsedTriadPayload } from '@shared/types';

const TRIAD_JSON_REGEX = /<triad-json>([\s\S]*?)<\/triad-json>/i;
const FENCED_JSON_REGEX = /```json\s*([\s\S]*?)```/i;
const DIFF_REGEX = /(diff --git[\s\S]*$|--- [\s\S]*?\n\+\+\+ [\s\S]*$)/m;

export function parseJsonLines(input: string): unknown[] {
  return normalizeLineEndings(input)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

export function extractTriadPayload(input: string, sourceAgent: AgentId): ParsedTriadPayload {
  const normalized = normalizeLineEndings(input);
  const matched = normalized.match(TRIAD_JSON_REGEX) ?? normalized.match(FENCED_JSON_REGEX);

  if (!matched) {
    return {
      summary: normalized.trim().slice(0, 2000),
      findings: extractFindingsFromPlainText(normalized, sourceAgent)
    };
  }

  try {
    const parsed = JSON.parse(matched[1]) as Partial<ParsedTriadPayload>;

    return {
      summary: parsed.summary ?? '',
      findings: (parsed.findings ?? []).map((finding) => ({
        sourceAgent,
        severity: finding.severity ?? 'info',
        title: finding.title ?? 'Finding',
        body: finding.body ?? '',
        file: finding.file,
        line: finding.line,
        evidence: finding.evidence,
        recommendedAction: finding.recommendedAction
      })),
      recommendedRole: parsed.recommendedRole,
      notes: parsed.notes ?? []
    };
  } catch {
    return {
      summary: normalized.trim().slice(0, 2000),
      findings: extractFindingsFromPlainText(normalized, sourceAgent)
    };
  }
}

export function extractFindingsFromPlainText(input: string, sourceAgent: AgentId): Finding[] {
  const lines = normalizeLineEndings(input)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter((line) => line.startsWith('-') || line.startsWith('*'))
    .slice(0, 20)
    .map((line) => ({
      sourceAgent,
      severity: classifySeverity(line),
      title: line.replace(/^[-*]\s*/, '').slice(0, 120),
      body: line.replace(/^[-*]\s*/, '')
    }));
}

function classifySeverity(line: string): Finding['severity'] {
  const lower = line.toLowerCase();
  if (lower.includes('critical')) {
    return 'critical';
  }
  if (lower.includes('high') || lower.includes('security')) {
    return 'high';
  }
  if (lower.includes('medium') || lower.includes('bug')) {
    return 'medium';
  }
  if (lower.includes('low') || lower.includes('style')) {
    return 'low';
  }
  return 'info';
}

export function extractPatch(input: string): string | undefined {
  return normalizeLineEndings(input).match(DIFF_REGEX)?.[1];
}

export function summarizeText(input: string): string {
  return normalizeLineEndings(input)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(' ')
    .slice(0, 500);
}

```

### src\main\utils\path-mapping.test.ts

```ts
import { describe, expect, it } from 'vitest';

import { sanitizeBranchName, windowsToWslPath } from './path-mapping';

describe('path mapping helpers', () => {
  it('maps Windows paths to WSL mounts', () => {
    expect(windowsToWslPath('D:\\ccgl room\\project')).toBe('/mnt/d/ccgl room/project');
  });

  it('sanitizes branch names for git worktrees', () => {
    expect(sanitizeBranchName('Fix Rate Limit!! 123')).toBe('fix-rate-limit-123');
  });
});

```

### src\main\utils\path-mapping.ts

```ts
import path from 'node:path';

import type { RunnerKind } from '@shared/types';

export function windowsToWslPath(inputPath: string): string {
  const normalized = path.win32.normalize(inputPath);
  const drive = normalized.slice(0, 1).toLowerCase();
  const remainder = normalized.slice(2).replace(/\\/g, '/');
  return `/mnt/${drive}${remainder}`;
}

export function mapPathForRunner(inputPath: string, runner: RunnerKind): string {
  if (runner === 'wsl') {
    return windowsToWslPath(inputPath);
  }

  return inputPath;
}

export function sanitizeBranchName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'task';
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

```

### src\main\utils\prompts.ts

```ts
import type { AgentId, Finding, TaskRun } from '@shared/types';

function findingsBlock(findings: Finding[]): string {
  if (!findings.length) {
    return 'No prior findings were recorded.';
  }

  return findings
    .map((finding) => {
      const location = finding.file ? ` (${finding.file}${finding.line ? `:${finding.line}` : ''})` : '';
      return `- [${finding.severity}] ${finding.title}${location}: ${finding.body}`;
    })
    .join('\n');
}

function jsonContract(sourceAgent: AgentId): string {
  return [
    'Return a concise natural-language answer, then include one machine-readable payload wrapped in <triad-json>...</triad-json>.',
    'The JSON object must contain:',
    '{"summary": "short summary", "findings": [{"severity":"low|medium|high|critical|info","title":"...","body":"...","file":"optional","line":1,"recommendedAction":"optional"}], "notes":["optional"], "recommendedRole":"optional"}.',
    `Set source-specific details from the perspective of ${sourceAgent}.`
  ].join('\n');
}

export function buildCodingPrompt(task: TaskRun): string {
  return [
    'You are the coding agent in Triad Workbench.',
    `Task brief: ${task.brief}`,
    'Work only inside the current git worktree.',
    'Make the necessary code changes, run the minimum checks you need, and explain the result.',
    jsonContract('claude')
  ].join('\n\n');
}

export function buildReviewPrompt(task: TaskRun, diff: string, reviewer: AgentId): string {
  return [
    'You are the reviewer/tester in Triad Workbench.',
    `Task brief: ${task.brief}`,
    'Review the current diff for correctness, regressions, security issues, and missing tests.',
    'If helpful, run tests or lightweight checks in this worktree.',
    `Current diff:\n\n${diff || 'No diff was generated.'}`,
    jsonContract(reviewer)
  ].join('\n\n');
}

export function buildFixPrompt(task: TaskRun, findings: Finding[]): string {
  return [
    'You are the coding agent in Triad Workbench.',
    `Task brief: ${task.brief}`,
    'Fix the following findings without undoing unrelated work:',
    findingsBlock(findings),
    jsonContract('claude')
  ].join('\n\n');
}

export function buildArchitecturePrompt(task: TaskRun, source: AgentId): string {
  return [
    'You are acting as an architecture advisor in Triad Workbench.',
    `Task brief: ${task.brief}`,
    'Provide a practical implementation approach with tradeoffs and edge cases.',
    jsonContract(source)
  ].join('\n\n');
}

export function buildMonitorPrompt(task: TaskRun): string {
  return [
    'You are in monitor mode for Triad Workbench.',
    `Watch for failures, stalls, and risky diffs for this task: ${task.brief}.`,
    'Suggest when another agent should intervene, but do not apply changes yourself.',
    jsonContract('ollama')
  ].join('\n\n');
}

```

### src\preload\index.ts

```ts
import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS, type WorkbenchApi } from '@shared/ipc';

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
  promoteTask: (taskId, action) => ipcRenderer.invoke(IPC_CHANNELS.promoteTask, taskId, action),
  setOllamaRole: (role, model) => ipcRenderer.invoke(IPC_CHANNELS.setOllamaRole, role, model),
  shutdownOllama: () => ipcRenderer.invoke(IPC_CHANNELS.shutdownOllama),
  setProjectArchiveEnabled: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.setProjectArchiveEnabled, enabled),
  saveProjectArchive: () => ipcRenderer.invoke(IPC_CHANNELS.saveProjectArchive),
  openProjectArchive: () => ipcRenderer.invoke(IPC_CHANNELS.openProjectArchive),
  onState: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: Awaited<ReturnType<WorkbenchApi['bootstrap']>>) => listener(state);
    ipcRenderer.on(IPC_CHANNELS.stateChanged, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, wrapped);
    };
  },
  onTerminalData: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; data: string }) => listener(payload);
    ipcRenderer.on(IPC_CHANNELS.terminalData, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.terminalData, wrapped);
    };
  }
};

contextBridge.exposeInMainWorld('workbench', api);

```

### src\renderer\index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Triad Workbench</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>

```

### src\renderer\src\App.tsx

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import type { AgentId, AgentProfile, AgentRole, TaskRun } from '@shared/types';
import { WORKFLOW_DEFINITIONS } from '@shared/workflows';

import { useWorkbenchStore } from './store';

import '@xterm/xterm/css/xterm.css';
import './styles.css';

const ROLE_OPTIONS: AgentRole[] = ['coder', 'reviewer', 'tester', 'architect', 'planner', 'monitor', 'developer', 'off'];

function formatStatus(agent: AgentProfile): string {
  return `${agent.status}${agent.version ? ` - ${agent.version}` : ''}`;
}

function findTerminalSession(agentId: AgentId, snapshot: ReturnType<typeof useWorkbenchStore.getState>['snapshot']) {
  return snapshot?.terminals.find((session) => session.agentId === agentId);
}

function TerminalPane({ sessionId, buffer }: { sessionId?: string; buffer?: string }) {
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

function AgentPanel({ agent }: { agent: AgentProfile }) {
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const terminalBuffers = useWorkbenchStore((state) => state.terminalBuffers);
  const setAgentRole = useWorkbenchStore((state) => state.setAgentRole);
  const startTerminal = useWorkbenchStore((state) => state.startTerminal);
  const stopTerminal = useWorkbenchStore((state) => state.stopTerminal);
  const sendTerminalInput = useWorkbenchStore((state) => state.sendTerminalInput);
  const setOllamaRole = useWorkbenchStore((state) => state.setOllamaRole);
  const session = findTerminalSession(agent.id, snapshot);
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

function TaskCard({ task, onPromote }: { task: TaskRun; onPromote: (action: 'apply-to-main' | 'keep-worktree' | 'open-task-branch') => void }) {
  return (
    <article className="task-card">
      <div className="task-card-header">
        <h4>{task.brief}</h4>
        <span>{task.stage}</span>
      </div>
      <p>{task.summary || 'No summary yet.'}</p>
      <div className="task-meta">
        <span>{task.workflowId}</span>
        <span>{task.branchName}</span>
      </div>
      {task.stage === 'promote' ? (
        <div className="task-actions">
          <button onClick={() => onPromote('apply-to-main')}>Apply to main</button>
          <button onClick={() => onPromote('keep-worktree')}>Keep worktree</button>
          <button onClick={() => onPromote('open-task-branch')}>Open task branch</button>
        </div>
      ) : null}
    </article>
  );
}

export default function App() {
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const error = useWorkbenchStore((state) => state.error);
  const isBusy = useWorkbenchStore((state) => state.isBusy);
  const bootstrap = useWorkbenchStore((state) => state.bootstrap);
  const applySnapshot = useWorkbenchStore((state) => state.applySnapshot);
  const appendTerminalData = useWorkbenchStore((state) => state.appendTerminalData);
  const selectProject = useWorkbenchStore((state) => state.selectProject);
  const probeAgents = useWorkbenchStore((state) => state.probeAgents);
  const setProjectRunner = useWorkbenchStore((state) => state.setProjectRunner);
  const startWorkflow = useWorkbenchStore((state) => state.startWorkflow);
  const promoteTask = useWorkbenchStore((state) => state.promoteTask);
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

  const latestTask = snapshot.tasks[0];
  const findings = latestTask?.findings ?? [];

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
              snapshot.tasks.map((task) => <TaskCard key={task.id} task={task} onPromote={(action) => void promoteTask(task.id, action)} />)
            ) : (
              <p className="empty-state">No tasks yet.</p>
            )}
          </section>
        </aside>

        <section className="center-grid">
          {(Object.values(snapshot.agents) as AgentProfile[]).map((agent) => (
            <AgentPanel key={agent.id} agent={agent} />
          ))}
        </section>

        <aside className="right-rail">
          <section className="card">
            <h2>Findings</h2>
            {findings.length ? (
              findings.map((finding, index) => (
                <article key={`${finding.sourceAgent}-${index}`} className={`finding finding-${finding.severity}`}>
                  <h4>{finding.title}</h4>
                  <p>{finding.body}</p>
                  <span>{finding.sourceAgent}</span>
                </article>
              ))
            ) : (
              <p className="empty-state">No findings yet.</p>
            )}
          </section>

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

### src\renderer\src\main.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

```

### src\renderer\src\store.ts

```ts
import { create } from 'zustand';

import type {
  AgentId,
  AgentRole,
  PromotionAction,
  RunnerKind,
  StartWorkflowInput,
  TerminalSession,
  WorkbenchSnapshot
} from '@shared/types';

interface WorkbenchState {
  snapshot?: WorkbenchSnapshot;
  terminalBuffers: Record<string, string>;
  error?: string;
  isBusy: boolean;
  bootstrap: () => Promise<void>;
  applySnapshot: (snapshot: WorkbenchSnapshot) => void;
  appendTerminalData: (sessionId: string, data: string) => void;
  selectProject: () => Promise<void>;
  probeAgents: (deep?: boolean) => Promise<void>;
  setProjectRunner: (runner: RunnerKind | 'auto') => Promise<void>;
  setAgentRole: (agentId: AgentId, role: AgentRole) => Promise<void>;
  startTerminal: (agentId: AgentId) => Promise<TerminalSession | undefined>;
  stopTerminal: (sessionId: string) => Promise<void>;
  sendTerminalInput: (sessionId: string, input: string) => Promise<void>;
  startWorkflow: (input: StartWorkflowInput) => Promise<void>;
  promoteTask: (taskId: string, action: PromotionAction) => Promise<void>;
  setOllamaRole: (role: AgentRole, model?: string) => Promise<void>;
  shutdownOllama: () => Promise<void>;
  setProjectArchiveEnabled: (enabled: boolean) => Promise<void>;
  saveProjectArchive: () => Promise<void>;
  openProjectArchive: () => Promise<void>;
}

type StateSetter = (partial: Partial<WorkbenchState> | ((state: WorkbenchState) => Partial<WorkbenchState>)) => void;

async function runAction<T>(set: StateSetter, action: () => Promise<T>, onSuccess: (result: T) => void): Promise<void> {
  set({ isBusy: true, error: undefined });
  try {
    const result = await action();
    onSuccess(result);
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    set({ isBusy: false });
  }
}

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  snapshot: undefined,
  terminalBuffers: {},
  error: undefined,
  isBusy: false,
  bootstrap: async () => {
    await runAction(set, () => window.workbench.bootstrap(), (snapshot) => {
      set({ snapshot });
    });
  },
  applySnapshot: (snapshot) => set({ snapshot }),
  appendTerminalData: (sessionId, data) =>
    set((state) => ({
      terminalBuffers: {
        ...state.terminalBuffers,
        [sessionId]: `${state.terminalBuffers[sessionId] ?? ''}${data}`
      }
    })),
  selectProject: async () => {
    await runAction(set, () => window.workbench.selectProject(), () => undefined);
  },
  probeAgents: async (deep) => {
    await runAction(set, () => window.workbench.probeAgents(deep), (snapshot) => set({ snapshot }));
  },
  setProjectRunner: async (runner) => {
    await runAction(set, () => window.workbench.setProjectRunner(runner), (snapshot) => set({ snapshot }));
  },
  setAgentRole: async (agentId, role) => {
    await runAction(set, () => window.workbench.setAgentRole(agentId, role), (snapshot) => set({ snapshot }));
  },
  startTerminal: async (agentId) => {
    let session: TerminalSession | undefined;
    await runAction(set, () => window.workbench.startTerminal(agentId), (result) => {
      session = result;
    });
    return session;
  },
  stopTerminal: async (sessionId) => {
    await runAction(set, () => window.workbench.stopTerminal(sessionId), () => undefined);
  },
  sendTerminalInput: async (sessionId, input) => {
    await runAction(set, () => window.workbench.sendTerminalInput(sessionId, input), () => undefined);
  },
  startWorkflow: async (input) => {
    await runAction(set, () => window.workbench.startWorkflow(input), (snapshot) => set({ snapshot }));
  },
  promoteTask: async (taskId, action) => {
    await runAction(set, () => window.workbench.promoteTask(taskId, action), (snapshot) => set({ snapshot }));
  },
  setOllamaRole: async (role, model) => {
    await runAction(set, () => window.workbench.setOllamaRole(role, model), (snapshot) => set({ snapshot }));
  },
  shutdownOllama: async () => {
    await runAction(set, () => window.workbench.shutdownOllama(), (snapshot) => set({ snapshot }));
  },
  setProjectArchiveEnabled: async (enabled) => {
    await runAction(set, () => window.workbench.setProjectArchiveEnabled(enabled), (snapshot) => set({ snapshot }));
  },
  saveProjectArchive: async () => {
    await runAction(set, () => window.workbench.saveProjectArchive(), (archive) =>
      set((state) => ({
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              archive: archive ?? state.snapshot.archive
            }
          : state.snapshot
      }))
    );
  },
  openProjectArchive: async () => {
    await runAction(set, () => window.workbench.openProjectArchive(), (archive) =>
      set((state) => ({
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              archive: archive ?? state.snapshot.archive
            }
          : state.snapshot
      }))
    );
  }
}));

```

### src\renderer\src\styles.css

```css
:root {
  color-scheme: light;
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(180deg, #f1f5fb 0%, #dfe7f1 100%);
  color: #122033;
}

* {
  box-sizing: border-box;
}

body,
#root {
  margin: 0;
  min-height: 100vh;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  border: none;
  border-radius: 12px;
  background: #1955d6;
  color: white;
  padding: 0.7rem 1rem;
  cursor: pointer;
}

button.selected,
button:hover {
  background: #123da0;
}

.shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(18, 32, 51, 0.1);
}

.top-bar h1,
.card h2,
.agent-panel h3,
.task-card h4,
.finding h4 {
  margin: 0;
}

.top-actions,
.panel-actions,
.task-actions,
.composer-actions,
.task-meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.layout {
  display: grid;
  grid-template-columns: 300px 1fr 320px;
  gap: 1rem;
  padding: 1rem 1.5rem;
}

.left-rail,
.right-rail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.center-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.card,
.agent-panel,
.bottom-dock .composer {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(18, 32, 51, 0.1);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(34, 59, 104, 0.08);
}

.card,
.agent-panel {
  padding: 1rem;
}

.workflow-list,
.task-card,
.finding {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.workflow-list button {
  text-align: left;
  padding: 1rem;
}

.task-card {
  border: 1px solid rgba(18, 32, 51, 0.08);
  border-radius: 16px;
  padding: 0.9rem;
  margin-top: 0.75rem;
}

.task-card-header,
.panel-header,
.composer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.agent-panel {
  min-height: 360px;
  display: flex;
  flex-direction: column;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.panel-message,
.artifact-summary p,
.empty-state,
.loading-screen {
  color: #4c5f7c;
}

.hint-text,
.archive-meta {
  color: #4c5f7c;
  margin: 0;
}

.terminal-canvas,
.terminal-empty {
  min-height: 180px;
  background: #101826;
  border-radius: 14px;
  padding: 0.25rem;
  overflow: hidden;
}

.terminal-empty {
  display: grid;
  place-items: center;
  color: #d8e1f0;
}

.terminal-input {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
}

.terminal-input input,
.right-rail input,
.composer textarea,
select {
  width: 100%;
  border: 1px solid rgba(18, 32, 51, 0.15);
  border-radius: 12px;
  padding: 0.75rem;
  background: white;
}

.toggle-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.toggle-row input {
  margin-top: 0.25rem;
}

.archive-path {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.archive-path code {
  display: block;
  padding: 0.75rem;
  border-radius: 12px;
  background: #edf3fb;
  color: #173257;
  word-break: break-all;
}

.finding {
  padding: 0.85rem;
  border-radius: 16px;
  margin-top: 0.75rem;
}

.finding-high,
.finding-critical {
  background: #fff0f0;
}

.finding-medium {
  background: #fff8e8;
}

.finding-low,
.finding-info {
  background: #eef6ff;
}

.bottom-dock {
  padding: 0 1.5rem 1.5rem;
}

.composer {
  padding: 1rem;
}

.composer textarea {
  min-height: 120px;
  margin: 0.75rem 0;
  resize: vertical;
}

.busy-indicator {
  color: #1955d6;
}

.error-banner {
  margin: 0.75rem 0 0;
  color: #ab1d33;
}

@media (max-width: 1280px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .center-grid {
    grid-template-columns: 1fr;
  }
}

```

### src\renderer\src\vite-env.d.ts

```ts
/// <reference types="vite/client" />

import type { WorkbenchApi } from '@shared/ipc';

declare global {
  interface Window {
    workbench: WorkbenchApi;
  }
}

export {};

```

### src\shared\ipc.ts

```ts
import type {
  AgentId,
  AgentRole,
  PromotionAction,
  ProjectArchiveSummary,
  ProjectRef,
  RunnerKind,
  StartWorkflowInput,
  TerminalSession,
  WorkbenchSnapshot
} from './types';

export interface WorkbenchApi {
  bootstrap: () => Promise<WorkbenchSnapshot>;
  selectProject: () => Promise<ProjectRef | undefined>;
  probeAgents: (deep?: boolean) => Promise<WorkbenchSnapshot>;
  setProjectRunner: (runner: RunnerKind | 'auto') => Promise<WorkbenchSnapshot>;
  setAgentRole: (agentId: AgentId, role: AgentRole) => Promise<WorkbenchSnapshot>;
  startTerminal: (agentId: AgentId) => Promise<TerminalSession>;
  stopTerminal: (sessionId: string) => Promise<void>;
  sendTerminalInput: (sessionId: string, input: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  startWorkflow: (input: StartWorkflowInput) => Promise<WorkbenchSnapshot>;
  promoteTask: (taskId: string, action: PromotionAction) => Promise<WorkbenchSnapshot>;
  setOllamaRole: (role: AgentRole, model?: string) => Promise<WorkbenchSnapshot>;
  shutdownOllama: () => Promise<WorkbenchSnapshot>;
  setProjectArchiveEnabled: (enabled: boolean) => Promise<WorkbenchSnapshot>;
  saveProjectArchive: () => Promise<ProjectArchiveSummary | undefined>;
  openProjectArchive: () => Promise<ProjectArchiveSummary | undefined>;
  onState: (listener: (state: WorkbenchSnapshot) => void) => () => void;
  onTerminalData: (listener: (payload: { sessionId: string; data: string }) => void) => () => void;
}

export const IPC_CHANNELS = {
  bootstrap: 'workbench:bootstrap',
  selectProject: 'workbench:project:select',
  probeAgents: 'workbench:agents:probe',
  setProjectRunner: 'workbench:project:set-runner',
  setAgentRole: 'workbench:agents:set-role',
  startTerminal: 'workbench:terminals:start',
  stopTerminal: 'workbench:terminals:stop',
  sendTerminalInput: 'workbench:terminals:input',
  resizeTerminal: 'workbench:terminals:resize',
  startWorkflow: 'workbench:workflow:start',
  promoteTask: 'workbench:workflow:promote',
  setOllamaRole: 'workbench:ollama:set-role',
  shutdownOllama: 'workbench:ollama:shutdown',
  setProjectArchiveEnabled: 'workbench:project:set-archive-enabled',
  saveProjectArchive: 'workbench:project:save-archive',
  openProjectArchive: 'workbench:project:open-archive',
  stateChanged: 'workbench:event:state',
  terminalData: 'workbench:event:terminal-data'
} as const;

```

### src\shared\types.ts

```ts
export type AgentId = 'claude' | 'codex' | 'gemini' | 'ollama';
export type AgentRole =
  | 'coder'
  | 'reviewer'
  | 'tester'
  | 'architect'
  | 'planner'
  | 'monitor'
  | 'compare-only'
  | 'developer'
  | 'off';
export type AuthMode = 'native-login' | 'api-key' | 'none';
export type RunnerKind = 'wsl' | 'windows' | 'http-local';
export type AgentStatus = 'missing' | 'installed' | 'needs-login' | 'ready' | 'running' | 'error';
export type WorkflowMode = 'orchestrate' | 'direct' | 'parallel' | 'chain';
export type WorkflowId =
  | 'code-review-fix-verify'
  | 'code-gemini-compare-codex-review'
  | 'architecture-compare'
  | 'away-monitor';
export type TaskStage =
  | 'brief'
  | 'code'
  | 'review'
  | 'findings'
  | 'fix'
  | 'verify'
  | 'promote'
  | 'done'
  | 'error';
export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'not-required';
export type PromotionAction = 'apply-to-main' | 'keep-worktree' | 'open-task-branch';
export type OllamaLifecycleOwner = 'external' | 'app-managed' | 'none';

export interface ProjectRef {
  id: string;
  name: string;
  rootPath: string;
  wslPath?: string;
  runnerPreference: RunnerKind | 'auto';
  isGitRepo: boolean;
  currentBranch?: string;
  archivePath: string;
  archiveEnabled: boolean;
}

export interface AgentCapabilitySet {
  supportsInteractive: boolean;
  supportsStructuredOutput: boolean;
  supportsEditing: boolean;
  supportsResume: boolean;
  supportsVision?: boolean;
  supportsBrowserLogin?: boolean;
}

export interface AgentProfile {
  id: AgentId;
  displayName: string;
  binaryOrEndpoint: string;
  authMode: AuthMode;
  role: AgentRole;
  runner: RunnerKind;
  status: AgentStatus;
  capabilities: AgentCapabilitySet;
  version?: string;
  installHelpUrl?: string;
  message?: string;
  detectedPath?: string;
  lastCheckedAt?: string;
}

export interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  body: string;
  file?: string;
  line?: number;
  sourceAgent: AgentId;
  evidence?: string;
  recommendedAction?: string;
}

export interface CommandRun {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface ArtifactBundle {
  id: string;
  taskId: string;
  stepId: string;
  agentId: AgentId;
  role: AgentRole;
  prompt: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  structuredEvents: unknown[];
  summary: string;
  finalMessage: string;
  patch?: string;
  findings: Finding[];
  commandRuns: CommandRun[];
  createdAt: string;
}

export interface TaskStepRecord {
  id: string;
  stage: TaskStage;
  agentId: AgentId;
  startedAt: string;
  completedAt?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  summary?: string;
}

export interface TaskRun {
  id: string;
  projectId: string;
  workflowId: WorkflowId;
  workflowMode: WorkflowMode;
  baseBranch: string;
  baseCommit: string;
  worktreePath: string;
  stage: TaskStage;
  brief: string;
  assignedAgents: AgentId[];
  approvalState: ApprovalState;
  branchName: string;
  summary?: string;
  errorMessage?: string;
  findings: Finding[];
  artifacts: ArtifactBundle[];
  steps: TaskStepRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface TerminalSession {
  id: string;
  agentId: AgentId;
  title: string;
  cwd: string;
  runner: RunnerKind;
  createdAt: string;
}

export interface ProjectArchiveSummary {
  path: string;
  enabled: boolean;
  lastSavedAt?: string;
}

export interface OllamaStatus {
  available: boolean;
  running: boolean;
  owner: OllamaLifecycleOwner;
  activeModel?: string;
  endpoint: string;
  message?: string;
}

export interface WorkbenchSnapshot {
  project?: ProjectRef;
  agents: Record<AgentId, AgentProfile>;
  tasks: TaskRun[];
  activeWorkflowId: WorkflowId;
  terminals: TerminalSession[];
  ollama: OllamaStatus;
  archive?: ProjectArchiveSummary;
  notifications: string[];
}

export interface WorkflowDefinition {
  id: WorkflowId;
  label: string;
  description: string;
  mode: WorkflowMode;
  stages: TaskStage[];
}

export interface StartWorkflowInput {
  brief: string;
  workflowId: WorkflowId;
  workflowMode?: WorkflowMode;
  agentOverrides?: Partial<Record<AgentId, AgentRole>>;
}

export interface ProbeResult {
  profile: AgentProfile;
  rawOutput: string;
}

export interface StructuredEnvelope<T> {
  triad: T;
}

export interface ParsedTriadPayload {
  summary: string;
  findings: Finding[];
  recommendedRole?: AgentRole;
  notes?: string[];
}

export const DEFAULT_AGENTS: Record<AgentId, AgentProfile> = {
  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    binaryOrEndpoint: 'claude',
    authMode: 'native-login',
    role: 'coder',
    runner: 'wsl',
    status: 'missing',
    installHelpUrl: 'https://code.claude.com/docs/en/quickstart',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    }
  },
  codex: {
    id: 'codex',
    displayName: 'Codex CLI',
    binaryOrEndpoint: 'codex',
    authMode: 'native-login',
    role: 'reviewer',
    runner: 'wsl',
    status: 'missing',
    installHelpUrl: 'https://developers.openai.com/codex',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: false
    }
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini CLI',
    binaryOrEndpoint: 'gemini',
    authMode: 'native-login',
    role: 'architect',
    runner: 'wsl',
    status: 'missing',
    installHelpUrl: 'https://github.com/google-gemini/gemini-cli',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    }
  },
  ollama: {
    id: 'ollama',
    displayName: 'Ollama',
    binaryOrEndpoint: 'http://localhost:11434',
    authMode: 'none',
    role: 'off',
    runner: 'http-local',
    status: 'installed',
    installHelpUrl: 'https://docs.ollama.com/windows',
    capabilities: {
      supportsInteractive: false,
      supportsStructuredOutput: true,
      supportsEditing: false,
      supportsResume: false
    }
  }
};

```

### src\shared\workflows.ts

```ts
import type { WorkflowDefinition } from './types';

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'code-review-fix-verify',
    label: 'Code -> Review -> Fix -> Verify',
    description: 'Claude codes, Codex reviews, Claude fixes, Codex verifies inside an isolated worktree.',
    mode: 'orchestrate',
    stages: ['brief', 'code', 'review', 'findings', 'fix', 'verify', 'promote']
  },
  {
    id: 'code-gemini-compare-codex-review',
    label: 'Code -> Gemini Compare -> Codex Review',
    description: 'Claude codes first, Gemini compares or critiques, and Codex finishes the final review pass.',
    mode: 'chain',
    stages: ['brief', 'code', 'review', 'findings', 'verify', 'promote']
  },
  {
    id: 'architecture-compare',
    label: 'Architecture Compare',
    description: 'Compare architecture suggestions from Claude, Codex, Gemini, and Ollama side-by-side.',
    mode: 'parallel',
    stages: ['brief', 'review', 'done']
  },
  {
    id: 'away-monitor',
    label: 'Away Monitor',
    description: 'Keep Ollama in monitor mode for long-running work and surface issues when the session stalls.',
    mode: 'direct',
    stages: ['brief', 'review', 'done']
  }
];

```

### TRIAD_WORKBENCH_AI_CONTEXT.md

```md
# Triad Workbench AI Context

This document is the handoff file for any AI agent that needs to understand, continue, or review the project quickly.

The source code is the canonical implementation. This file is the high-signal map of how the system works, why it exists, what is already implemented, and what still needs to be built.

## Product Goal

Triad Workbench is a local Electron desktop app for orchestrating multiple coding agents in one workspace without relying on browser tabs.

Primary roles:

- Claude Code: main coder
- Codex CLI: reviewer and tester
- Gemini CLI: optional reviewer, architect, or coder
- Ollama: optional local monitor, tester, developer, architect, or off

Core promise:

- local-first
- CLI-native orchestration
- isolated git worktrees for safety
- explicit promotion back to the main checkout
- persistent project archive of AI output

## Current Status

Implemented:

- Electron + React + Vite shell
- agent grid UI with interactive terminals for CLI agents
- startup probing for Claude, Codex, Gemini, and Ollama
- workflow engine for built-in multi-agent flows
- isolated git worktree creation per task run
- task promotion back to main checkout
- SQLite persistence
- per-project archive folder inside `.triad-workbench`
- Ollama lifecycle reuse and shutdown behavior

Partially implemented:

- approval and review UI is functional but still basic
- findings display exists, but handoffs are not yet fully interactive
- onboarding exists, but deep auth verification can be improved

Not yet fully implemented:

- rich diff viewer and review center
- custom workflow builder
- archive browser inside the app
- explicit cross-agent handoff actions like "send this finding to Claude"
- more polished dashboard styling to match the mockup closely

## Architecture Summary

### Main Process

The Electron main process owns orchestration, filesystem operations, subprocess execution, persistence, and IPC.

Main entry:

- `src/main/index.ts`

Central coordinator:

- `src/main/app-controller.ts`

Main responsibilities:

- bootstrap persisted state
- probe agent connectors
- select and inspect project folders
- create and track interactive terminals
- start workflows
- promote finished task diffs
- manage Ollama state
- save project archive snapshots and logs

### Renderer Process

The React renderer is the operator dashboard.

Main renderer files:

- `src/renderer/src/App.tsx`
- `src/renderer/src/store.ts`
- `src/renderer/src/styles.css`

Responsibilities:

- render agent panels
- show tasks, findings, notifications, and archive controls
- allow workflow execution
- display terminal streams from the main process
- allow direct terminal input for interactive CLI sessions

### Shared Contracts

The shared TypeScript definitions are the main contract between main and renderer.

Key files:

- `src/shared/types.ts`
- `src/shared/ipc.ts`
- `src/shared/workflows.ts`

Important types:

- `AgentProfile`
- `TaskRun`
- `ArtifactBundle`
- `Finding`
- `ProjectRef`
- `WorkbenchSnapshot`

## Connector System

The connector abstraction is defined in:

- `src/main/connectors/base.ts`

Concrete connectors:

- `src/main/connectors/claude-connector.ts`
- `src/main/connectors/codex-connector.ts`
- `src/main/connectors/gemini-connector.ts`
- `src/main/connectors/ollama-connector.ts`

Behavior:

- CLI agents support `probe`, `runJob`, and interactive terminal launch specs
- Ollama uses the local HTTP API instead of a PTY-based CLI flow in orchestrated mode

Connector outputs are normalized into `ArtifactBundle`, which includes:

- prompt
- role
- stdout
- stderr
- summary
- final message
- patch
- findings
- command runs

## Workflow Engine

Workflow logic lives in:

- `src/main/services/workflow-engine.ts`

Implemented workflows:

- `code-review-fix-verify`
- `code-gemini-compare-codex-review`
- `architecture-compare`
- `away-monitor`

Canonical task path:

- `brief -> code -> review -> findings -> fix -> verify -> promote`

Each workflow step:

- creates a `TaskStepRecord`
- runs one connector job
- captures an `ArtifactBundle`
- merges findings back into the task
- updates task state and persistence

## Workspace Safety Model

Workspace logic lives in:

- `src/main/services/workspace-manager.ts`

Rules:

- every workflow task gets its own git worktree
- agent changes stay inside the worktree
- promotion to the main checkout is explicit
- `apply-to-main` is blocked if the main checkout has uncommitted changes

Current archive path per project:

- `<project>/.triad-workbench`

## Project Archive System

Archive logic lives in:

- `src/main/services/project-archive.ts`

What it saves:

- `project.json`
- latest full snapshot
- agent state snapshot
- notifications snapshot
- task JSON
- per-artifact JSON
- prompts
- stdout logs
- stderr logs
- patch diffs
- terminal sessions
- terminal transcript log
- terminal transcript JSONL
- events JSONL

Archive folder structure:

```text
.triad-workbench/
  project.json
  state/
    latest-snapshot.json
    agents.json
    notifications.json
  tasks/
    <task-id>/
      task.json
      artifacts/
        <artifact-id>.json
        <artifact-id>.prompt.txt
        <artifact-id>.stdout.log
        <artifact-id>.stderr.log
        <artifact-id>.patch.diff
  terminals/
    <session-id>/
      session.json
      transcript.log
      transcript.jsonl
  events/
    events.jsonl
```

## Persistence

SQLite persistence lives in:

- `src/main/services/persistence.ts`

Current persisted entities:

- latest project
- agent profiles
- tasks
- artifacts

The project record also stores:

- runner preference
- git metadata
- archive path
- archive enabled state

## Terminal System

Interactive PTY management lives in:

- `src/main/services/terminal-manager.ts`
- `src/main/services/process-runner.ts`

Renderer display uses:

- `@xterm/xterm`
- `@xterm/addon-fit`

Terminal flow:

- main process spawns PTY
- main emits terminal data over IPC
- renderer stores terminal buffer in Zustand
- `App.tsx` renders the buffer in an xterm canvas
- user input is sent back to the PTY through IPC

The archive layer also records terminal output and user input when project archive is enabled.

## Renderer Layout

Current UI structure:

- top bar: project context, runner selector, probe action
- left rail: workflow list and task list
- center grid: one panel per agent
- right rail: findings, Ollama controls, project archive controls, notifications
- bottom dock: workflow composer

Design preview assets:

- `design-preview/index.html`
- `design-preview/styles.css`

Preview screenshot:

- `triad-workbench-preview.png`

## How To Run

Development:

- `npm install`
- `npm run dev`

Validation:

- `npm run typecheck`
- `npm test`
- `npm run build`

External tools expected on the machine or selected runner:

- `claude`
- `codex`
- `gemini`
- optionally `ollama`

## Important Implementation Invariants

- Do not let orchestrated agents write directly into the main checkout.
- Keep worktree promotion explicit.
- Preserve local-first behavior.
- Prefer CLI-native agent execution over browser automation.
- Treat the project archive as durable evidence of what the agents did.
- Use shared types as the contract between main and renderer.

## Best Files To Read First

If another AI needs to continue building the project, read these first:

1. `README.md`
2. `TRIAD_WORKBENCH_AI_CONTEXT.md`
3. `src/shared/types.ts`
4. `src/main/app-controller.ts`
5. `src/main/services/workflow-engine.ts`
6. `src/main/services/workspace-manager.ts`
7. `src/main/services/project-archive.ts`
8. `src/renderer/src/App.tsx`
9. `src/renderer/src/store.ts`

## Recommended Next Work

Highest-value next block:

1. Build a richer review and approval center.

That should include:

- artifact timeline
- focused findings panel
- selected artifact detail view
- patch and diff inspection
- clear promote actions
- handoff actions like "send findings to Claude"

After that:

2. Improve deep auth and install verification
3. Add an archive browser inside the app
4. Add a custom workflow builder
5. Polish the dashboard to match the visual mockup more closely

## Current Reality Check

This project is already a real working scaffold, not just a plan document.

It currently supports:

- running the desktop app
- selecting a project
- probing agents
- starting built-in workflows
- using interactive terminals
- saving project archive data

It is not yet finished as a full production-grade workbench, but the architecture is already in place and the next steps are clear.

```

### TRIAD_WORKBENCH_BUILD_GUIDE.md

```md
# Triad Workbench Build Guide

This document is the execution guide for any AI or human contributor who needs to keep building Triad Workbench.

It focuses on three things:

- build roadmap
- frontend UI plan
- agent interaction protocol

Read this after:

1. `README.md`
2. `TRIAD_WORKBENCH_AI_CONTEXT.md`

## Product Intent

Triad Workbench is meant to be a local mission-control app for multiple coding agents working on the same project safely.

The app should make this loop easy:

1. Claude writes code in an isolated worktree
2. Codex reviews and tests it
3. Claude fixes findings
4. Codex verifies again
5. User promotes the result

Gemini and Ollama extend that loop:

- Gemini adds low-cost architecture or review support
- Ollama adds local monitoring, architecture thinking, or extra evaluation when the user wants a local model

## Build Roadmap

### Phase 1: Foundation

Status: mostly done

Delivered:

- Electron app shell
- React renderer
- shared IPC contract
- CLI connectors
- workflow engine
- worktree safety model
- SQLite persistence
- per-project archive folder

Files:

- `src/main/index.ts`
- `src/main/app-controller.ts`
- `src/shared/types.ts`
- `src/shared/ipc.ts`
- `src/main/services/workflow-engine.ts`
- `src/main/services/workspace-manager.ts`
- `src/main/services/persistence.ts`
- `src/main/services/project-archive.ts`

### Phase 2: Review Center

Status: next major build target

Goal:

Turn the current dashboard into a true code-review workstation.

Needs:

- selected task detail view
- artifact timeline
- patch inspection panel
- rich findings list
- clear approval controls
- promote action center
- quick handoff actions between agents

Recommended implementation:

- split right rail into:
  - active task summary
  - findings
  - artifacts
  - approvals
- add a central detail pane for the currently selected artifact
- support toggling between:
  - summary
  - prompt
  - stdout
  - stderr
  - patch
  - structured findings

### Phase 3: Onboarding Hardening

Status: pending

Goal:

Make first-run setup reliable even when one or more agents are missing or not logged in.

Needs:

- better install detection
- better auth verification
- friendlier status messages
- environment-aware runner checks for Windows vs WSL
- Gemini auth mode guidance
- Ollama model discovery

Desired states per agent:

- missing
- installed but not ready
- needs login
- ready
- running
- error

### Phase 4: Archive Browser

Status: pending

Goal:

Make `.triad-workbench` readable inside the app instead of only on disk.

Needs:

- task history explorer
- transcript reader
- prompt viewer
- artifact viewer
- event timeline
- filter by agent, workflow, date, or severity

### Phase 5: Custom Workflow Builder

Status: pending

Goal:

Let users define chains beyond the built-in templates.

Examples:

- `Claude -> Codex -> Claude -> Codex`
- `Gemini architect -> Claude coder -> Codex verify`
- `Claude -> Gemini compare -> Codex final review`

Needs:

- workflow step editor
- agent selector
- role selector
- prompt template per step
- approval gate toggle per step
- save named workflow

### Phase 6: Final UX Polish

Status: pending

Goal:

Make the UI match the intended mission-control visual language.

Needs:

- stronger dark theme
- richer panel styling
- clearer agent identity colors
- denser terminal visuals
- better empty states
- smoother task selection flow

## Frontend UI Plan

### Current Layout

Current structure in `src/renderer/src/App.tsx`:

- top bar
- left rail
- center agent grid
- right rail
- bottom composer

This is the correct overall layout and should be preserved.

### Target Layout

#### Top Bar

Should show:

- project name
- current branch
- runner mode
- quick agent health
- workflow status
- quick archive status

#### Left Rail

Should contain:

- active workflows
- task queue
- task filters
- workspace/project summary

Future additions:

- saved workflow chains
- archive history shortcuts

#### Center Area

Should become a two-layer workspace:

1. agent grid
2. selected task or artifact detail panel

Suggested behavior:

- clicking a task in the left rail changes the right-side detail context
- clicking an artifact inside a task shows that artifactâ€™s details
- clicking a finding focuses the related artifact and patch

#### Right Rail

Should be the review rail.

Recommended cards:

- active task summary
- findings
- approval center
- handoff suggestions
- archive controls

#### Bottom Composer

Should remain the main entry point for:

- task brief
- workflow selection
- direct mode
- parallel mode
- future chain mode

Future additions:

- attach file paths
- quick prompt presets
- keyboard shortcut hints

### Artifact Detail View

This is the most important missing UI.

Each artifact should expose:

- source agent
- role
- stage
- created time
- summary
- prompt
- final message
- stdout
- stderr
- findings
- patch
- command runs

Recommended tabs:

- `Overview`
- `Prompt`
- `Patch`
- `Logs`
- `Findings`
- `Commands`

### Diff And Patch Plan

The app does not need a full external Git client, but it does need a usable patch viewer.

Recommended first version:

- monospace patch viewer with add/remove highlighting
- line wrapping off by default
- copy diff button
- open worktree button

Recommended later version:

- Monaco diff view
- side-by-side patch mode
- inline file navigation

## Agent Interaction Protocol

This is the intended behavior between Claude, Codex, Gemini, and Ollama.

### Core Roles

#### Claude

Default role:

- coder

Primary responsibilities:

- implement requested code changes
- fix review findings
- work only inside the task worktree

Claude should receive:

- task brief
- current findings
- relevant prior artifact summary

Claude should return:

- concise explanation
- structured `<triad-json>` payload
- code changes in the worktree

#### Codex

Default role:

- reviewer or tester

Primary responsibilities:

- inspect diffs
- run focused validation
- surface bugs, regressions, or missing tests

Codex should receive:

- task brief
- current diff
- verification context

Codex should return:

- findings
- summary
- recommended next action

Codex should not be treated as the default writer during orchestrated review stages.

#### Gemini

Default role:

- architect or optional reviewer

Primary responsibilities:

- provide alternative implementation directions
- critique design choices
- give a second review pass when wanted

Gemini is best used for:

- architecture compare workflows
- low-cost second opinion reviews
- design tradeoff analysis

#### Ollama

Default role:

- off

Optional roles:

- monitor
- tester
- developer
- architect

Primary responsibilities:

- local-only support
- monitoring stalls or failures
- offering architecture analysis
- performing optional local reasoning passes

Ollama lifecycle rules:

- if external daemon exists, reuse it
- if app starts it, app may shut it down later
- if user switches it off, free resources when possible

### Standard Workflow Protocol

#### Code -> Review -> Fix -> Verify

1. Claude receives coding brief
2. Claude edits inside worktree
3. App captures diff
4. Codex reviews diff and optionally runs checks
5. Findings are merged into the task
6. Claude receives findings-focused fix prompt
7. Codex verifies resulting diff
8. User reviews and promotes

#### Code -> Gemini Compare -> Codex Review

1. Claude codes
2. Gemini critiques or compares direction
3. Claude may fix if findings exist
4. Codex performs the final review

#### Architecture Compare

1. Claude, Codex, Gemini, and Ollama each receive an architecture prompt
2. Their outputs are stored as artifacts
3. User compares summaries and chooses a direction

#### Away Monitor

1. Ollama receives a monitoring prompt
2. It should not apply changes
3. It should only report risks, stalls, or when another agent should intervene

### Prompt Contract

Prompt builders live in:

- `src/main/utils/prompts.ts`

Current contract:

- natural-language answer first
- machine-readable payload inside `<triad-json>...</triad-json>`

The JSON payload should contain:

- `summary`
- `findings`
- `notes`
- `recommendedRole`

This contract is important because the workflow engine depends on normalized parsing rather than raw vendor-specific output.

### Handoff Rules

The app should eventually make handoffs explicit.

Recommended handoff actions:

- `Send findings to Claude`
- `Ask Codex to verify latest Claude fix`
- `Ask Gemini for architecture alternative`
- `Ask Ollama to monitor this task`

Future rule:

- handoffs should pass structured context, not entire raw transcripts unless requested

### Safety Rules

Always preserve these invariants:

- main checkout is protected
- orchestrated work happens in task worktrees
- promotion is explicit
- archive records what the agents did
- reviewer roles should be treated as read-only by policy even if the underlying CLI is capable of editing

## Recommended Order For Future AI Contributors

If an AI is continuing this project, it should usually follow this order:

1. read `README.md`
2. read `TRIAD_WORKBENCH_AI_CONTEXT.md`
3. read this file
4. inspect `src/shared/types.ts`
5. inspect `src/main/app-controller.ts`
6. inspect `src/main/services/workflow-engine.ts`
7. inspect `src/renderer/src/App.tsx`

Then choose one focused task:

- review center
- onboarding hardening
- archive browser
- custom workflow builder
- visual polish

```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@renderer/*": ["src/renderer/src/*"],
      "@main/*": ["src/main/*"]
    },
    "types": ["node"]
  },
  "include": ["src", "electron.vite.config.ts", "vitest.config.ts"]
}

```

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});

```

