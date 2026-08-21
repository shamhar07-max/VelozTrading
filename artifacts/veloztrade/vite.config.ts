import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
  ],
  define: {
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || ""
    ),
    "import.meta.env.VITE_CLERK_PROXY_URL": JSON.stringify(
      process.env.NODE_ENV === "production"
        ? (process.env.VITE_CLERK_PROXY_URL || "/api/__clerk")
        : ""
    ),
    "import.meta.env.VITE_WALLETCONNECT_PROJECT_ID": JSON.stringify(
      process.env.VITE_WALLETCONNECT_PROJECT_ID || ""
    ),
    "import.meta.env.VITE_PLATFORM_USDT_DEPOSIT_ADDRESS": JSON.stringify(
      process.env.VITE_PLATFORM_USDT_DEPOSIT_ADDRESS || ""
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store",
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: Number(process.env.PORT) || 3000,
    host: "0.0.0.0",
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' https://*.clerk.accounts.dev https://clerk.com https://*.clerk.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https://cdn.jsdelivr.net https://flagcdn.com https://img.logo.dev https://api.qrserver.com",
        "connect-src 'self' wss: https://api.twelvedata.com https://*.clerk.accounts.dev https://frontend-api.clerk.dev https://clerk.com https://*.clerk.com",
        "font-src 'self' https://fonts.gstatic.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
      "X-Frame-Options": "DENY",
    },
  },
});
