import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { ghostscriptVersion } from './pdf.js';
import fs from 'node:fs';

const cfg = loadConfig();
const { app, db } = createApp(cfg);

const gs = await ghostscriptVersion(cfg.gsPath);
if (!gs) console.warn('[uwaga] Nie znaleziono Ghostscript – PDF w CMYK nie powstanie (zainstaluj pakiet ghostscript).');
if (!fs.existsSync(cfg.iccProfile)) console.warn(`[uwaga] Brak profilu ICC ${cfg.iccProfile} – ustaw ICC_PROFILE.`);
if (!cfg.smtpUrl) console.warn('[uwaga] Brak SMTP_URL – maile trafiają tylko do logu i do DATA_DIR/outbox.');
if (!db.get('SELECT id FROM admins LIMIT 1')) console.warn('[uwaga] Brak kont w panelu produkcji. Dodaj: npm run admin:add -- produkcja@firma.pl "Imię"');

// sprzątanie wygasłych sesji i kodów raz na godzinę
setInterval(() => {
  db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  db.run("DELETE FROM login_codes WHERE expires_at < datetime('now', '-1 day')");
}, 3600 * 1000).unref();

app.listen(cfg.port, () => {
  console.log(`Backend krówek: ${cfg.publicUrl} (port ${cfg.port}) · panel: ${cfg.publicUrl}/panel/ · Ghostscript ${gs ?? 'brak'}`);
});
