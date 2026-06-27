#!/usr/bin/env node
/**
 * Ensures mobile/www (and optionally ios/App/App/public) index.html references
 * assets that exist on disk. Prevents shipping TestFlight builds with a black
 * screen when the main JS bundle is missing from the native project.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function verifyWebDir(label, webDir) {
  const indexPath = path.join(webDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`[${label}] Missing ${indexPath}`);
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const refs = [
    ...html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g),
  ].map((m) => m[1]);

  if (refs.length === 0) {
    throw new Error(`[${label}] No ./ asset references found in index.html`);
  }

  const missing = refs.filter((ref) => {
    const assetPath = path.join(webDir, ref.replace(/^\.\//, ""));
    return !fs.existsSync(assetPath);
  });

  if (missing.length > 0) {
    throw new Error(
      `[${label}] index.html references missing files:\n${missing.map((m) => `  - ${m}`).join("\n")}\nRun: npm run mobile:build:prod && npx cap sync ios`,
    );
  }

  console.log(`[${label}] OK — ${refs.length} bundled assets verified`);
}

const dirs = [
  ["mobile/www", path.join(root, "mobile", "www")],
  ["ios/App/App/public", path.join(root, "ios", "App", "App", "public")],
];

let checked = 0;
for (const [label, dir] of dirs) {
  if (!fs.existsSync(dir)) {
    console.log(`[${label}] skipped (directory not present)`);
    continue;
  }
  verifyWebDir(label, dir);
  checked += 1;
}

if (checked === 0) {
  throw new Error("No mobile web directories found to verify");
}
