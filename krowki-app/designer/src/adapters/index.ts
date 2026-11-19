// Adaptery: logowanie i zamówienie są wymienne, żeby moduł mógł działać samodzielnie
// (teraz) i wewnątrz sklepu (docelowo) bez zmian w edytorze.

export interface User { id: string; name: string; email: string }

export interface AuthProvider {
  getUser(): Promise<User | null>;
  loginUrl?: string;
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
  /** newsletter = dobrowolny zapis (backend wysyła link potwierdzający) */
  customer: { name: string; email: string; phone: string; notes: string; newsletter?: boolean };
}

export interface OrderProvider {
  /** tekst przycisku, np. „Złóż zamówienie” albo „Dodaj do koszyka” */
  label: string;
  submit(o: OrderPayload): Promise<OrderResult>;
  /** gdy jest: przy zapisie projektu pokazujemy dobrowolną zgodę na newsletter */
  newsletter?: { config(): Promise<{ consentText: string; privacyUrl: string | null }> };
}

export interface OrderResult {
  orderId: string;
  message: string;
  /** strona produktu w sklepie, gdzie klient zamawia z numerem projektu */
  shopUrl?: string | null;
}

/** Konfigurator dla wszystkich: bez logowania. E-mail klient podaje dopiero przy zapisie projektu. */
export const guestAuth: AuthProvider = {
  async getUser() { return { id: 'gosc', name: '', email: '' }; },
};

/** Tryb pokazowy: testowy klient, bez prawdziwego logowania. */
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

/** Z backendem: POST multipart na {apiUrl}/designs (projekt, PDF, podgląd, oryginały zdjęć). Token jest opcjonalny. */
export function httpOrders(apiUrl: string, token: string | null | (() => string | null) = null): OrderProvider {
  const getToken = typeof token === 'function' ? token : () => token;
  const base = apiUrl.replace(/\/$/, '');
  let cfg: Promise<{ consentText: string; privacyUrl: string | null }> | undefined;
  return {
    label: 'Zapisz projekt do druku',
    newsletter: {
      config: () => (cfg ??= fetch(base + '/config').then((r) => r.json()).catch(() => ({ consentText: 'Chcę dostawać newsletter z nowościami i promocjami.', privacyUrl: null }))),
    },
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
      const r = await fetch(`${base}/designs`, {
        method: 'POST', body: f, headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Serwer odrzucił projekt (${r.status})`);
      return { orderId: j.orderId, message: j.message ?? 'Projekt przyjęty.', shopUrl: j.shopUrl };
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
