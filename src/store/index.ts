import { create } from "zustand";
import type { Goal, Task, Habit, HabitLog } from "../db/types";
import { getGoals, createGoal, updateGoal, deleteGoal, setGoalStatus } from "../db/goals";
import { getAllOpenTasks, getInboxTasks, createTask, setTaskStatus, deleteTask, updateTask, getWeeklySummary } from "../db/tasks";
import { getHabits, createHabit, deleteHabit, getHabitLogs, toggleHabitLog } from "../db/habits";

export type View = "inbox" | "daily" | "weekly" | "goals" | "habits";

interface WeeklySummary {
  done: Task[];
  remaining: Task[];
}

interface AppState {
  view: View;
  goals: Goal[];
  tasks: Task[];
  inboxTasks: Task[];
  habits: Habit[];
  habitLogs: Record<string, HabitLog[]>; // habitId -> logs
  weeklySummary: WeeklySummary | null;
  loading: boolean;

  setView: (v: View) => void;

  loadGoals: () => Promise<void>;
  addGoal: (data: { title: string; description?: string; target_date?: string; parent_goal_id?: string }) => Promise<void>;
  editGoal: (id: string, data: Partial<Pick<Goal, "title" | "description" | "target_date" | "status">>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  completeGoal: (id: string) => Promise<void>;

  loadTasks: () => Promise<void>;
  loadInbox: () => Promise<void>;
  addTask: (data: { title: string; due_date?: string; is_urgent?: boolean; parent_goal_id?: string; parent_task_id?: string }) => Promise<void>;
  toggleTask: (id: string, currentStatus: string) => Promise<void>;
  editTask: (id: string, data: Partial<Pick<Task, "title" | "status" | "due_date" | "is_urgent" | "parent_goal_id">>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  triageTask: (id: string, goalId: string | null) => Promise<void>;

  loadHabits: () => Promise<void>;
  loadHabitLogs: (habitId: string) => Promise<void>;
  addHabit: (data: { name: string; frequency: "daily" | "weekly" }) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggleHabit: (habitId: string, date: string) => Promise<void>;

  loadWeekly: () => Promise<void>;

  loadAll: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  view: "inbox",
  goals: [],
  tasks: [],
  inboxTasks: [],
  habits: [],
  habitLogs: {},
  weeklySummary: null,
  loading: false,

  setView: (v) => set({ view: v }),

  loadGoals: async () => {
    const goals = await getGoals();
    set({ goals });
  },

  addGoal: async (data) => {
    await createGoal(data);
    await get().loadGoals();
  },

  editGoal: async (id, data) => {
    await updateGoal(id, data);
    await get().loadGoals();
  },

  removeGoal: async (id) => {
    await deleteGoal(id);
    await get().loadGoals();
    await get().loadTasks();
  },

  completeGoal: async (id) => {
    await setGoalStatus(id, "completed");
    await get().loadGoals();
  },

  loadTasks: async () => {
    const tasks = await getAllOpenTasks();
    set({ tasks });
  },

  loadInbox: async () => {
    const inboxTasks = await getInboxTasks();
    set({ inboxTasks });
  },

  addTask: async (data) => {
    await createTask(data);
    await get().loadTasks();
    await get().loadInbox();
  },

  toggleTask: async (id, currentStatus) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    await setTaskStatus(id, newStatus);
    await get().loadTasks();
    await get().loadInbox();
  },

  editTask: async (id, data) => {
    await updateTask(id, data);
    await get().loadTasks();
    await get().loadInbox();
  },

  removeTask: async (id) => {
    await deleteTask(id);
    await get().loadTasks();
    await get().loadInbox();
  },

  triageTask: async (id, goalId) => {
    await updateTask(id, { parent_goal_id: goalId ?? undefined });
    await get().loadTasks();
    await get().loadInbox();
  },

  loadHabits: async () => {
    const habits = await getHabits();
    set({ habits });
  },

  loadHabitLogs: async (habitId) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const logs = await getHabitLogs(habitId, weekAgo.toISOString().split("T")[0]);
    set((s) => ({ habitLogs: { ...s.habitLogs, [habitId]: logs } }));
  },

  addHabit: async (data) => {
    await createHabit(data);
    await get().loadHabits();
  },

  removeHabit: async (id) => {
    await deleteHabit(id);
    await get().loadHabits();
  },

  toggleHabit: async (habitId, date) => {
    await toggleHabitLog(habitId, date);
    await get().loadHabitLogs(habitId);
  },

  loadWeekly: async () => {
    const weeklySummary = await getWeeklySummary();
    set({ weeklySummary });
  },

  loadAll: async () => {
    set({ loading: true });
    await Promise.all([get().loadGoals(), get().loadTasks(), get().loadInbox(), get().loadHabits(), get().loadWeekly()]);
    set({ loading: false });
  },
}));
