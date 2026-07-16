const { contextBridge, ipcRenderer } = require('electron');

// Bridge native desktop capabilities safely to the React App
contextBridge.exposeInMainWorld('electronAPI', {
  getTelemetry: () => ipcRenderer.invoke('get-telemetry'),
  executeAction: (command, params) => ipcRenderer.invoke('execute-action', { command, params }),
  chatBrain: (message) => ipcRenderer.invoke('chat-brain', { message })
});
