import { useCallback, useEffect, useState } from 'react';

import type { AgentMetricRecord, AgentMetricsSummary } from '@shared/types';

const AGENT_IDS = ['claude', 'codex', 'gemini', 'ollama'] as const;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export interface MetricsPanelProps {
  /** Fetch metrics summary via IPC. Injected so the component stays store-agnostic. */
  loadMetrics: () => Promise<AgentMetricsSummary>;
}

export function MetricsPanel({ loadMetrics }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<AgentMetricsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await loadMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadMetrics]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="card metrics-panel">
      <div className="metrics-header">
        <h2>Agent Performance</h2>
        <button className="metrics-refresh-btn" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error ? <p className="metrics-error">{error}</p> : null}

      {!metrics && !loading && !error ? (
        <p className="empty-state">No metrics data available.</p>
      ) : null}

      {metrics ? (
        <>
          <div className="metrics-agents">
            {AGENT_IDS.map((agentId) => {
              const agentData = metrics.byAgent[agentId];
              return (
                <div key={agentId} className="metrics-agent-card" data-agent={agentId}>
                  <h3>{agentId}</h3>
                  {agentData ? (
                    <>
                      <span className="metrics-success-rate">{formatPercent(agentData.successRate)} ok</span>
                      <span className="metrics-avg-duration">{formatDuration(agentData.avgDurationMs)} avg</span>
                      <span className="metrics-run-count">{agentData.runs} runs</span>
                    </>
                  ) : (
                    <span className="metrics-no-data">No runs</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="metrics-recent">
            <h3>Recent Runs</h3>
            {metrics.recentRuns.length === 0 ? (
              <p className="empty-state">No recent runs.</p>
            ) : (
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Stage</th>
                    <th>Duration</th>
                    <th>Findings</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentRuns.map((run: AgentMetricRecord) => (
                    <tr key={run.id} className={run.success ? 'metrics-run-ok' : 'metrics-run-fail'}>
                      <td>{run.agentId}</td>
                      <td>{run.stage}</td>
                      <td>{formatDuration(run.durationMs)}</td>
                      <td>{run.findingsCount}</td>
                      <td>{run.success ? 'OK' : 'FAIL'}</td>
                      <td>{formatTimeAgo(run.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="metrics-totals">
            <span>Total: {metrics.totalRuns} runs</span>
            <span>Success: {formatPercent(metrics.successRate)}</span>
            <span>Avg: {formatDuration(metrics.avgDurationMs)}</span>
            <span>P95: {formatDuration(metrics.p95DurationMs)}</span>
            <span>Findings: {metrics.totalFindings}</span>
          </div>
        </>
      ) : null}
    </section>
  );
}
