import { api } from './index';
import type { PerformanceSource } from '../../shared/api';
export type { PerformanceSource } from '../../shared/api';
export const getPerformanceSource = () => api<PerformanceSource>('/performance');
