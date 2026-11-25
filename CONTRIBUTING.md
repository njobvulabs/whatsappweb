# Contributing

This is a plain CommonJS Electron app with no bundler or framework.

## Setup

```bash
bash setup.sh
```

Use `bash setup.sh --skip-deps` if Node and `rsvg-convert` are already installed.

## Verification

```bash
npm run check
npm start
npm run build
```

`npm run check` runs `node --check` over every JS file. There are no test, lint
or typecheck scripts. `npm start` needs a display session; `npm run build` needs
`rsvg-convert` on PATH. To avoid touching real sessions, run the app with a
temporary config directory:

```bash
XDG_CONFIG_HOME=/tmp/opencode/njobvu-verify npm start
```

## Conventions

- Read `AGENTS.md` before changing wiring between main, preload and renderer.
- Every `window.api.*` call needs a matching `ipcMain` handler in `src/main/main.js`.
- Add new cross-module callbacks to the `ctx` object in `main.js`.
- Keep `dist/` and `node_modules/` out of git; releases are uploaded by CI.
