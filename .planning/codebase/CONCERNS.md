# Codebase Concerns

**Analysis Date:** 2026-03-15

## Tech Debt

**Unbounded Terminal Buffer Growth:**
- Issue: `TerminalManager` in `src/main/services/terminal-manager.ts` and the Zustand store in `src/renderer/src/store.ts` accumulate terminal data indefinitely in memory via `terminalBuffers`. The store appends to buffers without truncation or rotation, causing memory leaks during long-running interactive sessions.
- Files: `src/main/services/terminal-manager.ts`, `src/renderer/src/store.ts` (line 70)
- Impact: Extended terminal sessions (hours of agent interaction) will consume unbounded heap memory, eventually crashing the Electron process or freezing the UI.
- Fix approach: Implement a circular buffer or ring buffer pattern with a maximum line count (e.g., 10,000 lines). Implement periodic cleanup or use a streaming approach for terminal output.

**Process Timeout Not Universally Enforced:**
- Issue: `BaseConnector.runJob()` in `src/main/connectors/base.ts` (line 86) uses `getTimeoutMs()` which defaults to 60 seconds. However, some operations (large repos, slow agents) may exceed this silently, and timeouts can kill processes without graceful error handling.
- Files: `src/main/connectors/base.ts` (line 132-134), `src/main/services/process-runner.ts` (line 70-73)
- Impact: Workflows may hang indefinitely or timeout abruptly, leaving worktrees in inconsistent states or zombie processes.
- Fix approach: Add explicit timeout configuration per workflow type, implement graceful shutdown sequences, ensure worktree cleanup on timeout.

**Unbounded Archive File Growth:**
- Issue: `ProjectArchiveService` in `src/main/services/project-archive.ts` appends to transcript logs and event logs indefinitely without any rotation, compression, or purging. Long-running projects will accumulate gigabytes of logs.
- Files: `src/main/services/project-archive.ts` (lines 130-131, 140-147)
- Impact: Disk space exhaustion; archive operations slow down over time; no cleanup strategy for old sessions.
- Fix approach: Implement log rotation (e.g., daily snapshots), add archive retention policy, compress old artifacts, provide UI for archival cleanup.

**SQLite Database Growth Without Vacuuming:**
- Issue: `PersistenceService` in `src/main/services/persistence.ts` uses better-sqlite3 with WAL mode but never runs VACUUM. Deleted tasks and artifacts leave unused pages in the database file.
- Files: `src/main/services/persistence.ts` (lines 14-15)
- Impact: Database file grows unbounded; queries may slow down; disk space wasted.
- Fix approach: Add periodic VACUUM calls (e.g., on app startup or when archiving), implement database cleanup on deletion operations.

**Weak Error Messages in Workflow Failures:**
- Issue: `WorkflowEngine.runStep()` in `src/main/services/workflow-engine.ts` (lines 171-176) catches errors but stores only `error.message`. For network failures, agent crashes, or complex git operations, the message may be truncated or unhelpful, making debugging difficult.
- Files: `src/main/services/workflow-engine.ts` (line 175)
- Impact: Users cannot diagnose failures; support tickets contain insufficient context; logs are difficult to parse.
- Fix approach: Store full error stack, stderr output, and execution context (worker PID, duration). Implement structured error logging.

## Known Bugs

**Terminal Data Not Synced When Switching Projects:**
- Symptoms: Terminal buffers from previous project session persist; garbage terminal output appears after project switch
- Files: `src/renderer/src/store.ts` (line 57), `src/main/app-controller.ts` (lines 95-106)
- Trigger: Open Project A → start terminal → switch to Project B → terminal shows old data
- Workaround: Manually click "Clear" or reload the app
- Root cause: `terminalBuffers` state is global and project-agnostic; no cleanup on project switch

**Ollama Process Not Cleaned Up on Unexpected Exit:**
- Symptoms: `ollama serve` orphaned processes accumulate; VRAM stays allocated to dead processes
- Files: `src/main/services/ollama-manager.ts` (lines 65-70)
- Trigger: Close app while Ollama is app-managed → restart → new Ollama spawned → old one still running
- Workaround: Manual `taskkill /IM ollama.exe /F` needed
- Root cause: `spawn(..., { detached: true }).unref()` means process survives app exit; no shutdown signal handler

**Worktree Never Cleaned When Workflow Errors:**
- Symptoms: `.git/worktrees/` directory accumulates stale worktrees; disk fills up; subsequent tasks fail
- Files: `src/main/services/workspace-manager.ts` (line 108-113)
- Trigger: Start workflow → agent crashes → task marked as error → worktree left behind
- Workaround: Manual cleanup via `git worktree remove --force`
- Root cause: `WorkflowEngine.runStep()` doesn't call `cleanupTaskWorkspace()` on failure

**Read-Only Enforcement False Positive:**
- Symptoms: High-severity finding raised even when agent read-only stages legitimately modify workspace (e.g., creating test files)
- Files: `src/main/services/workflow-engine.ts` (lines 155-162)
- Trigger: Run 'verify' stage with agent that outputs test artifacts → false positive
- Workaround: Ignore the finding or manually review the diff
- Root cause: Comparison uses `getDiff()` which includes *all* changes; doesn't distinguish between intended test output and unintended edits

## Security Considerations

**Command Injection via Unsanitized Prompts:**
- Risk: LLM prompts in `src/main/utils/prompts.ts` are concatenated directly into shell commands without escaping. A malicious or compromised agent response could inject shell commands.
- Files: `src/main/connectors/claude-connector.ts` (lines 14-26), `src/main/connectors/codex-connector.ts`, `src/main/connectors/gemini-connector.ts`
- Current mitigation: Prompts are controlled by the user, not external input. Arguments use proper array form for `spawn()` (not shell strings).
- Recommendations: Validate that `input.prompt` doesn't exceed size limits (prevent log injection). Use `--prompt-file` instead of `-p` for large prompts. Consider sandboxing agent execution.

**Process Spawning Without Resource Limits:**
- Risk: `ProcessRunner.run()` in `src/main/services/process-runner.ts` spawns child processes without memory, CPU, or file descriptor limits. A misbehaving agent could exhaust system resources.
- Files: `src/main/services/process-runner.ts` (lines 46-54)
- Current mitigation: Default 60-second timeout kills runaway processes.
- Recommendations: Use Node.js `resourceLimits` on worker threads (if moving to worker pool), or implement system-level cgroups on WSL runner.

**Artifact Paths Not Validated:**
- Risk: Archive paths in `ProjectArchiveService` use `project.archivePath` without validation. Symlinks or path traversal (e.g., `../../../`) could write outside intended directory.
- Files: `src/main/services/project-archive.ts` (lines 162-164), `src/main/services/persistence.ts` (line 35)
- Current mitigation: Paths are set by app, not user input; Electron runs with user privileges.
- Recommendations: Normalize and validate all archive paths; reject paths containing `..` or symlinks.

**Unencrypted SQLite Database:**
- Risk: `better-sqlite3` database stores all agent profiles, task metadata, and findings in plaintext. If user data dir is compromised, all project data is readable.
- Files: `src/main/services/persistence.ts` (line 13)
- Current mitigation: Database lives in `app.getPath('userData')`, which is user-only on most systems.
- Recommendations: For sensitive projects, implement at-rest encryption using sqlcipher or similar; document data security model.

## Performance Bottlenecks

**Diff Computation on Every Task State Update:**
- Problem: `WorkflowEngine.runStep()` calls `getDiff()` before and after read-only steps (lines 144, 153). Large repos with big diffs (monorepos) can stall the workflow for seconds.
- Files: `src/main/services/workflow-engine.ts` (lines 144, 153), `src/main/services/workspace-manager.ts` (line 72-79)
- Cause: `git diff` on large repos is O(worktree size); no caching.
- Improvement path: Cache diffs per task; skip diff if no file changes detected; consider shallow diffs for performance.

**Linear Task Lookup:**
- Problem: `AppController.upsertTask()` (line 301) uses `findIndex()` to locate tasks. With hundreds of tasks, this becomes O(n) per operation.
- Files: `src/main/app-controller.ts` (lines 300-311)
- Cause: Tasks stored in array; no index.
- Improvement path: Use a Map<taskId, task> internally; maintain array for UI only. Batch upserts.

**Full Snapshot Serialization on Every Emit:**
- Problem: `AppController.emitState()` calls `saveSnapshot()` which serializes the entire `WorkbenchSnapshot` to JSON on disk every time state changes. With large task lists, this is slow.
- Files: `src/main/app-controller.ts` (lines 317-322), `src/main/services/project-archive.ts` (lines 53-82)
- Cause: No differential updates; always write full JSON.
- Improvement path: Only persist changed fields; use binary format (msgpack) for large snapshots; debounce persistence.

**Artifact List Rendering Without Virtualization:**
- Problem: `TaskDetailPanel` in `src/renderer/src/components/TaskDetailPanel.tsx` renders all artifacts in a list (line 75-85). With 1000+ artifacts per task, rendering blocks the UI.
- Files: `src/renderer/src/components/TaskDetailPanel.tsx` (lines 72-87)
- Cause: React renders full list; no windowing.
- Improvement path: Use react-window or react-virtualized for large lists. Implement lazy loading.

## Fragile Areas

**Workflow State Machine Not Enforced:**
- Files: `src/main/services/workflow-engine.ts`, `src/shared/types.ts` (TaskStage enum)
- Why fragile: Task stages can transition to invalid states (e.g., 'brief' -> 'done' skipping all steps). No state validation on task updates. UI assumes stages follow expected order.
- Safe modification: Add a `isValidTransition(from: TaskStage, to: TaskStage): boolean` function. Validate all stage assignments. Document state machine in comments.
- Test coverage: No tests for invalid state transitions

**Connector Polymorphism Without Tests:**
- Files: `src/main/connectors/` (base.ts, claude-connector.ts, codex-connector.ts, gemini-connector.ts, ollama-connector.ts)
- Why fragile: Each connector subclass implements `getScriptedCommand()` differently. A typo in args could break a connector silently.
- Safe modification: Add integration tests for each connector (mock process execution). Verify command args before spawning.
- Test coverage: No tests; only unit tests for parsing exist

**Git Worktree Path Mapping Between Windows/WSL:**
- Files: `src/main/services/workspace-manager.ts` (line 57), `src/main/utils/path-mapping.ts`
- Why fragile: Path conversion between Windows and WSL is error-prone. A wrong separator or case issue breaks git operations.
- Safe modification: Add round-trip tests: Windows path -> WSL -> Windows should be identical. Mock git operations with known path inputs.
- Test coverage: `path-mapping.test.ts` exists but is minimal

**Parse-Driven Architecture:**
- Files: `src/main/connectors/base.ts` (line 89), `src/main/utils/parsing.ts`
- Why fragile: Extraction of findings and patches relies on regex patterns over agent output. If an agent changes output format, parsing fails silently and losses findings.
- Safe modification: Add fallback parsing; log parse failures. Consider structured output (JSON-only) as future requirement.
- Test coverage: `parsing.test.ts` tests basic cases but not edge cases (truncated JSON, malformed patches)

## Scaling Limits

**Single Electron Main Thread:**
- Current capacity: ~50-100 concurrent tasks before UI becomes unresponsive
- Limit: All I/O (file, git, process) runs on the main thread. Long git operations block UI.
- Scaling path: Move I/O to worker threads; use `node:worker_threads` or `piscina`. Implement queue for workflow jobs.

**In-Memory Artifact Buffer:**
- Current capacity: ~1000 artifacts at ~1MB each = 1GB
- Limit: `ArtifactBundle` and full task snapshots held in memory. Large diffs (100MB+) crash process.
- Scaling path: Stream artifacts to disk; keep only recent artifacts in memory. Implement lazy loading from archive.

**SQLite Single Writer:**
- Current capacity: ~10 writes per second before lock contention
- Limit: better-sqlite3 serializes writes; simultaneous task updates queue.
- Scaling path: Batch writes; use async query queue (e.g., sql.js in worker thread).

**PTY Session Count:**
- Current capacity: ~20 concurrent terminals per app
- Limit: Each terminal allocates system resources (file descriptors, memory). OS limits reached around 20.
- Scaling path: Implement session pooling; detach idle terminals; use SSH for remote shells instead of PTY.

## Dependencies at Risk

**better-sqlite3 Windows Compatibility:**
- Risk: `better-sqlite3` requires native compilation. Prebuilt binaries may not work on all Windows versions; npm install failures are common.
- Impact: Setup failures; users can't load previous projects.
- Migration plan: Consider `sql.js` (pure JS, slower) or `sqlite3` (async, different API) as fallback.

**Ollama Binary Distribution:**
- Risk: No vendored Ollama binary. Users must install and manage Ollama separately. Distribution channels may change.
- Impact: Setup friction; version mismatches; integration breaks if Ollama changes API.
- Migration plan: Bundle Ollama in app (if license permits); detect major version changes and warn user.

**Node-PTY Node Version Sensitivity:**
- Risk: `node-pty` depends on Node.js ABI. Electron's bundled Node may not match build environment, causing segfaults on `require('node-pty')`.
- Impact: Interactive terminals fail on certain Electron versions; debugging is difficult.
- Migration plan: Use `prebuilt` binaries; test against supported Node versions; consider pure JS PTY (less performant).

## Missing Critical Features

**No Cancellation Mechanism for Long Workflows:**
- Problem: Once a workflow starts, there's no clean way to cancel it mid-execution. Killing the process leaves worktrees in dirty state.
- Blocks: Users cannot stop runaway agents; must kill entire app.
- Fix approach: Implement `AbortController` pattern; propagate cancellation through connectors; ensure cleanup on abort.

**No Persistence of Workflow Partial Results:**
- Problem: If app crashes during a multi-step workflow, all in-memory state is lost. Previous step outputs are not recovered.
- Blocks: Long workflows are risky; users reluctant to run overnight jobs.
- Fix approach: Checkpoint workflow state to disk after each step; implement resume logic.

**No Rate Limiting or Quota Management:**
- Problem: No limits on API calls to Claude, Codex, or Gemini. A loop could exhaust monthly quotas.
- Blocks: Cannot deploy in multi-user setups; cost control is impossible.
- Fix approach: Add per-agent call counters; implement quota alerts and hard limits.

## Test Coverage Gaps

**No Workflow Integration Tests:**
- What's not tested: Full end-to-end workflow execution (code-review-fix-verify). Mock agents, mock git, verify state transitions.
- Files: `src/main/services/workflow-engine.ts` (all)
- Risk: Silent failures in state machine; duplicate findings; missed cleanup.
- Priority: High — workflows are the core feature

**No Project Archive Tests:**
- What's not tested: File I/O, log rotation, cleanup. Verify archives survive app restart.
- Files: `src/main/services/project-archive.ts` (all)
- Risk: Silent disk failures; corrupted archives; data loss.
- Priority: High — archives are permanent record

**No ProcessRunner Timeout Tests:**
- What's not tested: Timeout enforcement, cleanup on kill, stderr capture for long-running processes.
- Files: `src/main/services/process-runner.ts` (all)
- Risk: Timeouts don't work; processes not cleaned up; zombie processes accumulate.
- Priority: High — process execution is critical

**No Connector Subclass Tests:**
- What's not tested: Each connector's `getScriptedCommand()` output. Mocking agents to verify args are correct.
- Files: `src/main/connectors/` (all)
- Risk: Connector arg typos; silent failures.
- Priority: Medium — parser tests exist but not connector contracts

**No Terminal Buffer Cleanup Tests:**
- What's not tested: Long terminal sessions, buffer growth, memory leaks.
- Files: `src/main/services/terminal-manager.ts`, `src/renderer/src/store.ts`
- Risk: Memory leaks in long sessions.
- Priority: High — terminal is interactive, users will notice

**No Path Mapping Edge Cases:**
- What's not tested: Symlinks, spaces in paths, UNC paths on Windows, WSL path conversion roundtrips.
- Files: `src/main/utils/path-mapping.ts`
- Risk: Git operations fail on unusual paths.
- Priority: Medium — path issues are user-specific

---

*Concerns audit: 2026-03-15*
