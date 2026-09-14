import { useStore, THEMES, type View } from "../store";

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

interface Props { onQuickAdd: () => void; onNavigate: () => void; }

export default function Sidebar({ onQuickAdd, onNavigate }: Props) {
  const { view, setView, theme, setTheme } = useStore();
  return (
    <aside className="sidebar" id="app-navigation" aria-label="Primary navigation">
      <button className="btn btn-ghost sidebar-close" onClick={onNavigate} aria-label="Close navigation">✕ Close</button>
      <div className="sidebar-logo">
        <img src="/mycoach-web-icon.png" className="sidebar-logo-img" alt="MyCoach" />
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
              onClick={() => { void setView(item.id); onNavigate(); }}
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
