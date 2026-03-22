/**
 * PersistenceService tests.
 *
 * better-sqlite3 is a native Node.js addon compiled for the Electron ABI
 * (NODE_MODULE_VERSION 136) and cannot be loaded by the Vitest Node.js
 * runner (NODE_MODULE_VERSION 137).  We mock the module with a lightweight
 * in-memory implementation so we can test the PersistenceService logic —
 * in particular its corrupt-row error handling — without native binaries.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentProfile, TaskRun } from '@shared/types';

// ---------------------------------------------------------------------------
// In-memory better-sqlite3 mock
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

class InMemoryDb {
  private readonly tables = new Map<string, Row[]>();

  pragma(): void { /* no-op */ }

  exec(sql: string): void {
    for (const match of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
      if (!this.tables.has(match[1])) this.tables.set(match[1], []);
    }
  }

  // Expose for tests that need to seed corrupt rows directly.
  _insert(table: string, row: Row): void {
    const rows = this.tables.get(table) ?? [];
    rows.push(row);
    this.tables.set(table, rows);
  }

  prepare(sql: string) {
    const tables = this.tables;

    // Determine which table the statement targets.
    const tableMatch = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    const table = tableMatch?.[1] ?? '';
    const isConflictUpsert = /ON CONFLICT/i.test(sql);
    const isPragmaTableInfo = /PRAGMA table_info/i.test(sql);

    // Parse INSERT column list → named param mapping so rows are stored with
    // SQL column names (snake_case) even though params use camelCase keys.
    // e.g. INSERT INTO t (task_json) VALUES (@taskJson)  →  { task_json: params.taskJson }
    const insertMatch = sql.match(/INSERT INTO \w+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    const colToParam = new Map<string, string>();
    if (insertMatch) {
      const cols = insertMatch[1].split(',').map((s) => s.trim());
      const vals = insertMatch[2].split(',').map((s) => s.trim());
      for (let i = 0; i < cols.length; i++) {
        const val = vals[i];
        if (val?.startsWith('@')) colToParam.set(cols[i], val.slice(1));
      }
    }

    return {
      /** INSERT / UPSERT */
      run: (params: Row): void => {
        const rows = tables.get(table) ?? [];
        // Build row with SQL column names.
        const row: Row = colToParam.size > 0
          ? Object.fromEntries([...colToParam].map(([col, p]) => [col, params[p]]))
          : { ...params };
        const id = row['id'] as string | undefined;
        if (isConflictUpsert && id !== undefined) {
          const idx = rows.findIndex((r) => r['id'] === id);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...row };
          } else {
            rows.push(row);
          }
        } else {
          rows.push(row);
        }
        tables.set(table, rows);
      },

      /** SELECT … LIMIT 1 */
      get: (): Row | undefined => {
        return (tables.get(table) ?? [])[0];
      },

      /** SELECT … (optionally filtered by one positional param) */
      all: (param?: unknown): Row[] => {
        if (isPragmaTableInfo) {
          // Return fake column info so ensureColumn skips ALTER TABLE calls.
          return [
            { name: 'id' }, { name: 'archive_path' }, { name: 'archive_enabled' },
            { name: 'resolved_runner' }, { name: 'worktree_status' }
          ];
        }
        const rows = tables.get(table) ?? [];
        if (param === undefined) return rows;
        // Filter: WHERE project_id = ? OR task_id = ?
        return rows.filter((r) => r['project_id'] === param || r['task_id'] === param);
      }
    };
  }
}

vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => new InMemoryDb())
}));

// Import AFTER the mock is in place.
import { PersistenceService } from './persistence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(id: AgentProfile['id'] = 'claude'): AgentProfile {
  return {
    id,
    displayName: 'Test Agent',
    binaryOrEndpoint: id,
    authMode: 'native-login',
    role: 'coder',
    runner: 'windows',
    status: 'ready',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    }
  };
}

function makeTask(id = 'task-1', projectId = 'project-1'): TaskRun {
  return {
    id,
    projectId,
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc123',
    worktreePath: `/tmp/worktrees/${id}`,
    stage: 'promote',
    brief: 'Test task',
    assignedAgents: ['claude', 'codex'],
    approvalState: 'pending',
    branchName: `triad/${id}`,
    findings: [],
    artifacts: [],
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Setup — fresh PersistenceService (and a fresh in-memory DB) per test.
// ---------------------------------------------------------------------------

let db: PersistenceService;
let rawDb: InMemoryDb;

beforeEach(async () => {
  const MockDb = vi.mocked((await import('better-sqlite3')).default);
  rawDb = new InMemoryDb();
  MockDb.mockReturnValueOnce(rawDb as never);
  db = new PersistenceService('/fake/userData');
});

// ---------------------------------------------------------------------------
// Agent profiles
// ---------------------------------------------------------------------------

describe('PersistenceService agent profiles', () => {
  it('round-trips an agent profile', () => {
    const profile = makeProfile('codex');
    db.saveAgentProfile(profile);
    const loaded = db.loadAgentProfiles();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ id: 'codex', status: 'ready' });
  });

  it('overwrites on duplicate id (upsert)', () => {
    const profile = makeProfile('claude');
    db.saveAgentProfile(profile);
    db.saveAgentProfile({ ...profile, status: 'missing' });
    const loaded = db.loadAgentProfiles();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].status).toBe('missing');
  });

  it('skips corrupt rows without throwing', () => {
    db.saveAgentProfile(makeProfile('gemini'));
    // Seed a corrupt row directly into the in-memory table.
    rawDb._insert('agent_profiles', { id: 'bad', profile_json: '{INVALID JSON' });
    const loaded = db.loadAgentProfiles();
    // Only the valid row survives.
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('gemini');
  });
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

describe('PersistenceService tasks', () => {
  it('round-trips a task', () => {
    db.saveTask(makeTask());
    const loaded = db.loadTasks('project-1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('task-1');
  });

  it('updates an existing task on duplicate id', () => {
    const task = makeTask();
    db.saveTask(task);
    db.saveTask({ ...task, stage: 'done' });
    const loaded = db.loadTasks('project-1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].stage).toBe('done');
  });

  it('skips corrupt task rows without throwing', () => {
    db.saveTask(makeTask('task-good', 'proj-1'));
    rawDb._insert('task_runs', {
      id: 'task-bad',
      project_id: 'proj-1',
      stage: 'code',
      workflow_id: 'code-review-fix-verify',
      task_json: '{BROKEN'
    });
    const loaded = db.loadTasks('proj-1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('task-good');
  });

  it('returns tasks only for the requested project', () => {
    db.saveTask(makeTask('t1', 'proj-a'));
    db.saveTask(makeTask('t2', 'proj-b'));
    expect(db.loadTasks('proj-a')).toHaveLength(1);
    expect(db.loadTasks('proj-b')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// appendRunEvent — non-fatal on failure
// ---------------------------------------------------------------------------

describe('PersistenceService.appendRunEvent', () => {
  it('persists and retrieves run events', () => {
    db.appendRunEvent('task-1', 'step-started', { stage: 'code' });
    db.appendRunEvent('task-1', 'step-completed', { exitCode: 0 });
    const events = db.loadRunEvents('task-1');
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('step-started');
    expect(events[1].payload).toMatchObject({ exitCode: 0 });
  });

  it('does not throw when JSON.stringify fails (circular reference)', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => db.appendRunEvent('task-x', 'test-event', circular)).not.toThrow();
  });
});
