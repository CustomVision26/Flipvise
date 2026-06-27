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
  define: {
    "import.meta.env.BASE_URL": JSON.stringify("./"),
    "import.meta.env.VITE_LIVE_URL": JSON.stringify(
      process.env.VITE_LIVE_URL ?? "https://flipvise-sjgw.onrender.com",
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "..", "src"),
    },
  },
  plugins: [
    react(),
    {
      name: "flipvise-capacitor-html",
      apply: "build",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          let out = html.replace(/\s+crossorigin/g, "");
          out = out.replace(/\s+type="module"/g, "");
          out = out.replace(/<link rel="modulepreload"[^>]*>\s*/g, "");
          const appScript = out.match(/<script src="\.\/assets\/app\.js"><\/script>/);
          if (appScript) {
            out = out.replace(appScript[0], "");
            out = out.replace("</body>", `    ${appScript[0]}\n  </body>`);
          }
          return out;
        },
      },
    },
  ],
  build: {
    outDir: path.resolve(__dirname, "www"),
    emptyOutDir: true,
    target: "es2020",
    // One JS file — iOS WKWebView often fails to load secondary Vite chunks (MIME/CORS).
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        extend: true,
        name: "FlipviseOffline",
      },
    },
  },
});
