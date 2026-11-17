package com.flipvise.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens the public Flipvise site in Chrome (or the device's default browser).
 * The page stays out of the app WebView. Custom Tabs are not used.
 */
@CapacitorPlugin(name = "FlipviseShell")
public class FlipviseShellPlugin extends Plugin {

    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (!isAllowedPage(url)) {
            call.reject("Unsupported url");
            return;
        }

        Uri uri = Uri.parse(url);
        Intent chrome = new Intent(Intent.ACTION_VIEW, uri);
        chrome.addCategory(Intent.CATEGORY_BROWSABLE);
        chrome.setPackage("com.android.chrome");
        chrome.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            startBrowser(chrome);
            call.resolve();
            return;
        } catch (ActivityNotFoundException ignored) {
            // Chrome is not installed. Open whichever browser the device uses.
        }

        Intent browser = new Intent(Intent.ACTION_VIEW, uri);
        browser.addCategory(Intent.CATEGORY_BROWSABLE);
        browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startBrowser(browser);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("Could not open Chrome", error);
        }
    }

    private void startBrowser(Intent intent) {
        if (getActivity() != null) {
            getActivity().startActivity(intent);
            return;
        }
        getContext().startActivity(intent);
    }

    private static boolean isAllowedPage(String url) {
        if (url == null || url.isEmpty()) return false;
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equals("https") || scheme.equals("http"))) return false;
        String host = uri.getHost();
        if (host == null) return false;
        String normalized = host.toLowerCase();
        return normalized.equals("learn.flipvisestudio.com")
            || normalized.endsWith(".flipvisestudio.com")
            || normalized.equals("flipvisestudio.com")
            || normalized.equals("localhost")
            || normalized.equals("127.0.0.1");
    }
}
