"use client";

import * as React from "react";
import { useEffect } from "react";

export function ForceDarkTheme({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const applyDarkTheme = () => {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.removeAttribute("data-ui-theme");
    };

    applyDarkTheme();

    const observer = new MutationObserver(() => {
      if (!document.documentElement.classList.contains("dark") || 
          document.documentElement.hasAttribute("data-ui-theme")) {
        applyDarkTheme();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-ui-theme"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return <div className="dark">{children}</div>;
}
