const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  generateTree: (config) => ipcRenderer.invoke('generate-tree', config),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFilesDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  loadConfig: () => ipcRenderer.invoke('config:load'),
});
