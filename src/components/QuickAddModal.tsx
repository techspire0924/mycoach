import { useState } from "react";
import { useStore } from "../store";

type Tab = "task" | "goal";

interface Props {
  onClose: () => void;
}

export default function QuickAddModal({ onClose }: Props) {
  const { goals, addTask, addGoal } = useStore();
  const [tab, setTab] = useState<Tab>("task");

  // Task fields
  const [taskTitle, setTaskTitle] = useState("");
  const [taskGoalId, setTaskGoalId] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskUrgent, setTaskUrgent] = useState(false);

  // Goal fields
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalParent, setGoalParent] = useState("");

  async function handleSave() {
    if (tab === "task") {
      if (!taskTitle.trim()) return;
      await addTask({
        title: taskTitle.trim(),
        due_date: taskDue || undefined,
        is_urgent: taskUrgent,
        parent_goal_id: taskGoalId || undefined,
      });
    } else {
      if (!goalTitle.trim()) return;
      await addGoal({
        title: goalTitle.trim(),
        description: goalDesc.trim() || undefined,
        target_date: goalDate || undefined,
        parent_goal_id: goalParent || undefined,
      });
    }
    onClose();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) handleSave();
    if (e.key === "Escape") onClose();
  }

  const activeGoals = goals.filter((g) => g.status !== "completed");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onKeyDown={handleKey}>
        <div className="modal-tabs">
          <button className={`modal-tab${tab === "task" ? " active" : ""}`} onClick={() => setTab("task")}>
            📋 Task
          </button>
          <button className={`modal-tab${tab === "goal" ? " active" : ""}`} onClick={() => setTab("goal")}>
            🎯 Goal
          </button>
        </div>

        {tab === "task" && (
          <>
            <input
              className="modal-input"
              placeholder="What needs to be done?"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              autoFocus
            />
            <select className="modal-select" value={taskGoalId} onChange={(e) => setTaskGoalId(e.target.value)}>
              <option value="">No goal — standalone</option>
              {activeGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
            <div className="modal-row">
              <input
                className="modal-input"
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
              />
            </div>
            <label className="modal-check">
              <input type="checkbox" checked={taskUrgent} onChange={(e) => setTaskUrgent(e.target.checked)} />
              Mark as Urgent
            </label>
          </>
        )}

        {tab === "goal" && (
          <>
            <input
              className="modal-input"
              placeholder="What do you want to achieve?"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              autoFocus={tab === "goal"}
            />
            <textarea
              className="modal-input"
              placeholder="Why does this goal matter? (optional)"
              value={goalDesc}
              onChange={(e) => setGoalDesc(e.target.value)}
              rows={2}
              style={{ resize: "vertical" }}
            />
            {activeGoals.length > 0 && (
              <select className="modal-select" value={goalParent} onChange={(e) => setGoalParent(e.target.value)}>
                <option value="">No parent goal (top-level)</option>
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id}>Sub-goal of: {g.title}</option>
                ))}
              </select>
            )}
            <input
              className="modal-input"
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
              placeholder="Target date"
            />
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            Add {tab === "task" ? "Task" : "Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}
