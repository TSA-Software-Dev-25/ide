const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    create_account: (username, password) => ipcRenderer.invoke('create-account', username, password),
    login: (username, password) => ipcRenderer.invoke('login', username, password),
    logout: () => ipcRenderer.invoke('logout'),
    run: (data) => ipcRenderer.invoke('run', data),
});