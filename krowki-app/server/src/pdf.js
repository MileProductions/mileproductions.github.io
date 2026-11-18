// Kontrola pliku z konfiguratora i konwersja do CMYK (Ghostscript + profil ICC, domyślnie FOGRA39).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';

const run = promisify(execFile);
const PT_PER_MM = 72 / 25.4;
/** wymiary z siatki (SIATKA SPECYFIKACJA 2016): netto 70 × 73 mm, spad 3 mm */
export const SPEC = { netW: 70, netH: 73, bleed: 3 };
const TOL_MM = 0.6;

const toMm = (b) => b && { x: +(b.x / PT_PER_MM).toFixed(2), y: +(b.y / PT_PER_MM).toFixed(2), w: +(b.width / PT_PER_MM).toFixed(2), h: +(b.height / PT_PER_MM).toFixed(2) };

/** Odczyt rozmiaru, ramek i przestrzeni barw obrazów strony 1. */
export async function inspectPdf(buf) {
  const doc = await PDFDocument.load(buf, { updateMetadata: false });
  const pages = doc.getPages();
  const page = pages[0];
  const media = page.getMediaBox();
  const trim = page.node.get(PDFName.of('TrimBox')) ? page.getTrimBox() : null;
  const bleed = page.node.get(PDFName.of('BleedBox')) ? page.getBleedBox() : null;
  const colorSpaces = new Set();
  const res = page.node.Resources();
  const xo = res?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  if (xo) {
    for (const [, ref] of xo.entries()) {
      const obj = doc.context.lookup(ref);
      const dict = obj?.dict ?? obj;
      if (!(dict instanceof PDFDict)) continue;
      let cs = dict.get(PDFName.of('ColorSpace'));
      if (cs instanceof PDFRef) cs = doc.context.lookup(cs);
      if (cs instanceof PDFName) colorSpaces.add(cs.decodeText());
      else if (cs instanceof PDFArray) {
        const kind = cs.get(0)?.decodeText?.() ?? '?';
        if (kind === 'ICCBased') {
          const icc = doc.context.lookup(cs.get(1));
          const n = icc?.dict?.get(PDFName.of('N'))?.asNumber?.();
          colorSpaces.add(`ICCBased(${n === 4 ? 'CMYK' : n === 3 ? 'RGB' : n === 1 ? 'Gray' : n})`);
        } else colorSpaces.add(kind);
      }
    }
  }
  const intents = doc.catalog.lookupMaybe(PDFName.of('OutputIntents'), PDFArray);
  return {
    pages: pages.length,
    media: toMm(media), trim: toMm(trim), bleed: toMm(bleed),
    imageColorSpaces: [...colorSpaces],
    outputIntent: !!intents && intents.size() > 0,
  };
}

/** Sprawdza, czy PDF z konfiguratora ma format siatki. Zwraca listę problemów (pusta = OK). */
export function checkPrintPdf(info) {
  const p = [];
  const W = SPEC.netW + 2 * SPEC.bleed, H = SPEC.netH + 2 * SPEC.bleed;
  if (info.pages !== 1) p.push(`PDF ma ${info.pages} stron, oczekiwano 1`);
  if (Math.abs(info.media.w - W) > TOL_MM || Math.abs(info.media.h - H) > TOL_MM) p.push(`Strona ${info.media.w} × ${info.media.h} mm, oczekiwano ${W} × ${H} mm (ze spadem)`);
  if (!info.trim) p.push('Brak TrimBox (format netto)');
  else if (Math.abs(info.trim.w - SPEC.netW) > TOL_MM || Math.abs(info.trim.h - SPEC.netH) > TOL_MM) p.push(`TrimBox ${info.trim.w} × ${info.trim.h} mm, oczekiwano ${SPEC.netW} × ${SPEC.netH} mm`);
  return p;
}

export async function ghostscriptVersion(gs = 'gs') {
  try { return (await run(gs, ['--version'], { timeout: 5000 })).stdout.trim(); } catch { return null; }
}

const psString = (s) => '(' + String(s).replace(/[\\()]/g, (c) => '\\' + c) + ')';

/**
 * RGB → CMYK. Wynik: PDF/X-3 z OutputIntent wskazującym profil (drukarnia widzi, pod jaki druk
 * przygotowano plik). Obrazy bez ponownej kompresji JPEG (Flate, bez strat) i bez zmiany rozdzielczości.
 * Ramki TrimBox/BleedBox są zachowane.
 */
export async function convertToCmyk(inBuf, cfg) {
  if (!fs.existsSync(cfg.iccProfile)) throw new Error(`Brak profilu ICC: ${cfg.iccProfile}`);
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'krowki-gs-'));
  try {
    const input = path.join(dir, 'in.pdf');
    const output = path.join(dir, 'out.pdf');
    const def = path.join(dir, 'pdfx_def.ps');
    await fs.promises.writeFile(input, inBuf);
    await fs.promises.writeFile(def, `%!
/ICCProfile ${psString(cfg.iccProfile)} def
[/_objdef {icc_PDFX} /type /stream /OBJ pdfmark
[{icc_PDFX} <</N 4>> /PUT pdfmark
[{icc_PDFX} ICCProfile (r) file /PUT pdfmark
[/_objdef {OutputIntent_PDFX} /type /dict /OBJ pdfmark
[{OutputIntent_PDFX} <<
  /Type /OutputIntent /S /GTS_PDFX
  /OutputCondition ${psString(cfg.iccName)}
  /OutputConditionIdentifier ${psString(cfg.iccName)}
  /RegistryName (http://www.color.org)
  /DestOutputProfile {icc_PDFX}
>> /PUT pdfmark
[{Catalog} <</OutputIntents [ {OutputIntent_PDFX} ]>> /PUT pdfmark
`);
    const args = [
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET', '-dNOOUTERSAVE',
      `--permit-file-read=${cfg.iccProfile}`,
      '-sDEVICE=pdfwrite', '-dPDFX', '-dCompatibilityLevel=1.4',
      '-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK',
      `-sOutputICCProfile=${cfg.iccProfile}`, `-dRenderIntent=${cfg.renderIntent}`,
      '-dAutoFilterColorImages=false', '-sColorImageFilter=FlateEncode',
      '-dDownsampleColorImages=false', '-dDownsampleGrayImages=false', '-dDownsampleMonoImages=false',
      '-dEmbedAllFonts=true', '-dSubsetFonts=true',
      `-sOutputFile=${output}`, def, input,
    ];
    await run(cfg.gsPath, args, { timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
    return await fs.promises.readFile(output);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}
