import { getDb, generateId, now } from "./index";
import type { Task, TaskStatus, TaskType, RecurrenceType } from "./types";

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks ORDER BY is_urgent DESC, due_date, position, created_at"
  );
}

export async function getInboxTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks WHERE parent_goal_id IS NULL AND parent_task_id IS NULL AND status = 'todo' AND task_type = 'onetime' ORDER BY created_at DESC"
  );
}

export async function createTask(data: {
  title: string;
  due_date?: string;
  is_urgent?: boolean;
  parent_goal_id?: string;
  parent_task_id?: string;
  task_type?: TaskType;
  recurrence_type?: RecurrenceType;
  recurrence_days?: string;
  recurrence_end_date?: string;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const ts = now();
  await db.execute(
    `INSERT INTO tasks
      (id, title, due_date, is_urgent, parent_goal_id, parent_task_id,
       task_type, recurrence_type, recurrence_days, recurrence_end_date,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.title,
      data.due_date ?? null,
      data.is_urgent ? 1 : 0,
      data.parent_goal_id ?? null,
      data.parent_task_id ?? null,
      data.task_type ?? "onetime",
      data.recurrence_type ?? null,
      data.recurrence_days ?? null,
      data.recurrence_end_date ?? null,
      ts,
      ts,
    ]
  );
  return id;
}

export async function updateTask(
  id: string,
  data: Partial<Pick<Task,
    "title" | "status" | "due_date" | "is_urgent" |
    "parent_goal_id" | "parent_task_id" |
    "task_type" | "recurrence_type" | "recurrence_days" | "recurrence_end_date"
  >>
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(data), now(), id];
  await db.execute(`UPDATE tasks SET ${fields}, updated_at = ? WHERE id = ?`, values);
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?", [status, now(), id]);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = ?", [id]);
}

export async function getTodayCompletions(): Promise<string[]> {
  const db = await getDb();
  const today = new Date().toISOString().split("T")[0];
  const rows = await db.select<{ task_id: string }[]>(
    "SELECT task_id FROM task_completions WHERE completed_date = ?",
    [today]
  );
  return rows.map((r) => r.task_id);
}

export async function toggleTaskCompletion(taskId: string): Promise<void> {
  const db = await getDb();
  const today = new Date().toISOString().split("T")[0];
  const existing = await db.select<{ id: string }[]>(
    "SELECT id FROM task_completions WHERE task_id = ? AND completed_date = ?",
    [taskId, today]
  );
  if (existing.length > 0) {
    await db.execute(
      "DELETE FROM task_completions WHERE task_id = ? AND completed_date = ?",
      [taskId, today]
    );
  } else {
    await db.execute(
      "INSERT INTO task_completions (id, task_id, completed_date) VALUES (?, ?, ?)",
      [generateId(), taskId, today]
    );
  }
}

export async function getWeeklySummary(): Promise<{ done: Task[]; remaining: Task[] }> {
  const db = await getDb();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const startStr = weekStart.toISOString();

  const done = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE status = 'done' AND updated_at >= ? ORDER BY updated_at DESC",
    [startStr]
  );
  const remaining = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE status != 'done' ORDER BY is_urgent DESC, due_date",
    []
  );
  return { done, remaining };
}
