import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { openDatabase } from './database';
import { hashPassword } from './auth';
import { buildApp } from './app';
import { instantDateKey } from '../shared/date';
import type { Snapshot } from '../shared/api';
const origin = 'https://192.168.1.20:8443';
let directory: string, db: ReturnType<typeof openDatabase>, app: Awaited<ReturnType<typeof buildApp>>, cookie: string;
const password = 'test-owner-password';
async function request(method: 'GET'|'POST'|'PATCH'|'PUT'|'DELETE', url: string, payload?: any, overrides: Record<string,string> = {}) {
  return app.inject({method,url,payload,headers:{origin,cookie,...overrides}});
}
async function create(url: string, payload: any) {
  const result = await request('POST',url,payload); expect(result.statusCode,result.body).toBe(201); return result.json().id as string;
}
beforeEach(async () => {
  directory=mkdtempSync(resolve(tmpdir(),'mycoach-api-'));
  db=openDatabase(resolve(directory,'mycoach.db'));
  db.prepare('INSERT INTO web_owner VALUES (1,?)').run(await hashPassword(password));
  app=await buildApp(db,{dataDir:directory,origin,port:3001,secureCookies:true},{serveStatic:false});
  const login=await app.inject({method:'POST',url:'/api/auth/login',payload:{password},headers:{origin}});
  expect(login.statusCode).toBe(200);cookie=String(login.headers['set-cookie']).split(';')[0];
});
afterEach(async () => {await app?.close();db?.close();rmSync(directory,{recursive:true,force:true});});
describe('owner access', () => {
  it('requires authentication and exact origin, without exposing data',async () => {
    expect((await app.inject('/api/state')).statusCode).toBe(401);
    expect((await request('POST','/api/tasks',{title:'forbidden'},{origin:'https://evil.example'})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:'/api/tasks',headers:{cookie},payload:{title:'forbidden'}})).statusCode).toBe(403);
    expect((await request('GET','/api/state')).headers['cache-control']).toBe('no-store');
    for (const url of ['/api/tasks?x=1','/api/performance','/api/goals','/api/weekly']) expect((await app.inject(url)).statusCode).toBe(401);
  });
  it('sets secure cookies, expires sessions and revokes logout',async () => {
    const login=await request('POST','/api/auth/login',{password});
    const header=String(login.headers['set-cookie']);
    expect(header).toMatch(/HttpOnly/i);expect(header).toMatch(/Secure/);expect(header).toMatch(/SameSite=Strict/i);
    cookie=header.split(';')[0];
    expect((await request('POST','/api/auth/logout')).statusCode).toBe(200);
    expect((await request('GET','/api/state')).statusCode).toBe(401);
    const again=await request('POST','/api/auth/login',{password});cookie=String(again.headers['set-cookie']).split(';')[0];
    db.exec('UPDATE web_sessions SET expires_at = 0');
    expect((await request('GET','/api/state')).statusCode).toBe(401);
  });
  it('rate limits password guessing',async () => {
    for(let i=0;i<4;i++) expect((await request('POST','/api/auth/login',{password:'incorrect-password'})).statusCode).toBe(401);
    expect((await request('POST','/api/auth/login',{password})).statusCode).toBe(429);
  });
});
describe('shared data', () => {
  it('preserves task lifecycle events, nesting, weekly summary and cascades',async () => {
    const goal=await create('/api/goals',{title:'Learn'});
    const subgoal=await create('/api/goals',{title:'Practice',parent_goal_id:goal});
    const task=await create('/api/tasks',{title:'Read',parent_goal_id:subgoal});
    const child=await create('/api/tasks',{title:'Notes',parent_task_id:task});
    expect((await request('PATCH',`/api/tasks/${task}`,{status:'in_progress'})).statusCode).toBe(200);
    await request('PATCH',`/api/tasks/${task}`,{status:'done'});
    await request('PATCH',`/api/tasks/${task}`,{status:'done'});
    const state=(await request('GET','/api/state')).json<Snapshot>();
    expect(state.statusEvents.filter(e=>e.task_id===task).map(e=>e.to_status)).toEqual(['todo','in_progress','done']);
    expect(state.weeklySummary.done.map(t=>t.id)).toContain(task);
    expect((await request('GET','/api/performance')).json().statusEvents).toEqual(state.statusEvents);
    await request('DELETE',`/api/goals/${goal}`);
    const after=(await request('GET','/api/state')).json<Snapshot>();
    expect(after.goals).toHaveLength(0);expect(after.tasks).toHaveLength(0);expect(after.statusEvents).toHaveLength(0);
    expect((await request('PATCH',`/api/tasks/${child}`,{title:'gone'})).statusCode).toBe(404);
  });
  it('uses idempotent dated task and habit check-ins, including concurrent requests',async () => {
    const task=await create('/api/tasks',{title:'Walk',task_type:'recurring',recurrence_type:'custom',recurrence_days:'[1,3,5]'});
    const habit=await create('/api/habits',{name:'Water',frequency:'daily'});
    const date=instantDateKey();
    const results=await Promise.all(Array.from({length:5},()=>request('PUT',`/api/tasks/${task}/check-ins/${date}`,{checked:true})));
    expect(results.every(r=>r.statusCode===200)).toBe(true);
    await request('PUT',`/api/habits/${habit}/check-ins/${date}`,{checked:true});
    await request('PUT',`/api/habits/${habit}/check-ins/${date}`,{checked:true});
    let state=(await request('GET','/api/state')).json<Snapshot>();
    expect(state.taskCompletions).toHaveLength(1);expect(state.habitLogs).toHaveLength(1);
    const before=state.habitLogs;
    await request('PUT',`/api/habits/${habit}/finished`,{finished:true});
    await request('PUT',`/api/habits/${habit}/finished`,{finished:true});
    state=(await request('GET','/api/state')).json<Snapshot>();
    expect(state.habits[0].finished_at).toBeTruthy();expect(state.habitLogs).toEqual(before);
    await request('PUT',`/api/habits/${habit}/finished`,{finished:false});
    await request('PUT',`/api/tasks/${task}/check-ins/${date}`,{checked:false});
    await request('PUT',`/api/tasks/${task}/check-ins/${date}`,{checked:false});
    state=(await request('GET','/api/state')).json<Snapshot>();expect(state.taskCompletions).toHaveLength(0);expect(state.habits[0].finished_at).toBeNull();
    await request('DELETE',`/api/habits/${habit}`);expect((await request('GET','/api/state')).json().habitLogs).toHaveLength(0);
  });
  it('validates dates, fields, relations, cycles and schedules; accepts explicit clears',async () => {
    expect((await request('POST','/api/tasks',{title:'Bad',extra:'x'})).statusCode).toBe(400);
    expect((await request('POST','/api/tasks',{title:'Bad',due_date:'2026-02-30'})).statusCode).toBe(400);
    expect((await request('POST','/api/tasks',{title:'Bad',task_type:'recurring'})).statusCode).toBe(400);
    expect((await request('POST','/api/tasks',{title:'Bad',parent_goal_id:'a'.repeat(32)})).statusCode).toBe(404);
    const parent=await create('/api/tasks',{title:'Parent',due_date:'2026-09-20'});
    const child=await create('/api/tasks',{title:'Child',parent_task_id:parent});
    expect((await request('PATCH',`/api/tasks/${parent}`,{parent_task_id:child})).statusCode).toBe(400);
    expect((await request('PATCH',`/api/tasks/${parent}`,{})).statusCode).toBe(400);
    await request('PATCH',`/api/tasks/${parent}`,{due_date:null});
    expect((await request('GET','/api/state')).json<Snapshot>().tasks.find(t=>t.id===parent)?.due_date).toBeNull();
    expect((await request('PUT',`/api/tasks/${parent}/check-ins/2026-01-01`,{checked:true})).statusCode).toBe(400);
  });
  it('shares committed changes across sessions and persists after restart',async () => {
    const task=await create('/api/tasks',{title:'First'});
    const login=await request('POST','/api/auth/login',{password});const other=String(login.headers['set-cookie']).split(';')[0];
    await request('PATCH',`/api/tasks/${task}`,{title:'Second'},{cookie:other});
    expect((await request('GET','/api/state',undefined,{cookie:other})).json<Snapshot>().tasks[0].title).toBe('Second');
    await app.close();db.close();db=openDatabase(resolve(directory,'mycoach.db'));
    app=await buildApp(db,{dataDir:directory,origin,port:3001,secureCookies:true},{serveStatic:false});
    expect((await request('GET','/api/state',undefined,{cookie:other})).json<Snapshot>().tasks[0].title).toBe('Second');
  });
});
