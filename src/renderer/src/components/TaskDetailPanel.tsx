import type { TaskRun, TaskStage } from '@shared/types';
import { WORKFLOW_DEFINITIONS } from '@shared/workflows';

import { ArtifactViewer } from './ArtifactViewer';
import { useWorkbenchStore } from '../store';

const STAGE_ORDER: TaskStage[] = ['brief', 'code', 'review', 'findings', 'fix', 'verify', 'promote', 'done', 'error', 'cancelled'];

// Stages that are internal transitions, not displayed as progress steps.
const HIDDEN_STAGES = new Set<string>(['findings', 'error']);

function stageIndex(stage: TaskStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function WorkflowProgress({ task }: { task: TaskRun }) {
  const workflowDef = WORKFLOW_DEFINITIONS.find((w) => w.id === task.workflowId);
  const progressStages = (workflowDef?.stages ?? ['brief', 'code', 'review', 'fix', 'verify', 'promote'])
    .filter((s) => !HIDDEN_STAGES.has(s)) as TaskStage[];

  // For terminal error/cancelled states we can't use stageIndex reliably (they sit outside the
  // normal progress flow). Find the last stage that actually completed via task.steps instead.
  const isTerminalFailure = task.stage === 'error' || task.stage === 'cancelled';
  const lastCompletedStage = isTerminalFailure
    ? (task.steps.filter((s) => s.status === 'completed').at(-1)?.stage ?? null)
    : null;
  const currentIdx = isTerminalFailure ? -1 : stageIndex(task.stage);

  return (
    <div className="workflow-progress">
      {progressStages.map((stage) => {
        const idx = stageIndex(stage);
        let isDone: boolean;
        let isCurrent: boolean;
        if (isTerminalFailure) {
          isDone = lastCompletedStage !== null && idx <= stageIndex(lastCompletedStage);
          isCurrent = false;
        } else {
          isDone = idx < currentIdx && task.stage !== 'error';
          isCurrent = task.stage === stage;
        }
        const cls = isDone ? 'progress-stage-done' : isCurrent ? 'progress-stage-running' : 'progress-stage-upcoming';
        return (
          <div key={stage} className={`progress-stage ${cls}`}>
            <span className="progress-dot">{isDone ? '✓' : isCurrent ? '●' : '○'}</span>
            <span className="progress-label">{stage}</span>
          </div>
        );
      })}
    </div>
  );
}

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

        <WorkflowProgress task={task} />
        <div className="detail-meta">
          <span>Workflow: {task.workflowId}</span>
          <span>Branch: {task.branchName}</span>
          <span>{task.findings.length} findings</span>
          <span>{task.artifacts.length} artifacts</span>
        </div>

        {task.stage === 'promote' && task.approvalState !== 'not-required' ? (
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
          {task.steps.map((step) => {
            const statusIcon =
              step.status === 'completed' ? '✓' :
              step.status === 'failed'    ? '✗' :
              step.status === 'cancelled' ? '⊘' :
              step.status === 'running'   ? '●' :
              '○';
            const isBad = step.status === 'failed' || step.status === 'cancelled';
            return (
              <div key={step.id} className={`step-item step-${step.status}`}>
                <span className="step-status-icon">{statusIcon}</span>
                <span className="step-stage">{step.stage}</span>
                <span className="step-agent">{step.agentId}</span>
                <span className="step-status">{step.status}</span>
                {step.startedAt ? (
                  <span className="step-time">{new Date(step.startedAt).toLocaleTimeString()}</span>
                ) : null}
                {step.summary ? (
                  <p className={`step-summary${isBad ? ' step-summary-prominent' : ''}`}>{step.summary}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="detail-artifacts">
        <h3>Artifacts</h3>
        <div className="artifact-list">
          {[...task.artifacts]
            .sort((a, b) => {
              // Failed artifacts (exitCode !== 0) sort before successful ones.
              // Within each group preserve the existing order (stable sort).
              const aFailed = a.exitCode !== 0 ? 0 : 1;
              const bFailed = b.exitCode !== 0 ? 0 : 1;
              return aFailed - bFailed;
            })
            .map((artifact) => (
              <button
                key={artifact.id}
                className={[
                  'artifact-list-item',
                  artifact.id === selectedArtifact?.id ? 'artifact-list-item-active' : '',
                  artifact.exitCode !== 0 ? 'artifact-list-item-failed' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => selectArtifact(artifact.id)}
              >
                <span className="artifact-list-agent">{artifact.agentId}</span>
                <span className="artifact-list-role">{artifact.role}</span>
                {artifact.exitCode !== 0 ? (
                  <span className="artifact-exit-badge artifact-exit-failed">exit {artifact.exitCode ?? '?'}</span>
                ) : null}
                <span className="artifact-list-time">{new Date(artifact.createdAt).toLocaleTimeString()}</span>
              </button>
            ))}
        </div>
      </div>

      {selectedArtifact ? (
        <ArtifactViewer key={selectedArtifact.id} artifact={selectedArtifact} />
      ) : null}
    </div>
  );
}
