import MutationFeedback from "../components/MutationFeedback";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { HabitLog } from "../db/types";
import ConfirmDialog from "../components/ConfirmDialog";
import { toLocalDateKey, appCalendarDate, timestampDate } from "../utils/date";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCurrentWeekDays(): { label: string; date: string }[] {
  const today = appCalendarDate();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label: DAYS[d.getDay()], date: toLocalDateKey(d) };
  });
}

function computeStreak(logs: HabitLog[], frequency: "daily" | "weekly"): number {
  if (!logs.length) return 0;
  const logSet = new Set(logs.map((l) => l.logged_date));

  if (frequency === "daily") {
    const today = appCalendarDate();
    const todayStr = toLocalDateKey(today);
    const d = new Date(today);
    if (!logSet.has(todayStr)) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (logSet.has(toLocalDateKey(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  } else {
    const today = appCalendarDate();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekMon = new Date(today);
    weekMon.setDate(today.getDate() + diff);

    const weekHasLog = (mon: Date): boolean => {
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        if (logSet.has(toLocalDateKey(d))) return true;
      }
      return false;
    };

    const cur = new Date(weekMon);
    if (!weekHasLog(cur)) cur.setDate(cur.getDate() - 7);
    let streak = 0;
    while (weekHasLog(cur)) {
      streak++;
      cur.setDate(cur.getDate() - 7);
    }
    return streak;
  }
}

function HabitName({ name }: { name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateOverflow = () => {
      const text = textRef.current;
      if (!text) return;
      setIsOverflowing(text.scrollWidth > container.clientWidth + 1);
    };

    updateOverflow();
    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(container);
    document.fonts.ready.then(updateOverflow);

    return () => resizeObserver.disconnect();
  }, [name]);

  return (
    <div
      ref={containerRef}
      className={`habit-name${isOverflowing ? " habit-name--overflowing" : ""}`}
      title={name}
    >
      <span ref={textRef} className="habit-name-static">{name}</span>
      {isOverflowing && (
        <div className="habit-name-track">
          <span className="habit-name-text">{name}</span>
          <span className="habit-name-text" aria-hidden="true">{name}</span>
        </div>
      )}
    </div>
  );
}

function formatFinished(timestamp: string): string {
  return timestampDate(timestamp).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Habits() {
  const { habits, habitLogs, loadHabitLogs, toggleHabit, addHabit, removeHabit, completeHabit, resumeHabit } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmFinishId, setConfirmFinishId] = useState<string | null>(null);
  const weekDays = getCurrentWeekDays();
  const activeHabits = habits.filter((h) => !h.finished_at);
  const finishedHabits = habits.filter((h) => h.finished_at);

  useEffect(() => {
    habits.forEach((h) => loadHabitLogs(h.id));
  }, [habits, loadHabitLogs]);

  function isLogged(habitId: string, date: string): boolean {
    return (habitLogs[habitId] ?? []).some((l) => l.logged_date === date);
  }

  function isLoggedThisWeek(habitId: string): boolean {
    return weekDays.some((d) => isLogged(habitId, d.date));
  }

  async function handleWeeklyToggle(habitId: string) {
    const logs = habitLogs[habitId] ?? [];
    const loggedDay = weekDays.find((d) => logs.some((l) => l.logged_date === d.date));
    if (loggedDay) {
      await toggleHabit(habitId, loggedDay.date);
    } else {
      const today = toLocalDateKey();
      await toggleHabit(habitId, today);
    }
  }

  async function handleAdd() {
    try {
    if (!name.trim()) return;
    await addHabit({ name: name.trim(), frequency });
    setName("");
    setShowAdd(false);

    } catch { /* Keep input open; the store displays the save error. */ }
  }

  return (
    <>
      <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20 }}>
        Track recurring behaviors. Check off as you complete them each day.
      </p>

      <div className="habits-grid">
        {activeHabits.map((h) => {
          const logs = habitLogs[h.id] ?? [];
          const streak = computeStreak(logs, h.frequency);
          const doneThisWeek = isLoggedThisWeek(h.id);

          return (
            <div key={h.id} className="habit-card">
              <div className="habit-card-top">
                <div className="habit-card-heading">
                  <HabitName name={h.name} />
                  {streak > 0 && (
                    <span className="habit-streak">
                      🔥 {streak}
                    </span>
                  )}
                </div>
                <div className="habit-card-actions">
                  <span className="habit-freq">{h.frequency}</span>
                  <button
                    className="habit-finish-btn"
                    onClick={() => setConfirmFinishId(h.id)}
                    title="Finish habit — keeps its performance history"
                  >Finish</button>
                </div>
              </div>

              {h.frequency === "weekly" ? (
                <button
                  className={`habit-weekly-toggle${doneThisWeek ? " logged" : ""}`}
                  onClick={() => handleWeeklyToggle(h.id)}
                >
                  {doneThisWeek ? "✓ Done this week" : "Mark done this week"}
                </button>
              ) : (
                <div className="habit-days">
                  {weekDays.map((d) => {
                    const logged = isLogged(h.id, d.date);
                    return (
                      <button
                        key={d.date}
                        className={`habit-day${logged ? " logged" : ""}`}
                        onClick={() => toggleHabit(h.id, d.date)}
                        title={d.date}
                      >
                        {logged ? "✓" : <span style={{ fontSize: 9 }}>{d.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <button className="habit-add-card" onClick={() => setShowAdd(true)}>
          + Add Habit
        </button>
      </div>

      {finishedHabits.length > 0 && (
        <section className="habits-finished">
          <div className="habits-finished-heading">
            <span className="habits-finished-label">Finished</span>
            <span className="habits-finished-count">{finishedHabits.length}</span>
            <span className="habits-finished-hint">History stays in Performance</span>
          </div>
          <div className="habits-finished-list">
            {finishedHabits.map((h) => {
              const logs = habitLogs[h.id] ?? [];
              return (
                <div key={h.id} className="habit-finished-row">
                  <span className="habit-finished-name" title={h.name}>{h.name}</span>
                  <span className="habit-freq">{h.frequency}</span>
                  <span className="habit-finished-meta">
                    {logs.length} logged · finished {formatFinished(h.finished_at!)}
                  </span>
                  <button className="habit-reopen-btn" onClick={() => resumeHabit(h.id)}>Reopen</button>
                  <button
                    className="habit-delete-btn"
                    onClick={() => setConfirmDeleteId(h.id)}
                    title="Delete habit and its history"
                  >✕</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal"><MutationFeedback />
            <h3>Add Habit</h3>
            <input
              className="modal-input"
              placeholder="Habit name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <select className="modal-select" value={frequency} onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Add</button>
            </div>
          </div>
        </div>
      )}
      {confirmFinishId && (() => {
        const habit = habits.find((h) => h.id === confirmFinishId);
        return habit ? (
          <ConfirmDialog
            message={`Finish "${habit.name}"? It stops being tracked from today, and its performance history stays.`}
            confirmLabel="Finish"
            confirmVariant="primary"
            onConfirm={() => { setConfirmFinishId(null); completeHabit(confirmFinishId); }}
            onCancel={() => setConfirmFinishId(null)}
          />
        ) : null;
      })()}
      {confirmDeleteId && (() => {
        const habit = habits.find((h) => h.id === confirmDeleteId);
        return habit ? (
          <ConfirmDialog
            message={`Delete "${habit.name}"? Its logs and performance history are removed too.`}
            onConfirm={() => { setConfirmDeleteId(null); removeHabit(confirmDeleteId); }}
            onCancel={() => setConfirmDeleteId(null)}
          />
        ) : null;
      })()}
    </>
  );
}
