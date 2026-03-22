import { create } from 'zustand';

const MAX_TERMINAL_LINES = 5000;

import type {
  AgentId,
  AgentRole,
  ContinueTaskOptions,
  PromotionAction,
  RunnerKind,
  StartWorkflowInput,
  TerminalSession,
  WorkbenchSnapshot
} from '@shared/types';

interface WorkbenchState {
  snapshot?: WorkbenchSnapshot;
  terminalBuffers: Record<string, string>;
  error?: string;
  isBusy: boolean;
  bootstrap: () => Promise<void>;
  applySnapshot: (snapshot: WorkbenchSnapshot) => void;
  appendTerminalData: (sessionId: string, data: string) => void;
  selectProject: () => Promise<void>;
  probeAgents: (deep?: boolean) => Promise<void>;
  setProjectRunner: (runner: RunnerKind | 'auto') => Promise<void>;
  setAgentRole: (agentId: AgentId, role: AgentRole) => Promise<void>;
  startTerminal: (agentId: AgentId) => Promise<TerminalSession | undefined>;
  stopTerminal: (sessionId: string) => Promise<void>;
  sendTerminalInput: (sessionId: string, input: string) => Promise<void>;
  startWorkflow: (input: StartWorkflowInput) => Promise<void>;
  cancelWorkflow: (taskId: string) => Promise<void>;
  promoteTask: (taskId: string, action: PromotionAction) => Promise<void>;
  continueTask: (taskId: string, options: ContinueTaskOptions) => Promise<void>;
  startAgentAuth: (agentId: AgentId) => Promise<string | undefined>;
  setOllamaRole: (role: AgentRole, model?: string) => Promise<void>;
  shutdownOllama: () => Promise<void>;
  setProjectArchiveEnabled: (enabled: boolean) => Promise<void>;
  saveProjectArchive: () => Promise<void>;
  openProjectArchive: () => Promise<void>;
  selectedTaskId?: string;
  selectedArtifactId?: string;
  selectTask: (taskId: string | undefined) => void;
  selectArtifact: (artifactId: string | undefined) => void;
  expandedTerminalId: string | null;
  expandTerminal: (sessionId: string) => void;
  collapseTerminal: () => void;
}

type StateSetter = (partial: Partial<WorkbenchState> | ((state: WorkbenchState) => Partial<WorkbenchState>)) => void;

async function runAction<T>(set: StateSetter, action: () => Promise<T>, onSuccess: (result: T) => void): Promise<void> {
  set({ isBusy: true, error: undefined });
  try {
    const result = await action();
    onSuccess(result);
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    set({ isBusy: false });
  }
}

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  snapshot: undefined,
  terminalBuffers: {},
  error: undefined,
  isBusy: false,
  bootstrap: async () => {
    await runAction(set, () => window.workbench.bootstrap(), (snapshot) => {
      set({ snapshot });
    });
  },
  applySnapshot: (snapshot) => set({ snapshot }),
  appendTerminalData: (sessionId, data) =>
    set((state) => {
      const current = state.terminalBuffers[sessionId] ?? '';
      const combined = `${current}${data}`;
      const lines = combined.split('\n');
      const trimmed = lines.length > MAX_TERMINAL_LINES ? lines.slice(-MAX_TERMINAL_LINES).join('\n') : combined;
      return {
        terminalBuffers: {
          ...state.terminalBuffers,
          [sessionId]: trimmed
        }
      };
    }),
  selectProject: async () => {
    await runAction(set, () => window.workbench.selectProject(), () => {
      set({ terminalBuffers: {} });
    });
  },
  probeAgents: async (deep) => {
    await runAction(set, () => window.workbench.probeAgents(deep), (snapshot) => set({ snapshot }));
  },
  setProjectRunner: async (runner) => {
    await runAction(set, () => window.workbench.setProjectRunner(runner), (snapshot) => set({ snapshot }));
  },
  setAgentRole: async (agentId, role) => {
    await runAction(set, () => window.workbench.setAgentRole(agentId, role), (snapshot) => set({ snapshot }));
  },
  startTerminal: async (agentId) => {
    let session: TerminalSession | undefined;
    await runAction(set, () => window.workbench.startTerminal(agentId), (result) => {
      session = result;
    });
    return session;
  },
  stopTerminal: async (sessionId) => {
    await runAction(set, () => window.workbench.stopTerminal(sessionId), () => {
      set((state) => {
        const { [sessionId]: _removed, ...rest } = state.terminalBuffers;
        return { terminalBuffers: rest };
      });
    });
  },
  sendTerminalInput: async (sessionId, input) => {
    await runAction(set, () => window.workbench.sendTerminalInput(sessionId, input), () => undefined);
  },
  startWorkflow: async (input) => {
    await runAction(set, () => window.workbench.startWorkflow(input), (snapshot) => set({ snapshot }));
  },
  cancelWorkflow: async (taskId) => {
    await runAction(set, () => window.workbench.cancelWorkflow(taskId), (snapshot) => set({ snapshot }));
  },
  promoteTask: async (taskId, action) => {
    await runAction(set, () => window.workbench.promoteTask(taskId, action), (snapshot) => set({ snapshot }));
  },
  continueTask: async (taskId, options) => {
    await runAction(set, () => window.workbench.continueTask(taskId, options), (snapshot) => set({ snapshot }));
  },
  startAgentAuth: async (agentId) => {
    let sessionId: string | undefined;
    await runAction(set, () => window.workbench.startAgentAuth(agentId), (id) => { sessionId = id; });
    return sessionId;
  },
  setOllamaRole: async (role, model) => {
    await runAction(set, () => window.workbench.setOllamaRole(role, model), (snapshot) => set({ snapshot }));
  },
  shutdownOllama: async () => {
    await runAction(set, () => window.workbench.shutdownOllama(), (snapshot) => set({ snapshot }));
  },
  setProjectArchiveEnabled: async (enabled) => {
    await runAction(set, () => window.workbench.setProjectArchiveEnabled(enabled), (snapshot) => set({ snapshot }));
  },
  saveProjectArchive: async () => {
    await runAction(set, () => window.workbench.saveProjectArchive(), (archive) =>
      set((state) => ({
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              archive: archive ?? state.snapshot.archive
            }
          : state.snapshot
      }))
    );
  },
  openProjectArchive: async () => {
    await runAction(set, () => window.workbench.openProjectArchive(), (archive) =>
      set((state) => ({
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              archive: archive ?? state.snapshot.archive
            }
          : state.snapshot
      }))
    );
  },
  selectedTaskId: undefined,
  selectedArtifactId: undefined,
  selectTask: (taskId) => set({ selectedTaskId: taskId, selectedArtifactId: undefined }),
  selectArtifact: (artifactId) => set({ selectedArtifactId: artifactId }),
  expandedTerminalId: null,
  expandTerminal: (sessionId) => set({ expandedTerminalId: sessionId }),
  collapseTerminal: () => set({ expandedTerminalId: null }),
}));
