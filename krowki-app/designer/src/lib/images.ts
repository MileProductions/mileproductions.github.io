import { applyAdjust } from './filters';
import { uid, type Asset, type ImageEl } from './types';

const MAX_SOURCE = 6000;
const SVG_RASTER = 3000;

export async function loadAsset(file: Blob, name = 'obraz'): Promise<Asset> {
  const isSvg = file.type === 'image/svg+xml' || name.toLowerCase().endsWith('.svg');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('decode'));
      i.src = url;
    });
    let w = img.naturalWidth || SVG_RASTER, h = img.naturalHeight || SVG_RASTER;
    const target = isSvg ? SVG_RASTER : MAX_SOURCE;
    const scale = isSvg ? target / Math.max(w, h) : Math.min(1, target / Math.max(w, h));
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    canvas.getContext('2d')!.drawImage(img, 0, 0, cw, ch);
    return { id: uid('asset'), name, blob: file, source: canvas, width: cw, height: ch, vector: isSvg };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const cache = new Map<string, HTMLCanvasElement>();

/** Zwraca wykadrowany i skorygowany obraz. maxSide ogranicza rozmiar (podgląd); Infinity = pełna rozdzielczość. */
export function processedCanvas(asset: Asset, el: ImageEl, maxSide: number): HTMLCanvasElement {
  const crop = el.crop ?? { x: 0, y: 0, width: asset.width, height: asset.height };
  const key = JSON.stringify([asset.id, crop, el.adjust, maxSide]);
  const hit = cache.get(key);
  if (hit) return hit;
  const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  const cw = Math.max(1, Math.round(crop.width * scale)), ch = Math.max(1, Math.round(crop.height * scale));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(asset.source, crop.x, crop.y, crop.width, crop.height, 0, 0, cw, ch);
  const a = el.adjust;
  if (a.brightness || a.contrast || a.saturation || a.warmth || a.preset !== 'none') {
    const d = ctx.getImageData(0, 0, cw, ch);
    applyAdjust(d.data, a);
    ctx.putImageData(d, 0, 0);
  }
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  cache.set(key, c);
  return c;
}

export const PREVIEW_MAX = 1400;
