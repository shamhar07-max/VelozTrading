# VelozTrade — Android App

Native Android wrapper for `https://veloztrade.com` built with **Capacitor 6**.

## Prerequisites (one-time)

- **Node 22+ + pnpm 10** (same as web)
- **Android Studio** + SDK + Platform Tools (for `gradlew`)
- **Java 17+** (`JAVA_HOME` set)

## First-time setup

```bash
cd artifacts/app-android

# 1) Build the web app
pnpm run build:web

# 2) Initialize Capacitor (only once)
pnpm run cap:init

# 3) Add Android platform (only once, creates ./android folder)
pnpm run cap:add

# 4) Set app icon & splash (copy from veloztrade public)
# Replace android/app/src/main/res/* with your branded assets, or use:
# npx capacitor-assets generate --androidBackgroundColor "#0f172a"
```

## Build APK

```bash
# Debug APK (installable on any device, no signing)
pnpm run build:apk:debug
# → android/app/build/outputs/apk/debug/app-debug.apk

# Release AAB for Play Store (needs signing)
pnpm run build:aab
# → android/app/build/outputs/bundle/release/app-release.aab
```

Install on device:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Live updates without store review

The WebView loads the **bundled** `dist/public` but all data (prices, trades) is live from `https://veloztrade.com` via API/WebSocket. To ship a UI fix, just rebuild the web app and sync:

```bash
pnpm run build:web && pnpm run cap:copy
```

## Signing for release

1. Generate keystore: `keytool -genkey -v -keystore veloztrade.keystore -alias veloztrade -keyalg RSA -keysize 2048 -validity 10000`
2. Create `android/gradle.properties`:
```
MYAPP_UPLOAD_STORE_FILE=veloztrade.keystore
MYAPP_UPLOAD_KEY_ALIAS=veloztrade
MYAPP_UPLOAD_STORE_PASSWORD=*****
MYAPP_UPLOAD_KEY_PASSWORD=*****
```
3. `android/app/build.gradle` already wires these keys for `release`.

## Troubleshooting

- `ERR_CORS` in WebView → backend `ALLOWED_ORIGINS` already allows `capacitor://localhost` (patched in `app.ts`)
- White screen → check `adb logcat | grep Capacitor`
- WebSocket fails → ensure `wss://veloztrade.com` is in CSP (already allowed)
