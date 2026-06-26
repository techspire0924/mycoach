import { useStore, type View } from "../store";

const NAV: { id: View; icon: string; label: string; section?: string }[] = [
  { id: "inbox", icon: "📥", label: "Inbox", section: "Capture" },
  { id: "daily", icon: "☀️", label: "Daily", section: "Plan" },
  { id: "weekly", icon: "📅", label: "Weekly" },
  { id: "goals", icon: "🎯", label: "Goals", section: "Track" },
  { id: "habits", icon: "🔁", label: "Habits" },
];

interface Props {
  onQuickAdd: () => void;
}

export default function Sidebar({ onQuickAdd }: Props) {
  const { view, setView } = useStore();

  return (
    <aside className="sidebar">
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
        <button className="quick-add-btn" onClick={onQuickAdd}>+ Quick Add</button>
      </div>
    </aside>
  );
}
