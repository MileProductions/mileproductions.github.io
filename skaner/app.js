/* Skaner AI – wersja webowa (iPhone / iPad / każda przeglądarka). */
(function () {
  "use strict";
  const S = window.Silnik;
  const WERSJA = "web 1.3";
  const API = "https://generativelanguage.googleapis.com/v1beta";
  const LICZBA_WATKOW = 4;
  const MAKS_PROB = 4;
  const TIMEOUT_MS = 180000;
  const MAKS_BOK = 2500;
  const MAKS_BOK_PRO = 3600;
  const MINIATURA = 768;           // miniatura do sprawdzenia orientacji
  const ORIENT_OSZCZEDNIE = "Automatycznie – oszczędnie (zalecane)";
  const ORIENT_KAZDA = "Automatycznie – sprawdzaj każdą stronę";
  const ORIENT_BRAK = "Bez obracania";
  const ORIENT_STALE = { "Obróć wszystkie o 90° w prawo": 270, "Obróć wszystkie o 90° w lewo": 90, "Obróć wszystkie o 180°": 180 };
  const TRYBY_ORIENTACJI = [ORIENT_OSZCZEDNIE, ORIENT_KAZDA, ORIENT_BRAK].concat(Object.keys(ORIENT_STALE));
  const OPIS_OBROTU = { 0: "bez obrotu", 270: "90° w prawo", 90: "90° w lewo", 180: "180°" };
  const JAKOSC = 0.85;
  const K_KLUCZ = "skanerai.klucz";
  const K_UST = "skanerai.ustawienia";

  const $ = (id) => document.getElementById(id);
  const el = {
    kartaKlucz: $("karta-klucz"), poleKlucz: $("pole-klucz"), btnZapiszKlucz: $("btn-zapisz-klucz"),
    btnAparat: $("btn-aparat"), btnGaleria: $("btn-galeria"), inAparat: $("in-aparat"), inGaleria: $("in-galeria"),
    lista: $("lista-stron"), brak: $("brak-stron"), akcjeListy: $("akcje-listy"), licznik: $("licznik"),
    btnSortuj: $("btn-sortuj"), btnWyczysc: $("btn-wyczysc"),
    nazwa: $("pole-nazwa"), model: $("pole-model"), modelPro: $("pole-model-pro"), orientacja: $("pole-orientacja"),
    scal: $("op-scal"), laczenie: $("op-laczenie"), pro: $("op-pro"), redakcja: $("op-redakcja"), czytelna: $("op-czytelna"),
    numery: $("op-numery"), numeryAuto: $("op-numery-auto"), start: $("pole-start"), wierszStart: $("wiersz-start"),
    uwagi: $("op-uwagi"), czysty: $("op-czysty"),
    kartaPostep: $("karta-postep"), postep: $("postep"), status: $("status"), log: $("log"), szczegoly: $("szczegoly"),
    kartaWyniki: $("karta-wyniki"), listaWynikow: $("lista-wynikow"), podglad: $("podglad"),
    btnUdostepnijWszystko: $("btn-udostepnij-wszystko"),
    btnStart: $("btn-start"), btnStop: $("btn-stop"), btnZmienKlucz: $("btn-zmien-klucz"), btnUsunKlucz: $("btn-usun-klucz"),
    wersja: $("wersja"),
  };

  // ---------------- pamięć urządzenia (bezpieczna) ----------------
  const pamiec = {
    czytaj(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    zapisz(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    usun(k) { try { window.localStorage.removeItem(k); } catch (e) { /* nic */ } },
  };

  let klucz = pamiec.czytaj(K_KLUCZ) || "";
  let dostepneModele = S.STALE.MODELE_ZAPASOWE.slice();
  let strony = [];          // {id, plik: File, nazwa, url}
  let wynikPliki = [];      // {nazwa, tresc, typ}
  let praca = null;         // {kontroler}
  let blokadaEkranu = null;
  let licznikId = 0;

  // ---------------- ustawienia ----------------
  const PREFEROWANE = S.STALE.MODELE_PREFEROWANE || [S.STALE.MODEL_DOMYSLNY];
  const DOMYSLNE = { nazwa: "Notatki", model: PREFEROWANE[0], modelPro: S.MODEL_PRO_AUTO, orientacja: ORIENT_OSZCZEDNIE, scal: true, laczenie: true,
    pro: true, redakcja: true, czytelna: true, numery: false, numeryAuto: true, start: "1", uwagi: true, czysty: false };
  function wczytajUstawienia() {
    let u = {};
    try { u = JSON.parse(pamiec.czytaj(K_UST) || "{}") || {}; } catch (e) { u = {}; }
    return Object.assign({}, DOMYSLNE, u);
  }
  function zapiszUstawienia() {
    pamiec.zapisz(K_UST, JSON.stringify({
      nazwa: el.nazwa.value.trim() || "Notatki", model: el.model.value, modelPro: el.modelPro.value,
      scal: el.scal.checked, laczenie: el.laczenie.checked, pro: el.pro.checked, redakcja: el.redakcja.checked,
      czytelna: el.czytelna.checked, numery: el.numery.checked, numeryAuto: el.numeryAuto.checked,
      start: el.start.value, uwagi: el.uwagi.checked, czysty: el.czysty.checked, orientacja: el.orientacja.value,
    }));
  }
  const ust = wczytajUstawienia();
  el.nazwa.value = ust.nazwa; el.scal.checked = ust.scal; el.laczenie.checked = ust.laczenie; el.pro.checked = ust.pro;
  el.redakcja.checked = ust.redakcja; el.czytelna.checked = ust.czytelna; el.numery.checked = ust.numery;
  el.numeryAuto.checked = ust.numeryAuto; el.start.value = ust.start; el.uwagi.checked = ust.uwagi; el.czysty.checked = ust.czysty;
  (function () { const sel = el.orientacja; TRYBY_ORIENTACJI.forEach((t) => { const o = document.createElement("option"); o.value = t; o.textContent = t; sel.appendChild(o); });
    sel.value = TRYBY_ORIENTACJI.includes(ust.orientacja) ? ust.orientacja : ORIENT_OSZCZEDNIE; })();
  el.wersja.textContent = `Skaner AI ${WERSJA}`;

  function ustawOpcjeSelect(select, wartosci, wybrana) {
    select.textContent = "";
    for (const w of wartosci) {
      const o = document.createElement("option");
      o.value = w; o.textContent = w;
      select.appendChild(o);
    }
    select.value = wartosci.includes(wybrana) ? wybrana : wartosci[0];
  }
  function ustawModele(modele, wybrany, wybranyPro) {
    dostepneModele = modele.slice();
    const glowny = modele.includes(wybrany) ? wybrany
      : (PREFEROWANE.find((m) => modele.includes(m)) || (modele.includes(S.STALE.MODEL_DOMYSLNY) ? S.STALE.MODEL_DOMYSLNY : modele[0]));
    ustawOpcjeSelect(el.model, modele, glowny);
    ustawOpcjeSelect(el.modelPro, [S.MODEL_PRO_AUTO].concat(S.listaModeliPro(modele)), wybranyPro);
  }
  ustawModele(dostepneModele, ust.model, ust.modelPro);

  function przelaczOpcje() {
    const scal = el.scal.checked;
    el.numery.disabled = !scal;
    if (!scal) el.numery.checked = false;
    const numery = el.numery.checked;
    el.numeryAuto.disabled = !numery;
    el.start.disabled = !numery || el.numeryAuto.checked;
    el.wierszStart.style.opacity = el.start.disabled ? 0.5 : 1;
    el.modelPro.disabled = !el.pro.checked;
    if (el.czysty.checked) el.uwagi.checked = false;
    el.uwagi.disabled = el.czysty.checked;
  }
  [el.scal, el.numery, el.numeryAuto, el.pro, el.czysty].forEach((x) => x.addEventListener("change", przelaczOpcje));
  document.querySelectorAll("input, select").forEach((x) => x.addEventListener("change", zapiszUstawienia));
  przelaczOpcje();

  // ---------------- log i status ----------------
  function log(t) { el.log.textContent += t + "\n"; el.log.scrollTop = el.log.scrollHeight; }
  function status(t, klasa) { el.status.textContent = t; el.status.className = "status " + (klasa || ""); }

  // ---------------- klucz API ----------------
  function pokazKlucz(pokaz) {
    el.kartaKlucz.hidden = !pokaz;
    if (pokaz) { el.poleKlucz.value = ""; setTimeout(() => el.poleKlucz.focus(), 50); }
    sprawdzGotowosc();
  }
  el.btnZapiszKlucz.addEventListener("click", () => {
    const k = el.poleKlucz.value.trim();
    if (!k) return;
    klucz = k;
    if (!pamiec.zapisz(K_KLUCZ, k)) alert("Nie udało się zapisać klucza w pamięci przeglądarki (tryb prywatny?). Klucz będzie działał do zamknięcia strony.");
    pokazKlucz(false);
    zaladujModele();
  });
  el.btnZmienKlucz.addEventListener("click", () => pokazKlucz(true));
  el.btnUsunKlucz.addEventListener("click", () => {
    if (!confirm("Usunąć klucz API z tego telefonu?")) return;
    pamiec.usun(K_KLUCZ); klucz = ""; pokazKlucz(true);
  });

  // ---------------- Gemini REST ----------------
  function bladApi(kod, tresc) { const e = new Error(tresc); e.kod = kod; return e; }

  async function zapytanie(url, opcje, sygnal) {
    const kontroler = new AbortController();
    const przerwij = () => kontroler.abort();
    if (sygnal) { if (sygnal.aborted) throw bladApi("przerwano", "Przerwano"); sygnal.addEventListener("abort", przerwij, { once: true }); }
    const zegar = setTimeout(() => kontroler.abort(), TIMEOUT_MS);
    try {
      let r;
      try {
        r = await fetch(url, Object.assign({}, opcje, { signal: kontroler.signal }));
      } catch (e) {
        if (sygnal && sygnal.aborted) throw bladApi("przerwano", "Przerwano");
        throw bladApi("siec", e.message || "Błąd sieci");
      }
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        let msg = t;
        try { msg = JSON.parse(t).error.message || t; } catch (e) { /* tekst */ }
        throw bladApi(r.status, msg);
      }
      return await r.json();
    } finally {
      clearTimeout(zegar);
      if (sygnal) sygnal.removeEventListener("abort", przerwij);
    }
  }

  function czekaj(ms, sygnal) {
    return new Promise((res, rej) => {
      const t = setTimeout(res, ms);
      if (sygnal) sygnal.addEventListener("abort", () => { clearTimeout(t); rej(bladApi("przerwano", "Przerwano")); }, { once: true });
    });
  }

  async function zPonowieniem(fn, sygnal) {
    for (let proba = 1; proba <= MAKS_PROB; proba++) {
      try { return await fn(); } catch (e) {
        if (e.kod === "przerwano" || (sygnal && sygnal.aborted)) throw bladApi("przerwano", "Przerwano");
        if (!S.czyPonowic(e.kod, e.message) || proba === MAKS_PROB) throw e;
        const ms = Math.min(30, 2 ** proba) * 1000 + Math.random() * 1500;
        log(`↻ Ponawiam (${proba}/${MAKS_PROB - 1}) za ${(ms / 1000).toFixed(1)} s: ${S.opisBledu(e.kod, e.message)}`);
        await czekaj(ms, sygnal);
      }
    }
  }

  function generuj(model, cialo, sygnal) {
    return zapytanie(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": klucz }, body: JSON.stringify(cialo),
    }, sygnal);
  }

  async function zaladujModele() {
    if (!klucz) return;
    try {
      const odp = await zapytanie(`${API}/models?pageSize=1000`, { headers: { "x-goog-api-key": klucz } });
      const modele = S.filtrujModele(odp.models || []);
      if (modele.length) {
        const uu = wczytajUstawienia();
        ustawModele(modele, uu.model, uu.modelPro);
        if (uu.modelPro !== S.MODEL_PRO_AUTO && el.modelPro.value !== uu.modelPro) log(`⚠️ Model ${uu.modelPro} jest niedostępny – ustawiono wybór automatyczny.`);
      }
    } catch (e) {
      const opis = S.opisBledu(e.kod, e.message);
      if ([400, 401, 403].includes(e.kod)) { alert("Klucz API nie działa: " + opis); pokazKlucz(true); }
    }
  }

  // ---------------- zdjęcia ----------------
  function dodajPliki(lista) {
    for (const f of lista) {
      if (!f || !(f.type || "").startsWith("image/") && !/\.(jpe?g|png|heic|heif)$/i.test(f.name || "")) continue;
      strony.push({ id: ++licznikId, plik: f, nazwa: f.name || `zdjęcie ${licznikId}.jpg`, url: URL.createObjectURL(f) });
    }
    rysujListe();
  }
  el.btnAparat.addEventListener("click", () => el.inAparat.click());
  el.btnGaleria.addEventListener("click", () => el.inGaleria.click());
  el.inAparat.addEventListener("change", () => { dodajPliki(Array.from(el.inAparat.files || [])); el.inAparat.value = ""; });
  el.inGaleria.addEventListener("change", () => { dodajPliki(Array.from(el.inGaleria.files || [])); el.inGaleria.value = ""; });
  el.btnSortuj.addEventListener("click", () => { strony.sort((a, b) => S.porownajNaturalnie(a.nazwa, b.nazwa)); rysujListe(); });
  el.btnWyczysc.addEventListener("click", () => {
    if (!confirm("Usunąć wszystkie zdjęcia z listy?")) return;
    strony.forEach((s) => URL.revokeObjectURL(s.url)); strony = []; rysujListe();
  });

  function przycisk(tekst, etykieta, fn) {
    const b = document.createElement("button");
    b.textContent = tekst; b.setAttribute("aria-label", etykieta); b.title = etykieta;
    b.addEventListener("click", fn);
    return b;
  }
  function rysujListe() {
    el.lista.textContent = "";
    strony.forEach((s, i) => {
      const li = document.createElement("li");
      const nr = document.createElement("span"); nr.className = "nr"; nr.textContent = `${i + 1}.`;
      const img = document.createElement("img"); img.src = s.url; img.alt = ""; img.loading = "lazy";
      img.onerror = () => { const d = document.createElement("div"); d.className = "bez-podgladu"; img.replaceWith(d); };
      const opis = document.createElement("div"); opis.className = "opis";
      const n = document.createElement("span"); n.textContent = s.nazwa;
      const r = document.createElement("small"); r.textContent = `${(s.plik.size / 1048576).toFixed(1)} MB`;
      opis.append(n, r);
      const akcje = document.createElement("div"); akcje.className = "akcje";
      akcje.append(
        przycisk("↑", "Przesuń wyżej", () => { if (i > 0) { [strony[i - 1], strony[i]] = [strony[i], strony[i - 1]]; rysujListe(); } }),
        przycisk("↓", "Przesuń niżej", () => { if (i < strony.length - 1) { [strony[i + 1], strony[i]] = [strony[i], strony[i + 1]]; rysujListe(); } }),
        przycisk("✕", "Usuń", () => { URL.revokeObjectURL(s.url); strony.splice(i, 1); rysujListe(); }),
      );
      if (praca) akcje.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      li.append(nr, img, opis, akcje);
      el.lista.appendChild(li);
    });
    el.brak.hidden = strony.length > 0;
    el.akcjeListy.hidden = strony.length === 0;
    el.licznik.textContent = strony.length ? `(${strony.length})` : "";
    sprawdzGotowosc();
  }

  function wczytajObrazek(plik) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(plik);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("nie można otworzyć zdjęcia")); };
      img.src = url;
    });
  }

  /** Dekoduje zdjęcie (obrót wg EXIF robi przeglądarka) i od razu zmniejsza do MAKS_BOK_PRO,
   *  żeby przy kilku stronach naraz nie zabrakło pamięci na telefonie. Zwraca canvas. */
  async function wczytajZrodlo(plik) {
    let zrodlo;
    try { zrodlo = await createImageBitmap(plik, { imageOrientation: "from-image" }); }
    catch (e) {
      try { zrodlo = await wczytajObrazek(plik); }
      catch (e2) { throw bladApi("obraz", "Nie można odczytać zdjęcia. Jeśli to HEIC, ustaw w Ustawieniach → Aparat → Formaty: „Najbardziej zgodny”."); }
    }
    const w = zrodlo.width, h = zrodlo.height;
    const skala = Math.min(1, MAKS_BOK_PRO / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * skala)); c.height = Math.max(1, Math.round(h * skala));
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(zrodlo, 0, 0, c.width, c.height);
    if (zrodlo.close) zrodlo.close();
    return c;
  }

  /** Rysuje źródło zmniejszone do maksBok i obrócone o kąt (jak PIL: 270 = 90° w prawo, 90 = 90° w lewo). */
  function obroconyCanvas(zrodlo, maksBok, kat) {
    const skala = Math.min(1, maksBok / Math.max(zrodlo.width, zrodlo.height));
    const sw = Math.max(1, Math.round(zrodlo.width * skala)), sh = Math.max(1, Math.round(zrodlo.height * skala));
    const bok = kat === 90 || kat === 270;
    const c = document.createElement("canvas");
    c.width = bok ? sh : sw; c.height = bok ? sw : sh;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    if (kat === 270) { ctx.translate(c.width, 0); ctx.rotate(Math.PI / 2); }
    else if (kat === 90) { ctx.translate(0, c.height); ctx.rotate(-Math.PI / 2); }
    else if (kat === 180) { ctx.translate(c.width, c.height); ctx.rotate(Math.PI); }
    ctx.drawImage(zrodlo, 0, 0, sw, sh);
    return c;
  }

  async function jpegBase64(zrodlo, maksBok, kat = 0, jakosc = JAKOSC) {
    const canvas = obroconyCanvas(zrodlo, maksBok, kat);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", jakosc));
    canvas.width = canvas.height = 0;
    if (!blob) throw bladApi("obraz", "Nie udało się przygotować zdjęcia");
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    return String(dataUrl).split(",")[1];
  }

  /** Jasność pikseli miniatury ≤1000 px (jak ImageOps.grayscale w PIL) do analizy układu tekstu. */
  function szarosci(zrodlo) {
    const c = obroconyCanvas(zrodlo, 1000, 0);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const g = new Uint8Array(c.width * c.height);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 19595 + d[i + 1] * 38470 + d[i + 2] * 7471 + 0x8000) >> 16;
    const wynik = { szary: g, w: c.width, h: c.height };
    c.width = c.height = 0;
    return wynik;
  }

  // ---------------- orientacja strony ----------------
  let orient = null;   // stan dla bieżącej serii
  let wyczerpane = new Set();   // modele, które w tej serii wyczerpały limit dzienny
  let przerwijLimit = null;     // zatrzymanie serii, gdy limit wyczerpie główny model
  function oznaczNiedostepny(model, e) {
    if (wyczerpane.has(model)) return;
    wyczerpane.add(model);
    log(S.limitDzienny(e.kod, e.message) ? `⛔ ${model}: dzienny limit zapytań wyczerpany – do końca tej serii nie będzie używany.` : `⛔ ${model}: model niedostępny – do końca tej serii nie będzie używany.`);
  }

  async function zapytajOrientacje(zrodlo, kandydaci, sygnal) {
    const miniatury = [];
    for (const k of kandydaci) miniatury.push(await jpegBase64(zrodlo, MINIATURA, k, 0.75));
    const odp = await zPonowieniem(() => generuj(orient.model, S.zapytanieOrientacji(miniatury), sygnal), sygnal);
    let wybor = "";
    try { wybor = String(JSON.parse(S.tekstOdpowiedzi(odp) || "{}").prawidlowy || "").trim().toUpperCase(); } catch (e) { wybor = ""; }
    const idx = "ABCD".indexOf(wybor);
    if (idx < 0 || idx >= kandydaci.length) throw bladApi("orientacja", "niejasna odpowiedź modelu");
    const u = odp.usageMetadata || {};
    return [kandydaci[idx], (u.promptTokenCount || 0) + (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), u];
  }

  async function ustalObrot(zrodlo, nazwa, sygnal, zuzycie) {
    const tryb = orient.tryb;
    if (tryb in ORIENT_STALE) return ORIENT_STALE[tryb];
    if (tryb === ORIENT_BRAK) return 0;
    const { szary, w, h } = szarosci(zrodlo);
    const { uklad } = S.ukladTekstu(szary, w, h);
    let kandydaci;
    if (uklad === "poziomy") {
      if (tryb !== ORIENT_KAZDA) return 0;
      kandydaci = [0, 180];
    } else if (uklad === "pionowy") {
      kandydaci = [270, 90];
      if (tryb === ORIENT_OSZCZEDNIE) {
        const hist = orient.historia, nr = orient.licznikBok++;
        const seria = hist.length >= 3 && new Set(hist.slice(-3)).size === 1;
        if (seria && nr % 10 !== 0) { orient.zSerii++; return hist[hist.length - 1]; }   // co 10. stronę i tak sprawdzamy
      }
    } else {
      kandydaci = [0, 270, 90, 180];
    }
    try {
      const [kat, tokeny, u] = await zapytajOrientacje(zrodlo, kandydaci, sygnal);
      orient.pytania++; orient.tokeny += tokeny; zuzycie.push(u);
      if (uklad === "pionowy") orient.historia.push(kat);
      return kat;
    } catch (e) {
      if (e.kod === "przerwano") throw e;
      const zapas = uklad === "pionowy" && orient.historia.length ? orient.historia[orient.historia.length - 1] : 0;
      log(`⚠️ ${nazwa}: nie udało się sprawdzić orientacji (${S.opisBledu(e.kod, e.message)}) – przyjęto: ${OPIS_OBROTU[zapas]}.`);
      return zapas;
    }
  }

  // ---------------- przetwarzanie ----------------
  async function odczytaj(zrodlo, kat, model, czysty, maksBok, sygnal, zuzycie) {
    const b64 = await jpegBase64(zrodlo, maksBok, kat);
    const odp = await zPonowieniem(() => generuj(model, S.zapytanieStrony(b64, czysty), sygnal), sygnal);
    if (odp.usageMetadata) zuzycie.push(odp.usageMetadata);
    const tekst = S.tekstOdpowiedzi(odp);
    if (!tekst) return [null, S.powodBrakuTekstu(odp)];
    const strona = S.odczytajOdpowiedz(tekst);
    if (!strona.akapity.length) return [null, "Model nie odczytał żadnego tekstu"];
    return [strona, "OK"];
  }

  async function przetworzStrone(s, p, sygnal) {
    const zuzycie = [];
    let zrodlo;
    try { zrodlo = await wczytajZrodlo(s.plik); }
    catch (e) { return { status: e.message, zuzycie }; }
    try {
      let kat = 0;
      try { kat = await ustalObrot(zrodlo, s.nazwa, sygnal, zuzycie); }
      catch (e) { if (e.kod === "przerwano") return { status: "Przerwano", zuzycie }; kat = 0; }
      if (kat) { orient.obrocone++; log(`↻ ${s.nazwa}: obrócono ${OPIS_OBROTU[kat]}`); }
      let strona = null, stat;
      try { [strona, stat] = await odczytaj(zrodlo, kat, p.model, p.czysty, MAKS_BOK, sygnal, zuzycie); }
      catch (e) {
        if (e.kod === "przerwano") return { status: "Przerwano", zuzycie };
        if (S.modelNiedostepny(e.kod, e.message)) {
          const pierwszy = !wyczerpane.has(p.model);
          oznaczNiedostepny(p.model, e);
          if (pierwszy) log("⛔ Zatrzymuję odczyt: wybierz inny model główny i uruchom ponownie. Gotowe strony zostaną zapisane.");
          if (przerwijLimit) przerwijLimit();
          return { status: "Przerwano", zuzycie };
        }
        stat = e.kod === "obraz" ? e.message : S.opisBledu(e.kod, e.message);
      }
      if (!sygnal.aborted && (strona === null || S.czyStronaTrudna(strona))) {
        for (const mPro of p.modelePro) {
          if (sygnal.aborted) break;
          if (wyczerpane.has(mPro)) continue;
          log(`🔁 ${s.nazwa}: ${strona ? "trudna strona" : "błąd: " + stat} – ponowny odczyt modelem ${mPro}…`);
          try {
            const [sp, statPro] = await odczytaj(zrodlo, kat, mPro, p.czysty, MAKS_BOK_PRO, sygnal, zuzycie);
            if (sp) return { strona: sp, status: "OK", zuzycie, pro: mPro };
            log(`⚠️ ${s.nazwa}: model Pro nie poprawił wyniku (${statPro}).`);
            break;
          } catch (e) {
            if (e.kod === "przerwano") return strona ? { strona, status: "OK", zuzycie } : { status: "Przerwano", zuzycie };
            if (S.modelNiedostepny(e.kod, e.message)) { oznaczNiedostepny(mPro, e); continue; }
            log(`⚠️ ${s.nazwa}: ponowny odczyt Pro nieudany (${S.opisBledu(e.kod, e.message)}) – zostaje pierwszy wynik.`);
            break;
          }
        }
      }
      return strona ? { strona, status: "OK", zuzycie } : { status: stat, zuzycie };
    } finally {
      zrodlo.width = zrodlo.height = 0;   // zwolnij pamięć
    }
  }

  function sprawdzGotowosc() {
    el.btnStart.disabled = !(strony.length && klucz && !praca);
  }

  async function zablokujEkran() {
    try { if ("wakeLock" in navigator) blokadaEkranu = await navigator.wakeLock.request("screen"); } catch (e) { blokadaEkranu = null; }
  }
  function zwolnijEkran() { try { if (blokadaEkranu) blokadaEkranu.release(); } catch (e) { /* nic */ } blokadaEkranu = null; }
  document.addEventListener("visibilitychange", () => { if (praca && document.visibilityState === "visible" && !blokadaEkranu) zablokujEkran(); });

  function opcje() {
    const model = el.model.value;
    let start = parseInt(el.start.value, 10); if (!Number.isFinite(start)) start = 1;
    const czysty = el.czysty.checked;
    return {
      nazwa: (el.nazwa.value.trim() || "Notatki").replace(/[\/:\\]/g, "_"), model, czysty,
      scal: el.scal.checked, numery: el.numery.checked, numeryAuto: el.numery.checked && el.numeryAuto.checked,
      numerStartowy: start, osobneUwagi: el.uwagi.checked && !czysty, laczenie: el.laczenie.checked,
      redakcja: el.redakcja.checked, czytelna: el.czytelna.checked, autoPro: el.pro.checked,
      modelePro: el.pro.checked ? S.modeleDlaTrudnych(el.modelPro.value, dostepneModele, model) : [],
      orientacja: el.orientacja.value, modelOrientacji: S.modelDoOrientacji(dostepneModele, model),
    };
  }

  async function start() {
    if (praca || !strony.length) return;
    if (!klucz) { pokazKlucz(true); return; }
    const p = opcje();
    if (!p.redakcja && !p.czytelna) { alert("Zaznacz co najmniej jedną wersję wyniku: redakcyjną lub do czytania (Więcej opcji)."); return; }
    zapiszUstawienia();

    const kontroler = new AbortController();
    praca = { kontroler };
    const lista = strony.slice();
    const total = lista.length;
    const wyniki = new Array(total).fill(null);
    let ukonczone = 0;
    const t0 = Date.now();
    const tokeny = [0, 0];

    el.btnStart.hidden = true; el.btnStop.hidden = false; el.btnStop.disabled = false;
    el.kartaPostep.hidden = false; el.kartaWyniki.hidden = true; el.log.textContent = "";
    $("uwaga-ekran").hidden = false;
    el.postep.max = total; el.postep.value = 0;
    document.querySelectorAll("main input, main select, main button").forEach((x) => { x.dataset.byl = x.disabled ? "1" : ""; x.disabled = true; });
    status(`Analiza równoległa (0/${total})…`, "praca");
    log(`Model: ${p.model}`);
    if (p.model.includes("lite")) log(`⚠️ Model ${p.model} (Lite) jest tani, ale słabo czyta pismo odręczne – zalecany: ${PREFEROWANE.find((m) => dostepneModele.includes(m)) || "model Flash"}.`);
    orient = { tryb: p.orientacja, model: p.modelOrientacji, historia: [], licznikBok: 0, pytania: 0, tokeny: 0, zSerii: 0, obrocone: 0 };
    if (p.orientacja === ORIENT_OSZCZEDNIE || p.orientacja === ORIENT_KAZDA) log(`Orientacja stron: ${p.orientacja.toLowerCase()}; sprawdzanie modelem ${orient.model}.`);
    else if (p.orientacja !== ORIENT_BRAK) log(`Orientacja stron: ${p.orientacja.toLowerCase()}.`);
    wyczerpane = new Set(); przerwijLimit = () => kontroler.abort();
    if (p.modelePro.length) log(`Trudne strony zostaną ponownie odczytane modelem ${p.modelePro[0]}` + (p.modelePro.length > 1 ? ` (zapas przy wyczerpanym limicie: ${p.modelePro.slice(1).join(", ")}).` : "."));
    else if (p.autoPro) log(`ℹ️ Ponowny odczyt trudnych stron pominięty: główny model (${p.model}) jest już modelem Pro albo nie ma innego modelu Pro do wyboru.`);
    await zablokujEkran();
    el.kartaPostep.scrollIntoView({ behavior: "smooth", block: "start" });

    let nastepny = 0;
    async function watek() {
      while (nastepny < total && !kontroler.signal.aborted) {
        const i = nastepny++;
        const s = lista[i];
        const r = await przetworzStrone(s, p, kontroler.signal);
        for (const u of r.zuzycie) { tokeny[0] += u.promptTokenCount || 0; tokeny[1] += (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0); }
        if (r.status === "Przerwano") continue;
        ukonczone++;
        if (r.status === "OK") {
          const st = S.statystyka(r.strona);
          const opis = r.strona.numer ? [`s. ${r.strona.numer}`] : [];
          if (r.strona.trudnosc === "trudna") opis.push("trudna");
          if (r.pro) opis.push(`odczyt: ${r.pro}`);
          [["dopisek", "dopiski"], ["niepewne", "niepewne"], ["nieczytelne", "nieczytelne"], ["niepewne_miejsca", "dopiski o niepewnym miejscu"]]
            .forEach(([k, e]) => { if (st[k]) opis.push(`${e}: ${st[k]}`); });
          log(`✅ ${s.nazwa}${opis.length ? " (" + opis.join("; ") + ")" : ""}`);
          wyniki[i] = Object.assign(r.strona, { plik: s.nazwa });
        } else {
          log(`❌ ${s.nazwa}: ${r.status}. Zostawiono puste miejsce.`);
          wyniki[i] = Object.assign(S.stronaBledu(s.nazwa, r.status), { plik: s.nazwa });
        }
        el.postep.value = ukonczone;
        const pozostalo = (Date.now() - t0) / 1000 / ukonczone * (total - ukonczone);
        const eta = ukonczone < total ? `, zostało ok. ${Math.floor(pozostalo / 60)} min ${Math.floor(pozostalo % 60)} s` : "";
        status(`Analiza równoległa (${ukonczone}/${total}${eta})`, "praca");
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(LICZBA_WATKOW, total) }, watek));
      const gotowe = wyniki.filter(Boolean);
      if (gotowe.length) {
        S.sprawdzNumeracje(gotowe.map((x) => x.numer)).forEach((o) => log("⚠️ " + o));
        const { pliki, komunikaty } = S.plikiWynikowe(gotowe, p);
        komunikaty.forEach(log);
        pokazWyniki(pliki, gotowe, p);
      }
      if (orient.tryb !== ORIENT_BRAK) log(`Orientacja: obrócono ${orient.obrocone} z ${total} stron; zapytań do modelu: ${orient.pytania} (ok. ${orient.tokeny.toLocaleString("pl-PL")} tokenów), przyjęto z serii bez pytania: ${orient.zSerii}.`);
      if (tokeny[0] || tokeny[1]) log(`Zużyte tokeny: wejście ${tokeny[0].toLocaleString("pl-PL")}, wyjście ${tokeny[1].toLocaleString("pl-PL")}.`);
      const bledy = gotowe.filter((x) => x.blad).length;
      if (kontroler.signal.aborted) status(`Zatrzymano. Zapisano ${gotowe.length} z ${total} stron.`, "blad");
      else if (bledy) status(`Zakończono – ${bledy} stron z błędem`, "blad");
      else status("Zakończono sukcesem!", "ok");
      if (!gotowe.length && !kontroler.signal.aborted) status("Nie odczytano żadnej strony – szczegóły poniżej", "blad");
    } catch (e) {
      log("❌ Nieoczekiwany błąd: " + (e && e.message));
      status("Błąd – szczegóły poniżej", "blad");
      el.szczegoly.open = true;
    } finally {
      praca = null;
      zwolnijEkran();
      $("uwaga-ekran").hidden = true;
      if (!el.kartaWyniki.hidden) setTimeout(() => el.kartaWyniki.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      document.querySelectorAll("main input, main select, main button").forEach((x) => { x.disabled = x.dataset.byl === "1"; });
      przelaczOpcje();
      rysujListe();
      el.btnStart.hidden = false; el.btnStop.hidden = true;
      sprawdzGotowosc();
    }
  }

  el.btnStart.addEventListener("click", start);
  el.btnStop.addEventListener("click", () => {
    if (!praca) return;
    praca.kontroler.abort();
    el.btnStop.disabled = true;
    status("Zatrzymywanie… zapisuję gotowe strony", "blad");
    log("⚠️ Zatrzymano. Gotowe strony zostaną zapisane.");
  });
  window.addEventListener("beforeunload", (e) => { if (praca) { e.preventDefault(); e.returnValue = ""; } });

  // ---------------- wyniki ----------------
  function plikDoFile(f) {
    const typ = f.typ === "text/plain" ? "text/plain;charset=utf-8" : f.typ;
    return new File([f.tresc], f.nazwa, { type: typ });
  }
  function pobierz(f) {
    const url = URL.createObjectURL(new Blob([f.tresc], { type: f.typ === "text/plain" ? "text/plain;charset=utf-8" : f.typ }));
    const a = document.createElement("a");
    a.href = url; a.download = f.nazwa; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function udostepnij(pliki) {
    const files = pliki.map(plikDoFile);
    try {
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files }); return; }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    pliki.forEach(pobierz);
  }

  function pokazWyniki(pliki, gotowe, p) {
    wynikPliki = pliki;
    el.listaWynikow.textContent = "";
    for (const f of pliki) {
      const li = document.createElement("li");
      const opis = document.createElement("div"); opis.className = "opis";
      const n = document.createElement("span"); n.textContent = f.nazwa;
      const m = document.createElement("small");
      m.textContent = f.nazwa.endsWith("_redakcja.rtf") ? "wersja redakcyjna" : f.nazwa.endsWith("_uwagi.txt") ? "uwagi AI" : "wersja do czytania";
      opis.append(n, m);
      const b = document.createElement("button"); b.className = "maly"; b.textContent = "Udostępnij";
      b.addEventListener("click", () => udostepnij([f]));
      const d = document.createElement("button"); d.className = "maly"; d.textContent = "Pobierz";
      d.addEventListener("click", () => pobierz(f));
      li.append(opis, b, d);
      el.listaWynikow.appendChild(li);
    }
    el.podglad.textContent = S.tekstCzytelny(S.zlozDokument(gotowe.map((s, i) => Object.assign({}, s, { nr: i + 1 })), p.laczenie)).slice(0, 20000);
    el.kartaWyniki.hidden = false;
    window.__wyniki = pliki; // do testów
  }
  el.btnUdostepnijWszystko.addEventListener("click", () => udostepnij(wynikPliki));

  // ---------------- start aplikacji ----------------
  rysujListe();
  if (!klucz) pokazKlucz(true); else zaladujModele();
})();
