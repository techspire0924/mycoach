import { useState } from "react";
import type { Task } from "../db/types";
import { useStore } from "../store";
import AddTaskModal from "./AddTaskModal";

interface Props {
  task: Task;
  subtasks?: Task[];
  onEdit?: (task: Task) => void;
  completedToday?: boolean;
  overdue?: boolean;
}

const STATUS_CYCLE: Record<string, { next: string; icon: string; cls: string; title: string }> = {
  todo:        { next: "in_progress", icon: "",  cls: "",        title: "Start task" },
  in_progress: { next: "done",        icon: "◐", cls: "inprog",  title: "Mark done" },
  done:        { next: "todo",        icon: "✓", cls: "checked", title: "Mark todo" },
};

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const TODAY = new Date().toISOString().split("T")[0];

function recurrenceLabel(task: Task): string {
  if (task.recurrence_type === "daily") return "↻ Daily";
  if (task.recurrence_type === "workdays") return "↻ Workdays";
  if (task.recurrence_type === "custom" && task.recurrence_days) {
    const days = JSON.parse(task.recurrence_days) as number[];
    return "↻ " + days.map((d) => DAY_NAMES[d]).join(" ");
  }
  return "↻";
}

export default function TaskItem({ task, subtasks = [], onEdit, completedToday, overdue }: Props) {
  const { cycleTaskStatus, toggleRecurring, removeTask, editTask, todayCompletions } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);

  const isRecurring = task.task_type === "recurring";

  // Permanently finished recurring task (user clicked FINISH)
  const isFinished = isRecurring && task.status === "done";

  // Recurring task whose end date passed but not yet finished
  const isExpiredUnfinished = isRecurring && !isFinished &&
    !!task.recurrence_end_date && task.recurrence_end_date < TODAY;

  const isDone = isFinished || (isRecurring ? !!completedToday : task.status === "done");
  const isInProg = !isFinished && (isRecurring
    ? (!completedToday && task.status === "in_progress")
    : task.status === "in_progress");

  const s = isRecurring
    ? (isFinished
      ? { icon: "✓", cls: "checked", title: "Finished" }
      : isDone
      ? { icon: "✓", cls: "checked", title: "Mark incomplete" }
      : isInProg
      ? { icon: "◐", cls: "inprog",  title: "Mark done for today" }
      : { icon: "",  cls: "",        title: "Start" })
    : (STATUS_CYCLE[task.status] ?? STATUS_CYCLE.todo);

  async function handleCheck() {
    if (isFinished) return; // read-only
    if (isRecurring) {
      if (isDone) {
        toggleRecurring(task.id);
      } else if (isInProg) {
        await toggleRecurring(task.id);
        await editTask(task.id, { status: "todo" });
      } else {
        cycleTaskStatus(task.id, "todo");
      }
    } else {
      cycleTaskStatus(task.id, task.status);
    }
  }

  async function handleFinish() {
    await editTask(task.id, { status: "done" });
  }

  const itemCls = [
    "task-item",
    isDone ? " done" : "",
    overdue ? " overdue" : "",
    isExpiredUnfinished ? " recurring-overdue" : "",
    isFinished ? " recurring-finished" : "",
  ].join("");

  return (
    <>
      <div className={itemCls}>
        <button
          className={`task-check${s.cls ? ` ${s.cls}` : ""}`}
          onClick={handleCheck}
          disabled={isFinished}
          title={s.title}
        >
          {s.icon}
        </button>
        <div className="task-body">
          <div className="task-title">
            {task.title}
            {isExpiredUnfinished && <span className="recur-expired-flag"> ⚑ Overdue</span>}
            {isFinished && <span className="recur-finished-label"> · Finished</span>}
          </div>
          <div className="task-meta">
            {task.is_urgent === 1 && <span className="tag tag-urgent">Urgent</span>}
            {!isRecurring && task.status === "in_progress" && <span className="tag tag-inprogress">In Progress</span>}
            {isDone && !isFinished && <span className="tag tag-done">Done</span>}
            {isRecurring && !isFinished && (
              <span className="tag tag-recur">{recurrenceLabel(task)}</span>
            )}
            {!isRecurring && task.due_date && (
              <span className="tag tag-due">
                {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
            {isRecurring && task.recurrence_end_date && (
              <span className="tag tag-due">
                until {new Date(task.recurrence_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                  {subtasks.map((st) => {
                    const stIsRecurring = st.task_type === "recurring";
                    const stFinished = stIsRecurring && st.status === "done";
                    const stDone = stFinished || (stIsRecurring ? todayCompletions.includes(st.id) : st.status === "done");
                    const stInProg = !stFinished && (stIsRecurring
                      ? (!stDone && st.status === "in_progress")
                      : st.status === "in_progress");
                    const stCls = stDone ? " checked" : stInProg ? " inprog" : "";
                    const stIcon = stDone ? "✓" : stInProg ? "◐" : "";

                    async function handleStCheck() {
                      if (stFinished) return;
                      if (stIsRecurring) {
                        if (stDone) { toggleRecurring(st.id); }
                        else if (stInProg) { await toggleRecurring(st.id); await editTask(st.id, { status: "todo" }); }
                        else { cycleTaskStatus(st.id, "todo"); }
                      } else {
                        cycleTaskStatus(st.id, st.status);
                      }
                    }

                    return (
                      <div key={st.id} className="subtask-item">
                        <button className={`subtask-check${stCls}`} onClick={handleStCheck}
                          disabled={stFinished}
                          title={stDone ? "Mark incomplete" : stInProg ? "Mark done" : "Start"}>
                          {stIcon}
                        </button>
                        <span className={`subtask-text${stDone ? " done" : ""}`}>{st.title}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <div className="task-actions">
          {isRecurring && !isFinished && (
            <button className="icon-btn finish-btn" onClick={handleFinish} title="Finish recurring task permanently">
              ✔ Finish
            </button>
          )}
          {!isFinished && <button className="icon-btn" onClick={() => setAddingSubtask(true)} title="Add subtask">⊕</button>}
          {onEdit && !isFinished && (
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
