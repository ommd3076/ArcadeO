import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./theme/theme.css";
import { registerServiceWorker } from "./app/service-worker-registration";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  registerServiceWorker();
}
