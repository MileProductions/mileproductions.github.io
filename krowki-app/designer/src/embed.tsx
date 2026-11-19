import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import { guestAuth, hostCartOrders, httpOrders, mockAuth, tokenAuth, type AuthProvider } from './adapters';
import { HostContext, type HostConfig } from './host';
import { loadFonts } from './fonts';
import cropCss from 'react-easy-crop/react-easy-crop.css?inline';
import css from './styles.css?inline';

/**
 * <krowka-designer> – moduł do osadzenia na stronie sklepu.
 *
 * Atrybuty:
 *  api-url      – backend konfiguratora (np. https://projektuj.krowki24.pl/api): projekt zapisuje się do druku
 *                 przez POST {api-url}/designs, klient podaje e-mail i może zapisać się do newslettera
 *  token        – (opcjonalnie) podpisany token klienta wydany przez sklep
 *  login-url    – (opcjonalnie) wymaga logowania w sklepie; bez tego konfigurator jest dostępny dla wszystkich
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
    // konfigurator dla wszystkich; token (konto sklepu) tylko gdy sklep go poda albo wymaga logowania (login-url)
    const auth: AuthProvider = this.hasAttribute('demo') ? mockAuth
      : token || this.hasAttribute('login-url') ? tokenAuth(token, this.getAttribute('login-url') ?? undefined) : guestAuth;
    const host: HostConfig = {
      auth,
      orders: api ? httpOrders(api, token) : hostCartOrders(this.emit),
      emit: this.emit,
      portalRoot: this.mount,
      showCustomerForm: !!api,
    };
    this.root!.render(
      <HostContext.Provider value={host}>
        <App />
      </HostContext.Provider>,
    );
  }
}

if (!customElements.get('krowka-designer')) customElements.define('krowka-designer', KrowkaDesigner);
