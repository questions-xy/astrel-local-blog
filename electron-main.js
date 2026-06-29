const { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog, Notification } = require("electron");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./server");

let mainWindow = null;
let localServer = null;
let tray = null;
let isQuitting = false;
let runtimePaths = null;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (process.platform === "win32") app.setAppUserModelId("com.astrel.localblog");

function copyDirIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function stateActivityScore(filePath) {
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const photoCount = (state.photoWalls || []).reduce((sum, wall) => sum + (wall.photos || []).length, 0);
    return (state.posts || []).length
      + (state.tasks || []).length
      + (state.focusRecords || []).length
      + (state.exam?.reports || []).length
      + (state.exam?.reviews || []).length
      + (state.words || []).filter((word) => Number(word.reviews || 0) > 0).length
      + photoCount
      + (state.settings?.background ? 3 : 0)
      + (state.settings?.avatar ? 3 : 0)
      + (state.settings?.musicSrc ? 2 : 0);
  } catch {
    return 0;
  }
}

function copySeedState(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) {
    fs.copyFileSync(source, target);
    return;
  }
  const sourceScore = stateActivityScore(source);
  const targetScore = stateActivityScore(target);
  if (sourceScore > targetScore) {
    const backup = target.replace(/\.json$/i, `.before-seed-${Date.now()}.json`);
    fs.copyFileSync(target, backup);
    fs.copyFileSync(source, target);
  }
}

function mergeSeedDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      mergeSeedDir(sourcePath, targetPath);
    } else if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function copyDirContents(source, target, options = {}) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, {
    recursive: true,
    force: options.force !== false,
    errorOnExist: false
  });
}

function timestampLabel() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function ensureRuntimePaths() {
  if (runtimePaths) return runtimePaths;
  const userData = app.getPath("userData");
  runtimePaths = {
    userData,
    dataDir: path.join(userData, "data"),
    uploadDir: path.join(userData, "uploads"),
    backupDir: path.join(userData, "backups")
  };
  fs.mkdirSync(runtimePaths.dataDir, { recursive: true });
  fs.mkdirSync(runtimePaths.uploadDir, { recursive: true });
  fs.mkdirSync(runtimePaths.backupDir, { recursive: true });
  return runtimePaths;
}

function ensureUserDataSeed() {
  const paths = ensureRuntimePaths();
  const packagedSeed = path.join(process.resourcesPath || "", "seed");
  const seedRoot = app.isPackaged && fs.existsSync(packagedSeed) ? packagedSeed : __dirname;
  copyDirIfMissing(path.join(seedRoot, "data"), paths.dataDir);
  copyDirIfMissing(path.join(seedRoot, "uploads"), paths.uploadDir);
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(paths.uploadDir, { recursive: true });
  fs.mkdirSync(paths.backupDir, { recursive: true });
  copySeedState(path.join(seedRoot, "data", "state.json"), path.join(paths.dataDir, "state.json"));
  if (!fs.existsSync(path.join(paths.dataDir, "state.json.bak"))) {
    copySeedState(path.join(seedRoot, "data", "state.json.bak"), path.join(paths.dataDir, "state.json.bak"));
  }
  mergeSeedDir(path.join(seedRoot, "uploads"), paths.uploadDir);
  return paths;
}

function showMainWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, "assets", "icon.ico");
  tray = new Tray(iconPath);
  tray.setToolTip("Astrel Local Blog Studio");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示 Astrel", click: showMainWindow },
    { label: "隐藏到托盘", click: () => mainWindow?.hide() },
    { type: "separator" },
    { label: "打开数据目录", click: () => shell.openPath(ensureRuntimePaths().userData) },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on("double-click", showMainWindow);
}

function createDesktopBackup(label = "backup") {
  const paths = ensureRuntimePaths();
  const backupPath = path.join(paths.backupDir, `${label}-${timestampLabel()}`);
  fs.mkdirSync(backupPath, { recursive: true });
  copyDirContents(paths.dataDir, path.join(backupPath, "data"));
  copyDirContents(paths.uploadDir, path.join(backupPath, "uploads"));
  return backupPath;
}

function notify(title, body) {
  if (!Notification.isSupported()) return false;
  new Notification({ title, body }).show();
  return true;
}

async function createMainWindow() {
  const { dataDir, uploadDir } = ensureUserDataSeed();
  const started = await startServer({
    rootDir: __dirname,
    dataDir,
    uploadDir,
    port: 0
  });
  localServer = started.server;

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: "Astrel",
    frame: false,
    backgroundColor: "#11101a",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  mainWindow.loadURL(started.url);
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    notify("Astrel 仍在运行", "窗口已隐藏到托盘，计时和本地服务会继续工作。");
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  createTray();
}

app.whenReady().then(createMainWindow).catch((error) => {
  console.error(error);
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch((error) => {
      console.error(error);
      app.quit();
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
});

app.on("before-quit", () => {
  isQuitting = true;
  if (localServer) localServer.close();
});

ipcMain.handle("window:minimize", () => {
  BrowserWindow.getFocusedWindow()?.minimize();
});

ipcMain.handle("window:toggle-maximize", () => {
  const window = BrowserWindow.getFocusedWindow();
  if (!window) return false;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
  return window.isMaximized();
});

ipcMain.handle("window:close", () => {
  BrowserWindow.getFocusedWindow()?.close();
});

ipcMain.handle("app:show-window", () => {
  showMainWindow();
});

ipcMain.handle("app:quit", () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle("app:get-data-info", () => {
  const paths = ensureRuntimePaths();
  return {
    userData: paths.userData,
    dataDir: paths.dataDir,
    uploadDir: paths.uploadDir,
    backupDir: paths.backupDir,
    stateFile: path.join(paths.dataDir, "state.json")
  };
});

ipcMain.handle("app:open-data-dir", async () => {
  const result = await shell.openPath(ensureRuntimePaths().userData);
  return { ok: !result, error: result || "" };
});

ipcMain.handle("app:create-backup", () => {
  const backupPath = createDesktopBackup();
  notify("备份完成", `已保存到 ${backupPath}`);
  return { ok: true, path: backupPath };
});

ipcMain.handle("app:restore-backup", async () => {
  const paths = ensureRuntimePaths();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择 Astrel 备份文件夹",
    defaultPath: paths.backupDir,
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
  const source = result.filePaths[0];
  const sourceState = path.join(source, "data", "state.json");
  if (!fs.existsSync(sourceState)) {
    return { ok: false, error: "所选文件夹不是有效备份，缺少 data/state.json。" };
  }
  const safetyBackup = createDesktopBackup("before-restore");
  copyDirContents(path.join(source, "data"), paths.dataDir);
  copyDirContents(path.join(source, "uploads"), paths.uploadDir);
  notify("恢复完成", "Astrel 将刷新页面载入恢复后的数据。");
  return { ok: true, path: source, safetyBackup };
});

ipcMain.handle("app:notify", (_event, payload = {}) => {
  return notify(String(payload.title || "Astrel"), String(payload.body || ""));
});
