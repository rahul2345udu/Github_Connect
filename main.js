const { app, BrowserWindow } = require('electron');
const path = require('path');

// Enable live reloading during development
try {
  require('electron-reload')(__dirname, {
    electron: require.resolve('electron'),
    awaitWriteFinish: true
  });
} catch (err) {
  console.warn('Live reload failed to initialize:', err.message);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the main UI
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html')).catch(err => {
    console.error('Failed to load index.html:', err.message);
  });

  // DevTools – comment this out for production
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details);
    if (!mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });
}

// App ready
app.whenReady().then(createWindow).catch(err => {
  console.error('App initialization failed:', err.message);
  app.quit();
});

// macOS behavior: recreate window if all closed
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Quit app on all window close (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Global exception handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
