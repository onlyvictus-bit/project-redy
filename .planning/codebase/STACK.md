# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- TypeScript 5.9.2 - Main codebase for all modules (main, preload, renderer)
- JavaScript - Build scripts and configuration files

**Secondary:**
- Node.js API calls - Native HTTP via fetch() for Ollama integration

## Runtime

**Environment:**
- Electron 37.2.1 - Desktop application framework
- Node.js - Used via Electron's main process, handles system operations

**Package Manager:**
- npm - Used for dependency management
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Electron 37.2.1 - Desktop application framework with process isolation (main/preload/renderer)
- React 19.1.1 - UI framework for renderer process
- Zustand 5.0.8 - State management library for React components

**Testing:**
- Vitest 3.2.4 - Test runner with multi-project support (main and renderer)
- jsdom 28.1.0 - DOM implementation for renderer tests
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - Jest DOM matchers

**Build/Dev:**
- electron-vite 4.0.0 - Vite-based build tool optimized for Electron
- Vite 7.1.3 - Build tool and dev server
- @vitejs/plugin-react 5.0.2 - React plugin for Vite
- TypeScript 5.9.2 - Type checking and compilation

## Key Dependencies

**Critical:**
- better-sqlite3 11.8.1 - SQLite database driver for local persistence (`triad-workbench.db`)
- node-pty 1.0.0 - PTY (pseudo-terminal) support for interactive terminal sessions
- @xterm/xterm 5.5.0 - Terminal emulator UI component
- @xterm/addon-fit 0.10.0 - XTerm fit addon for responsive terminal sizing
- uuid 11.1.0 - UUID generation for task IDs and artifact IDs

**Infrastructure:**
- electron-vite externalizeDepsPlugin - Externalizes dependencies to native Node modules (not bundled)

## Configuration

**Environment:**
- `.env` support via `process.env` access - Ollama model selection via `TRIAD_OLLAMA_MODEL` (defaults to `qwen2.5-coder:7b`)
- `ELECTRON_RENDERER_URL` - Set by Vite in development for HMR
- No mandatory environment configuration - app works with defaults

**Build:**
- `electron.vite.config.ts` - Electron + Vite configuration with path aliases
- `tsconfig.json` - TypeScript compilation options (target: ES2022, strict mode enabled)
- `vitest.config.ts` - Test runner configuration with dual projects (main and renderer)
- `vite.preview.config.ts` - Standalone Vite preview server on port 5199

**Path Aliases:**
- `@shared/*` → `src/shared/` (types, IPC, workflows shared across all processes)
- `@renderer/*` → `src/renderer/src/` (React components)
- `@main/*` → `src/main/` (Electron main process code)

## Platform Requirements

**Development:**
- Node.js (recommended 18+)
- Windows/macOS/Linux with Electron support
- WSL2 support available (optional runner choice in project config)

**Production:**
- Electron 37.2.1 runtime
- OS: Windows, macOS, or Linux
- Sqlite3 native module compilation at install time
- Ollama 0.1+ (optional - app probes and can start Ollama if installed)

## Database

**Local SQLite:**
- File: `triad-workbench.db` (created in user data directory)
- Schema includes 4 tables: `projects`, `agent_profiles`, `task_runs`, `artifacts`
- WAL (Write-Ahead Logging) enabled for concurrent access
- JSON serialization for complex objects (profile_json, task_json, artifact_json)

## Process Management

**PTY Support:**
- node-pty for interactive terminal emulation
- Terminal sessions can run in WSL or native Windows shells
- Environment variables passed through from parent process

## Logging & Debugging

**Method:** `console.*` methods (stdout/stderr in main process, DevTools in renderer)
- No structured logging framework detected
- Errors thrown and caught by process-runner and connectors

---

*Stack analysis: 2026-03-15*
