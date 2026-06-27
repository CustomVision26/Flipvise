import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { LockGate } from "./lock-gate";
import "./styles.css";

declare global {
  interface Window {
    __flipviseDismissBootSplash?: () => void;
  }
}

function showFatalStartupError(message: string) {
  window.__flipviseDismissBootSplash?.();
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "app lock-screen";
  panel.innerHTML =
    '<div class="lock-screen__inner">' +
    '<p class="lock-screen__title">Could not start Flipvise</p>' +
    '<p class="lock-screen__hint"></p>' +
    "</div>";
  const hint = panel.querySelector(".lock-screen__hint");
  if (hint) hint.textContent = message;
  root.appendChild(panel);
}

try {
  const container = document.getElementById("root");
  if (!container) throw new Error("Root element #root not found");

  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

  createRoot(container).render(
    <LockGate>
      <div className="app-watermark" aria-hidden>
        <img src={logoUrl} alt="" />
      </div>
      <App />
    </LockGate>,
  );

  window.__flipviseDismissBootSplash?.();
} catch (err) {
  const detail = err instanceof Error ? err.message : String(err);
  showFatalStartupError(detail);
}
