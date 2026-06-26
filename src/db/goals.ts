import { getDb, generateId, now } from "./index";
import type { Goal, GoalStatus } from "./types";

export async function getGoals(): Promise<Goal[]> {
  const db = await getDb();
  return db.select<Goal[]>("SELECT * FROM goals ORDER BY position, created_at");
}

export async function getGoal(id: string): Promise<Goal | null> {
  const db = await getDb();
  const rows = await db.select<Goal[]>("SELECT * FROM goals WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function createGoal(data: {
  title: string;
  description?: string;
  target_date?: string;
  parent_goal_id?: string;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const ts = now();
  await db.execute(
    `INSERT INTO goals (id, title, description, target_date, parent_goal_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.description ?? null, data.target_date ?? null, data.parent_goal_id ?? null, ts, ts]
  );
  return id;
}

export async function updateGoal(id: string, data: Partial<Pick<Goal, "title" | "description" | "target_date" | "status">>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(data), now(), id];
  await db.execute(`UPDATE goals SET ${fields}, updated_at = ? WHERE id = ?`, values);
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM goals WHERE id = ?", [id]);
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE goals SET status = ?, updated_at = ? WHERE id = ?", [status, now(), id]);
}
