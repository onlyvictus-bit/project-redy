import { useEffect, useState } from 'react';

import type { AgentProfile } from '@shared/types';
import { WORKFLOW_DEFINITIONS } from '@shared/workflows';

import { useWorkbenchStore } from './store';
import { AgentPanel } from './components/AgentPanel';
import { TaskCard } from './components/TaskCard';

import '@xterm/xterm/css/xterm.css';
import './styles.css';


export default function App() {
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const error = useWorkbenchStore((state) => state.error);
  const isBusy = useWorkbenchStore((state) => state.isBusy);
  const bootstrap = useWorkbenchStore((state) => state.bootstrap);
  const applySnapshot = useWorkbenchStore((state) => state.applySnapshot);
  const appendTerminalData = useWorkbenchStore((state) => state.appendTerminalData);
  const selectProject = useWorkbenchStore((state) => state.selectProject);
  const probeAgents = useWorkbenchStore((state) => state.probeAgents);
  const setProjectRunner = useWorkbenchStore((state) => state.setProjectRunner);
  const startWorkflow = useWorkbenchStore((state) => state.startWorkflow);
  const promoteTask = useWorkbenchStore((state) => state.promoteTask);
  const selectedTaskId = useWorkbenchStore((state) => state.selectedTaskId);
  const selectTask = useWorkbenchStore((state) => state.selectTask);
  const setOllamaRole = useWorkbenchStore((state) => state.setOllamaRole);
  const shutdownOllama = useWorkbenchStore((state) => state.shutdownOllama);
  const setProjectArchiveEnabled = useWorkbenchStore((state) => state.setProjectArchiveEnabled);
  const saveProjectArchive = useWorkbenchStore((state) => state.saveProjectArchive);
  const openProjectArchive = useWorkbenchStore((state) => state.openProjectArchive);

  const [brief, setBrief] = useState('Add a safe, testable feature and have Codex review it for bugs.');
  const [workflowId, setWorkflowId] = useState(WORKFLOW_DEFINITIONS[0].id);
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:7b');

  useEffect(() => {
    void bootstrap();
    const unsubState = window.workbench.onState((nextSnapshot) => applySnapshot(nextSnapshot));
    const unsubTerminal = window.workbench.onTerminalData(({ sessionId, data }) => appendTerminalData(sessionId, data));
    return () => {
      unsubState();
      unsubTerminal();
    };
  }, [appendTerminalData, applySnapshot, bootstrap]);

  if (!snapshot) {
    return <div className="loading-screen">Booting Triad Workbench...</div>;
  }

  const latestTask = snapshot.tasks[0];
  const findings = latestTask?.findings ?? [];

  return (
    <div className="shell">
      <header className="top-bar">
        <div>
          <h1>Triad Workbench</h1>
          <p>{snapshot.project ? `${snapshot.project.name} - ${snapshot.project.currentBranch || 'no branch'}` : 'No project selected'}</p>
        </div>
        <div className="top-actions">
          <button onClick={() => void selectProject()}>Open project</button>
          <select
            value={snapshot.project?.runnerPreference ?? 'auto'}
            onChange={(event) => void setProjectRunner(event.target.value as 'auto' | 'windows' | 'wsl')}
          >
            <option value="auto">Auto runner</option>
            <option value="windows">Windows</option>
            <option value="wsl">WSL</option>
          </select>
          <button onClick={() => void probeAgents(true)}>Probe agents</button>
        </div>
      </header>

      <main className="layout">
        <aside className="left-rail">
          <section className="card">
            <h2>Workflows</h2>
            <div className="workflow-list">
              {WORKFLOW_DEFINITIONS.map((workflow) => (
                <button
                  key={workflow.id}
                  className={workflowId === workflow.id ? 'selected' : ''}
                  onClick={() => setWorkflowId(workflow.id)}
                >
                  <strong>{workflow.label}</strong>
                  <span>{workflow.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Tasks</h2>
            {snapshot.tasks.length ? (
              snapshot.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={() => selectTask(task.id)}
                  onPromote={(action) => void promoteTask(task.id, action)}
                />
              ))
            ) : (
              <p className="empty-state">No tasks yet.</p>
            )}
          </section>
        </aside>

        <section className="center-grid">
          {(Object.values(snapshot.agents) as AgentProfile[]).map((agent) => (
            <AgentPanel key={agent.id} agent={agent} />
          ))}
        </section>

        <aside className="right-rail">
          <section className="card">
            <h2>Findings</h2>
            {findings.length ? (
              findings.map((finding, index) => (
                <article key={`${finding.sourceAgent}-${index}`} className={`finding finding-${finding.severity}`}>
                  <h4>{finding.title}</h4>
                  <p>{finding.body}</p>
                  <span>{finding.sourceAgent}</span>
                </article>
              ))
            ) : (
              <p className="empty-state">No findings yet.</p>
            )}
          </section>

          <section className="card">
            <h2>Ollama</h2>
            <p>{snapshot.ollama.message || 'Ollama is idle.'}</p>
            <input value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)} placeholder="Model name" />
            <button onClick={() => void setOllamaRole('monitor', ollamaModel)}>Start monitor</button>
            <button onClick={() => void shutdownOllama()}>Turn off Ollama</button>
          </section>

          <section className="card">
            <h2>Project Archive</h2>
            {snapshot.project ? (
              <>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={snapshot.project.archiveEnabled}
                    onChange={(event) => void setProjectArchiveEnabled(event.target.checked)}
                  />
                  <span>Auto-save every prompt, log, task, transcript, and artifact for this project.</span>
                </label>
                <div className="archive-path">
                  <strong>Folder</strong>
                  <code>{snapshot.archive?.path || snapshot.project.archivePath}</code>
                </div>
                <p className="panel-message">
                  Triad stores snapshots, task JSON, prompts, stdout, stderr, diffs, and terminal transcripts inside this project folder.
                </p>
                <p className="archive-meta">
                  {snapshot.archive?.lastSavedAt
                    ? `Last saved ${new Date(snapshot.archive.lastSavedAt).toLocaleString()}`
                    : 'No archive snapshot has been saved yet.'}
                </p>
                <div className="panel-actions">
                  <button onClick={() => void saveProjectArchive()} disabled={!snapshot.project.archiveEnabled}>
                    Save now
                  </button>
                  <button onClick={() => void openProjectArchive()}>Open folder</button>
                </div>
              </>
            ) : (
              <p className="empty-state">Select a project to create its archive folder.</p>
            )}
          </section>

          <section className="card">
            <h2>Notifications</h2>
            {snapshot.notifications.length ? (
              snapshot.notifications.map((notification) => <p key={notification}>{notification}</p>)
            ) : (
              <p className="empty-state">No notifications yet.</p>
            )}
          </section>
        </aside>
      </main>

      <footer className="bottom-dock">
        <div className="composer">
          <div className="composer-header">
            <span>{WORKFLOW_DEFINITIONS.find((workflow) => workflow.id === workflowId)?.label}</span>
            {isBusy ? <span className="busy-indicator">Working...</span> : null}
          </div>
          <textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Describe the task for your agents." />
          <div className="composer-actions">
            <button
              onClick={() =>
                void startWorkflow({
                  brief,
                  workflowId
                })
              }
            >
              Run workflow
            </button>
          </div>
          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </footer>
    </div>
  );
}
