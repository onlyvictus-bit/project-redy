interface DiffViewerProps {
  patch: string | undefined;
}

function classifyLine(line: string): 'added' | 'removed' | 'header' | 'context' {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('@@')) {
    return 'header';
  }
  if (line.startsWith('+')) {
    return 'added';
  }
  if (line.startsWith('-')) {
    return 'removed';
  }
  return 'context';
}

export function DiffViewer({ patch }: DiffViewerProps) {
  if (!patch) {
    return <div className="diff-empty">No patch available for this artifact.</div>;
  }

  const lines = patch.split('\n');

  return (
    <div className="diff-viewer">
      <div className="diff-toolbar">
        <button
          onClick={() => {
            void navigator.clipboard.writeText(patch);
          }}
        >
          Copy diff
        </button>
        <span className="diff-stats">
          +{lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length}
          {' / '}
          -{lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length}
        </span>
      </div>
      <pre className="diff-content">
        {lines.map((line, i) => (
          <div key={i} className={`diff-line diff-line-${classifyLine(line)}`}>
            <span className="diff-line-number">{i + 1}</span>
            <span className="diff-line-text">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
