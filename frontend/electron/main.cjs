/**
 * Windows 自助终端 · Electron 全屏 Kiosk 外壳。
 * 默认加载本机后端托管的前端（http://localhost:8080）。
 * 可用环境变量 INVMAP_URL 指向独立后端地址。
 * 退出快捷键：Ctrl+Shift+Q（便于现场维护）。
 */
const { app, BrowserWindow, globalShortcut } = require('electron');

const TARGET_URL = process.env.INVMAP_URL || 'http://localhost:8080';

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  win.loadURL(TARGET_URL);
  // 断网/后端未起时自动重试
  win.webContents.on('did-fail-load', () => {
    setTimeout(() => win.loadURL(TARGET_URL), 3000);
  });
}

app.whenReady().then(() => {
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
