import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentMetricsSummary } from '@shared/types';

import { MetricsPanel } from './MetricsPanel';

function makeSummary(overrides: Partial<AgentMetricsSummary> = {}): AgentMetricsSummary {
  return {
    totalRuns: 35,
    successRate: 0.86,
    avgDurationMs: 42_000,
    p95DurationMs: 120_000,
    totalFindings: 28,
    byAgent: {
      claude: { runs: 12, successRate: 0.92, avgDurationMs: 45_000, avgFindings: 3 },
      codex: { runs: 10, successRate: 0.87, avgDurationMs: 38_000, avgFindings: 2 },
      gemini: { runs: 8, successRate: 0.78, avgDurationMs: 52_000, avgFindings: 1.5 },
      ollama: { runs: 5, successRate: 0.65, avgDurationMs: 12_000, avgFindings: 0.4 }
    },
    byWorkflow: {
      'code-review-fix-verify': { runs: 20, successRate: 0.9, avgDurationMs: 45_000 }
    },
    recentRuns: [
      {
        id: 'run-1',
        taskId: 'task-1',
        agentId: 'claude',
        workflowId: 'code-review-fix-verify',
        stage: 'code',
        role: 'coder',
        startedAt: '2026-03-26T10:00:00.000Z',
        completedAt: '2026-03-26T10:00:45.000Z',
        durationMs: 45_000,
        exitCode: 0,
        findingsCount: 3,
        patchLinesAdded: 20,
        patchLinesRemoved: 5,
        promptTokensEstimate: 1000,
        success: true
      },
      {
        id: 'run-2',
        taskId: 'task-2',
        agentId: 'codex',
        workflowId: 'code-review-fix-verify',
        stage: 'review',
        role: 'reviewer',
        startedAt: '2026-03-26T10:01:00.000Z',
        completedAt: '2026-03-26T10:01:38.000Z',
        durationMs: 38_000,
        exitCode: 1,
        findingsCount: 0,
        patchLinesAdded: 0,
        patchLinesRemoved: 0,
        promptTokensEstimate: 800,
        success: false
      }
    ],
    ...overrides
  };
}

describe('MetricsPanel', () => {
  let mockLoadMetrics: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLoadMetrics = vi.fn();
  });

  it('shows loading state then renders metrics data', async () => {
    mockLoadMetrics.mockResolvedValue(makeSummary());

    render(<MetricsPanel loadMetrics={mockLoadMetrics} />);

    // Initially shows loading
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeInTheDocument();

    // After data loads
    await waitFor(() => {
      expect(screen.getByText('Agent Performance')).toBeInTheDocument();
    });

    expect(mockLoadMetrics).toHaveBeenCalledTimes(1);
  });

  it('displays per-agent summary cards', async () => {
    mockLoadMetrics.mockResolvedValue(makeSummary());

    render(<MetricsPanel loadMetrics={mockLoadMetrics} />);

    await waitFor(() => {
      expect(screen.getByText('92% ok')).toBeInTheDocument();
    });

    expect(screen.getByText('12 runs')).toBeInTheDocument();
    expect(screen.getByText('87% ok')).toBeInTheDocument();
    expect(screen.getByText('10 runs')).toBeInTheDocument();
    expect(screen.getByText('78% ok')).toBeInTheDocument();
    expect(screen.getByText('8 runs')).toBeInTheDocument();
    expect(screen.getByText('65% ok')).toBeInTheDocument();
    expect(screen.getByText('5 runs')).toBeInTheDocument();
  });

  it('displays recent runs table', async () => {
    mockLoadMetrics.mockResolvedValue(makeSummary());

    render(<MetricsPanel loadMetrics={mockLoadMetrics} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Runs')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Stage')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();

    // Check rows
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });

  it('displays aggregate totals', async () => {
    mockLoadMetrics.mockResolvedValue(makeSummary());

    render(<MetricsPanel loadMetrics={mockLoadMetrics} />);

    await waitFor(() => {
      expect(screen.getByText('Total: 35 runs')).toBeInTheDocument();
    });

    expect(screen.getByText('Success: 86%')).toBeInTheDocument();
    expect(screen.getByText('Findings: 28')).toBeInTheDocument();
  });

  it('shows "No runs" for agents without data', async () => {
    mockLoadMetrics.mockResolvedValue(makeSummary({ byAgent: {} }));

    render(<MetricsPanel loadMetrics={mockLoadMetrics} />);

    await waitFor(() => {
      expect(screen.getAllByText('No runs')).toHaveLength(4);
    });
  });

  it('shows empty state when no metrics returned and then no data', async () => {
    mockLoadMetrics.mockResolvedValue(makeSummary({ recentRuns: [] }));

    render(<MetricsPanel loadMetrics={mockLoadMetrics} />);

    await waitFor(() => {
      expect(screen.getByText('No recent runs.')).toBeInTheDocument();
    });
  });

  it('shows error when loadMetrics rejects', async () => {
    mockLoadMetrics.mockRejectedValue(new Error('IPC channel not available'));

    render(<MetricsPanel loadMetrics={mockLoadMetrics} />);

    await waitFor(() => {
      expect(screen.getByText('IPC channel not available')).toBeInTheDocument();
    });
  });

  it('refresh button reloads metrics', async () => {
    const summary = makeSummary();
    mockLoadMetrics.mockResolvedValue(summary);

    render(<MetricsPanel loadMetrics={mockLoadMetrics} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });

    // Click refresh
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(mockLoadMetrics).toHaveBeenCalledTimes(2);
    });
  });
});
