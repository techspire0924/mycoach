import { create } from 'zustand';
import type { Goal, Task, Habit, HabitLog } from '../db/types';
import type { CreateGoal, EditGoal, CreateTask, EditTask, CreateHabit, Snapshot, PerformanceSource, WeeklySummary } from '../../shared/api';
import { api } from '../db';
import * as goalsDb from '../db/goals';
import * as tasksDb from '../db/tasks';
import * as habitsDb from '../db/habits';
import { toLocalDateKey } from '../utils/date';
export type View = 'inbox' | 'today' | 'tasks' | 'weekly' | 'goals' | 'habits' | 'calendar' | 'performance';
export type Theme = 'cosmic' | 'arctic' | 'midnight';
export const THEMES: {id: Theme; name: string; dot1: string; dot2: string}[] = [
  { id: 'cosmic', name: 'Cosmic', dot1: '#7c3aed', dot2: '#ec4899' },
  { id: 'arctic', name: 'Arctic', dot1: '#7c3aed', dot2: '#6366f1' },
  { id: 'midnight', name: 'Midnight', dot1: '#3b82f6', dot2: '#f59e0b' },
];
interface AppState {
  view: View; theme: Theme; setTheme: (theme: Theme) => void;
  goals: Goal[]; tasks: Task[]; inboxTasks: Task[]; habits: Habit[];
  habitLogs: Record<string, HabitLog[]>; weeklySummary: WeeklySummary | null;
  performanceSource: PerformanceSource | null; todayCompletions: string[];
  loading: boolean; loaded: boolean; error: string | null; connected: boolean; pending: number;
  focusMode: boolean; setFocusMode: (value: boolean) => void;
  setView: (view: View) => Promise<void>; loadAll: () => Promise<void>; refresh: () => Promise<void>;
  loadGoals: () => Promise<void>; loadTasks: () => Promise<void>; loadInbox: () => Promise<void>;
  loadHabits: () => Promise<void>; loadHabitLogs: (id: string) => Promise<void>; loadWeekly: () => Promise<void>; loadTodayCompletions: () => Promise<void>;
  addGoal: (data: CreateGoal) => Promise<void>; editGoal: (id: string, data: EditGoal) => Promise<void>; removeGoal: (id: string) => Promise<void>; completeGoal: (id: string) => Promise<void>;
  addTask: (data: CreateTask) => Promise<void>; editTask: (id: string, data: EditTask) => Promise<void>; removeTask: (id: string) => Promise<void>; triageTask: (id: string, goal: string) => Promise<void>; cycleTaskStatus: (id: string, current: string) => Promise<void>; toggleRecurring: (id: string) => Promise<void>;
  addHabit: (data: CreateHabit) => Promise<void>; removeHabit: (id: string) => Promise<void>; completeHabit: (id: string) => Promise<void>; resumeHabit: (id: string) => Promise<void>; toggleHabit: (id: string, date: string) => Promise<void>;
  clearError: () => void; reset: () => void;
}
let generation = 0;
const empty = { goals: [], tasks: [], inboxTasks: [], habits: [], habitLogs: {}, weeklySummary: null, todayCompletions: [], performanceSource: null, loaded: false };
export const useStore = create<AppState>((set, get) => {
  async function refresh() {
    const ticket = ++generation;
    try {
      const data = await api<Snapshot>('/state');
      if (ticket !== generation) return;
      const habitLogs: Record<string, HabitLog[]> = {};
      for (const log of data.habitLogs) (habitLogs[log.habit_id] ??= []).push(log);
      set({ goals: data.goals, tasks: data.tasks, habits: data.habits, habitLogs,
        inboxTasks: data.tasks.filter(t => !t.parent_goal_id && !t.parent_task_id && t.status === 'todo' && t.task_type === 'onetime'),
        weeklySummary: data.weeklySummary, performanceSource: data,
        todayCompletions: data.taskCompletions.filter(c => c.completed_date === data.today).map(c => c.task_id),
        loaded: true, loading: false, connected: true });
    } catch (error) {
      if (ticket === generation) set({ loading: false, connected: false, error: (error as Error).message });
    }
  }
  async function mutate(operation: () => Promise<unknown>) {
    if (get().pending) throw new Error('Wait for the current save to finish.');
    ++generation;
    set({ pending: 1, error: null });
    try { await operation(); }
    catch (error) { set({ error: (error as Error).message }); throw error; }
    finally { set({ pending: 0 }); await refresh(); }
  }
  return {
    ...empty, view: 'today', theme: (localStorage.getItem('mycoach-theme') as Theme) ?? 'cosmic',
    setTheme: theme => { localStorage.setItem('mycoach-theme', theme); document.documentElement.setAttribute('data-theme', theme); set({theme}); },
    loading: false, error: null, connected: true, pending: 0, focusMode: false,
    setFocusMode: focusMode => set({focusMode}), clearError: () => set({error: null}),
    reset: () => { ++generation; set({...empty, error:null}); },
    setView: async view => { set({view}); await refresh(); },
    refresh, loadAll: async () => { if (!get().loaded) set({loading:true}); await refresh(); },
    loadGoals: refresh, loadTasks: refresh, loadInbox: refresh, loadHabits: refresh,
    loadHabitLogs: async () => {}, loadWeekly: refresh, loadTodayCompletions: refresh,
    addGoal: data => mutate(() => goalsDb.createGoal(data)), editGoal: (id,data) => mutate(() => goalsDb.updateGoal(id,data)),
    removeGoal: id => mutate(() => goalsDb.deleteGoal(id)), completeGoal: id => mutate(() => goalsDb.setGoalStatus(id,'completed')),
    addTask: data => mutate(() => tasksDb.createTask(data)), editTask: (id,data) => mutate(() => tasksDb.updateTask(id,data)),
    removeTask: id => mutate(() => tasksDb.deleteTask(id)), triageTask: (id,goal) => mutate(() => tasksDb.updateTask(id,{parent_goal_id:goal})),
    cycleTaskStatus: (id,current) => mutate(() => tasksDb.setTaskStatus(id,current === 'todo' ? 'in_progress' : current === 'in_progress' ? 'done' : 'todo')),
    toggleRecurring: id => { const checked = !get().todayCompletions.includes(id); return mutate(() => tasksDb.setTaskCompletion(id,toLocalDateKey(),checked)); },
    addHabit: data => mutate(() => habitsDb.createHabit(data)), removeHabit: id => mutate(() => habitsDb.deleteHabit(id)),
    completeHabit: id => mutate(() => habitsDb.finishHabit(id)), resumeHabit: id => mutate(() => habitsDb.reopenHabit(id)),
    toggleHabit: (id,date) => { const checked = !(get().habitLogs[id] ?? []).some(l => l.logged_date === date); return mutate(() => habitsDb.setHabitLog(id,date,checked)); },
  };
});
