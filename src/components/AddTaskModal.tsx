import { useState, useEffect } from "react";
import type { Task } from "../db/types";
import { useStore } from "../store";

interface Props {
  onClose: () => void;
  editTask?: Task | null;
  defaultGoalId?: string;
  defaultParentTaskId?: string;
}

export default function AddTaskModal({ onClose, editTask, defaultGoalId, defaultParentTaskId }: Props) {
  const { goals, tasks, addTask, editTask: updateTask } = useStore();
  const [title, setTitle] = useState(editTask?.title ?? "");
  const [dueDate, setDueDate] = useState(editTask?.due_date ?? "");
  const [isUrgent, setIsUrgent] = useState(editTask ? editTask.is_urgent === 1 : false);
  const [goalId, setGoalId] = useState(editTask?.parent_goal_id ?? defaultGoalId ?? "");

  const parentTask = defaultParentTaskId ? tasks.find((t) => t.id === defaultParentTaskId) : null;

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDueDate(editTask.due_date ?? "");
      setIsUrgent(editTask.is_urgent === 1);
      setGoalId(editTask.parent_goal_id ?? "");
    }
  }, [editTask]);

  async function handleSave() {
    if (!title.trim()) return;
    if (editTask) {
      await updateTask(editTask.id, {
        title: title.trim(),
        due_date: dueDate || undefined,
        is_urgent: isUrgent ? 1 : 0,
        parent_goal_id: goalId || undefined,
      });
    } else {
      await addTask({
        title: title.trim(),
        due_date: dueDate || undefined,
        is_urgent: isUrgent,
        parent_goal_id: goalId || undefined,
        parent_task_id: defaultParentTaskId,
      });
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
          <select className="modal-select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">No goal (standalone)</option>
            {goals.filter((g) => g.status !== "completed").map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        )}
        <div className="modal-row">
          <input
            className="modal-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
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
