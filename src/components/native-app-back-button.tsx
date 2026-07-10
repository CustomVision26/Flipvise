"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  detectNativeShellNow,
  navigateToOfflineShellFast,
} from "@/lib/offline/is-flipvise-native-app";

const NATIVE_BTN_CLASS =
  "min-h-11 touch-manipulation active:scale-[0.98] transition-transform";

/** Returns to the bundled offline Study shell inside the Capacitor app. */
export function NativeAppBackButton() {
  const [isNative] = React.useState(detectNativeShellNow);
  const [leaving, setLeaving] = React.useState(false);

  if (!isNative) return null;

  return (
    <Button
      variant="outline"
      className={NATIVE_BTN_CLASS}
      disabled={leaving}
      onPointerDown={() => {
        if (leaving) return;
        setLeaving(true);
        navigateToOfflineShellFast();
      }}
    >
      <ArrowLeft className="size-4" />
      {leaving ? "Opening…" : "Offline study"}
    </Button>
  );
}
