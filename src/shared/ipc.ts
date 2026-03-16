import type {
  AgentId,
  AgentRole,
  ContinueTaskOptions,
  PromotionAction,
  ProjectArchiveSummary,
  ProjectRef,
  RunnerKind,
  StartWorkflowInput,
  TerminalSession,
  WorkbenchSnapshot
} from './types';

export interface WorkbenchApi {
  bootstrap: () => Promise<WorkbenchSnapshot>;
  selectProject: () => Promise<ProjectRef | undefined>;
  probeAgents: (deep?: boolean) => Promise<WorkbenchSnapshot>;
  setProjectRunner: (runner: RunnerKind | 'auto') => Promise<WorkbenchSnapshot>;
  setAgentRole: (agentId: AgentId, role: AgentRole) => Promise<WorkbenchSnapshot>;
  startTerminal: (agentId: AgentId) => Promise<TerminalSession>;
  stopTerminal: (sessionId: string) => Promise<void>;
  sendTerminalInput: (sessionId: string, input: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  startWorkflow: (input: StartWorkflowInput) => Promise<WorkbenchSnapshot>;
  cancelWorkflow: (taskId: string) => Promise<WorkbenchSnapshot>;
  promoteTask: (taskId: string, action: PromotionAction) => Promise<WorkbenchSnapshot>;
  continueTask: (taskId: string, options: ContinueTaskOptions) => Promise<WorkbenchSnapshot>;
  startAgentAuth: (agentId: AgentId) => Promise<string>;
  setOllamaRole: (role: AgentRole, model?: string) => Promise<WorkbenchSnapshot>;
  shutdownOllama: () => Promise<WorkbenchSnapshot>;
  setProjectArchiveEnabled: (enabled: boolean) => Promise<WorkbenchSnapshot>;
  saveProjectArchive: () => Promise<ProjectArchiveSummary | undefined>;
  openProjectArchive: () => Promise<ProjectArchiveSummary | undefined>;
  onState: (listener: (state: WorkbenchSnapshot) => void) => () => void;
  onTerminalData: (listener: (payload: { sessionId: string; data: string }) => void) => () => void;
}

export const IPC_CHANNELS = {
  bootstrap: 'workbench:bootstrap',
  selectProject: 'workbench:project:select',
  probeAgents: 'workbench:agents:probe',
  setProjectRunner: 'workbench:project:set-runner',
  setAgentRole: 'workbench:agents:set-role',
  startTerminal: 'workbench:terminals:start',
  stopTerminal: 'workbench:terminals:stop',
  sendTerminalInput: 'workbench:terminals:input',
  resizeTerminal: 'workbench:terminals:resize',
  startWorkflow: 'workbench:workflow:start',
  cancelWorkflow: 'workbench:workflow:cancel',
  promoteTask: 'workbench:workflow:promote',
  continueTask: 'workbench:workflow:continue',
  startAgentAuth: 'workbench:agents:start-auth',
  setOllamaRole: 'workbench:ollama:set-role',
  shutdownOllama: 'workbench:ollama:shutdown',
  setProjectArchiveEnabled: 'workbench:project:set-archive-enabled',
  saveProjectArchive: 'workbench:project:save-archive',
  openProjectArchive: 'workbench:project:open-archive',
  stateChanged: 'workbench:event:state',
  terminalData: 'workbench:event:terminal-data'
} as const;
