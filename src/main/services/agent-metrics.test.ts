/**
 * AgentMetricsService tests.
 *
 * Uses the same in-memory better-sqlite3 mock as persistence.test.ts
 * since native bindings cannot load in the Vitest runner.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentMetricRecord } from '@shared/types';

// ---------------------------------------------------------------------------
// In-memory better-sqlite3 mock (extended for agent_metrics)
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

  _insert(table: string, row: Row): void {
    const rows = this.tables.get(table) ?? [];
    rows.push(row);
    this.tables.set(table, rows);
  }

  prepare(sql: string) {
    const tables = this.tables;
    const tableMatch = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    const table = tableMatch?.[1] ?? '';
    const isConflictUpsert = /ON CONFLICT/i.test(sql);
    const isPragmaTableInfo = /PRAGMA table_info/i.test(sql);
    const isDelete = /^DELETE/i.test(sql.trim());
    const isSelectAll = /^SELECT \*/i.test(sql.trim());

    // Parse INSERT columns
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

    // Parse WHERE conditions for parameterized queries
    const whereConditions = [...sql.matchAll(/(\w+)\s*=\s*@(\w+)/g)];
    const hasPositionalWhere = /WHERE\s+\w+\s*=\s*\?/i.test(sql);

    // Parse LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    const sqlLimit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

    return {
      run: (params?: Row | unknown): void => {
        if (isDelete) {
          const rows = tables.get(table) ?? [];
          if (hasPositionalWhere && params !== undefined) {
            tables.set(table, rows.filter((r) => r['project_id'] !== params));
          } else if (whereConditions.length > 0 && typeof params === 'object' && params !== null) {
            const p = params as Row;
            tables.set(table, rows.filter((r) => {
              return !whereConditions.every(([, col, param]) => r[col] === p[param]);
            }));
          } else {
            tables.set(table, []);
          }
          return;
        }

        const rows = tables.get(table) ?? [];
        const row: Row = colToParam.size > 0
          ? Object.fromEntries([...colToParam].map(([col, p]) => [col, (params as Row)[p]]))
          : { ...(params as Row) };
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

      get: (): Row | undefined => {
        return (tables.get(table) ?? [])[0];
      },

      all: (params?: unknown): Row[] => {
        if (isPragmaTableInfo) {
          return [
            { name: 'id' }, { name: 'archive_path' }, { name: 'archive_enabled' },
            { name: 'resolved_runner' }, { name: 'worktree_status' }
          ];
        }

        let rows = tables.get(table) ?? [];

        // Apply WHERE filtering for named params
        if (isSelectAll && whereConditions.length > 0 && typeof params === 'object' && params !== null) {
          const p = params as Row;
          rows = rows.filter((r) => {
            return whereConditions.every(([, col, param]) => {
              if (p[param] === undefined || p[param] === null) return true;
              // Handle >= for dates
              if (sql.includes(`${col} >=`)) {
                return String(r[col]) >= String(p[param]);
              }
              return r[col] === p[param];
            });
          });
        } else if (params !== undefined && typeof params !== 'object') {
          rows = rows.filter((r) => r['project_id'] === params || r['task_id'] === params);
        }

        // Apply ORDER BY started_at DESC (reverse chronological)
        if (sql.includes('ORDER BY started_at DESC') || sql.includes('ORDER BY')) {
          rows = [...rows].reverse();
        }

        // Apply LIMIT
        if (sqlLimit !== undefined) {
          rows = rows.slice(0, sqlLimit);
        }

        return rows;
      }
    };
  }
}

vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => new InMemoryDb())
}));

// Import AFTER mock
import { PersistenceService } from './persistence';
import { AgentMetricsService } from './agent-metrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMetric(overrides?: Partial<Omit<AgentMetricRecord, 'id'>>): Omit<AgentMetricRecord, 'id'> {
  return {
    taskId: 'task-1',
    agentId: 'claude',
    workflowId: 'code-review-fix-verify',
    stage: 'code',
    role: 'coder',
    startedAt: '2026-03-26T10:00:00Z',
    completedAt: '2026-03-26T10:00:45Z',
    durationMs: 45_000,
    exitCode: 0,
    findingsCount: 3,
    patchLinesAdded: 50,
    patchLinesRemoved: 10,
    promptTokensEstimate: 2500,
    success: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let persistence: PersistenceService;
let metrics: AgentMetricsService;

beforeEach(async () => {
  const MockDb = vi.mocked((await import('better-sqlite3')).default);
  const rawDb = new InMemoryDb();
  MockDb.mockReturnValueOnce(rawDb as never);
  persistence = new PersistenceService('/fake/userData');
  metrics = new AgentMetricsService(persistence);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentMetricsService', () => {
  describe('record', () => {
    it('records a metric and assigns an id', () => {
      metrics.record(makeMetric());
      const history = metrics.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBeDefined();
      expect(history[0].id.length).toBeGreaterThan(0);
      expect(history[0].agentId).toBe('claude');
    });

    it('records multiple metrics', () => {
      metrics.record(makeMetric({ agentId: 'claude' }));
      metrics.record(makeMetric({ agentId: 'codex' }));
      metrics.record(makeMetric({ agentId: 'gemini' }));
      expect(metrics.getHistory()).toHaveLength(3);
    });
  });

  describe('getHistory', () => {
    it('returns empty array when no metrics exist', () => {
      expect(metrics.getHistory()).toEqual([]);
    });

    it('filters by agentId', () => {
      metrics.record(makeMetric({ agentId: 'claude' }));
      metrics.record(makeMetric({ agentId: 'codex' }));
      const claudeHistory = metrics.getHistory('claude');
      expect(claudeHistory.length).toBeGreaterThanOrEqual(1);
      expect(claudeHistory.every((m) => m.agentId === 'claude')).toBe(true);
    });

    it('respects limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        metrics.record(makeMetric());
      }
      const limited = metrics.getHistory(undefined, 5);
      expect(limited).toHaveLength(5);
    });
  });

  describe('getSummary', () => {
    it('returns zeroed summary when no metrics exist', () => {
      const summary = metrics.getSummary();
      expect(summary.totalRuns).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.avgDurationMs).toBe(0);
      expect(summary.p95DurationMs).toBe(0);
      expect(summary.totalFindings).toBe(0);
      expect(Object.keys(summary.byAgent)).toHaveLength(0);
      expect(Object.keys(summary.byWorkflow)).toHaveLength(0);
      expect(summary.recentRuns).toHaveLength(0);
    });

    it('computes correct totals for single metric', () => {
      metrics.record(makeMetric({
        durationMs: 45_000,
        findingsCount: 3,
        success: true,
      }));
      const summary = metrics.getSummary();
      expect(summary.totalRuns).toBe(1);
      expect(summary.successRate).toBe(1);
      expect(summary.avgDurationMs).toBe(45_000);
      expect(summary.totalFindings).toBe(3);
    });

    it('computes correct success rate with mixed results', () => {
      metrics.record(makeMetric({ success: true }));
      metrics.record(makeMetric({ success: true }));
      metrics.record(makeMetric({ success: false }));
      const summary = metrics.getSummary();
      expect(summary.totalRuns).toBe(3);
      expect(summary.successRate).toBeCloseTo(2 / 3);
    });

    it('groups metrics by agent', () => {
      metrics.record(makeMetric({ agentId: 'claude', durationMs: 40_000, findingsCount: 2 }));
      metrics.record(makeMetric({ agentId: 'claude', durationMs: 60_000, findingsCount: 4 }));
      metrics.record(makeMetric({ agentId: 'codex', durationMs: 30_000, findingsCount: 1 }));

      const summary = metrics.getSummary();
      expect(summary.byAgent['claude']).toBeDefined();
      expect(summary.byAgent['claude'].runs).toBe(2);
      expect(summary.byAgent['claude'].avgDurationMs).toBe(50_000);
      expect(summary.byAgent['claude'].avgFindings).toBe(3);
      expect(summary.byAgent['codex']).toBeDefined();
      expect(summary.byAgent['codex'].runs).toBe(1);
    });

    it('groups metrics by workflow', () => {
      metrics.record(makeMetric({ workflowId: 'code-review-fix-verify' }));
      metrics.record(makeMetric({ workflowId: 'code-review-fix-verify' }));
      metrics.record(makeMetric({ workflowId: 'architecture-compare' }));

      const summary = metrics.getSummary();
      expect(summary.byWorkflow['code-review-fix-verify']).toBeDefined();
      expect(summary.byWorkflow['code-review-fix-verify'].runs).toBe(2);
      expect(summary.byWorkflow['architecture-compare']).toBeDefined();
      expect(summary.byWorkflow['architecture-compare'].runs).toBe(1);
    });

    it('limits recentRuns to 20', () => {
      for (let i = 0; i < 25; i++) {
        metrics.record(makeMetric());
      }
      const summary = metrics.getSummary();
      expect(summary.recentRuns.length).toBeLessThanOrEqual(20);
    });

    it('computes p95 duration correctly', () => {
      // Record 20 metrics with durations 1000..20000
      for (let i = 1; i <= 20; i++) {
        metrics.record(makeMetric({ durationMs: i * 1000 }));
      }
      const summary = metrics.getSummary();
      // p95 of [1000..20000] = value at index ceil(0.95 * 20) - 1 = 18 => 19000
      expect(summary.p95DurationMs).toBe(19_000);
    });
  });

  describe('clear', () => {
    it('clears all metrics', () => {
      metrics.record(makeMetric());
      metrics.record(makeMetric());
      expect(metrics.getHistory()).toHaveLength(2);

      metrics.clear();
      expect(metrics.getHistory()).toHaveLength(0);
    });

    it('clears metrics for a specific project', () => {
      metrics.record(makeMetric({ projectId: 'proj-a' }));
      metrics.record(makeMetric({ projectId: 'proj-b' }));

      metrics.clear('proj-a');
      const history = metrics.getHistory();
      // Only proj-b should remain
      const remaining = history.filter((m) => m.projectId === 'proj-a');
      expect(remaining).toHaveLength(0);
    });
  });
});
