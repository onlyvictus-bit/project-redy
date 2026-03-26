import { randomUUID } from 'node:crypto';

import type { AgentMetricRecord, AgentMetricsSummary } from '@shared/types';
import type { PersistenceService } from './persistence';

export class AgentMetricsService {
  constructor(private readonly persistence: PersistenceService) {}

  /**
   * Record a completed agent metric. Generates a UUID for the id field.
   */
  record(metric: Omit<AgentMetricRecord, 'id'>): void {
    const full: AgentMetricRecord = {
      ...metric,
      id: randomUUID(),
    };
    this.persistence.insertMetric(full);
  }

  /**
   * Get an aggregated summary of agent metrics.
   * Optionally filter by projectId and/or a date-since ISO string.
   */
  getSummary(projectId?: string, since?: string): AgentMetricsSummary {
    const all = this.persistence.queryMetrics({ projectId, since });

    if (all.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        avgDurationMs: 0,
        p95DurationMs: 0,
        totalFindings: 0,
        byAgent: {},
        byWorkflow: {},
        recentRuns: [],
      };
    }

    const totalRuns = all.length;
    const successCount = all.filter((m) => m.success).length;
    const successRate = successCount / totalRuns;

    const durations = all.map((m) => m.durationMs);
    const avgDurationMs = Math.round(durations.reduce((a, b) => a + b, 0) / totalRuns);
    const p95DurationMs = computePercentile(durations, 0.95);

    const totalFindings = all.reduce((sum, m) => sum + m.findingsCount, 0);

    // Group by agent
    const byAgent: AgentMetricsSummary['byAgent'] = {};
    const agentGroups = groupBy(all, (m) => m.agentId);
    for (const [agentId, records] of Object.entries(agentGroups)) {
      const agentSuccess = records.filter((r) => r.success).length;
      const agentDurations = records.map((r) => r.durationMs);
      const agentFindings = records.reduce((s, r) => s + r.findingsCount, 0);
      byAgent[agentId] = {
        runs: records.length,
        successRate: agentSuccess / records.length,
        avgDurationMs: Math.round(agentDurations.reduce((a, b) => a + b, 0) / records.length),
        avgFindings: Math.round((agentFindings / records.length) * 100) / 100,
      };
    }

    // Group by workflow
    const byWorkflow: AgentMetricsSummary['byWorkflow'] = {};
    const workflowGroups = groupBy(all, (m) => m.workflowId);
    for (const [workflowId, records] of Object.entries(workflowGroups)) {
      const wfSuccess = records.filter((r) => r.success).length;
      const wfDurations = records.map((r) => r.durationMs);
      byWorkflow[workflowId] = {
        runs: records.length,
        successRate: wfSuccess / records.length,
        avgDurationMs: Math.round(wfDurations.reduce((a, b) => a + b, 0) / records.length),
      };
    }

    // Recent runs (last 20 — already sorted DESC from persistence)
    const recentRuns = all.slice(0, 20);

    return {
      totalRuns,
      successRate,
      avgDurationMs,
      p95DurationMs,
      totalFindings,
      byAgent,
      byWorkflow,
      recentRuns,
    };
  }

  /**
   * Get raw metric history, optionally filtered by agentId with a limit.
   */
  getHistory(agentId?: string, limit?: number): AgentMetricRecord[] {
    return this.persistence.queryMetrics({ agentId, limit: limit ?? 100 });
  }

  /**
   * Clear all metrics, optionally scoped to a project.
   */
  clear(projectId?: string): void {
    this.persistence.clearMetrics(projectId);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(percentile * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}
