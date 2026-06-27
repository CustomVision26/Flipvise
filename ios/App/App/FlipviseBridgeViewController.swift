import Capacitor

class FlipviseBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(FlipviseShellPlugin())
    }
}
