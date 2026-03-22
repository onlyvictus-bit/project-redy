import { useEffect, useState } from 'react';

import type { AgentProfile, CustomWorkflow, WorkflowDefinition } from '@shared/types';
import { WORKFLOW_DEFINITIONS } from '@shared/workflows';
import { WorkflowBuilder } from './components/WorkflowBuilder';

import { AgentPanel } from './components/AgentPanel';
import { ArchiveBrowser } from './components/ArchiveBrowser';
import { FindingsPanel } from './components/FindingsPanel';
import { SetupBanner } from './components/SetupBanner';
import { TaskCard } from './components/TaskCard';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { TerminalOverlay } from './components/TerminalOverlay';
import { useWorkbenchStore } from './store';

import './styles.css';

export default function App() {
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const error = useWorkbenchStore((state) => state.error);
  const isBusy = useWorkbenchStore((state) => state.isBusy);
  const selectedTaskId = useWorkbenchStore((state) => state.selectedTaskId);
  const bootstrap = useWorkbenchStore((state) => state.bootstrap);
  const applySnapshot = useWorkbenchStore((state) => state.applySnapshot);
  const appendTerminalData = useWorkbenchStore((state) => state.appendTerminalData);
  const selectProject = useWorkbenchStore((state) => state.selectProject);
  const probeAgents = useWorkbenchStore((state) => state.probeAgents);
  const setProjectRunner = useWorkbenchStore((state) => state.setProjectRunner);
  const startWorkflow = useWorkbenchStore((state) => state.startWorkflow);
  const cancelWorkflow = useWorkbenchStore((state) => state.cancelWorkflow);
  const promoteTask = useWorkbenchStore((state) => state.promoteTask);
  const selectTask = useWorkbenchStore((state) => state.selectTask);
  const setProjectArchiveEnabled = useWorkbenchStore((state) => state.setProjectArchiveEnabled);
  const saveProjectArchive = useWorkbenchStore((state) => state.saveProjectArchive);
  const openProjectArchive = useWorkbenchStore((state) => state.openProjectArchive);
  const setOllamaRole = useWorkbenchStore((state) => state.setOllamaRole);
  const customWorkflows = useWorkbenchStore((state) => state.customWorkflows);
  const saveCustomWorkflow = useWorkbenchStore((state) => state.saveCustomWorkflow);
  const deleteCustomWorkflow = useWorkbenchStore((state) => state.deleteCustomWorkflow);

  const [brief, setBrief] = useState('Add a safe, testable feature and have Codex review it for bugs.');
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOW_DEFINITIONS[0].id);
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:7b');
  const [showArchiveBrowser, setShowArchiveBrowser] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<CustomWorkflow | undefined>();


  // Keep ollamaModel in sync with the discovered model list.
  // When availableModels arrives and the current value is not in the list,
  // reset to the first discovered model so Start monitor submits a valid name.
  useEffect(() => {
    const models = snapshot?.ollama.availableModels;
    if (models && models.length > 0 && !models.includes(ollamaModel)) {
      setOllamaModel(models[0]);
    }
  }, [snapshot?.ollama.availableModels, ollamaModel]);

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
    return (
      <div className="loading-screen">
        {error ? <p className="error-banner">{error}</p> : <p>Booting Triad Workbench...</p>}
      </div>
    );
  }

  const selectedTask = snapshot.tasks.find((t) => t.id === selectedTaskId) ?? snapshot.tasks[0];
  const runnerValue = snapshot.project?.runnerPreference ?? snapshot.agents.claude.runner ?? 'auto';

  // Per-workflow readiness: checks the agents actually needed plus git repo requirement.
  const canRun = (() => {
    if (!snapshot.project?.isGitRepo) return false;
    const { agents, ollama } = snapshot;
    const ready = (id: 'claude' | 'codex' | 'gemini') => agents[id].status === 'ready';
    // Ollama is only active when running AND not in Sleep mode.
    const ollamaActive = ollama.running && agents.ollama.role !== 'off';
    switch (workflowId) {
      case 'away-monitor': return ollamaActive;
      case 'code-review-fix-verify': return ready('claude') && ready('codex');
      case 'code-gemini-compare-codex-review': return ready('claude') && ready('gemini') && ready('codex');
      case 'architecture-compare': return ready('claude') && ready('codex') && ready('gemini') && ollamaActive;
      case 'custom':
        return Boolean(snapshot.project?.isGitRepo);
      default:
        // Check if this is a custom workflow UUID (not a built-in WorkflowId)
        if (customWorkflows.some((w) => w.id === workflowId)) {
          return Boolean(snapshot.project?.isGitRepo);
        }
        return false;
    }
  })();

  const allWorkflows: Array<WorkflowDefinition | CustomWorkflow> = [
    ...WORKFLOW_DEFINITIONS,
    ...customWorkflows
  ];

  return (
    <div className="shell">
      <header className="top-bar">
        <div>
          <h1>Triad Workbench</h1>
          <p>{snapshot.project ? `${snapshot.project.name} - ${snapshot.project.currentBranch || 'no branch'}` : 'No project selected'}</p>
        </div>
        <div className="top-actions">
          <button disabled={isBusy} onClick={() => void selectProject()}>Open project</button>
          <select
            value={runnerValue}
            disabled={isBusy}
            onChange={(event) => void setProjectRunner(event.target.value as 'auto' | 'windows' | 'wsl')}
          >
            <option value="auto">Auto runner</option>
            <option value="windows">Windows</option>
            <option value="wsl">WSL</option>
          </select>
          <button onClick={() => void probeAgents(true)}>Probe agents</button>
        </div>
      </header>

      {/* Setup banner — shown only when agents need connecting */}
      <SetupBanner
        agents={{ claude: snapshot.agents.claude, codex: snapshot.agents.codex, gemini: snapshot.agents.gemini }}
        ollama={snapshot.ollama}
      />

      <main className="layout">
        <aside className="left-rail">
          <section className="card">
            <div className="workflow-section-header">
              <h2>Workflows</h2>
              <button
                className="workflow-add-btn"
                title="Create new workflow"
                onClick={() => {
                  setEditingWorkflow(undefined);
                  setShowBuilder(true);
                }}
              >
                +
              </button>
            </div>
            <div className="workflow-list">
              {allWorkflows.map((workflow) => {
                const isCustom = 'isCustom' in workflow && workflow.isCustom;
                return (
                  <button
                    key={workflow.id}
                    className={workflowId === workflow.id ? 'selected' : ''}
                    onClick={() => setWorkflowId(workflow.id)}
                  >
                    <strong>{workflow.label}</strong>
                    <span>{workflow.description}</span>
                    {isCustom && (
                      <span className="workflow-custom-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Edit workflow"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkflow(workflow as CustomWorkflow);
                            setShowBuilder(true);
                          }}
                        >
                          edit
                        </button>
                        <button
                          title="Delete workflow"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteCustomWorkflow(workflow.id);
                            if (workflowId === workflow.id) setWorkflowId(WORKFLOW_DEFINITIONS[0].id);
                          }}
                        >
                          del
                        </button>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card">
            <h2>Tasks</h2>
            {snapshot.tasks.length ? (
              snapshot.tasks.map((task) => (
                <div key={task.id}>
                  <TaskCard
                    task={task}
                    isSelected={task.id === selectedTask?.id}
                    onSelect={() => selectTask(task.id)}
                    onPromote={(action) => void promoteTask(task.id, action)}
                  />
                  {(['code', 'review', 'fix', 'verify'] as const).includes(task.stage as 'code' | 'review' | 'fix' | 'verify') ? (
                    <button
                      disabled={isBusy}
                      onClick={() => void cancelWorkflow(task.id)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="empty-state">No tasks yet.</p>
            )}
          </section>
        </aside>

        <section className="center-area">
          {/* 2x2 agent grid — Ollama is always the 4th card */}
          <div className="center-grid">
            {(['claude', 'codex', 'gemini', 'ollama'] as const).map((id) => (
              <AgentPanel key={id} agent={snapshot.agents[id] as AgentProfile} ollamaModel={id === 'ollama' ? ollamaModel : undefined} />
            ))}
          </div>

          <TaskDetailPanel task={selectedTask} />
        </section>

        <aside className="right-rail">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              onClick={() => setShowArchiveBrowser((prev) => !prev)}
              style={{ fontSize: 12, padding: '3px 10px' }}
            >
              {showArchiveBrowser ? 'Back to overview' : 'Browse history'}
            </button>
          </div>
          {showArchiveBrowser ? (
            <ArchiveBrowser />
          ) : (
            <>
              <FindingsPanel task={selectedTask} />

              {/* Ollama model picker lives here for when Ollama is running */}
              {snapshot.ollama.running ? (
                <section className="card">
                  <h2>Ollama model</h2>
                  {snapshot.ollama.availableModels && snapshot.ollama.availableModels.length > 0 ? (
                    <select
                      value={ollamaModel}
                      onChange={(event) => {
                        const model = event.target.value;
                        setOllamaModel(model);
                        void setOllamaRole(snapshot.agents.ollama.role, model);
                      }}
                    >
                      {snapshot.ollama.availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={ollamaModel}
                      onChange={(event) => {
                        const model = event.target.value;
                        setOllamaModel(model);
                        void setOllamaRole(snapshot.agents.ollama.role, model);
                      }}
                      placeholder="Model name"
                    />
                  )}
                </section>
              ) : null}

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
                    <p className="archive-meta">
                      {snapshot.archive?.lastSavedAt
                        ? `Last saved ${new Date(snapshot.archive.lastSavedAt).toLocaleString()}`
                        : 'No archive snapshot saved yet.'}
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
            </>
          )}
        </aside>
      </main>

      <footer className="bottom-dock">
        <div className="composer">
          <div className="composer-header">
            <span>{WORKFLOW_DEFINITIONS.find((workflow) => workflow.id === workflowId)?.label ?? allWorkflows.find((w) => w.id === workflowId)?.label}</span>
            {isBusy ? <span className="busy-indicator">Working...</span> : null}
          </div>
          <textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Describe the task for your agents." />
          <div className="composer-actions">
            <button
              disabled={!canRun || isBusy}
              onClick={() => {
                const selectedWorkflow = allWorkflows.find((w) => w.id === workflowId);
                const isCustom = selectedWorkflow && 'isCustom' in selectedWorkflow && selectedWorkflow.isCustom;
                void startWorkflow({
                  brief,
                  workflowId: isCustom ? 'custom' : workflowId as import('@shared/types').WorkflowId,
                  ...(isCustom ? {
                    customWorkflowSteps: (selectedWorkflow as CustomWorkflow).steps,
                    customWorkflowId: (selectedWorkflow as CustomWorkflow).id
                  } : {})
                });
              }}
            >
              Run workflow
            </button>
          </div>
          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </footer>
      {showBuilder && (
        <WorkflowBuilder
          onClose={() => {
            setShowBuilder(false);
            setEditingWorkflow(undefined);
          }}
          onSave={(workflow) => {
            void saveCustomWorkflow(workflow).then(() => {
              setShowBuilder(false);
              setEditingWorkflow(undefined);
              setWorkflowId(workflow.id);
            });
          }}
          editWorkflow={editingWorkflow}
        />
      )}
      <TerminalOverlay />
    </div>
  );
}
