import { useEffect, useRef, useState } from "react";
import twemoji from "twemoji";
import { useStore } from "./store";
import { appCalendarDate } from "./utils/date";
import { api } from "./db";
import Sidebar from "./components/Sidebar";
import QuickAddModal from "./components/QuickAddModal";
import Inbox from "./views/Inbox";
import Tasks from "./views/Daily";
import Today from "./views/Today";
import Weekly from "./views/Weekly";
import Goals from "./views/Goals";
import Habits from "./views/Habits";
import Calendar from "./views/Calendar";
import Performance from "./views/Performance";

const VIEW_TITLES: Record<string, string> = {
  inbox: "Inbox",
  today: "Today",
  tasks: "Tasks",
  weekly: "Weekly Review",
  goals: "Goals",
  habits: "Habits",
  calendar: "Calendar",
  performance: "Performance Tracker",
};

export default function App() {
  const { view, setView, loadAll, loading, focusMode, setFocusMode } = useStore();
  const [quickAdd, setQuickAdd] = useState(false);
  const { loaded, error, connected, pending, refresh, clearError } = useStore();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const navigationToggle = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const resize = () => { setCompact(query.matches); setNavigationOpen(false); };
    query.addEventListener('change', resize);
    return () => query.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!navigationOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    main.current?.setAttribute('inert', '');
    const close = () => { setNavigationOpen(false); navigationToggle.current?.focus(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
    document.querySelector<HTMLButtonElement>('.sidebar-close')?.focus();
    return () => {
      document.body.style.overflow = previous;
      main.current?.removeAttribute('inert');
      document.removeEventListener('keydown', escape);
      navigationToggle.current?.focus();
    };
  }, [navigationOpen]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view, focusMode]);
  const isPerformancePreview = import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("preview") === "performance";

  useEffect(() => {
    if (isPerformancePreview) void setView("performance");
    else void loadAll();
    const sync = () => { if (!document.hidden && !useStore.getState().pending) void refresh(); };
    const timer = window.setInterval(sync, 5000);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    const onFailure = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error) {
        useStore.setState({ error: event.reason.message });
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", onFailure);
    return () => {
      clearInterval(timer); document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync); window.removeEventListener("online", sync);
      window.removeEventListener("unhandledrejection", onFailure);
    };
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      twemoji.parse(document.body, { base: "/emoji/", folder: "svg", ext: ".svg", className: "twemoji" });
    }, 50);
    return () => clearTimeout(id);
  }, [view, loading, quickAdd]);

  function toggleFocus() { setFocusMode(!focusMode); }
  async function logout() {
    await api("/auth/logout", "POST");
    window.dispatchEvent(new Event("mycoach-logged-out"));
  }

  const today = appCalendarDate().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className={`layout${focusMode ? " focus-mode" : ""}${navigationOpen ? " navigation-open" : ""}${sidebarCollapsed && !compact ? " sidebar-collapsed" : ""}`}>
      {!focusMode && <Sidebar onQuickAdd={() => { setNavigationOpen(false); setQuickAdd(true); }} onNavigate={() => setNavigationOpen(false)} />}
      {navigationOpen && <button className="navigation-backdrop" aria-label="Dismiss navigation" tabIndex={-1} onClick={() => setNavigationOpen(false)} />}
      <main className="main" ref={main}>
        <div className="topbar">
          {!focusMode && <button className="btn btn-ghost nav-toggle" aria-label="Toggle navigation" ref={navigationToggle} aria-controls="app-navigation" aria-expanded={compact ? navigationOpen : !sidebarCollapsed} onClick={() => compact ? setNavigationOpen(!navigationOpen) : setSidebarCollapsed(!sidebarCollapsed)}>☰</button>}
          {focusMode
            ? <h2 className="focus-title">☀️ Today</h2>
            : <h2>{VIEW_TITLES[view]}</h2>}
          <div className="topbar-right">
            {!focusMode && <span className="topbar-date">{today}</span>}
            <button className={`focus-btn${focusMode ? " active" : ""}`} onClick={toggleFocus} title={focusMode ? "Exit Focus" : "Focus Mode"}>
              {focusMode ? "✕ Exit Focus" : "⊙ Focus"}
            </button>
            <button className="btn btn-ghost" onClick={() => void logout()}>Sign out</button>
          </div>
        </div>
        {error && <div className="connection-banner" role="alert"><span>{error}</span><button className="btn btn-ghost" onClick={() => { clearError(); void refresh(); }}>Retry</button><button className="btn btn-ghost" aria-label="Dismiss error" onClick={clearError}>×</button></div>}
        <div className="connection-status" role="status">{pending ? "Saving…" : connected ? "Connected · Shared on your home network" : "Disconnected · Reconnect to save"}</div>
        <div className="content" aria-busy={loading}>
          {loading ? (
            <div className="empty-state"><p>Loading...</p></div>
          ) : !loaded && !isPerformancePreview ? (
            <div className="empty-state"><p>Unable to load your data.</p><button className="btn btn-primary" onClick={() => void loadAll()}>Retry</button></div>
          ) : focusMode ? (
            <Today />
          ) : isPerformancePreview ? (
            <Performance />
          ) : (
            <>
              {view === "inbox" && <Inbox />}
              {view === "today" && <Today />}
              {view === "tasks" && <Tasks />}
              {view === "weekly" && <Weekly />}
              {view === "goals" && <Goals />}
              {view === "habits" && <Habits />}
              {view === "calendar" && <Calendar />}
              {view === "performance" && <Performance />}
            </>
          )}
        </div>
      </main>
      {quickAdd && <QuickAddModal onClose={() => setQuickAdd(false)} />}
    </div>
  );
}
