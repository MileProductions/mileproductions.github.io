// Zamiana plików, których przeglądarka nie otworzy jako zwykły obraz:
// HEIC/HEIF (zdjęcia z iPhone'a) i PDF (pierwsza strona, np. logo od grafika).
// Biblioteki ładują się dopiero, gdy klient wgra taki plik.

export const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Czy przeglądarka sama dekoduje obraz (Safari zwykle dekoduje HEIC). */
async function nativeDecodes(blob: Blob): Promise<boolean> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<boolean>((res) => {
      const i = new Image();
      i.onload = () => res(i.naturalWidth > 0);
      i.onerror = () => res(false);
      i.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export async function heicToJpeg(file: File): Promise<Blob> {
  if (await nativeDecodes(file)) return file;
  // nowy libheif – obsługuje zdjęcia z aktualnych iPhone'ów (siatka kafli, 10 bit)
  const { heicTo } = await import('heic-to');
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.95 });
}

/** Maksymalny bok renderu strony PDF (px) – wystarcza na ponad 600 DPI na całym papierku. */
export const PDF_MAX_SIDE = 4000;

export async function pdfFirstPage(file: File): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = PDF_MAX_SIDE / Math.max(base.width, base.height);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    // przezroczyste tło – logo z PDF zwykle ma być bez białego prostokąta
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp, background: 'rgba(0,0,0,0)' }).promise;
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('pdf'))), 'image/png'));
  } finally {
    doc.destroy();
  }
}

/** Zwraca obraz gotowy do edytora albo zgłasza błąd z polskim komunikatem. */
export async function toEditableImage(file: File): Promise<{ blob: Blob; name: string }> {
  const name = file.name.replace(/\.(heic|heif|pdf)$/i, '') || 'obraz';
  if (isPdf(file)) {
    try { return { blob: await pdfFirstPage(file), name: name + '.png' }; } catch (e) {
      console.warn(e);
      throw new Error(`Nie udało się otworzyć PDF „${file.name}”. Sprawdź, czy plik nie jest zabezpieczony hasłem.`);
    }
  }
  if (isHeic(file)) {
    try { return { blob: await heicToJpeg(file), name: name + '.jpg' }; } catch (e) {
      console.warn(e);
      throw new Error(`Nie udało się otworzyć zdjęcia „${file.name}”. W iPhonie wybierz „Najbardziej zgodne” w Ustawienia → Aparat → Formaty.`);
    }
  }
  return { blob: file, name: file.name };
}
