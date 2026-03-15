import { useState } from 'react';

import type { ArtifactBundle } from '@shared/types';

import { DiffViewer } from './DiffViewer';

type ArtifactTab = 'overview' | 'prompt' | 'patch' | 'logs' | 'findings' | 'commands';

const TABS: { id: ArtifactTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'patch', label: 'Patch' },
  { id: 'logs', label: 'Logs' },
  { id: 'findings', label: 'Findings' },
  { id: 'commands', label: 'Commands' }
];

interface ArtifactViewerProps {
  artifact: ArtifactBundle;
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  const [activeTab, setActiveTab] = useState<ArtifactTab>('overview');

  return (
    <div className="artifact-viewer">
      <div className="artifact-header">
        <span className="artifact-agent">{artifact.agentId}</span>
        <span className="artifact-role">{artifact.role}</span>
        <span className="artifact-time">{new Date(artifact.createdAt).toLocaleTimeString()}</span>
      </div>

      <div className="artifact-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`artifact-tab${activeTab === tab.id ? ' artifact-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'findings' && artifact.findings.length > 0 ? ` (${artifact.findings.length})` : ''}
          </button>
        ))}
      </div>

      <div className="artifact-tab-content">
        {activeTab === 'overview' && (
          <div className="artifact-overview">
            <h4>Summary</h4>
            <p>{artifact.summary || 'No summary available.'}</p>
            <h4>Final Message</h4>
            <pre className="artifact-pre">{artifact.finalMessage || 'No final message.'}</pre>
          </div>
        )}

        {activeTab === 'prompt' && (
          <pre className="artifact-pre">{artifact.prompt}</pre>
        )}

        {activeTab === 'patch' && (
          <DiffViewer patch={artifact.patch} />
        )}

        {activeTab === 'logs' && (
          <div className="artifact-logs">
            <h4>stdout</h4>
            <pre className="artifact-pre">{artifact.stdout || '(empty)'}</pre>
            <h4>stderr</h4>
            <pre className="artifact-pre artifact-stderr">{artifact.stderr || '(empty)'}</pre>
          </div>
        )}

        {activeTab === 'findings' && (
          <div className="artifact-findings-list">
            {artifact.findings.length === 0 ? (
              <p className="empty-state">No findings from this artifact.</p>
            ) : (
              artifact.findings.map((finding, i) => (
                <article key={i} className={`finding finding-${finding.severity}`}>
                  <h4>{finding.title}</h4>
                  <p>{finding.body}</p>
                  {finding.file ? (
                    <span className="finding-location">
                      {finding.file}
                      {finding.line ? `:${finding.line}` : ''}
                    </span>
                  ) : null}
                  {finding.recommendedAction ? (
                    <p className="finding-action">{finding.recommendedAction}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === 'commands' && (
          <div className="artifact-commands">
            {artifact.commandRuns.length === 0 ? (
              <p className="empty-state">No commands were run.</p>
            ) : (
              artifact.commandRuns.map((cmd, i) => (
                <div key={i} className="command-run">
                  <code className="command-line">$ {cmd.command}</code>
                  <span className={`command-exit ${cmd.exitCode === 0 ? 'exit-ok' : 'exit-fail'}`}>
                    exit {cmd.exitCode ?? '?'}
                  </span>
                  {cmd.stdout ? <pre className="artifact-pre">{cmd.stdout}</pre> : null}
                  {cmd.stderr ? <pre className="artifact-pre artifact-stderr">{cmd.stderr}</pre> : null}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
