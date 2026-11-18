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
const lastCode = () => /Kod: (\d{6})/.exec(ctx.mailer.outbox.at(-1).text)[1];

let token;

test('dostęp wymaga zgody na newsletter', async () => {
  const r = await post('/api/auth/request', { email: 'Klient@Example.com' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /zgod/i);
});

test('zapis do newslettera: kod z maila daje dostęp i potwierdza zapis', async () => {
  let r = await post('/api/auth/request', { email: 'Klient@Example.com', consent: true });
  assert.equal(r.status, 200);
  assert.equal(ctx.db.get('SELECT status FROM subscribers WHERE email = ?', 'klient@example.com').status, 'pending');
  const mail = ctx.mailer.outbox.at(-1);
  assert.equal(mail.to, 'klient@example.com');
  assert.match(mail.text, /http:\/\/localhost\/potwierdz\?t=/);
  r = await post('/api/auth/verify', { email: 'klient@example.com', code: '000000' === lastCode() ? '111111' : '000000' });
  assert.equal(r.status, 400);
  r = await post('/api/auth/verify', { email: 'klient@example.com', code: lastCode() });
  assert.equal(r.status, 200);
  token = (await r.json()).token;
  assert.ok(token);
  assert.equal(ctx.db.get('SELECT status FROM subscribers WHERE email = ?', 'klient@example.com').status, 'confirmed');
  r = await fetch(base + '/api/me', { headers: { authorization: `Bearer ${token}` } });
  assert.deepEqual(await r.json(), { email: 'klient@example.com' });
  // ponowne logowanie: bez zgody, bo zapis już potwierdzony
  r = await post('/api/auth/request', { email: 'klient@example.com' });
  assert.equal(r.status, 200);
});

test('link z maila loguje i wraca do konfiguratora z tokenem', async () => {
  await post('/api/auth/request', { email: 'drugi@example.com', consent: true });
  const link = /(http:\/\/localhost\/potwierdz\?t=\S+)/.exec(ctx.mailer.outbox.at(-1).text)[1].replace('http://localhost', base);
  let r = await fetch(link, { redirect: 'manual' });
  assert.equal(r.status, 303);
  assert.match(r.headers.get('location'), /^http:\/\/localhost\/projektant\/#kd-session=/);
  r = await fetch(link, { redirect: 'manual' });
  assert.equal(r.status, 400, 'link działa tylko raz');
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
  assert.equal(r.status, 401, 'bez logowania nie wolno');
  r = await fetch(base + '/api/designs', { method: 'POST', body: f, headers: { authorization: `Bearer ${token}` } });
  const j = await r.json();
  assert.equal(r.status, 201, JSON.stringify(j));
  number = j.orderId;
  assert.match(number, /^KR-\d{4}-0001$/);
  assert.equal(j.shopUrl, 'https://sklep.example/krowki');
  const mails = ctx.mailer.outbox.slice(-2);
  assert.ok(mails.some((m) => m.to === 'klient@example.com' && m.subject.includes(number)));
  assert.ok(mails.some((m) => m.to === 'grafik@example.com'));
  await ctx.designs.idle();
  const d = ctx.db.get('SELECT * FROM designs WHERE number = ?', number);
  if (await ghostscriptVersion()) assert.equal(d.cmyk_status, 'ok', d.cmyk_error);
  const kinds = ctx.db.all('SELECT kind FROM files WHERE design_id = ?', d.id).map((x) => x.kind).sort();
  assert.equal(ctx.db.get("SELECT name FROM files WHERE kind = 'asset'").name, 'x1__zdjęcie ślubne.png');
  assert.deepEqual(kinds, ['asset', 'pdf_rgb', 'preview', ...(d.cmyk_status === 'ok' ? ['pdf_cmyk'] : [])].sort());
  r = await fetch(base + '/api/designs', { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await r.json())[0].number, number);
});

test('PDF w złym formacie jest odrzucany', async () => {
  const f = new FormData();
  f.set('design', JSON.stringify({ elements: [] }));
  f.set('pdf', new Blob([await printPdf(100, 100)]), 'a.pdf');
  f.set('preview', new Blob([PNG(5, 5)]), 'p.png');
  const r = await fetch(base + '/api/designs', { method: 'POST', body: f, headers: { authorization: `Bearer ${token}` } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /siatki/);
});

test('panel: logowanie, lista, odrzucenie z komentarzem, akceptacja, pobranie PDF', async () => {
  let r = await fetch(base + '/api/admin/designs');
  assert.equal(r.status, 401);
  r = await post('/api/admin/login', { email: 'grafik@example.com', password: 'zle' });
  assert.equal(r.status, 401);
  r = await post('/api/admin/login', { email: 'grafik@example.com', password: 'tajne-haslo-123' });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const h = { cookie };
  r = await fetch(base + '/api/admin/designs?status=submitted', { headers: h });
  const list = await r.json();
  assert.equal(list.items[0].number, number);
  assert.equal(list.counts.submitted, 1);

  r = await post(`/api/admin/designs/${number}/status`, { status: 'rejected' }, h);
  assert.equal(r.status, 400, 'odrzucenie wymaga komentarza');
  r = await post(`/api/admin/designs/${number}/status`, { status: 'rejected', note: 'Zdjęcie za ciemne' }, { ...h, origin: 'https://obcy.example' });
  assert.equal(r.status, 403, 'ochrona przed CSRF');
  r = await post(`/api/admin/designs/${number}/status`, { status: 'rejected', note: 'Zdjęcie za ciemne' }, h);
  assert.equal(r.status, 200);
  assert.match(ctx.mailer.outbox.at(-1).text, /Zdjęcie za ciemne/);
  r = await post(`/api/admin/designs/${number}/status`, { status: 'accepted' }, h);
  assert.equal((await r.json()).status, 'accepted');
  r = await post(`/api/admin/designs/${number}/status`, { status: 'ordered', shopOrder: '12345' }, h);
  const d = await r.json();
  assert.equal(d.shopOrder, '12345');
  assert.ok(d.events.length >= 4);

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
  r = await fetch(base + '/api/me', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(r.status, 401);
});
