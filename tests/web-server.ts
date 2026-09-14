import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { openDatabase } from '../server/database.ts';
import { buildApp } from '../server/app.ts';
import { hashPassword } from '../server/auth.ts';
const directory=mkdtempSync(resolve(tmpdir(),'mycoach-browser-'));
const db=openDatabase(resolve(directory,'mycoach.db'));
db.prepare('INSERT INTO web_owner VALUES (1,?)').run(await hashPassword('browser-test-password'));
const app=await buildApp(db,{dataDir:directory,port:4317,origin:'http://127.0.0.1:4317',secureCookies:false});
await app.listen({host:'127.0.0.1',port:4317});
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>{
  void app.close().then(()=>{db.close();rmSync(directory,{recursive:true,force:true});process.exit(0);});
});
