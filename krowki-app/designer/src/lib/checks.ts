import { BLEED, FRONT, NET_H, NET_W, PANELS, PRODUCER, SAFE_FROM_CUT, SAFE_FROM_FOLD, type Panel, type Rect } from '../config/template';
import { fitTextHeight } from './factory';
import type { Asset, Design, El, TextEl } from './types';
import { effectiveDpi, ptToMm } from './units';

export type Level = 'error' | 'warn' | 'info';
export interface Issue {
  id: string; elId: string; level: Level; message: string;
  fix?: (d: Design) => Design; fixLabel?: string;
}

export const MIN_TEXT_MM = ptToMm(5);

/** Prostokąt opisujący element (uwzględnia obrót o wielokrotność 90°, przy innych kątach – obwiednia). */
export function bbox(el: Pick<El, 'cx' | 'cy' | 'w' | 'h' | 'rotation'>): Rect {
  const r = ((el.rotation % 360) + 360) % 360 * (Math.PI / 180);
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const w = el.w * c + el.h * s, h = el.w * s + el.h * c;
  return { x: el.cx - w / 2, y: el.cy - h / 2, w, h };
}

export function safeRect(p: Panel): Rect {
  // od strony cięcia 2 mm, od strony zagięć 1,5 mm
  const left = p.rect.x <= BLEED + 0.01 ? SAFE_FROM_CUT : SAFE_FROM_FOLD;
  const right = p.rect.x + p.rect.w >= BLEED + NET_W - 0.01 ? SAFE_FROM_CUT : SAFE_FROM_FOLD;
  const top = p.rect.y <= BLEED + 0.01 ? SAFE_FROM_CUT : SAFE_FROM_FOLD;
  const bottom = p.rect.y + p.rect.h >= BLEED + NET_H - 0.01 ? SAFE_FROM_CUT : SAFE_FROM_FOLD;
  return { x: p.rect.x + left, y: p.rect.y + top, w: p.rect.w - left - right, h: p.rect.h - top - bottom };
}

export const inside = (a: Rect, b: Rect, eps = 0.05) =>
  a.x >= b.x - eps && a.y >= b.y - eps && a.x + a.w <= b.x + b.w + eps && a.y + a.h <= b.y + b.h + eps;
export const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function panelAt(x: number, y: number): Panel | undefined {
  return PANELS.find((p) => contains(p.rect, x, y));
}

/** Przesuwa (i w razie potrzeby zmniejsza) tekst tak, by mieścił się w strefie bezpiecznej panelu. */
export function fitTextIntoPanel(el: TextEl): TextEl {
  let p = panelAt(el.cx, el.cy);
  if (!p || !p.textOk) p = PANELS[0];
  const s = safeRect(p);
  let t: TextEl = { ...el, rotation: Math.round(el.rotation / 90) * 90 };
  const rotated = Math.abs(t.rotation % 180) === 90;
  const maxW = rotated ? s.h : s.w;
  if (t.w > maxW) t = fitTextHeight({ ...t, w: maxW });
  let b = bbox(t);
  for (let i = 0; i < 20 && (b.h > s.h + 0.01 || b.w > s.w + 0.01); i++) {
    t = fitTextHeight({ ...t, fontSize: t.fontSize * 0.9 });
    b = bbox(t);
  }
  const cx = Math.min(Math.max(t.cx, s.x + b.w / 2), s.x + s.w - b.w / 2);
  const cy = Math.min(Math.max(t.cy, s.y + b.h / 2), s.y + s.h - b.h / 2);
  return { ...t, cx, cy };
}

const PRODUCER_RECT: Rect = { x: PRODUCER.cx - PRODUCER.w / 2, y: PRODUCER.cy - PRODUCER.h / 2, w: PRODUCER.w, h: PRODUCER.h };

const replaceEl = (d: Design, el: El): Design => ({ ...d, elements: d.elements.map((e) => (e.id === el.id ? el : e)) });

export function imageDpi(el: El, asset?: Asset): number {
  if (el.type !== 'image' || !asset) return Infinity;
  if (asset.vector) return Infinity;
  const cw = el.crop?.width ?? asset.width;
  return effectiveDpi(cw, el.w);
}

export function checkDesign(d: Design, assets: Record<string, Asset>): Issue[] {
  const out: Issue[] = [];
  for (const el of d.elements) {
    if (el.hidden) continue;
    if (el.type === 'image') {
      if (!el.assetId) {
        out.push({
          id: el.id + ':empty', elId: el.id, level: 'warn',
          message: `Puste miejsce na zdjęcie („${el.placeholderLabel ?? el.name}”). Kliknij je, aby dodać zdjęcie.`,
          fix: (x) => ({ ...x, elements: x.elements.filter((e) => e.id !== el.id) }), fixLabel: 'Usuń puste miejsce',
        });
        continue;
      }
      const dpi = imageDpi(el, assets[el.assetId]);
      if (dpi < 150) out.push({ id: el.id + ':dpi', elId: el.id, level: 'error', message: `„${el.name}” będzie rozmazane w druku. Wgraj większe zdjęcie albo je zmniejsz.` });
      else if (dpi < 300) out.push({ id: el.id + ':dpi', elId: el.id, level: 'warn', message: `„${el.name}” może wyjść lekko nieostre.` });
    }
    if (el.type === 'text') {
      if (!el.text.trim()) continue;
      const b = bbox(el);
      const p = panelAt(el.cx, el.cy);
      const ok = p && p.textOk && inside(b, safeRect(p));
      if (!ok) {
        const where = p && !p.textOk ? 'jest na zawiniętym końcu papierka' : 'wychodzi za blisko krawędzi lub zagięcia';
        out.push({
          id: el.id + ':safe', elId: el.id, level: 'warn',
          message: `Tekst „${short(el.text)}” ${where} i może zostać ucięty.`,
          fix: (x) => replaceEl(x, fitTextIntoPanel(el)), fixLabel: 'Napraw automatycznie',
        });
      }
      if (el.fontSize < MIN_TEXT_MM) {
        out.push({
          id: el.id + ':small', elId: el.id, level: 'warn',
          message: `Tekst „${short(el.text)}” jest bardzo mały i może być nieczytelny.`,
          fix: (x) => replaceEl(x, fitTextIntoPanel(fitTextHeight({ ...el, fontSize: MIN_TEXT_MM }))), fixLabel: 'Powiększ',
        });
      }
    }
    if (el.type !== 'image' && intersects(bbox(el), PRODUCER_RECT)) {
      out.push({ id: el.id + ':prod', elId: el.id, level: 'info', message: `„${el.name}” nachodzi na obowiązkowy dopisek producenta na tylnej klapie.` });
    }
  }
  if (!d.elements.some((e) => !e.hidden && intersects(bbox(e), FRONT))) {
    out.push({ id: 'front-empty', elId: '', level: 'info', message: 'Przód cukierka jest pusty. Dodaj zdjęcie lub tekst.' });
  }
  return out;
}

const short = (t: string) => (t.length > 24 ? t.slice(0, 22) + '…' : t).replace(/\n/g, ' ');
