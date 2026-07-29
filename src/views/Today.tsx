import { useState } from "react";
import { useStore } from "../store";
import type { Task } from "../db/types";
import TaskItem from "../components/TaskItem";
import AddTaskModal from "../components/AddTaskModal";
import { toLocalDateKey } from "../utils/date";

const TODAY = toLocalDateKey();
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
  const { tasks, goals, habits, habitLogs, todayCompletions, toggleHabit } = useStore();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const topLevel = tasks.filter(t => !t.parent_task_id);
  const subtasksOf = (id: string) => tasks.filter(t => t.parent_task_id === id);
  const completedSet = new Set(todayCompletions);
  const goalMap = new Map(goals.map(goal => [goal.id, goal]));

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

  const taskBuckets = [
    { id: "overdue", title: "Overdue", icon: "🔴", tasks: overdue },
    { id: "due-today", title: "Due Today", icon: "📅", tasks: dueToday },
    { id: "in-progress", title: "In Progress", icon: "◐", tasks: inProgress },
    { id: "no-deadline", title: "No Deadline", icon: "∞", tasks: noDeadline },
    { id: "recurring", title: "Recurring", icon: "↻", tasks: recurringToday },
  ];

  const tasksByParent = new Map<string | null, Map<string, Task[]>>();
  for (const bucket of taskBuckets) {
    for (const task of bucket.tasks) {
      // A task whose goal was removed belongs with the other standalone tasks.
      const parentId = task.parent_goal_id && goalMap.has(task.parent_goal_id)
        ? task.parent_goal_id
        : null;
      if (!tasksByParent.has(parentId)) tasksByParent.set(parentId, new Map());
      const parentBuckets = tasksByParent.get(parentId)!;
      if (!parentBuckets.has(bucket.id)) parentBuckets.set(bucket.id, []);
      parentBuckets.get(bucket.id)!.push(task);
    }
  }

  const orderedParentIds: (string | null)[] = [
    ...goals.map(goal => goal.id).filter(id => tasksByParent.has(id)),
    ...(tasksByParent.has(null) ? [null] : []),
  ];

  function goalPath(goalId: string): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    let current = goalMap.get(goalId);

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current.title);
      current = current.parent_goal_id ? goalMap.get(current.parent_goal_id) : undefined;
    }

    return path;
  }

  const visibleTaskCount = taskBuckets.reduce((sum, bucket) => sum + bucket.tasks.length, 0);
  const isEmpty = visibleTaskCount === 0 && habits.length === 0;

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
      {orderedParentIds.map(parentId => {
        const parentBuckets = tasksByParent.get(parentId)!;
        const groupCount = [...parentBuckets.values()].reduce((sum, groupTasks) => sum + groupTasks.length, 0);
        const path = parentId ? goalPath(parentId) : [];

        return (
          <section key={parentId ?? "standalone"} className="today-parent-group">
            <div className="today-parent-header">
              <span className="today-parent-icon">{parentId ? "🎯" : "📋"}</span>
              <div className="today-parent-name">
                {parentId
                  ? path.map((name, index) => (
                      <span key={`${name}-${index}`} className="today-parent-path-part">
                        {index > 0 && <span className="today-parent-path-separator">/</span>}
                        {name}
                      </span>
                    ))
                  : "Standalone"}
              </div>
              <span className="today-parent-count">
                {groupCount} {groupCount === 1 ? "item" : "items"}
              </span>
            </div>

            {taskBuckets.map(bucket => {
              const groupTasks = parentBuckets.get(bucket.id) ?? [];
              if (groupTasks.length === 0) return null;

              return (
                <div key={bucket.id} className={`today-parent-bucket today-parent-bucket--${bucket.id}`}>
                  <div className="today-parent-bucket-header">
                    <span>{bucket.icon}</span>
                    <span>{bucket.title}</span>
                    <span className="today-parent-bucket-count">{groupTasks.length}</span>
                  </div>
                  {groupTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      subtasks={subtasksOf(task.id)}
                      onEdit={setEditingTask}
                      completedToday={completedSet.has(task.id)}
                      overdue={
                        bucket.id === "overdue" ||
                        (task.task_type === "recurring" &&
                          !!(task.recurrence_end_date && task.recurrence_end_date < TODAY))
                      }
                    />
                  ))}
                </div>
              );
            })}
          </section>
        );
      })}

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
