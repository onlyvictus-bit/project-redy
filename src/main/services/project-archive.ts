import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type {
  ArtifactBundle,
  ProjectArchiveSummary,
  ProjectRef,
  TaskRun,
  TerminalSession,
  WorkbenchSnapshot
} from '@shared/types';

function validateAndNormalizePath(candidatePath: string, allowedRoots: string[]): string {
  const normalized = path.resolve(candidatePath);
  const isAllowed = allowedRoots.some((root) => {
    const normalizedRoot = path.resolve(root);
    return normalized.startsWith(normalizedRoot + path.sep) || normalized === normalizedRoot;
  });
  if (!isAllowed) {
    throw new Error(`Archive path '${normalized}' is outside all allowed roots.`);
  }
  return normalized;
}

type TranscriptSource = 'agent' | 'user' | 'system';

interface TranscriptEntry {
  timestamp: string;
  source: TranscriptSource;
  agentId: string;
  chunk: string;
}

export class ProjectArchiveService {
  getArchiveSummary(project?: ProjectRef): ProjectArchiveSummary | undefined {
    if (!project) {
      return undefined;
    }

    const archivePath = this.resolveArchivePath(project);
    const snapshotPath = path.join(archivePath, 'state', 'latest-snapshot.json');
    const lastSavedAt = fs.existsSync(snapshotPath) ? fs.statSync(snapshotPath).mtime.toISOString() : undefined;

    return {
      path: archivePath,
      enabled: project.archiveEnabled,
      lastSavedAt
    };
  }

  ensureProject(project: ProjectRef): ProjectArchiveSummary {
    const archivePath = this.resolveArchivePath(project);
    fs.mkdirSync(path.join(archivePath, 'state'), { recursive: true });
    fs.mkdirSync(path.join(archivePath, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(archivePath, 'terminals'), { recursive: true });
    fs.mkdirSync(path.join(archivePath, 'events'), { recursive: true });
    this.writeJson(path.join(archivePath, 'project.json'), {
      savedAt: new Date().toISOString(),
      project
    });

    return this.getArchiveSummary(project)!;
  }

  saveSnapshot(snapshot: WorkbenchSnapshot): ProjectArchiveSummary | undefined {
    const project = snapshot.project;
    if (!project || !project.archiveEnabled) {
      return this.getArchiveSummary(project);
    }

    const archive = this.ensureProject(project);
    const stateDir = path.join(archive.path, 'state');
    const savedAt = new Date().toISOString();

    this.writeJson(path.join(stateDir, 'latest-snapshot.json'), {
      savedAt,
      snapshot
    });
    this.writeJson(path.join(stateDir, 'agents.json'), {
      savedAt,
      agents: snapshot.agents
    });
    this.writeJson(path.join(stateDir, 'notifications.json'), {
      savedAt,
      notifications: snapshot.notifications
    });
    this.appendEvent(project, 'snapshot-saved', {
      savedAt,
      taskCount: snapshot.tasks.length,
      terminalCount: snapshot.terminals.length
    });

    return this.getArchiveSummary(project);
  }

  saveTask(project: ProjectRef, task: TaskRun): void {
    if (!project.archiveEnabled) {
      return;
    }

    const archive = this.ensureProject(project);
    const taskDir = path.join(archive.path, 'tasks', task.id);
    const artifactDir = path.join(taskDir, 'artifacts');
    fs.mkdirSync(artifactDir, { recursive: true });

    this.writeJson(path.join(taskDir, 'task.json'), task);
    for (const artifact of task.artifacts) {
      this.saveArtifact(taskDir, artifact);
    }
  }

  saveTerminalSession(project: ProjectRef, session: TerminalSession): void {
    if (!project.archiveEnabled) {
      return;
    }

    const archive = this.ensureProject(project);
    const sessionDir = path.join(archive.path, 'terminals', session.id);
    fs.mkdirSync(sessionDir, { recursive: true });
    this.writeJson(path.join(sessionDir, 'session.json'), session);
    this.appendEvent(project, 'terminal-started', session);
  }

  appendTerminalChunk(project: ProjectRef, session: TerminalSession, chunk: string, source: TranscriptSource): void {
    if (!project.archiveEnabled) {
      return;
    }

    const archive = this.ensureProject(project);
    const sessionDir = path.join(archive.path, 'terminals', session.id);
    fs.mkdirSync(sessionDir, { recursive: true });

    const timestamp = new Date().toISOString();
    const entry: TranscriptEntry = {
      timestamp,
      source,
      agentId: session.agentId,
      chunk
    };

    const transcriptLine = `[${timestamp}] [${source}] ${chunk}`;
    fs.appendFileSync(path.join(sessionDir, 'transcript.log'), `${transcriptLine}\n`, 'utf8');
    fs.appendFileSync(path.join(sessionDir, 'transcript.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
  }

  appendEvent(project: ProjectRef, type: string, payload: unknown): void {
    if (!project.archiveEnabled) {
      return;
    }

    const archive = this.ensureProject(project);
    fs.appendFileSync(
      path.join(archive.path, 'events', 'events.jsonl'),
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        type,
        payload
      })}\n`,
      'utf8'
    );
  }

  private saveArtifact(taskDir: string, artifact: ArtifactBundle): void {
    const artifactDir = path.join(taskDir, 'artifacts');
    this.writeJson(path.join(artifactDir, `${artifact.id}.json`), artifact);
    fs.writeFileSync(path.join(artifactDir, `${artifact.id}.prompt.txt`), artifact.prompt, 'utf8');
    fs.writeFileSync(path.join(artifactDir, `${artifact.id}.stdout.log`), artifact.stdout, 'utf8');
    fs.writeFileSync(path.join(artifactDir, `${artifact.id}.stderr.log`), artifact.stderr, 'utf8');
    if (artifact.patch) {
      fs.writeFileSync(path.join(artifactDir, `${artifact.id}.patch.diff`), artifact.patch, 'utf8');
    }
  }

  private resolveArchivePath(project: ProjectRef): string {
    const allowedRoots = [
      path.resolve(project.rootPath),
      path.resolve(os.homedir()),
      path.resolve(os.tmpdir())
    ];
    return validateAndNormalizePath(project.archivePath, allowedRoots);
  }

  private writeJson(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  }
}
