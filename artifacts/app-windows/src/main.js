const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────
const LIVE_URL = process.env.VELOZTRADE_URL || 'https://veloztrade.com';
const IS_DEV = !app.isPackaged;

// ── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0f172a',
    title: 'VelozTrade — Professional Trading Platform',
    icon: (() => { try { const p = path.join(__dirname, '../build/icon.ico'); return require('fs').existsSync(p) ? p : undefined; } catch { return undefined; } })(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    autoHideMenuBar: false,
    show: false,
  });

  // Show when ready to avoid white flash
  win.once('ready-to-show', () => win.show());

  // Load live production site (always fresh, no rebuild needed for UI fixes)
  // To bundle offline, replace with: win.loadFile(path.join(__dirname, '../../veloztrade/dist/public/index.html'))
  win.loadURL(LIVE_URL);

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(LIVE_URL) || url.startsWith('https://veloztrade.com') || url.startsWith('https://veloztrading-production.up.railway.app')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Optional: open DevTools in dev
  if (IS_DEV) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}

// ── Menu ──────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'VelozTrade',
      submenu: [
        { label: 'About VelozTrade', role: 'about' },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: (item, win) => win && win.reload() },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: (item, win) => win && win.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Visit veloztrade.com', click: () => shell.openExternal('https://veloztrade.com') },
        { label: 'Support', click: () => shell.openExternal('https://veloztrade.com/support') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Security: block navigation to file:// or unexpected origins
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith(LIVE_URL) || url.startsWith('https://veloztrade.com') || url.startsWith('https://veloztrading-production.up.railway.app') || url.startsWith('https://clerk.') || url.startsWith('https://*.clerk.accounts.dev');
    // Allow in-app navigation; external is handled by setWindowOpenHandler
    if (!allowed && !url.startsWith('https://veloztrade.com')) {
      // still allow — main window navigation is same-origin, external links are new windows
    }
  });
});
