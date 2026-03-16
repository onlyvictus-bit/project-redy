/**
 * Browser-only mock for window.workbench.
 * Loaded only when the app runs outside Electron (e.g. Vite dev preview).
 * Provides realistic sample data so all Phase 2 components render.
 */
import type { WorkbenchApi } from '@shared/ipc';
import type { WorkbenchSnapshot } from '@shared/types';
import { DEFAULT_AGENTS } from '@shared/types';

const MOCK_SNAPSHOT: WorkbenchSnapshot = {
  project: {
    id: 'proj-001',
    name: 'my-awesome-app',
    rootPath: '/home/dev/my-awesome-app',
    runnerPreference: 'auto',
    isGitRepo: true,
    currentBranch: 'feat/login-system',
    archivePath: '/home/dev/my-awesome-app/.triad-workbench',
    archiveEnabled: true
  },
  agents: {
    claude: { ...DEFAULT_AGENTS.claude, status: 'ready', version: '1.0.23', message: 'Claude Code is ready. Authenticated via native login.' },
    codex: { ...DEFAULT_AGENTS.codex, status: 'ready', version: '0.1.4', message: 'Codex CLI is ready. OpenAI key configured.' },
    gemini: { ...DEFAULT_AGENTS.gemini, status: 'installed', version: '0.5.0', message: 'Gemini CLI installed. Needs login.' },
    ollama: { ...DEFAULT_AGENTS.ollama, status: 'ready', message: 'Ollama running on localhost:11434 with qwen2.5-coder:7b.' }
  },
  tasks: [
    {
      id: 'task-abc-001',
      projectId: 'proj-001',
      workflowId: 'code-review-fix-verify',
      workflowMode: 'orchestrate',
      baseBranch: 'main',
      baseCommit: 'a1b2c3d',
      worktreePath: '/tmp/triad/task-abc-001',
      stage: 'findings',
      brief: 'Add user authentication with JWT tokens and bcrypt password hashing',
      assignedAgents: ['claude', 'codex'],
      approvalState: 'pending',
      branchName: 'triad/task-abc-001',
      summary: 'Claude implemented JWT auth with login/register endpoints. Codex found 3 issues during review.',
      findings: [
        {
          severity: 'high',
          title: 'JWT secret hardcoded in source',
          body: 'The JWT_SECRET is hardcoded as "mysecret123" in auth.ts:15. This must be loaded from environment variables.',
          file: 'src/auth/jwt.ts',
          line: 15,
          sourceAgent: 'codex',
          evidence: 'const JWT_SECRET = "mysecret123";',
          recommendedAction: 'Move to process.env.JWT_SECRET with validation on startup.'
        },
        {
          severity: 'medium',
          title: 'Missing rate limiting on login endpoint',
          body: 'The /api/login endpoint has no rate limiting, making it vulnerable to brute force attacks.',
          file: 'src/routes/auth.ts',
          line: 42,
          sourceAgent: 'codex',
          recommendedAction: 'Add express-rate-limit middleware with max 5 attempts per 15 minutes.'
        },
        {
          severity: 'low',
          title: 'Password validation too lenient',
          body: 'Minimum password length is 4 characters. OWASP recommends at least 8.',
          file: 'src/auth/validation.ts',
          line: 8,
          sourceAgent: 'codex',
          recommendedAction: 'Increase minimum length to 8 and require mixed case + number.'
        }
      ],
      artifacts: [
        {
          id: 'art-001',
          taskId: 'task-abc-001',
          stepId: 'step-code',
          agentId: 'claude',
          role: 'coder',
          prompt: 'Implement user authentication with JWT tokens and bcrypt password hashing.\n\nRequirements:\n1. POST /api/register - create new user\n2. POST /api/login - authenticate and return JWT\n3. GET /api/me - return current user (protected)\n4. Use bcrypt for password hashing\n5. Use jsonwebtoken for JWT',
          stdout: 'Created src/auth/jwt.ts\nCreated src/auth/validation.ts\nCreated src/routes/auth.ts\nCreated src/middleware/requireAuth.ts\nUpdated src/app.ts\n\nAll files written successfully.',
          stderr: '',
          exitCode: 0,
          structuredEvents: [],
          summary: 'Implemented JWT authentication: register, login, and protected /me endpoint with bcrypt hashing.',
          finalMessage: 'Authentication system is complete. 4 new files created, 1 file updated.',
          patch: `diff --git a/src/auth/jwt.ts b/src/auth/jwt.ts
new file mode 100644
--- /dev/null
+++ b/src/auth/jwt.ts
@@ -0,0 +1,18 @@
+import jwt from 'jsonwebtoken';
+
+const JWT_SECRET = "mysecret123";
+const JWT_EXPIRY = '24h';
+
+export function signToken(userId: string): string {
+  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
+}
+
+export function verifyToken(token: string): { sub: string } {
+  return jwt.verify(token, JWT_SECRET) as { sub: string };
+}
diff --git a/src/routes/auth.ts b/src/routes/auth.ts
new file mode 100644
--- /dev/null
+++ b/src/routes/auth.ts
@@ -0,0 +1,35 @@
+import { Router } from 'express';
+import bcrypt from 'bcrypt';
+import { signToken } from '../auth/jwt';
+
+const router = Router();
+
+router.post('/register', async (req, res) => {
+  const { email, password } = req.body;
+  const hash = await bcrypt.hash(password, 10);
+  // save user...
+  res.json({ ok: true });
+});
+
+router.post('/login', async (req, res) => {
+  const { email, password } = req.body;
+  // find user, verify password...
+  const token = signToken(email);
+  res.json({ token });
+});`,
          findings: [],
          commandRuns: [
            { command: 'npm test', exitCode: 0, stdout: 'Tests: 12 passed, 12 total', stderr: '' },
            { command: 'npx tsc --noEmit', exitCode: 0, stdout: '', stderr: '' }
          ],
          createdAt: new Date(Date.now() - 600000).toISOString()
        },
        {
          id: 'art-002',
          taskId: 'task-abc-001',
          stepId: 'step-review',
          agentId: 'codex',
          role: 'reviewer',
          prompt: 'Review the authentication implementation for security issues, bugs, and best practices.',
          stdout: 'Reviewing src/auth/jwt.ts...\nReviewing src/routes/auth.ts...\nReviewing src/auth/validation.ts...\n\nFound 3 issues.',
          stderr: '',
          exitCode: 0,
          structuredEvents: [],
          summary: 'Found 3 issues: 1 high (hardcoded secret), 1 medium (no rate limiting), 1 low (weak password policy).',
          finalMessage: 'Review complete. 3 findings reported.',
          findings: [
            {
              severity: 'high',
              title: 'JWT secret hardcoded in source',
              body: 'The JWT_SECRET is hardcoded as "mysecret123" in auth.ts:15.',
              file: 'src/auth/jwt.ts',
              line: 15,
              sourceAgent: 'codex'
            },
            {
              severity: 'medium',
              title: 'Missing rate limiting on login endpoint',
              body: 'The /api/login endpoint has no rate limiting.',
              file: 'src/routes/auth.ts',
              line: 42,
              sourceAgent: 'codex'
            },
            {
              severity: 'low',
              title: 'Password validation too lenient',
              body: 'Minimum password length is 4 characters.',
              file: 'src/auth/validation.ts',
              line: 8,
              sourceAgent: 'codex'
            }
          ],
          commandRuns: [],
          createdAt: new Date(Date.now() - 300000).toISOString()
        }
      ],
      steps: [
        { id: 'step-brief', stage: 'brief', agentId: 'claude', startedAt: new Date(Date.now() - 900000).toISOString(), completedAt: new Date(Date.now() - 890000).toISOString(), status: 'completed', summary: 'Task brief accepted.' },
        { id: 'step-code', stage: 'code', agentId: 'claude', startedAt: new Date(Date.now() - 890000).toISOString(), completedAt: new Date(Date.now() - 600000).toISOString(), status: 'completed', summary: 'Implemented JWT auth with 4 new files.' },
        { id: 'step-review', stage: 'review', agentId: 'codex', startedAt: new Date(Date.now() - 600000).toISOString(), completedAt: new Date(Date.now() - 300000).toISOString(), status: 'completed', summary: 'Found 3 issues during security review.' },
        { id: 'step-findings', stage: 'findings', agentId: 'codex', startedAt: new Date(Date.now() - 300000).toISOString(), status: 'running', summary: 'Awaiting user decision on findings.' }
      ],
      createdAt: new Date(Date.now() - 900000).toISOString(),
      updatedAt: new Date(Date.now() - 300000).toISOString()
    },
    {
      id: 'task-def-002',
      projectId: 'proj-001',
      workflowId: 'code-review-fix-verify',
      workflowMode: 'orchestrate',
      baseBranch: 'main',
      baseCommit: 'e5f6g7h',
      worktreePath: '/tmp/triad/task-def-002',
      stage: 'promote',
      brief: 'Add database migration system with up/down support',
      assignedAgents: ['claude', 'codex'],
      approvalState: 'approved',
      branchName: 'triad/task-def-002',
      summary: 'Migration system implemented and verified. Ready to merge.',
      findings: [],
      artifacts: [],
      steps: [
        { id: 'step-2-brief', stage: 'brief', agentId: 'claude', startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3590000).toISOString(), status: 'completed' },
        { id: 'step-2-code', stage: 'code', agentId: 'claude', startedAt: new Date(Date.now() - 3590000).toISOString(), completedAt: new Date(Date.now() - 3000000).toISOString(), status: 'completed' },
        { id: 'step-2-review', stage: 'review', agentId: 'codex', startedAt: new Date(Date.now() - 3000000).toISOString(), completedAt: new Date(Date.now() - 2400000).toISOString(), status: 'completed' },
        { id: 'step-2-verify', stage: 'verify', agentId: 'codex', startedAt: new Date(Date.now() - 2400000).toISOString(), completedAt: new Date(Date.now() - 1800000).toISOString(), status: 'completed' },
        { id: 'step-2-promote', stage: 'promote', agentId: 'claude', startedAt: new Date(Date.now() - 1800000).toISOString(), status: 'completed' }
      ],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString()
    }
  ],
  activeWorkflowId: 'code-review-fix-verify',
  terminals: [],
  ollama: {
    available: true,
    running: true,
    owner: 'external',
    activeModel: 'qwen2.5-coder:7b',
    endpoint: 'http://localhost:11434',
    message: 'Ollama running with qwen2.5-coder:7b'
  },
  archive: {
    path: '/home/dev/my-awesome-app/.triad-workbench',
    enabled: true,
    lastSavedAt: new Date(Date.now() - 120000).toISOString()
  },
  notifications: [
    'Codex review complete — 3 findings reported for task-abc-001.',
    'Task task-def-002 is ready to promote.'
  ]
};

const mockApi: WorkbenchApi = {
  bootstrap: async () => MOCK_SNAPSHOT,
  selectProject: async () => MOCK_SNAPSHOT.project,
  probeAgents: async () => MOCK_SNAPSHOT,
  setProjectRunner: async () => MOCK_SNAPSHOT,
  setAgentRole: async () => MOCK_SNAPSHOT,
  startTerminal: async () => ({ id: 'term-1', agentId: 'claude' as const, title: 'Claude Code', cwd: '/home/dev', runner: 'wsl' as const, createdAt: new Date().toISOString() }),
  stopTerminal: async () => {},
  sendTerminalInput: async () => {},
  resizeTerminal: async () => {},
  startWorkflow: async () => MOCK_SNAPSHOT,
  cancelWorkflow: async () => MOCK_SNAPSHOT,
  promoteTask: async () => MOCK_SNAPSHOT,
  continueTask: async () => MOCK_SNAPSHOT,
  startAgentAuth: async () => 'mock-auth-session-1',
  setOllamaRole: async () => MOCK_SNAPSHOT,
  shutdownOllama: async () => MOCK_SNAPSHOT,
  setProjectArchiveEnabled: async () => MOCK_SNAPSHOT,
  saveProjectArchive: async () => MOCK_SNAPSHOT.archive,
  openProjectArchive: async () => MOCK_SNAPSHOT.archive,
  onState: () => () => {},
  onTerminalData: () => () => {}
};

(window as unknown as { workbench: WorkbenchApi }).workbench = mockApi;
