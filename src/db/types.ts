export type GoalStatus = "active" | "completed" | "paused";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskType = "onetime" | "recurring";
export type RecurrenceType = "daily" | "workdays" | "custom";
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
  is_urgent: number;
  parent_goal_id: string | null;
  parent_task_id: string | null;
  position: number;
  task_type: TaskType;
  recurrence_type: RecurrenceType | null;
  recurrence_days: string | null; // JSON number array, e.g. "[1,3,5]" (Mon/Wed/Fri)
  recurrence_end_date: string | null;
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
