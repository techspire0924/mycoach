import { useState } from "react";
import type { Task } from "../db/types";
import { useStore } from "../store";

interface Props {
  task: Task;
  subtasks?: Task[];
  onEdit?: (task: Task) => void;
}

export default function TaskItem({ task, subtasks = [], onEdit }: Props) {
  const { toggleTask, removeTask } = useStore();
  const [expanded, setExpanded] = useState(false);

  const isDone = task.status === "done";

  return (
    <div className={`task-item${isDone ? " done" : ""}`}>
      <button
        className={`task-check${isDone ? " checked" : ""}`}
        onClick={() => toggleTask(task.id, task.status)}
        title={isDone ? "Mark todo" : "Mark done"}
      >
        {isDone && "✓"}
      </button>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.is_urgent === 1 && <span className="tag tag-urgent">Urgent</span>}
          {task.status === "in_progress" && <span className="tag tag-inprogress">In Progress</span>}
          {isDone && <span className="tag tag-done">Done</span>}
          {task.due_date && (
            <span className="tag tag-due">
              {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        {subtasks.length > 0 && (
          <>
            <button className="subtask-toggle" onClick={() => setExpanded((e) => !e)}>
              {expanded ? "▼" : "▶"} {subtasks.length} subtask{subtasks.length !== 1 ? "s" : ""}
            </button>
            {expanded && (
              <div className="subtask-list">
                {subtasks.map((st) => (
                  <div key={st.id} className="subtask-item">
                    <button
                      className={`subtask-check${st.status === "done" ? " checked" : ""}`}
                      onClick={() => toggleTask(st.id, st.status)}
                    >
                      {st.status === "done" && "✓"}
                    </button>
                    <span className={`subtask-text${st.status === "done" ? " done" : ""}`}>{st.title}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="task-actions">
        {onEdit && (
          <button className="icon-btn" onClick={() => onEdit(task)} title="Edit">✏️</button>
        )}
        <button className="icon-btn danger" onClick={() => removeTask(task.id)} title="Delete">🗑</button>
      </div>
    </div>
  );
}
