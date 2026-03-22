import { fireEvent, render, screen } from '@testing-library/react';

import { makeArtifact } from '../test-fixtures';
import { ArtifactViewer } from './ArtifactViewer';

describe('ArtifactViewer', () => {
  it('renders overview by default and switches between tabs', () => {
    const artifact = makeArtifact({
      findings: [
        {
          severity: 'high',
          title: 'Race condition',
          body: 'Missing lock',
          sourceAgent: 'codex',
          file: 'src/app.ts',
          line: 12,
          recommendedAction: 'Add a lock'
        }
      ],
      commandRuns: [
        {
          command: 'npm test',
          exitCode: 1,
          stdout: '1 failed',
          stderr: 'stack trace'
        }
      ]
    });

    render(<ArtifactViewer artifact={artifact} />);

    expect(screen.getByText('Artifact summary')).toBeInTheDocument();
    expect(screen.getByText('Artifact final message')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Logs' }));
    expect(screen.getByText('stdout')).toBeInTheDocument();
    expect(screen.getByText('stdout log')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Findings (1)' }));
    expect(screen.getByText('Race condition')).toBeInTheDocument();
    expect(screen.getByText('Add a lock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Commands' }));
    expect(screen.getByText('$ npm test')).toBeInTheDocument();
    expect(screen.getByText('exit 1')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });
});
