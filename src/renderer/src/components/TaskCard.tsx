import type { PromotionAction, TaskRun } from '@shared/types';

interface TaskCardProps {
  task: TaskRun;
  isSelected: boolean;
  onSelect: () => void;
  onPromote: (action: PromotionAction) => void;
}

export function TaskCard({ task, isSelected, onSelect, onPromote }: TaskCardProps) {
  return (
    <article className={`task-card${isSelected ? ' task-card-selected' : ''}`} onClick={onSelect}>
      <div className="task-card-header">
        <h4>{task.brief}</h4>
        <span className={`stage-badge stage-${task.stage}`}>{task.stage}</span>
      </div>
      <p>{task.summary || 'No summary yet.'}</p>
      <div className="task-meta">
        <span>{task.workflowId}</span>
        <span>{task.branchName}</span>
        <span>{task.findings.length} findings</span>
      </div>
      {task.stage === 'promote' ? (
        <div className="task-actions" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onPromote('apply-to-main')}>Apply to main</button>
          <button onClick={() => onPromote('keep-worktree')}>Keep worktree</button>
          <button onClick={() => onPromote('open-task-branch')}>Open task branch</button>
        </div>
      ) : null}
    </article>
  );
}
