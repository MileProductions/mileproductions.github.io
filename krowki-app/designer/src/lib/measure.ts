import Konva from 'konva';
import type { TextEl } from './types';

export function fontStyle(el: Pick<TextEl, 'bold' | 'italic'>) {
  return [el.italic ? 'italic' : '', el.bold ? 'bold' : ''].filter(Boolean).join(' ') || 'normal';
}

/** Wysokość tekstu po zawinięciu w szerokości el.w (mm). */
export function measureTextHeight(el: TextEl): number {
  try {
    const t = new Konva.Text({
      text: el.text || ' ', width: el.w, fontSize: el.fontSize, fontFamily: el.fontFamily,
      fontStyle: fontStyle(el), lineHeight: el.lineHeight, letterSpacing: el.letterSpacing, padding: 0,
    });
    const h = t.height();
    t.destroy();
    return Math.max(el.fontSize * el.lineHeight, h);
  } catch {
    const lines = (el.text || ' ').split('\n').length;
    return lines * el.fontSize * el.lineHeight;
  }
}
