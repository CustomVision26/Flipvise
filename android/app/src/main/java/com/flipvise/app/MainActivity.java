package com.flipvise.app;

import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

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
}
