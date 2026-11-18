import Konva from 'konva';
import { FULL_H, FULL_W } from '../config/template';
import { FONTS } from './factory';
import { fontsCssReady } from '../fonts';
import { processedCanvas, PREVIEW_MAX } from './images';
import { clipHexagon, HEART_PATH, imageAttrs, producerAttrs, shapeAttrs, textAttrs } from './nodes';
import type { Asset, Design, El } from './types';

export async function fontsReady(d: Design) {
  if (typeof document === 'undefined' || !document.fonts) return;
  await fontsCssReady;
  const texts = d.elements.filter((e) => e.type === 'text') as { fontFamily: string; bold: boolean; italic: boolean }[];
  const specs = new Set(['16px "Lato"', ...texts.filter((t) => FONTS.includes(t.fontFamily)).map((t) => `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}16px "${t.fontFamily}"`)]);
  await Promise.all([...specs].map((s) => document.fonts.load(s, 'ąęółśżźćńĄĘÓŁŚŻŹĆŃ'))).catch(() => undefined);
}

function nodeFor(el: El, assets: Record<string, Asset>, print: boolean): Konva.Node | null {
  if (el.hidden) return null;
  if (el.type === 'text') return new Konva.Text(textAttrs(el));
  if (el.type === 'shape') {
    if (el.shape === 'rect') return new Konva.Rect({ ...shapeAttrs(el), width: el.w, height: el.h, cornerRadius: el.cornerRadius });
    if (el.shape === 'ellipse') return new Konva.Ellipse({ ...shapeAttrs(el), radiusX: el.w / 2, radiusY: el.h / 2, offsetX: 0, offsetY: 0 });
    return new Konva.Path({ ...shapeAttrs(el), data: HEART_PATH, scaleX: el.w / 100, scaleY: el.h / 92, offsetX: 50, offsetY: 46 });
  }
  const asset = el.assetId ? assets[el.assetId] : undefined;
  if (!asset) return null; // puste miejsce nie trafia do druku
  const img = new Konva.Image({ ...imageAttrs(el), image: processedCanvas(asset, el, print ? Infinity : PREVIEW_MAX) });
  if (!el.clipFront) return img;
  const g = new Konva.Group({ clipFunc: clipHexagon as never });
  g.add(img);
  return g;
}

/** Renderuje projekt bez linii pomocniczych do canvasa (format ze spadem 76 × 79 mm). */
export async function renderDesign(d: Design, assets: Record<string, Asset>, pxPerMm: number, print = false): Promise<HTMLCanvasElement> {
  await fontsReady(d);
  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: Math.round(FULL_W * pxPerMm), height: Math.round(FULL_H * pxPerMm) });
  const layer = new Konva.Layer({ scaleX: pxPerMm, scaleY: pxPerMm });
  stage.add(layer);
  layer.add(new Konva.Rect({ x: 0, y: 0, width: FULL_W, height: FULL_H, fill: d.bg }));
  for (const el of d.elements) {
    const n = nodeFor(el, assets, print);
    if (n) layer.add(n as Konva.Shape);
  }
  layer.add(new Konva.Text(producerAttrs(d.bg)));
  const canvas = stage.toCanvas({ pixelRatio: 1 });
  stage.destroy();
  return canvas;
}
