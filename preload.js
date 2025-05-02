const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  saveFile: (filepath, content) => ipcRenderer.invoke('save-file', filepath, content),
  popWindow: () => ipcRenderer.send('pop-window'),
  readFile: (filepath) => ipcRenderer.invoke('read-file', filePath)
});
