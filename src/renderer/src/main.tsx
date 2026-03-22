// Only enable the browser mock in plain browser preview mode.
// If Electron is present but preload failed, surface that as a real app error
// instead of silently downgrading to a fake mock backend.
const isElectronRuntime = navigator.userAgent.includes('Electron');
const isMockMode = !window.workbench && !isElectronRuntime;
if (isMockMode) {
  await import('./dev-mock');
}
if (!window.workbench && isElectronRuntime) {
  throw new Error('Electron preload bridge is unavailable. The desktop app cannot function without window.workbench.');
}
console.log('[workbench] mode:', isMockMode ? 'MOCK (browser preview)' : 'LIVE (Electron IPC)');

import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
