import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync, chmodSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { config } from './config.ts';
import { openDatabase, backup, importDatabase, validateDatabase } from './database.ts';
import { hashPassword } from './auth.ts';
import { assertStopped } from './lock.ts';
import { generateHost } from './hosting.ts';
async function secret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Run setup in an interactive terminal.');
  let muted = false;
  const output = new Writable({write(chunk,_encoding,callback) { if (!muted) process.stdout.write(chunk); callback(); }});
  const reader = createInterface({input:process.stdin,output,terminal:true});
  process.stdout.write(prompt); muted = true;
  try { return await reader.question(''); } finally { reader.close(); process.stdout.write('\n'); }
}
async function main() {
  const settings = config(), command = process.argv[2], path = resolve(settings.dataDir,'mycoach.db');
  mkdirSync(settings.dataDir,{recursive:true,mode:0o700});
  if (command === 'host') {
    assertStopped(settings.dataDir);
    const result = generateHost(settings.dataDir, process.argv[3] ?? '', process.argv[4] ?? '/opt/homebrew/bin/caddy');
    console.log(`Generated host setup in ${result.directory}\nURL: ${result.origin}\nFollow deploy/README.md to install the services and trust the certificate.`); return;
  }
  if (command === 'setup') {
    assertStopped(settings.dataDir);
    const generated = process.argv.includes('--generate');
    const password = generated ? randomBytes(24).toString('base64url') : await secret('Owner password (12–256 characters): ');
    if (!generated && password !== await secret('Confirm password: ')) throw new Error('Passwords do not match.');
    const hash = await hashPassword(password);
    const db = openDatabase(path);
    try { db.transaction(() => { db.prepare('INSERT INTO web_owner VALUES (1,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash').run(hash); db.exec('DELETE FROM web_sessions'); })(); }
    finally {db.close();}
    if (generated) {
      const passwordFile = resolve(settings.dataDir, 'owner-password.txt');
      writeFileSync(passwordFile, password + '\n', {mode:0o600}); chmodSync(passwordFile,0o600);
      console.log(`Generated password saved privately in ${passwordFile}`);
    }
    console.log('Owner password saved. Existing sessions were revoked.'); return;
  }
  if (command === 'import') {
    assertStopped(settings.dataDir);
    const source = process.argv[3]; if (!source) throw new Error('Usage: npm run db:import -- /absolute/path/to/mycoach.db');
    if (existsSync(path)) throw new Error('Destination exists. Import into a new MYCOACH_DATA_DIR.');
    if (process.platform === 'darwin') {
      try { execFileSync('/usr/bin/pgrep',['-x','MyCoach'],{stdio:'pipe'}); throw new Error('Close MyCoach desktop before importing.'); }
      catch (error) { if ((error as {status?:number}).status !== 1) throw error; }
    }
    const original = new Database(resolve(source),{readonly:true,fileMustExist:true});
    let safetyCopy: string;
    try { validateDatabase(original); safetyCopy = await backup(original,resolve(settings.dataDir,'backups'),'pre-upgrade'); }
    finally {original.close();}
    await importDatabase(safetyCopy!,path);
    console.log('Database imported and verified. Original desktop database was not changed. Run npm run setup next.'); return;
  }
  if (command === 'backup') {
    const db = new Database(path,{readonly:true,fileMustExist:true});
    try { validateDatabase(db); console.log(await backup(db,resolve(settings.dataDir,'backups'))); }
    finally {db.close();} return;
  }
  if (command === 'restore') {
    assertStopped(settings.dataDir);
    const source = process.argv[3]; if (!source || resolve(source) === path) throw new Error('Provide a backup file to restore.');
    const candidate = path+'.restore';
    if (existsSync(candidate)) throw new Error('A restore candidate already exists; inspect it first.');
    await importDatabase(resolve(source),candidate);
    if (existsSync(path)) {
      const current = new Database(path,{fileMustExist:true});
      try { await backup(current,resolve(settings.dataDir,'backups'),'pre-upgrade'); current.pragma('wal_checkpoint(TRUNCATE)'); }
      finally {current.close();}
    }
    const restored = new Database(candidate);
    try { restored.exec('DELETE FROM web_sessions'); } finally {restored.close();}
    rmSync(path+'-wal',{force:true}); rmSync(path+'-shm',{force:true}); renameSync(candidate,path); chmodSync(path,0o600);
    console.log('Restored and verified. Sessions were revoked. Start MyCoach again.'); return;
  }
  throw new Error('Expected setup, import, backup, restore, or host.');
}
main().catch(error => {console.error(error.message);process.exitCode=1;});
