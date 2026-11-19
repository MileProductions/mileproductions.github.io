import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { ghostscriptVersion } from '../src/pdf.js';
import { PNG } from './png-fixture.js';

const mm = (v) => (v * 72) / 25.4;
let srv, base, ctx, dataDir;
const quiet = { info() {}, warn() {}, error() {} };

async function printPdf(w = 76, h = 79) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([mm(w), mm(h)]);
  const img = await doc.embedPng(PNG(200, 208));
  page.drawImage(img, { x: 0, y: 0, width: mm(w), height: mm(h) });
  page.setBleedBox(0, 0, mm(w), mm(h));
  page.setTrimBox(mm(3), mm(3), mm(w - 6), mm(h - 6));
  return Buffer.from(await doc.save());
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'krowki-test-'));
  const cfg = loadConfig({ dataDir, publicUrl: 'http://localhost', designerUrl: 'http://localhost/projektant/', shopProductUrl: 'https://sklep.example/krowki', notifyEmail: ['grafik@example.com'], allowedOrigins: ['https://sklep.example'] });
  ctx = createApp(cfg, { log: quiet });
  ctx.db.run('INSERT INTO admins (email, name, pass_hash) VALUES (?, ?, ?)', 'grafik@example.com', 'Grafik', await hashPassword('tajne-haslo-123'));
  await new Promise((r) => { srv = ctx.app.listen(0, r); });
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => { srv?.close(); ctx?.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
test('konfigurator bez logowania: stare endpointy dostępu nie istnieją', async () => {
  const r = await post('/api/auth/request', { email: 'klient@example.com', consent: true });
  assert.equal(r.status, 404);
});

test('CORS tylko dla dozwolonych domen', async () => {
  let r = await fetch(base + '/api/config', { headers: { origin: 'https://sklep.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://sklep.example');
  r = await fetch(base + '/api/config', { headers: { origin: 'https://obcy.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

let number;
test('wysłanie projektu: zapis, numer, maile, PDF w CMYK', async () => {
  const f = new FormData();
  f.set('design', JSON.stringify({ bg: '#fff', elements: [{ id: 'a', type: 'image', assetId: 'x1' }] }));
  f.set('pdf', new Blob([await printPdf()], { type: 'application/pdf' }), 'papierek.pdf');
  f.set('preview', new Blob([PNG(20, 20)], { type: 'image/png' }), 'podglad.png');
  f.append('asset', new Blob([PNG(30, 30)], { type: 'image/png' }), 'x1__zdjęcie ślubne.png');
  f.set('kg', '2'); f.set('pcs', '190'); f.set('total', '158');
  f.set('customer', JSON.stringify({ name: 'Jan Test', phone: '600100200', notes: 'Na wesele' }));
  let r = await fetch(base + '/api/designs', { method: 'POST', body: f });
  assert.equal(r.status, 400, 'bez e-maila nie wolno');
  assert.match((await r.json()).error, /e-mail/);
  f.set('customer', JSON.stringify({ name: 'Jan Test', email: 'Klient@Example.com', phone: '600100200', notes: 'Na wesele', newsletter: true }));
  r = await fetch(base + '/api/designs', { method: 'POST', body: f });
  const j = await r.json();
  assert.equal(r.status, 201, JSON.stringify(j));
  number = j.orderId;
  assert.match(number, /^KR-\d{4}-0001$/);
  assert.equal(j.shopUrl, 'https://sklep.example/krowki');
  const mails = ctx.mailer.outbox.slice(-3);
  assert.ok(mails.some((m) => m.to === 'klient@example.com' && m.subject === `Projekt ${number} gotowy do druku`));
  assert.ok(mails.some((m) => m.to === 'grafik@example.com'));
  // dobrowolny newsletter: double opt-in
  assert.equal(ctx.db.get('SELECT status FROM subscribers WHERE email = ?', 'klient@example.com').status, 'pending');
  const link = /(http:\/\/localhost\/potwierdz\?t=\S+)/.exec(ctx.mailer.outbox.at(-1).text)[1].replace('http://localhost', base);
  r = await fetch(link);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Zapis potwierdzony/);
  assert.equal(ctx.db.get('SELECT status FROM subscribers WHERE email = ?', 'klient@example.com').status, 'confirmed');
  assert.equal((await fetch(link)).status, 400, 'link działa tylko raz');
  await ctx.designs.idle();
  const d = ctx.db.get('SELECT * FROM designs WHERE number = ?', number);
  assert.equal(d.status, 'ready');
  if (await ghostscriptVersion()) assert.equal(d.cmyk_status, 'ok', d.cmyk_error);
  const kinds = ctx.db.all('SELECT kind FROM files WHERE design_id = ?', d.id).map((x) => x.kind).sort();
  assert.equal(ctx.db.get("SELECT name FROM files WHERE kind = 'asset'").name, 'x1__zdjęcie ślubne.png');
  assert.deepEqual(kinds, ['asset', 'pdf_rgb', 'preview', ...(d.cmyk_status === 'ok' ? ['pdf_cmyk'] : [])].sort());
});

test('PDF w złym formacie jest odrzucany', async () => {
  const f = new FormData();
  f.set('design', JSON.stringify({ elements: [] }));
  f.set('pdf', new Blob([await printPdf(100, 100)]), 'a.pdf');
  f.set('preview', new Blob([PNG(5, 5)]), 'p.png');
  f.set('customer', JSON.stringify({ email: 'klient@example.com' }));
  const r = await fetch(base + '/api/designs', { method: 'POST', body: f });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /siatki/);
});

test('panel produkcji: logowanie, lista gotowych, zamówienie, produkcja, pobranie PDF', async () => {
  let r = await fetch(base + '/api/admin/designs');
  assert.equal(r.status, 401);
  r = await post('/api/admin/login', { email: 'grafik@example.com', password: 'zle' });
  assert.equal(r.status, 401);
  r = await post('/api/admin/login', { email: 'grafik@example.com', password: 'tajne-haslo-123' });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const h = { cookie };
  r = await fetch(base + '/api/admin/designs?status=ready', { headers: h });
  const list = await r.json();
  assert.equal(list.items[0].number, number, 'projekt od razu gotowy do druku, bez akceptacji');
  assert.equal(list.counts.ready, 1);

  r = await post(`/api/admin/designs/${number}/status`, { status: 'accepted' }, h);
  assert.equal(r.status, 400, 'nie ma już akceptacji przez grafika');
  r = await post(`/api/admin/designs/${number}/status`, { status: 'ordered', shopOrder: '12345' }, { ...h, origin: 'https://obcy.example' });
  assert.equal(r.status, 403, 'ochrona przed CSRF');
  r = await post(`/api/admin/designs/${number}/status`, { status: 'ordered', shopOrder: '12345' }, h);
  assert.equal((await r.json()).shopOrder, '12345');
  r = await post(`/api/admin/designs/${number}/status`, { status: 'production', note: 'Wysyłka w piątek' }, h);
  const d = await r.json();
  assert.equal(d.status, 'production');
  assert.equal(ctx.mailer.outbox.at(-1).to, 'klient@example.com');
  assert.match(ctx.mailer.outbox.at(-1).text, /w produkcji[\s\S]*Wysyłka w piątek/i);
  assert.ok(d.events.some((e) => e.action === 'checked'));

  const pdf = d.files.find((f) => f.kind === 'pdf_cmyk') ?? d.files.find((f) => f.kind === 'pdf_rgb');
  r = await fetch(`${base}/api/admin/files/${pdf.id}?download=1`, { headers: h });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /attachment/);
  assert.equal((await r.arrayBuffer()).byteLength, pdf.size);

  r = await fetch(base + '/api/admin/subscribers.csv', { headers: h });
  const csv = await r.text();
  assert.match(csv, /klient@example.com/);
});

test('RODO: usunięcie danych klienta', async () => {
  let r = await post('/api/admin/login', { email: 'grafik@example.com', password: 'tajne-haslo-123' });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  r = await fetch(base + '/api/admin/customers/klient@example.com', { method: 'DELETE', headers: { cookie } });
  assert.deepEqual(await r.json(), { ok: true, designs: 1 });
  assert.equal(ctx.db.get('SELECT COUNT(*) AS n FROM designs').n, 0);
  assert.equal(fs.readdirSync(path.join(dataDir, 'files')).length, 0);
  assert.equal(ctx.db.get('SELECT COUNT(*) AS n FROM subscribers WHERE email = ?', 'klient@example.com').n, 0);
});
