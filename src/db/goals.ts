import { api } from './index';
import type { Goal, GoalStatus } from './types';
import type { CreateGoal, EditGoal } from '../../shared/api';
export const getGoals = () => api<Goal[]>('/goals');
export const getGoal = (id: string) => api<Goal>(`/goals/${id}`);
export const createGoal = async (data: CreateGoal) => (await api<{id:string}>('/goals', 'POST', data)).id;
export const updateGoal = (id: string, data: EditGoal) => api(`/goals/${id}`, 'PATCH', data);
export const deleteGoal = (id: string) => api(`/goals/${id}`, 'DELETE');
export const setGoalStatus = (id: string, status: GoalStatus) => updateGoal(id, {status});
