import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource-variable/inter";
import "./styles.css";
import AuthGate from "./components/AuthGate";

// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem("mycoach-theme") ?? "cosmic";
document.documentElement.setAttribute("data-theme", savedTheme);


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthGate><App /></AuthGate>
  </React.StrictMode>,
);
