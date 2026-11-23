/**
 * Zdarzenia analityczne konfiguratora (Google Tag Manager / GA4).
 *
 * Zdarzenie trafia do dataLayer strony, na której działa GTM:
 * - konfigurator otwarty samodzielnie (/krówki/): własny window.dataLayer,
 * - w ramce na tej samej domenie (sklep): dataLayer strony-rodzica, bo w ramce GTM się nie ładuje,
 * - w ramce na innej domenie: postMessage {type:'krowki:analytics', event, params} do rodzica.
 * Zgody (Consent Mode) obsługuje GTM, tu niczego nie zapisujemy.
 */
type Params = Record<string, string | number | boolean | undefined>;
type DL = { push: (x: unknown) => void };

function targetLayer(): DL | null {
  if (window.self === window.top) {
    const w = window as unknown as { dataLayer?: DL[] & DL };
    return (w.dataLayer = w.dataLayer || ([] as unknown as DL[] & DL));
  }
  try {
    const p = window.parent as unknown as { dataLayer?: DL };
    if (p.dataLayer) return p.dataLayer;
  } catch { /* inna domena */ }
  return null;
}

export function track(event: string, params: Params = {}) {
  try {
    const dl = targetLayer();
    if (dl) dl.push({ event, ...params });
    else window.parent.postMessage({ type: 'krowki:analytics', event, params }, '*');
  } catch { /* analityka nigdy nie psuje konfiguratora */ }
}

const STEP_NAMES: Record<number, string> = { 1: 'start', 2: 'dopasuj', 3: 'zamow' };
export const stepName = (n: number) => STEP_NAMES[n] ?? String(n);
