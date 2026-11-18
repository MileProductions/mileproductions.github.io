import { FRONT, FRONT_CENTER } from '../config/template';
import { NO_ADJUST, uid, type Crop, type ImageEl, type ShapeEl, type TextEl } from './types';
import { measureTextHeight } from './measure';

export const FONTS = [
  'Lato', 'Montserrat', 'Playfair Display', 'Great Vibes', 'Dancing Script',
  'Lobster', 'Pacifico', 'Caveat', 'Merriweather', 'Roboto Slab', 'Amatic SC', 'Oswald',
];

export const SWATCHES = [
  '#ffffff', '#f8f3ea', '#f6d9d5', '#fde8b0', '#d9ead3', '#cfe2f3', '#e6d5f2',
  '#c0392b', '#e67e22', '#d4a017', '#27ae60', '#2471a3', '#6c3483', '#5d4037', '#333333', '#000000',
];

export function newText(partial: Partial<TextEl> = {}): TextEl {
  const el: TextEl = {
    id: uid('txt'), type: 'text', name: 'Tekst', cx: FRONT_CENTER.x, cy: FRONT_CENTER.y,
    w: FRONT.w - 6, h: 5, rotation: 0, opacity: 1,
    text: 'Twój tekst', fontFamily: 'Lato', fontSize: 3.5, fill: '#333333', bold: false, italic: false,
    align: 'center', letterSpacing: 0, lineHeight: 1.1, stroke: '#ffffff', strokeWidth: 0,
    ...partial,
  };
  return fitTextHeight(el);
}

export function fitTextHeight(el: TextEl): TextEl {
  const h = measureTextHeight(el);
  return Math.abs(h - el.h) > 0.01 ? { ...el, h } : el;
}

export function newImage(partial: Partial<ImageEl> = {}): ImageEl {
  return {
    id: uid('img'), type: 'image', name: 'Zdjęcie', cx: FRONT_CENTER.x, cy: FRONT_CENTER.y,
    w: FRONT.w, h: FRONT.h, rotation: 0, opacity: 1, assetId: null, crop: null,
    flipX: false, flipY: false, adjust: { ...NO_ADJUST }, clipFront: false, ...partial,
  };
}

export function newShape(shape: ShapeEl['shape'], partial: Partial<ShapeEl> = {}): ShapeEl {
  return {
    id: uid('shp'), type: 'shape', name: shape === 'rect' ? 'Prostokąt' : shape === 'ellipse' ? 'Koło' : 'Serce',
    shape, cx: FRONT_CENTER.x, cy: FRONT_CENTER.y, w: 10, h: 10, rotation: 0, opacity: 1,
    fill: '#c0392b', stroke: '#ffffff', strokeWidth: 0, cornerRadius: 0, ...partial,
  };
}

/** Kadr wycentrowany o zadanych proporcjach (w:h), „cover”. */
export function centerCrop(imgW: number, imgH: number, aspect: number): Crop {
  if (imgW / imgH > aspect) {
    const width = imgH * aspect;
    return { x: (imgW - width) / 2, y: 0, width, height: imgH };
  }
  const height = imgW / aspect;
  return { x: 0, y: (imgH - height) / 2, width: imgW, height };
}

/** Wstawia zdjęcie w ramkę (cx,cy,w,h) metodą „cover”. */
export function fillFrame(el: ImageEl, assetId: string, imgW: number, imgH: number): ImageEl {
  return { ...el, assetId, crop: centerCrop(imgW, imgH, el.w / el.h), placeholderLabel: undefined };
}
