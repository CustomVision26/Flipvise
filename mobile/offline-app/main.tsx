import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { LockGate } from "./lock-gate";
import { markBootSplashReady, startBootSplashTimer } from "./boot-splash";
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

  startBootSplashTimer();

  createRoot(container).render(
    <LockGate>
      <div className="app-scene" aria-hidden>
        <img
          className="app-scene__light"
          src={`${import.meta.env.BASE_URL}artwork/woodland-light.png`}
          alt=""
        />
        <img
          className="app-scene__dark"
          src={`${import.meta.env.BASE_URL}artwork/woodland-dark.png`}
          alt=""
        />
      </div>
      <App />
    </LockGate>,
  );
} catch (err) {
  markBootSplashReady();
  const detail = err instanceof Error ? err.message : String(err);
  showFatalStartupError(detail);
}
