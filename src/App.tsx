import { useEffect, useState } from "react";
import { getCurrentWindow, Effect, EffectState } from "@tauri-apps/api/window";
import { useStore } from "./store";
import Sidebar from "./components/Sidebar";
import Cursor from "./components/Cursor";
import QuickAddModal from "./components/QuickAddModal";
import Inbox from "./views/Inbox";
import Daily from "./views/Daily";
import Weekly from "./views/Weekly";
import Goals from "./views/Goals";
import Habits from "./views/Habits";

const VIEW_TITLES: Record<string, string> = {
  inbox: "Inbox",
  daily: "Daily Plan",
  weekly: "Weekly Review",
  goals: "Goals",
  habits: "Habits",
};

export default function App() {
  const { view, loadAll, loading } = useStore();
  const [quickAdd, setQuickAdd] = useState(false);

  useEffect(() => {
    loadAll();
    getCurrentWindow().setEffects({
      effects: [Effect.HudWindow],
      state: EffectState.Active,
    }).catch(() => {});
  }, []);

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
            </>
          )}
        </div>
      </main>
      {quickAdd && <QuickAddModal onClose={() => setQuickAdd(false)} />}
    </div>
  );
}
