import { getDb, generateId, now } from "./index";
import type { Habit, HabitFrequency, HabitLog } from "./types";

export async function getHabits(): Promise<Habit[]> {
  const db = await getDb();
  return db.select<Habit[]>("SELECT * FROM habits ORDER BY created_at");
}

export async function createHabit(data: { name: string; frequency: HabitFrequency }): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    "INSERT INTO habits (id, name, frequency, created_at) VALUES (?, ?, ?, ?)",
    [id, data.name, data.frequency, now()]
  );
  return id;
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM habits WHERE id = ?", [id]);
}

export async function getHabitLogs(habitId: string, since: string): Promise<HabitLog[]> {
  const db = await getDb();
  return db.select<HabitLog[]>(
    "SELECT * FROM habit_logs WHERE habit_id = ? AND logged_date >= ? ORDER BY logged_date",
    [habitId, since]
  );
}

export async function toggleHabitLog(habitId: string, date: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.select<HabitLog[]>(
    "SELECT id FROM habit_logs WHERE habit_id = ? AND logged_date = ?",
    [habitId, date]
  );
  if (existing.length > 0) {
    await db.execute("DELETE FROM habit_logs WHERE habit_id = ? AND logged_date = ?", [habitId, date]);
    return false;
  } else {
    await db.execute(
      "INSERT INTO habit_logs (id, habit_id, logged_date, created_at) VALUES (?, ?, ?, ?)",
      [generateId(), habitId, date, now()]
    );
    return true;
  }
}
