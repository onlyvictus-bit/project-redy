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
  const startWorkflow = useWorkbenchStore((state) => state.startWorkflow);

  return (
    <div className="handoff-actions">
      <strong className="handoff-label">Handoff actions</strong>
      <div className="handoff-buttons">
        <button
          className="handoff-btn handoff-claude"
          onClick={() => {
            void startWorkflow({
              brief: formatFindingsBrief(task.id, findings),
              workflowId: 'code-review-fix-verify'
            });
          }}
        >
          Send to Claude for fix
        </button>
        <button
          className="handoff-btn handoff-codex"
          onClick={() => {
            void startWorkflow({
              brief: `Verify the latest changes for task ${task.id.slice(0, 8)}. Check for regressions and run tests.`,
              workflowId: 'code-review-fix-verify'
            });
          }}
        >
          Ask Codex to verify
        </button>
        <button
          className="handoff-btn handoff-gemini"
          onClick={() => {
            void startWorkflow({
              brief: `Review the architecture of task ${task.id.slice(0, 8)}: ${task.brief}\n\nFindings so far:\n${findings.map((f) => `- ${f.title}`).join('\n')}`,
              workflowId: 'code-gemini-compare-codex-review'
            });
          }}
        >
          Ask Gemini for review
        </button>
      </div>
    </div>
  );
}
