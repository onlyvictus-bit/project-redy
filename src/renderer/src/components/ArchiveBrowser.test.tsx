import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactBundle, Finding, TaskRun } from '@shared/types';
import type { ArchiveTaskDetail } from '@shared/ipc';
import { useWorkbenchStore } from '../store';

import { ArchiveBrowser } from './ArchiveBrowser';

// ---- helpers ----------------------------------------------------------------

function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'task-aaaa-bbbb',
    projectId: 'proj-1',
    workflowId: 'code-review-fix-verify',
    stage: 'done',
    brief: 'Fix the login bug and have Codex review it',
    assignedAgents: ['claude', 'codex'],
    findings: [],
    artifacts: [],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T11:00:00Z',
    ...overrides
  } as unknown as TaskRun;
}

function makeArtifact(overrides: Partial<ArtifactBundle> = {}): ArtifactBundle {
  return {
    id: 'art-1',
    agentId: 'claude',
    role: 'coder',
    prompt: 'Write tests for auth',
    stdout: 'Tests pass',
    stderr: '',
    summary: 'done',
    findings: [],
    createdAt: '2026-01-15T10:05:00Z',
    ...overrides
  } as unknown as ArtifactBundle;
}

function makeDetail(task: TaskRun, overrides: Partial<ArchiveTaskDetail> = {}): ArchiveTaskDetail {
  return {
    task,
    events: [
      { eventType: 'task.started', payload: {}, recordedAt: '2026-01-15T10:00:00Z' },
      { eventType: 'task.completed', payload: {}, recordedAt: '2026-01-15T11:00:00Z' }
    ],
    artifacts: [makeArtifact()],
    ...overrides
  };
}

// ---- tests ------------------------------------------------------------------

describe('ArchiveBrowser', () => {
  describe('when no project is selected', () => {
    beforeEach(() => {
      useWorkbenchStore.setState({ snapshot: undefined });
    });

    it('shows "No project selected" message', () => {
      render(<ArchiveBrowser />);
      expect(screen.getByText(/select or add a project to get started/i)).toBeInTheDocument();
    });

    it('does not call listArchiveTasks', () => {
      render(<ArchiveBrowser />);
      expect(window.workbench.listArchiveTasks).not.toHaveBeenCalled();
    });
  });

  describe('when a project is selected', () => {
    const PROJECT_ID = 'proj-1';

    beforeEach(() => {
      useWorkbenchStore.setState({
        snapshot: {
          project: { id: PROJECT_ID } as never,
          tasks: [],
          agents: {} as never,
          ollama: {} as never,
          notifications: [],
          terminals: []
        } as never
      });
    });

    it('shows loading state while fetch is in progress', async () => {
      // Never resolves so we can observe the loading state
      vi.mocked(window.workbench.listArchiveTasks).mockReturnValue(new Promise(() => undefined));

      render(<ArchiveBrowser />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('calls listArchiveTasks with the projectId on mount', async () => {
      vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([]);

      render(<ArchiveBrowser />);

      await waitFor(() => {
        expect(window.workbench.listArchiveTasks).toHaveBeenCalledWith(PROJECT_ID);
      });
    });

    it('shows "No tasks found" when task list is empty', async () => {
      vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([]);

      render(<ArchiveBrowser />);

      await waitFor(() => {
        expect(screen.getByText(/no task history for this project yet/i)).toBeInTheDocument();
      });
    });

    it('renders task rows with brief, stage, and date', async () => {
      const task = makeTask();
      vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);

      render(<ArchiveBrowser />);

      await waitFor(() => {
        expect(screen.getByText(/Fix the login bug/)).toBeInTheDocument();
      });
      expect(screen.getByText(/\[done\]/)).toBeInTheDocument();
      expect(screen.getByText(/2026-01-15/)).toBeInTheDocument();
    });

    it('renders the filter bar with 4 controls', async () => {
      vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([]);

      render(<ArchiveBrowser />);

      // 3 selects (agent, workflow, severity) + 1 date input
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(3);
      expect(screen.getByPlaceholderText(/YYYY-MM-DD/i)).toBeInTheDocument();
    });

    describe('filters', () => {
      it('agent filter hides tasks that do not include the selected agent', async () => {
        const codexTask = makeTask({ id: 'codex-task', assignedAgents: ['codex'] as never });
        const claudeTask = makeTask({ id: 'claude-task', assignedAgents: ['claude'] as never, brief: 'Claude only task' });
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([codexTask, claudeTask]);

        render(<ArchiveBrowser />);

        await waitFor(() => expect(screen.getByText(/claude only task/i)).toBeInTheDocument());

        // Select claude agent filter
        const agentSelect = screen.getAllByRole('combobox')[0];
        fireEvent.change(agentSelect, { target: { value: 'claude' } });

        await waitFor(() => {
          expect(screen.getByText(/claude only task/i)).toBeInTheDocument();
          expect(screen.queryByText(/Fix the login bug/)).not.toBeInTheDocument();
        });
      });

      it('date filter hides tasks that do not start with the typed date', async () => {
        const jan15task = makeTask({ id: 'jan15', brief: 'January 15 task', createdAt: '2026-01-15T10:00:00Z' });
        const jan20task = makeTask({ id: 'jan20', brief: 'January 20 task', createdAt: '2026-01-20T10:00:00Z' });
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([jan15task, jan20task]);

        render(<ArchiveBrowser />);

        await waitFor(() => expect(screen.getByText(/january 15 task/i)).toBeInTheDocument());

        fireEvent.change(screen.getByPlaceholderText(/YYYY-MM-DD/i), { target: { value: '2026-01-20' } });

        await waitFor(() => {
          expect(screen.getByText(/january 20 task/i)).toBeInTheDocument();
          expect(screen.queryByText(/january 15 task/i)).not.toBeInTheDocument();
        });
      });

      it('severity filter hides tasks that have no finding with that severity', async () => {
        const criticalFinding: Finding = { severity: 'critical', title: 'Critical bug', body: 'Bad bug', sourceAgent: 'claude' } as never;
        const withCritical = makeTask({ id: 'with-critical', brief: 'Has critical finding', findings: [criticalFinding] });
        const noFindings = makeTask({ id: 'no-findings', brief: 'Clean task', findings: [] });
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([withCritical, noFindings]);

        render(<ArchiveBrowser />);

        await waitFor(() => expect(screen.getByText(/has critical finding/i)).toBeInTheDocument());

        const severitySelect = screen.getAllByRole('combobox')[2];
        fireEvent.change(severitySelect, { target: { value: 'critical' } });

        await waitFor(() => {
          expect(screen.getByText(/has critical finding/i)).toBeInTheDocument();
          expect(screen.queryByText(/clean task/i)).not.toBeInTheDocument();
        });
      });
    });

    describe('task detail', () => {
      it('calls getArchiveTaskDetail when a task row is clicked', async () => {
        const task = makeTask();
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);
        vi.mocked(window.workbench.getArchiveTaskDetail).mockResolvedValue(makeDetail(task));

        render(<ArchiveBrowser />);

        const row = await screen.findByText(/Fix the login bug/);
        fireEvent.click(row.closest('button')!);

        await waitFor(() => {
          expect(window.workbench.getArchiveTaskDetail).toHaveBeenCalledWith(task.id);
        });
      });

      it('shows task ID (first 8 chars) in detail header after click', async () => {
        const task = makeTask();
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);
        vi.mocked(window.workbench.getArchiveTaskDetail).mockResolvedValue(makeDetail(task));

        render(<ArchiveBrowser />);

        const row = await screen.findByText(/Fix the login bug/);
        fireEvent.click(row.closest('button')!);

        await waitFor(() => {
          expect(screen.getByText('task-aaa')).toBeInTheDocument();
        });
      });

      it('shows 4 tabs: Transcript, Prompt, Findings, Timeline', async () => {
        const task = makeTask();
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);
        vi.mocked(window.workbench.getArchiveTaskDetail).mockResolvedValue(makeDetail(task));

        render(<ArchiveBrowser />);

        const row = await screen.findByText(/Fix the login bug/);
        fireEvent.click(row.closest('button')!);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /transcript/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /prompt/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /findings/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /timeline/i })).toBeInTheDocument();
        });
      });

      it('Transcript tab shows stdout from artifacts', async () => {
        const task = makeTask();
        const detail = makeDetail(task, {
          artifacts: [makeArtifact({ stdout: 'Hello from stdout' })]
        });
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);
        vi.mocked(window.workbench.getArchiveTaskDetail).mockResolvedValue(detail);

        render(<ArchiveBrowser />);

        const row = await screen.findByText(/Fix the login bug/);
        fireEvent.click(row.closest('button')!);

        await waitFor(() => {
          expect(screen.getByText('Hello from stdout')).toBeInTheDocument();
        });
      });

      it('Prompt tab shows prompt from artifacts', async () => {
        const task = makeTask();
        const detail = makeDetail(task, {
          artifacts: [makeArtifact({ prompt: 'Unique prompt text here' })]
        });
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);
        vi.mocked(window.workbench.getArchiveTaskDetail).mockResolvedValue(detail);

        render(<ArchiveBrowser />);

        const row = await screen.findByText(/Fix the login bug/);
        fireEvent.click(row.closest('button')!);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /prompt/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /prompt/i }));

        await waitFor(() => {
          expect(screen.getByText('Unique prompt text here')).toBeInTheDocument();
        });
      });

      it('Findings tab shows "No findings." when there are none', async () => {
        const task = makeTask();
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);
        vi.mocked(window.workbench.getArchiveTaskDetail).mockResolvedValue(makeDetail(task, { artifacts: [makeArtifact({ findings: [] })] }));

        render(<ArchiveBrowser />);

        const row = await screen.findByText(/Fix the login bug/);
        fireEvent.click(row.closest('button')!);

        await waitFor(() => screen.getByRole('button', { name: /findings/i }));
        fireEvent.click(screen.getByRole('button', { name: /findings/i }));

        await waitFor(() => {
          expect(screen.getByText(/no findings/i)).toBeInTheDocument();
        });
      });

      it('Findings tab shows finding title and severity', async () => {
        const task = makeTask();
        const finding: Finding = { severity: 'high', title: 'Memory leak detected', body: 'Leak in render loop', sourceAgent: 'claude' } as never;
        const detail = makeDetail(task, { artifacts: [makeArtifact({ findings: [finding] })] });
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);
        vi.mocked(window.workbench.getArchiveTaskDetail).mockResolvedValue(detail);

        render(<ArchiveBrowser />);

        const row = await screen.findByText(/Fix the login bug/);
        fireEvent.click(row.closest('button')!);

        await waitFor(() => screen.getByRole('button', { name: /findings/i }));
        fireEvent.click(screen.getByRole('button', { name: /findings/i }));

        await waitFor(() => {
          expect(screen.getByText('Memory leak detected')).toBeInTheDocument();
          expect(screen.getByText(/\[high\]/)).toBeInTheDocument();
        });
      });

      it('Timeline tab shows event types from detail.events', async () => {
        const task = makeTask();
        vi.mocked(window.workbench.listArchiveTasks).mockResolvedValue([task]);
        vi.mocked(window.workbench.getArchiveTaskDetail).mockResolvedValue(makeDetail(task));

        render(<ArchiveBrowser />);

        const row = await screen.findByText(/Fix the login bug/);
        fireEvent.click(row.closest('button')!);

        await waitFor(() => screen.getByRole('button', { name: /timeline/i }));
        fireEvent.click(screen.getByRole('button', { name: /timeline/i }));

        await waitFor(() => {
          expect(screen.getByText('task.started')).toBeInTheDocument();
          expect(screen.getByText('task.completed')).toBeInTheDocument();
        });
      });
    });
  });
});
