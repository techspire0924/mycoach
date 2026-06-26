import { useState } from "react";
import { useStore } from "../store";
import type { Task, Goal } from "../db/types";

type CalMode = "month" | "week" | "day";

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function taskOccursOnDate(task: Task, dateStr: string): boolean {
  if (task.task_type === "onetime") return task.due_date === dateStr;
  if (task.recurrence_end_date && dateStr > task.recurrence_end_date) return false;
  if (dateStr < task.created_at.slice(0, 10)) return false;
  const day = new Date(dateStr + "T12:00:00").getDay();
  if (task.recurrence_type === "daily") return true;
  if (task.recurrence_type === "workdays") return day >= 1 && day <= 5;
  if (task.recurrence_type === "custom" && task.recurrence_days) {
    return (JSON.parse(task.recurrence_days) as number[]).includes(day);
  }
  return false;
}

function itemsForDate(tasks: Task[], goals: Goal[], dateStr: string) {
  return {
    tasks: tasks.filter(t => taskOccursOnDate(t, dateStr)),
    goals: goals.filter(g => g.target_date === dateStr),
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar() {
  const { tasks, goals } = useStore();
  const today = fmtDate(new Date());

  const [mode, setMode] = useState<CalMode>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today);

  function navigate(dir: -1 | 1) {
    const d = new Date(anchor);
    if (mode === "month") d.setMonth(d.getMonth() + dir);
    else if (mode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setAnchor(d);
    if (mode === "day") setSelectedDate(fmtDate(d));
  }

  function selectDay(date: Date) {
    const ds = fmtDate(date);
    setSelectedDate(ds);
    setAnchor(new Date(date));
    setMode("day");
  }

  function getMonthGrid(): Date[] {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const days: Date[] = [];
    for (let i = first.getDay() - 1; i >= 0; i--) days.push(new Date(y, m, -i));
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d));
    let extra = 1;
    while (days.length < 42) days.push(new Date(y, m + 1, extra++));
    return days;
  }

  function getWeekDays(): Date[] {
    const d = new Date(anchor);
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d);
      dd.setDate(d.getDate() + i);
      return dd;
    });
  }

  function headerLabel(): string {
    if (mode === "month")
      return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (mode === "week") {
      const days = getWeekDays();
      const s = days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const e = days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${s} – ${e}`;
    }
    return new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  function renderMonth() {
    const grid = getMonthGrid();
    const currentMonth = anchor.getMonth();
    return (
      <div className="cal-month">
        <div className="cal-weekdays">
          {WEEKDAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
        </div>
        <div className="cal-grid">
          {grid.map((date, i) => {
            const ds = fmtDate(date);
            const items = itemsForDate(tasks, goals, ds);
            const total = items.tasks.length + items.goals.length;
            const inMonth = date.getMonth() === currentMonth;
            const maxChips = items.goals.length > 0 ? 1 : 2;
            const shown = [...items.goals.map(g => ({ type: "goal" as const, item: g })),
                           ...items.tasks.slice(0, maxChips).map(t => ({ type: "task" as const, item: t }))];
            const overflow = total - shown.length;
            return (
              <div
                key={i}
                className={[
                  "cal-day",
                  !inMonth && "cal-day--other",
                  ds === today && "cal-day--today",
                  ds === selectedDate && "cal-day--selected",
                ].filter(Boolean).join(" ")}
                onClick={() => selectDay(date)}
              >
                <span className="cal-day-num">{date.getDate()}</span>
                <div className="cal-day-chips">
                  {shown.map(({ type, item }) =>
                    type === "goal" ? (
                      <div key={item.id} className="cal-chip cal-chip--goal" title={item.title}>🎯 {item.title}</div>
                    ) : (
                      <div
                        key={item.id}
                        className={[
                          "cal-chip",
                          (item as Task).status === "done" && "cal-chip--done",
                          (item as Task).is_urgent && "cal-chip--urgent",
                        ].filter(Boolean).join(" ")}
                        title={item.title}
                      >
                        {(item as Task).task_type === "recurring" ? "↻ " : ""}{item.title}
                      </div>
                    )
                  )}
                  {overflow > 0 && <div className="cal-chip cal-chip--more">+{overflow} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWeek() {
    const days = getWeekDays();
    return (
      <div className="cal-week">
        {days.map((date, i) => {
          const ds = fmtDate(date);
          const items = itemsForDate(tasks, goals, ds);
          return (
            <div
              key={i}
              className={[
                "cal-week-col",
                ds === today && "cal-week-col--today",
                ds === selectedDate && "cal-week-col--selected",
              ].filter(Boolean).join(" ")}
            >
              <div className="cal-week-header" onClick={() => selectDay(date)}>
                <span className="cal-week-dayname">{WEEKDAYS[i]}</span>
                <span className="cal-week-daynum">{date.getDate()}</span>
              </div>
              <div className="cal-week-items">
                {items.goals.map(g => (
                  <div key={g.id} className="cal-chip cal-chip--goal">🎯 {g.title}</div>
                ))}
                {items.tasks.map(t => (
                  <div
                    key={t.id}
                    className={[
                      "cal-chip",
                      t.status === "done" && "cal-chip--done",
                      t.is_urgent && "cal-chip--urgent",
                    ].filter(Boolean).join(" ")}
                  >
                    {t.task_type === "recurring" ? "↻ " : ""}{t.title}
                  </div>
                ))}
                {items.tasks.length === 0 && items.goals.length === 0 && (
                  <div className="cal-week-empty">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderDay() {
    const items = itemsForDate(tasks, goals, selectedDate);
    return (
      <div className="cal-day-view">
        {items.goals.length > 0 && (
          <div className="cal-section">
            <div className="cal-section-label">Goals</div>
            {items.goals.map(g => (
              <div key={g.id} className="cal-event cal-event--goal">
                <span className="cal-event-icon">🎯</span>
                <span className="cal-event-title">{g.title}</span>
                <span className={`cal-event-status cal-event-status--${g.status}`}>{g.status}</span>
              </div>
            ))}
          </div>
        )}
        {items.tasks.length > 0 && (
          <div className="cal-section">
            <div className="cal-section-label">Tasks</div>
            {items.tasks.map(t => (
              <div
                key={t.id}
                className={["cal-event", t.status === "done" && "cal-event--done"].filter(Boolean).join(" ")}
              >
                <span className="cal-event-icon">
                  {t.task_type === "recurring" ? "↻" : t.status === "done" ? "✓" : "○"}
                </span>
                <span className="cal-event-title">{t.title}</span>
                {!!t.is_urgent && <span className="cal-event-urgent">urgent</span>}
                {t.parent_goal_id && (
                  <span className="cal-event-goal-ref">
                    {goals.find(g => g.id === t.parent_goal_id)?.title}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {items.tasks.length === 0 && items.goals.length === 0 && (
          <div className="empty-state"><p>Nothing scheduled</p></div>
        )}
      </div>
    );
  }

  return (
    <div className="cal-container">
      <div className="cal-header">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => navigate(-1)}>‹</button>
          <span className="cal-nav-label">{headerLabel()}</span>
          <button className="cal-nav-btn" onClick={() => navigate(1)}>›</button>
          <button className="cal-today-btn" onClick={() => { setAnchor(new Date()); setSelectedDate(today); }}>
            Today
          </button>
        </div>
        <div className="cal-mode-tabs">
          {(["month", "week", "day"] as CalMode[]).map(m => (
            <button
              key={m}
              className={`cal-mode-btn ${mode === m ? "active" : ""}`}
              onClick={() => setMode(m)}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {mode === "month" && renderMonth()}
      {mode === "week" && renderWeek()}
      {mode === "day" && renderDay()}
    </div>
  );
}
