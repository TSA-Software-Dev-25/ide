const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  saveFile: (filepath, content) => ipcRenderer.invoke('save-file', filepath, content),
  popWindow: () => ipcRenderer.send('pop-window'),
  readFile: (filepath) => ipcRenderer.invoke('read-file', filepath),
  onLoginChange: (callback) => ipcRenderer.on("update-login", (_event, status) => callback(status) ),
  sendFile: (code, filepath) => ipcRenderer.invoke('send-file', code, filepath),
  logout: () => ipcRenderer.invoke('logout'),
});
