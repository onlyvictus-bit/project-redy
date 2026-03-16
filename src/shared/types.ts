export type AgentId = 'claude' | 'codex' | 'gemini' | 'ollama';
export type AgentRole =
  | 'coder'
  | 'reviewer'
  | 'tester'
  | 'architect'
  | 'planner'
  | 'monitor'
  | 'compare-only'
  | 'developer'
  | 'off';
export type ActiveAgentRole = 'coder' | 'reviewer' | 'tester' | 'architect' | 'planner' | 'monitor';
export type AuthMode = 'native-login' | 'api-key' | 'none';
export type RunnerKind = 'wsl' | 'windows' | 'http-local';
export type AgentStatus = 'missing' | 'installed' | 'needs-login' | 'ready' | 'running' | 'error';
export type WorkflowMode = 'orchestrate' | 'direct' | 'parallel' | 'chain';
export type WorkflowId =
  | 'code-review-fix-verify'
  | 'code-gemini-compare-codex-review'
  | 'architecture-compare'
  | 'away-monitor';
export type TaskStage =
  | 'brief'
  | 'code'
  | 'review'
  | 'findings'
  | 'fix'
  | 'verify'
  | 'promote'
  | 'done'
  | 'error'
  | 'cancelled';
export type ResumableStage = 'code' | 'review' | 'fix' | 'verify';
export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'not-required';
export type PromotionAction = 'apply-to-main' | 'keep-worktree' | 'open-task-branch';
export type OllamaLifecycleOwner = 'external' | 'app-managed' | 'none';

export interface ProjectRef {
  id: string;
  name: string;
  rootPath: string;
  wslPath?: string;
  runnerPreference: RunnerKind | 'auto';
  /** Resolved at load/set time; used by workspace layer to avoid re-detecting WSL on every git call. */
  resolvedRunner?: RunnerKind;
  isGitRepo: boolean;
  currentBranch?: string;
  archivePath: string;
  archiveEnabled: boolean;
}

export interface AgentCapabilitySet {
  supportsInteractive: boolean;
  supportsStructuredOutput: boolean;
  supportsEditing: boolean;
  supportsResume: boolean;
  supportsVision?: boolean;
  supportsBrowserLogin?: boolean;
}

export interface AgentProfile {
  id: AgentId;
  displayName: string;
  binaryOrEndpoint: string;
  authMode: AuthMode;
  role: AgentRole;
  runner: RunnerKind;
  status: AgentStatus;
  capabilities: AgentCapabilitySet;
  version?: string;
  installHelpUrl?: string;
  message?: string;
  detectedPath?: string;
  lastCheckedAt?: string;
  /** Ollama only: the model last explicitly selected by the user. Persisted so it survives restart. */
  selectedModel?: string;
}

export interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  body: string;
  file?: string;
  line?: number;
  sourceAgent: AgentId;
  evidence?: string;
  recommendedAction?: string;
}

export interface CommandRun {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface ArtifactBundle {
  id: string;
  taskId: string;
  stepId: string;
  agentId: AgentId;
  role: AgentRole;
  prompt: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  structuredEvents: unknown[];
  summary: string;
  finalMessage: string;
  patch?: string;
  findings: Finding[];
  commandRuns: CommandRun[];
  createdAt: string;
}

export interface TaskStepRecord {
  id: string;
  stage: TaskStage;
  agentId: AgentId;
  startedAt: string;
  completedAt?: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  summary?: string;
}

export interface TaskRun {
  id: string;
  projectId: string;
  workflowId: WorkflowId;
  workflowMode: WorkflowMode;
  baseBranch: string;
  baseCommit: string;
  worktreePath: string;
  stage: TaskStage;
  brief: string;
  assignedAgents: AgentId[];
  approvalState: ApprovalState;
  branchName: string;
  summary?: string;
  errorMessage?: string;
  findings: Finding[];
  artifacts: ArtifactBundle[];
  steps: TaskStepRecord[];
  createdAt: string;
  updatedAt: string;
  /** Track whether the worktree is still present and who owns it. */
  worktreeStatus?: 'active' | 'preserved' | 'cleaned';
}

export interface TerminalSession {
  id: string;
  agentId: AgentId;
  title: string;
  cwd: string;
  runner: RunnerKind;
  createdAt: string;
}

export interface ProjectArchiveSummary {
  path: string;
  enabled: boolean;
  lastSavedAt?: string;
}

export interface OllamaStatus {
  available: boolean;
  running: boolean;
  owner: OllamaLifecycleOwner;
  activeModel?: string;
  availableModels?: string[];
  endpoint: string;
  message?: string;
}

export interface WorkbenchSnapshot {
  project?: ProjectRef;
  agents: Record<AgentId, AgentProfile>;
  tasks: TaskRun[];
  activeWorkflowId: WorkflowId;
  terminals: TerminalSession[];
  ollama: OllamaStatus;
  archive?: ProjectArchiveSummary;
  notifications: string[];
}

export interface WorkflowDefinition {
  id: WorkflowId;
  label: string;
  description: string;
  mode: WorkflowMode;
  stages: TaskStage[];
}

export interface StartWorkflowInput {
  brief: string;
  workflowId: WorkflowId;
  workflowMode?: WorkflowMode;
  agentOverrides?: Partial<Record<AgentId, AgentRole>>;
}

export type ContinueTaskOptions =
  | {
      mode: 'resume';
      fromStage: ResumableStage;
    }
  | {
      mode: 'single-step';
      stage: ResumableStage;
      agentId: AgentId;
      role: ActiveAgentRole;
      prompt?: string;
    };

export interface ProbeResult {
  profile: AgentProfile;
  rawOutput: string;
}

export interface StructuredEnvelope<T> {
  triad: T;
}

export interface ParsedTriadPayload {
  summary: string;
  findings: Finding[];
  recommendedRole?: AgentRole;
  notes?: string[];
}

export const DEFAULT_AGENTS: Record<AgentId, AgentProfile> = {
  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    binaryOrEndpoint: 'claude',
    authMode: 'native-login',
    role: 'coder',
    runner: 'wsl',
    status: 'missing',
    installHelpUrl: 'https://code.claude.com/docs/en/quickstart',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    }
  },
  codex: {
    id: 'codex',
    displayName: 'Codex CLI',
    binaryOrEndpoint: 'codex',
    authMode: 'native-login',
    role: 'reviewer',
    runner: 'wsl',
    status: 'missing',
    installHelpUrl: 'https://developers.openai.com/codex',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: false
    }
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini CLI',
    binaryOrEndpoint: 'gemini',
    authMode: 'native-login',
    role: 'architect',
    runner: 'wsl',
    status: 'missing',
    installHelpUrl: 'https://github.com/google-gemini/gemini-cli',
    capabilities: {
      supportsInteractive: true,
      supportsStructuredOutput: true,
      supportsEditing: true,
      supportsResume: true
    }
  },
  ollama: {
    id: 'ollama',
    displayName: 'Ollama',
    binaryOrEndpoint: 'http://localhost:11434',
    authMode: 'none',
    role: 'off',
    runner: 'http-local',
    status: 'installed',
    installHelpUrl: 'https://docs.ollama.com/windows',
    capabilities: {
      supportsInteractive: false,
      supportsStructuredOutput: true,
      supportsEditing: false,
      supportsResume: false
    }
  }
};
