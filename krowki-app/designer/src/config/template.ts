// Specyfikacja siatki krówki wg pliku „SIATKA SPECYFIKACJA 2016.pdf”.
// Wszystkie wartości w mm. Układ współrzędnych edytora: początek w lewym GÓRNYM rogu
// formatu ze spadem (76 × 79 mm). Specyfikacja liczy Y od dołu formatu netto, dlatego
// poniżej przeliczamy: yEdytor = BLEED + (NET_H - ySpec).

export const BLEED = 3;
export const NET_W = 70;
export const NET_H = 73;
export const FULL_W = NET_W + 2 * BLEED; // 76
export const FULL_H = NET_H + 2 * BLEED; // 79

/** Strefa bezpieczna (nie ma jej w specyfikacji – wartości przyjęte, konfigurowalne). */
export const SAFE_FROM_CUT = 2;
export const SAFE_FROM_FOLD = 1.5;

const fromSpecY = (ySpec: number) => BLEED + (NET_H - ySpec);
const X = (xSpec: number) => BLEED + xSpec;

export interface Rect { x: number; y: number; w: number; h: number }
const rect = (x1: number, ySpecTop: number, x2: number, ySpecBottom: number): Rect => ({
  x: X(x1), y: fromSpecY(ySpecTop), w: x2 - x1, h: ySpecTop - ySpecBottom,
});

export type PanelId = 'front' | 'sideTop' | 'sideBottom' | 'backTop' | 'backBottom' | 'endLeft' | 'endRight';

export interface Panel { id: PanelId; name: string; rect: Rect; textOk: boolean }

export const PANELS: Panel[] = [
  { id: 'front', name: 'przód cukierka', rect: rect(17, 50, 53, 29), textOk: true },
  { id: 'sideTop', name: 'górna ścianka', rect: rect(17, 60, 53, 50), textOk: true },
  { id: 'sideBottom', name: 'dolna ścianka', rect: rect(17, 29, 53, 19), textOk: true },
  { id: 'backTop', name: 'tył (górna klapa)', rect: rect(17, 73, 53, 60), textOk: true },
  { id: 'backBottom', name: 'tył (dolna klapa)', rect: rect(17, 19, 53, 0), textOk: true },
  { id: 'endLeft', name: 'lewy koniec (zawinięty)', rect: rect(0, 73, 17, 0), textOk: false },
  { id: 'endRight', name: 'prawy koniec (zawinięty)', rect: rect(53, 73, 70, 0), textOk: false },
];

export const panel = (id: PanelId) => PANELS.find((p) => p.id === id)!;
export const FRONT = panel('front').rect;
export const FRONT_CENTER = { x: FRONT.x + FRONT.w / 2, y: FRONT.y + FRONT.h / 2 };

/** Sześciokąt frontu (prostokąt 36 × 21 + trójkąty do krawędzi, wierzchołki na wys. 39,5 mm). */
export const FRONT_HEXAGON: [number, number][] = [
  [X(17), fromSpecY(50)], [X(53), fromSpecY(50)], [X(70), fromSpecY(39.5)],
  [X(53), fromSpecY(29)], [X(17), fromSpecY(29)], [X(0), fromSpecY(39.5)],
];

/** Linie zagięć (odcinki) do warstwy pomocniczej. */
export const FOLD_LINES: [number, number, number, number][] = [
  [X(17), BLEED, X(17), BLEED + NET_H],
  [X(53), BLEED, X(53), BLEED + NET_H],
  ...[60, 50, 29, 19].map((y) => [X(17), fromSpecY(y), X(53), fromSpecY(y)] as [number, number, number, number]),
];

export const NET_RECT: Rect = { x: BLEED, y: BLEED, w: NET_W, h: NET_H };

/** Obowiązkowy dopisek producenta – górna klapa, obrócony o 180°. */
// Położenie zmierzone z pliku siatki (600 DPI): tekst zajmuje x 23,2–46,9 mm, y 2,9–4,1 mm od góry formatu netto.
export const PRODUCER = {
  text: 'PRODUCENT: Krowki.pl Sp. z o.o., MILANÓWEK',
  cx: X(35.03),
  cy: BLEED + 3.53,
  /** szerokość tekstu na siatce – rozmiar fontu dobierany tak, by ją zachować */
  textWidth: 23.75,
  fontSize: 1.2,
  w: 30,
  h: 1.8,
};

/** Wymiary cukierka wynikające z siatki (do podglądu 3D). */
export const CANDY = { length: 36, width: 21, thickness: 10 };
