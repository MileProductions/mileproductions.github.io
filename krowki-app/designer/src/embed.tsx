import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import { hostCartOrders, httpOrders, mockAuth, newsletterAuth, tokenAuth, type AuthProvider } from './adapters';
import { HostContext, type HostConfig } from './host';
import { loadFonts } from './fonts';
import cropCss from 'react-easy-crop/react-easy-crop.css?inline';
import css from './styles.css?inline';

/**
 * <krowka-designer> – moduł do osadzenia na stronie sklepu.
 *
 * Atrybuty:
 *  api-url      – backend konfiguratora (np. https://projektuj.krowki24.pl/api). Bez atrybutu token: dostęp po zapisie
 *                 do newslettera (kod z maila), projekt zapisuje się do druku przez POST {api-url}/designs
 *  token        – (później) podpisany token zalogowanego klienta wydany przez sklep; brak tokenu i api-url = prośba o zalogowanie
 *  login-url    – adres logowania w sklepie
 *  bez api-url  – projekt idzie do koszyka sklepu (zdarzenie cart:add)
 *  demo         – tryb pokazowy z testowym klientem (bez tokenu)
 *  primary-color, font-family – dopasowanie do wyglądu sklepu
 *
 * Zdarzenia (CustomEvent na elemencie, bubbles + composed):
 *  krowka:design:saved, krowka:design:approved, krowka:cart:add, krowka:price:changed, krowka:auth:required
 * W iframe te same zdarzenia idą do rodzica przez postMessage({ source: 'krowka-designer', name, detail }).
 */
class KrowkaDesigner extends HTMLElement {
  static observedAttributes = ['token', 'api-url', 'login-url', 'demo', 'primary-color', 'font-family'];
  private root?: Root;
  private mount?: HTMLDivElement;
  private gate?: { api: string; auth: ReturnType<typeof newsletterAuth> };

  connectedCallback() {
    loadFonts();
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    if (!this.mount) {
      const style = document.createElement('style');
      style.textContent = cropCss + '\n' + css.replace(/:root/g, ':host');
      this.mount = document.createElement('div');
      this.mount.className = 'kd-host';
      shadow.append(style, this.mount);
      this.root = createRoot(this.mount);
    }
    this.render();
  }

  attributeChangedCallback() { if (this.root) this.render(); }
  disconnectedCallback() { this.root?.unmount(); this.root = undefined; this.mount = undefined; }

  private emit = (name: string, detail?: unknown) => {
    this.dispatchEvent(new CustomEvent('krowka:' + name, { detail, bubbles: true, composed: true }));
    if (window.parent !== window) {
      const safe = detail && typeof detail === 'object' ? Object.fromEntries(Object.entries(detail).filter(([, v]) => !(v instanceof Blob))) : detail;
      window.parent.postMessage({ source: 'krowka-designer', name, detail: safe }, '*');
    }
  };

  private render() {
    const token = this.getAttribute('token');
    const api = this.getAttribute('api-url');
    const color = this.getAttribute('primary-color');
    const font = this.getAttribute('font-family');
    if (color) this.style.setProperty('--kd-primary', color);
    if (font) this.style.setProperty('--kd-font', font);
    let auth: AuthProvider;
    let getToken: () => string | null = () => token;
    if (this.hasAttribute('demo')) auth = mockAuth;
    else if (api && !token) {
      if (this.gate?.api !== api) this.gate = { api, auth: newsletterAuth(api) };
      auth = this.gate.auth;
      getToken = this.gate.auth.token;
    } else auth = tokenAuth(token, this.getAttribute('login-url') ?? undefined);
    const host: HostConfig = {
      auth,
      orders: api ? httpOrders(api, getToken) : hostCartOrders(this.emit),
      emit: this.emit,
      portalRoot: this.mount,
      showCustomerForm: false,
    };
    this.root!.render(
      <HostContext.Provider value={host}>
        <App />
      </HostContext.Provider>,
    );
  }
}

if (!customElements.get('krowka-designer')) customElements.define('krowka-designer', KrowkaDesigner);
