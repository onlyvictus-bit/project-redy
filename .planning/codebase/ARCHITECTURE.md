# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Multi-agent orchestration framework with Electron IPC bridge.

**Key Characteristics:**
- Task-driven workflow engine coordinating multiple AI agents (Claude, Codex, Gemini, Ollama)
- Electron main/renderer separation with secure IPC communication
- Git-based worktree management for isolated code changes
- SQLite persistence for projects, tasks, agents, and artifacts
- Process runner abstraction supporting Windows and WSL execution

## Layers

**Presentation Layer (Renderer):**
- Purpose: React-based UI for workbench control and task monitoring
- Location: `src/renderer/src/`
- Contains: App.tsx, components, Zustand store, event listeners
- Depends on: Preload API (IPC bridge), Zustand state management
- Used by: Electron renderer process

**IPC Bridge Layer (Preload):**
- Purpose: Secure context bridge between renderer and main process
- Location: `src/preload/index.ts`
- Contains: WorkbenchApi interface exposed via contextBridge
- Depends on: ipcRenderer for invoking main handlers
- Used by: Renderer and main process communication

**Application Controller (Main):**
- Purpose: Central orchestrator managing all workbench operations
- Location: `src/main/app-controller.ts`
- Contains: Project management, agent lifecycle, workflow startup, terminal management, archive operations
- Depends on: All services (persistence, workflow engine, terminal manager, workspace manager, ollama manager, project archive)
- Used by: IPC handlers in main/index.ts

**Service Layer (Main):**
- Purpose: Encapsulate domain logic for specific concerns
- Location: `src/main/services/`
- Contains: WorkflowEngine, WorkspaceManager, TerminalManager, PersistenceService, ProcessRunner, OllamaManager, ProjectArchiveService
- Depends on: ProcessRunner for execution, types from shared
- Used by: AppController

**Connector Layer (Main):**
- Purpose: Abstract interface for different AI agent integrations
- Location: `src/main/connectors/`
- Contains: BaseConnector, ClaudeConnector, CodexConnector, GeminiConnector, OllamaConnector
- Depends on: ProcessRunner, parsing utilities, types
- Used by: WorkflowEngine for agent communication

**Shared Types Layer:**
- Purpose: Single source of truth for cross-process data structures
- Location: `src/shared/`
- Contains: types.ts (ProjectRef, AgentProfile, TaskRun, etc.), ipc.ts (channel definitions), workflows.ts (workflow definitions)
- Depends on: Nothing (lowest layer)
- Used by: All layers for type safety

## Data Flow

**Workflow Execution (Primary):**

1. User submits task brief + workflow selection in renderer
2. Renderer calls `startWorkflow()` via IPC → main process
3. AppController.startWorkflow() called
4. WorkflowEngine.start() creates git worktree via WorkspaceManager
5. WorkflowEngine orchestrates steps sequentially:
   - Resolves agents based on workflow ID
   - For each step: calls AgentConnector.runJob(prompt, cwd, runner)
   - AgentConnector invokes ProcessRunner.run() with appropriate shell (Windows/WSL)
   - ParseTriadPayload extracts structured findings from agent output
   - Artifacts collected and persisted
6. Final task state emitted back to renderer via IPC event

**Agent Probing (Discovery):**

1. User clicks "Probe agents" in renderer
2. AppController.probeAgents() called for each connector
3. Each connector runs version check and auth probe
4. Profiles updated in persistence and emitted to renderer

**Terminal Session (Interactive):**

1. User selects agent → starts terminal session
2. AppController.startTerminal() → TerminalManager.start()
3. TerminalManager uses AgentConnector.getInteractiveLaunchSpec() to get launch args
4. ProcessRunner.spawnInteractive() creates PTY with node-pty
5. Terminal data streams back to renderer via IPC events
6. User input sent to PTY via TerminalManager.write()

**State Management:**

- Renderer: Zustand store holds snapshot (WorkbenchSnapshot)
- Main: AppController holds snapshot and emits updates
- Sync: IPC events push state changes from main → renderer
- Persistence: PersistenceService saves projects, tasks, artifacts to SQLite

## Key Abstractions

**WorkbenchSnapshot:**
- Purpose: Immutable view of entire workbench state
- Examples: `src/shared/types.ts` (interface defined)
- Pattern: Returned by all major actions, emitted on IPC state changes

**AgentConnector:**
- Purpose: Pluggable interface for different AI agents
- Examples: `src/main/connectors/claude-connector.ts`, `codex-connector.ts`, `gemini-connector.ts`, `ollama-connector.ts`
- Pattern: Each implements BaseConnector, overrides getScriptedCommand() to build agent-specific invocation

**TaskRun:**
- Purpose: Complete execution record of a workflow
- Examples: Created in WorkflowEngine.start(), updated per step, persisted via PersistenceService
- Pattern: Immutable append-only structure (steps array, artifacts array, findings array)

**ProcessRunner:**
- Purpose: Abstraction over execution environment (Windows vs WSL)
- Examples: `src/main/services/process-runner.ts`
- Pattern: run() for non-interactive, spawnInteractive() for PTY sessions

## Entry Points

**Electron Main:**
- Location: `src/main/index.ts`
- Triggers: App ready event
- Responsibilities: Create BrowserWindow, instantiate AppController, wire IPC handlers

**React App:**
- Location: `src/renderer/src/main.tsx`
- Triggers: Document ready
- Responsibilities: Render App component, initialize Zustand store

**Workflow Invocation:**
- Location: `src/main/services/workflow-engine.ts:start()`
- Triggers: User clicks "Run workflow" with brief and workflowId
- Responsibilities: Create task workspace, orchestrate agent steps, collect artifacts

## Error Handling

**Strategy:** Try-catch at step boundaries with artifact error recording.

**Patterns:**
- `WorkflowEngine.runStep()`: Catches errors, sets task.stage = 'error', stores errorMessage
- `AgentConnector.runJob()`: Parses agent output, extracts findings regardless of exit code
- IPC handlers: Wrap in try-catch, return error via Zustand `error` field
- `ProcessRunner.run()`: Rejects on spawn error or timeout, resolves with exitCode (can be non-zero)

## Cross-Cutting Concerns

**Logging:** Console logs in main process (no structured logging library).

**Validation:**
- Path validation in WorkspaceManager (git worktree paths)
- JSON validation in ParseTriadPayload (structured agent output)

**Authentication:**
- Handled per-agent (Claude native login, Codex API key, Ollama HTTP endpoint)
- Probed via connector.probe() before use
- Status tracked in AgentProfile.status enum

**Process Execution:**
- Windows: spawn() with shell: false
- WSL: spawn() with wsl bash -c wrapper for commands
- Timeout: configurable per connector (base 60s, used by ProcessRunner)

---

*Architecture analysis: 2026-03-15*
