import { useState } from 'react';
import { PRICING } from '../config/pricing';
import { checkDesign } from '../lib/checks';
import { formatPrice, quote } from '../lib/pricing';
import { renderDesign } from '../lib/render';
import { useHost } from '../host';
import { useStore } from '../state/store';
import { Candy3D, usePreviewTextures } from './Preview3D';
import { PriceBox } from './Price';
import type { OrderResult, User } from '../adapters';

export function Summary({ user, onBack }: { user: User | null; onBack: () => void }) {
  const design = useStore((s) => s.design);
  const assets = useStore((s) => s.assets);
  const kg = useStore((s) => s.kg);
  const host = useHost();
  const prev = usePreviewTextures();
  const [view, setView] = useState<'3d' | 'flat' | 'pile'>('3d');
  const [angle, setAngle] = useState<'angle' | 'front' | 'back' | 'side'>('angle');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cust, setCust] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: '', notes: '' });
  const issues = checkDesign(design, assets);
  const blocking = issues.filter((i) => i.level === 'error');
  const q = quote(kg);
  const formOk = !host.showCustomerForm || (cust.name.trim() && /.+@.+\..+/.test(cust.email));

  const pdf = async () => {
    setBusy('pdf');
    const { download, exportPdf } = await import('../lib/pdf');
    try { download(await exportPdf(design, assets), 'papierek-krowki.pdf'); } finally { setBusy(null); }
  };

  const submit = async () => {
    setBusy('order'); setError(null);
    const { exportPdf } = await import('../lib/pdf');
    try {
      const [pdfBlob, previewCanvas] = await Promise.all([exportPdf(design, assets), renderDesign(design, assets, 10)]);
      const preview = await new Promise<Blob>((r) => previewCanvas.toBlob((b) => r(b!), 'image/png'));
      const used = new Set(design.elements.map((e) => (e.type === 'image' ? e.assetId : null)));
      const files = Object.values(assets).filter((a) => used.has(a.id)).map((a) => ({ id: a.id, name: a.name, blob: a.blob }));
      const res = await host.orders.submit({
        designJson: JSON.stringify(design), assets: files, pdf: pdfBlob, preview, kg: q.kg, pcs: q.pcs, total: q.total, customer: cust,
      });
      host.emit('design:approved', { orderId: res.orderId, kg: q.kg, total: q.total });
      setDone(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się złożyć zamówienia.');
    } finally { setBusy(null); }
  };

  if (done) {
    return (
      <div className="kd-summary kd-done">
        <div className="kd-big">🎉</div>
        <h2>Dziękujemy! Numer projektu: {done.orderId}</h2>
        <p>{done.message}</p>
        {done.shopUrl && (
          <>
            <p>Zamów krówki w sklepie: dodaj produkt do koszyka i wpisz numer projektu <b>{done.orderId}</b>.</p>
            <p><a className="kd-btn kd-primary kd-lg" href={done.shopUrl} target="_top">Przejdź do sklepu →</a></p>
          </>
        )}
        <p>Termin realizacji: {PRICING.leadTime}.</p>
        <button className="kd-btn" onClick={pdf}>{busy === 'pdf' ? 'Przygotowuję…' : 'Pobierz plik PDF projektu'}</button>
      </div>
    );
  }

  return (
    <div className="kd-summary">
      <div className="kd-summary-preview">
        <div className="kd-tabs">
          {([['3d', 'Cukierek 3D'], ['flat', 'Papierek'], ['pile', 'Kilka sztuk']] as const).map(([k, l]) => (
            <button key={k} className={'kd-chip' + (view === k ? ' kd-on' : '')} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        <div className="kd-stage-preview">
          {!prev && <p className="kd-hint">Przygotowuję podgląd…</p>}
          {prev && view === '3d' && <Candy3D data={prev} height={400} view={angle} />}
          {prev && view === 'flat' && <img src={prev.flat} alt="Papierek" className="kd-flat" />}
          {prev && view === 'pile' && <Candy3D data={prev} height={400} pile />}
        </div>
        {view === '3d' && (
          <div className="kd-row kd-wrap" style={{ justifyContent: 'center' }}>
            {([['angle', 'Z ukosa'], ['front', 'Przód'], ['back', 'Tył'], ['side', 'Bok']] as const).map(([k, l]) => (
              <button key={k} className={'kd-chip' + (angle === k ? ' kd-on' : '')} onClick={() => setAngle(k)}>{l}</button>
            ))}
          </div>
        )}
        {view !== 'flat' && <p className="kd-hint">Przeciągnij, aby obrócić. Kółko myszy lub dwa palce przybliżają.</p>}
      </div>
      <div className="kd-summary-side">
        <h2>Sprawdź i zamów</h2>
        <ul className="kd-checks">
          <li className={blocking.some((i) => i.id.endsWith(':dpi')) ? 'kd-err' : 'kd-ok'}>{blocking.some((i) => i.id.endsWith(':dpi')) ? '✗ Zdjęcie jest zbyt małe – wyjdzie rozmazane' : '✓ Ostrość zdjęć'}</li>
          <li className={issues.some((i) => i.id.endsWith(':safe')) ? 'kd-warn' : 'kd-ok'}>{issues.some((i) => i.id.endsWith(':safe')) ? '! Część tekstu może zostać ucięta' : '✓ Teksty mieszczą się na papierku'}</li>
          <li className={issues.some((i) => i.id.endsWith(':empty')) ? 'kd-warn' : 'kd-ok'}>{issues.some((i) => i.id.endsWith(':empty')) ? '! Zostało puste miejsce na zdjęcie' : '✓ Wszystkie miejsca wypełnione'}</li>
          <li className="kd-ok">✓ Dopisek producenta na tylnej klapie</li>
        </ul>
        {issues.some((i) => i.level !== 'info') && <button className="kd-link" onClick={onBack}>← Wróć i popraw</button>}
        <PriceBox />
        <p className="kd-hint">Termin: {PRICING.leadTime}. Cena przykładowa – do ustalenia przez sklep.</p>
        {host.showCustomerForm && (
          <div className="kd-form">
            <input placeholder="Imię i nazwisko" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
            <input placeholder="E-mail" type="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} />
            <input placeholder="Telefon (opcjonalnie)" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
            <textarea placeholder="Uwagi do zamówienia (opcjonalnie)" rows={2} value={cust.notes} onChange={(e) => setCust({ ...cust, notes: e.target.value })} />
          </div>
        )}
        <label className="kd-accept">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          Sprawdziłem/am pisownię, kolory i rozmieszczenie. Akceptuję projekt: pójdzie do druku dokładnie w tej postaci, bez dodatkowej korekty z naszej strony.
        </label>
        <p className="kd-hint">Kolory w druku mogą być nieco inne niż na ekranie.</p>
        {error && <p className="kd-error">{error}</p>}
        <button className="kd-btn kd-primary kd-block kd-lg" disabled={!ok || !!busy || !!blocking.length || !formOk} onClick={submit}>
          {busy === 'order' ? 'Wysyłam…' : `${host.orders.label} · ${q.individual ? 'wycena indywidualna' : formatPrice(q.total)}`}
        </button>
        <button className="kd-link" onClick={pdf} disabled={!!busy}>{busy === 'pdf' ? 'Przygotowuję PDF…' : 'Pobierz plik PDF do druku'}</button>
      </div>
    </div>
  );
}
