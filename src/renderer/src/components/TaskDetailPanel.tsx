import type { TaskRun } from '@shared/types';

import { ArtifactViewer } from './ArtifactViewer';
import { useWorkbenchStore } from '../store';

interface TaskDetailPanelProps {
  task: TaskRun | undefined;
}

export function TaskDetailPanel({ task }: TaskDetailPanelProps) {
  const selectedArtifactId = useWorkbenchStore((state) => state.selectedArtifactId);
  const selectArtifact = useWorkbenchStore((state) => state.selectArtifact);
  const promoteTask = useWorkbenchStore((state) => state.promoteTask);

  if (!task) {
    return (
      <div className="detail-panel detail-panel-empty">
        <p>Select a task from the left rail to inspect it.</p>
      </div>
    );
  }

  const selectedArtifact = task.artifacts.find((a) => a.id === selectedArtifactId) ?? task.artifacts[0];

  return (
    <div className="detail-panel">
      <div className="detail-summary">
        <div className="detail-summary-header">
          <h2>{task.brief}</h2>
          <div className="detail-badges">
            <span className={`stage-badge stage-${task.stage}`}>{task.stage}</span>
            <span className={`approval-badge approval-${task.approvalState}`}>{task.approvalState}</span>
          </div>
        </div>
        <div className="detail-meta">
          <span>Workflow: {task.workflowId}</span>
          <span>Branch: {task.branchName}</span>
          <span>{task.findings.length} findings</span>
          <span>{task.artifacts.length} artifacts</span>
        </div>

        {task.stage === 'promote' ? (
          <div className="detail-promote">
            <strong>Ready to promote</strong>
            <div className="task-actions">
              <button onClick={() => void promoteTask(task.id, 'apply-to-main')}>Apply to main</button>
              <button onClick={() => void promoteTask(task.id, 'keep-worktree')}>Keep worktree</button>
              <button onClick={() => void promoteTask(task.id, 'open-task-branch')}>Open task branch</button>
            </div>
          </div>
        ) : null}

        {task.errorMessage ? (
          <p className="error-banner">{task.errorMessage}</p>
        ) : null}
      </div>

      <div className="detail-steps">
        <h3>Steps</h3>
        <div className="steps-timeline">
          {task.steps.map((step) => (
            <div key={step.id} className={`step-item step-${step.status}`}>
              <span className="step-stage">{step.stage}</span>
              <span className="step-agent">{step.agentId}</span>
              <span className="step-status">{step.status}</span>
              {step.summary ? <p className="step-summary">{step.summary}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="detail-artifacts">
        <h3>Artifacts</h3>
        <div className="artifact-list">
          {task.artifacts.map((artifact) => (
            <button
              key={artifact.id}
              className={`artifact-list-item${artifact.id === selectedArtifact?.id ? ' artifact-list-item-active' : ''}`}
              onClick={() => selectArtifact(artifact.id)}
            >
              <span className="artifact-list-agent">{artifact.agentId}</span>
              <span className="artifact-list-role">{artifact.role}</span>
              <span className="artifact-list-time">{new Date(artifact.createdAt).toLocaleTimeString()}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedArtifact ? (
        <ArtifactViewer artifact={selectedArtifact} />
      ) : null}
    </div>
  );
}
