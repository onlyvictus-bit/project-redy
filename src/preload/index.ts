import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS, type WorkbenchApi } from '@shared/ipc';

const api: WorkbenchApi = {
  bootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.bootstrap),
  selectProject: () => ipcRenderer.invoke(IPC_CHANNELS.selectProject),
  probeAgents: (deep) => ipcRenderer.invoke(IPC_CHANNELS.probeAgents, deep),
  setProjectRunner: (runner) => ipcRenderer.invoke(IPC_CHANNELS.setProjectRunner, runner),
  setAgentRole: (agentId, role) => ipcRenderer.invoke(IPC_CHANNELS.setAgentRole, agentId, role),
  startTerminal: (agentId) => ipcRenderer.invoke(IPC_CHANNELS.startTerminal, agentId),
  stopTerminal: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.stopTerminal, sessionId),
  sendTerminalInput: (sessionId, input) => ipcRenderer.invoke(IPC_CHANNELS.sendTerminalInput, sessionId, input),
  resizeTerminal: (sessionId, cols, rows) => ipcRenderer.invoke(IPC_CHANNELS.resizeTerminal, sessionId, cols, rows),
  startWorkflow: (input) => ipcRenderer.invoke(IPC_CHANNELS.startWorkflow, input),
  promoteTask: (taskId, action) => ipcRenderer.invoke(IPC_CHANNELS.promoteTask, taskId, action),
  continueTask: (taskId, options) => ipcRenderer.invoke(IPC_CHANNELS.continueTask, taskId, options),
  setOllamaRole: (role, model) => ipcRenderer.invoke(IPC_CHANNELS.setOllamaRole, role, model),
  shutdownOllama: () => ipcRenderer.invoke(IPC_CHANNELS.shutdownOllama),
  setProjectArchiveEnabled: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.setProjectArchiveEnabled, enabled),
  saveProjectArchive: () => ipcRenderer.invoke(IPC_CHANNELS.saveProjectArchive),
  openProjectArchive: () => ipcRenderer.invoke(IPC_CHANNELS.openProjectArchive),
  onState: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: Awaited<ReturnType<WorkbenchApi['bootstrap']>>) => listener(state);
    ipcRenderer.on(IPC_CHANNELS.stateChanged, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, wrapped);
    };
  },
  onTerminalData: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; data: string }) => listener(payload);
    ipcRenderer.on(IPC_CHANNELS.terminalData, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.terminalData, wrapped);
    };
  }
};

contextBridge.exposeInMainWorld('workbench', api);
