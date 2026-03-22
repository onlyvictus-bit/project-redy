import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import type { PromotionAction } from '@shared/types';
import { useWorkbenchStore } from '../store';
import { makeArtifact, makeTask } from '../test-fixtures';
import { TaskDetailPanel } from './TaskDetailPanel';

describe('TaskDetailPanel', () => {
  it('shows an empty state when no task is selected', () => {
    render(<TaskDetailPanel task={undefined} />);

    expect(screen.getByText('Select a task to inspect it')).toBeInTheDocument();
  });

  it('shows promote actions and switches selected artifacts', () => {
    const promoteTask = vi.fn(async (_taskId: string, _action: PromotionAction) => undefined);
    useWorkbenchStore.setState({ promoteTask });

    const firstArtifact = makeArtifact({
      id: 'artifact-1',
      agentId: 'claude',
      summary: 'Claude summary'
    });
    const secondArtifact = makeArtifact({
      id: 'artifact-2',
      agentId: 'codex',
      role: 'tester',
      summary: 'Codex summary',
      finalMessage: 'Codex final message'
    });
    const task = makeTask({
      artifacts: [firstArtifact, secondArtifact]
    });

    render(<TaskDetailPanel task={task} />);

    expect(screen.getByText('Ready to promote')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to main' })).toBeInTheDocument();
    expect(screen.getByText('Claude summary')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /codextester/i }));

    expect(screen.getByText('Codex summary')).toBeInTheDocument();
    expect(screen.getByText('Codex final message')).toBeInTheDocument();
  });
});
