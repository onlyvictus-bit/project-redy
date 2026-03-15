import { render, screen } from '@testing-library/react';

import { makeTask } from '../test-fixtures';
import { FindingsPanel } from './FindingsPanel';

describe('FindingsPanel', () => {
  it('shows an empty state when no task is selected', () => {
    render(<FindingsPanel task={undefined} />);

    expect(screen.getByText('Select a task to see findings.')).toBeInTheDocument();
  });

  it('shows findings summary and enabled handoff actions', () => {
    const task = makeTask({
      findings: [
        {
          severity: 'high',
          title: 'Race condition',
          body: 'Missing lock',
          sourceAgent: 'codex',
          file: 'src/app.ts',
          line: 12
        },
        {
          severity: 'low',
          title: 'Style issue',
          body: 'Rename this variable',
          sourceAgent: 'gemini'
        }
      ]
    });

    render(<FindingsPanel task={task} />);

    expect(screen.getByText('Findings (2)')).toBeInTheDocument();
    expect(screen.getByText('1 critical/high')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to Claude for fix' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ask Codex to verify' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ask Gemini for review' })).not.toBeDisabled();
  });
});
