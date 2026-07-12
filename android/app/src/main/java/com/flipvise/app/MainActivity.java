package com.flipvise.app;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import android.app.NotificationChannel;
import android.app.NotificationManager;

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
        ensureDefaultNotificationChannel();

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
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    if (request != null && request.isForMainFrame() && error != null) {
                        CharSequence desc = error.getDescription();
                        String descText = desc != null ? desc.toString().toLowerCase() : "";
                        // Ignore aborted/cancelled navigations during Clerk/Next redirects only.
                        // Do NOT treat ERROR_UNKNOWN as cancelled — cleartext and other real failures
                        // use that code and must reach error.html (Refresh / Offline study).
                        if (
                            descText.contains("err_aborted") ||
                            descText.contains("cancelled") ||
                            descText.contains("canceled")
                        ) {
                            return;
                        }
                        if (loadConnectionErrorPage(view, request.getUrl(), descText)) {
                            return;
                        }
                    }
                    super.onReceivedError(view, request, error);
                }

                @Override
                public void onReceivedHttpError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceResponse errorResponse
                ) {
                    if (request != null && request.isForMainFrame() && errorResponse != null) {
                        int status = errorResponse.getStatusCode();
                        // Render cold starts often return 502/503 briefly — don't trap users on error.html.
                        if (status >= 500 && status < 600) {
                            return;
                        }
                    }
                    super.onReceivedHttpError(view, request, errorResponse);
                }

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

    /**
     * Replace Android's system "Webpage not available" screen with the bundled error.html
     * (Refresh + Offline study). Returns true when the recovery page was loaded.
     */
    private boolean loadConnectionErrorPage(WebView view, Uri failedUri, String descText) {
        String errorPage = getBridge().getErrorUrl();
        if (errorPage == null || errorPage.trim().isEmpty()) {
            return false;
        }
        Uri.Builder target = Uri.parse(errorPage).buildUpon();
        if (failedUri != null) {
            target.appendQueryParameter("url", failedUri.toString());
        }
        if (descText.contains("cleartext")) {
            target.appendQueryParameter("reason", "cleartext");
        }
        view.loadUrl(target.build().toString());
        return true;
    }

    /** FCM payloads use channel id flipvise_default (see AndroidManifest.xml). */
    private void ensureDefaultNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            "flipvise_default",
            "Flipvise",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Inbox messages and app updates");
        manager.createNotificationChannel(channel);
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
