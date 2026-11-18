import { PDFDocument } from 'pdf-lib';
import { BLEED, FULL_H, FULL_W, NET_H, NET_W } from '../config/template';
import { renderDesign } from './render';
import type { Asset, Design } from './types';
import { mmToPt } from './units';

export const PRINT_DPI = 600;

/**
 * PDF do druku: strona 76 × 79 mm (format netto 70 × 73 mm + 3 mm spadu),
 * BleedBox = cała strona, TrimBox = format netto. Grafika spłaszczona do RGB w 600 DPI
 * (konwersja do CMYK – etap 3, po stronie serwera).
 */
export async function exportPdf(d: Design, assets: Record<string, Asset>, meta: { title?: string; orderId?: string } = {}) {
  const canvas = await renderDesign(d, assets, PRINT_DPI / 25.4, true);
  const png = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([mmToPt(FULL_W), mmToPt(FULL_H)]);
  const img = await pdf.embedPng(await png.arrayBuffer());
  page.drawImage(img, { x: 0, y: 0, width: mmToPt(FULL_W), height: mmToPt(FULL_H) });
  page.setMediaBox(0, 0, mmToPt(FULL_W), mmToPt(FULL_H));
  page.setBleedBox(0, 0, mmToPt(FULL_W), mmToPt(FULL_H));
  page.setTrimBox(mmToPt(BLEED), mmToPt(BLEED), mmToPt(NET_W), mmToPt(NET_H));
  pdf.setTitle(meta.title ?? 'Papierek krówki');
  pdf.setSubject(`Format netto ${NET_W}x${NET_H} mm, spad ${BLEED} mm${meta.orderId ? `, zamówienie ${meta.orderId}` : ''}`);
  pdf.setCreator('Projektant opakowań krówek');
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
