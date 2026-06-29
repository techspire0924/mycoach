import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { HabitLog } from "../db/types";
import ConfirmDialog from "../components/ConfirmDialog";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCurrentWeekDays(): { label: string; date: string }[] {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label: DAYS[d.getDay()], date: d.toISOString().split("T")[0] };
  });
}

function computeStreak(logs: HabitLog[], frequency: "daily" | "weekly"): number {
  if (!logs.length) return 0;
  const logSet = new Set(logs.map((l) => l.logged_date));

  if (frequency === "daily") {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const d = new Date(today);
    if (!logSet.has(todayStr)) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (logSet.has(d.toISOString().split("T")[0])) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  } else {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekMon = new Date(today);
    weekMon.setDate(today.getDate() + diff);

    const weekHasLog = (mon: Date): boolean => {
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        if (logSet.has(d.toISOString().split("T")[0])) return true;
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

export default function Habits() {
  const { habits, habitLogs, loadHabitLogs, toggleHabit, addHabit, removeHabit } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const weekDays = getCurrentWeekDays();

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
      const today = new Date().toISOString().split("T")[0];
      await toggleHabit(habitId, today);
    }
  }

  async function handleAdd() {
    if (!name.trim()) return;
    await addHabit({ name: name.trim(), frequency });
    setName("");
    setShowAdd(false);
  }

  return (
    <>
      <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20 }}>
        Track recurring behaviors. Check off as you complete them each day.
      </p>

      <div className="habits-grid">
        {habits.map((h) => {
          const logs = habitLogs[h.id] ?? [];
          const streak = computeStreak(logs, h.frequency);
          const doneThisWeek = isLoggedThisWeek(h.id);

          return (
            <div key={h.id} className="habit-card">
              <div className="habit-card-top">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="habit-name">{h.name}</div>
                  {streak > 0 && (
                    <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                      🔥 {streak}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="habit-freq">{h.frequency}</span>
                  <button
                    style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}
                    onClick={() => setConfirmDeleteId(h.id)}
                    title="Delete habit"
                  >✕</button>
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

      {showAdd && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
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
      {confirmDeleteId && (() => {
        const habit = habits.find((h) => h.id === confirmDeleteId);
        return habit ? (
          <ConfirmDialog
            message={`Delete "${habit.name}"?`}
            onConfirm={() => { setConfirmDeleteId(null); removeHabit(confirmDeleteId); }}
            onCancel={() => setConfirmDeleteId(null)}
          />
        ) : null;
      })()}
    </>
  );
}
