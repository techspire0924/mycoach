import { useState } from "react";
import type { Task } from "../db/types";
import { useStore } from "../store";
import AddTaskModal from "./AddTaskModal";

interface Props {
  task: Task;
  subtasks?: Task[];
  onEdit?: (task: Task) => void;
}

const STATUS_CYCLE: Record<string, { next: string; icon: string; cls: string; title: string }> = {
  todo:        { next: "in_progress", icon: "",  cls: "",        title: "Start task" },
  in_progress: { next: "done",        icon: "◐", cls: "inprog",  title: "Mark done" },
  done:        { next: "todo",        icon: "✓", cls: "checked", title: "Mark todo" },
};

export default function TaskItem({ task, subtasks = [], onEdit }: Props) {
  const { cycleTaskStatus, removeTask } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);

  const s = STATUS_CYCLE[task.status] ?? STATUS_CYCLE.todo;
  const isDone = task.status === "done";

  return (
    <>
      <div className={`task-item${isDone ? " done" : ""}`}>
        <button
          className={`task-check${s.cls ? ` ${s.cls}` : ""}`}
          onClick={() => cycleTaskStatus(task.id, task.status)}
          title={s.title}
        >
          {s.icon}
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
                        className={`subtask-check${st.status === "done" ? " checked" : st.status === "in_progress" ? " inprog" : ""}`}
                        onClick={() => cycleTaskStatus(st.id, st.status)}
                        title={STATUS_CYCLE[st.status]?.title}
                      >
                        {st.status === "done" ? "✓" : st.status === "in_progress" ? "◐" : ""}
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
          <button className="icon-btn" onClick={() => setAddingSubtask(true)} title="Add subtask">⊕</button>
          {onEdit && (
            <button className="icon-btn" onClick={() => onEdit(task)} title="Edit">✏️</button>
          )}
          <button className="icon-btn danger" onClick={() => removeTask(task.id)} title="Delete">🗑</button>
        </div>
      </div>
      {addingSubtask && (
        <AddTaskModal
          onClose={() => setAddingSubtask(false)}
          defaultParentTaskId={task.id}
          defaultGoalId={task.parent_goal_id ?? undefined}
        />
      )}
    </>
  );
}
