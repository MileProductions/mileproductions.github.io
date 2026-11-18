import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',          -- pending | confirmed | unsubscribed
  consent_text TEXT, consent_at TEXT, consent_ip TEXT,
  confirmed_at TEXT, synced_at TEXT, sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS login_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  link_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS login_codes_email ON login_codes(email);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                              -- customer | admin
  subject TEXT NOT NULL,                           -- e-mail klienta albo id grafika
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  name TEXT, phone TEXT, notes TEXT,
  kg REAL, pcs INTEGER, total REAL,
  design_json TEXT NOT NULL,
  pdf_check TEXT,
  cmyk_status TEXT NOT NULL DEFAULT 'pending',     -- pending | ok | error
  cmyk_error TEXT, cmyk_profile TEXT,
  reject_reason TEXT, shop_order TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS designs_email ON designs(email);
CREATE INDEX IF NOT EXISTS designs_status ON designs(status);
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                              -- pdf_rgb | pdf_cmyk | preview | asset
  name TEXT NOT NULL, rel_path TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS files_design ON files(design_id);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL, action TEXT NOT NULL, note TEXT
);
`;

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'krowki.sqlite'));
  db.exec(SCHEMA);
  const stmts = new Map();
  const prep = (sql) => { let s = stmts.get(sql); if (!s) { s = db.prepare(sql); stmts.set(sql, s); } return s; };
  return {
    raw: db,
    get: (sql, ...p) => prep(sql).get(...p),
    all: (sql, ...p) => prep(sql).all(...p),
    run: (sql, ...p) => prep(sql).run(...p),
    tx(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    close: () => db.close(),
  };
}

/** Numer projektu widoczny dla klienta i w sklepie, np. KR-2611-0042 */
export function designNumber(id, date = new Date()) {
  const yy = String(date.getUTCFullYear()).slice(2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `KR-${yy}${mm}-${String(id).padStart(4, '0')}`;
}
