import { useState, useRef } from "react";
import { useStore } from "../store";
import type { Task } from "../db/types";

interface TriageState {
  task: Task;
}

export default function Inbox() {
  const { inboxTasks, addTask, removeTask, triageTask, goals, loadInbox } = useStore();
  const [input, setInput] = useState("");
  const [triage, setTriage] = useState<TriageState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    const title = input.trim();
    if (!title) return;
    await addTask({ title });
    setInput("");
    inputRef.current?.focus();
  }

  async function handleTriageTo(task: Task, type: "goal" | "delete", goalId?: string) {
    if (type === "delete") {
      await removeTask(task.id);
    } else if (type === "goal" && goalId) {
      await triageTask(task.id, goalId);
    }
    setTriage(null);
    await loadInbox();
  }

  return (
    <>
      <div className="inbox-capture">
        <span style={{ fontSize: 16 }}>✏️</span>
        <input
          ref={inputRef}
          placeholder="Capture anything... press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          autoFocus
        />
        <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={handleAdd}>Add</button>
      </div>

      {inboxTasks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📥</div>
          <p>Inbox empty — capture something above</p>
        </div>
      )}

      {inboxTasks.map((task) => (
        <div key={task.id} className="inbox-item">
          <span className="inbox-item-text">{task.title}</span>
          <button className="triage-btn" onClick={() => setTriage({ task })}>Triage →</button>
          <button className="delete-inbox-btn" onClick={() => removeTask(task.id)}>✕</button>
        </div>
      ))}

      {triage && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setTriage(null)}>
          <div className="modal">
            <h3 style={{ marginBottom: 4 }}>Triage</h3>
            <p style={{ color: "var(--accent)", fontSize: 14, marginBottom: 16 }}>{triage.task.title}</p>
            <div className="triage-opts">
              {goals.filter((g) => g.status !== "completed").length === 0 && (
                <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 8 }}>No goals yet — create one in Goals first.</p>
              )}
              {goals.filter((g) => g.status !== "completed").map((g) => (
                <button
                  key={g.id}
                  className="triage-opt"
                  onClick={() => handleTriageTo(triage.task, "goal", g.id)}
                >
                  🎯 Move to: {g.title}
                  <span>Assign to this goal</span>
                </button>
              ))}
              <button className="triage-opt danger" onClick={() => handleTriageTo(triage.task, "delete")}>
                🗑 Delete
                <span>Remove from inbox</span>
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setTriage(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
