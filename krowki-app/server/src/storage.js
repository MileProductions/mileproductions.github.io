// Pliki projektów na dysku: DATA_DIR/files/<id projektu>/... (w Dockerze to wolumen).
// Interfejs jest celowo mały, żeby dało się go później podmienić na S3.
import fs from 'node:fs';
import path from 'node:path';

export function createStorage(dataDir) {
  const base = path.join(dataDir, 'files');
  fs.mkdirSync(base, { recursive: true });
  const abs = (rel) => {
    const p = path.resolve(base, rel);
    if (!p.startsWith(base + path.sep)) throw new Error('Nieprawidłowa ścieżka pliku');
    return p;
  };
  return {
    abs,
    async write(rel, buf) {
      const p = abs(rel);
      await fs.promises.mkdir(path.dirname(p), { recursive: true });
      await fs.promises.writeFile(p, buf);
      return buf.length;
    },
    read: (rel) => fs.promises.readFile(abs(rel)),
    stream: (rel) => fs.createReadStream(abs(rel)),
    exists: (rel) => fs.existsSync(abs(rel)),
    async removeDir(rel) { await fs.promises.rm(abs(rel), { recursive: true, force: true }); },
  };
}

/** Bezpieczna nazwa pliku do zapisu i do nagłówka Content-Disposition. */
export function safeName(name, fallback = 'plik') {
  const n = String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return n || fallback;
}
