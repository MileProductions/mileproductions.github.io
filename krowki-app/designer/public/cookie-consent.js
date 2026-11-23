/*
 * Baner zgody na cookies + Google Consent Mode v2.
 *
 * Domyślne zgody ("denied") ustawia wcześniej skrypt w <head> każdej strony,
 * przed kontenerem Google Tag Manager. Ten plik tylko pokazuje baner, zapisuje
 * wybór w localStorage i wysyła do GTM aktualizację zgód (gtag 'consent' 'update').
 *
 * Ponowne otwarcie ustawień: dowolny element z atrybutem data-cookie-settings
 * albo window.krowkiCookies.open().
 *
 * Ten sam plik leży w stronakrowki/, krówki/ i krowki-app/designer/public/.
 */
(function () {
  "use strict";

  var KEY = "krowki_cookie_consent";
  var VERSION = 1;
  var POLICY_URL = window.KROWKI_COOKIE_POLICY_URL || "/stronakrowki/#polityka-cookies";

  // W ramce (konfigurator osadzony w sklepie) baner pokazuje strona nadrzędna.
  var inFrame = false;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "null");
      return c && c.v === VERSION ? c : null;
    } catch (e) { return null; }
  }

  function apply(c) {
    var a = c.analytics ? "granted" : "denied";
    var m = c.marketing ? "granted" : "denied";
    gtag("consent", "update", {
      analytics_storage: a,
      ad_storage: m,
      ad_user_data: m,
      ad_personalization: m
    });
    window.dataLayer.push({ event: "cookie_consent_update", consent_analytics: a, consent_marketing: m });
  }

  function save(analytics, marketing) {
    var c = { v: VERSION, analytics: !!analytics, marketing: !!marketing, ts: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    apply(c);
    close();
  }

  var CSS =
    ".kc-banner{position:fixed;z-index:2147483000;left:1rem;right:1rem;bottom:1rem;max-width:560px;margin:0 auto;" +
    "background:#fbf9f4;color:#160602;border:1px solid #e0d5c2;border-radius:18px;box-shadow:0 18px 40px -18px rgba(22,6,2,.45);" +
    "padding:1.25rem 1.25rem 1rem;font:15px/1.5 Inter,system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".kc-banner h2{margin:0 0 .4rem;font:600 1.35rem/1.2 'Cormorant Garamond',Georgia,serif}" +
    ".kc-banner p{margin:0 0 .9rem;color:#4a1f10}" +
    ".kc-banner a{color:#9a5626}" +
    ".kc-row{display:flex;flex-wrap:wrap;gap:.5rem}" +
    ".kc-btn{flex:1 1 auto;cursor:pointer;border-radius:999px;padding:.6rem 1.1rem;font-family:inherit;font-weight:600;font-size:14px;line-height:1.2;" +
    "border:1.5px solid #671e08;background:transparent;color:#671e08}" +
    ".kc-btn:focus-visible{outline:3px solid #d9a57c;outline-offset:2px}" +
    ".kc-btn.kc-primary{background:#671e08;color:#fff}" +
    ".kc-opts{margin:0 0 .9rem;padding:0;list-style:none;border-top:1px solid #e0d5c2}" +
    ".kc-opts li{padding:.6rem 0;border-bottom:1px solid #e0d5c2}" +
    ".kc-opts label{display:flex;gap:.6rem;align-items:flex-start;cursor:pointer}" +
    ".kc-opts input{margin-top:.25rem;accent-color:#671e08;width:1.05rem;height:1.05rem}" +
    ".kc-opts small{display:block;color:#6b5248;font-size:13px}" +
    "@media (max-width:480px){.kc-banner{left:.5rem;right:.5rem;bottom:.5rem}.kc-btn{flex-basis:100%}}";

  var el = null;

  function close() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  }

  function open(showSettings) {
    if (inFrame) return;
    close();
    if (!document.getElementById("kc-style")) {
      var st = document.createElement("style");
      st.id = "kc-style";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var cur = read() || { analytics: false, marketing: false };
    el = document.createElement("div");
    el.className = "kc-banner";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-labelledby", "kc-title");
    el.innerHTML =
      '<h2 id="kc-title">Pliki cookies</h2>' +
      "<p>Używamy plików cookies niezbędnych do działania strony. Za Twoją zgodą użyjemy też cookies analitycznych (Google Analytics), " +
      "żeby sprawdzać, jak korzystasz ze strony, oraz marketingowych, żeby dopasować reklamy. Zgodę możesz w każdej chwili zmienić. " +
      '<a href="' + POLICY_URL + '" data-modal="legal" data-title="Polityka cookies">Polityka cookies</a></p>' +
      '<ul class="kc-opts" hidden>' +
      '<li><label><input type="checkbox" checked disabled><span>Niezbędne<small>Potrzebne do działania strony i zapamiętania tego wyboru. Zawsze włączone.</small></span></label></li>' +
      '<li><label><input type="checkbox" data-kc="analytics"' + (cur.analytics ? " checked" : "") + '><span>Analityczne<small>Anonimowe statystyki odwiedzin (Google Analytics).</small></span></label></li>' +
      '<li><label><input type="checkbox" data-kc="marketing"' + (cur.marketing ? " checked" : "") + '><span>Marketingowe<small>Dopasowanie i pomiar reklam (np. Google Ads).</small></span></label></li>' +
      "</ul>" +
      '<div class="kc-row">' +
      '<button type="button" class="kc-btn" data-kc-act="reject">Odrzucam</button>' +
      '<button type="button" class="kc-btn" data-kc-act="settings">Ustawienia</button>' +
      '<button type="button" class="kc-btn kc-primary" data-kc-act="accept">Akceptuję wszystkie</button>' +
      "</div>";

    var opts = el.querySelector(".kc-opts");
    var settingsBtn = el.querySelector('[data-kc-act="settings"]');
    function showOpts() {
      opts.hidden = false;
      settingsBtn.textContent = "Zapisz wybór";
      settingsBtn.setAttribute("data-kc-act", "save");
    }
    if (showSettings) showOpts();

    el.addEventListener("click", function (e) {
      var act = e.target && e.target.getAttribute && e.target.getAttribute("data-kc-act");
      if (act === "accept") save(true, true);
      else if (act === "reject") save(false, false);
      else if (act === "settings") showOpts();
      else if (act === "save") {
        save(el.querySelector('[data-kc="analytics"]').checked, el.querySelector('[data-kc="marketing"]').checked);
      }
    });
    document.body.appendChild(el);
  }

  window.krowkiCookies = { open: function () { open(true); }, get: read };

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("[data-cookie-settings]");
    if (t) { e.preventDefault(); open(true); }
  });

  function init() { if (!read()) open(false); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
