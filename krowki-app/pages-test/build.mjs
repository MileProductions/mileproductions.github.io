// Buduje wersję testową na GitHub Pages do folderu /krowki-test/ w katalogu głównym repozytorium.
// Użycie (z krowki-app/): node pages-test/build.mjs   (najpierw: cd designer && npm ci)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const out = path.resolve(app, '..', 'krowki-test');
execSync('npm run build', { cwd: path.join(app, 'designer'), stdio: 'inherit' });

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(app, 'designer', 'dist', 'app'), out, { recursive: true });
fs.cpSync(path.join(app, 'server', 'panel'), path.join(out, 'panel'), { recursive: true });
for (const f of ['sw.js', 'boot.js']) fs.copyFileSync(path.join(here, f), path.join(out, f));

const loader = (src) => `<script type="module">import { ready } from '${src.startsWith('../') ? '../' : './'}boot.js'; await ready(); import('${src}');</script>`;
const banner = (html) => `<style>body{padding-bottom:36px}</style><div style="position:fixed;bottom:0;left:0;right:0;z-index:99;background:#3b2414;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:6px 12px;text-align:center">🧪 Wersja testowa: dane zostają tylko w tej przeglądarce, maile nie wychodzą, PDF w CMYK powstaje tylko na serwerze. ${html}</div>`;

// konfigurator
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const m = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
if (!m) throw new Error('Nie znaleziono skryptu aplikacji w index.html');
html = html.replace(m[0], '')
  .replace('<head>', '<head>\n    <meta name="krowka-api" content="./api" />\n    <meta name="robots" content="noindex" />')
  .replace('</body>', `${banner('<a href="./panel/" style="color:#ffd9a8">Panel produkcji →</a>')}\n    ${loader(m[1])}\n  </body>`);
fs.writeFileSync(path.join(out, 'index.html'), html);

// panel
const pIndex = path.join(out, 'panel', 'index.html');
let p = fs.readFileSync(pIndex, 'utf8');
p = p.replace('<script src="panel.js" type="module"></script>', loader('./panel.js').replace("'./boot.js'", "'../boot.js'"))
  .replace('<a href="#/newsletter">Newsletter</a>', '<a href="#/newsletter">Newsletter</a>\n      <a href="#/maile">Maile (test)</a>')
  .replace('</body>', `${banner('Logowanie: <b>produkcja@test.pl</b> / <b>krowki-test</b> · <a href="../" style="color:#ffd9a8">← Konfigurator</a>')}\n</body>`);
fs.writeFileSync(pIndex, p);
console.log('Gotowe:', out);
