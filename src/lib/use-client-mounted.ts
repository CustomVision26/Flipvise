"use client";

import { useEffect, useState } from "react";

/** True after the component has mounted (safe for browser-only UI). */
export function useClientMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
