const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('shell:getState'),
  onState: (callback) =>
    ipcRenderer.on('shell:state', (_event, state) => callback(state)),
  addAccount: () => ipcRenderer.invoke('shell:addAccount'),
  renameAccount: (id) => ipcRenderer.invoke('shell:renameAccount', id),
  selectAccount: (id) => ipcRenderer.send('shell:selectAccount', id),
  toggleMute: (id) => ipcRenderer.send('shell:toggleMute', id),
  reloadAccount: (id) => ipcRenderer.send('shell:reloadAccount', id),
  openDevTools: (id) => ipcRenderer.send('shell:openDevTools', id),
  showTabMenu: (id) => ipcRenderer.send('shell:showTabMenu', id),
  openSettings: () => ipcRenderer.send('shell:openSettings'),
});
