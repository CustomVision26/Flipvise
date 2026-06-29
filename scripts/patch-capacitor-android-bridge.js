/**
 * Patches Capacitor Android Bridge.java so the native JS bridge is injected on
 * `server.allowNavigation` origins (not only the bundled app origin).
 *
 * Without this, navigating to the live site inside the WebView leaves plugins
 * (SQLite, Preferences) unavailable on Android API 37+.
 *
 * Upstream: https://github.com/ionic-team/capacitor/issues/7454
 */
const fs = require("fs");
const path = require("path");

const bridgePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@capacitor",
  "android",
  "capacitor",
  "src",
  "main",
  "java",
  "com",
  "getcapacitor",
  "Bridge.java",
);

if (!fs.existsSync(bridgePath)) {
  process.exit(0);
}

const content = fs.readFileSync(bridgePath, "utf8");

const oldBlock = `        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            String allowedOrigin = Uri.parse(appUrl).buildUpon().path(null).fragment(null).clearQuery().build().toString();
            try {
                WebViewCompat.addDocumentStartJavaScript(webView, injector.getScriptString(), Collections.singleton(allowedOrigin));
                injector = null;
            } catch (IllegalArgumentException ex) {
                Logger.warn("Invalid url, using fallback");
            }
        }`;

const newBlock = `        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Set<String> injectionOrigins = new HashSet<>();
            String allowedOrigin = Uri.parse(appUrl).buildUpon().path(null).fragment(null).clearQuery().build().toString();
            injectionOrigins.add(allowedOrigin);
            for (String rule : allowedOriginRules) {
                if (rule.startsWith("http")) {
                    try {
                        Uri originUri = Uri.parse(rule).buildUpon().path(null).fragment(null).clearQuery().build();
                        injectionOrigins.add(originUri.toString());
                        if ("https".equals(originUri.getScheme())) {
                            injectionOrigins.add(
                                originUri.buildUpon().scheme("http").build().toString()
                            );
                        }
                    } catch (Exception ignored) {
                        // skip invalid rule
                    }
                }
            }
            try {
                WebViewCompat.addDocumentStartJavaScript(webView, injector.getScriptString(), injectionOrigins);
                injector = null;
            } catch (IllegalArgumentException ex) {
                Logger.warn("Invalid url, using fallback");
            }
        }`;

const previousBlock = `        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Set<String> injectionOrigins = new HashSet<>();
            String allowedOrigin = Uri.parse(appUrl).buildUpon().path(null).fragment(null).clearQuery().build().toString();
            injectionOrigins.add(allowedOrigin);
            for (String rule : allowedOriginRules) {
                if (rule.startsWith("http")) {
                    try {
                        Uri originUri = Uri.parse(rule).buildUpon().path(null).fragment(null).clearQuery().build();
                        injectionOrigins.add(originUri.toString());
                    } catch (Exception ignored) {
                        // skip invalid rule
                    }
                }
            }
            try {
                WebViewCompat.addDocumentStartJavaScript(webView, injector.getScriptString(), injectionOrigins);
                injector = null;
            } catch (IllegalArgumentException ex) {
                Logger.warn("Invalid url, using fallback");
            }
        }`;

if (content.includes(newBlock)) {
  process.exit(0);
}

if (content.includes(previousBlock)) {
  fs.writeFileSync(bridgePath, content.replace(previousBlock, newBlock));
  console.log(
    "[patch-capacitor-android-bridge] Upgraded patch with http injection mirrors.",
  );
  process.exit(0);
}

if (!content.includes(oldBlock)) {
  console.warn(
    "[patch-capacitor-android-bridge] Bridge.java block not found; skipping.",
  );
  process.exit(0);
}

fs.writeFileSync(bridgePath, content.replace(oldBlock, newBlock));
console.log(
  "[patch-capacitor-android-bridge] Patched allowNavigation JS injection.",
);
