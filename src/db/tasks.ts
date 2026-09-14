import { api } from './index';
import type { Task, TaskStatus } from './types';
import type { CreateTask, EditTask, Snapshot, WeeklySummary } from '../../shared/api';
export const getAllTasks = () => api<Task[]>('/tasks');
export const getInboxTasks = async () => (await getAllTasks()).filter(t => !t.parent_goal_id && !t.parent_task_id && t.status === 'todo' && t.task_type === 'onetime');
export const createTask = async (data: CreateTask) => (await api<{id:string}>('/tasks', 'POST', data)).id;
export const updateTask = (id: string, data: EditTask) => api(`/tasks/${id}`, 'PATCH', data);
export const setTaskStatus = (id: string, status: TaskStatus) => updateTask(id, {status});
export const deleteTask = (id: string) => api(`/tasks/${id}`, 'DELETE');
export const setTaskCompletion = (id: string, date: string, checked: boolean) => api(`/tasks/${id}/check-ins/${date}`, 'PUT', {checked});
export const getWeeklySummary = () => api<WeeklySummary>('/weekly');
export const getTodayCompletions = async () => {
  const state = await api<Snapshot>('/state');
  return state.taskCompletions.filter(c => c.completed_date === state.today).map(c => c.task_id);
};
