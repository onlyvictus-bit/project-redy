import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import { IPC_CHANNELS } from '@shared/ipc';

import { AppController } from './app-controller';

let controller: AppController | undefined;
let mainWindow: BrowserWindow | undefined;
let ipcWired = false;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    title: 'Triad Workbench',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function wireIpc(nextController: AppController): void {
  if (ipcWired) return;
  ipcWired = true;

  // Forward controller events to whichever window is currently open.
  // Uses the module-level `mainWindow` reference so macOS re-activate picks up the new window.
  nextController.on('state', (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.stateChanged, state);
    }
  });
  nextController.on('terminal-data', (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.terminalData, payload);
    }
  });

  ipcMain.handle(IPC_CHANNELS.bootstrap, () => nextController.bootstrap());
  ipcMain.handle(IPC_CHANNELS.selectProject, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    return nextController.selectProject(win);
  });
  ipcMain.handle(IPC_CHANNELS.probeAgents, (_event, deep?: boolean) => nextController.probeAgents(deep));
  ipcMain.handle(IPC_CHANNELS.setProjectRunner, (_event, runner) => nextController.setProjectRunner(runner));
  ipcMain.handle(IPC_CHANNELS.setAgentRole, (_event, agentId, role) => nextController.setAgentRole(agentId, role));
  ipcMain.handle(IPC_CHANNELS.startTerminal, (_event, agentId) => nextController.startTerminal(agentId));
  ipcMain.handle(IPC_CHANNELS.stopTerminal, (_event, sessionId) => nextController.stopTerminal(sessionId));
  ipcMain.handle(IPC_CHANNELS.sendTerminalInput, (_event, sessionId, input) => nextController.sendTerminalInput(sessionId, input));
  ipcMain.handle(IPC_CHANNELS.resizeTerminal, (_event, sessionId, cols, rows) => nextController.resizeTerminal(sessionId, cols, rows));
  ipcMain.handle(IPC_CHANNELS.startWorkflow, (_event, input) => nextController.startWorkflow(input));
  ipcMain.handle(IPC_CHANNELS.cancelWorkflow, (_event, taskId) => nextController.cancelWorkflow(taskId));
  ipcMain.handle(IPC_CHANNELS.promoteTask, (_event, taskId, action) => nextController.promoteTask(taskId, action));
  ipcMain.handle(IPC_CHANNELS.continueTask, (_event, taskId, options) => nextController.continueTask(taskId, options));
  ipcMain.handle(IPC_CHANNELS.startAgentAuth, (_event, agentId) => nextController.startAgentAuth(agentId));
  ipcMain.handle(IPC_CHANNELS.setOllamaRole, (_event, role, model) => nextController.setOllamaRole(role, model));
  ipcMain.handle(IPC_CHANNELS.shutdownOllama, () => nextController.shutdownOllama());
  ipcMain.handle(IPC_CHANNELS.setProjectArchiveEnabled, (_event, enabled) => nextController.setProjectArchiveEnabled(enabled));
  ipcMain.handle(IPC_CHANNELS.saveProjectArchive, () => nextController.saveProjectArchive());
  ipcMain.handle(IPC_CHANNELS.openProjectArchive, () => nextController.openProjectArchive());
  ipcMain.handle(IPC_CHANNELS.listArchiveTasks, (_event, projectId: string) => nextController.listArchiveTasks(projectId));
  ipcMain.handle(IPC_CHANNELS.getArchiveTaskDetail, (_event, taskId: string) => nextController.getArchiveTaskDetail(taskId));
  ipcMain.handle(IPC_CHANNELS.listCustomWorkflows, () => nextController.listCustomWorkflows());
  ipcMain.handle(IPC_CHANNELS.saveCustomWorkflow, (_event, workflow) => nextController.saveCustomWorkflow(workflow));
  ipcMain.handle(IPC_CHANNELS.deleteCustomWorkflow, (_event, id) => nextController.deleteCustomWorkflow(id));
}

app.whenReady().then(() => {
  controller = new AppController();
  mainWindow = createMainWindow();
  wireIpc(controller);
  controller.registerQuitHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && controller) {
      mainWindow = createMainWindow();
      // IPC handlers are already registered; new window receives events via mainWindow reference.
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
