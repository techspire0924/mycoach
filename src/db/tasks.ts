import { getDb, generateId, now } from "./index";
import type { Task, TaskStatus } from "./types";

export async function getTasks(filter?: { parent_goal_id?: string; parent_task_id?: string }): Promise<Task[]> {
  const db = await getDb();
  if (filter?.parent_goal_id) {
    return db.select<Task[]>(
      "SELECT * FROM tasks WHERE parent_goal_id = ? AND parent_task_id IS NULL ORDER BY position, created_at",
      [filter.parent_goal_id]
    );
  }
  if (filter?.parent_task_id) {
    return db.select<Task[]>(
      "SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY position, created_at",
      [filter.parent_task_id]
    );
  }
  return db.select<Task[]>("SELECT * FROM tasks ORDER BY is_urgent DESC, due_date, position, created_at");
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks ORDER BY is_urgent DESC, due_date, position, created_at"
  );
}

export async function getInboxTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks WHERE parent_goal_id IS NULL AND parent_task_id IS NULL AND status = 'todo' ORDER BY created_at DESC"
  );
}

export async function createTask(data: {
  title: string;
  due_date?: string;
  is_urgent?: boolean;
  parent_goal_id?: string;
  parent_task_id?: string;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const ts = now();
  await db.execute(
    `INSERT INTO tasks (id, title, due_date, is_urgent, parent_goal_id, parent_task_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.title,
      data.due_date ?? null,
      data.is_urgent ? 1 : 0,
      data.parent_goal_id ?? null,
      data.parent_task_id ?? null,
      ts,
      ts,
    ]
  );
  return id;
}

export async function updateTask(id: string, data: Partial<Pick<Task, "title" | "status" | "due_date" | "is_urgent" | "parent_goal_id" | "parent_task_id">>): Promise<void> {
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
