const path = require('node:path');
const { session, shell, WebContentsView } = require('electron');
const { registerShortcuts } = require('./shortcuts');

const TAB_BAR_HEIGHT = 48;
const WHATSAPP_URL = 'https://web.whatsapp.com';
const VIEW_BACKGROUND = '#0b141a';

const ALLOWED_HOSTS = new Set([
  'web.whatsapp.com',
  'www.whatsapp.com',
  'whatsapp.com',
  'api.whatsapp.com',
  'mmg.whatsapp.net',
  'static.whatsapp.net',
  'pps.whatsapp.net',
  'm.facebook.com',
  'www.facebook.com',
  'facebook.com',
  'fb.watch',
]);

function isAllowedUrl(url) {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

const ALLOWED_PERMISSIONS = new Set([
  'notifications',
  'media',
  'display-capture',
  'fullscreen',
  'clipboard-read',
  'clipboard-sanitized-write',
  'geolocation',
  'idle-detection',
]);

class ViewManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.views = new Map();
    this.activeId = null;
    this.cacheCleared = new Set();
  }

  get win() {
    return this.ctx.win();
  }

  get store() {
    return this.ctx.store();
  }

  add(account) {
    const view = new WebContentsView({
      webPreferences: {
        partition: `persist:whatsapp-${account.id}`,
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        sandbox: true,
        contextIsolation: false,
        autoplayPolicy: 'no-user-gesture-required',
        spellcheck: true,
      },
    });
    view.setBackgroundColor(VIEW_BACKGROUND);

    this.views.set(account.id, view);
    this.win.contentView.addChildView(view);
    this.hookSession(account, view.webContents.session);
    this.hookWebContents(account, view.webContents);
    registerShortcuts(this.ctx, view.webContents);
    view.webContents.setZoomFactor(account.zoom || 1);
    if (account.muted) view.webContents.setAudioMuted(true);
    view.webContents.loadURL(WHATSAPP_URL);
    this.layout();
    this.ctx.onLoading(account.id, true);
    return view;
  }

  remove(account) {
    const view = this.views.get(account.id);
    if (!view) return;
    this.views.delete(account.id);
    this.win.contentView.removeChildView(view);
    view.webContents.close();
    const partition = `persist:whatsapp-${account.id}`;
    const ses = session.fromPartition(partition);
    Promise.allSettled([ses.clearStorageData(), ses.clearCache()]).catch(
      () => {}
    );
  }

  destroyAll() {
    for (const view of this.views.values()) {
      this.win.contentView.removeChildView(view);
      view.webContents.close();
    }
    this.views.clear();
    this.activeId = null;
  }

  get(accountId) {
    return this.views.get(accountId);
  }

  get activeView() {
    return this.activeId ? this.views.get(this.activeId) : null;
  }

  select(accountId) {
    const account = this.store.get(accountId);
    if (!account && !this.views.has(accountId)) return;
    if (!this.views.has(accountId)) this.add(account);
    for (const [id, view] of this.views) {
      if (id === accountId) {
        view.setVisible(true);
        view.webContents.focus();
      } else {
        view.setVisible(false);
      }
    }
    this.activeId = accountId;
  }

  layout() {
    const win = this.win;
    if (!win || win.isDestroyed()) return;
    const [width, height] = win.getContentSize();
    for (const view of this.views.values()) {
      view.setBounds({
        x: 0,
        y: TAB_BAR_HEIGHT,
        width,
        height: height - TAB_BAR_HEIGHT,
      });
    }
  }

  hookSession(account, ses) {
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission));
    });
    ses.setPermissionCheckHandler((_wc, permission) =>
      ALLOWED_PERMISSIONS.has(permission)
    );
    ses.setDevicePermissionHandler(() => true);

    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = this.ctx.getUA();
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    try {
      ses.setSpellCheckerEnabled(!!this.ctx.config.spellcheck);
      if (this.ctx.config.spellcheckLanguage) {
        ses.setSpellCheckerLanguages([this.ctx.config.spellcheckLanguage]);
      }
    } catch {
      /* ignore */
    }

    ses.on('will-download', (_event, item) => {
      this.ctx.onDownload(account, item);
    });
  }

  hookWebContents(account, wc) {
    wc.setWindowOpenHandler(({ url }) => {
      if (isAllowedUrl(url)) return { action: 'allow' };
      shell.openExternal(url);
      return { action: 'deny' };
    });

    wc.on('will-navigate', (event, url) => {
      if (!isAllowedUrl(url)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    wc.on('page-title-updated', (_event, title) => {
      const match = /^\((\d+)\)/.exec(title || '');
      const count = match ? parseInt(match[1], 10) : 0;
      if (this.store.setUnread(account.id, count)) {
        this.ctx.broadcast();
      }
    });

    wc.on('did-finish-load', () => {
      if (this.cacheCleared.has(account.id)) return;
      this.cacheCleared.add(account.id);
      wc.executeJavaScript(
        '(async () => { try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch (e) {} })()'
      ).catch(() => {});
    });

    wc.on('did-start-loading', () => this.ctx.onLoading(account.id, true));
    wc.on('did-stop-loading', () => this.ctx.onLoading(account.id, false));

    wc.on('ipc-message', (_event, channel, payload) => {
      if (channel === 'account:notify') {
        this.ctx.onAccountNotify(account, payload || {});
      }
    });
  }

  setMuted(account, muted) {
    const view = this.views.get(account.id);
    if (view) view.webContents.setAudioMuted(muted);
  }

  reload(account) {
    const view = this.views.get(account.id);
    if (view) view.webContents.reload();
  }

  openDevTools(account) {
    const view = this.views.get(account.id);
    if (view) view.webContents.openDevTools({ mode: 'detach' });
  }
}

module.exports = { ViewManager, TAB_BAR_HEIGHT, WHATSAPP_URL };
