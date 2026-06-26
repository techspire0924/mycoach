import { useState } from "react";
import { useStore } from "../store";
import type { Task } from "../db/types";
import TaskItem from "../components/TaskItem";
import AddTaskModal from "../components/AddTaskModal";

export default function Daily() {
  const { tasks, goals } = useStore();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingToGoal, setAddingToGoal] = useState<string | undefined>(undefined);
  const [showDone, setShowDone] = useState(false);

  const subtasksOf = (id: string) => tasks.filter((t) => t.parent_task_id === id);
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  const topLevel = tasks.filter((t) => !t.parent_task_id);
  const openTasks = topLevel.filter((t) => t.status !== "done");
  const doneTasks = topLevel.filter((t) => t.status === "done");

  // Group open tasks by goal
  const tasksByGoal = new Map<string | null, Task[]>();
  for (const task of openTasks) {
    const key = task.parent_goal_id ?? null;
    if (!tasksByGoal.has(key)) tasksByGoal.set(key, []);
    tasksByGoal.get(key)!.push(task);
  }

  const orderedGoalIds = goals.map((g) => g.id).filter((id) => tasksByGoal.has(id));

  function goalProgress(goalId: string) {
    const all = tasks.filter((t) => t.parent_goal_id === goalId && !t.parent_task_id);
    const done = all.filter((t) => t.status === "done").length;
    return { done, total: all.length };
  }

  if (openTasks.length === 0 && doneTasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">☀️</div>
        <p>No tasks — add some from Inbox or Quick Add</p>
      </div>
    );
  }

  return (
    <>
      {openTasks.length === 0 && doneTasks.length > 0 && (
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
              <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask} />
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
            <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask} />
          ))}
        </div>
      )}

      {doneTasks.length > 0 && (
        <div className="goal-group">
          <div className="goal-group-header" style={{ cursor: "pointer" }} onClick={() => setShowDone((v) => !v)}>
            <span className="goal-group-label" style={{ color: "var(--done)" }}>
              {showDone ? "▼" : "▶"} ✓ Completed ({doneTasks.length})
            </span>
            <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: "auto" }}>click to undo</span>
          </div>
          {showDone && doneTasks.map((t) => (
            <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask} />
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
