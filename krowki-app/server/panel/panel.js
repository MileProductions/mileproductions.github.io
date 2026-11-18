// Panel grafika: lista projektów, podgląd, akceptacja / odrzucenie, pobieranie plików, newsletter.
// Bez frameworka i bez budowania. Wszystkie dane klienta wstawiane jako tekst (bez innerHTML).

const main = document.getElementById('main');
let me = null;
let filter = { status: 'submitted', q: '' };

// ——— pomocnicze ———
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
  return el;
}
async function api(path, opt = {}) {
  const r = await fetch('/api/admin' + path, {
    ...opt, credentials: 'same-origin',
    headers: opt.body ? { 'content-type': 'application/json' } : {},
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const j = r.headers.get('content-type')?.includes('json') ? await r.json() : null;
  if (r.status === 401 && path !== '/login') { me = null; showLogin(); throw new Error('Sesja wygasła.'); }
  if (!r.ok) throw new Error(j?.error ?? `Błąd ${r.status}`);
  return j;
}
function toast(t) {
  const el = document.getElementById('toast');
  el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3500);
}
const fmtDate = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : '–');
const fmtKg = (kg) => (kg ? `${String(kg).replace('.', ',')} kg` : '–');
const fmtMoney = (v) => (v ? v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) : '–');
const fmtSize = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} kB`);
const badge = (s) => h('span', { class: `badge s-${s}` }, me?.statuses?.[s] ?? s);
const CMYK = { ok: ['CMYK gotowy', 'c-ok'], pending: ['CMYK w toku…', 'c-pending'], error: ['Błąd CMYK', 'c-error'] };
const fileUrl = (id, dl) => `/api/admin/files/${id}${dl ? '?download=1' : ''}`;

function ask({ title, text, field, required, confirm = 'Zapisz', danger }) {
  return new Promise((resolve) => {
    const input = field === 'textarea' ? h('textarea', { rows: 4 }) : field ? h('input', { type: 'text' }) : null;
    const err = h('p', { class: 'err' });
    const dlg = h('dialog', {},
      h('h2', {}, title), text ? h('p', {}, text) : null, input, err,
      h('div', { class: 'actions' },
        h('button', { onclick: () => { dlg.close(); resolve(null); } }, 'Anuluj'),
        h('button', {
          class: danger ? 'primary danger' : 'primary',
          onclick: () => {
            const v = input ? input.value.trim() : true;
            if (required && !v) { err.textContent = 'To pole jest wymagane.'; return; }
            dlg.close(); resolve(v);
          },
        }, confirm)));
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
    input?.focus();
  });
}

// ——— logowanie ———
function showLogin() {
  document.getElementById('nav').hidden = true;
  document.getElementById('logout').hidden = true;
  document.getElementById('who').textContent = '';
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'err' });
  const form = h('form', {
    class: 'card login',
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try {
        await api('/login', { method: 'POST', body: { email: email.value, password: pass.value } });
        await boot();
      } catch (x) { err.textContent = x.message; }
    },
  }, h('h1', {}, 'Logowanie grafika'), h('label', {}, 'E-mail'), email, h('label', {}, 'Hasło'), pass, err, h('button', { class: 'primary', type: 'submit' }, 'Zaloguj się'));
  main.replaceChildren(form);
  email.focus();
}

document.getElementById('logout').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => undefined);
  me = null; showLogin();
});

// ——— lista projektów ———
async function showList() {
  const data = await api(`/designs?${new URLSearchParams({ status: filter.status, q: filter.q })}`);
  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const chip = (s, label, n) => h('button', { class: 'chip' + (filter.status === s ? ' on' : ''), onclick: () => { filter.status = s; showList(); } }, label, n != null ? h('b', {}, n) : null);
  const search = h('input', { type: 'search', placeholder: 'Szukaj: numer, e-mail, nr zamówienia', value: filter.q });
  search.addEventListener('input', () => { clearTimeout(search.t); search.t = setTimeout(() => { filter.q = search.value; showList().then(() => { const s = main.querySelector('input[type=search]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }); }, 300); });

  const rows = data.items.map((d) => h('tr', { onclick: () => { location.hash = `#/projekt/${d.number}`; } },
    h('td', { class: 'thumb' }, d.previewId ? h('img', { src: fileUrl(d.previewId), alt: '', loading: 'lazy' }) : ''),
    h('td', {}, h('b', {}, d.number)),
    h('td', {}, fmtDate(d.createdAt)),
    h('td', {}, d.name ? [d.name, h('br'), h('small', { class: 'muted' }, d.email)] : d.email),
    h('td', {}, fmtKg(d.kg)),
    h('td', {}, badge(d.status)),
    h('td', { class: CMYK[d.cmyk][1] }, CMYK[d.cmyk][0]),
    h('td', {}, d.shopOrder ?? ''),
  ));
  main.replaceChildren(
    h('h1', {}, 'Projekty'),
    h('div', { class: 'filters' },
      chip('submitted', 'Do akceptacji', data.counts.submitted ?? 0),
      ...Object.entries(me.statuses).filter(([s]) => s !== 'submitted').map(([s, l]) => chip(s, l, data.counts[s] ?? 0)),
      chip('', 'Wszystkie', total),
      search),
    rows.length
      ? h('table', {}, h('thead', {}, h('tr', {}, ['', 'Numer', 'Wysłany', 'Klient', 'Ilość', 'Status', 'Plik do druku', 'Zamówienie w sklepie'].map((t) => h('th', {}, t)))), h('tbody', {}, rows))
      : h('div', { class: 'card empty' }, filter.status === 'submitted' && !filter.q ? 'Nie ma projektów czekających na akceptację. 🎉' : 'Brak projektów.'),
  );
}

// ——— szczegóły projektu ———
async function showDesign(number) {
  const d = await api(`/designs/${encodeURIComponent(number)}`);
  const preview = d.files.filter((f) => f.kind === 'preview').at(-1);
  const cmyk = d.files.filter((f) => f.kind === 'pdf_cmyk').at(-1);
  const rgb = d.files.filter((f) => f.kind === 'pdf_rgb').at(-1);
  const assets = d.files.filter((f) => f.kind === 'asset');

  const setStatus = async (status, extra = {}) => {
    try { await api(`/designs/${d.number}/status`, { method: 'POST', body: { status, ...extra } }); toast(`Status: ${me.statuses[status]}`); showDesign(number); } catch (e) { toast(e.message); }
  };
  const actions = [];
  if (['submitted', 'rejected'].includes(d.status)) {
    actions.push(h('button', { class: 'green', onclick: async () => { const note = await ask({ title: `Akceptuj ${d.number}`, text: 'Klient dostanie maila, że projekt jest gotowy do druku. Możesz dopisać uwagę (opcjonalnie).', field: 'textarea', confirm: 'Akceptuj' }); if (note !== null) setStatus('accepted', { note: note === true ? '' : note }); } }, '✓ Akceptuj'));
  }
  if (['submitted', 'accepted'].includes(d.status)) {
    actions.push(h('button', { class: 'danger', onclick: async () => { const note = await ask({ title: `Do poprawy: ${d.number}`, text: 'Napisz klientowi, co trzeba poprawić. Treść trafi do maila.', field: 'textarea', required: true, confirm: 'Wyślij do poprawy' }); if (note) setStatus('rejected', { note }); } }, '✗ Do poprawy'));
  }
  if (['submitted', 'accepted'].includes(d.status)) {
    actions.push(h('button', { onclick: async () => { const o = await ask({ title: 'Powiąż z zamówieniem w sklepie', text: 'Numer zamówienia z Shopera, w którym klient wpisał ten numer projektu.', field: 'text', required: true }); if (o) setStatus('ordered', { shopOrder: o }); } }, '🛒 Zamówiony…'));
  }
  if (['accepted', 'ordered'].includes(d.status)) actions.push(h('button', { onclick: () => setStatus('production') }, '🖨 W produkcji'));
  if (['ordered', 'production'].includes(d.status)) actions.push(h('button', { onclick: () => setStatus('done') }, '📦 Zrealizowany'));
  if (!['done', 'cancelled'].includes(d.status)) actions.push(h('button', { class: 'link', onclick: async () => { if (await ask({ title: 'Anulować projekt?', text: 'Klient nie dostanie maila.', confirm: 'Anuluj projekt', danger: true })) setStatus('cancelled'); } }, 'Anuluj'));
  if (['rejected', 'cancelled', 'done'].includes(d.status)) actions.push(h('button', { class: 'link', onclick: () => setStatus('submitted') }, 'Przywróć do akceptacji'));

  const cmykBox = d.cmyk === 'ok'
    ? h('div', { class: 'notice ok' }, `PDF w CMYK gotowy · profil ${d.cmykProfile ?? ''}`)
    : d.cmyk === 'pending'
      ? h('div', { class: 'notice warn' }, 'Trwa konwersja do CMYK… odśwież za chwilę.')
      : h('div', { class: 'notice err' }, 'Konwersja do CMYK nie powiodła się: ', h('code', {}, d.cmykError ?? ''));
  const regen = h('button', { class: 'link', onclick: async () => { regen.disabled = true; try { await api(`/designs/${d.number}/cmyk`, { method: 'POST' }); toast('Plik CMYK utworzony ponownie.'); showDesign(number); } catch (e) { toast(e.message); regen.disabled = false; } } }, 'Utwórz PDF w CMYK ponownie');

  const fileRow = (f, label) => h('li', {}, h('span', {}, label ?? f.name, h('small', { class: 'muted' }, ` · ${fmtSize(f.size)}`)),
    f.mime.startsWith('image/') || f.mime === 'application/pdf' ? h('a', { href: fileUrl(f.id), target: '_blank', rel: 'noopener' }, 'Otwórz') : null,
    h('a', { href: fileUrl(f.id, true) }, 'Pobierz'));
  const check = d.pdfCheck;

  main.replaceChildren(
    h('p', {}, h('a', { href: '#/' }, '← Wszystkie projekty')),
    h('h1', {}, `Projekt ${d.number} `, badge(d.status)),
    h('div', { class: 'detail' },
      h('div', { class: 'stack' },
        h('div', { class: 'card preview' }, preview
          ? h('span', { style: 'position:relative;display:inline-block' }, h('img', { src: fileUrl(preview.id), alt: 'Podgląd papierka' }), h('span', { class: 'trim', style: 'left:3.95%;right:3.95%;top:3.8%;bottom:3.8%' }))
          : h('p', { class: 'muted' }, 'Brak podglądu')),
        h('p', { class: 'muted', style: 'font-size:13px;margin:6px 0 0' }, 'Przerywana linia = format netto 70 × 73 mm (cięcie). Poza nią spad 3 mm.'),
      ),
      h('div', { class: 'stack' },
        h('div', { class: 'card' },
          h('h2', {}, 'Decyzja'),
          d.status === 'rejected' && d.rejectReason ? h('div', { class: 'notice err' }, 'Wysłano do poprawy: ', d.rejectReason) : null,
          h('div', { class: 'actions' }, actions),
        ),
        h('div', { class: 'card' },
          h('h2', {}, 'Pliki do druku'),
          cmykBox,
          h('ul', { class: 'files', style: 'margin-top:10px' },
            cmyk ? fileRow(cmyk, `PDF do druku, CMYK (${d.number}-CMYK.pdf)`) : null,
            rgb ? fileRow(rgb, 'PDF z konfiguratora, RGB') : null,
            ...assets.map((f) => fileRow(f, `Zdjęcie klienta: ${f.name.includes('__') ? f.name.slice(f.name.indexOf('__') + 2) : f.name}`)),
            h('li', {}, h('span', {}, 'Projekt (JSON, do ponownego otwarcia)'), h('a', { href: `/api/admin/designs/${d.number}/design.json` }, 'Pobierz'))),
          d.cmyk !== 'pending' ? regen : null,
          check ? h('p', { class: 'muted', style: 'font-size:13px' }, `Kontrola pliku: strona ${check.media.w} × ${check.media.h} mm, format netto ${check.trim?.w} × ${check.trim?.h} mm.`) : null,
        ),
        h('div', { class: 'card' },
          h('h2', {}, 'Klient i zamówienie'),
          h('dl', { class: 'kv' },
            h('dt', {}, 'E-mail'), h('dd', {}, h('a', { href: `mailto:${d.email}?subject=${encodeURIComponent('Projekt ' + d.number)}` }, d.email)),
            h('dt', {}, 'Imię i nazwisko'), h('dd', {}, d.name ?? '–'),
            h('dt', {}, 'Telefon'), h('dd', {}, d.phone ?? '–'),
            h('dt', {}, 'Ilość'), h('dd', {}, `${fmtKg(d.kg)}${d.pcs ? ` · ok. ${d.pcs} szt.` : ''}`),
            h('dt', {}, 'Cena w konfiguratorze'), h('dd', {}, fmtMoney(d.total)),
            h('dt', {}, 'Zamówienie w sklepie'), h('dd', {}, d.shopOrder ?? '–'),
            h('dt', {}, 'Uwagi klienta'), h('dd', {}, d.notes ?? '–'),
            h('dt', {}, 'Wysłany'), h('dd', {}, fmtDate(d.createdAt)),
          ),
          d.otherDesigns.length ? h('p', { style: 'font-size:14px' }, 'Inne projekty klienta: ', ...d.otherDesigns.flatMap((o, i) => [i ? ', ' : '', h('a', { href: `#/projekt/${o.number}` }, o.number)])) : null,
        ),
        h('div', { class: 'card' },
          h('h2', {}, 'Historia'),
          h('ul', { class: 'events' }, d.events.map((e) => h('li', {}, h('time', {}, fmtDate(e.at)), describe(e), e.note ? h('div', { class: 'muted' }, e.note) : null))),
          h('button', { class: 'link danger', onclick: async () => { if (await ask({ title: `Usunąć ${d.number}?`, text: 'Projekt i wszystkie jego pliki zostaną trwale usunięte.', confirm: 'Usuń na zawsze', danger: true })) { await api(`/designs/${d.number}`, { method: 'DELETE' }); toast('Projekt usunięty.'); location.hash = '#/'; } } }, 'Usuń projekt'),
        ),
      ),
    ),
  );
}

function describe(e) {
  if (e.action === 'submitted') return `Klient wysłał projekt (${e.actor})`;
  if (e.action === 'cmyk') return 'Utworzono PDF w CMYK';
  if (e.action === 'cmyk-error') return 'Błąd konwersji do CMYK';
  if (e.action.startsWith('status:')) return `${e.actor}: ${me.statuses[e.action.slice(7)] ?? e.action}`;
  return `${e.actor}: ${e.action}`;
}

// ——— newsletter ———
async function showNewsletter() {
  const rows = await api('/subscribers');
  const confirmed = rows.filter((r) => r.status === 'confirmed').length;
  main.replaceChildren(
    h('h1', {}, 'Newsletter z konfiguratora'),
    h('p', {}, `Potwierdzonych adresów: ${confirmed}. Niepotwierdzone (pending) to osoby, które nie kliknęły jeszcze linku ani nie wpisały kodu.`),
    h('div', { class: 'actions' },
      h('a', { class: 'btn primary', href: '/api/admin/subscribers.csv' }, 'Pobierz potwierdzone (CSV)'),
      h('a', { class: 'btn', href: '/api/admin/subscribers.csv?all=1' }, 'Pobierz wszystkie (CSV)')),
    rows.length
      ? h('table', {}, h('thead', {}, h('tr', {}, ['E-mail', 'Status', 'Zgoda', 'Potwierdzono', 'Projekty', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, rows.map((r) => h('tr', { style: 'cursor:default' },
          h('td', {}, r.email), h('td', {}, r.status === 'confirmed' ? 'potwierdzony' : r.status === 'pending' ? 'czeka na potwierdzenie' : r.status),
          h('td', {}, fmtDate(r.consentAt)), h('td', {}, fmtDate(r.confirmedAt)), h('td', {}, r.designs),
          h('td', {}, h('button', { class: 'link danger', title: 'RODO: usuwa zapis, projekty i pliki klienta', onclick: async () => {
            if (!(await ask({ title: 'Usunąć wszystkie dane klienta?', text: `${r.email}: zapis do newslettera, wszystkie projekty i pliki. Tego nie da się cofnąć.`, confirm: 'Usuń dane', danger: true }))) return;
            const res = await api(`/customers/${encodeURIComponent(r.email)}`, { method: 'DELETE' });
            toast(`Usunięto dane klienta (projektów: ${res.designs}).`); showNewsletter();
          } }, 'Usuń dane')))))) : h('div', { class: 'card empty' }, 'Nikt się jeszcze nie zapisał.'),
  );
}

// ——— routing ———
async function route() {
  if (!me) return;
  const hash = location.hash || '#/';
  for (const a of document.querySelectorAll('nav a')) a.classList.toggle('on', a.getAttribute('href') === (hash.startsWith('#/newsletter') ? '#/newsletter' : '#/'));
  try {
    const m = hash.match(/^#\/projekt\/(.+)$/);
    if (m) await showDesign(decodeURIComponent(m[1]));
    else if (hash.startsWith('#/newsletter')) await showNewsletter();
    else await showList();
  } catch (e) {
    if (me) main.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'err' }, e.message), h('a', { href: '#/' }, '← Wróć do listy')));
  }
}

async function boot() {
  try { me = await api('/me'); } catch { return; }
  document.getElementById('nav').hidden = false;
  document.getElementById('logout').hidden = false;
  document.getElementById('who').textContent = me.name;
  const warn = [];
  if (!me.ghostscript) warn.push('Na serwerze nie ma Ghostscript – pliki CMYK nie powstaną.');
  if (!me.iccFound) warn.push('Na serwerze brakuje profilu ICC – pliki CMYK nie powstaną.');
  document.querySelector('.server-warn')?.remove();
  if (warn.length) document.querySelector('.top').after(h('div', { class: 'notice err server-warn', style: 'margin:12px 24px 0' }, warn.join(' ')));
  route();
}

window.addEventListener('hashchange', route);
boot();
