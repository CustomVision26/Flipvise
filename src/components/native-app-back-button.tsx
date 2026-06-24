"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FLIPVISE_OFFLINE_SHELL_URL,
  isFlipviseNativeApp,
} from "@/lib/offline/is-flipvise-native-app";

/** Returns to the bundled offline Study shell inside the Capacitor app. */
export function NativeAppBackButton() {
  const [isNative, setIsNative] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      if (isFlipviseNativeApp()) {
        setIsNative(true);
        return;
      }
      try {
        const { isFlipviseNativeAppAsync } = await import(
          "@/lib/offline/is-flipvise-native-app"
        );
        if (await isFlipviseNativeAppAsync()) setIsNative(true);
      } catch {
        // ignore
      }
    })();
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
