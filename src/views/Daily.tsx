import { useState } from "react";
import { useStore } from "../store";
import type { Task } from "../db/types";
import TaskItem from "../components/TaskItem";
import AddTaskModal from "../components/AddTaskModal";

const TODAY = new Date().toISOString().split("T")[0];
const TODAY_DOW = new Date().getDay(); // 0=Sun

function showsToday(t: Task): boolean {
  if (t.task_type === "onetime") return t.status !== "done";
  // Recurring: only hide permanently finished
  if (t.status === "done") return false;
  // Overdue (past end date but not finished) — still show with flag
  if (t.recurrence_type === "daily") return true;
  if (t.recurrence_type === "workdays") return TODAY_DOW >= 1 && TODAY_DOW <= 5;
  if (t.recurrence_type === "custom" && t.recurrence_days) {
    return (JSON.parse(t.recurrence_days) as number[]).includes(TODAY_DOW);
  }
  return false;
}

export default function Daily() {
  const { tasks, goals, todayCompletions } = useStore();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingToGoal, setAddingToGoal] = useState<string | undefined>(undefined);
  const [showDone, setShowDone] = useState(false);

  const completedSet = new Set(todayCompletions);
  const subtasksOf = (id: string) => tasks.filter((t) => t.parent_task_id === id);
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  const topLevel = tasks.filter((t) => !t.parent_task_id);
  const activeTasks = topLevel.filter((t) => showsToday(t) && !(t.task_type === "recurring" && completedSet.has(t.id)));
  const doneTasks = topLevel.filter((t) =>
    t.task_type === "onetime" ? t.status === "done" :
    completedSet.has(t.id) && showsToday(t)
  );

  // Group active tasks by goal
  const tasksByGoal = new Map<string | null, Task[]>();
  for (const task of activeTasks) {
    const key = task.parent_goal_id ?? null;
    if (!tasksByGoal.has(key)) tasksByGoal.set(key, []);
    tasksByGoal.get(key)!.push(task);
  }

  const orderedGoalIds = goals.map((g) => g.id).filter((id) => tasksByGoal.has(id));

  function goalProgress(goalId: string) {
    const all = tasks.filter((t) => t.parent_goal_id === goalId && !t.parent_task_id);
    const done = all.filter((t) =>
      t.task_type === "onetime" ? t.status === "done" : completedSet.has(t.id)
    ).length;
    return { done, total: all.length };
  }

  if (activeTasks.length === 0 && doneTasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">☀️</div>
        <p>No tasks for today — add some from Inbox or Quick Add</p>
      </div>
    );
  }

  return (
    <>
      {activeTasks.length === 0 && doneTasks.length > 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <p>All done for today!</p>
        </div>
      )}

      {orderedGoalIds.map((goalId) => {
        const goal = goalMap.get(goalId)!;
        const groupTasks = tasksByGoal.get(goalId) ?? [];
        const { done, total } = goalProgress(goalId);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={goalId} className="goal-group">
            <div className="goal-group-header">
              <span className="goal-group-label">🎯 {goal.title}</span>
              <div className="mini-progress">
                <div className="mini-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="goal-group-count">{done}/{total}</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "3px 10px", marginLeft: 8 }}
                onClick={() => setAddingToGoal(goalId)}
              >
                + Task
              </button>
            </div>
            {groupTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                subtasks={subtasksOf(t.id)}
                onEdit={setEditingTask}
                completedToday={completedSet.has(t.id)}
                overdue={t.task_type === "recurring" && !!(t.recurrence_end_date && t.recurrence_end_date < TODAY)}
              />
            ))}
          </div>
        );
      })}

      {tasksByGoal.has(null) && (
        <div className="goal-group">
          <div className="goal-group-header">
            <span className="goal-group-label" style={{ color: "var(--text2)" }}>📋 Standalone</span>
          </div>
          {(tasksByGoal.get(null) ?? []).map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              subtasks={subtasksOf(t.id)}
              onEdit={setEditingTask}
              completedToday={completedSet.has(t.id)}
              overdue={t.task_type === "recurring" && !!(t.recurrence_end_date && t.recurrence_end_date < TODAY)}
            />
          ))}
        </div>
      )}

      {doneTasks.length > 0 && (
        <div className="goal-group">
          <div
            className="goal-group-header"
            style={{ cursor: "pointer" }}
            onClick={() => setShowDone((v) => !v)}
          >
            <span className="goal-group-label" style={{ color: "var(--done)" }}>
              {showDone ? "▼" : "▶"} ✓ Completed ({doneTasks.length})
            </span>
            <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: "auto" }}>click to undo</span>
          </div>
          {showDone && doneTasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              subtasks={subtasksOf(t.id)}
              onEdit={setEditingTask}
              completedToday={completedSet.has(t.id)}
            />
          ))}
        </div>
      )}

      {(editingTask || addingToGoal !== undefined) && (
        <AddTaskModal
          onClose={() => { setEditingTask(null); setAddingToGoal(undefined); }}
          editTask={editingTask}
          defaultGoalId={addingToGoal}
        />
      )}
    </>
  );
}
