import { fitTextHeight } from './factory';
import type { El } from './types';

export interface Touch2 { x1: number; y1: number; x2: number; y2: number }

export const pinchMetrics = (t: Touch2) => ({
  dist: Math.hypot(t.x2 - t.x1, t.y2 - t.y1),
  angle: (Math.atan2(t.y2 - t.y1, t.x2 - t.x1) * 180) / Math.PI,
  cx: (t.x1 + t.x2) / 2,
  cy: (t.y1 + t.y2) / 2,
});

/** Zmiana kąta w zakresie -180..180 (bez skoku przy przejściu przez ±180°). */
export const angleDelta = (a: number, b: number) => ((b - a + 540) % 360) - 180;

/** Gest dwoma palcami na elemencie: k = zmiana odległości palców, dRot = obrót w stopniach. */
export function applyPinch(el: El, k: number, dRot: number): Partial<El> {
  const kk = Math.min(1.5, Math.max(0.67, k)); // ogranicz skoki z pojedynczej klatki
  const rotation = Math.round((el.rotation + dRot) * 10) / 10;
  if (el.type === 'text') {
    const fontSize = Math.min(30, Math.max(0.8, el.fontSize * kk));
    return fitTextHeight({ ...el, fontSize, w: Math.max(4, el.w * kk), rotation });
  }
  const w = Math.min(160, Math.max(2, el.w * kk));
  return { w, h: el.h * (w / el.w), rotation };
}
