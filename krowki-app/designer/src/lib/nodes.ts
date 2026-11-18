import Konva from 'konva';
import { FRONT_HEXAGON, PRODUCER } from '../config/template';
import { fontStyle } from './measure';
import type { ImageEl, ShapeEl, TextEl } from './types';

/** Wspólne atrybuty Konva – te same w edytorze, podglądzie i pliku do druku. */
export const baseAttrs = (el: { cx: number; cy: number; w: number; h: number; rotation: number; opacity: number }) => ({
  x: el.cx, y: el.cy, offsetX: el.w / 2, offsetY: el.h / 2, rotation: el.rotation, opacity: el.opacity,
});

export const textAttrs = (el: TextEl): Konva.TextConfig => ({
  ...baseAttrs(el),
  width: el.w, height: el.h, text: el.text, fontFamily: el.fontFamily, fontSize: el.fontSize,
  fontStyle: fontStyle(el), fill: el.fill, align: el.align, verticalAlign: 'middle',
  letterSpacing: el.letterSpacing, lineHeight: el.lineHeight, padding: 0,
  stroke: el.strokeWidth > 0 ? el.stroke : undefined, strokeWidth: el.strokeWidth, fillAfterStrokeEnabled: true,
});

export const imageAttrs = (el: ImageEl) => ({
  ...baseAttrs(el), width: el.w, height: el.h, scaleX: el.flipX ? -1 : 1, scaleY: el.flipY ? -1 : 1,
});

export const HEART_PATH = 'M50 88 C20 66 4 50 4 30 C4 14 16 4 29 4 C38 4 46 9 50 17 C54 9 62 4 71 4 C84 4 96 14 96 30 C96 50 80 66 50 88 Z';

export const shapeAttrs = (el: ShapeEl) => ({
  ...baseAttrs(el), fill: el.fill, stroke: el.strokeWidth > 0 ? el.stroke : undefined, strokeWidth: el.strokeWidth,
});

export function clipHexagon(ctx: Konva.Context) {
  ctx.beginPath();
  FRONT_HEXAGON.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

export const isDark = (hex: string) => {
  const m = hex.replace('#', '');
  if (m.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
};

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** Rozmiar fontu, przy którym dopisek ma dokładnie szerokość z siatki. */
export function producerFontSize(): number {
  if (measureCtx === undefined) {
    try { measureCtx = document.createElement('canvas').getContext('2d'); } catch { measureCtx = null; }
  }
  if (!measureCtx) return PRODUCER.fontSize;
  measureCtx.font = '100px "Lato"';
  const w = measureCtx.measureText(PRODUCER.text).width / 100;
  return w > 0 ? PRODUCER.textWidth / w : PRODUCER.fontSize;
}

export const producerAttrs = (bg: string): Konva.TextConfig => ({
  x: PRODUCER.cx, y: PRODUCER.cy, width: PRODUCER.w, height: PRODUCER.h, offsetX: PRODUCER.w / 2, offsetY: PRODUCER.h / 2,
  rotation: 180, text: PRODUCER.text, fontFamily: 'Lato', fontSize: producerFontSize(), align: 'center',
  verticalAlign: 'middle', fill: isDark(bg) ? '#ffffff' : '#000000', listening: false,
});
