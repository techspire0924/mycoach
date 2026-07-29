import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore, THEMES, type View } from "../store";
import {
  applyTransparency,
  getSavedTransparency,
  MAX_APP_TRANSPARENCY,
  TRANSPARENCY_STEP,
} from "../uiPreferences";

const NAV: { id: View; icon: string; label: string; section?: string }[] = [
  { id: "inbox",    icon: "📥", label: "Inbox",    section: "Capture" },
  { id: "today",    icon: "☀️", label: "Today",    section: "Plan" },
  { id: "tasks",    icon: "✅", label: "Tasks" },
  { id: "weekly",   icon: "📅", label: "Weekly" },
  { id: "goals",    icon: "🎯", label: "Goals",    section: "Track" },
  { id: "habits",   icon: "🔁", label: "Habits" },
  { id: "performance", icon: "📈", label: "Performance", section: "Review" },
  { id: "calendar", icon: "📆", label: "Calendar" },
];

interface Props { onQuickAdd: () => void; }

export default function Sidebar({ onQuickAdd }: Props) {
  const { view, setView, theme, setTheme } = useStore();
  const [transparency, setTransparency] = useState(getSavedTransparency);
  const win = "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null;

  function updateTransparency(value: number) {
    setTransparency(applyTransparency(value));
  }

  return (
    <aside className="sidebar">
      {/* Window controls row — draggable, with macOS-style buttons */}
      <div className="sidebar-titlebar" data-tauri-drag-region>
        <div className="sidebar-titlebar-controls">
          <button className="titlebar-btn titlebar-close"    onClick={() => win?.close()}          title="Close" />
          <button className="titlebar-btn titlebar-minimize" onClick={() => win?.minimize()}       title="Minimize" />
          <button className="titlebar-btn titlebar-maximize" onClick={() => win?.toggleMaximize()} title="Maximize" />
        </div>
      </div>

      <div className="sidebar-logo">
        <img src="/mycoach-icon.png" className="sidebar-logo-img" alt="MyCoach" />
        <div className="sidebar-logo-text">
          <h1>MyCoach</h1>
          <span>Personal Growth OS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <div key={item.id}>
            {item.section && <div className="nav-section">{item.section}</div>}
            <button
              className={`nav-item${view === item.id ? " active" : ""}`}
              onClick={() => setView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="theme-picker">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-btn${theme === t.id ? " active" : ""}`}
              onClick={() => setTheme(t.id)}
              title={t.name}
              style={{ background: `linear-gradient(135deg, ${t.dot1}, ${t.dot2})` }}
            />
          ))}
        </div>
        <div className="transparency-control">
          <div className="transparency-label">
            <span>Transparency</span>
            <span>{transparency}%</span>
          </div>
          <input
            className="transparency-slider"
            type="range"
            min="0"
            max={MAX_APP_TRANSPARENCY}
            step={TRANSPARENCY_STEP}
            value={transparency}
            onChange={(e) => updateTransparency(Number(e.target.value))}
            aria-label="Window transparency"
          />
        </div>
        <button className="quick-add-btn" onClick={onQuickAdd}>+ Quick Add</button>
      </div>
    </aside>
  );
}
