export type GoalStatus = "active" | "completed" | "paused";
export type TaskStatus = "todo" | "in_progress" | "done";
export type HabitFrequency = "daily" | "weekly";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: GoalStatus;
  parent_goal_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  is_urgent: number; // 0 or 1 (SQLite boolean)
  parent_goal_id: string | null;
  parent_task_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  name: string;
  frequency: HabitFrequency;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  logged_date: string;
  created_at: string;
}
