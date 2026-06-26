import { useState } from "react";
import { useStore } from "../store";
import type { Goal } from "../db/types";
import TaskItem from "../components/TaskItem";
import AddTaskModal from "../components/AddTaskModal";
import AddGoalModal from "../components/AddGoalModal";

export default function Goals() {
  const { goals, tasks, removeGoal, completeGoal } = useStore();
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);

  function goalProgress(goalId: string) {
    const all = tasks.filter((t) => t.parent_goal_id === goalId && !t.parent_task_id);
    const done = all.filter((t) => t.status === "done").length;
    return { done, total: all.length, pct: all.length > 0 ? Math.round((done / all.length) * 100) : 0 };
  }

  if (detailGoal) {
    const goalTasks = tasks.filter((t) => t.parent_goal_id === detailGoal.id && !t.parent_task_id);
    const subtasksOf = (id: string) => tasks.filter((t) => t.parent_task_id === id);
    const { done, total, pct } = goalProgress(detailGoal.id);

    return (
      <>
        <button className="back-btn" onClick={() => setDetailGoal(null)}>← Back to Goals</button>
        <div className="goal-detail-header">
          <div className="goal-detail-title">{detailGoal.title}</div>
          {detailGoal.description && <div className="goal-detail-desc">{detailGoal.description}</div>}
          <div className="goal-detail-meta">
            {detailGoal.target_date && (
              <span>Target: <strong>{new Date(detailGoal.target_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong></span>
            )}
            <span>Progress: <strong>{pct}%</strong></span>
            <span>Tasks: <strong>{done}/{total} done</strong></span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setAddingTask(true)}>+ Add Task</button>
            {detailGoal.status !== "completed" && (
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => completeGoal(detailGoal.id).then(() => setDetailGoal(null))}>
                Mark Complete
              </button>
            )}
            <button className="btn btn-danger" style={{ fontSize: 13 }} onClick={() => removeGoal(detailGoal.id).then(() => setDetailGoal(null))}>
              Delete Goal
            </button>
          </div>
        </div>

        {goalTasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>No tasks yet — add one above</p>
          </div>
        )}
        {goalTasks.map((t) => (
          <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} />
        ))}

        {addingTask && (
          <AddTaskModal
            onClose={() => setAddingTask(false)}
            defaultGoalId={detailGoal.id}
          />
        )}
      </>
    );
  }

  const topGoals = goals.filter((g) => !g.parent_goal_id);

  return (
    <>
      <div className="section-header">
        <span className="section-title">Goals</span>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setAddingGoal(true)}>+ Add Goal</button>
      </div>

      {topGoals.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <p>No goals yet — add your first one</p>
        </div>
      )}

      <div className="goals-grid">
        {topGoals.map((g) => {
          const { done, total, pct } = goalProgress(g.id);
          const subGoals = goals.filter((sg) => sg.parent_goal_id === g.id);
          return (
            <div key={g.id} className="goal-card" onClick={() => setDetailGoal(g)}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div className="goal-card-title">{g.title}</div>
                  {g.target_date && (
                    <div className="goal-card-date">
                      Target: {new Date(g.target_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </div>
                  )}
                </div>
                <div className={`goal-status-dot ${g.status === "completed" ? "dot-completed" : "dot-active"}`} style={{ marginTop: 4 }} />
              </div>
              <div className="goal-card-bar">
                <div className="goal-card-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="goal-card-stats">
                <span>📋 {total} tasks</span>
                <span>✓ {done} done</span>
                {subGoals.length > 0 && <span>🎯 {subGoals.length} sub-goals</span>}
                <span style={{ marginLeft: "auto" }}>{pct}%</span>
              </div>
            </div>
          );
        })}
        <div className="goal-card goal-card-add" onClick={() => setAddingGoal(true)}>
          <span style={{ fontSize: 20 }}>+</span> Add Goal
        </div>
      </div>

      {addingGoal && <AddGoalModal onClose={() => setAddingGoal(false)} />}
    </>
  );
}
