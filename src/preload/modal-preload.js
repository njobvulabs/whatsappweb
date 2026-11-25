const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  init: (callback) => ipcRenderer.on('modal:init', (_event, data) => callback(data)),
  submit: (name) => ipcRenderer.send('modal:submit', name),
  cancel: () => ipcRenderer.send('modal:cancel'),
});
