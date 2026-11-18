export const MM_PER_INCH = 25.4;
export const PT_PER_MM = 72 / MM_PER_INCH;
export const mmToPx = (mm: number, dpi: number) => (mm / MM_PER_INCH) * dpi;
export const pxToMm = (px: number, dpi: number) => (px / dpi) * MM_PER_INCH;
/** Efektywna rozdzielczość: ile pikseli źródła przypada na cal wydruku. */
export const effectiveDpi = (sourcePx: number, printedMm: number) =>
  printedMm <= 0 ? Infinity : sourcePx / (printedMm / MM_PER_INCH);
export const mmToPt = (mm: number) => mm * PT_PER_MM;
export const ptToMm = (pt: number) => pt / PT_PER_MM;
