import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { initNative, hideSplash, isNative, LIVE_URL } from "./lib/native";
import "./index.css";

// ── Native shell bootstrap ──────────────────────────────────────────────────
// When running inside the Android/iOS wrapper the bundled SPA is a fallback
// only; the wrapper's primary mode loads LIVE_URL directly. If we ever land
// on the bundled copy in native (e.g. cold start race), bounce to live so
// Clerk/API/WS always work — this is what previously caused a blank screen.
if (isNative() && window.location.protocol !== "https:") {
  window.location.replace(LIVE_URL);
} else {
  void initNative();

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );

  // Hide splash after first paint + one frame for images/fonts to settle
  requestAnimationFrame(() => setTimeout(() => void hideSplash(), 250));
}

