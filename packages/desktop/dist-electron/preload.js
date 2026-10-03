"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  camera: {
    connect: () => electron.ipcRenderer.invoke("camera:connect"),
    capture: () => electron.ipcRenderer.invoke("camera:capture"),
    getStatus: () => electron.ipcRenderer.invoke("camera:status"),
    onStatusChange: (callback) => {
      electron.ipcRenderer.on("camera:status-changed", (_event, status) => callback(status));
    }
  },
  session: {
    start: () => electron.ipcRenderer.invoke("session:start"),
    getState: () => electron.ipcRenderer.invoke("session:state")
  },
  app: {
    getConfig: () => electron.ipcRenderer.invoke("app:config"),
    quit: () => electron.ipcRenderer.invoke("app:quit")
  }
});
