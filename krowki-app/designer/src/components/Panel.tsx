import { useEffect, useRef } from 'react';
import { FRONT, FRONT_CENTER } from '../config/template';
import { LAYOUTS, firstText } from '../config/templates';
import { imageDpi } from '../lib/checks';
import { centerCrop, fitTextHeight, FONTS, newShape, newText, SWATCHES } from '../lib/factory';
import type { Adjust, El, ImageEl, ShapeEl, TextEl } from '../lib/types';
import { uid } from '../lib/types';
import { mmToPt, ptToMm } from '../lib/units';
import { useStore } from '../state/store';

interface Props {
  onUpload: (targetId: string | null) => void;
  onCrop: (id: string) => void;
  textFocus: number;
}

export function Panel({ onUpload, onCrop, textFocus }: Props) {
  const el = useStore((s) => s.design.elements.find((e) => e.id === s.selectedId) ?? null);
  const mode = useStore((s) => s.mode);
  return (
    <div className="kd-panel">
      {!el && <NothingSelected onUpload={onUpload} />}
      {el?.type === 'image' && <ImageProps el={el} onUpload={onUpload} onCrop={onCrop} />}
      {el?.type === 'text' && <TextProps el={el} focus={textFocus} />}
      {el?.type === 'shape' && <ShapeProps el={el} />}
      {el && mode === 'advanced' && <Arrange el={el} />}
      {el && <DeleteRow el={el} />}
      {mode === 'advanced' && <Layers />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="kd-section"><h3>{title}</h3>{children}</section>;
}

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="kd-swatches">
      {SWATCHES.map((c) => (
        <button key={c} aria-label={'kolor ' + c} className={'kd-swatch' + (c.toLowerCase() === value.toLowerCase() ? ' kd-on' : '')} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
      <label className="kd-swatch kd-swatch-custom" title="Inny kolor">
        <input type="color" value={value.length === 7 ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />+
      </label>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, unit = '' }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="kd-field">
      <span className="kd-field-label">{label} <b>{Math.round(value * 10) / 10}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} onDoubleClick={() => onChange(Math.max(min, Math.min(max, 0)))} />
    </label>
  );
}

function NothingSelected({ onUpload }: { onUpload: (t: string | null) => void }) {
  const design = useStore((s) => s.design);
  const assets = useStore((s) => s.assets);
  const mode = useStore((s) => s.mode);
  const commit = useStore((s) => s.commit);
  const select = useStore((s) => s.select);
  const firstImage = design.elements.find((e) => e.type === 'image' && e.assetId) as ImageEl | undefined;
  const asset = firstImage?.assetId ? assets[firstImage.assetId] : undefined;
  const add = (el: El) => { commit((d) => ({ ...d, elements: [...d.elements, el] })); select(el.id); };
  return (
    <>
      <Section title="Dodaj">
        <div className="kd-grid2">
          <button className="kd-tile" onClick={() => onUpload(null)}><span className="kd-ico">🖼️</span>Zdjęcie lub logo</button>
          <button className="kd-tile" onClick={() => add(newText({ cy: FRONT_CENTER.y }))}><span className="kd-ico">T</span>Tekst</button>
        </div>
        {mode === 'advanced' && (
          <div className="kd-row kd-wrap" style={{ marginTop: 8 }}>
            <button className="kd-chip" onClick={() => add(newShape('rect'))}>▭ Prostokąt</button>
            <button className="kd-chip" onClick={() => add(newShape('ellipse'))}>◯ Koło</button>
            <button className="kd-chip" onClick={() => add(newShape('heart'))}>♥ Serce</button>
          </div>
        )}
      </Section>
      {asset && firstImage && (
        <Section title="Propozycje układu">
          <div className="kd-grid2">
            {LAYOUTS.map((l) => (
              <button key={l.id} className="kd-tile kd-layout" onClick={() => {
                const d = l.build(asset.id, asset.width, asset.height, design.bg, firstText(design.elements) ?? 'Dziękujemy!');
                d.elements = d.elements.map((e) => (e.type === 'image' ? { ...e, adjust: firstImage.adjust } : e));
                commit(() => d);
              }}>
                <LayoutIcon id={l.id} />{l.name}
              </button>
            ))}
          </div>
        </Section>
      )}
      <Section title="Kolor tła">
        <Swatches value={design.bg} onChange={(c) => commit((d) => ({ ...d, bg: c }), 'bg')} />
      </Section>
      <p className="kd-hint">Kliknij element na papierku, aby go zmienić. Przeciągnij, aby przesunąć.</p>
    </>
  );
}

function LayoutIcon({ id }: { id: string }) {
  return (
    <span className={'kd-layout-ico kd-l-' + id}>
      <i className="kd-l-img" /><i className="kd-l-txt" />
    </span>
  );
}

function DpiBadge({ el }: { el: ImageEl }) {
  const asset = useStore((s) => (el.assetId ? s.assets[el.assetId] : undefined));
  const dpi = imageDpi(el, asset);
  if (!asset) return null;
  const [cls, txt] = dpi >= 300 ? ['kd-ok', 'Ostrość: bardzo dobra'] : dpi >= 150 ? ['kd-warn', 'Ostrość: może być lekko nieostre'] : ['kd-err', 'Ostrość: zbyt mała – wyjdzie rozmazane'];
  return <div className={'kd-badge ' + cls} title={isFinite(dpi) ? `${Math.round(dpi)} DPI` : 'grafika wektorowa'}>{txt}</div>;
}

function ImageProps({ el, onUpload, onCrop }: { el: ImageEl; onUpload: (t: string | null) => void; onCrop: (id: string) => void }) {
  const updateEl = useStore((s) => s.updateEl);
  const mode = useStore((s) => s.mode);
  const asset = useStore((s) => (el.assetId ? s.assets[el.assetId] : undefined));
  const adj = (p: Partial<Adjust>, k: string) => updateEl(el.id, { adjust: { ...el.adjust, ...p } }, el.id + k);
  if (!el.assetId) {
    return (
      <Section title={el.placeholderLabel ?? 'Miejsce na zdjęcie'}>
        <button className="kd-btn kd-primary kd-block" onClick={() => onUpload(el.id)}>Wybierz zdjęcie</button>
      </Section>
    );
  }
  const fillFront = () => {
    if (!asset) return;
    updateEl(el.id, { cx: FRONT_CENTER.x, cy: FRONT_CENTER.y, w: FRONT.w, h: FRONT.h, rotation: 0, crop: centerCrop(asset.width, asset.height, FRONT.w / FRONT.h) }, 'fill' + Date.now());
  };
  return (
    <>
      <Section title="Zdjęcie">
        <DpiBadge el={el} />
        <div className="kd-grid3">
          <button className="kd-tile" onClick={() => onUpload(el.id)}><span className="kd-ico">⇄</span>Zamień</button>
          <button className="kd-tile" onClick={() => onCrop(el.id)}><span className="kd-ico">✂</span>Kadruj</button>
          <button className="kd-tile" onClick={() => updateEl(el.id, { rotation: (Math.round(el.rotation / 90) * 90 + 90) % 360 }, 'rot' + Date.now())}><span className="kd-ico">↻</span>Obróć</button>
        </div>
        <Slider label="Jasność" value={el.adjust.brightness} min={-100} max={100} onChange={(v) => adj({ brightness: v }, 'b')} />
        {mode === 'simple' && <button className="kd-link" onClick={fillFront}>Dopasuj do przodu cukierka</button>}
      </Section>
      {mode === 'advanced' && (
        <>
          <Section title="Korekty">
            <Slider label="Kontrast" value={el.adjust.contrast} min={-100} max={100} onChange={(v) => adj({ contrast: v }, 'c')} />
            <Slider label="Nasycenie" value={el.adjust.saturation} min={-100} max={100} onChange={(v) => adj({ saturation: v }, 's')} />
            <Slider label="Temperatura" value={el.adjust.warmth} min={-100} max={100} onChange={(v) => adj({ warmth: v }, 'w')} />
            <div className="kd-row kd-wrap">
              {([['none', 'Bez filtra'], ['bw', 'Czarno-białe'], ['sepia', 'Sepia'], ['vintage', 'Vintage'], ['warm', 'Ciepły']] as const).map(([k, l]) => (
                <button key={k} className={'kd-chip' + (el.adjust.preset === k ? ' kd-on' : '')} onClick={() => adj({ preset: k }, 'p' + Date.now())}>{l}</button>
              ))}
            </div>
            <button className="kd-link" onClick={() => updateEl(el.id, { adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, preset: 'none' } }, 'reset' + Date.now())}>Przywróć oryginał</button>
          </Section>
          <Section title="Kształt i położenie">
            <div className="kd-row kd-wrap">
              <button className="kd-chip" onClick={() => updateEl(el.id, { flipX: !el.flipX }, 'fx' + Date.now())}>⇋ Odbij poziomo</button>
              <button className="kd-chip" onClick={() => updateEl(el.id, { flipY: !el.flipY }, 'fy' + Date.now())}>⇵ Odbij pionowo</button>
              <button className={'kd-chip' + (el.clipFront ? ' kd-on' : '')} onClick={() => updateEl(el.id, { clipFront: !el.clipFront }, 'clip' + Date.now())}>⬡ Przytnij do kształtu przodu</button>
              <button className="kd-chip" onClick={fillFront}>Dopasuj do przodu</button>
            </div>
            <Slider label="Obrót" value={el.rotation} min={-180} max={180} unit="°" onChange={(v) => updateEl(el.id, { rotation: v }, el.id + 'r')} />
            <Slider label="Krycie" value={Math.round(el.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => updateEl(el.id, { opacity: v / 100 }, el.id + 'o')} />
          </Section>
        </>
      )}
    </>
  );
}

function TextProps({ el, focus }: { el: TextEl; focus: number }) {
  const updateEl = useStore((s) => s.updateEl);
  const mode = useStore((s) => s.mode);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (focus) { ta.current?.focus(); ta.current?.select(); } }, [focus]);
  const set = (p: Partial<TextEl>, k: string) => updateEl(el.id, fitTextHeight({ ...el, ...p }), el.id + k);
  return (
    <>
      <Section title="Tekst">
        <textarea ref={ta} className="kd-textarea" rows={2} value={el.text} onChange={(e) => set({ text: e.target.value, name: e.target.value.split('\n')[0].slice(0, 20) || 'Tekst' }, 't')} />
        <select className="kd-select" value={el.fontFamily} style={{ fontFamily: el.fontFamily }} onChange={(e) => set({ fontFamily: e.target.value }, 'f' + Date.now())}>
          {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
        <Slider label="Wielkość" value={Math.round(mmToPt(el.fontSize))} min={4} max={40} unit=" pt" onChange={(v) => set({ fontSize: ptToMm(v) }, 'fs')} />
        <div className="kd-row">
          <button className={'kd-chip' + (el.bold ? ' kd-on' : '')} style={{ fontWeight: 700 }} onClick={() => set({ bold: !el.bold }, 'b' + Date.now())}>B</button>
          <button className={'kd-chip' + (el.italic ? ' kd-on' : '')} style={{ fontStyle: 'italic' }} onClick={() => set({ italic: !el.italic }, 'i' + Date.now())}>I</button>
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} className={'kd-chip' + (el.align === a ? ' kd-on' : '')} onClick={() => set({ align: a }, 'a' + Date.now())} aria-label={'wyrównaj ' + a}>
              {a === 'left' ? '⯇≡' : a === 'center' ? '≡' : '≡⯈'}
            </button>
          ))}
        </div>
        <Swatches value={el.fill} onChange={(c) => set({ fill: c }, 'fill')} />
      </Section>
      {mode === 'advanced' && (
        <Section title="Więcej">
          <Slider label="Odstęp liter" value={el.letterSpacing} min={-0.5} max={2} step={0.05} unit=" mm" onChange={(v) => set({ letterSpacing: v }, 'ls')} />
          <Slider label="Interlinia" value={el.lineHeight} min={0.7} max={2} step={0.05} onChange={(v) => set({ lineHeight: v }, 'lh')} />
          <Slider label="Obrys" value={el.strokeWidth} min={0} max={0.8} step={0.05} unit=" mm" onChange={(v) => set({ strokeWidth: v }, 'sw')} />
          {el.strokeWidth > 0 && <Swatches value={el.stroke} onChange={(c) => set({ stroke: c }, 'st')} />}
          <Slider label="Obrót" value={el.rotation} min={-180} max={180} unit="°" onChange={(v) => set({ rotation: v }, 'r')} />
        </Section>
      )}
    </>
  );
}

function ShapeProps({ el }: { el: ShapeEl }) {
  const updateEl = useStore((s) => s.updateEl);
  return (
    <Section title={el.name}>
      <Swatches value={el.fill} onChange={(c) => updateEl(el.id, { fill: c }, el.id + 'fill')} />
      <Slider label="Krycie" value={Math.round(el.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => updateEl(el.id, { opacity: v / 100 }, el.id + 'o')} />
      {el.shape === 'rect' && <Slider label="Zaokrąglenie" value={el.cornerRadius} min={0} max={10} step={0.1} unit=" mm" onChange={(v) => updateEl(el.id, { cornerRadius: v }, el.id + 'cr')} />}
      <Slider label="Obramowanie" value={el.strokeWidth} min={0} max={1.5} step={0.05} unit=" mm" onChange={(v) => updateEl(el.id, { strokeWidth: v }, el.id + 'sw')} />
      {el.strokeWidth > 0 && <Swatches value={el.stroke} onChange={(c) => updateEl(el.id, { stroke: c }, el.id + 'st')} />}
    </Section>
  );
}

function move(arr: El[], id: string, dir: 1 | -1 | 'top' | 'bottom') {
  const i = arr.findIndex((e) => e.id === id);
  const a = [...arr];
  const [x] = a.splice(i, 1);
  const j = dir === 'top' ? a.length : dir === 'bottom' ? 0 : Math.max(0, Math.min(a.length, i + dir));
  a.splice(j, 0, x);
  return a;
}

function Arrange({ el }: { el: El }) {
  const commit = useStore((s) => s.commit);
  const updateEl = useStore((s) => s.updateEl);
  const select = useStore((s) => s.select);
  return (
    <Section title="Kolejność">
      <div className="kd-row kd-wrap">
        <button className="kd-chip" onClick={() => commit((d) => ({ ...d, elements: move(d.elements, el.id, 'top') }))}>Na wierzch</button>
        <button className="kd-chip" onClick={() => commit((d) => ({ ...d, elements: move(d.elements, el.id, 'bottom') }))}>Pod spód</button>
        <button className="kd-chip" onClick={() => { const c = { ...el, id: uid(el.type), cx: el.cx + 2, cy: el.cy + 2 } as El; commit((d) => ({ ...d, elements: [...d.elements, c] })); select(c.id); }}>Duplikuj</button>
        <button className="kd-chip" onClick={() => updateEl(el.id, { cx: FRONT_CENTER.x }, 'cx' + Date.now())}>Wyśrodkuj w poziomie</button>
        <button className={'kd-chip' + (el.locked ? ' kd-on' : '')} onClick={() => updateEl(el.id, { locked: !el.locked }, 'lock' + Date.now())}>{el.locked ? '🔒 Zablokowany' : '🔓 Zablokuj'}</button>
      </div>
    </Section>
  );
}

function DeleteRow({ el }: { el: El }) {
  const commit = useStore((s) => s.commit);
  const select = useStore((s) => s.select);
  return (
    <div className="kd-row kd-between kd-section">
      <button className="kd-link" onClick={() => select(null)}>← Gotowe</button>
      <button className="kd-btn kd-danger" onClick={() => { commit((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== el.id) })); select(null); }}>Usuń</button>
    </div>
  );
}

function Layers() {
  const els = useStore((s) => s.design.elements);
  const sel = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const commit = useStore((s) => s.commit);
  const updateEl = useStore((s) => s.updateEl);
  return (
    <Section title="Warstwy">
      {!els.length && <p className="kd-hint">Brak elementów.</p>}
      <ul className="kd-layers">
        {[...els].reverse().map((e) => (
          <li key={e.id} className={e.id === sel ? 'kd-on' : ''}>
            <button className="kd-layer-name" onClick={() => select(e.id)}>
              {e.type === 'image' ? '🖼️' : e.type === 'text' ? 'T' : '◆'} {e.type === 'text' ? (e as TextEl).text.split('\n')[0] || 'Tekst' : e.name}
            </button>
            <button title={e.hidden ? 'Pokaż' : 'Ukryj'} onClick={() => updateEl(e.id, { hidden: !e.hidden }, 'h' + Date.now())}>{e.hidden ? '🙈' : '👁'}</button>
            <button title="Zablokuj" onClick={() => updateEl(e.id, { locked: !e.locked }, 'l' + Date.now())}>{e.locked ? '🔒' : '🔓'}</button>
            <button title="W górę" onClick={() => commit((d) => ({ ...d, elements: move(d.elements, e.id, 1) }))}>▲</button>
            <button title="W dół" onClick={() => commit((d) => ({ ...d, elements: move(d.elements, e.id, -1) }))}>▼</button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
