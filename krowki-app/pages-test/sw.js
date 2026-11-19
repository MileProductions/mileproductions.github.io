// Wersja testowa na GitHub Pages: ten service worker udaje backend (krowki-app/server) w przeglądarce.
// Dane (zapisy, projekty, pliki, „wysłane” maile) są tylko w tej przeglądarce (IndexedDB).
// Nie ma tu Ghostscript, więc PDF w CMYK powstaje tylko na prawdziwym serwerze.
/* eslint-disable no-restricted-globals */

const SCOPE = new URL(self.registration.scope).pathname; // np. /krowki-test/
const ADMIN = { email: 'produkcja@test.pl', password: 'krowki-test', name: 'Produkcja (test)' };
const CONSENT = 'Zapisuję się do newslettera i chcę otrzymywać informacje o ofercie i promocjach. Wiem, że mogę się wypisać w każdej chwili. (wersja testowa)';
const SHOP_URL = 'https://krowki24.pl/';
const STATUSES = { ready: 'Gotowy do druku', ordered: 'Zamówiony', production: 'W produkcji', done: 'Zrealizowany', cancelled: 'Anulowany' };
const NO_CMYK = 'Wersja testowa: konwersja do CMYK (Ghostscript, FOGRA39) działa tylko na serwerze. Tu można pobrać PDF w RGB.';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ——— IndexedDB: stan (JSON) + pliki (Blob) ———
let dbp;
const idb = () => dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open('krowki-test', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('files'); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const op = async (store, mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
  });
};
const EMPTY = () => ({ seq: { design: 0, file: 0 }, subscribers: {}, codes: {}, sessions: {}, admin: null, designs: [], files: [], outbox: [] });
const load = async () => (await op('kv', 'readonly', (s) => s.get('state'))) ?? EMPTY();
const save = (st) => op('kv', 'readwrite', (s) => s.put(st, 'state'));
const putFile = (id, blob) => op('files', 'readwrite', (s) => s.put(blob, id));
const getFile = (id) => op('files', 'readonly', (s) => s.get(id));
const delFile = (id) => op('files', 'readwrite', (s) => s.delete(id));

// Zapytania obsługujemy po kolei, żeby nie nadpisywać stanu równoległymi zapisami.
let chain = Promise.resolve();
const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => undefined); return p; };

// ——— pomocnicze ———
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const fail = (msg, status = 400) => json({ error: msg }, status);
const rnd = (n = 24) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const code6 = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
const norm = (e) => String(e ?? '').trim().toLowerCase();
const okEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const number = (id) => { const d = new Date(); return `KR-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(id).padStart(4, '0')}`; };
const bearer = (req) => (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || null;
const mail = (st, to, subject, lines) => st.outbox.unshift({ at: now(), to, subject, text: lines.filter(Boolean).join('\n') });
const customerOf = (st, req) => { const s = st.sessions[bearer(req)]; return s ? s.email : null; };

const listRow = (st, d) => ({ number: d.number, email: d.email, name: d.name, status: d.status, kg: d.kg, pcs: d.pcs, total: d.total, cmyk: d.cmyk, shopOrder: d.shopOrder, createdAt: d.createdAt, updatedAt: d.updatedAt, previewId: st.files.filter((f) => f.designId === d.id && f.kind === 'preview').at(-1)?.id ?? null });
const full = (st, d) => ({
  ...listRow(st, d), phone: d.phone, notes: d.notes, rejectReason: d.rejectReason, cmykError: NO_CMYK, cmykProfile: null, pdfCheck: null,
  files: st.files.filter((f) => f.designId === d.id).map(({ id, kind, name, mime, size, createdAt }) => ({ id, kind, name, mime, size, createdAt })),
  events: [...d.events].reverse(), elements: d.design.elements?.length ?? 0,
  otherDesigns: st.designs.filter((o) => o.email === d.email && o.id !== d.id).map((o) => ({ number: o.number, status: o.status, createdAt: o.createdAt })),
});
async function removeDesign(st, d) {
  for (const f of st.files.filter((x) => x.designId === d.id)) await delFile(f.id);
  st.files = st.files.filter((x) => x.designId !== d.id);
  st.designs = st.designs.filter((x) => x.id !== d.id);
}

// ——— API ———
async function handle(req, path) {
  const st = await load();
  const m = req.method;
  const body = async () => { try { return await req.json(); } catch { return {}; } };

  if (path === 'potwierdz') {
    const t = new URL(req.url).searchParams.get('t');
    const c = Object.values(st.codes).find((x) => x.link === t && !x.used && x.exp > Date.now());
    if (!c) return new Response('<p>Link wygasł.</p>', { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
    const token = confirm(st, c);
    await save(st);
    return Response.redirect(`${self.registration.scope}#kd-session=${token}`, 303);
  }
  if (path === 'api/config') return json({ consentText: CONSENT, privacyUrl: null, shopProductUrl: SHOP_URL, brand: 'Krówki (test)' });

  if (path === 'api/auth/request' && m === 'POST') {
    const b = await body();
    const email = norm(b.email);
    if (!okEmail(email)) return fail('Podaj poprawny adres e-mail.');
    const sub = st.subscribers[email];
    if (sub?.status !== 'confirmed' && b.consent !== true) return fail('Zaznacz zgodę na zapis do newslettera – daje ona dostęp do projektanta.');
    if (b.consent === true) st.subscribers[email] = { email, status: sub?.status === 'confirmed' ? 'confirmed' : 'pending', consentAt: now(), confirmedAt: sub?.confirmedAt ?? null, createdAt: sub?.createdAt ?? now() };
    const code = code6(); const link = rnd();
    st.codes[email] = { email, code, link, exp: Date.now() + 30 * 60000, attempts: 0, used: false };
    mail(st, email, sub?.status === 'confirmed' ? `Kod logowania: ${code}` : `Potwierdź zapis – kod ${code}`,
      [`Kod: ${code}`, 'Wpisz go w projektancie albo kliknij przycisk w mailu. Kod jest ważny 30 minut.', `Przycisk: ${self.registration.scope}potwierdz?t=${link}`]);
    await save(st);
    return json({ ok: true, minutes: 30, demoCode: code });
  }
  if (path === 'api/auth/verify' && m === 'POST') {
    const b = await body();
    const email = norm(b.email);
    const c = st.codes[email];
    if (!c || c.used || c.exp < Date.now()) return fail('Kod wygasł. Poproś o nowy.');
    if (c.attempts >= 5) return fail('Za dużo błędnych prób. Poproś o nowy kod.', 429);
    if (String(b.code ?? '').replace(/\D/g, '') !== c.code) { c.attempts++; await save(st); return fail('Nieprawidłowy kod.'); }
    const token = confirm(st, c);
    await save(st);
    return json({ token, email });
  }
  if (path === 'api/me') { const e = customerOf(st, req); return e ? json({ email: e }) : fail('Zaloguj się adresem e-mail.', 401); }
  if (path === 'api/auth/logout') { delete st.sessions[bearer(req)]; await save(st); return json({ ok: true }); }

  if (path === 'api/designs') {
    const email = customerOf(st, req);
    if (!email) return fail('Zaloguj się adresem e-mail.', 401);
    if (m === 'GET') return json(st.designs.filter((d) => d.email === email).reverse().map((d) => ({ number: d.number, status: d.status, statusLabel: STATUSES[d.status], kg: d.kg, createdAt: d.createdAt })));
    const f = await req.formData();
    let design; try { design = JSON.parse(f.get('design')); } catch { return fail('Brak lub uszkodzony projekt.'); }
    if (!(f.get('pdf') instanceof Blob) || !(f.get('preview') instanceof Blob)) return fail('Brak pliku PDF lub podglądu.');
    let customer = {}; try { customer = JSON.parse(f.get('customer') || '{}'); } catch { /* */ }
    const id = ++st.seq.design;
    const d = {
      id, number: number(id), email, status: 'ready', name: customer.name || null, phone: customer.phone || null, notes: customer.notes || null,
      kg: Number(f.get('kg')) || 0, pcs: Number(f.get('pcs')) || 0, total: Number(f.get('total')) || 0, design, cmyk: 'error', shopOrder: null, rejectReason: null,
      createdAt: now(), updatedAt: now(), events: [{ at: now(), actor: email, action: 'submitted', note: customer.notes || null }, { at: now(), actor: 'system', action: 'checked', note: 'Klient zaakceptował projekt w konfiguratorze.' }],
    };
    const add = async (kind, name, blob) => { const fid = ++st.seq.file; await putFile(fid, blob); st.files.push({ id: fid, designId: id, kind, name, mime: blob.type || 'application/octet-stream', size: blob.size, createdAt: now() }); };
    await add('pdf_rgb', `${d.number}-RGB.pdf`, new Blob([f.get('pdf')], { type: 'application/pdf' }));
    await add('preview', `${d.number}-podglad.png`, new Blob([f.get('preview')], { type: 'image/png' }));
    for (const a of f.getAll('asset')) if (a instanceof Blob) await add('asset', a.name || 'zdjecie', a);
    d.events.push({ at: now(), actor: 'system', action: 'cmyk-error', note: NO_CMYK });
    st.designs.push(d);
    mail(st, email, `Projekt ${d.number} gotowy do druku`, [`Dziękujemy! Twój projekt ma numer ${d.number}.`, 'Projekt jest zapisany i gotowy do druku dokładnie tak, jak go zaakceptowałeś/aś w projektancie.', `Aby zamówić krówki, dodaj produkt do koszyka w sklepie i wpisz numer projektu ${d.number}.`]);
    mail(st, ADMIN.email, `Nowy projekt: ${d.number}`, [`Klient: ${email}`, d.kg ? `Ilość: ${d.kg} kg` : '', d.notes ? `Uwagi: ${d.notes}` : '']);
    await save(st);
    return json({ orderId: d.number, status: d.status, shopUrl: SHOP_URL, message: 'Projekt zapisany i gotowy do druku (wersja testowa: zapisany w tej przeglądarce). Zobacz go w panelu produkcji.' }, 201);
  }

  // ——— panel ———
  if (path === 'api/admin/login' && m === 'POST') {
    const b = await body();
    if (norm(b.email) !== ADMIN.email || b.password !== ADMIN.password) return fail('Nieprawidłowy e-mail lub hasło. W wersji testowej: produkcja@test.pl / krowki-test', 401);
    st.admin = { exp: Date.now() + 12 * 3600e3 }; await save(st);
    return json({ email: ADMIN.email, name: ADMIN.name });
  }
  if (path === 'api/admin/logout') { st.admin = null; await save(st); return json({ ok: true }); }
  if (path.startsWith('api/admin/')) {
    if (!st.admin || st.admin.exp < Date.now()) return fail('Zaloguj się do panelu.', 401);
    const p = path.slice('api/admin/'.length);
    const q = new URL(req.url).searchParams;
    if (p === 'me') return json({ email: ADMIN.email, name: ADMIN.name, statuses: STATUSES, ghostscript: 'test', iccProfile: 'FOGRA39', iccFound: true, shopProductUrl: SHOP_URL });
    if (p === 'outbox') return json(st.outbox.slice(0, 100));
    if (p === 'designs') {
      let items = [...st.designs].reverse();
      if (q.get('status') && STATUSES[q.get('status')]) items = items.filter((d) => d.status === q.get('status'));
      const s = (q.get('q') ?? '').trim().toLowerCase();
      if (s) items = items.filter((d) => [d.number, d.email, d.name, d.shopOrder].some((v) => String(v ?? '').toLowerCase().includes(s)));
      const counts = {}; for (const d of st.designs) counts[d.status] = (counts[d.status] ?? 0) + 1;
      return json({ items: items.map((d) => listRow(st, d)), counts });
    }
    let mm = p.match(/^designs\/([^/]+)(\/.*)?$/);
    if (mm) {
      const d = st.designs.find((x) => x.number === decodeURIComponent(mm[1]));
      if (!d) return fail('Nie ma takiego projektu.', 404);
      const sub = mm[2] ?? '';
      if (!sub && m === 'GET') return json(full(st, d));
      if (!sub && m === 'DELETE') { await removeDesign(st, d); await save(st); return json({ ok: true }); }
      if (sub === '/design.json') return new Response(JSON.stringify(d.design), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${d.number}-projekt.json"` } });
      if (sub === '/cmyk') return json(full(st, d));
      if (sub === '/status' && m === 'POST') {
        const b = await body();
        if (!STATUSES[b.status]) return fail('Nieznany status.');
        if (b.shopOrder !== undefined) d.shopOrder = String(b.shopOrder).trim() || null;
        const was = d.status;
        d.status = b.status; d.updatedAt = now();
        d.events.push({ at: now(), actor: ADMIN.email, action: 'status:' + b.status, note: [b.note, b.shopOrder ? `zamówienie w sklepie: ${b.shopOrder}` : ''].filter(Boolean).join(' · ') || null });
        if (b.status === 'production' && was !== 'production') mail(st, d.email, `Krówki z projektem ${d.number} są w produkcji`, [`Drukujemy papierki z projektu ${d.number}. Termin realizacji: 5–7 dni roboczych.`, b.note ? `Informacja od nas: ${b.note}` : '']);
        await save(st);
        return json(full(st, d));
      }
    }
    mm = p.match(/^files\/(\d+)$/);
    if (mm) {
      const f = st.files.find((x) => x.id === Number(mm[1]));
      const blob = f && await getFile(f.id);
      if (!blob) return fail('Brak pliku.', 404);
      return new Response(blob, { headers: { 'content-type': f.mime, 'content-disposition': `${q.get('download') ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.name)}` } });
    }
    const subsRows = () => Object.values(st.subscribers).map((s) => ({ ...s, designs: st.designs.filter((d) => d.email === s.email).length })).reverse();
    if (p === 'subscribers') return json(subsRows());
    if (p === 'subscribers.csv') {
      const rows = subsRows().filter((r) => q.get('all') || r.status === 'confirmed');
      const csv = ['email,status,zgoda,potwierdzono', ...rows.map((r) => [r.email, r.status, r.consentAt ?? '', r.confirmedAt ?? ''].map((v) => `"${v}"`).join(','))].join('\r\n');
      return new Response('﻿' + csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="newsletter-konfigurator.csv"' } });
    }
    mm = p.match(/^customers\/(.+)$/);
    if (mm && m === 'DELETE') {
      const email = norm(decodeURIComponent(mm[1]));
      const list = st.designs.filter((d) => d.email === email);
      for (const d of list) await removeDesign(st, d);
      delete st.subscribers[email]; delete st.codes[email];
      for (const [t, s] of Object.entries(st.sessions)) if (s.email === email) delete st.sessions[t];
      await save(st);
      return json({ ok: true, designs: list.length });
    }
  }
  return fail('Nie ma takiego adresu.', 404);
}

function confirm(st, c) {
  c.used = true;
  const s = st.subscribers[c.email] ?? { email: c.email, createdAt: now(), consentAt: null };
  st.subscribers[c.email] = { ...s, status: 'confirmed', confirmedAt: s.confirmedAt ?? now() };
  const token = rnd();
  st.sessions[token] = { email: c.email, exp: Date.now() + 90 * 864e5 };
  return token;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(SCOPE)) return;
  const path = url.pathname.slice(SCOPE.length);
  if (!path.startsWith('api/') && path !== 'potwierdz') return;
  e.respondWith(serial(() => handle(e.request, path)).catch((err) => fail('Błąd wersji testowej: ' + (err?.message ?? err), 500)));
});
