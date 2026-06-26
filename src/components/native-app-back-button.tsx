"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FLIPVISE_OFFLINE_SHELL_URL,
  isFlipviseNativeShell,
} from "@/lib/offline/is-flipvise-native-app";

/** Returns to the bundled offline Study shell inside the Capacitor app. */
export function NativeAppBackButton() {
  const [isNative, setIsNative] = React.useState(false);

  // Strict native-only: never show in a browser/PWA (those can't reach the shell URL).
  React.useEffect(() => {
    setIsNative(isFlipviseNativeShell());
  }, []);

  if (!isNative) return null;

  return (
    <Button
      variant="outline"
      onClick={() => {
        window.location.href = FLIPVISE_OFFLINE_SHELL_URL;
      }}
    >
      <ArrowLeft className="size-4" />
      Offline study
    </Button>
  );
}
