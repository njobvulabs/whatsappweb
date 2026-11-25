# AGENTS.md

Electron 45 desktop app, plain CommonJS (no bundler/framework). Entry: `src/main/main.js`.

## Verification

- No test, lint, or typecheck framework exists. Run `npm run check` (node --check over all JS); verify behavior with `npm start` (needs a display session) and packaging with `npm run build`.
- `npm run build` / `build:dir` first run `scripts/gen-icon.js`, which shells out to `rsvg-convert` (librsvg); `setup.sh` installs it, but bare `npm run build` still needs it on PATH.
- `npm run install:integration` only re-registers the launcher + `whatsapp://` handler; it requires an existing AppImage in `dist/` or `~/Applications/` (override with `APPIMAGE=...`).

## Wiring

- `main.js` owns a mutable `ctx` object; main-process modules receive `ctx` and call back through it (`ctx.broadcast`, `ctx.onLoading`, etc.). Wire new cross-module callbacks there instead of importing `main.js`.
- Renderer state is one-way: `broadcast()` sends `shell:state` / `settings:state`; `src/renderer/tabs.js` and `settings.js` only render and call `window.api.*`. New state must be added to `currentPayload()` / `getSettings()` and followed by `broadcast()`.
- Four separate preload surfaces, each with its own `window.api` contract: `shell-preload.js` (tab bar), `settings-preload.js`, `modal-preload.js`, and `preload.js` for WhatsApp views. Every renderer call needs a matching `ipcMain` handler in `main.js`.
- Account views are Electron 45 `WebContentsView` children (not legacy `BrowserView`), with `contextIsolation: false` while shell/settings/modal windows use `true`. `preload.js` deliberately overwrites `window.Notification` in-page to funnel notifications over IPC; flipping that flag breaks notifications.
- Shortcuts are registered twice via `registerShortcuts(ctx, webContents)`: on the shell window and on every account view (`before-input-event`). Edit `src/main/shortcuts.js`, not the callers. `Ctrl+Shift+K` calls `ctx.openQuickSwitcher()`, which sends `shell:showQuickSwitcher` to the shell renderer. The native application menu is disabled with `Menu.setApplicationMenu(null)` so Alt-based global shortcuts never reveal a menu bar; reload/fullscreen are handled through `ctx.reloadActive()` / `ctx.toggleFullScreen()`.
- Global `Alt+1`–`Alt+9` switching is separate: `main.js` registers it with `globalShortcut` inside `rebindHotkey()` (which calls `unregisterAll()`), then calls `selectAccountByIndex()` + `ctx.showWindow()`. The `accountSwitcherEnabled` config can disable it; binding status is surfaced through `getSettings()`. `desktopName` must stay a reverse-DNS ID matching the installed `.desktop` file or Wayland's shortcut portal can silently deny binds.

## Quirks

- Accounts load on demand: `ViewManager.select()` creates a view on first click; each uses partition `persist:whatsapp-<id>` and occupies `height - TAB_BAR_HEIGHT` (48). Window events only relayout via debounced `relayoutSoon()`.
- `ALLOWED_HOSTS` in `src/main/view-manager.js` gates both `will-navigate` and `window.open`; other URLs go to `shell.openExternal`. Add a host there before linking to a new domain from a view.
- User agent is applied three ways: `app.commandLine.appendSwitch('user-agent')` before ready, `app.userAgentFallback`, and per-session `onBeforeSendHeaders`. Changing it in Settings affects new requests only; service workers need a restart.
- Single-instance lock routes `whatsapp://` and `wa.me` argv through `extractWhatsappUrl()` / `buildSendUrl()` in `src/main/url-router.js` on both startup and `second-instance`. With multiple accounts, `openWhatsappUrl()` shows a chooser menu before loading the send URL.
- `accounts.json`, `config.json`, and `downloads.json` live in `~/.config/Njobvu WhatsApp/`; `main.js` pins `app.setPath('userData', ...)` to that legacy path through the rename so sessions survive. `loadConfig()` merges defaults and strips obsolete lock-related keys.
- Auto-update is a no-op unless `app.isPackaged`; `electron-updater` checks from Settings → About or hourly when `autoCheckUpdates` is enabled. `.github/workflows/release.yml` publishes tagged `v*.*.*` builds; the `publish` target in `electron-builder.yml` is `njobvulabs/whatsappweb`, and `npmRebuild: false`.
- Tab order and per-account color are persisted in `accounts.json`; `Alt+1`–`Alt+9` follow the reordered list.
