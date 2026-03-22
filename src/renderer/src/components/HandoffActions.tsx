import type { Finding, TaskRun } from '@shared/types';

import { useWorkbenchStore } from '../store';

interface HandoffActionsProps {
  task: TaskRun;
  findings: Finding[];
}

function formatFindingsBrief(taskId: string, findings: Finding[]): string {
  return `Fix these findings from task ${taskId.slice(0, 8)}:\n${findings.map((f) => `- [${f.severity}] ${f.title}: ${f.body}`).join('\n')}`;
}

export function HandoffActions({ task, findings }: HandoffActionsProps) {
  const continueTask = useWorkbenchStore((state) => state.continueTask);
  const isBusy = useWorkbenchStore((state) => state.isBusy);

  return (
    <div className="handoff-actions">
      <strong className="handoff-label">Handoff actions</strong>
      <div className="handoff-buttons">
        <button
          className="handoff-btn handoff-claude"
          disabled={isBusy}
          onClick={() => {
            void continueTask(task.id, {
              mode: 'single-step',
              stage: 'fix',
              agentId: 'claude',
              role: 'coder',
              prompt: findings.length > 0 ? formatFindingsBrief(task.id, findings) : undefined
            });
          }}
        >
          Send to Claude for fix
        </button>
        <button
          className="handoff-btn handoff-codex"
          disabled={isBusy}
          onClick={() => {
            void continueTask(task.id, {
              mode: 'single-step',
              stage: 'verify',
              agentId: 'codex',
              role: 'tester'
            });
          }}
        >
          Ask Codex to verify
        </button>
        <button
          className="handoff-btn handoff-gemini"
          disabled={isBusy}
          onClick={() => {
            void continueTask(task.id, {
              mode: 'single-step',
              stage: 'review',
              agentId: 'gemini',
              role: 'reviewer'
            });
          }}
        >
          Ask Gemini for review
        </button>
      </div>
    </div>
  );
}
