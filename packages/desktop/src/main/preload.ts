import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  camera: {
    connect: () => ipcRenderer.invoke('camera:connect'),
    capture: () => ipcRenderer.invoke('camera:capture'),
    getStatus: () => ipcRenderer.invoke('camera:status'),
    onStatusChange: (callback: (status: string) => void) => {
      ipcRenderer.on('camera:status-changed', (_event, status) => callback(status));
    },
  },
  session: {
    start: () => ipcRenderer.invoke('session:start'),
    getState: () => ipcRenderer.invoke('session:state'),
  },
  app: {
    getConfig: () => ipcRenderer.invoke('app:config'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },
});
