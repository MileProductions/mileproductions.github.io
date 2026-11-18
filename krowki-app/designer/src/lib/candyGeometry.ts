// Model krówki w papierku, zbudowany z wymiarów siatki (mm).
// Oś X = długość (36 mm), Y = szerokość (21 mm), Z = grubość (10 mm), przód cukierka = +Z.
// Każdy wierzchołek dostaje współrzędne UV wskazujące punkt na płaskim papierku (76 × 79 mm ze spadem),
// tak żeby nadruk „owinął się” dokładnie jak w rzeczywistości: przód, ścianki, zachodzące klapy z tyłu
// i zagięte końce z trójkątnymi zakładkami.
import { BLEED, CANDY, FRONT, FULL_H, FULL_W, NET_H } from '../config/template';

export const HALF_L = CANDY.length / 2; // 18
export const HALF_W = CANDY.width / 2; // 10.5
export const HALF_T = CANDY.thickness / 2; // 5
export const CORNER_R = 1.3; // krawędzie wyraźne jak na zdjęciach prawdziwej krówki
export const DOME = 0.3; // minimalnie wypukły wierzch

const FY = FRONT.y + FRONT.h / 2; // środek przodu na papierku (y = 36.5)
const W = CANDY.width, T = CANDY.thickness;
/** Obwód przekroju w „płaskich” mm papieru: przód 21 + bok 10 + tył 21 + bok 10 = 62 */
export const PERIM = 2 * (W + T);
/** Nominalne położenia zagięć na obwodzie, licząc od środka przodu w stronę górnej ścianki. */
const C = [HALF_W, HALF_W + T, HALF_W + T + W, HALF_W + 2 * T + W];
/** Krawędź górnej klapy (13 mm za zagięciem) – szew na tyle cukierka. */
const TOP_FLAP_END = HALF_W + T + (panelLen('backTop'));
function panelLen(id: 'backTop' | 'backBottom') { return id === 'backTop' ? 13 : 19; }

/** Punkt przekroju (y, z) i normalna dla nominalnej pozycji s na obwodzie (0..62). */
export function crossPoint(s: number): { y: number; z: number; ny: number; nz: number } {
  s = ((s % PERIM) + PERIM) % PERIM;
  const a = HALF_W, b = HALF_T, r = CORNER_R;
  const centers: [number, number, number][] = [
    [a - r, b - r, 90], [a - r, -(b - r), 0], [-(a - r), -(b - r), -90], [-(a - r), b - r, -180],
  ];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(s - C[i]) <= r) {
      const t = (s - (C[i] - r)) / (2 * r);
      const ang = ((centers[i][2] - 90 * t) * Math.PI) / 180;
      const ny = Math.cos(ang), nz = Math.sin(ang);
      return { y: centers[i][0] + r * ny, z: centers[i][1] + r * nz, ny, nz };
    }
  }
  if (s < C[0]) return { y: s, z: b, ny: 0, nz: 1 };
  if (s < C[1]) return { y: a, z: b - (s - C[0]), ny: 1, nz: 0 };
  if (s < C[2]) return { y: a - (s - C[1]), z: -b, ny: 0, nz: -1 };
  if (s < C[3]) return { y: -a, z: -b + (s - C[2]), ny: -1, nz: 0 };
  return { y: s - PERIM, z: b, ny: 0, nz: 1 };
}

/** Pozycja na papierku (mm, układ edytora) dla punktu obwodu s i długości x. */
export function paperAt(s: number, x: number): { px: number; py: number } {
  s = ((s % PERIM) + PERIM) % PERIM;
  // od przodu w górę: górna ścianka, potem górna klapa (z dopiskiem producenta) – leży na wierzchu;
  // za jej krawędzią widać dolną klapę, która jest pod spodem
  const py = s <= TOP_FLAP_END ? FY - s : FY + (PERIM - s);
  return { px: FRONT.x + FRONT.w / 2 + x, py };
}

export const uvOf = (px: number, py: number): [number, number] => [px / FULL_W, 1 - py / FULL_H];

function dome(y: number, x: number, nz: number) {
  const k = Math.max(0, nz);
  return DOME * k * (1 - (y / HALF_W) ** 2) * (0.75 + 0.25 * (1 - (x / HALF_L) ** 2));
}

/** Próbki obwodu: gęściej na zaokrągleniach, z początkiem na krawędzi klapy (szew UV). */
export function ringSamples(): number[] {
  const pts = new Set<number>();
  for (let s = 0; s <= PERIM; s += 0.75) pts.add(+s.toFixed(3));
  pts.add(TOP_FLAP_END);
  for (const c of C) for (let k = -8; k <= 8; k++) pts.add(+(c + (k / 8) * CORNER_R).toFixed(4));
  const arr = [...pts].map((s) => ((s - TOP_FLAP_END) % PERIM + PERIM) % PERIM).sort((p, q) => p - q);
  const uniq = arr.filter((v, i) => i === 0 || v - arr[i - 1] > 1e-3);
  uniq.push(PERIM); // zamknięcie pierścienia z innym UV
  return uniq.map((v) => v + TOP_FLAP_END);
}

export interface Geo { position: number[]; normal: number[]; uv: number[]; index: number[] }

/** Koniec skrzydełka (mm od środka) – wierzchołek sześciokąta z siatki leży na 35 mm. */
export const WING_END = 34.5;
export const PINCH = 3.5; // krótki, stromy skos końca cukierka do płaskiego skrzydełka
const WING_TIP_HALF_W = 0.7; // prawie ostry czubek, jak sześciokąt na siatce
const WING_HALF_T = 0.35;

const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/**
 * Przekrój w danym miejscu długości. Z góry: sześciokąt (prostokąt + zwężające się skrzydełka).
 * Z boku: prostopadłościan o stromych końcach; skrzydełka są płaskie, w płaszczyźnie przodu (strony z grafiką,
 * jak sześciokąt na siatce), a ich czubki lekko podwijają się w stronę tyłu.
 */
export function profile(x: number) {
  const ax = Math.abs(x);
  const e = Math.max(0, ax - HALF_L);
  const tmin = WING_HALF_T / HALF_T;
  // prawie prosty skos z lekko zaokrąglonym początkiem i końcem
  const t = Math.min(1, e / PINCH);
  const slope = 0.85 * t + 0.15 * smooth(t);
  const ts = e <= 0 ? 1 : 1 - (1 - tmin) * slope;
  const ws = e <= 0 ? 1 : 1 - (1 - WING_TIP_HALF_W / HALF_W) * Math.min(1, e / (WING_END - HALF_L));
  // końcówki skrzydełek lekko uniesione
  const lift = e > PINCH ? 0.055 * Math.pow(e - PINCH, 1.45) : 0;
  return { ws, ts, lift, e };
}

export function buildCandy(): { body: Geo; caps: Geo } {
  const body: Geo = { position: [], normal: [], uv: [], index: [] };
  const ring = ringSamples();
  const xs: number[] = [];
  const wingN = 30;
  for (let i = wingN; i > 0; i--) xs.push(-(HALF_L + (WING_END - HALF_L) * Math.pow(i / wingN, 1.4)));
  for (let i = 0; i <= 26; i++) xs.push(-HALF_L + (i / 26) * 2 * HALF_L);
  for (let i = 1; i <= wingN; i++) xs.push(HALF_L + (WING_END - HALF_L) * Math.pow(i / wingN, 1.4));
  for (const x of xs) {
    const pr = profile(x);
    const f = smooth(pr.e / PINCH);
    for (let j = 0; j < ring.length; j++) {
      const s = ring[j];
      const p = crossPoint(s);
      const y = p.y * pr.ws;
      const z = HALF_T - (HALF_T - p.z - (pr.e <= 0 ? dome(p.y, x, p.nz) : 0)) * pr.ts - pr.lift;
      body.position.push(x, y, z);
      body.normal.push(0, p.ny, p.nz);
      // szew na krawędzi górnej klapy: pierwszy wierzchołek = dolna klapa, ostatni = krawędź górnej
      const px = paperAt(0, x).px;
      let py = j === 0 ? FY + (PERIM - TOP_FLAP_END) : j === ring.length - 1 ? FY - TOP_FLAP_END : paperAt(s, x).py;
      const sm = ((s % PERIM) + PERIM) % PERIM;
      const signed = sm > PERIM / 2 ? sm - PERIM : sm;
      // na skrzydełku wierzch pokazuje papier tak, jak leży na siatce (trójkąty sześciokąta)
      if (Math.abs(signed) <= HALF_W + T / 2 && j !== 0 && j !== ring.length - 1) py = py + (FY - y - py) * f;
      body.uv.push(...uvOf(px, py));
    }
  }
  const R = ring.length;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < R - 1; j++) {
      const a = i * R + j, b = a + 1, c = a + R, d = c + 1;
      body.index.push(a, c, b, b, c, d);
    }
  }
  // zamknięcie końców skrzydełek (bardzo cienka krawędź papieru)
  const caps: Geo = { position: [], normal: [], uv: [], index: [] };
  for (const side of [-1, 1] as const) {
    const x0 = side * WING_END;
    const pr = profile(x0);
    const base = caps.position.length / 3;
    const ringNoSeam = ring.slice(0, -1);
    for (const s of ringNoSeam) {
      const p = crossPoint(s);
      const y = p.y * pr.ws;
      caps.position.push(x0, y, HALF_T - (HALF_T - p.z) * pr.ts - pr.lift);
      caps.normal.push(side, 0, 0);
      caps.uv.push(...uvOf(paperAt(0, x0).px, FY - y));
    }
    caps.position.push(x0, 0, HALF_T - HALF_T * pr.ts - pr.lift);
    caps.normal.push(side, 0, 0);
    caps.uv.push(...uvOf(paperAt(0, x0).px, FY));
    const N = ringNoSeam.length, centre = base + N;
    for (let j = 0; j < N; j++) {
      const a = base + j, b = base + ((j + 1) % N);
      if (side > 0) caps.index.push(centre, a, b); else caps.index.push(centre, b, a);
    }
  }
  return { body, caps };
}

/** Fragmenty papierka, które na końcach są schowane pod trójkątną zakładką (do cieniowania tekstury). */
export function endFoldTriangles(): [number, number][][] {
  // trójkąty z siatki: od narożników przodu do wierzchołka sześciokąta na krawędzi formatu
  const yTop = FRONT.y, yBot = FRONT.y + FRONT.h, tipY = FY;
  return [
    [[FRONT.x, yTop], [BLEED, tipY], [FRONT.x, yBot]],
    [[FRONT.x + FRONT.w, yTop], [BLEED + 70, tipY], [FRONT.x + FRONT.w, yBot]],
  ];
}

export const NET_BOTTOM = BLEED + NET_H;
