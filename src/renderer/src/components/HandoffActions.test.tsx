import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HandoffActions } from './HandoffActions';

import type { Finding, TaskRun } from '@shared/types';

const mockContinueTask = vi.fn();

vi.mock('../store', () => ({
  useWorkbenchStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      continueTask: mockContinueTask,
      isBusy: false
    })
}));

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    severity: 'high',
    title: 'Test finding',
    body: 'Something is wrong',
    sourceAgent: 'codex',
    ...overrides
  };
}

function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'task-1234-5678',
    projectId: 'proj-1',
    workflowId: 'code-review-fix-verify',
    workflowMode: 'orchestrate',
    baseBranch: 'main',
    baseCommit: 'abc123',
    worktreePath: '/tmp/worktree',
    stage: 'review',
    brief: 'Test task',
    assignedAgents: ['claude', 'codex'],
    approvalState: 'pending',
    branchName: 'triad/test',
    findings: [],
    artifacts: [],
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('HandoffActions', () => {
  it('renders three enabled buttons that call continueTask with correct options', () => {
    const findings = [makeFinding()];
    const task = makeTask({ findings });

    render(<HandoffActions task={task} findings={findings} />);

    const claudeBtn = screen.getByText('Send to Claude for fix');
    const codexBtn = screen.getByText('Ask Codex to verify');
    const geminiBtn = screen.getByText('Ask Gemini for review');

    expect(claudeBtn).not.toBeDisabled();
    expect(codexBtn).not.toBeDisabled();
    expect(geminiBtn).not.toBeDisabled();

    fireEvent.click(claudeBtn);
    expect(mockContinueTask).toHaveBeenCalledWith('task-1234-5678', {
      mode: 'single-step',
      stage: 'fix',
      agentId: 'claude',
      role: 'coder',
      prompt: expect.stringContaining('Test finding')
    });

    fireEvent.click(codexBtn);
    expect(mockContinueTask).toHaveBeenCalledWith('task-1234-5678', {
      mode: 'single-step',
      stage: 'verify',
      agentId: 'codex',
      role: 'tester'
    });

    fireEvent.click(geminiBtn);
    expect(mockContinueTask).toHaveBeenCalledWith('task-1234-5678', {
      mode: 'single-step',
      stage: 'review',
      agentId: 'gemini',
      role: 'reviewer'
    });
  });
});
