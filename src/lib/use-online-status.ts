"use client";

import * as React from "react";

/**
 * Tracks the browser/WebView online status. Starts as `true` so server-rendered markup
 * matches the first client paint (avoids hydration mismatch), then syncs on mount.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
