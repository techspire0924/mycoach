import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export interface Config { dataDir: string; origin: string; port: number; secureCookies: boolean }
export function config(): Config {
  const dataDir = resolve(process.env.MYCOACH_DATA_DIR ?? '.data');
  let saved: { origin?: string } = {};
  try { saved = JSON.parse(readFileSync(resolve(dataDir, 'host.json'), 'utf8')); } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const origin = process.env.MYCOACH_ORIGIN ?? saved.origin ?? 'http://localhost:1420';
  const url = new URL(origin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.origin !== origin || (!local && url.protocol !== 'https:')) throw new Error('MYCOACH_ORIGIN must be an origin; non-loopback access requires HTTPS.');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported origin protocol');
  const port = Number(process.env.MYCOACH_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MYCOACH_PORT');
  return { dataDir, origin, port, secureCookies: url.protocol === 'https:' };
}
