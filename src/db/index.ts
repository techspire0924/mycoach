import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:mycoach.db");
  }
  return db;
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function now(): string {
  return new Date().toISOString();
}
