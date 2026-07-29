import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyTransparency, getSavedTransparency } from "./uiPreferences";

// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem("mycoach-theme") ?? "cosmic";
document.documentElement.setAttribute("data-theme", savedTheme);
applyTransparency(getSavedTransparency());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
