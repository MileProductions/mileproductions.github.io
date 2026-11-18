// Konfiguracja ze zmiennych środowiskowych. Opis każdej zmiennej: .env.example
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = (k, d) => (process.env[k] ?? '').trim() || d;
const list = (k) => env(k, '').split(',').map((s) => s.trim()).filter(Boolean);
const num = (k, d) => (process.env[k] ? Number(process.env[k]) : d);

export function loadConfig(over = {}) {
  const publicUrl = env('PUBLIC_URL', 'http://localhost:8080').replace(/\/$/, '');
  const c = {
    port: num('PORT', 8080),
    publicUrl,
    /** adres konfiguratora (link z maila wraca tutaj); domyślnie konfigurator serwowany przez ten backend */
    designerUrl: env('DESIGNER_URL', publicUrl + '/'),
    dataDir: path.resolve(env('DATA_DIR', path.join(root, 'data'))),
    designerDist: path.resolve(env('DESIGNER_DIST', path.join(root, '..', 'designer', 'dist'))),
    allowedOrigins: list('ALLOWED_ORIGINS'),
    cookieSecure: env('COOKIE_SECURE', publicUrl.startsWith('https:') ? '1' : '0') === '1',
    sessionDays: num('SESSION_DAYS', 90),
    adminSessionHours: num('ADMIN_SESSION_HOURS', 12),
    // poczta
    smtpUrl: env('SMTP_URL', ''),
    mailFrom: env('MAIL_FROM', 'Krówki – projekty <projekty@localhost>'),
    notifyEmail: list('NOTIFY_EMAIL'),
    brand: env('BRAND_NAME', 'Krówki z własnym projektem'),
    // newsletter
    newsletterWebhook: env('NEWSLETTER_WEBHOOK_URL', ''),
    consentText: env('CONSENT_TEXT', 'Zapisuję się do newslettera i chcę otrzymywać informacje o ofercie i promocjach. Wiem, że mogę się wypisać w każdej chwili.'),
    privacyUrl: env('PRIVACY_URL', ''),
    // sklep
    shopProductUrl: env('SHOP_PRODUCT_URL', ''),
    // druk
    gsPath: env('GS_PATH', 'gs'),
    iccProfile: env('ICC_PROFILE', '/usr/share/color/icc/colord/FOGRA39L_coated.icc'),
    iccName: env('ICC_NAME', 'FOGRA39 (ISO 12647-2:2004, Coated)'),
    renderIntent: num('RENDER_INTENT', 0),
    // limity
    maxFileMb: num('MAX_FILE_MB', 30),
    maxAssets: num('MAX_ASSETS', 12),
    retentionDays: num('RETENTION_DAYS', 365),
    ...over,
  };
  return c;
}
