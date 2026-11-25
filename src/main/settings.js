const path = require('node:path');
const fs = require('node:fs');
const { BrowserWindow, nativeTheme, shell } = require('electron');

const DEFAULT_LANG = 'en-US';

function dirSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const p = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else {
        try {
          total += fs.statSync(p).size;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function registerSettings(ctx) {
  let settingsWin = null;

  function open() {
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.show();
      settingsWin.focus();
      return;
    }
    settingsWin = new BrowserWindow({
      width: 900,
      height: 660,
      minWidth: 720,
      minHeight: 480,
      parent: ctx.win(),
      title: `${ctx.app.getName()} — Settings`,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#0b141a',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'settings-preload.js'),
        contextIsolation: true,
        sandbox: true,
      },
    });
    settingsWin.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
    settingsWin.on('closed', () => {
      settingsWin = null;
    });
    settingsWin.once('ready-to-show', () => settingsWin.show());
  }

  function effectiveTheme() {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }

  function getSettings() {
    let languages = [];
    try {
      languages = ctx.defaultSession().availableSpellCheckerLanguages;
    } catch {
      /* ignore */
    }
    const config = { ...ctx.config };
    return {
      config,
      languages,
      theme: effectiveTheme(),
      ua: ctx.getUA(),
      version: ctx.app.getVersion(),
      downloads: ctx.downloads.list,
      update: ctx.getUpdateState(),
    };
  }

  function pushToSettingsWindow() {
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('settings:state', getSettings());
    }
  }

  function pushUpdateState(state) {
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('settings:update', state);
    }
  }

  function storageInfo() {
    const partitions = path.join(ctx.app.getPath('userData'), 'Partitions');
    const entries = [];
    for (const account of ctx.store().accounts) {
      const folder = `persist:whatsapp-${account.id}`;
      const size = dirSize(path.join(partitions, folder));
      entries.push({
        id: account.id,
        name: account.name,
        size,
        sizeHuman: formatBytes(size),
      });
    }
    return entries;
  }

  const apply = {
    theme(value) {
      ctx.config.theme = value;
      nativeTheme.themeSource = value === 'auto' ? 'system' : value;
    },
    launchAtLogin(value) {
      ctx.setLaunchAtLogin(!!value);
    },
    closeToTray(value) {
      ctx.setCloseToTray(!!value);
    },
    startMinimized(value) {
      ctx.config.startMinimized = !!value;
    },
    downloadDir(value) {
      ctx.config.downloadDir = value || '';
    },
    globalHotkey(value) {
      ctx.config.globalHotkey = value || '';
      ctx.rebindHotkey();
    },
    spellcheck(value) {
      ctx.config.spellcheck = !!value;
      ctx.applySpellcheckAll();
    },
    spellcheckLanguage(value) {
      ctx.config.spellcheckLanguage = value || DEFAULT_LANG;
      ctx.applySpellcheckAll();
    },
    screenshotBlock(value) {
      ctx.config.screenshotBlock = !!value;
      try {
        ctx.win()?.setContentProtection(!!value);
      } catch {
        /* ignore */
      }
    },
    ua(value) {
      ctx.config.ua = value || '';
      ctx.applyUA();
    },
  };

  ctx.setSetting = (key, value) => {
    if (typeof apply[key] === 'function') apply[key](value);
    ctx.saveConfig();
    ctx.broadcast();
    pushToSettingsWindow();
  };

  nativeTheme.on('updated', () => {
    ctx.broadcast();
    pushToSettingsWindow();
  });

  return {
    open,
    getSettings,
    storageInfo,
    pushToSettingsWindow,
    pushUpdateState,
  };
}

module.exports = { registerSettings };
