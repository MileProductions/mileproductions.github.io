import { createRoot } from 'react-dom/client';
import App from './App';
import { httpOrders, mockAuth, mockOrders, newsletterAuth } from './adapters';
import { HostContext, type HostConfig } from './host';
import { loadFonts } from './fonts';
import 'react-easy-crop/react-easy-crop.css';
import './styles.css';

// Strona samodzielna. Adres backendu: <meta name="krowka-api"> (wstawia go backend, który serwuje
// konfigurator) albo ?api=https://…/api. Z backendem: dostęp po zapisie do newslettera i wysyłka
// projektów do druku. Bez backendu: tryb pokazowy (testowy klient, zapis tylko w przeglądarce).
loadFonts();
const api = new URLSearchParams(location.search).get('api') ?? document.querySelector<HTMLMetaElement>('meta[name="krowka-api"]')?.content ?? null;
const auth = api ? newsletterAuth(api) : null;
const host: HostConfig = {
  auth: auth ?? mockAuth,
  orders: auth ? httpOrders(api!, auth.token) : mockOrders,
  emit: (name, detail) => window.dispatchEvent(new CustomEvent('krowka:' + name, { detail })),
  showCustomerForm: true,
};

createRoot(document.getElementById('root')!).render(
  <HostContext.Provider value={host}>
    <App />
  </HostContext.Provider>,
);
