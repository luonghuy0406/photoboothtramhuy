import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export function initDatabase(storagePath: string): Database.Database {
  // Ensure storage directory exists
  fs.mkdirSync(storagePath, { recursive: true });
  fs.mkdirSync(path.join(storagePath, 'photos'), { recursive: true });
  fs.mkdirSync(path.join(storagePath, 'thumbnails'), { recursive: true });
  fs.mkdirSync(path.join(storagePath, 'strips'), { recursive: true });

  const dbPath = path.join(storagePath, 'photobooth.db');
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'IDLE',
      strip_url TEXT,
      qr_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      shot_index INTEGER NOT NULL,
      original_path TEXT NOT NULL,
      thumbnail_path TEXT,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_photos_session ON photos(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
  `);

  return db;
}
