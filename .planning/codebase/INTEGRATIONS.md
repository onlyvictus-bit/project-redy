# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**AI/LLM Agents:**
- Claude Code - CLI binary integration via subprocess
  - Implementation: `src/main/connectors/claude-connector.ts`
  - Launch: Interactive shell or scripted command with `-p` (prompt) flag
  - Output format: `--output-format stream-json`
  - Auth: Native login (CLI-managed)
  - Status detection: Binary path lookup via `ProcessRunner.probeBinary()`

- Codex CLI - CLI binary integration via subprocess
  - Implementation: `src/main/connectors/codex-connector.ts`
  - Launch: `codex exec --json [prompt]` for scripted mode
  - Auth: Native login (CLI-managed)
  - Status detection: Binary path lookup

- Gemini CLI - CLI binary integration via subprocess
  - Implementation: `src/main/connectors/gemini-connector.ts`
  - Launch: Interactive shell or `gemini -p [prompt] --output-format stream-json` for scripted
  - Auth: API-key or native login (conditional: passes env if auth mode is 'api-key')
  - Status detection: Binary path lookup

- Ollama (Local LLM) - HTTP API integration
  - Implementation: `src/main/services/ollama-manager.ts`, `src/main/connectors/ollama-connector.ts`
  - Endpoint: `http://localhost:11434` (default, configurable via hardcoded string)
  - API endpoints: `/api/tags` (list models), `/api/chat` (run inference)
  - Model selection: Env var `TRIAD_OLLAMA_MODEL` (default: `qwen2.5-coder:7b`)
  - Lifecycle: Auto-detect running daemon, can spawn managed process if binary present
  - Auth: None (local HTTP API)

## Data Storage

**Databases:**
- SQLite3 (better-sqlite3 driver)
  - File: `triad-workbench.db` in user data directory
  - Tables: `projects`, `agent_profiles`, `task_runs`, `artifacts`
  - WAL mode enabled for concurrent access
  - Schema auto-migration on startup
  - Stores project references, agent profiles, task execution history, and artifact bundles

**File Storage:**
- Local filesystem only
  - Project data stored relative to project root
  - Archives optional, stored at `project.archivePath` (default: `project_root/.triad-workbench/`)

**Caching:**
- None detected - all data is persistent SQLite

## Authentication & Identity

**Auth Providers:**
- Claude Code, Codex, Gemini: Native CLI logins (managed by respective tools)
- Ollama: No authentication (local HTTP API)

**Auth Implementation:**
- `src/main/connectors/base.ts`: Base class handles auth mode awareness
- `src/main/connectors/gemini-connector.ts`: Conditionally passes `process.env` if `authMode === 'api-key'`
- No credential storage in Triad itself - delegates to CLI tools

## Monitoring & Observability

**Error Tracking:**
- None detected - errors thrown and logged to console

**Logs:**
- Console output (stdout/stderr) captured in process-runner
- Structured JSON output from agents captured in `ArtifactBundle.stdout/stderr`
- Agent responses wrapped in `<triad-json>` tags for structured parsing
- Fallback to bullet-point extraction if JSON parse fails (`src/main/utils/parsing.ts`)

## CI/CD & Deployment

**Hosting:**
- Desktop application (Electron)
- No remote deployment - runs locally on user's machine

**Build:**
- electron-vite for development and production builds
- Output: `out/main/`, `out/preload/`, `out/renderer/` directories

**Launch:**
- Electron main entry: `src/main/index.ts`
- Renderer root: `src/renderer/src/App.tsx`
- Preload context bridge: `src/preload/index.ts` (IPC bridge to main process)

## Environment Configuration

**Required env vars:**
- None mandatory - all have defaults

**Optional env vars:**
- `TRIAD_OLLAMA_MODEL` - Ollama model selection (default: `qwen2.5-coder:7b`)
- `ELECTRON_RENDERER_URL` - Dev server URL (set by electron-vite in development)

**Secrets location:**
- No secrets storage in app - delegates to CLI tools (Claude Code, Codex, Gemini)
- Database contains task data but no credentials

## Process Management

**System Integration:**
- Terminal sessions via PTY (node-pty)
  - Runner types: `'wsl' | 'windows' | 'http-local'`
  - WSL2 bash shell support for subprocess execution
  - Native Windows PowerShell/cmd support
  - HTTP-local reserved for Ollama (read-only HTTP calls)

**Subprocess Execution:**
- `src/main/services/process-runner.ts`: Core subprocess spawner
- Supports environment variable inheritance
- Timeout and signal handling for long-running processes
- PTY allocation for interactive commands

## Ollama Integration Details

**Probe Mechanism:**
1. Check if `ollama` binary exists via `probeBinary('ollama', 'windows')`
2. Attempt HTTP GET to `/api/tags` endpoint
3. If successful: mark as `running`
4. If binary present but endpoint unreachable: mark as `installed` but not running
5. Status enum: `'missing' | 'installed' | 'ready' | 'running'`

**Startup Flow:**
1. If Ollama not running and binary exists: spawn detached process `ollama serve`
2. Retry up to 20 times (500ms intervals) to detect startup
3. On success: store as `owner: 'app-managed'`
4. On timeout: throw error

**Chat API:**
- Endpoint: `POST /api/chat`
- Payload: `{ model: string, stream: false, messages: [{ role: 'user', content: string }] }`
- Response format: `{ message: { content: string } }`
- Streams disabled (single response expected)

## IPC & Renderer-Main Communication

**IPC Channels:**
- Defined in `src/shared/ipc.ts`
- Context bridge in `src/preload/index.ts` exposes safe API to renderer

**Data Flow:**
- Renderer sends task requests to main via IPC
- Main orchestrates multi-agent workflows
- Artifacts (code, findings, summaries) streamed back to renderer
- Database queries run in main process, results serialized to renderer

## Git Integration

**Optional:**
- `src/main/services/workspace-manager.ts` - Can detect git repos and create worktrees
- Creates feature branches for task execution
- Archives changes to `.triad-workbench/` if enabled
- No remote git operations detected (pull/push/clone)

---

*Integration audit: 2026-03-15*
