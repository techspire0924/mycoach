import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './config.ts';
import { openDatabase, backup } from './database.ts';
import { buildApp } from './app.ts';
import { acquireLock } from './lock.ts';
const settings = config();
mkdirSync(settings.dataDir, {recursive: true, mode: 0o700});
const unlock = acquireLock(settings.dataDir);
let shutdown: (() => Promise<void>) | undefined;
try {
  const db = openDatabase(resolve(settings.dataDir, 'mycoach.db'));
  if (!db.prepare('SELECT 1 FROM web_owner WHERE id = 1').get()) { db.close(); throw new Error('Run npm run setup before starting MyCoach.'); }
  const app = await buildApp(db, settings, {logger: true});
  let backingUp = false;
  const backupDir = resolve(settings.dataDir, 'backups');
  mkdirSync(backupDir, {recursive: true, mode: 0o700});
  async function dailyBackup() {
    if (backingUp) return;
    if (readdirSync(backupDir).some(f => f.startsWith(`daily-${new Date().toISOString().slice(0,10)}`) && f.endsWith('.db'))) return;
    backingUp = true;
    try { await backup(db, backupDir, 'daily'); }
    catch (error) { app.log.error(error, 'Daily backup failed'); }
    finally { backingUp = false; }
  }
  await dailyBackup();
  const timer = setInterval(() => void dailyBackup(), 60 * 60 * 1000);
  shutdown = async () => { clearInterval(timer); await app.close(); while (backingUp) await new Promise(r => setTimeout(r, 20)); db.close(); unlock(); };
  await app.listen({ host: '127.0.0.1', port: settings.port });
  let stopping = false;
  for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => {
    if (stopping) return; stopping = true;
    void shutdown!().then(() => process.exit(0));
  });
} catch (error) {
  if (shutdown) await shutdown(); else unlock();
  console.error((error as Error).message); process.exitCode = 1;
}
