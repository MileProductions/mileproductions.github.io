import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const randomCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
export const normEmail = (e) => String(e ?? '').trim().toLowerCase();
export const validEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pw), salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(pw, stored) {
  const [, s, k] = String(stored).split('$');
  if (!s || !k) return false;
  const key = await scrypt(String(pw), Buffer.from(s, 'base64'), 64);
  const want = Buffer.from(k, 'base64');
  return key.length === want.length && crypto.timingSafeEqual(key, want);
}

/** zapis daty porównywalny z sqlite datetime('now') */
export const sqlTime = (d) => d.toISOString().replace('T', ' ').slice(0, 19);

export function createSession(db, kind, subject, ms) {
  const token = randomToken();
  db.run('INSERT INTO sessions (token_hash, kind, subject, expires_at) VALUES (?, ?, ?, ?)',
    sha256(token), kind, String(subject), sqlTime(new Date(Date.now() + ms)));
  return token;
}

export function readSession(db, kind, token) {
  if (!token) return null;
  return db.get("SELECT * FROM sessions WHERE token_hash = ? AND kind = ? AND expires_at > datetime('now')", sha256(token), kind) ?? null;
}

export function dropSession(db, token) {
  if (token) db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
}

/** Prosty limit zapytań w pamięci (wystarczy dla jednej instancji serwera). */
export function rateLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 10000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}
