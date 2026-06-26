import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore, THEMES, type View } from "../store";

const NAV: { id: View; icon: string; label: string; section?: string }[] = [
  { id: "inbox",    icon: "📥", label: "Inbox",    section: "Capture" },
  { id: "today",    icon: "☀️", label: "Today",    section: "Plan" },
  { id: "tasks",    icon: "✅", label: "Tasks" },
  { id: "weekly",   icon: "📅", label: "Weekly" },
  { id: "goals",    icon: "🎯", label: "Goals",    section: "Track" },
  { id: "habits",   icon: "🔁", label: "Habits" },
  { id: "calendar", icon: "📆", label: "Calendar", section: "Review" },
];

interface Props { onQuickAdd: () => void; }

export default function Sidebar({ onQuickAdd }: Props) {
  const { view, setView, theme, setTheme } = useStore();
  const win = getCurrentWindow();

  return (
    <aside className="sidebar">
      {/* Window controls row — draggable, with macOS-style buttons */}
      <div className="sidebar-titlebar" data-tauri-drag-region>
        <div className="sidebar-titlebar-controls">
          <button className="titlebar-btn titlebar-close"    onClick={() => win.close()}          title="Close" />
          <button className="titlebar-btn titlebar-minimize" onClick={() => win.minimize()}       title="Minimize" />
          <button className="titlebar-btn titlebar-maximize" onClick={() => win.toggleMaximize()} title="Maximize" />
        </div>
      </div>

      <div className="sidebar-logo">
        <h1>MyCoach</h1>
        <span>Personal Growth OS</span>
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
        <button className="quick-add-btn" onClick={onQuickAdd}>+ Quick Add</button>
      </div>
    </aside>
  );
}
