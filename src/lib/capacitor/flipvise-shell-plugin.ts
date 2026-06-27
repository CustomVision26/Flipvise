import { registerPlugin } from "@capacitor/core";

export interface FlipviseShellPlugin {
  /** Reload the WebView to the bundled offline Study shell (iOS native). */
  openOfflineShell(): Promise<void>;
}

export const FlipviseShell = registerPlugin<FlipviseShellPlugin>("FlipviseShell");
