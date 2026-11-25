const path = require('node:path');
const fs = require('node:fs');
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  dialog,
  ipcMain,
  nativeTheme,
  globalShortcut,
  session,
  shell,
} = require('electron');
const { autoUpdater } = require('electron-updater');

const { AccountStore } = require('./accounts');
const { ViewManager } = require('./view-manager');
const { createTray } = require('./tray');
const { registerShortcuts } = require('./shortcuts');
const { DownloadManager } = require('./downloads');
const { registerSettings } = require('./settings');
const { currentUA } = require('./ua');
const { normalizeAccelerator } = require('./hotkeys');
const { extractWhatsappUrl, buildSendUrl } = require('./url-router');

const APP_NAME = 'WhatsApp Web';
const ACCOUNT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Green', value: '#00a884' },
  { label: 'Bright green', value: '#25d366' },
  { label: 'Red', value: '#f15c6d' },
  { label: 'Orange', value: '#ffa726' },
  { label: 'Purple', value: '#5c6bc0' },
  { label: 'Cyan', value: '#26c6da' },
];
const ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icon.png');
app.setPath('userData', path.join(app.getPath('appData'), 'Njobvu WhatsApp'));

let win = null;
let tray = null;
let store = null;
let manager = null;
let downloads = null;
let settings = null;

/* ---------------- config ---------------- */

const DEFAULT_CONFIG = {
  launchAtLogin: false,
  closeToTray: true,
  lastActiveId: null,
  windowBounds: null,
  windowMaximized: false,
  startMinimized: false,
  theme: 'system',
  downloadDir: '',
  globalHotkey: 'CommandOrControl+Shift+Space',
  hotkeyEnabled: false,
  accountSwitcherEnabled: true,
  accountHotkeysEnabled: false,
  autoCheckUpdates: false,
  spellcheck: true,
  spellcheckLanguage: 'en-US',
  screenshotBlock: false,
  ua: '',
};

let config = { ...DEFAULT_CONFIG };

const DEPRECATED_CONFIG_KEYS = [
  'lockEnabled',
  'lockPinHash',
  'lockPinSalt',
  'lockAutoMinutes',
];

function configFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    config = {
      ...DEFAULT_CONFIG,
      ...JSON.parse(fs.readFileSync(configFile(), 'utf8')),
    };
  } catch {
    /* defaults */
  }
  for (const key of DEPRECATED_CONFIG_KEYS) delete config[key];
}

function saveConfig() {
  try {
    fs.writeFileSync(configFile(), JSON.stringify(config, null, 2));
  } catch {
    /* ignore */
  }
}

try {
  loadConfig();
} catch {
  /* config not ready */
}

/* ---------------- UA (applied before ready for service workers) ---------------- */

let activeUA = currentUA(config.ua);
app.commandLine.appendSwitch('user-agent', activeUA);

/* ---------------- ctx ---------------- */

const ctx = {
  app,
  win: () => win,
  store: () => store,
  manager: () => manager,
  activeId: () => manager.activeId,
  loading: {},
  config,
  getUA: () => activeUA,
  activeUA,
  defaultSession: () => session.defaultSession,
};

/* ---------------- state / broadcast ---------------- */

function currentPayload() {
  return {
    accounts: store.toState(),
    loading: { ...ctx.loading },
    activeId: manager.activeId,
    theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
  };
}

function broadcast() {
  const payload = currentPayload();
  if (win && !win.isDestroyed()) {
    win.webContents.send('shell:state', payload);
    const total = store.accounts.reduce((sum, a) => sum + a.unread, 0);
    const active = store.get(manager.activeId);
    win.setTitle(
      active
        ? `${APP_NAME} — ${active.name}${total ? ` (${total})` : ''}`
        : APP_NAME
    );
  }
  if (tray) ctx.onTrayStateChanged();
  if (settings) settings.pushToSettingsWindow();
}

/* ---------------- settings helpers ---------------- */

function setLaunchAtLogin(enabled) {
  config.launchAtLogin = enabled;
  saveConfig();
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
  broadcast();
}

function setCloseToTray(enabled) {
  config.closeToTray = enabled;
  saveConfig();
  broadcast();
}

function registerAccountHotkeys() {
  let registered = 0;
  for (let n = 1; n <= 9; n++) {
    const accelerator = `Alt+${n}`;
    try {
      const ok = globalShortcut.register(accelerator, () => {
        const index = n - 1;
        if (!store || index >= store.accounts.length) return;
        selectAccountByIndex(index);
        ctx.showWindow();
      });
      if (ok) registered++;
    } catch {
      /* ignore */
    }
  }
  return registered > 0;
}

function rebindHotkey() {
  try {
    globalShortcut.unregisterAll();
    if (config.globalHotkey) {
      config.hotkeyEnabled = globalShortcut.register(config.globalHotkey, () =>
        ctx.toggleWindow()
      );
    } else {
      config.hotkeyEnabled = false;
    }
  } catch {
    config.hotkeyEnabled = false;
  }
  config.accountHotkeysEnabled = config.accountSwitcherEnabled
    ? registerAccountHotkeys()
    : false;
  saveConfig();
}

function getHotkeyStatus() {
  return {
    showHide: !config.globalHotkey
      ? 'disabled'
      : config.hotkeyEnabled
        ? 'active'
        : 'failed',
    accountSwitch: !config.accountSwitcherEnabled
      ? 'disabled'
      : config.accountHotkeysEnabled
        ? 'active'
        : 'failed',
  };
}

function toggleWindow() {
  if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) {
    win.hide();
  } else {
    ctx.showWindow();
  }
}

function applySpellcheckAll() {
  for (const account of store.accounts) {
    const view = manager.get(account.id);
    if (!view) continue;
    const ses = view.webContents.session;
    try {
      ses.setSpellCheckerEnabled(!!config.spellcheck);
      if (config.spellcheckLanguage) {
        ses.setSpellCheckerLanguages([config.spellcheckLanguage]);
      }
    } catch {
      /* ignore */
    }
  }
}

/* ---------------- view / account actions ---------------- */

function select(id) {
  if (!id || !store.get(id)) {
    manager.activeId = null;
    broadcast();
    return;
  }
  manager.select(id);
  config.lastActiveId = id;
  saveConfig();
  broadcast();
}

async function removeAccount(id) {
  const account = store.get(id);
  if (!account) return;
  const { response } = await dialog
    .showMessageBox(win, {
      type: 'warning',
      title: 'Remove account',
      message: `Remove "${account.name}"?`,
      detail: 'This will sign out and delete all local data for this account.',
      buttons: ['Remove', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    .catch(() => ({ response: 1 }));
  if (response !== 0) return;

  manager.remove(account);
  delete ctx.loading[id];
  store.remove(id);
  if (manager.activeId === id) {
    const remaining = store.accounts.map((a) => a.id);
    if (remaining.length) select(remaining[0]);
    else manager.activeId = null;
  }
  broadcast();
  ctx.toast(`Removed "${account.name}"`);
}

async function requestAddAccount() {
  const name = await openAccountModal({ title: 'Add account' });
  if (!name) return;
  const account = store.add(name);
  ctx.loading[account.id] = true;
  manager.add(account);
  select(account.id);
  ctx.toast(`Added "${account.name}"`, 'success');
}

function closeActiveAccount() {
  const id = manager.activeId;
  if (id) removeAccount(id);
}

async function renameAccount(id) {
  const account = store.get(id);
  if (!account) return null;
  const name = await openAccountModal({
    title: 'Rename account',
    currentName: account.name,
  });
  if (name) {
    store.rename(id, name);
    broadcast();
    ctx.toast(`Renamed to "${name}"`, 'success');
  }
  return name;
}

function switchAccount(delta) {
  const ids = store.accounts.map((a) => a.id);
  if (!ids.length) return;
  const idx = Math.max(0, ids.indexOf(manager.activeId));
  const next = (idx + delta + ids.length) % ids.length;
  select(ids[next]);
}

function selectAccountByIndex(index) {
  const ids = store.accounts.map((a) => a.id);
  if (index >= 0 && index < ids.length) select(ids[index]);
}

function toggleMute(accountId) {
  const account = store.get(accountId);
  if (!account) return;
  const muted = !account.muted;
  store.setMuted(accountId, muted);
  manager.setMuted(account, muted);
  broadcast();
}

function toggleMuteActive() {
  if (manager.activeId) toggleMute(manager.activeId);
}

function reloadAccount(accountId) {
  const account = store.get(accountId);
  if (account) manager.reload(account);
}

function openDevToolsFor(accountId) {
  const account = store.get(accountId);
  if (account) manager.openDevTools(account);
}

function openDevToolsActive() {
  if (manager.activeId) openDevToolsFor(manager.activeId);
}

function adjustZoom(accountId, delta) {
  const account = store.get(accountId);
  const view = account && manager.get(accountId);
  if (!account || !view) return;
  const next = Math.min(3, Math.max(0.5, Math.round(((account.zoom || 1) + delta) * 100) / 100));
  view.webContents.setZoomFactor(next);
  store.setZoom(accountId, next);
  broadcast();
}

function zoomActive(delta) {
  if (manager.activeId) adjustZoom(manager.activeId, delta);
}

function zoomResetActive() {
  const account = manager.activeId && store.get(manager.activeId);
  if (account) adjustZoom(manager.activeId, 1 - (account.zoom || 1));
}

function openSettings() {
  if (settings) settings.open();
}

/* ---------------- whatsapp:// links ---------------- */

function loadSendUrl(accountId, target) {
  if (accountId && accountId !== manager.activeId) select(accountId);
  const view = manager.activeView;
  if (view) view.webContents.loadURL(target);
}

function openWhatsappUrl(raw) {
  const target = buildSendUrl(raw);
  if (!target) return;
  const accounts = store.accounts;
  if (!accounts.length) return;
  ctx.showWindow();

  if (accounts.length === 1 || !win || win.isDestroyed()) {
    loadSendUrl(accounts[0].id, target);
    return;
  }

  const template = accounts.map((account) => ({
    label: account.name,
    click: () => loadSendUrl(account.id, target),
  }));
  if (manager.activeId) {
    template.push(
      { type: 'separator' },
      {
        label: `Active: ${store.get(manager.activeId)?.name || 'account'}`,
        click: () => loadSendUrl(manager.activeId, target),
      }
    );
  }
  Menu.buildFromTemplate(template).popup({ window: win });
}

/* ---------------- notifications ---------------- */

function onAccountNotify(account, payload) {
  const title = `${account.name} · WhatsApp`;
  const body =
    payload.title && payload.body
      ? `${payload.title}\n${payload.body}`
      : payload.body || payload.title || '';
  const notif = new Notification({
    title,
    body,
    silent: !!payload.silent,
    icon: ICON_PATH,
  });
  notif.on('click', () => {
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
    select(account.id);
  });
  notif.show();
}

function onLoading(accountId, loading) {
  ctx.loading[accountId] = loading;
  broadcast();
}

function onDownload(account, item) {
  downloads.handle(account, item);
}

/* ---------------- auto-update ---------------- */

let updateState = { status: 'idle', version: '', downloaded: false };
let updateTimer = null;

function configureUpdateChecks() {
  clearInterval(updateTimer);
  updateTimer = null;
  if (!app.isPackaged || !config.autoCheckUpdates) return;
  updateTimer = setInterval(() => {
    if (ctx.checkForUpdates) ctx.checkForUpdates();
  }, 60 * 60 * 1000);
}

function pushUpdateState() {
  if (settings) settings.pushUpdateState(updateState);
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updateState = { status: 'checking', version: '', downloaded: false };
    pushUpdateState();
  });
  autoUpdater.on('update-available', (info) => {
    updateState = {
      status: 'available',
      version: info.version || '',
      downloaded: false,
    };
    pushUpdateState();
  });
  autoUpdater.on('update-not-available', () => {
    updateState = { status: 'up-to-date', version: '', downloaded: false };
    pushUpdateState();
  });
  autoUpdater.on('download-progress', (progress) => {
    updateState = {
      status: 'downloading',
      version: updateState.version,
      downloaded: false,
      percent: Math.round(progress.percent || 0),
    };
    pushUpdateState();
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateState = {
      status: 'downloaded',
      version: info.version || '',
      downloaded: true,
    };
    pushUpdateState();
    ctx.toast?.(`Update ${updateState.version} is ready to install`, 'success');
  });
  autoUpdater.on('error', (err) => {
    updateState = {
      status: 'error',
      version: '',
      downloaded: false,
      message: (err && err.message) || 'Update check failed',
    };
    pushUpdateState();
  });

  ctx.checkForUpdates = () => {
    if (!app.isPackaged) {
      updateState = {
        status: 'error',
        version: '',
        downloaded: false,
        message: 'Auto-update only works in the packaged app.',
      };
      pushUpdateState();
      return;
    }
    autoUpdater.checkForUpdates().catch(() => {});
  };

  ctx.downloadUpdate = () => {
    autoUpdater.downloadUpdate().catch(() => {});
  };

  ctx.installUpdate = () => {
    autoUpdater.quitAndInstall(false, true);
  };

  ctx.getUpdateState = () => updateState;
}

/* ---------------- modal ---------------- */

function openAccountModal({ title, currentName = '' }) {
  return new Promise((resolve) => {
    const modal = new BrowserWindow({
      parent: win,
      modal: true,
      width: 420,
      height: 210,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#0b141a',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'modal-preload.js'),
        contextIsolation: true,
        sandbox: true,
      },
    });
    modal.loadFile(path.join(__dirname, '..', 'renderer', 'modal.html'));

    modal.webContents.on('did-finish-load', () => {
      modal.webContents.send('modal:init', { title, currentName });
    });

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (!modal.isDestroyed()) modal.destroy();
      resolve(value);
    };

    modal.webContents.on('ipc-message', (_event, channel, arg) => {
      if (channel === 'modal:submit') {
        finish(typeof arg === 'string' && arg.trim() ? arg.trim() : null);
      } else if (channel === 'modal:cancel') {
        finish(null);
      }
    });
    modal.on('closed', () => finish(null));
    modal.once('ready-to-show', () => modal.show());
  });
}

/* ---------------- window ---------------- */

let boundsTimer = null;
let layoutTimer = null;

function scheduleSaveBounds() {
  clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    try {
      const b = win.getNormalBounds();
      config.windowBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
      config.windowMaximized = win.isMaximized();
      saveConfig();
    } catch {
      /* ignore */
    }
  }, 400);
}

function relayoutSoon(delay = 60) {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => {
    if (manager && win && !win.isDestroyed()) manager.layout();
  }, delay);
}

function createWindow() {
  if (win && !win.isDestroyed()) return;

  let bounds = { width: 1200, height: 800 };
  if (config.windowBounds) {
    const b = config.windowBounds;
    if (typeof b.width === 'number' && b.width > 300) {
      bounds = { ...b };
    }
  }

  win = new BrowserWindow({
    ...bounds,
    minWidth: 520,
    minHeight: 400,
    show: false,
    autoHideMenuBar: true,
    icon: ICON_PATH,
    backgroundColor: '#0b141a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'shell-preload.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    if (manager && win && !win.isDestroyed()) manager.layout();
  });
  win.once('ready-to-show', () => {
    if (config.windowMaximized) win.maximize();
    if (config.startMinimized) win.hide();
    else win.show();
    relayoutSoon(150);
    relayoutSoon(500);
  });

  win.on('close', (event) => {
    if (config.closeToTray && !ctx.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    win = null;
    manager.destroyAll();
  });
  win.on('resize', () => {
    relayoutSoon();
    scheduleSaveBounds();
  });
  win.on('move', () => scheduleSaveBounds());
  win.on('maximize', () => {
    relayoutSoon();
    scheduleSaveBounds();
  });
  win.on('unmaximize', () => {
    relayoutSoon();
    scheduleSaveBounds();
  });
  win.on('restore', () => relayoutSoon());
  win.on('focus', () => manager.activeView?.webContents.focus());

  try {
    win.setContentProtection(!!config.screenshotBlock);
  } catch {
    /* ignore */
  }

  registerShortcuts(ctx, win.webContents);

  const startId =
    config.lastActiveId && store.get(config.lastActiveId)
      ? config.lastActiveId
      : store.accounts[0]?.id;
  if (startId) select(startId);
  else manager.activeId = null;

  relayoutSoon(100);
  broadcast();
}

/* ---------------- app lifecycle ---------------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const url = extractWhatsappUrl(argv || []);
    if (url) openWhatsappUrl(url);
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.on('window-all-closed', () => {
    /* keep running in tray */
  });

  app.on('before-quit', () => {
    ctx.isQuitting = true;
    clearInterval(updateTimer);
    try {
      globalShortcut.unregisterAll();
    } catch {
      /* ignore */
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.whatsappweb.WhatsAppWeb');
    app.setAsDefaultProtocolClient('whatsapp');

    activeUA = currentUA(config.ua);
    app.userAgentFallback = activeUA;

    nativeTheme.themeSource =
      config.theme === 'system' || !config.theme ? 'system' : config.theme;

    loadConfig();
    activeUA = currentUA(config.ua);
    app.userAgentFallback = activeUA;

    store = new AccountStore();
    manager = new ViewManager(ctx);
    downloads = new DownloadManager(ctx);
    ctx.downloads = downloads;

    ctx.onAccountNotify = onAccountNotify;
    ctx.onLoading = onLoading;
    ctx.onDownload = onDownload;
    ctx.requestAddAccount = requestAddAccount;
    ctx.closeActiveAccount = closeActiveAccount;
    ctx.switchAccount = switchAccount;
    ctx.selectAccountByIndex = selectAccountByIndex;
    ctx.toggleMuteActive = toggleMuteActive;
    ctx.openDevToolsActive = openDevToolsActive;
    ctx.reloadActive = () => {
      if (manager.activeId) reloadAccount(manager.activeId);
    };
    ctx.toggleFullScreen = () => {
      if (win && !win.isDestroyed()) win.setFullScreen(!win.isFullScreen());
    };
    ctx.openSettings = openSettings;
    ctx.zoomActive = zoomActive;
    ctx.zoomResetActive = zoomResetActive;
    ctx.select = select;
    ctx.toggleMute = toggleMute;
    ctx.reloadAccount = reloadAccount;
    ctx.openDevToolsFor = openDevToolsFor;
    ctx.setLaunchAtLogin = setLaunchAtLogin;
    ctx.setCloseToTray = setCloseToTray;
    ctx.broadcast = broadcast;
    ctx.currentPayload = currentPayload;
    ctx.config = config;
    ctx.saveConfig = saveConfig;
    ctx.toggleWindow = toggleWindow;
    ctx.rebindHotkey = rebindHotkey;
    ctx.getHotkeyStatus = getHotkeyStatus;
    ctx.configureUpdateChecks = configureUpdateChecks;
    ctx.toast = (message, kind = 'info') => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('shell:toast', { message, kind });
      }
    };
    ctx.openQuickSwitcher = () => {
      ctx.showWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('shell:showQuickSwitcher');
      }
    };
    ctx.applySpellcheckAll = applySpellcheckAll;
    ctx.applyUA = () => {
      activeUA = currentUA(config.ua);
      ctx.activeUA = activeUA;
      broadcast();
    };
    ctx.focusActive = () => {
      manager.activeView?.webContents.focus();
    };
    ctx.showWindow = () => {
      if (!win || win.isDestroyed()) {
        createWindow();
      } else {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    };
    ctx.isQuitting = false;

    setupAutoUpdater();
    configureUpdateChecks();

    Menu.setApplicationMenu(null);

    settings = registerSettings(ctx);
    createTray(ctx);
    createWindow();

    ipcMain.handle('shell:getState', () => currentPayload());
    ipcMain.handle('shell:addAccount', () => requestAddAccount());
    ipcMain.handle('shell:renameAccount', (_event, id) => renameAccount(id));
    ipcMain.on('shell:selectAccount', (_event, id) => select(id));
    ipcMain.on('shell:toggleMute', (_event, id) => toggleMute(id));
    ipcMain.on('shell:reloadAccount', (_event, id) => reloadAccount(id));
    ipcMain.on('shell:openDevTools', (_event, id) => openDevToolsFor(id));
    ipcMain.on('shell:openSettings', () => openSettings());
    ipcMain.on('shell:showTabMenu', (event, id) => {
      const account = store.get(id);
      if (!account) return;
      const winRef = BrowserWindow.fromWebContents(event.sender);
      const menu = Menu.buildFromTemplate([
        { label: 'Select', click: () => select(id) },
        { label: 'Rename…', click: () => renameAccount(id) },
        { label: 'Reload', click: () => reloadAccount(id) },
        {
          label: account.muted ? 'Unmute' : 'Mute',
          click: () => toggleMute(id),
        },
        {
          label: 'Color',
          submenu: ACCOUNT_COLORS.map((color) => ({
            label: color.label,
            click: () => {
              store.setColor(id, color.value);
              broadcast();
            },
          })),
        },
        { label: 'Remove', click: () => removeAccount(id) },
        { label: 'Open DevTools', click: () => openDevToolsFor(id) },
      ]);
      menu.popup({ window: winRef });
    });
    ipcMain.on('shell:closeAccount', (_event, id) => {
      removeAccount(id);
    });
    ipcMain.on('shell:reorderAccounts', (_event, ids) => {
      if (!Array.isArray(ids)) return;
      store.reorder(ids);
      broadcast();
    });
    ipcMain.on('shell:setColor', (_event, id, color) => {
      if (store.setColor(id, color)) broadcast();
    });

    /* settings IPC */
    ipcMain.handle('settings:get', () => settings.getSettings());
    ipcMain.handle('settings:set', (_event, key, value) => {
      ctx.setSetting(key, value);
      return settings.getSettings();
    });
    ipcMain.handle('settings:storage', () => settings.storageInfo());
    ipcMain.handle('settings:chooseDir', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openDirectory', 'createDirectory'],
      });
      return canceled ? null : filePaths[0] || null;
    });
    ipcMain.handle('settings:getDownloads', () => downloads.list);
    ipcMain.handle('settings:openPath', async (_event, p) => {
      if (!p) return;
      await shell.openPath(p);
    });
    ipcMain.handle('settings:clearCache', async (_event, accountId) => {
      const account = store.get(accountId);
      if (!account) return;
      await manager.get(accountId)?.webContents.session.clearCache();
      ctx.toast(`Cleared cache for "${account.name}"`, 'success');
    });
    ipcMain.handle('settings:clearData', async (_event, accountId) => {
      const account = store.get(accountId);
      if (!account) return;
      const view = manager.get(accountId);
      if (view) {
        const ses = view.webContents.session;
        await Promise.allSettled([ses.clearStorageData(), ses.clearCache()]);
        view.webContents.reload();
      }
      ctx.toast(`Cleared data for "${account.name}"`, 'success');
    });
    ipcMain.handle('settings:removeAccount', async (_event, id) => {
      await removeAccount(id);
    });

    /* update IPC */
    ipcMain.handle('update:getState', () => ctx.getUpdateState());
    ipcMain.handle('update:check', () => ctx.checkForUpdates());
    ipcMain.handle('update:download', () => ctx.downloadUpdate());
    ipcMain.handle('update:install', () => ctx.installUpdate());

    setLaunchAtLogin(config.launchAtLogin);
    applySpellcheckAll();
    rebindHotkey();

    const startupUrl = extractWhatsappUrl(process.argv);
    if (startupUrl) {
      setTimeout(() => openWhatsappUrl(startupUrl), 2000);
    }
  });
}
