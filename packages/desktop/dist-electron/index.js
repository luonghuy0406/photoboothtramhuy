"use strict";
const electron = require("electron");
const path = require("path");
const url = require("url");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
const __dirname$1 = path.dirname(url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("index.js", document.baseURI).href));
let mainWindow = null;
function createWindow() {
  const isProd = process.env.NODE_ENV === "production";
  mainWindow = new electron.BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: isProd,
    kiosk: isProd,
    frame: !isProd,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  electron.globalShortcut.register("CommandOrControl+Shift+Q", () => {
    electron.app.quit();
  });
  electron.globalShortcut.register("F11", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.ipcMain.handle("app:quit", () => {
  electron.app.quit();
});
electron.ipcMain.handle("app:toggle-fullscreen", () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});
electron.app.whenReady().then(createWindow);
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
const gotTheLock = electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  electron.app.quit();
}
