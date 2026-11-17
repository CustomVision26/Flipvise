import Capacitor

/// Reloads the in-app WebView to the bundled offline Study shell (`capacitor://localhost`).
@objc(FlipviseShellPlugin)
public class FlipviseShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlipviseShellPlugin"
    public let jsName = "FlipviseShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openOfflineShell", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openExternal", returnType: CAPPluginReturnPromise),
    ]

    @objc func openOfflineShell(_ call: CAPPluginCall) {
        guard let bridge = self.bridge else {
            call.reject("Capacitor bridge unavailable")
            return
        }

        let serverURL = bridge.config.serverURL
        DispatchQueue.main.async {
            bridge.webView?.load(URLRequest(url: serverURL))
            call.resolve()
        }
    }

    /// Opens the URL in Safari (or the user's default browser), not an in-app Safari view.
    @objc func openExternal(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http" else {
            call.reject("Missing url")
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve()
                } else {
                    call.reject("Could not open the browser")
                }
            }
        }
    }
}
