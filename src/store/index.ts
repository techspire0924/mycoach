import { create } from "zustand";
import type { Goal, Task, Habit, HabitLog } from "../db/types";
import { getGoals, createGoal, updateGoal, deleteGoal, setGoalStatus } from "../db/goals";
import { getAllTasks, getInboxTasks, createTask, setTaskStatus, deleteTask, updateTask, getWeeklySummary } from "../db/tasks";
import { getHabits, createHabit, deleteHabit, getHabitLogs, toggleHabitLog } from "../db/habits";

export type View = "inbox" | "daily" | "weekly" | "goals" | "habits";
export type Theme = "cosmic" | "arctic" | "midnight";

export const THEMES: { id: Theme; name: string; dot1: string; dot2: string }[] = [
  { id: "cosmic",   name: "Cosmic",   dot1: "#7c3aed", dot2: "#ec4899" },
  { id: "arctic",   name: "Arctic",   dot1: "#7c3aed", dot2: "#6366f1" },
  { id: "midnight", name: "Midnight", dot1: "#3b82f6", dot2: "#f59e0b" },
];

interface WeeklySummary {
  done: Task[];
  remaining: Task[];
}

interface AppState {
  view: View;
  theme: Theme;
  setTheme: (t: Theme) => void;
  goals: Goal[];
  tasks: Task[];
  inboxTasks: Task[];
  habits: Habit[];
  habitLogs: Record<string, HabitLog[]>;
  weeklySummary: WeeklySummary | null;
  loading: boolean;

  setView: (v: View) => Promise<void>;

  loadGoals: () => Promise<void>;
  addGoal: (data: { title: string; description?: string; target_date?: string; parent_goal_id?: string }) => Promise<void>;
  editGoal: (id: string, data: Partial<Pick<Goal, "title" | "description" | "target_date" | "status">>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  completeGoal: (id: string) => Promise<void>;

  loadTasks: () => Promise<void>;
  loadInbox: () => Promise<void>;
  addTask: (data: { title: string; due_date?: string; is_urgent?: boolean; parent_goal_id?: string; parent_task_id?: string }) => Promise<void>;
  cycleTaskStatus: (id: string, currentStatus: string) => Promise<void>;
  editTask: (id: string, data: Partial<Pick<Task, "title" | "status" | "due_date" | "is_urgent" | "parent_goal_id" | "parent_task_id">>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  triageTask: (id: string, goalId: string) => Promise<void>;

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
  theme: (localStorage.getItem("mycoach-theme") as Theme) ?? "cosmic",
  setTheme: (t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("mycoach-theme", t);
    set({ theme: t });
  },
  goals: [],
  tasks: [],
  inboxTasks: [],
  habits: [],
  habitLogs: {},
  weeklySummary: null,
  loading: false,

  setView: async (v) => {
    set({ view: v });
    if (v === "weekly") await get().loadWeekly();
    if (v === "daily") await get().loadTasks();
    if (v === "inbox") await Promise.all([get().loadTasks(), get().loadInbox()]);
  },

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
    await Promise.all([get().loadGoals(), get().loadTasks()]);
  },

  completeGoal: async (id) => {
    await setGoalStatus(id, "completed");
    await get().loadGoals();
  },

  loadTasks: async () => {
    const tasks = await getAllTasks();
    set({ tasks });
  },

  loadInbox: async () => {
    const inboxTasks = await getInboxTasks();
    set({ inboxTasks });
  },

  addTask: async (data) => {
    await createTask(data);
    await Promise.all([get().loadTasks(), get().loadInbox()]);
  },

  cycleTaskStatus: async (id, currentStatus) => {
    const next = currentStatus === "todo" ? "in_progress" : currentStatus === "in_progress" ? "done" : "todo";
    await setTaskStatus(id, next);
    await Promise.all([get().loadTasks(), get().loadInbox(), get().loadWeekly()]);
  },

  editTask: async (id, data) => {
    await updateTask(id, data);
    await Promise.all([get().loadTasks(), get().loadInbox()]);
  },

  removeTask: async (id) => {
    await deleteTask(id);
    await Promise.all([get().loadTasks(), get().loadInbox()]);
  },

  triageTask: async (id, goalId) => {
    await updateTask(id, { parent_goal_id: goalId });
    await Promise.all([get().loadTasks(), get().loadInbox()]);
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
    await Promise.all([
      get().loadGoals(),
      get().loadTasks(),
      get().loadInbox(),
      get().loadHabits(),
      get().loadWeekly(),
    ]);
    set({ loading: false });
  },
}));
