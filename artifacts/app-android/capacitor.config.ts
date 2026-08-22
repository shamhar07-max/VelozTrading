import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.veloztrade.app',
  appName: 'VelozTrade',
  webDir: '../veloztrade/dist/public',
  // Bundled build is primary. Live API/WebSocket goes to veloztrade.com.
  // For development, uncomment server.url to live-reload from production:
  // server: {
  //   url: 'https://veloztrade.com',
  //   cleartext: true,
  // },
  server: {
    androidScheme: 'https',
    // Allow navigation to veloztrade.com and subdomains
    allowNavigation: ['veloztrade.com', '*.veloztrade.com', 'veloztrading-production.up.railway.app'],
  },
  android: {
    backgroundColor: '#0f172a',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
      // Brand assets live in resources/ — copy into android/res after `cap add`:
      //   resources/splash.png → android/app/src/main/res/drawable*/splash.png
      //   resources/icon.png / icon-foreground.png → mipmap-* launchers
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
