import path from "node:path";
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
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "www"),
    emptyOutDir: true,
    target: "es2020",
  },
});
