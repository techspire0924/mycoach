import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export const domainTables = ['goals', 'tasks', 'habits', 'habit_logs', 'task_completions', 'task_status_events'] as const;
const migrationDir = resolve('server/migrations');
export const migrations = readdirSync(migrationDir).filter(f => /^\d+.*\.sql$/.test(f)).sort().map((file, i) => {
  const sql = readFileSync(resolve(migrationDir, file), 'utf8');
  return { version: i + 1, sql, checksum: createHash('sha256').update(sql).digest('hex'), sqlxChecksum: createHash('sha384').update(sql).digest() };
});
function hasTable(db: Database.Database, name: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}
function migrationVersion(db: Database.Database): number {
  const table = hasTable(db, 'web_migrations') ? 'web_migrations' : hasTable(db, '_sqlx_migrations') ? '_sqlx_migrations' : null;
  if (!table) {
    if (domainTables.some(t => hasTable(db, t))) throw new Error('Database has application tables without a supported migration ledger.');
    return 0;
  }
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY version`).all() as {version:number; checksum: string | Buffer; success?:number}[];
  rows.forEach((row, index) => {
    const migration = migrations[index];
    if (!migration || row.version !== migration.version || row.success === 0) throw new Error('Unsupported or incomplete database migration history.');
    const valid = table === 'web_migrations' ? row.checksum === migration.checksum : Buffer.isBuffer(row.checksum) && row.checksum.equals(migration.sqlxChecksum);
    if (!valid) throw new Error(`Migration ${row.version} checksum mismatch. Restore the matching application version.`);
  });
  return rows.length;
}
function schema(db: Database.Database) {
  return db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
    .filter((r: any) => domainTables.includes(r.tbl_name));
}
export function validateDatabase(db: Database.Database): number {
  if (db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Database integrity check failed.');
  if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Database has orphaned relationships.');
  const version = migrationVersion(db);
  const expected = new Database(':memory:');
  try {
    migrations.slice(0, version).forEach(m => expected.exec(m.sql));
    if (JSON.stringify(schema(db)) !== JSON.stringify(schema(expected))) throw new Error('Database schema does not match its migration history.');
  } finally { expected.close(); }
  return version;
}
export function migrate(db: Database.Database): void {
  const version = validateDatabase(db);
  db.transaction(() => {
    db.exec('CREATE TABLE IF NOT EXISTS web_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL)');
    const record = db.prepare('INSERT OR IGNORE INTO web_migrations VALUES (?, ?)');
    migrations.forEach(m => {
      if (m.version > version) db.exec(m.sql);
      record.run(m.version, m.checksum);
    });
    db.exec(`CREATE TABLE IF NOT EXISTS web_owner (id INTEGER PRIMARY KEY CHECK(id=1), password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS web_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);`);
  })();
  validateDatabase(db);
}
export function openDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    const version = validateDatabase(db);
    if (version > 0 && version < migrations.length) {
      const directory = resolve(dirname(path), 'backups');
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const target = resolve(directory, `pre-upgrade-${Date.now()}.db`);
      db.prepare('VACUUM INTO ?').run(target);
      chmodSync(target, 0o600);
    }
    migrate(db);
    db.pragma('journal_mode = WAL');
    chmodSync(path, 0o600);
    return db;
  } catch (e) { db.close(); throw e; }
}
export function domainSnapshot(db: Database.Database) {
  return Object.fromEntries(domainTables.filter(t => hasTable(db, t)).map(t => [t, db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()]));
}
export async function backup(db: Database.Database, directory: string, kind: 'daily' | 'pre-upgrade' | 'manual' = 'manual'): Promise<string> {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const name = `${kind}-${new Date().toISOString().replaceAll(':', '-')}.db`;
  const path = resolve(directory, name);
  await db.backup(path + '.partial');
  chmodSync(path + '.partial', 0o600);
  renameSync(path + '.partial', path);
  if (kind === 'daily') {
    const files = readdirSync(directory).filter(f => f.startsWith('daily-') && f.endsWith('.db')).sort().reverse();
    files.slice(7).forEach(f => rmSync(resolve(directory, f)));
  }
  return path;
}
export async function importDatabase(source: string, target: string): Promise<void> {
  if (resolve(source) === resolve(target)) throw new Error('Source and destination must be different.');
  const original = new Database(source, { readonly: true, fileMustExist: true });
  const temp = target + '.importing';
  try {
    validateDatabase(original);
    const before = domainSnapshot(original);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    if (readdirSync(dirname(target)).includes(target.split('/').pop()!)) throw new Error('Destination exists. Import requires an empty destination.');
    await original.backup(temp);
    const copy = new Database(temp);
    try {
      if (JSON.stringify(before) !== JSON.stringify(domainSnapshot(copy))) throw new Error('Source changed during import. Close the desktop app and retry.');
      migrate(copy);
      // Existing tables/columns must keep every original value. Only unapplied migrations may add history/columns.
      const after = domainSnapshot(copy) as Record<string, any[]>;
      for (const [table, rows] of Object.entries(before) as [string, any[]][]) {
        for (const row of rows) {
          const migrated = after[table].find(r => r.id === row.id);
          if (!migrated || Object.keys(row).some(k => migrated[k] !== row[k])) throw new Error(`Import altered existing ${table} data.`);
        }
        if (table !== 'task_status_events' && after[table].length !== rows.length) throw new Error(`Import changed ${table} row count.`);
      }
      copy.pragma('wal_checkpoint(TRUNCATE)');
      copy.pragma('journal_mode = DELETE');
    } finally { copy.close(); }
    chmodSync(temp, 0o600);
    renameSync(temp, target);
  } finally { original.close(); rmSync(temp, { force: true }); }
}
