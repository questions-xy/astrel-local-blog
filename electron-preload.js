const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("astrelWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close")
});

contextBridge.exposeInMainWorld("astrelDesktop", {
  showWindow: () => ipcRenderer.invoke("app:show-window"),
  quit: () => ipcRenderer.invoke("app:quit"),
  getDataInfo: () => ipcRenderer.invoke("app:get-data-info"),
  openDataDir: () => ipcRenderer.invoke("app:open-data-dir"),
  createBackup: () => ipcRenderer.invoke("app:create-backup"),
  restoreBackup: () => ipcRenderer.invoke("app:restore-backup"),
  notify: (payload) => ipcRenderer.invoke("app:notify", payload)
});
