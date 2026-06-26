import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import twemoji from "twemoji";
import { useStore } from "./store";
import Sidebar from "./components/Sidebar";
import Cursor from "./components/Cursor";
import QuickAddModal from "./components/QuickAddModal";
import Inbox from "./views/Inbox";
import Daily from "./views/Daily";
import Weekly from "./views/Weekly";
import Goals from "./views/Goals";
import Habits from "./views/Habits";
import Calendar from "./views/Calendar";

const VIEW_TITLES: Record<string, string> = {
  inbox: "Inbox",
  daily: "Daily Plan",
  weekly: "Weekly Review",
  goals: "Goals",
  habits: "Habits",
  calendar: "Calendar",
};

export default function App() {
  const { view, loadAll, loading } = useStore();
  const [quickAdd, setQuickAdd] = useState(false);

  useEffect(() => {
    loadAll();
    getCurrentWindow().clearEffects().catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      twemoji.parse(document.body, { folder: "svg", ext: ".svg", className: "twemoji" });
    }, 50);
    return () => clearTimeout(id);
  }, [view, loading, quickAdd]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="layout">
      <Cursor />
      <Sidebar onQuickAdd={() => setQuickAdd(true)} />
      <main className="main">
        <div className="topbar" data-tauri-drag-region>
          <h2>{VIEW_TITLES[view]}</h2>
          <span className="topbar-date">{today}</span>
        </div>
        <div className="content">
          {loading ? (
            <div className="empty-state"><p>Loading...</p></div>
          ) : (
            <>
              {view === "inbox" && <Inbox />}
              {view === "daily" && <Daily />}
              {view === "weekly" && <Weekly />}
              {view === "goals" && <Goals />}
              {view === "habits" && <Habits />}
              {view === "calendar" && <Calendar />}
            </>
          )}
        </div>
      </main>
      {quickAdd && <QuickAddModal onClose={() => setQuickAdd(false)} />}
    </div>
  );
}
