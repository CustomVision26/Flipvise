import path from "node:path";
import fs from "node:fs";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

/**
 * Build config for the bundled offline Study app.
 *
 * Source lives in `mobile/offline-app/`; the production build is emitted into
 * `mobile/www/`, which is the Capacitor `webDir`. Run with `npm run mobile:build`.
 *
 * `base: "./"` makes asset URLs relative so they resolve under the native
 * capacitor:// (Android) and file:// (iOS) schemes.
 */
export default defineConfig({
  root: path.resolve(__dirname, "offline-app"),
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "..", "src"),
    },
  },
  plugins: [
    react(),
    {
      name: "flipvise-capacitor-html",
      closeBundle() {
        const indexPath = path.resolve(__dirname, "www", "index.html");
        if (!fs.existsSync(indexPath)) return;
        let html = fs.readFileSync(indexPath, "utf8");
        // WKWebView + capacitor://localhost can reject module scripts with crossorigin.
        html = html.replace(/\s+crossorigin/g, "");
        fs.writeFileSync(indexPath, html);
      },
    },
  ],
  build: {
    outDir: path.resolve(__dirname, "www"),
    emptyOutDir: true,
    target: "es2020",
  },
});
