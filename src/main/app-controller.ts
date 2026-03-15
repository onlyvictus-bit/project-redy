import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { app, dialog, shell } from 'electron';

import {
  DEFAULT_AGENTS,
  type AgentId,
  type AgentRole,
  type ContinueTaskOptions,
  type PromotionAction,
  type ProjectRef,
  type RunnerKind,
  type StartWorkflowInput,
  type WorkbenchSnapshot
} from '@shared/types';

import { createConnector } from './connectors';
import type { AgentConnector } from './connectors/base';
import { OllamaManager } from './services/ollama-manager';
import { PersistenceService } from './services/persistence';
import { ProcessRunner } from './services/process-runner';
import { ProjectArchiveService } from './services/project-archive';
import { TerminalManager } from './services/terminal-manager';
import { WorkflowEngine } from './services/workflow-engine';
import { WorkspaceManager } from './services/workspace-manager';

export class AppController extends EventEmitter {
  private readonly processRunner = new ProcessRunner();
  private readonly persistence = new PersistenceService(app.getPath('userData'));
  private readonly ollamaManager = new OllamaManager(this.processRunner);
  private readonly projectArchive = new ProjectArchiveService();
  private readonly workspaceManager = new WorkspaceManager(this.processRunner, path.join(app.getPath('userData'), 'worktrees'));
  private readonly connectors: Record<AgentId, AgentConnector>;
  private readonly terminalManager = new TerminalManager(this.processRunner);
  private readonly workflowEngine: WorkflowEngine;
  private snapshot: WorkbenchSnapshot;
  private readonly activeContinuations = new Set<string>();

  constructor() {
    super();

    const persistedProfiles = this.persistence.loadAgentProfiles();
    const mergedAgents = { ...DEFAULT_AGENTS };
    for (const profile of persistedProfiles) {
      mergedAgents[profile.id] = profile;
    }

    this.connectors = {
      claude: createConnector({ ...mergedAgents.claude }, this.processRunner, this.ollamaManager),
      codex: createConnector({ ...mergedAgents.codex }, this.processRunner, this.ollamaManager),
      gemini: createConnector({ ...mergedAgents.gemini }, this.processRunner, this.ollamaManager),
      ollama: createConnector({ ...mergedAgents.ollama }, this.processRunner, this.ollamaManager)
    };

    const project = this.persistence.loadLatestProject();
    this.snapshot = {
      project,
      agents: {
        claude: this.connectors.claude.profile,
        codex: this.connectors.codex.profile,
        gemini: this.connectors.gemini.profile,
        ollama: this.connectors.ollama.profile
      },
      tasks: project ? this.persistence.loadTasks(project.id) : [],
      activeWorkflowId: 'code-review-fix-verify',
      terminals: [],
      ollama: this.ollamaManager.getStatus(),
      archive: this.projectArchive.getArchiveSummary(project),
      notifications: []
    };

    this.workflowEngine = new WorkflowEngine(this.workspaceManager, () => this.connectors);

    this.terminalManager.on('data', (payload) => {
      const project = this.snapshot.project;
      const session = this.terminalManager.getSession(payload.sessionId);
      if (project && session) {
        this.projectArchive.appendTerminalChunk(project, session, payload.data, 'agent');
      }
      this.emit('terminal-data', payload);
    });
  }

  async bootstrap(): Promise<WorkbenchSnapshot> {
    await this.probeAgents();
    return this.snapshot;
  }

  async selectProject(): Promise<ProjectRef | undefined> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (result.canceled || !result.filePaths.length) {
      return this.snapshot.project;
    }

    const runnerPreference = this.snapshot.project?.runnerPreference ?? 'auto';
    const project = await this.workspaceManager.inspectProject(result.filePaths[0], runnerPreference);
    this.snapshot.project = project;
    this.snapshot.tasks = this.persistence.loadTasks(project.id);
    this.persistence.saveProject(project);
    this.snapshot.archive = project.archiveEnabled
      ? this.projectArchive.ensureProject(project)
      : this.projectArchive.getArchiveSummary(project);
    this.pushNotification(project.isGitRepo ? `Loaded ${project.name}.` : `${project.name} is not a git repository yet.`);
    this.emitState();
    return project;
  }

  async probeAgents(deep = false): Promise<WorkbenchSnapshot> {
    for (const connector of Object.values(this.connectors)) {
      const result = await connector.probe(deep);
      this.snapshot.agents[result.profile.id] = result.profile;
      this.persistence.saveAgentProfile(result.profile);
    }
    this.snapshot.ollama = await this.ollamaManager.probe();
    this.emitState();
    return this.snapshot;
  }

  async setProjectRunner(runnerPreference: RunnerKind | 'auto'): Promise<WorkbenchSnapshot> {
    if (!this.snapshot.project) {
      throw new Error('Select a project before choosing a runner.');
    }

    this.snapshot.project = {
      ...this.snapshot.project,
      runnerPreference
    };

    for (const connector of Object.values(this.connectors)) {
      if (connector.profile.id !== 'ollama') {
        connector.profile.runner = runnerPreference === 'auto' ? 'windows' : runnerPreference;
        this.persistence.saveAgentProfile(connector.profile);
      }
    }

    this.persistence.saveProject(this.snapshot.project);
    this.emitState();
    return this.snapshot;
  }

  async setAgentRole(agentId: AgentId, role: AgentRole): Promise<WorkbenchSnapshot> {
    this.connectors[agentId].setRole(role);
    this.persistence.saveAgentProfile(this.connectors[agentId].profile);

    if (agentId === 'ollama') {
      this.snapshot.ollama = await this.ollamaManager.setRole(role);
    }

    this.snapshot.agents[agentId] = this.connectors[agentId].profile;
    this.emitState();
    return this.snapshot;
  }

  startTerminal(agentId: AgentId) {
    const projectPath = this.snapshot.project?.rootPath ?? process.cwd();
    const session = this.terminalManager.start(agentId, this.connectors[agentId], projectPath);
    if (this.snapshot.project) {
      this.projectArchive.saveTerminalSession(this.snapshot.project, session);
    }
    this.snapshot.terminals = this.terminalManager.list();
    this.emitState();
    return session;
  }

  stopTerminal(sessionId: string): void {
    this.terminalManager.stop(sessionId);
    this.snapshot.terminals = this.terminalManager.list();
    this.emitState();
  }

  sendTerminalInput(sessionId: string, input: string): void {
    const project = this.snapshot.project;
    const session = this.terminalManager.getSession(sessionId);
    if (project && session) {
      this.projectArchive.appendTerminalChunk(project, session, input, 'user');
    }
    this.terminalManager.write(sessionId, input);
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    this.terminalManager.resize(sessionId, cols, rows);
  }

  async startWorkflow(input: StartWorkflowInput): Promise<WorkbenchSnapshot> {
    if (!this.snapshot.project?.isGitRepo) {
      throw new Error('Select a git-backed project before starting a workflow.');
    }

    const task = await this.workflowEngine.start(
      this.snapshot.project,
      input,
      (nextTask) => {
        this.upsertTask(nextTask);
      },
      (artifact) => {
        this.persistence.appendArtifact(artifact);
      }
    );

    this.upsertTask(task);
    this.projectArchive.appendEvent(this.snapshot.project, 'workflow-finished', {
      taskId: task.id,
      workflowId: task.workflowId,
      stage: task.stage
    });
    this.emitState();
    return this.snapshot;
  }

  async continueTask(taskId: string, options: ContinueTaskOptions): Promise<WorkbenchSnapshot> {
    const task = this.snapshot.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('Task not found.');
    }
    if (!this.snapshot.project?.isGitRepo) {
      throw new Error('Select a git-backed project before continuing a task.');
    }
    if (this.activeContinuations.has(taskId)) {
      throw new Error('Task is already being continued. Wait for the current step to finish.');
    }

    this.activeContinuations.add(taskId);
    try {
      if (!fs.existsSync(task.worktreePath)) {
        throw new Error('Task worktree no longer exists. Cannot continue.');
      }

      const updatedTask = await this.workflowEngine.continue(
        this.snapshot.project,
        task,
        options,
        (nextTask) => {
          this.upsertTask(nextTask);
        },
        (artifact) => {
          this.persistence.appendArtifact(artifact);
        }
      );

      this.upsertTask(updatedTask);
      this.projectArchive.appendEvent(this.snapshot.project, 'task-continued', {
        taskId: updatedTask.id,
        mode: options.mode,
        stage: updatedTask.stage
      });
      this.emitState();
      return this.snapshot;
    } finally {
      this.activeContinuations.delete(taskId);
    }
  }

  async promoteTask(taskId: string, action: PromotionAction): Promise<WorkbenchSnapshot> {
    const task = this.snapshot.tasks.find((candidate) => candidate.id === taskId);
    const project = this.snapshot.project;
    if (!task || !project) {
      throw new Error('Task or project not found.');
    }

    await this.workspaceManager.promoteTask(task, project, action);
    task.approvalState = 'approved';
    task.stage = 'done';
    task.updatedAt = new Date().toISOString();
    this.upsertTask(task);
    this.projectArchive.appendEvent(project, 'task-promoted', {
      taskId: task.id,
      action
    });
    this.pushNotification(`Task ${task.id.slice(0, 8)} promoted via ${action}.`);
    this.emitState();
    return this.snapshot;
  }

  async setOllamaRole(role: AgentRole, model?: string): Promise<WorkbenchSnapshot> {
    this.snapshot.ollama = await this.ollamaManager.setRole(role, model);
    this.connectors.ollama.profile.role = role;
    this.snapshot.agents.ollama = this.connectors.ollama.profile;
    this.persistence.saveAgentProfile(this.snapshot.agents.ollama);
    this.emitState();
    return this.snapshot;
  }

  async shutdownOllama(): Promise<WorkbenchSnapshot> {
    this.snapshot.ollama = await this.ollamaManager.shutdownIfManaged();
    this.emitState();
    return this.snapshot;
  }

  async setProjectArchiveEnabled(enabled: boolean): Promise<WorkbenchSnapshot> {
    if (!this.snapshot.project) {
      throw new Error('Select a project before changing archive settings.');
    }

    this.snapshot.project = {
      ...this.snapshot.project,
      archiveEnabled: enabled
    };
    this.persistence.saveProject(this.snapshot.project);
    this.snapshot.archive = enabled
      ? this.projectArchive.ensureProject(this.snapshot.project)
      : this.projectArchive.getArchiveSummary(this.snapshot.project);
    this.pushNotification(enabled ? 'Project archive enabled.' : 'Project archive disabled.');
    this.emitState();
    return this.snapshot;
  }

  async saveProjectArchive() {
    if (!this.snapshot.project) {
      return undefined;
    }

    const archive = this.projectArchive.saveSnapshot(this.snapshot);
    this.snapshot.archive = archive;
    if (archive) {
      this.pushNotification(`Saved project archive to ${archive.path}.`);
    }
    this.emit('state', this.snapshot);
    return archive;
  }

  async openProjectArchive() {
    const project = this.snapshot.project;
    if (!project) {
      return undefined;
    }

    const archive = project.archiveEnabled
      ? this.projectArchive.ensureProject(project)
      : this.projectArchive.getArchiveSummary(project);
    if (archive) {
      const result = await shell.openPath(archive.path);
      if (result) {
        throw new Error(result);
      }
    }
    this.snapshot.archive = archive;
    this.emit('state', this.snapshot);
    return archive;
  }

  private upsertTask(task: WorkbenchSnapshot['tasks'][number]): void {
    const existingIndex = this.snapshot.tasks.findIndex((candidate) => candidate.id === task.id);
    if (existingIndex >= 0) {
      this.snapshot.tasks[existingIndex] = task;
    } else {
      this.snapshot.tasks.unshift(task);
    }
    this.persistence.saveTask(task);
    if (this.snapshot.project) {
      this.projectArchive.saveTask(this.snapshot.project, task);
    }
  }

  private pushNotification(message: string): void {
    this.snapshot.notifications = [message, ...this.snapshot.notifications].slice(0, 20);
  }

  private emitState(): void {
    this.snapshot.archive = this.snapshot.project?.archiveEnabled
      ? this.projectArchive.saveSnapshot(this.snapshot)
      : this.projectArchive.getArchiveSummary(this.snapshot.project);
    this.emit('state', this.snapshot);
  }
}
