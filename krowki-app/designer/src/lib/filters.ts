import type { Adjust } from './types';

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Korekty obrazu liczone na pikselach – identycznie w podglądzie i w pliku do druku. */
export function applyAdjust(data: Uint8ClampedArray, a: Adjust) {
  let { brightness, contrast, saturation, warmth } = a;
  let sepia = 0, gray = false;
  if (a.preset === 'bw') gray = true;
  if (a.preset === 'sepia') sepia = 1;
  if (a.preset === 'vintage') { sepia = 0.45; contrast -= 10; brightness += 5; saturation -= 15; }
  if (a.preset === 'warm') { warmth += 30; saturation += 10; }
  if (!brightness && !contrast && !saturation && !warmth && !sepia && !gray) return;
  const b = brightness * 2.55;
  const c = contrast * 2.55;
  const f = (259 * (c + 255)) / (255 * (259 - c));
  const s = 1 + saturation / 100;
  const w = warmth * 0.4;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], bl = data[i + 2];
    if (gray) { const l = 0.299 * r + 0.587 * g + 0.114 * bl; r = g = bl = l; }
    if (sepia) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * bl;
      const sg = 0.349 * r + 0.686 * g + 0.168 * bl;
      const sb = 0.272 * r + 0.534 * g + 0.131 * bl;
      r = r + (sr - r) * sepia; g = g + (sg - g) * sepia; bl = bl + (sb - bl) * sepia;
    }
    if (saturation) { const l = 0.299 * r + 0.587 * g + 0.114 * bl; r = l + (r - l) * s; g = l + (g - l) * s; bl = l + (bl - l) * s; }
    if (contrast) { r = f * (r - 128) + 128; g = f * (g - 128) + 128; bl = f * (bl - 128) + 128; }
    if (b) { r += b; g += b; bl += b; }
    if (w) { r += w; bl -= w; }
    data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(bl);
  }
}
