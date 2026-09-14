import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  try { return Temporal.PlainDate.from(value).toString() === value; } catch { return false; }
}, 'Invalid date');
export const dateSchema = date;
export const idSchema = z.string().regex(/^[a-f0-9]{32}$/);
const text = z.string().trim().min(1).max(1000);
const ref = idSchema.nullable().optional();
const optionalDate = date.nullable().optional();
const taskFields = {
  title: text, due_date: optionalDate, parent_goal_id: ref, parent_task_id: ref,
  task_type: z.enum(['onetime', 'recurring']).optional(),
  recurrence_type: z.enum(['daily', 'workdays', 'custom']).nullable().optional(),
  recurrence_days: z.string().refine(value => {
    try {
      const days = JSON.parse(value);
      return Array.isArray(days) && days.length > 0 && days.length <= 7 && new Set(days).size === days.length && days.every(d => Number.isInteger(d) && d >= 0 && d <= 6);
    } catch { return false; }
  }, 'Choose at least one unique weekday').nullable().optional(),
  recurrence_end_date: optionalDate,
};
export const createTaskSchema = z.strictObject({ ...taskFields, is_urgent: z.boolean().optional() });
export const editTaskSchema = z.strictObject({ ...taskFields, title: text.optional(), is_urgent: z.union([z.literal(0), z.literal(1)]).optional(), status: z.enum(['todo', 'in_progress', 'done']).optional() }).refine(v => Object.keys(v).length > 0, 'No changes supplied');
export const createGoalSchema = z.strictObject({ title: text, description: z.string().max(10000).nullable().optional(), target_date: optionalDate, parent_goal_id: ref });
export const editGoalSchema = createGoalSchema.omit({ parent_goal_id: true }).partial().extend({ status: z.enum(['active', 'completed', 'paused']).optional() }).refine(v => Object.keys(v).length > 0, 'No changes supplied');
export const createHabitSchema = z.strictObject({ name: text, frequency: z.enum(['daily', 'weekly']) });
export const checkSchema = z.strictObject({ checked: z.boolean() });
export const finishSchema = z.strictObject({ finished: z.boolean() });
export const loginSchema = z.strictObject({ password: z.string().min(1).max(256) });
