import type { Finding, TaskRun } from '@shared/types';

import { HandoffActions } from './HandoffActions';

const SEVERITY_ICONS: Record<Finding['severity'], string> = {
  critical: '\u26D4',
  high: '\u26A0\uFE0F',
  medium: '\u2139\uFE0F',
  low: '\u2022',
  info: '\u25CB'
};

interface FindingsPanelProps {
  task: TaskRun | undefined;
}

export function FindingsPanel({ task }: FindingsPanelProps) {
  const findings = task?.findings ?? [];

  if (!task) {
    return (
      <section className="card">
        <h2>Findings</h2>
        <p className="empty-state">Select a task to see findings.</p>
      </section>
    );
  }

  const criticalCount = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;

  return (
    <section className="card">
      <div className="findings-header">
        <h2>Findings ({findings.length})</h2>
        {criticalCount > 0 ? (
          <span className="findings-critical-badge">{criticalCount} critical/high</span>
        ) : null}
      </div>

      {findings.length === 0 ? (
        <p className="empty-state">No findings yet.</p>
      ) : (
        <>
          {findings.map((finding, index) => (
            <article key={`${finding.sourceAgent}-${index}`} className={`finding finding-${finding.severity}`}>
              <div className="finding-title-row">
                <span className="finding-icon">{SEVERITY_ICONS[finding.severity]}</span>
                <h4>{finding.title}</h4>
              </div>
              <p>{finding.body}</p>
              {finding.file ? (
                <span className="finding-location">
                  {finding.file}
                  {finding.line ? `:${finding.line}` : ''}
                </span>
              ) : null}
              <span className="finding-source">from {finding.sourceAgent}</span>
            </article>
          ))}

          <HandoffActions task={task} findings={findings} />
        </>
      )}
    </section>
  );
}
