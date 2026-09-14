import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { backup, domainSnapshot, importDatabase, migrate, migrations, openDatabase, validateDatabase } from './database';
let directory:string;
beforeEach(()=>{directory=mkdtempSync(resolve(tmpdir(),'mycoach-migration-'));});
afterEach(()=>rmSync(directory,{recursive:true,force:true}));
function desktop(version:number) {
  const path=resolve(directory,`desktop-${version}.db`),db=new Database(path);
  db.exec('CREATE TABLE _sqlx_migrations (version BIGINT PRIMARY KEY, checksum BLOB, success BOOLEAN)');
  for(const m of migrations.slice(0,version)) {
    db.exec(m.sql);db.prepare('INSERT INTO _sqlx_migrations VALUES (?,?,1)').run(m.version,m.sqlxChecksum);
  }
  if(version) {
    db.prepare("INSERT INTO goals (id,title) VALUES (?,?)").run('a'.repeat(32),'Original goal');
    db.prepare("INSERT INTO tasks (id,title,parent_goal_id) VALUES (?,?,?)").run('b'.repeat(32),'Original task','a'.repeat(32));
    db.prepare("INSERT INTO habits (id,name) VALUES (?,?)").run('c'.repeat(32),'Original habit');
    db.prepare("INSERT INTO habit_logs (habit_id,logged_date) VALUES (?,?)").run('c'.repeat(32),'2026-01-01');
  }
  const data=domainSnapshot(db);db.close();return {path,data};
}
describe('migration and recovery',()=>{
  it.each([0,1,2,3,4,5])('imports version %i without changing its source, and never replays history',async version=>{
    const source=desktop(version),target=resolve(directory,'web.db');
    const hash=()=>createHash('sha256').update(readFileSync(source.path)).digest('hex');const originalHash=hash();
    await importDatabase(source.path,target);expect(hash()).toBe(originalHash);
    const db=openDatabase(target);expect(validateDatabase(db)).toBe(5);
    if(version) {expect(db.prepare('SELECT title FROM goals').get()).toEqual({title:'Original goal'});expect(db.prepare('SELECT COUNT(*) AS count FROM habit_logs').get()).toEqual({count:1});}
    const before=domainSnapshot(db);migrate(db);expect(domainSnapshot(db)).toEqual(before);db.close();
    const reopened=openDatabase(target);expect(domainSnapshot(reopened)).toEqual(before);reopened.close();
    if(version===5) expect(before).toEqual(source.data);
  });
  it('refuses unsupported history, checksum mismatches, schema drift, and orphaned relations',()=>{
    const {path}=desktop(5),db=new Database(path);
    db.prepare('UPDATE _sqlx_migrations SET version=99 WHERE version=5').run();expect(()=>migrate(db)).toThrow(/history/);
    db.prepare('UPDATE _sqlx_migrations SET version=5 WHERE version=99').run();
    db.prepare('UPDATE _sqlx_migrations SET checksum=? WHERE version=5').run(Buffer.from('wrong'));expect(()=>migrate(db)).toThrow(/checksum/);
    db.prepare('UPDATE _sqlx_migrations SET checksum=? WHERE version=5').run(migrations[4].sqlxChecksum);
    db.exec('DROP TRIGGER task_status_event_after_update');expect(()=>migrate(db)).toThrow(/schema/);db.close();
    const other=desktop(2),orphan=new Database(other.path);orphan.pragma('foreign_keys=OFF');orphan.prepare('UPDATE tasks SET parent_goal_id=?').run('d'.repeat(32));expect(()=>migrate(orphan)).toThrow(/orphaned/);orphan.close();
  });
  it('backs up WAL data, restores it, and retains seven daily backups',async()=>{
    const db=openDatabase(resolve(directory,'live.db'));db.prepare('INSERT INTO goals (id,title) VALUES (?,?)').run('a'.repeat(32),'In WAL');
    const expected=domainSnapshot(db),dir=resolve(directory,'backups');
    const file=await backup(db,dir);
    for(let i=0;i<9;i++) await backup(db,dir,'daily');
    expect(readdirSync(dir).filter(f=>f.startsWith('daily-'))).toHaveLength(7);
    expect(readdirSync(dir).filter(f=>f.startsWith('manual-'))).toHaveLength(1);
    const restored=resolve(directory,'restored.db');await importDatabase(file,restored);
    const copy=openDatabase(restored);expect(domainSnapshot(copy)).toEqual(expected);copy.close();db.close();
  });
  it('does not overwrite an existing target',async()=>{
    const source=desktop(5);await expect(importDatabase(source.path,source.path)).rejects.toThrow(/different/);
    const target=openDatabase(resolve(directory,'existing.db'));target.close();
    await expect(importDatabase(source.path,resolve(directory,'existing.db'))).rejects.toThrow(/exists/);
  });
});
