import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import twemoji from "twemoji";
import { useStore } from "./store";
import Sidebar from "./components/Sidebar";
import Cursor from "./components/Cursor";
import QuickAddModal from "./components/QuickAddModal";
import Inbox from "./views/Inbox";
import Tasks from "./views/Daily";
import Today from "./views/Today";
import Weekly from "./views/Weekly";
import Goals from "./views/Goals";
import Habits from "./views/Habits";
import Calendar from "./views/Calendar";

const VIEW_TITLES: Record<string, string> = {
  inbox: "Inbox",
  today: "Today",
  tasks: "Tasks",
  weekly: "Weekly Review",
  goals: "Goals",
  habits: "Habits",
  calendar: "Calendar",
};

export default function App() {
  const { view, loadAll, loading, focusMode, setFocusMode } = useStore();
  const [quickAdd, setQuickAdd] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    loadAll();
    const win = getCurrentWindow();
    win.clearEffects().catch(() => {});
    win.setCursorVisible(false).catch(() => {});

    const INTERACTIVE =
      'button, a, input, select, textarea, [contenteditable], ' +
      '.task-item, .goal-card, .nav-item, .inbox-item, .habit-card, ' +
      '.subgoal-item, .cal-day, .cal-week-col, .cal-chip, ' +
      '.week-stat, .modal, .modal-overlay, .quick-add-btn, ' +
      '.task-check, .theme-btn, .titlebar-btn';

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      if (!(e.target as HTMLElement).closest(INTERACTIVE)) {
        win.startDragging().catch(() => {});
      }
    }

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      twemoji.parse(document.body, { folder: "svg", ext: ".svg", className: "twemoji" });
    }, 50);
    return () => clearTimeout(id);
  }, [view, loading, quickAdd]);

  const win = getCurrentWindow();

  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    await win.setAlwaysOnTop(next);
  }

  async function toggleFocus() {
    const next = !focusMode;
    setFocusMode(next);
    if (next) {
      await win.setMinSize(new LogicalSize(340, 400));
      await win.setSize(new LogicalSize(340, 720));
    } else {
      await win.setMinSize(new LogicalSize(900, 600));
      await win.setSize(new LogicalSize(1200, 800));
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className={`layout${focusMode ? " focus-mode" : ""}`}>
      <Cursor />
      {!focusMode && <Sidebar onQuickAdd={() => setQuickAdd(true)} />}
      <main className="main">
        <div className="topbar" data-tauri-drag-region>
          {focusMode
            ? <h2 className="focus-title">☀️ Today</h2>
            : <h2>{VIEW_TITLES[view]}</h2>}
          <div className="topbar-right">
            {!focusMode && <span className="topbar-date">{today}</span>}
            <button className={`pin-btn${pinned ? " active" : ""}`} onClick={togglePin} title={pinned ? "Unpin window" : "Pin on top"}>
              📌
            </button>
            <button className={`focus-btn${focusMode ? " active" : ""}`} onClick={toggleFocus} title={focusMode ? "Exit Focus" : "Focus Mode"}>
              {focusMode ? "✕ Exit Focus" : "⊙ Focus"}
            </button>
          </div>
        </div>
        <div className="content">
          {loading ? (
            <div className="empty-state"><p>Loading...</p></div>
          ) : focusMode ? (
            <Today />
          ) : (
            <>
              {view === "inbox" && <Inbox />}
              {view === "today" && <Today />}
              {view === "tasks" && <Tasks />}
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
