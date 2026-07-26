const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('installer', {
  bootstrap: () => ipcRenderer.invoke('installer:bootstrap'),
  chooseFolder: () => ipcRenderer.invoke('installer:choose-folder'),
  start: (opts) => ipcRenderer.invoke('installer:start', opts),
  uninstall: () => ipcRenderer.invoke('installer:uninstall'),
  openFolder: (dir) => ipcRenderer.invoke('installer:open-folder', dir),
  onProgress: (cb) => ipcRenderer.on('installer:progress', (_e, data) => cb(data)),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
})
