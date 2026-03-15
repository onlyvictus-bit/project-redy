# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- PascalCase for React components: `ArtifactViewer.tsx`, `DiffViewer.tsx`, `FindingsPanel.tsx`
- camelCase for utilities and services: `parsing.ts`, `path-mapping.ts`, `ollama-manager.ts`
- camelCase for connectors with `-connector` suffix: `claude-connector.ts`, `codex-connector.ts`
- snake_case for configuration files: `vitest.config.ts`, `electron.vite.config.ts`

**Functions:**
- camelCase for all function declarations: `parseJsonLines()`, `extractTriadPayload()`, `windowsToWslPath()`
- Descriptive action-based names: `sanitizeBranchName()`, `normalizeLineEndings()`, `extractFindingsFromPlainText()`
- Hook functions prefixed with `use`: `useWorkbenchStore()` (Zustand state management)

**Variables:**
- camelCase for all variable names: `sourceAgent`, `baseCommit`, `worktreePath`
- Constants in UPPER_CASE when appropriate: `TRIAD_JSON_REGEX`, `FENCED_JSON_REGEX`, `DIFF_REGEX` (module-level)
- Descriptive names for flags: `archiveEnabled`, `isGitRepo`, `isBusy`

**Types:**
- PascalCase for interfaces and types: `AgentConnector`, `WorkbenchSnapshot`, `ArtifactBundle`, `TaskRun`
- Suffix with `Props` for React component props: `ArtifactViewerProps`
- Suffix with `Record` for database/data records: `TaskStepRecord`, `TaskStepRecord`
- Suffix with `Tab` for discriminated union types: `ArtifactTab = 'overview' | 'prompt' | 'patch' | 'logs' | 'findings' | 'commands'`

## Code Style

**Formatting:**
- No explicit formatter configured (Prettier not used)
- Consistent spacing: 2-space indentation throughout
- Line length: No strict limit observed, varies up to ~120 characters
- Template literals used for complex strings: `` `${versionResult.stdout}\n${versionResult.stderr}` ``

**Linting:**
- No ESLint configuration found
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- Module resolution: `"moduleResolution": "Bundler"` for modern bundler support

**Semicolons:**
- Consistent use of semicolons at end of statements
- Omitted in JSX return statements when part of expression

## Import Organization

**Order (observed pattern):**
1. Node.js built-in modules (import from 'node:*'): `import path from 'node:path'`
2. Third-party npm packages: `import { v4 as uuid } from 'uuid'`, `import Database from 'better-sqlite3'`
3. Type imports (TypeScript only): `import type { AgentId, RunnerKind } from '@shared/types'`
4. Internal project imports: `import { createConnector } from './connectors'`
5. Relative imports: `import { extractPatch } from '../utils/parsing'`

**Path Aliases:**
- `@shared/*` → `src/shared/*` - Shared types and configurations
- `@renderer/*` → `src/renderer/src/*` - Renderer (React UI) components and stores
- `@main/*` → `src/main/*` - Main process (Electron backend) code

**Example pattern from `src/main/app-controller.ts`:**
```typescript
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { app, dialog, shell } from 'electron';
import { DEFAULT_AGENTS, type AgentId, type AgentRole } from '@shared/types';
import { createConnector } from './connectors';
import type { AgentConnector } from './connectors/base';
import { OllamaManager } from './services/ollama-manager';
```

## Error Handling

**Patterns:**
- Errors thrown as `new Error('descriptive message')` with no error codes or enums
- Messages are user-facing and descriptive: `'Select a project before choosing a runner.'`
- Silent catch blocks used for expected failures: `try { JSON.parse() } catch { return [] }`
- Promise rejections propagate up to caller for handling

**Common error scenarios in codebase:**
- Validation errors when preconditions unmet: `if (!this.snapshot.project) { throw new Error(...) }`
- Missing binary/tool errors: `if (!detectedPath) { return { status: 'missing' } }`
- Timeout errors with explicit message: `throw new Error('Timed out while starting Ollama.')`

**Error handling in `src/main/utils/parsing.ts`:**
```typescript
try {
  const parsed = JSON.parse(matched[1]) as Partial<ParsedTriadPayload>;
  return { summary: parsed.summary ?? '', findings: ... };
} catch {
  // Fallback to plain text extraction
  return { summary: normalized.trim().slice(0, 2000), findings: extractFindingsFromPlainText(...) };
}
```

## Logging

**Framework:** console (no external logging library detected)

**Patterns:**
- No explicit logging calls found in source code
- All console output handled via stdout/stderr from subprocesses
- Artifacts and events persisted to SQLite instead of logs
- Terminal sessions archived to disk for audit trail

## Comments

**When to Comment:**
- Regex patterns documented inline: `const TRIAD_JSON_REGEX = /<triad-json>([\s\S]*?)<\/triad-json>/i;`
- JSDoc not used for functions
- Parameter documentation via TypeScript type annotations only

**Example - Self-documenting code (preferred):**
```typescript
// Extract findings from agent output
export function extractFindingsFromPlainText(input: string, sourceAgent: AgentId): Finding[] {
  // Implementation...
}
```

## Function Design

**Size:**
- Generally 10-50 lines per function
- Larger functions (100+ lines) found in classes like `AppController` with clear method boundaries
- Single responsibility principle followed: `parseJsonLines()` does one thing

**Parameters:**
- Destructured object parameters for multiple related arguments: `(overrides: Partial<TaskRun> = {})`
- Required parameters before optional: `probe(deep = false)`
- Type annotations required for all parameters (TypeScript strict mode)

**Return Values:**
- Explicit return types on all function declarations
- Void for side-effect-only functions: `setRole(role: AgentRole): void`
- Union types for multiple return possibilities: `string | undefined`
- Promises for async operations: `async runJob(...): Promise<ArtifactBundle>`

**Example from `src/main/utils/parsing.ts`:**
```typescript
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
    // ... structured parsing
  } catch {
    // ... fallback
  }
}
```

## Module Design

**Exports:**
- Named exports preferred: `export function parseJsonLines(...) {}`, `export class AppController {}`
- Single default export for App component: `export default function App() {}`
- Explicit export of types: `export interface ConnectorJobInput {}`

**Barrel Files:**
- Used in connector modules: `src/main/connectors/index.ts` exports factory function
- Selectively used to group related exports

**Class Design:**
- Services as classes with clear lifecycle: `OllamaManager`, `PersistenceService`, `ProcessRunner`
- Private fields for internal state: `private readonly processRunner = new ProcessRunner()`
- Public readonly for configuration: `public readonly profile: AgentProfile`
- Abstract base classes for extension: `BaseConnector` for connector implementations

**Example - Connector base class pattern in `src/main/connectors/base.ts`:**
```typescript
export abstract class BaseConnector implements AgentConnector {
  protected lastProcessId: number | undefined;

  constructor(
    public readonly profile: AgentProfile,
    protected readonly processRunner: ProcessRunner
  ) {}

  setRole(role: AgentRole): void {
    this.profile.role = role;
  }

  protected abstract getScriptedCommand(input: ConnectorJobInput): {...};
}
```

## State Management (React)

**Pattern:** Zustand for global state (`src/renderer/src/store.ts`)

**Conventions:**
- Store interface includes all state + action methods: `WorkbenchState`
- Async actions wrapped in `runAction()` helper for consistent loading/error handling
- Actions named as verbs: `bootstrap()`, `applySnapshot()`, `selectProject()`
- State updates via `set()` within actions
- Subscription-based updates from main process: `window.workbench.onState(callback)`

**Example from `src/renderer/src/App.tsx`:**
```typescript
const snapshot = useWorkbenchStore((state) => state.snapshot);
const error = useWorkbenchStore((state) => state.error);
const isBusy = useWorkbenchStore((state) => state.isBusy);
const bootstrap = useWorkbenchStore((state) => state.bootstrap);
```

## Type Safety

**Strict TypeScript:**
- All files are `.ts` or `.tsx` (no `.js`)
- No `any` types observed
- Type imports use `type` keyword: `import type { AgentId } from '@shared/types'`
- Discriminated unions for complex types: `type ArtifactTab = 'overview' | 'patch' | ...`

---

*Convention analysis: 2026-03-15*
