import Database from 'better-sqlite3';
import path from 'path';
import type { Session, GameState } from './types';

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

export function createSession(id: string, name: string, state: GameState): Session {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO sessions (id, name, state, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, JSON.stringify(state), now, now);
  return {
    id,
    name,
    state,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

export function getSession(id: string): Session | null {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  const row = stmt.get(id) as { id: string; name: string; state: string; created_at: string; updated_at: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    state: JSON.parse(row.state),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function getAllSessions(): Array<{ id: string; name: string; createdAt: Date; updatedAt: Date }> {
  const stmt = db.prepare('SELECT id, name, created_at, updated_at FROM sessions');
  const rows = stmt.all() as Array<{ id: string; name: string; created_at: string; updated_at: string }>;
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export function updateSession(id: string, state: GameState): boolean {
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE sessions SET state = ?, updated_at = ? WHERE id = ?');
  const result = stmt.run(JSON.stringify(state), now, id);
  return result.changes > 0;
}

export function deleteSession(id: string): boolean {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export default db;
