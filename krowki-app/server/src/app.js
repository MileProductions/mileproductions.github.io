import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import {
  checkPassword, createSession, dropSession, normEmail, randomCode, randomToken, rateLimiter, readSession, sha256, sqlTime, validEmail,
} from './auth.js';
import { openDb } from './db.js';
import { createDesigns, STATUSES, UserError } from './designs.js';
import { createMailer, mailBody } from './mail.js';
import { createNewsletter } from './newsletter.js';
import { ghostscriptVersion } from './pdf.js';
import { createStorage, safeName } from './storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CODE_MINUTES = 30;
const DAY = 24 * 3600 * 1000;

export function createApp(cfg, { log = console } = {}) {
  const db = openDb(cfg.dataDir);
  const storage = createStorage(cfg.dataDir);
  const mailer = createMailer(cfg, log);
  const newsletter = createNewsletter(cfg, db, log);
  const designs = createDesigns({ cfg, db, storage, mailer, log });
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  const ipLimit = rateLimiter({ max: 20, windowMs: 15 * 60 * 1000 });
  const mailLimit = rateLimiter({ max: 4, windowMs: 15 * 60 * 1000 });
  const loginLimit = rateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
  const submitLimit = rateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ——— CORS dla API klienta (konfigurator może stać na innej domenie niż backend) ———
  const corsFor = (req, res) => {
    const origin = req.get('origin');
    if (origin && (cfg.allowedOrigins.includes('*') || cfg.allowedOrigins.includes(origin))) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Max-Age', '600');
    }
  };
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/admin')) return next();
    corsFor(req, res);
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const json = express.json({ limit: '100kb' });
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const bearer = (req) => (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || null;
  const cookies = (req) => Object.fromEntries((req.get('cookie') ?? '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));

  const customer = (req, res, next) => {
    const s = readSession(db, 'customer', bearer(req));
    if (!s) return res.status(401).json({ error: 'Zaloguj się adresem e-mail.' });
    req.email = s.subject;
    next();
  };

  // ——— Dostęp do konfiguratora: zapis do newslettera z potwierdzeniem e-mail ———
  app.get('/api/config', (req, res) => {
    res.json({ consentText: cfg.consentText, privacyUrl: cfg.privacyUrl || null, shopProductUrl: cfg.shopProductUrl || null, brand: cfg.brand });
  });

  app.post('/api/auth/request', json, wrap(async (req, res) => {
    const email = normEmail(req.body?.email);
    if (!validEmail(email)) throw new UserError('Podaj poprawny adres e-mail.');
    if (!ipLimit(req.ip) || !mailLimit(email)) throw new UserError('Za dużo prób. Spróbuj ponownie za kilkanaście minut.', 429);
    const sub = db.get('SELECT * FROM subscribers WHERE email = ?', email);
    const consent = req.body?.consent === true;
    if (sub?.status !== 'confirmed' && !consent) throw new UserError('Zaznacz zgodę na zapis do newslettera – daje ona dostęp do projektanta.');
    if (consent) {
      db.run(`INSERT INTO subscribers (email, status, consent_text, consent_at, consent_ip) VALUES (?, 'pending', ?, datetime('now'), ?)
        ON CONFLICT(email) DO UPDATE SET consent_text = excluded.consent_text, consent_at = excluded.consent_at, consent_ip = excluded.consent_ip,
        status = CASE WHEN subscribers.status = 'confirmed' THEN 'confirmed' ELSE 'pending' END`, email, cfg.consentText, req.ip);
    }
    const code = randomCode();
    const link = randomToken();
    db.run('UPDATE login_codes SET used_at = datetime(\'now\') WHERE email = ? AND used_at IS NULL', email);
    db.run('INSERT INTO login_codes (email, code_hash, link_hash, expires_at) VALUES (?, ?, ?, ?)', email, sha256(email + ':' + code), sha256(link), sqlTime(new Date(Date.now() + CODE_MINUTES * 60000)));
    const confirmUrl = `${cfg.publicUrl}/potwierdz?t=${link}`;
    const first = sub?.status !== 'confirmed';
    await mailer.send({
      to: email,
      subject: first ? `Potwierdź zapis – kod ${code}` : `Kod logowania: ${code}`,
      ...mailBody(cfg, {
        title: first ? 'Potwierdź adres i zacznij projektować' : 'Twój kod do projektanta krówek',
        lines: [
          `Kod: ${code}`,
          'Wpisz go w projektancie albo kliknij przycisk poniżej. Kod jest ważny 30 minut.',
          first ? 'Potwierdzając, zapisujesz się do naszego newslettera. Możesz się wypisać w każdej chwili.' : '',
          'Jeśli to nie Ty, zignoruj tę wiadomość.',
        ].filter(Boolean),
        button: { label: first ? 'Potwierdzam i projektuję' : 'Otwórz projektanta', url: confirmUrl },
      }),
    });
    res.json({ ok: true, minutes: CODE_MINUTES });
  }));

  async function confirm(row) {
    db.run("UPDATE login_codes SET used_at = datetime('now') WHERE id = ?", row.id);
    const before = db.get('SELECT status FROM subscribers WHERE email = ?', row.email);
    db.run(`INSERT INTO subscribers (email, status, confirmed_at) VALUES (?, 'confirmed', datetime('now'))
      ON CONFLICT(email) DO UPDATE SET status = 'confirmed', confirmed_at = COALESCE(subscribers.confirmed_at, datetime('now'))`, row.email);
    if (before?.status !== 'confirmed') newsletter.onConfirmed(row.email);
    return createSession(db, 'customer', row.email, cfg.sessionDays * DAY);
  }
  const liveCode = "used_at IS NULL AND expires_at > datetime('now')";

  app.post('/api/auth/verify', json, wrap(async (req, res) => {
    if (!ipLimit(req.ip)) throw new UserError('Za dużo prób. Spróbuj ponownie za kilkanaście minut.', 429);
    const email = normEmail(req.body?.email);
    const code = String(req.body?.code ?? '').replace(/\D/g, '');
    const row = db.get(`SELECT * FROM login_codes WHERE email = ? AND ${liveCode} ORDER BY id DESC LIMIT 1`, email);
    if (!row) throw new UserError('Kod wygasł. Poproś o nowy.');
    if (row.attempts >= 5) throw new UserError('Za dużo błędnych prób. Poproś o nowy kod.', 429);
    if (sha256(email + ':' + code) !== row.code_hash) {
      db.run('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?', row.id);
      throw new UserError('Nieprawidłowy kod.');
    }
    res.json({ token: await confirm(row), email });
  }));

  // link z maila: potwierdza, loguje i wraca do konfiguratora z tokenem w #
  app.get('/potwierdz', wrap(async (req, res) => {
    const row = db.get(`SELECT * FROM login_codes WHERE link_hash = ? AND ${liveCode}`, sha256(String(req.query.t ?? '')));
    if (!row) {
      return res.status(400).type('html').send(page('Link wygasł', '<p>Ten link był już użyty albo wygasł. Wróć do projektanta i poproś o nowy kod.</p>' +
        `<p><a href="${escapeAttr(cfg.designerUrl)}">Otwórz projektanta</a></p>`));
    }
    const token = await confirm(row);
    res.redirect(303, `${cfg.designerUrl}#kd-session=${token}`);
  }));

  app.get('/api/me', customer, (req, res) => res.json({ email: req.email }));
  app.post('/api/auth/logout', (req, res) => { dropSession(db, bearer(req)); res.json({ ok: true }); });

  // ——— Projekty klienta ———
  const upload = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    limits: { fileSize: cfg.maxFileMb * 1024 * 1024, files: cfg.maxAssets + 2, fields: 20, fieldSize: 5 * 1024 * 1024 },
  }).fields([{ name: 'pdf', maxCount: 1 }, { name: 'preview', maxCount: 1 }, { name: 'asset', maxCount: cfg.maxAssets }]);

  app.post('/api/designs', customer, (req, res, next) => {
    if (!submitLimit(req.email)) return next(new UserError('Za dużo projektów w krótkim czasie. Spróbuj za godzinę.', 429));
    upload(req, res, (err) => {
      if (err) return next(new UserError(err.code === 'LIMIT_FILE_SIZE' ? `Plik jest za duży (maks. ${cfg.maxFileMb} MB).` : `Błąd przesyłania: ${err.message}`, 413));
      next();
    });
  }, wrap(async (req, res) => {
    const f = req.files ?? {};
    const d = await designs.submit({ email: req.email, fields: req.body ?? {}, files: { pdf: f.pdf?.[0], preview: f.preview?.[0], assets: f.asset ?? [] } });
    res.status(201).json({
      orderId: d.number, status: d.status, shopUrl: cfg.shopProductUrl || null,
      message: 'Projekt zapisany i gotowy do druku. Potwierdzenie z numerem projektu wysłaliśmy e-mailem.',
    });
  }));

  const publicDesign = (d) => ({ number: d.number, status: d.status, statusLabel: STATUSES[d.status], kg: d.kg, pcs: d.pcs, total: d.total, createdAt: d.created_at });
  app.get('/api/designs', customer, (req, res) => {
    res.json(db.all('SELECT * FROM designs WHERE email = ? ORDER BY id DESC LIMIT 100', req.email).map(publicDesign));
  });
  app.get('/api/designs/:number', customer, (req, res) => {
    const d = db.get('SELECT * FROM designs WHERE number = ? AND email = ?', req.params.number, req.email);
    if (!d) return res.status(404).json({ error: 'Nie ma takiego projektu.' });
    res.json({ ...publicDesign(d), design: JSON.parse(d.design_json) });
  });

  // ——— Panel produkcji (podgląd zamówień, pliki do druku) ———
  const adminRouter = express.Router();
  const sameOrigin = (req) => {
    const origin = req.get('origin');
    if (!origin) return true;
    const host = req.get('host');
    return origin === new URL(cfg.publicUrl).origin || (host && (origin === `https://${host}` || origin === `http://${host}`));
  };
  adminRouter.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({ error: 'Niedozwolone źródło zapytania.' });
    next();
  });
  const setAdminCookie = (res, token, maxAgeMs) => res.append('Set-Cookie',
    `kd_admin=${token ?? ''}; Path=/; HttpOnly; SameSite=Strict${cfg.cookieSecure ? '; Secure' : ''}; Max-Age=${Math.floor(maxAgeMs / 1000)}`);

  adminRouter.post('/login', json, wrap(async (req, res) => {
    if (!loginLimit(req.ip)) throw new UserError('Za dużo prób logowania. Spróbuj za kwadrans.', 429);
    const a = db.get('SELECT * FROM admins WHERE email = ?', normEmail(req.body?.email));
    if (!a || !(await checkPassword(req.body?.password ?? '', a.pass_hash))) throw new UserError('Nieprawidłowy e-mail lub hasło.', 401);
    const ms = cfg.adminSessionHours * 3600 * 1000;
    setAdminCookie(res, createSession(db, 'admin', a.id, ms), ms);
    res.json({ email: a.email, name: a.name });
  }));
  adminRouter.post('/logout', (req, res) => { dropSession(db, cookies(req).kd_admin); setAdminCookie(res, '', 0); res.json({ ok: true }); });
  adminRouter.use((req, res, next) => {
    const s = readSession(db, 'admin', cookies(req).kd_admin);
    const a = s && db.get('SELECT id, email, name FROM admins WHERE id = ?', Number(s.subject));
    if (!a) return res.status(401).json({ error: 'Zaloguj się do panelu.' });
    req.admin = a;
    next();
  });
  adminRouter.get('/me', wrap(async (req, res) => {
    res.json({ ...req.admin, statuses: STATUSES, ghostscript: await ghostscriptVersion(cfg.gsPath), iccProfile: cfg.iccName, iccFound: fs.existsSync(cfg.iccProfile), shopProductUrl: cfg.shopProductUrl || null });
  }));

  const listRow = (d) => ({ number: d.number, email: d.email, name: d.name, status: d.status, kg: d.kg, pcs: d.pcs, total: d.total, cmyk: d.cmyk_status, shopOrder: d.shop_order, createdAt: d.created_at, updatedAt: d.updated_at, previewId: d.preview_id });
  adminRouter.get('/designs', (req, res) => {
    const where = []; const p = [];
    if (req.query.status && STATUSES[req.query.status]) { where.push('d.status = ?'); p.push(req.query.status); }
    if (req.query.q) { where.push('(d.number LIKE ? OR d.email LIKE ? OR d.name LIKE ? OR d.shop_order LIKE ?)'); const q = `%${String(req.query.q).trim()}%`; p.push(q, q, q, q); }
    const rows = db.all(`SELECT d.*, (SELECT id FROM files f WHERE f.design_id = d.id AND f.kind = 'preview' ORDER BY id DESC LIMIT 1) AS preview_id
      FROM designs d ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.id DESC LIMIT 500`, ...p);
    const counts = Object.fromEntries(db.all('SELECT status, COUNT(*) AS n FROM designs GROUP BY status').map((r) => [r.status, r.n]));
    res.json({ items: rows.map(listRow), counts });
  });

  const findDesign = (req, res) => {
    const d = db.get('SELECT * FROM designs WHERE number = ?', req.params.number);
    if (!d) res.status(404).json({ error: 'Nie ma takiego projektu.' });
    return d;
  };
  const fullDesign = (d) => ({
    ...listRow(d), phone: d.phone, notes: d.notes, rejectReason: d.reject_reason,
    cmykError: d.cmyk_error, cmykProfile: d.cmyk_profile, pdfCheck: d.pdf_check ? JSON.parse(d.pdf_check) : null,
    files: db.all('SELECT id, kind, name, mime, size, created_at AS createdAt FROM files WHERE design_id = ? ORDER BY id', d.id),
    events: db.all('SELECT at, actor, action, note FROM events WHERE design_id = ? ORDER BY id DESC', d.id),
    elements: JSON.parse(d.design_json).elements?.length ?? 0,
    otherDesigns: db.all('SELECT number, status, created_at AS createdAt FROM designs WHERE email = ? AND id <> ? ORDER BY id DESC LIMIT 20', d.email, d.id),
  });
  adminRouter.get('/designs/:number', (req, res) => { const d = findDesign(req, res); if (d) res.json(fullDesign(d)); });
  adminRouter.post('/designs/:number/status', json, wrap(async (req, res) => {
    const d = findDesign(req, res); if (!d) return;
    await designs.setStatus(d, req.body?.status, { actor: req.admin.email, note: req.body?.note, shopOrder: req.body?.shopOrder });
    res.json(fullDesign(db.get('SELECT * FROM designs WHERE id = ?', d.id)));
  }));
  adminRouter.post('/designs/:number/cmyk', wrap(async (req, res) => {
    const d = findDesign(req, res); if (!d) return;
    db.run("UPDATE designs SET cmyk_status = 'pending', cmyk_error = NULL WHERE id = ?", d.id);
    await designs.enqueueCmyk(d.id);
    res.json(fullDesign(db.get('SELECT * FROM designs WHERE id = ?', d.id)));
  }));
  adminRouter.get('/designs/:number/design.json', (req, res) => {
    const d = findDesign(req, res); if (!d) return;
    res.attachment(`${d.number}-projekt.json`).type('json').send(d.design_json);
  });
  adminRouter.delete('/designs/:number', wrap(async (req, res) => {
    const d = findDesign(req, res); if (!d) return;
    await designs.remove(d.id);
    log.info?.(`[panel] ${req.admin.email} usunął projekt ${d.number}`);
    res.json({ ok: true });
  }));
  adminRouter.get('/files/:id', wrap(async (req, res) => {
    const f = db.get('SELECT * FROM files WHERE id = ?', Number(req.params.id));
    if (!f || !storage.exists(f.rel_path)) return res.status(404).json({ error: 'Brak pliku.' });
    res.type(f.mime);
    const name = safeName(f.name);
    res.set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    if (!/^image\/(png|jpeg|webp|gif)$|^application\/pdf$/.test(f.mime)) res.set('Content-Disposition', `attachment; filename="${name}"`);
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
    storage.stream(f.rel_path).pipe(res);
  }));

  const subscriberRows = () => db.all(`SELECT s.email, s.status, s.consent_at AS consentAt, s.confirmed_at AS confirmedAt, s.synced_at AS syncedAt, s.sync_error AS syncError,
    (SELECT COUNT(*) FROM designs d WHERE d.email = s.email) AS designs FROM subscribers s ORDER BY s.created_at DESC`);
  adminRouter.get('/subscribers', (req, res) => res.json(subscriberRows()));
  adminRouter.get('/subscribers.csv', (req, res) => {
    const rows = subscriberRows().filter((r) => req.query.all || r.status === 'confirmed');
    const csv = ['email,status,zgoda,potwierdzono', ...rows.map((r) => [r.email, r.status, r.consentAt ?? '', r.confirmedAt ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\r\n');
    res.attachment('newsletter-konfigurator.csv').type('text/csv; charset=utf-8').send('﻿' + csv);
  });
  // RODO: usunięcie wszystkich danych klienta (projekty, pliki, zapis, sesje)
  adminRouter.delete('/customers/:email', wrap(async (req, res) => {
    const email = normEmail(req.params.email);
    const ids = db.all('SELECT id FROM designs WHERE email = ?', email).map((r) => r.id);
    for (const id of ids) await designs.remove(id);
    db.run('DELETE FROM subscribers WHERE email = ?', email);
    db.run('DELETE FROM login_codes WHERE email = ?', email);
    db.run("DELETE FROM sessions WHERE kind = 'customer' AND subject = ?", email);
    log.info?.(`[panel] ${req.admin.email} usunął dane klienta (${ids.length} projektów)`);
    res.json({ ok: true, designs: ids.length });
  }));
  app.use('/api/admin', adminRouter);

  app.get('/health', (req, res) => res.json({ ok: true }));

  // ——— Pliki statyczne: panel i (opcjonalnie) zbudowany konfigurator ———
  app.use('/panel', (req, res, next) => { res.set('X-Frame-Options', 'DENY'); res.set('Cache-Control', 'no-cache'); next(); },
    express.static(path.join(here, '..', 'panel'), { index: 'index.html' }));

  const appDir = path.join(cfg.designerDist, 'app');
  const embedDir = path.join(cfg.designerDist, 'embed');
  if (fs.existsSync(path.join(appDir, 'index.html'))) {
    const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8')
      .replace('<head>', `<head>\n    <meta name="krowka-api" content="${escapeAttr(cfg.publicUrl)}/api" />`);
    const sendIndex = (req, res) => res.set('Cache-Control', 'no-cache').type('html').send(html);
    app.get('/', sendIndex);
    app.get('/index.html', sendIndex);
    app.use('/assets', express.static(path.join(appDir, 'assets'), { immutable: true, maxAge: '365d' }));
    app.use(express.static(appDir, { index: false }));
  }
  if (fs.existsSync(embedDir)) {
    app.use('/embed', (req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); }, express.static(embedDir));
  }

  app.use('/api', (req, res) => res.status(404).json({ error: 'Nie ma takiego adresu.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err instanceof UserError ? err.status : err.type === 'entity.parse.failed' ? 400 : 500;
    if (status >= 500) log.error?.(err);
    res.status(status).json({ error: status >= 500 ? 'Błąd serwera. Spróbuj ponownie.' : err.message });
  });

  return { app, db, mailer, designs, storage, close: () => db.close() };
}

function escapeAttr(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function page(title, body) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeAttr(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#fdf8f1;color:#3b2414;display:grid;place-items:center;min-height:90vh}main{background:#fff;padding:32px;border-radius:14px;max-width:420px}a{color:#8e3b16}</style></head>
<body><main><h1>${escapeAttr(title)}</h1>${body}</main></body></html>`;
}
