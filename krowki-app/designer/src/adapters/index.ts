// Adaptery: logowanie i zamówienie są wymienne, żeby moduł mógł działać samodzielnie
// (teraz) i wewnątrz sklepu (docelowo) bez zmian w edytorze.

export interface User { id: string; name: string; email: string }

export interface AuthProvider {
  getUser(): Promise<User | null>;
  loginUrl?: string;
  /** dostęp po zapisie do newslettera (kod z maila) – gdy jest, zamiast „Zaloguj się” pokazujemy formularz e-mail */
  newsletter?: NewsletterGate;
  logout?(): Promise<void>;
}

export interface NewsletterGate {
  config(): Promise<{ consentText: string; privacyUrl: string | null }>;
  /** wysyła kod i link na e-mail; consent = zgoda na newsletter (wymagana przy pierwszym zapisie) */
  request(email: string, consent: boolean): Promise<{ demoCode?: string }>;
  verify(email: string, code: string): Promise<User>;
}

export interface OrderPayload {
  designJson: string;
  /** oryginały zdjęć użytych w projekcie – zostają przy zamówieniu na wypadek reklamacji lub ponownego druku */
  assets?: { id: string; name: string; blob: Blob }[];
  pdf: Blob;
  preview: Blob;
  kg: number;
  pcs: number;
  total: number;
  customer: { name: string; email: string; phone: string; notes: string };
}

export interface OrderProvider {
  /** tekst przycisku, np. „Złóż zamówienie” albo „Dodaj do koszyka” */
  label: string;
  submit(o: OrderPayload): Promise<OrderResult>;
}

export interface OrderResult {
  orderId: string;
  message: string;
  /** strona produktu w sklepie, gdzie klient zamawia z numerem projektu */
  shopUrl?: string | null;
}

/** Tryb samodzielny: testowy klient, bez prawdziwego logowania. */
export const mockAuth: AuthProvider = {
  async getUser() { return { id: 'demo', name: 'Klient testowy', email: 'klient@example.com' }; },
};

/** Tryb sklepu: tożsamość z tokenu podanego przez sklep (podpis weryfikuje backend). */
export function tokenAuth(token: string | null, loginUrl?: string): AuthProvider {
  return {
    loginUrl,
    async getUser() {
      if (!token) return null;
      try {
        const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (p.exp && p.exp * 1000 < Date.now()) return null;
        return { id: String(p.sub ?? p.id), name: p.name ?? '', email: p.email ?? '' };
      } catch { return null; }
    },
  };
}

/** Bez backendu: zamówienie zapisane lokalnie (do demonstracji). */
export const mockOrders: OrderProvider = {
  label: 'Złóż zamówienie',
  async submit(o) {
    const orderId = 'KR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const list = JSON.parse(localStorage.getItem('krowka-designer:orders') ?? '[]');
    list.push({ orderId, kg: o.kg, pcs: o.pcs, total: o.total, customer: o.customer, at: new Date().toISOString() });
    localStorage.setItem('krowka-designer:orders', JSON.stringify(list));
    return { orderId, message: 'Zamówienie zapisane (tryb demonstracyjny, bez wysyłki do sklepu).' };
  },
};

/** Z backendem: POST multipart na {apiUrl}/designs (projekt, PDF, podgląd, oryginały zdjęć) z tokenem klienta. */
export function httpOrders(apiUrl: string, token: string | null | (() => string | null)): OrderProvider {
  const getToken = typeof token === 'function' ? token : () => token;
  return {
    label: 'Zapisz projekt do druku',
    async submit(o) {
      const f = new FormData();
      f.set('design', o.designJson);
      f.set('pdf', o.pdf, 'papierek.pdf');
      f.set('preview', o.preview, 'podglad.png');
      for (const a of o.assets ?? []) f.append('asset', a.blob, `${a.id}__${a.name}`);
      f.set('kg', String(o.kg));
      f.set('pcs', String(o.pcs));
      f.set('total', String(o.total));
      f.set('customer', JSON.stringify(o.customer));
      const t = getToken();
      const r = await fetch(`${apiUrl.replace(/\/$/, '')}/designs`, {
        method: 'POST', body: f, headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Serwer odrzucił projekt (${r.status})`);
      return { orderId: j.orderId, message: j.message ?? 'Projekt przyjęty.', shopUrl: j.shopUrl };
    },
  };
}

const SESSION_KEY = 'krowka-designer:session';

/** Token sesji z linku w mailu (#kd-session=…) – zapisujemy i czyścimy adres. */
function takeSessionFromUrl() {
  if (typeof location === 'undefined') return;
  const m = /[#&]kd-session=([\w-]+)/.exec(location.hash);
  if (!m) return;
  try { localStorage.setItem(SESSION_KEY, m[1]); } catch { /* prywatny tryb */ }
  history.replaceState(null, '', location.pathname + location.search);
}

/**
 * Wariant C: dostęp dla każdego, kto zapisze się do newslettera i potwierdzi adres
 * kodem albo linkiem z maila. Sesja (token) trzymana w localStorage.
 */
export function newsletterAuth(apiUrl: string): AuthProvider & { token(): string | null } {
  const base = apiUrl.replace(/\/$/, '');
  takeSessionFromUrl();
  const token = () => { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } };
  const call = async (path: string, body?: unknown) => {
    const t = token();
    const r = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error ?? `Błąd serwera (${r.status})`), { status: r.status });
    return j;
  };
  const asUser = (email: string): User => ({ id: email, name: '', email });
  return {
    token,
    async getUser() {
      if (!token()) return null;
      try { return asUser((await call('/me')).email); } catch (e) {
        if ((e as { status?: number }).status === 401) localStorage.removeItem(SESSION_KEY);
        return null;
      }
    },
    async logout() {
      await call('/auth/logout', {}).catch(() => undefined);
      localStorage.removeItem(SESSION_KEY);
    },
    newsletter: {
      config: () => call('/config'),
      async request(email, consent) { const j = await call('/auth/request', { email, consent }); return { demoCode: j.demoCode }; },
      async verify(email, code) {
        const j = await call('/auth/verify', { email, code });
        localStorage.setItem(SESSION_KEY, j.token);
        return asUser(j.email);
      },
    },
  };
}

/** Koszyk sklepu: moduł wysyła zdarzenie cart:add, a sklep dodaje produkt do koszyka. */
export function hostCartOrders(emit: (name: string, detail: unknown) => void): OrderProvider {
  return {
    label: 'Dodaj do koszyka',
    async submit(o) {
      const orderId = 'P-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      emit('cart:add', { designId: orderId, kg: o.kg, pcs: o.pcs, total: o.total, pdf: o.pdf, preview: o.preview, design: o.designJson });
      return { orderId, message: 'Projekt dodany do koszyka.' };
    },
  };
}
