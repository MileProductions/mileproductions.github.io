import { get, set } from 'idb-keyval';
import { loadAsset } from '../lib/images';
import type { Asset, Design } from '../lib/types';
import { useStore, type Step } from './store';

interface Saved { v: 1; design: Design; kg: number; step: Step; assets: { id: string; name: string; blob: Blob }[]; savedAt: number }

const keyFor = (userId: string) => `krowka-designer:project:${userId}`;

export async function restore(userId: string): Promise<boolean> {
  try {
    const s = (await get(keyFor(userId))) as Saved | undefined;
    if (!s || s.v !== 1 || !s.design?.elements?.length) return false;
    const assets: Record<string, Asset> = {};
    for (const a of s.assets) {
      const loaded = await loadAsset(a.blob, a.name);
      assets[a.id] = { ...loaded, id: a.id };
    }
    useStore.getState().hydrate({ design: s.design, assets, kg: s.kg, step: s.step === 3 ? 2 : s.step });
    return true;
  } catch (e) {
    console.warn('Nie udało się wczytać zapisanego projektu', e);
    return false;
  }
}

/** Automatyczny zapis co ~1,5 s po zmianie. Zwraca funkcję wyłączającą. */
export function startAutosave(userId: string, onSaved?: () => void) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return useStore.subscribe((s, prev) => {
    if (s.design === prev.design && s.kg === prev.kg && s.step === prev.step) return;
    clearTimeout(t);
    t = setTimeout(async () => {
      const st = useStore.getState();
      const used = new Set(st.design.elements.map((e) => (e.type === 'image' ? e.assetId : null)));
      const payload: Saved = {
        v: 1, design: st.design, kg: st.kg, step: st.step, savedAt: Date.now(),
        assets: Object.values(st.assets).filter((a) => used.has(a.id)).map((a) => ({ id: a.id, name: a.name, blob: a.blob })),
      };
      try { await set(keyFor(userId), payload); onSaved?.(); } catch (e) { console.warn('Autozapis nieudany', e); }
    }, 1500);
  });
}
