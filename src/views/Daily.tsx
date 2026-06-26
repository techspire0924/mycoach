import { useState } from "react";
import { useStore } from "../store";
import type { Task } from "../db/types";
import TaskItem from "../components/TaskItem";
import AddTaskModal from "../components/AddTaskModal";

export default function Daily() {
  const { tasks, goals } = useStore();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  // subtasksOf uses all tasks (including done) to show full progress
  const [addingToGoal, setAddingToGoal] = useState<string | undefined>(undefined);

  // Group tasks by goal — top-level open tasks only (subtasks rendered inline)
  const tasksByGoal = new Map<string | null, Task[]>();
  const topLevelTasks = tasks.filter((t) => !t.parent_task_id && t.status !== "done");

  for (const task of topLevelTasks) {
    const key = task.parent_goal_id ?? null;
    if (!tasksByGoal.has(key)) tasksByGoal.set(key, []);
    tasksByGoal.get(key)!.push(task);
  }

  const subtasksOf = (id: string) => tasks.filter((t) => t.parent_task_id === id);

  function goalProgress(goalId: string): { done: number; total: number } {
    const all = topLevelTasks.filter((t) => t.parent_goal_id === goalId);
    return { done: all.filter((t) => t.status === "done").length, total: all.length };
  }

  const goalMap = new Map(goals.map((g) => [g.id, g]));

  // Ordered: goals first (in goals order), then standalone
  const orderedGoalIds = goals.map((g) => g.id).filter((id) => tasksByGoal.has(id));

  if (topLevelTasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">☀️</div>
        <p>No open tasks — add some from Inbox or Quick Add</p>
      </div>
    );
  }

  return (
    <>
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
