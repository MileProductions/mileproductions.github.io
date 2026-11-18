import { FRONT, FRONT_CENTER, FULL_H, FULL_W, panel } from './template';
import { fillFrame, newImage, newShape, newText } from '../lib/factory';
import type { Design, El } from '../lib/types';

const sideTop = panel('sideTop').rect;
const sideBottom = panel('sideBottom').rect;
const cyOf = (r: { y: number; h: number }) => r.y + r.h / 2;

export interface Template { id: string; name: string; category: string; build: () => Design }

const photoSlot = (label: string, extra: Partial<ReturnType<typeof newImage>> = {}) =>
  newImage({ placeholderLabel: label, name: label, ...extra });

export const TEMPLATES: Template[] = [
  {
    id: 'wesele', name: 'Wesele', category: 'Wesele',
    build: () => ({
      bg: '#f8f3ea',
      elements: [
        photoSlot('Zdjęcie pary', { cx: FRONT.x + 10.5, w: 19, h: 19 }),
        newText({ text: 'Anna\n& Piotr', fontFamily: 'Great Vibes', fontSize: 4.6, fill: '#8a6d3b', cx: FRONT.x + 27.25, w: 13.5, lineHeight: 1 }),
        newText({ text: 'Dziękujemy, że jesteście z nami', fontFamily: 'Lato', fontSize: 2.1, fill: '#8a6d3b', cy: cyOf(sideBottom), w: 32 }),
        newText({ text: '12.06.2027', fontFamily: 'Playfair Display', fontSize: 2.4, fill: '#8a6d3b', cy: cyOf(sideTop), w: 32 }),
      ],
    }),
  },
  {
    id: 'chrzest', name: 'Chrzest', category: 'Chrzest',
    build: () => ({
      bg: '#cfe2f3',
      elements: [
        newShape('rect', { cx: FRONT_CENTER.x, cy: FRONT_CENTER.y, w: FRONT.w - 2, h: FRONT.h - 2, fill: '#ffffff', cornerRadius: 2, name: 'Tło napisu' }),
        newText({ text: 'Pamiątka Chrztu Świętego', fontFamily: 'Lato', fontSize: 2.1, fill: '#2471a3', cy: FRONT.y + 5, w: 32 }),
        newText({ text: 'Zuzia', fontFamily: 'Dancing Script', fontSize: 6, fill: '#2471a3', cy: FRONT_CENTER.y + 1.5, w: 32, bold: true }),
        newText({ text: '5 maja 2027', fontFamily: 'Lato', fontSize: 2.2, fill: '#2471a3', cy: cyOf(sideBottom), w: 32 }),
      ],
    }),
  },
  {
    id: 'komunia', name: 'Komunia', category: 'Komunia',
    build: () => ({
      bg: '#fdf7e3',
      elements: [
        photoSlot('Zdjęcie dziecka', { cx: FRONT.x + 10.5, w: 19, h: 19 }),
        newText({ text: 'Pamiątka\nI Komunii\nŚwiętej', fontFamily: 'Playfair Display', fontSize: 2.6, fill: '#b8860b', cx: FRONT.x + 27.25, w: 13.5 }),
        newText({ text: 'Kuba · 2027', fontFamily: 'Lato', fontSize: 2.3, fill: '#b8860b', cy: cyOf(sideBottom), w: 32 }),
      ],
    }),
  },
  {
    id: 'urodziny', name: 'Urodziny', category: 'Urodziny',
    build: () => ({
      bg: '#fde8b0',
      elements: [
        newText({ text: '18', fontFamily: 'Lobster', fontSize: 11, fill: '#c0392b', cx: FRONT.x + 9, w: 14 }),
        newText({ text: 'Urodziny\nOli', fontFamily: 'Pacifico', fontSize: 3.6, fill: '#6c3483', cx: FRONT.x + 25.5, w: 16.5 }),
        newText({ text: 'Słodkiego świętowania!', fontFamily: 'Lato', fontSize: 2.3, fill: '#6c3483', cy: cyOf(sideBottom), w: 32 }),
      ],
    }),
  },
  {
    id: 'firma', name: 'Firmowe z logo', category: 'Firmowe',
    build: () => ({
      bg: '#ffffff',
      elements: [
        photoSlot('Logo firmy', { w: 30, h: 13, cy: FRONT.y + 8 }),
        newText({ text: 'Słodkie podziękowania', fontFamily: 'Montserrat', fontSize: 2.3, fill: '#333333', cy: FRONT.y + 18, w: 32, bold: true }),
        newText({ text: 'www.twojafirma.pl', fontFamily: 'Montserrat', fontSize: 2.1, fill: '#333333', cy: cyOf(sideBottom), w: 32 }),
      ],
    }),
  },
  {
    id: 'swieta', name: 'Boże Narodzenie', category: 'Święta',
    build: () => ({
      bg: '#1e5631',
      elements: [
        newShape('heart', { cx: FRONT.x + 6, cy: FRONT_CENTER.y, w: 6, h: 6, fill: '#c0392b', name: 'Serce' }),
        newShape('heart', { cx: FRONT.x + FRONT.w - 6, cy: FRONT_CENTER.y, w: 6, h: 6, fill: '#c0392b', name: 'Serce' }),
        newText({ text: 'Wesołych\nŚwiąt', fontFamily: 'Great Vibes', fontSize: 5.2, fill: '#fdf7e3', w: 22, lineHeight: 1 }),
        newText({ text: 'Zdrowych i słodkich świąt!', fontFamily: 'Lato', fontSize: 2.2, fill: '#fdf7e3', cy: cyOf(sideBottom), w: 32 }),
      ],
    }),
  },
];

/** Propozycje układu po wgraniu zdjęcia (tryb prosty: wybór jednym kliknięciem). */
export interface Layout { id: string; name: string; build: (assetId: string, w: number, h: number, bg: string, text: string) => Design }

export const LAYOUTS: Layout[] = [
  {
    id: 'front', name: 'Zdjęcie na przodzie',
    build: (a, w, h, bg, text) => ({
      bg,
      elements: [
        fillFrame(newImage({ name: 'Zdjęcie' }), a, w, h),
        newText({ text, fontSize: 2.6, cy: cyOf(sideBottom), w: 32 }),
      ],
    }),
  },
  {
    id: 'front-band', name: 'Zdjęcie z napisem',
    build: (a, w, h, bg, text) => ({
      bg,
      elements: [
        fillFrame(newImage({ name: 'Zdjęcie' }), a, w, h),
        newShape('rect', { cy: FRONT.y + FRONT.h - 3.5, w: FRONT.w, h: 7, fill: '#ffffff', opacity: 0.8, name: 'Pasek pod napis' }),
        newText({ text, fontSize: 3, cy: FRONT.y + FRONT.h - 3.6, w: 32, fontFamily: 'Montserrat', bold: true }),
      ],
    }),
  },
  {
    id: 'full', name: 'Zdjęcie na całym papierku',
    build: (a, w, h, bg, text) => ({
      bg,
      elements: [
        fillFrame(newImage({ name: 'Zdjęcie w tle', cx: FULL_W / 2, cy: FULL_H / 2, w: FULL_W, h: FULL_H }), a, w, h),
        newShape('rect', { cy: FRONT.y + FRONT.h - 4.5, w: 30, h: 6.5, fill: '#ffffff', opacity: 0.85, cornerRadius: 3.2, name: 'Tło napisu' }),
        newText({ text, fontSize: 3, cy: FRONT.y + FRONT.h - 4.6, w: 28, fontFamily: 'Montserrat', bold: true }),
      ],
    }),
  },
  {
    id: 'side', name: 'Zdjęcie obok napisu',
    build: (a, w, h, bg, text) => ({
      bg,
      elements: [
        fillFrame(newImage({ name: 'Zdjęcie', cx: FRONT.x + 10.5, w: 19, h: 19 }), a, w, h),
        newText({ text, fontSize: 3.2, cx: FRONT.x + 27.25, w: 13.5, fontFamily: 'Dancing Script', bold: true }),
      ],
    }),
  },
];

export const firstText = (els: El[]) => (els.find((e) => e.type === 'text') as { text: string } | undefined)?.text;
