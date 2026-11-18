// RODO: usuwa projekty (z plikami) starsze niż RETENTION_DAYS od ostatniej zmiany,
// które są zrealizowane, anulowane, odrzucone albo nigdy nie zostały zamówione.
// Uruchamiać np. raz dziennie z crona: npm run cleanup   (podgląd bez usuwania: npm run cleanup -- --dry-run)
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { createStorage } from '../src/storage.js';

const cfg = loadConfig();
const db = openDb(cfg.dataDir);
const storage = createStorage(cfg.dataDir);
const dry = process.argv.includes('--dry-run');
const rows = db.all(`SELECT id, number, status FROM designs
  WHERE status IN ('done', 'cancelled', 'rejected', 'submitted', 'accepted') AND updated_at < datetime('now', ?)`, `-${cfg.retentionDays} days`);
for (const r of rows) {
  console.log(`${dry ? '[podgląd] ' : ''}usuwam ${r.number} (${r.status})`);
  if (!dry) { db.run('DELETE FROM designs WHERE id = ?', r.id); await storage.removeDir(String(r.id)); }
}
console.log(`${rows.length} projektów starszych niż ${cfg.retentionDays} dni${dry ? ' do usunięcia' : ' usunięto'}.`);
