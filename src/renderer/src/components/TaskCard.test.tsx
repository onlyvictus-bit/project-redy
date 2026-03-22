import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TaskRun } from '@shared/types';
import { TaskCard } from './TaskCard';

function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'task-1',
    projectId: 'proj-1',
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc',
    worktreePath: '/tmp/worktree',
    stage: 'code',
    brief: 'Build a feature',
    assignedAgents: ['claude', 'codex'],
    approvalState: 'pending',
    branchName: 'triad/task-1',
    findings: [],
    artifacts: [],
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('TaskCard', () => {
  it('renders the brief and stage badge', () => {
    render(<TaskCard task={makeTask()} isSelected={false} onSelect={vi.fn()} onPromote={vi.fn()} />);
    expect(screen.getByText('Build a feature')).toBeTruthy();
    expect(screen.getByText('code')).toBeTruthy();
  });

  it('calls onSelect when the card is clicked', () => {
    const onSelect = vi.fn();
    render(<TaskCard task={makeTask()} isSelected={false} onSelect={onSelect} onPromote={vi.fn()} />);
    fireEvent.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('does not render promote buttons when stage is not "promote"', () => {
    render(<TaskCard task={makeTask({ stage: 'code' })} isSelected={false} onSelect={vi.fn()} onPromote={vi.fn()} />);
    expect(screen.queryByText('Apply to main')).toBeNull();
  });

  it('renders all three promote buttons when stage is "promote"', () => {
    render(<TaskCard task={makeTask({ stage: 'promote' })} isSelected={false} onSelect={vi.fn()} onPromote={vi.fn()} />);
    expect(screen.getByText('Apply to main')).toBeTruthy();
    expect(screen.getByText('Keep worktree')).toBeTruthy();
    expect(screen.getByText('Open task branch')).toBeTruthy();
  });

  it('calls onPromote with the correct action for each promote button', () => {
    const onPromote = vi.fn();
    render(<TaskCard task={makeTask({ stage: 'promote' })} isSelected={false} onSelect={vi.fn()} onPromote={onPromote} />);

    fireEvent.click(screen.getByText('Apply to main'));
    expect(onPromote).toHaveBeenCalledWith('apply-to-main');

    fireEvent.click(screen.getByText('Keep worktree'));
    expect(onPromote).toHaveBeenCalledWith('keep-worktree');

    fireEvent.click(screen.getByText('Open task branch'));
    expect(onPromote).toHaveBeenCalledWith('open-task-branch');
  });

  it('promote button clicks do not bubble up and trigger onSelect', () => {
    const onSelect = vi.fn();
    const onPromote = vi.fn();
    render(<TaskCard task={makeTask({ stage: 'promote' })} isSelected={false} onSelect={onSelect} onPromote={onPromote} />);

    fireEvent.click(screen.getByText('Apply to main'));
    // onPromote fires, onSelect must NOT fire (stopPropagation guard)
    expect(onPromote).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
