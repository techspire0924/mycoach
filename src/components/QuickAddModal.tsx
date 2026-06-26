import { useState } from "react";
import { useStore } from "../store";
import type { TaskType, RecurrenceType } from "../db/types";

type Tab = "task" | "goal";
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface Props { onClose: () => void; }

export default function QuickAddModal({ onClose }: Props) {
  const { goals, addTask, addGoal } = useStore();
  const [tab, setTab] = useState<Tab>("task");

  // Task fields
  const [taskTitle, setTaskTitle] = useState("");
  const [taskGoalId, setTaskGoalId] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("onetime");
  const [hasDeadline, setHasDeadline] = useState(false);
  const [taskDue, setTaskDue] = useState("");
  const [taskUrgent, setTaskUrgent] = useState(false);
  // Recurrence
  const [recurType, setRecurType] = useState<RecurrenceType>("daily");
  const [recurDays, setRecurDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon–Fri default
  const [recurEnd, setRecurEnd] = useState("");

  // Goal fields
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalParent, setGoalParent] = useState("");

  function toggleDay(d: number) {
    setRecurDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  async function handleSave() {
    if (tab === "task") {
      if (!taskTitle.trim()) return;
      const isRecurring = taskType === "recurring";
      await addTask({
        title: taskTitle.trim(),
        due_date: !isRecurring && hasDeadline && taskDue ? taskDue : undefined,
        is_urgent: taskUrgent,
        parent_goal_id: taskGoalId || undefined,
        task_type: taskType,
        recurrence_type: isRecurring ? recurType : undefined,
        recurrence_days: isRecurring && recurType === "custom" ? JSON.stringify(recurDays) : undefined,
        recurrence_end_date: isRecurring && recurEnd ? recurEnd : undefined,
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

            {/* Task type toggle */}
            <div className="task-type-toggle">
              <button
                className={`type-btn${taskType === "onetime" ? " active" : ""}`}
                onClick={() => setTaskType("onetime")}
              >
                One-time
              </button>
              <button
                className={`type-btn${taskType === "recurring" ? " active" : ""}`}
                onClick={() => setTaskType("recurring")}
              >
                ↻ Recurring
              </button>
            </div>

            {taskType === "onetime" && (
              <div className="deadline-row">
                <div className="task-type-toggle" style={{ marginBottom: 0 }}>
                  <button
                    className={`type-btn${!hasDeadline ? " active" : ""}`}
                    onClick={() => setHasDeadline(false)}
                  >
                    No deadline
                  </button>
                  <button
                    className={`type-btn${hasDeadline ? " active" : ""}`}
                    onClick={() => setHasDeadline(true)}
                  >
                    With deadline
                  </button>
                </div>
                {hasDeadline && (
                  <input
                    className="modal-input"
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                )}
              </div>
            )}

            {taskType === "recurring" && (
              <div className="recur-section">
                <div className="recur-type-row">
                  {(["daily", "workdays", "custom"] as RecurrenceType[]).map((rt) => (
                    <button
                      key={rt}
                      className={`recur-type-btn${recurType === rt ? " active" : ""}`}
                      onClick={() => setRecurType(rt)}
                    >
                      {rt === "daily" ? "Every day" : rt === "workdays" ? "Workdays" : "Custom"}
                    </button>
                  ))}
                </div>
                {recurType === "custom" && (
                  <div className="day-picker">
                    {DAYS.map((name, i) => (
                      <button
                        key={i}
                        className={`day-btn${recurDays.includes(i) ? " active" : ""}`}
                        onClick={() => toggleDay(i)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="recur-end-row">
                  <span className="recur-label">Ends</span>
                  <input
                    className="modal-input"
                    type="date"
                    value={recurEnd}
                    onChange={(e) => setRecurEnd(e.target.value)}
                    placeholder="Never"
                    style={{ marginBottom: 0 }}
                  />
                  {recurEnd && (
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => setRecurEnd("")}>
                      ✕ Never
                    </button>
                  )}
                </div>
              </div>
            )}

            <select className="modal-select" value={taskGoalId} onChange={(e) => setTaskGoalId(e.target.value)}>
              <option value="">No goal — standalone</option>
              {activeGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>

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
