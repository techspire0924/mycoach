import { useState } from "react";
import { useStore } from "../store";
import type { Task } from "../db/types";
import TaskItem from "../components/TaskItem";
import AddTaskModal from "../components/AddTaskModal";

const TODAY = new Date().toISOString().split("T")[0];
const TODAY_DOW = new Date().getDay();

function isRecurringToday(t: Task): boolean {
  if (t.task_type !== "recurring") return false;
  if (t.status === "done") return false; // permanently finished — hide
  // Overdue (past end date but not finished) — still show with flag
  if (t.recurrence_end_date && TODAY > t.recurrence_end_date) return true;
  if (TODAY < t.created_at.slice(0, 10)) return false;
  if (t.recurrence_type === "daily") return true;
  if (t.recurrence_type === "workdays") return TODAY_DOW >= 1 && TODAY_DOW <= 5;
  if (t.recurrence_type === "custom" && t.recurrence_days)
    return (JSON.parse(t.recurrence_days) as number[]).includes(TODAY_DOW);
  return false;
}

export default function Today() {
  const { tasks, habits, habitLogs, todayCompletions, toggleHabit } = useStore();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const topLevel = tasks.filter(t => !t.parent_task_id);
  const subtasksOf = (id: string) => tasks.filter(t => t.parent_task_id === id);
  const completedSet = new Set(todayCompletions);

  const overdue = topLevel.filter(t =>
    t.task_type === "onetime" && t.due_date && t.due_date < TODAY && t.status !== "done"
  );
  const dueToday = topLevel.filter(t =>
    t.task_type === "onetime" && t.due_date === TODAY && t.status !== "done"
  );
  const inProgress = topLevel.filter(t =>
    t.task_type === "onetime" && t.status === "in_progress" &&
    (!t.due_date || t.due_date > TODAY)
  );
  const noDeadline = topLevel.filter(t =>
    t.task_type === "onetime" && !t.due_date && t.status === "todo"
  );
  const recurringToday = topLevel.filter(t => isRecurringToday(t) && !completedSet.has(t.id));

  const isEmpty = overdue.length === 0 && dueToday.length === 0 &&
    inProgress.length === 0 && noDeadline.length === 0 &&
    recurringToday.length === 0 && habits.length === 0;

  if (isEmpty) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🌟</div>
        <p>Nothing on your plate today — enjoy the space!</p>
      </div>
    );
  }

  return (
    <>
      {overdue.length > 0 && (
        <section className="today-section">
          <div className="today-section-header today-section-header--overdue">
            <span className="today-section-icon">🔴</span>
            <span className="today-section-title">Overdue</span>
            <span className="today-section-count">{overdue.length}</span>
          </div>
          {overdue.map(t => (
            <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask} overdue />
          ))}
        </section>
      )}

      {dueToday.length > 0 && (
        <section className="today-section">
          <div className="today-section-header">
            <span className="today-section-icon">📅</span>
            <span className="today-section-title">Due Today</span>
            <span className="today-section-count">{dueToday.length}</span>
          </div>
          {dueToday.map(t => (
            <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask} />
          ))}
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="today-section">
          <div className="today-section-header">
            <span className="today-section-icon">◐</span>
            <span className="today-section-title">In Progress</span>
            <span className="today-section-count">{inProgress.length}</span>
          </div>
          {inProgress.map(t => (
            <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask} />
          ))}
        </section>
      )}

      {noDeadline.length > 0 && (
        <section className="today-section">
          <div className="today-section-header">
            <span className="today-section-icon">∞</span>
            <span className="today-section-title">No Deadline</span>
            <span className="today-section-count">{noDeadline.length}</span>
          </div>
          {noDeadline.map(t => (
            <TaskItem key={t.id} task={t} subtasks={subtasksOf(t.id)} onEdit={setEditingTask} />
          ))}
        </section>
      )}

      {recurringToday.length > 0 && (
        <section className="today-section">
          <div className="today-section-header">
            <span className="today-section-icon">↻</span>
            <span className="today-section-title">Recurring</span>
            <span className="today-section-count">{recurringToday.length}</span>
          </div>
          {recurringToday.map(t => (
            <TaskItem
              key={t.id}
              task={t}
              subtasks={subtasksOf(t.id)}
              onEdit={setEditingTask}
              completedToday={completedSet.has(t.id)}
              overdue={!!(t.recurrence_end_date && t.recurrence_end_date < TODAY)}
            />
          ))}
        </section>
      )}

      {habits.length > 0 && (
        <section className="today-section">
          <div className="today-section-header">
            <span className="today-section-icon">🔁</span>
            <span className="today-section-title">Habits</span>
            <span className="today-section-count">{habits.length}</span>
          </div>
          <div className="today-habits">
            {habits.map(h => {
              const logs = habitLogs[h.id] ?? [];
              const doneTodayHabit = logs.some(l => l.logged_date === TODAY);
              return (
                <div
                  key={h.id}
                  className={`today-habit-row ${doneTodayHabit ? "today-habit-row--done" : ""}`}
                  onClick={() => toggleHabit(h.id, TODAY)}
                >
                  <div className={`today-habit-check ${doneTodayHabit ? "checked" : ""}`}>
                    {doneTodayHabit ? "✓" : ""}
                  </div>
                  <span className={`today-habit-name ${doneTodayHabit ? "done" : ""}`}>{h.name}</span>
                  <span className="today-habit-freq">{h.frequency}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {editingTask && (
        <AddTaskModal onClose={() => setEditingTask(null)} editTask={editingTask} />
      )}
    </>
  );
}
