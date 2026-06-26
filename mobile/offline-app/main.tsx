import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

createRoot(container).render(
  <React.StrictMode>
    <div className="app-watermark" aria-hidden>
      <img src={logoUrl} alt="" />
    </div>
    <App />
  </React.StrictMode>,
);
