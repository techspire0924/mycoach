import { closeSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function assertStopped(dataDir: string) {
  const path = resolve(dataDir, 'server.lock');
  let pid: number;
  try { pid = Number(readFileSync(path, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; }
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid server.lock; inspect it before proceeding.');
  try { process.kill(pid, 0); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ESRCH') { rmSync(path); return; }
    throw e;
  }
  throw new Error('MyCoach is running. Stop the server before this operation.');
}
export function acquireLock(dataDir: string): () => void {
  assertStopped(dataDir);
  const path = resolve(dataDir, 'server.lock');
  const fd = openSync(path, 'wx', 0o600);
  writeFileSync(fd, String(process.pid)); closeSync(fd);
  return () => rmSync(path, { force: true });
}
