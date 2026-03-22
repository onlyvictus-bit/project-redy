import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { DiffViewer } from './DiffViewer';

describe('DiffViewer', () => {
  it('shows an empty state when no patch is available', () => {
    render(<DiffViewer patch={undefined} />);

    expect(screen.getByText('No patch available for this artifact.')).toBeInTheDocument();
  });

  it('renders diff stats and copies the patch', () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    const patch = ['diff --git a/file.ts b/file.ts', '@@ -1 +1 @@', '-old value', '+new value'].join('\n');
    render(<DiffViewer patch={patch} />);

    expect(
      screen.getByText((_, element) => Boolean(element?.classList.contains('diff-stats')) && element?.textContent === '+1 / -1')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy diff' }));

    expect(writeText).toHaveBeenCalledWith(patch);
  });
});
