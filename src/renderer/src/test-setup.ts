import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import type { WorkbenchApi } from '@shared/ipc';
import { useWorkbenchStore } from './store';

const workbenchStub: WorkbenchApi = {
  bootstrap: vi.fn(async () => {
    throw new Error('bootstrap not mocked for this test');
  }),
  selectProject: vi.fn(async () => undefined),
  probeAgents: vi.fn(async () => {
    throw new Error('probeAgents not mocked for this test');
  }),
  setProjectRunner: vi.fn(async () => {
    throw new Error('setProjectRunner not mocked for this test');
  }),
  setAgentRole: vi.fn(async () => {
    throw new Error('setAgentRole not mocked for this test');
  }),
  startTerminal: vi.fn(async () => {
    throw new Error('startTerminal not mocked for this test');
  }),
  stopTerminal: vi.fn(async () => undefined),
  sendTerminalInput: vi.fn(async () => undefined),
  resizeTerminal: vi.fn(async () => undefined),
  startWorkflow: vi.fn(async () => {
    throw new Error('startWorkflow not mocked for this test');
  }),
  cancelWorkflow: vi.fn(async () => {
    throw new Error('cancelWorkflow not mocked for this test');
  }),
  promoteTask: vi.fn(async () => {
    throw new Error('promoteTask not mocked for this test');
  }),
  continueTask: vi.fn(async () => {
    throw new Error('continueTask not mocked for this test');
  }),
  startAgentAuth: vi.fn(async () => {
    throw new Error('startAgentAuth not mocked for this test');
  }),
  setOllamaRole: vi.fn(async () => {
    throw new Error('setOllamaRole not mocked for this test');
  }),
  shutdownOllama: vi.fn(async () => {
    throw new Error('shutdownOllama not mocked for this test');
  }),
  setProjectArchiveEnabled: vi.fn(async () => {
    throw new Error('setProjectArchiveEnabled not mocked for this test');
  }),
  saveProjectArchive: vi.fn(async () => undefined),
  openProjectArchive: vi.fn(async () => undefined),
  listArchiveTasks: vi.fn(async () => []),
  getArchiveTaskDetail: vi.fn(async () => {
    throw new Error('getArchiveTaskDetail not mocked for this test');
  }),
  listCustomWorkflows: vi.fn(async () => []),
  saveCustomWorkflow: vi.fn(async (w) => w),
  deleteCustomWorkflow: vi.fn(async () => undefined),
  onState: vi.fn(() => () => undefined),
  onTerminalData: vi.fn(() => () => undefined)
};

beforeEach(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'workbench', {
      configurable: true,
      value: workbenchStub
    });
  }

  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined)
      }
    });
  }

  useWorkbenchStore.setState({
    snapshot: undefined,
    terminalBuffers: {},
    error: undefined,
    isBusy: false,
    selectedTaskId: undefined,
    selectedArtifactId: undefined
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
