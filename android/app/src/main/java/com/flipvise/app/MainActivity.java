package com.flipvise.app;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    private static final String WEBVIEW_PREFS = "flipvise_webview";
    private static final String LAST_VERSION_KEY = "last_version_code";

    /**
     * Recover gracefully if the WebView renderer process dies (e.g. out-of-memory
     * while loading the heavy live site). Without this, Android tears down the whole
     * native app. Instead we reload the bundled offline shell so the user lands back
     * on a known-good screen rather than the app closing.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            clearWebViewCacheOnAppUpgrade(webView);

            // Clerk loads its auth client from a separate domain (e.g. *.clerk.accounts.dev),
            // so the session/handshake cookies are "third-party" relative to the live site.
            // Android WebViews block those by default, which prevents sign-in from persisting.
            // Allow them so in-app sign-in works.
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);

            webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    if (view != null) {
                        // Reload the offline home instead of the page that crashed
                        // (reloading the crashing page would just crash again).
                        view.loadUrl("https://localhost/index.html");
                        return true;
                    }
                    return super.onRenderProcessGone(view, detail);
                }
            });
        }
    }

    /** Drop cached live-site assets after each store/app upgrade so Team Admin UI updates ship. */
    private void clearWebViewCacheOnAppUpgrade(WebView webView) {
        try {
            PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            long versionCode = packageInfo.getLongVersionCode();
            SharedPreferences prefs = getSharedPreferences(WEBVIEW_PREFS, MODE_PRIVATE);
            long lastVersion = prefs.getLong(LAST_VERSION_KEY, 0L);
            if (versionCode != lastVersion) {
                webView.clearCache(true);
                prefs.edit().putLong(LAST_VERSION_KEY, versionCode).apply();
            }
        } catch (Exception ignored) {
            // Non-fatal — continue with existing cache.
        }
    }
}
