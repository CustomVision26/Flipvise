import Capacitor

/// Reloads the in-app WebView to the bundled offline Study shell (`capacitor://localhost`).
@objc(FlipviseShellPlugin)
public class FlipviseShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlipviseShellPlugin"
    public let jsName = "FlipviseShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openOfflineShell", returnType: CAPPluginReturnPromise),
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
}
