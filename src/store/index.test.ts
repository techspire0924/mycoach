import { beforeEach, describe, expect, it, vi } from 'vitest';
const apiMock = vi.hoisted(() => vi.fn());
vi.mock('../db',()=>({api:apiMock}));
function state(title:string) {
  return {today:'2026-09-14', timeZone:'America/Chicago',goals:[],habits:[],habitLogs:[],statusEvents:[],taskCompletions:[],weeklySummary:{done:[],remaining:[]}, tasks:[{id:'a'.repeat(32),title,task_type:'onetime',status:'todo',parent_goal_id:null,parent_task_id:null}]};
}
beforeEach(()=>{
  vi.resetModules();apiMock.mockReset();
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{}});
});
describe('network state',()=>{
  it('discards an older response that finishes after a newer refresh',async()=>{
    const {useStore}=await import('./index');
    let resolveOld!:(value:unknown)=>void;
    apiMock.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;})).mockResolvedValueOnce(state('Latest'));
    const old=useStore.getState().refresh();await useStore.getState().refresh();resolveOld(state('Old'));await old;
    expect(useStore.getState().tasks[0].title).toBe('Latest');
  });
  it('does not replay a failed save and keeps the loaded data and error',async()=>{
    const {useStore}=await import('./index');apiMock.mockResolvedValueOnce(state('Existing'));await useStore.getState().refresh();
    apiMock.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(state('Existing'));
    await expect(useStore.getState().addTask({title:'Draft'})).rejects.toThrow('Connection lost');
    expect(useStore.getState().tasks[0].title).toBe('Existing');expect(useStore.getState().error).toBe('Connection lost');
    expect(apiMock.mock.calls.filter(([,method])=>method==='POST')).toHaveLength(1);
    expect(useStore.getState().pending).toBe(0);
  });
});
