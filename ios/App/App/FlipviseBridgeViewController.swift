import Capacitor

class FlipviseBridgeViewController: CAPBridgeViewController {
    private var didRegisterShellPlugin = false

    override open func capacitorDidLoad() {
        guard !didRegisterShellPlugin else { return }
        didRegisterShellPlugin = true
        bridge?.registerPluginInstance(FlipviseShellPlugin())
    }
}
