import { useState, useEffect } from "react";
import type { Task, TaskType, RecurrenceType } from "../db/types";
import { useStore } from "../store";

interface Props {
  onClose: () => void;
  editTask?: Task | null;
  defaultGoalId?: string;
  defaultParentTaskId?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function AddTaskModal({ onClose, editTask, defaultGoalId, defaultParentTaskId }: Props) {
  const { goals, tasks, addTask, editTask: updateTask } = useStore();
  const [title, setTitle] = useState(editTask?.title ?? "");
  const [goalId, setGoalId] = useState(editTask?.parent_goal_id ?? defaultGoalId ?? "");
  const [taskType, setTaskType] = useState<TaskType>(editTask?.task_type ?? "onetime");
  const [hasDeadline, setHasDeadline] = useState(!!(editTask?.due_date));
  const [dueDate, setDueDate] = useState(editTask?.due_date ?? "");
  const [isUrgent, setIsUrgent] = useState(editTask ? editTask.is_urgent === 1 : false);
  const [recurType, setRecurType] = useState<RecurrenceType>(editTask?.recurrence_type ?? "daily");
  const [recurDays, setRecurDays] = useState<number[]>(
    editTask?.recurrence_days ? JSON.parse(editTask.recurrence_days) : [1, 2, 3, 4, 5]
  );
  const [recurEnd, setRecurEnd] = useState(editTask?.recurrence_end_date ?? "");

  const parentTask = defaultParentTaskId ? tasks.find((t) => t.id === defaultParentTaskId) : null;

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setGoalId(editTask.parent_goal_id ?? "");
      setTaskType(editTask.task_type ?? "onetime");
      setHasDeadline(!!(editTask.due_date));
      setDueDate(editTask.due_date ?? "");
      setIsUrgent(editTask.is_urgent === 1);
      setRecurType(editTask.recurrence_type ?? "daily");
      setRecurDays(editTask.recurrence_days ? JSON.parse(editTask.recurrence_days) : [1, 2, 3, 4, 5]);
      setRecurEnd(editTask.recurrence_end_date ?? "");
    }
  }, [editTask]);

  function toggleDay(d: number) {
    setRecurDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  async function handleSave() {
    if (!title.trim()) return;
    const isRecurring = taskType === "recurring";
    const data = {
      title: title.trim(),
      due_date: !isRecurring && hasDeadline && dueDate ? dueDate : undefined,
      is_urgent: isUrgent,
      parent_goal_id: goalId || undefined,
      task_type: taskType,
      recurrence_type: isRecurring ? recurType : undefined,
      recurrence_days: isRecurring && recurType === "custom" ? JSON.stringify(recurDays) : undefined,
      recurrence_end_date: isRecurring && recurEnd ? recurEnd : undefined,
    };
    if (editTask) {
      await updateTask(editTask.id, { ...data, is_urgent: isUrgent ? 1 : 0 });
    } else {
      await addTask({ ...data, parent_task_id: defaultParentTaskId });
    }
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{editTask ? "Edit Task" : defaultParentTaskId ? "Add Subtask" : "Add Task"}</h3>
        {parentTask && (
          <p style={{ color: "var(--text2)", fontSize: 12, marginBottom: 10 }}>
            Subtask of: <strong style={{ color: "var(--text)" }}>{parentTask.title}</strong>
          </p>
        )}
        <input
          className="modal-input"
          placeholder={defaultParentTaskId ? "Subtask title..." : "Task title..."}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
        />

        {!defaultParentTaskId && (
          <>
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
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
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

            <select className="modal-select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">No goal (standalone)</option>
              {goals.filter((g) => g.status !== "completed").map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </>
        )}

        <label className="modal-check">
          <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} />
          Mark as Urgent
        </label>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editTask ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
