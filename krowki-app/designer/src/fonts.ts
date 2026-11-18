import { FONTS } from './lib/factory';

let resolveCss: () => void = () => undefined;
/** Rozwiązuje się, gdy arkusz z definicjami fontów jest wczytany (lub po 4 s). */
export const fontsCssReady = new Promise<void>((r) => { resolveCss = r; setTimeout(r, 4000); });

/** Fonty z polskimi znakami (Google Fonts, podzbiór latin-ext). Muszą być w <head> dokumentu – także w trybie Shadow DOM. */
export function loadFonts(doc: Document = document) {
  if (doc.getElementById('kd-fonts')) return;
  const fam = FONTS.map((f) => 'family=' + f.replace(/ /g, '+') + (f === 'Great Vibes' || f === 'Lobster' || f === 'Pacifico' || f === 'Amatic SC' ? '' : ':ital,wght@0,400;0,700;1,400')).join('&');
  const link = doc.createElement('link');
  link.id = 'kd-fonts';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${fam}&display=swap`;
  link.onload = link.onerror = () => resolveCss();
  doc.head.appendChild(link);
}
