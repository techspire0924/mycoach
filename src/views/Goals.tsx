import { useState } from "react";
import { useStore } from "../store";
import type { Goal, Task } from "../db/types";
import TaskItem from "../components/TaskItem";
import AddTaskModal from "../components/AddTaskModal";
import AddGoalModal from "../components/AddGoalModal";
import ConfirmDialog from "../components/ConfirmDialog";

function EditGoalModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { editGoal } = useStore();
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [targetDate, setTargetDate] = useState(goal.target_date ?? "");

  async function handleSave() {
    if (!title.trim()) return;
    await editGoal(goal.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      target_date: targetDate || undefined,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Edit Goal</h3>
        <input className="modal-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <textarea
          className="modal-input"
          placeholder="Description (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ resize: "vertical" }}
        />
        <input className="modal-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

const TODAY = new Date().toISOString().split("T")[0];
function isRecurringExpired(t: { task_type: string; status: string; recurrence_end_date?: string | null }) {
  if (t.task_type !== "recurring") return false;
  if (t.status === "done") return true; // permanently finished
  return !!t.recurrence_end_date && t.recurrence_end_date < TODAY;
}

export default function Goals() {
  const { goals, tasks, removeGoal, completeGoal, todayCompletions } = useStore();
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingSubGoal, setAddingSubGoal] = useState(false);
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState(false);

  function collectGoalIds(goalId: string): string[] {
    const ids = [goalId];
    for (const sub of goals.filter(g => g.parent_goal_id === goalId))
      ids.push(...collectGoalIds(sub.id));
    return ids;
  }

  function goalProgress(goalId: string) {
    const ids = new Set(collectGoalIds(goalId));
    const all = tasks.filter(t => t.parent_goal_id && ids.has(t.parent_goal_id) && !t.parent_task_id);
    const done = all.filter(t => {
      if (t.task_type !== "recurring") return t.status === "done";
      return t.status === "done"; // only permanently finished counts as done
    }).length;
    const inProgress = all.filter(t => {
      if (t.task_type !== "recurring") return t.status === "in_progress";
      if (t.status === "done") return false; // finished
      // overdue-unfinished OR actively in_progress OR completed today counts as in progress
      const overdueUnfinished = !!t.recurrence_end_date && t.recurrence_end_date < TODAY;
      return overdueUnfinished || t.status === "in_progress" || todayCompletions.includes(t.id);
    }).length;
    const n = all.length;
    return {
      done, inProgress, total: n,
      pct: n > 0 ? Math.round((done / n) * 100) : 0,
      inProgressPct: n > 0 ? Math.round((inProgress / n) * 100) : 0,
    };
  }

  if (detailGoal) {
    // Refresh detailGoal from store in case it was edited
    const currentGoal = goals.find((g) => g.id === detailGoal.id) ?? detailGoal;
    const allGoalTasks = tasks.filter((t) => t.parent_goal_id === currentGoal.id && !t.parent_task_id);
    const goalTasks = allGoalTasks.filter(t => !isRecurringExpired(t));
    const expiredTasks = allGoalTasks.filter(t => isRecurringExpired(t));
    const subGoals = goals.filter((g) => g.parent_goal_id === currentGoal.id);
    const subtasksOf = (id: string) => tasks.filter((t) => t.parent_task_id === id);
    const { done, inProgress, total, pct } = goalProgress(currentGoal.id);

    return (
      <>
        <button className="back-btn" onClick={() => setDetailGoal(null)}>← Back to Goals</button>
        <div className="goal-detail-header">
          <div className="goal-detail-title">{currentGoal.title}</div>
          {currentGoal.description && <div className="goal-detail-desc">{currentGoal.description}</div>}
          <div className="goal-detail-meta">
            {currentGoal.target_date && (
              <span>Target: <strong>{new Date(currentGoal.target_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong></span>
            )}
            <span>Progress: <strong>{pct}%</strong></span>
            <span>Tasks: <strong>{done}/{total} done</strong>{inProgress > 0 && <span style={{ marginLeft: 8, color: "var(--inprog)" }}>◐ {inProgress} in progress</span>}</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setAddingTask(true)}>+ Add Task</button>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setAddingSubGoal(true)}>+ Sub-Goal</button>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setEditingGoal(currentGoal)}>Edit Goal</button>
            {currentGoal.status !== "completed" && (
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => completeGoal(currentGoal.id).then(() => setDetailGoal(null))}>
                Mark Complete
              </button>
            )}
            <button className="btn btn-danger" style={{ fontSize: 13 }} onClick={() => setConfirmDeleteGoal(true)}>
              Delete Goal
            </button>
          </div>
        </div>

        {subGoals.length > 0 && (
          <div className="subgoals-section">
            <div className="section-label">Sub-Goals</div>
            <div className="subgoals-list">
              {subGoals.map((sg) => {
                const sp = goalProgress(sg.id);
                return (
                  <div key={sg.id} className="subgoal-item" onClick={() => setDetailGoal(sg)}>
                    <div className="subgoal-item-left">
                      <div className={`goal-status-dot ${sg.status === "completed" ? "dot-completed" : "dot-active"}`} />
                      <span className="subgoal-item-title">{sg.title}</span>
                    </div>
                    <div className="subgoal-item-right">
                      <div className="subgoal-bar">
                        <div className="subgoal-bar-fill" style={{ width: `${sp.pct}%` }} />
                        {sp.inProgressPct > 0 && <div className="subgoal-bar-fill subgoal-bar-fill--inprog" style={{ width: `${sp.inProgressPct}%` }} />}
                      </div>
                      <span className="subgoal-pct">{sp.pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {goalTasks.length === 0 && subGoals.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>No tasks yet — add one above</p>
          </div>
        )}
        {goalTasks.length === 0 && subGoals.length > 0 && (
          <div className="empty-state" style={{ marginTop: 8 }}>
            <p>No direct tasks — add one above</p>
          </div>
        )}
        {goalTasks.map((t) => (
          <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask}
            completedToday={todayCompletions.includes(t.id)} />
        ))}

        {expiredTasks.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="today-section-header" style={{ marginBottom: 8 }}>
              <span className="today-section-title">Ended Recurring</span>
              <span className="today-section-count">{expiredTasks.length}</span>
            </div>
            {expiredTasks.map((t) => (
              <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask}
                completedToday={false} />
            ))}
          </div>
        )}

        {addingTask && (
          <AddTaskModal onClose={() => setAddingTask(false)} defaultGoalId={currentGoal.id} />
        )}
        {editingTask && (
          <AddTaskModal onClose={() => setEditingTask(null)} editTask={editingTask} />
        )}
        {editingGoal && (
          <EditGoalModal goal={editingGoal} onClose={() => setEditingGoal(null)} />
        )}
        {addingSubGoal && (
          <AddGoalModal onClose={() => setAddingSubGoal(false)} defaultParentId={currentGoal.id} />
        )}
        {confirmDeleteGoal && (
          <ConfirmDialog
            message={`Delete "${currentGoal.title}"?`}
            onConfirm={() => { setConfirmDeleteGoal(false); removeGoal(currentGoal.id).then(() => setDetailGoal(null)); }}
            onCancel={() => setConfirmDeleteGoal(false)}
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
          const { done, inProgress, total, pct, inProgressPct } = goalProgress(g.id);
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
                {inProgressPct > 0 && <div className="goal-card-bar-fill goal-card-bar-fill--inprog" style={{ width: `${inProgressPct}%` }} />}
              </div>
              <div className="goal-card-stats">
                <span>📋 {total} tasks</span>
                <span>✓ {done} done</span>
                {inProgress > 0 && <span style={{ color: "var(--inprog)" }}>◐ {inProgress} in progress</span>}
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
