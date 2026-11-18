// Projekty: zapis zgłoszenia z konfiguratora, kolejka konwersji CMYK, zmiany statusu, usuwanie.
import { designNumber } from './db.js';
import { mailBody } from './mail.js';
import { checkPrintPdf, convertToCmyk, inspectPdf } from './pdf.js';
import { safeName } from './storage.js';

export const STATUSES = {
  submitted: 'Do akceptacji',
  accepted: 'Zaakceptowany',
  rejected: 'Do poprawy',
  ordered: 'Zamówiony',
  production: 'W produkcji',
  done: 'Zrealizowany',
  cancelled: 'Anulowany',
};

export class UserError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function createDesigns({ cfg, db, storage, mailer, log = console }) {
  // Ghostscript po kolei, jeden plik naraz – żeby nie zająć całego serwera.
  let queue = Promise.resolve();
  const enqueueCmyk = (id) => { queue = queue.then(() => makeCmyk(id)).catch(() => undefined); return queue; };

  const event = (designId, actor, action, note = null) =>
    db.run('INSERT INTO events (design_id, actor, action, note) VALUES (?, ?, ?, ?)', designId, actor, action, note);

  async function addFile(designId, kind, name, mime, buf) {
    const rel = `${designId}/${kind}-${Date.now().toString(36)}-${safeName(name)}`;
    const size = await storage.write(rel, buf);
    const r = db.run('INSERT INTO files (design_id, kind, name, rel_path, mime, size) VALUES (?, ?, ?, ?, ?, ?)', designId, kind, name, rel, mime, size);
    return Number(r.lastInsertRowid);
  }

  async function makeCmyk(id) {
    const d = db.get('SELECT * FROM designs WHERE id = ?', id);
    const src = db.get("SELECT * FROM files WHERE design_id = ? AND kind = 'pdf_rgb' ORDER BY id DESC LIMIT 1", id);
    if (!d || !src) return;
    try {
      const out = await convertToCmyk(await storage.read(src.rel_path), cfg);
      const info = await inspectPdf(out);
      const problems = checkPrintPdf(info);
      if (problems.length) throw new Error('Plik po konwersji: ' + problems.join('; '));
      if (!info.imageColorSpaces.every((c) => c === 'DeviceCMYK' || c.includes('CMYK') || c === 'DeviceGray')) {
        throw new Error('Po konwersji zostały obrazy poza CMYK: ' + info.imageColorSpaces.join(', '));
      }
      for (const old of db.all("SELECT id FROM files WHERE design_id = ? AND kind = 'pdf_cmyk'", id)) db.run('DELETE FROM files WHERE id = ?', old.id);
      await addFile(id, 'pdf_cmyk', `${d.number}-CMYK.pdf`, 'application/pdf', out);
      db.run("UPDATE designs SET cmyk_status = 'ok', cmyk_error = NULL, cmyk_profile = ?, updated_at = datetime('now') WHERE id = ?", cfg.iccName, id);
      event(id, 'system', 'cmyk', `PDF w CMYK gotowy (${cfg.iccName})`);
    } catch (e) {
      const msg = String(e.stderr || e.message || e).slice(0, 1000);
      db.run("UPDATE designs SET cmyk_status = 'error', cmyk_error = ?, updated_at = datetime('now') WHERE id = ?", msg, id);
      event(id, 'system', 'cmyk-error', msg);
      log.error?.(`[cmyk] projekt ${d.number}: ${msg}`);
    }
  }

  /**
   * Zgłoszenie projektu z konfiguratora.
   * files: { pdf: {buffer, originalname}, preview: {...}, assets: [{buffer, originalname, mimetype}] }
   */
  async function submit({ email, fields, files }) {
    let design;
    try { design = JSON.parse(fields.design ?? ''); } catch { throw new UserError('Brak lub uszkodzony projekt (design).'); }
    if (!design || !Array.isArray(design.elements)) throw new UserError('Nieprawidłowy projekt.');
    if (!files.pdf) throw new UserError('Brak pliku PDF do druku.');
    if (!files.preview) throw new UserError('Brak podglądu projektu.');
    if (!/^\x89PNG/.test(files.preview.buffer.subarray(0, 4).toString('latin1'))) throw new UserError('Podgląd musi być plikiem PNG.');

    let info;
    try { info = await inspectPdf(files.pdf.buffer); } catch { throw new UserError('Nie udało się odczytać pliku PDF.'); }
    const problems = checkPrintPdf(info);
    if (problems.length) throw new UserError('PDF nie pasuje do siatki papierka: ' + problems.join('; '));

    const kg = Math.max(0, Number(fields.kg) || 0);
    const pcs = Math.max(0, Math.round(Number(fields.pcs) || 0));
    const total = Math.max(0, Number(fields.total) || 0);
    let customer = {};
    try { customer = JSON.parse(fields.customer || '{}') ?? {}; } catch { /* pomijamy */ }
    const str = (v, n) => String(v ?? '').trim().slice(0, n) || null;

    const id = db.tx(() => {
      const r = db.run('INSERT INTO designs (email, name, phone, notes, kg, pcs, total, design_json, pdf_check) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        email, str(customer.name, 120), str(customer.phone, 40), str(customer.notes, 2000), kg, pcs, total, JSON.stringify(design), JSON.stringify(info));
      const newId = Number(r.lastInsertRowid);
      db.run('UPDATE designs SET number = ? WHERE id = ?', designNumber(newId), newId);
      return newId;
    });
    const d = db.get('SELECT * FROM designs WHERE id = ?', id);
    try {
      await addFile(id, 'pdf_rgb', `${d.number}-RGB.pdf`, 'application/pdf', files.pdf.buffer);
      await addFile(id, 'preview', `${d.number}-podglad.png`, 'image/png', files.preview.buffer);
      for (const a of files.assets ?? []) await addFile(id, 'asset', a.originalname || 'zdjecie', a.mimetype || 'application/octet-stream', a.buffer);
    } catch (e) {
      await remove(id);
      throw e;
    }
    event(id, email, 'submitted', d.notes);
    enqueueCmyk(id);

    const shop = cfg.shopProductUrl;
    const kgTxt = kg ? `${String(kg).replace('.', ',')} kg (ok. ${pcs} szt.)` : '';
    await mailer.send({
      to: email,
      subject: `Projekt ${d.number} przyjęty do sprawdzenia`,
      ...mailBody(cfg, {
        title: `Dziękujemy! Twój projekt ma numer ${d.number}`,
        lines: [
          'Nasz grafik sprawdzi projekt przed drukiem. Jeśli coś będzie wymagało poprawki, napiszemy do Ciebie.',
          kgTxt && `Wybrana ilość: ${kgTxt}.`,
          shop ? `Aby zamówić krówki, dodaj produkt do koszyka w sklepie i wpisz numer projektu ${d.number}.` : `Przy zamówieniu podaj numer projektu ${d.number}.`,
        ].filter(Boolean),
        button: shop ? { label: 'Przejdź do sklepu', url: shop } : undefined,
      }),
    }).catch((e) => log.warn?.(`[mail] ${e.message}`));
    if (cfg.notifyEmail.length) {
      await mailer.send({
        to: cfg.notifyEmail.join(','),
        subject: `Nowy projekt do akceptacji: ${d.number}`,
        ...mailBody(cfg, { title: `Nowy projekt ${d.number}`, lines: [`Klient: ${email}`, kgTxt, d.notes ? `Uwagi: ${d.notes}` : ''].filter(Boolean), button: { label: 'Otwórz w panelu', url: `${cfg.publicUrl}/panel/#/projekt/${d.number}` } }),
      }).catch((e) => log.warn?.(`[mail] ${e.message}`));
    }
    return d;
  }

  async function setStatus(d, status, { actor, note, shopOrder }) {
    if (!STATUSES[status]) throw new UserError('Nieznany status.');
    if (status === 'rejected' && !String(note ?? '').trim()) throw new UserError('Napisz klientowi, co trzeba poprawić.');
    const reason = status === 'rejected' ? String(note).trim().slice(0, 2000) : d.reject_reason;
    const order = shopOrder !== undefined ? (String(shopOrder).trim().slice(0, 60) || null) : d.shop_order;
    db.run("UPDATE designs SET status = ?, reject_reason = ?, shop_order = ?, updated_at = datetime('now') WHERE id = ?", status, reason, order, d.id);
    event(d.id, actor, 'status:' + status, [note, order && order !== d.shop_order ? `zamówienie w sklepie: ${order}` : ''].filter(Boolean).join(' · ') || null);

    if (status === 'accepted' || status === 'rejected') {
      const lines = status === 'accepted'
        ? ['Grafik sprawdził projekt i jest gotowy do druku.', note ? `Uwagi grafika: ${note}` : '', cfg.shopProductUrl && !order ? `Jeśli jeszcze nie zamówiłeś/aś, dodaj krówki do koszyka i wpisz numer projektu ${d.number}.` : ''].filter(Boolean)
        : ['Grafik sprawdził projekt i prosi o poprawkę:', String(note).trim(), 'Otwórz konfigurator, popraw projekt i wyślij go ponownie. Dostaniesz nowy numer projektu.'];
      await mailer.send({
        to: d.email,
        subject: status === 'accepted' ? `Projekt ${d.number} zaakceptowany` : `Projekt ${d.number} wymaga poprawki`,
        ...mailBody(cfg, {
          title: status === 'accepted' ? `Projekt ${d.number} zaakceptowany` : `Projekt ${d.number}: potrzebna poprawka`,
          lines,
          button: status === 'accepted' ? (cfg.shopProductUrl && !order ? { label: 'Przejdź do sklepu', url: cfg.shopProductUrl } : undefined) : { label: 'Otwórz konfigurator', url: cfg.designerUrl },
        }),
      }).catch((e) => log.warn?.(`[mail] ${e.message}`));
    }
  }

  async function remove(id) {
    db.run('DELETE FROM designs WHERE id = ?', id);
    await storage.removeDir(String(id));
  }

  return { submit, setStatus, remove, enqueueCmyk, event, idle: () => queue };
}
