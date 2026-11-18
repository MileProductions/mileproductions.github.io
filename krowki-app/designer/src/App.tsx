import { useCallback, useEffect, useRef, useState } from 'react';
import { FRONT, FRONT_CENTER } from './config/template';
import { LAYOUTS, TEMPLATES } from './config/templates';
import { checkDesign } from './lib/checks';
import { fillFrame, newImage } from './lib/factory';
import { loadAsset } from './lib/images';
import type { Design, ImageEl } from './lib/types';
import { useHost } from './host';
import { restore, startAutosave } from './state/persist';
import { EMPTY, useStore, type Step } from './state/store';
import { Editor } from './components/Editor';
import { Panel } from './components/Panel';
import { CropModal } from './components/CropModal';
import { Candy3D, usePreviewTextures } from './components/Preview3D';
import { PriceBox } from './components/Price';
import { Summary } from './components/Summary';
import type { User } from './adapters';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/heic,image/heif';
const MAX_MB = 25;

export default function App() {
  const host = useHost();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const step = useStore((s) => s.step);
  const set = useStore((s) => s.set);
  const [toast, setToast] = useState<string | null>(null);
  const say = useCallback((t: string) => { setToast(t); setTimeout(() => setToast((x) => (x === t ? null : x)), 3500); }, []);

  useEffect(() => {
    host.auth.getUser().then((u) => { setUser(u); if (!u) host.emit('auth:required'); }).catch(() => setUser(null));
  }, [host]);
  useEffect(() => {
    if (!user) return;
    let stop: (() => void) | undefined;
    restore(user.id).then((ok) => {
      if (ok) say('Wczytano Twój ostatni projekt.');
      stop = startAutosave(user.id, () => host.emit('design:saved', { at: Date.now() }));
    });
    return () => stop?.();
  }, [user, host, say]);

  const design = useStore((s) => s.design);
  useEffect(() => { host.emit('price:changed', { kg: useStore.getState().kg }); }, [host, design]);

  if (user === undefined) return <div className="kd-app kd-center"><p>Ładowanie…</p></div>;
  if (user === null) {
    if (host.auth.newsletter) return <AccessGate onUser={setUser} />;
    return (
      <div className="kd-app kd-center">
        <div className="kd-card">
          <h2>Zaloguj się, aby zaprojektować własne krówki</h2>
          <p>Projektant opakowań jest dostępny dla zalogowanych klientów sklepu.</p>
          {host.auth.loginUrl && <a className="kd-btn kd-primary" href={host.auth.loginUrl}>Zaloguj się</a>}
        </div>
      </div>
    );
  }

  const steps: [Step, string][] = [[1, 'Wgraj zdjęcie lub wybierz wzór'], [2, 'Dopasuj'], [3, 'Zamów']];
  const hasDesign = design.elements.length > 0;

  return (
    <div className="kd-app">
      <header className="kd-header">
        <ol className="kd-steps">
          {steps.map(([n, l]) => (
            <li key={n} className={(step === n ? 'kd-on ' : '') + (n < step ? 'kd-past' : '')}>
              <button disabled={n > 1 && !hasDesign} onClick={() => set({ step: n })}><span>{n}</span>{l}</button>
            </li>
          ))}
        </ol>
        <PriceBox compact />
        {host.auth.logout && (
          <button className="kd-link kd-logout" title={user.email} onClick={async () => { await host.auth.logout!(); setUser(null); }}>Wyloguj</button>
        )}
      </header>
      {step === 1 && <Start say={say} />}
      {step === 2 && <Edit say={say} />}
      {step === 3 && <Summary user={user} onBack={() => set({ step: 2 })} />}
      {toast && <div className="kd-toast" role="status">{toast}</div>}
    </div>
  );
}

/** Wariant C: dostęp po zapisie do newslettera. Krok 1: e-mail + zgoda, krok 2: kod z maila. */
function AccessGate({ onUser }: { onUser: (u: User) => void }) {
  const gate = useHost().auth.newsletter!;
  const [cfg, setCfg] = useState<{ consentText: string; privacyUrl: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { gate.config().then(setCfg).catch(() => setCfg({ consentText: 'Zapisuję się do newslettera.', privacyUrl: null })); }, [gate]);

  const go = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Coś poszło nie tak. Spróbuj ponownie.'); } finally { setBusy(false); }
  };
  const request = () => go(async () => { await gate.request(email.trim(), consent); setSent(true); setCode(''); });
  const verify = () => go(async () => { onUser(await gate.verify(email.trim(), code)); });

  return (
    <div className="kd-app kd-center">
      <form className="kd-card kd-gate" onSubmit={(e) => { e.preventDefault(); if (!busy) (sent ? verify() : request()); }}>
        <div className="kd-big">🍬</div>
        {!sent ? (
          <>
            <h2>Zaprojektuj własne krówki</h2>
            <p>Projektant jest bezpłatny dla subskrybentów naszego newslettera. Podaj e-mail, a wyślemy Ci kod dostępu. Twoje projekty zapiszemy pod tym adresem.</p>
            <input type="email" required autoComplete="email" placeholder="Twój e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="kd-accept">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{cfg?.consentText ?? '…'}{cfg?.privacyUrl && <> <a href={cfg.privacyUrl} target="_blank" rel="noopener">Polityka prywatności</a></>}</span>
            </label>
            <p className="kd-hint">Masz już dostęp? Wpisz e-mail, zgoda nie jest potrzebna drugi raz.</p>
            {error && <p className="kd-error">{error}</p>}
            <button className="kd-btn kd-primary kd-block kd-lg" disabled={busy || !/.+@.+\..+/.test(email)}>{busy ? 'Wysyłam…' : 'Wyślij kod'}</button>
          </>
        ) : (
          <>
            <h2>Sprawdź skrzynkę</h2>
            <p>Wysłaliśmy kod na <b>{email}</b>. Wpisz go poniżej albo kliknij przycisk w mailu.</p>
            <input className="kd-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            {error && <p className="kd-error">{error}</p>}
            <button className="kd-btn kd-primary kd-block kd-lg" disabled={busy || code.length !== 6}>{busy ? 'Sprawdzam…' : 'Zaczynam projektować'}</button>
            <p className="kd-hint">
              Nie ma maila? Zajrzyj do spamu albo{' '}
              <button type="button" className="kd-link" onClick={request} disabled={busy}>wyślij kod ponownie</button>
              {' · '}
              <button type="button" className="kd-link" onClick={() => { setSent(false); setError(null); }}>zmień adres</button>
            </p>
          </>
        )}
      </form>
    </div>
  );
}

/** Wgrywanie plików: wspólne dla kroku 1 i 2. */
function useUpload(say: (t: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = (t: string | null) => { target.current = t; input.current?.click(); };

  const handle = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith('image/') || /\.(svg|heic|heif)$/i.test(f.name));
    if (!list.length) return say('To nie wygląda na zdjęcie. Wybierz plik JPG lub PNG.');
    setBusy(true);
    try {
      for (const file of list) {
        if (file.size > MAX_MB * 1024 * 1024) { say(`Plik „${file.name}” jest za duży (maks. ${MAX_MB} MB).`); continue; }
        let asset;
        try { asset = await loadAsset(file, file.name); } catch {
          say(`Nie udało się otworzyć „${file.name}”. Zapisz zdjęcie jako JPG i spróbuj ponownie.`); continue;
        }
        const st = useStore.getState();
        st.addAsset(asset);
        const t = target.current ? st.design.elements.find((e) => e.id === target.current) : undefined;
        const placeholder = (t?.type === 'image' ? t : st.design.elements.find((e) => e.type === 'image' && !e.assetId)) as ImageEl | undefined;
        if (placeholder) {
          // zamiana / wypełnienie istniejącego miejsca – kadr „cover” w tej samej ramce
          st.commit((d) => ({ ...d, elements: d.elements.map((e) => (e.id === placeholder.id ? fillFrame({ ...placeholder, crop: null }, asset.id, asset.width, asset.height) : e)) }));
          st.select(placeholder.id);
        } else if (!st.design.elements.length) {
          // pusty projekt: od razu gotowy układ
          st.replaceDesign(LAYOUTS[0].build(asset.id, asset.width, asset.height, st.design.bg, 'Dziękujemy!'));
          st.select(null);
        } else {
          const aspect = asset.width / asset.height;
          const h = Math.min(FRONT.h, FRONT.w / aspect);
          const el = newImage({ name: file.name.replace(/\.[^.]+$/, '').slice(0, 20) || 'Zdjęcie', cx: FRONT_CENTER.x, cy: FRONT_CENTER.y, w: h * aspect, h, assetId: asset.id });
          st.commit((d) => ({ ...d, elements: [...d.elements, el] }));
          st.select(el.id);
        }
        target.current = null;
      }
      useStore.getState().set({ step: 2 });
    } finally { setBusy(false); }
  };

  const el = (
    <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { if (e.target.files) handle(e.target.files); e.target.value = ''; }} />
  );
  return { open, handle, el, busy };
}

function Start({ say }: { say: (t: string) => void }) {
  const up = useUpload(say);
  const [over, setOver] = useState(false);
  const replaceDesign = useStore((s) => s.replaceDesign);
  const hasDesign = useStore((s) => s.design.elements.length > 0);
  const set = useStore((s) => s.set);
  const choose = (d: Design) => { replaceDesign(d); useStore.getState().select(null); set({ step: 2 }); };
  return (
    <div className="kd-start">
      {up.el}
      <div className={'kd-drop' + (over ? ' kd-over' : '')}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); up.handle(e.dataTransfer.files); }}
        onClick={() => up.open(null)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && up.open(null)}>
        <div className="kd-big">📷</div>
        <h2>{up.busy ? 'Wczytuję zdjęcie…' : 'Przeciągnij tu zdjęcie albo kliknij, aby wybrać'}</h2>
        <p>Z komputera lub prosto z telefonu. Ułożymy je na papierku za Ciebie.</p>
        <span className="kd-btn kd-primary kd-lg">Wybierz zdjęcie</span>
      </div>
      <h3 className="kd-or">…albo zacznij od gotowego wzoru</h3>
      <div className="kd-templates">
        {TEMPLATES.map((t) => <TemplateCard key={t.id} id={t.id} name={t.name} onClick={() => choose(t.build())} />)}
        <button className="kd-template kd-blank" onClick={() => choose({ ...EMPTY, elements: [] })}><span className="kd-big">＋</span>Pusty papierek</button>
      </div>
      {hasDesign && <button className="kd-link" onClick={() => set({ step: 2 })}>Wróć do swojego projektu →</button>}
    </div>
  );
}

function TemplateCard({ id, name, onClick }: { id: string; name: string; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import('./lib/render').then(({ renderDesign }) => renderDesign(TEMPLATES.find((t) => t.id === id)!.build(), {}, 4))
      .then((c) => {
        if (!alive) return;
        const crop = document.createElement('canvas');
        crop.width = (FRONT.w + 10) * 4; crop.height = (FRONT.h + 22) * 4;
        crop.getContext('2d')!.drawImage(c, (FRONT.x - 5) * 4, (FRONT.y - 11) * 4, crop.width, crop.height, 0, 0, crop.width, crop.height);
        setSrc(crop.toDataURL());
      });
    return () => { alive = false; };
  }, [id]);
  return (
    <button className="kd-template" onClick={onClick}>
      {src ? <img src={src} alt="" /> : <span className="kd-ph" />}
      {name}
    </button>
  );
}

const TIPS = [
  'Kliknij zdjęcie lub tekst na papierku, aby je zmienić.',
  'Przeciągaj elementy palcem lub myszką. Rogi ramki powiększają i obracają.',
  'Różowa ramka to przód cukierka. Szare pole zostanie odcięte.',
];

function Edit({ say }: { say: (t: string) => void }) {
  const up = useUpload(say);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const [cropId, setCropId] = useState<string | null>(null);
  const [textFocus, setTextFocus] = useState(0);
  const [tip, setTip] = useState(() => (localStorage.getItem('krowka-designer:tips') ? -1 : 0));
  const [big3d, setBig3d] = useState(false);
  const design = useStore((s) => s.design);
  const assets = useStore((s) => s.assets);
  const mode = useStore((s) => s.mode);
  const zoom = useStore((s) => s.zoom);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const { undo, redo, set, commit, select } = useStore.getState();
  const prev = usePreviewTextures();
  const issues = checkDesign(design, assets);
  const cropEl = design.elements.find((e) => e.id === cropId) as ImageEl | undefined;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = (e.composedPath()[0] as HTMLElement) ?? e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); return; }
      const sel = s.design.elements.find((x) => x.id === s.selectedId);
      if (!sel) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.commit((d) => ({ ...d, elements: d.elements.filter((x) => x.id !== sel.id) })); s.select(null); return; }
      if (e.key === 'Escape') { s.select(null); return; }
      const step = e.shiftKey ? 5 : 0.5;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d && !sel.locked) { e.preventDefault(); s.updateEl(sel.id, { cx: sel.cx + d[0], cy: sel.cy + d[1] }, 'key' + sel.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closeTip = () => { localStorage.setItem('krowka-designer:tips', '1'); setTip(-1); };
  const visible = issues.filter((i) => i.level !== 'info' || i.id === 'front-empty');

  return (
    <div className="kd-edit">
      {up.el}
      <div className="kd-toolbar">
        <button className="kd-icon" onClick={undo} disabled={!past} title="Cofnij (Ctrl+Z)">↶ <span>Cofnij</span></button>
        <button className="kd-icon" onClick={redo} disabled={!future} title="Ponów (Ctrl+Y)">↷ <span>Ponów</span></button>
        <span className="kd-sep" />
        <button className="kd-icon kd-zoom" onClick={() => set({ zoom: Math.max(1, zoom / 1.25) })} disabled={zoom <= 1} title="Pomniejsz">−</button>
        <button className="kd-icon kd-zoom" onClick={() => set({ zoom: 1 })} title="Dopasuj do ekranu">{Math.round(zoom * 100)}%</button>
        <button className="kd-icon kd-zoom" onClick={() => set({ zoom: Math.min(4, zoom * 1.25) })} title="Powiększ">+</button>
        <span className="kd-grow" />
        <div className="kd-switch" role="group" aria-label="Tryb edytora">
          <button className={mode === 'simple' ? 'kd-on' : ''} onClick={() => set({ mode: 'simple' })}>Prosty</button>
          <button className={mode === 'advanced' ? 'kd-on' : ''} onClick={() => set({ mode: 'advanced' })}>Zaawansowany</button>
        </div>
      </div>

      <div className="kd-workspace">
        <div className="kd-canvas-col">
          {tip >= 0 && (
            <div className="kd-tip">
              <span>💡 {TIPS[tip]}</span>
              <span className="kd-row">
                <button className="kd-link" onClick={closeTip}>Pomiń</button>
                <button className="kd-btn kd-sm" onClick={() => (tip < TIPS.length - 1 ? setTip(tip + 1) : closeTip())}>{tip < TIPS.length - 1 ? 'Dalej' : 'Rozumiem'}</button>
              </span>
            </div>
          )}
          <div className="kd-canvas" ref={wrap}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); up.handle(e.dataTransfer.files); }}>
            <Editor width={size.w} height={size.h} onRequestUpload={up.open} onRequestCrop={setCropId} onEditText={(id) => { select(id); setTextFocus((x) => x + 1); }} />
            {prev && !big3d && (
              <button className="kd-mini3d" onClick={() => setBig3d(true)} title="Podgląd cukierka – kliknij, aby powiększyć">
                <Candy3D data={prev} height={118} interactive={false} autoRotate />
                <small>Podgląd 3D · kliknij</small>
              </button>
            )}
            {prev && big3d && (
              <div className="kd-mini3d kd-big3d">
                <button className="kd-close" onClick={() => setBig3d(false)} aria-label="Zamknij podgląd">×</button>
                <Candy3D data={prev} height={0} />
                <small>Przeciągnij, aby obrócić · kółko myszy lub dwa palce, aby przybliżyć</small>
              </div>
            )}
          </div>
          {visible.length > 0 && (
            <ul className="kd-issues" aria-live="polite">
              {visible.slice(0, 3).map((i) => (
                <li key={i.id} className={'kd-' + i.level}>
                  <span>{i.level === 'error' ? '⛔' : i.level === 'warn' ? '⚠️' : 'ℹ️'} {i.message}</span>
                  {i.fix && <button className="kd-btn kd-sm" onClick={() => commit(i.fix!)}>{i.fixLabel}</button>}
                </li>
              ))}
              {visible.length > 3 && <li className="kd-info">…i {visible.length - 3} więcej</li>}
            </ul>
          )}
        </div>
        <aside className="kd-side">
          <Panel onUpload={up.open} onCrop={setCropId} textFocus={textFocus} />
          <button className="kd-btn kd-primary kd-block kd-lg kd-next" onClick={() => { select(null); set({ step: 3 }); }} disabled={!design.elements.length}>
            Dalej: podgląd i zamówienie →
          </button>
        </aside>
      </div>
      {cropEl && <CropModal el={cropEl} onClose={() => setCropId(null)} />}
    </div>
  );
}
