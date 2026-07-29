import { getDb } from "./index";
import type {
  Goal,
  Habit,
  HabitLog,
  Task,
  TaskCompletion,
  TaskStatusEvent,
} from "./types";

export interface PerformanceSource {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  statusEvents: TaskStatusEvent[];
  taskCompletions: TaskCompletion[];
  habitLogs: HabitLog[];
}

export async function getPerformanceSource(): Promise<PerformanceSource> {
  const db = await getDb();
  const [tasks, goals, habits, statusEvents, taskCompletions, habitLogs] = await Promise.all([
    db.select<Task[]>("SELECT * FROM tasks ORDER BY created_at DESC"),
    db.select<Goal[]>("SELECT * FROM goals ORDER BY position, created_at"),
    db.select<Habit[]>("SELECT * FROM habits ORDER BY created_at"),
    db.select<TaskStatusEvent[]>(
      "SELECT * FROM task_status_events ORDER BY task_id, occurred_at, id",
    ),
    db.select<TaskCompletion[]>(
      "SELECT task_id, completed_date FROM task_completions ORDER BY completed_date",
    ),
    db.select<HabitLog[]>(
      "SELECT * FROM habit_logs ORDER BY habit_id, logged_date",
    ),
  ]);

  return { tasks, goals, habits, statusEvents, taskCompletions, habitLogs };
}
