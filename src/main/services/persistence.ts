import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import Database from 'better-sqlite3';

import type { AgentProfile, ArtifactBundle, ProjectRef, TaskRun } from '@shared/types';

export class PersistenceService {
  private db: Database.Database;

  constructor(private readonly userDataPath: string) {
    fs.mkdirSync(userDataPath, { recursive: true });
    this.db = new Database(path.join(userDataPath, 'triad-workbench.db'));
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  loadLatestProject(): ProjectRef | undefined {
    const row = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 1').get() as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      return undefined;
    }

    return {
      id: String(row.id),
      name: String(row.name),
      rootPath: String(row.root_path),
      wslPath: row.wsl_path ? String(row.wsl_path) : undefined,
      runnerPreference: row.runner_preference as ProjectRef['runnerPreference'],
      resolvedRunner: row.resolved_runner ? (String(row.resolved_runner) as ProjectRef['resolvedRunner']) : undefined,
      isGitRepo: Boolean(row.is_git_repo),
      currentBranch: row.current_branch ? String(row.current_branch) : undefined,
      archivePath: row.archive_path ? String(row.archive_path) : path.join(String(row.root_path), '.triad-workbench'),
      archiveEnabled: row.archive_enabled === undefined ? true : Boolean(row.archive_enabled)
    };
  }

  saveProject(project: ProjectRef): void {
    this.db
      .prepare(
        `INSERT INTO projects (
           id,
           name,
           root_path,
           wsl_path,
           runner_preference,
           resolved_runner,
           is_git_repo,
           current_branch,
           archive_path,
           archive_enabled,
           updated_at
         )
         VALUES (
           @id,
           @name,
           @rootPath,
           @wslPath,
           @runnerPreference,
           @resolvedRunner,
           @isGitRepo,
           @currentBranch,
           @archivePath,
           @archiveEnabled,
           CURRENT_TIMESTAMP
         )
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           root_path = excluded.root_path,
           wsl_path = excluded.wsl_path,
           runner_preference = excluded.runner_preference,
           resolved_runner = excluded.resolved_runner,
           is_git_repo = excluded.is_git_repo,
           current_branch = excluded.current_branch,
           archive_path = excluded.archive_path,
           archive_enabled = excluded.archive_enabled,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run({
        id: project.id,
        name: project.name,
        rootPath: project.rootPath,
        wslPath: project.wslPath ?? null,
        runnerPreference: project.runnerPreference,
        resolvedRunner: project.resolvedRunner ?? null,
        isGitRepo: project.isGitRepo ? 1 : 0,
        currentBranch: project.currentBranch ?? null,
        archivePath: project.archivePath,
        archiveEnabled: project.archiveEnabled ? 1 : 0
      });
  }

  loadAgentProfiles(): AgentProfile[] {
    const rows = this.db.prepare('SELECT profile_json FROM agent_profiles').all() as Array<{ profile_json: string }>;
    return rows.map((row) => JSON.parse(row.profile_json) as AgentProfile);
  }

  saveAgentProfile(profile: AgentProfile): void {
    this.db
      .prepare(
        `INSERT INTO agent_profiles (id, profile_json, updated_at)
         VALUES (@id, @profile, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           profile_json = excluded.profile_json,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run({
        id: profile.id,
        profile: JSON.stringify(profile)
      });
  }

  loadTasks(projectId: string): TaskRun[] {
    const rows = this.db
      .prepare('SELECT task_json FROM task_runs WHERE project_id = ? ORDER BY updated_at DESC')
      .all(projectId) as Array<{ task_json: string }>;
    return rows.map((row) => JSON.parse(row.task_json) as TaskRun);
  }

  saveTask(task: TaskRun): void {
    this.db
      .prepare(
        `INSERT INTO task_runs (id, project_id, stage, worktree_status, workflow_id, task_json, updated_at)
         VALUES (@id, @projectId, @stage, @worktreeStatus, @workflowId, @taskJson, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           stage = excluded.stage,
           worktree_status = excluded.worktree_status,
           workflow_id = excluded.workflow_id,
           task_json = excluded.task_json,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run({
        id: task.id,
        projectId: task.projectId,
        stage: task.stage,
        worktreeStatus: task.worktreeStatus ?? null,
        workflowId: task.workflowId,
        taskJson: JSON.stringify(task)
      });
  }

  appendArtifact(artifact: ArtifactBundle): void {
    this.db
      .prepare(
        `INSERT INTO artifacts (id, task_id, step_id, agent_id, artifact_json, created_at)
         VALUES (@id, @taskId, @stepId, @agentId, @artifactJson, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           artifact_json = excluded.artifact_json`
      )
      .run({
        id: artifact.id,
        taskId: artifact.taskId,
        stepId: artifact.stepId,
        agentId: artifact.agentId,
        artifactJson: JSON.stringify(artifact)
      });
  }

  appendRunEvent(taskId: string, eventType: string, payload: Record<string, unknown>): void {
    this.db.prepare(`
      INSERT INTO run_events (id, task_id, event_type, payload_json, recorded_at)
      VALUES (@id, @taskId, @eventType, @payload, CURRENT_TIMESTAMP)
    `).run({
      id: randomUUID(),
      taskId,
      eventType,
      payload: JSON.stringify(payload)
    });
  }

  loadRunEvents(taskId: string): Array<{ eventType: string; payload: Record<string, unknown>; recordedAt: string }> {
    const rows = this.db.prepare(
      'SELECT event_type, payload_json, recorded_at FROM run_events WHERE task_id = ? ORDER BY recorded_at ASC'
    ).all(taskId) as Array<{ event_type: string; payload_json: string; recorded_at: string }>;
    return rows.map((row) => ({
      eventType: row.event_type,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      recordedAt: row.recorded_at
    }));
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        wsl_path TEXT,
        runner_preference TEXT NOT NULL,
        is_git_repo INTEGER NOT NULL DEFAULT 0,
        current_branch TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agent_profiles (
        id TEXT PRIMARY KEY,
        profile_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        task_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        artifact_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS run_events (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS run_events_task_id ON run_events(task_id);
    `);

    this.ensureColumn('projects', 'archive_path', 'ALTER TABLE projects ADD COLUMN archive_path TEXT');
    this.ensureColumn('projects', 'archive_enabled', 'ALTER TABLE projects ADD COLUMN archive_enabled INTEGER NOT NULL DEFAULT 1');
    this.ensureColumn('projects', 'resolved_runner', 'ALTER TABLE projects ADD COLUMN resolved_runner TEXT');
    this.ensureColumn('task_runs', 'worktree_status', 'ALTER TABLE task_runs ADD COLUMN worktree_status TEXT');
  }

  private ensureColumn(tableName: string, columnName: string, alterSql: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === columnName)) {
      this.db.exec(alterSql);
    }
  }
}
