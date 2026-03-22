import { useEffect, useState } from 'react';

import type { ArtifactBundle, TaskRun } from '@shared/types';
import type { ArchiveTaskDetail } from '@shared/ipc';
import { useWorkbenchStore } from '../store';

type AgentFilter = 'all' | 'claude' | 'codex' | 'gemini' | 'ollama';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'info';
type DetailTab = 'transcript' | 'prompt' | 'findings' | 'timeline';

export function ArchiveBrowser() {
  const projectId = useWorkbenchStore((s) => s.snapshot?.project?.id);

  // Task list state
  const [tasks, setTasks] = useState<TaskRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter state (local, not Zustand)
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  // Detail state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArchiveTaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('transcript');

  // Fetch task list when project changes
  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    setIsLoading(true);
    setFetchError(null);
    window.workbench
      .listArchiveTasks(projectId)
      .then((fetched) => {
        setTasks(fetched);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [projectId]);

  // Fetch detail when a task is selected
  useEffect(() => {
    if (!selectedTaskId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    window.workbench
      .getArchiveTaskDetail(selectedTaskId)
      .then((d) => {
        setDetail(d);
        setActiveTab('transcript');
      })
      .catch(() => {
        setDetail(null);
      })
      .finally(() => {
        setDetailLoading(false);
      });
  }, [selectedTaskId]);

  // Client-side filtering
  const filteredTasks = tasks.filter((task) => {
    if (agentFilter !== 'all' && !task.assignedAgents.includes(agentFilter)) return false;
    if (workflowFilter !== 'all' && task.workflowId !== workflowFilter) return false;
    if (dateFilter && !task.createdAt.startsWith(dateFilter)) return false;
    if (severityFilter !== 'all') {
      const hasSeverity = task.findings.some((f) => f.severity === severityFilter);
      if (!hasSeverity) return false;
    }
    return true;
  });

  if (!projectId) {
    return (
      <div className="archive-browser">
        <div className="empty-state">
          <span className="empty-state-icon">&#9678;</span>
          Select or add a project to get started
        </div>
      </div>
    );
  }

  return (
    <div className="archive-browser" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, padding: '4px 0' }}>Task History</h3>

      {/* Filter bar */}
      <div className="archive-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value as AgentFilter)}>
          <option value="all">All agents</option>
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
          <option value="gemini">Gemini</option>
          <option value="ollama">Ollama</option>
        </select>
        <select value={workflowFilter} onChange={(e) => setWorkflowFilter(e.target.value)}>
          <option value="all">All workflows</option>
          <option value="code-review-fix-verify">Code + Review</option>
          <option value="code-gemini-compare-codex-review">Gemini Compare</option>
          <option value="architecture-compare">Architecture</option>
          <option value="away-monitor">Away Monitor</option>
        </select>
        <input
          type="text"
          placeholder="Date (YYYY-MM-DD)"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={{ width: 130 }}
        />
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* Task list */}
      <div
        className="archive-task-list"
        style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #2a3a4a', borderRadius: 4 }}
      >
        {isLoading ? (
          <p style={{ padding: 8, color: '#8a9ab0' }}>Loading...</p>
        ) : fetchError ? (
          <p style={{ padding: 8, color: '#e06c6c' }}>{fetchError}</p>
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">&#9719;</span>
            No task history for this project yet
          </div>
        ) : (
          filteredTasks.map((task) => (
            <button
              key={task.id}
              className={`archive-task-row${selectedTaskId === task.id ? ' selected' : ''}`}
              onClick={() => setSelectedTaskId(task.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                background: selectedTaskId === task.id ? '#1e3050' : 'transparent',
                border: 'none',
                borderBottom: '1px solid #1e2d3e',
                color: '#d8e1f0',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {task.brief.slice(0, 60)}
                {task.brief.length > 60 ? '\u2026' : ''}
              </span>
              <span style={{ marginLeft: 8, color: '#8a9ab0', fontSize: 11 }}>[{task.stage}]</span>
              <span style={{ marginLeft: 8, color: '#8a9ab0', fontSize: 11 }}>{task.createdAt.slice(0, 10)}</span>
            </button>
          ))
        )}
      </div>

      {/* Detail pane */}
      {selectedTaskId && (
        <div
          className="archive-detail"
          style={{ border: '1px solid #2a3a4a', borderRadius: 4, overflow: 'hidden' }}
        >
          {detailLoading ? (
            <p style={{ padding: 8, color: '#8a9ab0' }}>Loading detail...</p>
          ) : detail ? (
            <>
              <div style={{ padding: '6px 10px', background: '#1a2535', fontSize: 12 }}>
                <strong>{detail.task.id.slice(0, 8)}</strong>
                <span style={{ marginLeft: 8, color: '#8a9ab0' }}>{detail.task.workflowId}</span>
                <span style={{ marginLeft: 8, color: '#8a9ab0' }}>{detail.task.assignedAgents.join(', ')}</span>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', background: '#151f2e', borderBottom: '1px solid #2a3a4a' }}>
                {(['transcript', 'prompt', 'findings', 'timeline'] as DetailTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '4px 12px',
                      background: activeTab === tab ? '#1e3050' : 'transparent',
                      border: 'none',
                      borderBottom: activeTab === tab ? '2px solid #4a90e2' : '2px solid transparent',
                      color: activeTab === tab ? '#d8e1f0' : '#8a9ab0',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      textTransform: 'capitalize'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div
                style={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  padding: '8px 10px',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'pre-wrap',
                  background: '#0e1a28',
                  color: '#d8e1f0'
                }}
              >
                {activeTab === 'transcript' &&
                  detail.artifacts.map((a: ArtifactBundle) => (
                    <div key={a.id} style={{ marginBottom: 12 }}>
                      <div style={{ color: '#8a9ab0', marginBottom: 4 }}>
                        [{a.agentId} / {a.role}]
                      </div>
                      {a.stdout ? <div>{a.stdout}</div> : null}
                      {a.stderr ? <div style={{ color: '#e06c6c' }}>{a.stderr}</div> : null}
                    </div>
                  ))}

                {activeTab === 'prompt' &&
                  detail.artifacts.map((a: ArtifactBundle) => (
                    <div key={a.id} style={{ marginBottom: 12 }}>
                      <div style={{ color: '#8a9ab0', marginBottom: 4 }}>
                        [{a.agentId} / {a.role}]
                      </div>
                      <div>{a.prompt}</div>
                    </div>
                  ))}

                {activeTab === 'findings' &&
                  (() => {
                    const allFindings = detail.artifacts.flatMap((a: ArtifactBundle) => a.findings);
                    return allFindings.length === 0 ? (
                      <span style={{ color: '#8a9ab0' }}>No findings.</span>
                    ) : (
                      allFindings.map((f, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <span
                            style={{
                              color:
                                f.severity === 'critical' || f.severity === 'high' ? '#e06c6c' : '#8a9ab0',
                              marginRight: 8
                            }}
                          >
                            [{f.severity}]
                          </span>
                          <strong>{f.title}</strong>
                          <div style={{ marginTop: 4, color: '#c0cad8' }}>{f.body}</div>
                        </div>
                      ))
                    );
                  })()}

                {activeTab === 'timeline' &&
                  (detail.events.length === 0 ? (
                    <span style={{ color: '#8a9ab0' }}>No events.</span>
                  ) : (
                    detail.events.map((ev, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <span style={{ color: '#8a9ab0' }}>
                          {ev.recordedAt.slice(0, 19).replace('T', ' ')}
                        </span>
                        <span style={{ marginLeft: 8 }}>{ev.eventType}</span>
                      </div>
                    ))
                  ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
