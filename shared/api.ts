import type { Goal, Task, Habit, HabitLog, TaskCompletion, TaskStatusEvent } from '../src/db/types.ts';
export type CreateGoal = Pick<Goal, 'title'> & Partial<Pick<Goal, 'description' | 'target_date' | 'parent_goal_id'>>;
export type EditGoal = Partial<Pick<Goal, 'title' | 'description' | 'target_date' | 'status'>>;
export type CreateTask = Pick<Task, 'title'> & Partial<Pick<Task, 'due_date' | 'parent_goal_id' | 'parent_task_id' | 'task_type' | 'recurrence_type' | 'recurrence_days' | 'recurrence_end_date'>> & { is_urgent?: boolean };
export type EditTask = Partial<Pick<Task, 'title' | 'status' | 'due_date' | 'is_urgent' | 'parent_goal_id' | 'parent_task_id' | 'task_type' | 'recurrence_type' | 'recurrence_days' | 'recurrence_end_date'>>;
export type CreateHabit = Pick<Habit, 'name' | 'frequency'>;
export interface PerformanceSource {
  goals: Goal[]; tasks: Task[]; habits: Habit[]; habitLogs: HabitLog[];
  taskCompletions: TaskCompletion[]; statusEvents: TaskStatusEvent[];
}
export interface WeeklySummary { done: Task[]; remaining: Task[] }
export interface Snapshot extends PerformanceSource {
  today: string; weeklySummary: WeeklySummary; timeZone: 'America/Chicago';
}
export interface AuthState { authenticated: boolean }
export interface ApiError { message: string }
export interface CheckIn { checked: boolean }
