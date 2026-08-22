import type { CapacitorConfig } from '@capacitor/cli';

// ── VelozTrade Android shell ────────────────────────────────────────────────
// Architecture (senior decision, 2026-08): REMOTE SHELL.
//   The WebView loads the live site directly. Rationale:
//   • Clerk sessions are same-origin cookies — bundled SPA + cross-origin API
//     breaks auth silently (the original blank-screen bug)
//   • /config.js runtime key injection only exists behind Express
//   • UI fixes deploy instantly with zero app updates
// The bundled webDir remains as required scaffolding + offline error page.
const config: CapacitorConfig = {
  appId: 'com.veloztrade.app',
  appName: 'VelozTrade',
  webDir: '../veloztrade/dist/public',
  server: {
    // Primary: the dedicated mobile app UI (native-app look & feel),
    // served same-origin as the platform → Clerk cookies + WS just work
    url: 'https://veloztrade.com/m',
    androidScheme: 'https',
    allowNavigation: [
      'veloztrade.com', '*.veloztrade.com',
      'veloztrading-production.up.railway.app',
      'clerk.veloztrade.com', '*.clerk.accounts.dev',
    ],
  },
  android: {
    backgroundColor: '#0f172a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0f172a',
      splashFullScreen: true,
      splashImmersive: true,
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
