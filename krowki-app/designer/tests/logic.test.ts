import { describe, expect, it } from 'vitest';
import { FRONT, FRONT_HEXAGON, FULL_H, FULL_W, PANELS, BLEED } from '../src/config/template';
import { quote } from '../src/lib/pricing';
import { effectiveDpi, mmToPt, mmToPx, ptToMm } from '../src/lib/units';
import { bbox, checkDesign, fitTextIntoPanel, inside, safeRect, panelAt } from '../src/lib/checks';
import { applyAdjust } from '../src/lib/filters';
import { centerCrop, newText } from '../src/lib/factory';
import { NO_ADJUST } from '../src/lib/types';

describe('siatka', () => {
  it('format ze spadem 76 × 79 mm', () => { expect([FULL_W, FULL_H]).toEqual([76, 79]); });
  it('front 36 × 21 mm w miejscu ze specyfikacji', () => {
    expect(FRONT).toEqual({ x: 20, y: 26, w: 36, h: 21 });
    expect(FRONT_HEXAGON[2]).toEqual([73, 36.5]);
    expect(FRONT_HEXAGON[5]).toEqual([3, 36.5]);
  });
  it('panele kolumny środkowej sumują się do 73 mm', () => {
    const mid = PANELS.filter((p) => !p.id.startsWith('end'));
    expect(mid.reduce((s, p) => s + p.rect.h, 0)).toBe(73);
  });
  it('strefa bezpieczna frontu: 1,5 mm od zagięć', () => {
    expect(safeRect(PANELS[0])).toEqual({ x: 21.5, y: 27.5, w: 33, h: 18 });
  });
  it('dolna klapa: 2 mm od linii cięcia', () => {
    const r = safeRect(PANELS.find((p) => p.id === 'backBottom')!);
    expect(r.y + r.h).toBeCloseTo(BLEED + 73 - 2);
  });
});

describe('jednostki i DPI', () => {
  it('300 DPI na 70 mm ≈ 827 px', () => expect(Math.round(mmToPx(70, 300))).toBe(827));
  it('efektywne DPI', () => expect(Math.round(effectiveDpi(1200, 36))).toBe(847));
  it('pt ↔ mm', () => { expect(ptToMm(mmToPt(3))).toBeCloseTo(3); expect(mmToPt(25.4)).toBeCloseTo(72); });
});

describe('wycena', () => {
  it('minimum 1 kg ≈ 95 szt.', () => { const q = quote(0); expect(q.kg).toBe(1); expect(q.pcs).toBe(95); });
  it('rabat od 5 i 10 kg', () => { expect(quote(5).discountPct).toBe(5); expect(quote(12).discountPct).toBe(10); });
  it('od 25 kg wycena indywidualna', () => expect(quote(25).individual).toBe(true));
  it('suma = cena jednostkowa × kg', () => { const q = quote(7); expect(q.total).toBeCloseTo(q.unitPrice * 7); });
});

describe('kontrola projektu', () => {
  it('tekst poza strefą bezpieczną daje ostrzeżenie z naprawą', () => {
    const t = newText({ text: 'Hej', cx: FRONT.x + 1, cy: FRONT.y + 1, w: 10, h: 4 });
    const issues = checkDesign({ bg: '#fff', elements: [t] }, {});
    const safe = issues.find((i) => i.id.endsWith(':safe'))!;
    expect(safe).toBeTruthy();
    const fixed = safe.fix!({ bg: '#fff', elements: [t] });
    expect(checkDesign(fixed, {}).some((i) => i.id.endsWith(':safe'))).toBe(false);
  });
  it('naprawa przenosi tekst z zawiniętego końca na przód', () => {
    const t = newText({ text: 'Koniec', cx: 8, cy: 40, w: 10, h: 4 });
    expect(panelAt(t.cx, t.cy)?.id).toBe('endLeft');
    const f = fitTextIntoPanel(t);
    expect(inside(bbox(f), safeRect(PANELS[0]))).toBe(true);
  });
  it('za mały obraz = błąd ostrości', () => {
    const asset = { id: 'a', name: 'a', blob: new Blob(), source: null as never, width: 100, height: 60, vector: false };
    const img = { id: 'i', type: 'image' as const, name: 'Zdjęcie', cx: 38, cy: 36.5, w: 36, h: 21, rotation: 0, opacity: 1, assetId: 'a', crop: null, flipX: false, flipY: false, adjust: NO_ADJUST, clipFront: false };
    expect(checkDesign({ bg: '#fff', elements: [img] }, { a: asset }).some((i) => i.level === 'error')).toBe(true);
  });
});

describe('obraz', () => {
  it('kadr „cover” zachowuje proporcje', () => {
    const c = centerCrop(4000, 3000, 36 / 21);
    expect(c.width / c.height).toBeCloseTo(36 / 21);
    expect(c.width).toBe(4000);
  });
  it('czarno-białe wyrównuje kanały', () => {
    const d = new Uint8ClampedArray([200, 50, 10, 255]);
    applyAdjust(d, { ...NO_ADJUST, preset: 'bw' });
    expect(d[0]).toBe(d[1]); expect(d[1]).toBe(d[2]);
  });
  it('jasność +100 rozjaśnia', () => {
    const d = new Uint8ClampedArray([100, 100, 100, 255]);
    applyAdjust(d, { ...NO_ADJUST, brightness: 50 });
    expect(d[0]).toBeGreaterThan(200);
  });
});

import { TEMPLATES, LAYOUTS } from '../src/config/templates';
describe('szablony', () => {
  it('żaden szablon nie startuje z ostrzeżeniem o strefie bezpiecznej', () => {
    for (const t of TEMPLATES) {
      const issues = checkDesign(t.build(), {}).filter((i) => i.id.endsWith(':safe') || i.id.endsWith(':small'));
      expect(issues.map((i) => t.id + ': ' + i.message)).toEqual([]);
    }
  });
  it('propozycje układu też są poprawne', () => {
    const asset = { id: 'a', name: 'a', blob: new Blob(), source: null as never, width: 4000, height: 3000, vector: false };
    for (const l of LAYOUTS) {
      const d = l.build('a', 4000, 3000, '#fff', 'Dziękujemy!');
      expect(checkDesign(d, { a: asset }).filter((i) => i.level !== 'info').map((i) => l.id + ': ' + i.message)).toEqual([]);
    }
  });
});

import { buildCandy, crossPoint, paperAt, PERIM, ringSamples, profile, WING_END } from '../src/lib/candyGeometry';
describe('model 3D', () => {
  it('obwód przekroju = 62 mm papieru (przód, boki, tył)', () => expect(PERIM).toBe(62));
  it('środek przodu cukierka trafia w środek przodu na siatce', () => {
    expect(paperAt(0, 0)).toEqual({ px: 38, py: 36.5 });
    expect(crossPoint(0)).toMatchObject({ y: 0, z: 5 });
  });
  it('dopisek producenta (górna klapa) leży na wierzchu z tyłu', () => {
    // 30 mm od środka przodu w stronę górnej ścianki = tył cukierka, górna klapa
    expect(paperAt(30, 0).py).toBeCloseTo(6.5);
  });
  it('pierścień korpusu jest zamknięty (brak szczeliny na tyle)', () => {
    const { body } = buildCandy();
    const p = body.position;
    // pierwszy i ostatni wierzchołek pierwszego pierścienia mają tę samą pozycję
    const ringLen = ringSamples().length;
    const last = (ringLen - 1) * 3;
    expect(p[0]).toBeCloseTo(p[last]); expect(p[1]).toBeCloseTo(p[last + 1]); expect(p[2]).toBeCloseTo(p[last + 2]);
  });
});
describe('skrzydełka', () => {
  it('na końcu papier jest spłaszczony i węższy', () => {
    const p = profile(WING_END);
    expect(p.ts).toBeLessThan(0.1);
    expect(p.ws).toBeLessThan(0.1); // czubek jak wierzchołek sześciokąta
    expect(profile(0)).toMatchObject({ ws: 1, ts: 1, lift: 0 });
  });
  it('skrzydełko mieści się w papierze z siatki (35 mm od środka)', () => expect(WING_END).toBeLessThanOrEqual(35));
});
import { PRODUCER } from '../src/config/template';
describe('dopisek producenta', () => {
  it('na górnej klapie, w miejscu z siatki', () => {
    expect(PRODUCER.cx).toBeCloseTo(38.03, 1);
    expect(PRODUCER.cy).toBeCloseTo(6.53, 1);
    expect(PRODUCER.textWidth).toBeCloseTo(23.75, 1);
  });
});
import { angleDelta, applyPinch, pinchMetrics } from '../src/lib/gestures';
import { isHeic, isPdf } from '../src/lib/convert';
import { newImage } from '../src/lib/factory';
describe('gesty i formaty', () => {
  it('rozsunięcie palców 2× powiększa zdjęcie z zachowaniem proporcji', () => {
    const img = newImage({ w: 20, h: 10 });
    const p = applyPinch(img, 1.2, 0) as { w: number; h: number };
    expect(p.w).toBeCloseTo(24); expect(p.h).toBeCloseTo(12);
  });
  it('obrót dwoma palcami', () => {
    expect((applyPinch(newImage(), 1, 15) as { rotation: number }).rotation).toBe(15);
    expect(angleDelta(170, -170)).toBeCloseTo(20);
  });
  it('tekst skaluje się wielkością fontu', () => {
    const t = newText({ fontSize: 3 });
    expect((applyPinch(t, 1.1, 0) as { fontSize: number }).fontSize).toBeCloseTo(3.3);
  });
  it('odległość i kąt palców', () => {
    const m = pinchMetrics({ x1: 0, y1: 0, x2: 3, y2: 4 });
    expect(m.dist).toBe(5);
  });
  it('rozpoznaje HEIC i PDF', () => {
    expect(isHeic(new File([], 'IMG_1234.HEIC'))).toBe(true);
    expect(isPdf(new File([], 'logo.pdf', { type: 'application/pdf' }))).toBe(true);
    expect(isHeic(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(false);
  });
});
