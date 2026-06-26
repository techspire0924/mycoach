import { useEffect, useState } from "react";
import { useStore } from "../store";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLast7Days(): { label: string; date: string }[] {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: DAYS[d.getDay()],
      date: d.toISOString().split("T")[0],
    });
  }
  return days;
}

export default function Habits() {
  const { habits, habitLogs, loadHabitLogs, toggleHabit, addHabit, removeHabit } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const days = getLast7Days();

  useEffect(() => {
    habits.forEach((h) => loadHabitLogs(h.id));
  }, [habits, loadHabitLogs]);

  function isLogged(habitId: string, date: string): boolean {
    const logs = habitLogs[habitId] ?? [];
    return logs.some((l) => l.logged_date === date);
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
        {habits.map((h) => (
          <div key={h.id} className="habit-card">
            <div className="habit-card-top">
              <div className="habit-name">{h.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="habit-freq">{h.frequency}</span>
                <button
                  style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}
                  onClick={() => removeHabit(h.id)}
                  title="Delete habit"
                >✕</button>
              </div>
            </div>
            <div className="habit-days">
              {days.map((d) => {
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
          </div>
        ))}

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
    </>
  );
}
