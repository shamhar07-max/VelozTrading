// Native bridge — activates ONLY when the web build runs inside a Capacitor
// shell (Android/iOS). On the regular website every call below is a no-op.
import { Capacitor } from "@capacitor/core";

export const isNative = (): boolean =>
  typeof window !== "undefined" && Capacitor.isNativePlatform();

export const LIVE_URL = "https://veloztrade.com";

/**
 * Wire native chrome: Android back button, status bar styling, splash hide.
 * Safe to call on web — resolves immediately without doing anything.
 */
export async function initNative(): Promise<void> {
  if (!isNative()) return;

  try {
    // Status bar — dark background, light icons, no layout overlay (we handle insets via CSS)
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0f172a" });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch { /* plugin unavailable */ }

  try {
    // Android hardware back button:
    //   • if a modal/dialog consumed it, the page handles it (listener returns)
    //   • else navigate WebView history; on first screen minimize app instead of exit
    const { App: AppPlugin } = await import("@capacitor/app");
    AppPlugin.addListener("backButton", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        AppPlugin.exitApp();
      }
    });
  } catch { /* plugin unavailable */ }
}

/** Hide launch splash once React has painted. */
export async function hideSplash(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch { /* plugin unavailable */ }
}
