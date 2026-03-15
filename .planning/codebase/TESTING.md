# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vitest.config.ts`
- Two separate test projects configured:
  1. **main** - Node.js environment for backend tests
  2. **renderer** - jsdom environment for React component tests

**Assertion Library:**
- @testing-library/jest-dom (v6.9.1) - DOM matchers and utilities
- @testing-library/react (v16.3.2) - React component testing utilities

**Run Commands:**
```bash
npm test                # Run all tests (both main and renderer projects)
npm run typecheck       # Type check without emitting files
```

## Test File Organization

**Location:**
- Co-located with source files (same directory as implementation)
- Test files must match the pattern defined in `vitest.config.ts`

**Naming:**
- `.test.ts` suffix for utility/service tests: `parsing.test.ts`, `path-mapping.test.ts`
- `.test.tsx` suffix for React component tests: `ArtifactViewer.test.tsx`, `DiffViewer.test.tsx`

**Structure:**
```
src/main/
├── utils/
│   ├── parsing.ts
│   ├── parsing.test.ts         # Utility test
│   └── path-mapping.test.ts     # Utility test
└── connectors/
    ├── base.ts
    └── (no tests yet)

src/renderer/src/
├── components/
│   ├── ArtifactViewer.tsx
│   ├── ArtifactViewer.test.tsx  # Component test
│   ├── DiffViewer.tsx
│   └── DiffViewer.test.tsx      # Component test
├── test-fixtures.ts             # Shared test data
├── test-setup.ts                # Global test setup
└── App.tsx
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest';

describe('extractTriadPayload', () => {
  it('parses triad JSON blocks', () => {
    // Arrange
    const payload = extractTriadPayload(
      `review summary
<triad-json>{"summary":"Found issues","findings":[...]}</triad-json>`,
      'codex'
    );

    // Assert
    expect(payload.summary).toBe('Found issues');
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]).toMatchObject({
      sourceAgent: 'codex',
      severity: 'high',
      title: 'Race condition'
    });
  });

  it('falls back to bullet extraction when JSON is missing', () => {
    // Arrange & Act
    const payload = extractTriadPayload('- high severity issue\n- low style issue', 'gemini');

    // Assert
    expect(payload.findings).toHaveLength(2);
    expect(payload.findings[0].sourceAgent).toBe('gemini');
  });
});
```

**Patterns:**
- AAA (Arrange-Act-Assert) pattern used consistently
- Single assertion per test preferred, multiple related assertions acceptable
- Test names describe behavior: "parses triad JSON blocks", "falls back to bullet extraction"
- No setup/teardown hooks observed in individual tests (setup in test-setup.ts globally)

## Mocking

**Framework:** Vitest's built-in `vi` (mock/spy API)

**Patterns for utility tests:**
```typescript
// Utilities tested directly with real implementations
// No mocking needed for pure functions
const payload = extractTriadPayload(input, 'codex');
expect(payload.summary).toBe('Found issues');
```

**Patterns for component tests:**
```typescript
// Global setup in test-setup.ts mocks window.workbench
beforeEach(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'workbench', {
      configurable: true,
      value: workbenchStub
    });
  }
});
```

**Example from `src/renderer/src/components/DiffViewer.test.tsx`:**
```typescript
it('renders diff stats and copies the patch', () => {
  // Mock clipboard API
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  });

  const patch = 'diff --git a/file.ts b/file.ts\n@@ -1 +1 @@\n-old value\n+new value';
  render(<DiffViewer patch={patch} />);

  fireEvent.click(screen.getByRole('button', { name: 'Copy diff' }));
  expect(writeText).toHaveBeenCalledWith(patch);
});
```

**What to Mock:**
- Browser APIs: `window.workbench` (IPC bridge), `navigator.clipboard`
- External HTTP calls (if present)
- File system operations in integration tests

**What NOT to Mock:**
- Pure utility functions like `parseJsonLines()`, `windowsToWslPath()`
- Component internals - test behavior, not implementation
- Third-party testing utilities (@testing-library/react)

## Fixtures and Factories

**Test Data:**
Location: `src/renderer/src/test-fixtures.ts`

Factory pattern for creating realistic test data with overrides:
```typescript
export function makeArtifact(overrides: Partial<ArtifactBundle> = {}): ArtifactBundle {
  return {
    id: 'artifact-1',
    taskId: 'task-1',
    stepId: 'step-1',
    agentId: 'codex',
    role: 'reviewer',
    prompt: 'Review the latest diff.',
    stdout: 'stdout log',
    stderr: '',
    exitCode: 0,
    structuredEvents: [],
    summary: 'Artifact summary',
    finalMessage: 'Artifact final message',
    patch: 'diff --git a/src/app.ts b/src/app.ts\n@@ -1 +1 @@\n-old line\n+new line',
    findings: [],
    commandRuns: [],
    createdAt: '2026-03-15T08:05:00.000Z',
    ...overrides
  };
}

export function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'task-1',
    projectId: 'project-1',
    workflowId: 'code-review-fix-verify',
    // ... defaults
    ...overrides
  };
}

export function makeStep(overrides: Partial<TaskStepRecord> = {}): TaskStepRecord {
  // ... defaults
  return { ...defaults, ...overrides };
}
```

**Usage in tests:**
```typescript
const artifact = makeArtifact({
  findings: [
    {
      severity: 'high',
      title: 'Race condition',
      body: 'Missing lock',
      sourceAgent: 'codex',
      file: 'src/app.ts',
      line: 12
    }
  ]
});
render(<ArtifactViewer artifact={artifact} />);
```

**Location:**
- `src/renderer/src/test-fixtures.ts` - All shared test data factories

## Setup & Teardown

**Global Setup:**
Location: `src/renderer/src/test-setup.ts`

```typescript
beforeEach(() => {
  // Mock window.workbench IPC API
  Object.defineProperty(window, 'workbench', {
    configurable: true,
    value: workbenchStub
  });

  // Mock clipboard API
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => undefined) }
  });

  // Reset store state
  useWorkbenchStore.setState({
    snapshot: undefined,
    terminalBuffers: {},
    error: undefined,
    isBusy: false,
    selectedTaskId: undefined,
    selectedArtifactId: undefined
  });
});

afterEach(() => {
  cleanup();        // @testing-library/react cleanup
  vi.clearAllMocks();
});
```

**Configured in vitest.config.ts:**
```typescript
{
  test: {
    name: 'renderer',
    globals: true,
    environment: 'jsdom',
    include: ['src/renderer/src/**/*.test.ts', 'src/renderer/src/**/*.test.tsx'],
    setupFiles: ['src/renderer/src/test-setup.ts']
  }
}
```

## Coverage

**Requirements:** None enforced (no coverage config in vitest.config.ts)

**Current test files:**
- 6 test files total (as of analysis date)
- Main process: 2 test files (`parsing.test.ts`, `path-mapping.test.ts`)
- Renderer: 4 test files (`ArtifactViewer.test.tsx`, `DiffViewer.test.tsx`, `FindingsPanel.test.tsx`, `TaskDetailPanel.test.tsx`)

**View Coverage:**
No coverage command configured. To run with coverage:
```bash
npm test -- --coverage    # If coverage library added
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Direct function calls with various inputs
- Examples: `parsing.test.ts` tests pure string parsing functions
- No external dependencies mocked for pure functions

**Component Tests (React):**
- Scope: Individual React components in isolation
- Approach: Render component, interact via Testing Library queries, assert on DOM
- Mocking: Global browser APIs via setup file, component props via factories
- Fixtures: makeArtifact, makeTask, makeStep provide realistic component state

**Integration Tests:**
- Not yet implemented (noted in test-setup.ts comments about handoff support)
- Would test component + store interactions

**E2E Tests:**
- Not implemented
- Would require Electron app running with real file system/subprocess access

## Common Patterns

**Async Testing:**
Not used in current test suite (all tests are synchronous).

If needed, Vitest supports:
```typescript
it('handles async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

**Rendering Components:**
```typescript
import { render, screen } from '@testing-library/react';

describe('ArtifactViewer', () => {
  it('renders overview tab by default', () => {
    const artifact = makeArtifact();
    render(<ArtifactViewer artifact={artifact} />);

    expect(screen.getByText('Artifact summary')).toBeInTheDocument();
  });
});
```

**User Interactions:**
```typescript
import { fireEvent, screen } from '@testing-library/react';

it('switches tabs on button click', () => {
  render(<ArtifactViewer artifact={artifact} />);

  fireEvent.click(screen.getByRole('button', { name: 'Logs' }));
  expect(screen.getByText('stdout')).toBeInTheDocument();
});
```

**DOM Queries:**
- `screen.getByText()` - Find by text content
- `screen.getByRole()` - Find by semantic role (buttons, headers, etc.)
- `screen.getByTestId()` - Not used; prefer semantic queries

**Assertions:**
- `.toBeInTheDocument()` - DOM presence
- `.toHaveLength()` - Array length
- `.toMatchObject()` - Partial object matching
- `.toHaveBeenCalledWith()` - Mock verification

## Vitest Configuration

**File:** `vitest.config.ts`

Two separate test environments:
```typescript
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'main',
          globals: true,
          environment: 'node',
          include: ['src/main/**/*.test.ts']
        }
      },
      {
        test: {
          name: 'renderer',
          globals: true,
          environment: 'jsdom',
          include: ['src/renderer/src/**/*.test.ts', 'src/renderer/src/**/*.test.tsx'],
          setupFiles: ['src/renderer/src/test-setup.ts']
        }
      }
    ]
  }
});
```

**Key settings:**
- `globals: true` - Enables `describe`, `it`, `expect` without imports
- `environment: 'node'` for backend tests (no DOM)
- `environment: 'jsdom'` for React tests (simulated browser)
- `setupFiles` only for renderer tests (React-specific setup)

---

*Testing analysis: 2026-03-15*
