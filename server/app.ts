import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type Database from 'better-sqlite3';
import { ZodError } from 'zod';
import type { Config } from './config.ts';
import { tokenHash, verifyPassword } from './auth.ts';
import * as v from './validation.ts';
import { instantDateKey, sundayStartInstant, TIME_ZONE, timestampDate } from '../shared/date.ts';
import type { Goal, Task, Habit, HabitLog, TaskStatusEvent, TaskCompletion } from '../src/db/types.ts';
import type { Snapshot, WeeklySummary, PerformanceSource } from '../shared/api.ts';
const id = () => randomUUID().replaceAll('-', '');
let lastTimestamp = 0;
const now = () => new Date(lastTimestamp = Math.max(Date.now(), lastTimestamp + 1)).toISOString();
class HttpError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
export function snapshot(db: Database.Database): Snapshot {
  return db.transaction(() => {
    const today = instantDateKey();
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY is_urgent DESC, due_date, position, created_at').all() as Task[];
    return {
      today, timeZone: TIME_ZONE, tasks,
      goals: db.prepare('SELECT * FROM goals ORDER BY position, created_at').all() as Goal[],
      habits: db.prepare('SELECT * FROM habits ORDER BY created_at').all() as Habit[],
      habitLogs: db.prepare('SELECT * FROM habit_logs ORDER BY habit_id, logged_date').all() as HabitLog[],
      statusEvents: db.prepare('SELECT * FROM task_status_events ORDER BY task_id, occurred_at, id').all() as TaskStatusEvent[],
      taskCompletions: db.prepare('SELECT task_id, completed_date FROM task_completions ORDER BY completed_date').all() as TaskCompletion[],
      weeklySummary: {
        done: tasks.filter(t => t.status === 'done' && timestampDate(t.updated_at).getTime() >= new Date(sundayStartInstant(today)).getTime()).sort((a,b) => b.updated_at.localeCompare(a.updated_at)),
        remaining: tasks.filter(t => t.status !== 'done'),
      },
    };
  })();
}
export async function buildApp(db: Database.Database, config: Config, options: { logger?: boolean; serveStatic?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 64 * 1024, trustProxy: '127.0.0.1', ajv: { customOptions: { removeAdditional: false } } });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ message: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
    if ((error as {code?:string}).code?.startsWith('SQLITE_CONSTRAINT')) return reply.code(409).send({ message: 'This change conflicts with existing data. Refresh and try again.' });
    const status = (error as {statusCode?:number}).statusCode;
    if (status && status < 500) return reply.code(status).send({ message: status === 429 ? 'Too many attempts. Try again in a minute.' : 'Invalid request.' });
    request.log.error(error);
    return reply.code(500).send({ message: 'Unable to complete the request. Check the server log.' });
  });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'same-origin');
    reply.header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const route = request.routeOptions.url;
    if (!route?.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.headers.origin !== config.origin) throw new HttpError(403, 'Request origin is not allowed.');
    if (['/api/auth/login', '/api/auth/session', '/api/health'].includes(route)) return;
    const token = request.cookies.mycoach_session;
    const session = token && db.prepare('SELECT 1 FROM web_sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), Date.now());
    if (!session) throw new HttpError(401, 'Please sign in again. Your unsaved input is still here.');
  });
  app.get('/api/health', async () => { db.prepare('SELECT 1').get(); return { ok: true }; });
  app.get('/api/auth/session', async request => {
    const token = request.cookies.mycoach_session;
    return { authenticated: !!(token && db.prepare('SELECT 1 FROM web_sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), Date.now())) };
  });
  app.post('/api/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { password } = v.loginSchema.parse(request.body);
    const owner = db.prepare('SELECT password_hash FROM web_owner WHERE id = 1').get() as {password_hash:string} | undefined;
    if (!owner) throw new HttpError(503, 'Set up the owner password on the host first.');
    if (!await verifyPassword(password, owner.password_hash)) throw new HttpError(401, 'Incorrect password.');
    const token = randomBytes(32).toString('hex');
    const maxAge = 30 * 24 * 60 * 60;
    db.transaction(() => {
      db.prepare('DELETE FROM web_sessions WHERE expires_at <= ?').run(Date.now());
      if (request.cookies.mycoach_session) db.prepare('DELETE FROM web_sessions WHERE token_hash = ?').run(tokenHash(request.cookies.mycoach_session));
      db.prepare('INSERT INTO web_sessions VALUES (?, ?)').run(tokenHash(token), Date.now() + maxAge * 1000);
    })();
    reply.setCookie('mycoach_session', token, { path: '/', httpOnly: true, secure: config.secureCookies, sameSite: 'strict', maxAge });
    return { authenticated: true };
  });
  app.post('/api/auth/logout', async (request, reply) => {
    db.prepare('DELETE FROM web_sessions WHERE token_hash = ?').run(tokenHash(request.cookies.mycoach_session!));
    reply.clearCookie('mycoach_session', { path: '/', httpOnly: true, secure: config.secureCookies, sameSite: 'strict' });
    return { authenticated: false };
  });
  function existing(table: 'tasks' | 'goals' | 'habits', value: string) {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(v.idSchema.parse(value));
    if (!row) throw new HttpError(404, 'This item no longer exists. Refresh to see the latest data.');
    return row as Record<string, any>;
  }
  function references(data: Record<string, any>, taskId?: string) {
    if (data.parent_goal_id) existing('goals', data.parent_goal_id);
    if (data.parent_task_id) {
      let parent = data.parent_task_id;
      const visited = new Set<string>(taskId ? [taskId] : []);
      while (parent) {
        if (visited.has(parent)) throw new HttpError(400, 'A task cannot be its own ancestor.');
        visited.add(parent); parent = existing('tasks', parent).parent_task_id;
      }
    }
  }
  function taskRules(data: Record<string, any>) {
    if (data.task_type === 'recurring' && (!data.recurrence_type || (data.recurrence_type === 'custom' && !data.recurrence_days))) throw new HttpError(400, 'Recurring tasks need a schedule.');
  }
  function update(table: 'tasks' | 'goals', itemId: string, data: Record<string, any>) {
    const fields = Object.keys(data);
    db.prepare(`UPDATE ${table} SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...fields.map(f => data[f]), now(), itemId);
  }
  app.get('/api/state', async (): Promise<Snapshot> => snapshot(db));
  app.get('/api/performance', async (): Promise<PerformanceSource> => snapshot(db));
  app.get('/api/weekly', async (): Promise<WeeklySummary> => snapshot(db).weeklySummary);
  app.get('/api/goals', async () => snapshot(db).goals);
  app.get<{Params:{id:string}}>('/api/goals/:id', async request => existing('goals', request.params.id));
  app.post('/api/goals', async (request, reply) => {
    const data = v.createGoalSchema.parse(request.body); references(data);
    const itemId = id(), ts = now();
    db.prepare('INSERT INTO goals (id,title,description,target_date,parent_goal_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(itemId,data.title,data.description ?? null,data.target_date ?? null,data.parent_goal_id ?? null,ts,ts);
    return reply.code(201).send({ id: itemId });
  });
  app.patch<{Params:{id:string}}>('/api/goals/:id', async request => {
    existing('goals', request.params.id); update('goals', request.params.id, v.editGoalSchema.parse(request.body)); return { ok: true };
  });
  app.get('/api/tasks', async () => snapshot(db).tasks);
  app.post('/api/tasks', async (request, reply) => {
    const data = v.createTaskSchema.parse(request.body); references(data); taskRules(data);
    const itemId = id(), ts = now();
    db.prepare(`INSERT INTO tasks (id,title,due_date,is_urgent,parent_goal_id,parent_task_id,task_type,recurrence_type,recurrence_days,recurrence_end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(itemId,data.title,data.due_date ?? null,data.is_urgent ? 1 : 0,data.parent_goal_id ?? null,data.parent_task_id ?? null,data.task_type ?? 'onetime',data.recurrence_type ?? null,data.recurrence_days ?? null,data.recurrence_end_date ?? null,ts,ts);
    return reply.code(201).send({ id: itemId });
  });
  app.patch<{Params:{id:string}}>('/api/tasks/:id', async request => {
    const current = existing('tasks', request.params.id), data = v.editTaskSchema.parse(request.body);
    references(data, request.params.id); taskRules({ ...current, ...data }); update('tasks', request.params.id, data); return { ok: true };
  });
  app.get('/api/habits', async () => snapshot(db).habits);
  app.post('/api/habits', async (request, reply) => {
    const data = v.createHabitSchema.parse(request.body), itemId = id();
    db.prepare('INSERT INTO habits (id,name,frequency,created_at) VALUES (?,?,?,?)').run(itemId,data.name,data.frequency,now());
    return reply.code(201).send({ id: itemId });
  });
  app.put<{Params:{id:string}}>('/api/habits/:id/finished', async request => {
    existing('habits', request.params.id); const {finished} = v.finishSchema.parse(request.body);
    db.prepare(`UPDATE habits SET finished_at = ${finished ? 'COALESCE(finished_at, ?)' : 'NULL'} WHERE id = ?`).run(...(finished ? [now(),request.params.id] : [request.params.id])); return { ok: true };
  });
  for (const table of ['goals','tasks','habits'] as const) {
    app.delete<{Params:{id:string}}>(`/api/${table}/:id`, async request => {
      existing(table, request.params.id); db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(request.params.id); return { ok: true };
    });
  }
  for (const entity of ['tasks','habits'] as const) {
    app.put<{Params:{id:string;date:string}}>(`/api/${entity}/:id/check-ins/:date`, async request => {
      const item = existing(entity, request.params.id), date = v.dateSchema.parse(request.params.date), {checked} = v.checkSchema.parse(request.body);
      if (entity === 'tasks' && item.task_type !== 'recurring') throw new HttpError(400, 'Only recurring tasks have dated check-ins.');
      if (date > instantDateKey()) throw new HttpError(400, 'Future dates cannot be checked in.');
      const table = entity === 'tasks' ? 'task_completions' : 'habit_logs';
      const foreign = entity === 'tasks' ? 'task_id' : 'habit_id';
      const day = entity === 'tasks' ? 'completed_date' : 'logged_date';
      db.transaction(() => {
        if (checked) {
          if (entity === 'tasks') {
            db.prepare('INSERT OR IGNORE INTO task_completions (id,task_id,completed_date) VALUES (?,?,?)').run(id(),item.id,date);
            if (date === instantDateKey()) db.prepare("UPDATE tasks SET status='todo', updated_at=? WHERE id=? AND status='in_progress'").run(now(),item.id);
          }
          else db.prepare('INSERT OR IGNORE INTO habit_logs (id,habit_id,logged_date,created_at) VALUES (?,?,?,?)').run(id(),item.id,date,now());
        } else db.prepare(`DELETE FROM ${table} WHERE ${foreign} = ? AND ${day} = ?`).run(item.id,date);
      })();
      return { checked };
    });
  }
  if (options.serveStatic !== false && existsSync(resolve('dist/index.html'))) {
    await app.register(staticFiles, { root: resolve('dist'), index: 'index.html' });
  }
  return app;
}
