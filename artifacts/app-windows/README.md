# VelozTrade — Windows App

Native Windows wrapper for `https://veloztrade.com` built with **Electron 33**.

## Prerequisites (one-time, on Windows or any machine with Node)

- **Node 22+ + pnpm 10**
- **Windows 10/11** for building the installer (or use GitHub Actions on any OS)

## Quick start (dev)

```bash
cd artifacts/app-windows
pnpm install

# Run with live production site
pnpm run dev
# → opens a 1280×800 window loading https://veloztrade.com

# Point at local dev server instead:
VELOZTRADE_URL=http://localhost:5173 pnpm run dev
```

## Build installer

```bash
# 1) Ensure the web app is built (optional — Electron loads live URL, but bundling is good for offline fallback)
pnpm run build:web

# 2) Build Windows installer + portable exe
pnpm run build
# → release/VelozTrade Setup 1.0.0.exe  (NSIS installer, x64 + ia32)
# → release/VelozTrade-Portable-1.0.0.exe

# Portable only (no install, single exe):
pnpm run build:portable
```

**Icon:** Replace `build/icon.ico` with a 256×256 ICO. Current build uses `logo.svg` as placeholder — convert via https://icoconvert.com or `pnpm dlx svg-to-ico`.

## Distribution

- **NSIS installer** — double-click, installs to Program Files, Start Menu + Desktop shortcuts, uninstaller included.
- **Portable exe** — runs without install, ideal for USB/demo.

Both load **live** `https://veloztrade.com` so UI updates deploy instantly without rebuilding the Windows app. To ship an offline fallback, change `LIVE_URL` in `src/main.js` to `win.loadFile(...)`.

## Auto-update (optional)

Add `electron-updater` + GitHub Releases. The scaffold is ready — wire `autoUpdater` in `main.js` and publish releases via `electron-builder --publish always`.

## Troubleshooting

- White screen → check `https://veloztrade.com` is reachable; app shows live site, not bundled files.
- CORS errors → backend already allows `capacitor://`, `http://localhost`, and no-origin — Electron's `file://` is covered.
- DevTools → View → Toggle Developer Tools
