import { registerPlugin } from "@capacitor/core";

export interface FlipviseShellPlugin {
  /** Reload the WebView to the bundled offline Study shell (iOS native). */
  openOfflineShell(): Promise<void>;
  /** Open an http(s) URL in the device browser (Safari or the default Android browser). */
  openExternal(options: { url: string }): Promise<void>;
}

export const FlipviseShell = registerPlugin<FlipviseShellPlugin>("FlipviseShell");
