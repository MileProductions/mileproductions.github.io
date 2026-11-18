import { create } from 'zustand';
import type { Asset, Design, El } from '../lib/types';

export type Step = 1 | 2 | 3;
export type Mode = 'simple' | 'advanced';

interface State {
  design: Design;
  assets: Record<string, Asset>;
  selectedId: string | null;
  step: Step;
  mode: Mode;
  kg: number;
  past: Design[];
  future: Design[];
  lastKey: string | null;
  lastTime: number;
  showGrid: boolean;
  zoom: number;
  /** zmiana projektu z zapisem w historii; key łączy szybkie zmiany (np. suwak) w jeden krok */
  commit: (fn: (d: Design) => Design, key?: string) => void;
  updateEl: (id: string, patch: Partial<El>, key?: string) => void;
  replaceDesign: (d: Design) => void;
  select: (id: string | null) => void;
  addAsset: (a: Asset) => void;
  undo: () => void;
  redo: () => void;
  set: (p: Partial<Pick<State, 'step' | 'mode' | 'kg' | 'showGrid' | 'zoom'>>) => void;
  hydrate: (p: { design: Design; assets: Record<string, Asset>; kg?: number; step?: Step }) => void;
}

const HISTORY = 80;
export const EMPTY: Design = { bg: '#f8f3ea', elements: [] };

export const useStore = create<State>((set, get) => ({
  design: EMPTY,
  assets: {},
  selectedId: null,
  step: 1,
  mode: 'simple',
  kg: 1,
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  showGrid: false,
  zoom: 1,
  commit: (fn, key) => {
    const { design, past, lastKey, lastTime } = get();
    const next = fn(design);
    if (next === design) return;
    const now = Date.now();
    const merge = key && key === lastKey && now - lastTime < 800;
    set({
      design: next,
      past: merge ? past : [...past, design].slice(-HISTORY),
      future: [],
      lastKey: key ?? null,
      lastTime: now,
    });
  },
  updateEl: (id, patch, key) =>
    get().commit((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as El) : e)) }), key ?? id),
  replaceDesign: (d) => get().commit(() => d),
  select: (id) => set({ selectedId: id }),
  addAsset: (a) => set((s) => ({ assets: { ...s.assets, [a.id]: a } })),
  undo: () => {
    const { past, design, future } = get();
    if (!past.length) return;
    set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future], lastKey: null });
  },
  redo: () => {
    const { past, design, future } = get();
    if (!future.length) return;
    set({ design: future[0], future: future.slice(1), past: [...past, design], lastKey: null });
  },
  set: (p) => set(p),
  hydrate: ({ design, assets, kg, step }) =>
    set({ design, assets, kg: kg ?? 1, step: step ?? (design.elements.length ? 2 : 1), past: [], future: [] }),
}));

export const selectedEl = (s: State) => s.design.elements.find((e) => e.id === s.selectedId) ?? null;
