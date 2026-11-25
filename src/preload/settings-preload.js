const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  onState: (callback) =>
    ipcRenderer.on('settings:state', (_event, state) => callback(state)),
  onUpdate: (callback) =>
    ipcRenderer.on('settings:update', (_event, state) => callback(state)),
  chooseDir: () => ipcRenderer.invoke('settings:chooseDir'),
  storage: () => ipcRenderer.invoke('settings:storage'),
  getDownloads: () => ipcRenderer.invoke('settings:getDownloads'),
  openPath: (p) => ipcRenderer.invoke('settings:openPath', p),
  clearCache: (id) => ipcRenderer.invoke('settings:clearCache', id),
  clearData: (id) => ipcRenderer.invoke('settings:clearData', id),
  removeAccount: (id) => ipcRenderer.invoke('settings:removeAccount', id),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
});
