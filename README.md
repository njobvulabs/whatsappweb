# WhatsApp Web

A multi-account WhatsApp Web desktop client for Linux, packaged as an AppImage.
Run several WhatsApp accounts side by side in one window — each account keeps its
own fully isolated session, so you can be signed in to multiple numbers at once.

Built with Electron.

## Features

- **Multiple accounts** — add/rename/remove accounts as tabs in a single window
- **On-demand loading** — only the active account loads at startup; the others
  load the first time you click their tab (saves memory/network)
- **Isolated sessions** — each account uses its own `persist:` partition (cookies,
  service workers, storage are never shared)
- **Notifications & tray** — per-account native notifications, tray icon with
  account switcher and unread counts
- **`whatsapp://` links** — `whatsapp://send?phone=...` and `wa.me` links open
  straight in the app (after desktop integration)
- **Appearance** — dark/light/system theme
- **Downloads** — choose a download folder or prompt each time; recent downloads
  are listed in Settings
- **Privacy** — block screenshots/capture (`setContentProtection`), spellcheck
  toggle + language, per-account "clear cache" / "clear all data" from Settings
- **Account management in Settings** — remove an account (and all its data) from
  Settings → Storage
- **User-agent override** — keeps WhatsApp Web on the modern layout and avoids
  the "update Google Chrome" screen
- **Global hotkey** — show/hide the window from anywhere (default
  `Ctrl+Shift+Space`, configurable)
- **Global account switching** — `Alt+1` … `Alt+9` jump to account N from
  anywhere and show/focus the window
- **Zoom** — per-account zoom factor (`Ctrl+=` / `Ctrl+-` / `Ctrl+0`)
- **Auto-update** — checks GitHub Releases for updates (see *Releases & updates*)

## Requirements

- Linux with a desktop environment (Arch, Debian/Ubuntu, Fedora or openSUSE
  are auto-detected; other distros need git/node/npm/librsvg (`rsvg-convert`),
  fuse2 and xdg-utils manually)
- A display session (X11 or Wayland)

## Quick start (fresh copy / after OS reinstall)

Copy the folder anywhere and run:

```bash
bash setup.sh
```

This detects your distro, installs the required system packages
(`nodejs`, `npm`, `librsvg`, `fuse2`, `xdg-utils`, … via sudo), installs npm
dependencies, builds the AppImage, and registers the desktop launcher +
`whatsapp://` handler. It is idempotent — safe to re-run.

Options:

```bash
bash setup.sh               # full setup (installs system packages if needed)
bash setup.sh --skip-deps   # skip system package installation
```

To remove the app from the system:

```bash
bash uninstall.sh           # removes launcher + whatsapp:// handler (keeps app data)
bash uninstall.sh --all     # also removes dist/, node_modules/ and the legacy data dir
```

> The AppImage is built for the architecture of the machine you run this on
> (e.g. x86-64 on a standard PC, arm64 when run on an ARM machine).

## Run / build

```bash
npm start                 # run from source (dev)
npm run build             # rebuild the AppImage -> dist/WhatsApp-Web-*.AppImage
bash setup.sh             # system deps + deps + build + integration in one go
bash uninstall.sh         # remove launcher + whatsapp:// handler (+ --all for artifacts/data)
npm run install:integration   # only re-register the launcher + whatsapp:// handler
```

After the build you can also run the packaged app directly:

```bash
./dist/WhatsApp-Web-*.AppImage
```

## Desktop integration (`whatsapp://` links)

`scripts/install-integration.sh` installs:

- a `.desktop` launcher in `~/.local/share/applications/com.whatsappweb.WhatsAppWeb.desktop`
- the app icon in `~/.local/share/icons/hicolor/512x512/apps/`
- the default handler for the `x-scheme-handler/whatsapp` MIME type

Once registered, clicking a `whatsapp://` link in your browser opens WhatsApp
Web (it reuses the running instance and routes the link to the active
account). Verify with:

```bash
xdg-mime query default x-scheme-handler/whatsapp
# -> com.whatsappweb.WhatsAppWeb.desktop
```

The script auto-detects the AppImage in `dist/` or `~/Applications/`, or you can
point it at one explicitly: `APPIMAGE=/path/to/App.AppImage bash setup.sh`.

## Releases & updates

Auto-update uses [electron-updater](https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater)
against GitHub Releases. The publish config lives in `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: njobvulabs
  repo: whatsappweb
```

To enable auto-update for real:

1. Create the repository on GitHub (or change `owner`/`repo` to your own).
2. `git init` and add a `.gitignore` containing `node_modules/` and `dist/`.
3. Publish a release:

   ```bash
   GH_TOKEN=ghp_... npx electron-builder --linux AppImage --publish always
   ```

   or create the release manually in the GitHub UI and upload
   `dist/WhatsApp-Web-<version>.AppImage` plus `dist/latest-linux.yml`
   (electron-builder's `--publish always` uploads these automatically).

4. In the app: Settings → About → **Check for updates**.

If a release repo isn't configured, the app reports the check gracefully and
never blocks startup.

## Keyboard shortcuts

| Shortcut            | Action                    |
| ------------------- | ------------------------- |
| `Ctrl+T`            | Add account              |
| `Ctrl+W`            | Close (remove) active    |
| `Ctrl+Tab`          | Switch account           |
| `Ctrl+1` … `Ctrl+9` | Jump to account N        |
| `Alt+1` … `Alt+9`   | Jump to account N globally (shows window) |
| `Ctrl+Shift+M`      | Mute / unmute active     |
| `Ctrl+,`            | Settings                 |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out            |
| `Ctrl+0`            | Reset zoom               |
| `Ctrl+Shift+I`      | DevTools for active      |

## Settings

Open Settings (`Ctrl+,` or tray → Settings). Highlights:

- **General** — launch at login, start minimized, minimize-to-tray on close,
  download folder, global show/hide hotkey, custom user agent
- **Appearance** — dark / light / system theme
- **Downloads** — recent downloads with "Open" shortcut
- **Privacy** — block screenshots, spellcheck + language
- **Storage** — per-account "Clear cache" / "Clear all data" (signs out) and
  "Remove account" (deletes the account and its session)
- **About** — version, user agent, **Check for updates**

## Data locations

- App data: `~/.config/Njobvu WhatsApp/` (legacy path kept on purpose so existing
  accounts and sessions survive the rename)
  - `accounts.json` — account list
  - `config.json` — settings
  - `Partitions/persist:whatsapp-<id>/` — per-account session data
  - `downloads.json` — recent downloads history

Deleting an account removes its `accounts.json` entry and clears its partition.

## Project layout

```
assets/                 icon sources (generated PNGs)
scripts/
  gen-icon.js           generates assets/icon*.png + icon.svg
  install-integration.sh  installs .desktop + whatsapp:// handler
src/
  main/                 Electron main process
    main.js             app lifecycle, window, IPC, auto-update
    accounts.js         account store (accounts.json)
    view-manager.js     per-account WebContentsView, sessions, downloads
    downloads.js        download manager
    settings.js         settings window + state
    shortcuts.js        in-page keyboard shortcuts
    tray.js             tray icon + menu
    ua.js               user-agent builder
  preload/              contextBridge preloads (shell, settings, modal, whatsapp)
  renderer/             shell UI (tab bar), settings UI, account modal
electron-builder.yml    packaging + publish config
package.json            scripts + dependencies
setup.sh                one-shot setup: deps + build + integration
```

## Notes

- The app sets a modern Chrome user agent at the Chromium level (before app
  ready), so WhatsApp Web keeps working in the packaged build. Changing the UA
  in Settings applies to new requests immediately; service workers need a
  restart.
- The AppImage runs with `--no-sandbox` (electron-builder's default AppImage
  wrapper behavior).
- "Block screenshots" also blocks screen sharing of the window — turn it off if
  you present your screen.
- Global `Alt+1` … `Alt+9` use Electron's globalShortcuts portal on Wayland. The
  desktop file must stay `com.whatsappweb.WhatsAppWeb.desktop`; GNOME can
  silently deny binds with an unresolvable ID, and the first bind may ask for
  consent. On X11/XFCE a desktop environment may already own a combo — in that
  case `globalShortcut.register` reports failure and that key is skipped.
