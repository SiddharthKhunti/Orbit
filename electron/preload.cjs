const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  readAppData: () => ipcRenderer.invoke('app:read-data'),
  writeAppData: (payload) => ipcRenderer.invoke('app:write-data', payload),
})
