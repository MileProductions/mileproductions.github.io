/* Skaner AI – silnik (wersja webowa).
 * Wierne przeniesienie logiki z wersji na Maca (dokument.py + skaner_ai.py):
 * polecenia dla AI, schemat odpowiedzi, składanie stron, numeracja, pliki RTF.
 * Nie zależy od przeglądarki – działa też w Node (testy).
 */
(function (global) {
  "use strict";

  const STALE = {
 "INSTRUKCJA": "\nJesteś zaawansowanym systemem cyfryzacji rękopisów. Otrzymujesz zdjęcie JEDNEJ strony poufnej opowieści (powieści) pisanej ręcznie drukowanymi literami (wersalikami), zwykle na papierze w kratkę. Wykonaj wierną transkrypcję z pełną informacją redakcyjną: co jest tekstem głównym, co dopiskiem, co skreśleniem.\n\nZASADY OGÓLNE\n1. Przepisz tekst dokładnie. Nie streszczaj, nie zmieniaj doboru słów ani stylu autora, nie dodawaj nic od siebie. Fragmentów w innym języku nie tłumacz – przepisz je w oryginale.\n2. Zamień ciągłe wielkie litery na normalne, poprawne gramatycznie zdania: wielka litera tylko na początku zdania i w nazwach własnych, poprawna interpunkcja i polskie znaki.\n3. Słowa przeniesione do następnej linii z łącznikiem (np. „SYTU-” / „ACJI”) złącz w jedno słowo. Wyjątek: jeśli OSTATNIE słowo strony jest przeniesione na następną stronę, zostaw je z łącznikiem na końcu (np. „zoba-”).\n4. Dziel tekst na akapity tak jak autor (nowa linia z wcięciem). Każda kwestia dialogowa zaczynająca się od myślnika to osobny akapit; myślnik dialogowy zapisz jako „–”.\n5. Numer strony napisany przez autora (zwykle w górnym rogu, czasem w ramce lub nawiasie) wpisz w „numer_strony” i NIE umieszczaj go w tekście.\n6. „poczatek_kontynuacja” = true, jeśli strona zaczyna się w środku zdania z poprzedniej strony (np. pierwsze słowo to dalszy ciąg zdania, bez wcięcia akapitu). W przeciwnym razie false.\n7. „trudnosc”: oceń, jak trudna do odczytania jest strona – „latwa” (czysty tekst), „srednia” (pojedyncze dopiski lub skreślenia), „trudna” (dużo dopisków, skreśleń, tekst pisany w różnych kierunkach, fragmenty trudne do odczytania lub niejasna kolejność czytania).\n\nFRAGMENTY\nKażdy akapit to lista kolejnych fragmentów w kolejności czytania. Złączone fragmenty muszą dawać ciągły tekst – nie powtarzaj słów między fragmentami. Typy fragmentów:\n- „tekst”: tekst główny pisany w linii.\n- „dopisek”: tekst dodany później – nad linią, między wierszami, w ramce, na marginesie (także pisany pionowo wzdłuż krawędzi), wciśnięty w wolne miejsce. Wstaw go DOKŁADNIE tam, gdzie wskazuje autor: znak „^” lub „V”, strzałka, linia prowadząca, ramka z odnośnikiem albo para takich samych znaków (np. „X” w tekście i „X” przy dopisku na marginesie, „*”, cyfra w kółku). W „polozenie” podaj, gdzie dopisek stoi na kartce, a w „znak” – znak odsyłający, jeśli jest (np. „X”, „^”, „*”, „strzałka”, „ramka”). Jeśli dopisek ciągnie się dalej w innym miejscu (np. z ramki na margines), podaj go jako kolejne fragmenty w kolejności czytania. Jeśli miejsca wstawienia nie da się jednoznacznie ustalić, wstaw dopisek na końcu najbardziej prawdopodobnego akapitu i ustaw „miejsce_pewne”: false.\n- „skreslenie”: tekst przekreślony lub zamazany przez autora, umieszczony tam, gdzie był. Jeśli da się go odczytać, wpisz go w „tekst”; jeśli jest zamazany nieczytelnie, zostaw „tekst” pusty. Gdy autor przekreślił fragment i napisał obok lub nad nim nową wersję, podaj najpierw „skreslenie”, a potem „dopisek” z nową wersją.\n- „niepewne”: słowo lub krótki fragment odczytany z trudem – wpisz najbardziej prawdopodobny odczyt.\n- „nieczytelne”: fragment, którego nie da się odczytać (w „tekst” możesz podać krótki opis, np. „2–3 słowa”).\nDopiski są częścią opowieści: odczytaj każdy, także drobny, pionowy lub przy samej krawędzi kartki. Nie pomijaj żadnego dopisku.\n\nUWAGI\n{uwagi}\n\nNie dodawaj wstępów, nagłówków ani komentarzy w treści fragmentów.\n",
 "UWAGI_STANDARD": "W polu „uwagi” krótko opisz: nieczytelne miejsca, dopiski o niepewnym miejscu wstawienia (gdzie stoją na kartce i dlaczego miejsce jest niepewne), fragmenty w obcym języku przepisane bez tłumaczenia. Jeśli nie ma uwag, zostaw pole puste.",
 "UWAGI_CZYSTE": "Pole „uwagi” zostaw puste.",
 "POLECENIE": "Wykonaj transkrypcję tej strony zgodnie z instrukcją.",
 "MODELE_ZAPASOWE": [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.1-pro-preview"
 ],
 "MODELE_POMIJANE": [
  "embedding",
  "tts",
  "image",
  "imagen",
  "live",
  "audio",
  "aqa",
  "veo",
  "robotics",
  "computer-use",
  "banana",
  "omni",
  "transcribe",
  "customtools",
  "lyria",
  "gemma",
  "antigravity",
  "deep-research"
 ],
 "MODEL_DOMYSLNY": "gemini-2.5-flash",
 "MODELE_PREFEROWANE": [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash"
 ],
 "PRO_PREFEROWANE": [
  "gemini-4-argon"
 ],
 "CP1250": {
  "€": "80",
  "‚": "82",
  "„": "84",
  "…": "85",
  "†": "86",
  "‡": "87",
  "‰": "89",
  "Š": "8a",
  "‹": "8b",
  "Ś": "8c",
  "Ť": "8d",
  "Ž": "8e",
  "Ź": "8f",
  "‘": "91",
  "’": "92",
  "“": "93",
  "”": "94",
  "•": "95",
  "–": "96",
  "—": "97",
  "™": "99",
  "š": "9a",
  "›": "9b",
  "ś": "9c",
  "ť": "9d",
  "ž": "9e",
  "ź": "9f",
  " ": "a0",
  "ˇ": "a1",
  "˘": "a2",
  "Ł": "a3",
  "¤": "a4",
  "Ą": "a5",
  "¦": "a6",
  "§": "a7",
  "¨": "a8",
  "©": "a9",
  "Ş": "aa",
  "«": "ab",
  "¬": "ac",
  "­": "ad",
  "®": "ae",
  "Ż": "af",
  "°": "b0",
  "±": "b1",
  "˛": "b2",
  "ł": "b3",
  "´": "b4",
  "µ": "b5",
  "¶": "b6",
  "·": "b7",
  "¸": "b8",
  "ą": "b9",
  "ş": "ba",
  "»": "bb",
  "Ľ": "bc",
  "˝": "bd",
  "ľ": "be",
  "ż": "bf",
  "Ŕ": "c0",
  "Á": "c1",
  "Â": "c2",
  "Ă": "c3",
  "Ä": "c4",
  "Ĺ": "c5",
  "Ć": "c6",
  "Ç": "c7",
  "Č": "c8",
  "É": "c9",
  "Ę": "ca",
  "Ë": "cb",
  "Ě": "cc",
  "Í": "cd",
  "Î": "ce",
  "Ď": "cf",
  "Đ": "d0",
  "Ń": "d1",
  "Ň": "d2",
  "Ó": "d3",
  "Ô": "d4",
  "Ő": "d5",
  "Ö": "d6",
  "×": "d7",
  "Ř": "d8",
  "Ů": "d9",
  "Ú": "da",
  "Ű": "db",
  "Ü": "dc",
  "Ý": "dd",
  "Ţ": "de",
  "ß": "df",
  "ŕ": "e0",
  "á": "e1",
  "â": "e2",
  "ă": "e3",
  "ä": "e4",
  "ĺ": "e5",
  "ć": "e6",
  "ç": "e7",
  "č": "e8",
  "é": "e9",
  "ę": "ea",
  "ë": "eb",
  "ě": "ec",
  "í": "ed",
  "î": "ee",
  "ď": "ef",
  "đ": "f0",
  "ń": "f1",
  "ň": "f2",
  "ó": "f3",
  "ô": "f4",
  "ő": "f5",
  "ö": "f6",
  "÷": "f7",
  "ř": "f8",
  "ů": "f9",
  "ú": "fa",
  "ű": "fb",
  "ü": "fc",
  "ý": "fd",
  "ţ": "fe",
  "˙": "ff"
 }
};

  const TYPY = ["tekst", "dopisek", "skreslenie", "niepewne", "nieczytelne"];
  const POLOZENIA = {
    w_linii: "w linii",
    nad_linia: "nad linią",
    miedzy_wierszami: "między wierszami",
    ramka: "w ramce",
    margines_lewy: "lewy margines",
    margines_prawy: "prawy margines",
    margines_gorny: "górny margines",
    margines_dolny: "dolny margines",
    inne: "inne miejsce",
  };
  const LACZNIKI_WYRAZOW = "-\u00ad\u2010\u2011\u00ac";
  const BEZ_SPACJI_PRZED = ".,;:!?…)]}»”\u2019";
  const BEZ_SPACJI_PO = "([{„«\u201a";

  const jestLitera = (c) => /\p{L}/u.test(c);
  const jestMala = (c) => jestLitera(c) && c === c.toLowerCase() && c !== c.toUpperCase();
  const jestBialy = (c) => /\s/u.test(c);
  const ostatni = (s) => { const t = Array.from(s); return t[t.length - 1] || ""; };
  const przedostatni = (s) => { const t = Array.from(s); return t[t.length - 2] || ""; };
  const pierwszy = (s) => Array.from(s)[0] || "";

  // ===================================================================
  // POLECENIE DLA AI I SCHEMAT ODPOWIEDZI (REST API Gemini)
  // ===================================================================

  function instrukcja(trybCzysty) {
    return STALE.INSTRUKCJA.replace("{uwagi}", trybCzysty ? STALE.UWAGI_CZYSTE : STALE.UWAGI_STANDARD);
  }

  const SCHEMAT_FRAGMENTU = {
    type: "OBJECT",
    properties: {
      typ: { type: "STRING", enum: TYPY.slice() },
      tekst: { type: "STRING" },
      polozenie: { type: "STRING", enum: Object.keys(POLOZENIA) },
      znak: { type: "STRING" },
      miejsce_pewne: { type: "BOOLEAN" },
    },
    required: ["typ", "tekst"],
    propertyOrdering: ["typ", "tekst", "polozenie", "znak", "miejsce_pewne"],
  };

  const SCHEMAT_STRONY = {
    type: "OBJECT",
    properties: {
      numer_strony: { type: "STRING" },
      poczatek_kontynuacja: { type: "BOOLEAN" },
      trudnosc: { type: "STRING", enum: ["latwa", "srednia", "trudna"] },
      akapity: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { segmenty: { type: "ARRAY", items: SCHEMAT_FRAGMENTU } },
          required: ["segmenty"],
        },
      },
      uwagi: { type: "STRING" },
    },
    required: ["numer_strony", "poczatek_kontynuacja", "akapity"],
    propertyOrdering: ["numer_strony", "poczatek_kontynuacja", "akapity", "uwagi", "trudnosc"],
  };

  const KATEGORIE = ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH",
                     "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"];

  function zapytanieStrony(jpegBase64, trybCzysty) {
    return {
      systemInstruction: { parts: [{ text: instrukcja(trybCzysty) }] },
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: "image/jpeg", data: jpegBase64 } },
        { text: STALE.POLECENIE },
      ] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMAT_STRONY },
      safetySettings: KATEGORIE.map((c) => ({ category: c, threshold: "BLOCK_NONE" })),
    };
  }

  // ===================================================================
  // NORMALIZACJA ODPOWIEDZI AI
  // ===================================================================

  function fragment(s) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return null;
    let typ = String(s.typ || "tekst").trim().toLowerCase();
    if (!TYPY.includes(typ)) typ = "tekst";
    const tekst = String(s.tekst == null ? "" : s.tekst).replace(/\s+/gu, " ").trim();
    if (!tekst && typ !== "skreslenie" && typ !== "nieczytelne") return null;
    let polozenie = String(s.polozenie || "w_linii").trim().toLowerCase();
    if (!(polozenie in POLOZENIA)) polozenie = "inne";
    const pewne = s.miejsce_pewne;
    return { typ, tekst, polozenie, znak: String(s.znak || "").trim(),
             miejsce_pewne: pewne == null ? true : Boolean(pewne) };
  }

  function normalizujStrone(dane) {
    if (!dane || typeof dane !== "object" || !Array.isArray(dane.akapity)) return null;
    const akapity = [];
    for (const a of dane.akapity) {
      const segmenty = a && !Array.isArray(a) && typeof a === "object" ? a.segmenty : (Array.isArray(a) ? a : null);
      if (!Array.isArray(segmenty)) continue;
      const frag = segmenty.map(fragment).filter(Boolean);
      if (frag.length) akapity.push(frag);
    }
    return {
      numer: String(dane.numer_strony || "").trim(),
      kontynuacja: Boolean(dane.poczatek_kontynuacja),
      akapity,
      uwagi: String(dane.uwagi || "").trim(),
      trudnosc: String(dane.trudnosc || "").trim().toLowerCase(),
      blad: false,
    };
  }

  function oczyscWstepAi(tekst) {
    if (!tekst) return "";
    const frazy = ["oto transkrypcja", "transkrypcja załączonego", "poniżej znajduje się", "poufnej opowieści", "załączony skan"];
    const wynik = [];
    let pomijaj = false;
    for (const linia of tekst.split("\n")) {
      if (frazy.some((f) => linia.toLowerCase().includes(f))) { pomijaj = true; continue; }
      if (pomijaj && linia.trim() === "") { pomijaj = false; continue; }
      if (!pomijaj) wynik.push(linia);
    }
    return wynik.join("\n").trim();
  }

  function stronaZTekstu(tekst, uwagi) {
    const akapity = [];
    for (let blok of (tekst || "").trim().split(/\n\s*\n/u)) {
      blok = blok.replace(/\s*\n\s*/gu, " ").trim();
      if (blok) akapity.push([{ typ: "tekst", tekst: blok, polozenie: "w_linii", znak: "", miejsce_pewne: true }]);
    }
    const p = akapity.length ? akapity[0][0].tekst : "";
    return { numer: "", kontynuacja: jestMala(pierwszy(p)), akapity, uwagi: (uwagi || "").trim(), trudnosc: "", blad: false };
  }

  function rozdzielStaryFormat(wynik) {
    wynik = oczyscWstepAi(wynik);
    const gora = wynik.toUpperCase();
    for (const znacznik of ["[UWAGI]", "UWAGI:"]) {
      const idx = gora.indexOf(znacznik);
      if (idx !== -1) {
        const uwagi = wynik.slice(idx + znacznik.length).trim().replace(/^:+/, "").split("**").join("").split("*").join("").trim();
        return [wynik.slice(0, idx).trim(), uwagi];
      }
    }
    return [wynik, ""];
  }

  function odczytajOdpowiedz(tekstOdpowiedzi) {
    let dane = null;
    try { dane = JSON.parse(tekstOdpowiedzi); } catch (e) { dane = null; }
    const strona = normalizujStrone(dane);
    if (strona) return strona;
    if (dane && typeof dane === "object" && "tekst" in dane) {
      return stronaZTekstu(oczyscWstepAi(String(dane.tekst || "")), String(dane.uwagi || ""));
    }
    const [t, u] = rozdzielStaryFormat(tekstOdpowiedzi || "");
    return stronaZTekstu(t, u);
  }

  function stronaBledu(nazwaPliku, powod) {
    return {
      numer: "", kontynuacja: false, trudnosc: "", blad: true,
      akapity: [[{ typ: "blad", tekst: `[MIEJSCE NA RĘCZNE WKLEJENIE TEKSTU Z PLIKU: ${nazwaPliku} – BŁĄD: ${powod}]`,
                   polozenie: "w_linii", znak: "", miejsce_pewne: true }]],
      uwagi: `Plik ${nazwaPliku} nie został odczytany. Powód: ${powod}`,
    };
  }

  function statystyka(strona) {
    const licz = {};
    for (const t of TYPY) licz[t] = 0;
    let niepewneMiejsca = 0;
    for (const a of strona.akapity) for (const f of a) {
      if (f.typ in licz) licz[f.typ] += 1;
      if (f.typ === "dopisek" && !f.miejsce_pewne) niepewneMiejsca += 1;
    }
    licz.niepewne_miejsca = niepewneMiejsca;
    return licz;
  }

  function czyStronaTrudna(strona) {
    const st = statystyka(strona);
    return strona.trudnosc === "trudna" || st.niepewne + st.nieczytelne >= 4 || st.niepewne_miejsca >= 2;
  }

  // ===================================================================
  // MODELE
  // ===================================================================

  function kluczNaturalny(s) {
    return s.split(/([0-9]+)/).map((t) => (/^[0-9]+$/.test(t) ? Number(t) : t.toLowerCase()));
  }
  function porownajNaturalnie(a, b) {
    const x = kluczNaturalny(a), y = kluczNaturalny(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      if (x[i] === y[i]) continue;
      if (typeof x[i] === typeof y[i]) return x[i] < y[i] ? -1 : 1;
      return typeof x[i] === "number" ? -1 : 1;
    }
    return x.length - y.length;
  }

  function filtrujModele(modele) {
    const wynik = new Set();
    for (const m of modele || []) {
      const nazwa = String(m.name || "").replace("models/", "");
      const akcje = m.supportedGenerationMethods || m.supported_actions || [];
      if (!nazwa.includes("gemini")) continue;
      if (akcje.length && !akcje.includes("generateContent")) continue;
      if (STALE.MODELE_POMIJANE.some((p) => nazwa.includes(p))) continue;
      wynik.add(nazwa);
    }
    return Array.from(wynik).sort(porownajNaturalnie).reverse();
  }

  const MODEL_PRO_AUTO = "Automatycznie – najnowszy Pro";

  const jestPro = (m) => (m || "").includes("-pro") || (m || "").includes("argon");

  function listaModeliPro(dostepne) {
    const pro = dostepne.filter(jestPro);
    const pref = (STALE.PRO_PREFEROWANE || []).filter((m) => pro.includes(m));
    const stabilne = pro.filter((m) => !pref.includes(m) && !m.includes("preview") && !m.includes("exp")).sort(porownajNaturalnie).reverse();
    const reszta = pro.filter((m) => !pref.includes(m) && !stabilne.includes(m)).sort(porownajNaturalnie).reverse();
    return pref.concat(stabilne, reszta);
  }

  function wybierzModelPro(dostepne, aktualny) {
    if (jestPro(aktualny)) return null;
    const k = listaModeliPro(dostepne);
    return k.length ? k[0] : null;
  }

  // Kolejność modeli do ponownego odczytu trudnych stron: pierwszy jest używany, kolejne to zapas,
  // gdy poprzedni wyczerpie limit dzienny. Pusta lista = bez ponownego odczytu.
  function modeleDlaTrudnych(wybor, dostepne, aktualny) {
    if (wybor && wybor !== MODEL_PRO_AUTO) {
      if (wybor === aktualny) return [];
      return [wybor].concat(listaModeliPro(dostepne).filter((m) => m !== wybor && m !== aktualny));
    }
    if (jestPro(aktualny)) return [];
    return listaModeliPro(dostepne).filter((m) => m !== aktualny);
  }

  function modelDlaTrudnych(wybor, dostepne, aktualny) {
    const l = modeleDlaTrudnych(wybor, dostepne, aktualny);
    return l.length ? l[0] : null;
  }

  // ===================================================================
  // SKŁADANIE DOKUMENTU, NUMERACJA
  // ===================================================================

  function zlozDokument(strony, laczycStrony = true) {
    const wynik = [];
    let poprzedniaBlad = true;
    for (const st of strony) {
      const akapity = st.akapity.length ? st.akapity.map((a) => a.slice()) : [[]];
      const znacznik = { typ: "strona", tekst: "", nr: st.nr, rekopis: st.numer || "", plik: st.plik || "",
                         polozenie: "w_linii", znak: "", miejsce_pewne: true };
      if (laczycStrony && wynik.length && st.kontynuacja && !st.blad && !poprzedniaBlad) {
        wynik[wynik.length - 1].push(znacznik, ...akapity[0]);
        wynik.push(...akapity.slice(1));
      } else {
        akapity[0].unshift(znacznik);
        wynik.push(...akapity);
      }
      poprzedniaBlad = Boolean(st.blad);
    }
    return wynik;
  }

  function liczba(numer) {
    const m = /\d+/.exec(numer || "");
    return m ? parseInt(m[0], 10) : null;
  }

  function sprawdzNumeracje(numery) {
    const liczby = numery.map(liczba).filter((x) => x !== null);
    const ostrz = [];
    if (liczby.length < 2) return ostrz;
    for (let i = 0; i + 1 < liczby.length; i++) {
      const a = liczby[i], b = liczby[i + 1];
      if (b <= a) ostrz.push(`Strona ${b} występuje po stronie ${a} – sprawdź kolejność plików.`);
    }
    const pos = Array.from(new Set(liczby)).sort((x, y) => x - y);
    for (let i = 0; i + 1 < pos.length; i++) {
      const a = pos[i], b = pos[i + 1];
      if (b > a + 1) ostrz.push(`Brak stron(y) ${b === a + 2 ? `${a + 1}` : `${a + 1}–${b - 1}`} między ${a} a ${b}.`);
    }
    return ostrz;
  }

  function numerujStrony(numeryRekopisu, startDomyslny = 1) {
    const odczytane = numeryRekopisu.map(liczba);
    if (!odczytane.length) return [[], []];
    const znane = odczytane.map((x, i) => (x !== null ? i : -1)).filter((i) => i >= 0);
    if (!znane.length) {
      return [odczytane.map((_, i) => startDomyslny + i),
              [`Nie odczytano numerów stron z rękopisu – numeracja od ${startDomyslny}.`]];
    }
    const j = znane[0];
    let poprzedni = odczytane[j] - j - 1;
    const wynik = [], kom = [];
    odczytane.forEach((x, i) => {
      const oczekiwany = poprzedni + 1;
      let nr;
      if (x === null) { nr = oczekiwany; kom.push(`Plik ${i + 1}: brak numeru strony w rękopisie – przyjęto ${nr}.`); }
      else if (x > poprzedni) nr = x;
      else { nr = oczekiwany; kom.push(`Plik ${i + 1}: odczytano numer ${x}, który nie pasuje do kolejności – przyjęto ${nr}.`); }
      wynik.push(nr);
      poprzedni = nr;
    });
    return [wynik, kom];
  }

  function odstep(poprzedni, nastepny) {
    if (!poprzedni || !nastepny) return "";
    const a = ostatni(poprzedni), b = pierwszy(nastepny);
    if (LACZNIKI_WYRAZOW.includes(a) && Array.from(poprzedni).length > 1 && jestLitera(przedostatni(poprzedni))
        && jestLitera(b) && jestMala(b)) return "sklej";
    if (jestBialy(a) || BEZ_SPACJI_PO.includes(a) || BEZ_SPACJI_PRZED.includes(b)) return "";
    return " ";
  }

  // ===================================================================
  // RTF
  // ===================================================================

  function kodCp1250(ch) {
    const h = STALE.CP1250[ch];
    return h ? `\\'${h}` : "?";
  }

  function rtfEsc(text) {
    const out = [];
    for (const ch of text || "") {
      const o = ch.codePointAt(0);
      if (ch === "\\") out.push("\\\\");
      else if (ch === "{") out.push("\\{");
      else if (ch === "}") out.push("\\}");
      else if (ch === "\n") out.push("\\line ");
      else if (ch === "\t") out.push("\\tab ");
      else if (o < 128) out.push(ch);
      else if (o <= 0xffff) out.push(`\\u${o < 32768 ? o : o - 65536}${kodCp1250(ch)}`);
      else {
        const v = o - 0x10000;
        for (const j of [0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)]) out.push(`\\u${j - 65536}?`);
      }
    }
    return out.join("");
  }

  const KOLORY = [
    ["czarny", [0, 0, 0]], ["zolty", [255, 255, 0]], ["zielony", [0, 255, 0]], ["turkus", [0, 255, 255]],
    ["szary", [118, 118, 118]], ["czerwony", [200, 0, 0]], ["niebieski", [0, 90, 170]],
  ];
  const K = {};
  KOLORY.forEach(([n], i) => { K[n] = i + 1; });

  function naglowekRtf() {
    const tabela = KOLORY.map(([, [r, g, b]]) => `\\red${r}\\green${g}\\blue${b};`).join("");
    return "{\\rtf1\\ansi\\ansicpg1250\\deff0\\uc1\n" +
      "{\\fonttbl{\\f0\\froman\\fcharset238 Times New Roman;}{\\f1\\fswiss\\fcharset238 Helvetica;}}\n" +
      "{\\colortbl;" + tabela + "}\n" +
      "\\viewkind4\\f0\\fs24\n";
  }

  const run = (tekst, styl = "") => (!tekst ? "" : (styl ? "{" + styl + " " + rtfEsc(tekst) + "}" : rtfEsc(tekst)));
  const zakreslenie = (n) => `\\highlight${K[n]}\\cb${K[n]}`;
  const ETYKIETA = `\\f1\\fs16\\cf${K.szary}`;

  function etykietaDopisku(f) {
    const cz = [];
    if (!f.miejsce_pewne) cz.push("miejsce niepewne");
    cz.push(f.polozenie !== "w_linii" ? (POLOZENIA[f.polozenie] || "dopisek") : "dopisek");
    if (f.znak) cz.push(`znak ${f.znak}`);
    return "[" + cz.join(", ") + "]";
  }

  function redakcjaFragment(f) {
    const typ = f.typ;
    if (typ === "tekst") return [f.tekst, run(f.tekst)];
    if (typ === "dopisek") {
      const kolor = !f.miejsce_pewne ? "turkus" : (f.polozenie.startsWith("margines") ? "zielony" : "zolty");
      return [f.tekst, run(f.tekst, zakreslenie(kolor)) + run("\u2009" + etykietaDopisku(f), ETYKIETA)];
    }
    if (typ === "skreslenie") return ["", ""];
    if (typ === "niepewne") return [f.tekst, run(f.tekst, `\\cf${K.czerwony}`) + run("[?]", `\\f1\\fs16\\cf${K.czerwony}`)];
    if (typ === "nieczytelne") {
      const opis = `[nieczytelne${f.tekst ? ": " + f.tekst : ""}]`;
      return [opis, run(opis, `\\f1\\fs18\\cf${K.czerwony}`)];
    }
    if (typ === "strona") {
      const cz = [];
      if (f.rekopis) cz.push(`s. ${f.rekopis}`);
      if (f.plik) cz.push(f.plik);
      const e = "‹ " + (cz.length ? cz : [`strona ${f.nr}`]).join(" · ") + " ›";
      return [e, run(e, `\\f1\\fs16\\b\\cf${K.niebieski}`)];
    }
    if (typ === "blad") return [f.tekst, run(f.tekst, `\\b\\cf${K.czerwony}`)];
    return [f.tekst || "", run(f.tekst || "")];
  }

  function akapitRedakcja(akapit) {
    const out = [];
    let poprzedni = "";
    for (const f of akapit) {
      const [tekst, kod] = redakcjaFragment(f);
      if (!kod) continue;
      if (odstep(poprzedni, tekst) === " ") out.push(" ");
      out.push(kod);
      poprzedni = tekst;
    }
    return out.join("");
  }

  const LEGENDA = [
    ["dopisek (nad linią, w ramce, między wierszami)", zakreslenie("zolty"), ""],
    ["dopisek z marginesu", zakreslenie("zielony"), ""],
    ["dopisek – miejsce wstawienia niepewne", zakreslenie("turkus"), ""],
    ["odczyt niepewny", `\\cf${K.czerwony}`, "[?]"],
    ["‹ s. 493 · plik ›", `\\f1\\fs16\\b\\cf${K.niebieski}`, " początek strony rękopisu"],
  ];

  function rtfRedakcyjny(akapity, tytul = "", uwagi = []) {
    const out = [naglowekRtf()];
    if (tytul) out.push("\\pard\\sa60\\f1\\fs28\\b " + rtfEsc(tytul + " – wersja redakcyjna") + "\\b0\\par\n");
    out.push("\\pard\\sa40\\f1\\fs18 " + run("Legenda: ", "\\b"));
    LEGENDA.forEach(([opis, styl, dodatek], i) => {
      if (i) out.push(rtfEsc("   "));
      if (opis.startsWith("‹")) out.push(run(opis, styl) + rtfEsc(dodatek));
      else out.push(run("przykład", styl) + rtfEsc((dodatek || "") + " = " + opis));
    });
    out.push("\\par\\pard\\sa240\\par\n");
    for (const a of akapity) {
      const t = akapitRedakcja(a);
      if (t) out.push("\\pard\\sa160\\sl300\\slmult1\\f0\\fs24 " + t + "\\par\n");
    }
    const u = (uwagi || []).filter(([, x]) => x);
    if (u.length) {
      out.push("\\pard\\sb360\\sa120\\f1\\fs22\\b " + rtfEsc("Uwagi AI do stron") + "\\b0\\par\n");
      for (const [e, t] of u) out.push("\\pard\\sa100\\f1\\fs18 " + run(e + ": ", "\\b") + rtfEsc(t) + "\\par\n");
    }
    out.push("}");
    return out.join("");
  }

  function tekstAkapituCzytelny(akapit, numeryStron = false) {
    let wynik = "";
    for (const f of akapit) {
      let k;
      if (["tekst", "dopisek", "niepewne", "blad"].includes(f.typ)) k = f.tekst;
      else if (f.typ === "nieczytelne") k = "[…]";
      else if (f.typ === "strona" && numeryStron && f.nr != null) k = `(${f.nr})`;
      else continue;
      if (!k) continue;
      const o = odstep(wynik, k);
      if (o === "sklej") wynik = Array.from(wynik).slice(0, -1).join("") + k;
      else wynik += o + k;
    }
    return wynik.trim();
  }

  function rtfCzytelny(akapity, numeryStron = false) {
    const out = [naglowekRtf()];
    let pierwszyAk = true;
    for (const a of akapity) {
      const t = tekstAkapituCzytelny(a, numeryStron);
      if (!t) continue;
      const wciecie = pierwszyAk || t.startsWith("–") || t.startsWith("-") || t.startsWith("(") ? "" : "\\fi425";
      out.push(`\\pard\\sa120\\sl360\\slmult1\\qj${wciecie}\\f0\\fs24 ` + rtfEsc(t) + "\\par\n");
      pierwszyAk = false;
    }
    out.push("}");
    return out.join("");
  }

  function tekstCzytelny(akapity, numeryStron = false) {
    return akapity.map((a) => tekstAkapituCzytelny(a, numeryStron)).filter(Boolean).join("\n\n");
  }

  // ===================================================================
  // PLIKI WYNIKOWE (jak zapisz_wyniki w wersji na Maca)
  // ===================================================================

  /** strony: lista stron w kolejności (każda z polem plik). p: opcje.
   *  Zwraca { pliki: [{nazwa, tresc, typ}], komunikaty: [] } */
  function plikiWynikowe(strony, p) {
    const komunikaty = [];
    let numery;
    if (p.numeryAuto) {
      const [n, kom] = numerujStrony(strony.map((s) => s.numer || ""), p.numerStartowy);
      kom.forEach((k) => komunikaty.push("ℹ️ " + k));
      if (n.length) komunikaty.push(`Numeracja stron według rękopisu: ${n[0]}–${n[n.length - 1]}.`);
      numery = n;
    } else {
      numery = strony.map((_, i) => p.numerStartowy + i);
    }
    const st = strony.map((s, i) => Object.assign({}, s, { nr: numery[i], idx: i + 1 }));
    const etykieta = (s) => [p.numery ? `(${s.nr})` : "", s.numer ? `s. ${s.numer}` : "", s.plik || ""].filter(Boolean).join(" ");
    const pliki = [];
    const komplet = (rdzen, grupa, tytul) => {
      const akapity = zlozDokument(grupa, p.laczenie);
      const uwagi = p.czysty ? [] : grupa.map((s) => [etykieta(s), s.uwagi || ""]);
      if (p.czytelna) pliki.push({ nazwa: `${rdzen}.rtf`, tresc: rtfCzytelny(akapity, p.numery), typ: "application/rtf" });
      if (p.redakcja) pliki.push({ nazwa: `${rdzen}_redakcja.rtf`, tresc: rtfRedakcyjny(akapity, tytul, uwagi), typ: "application/rtf" });
      const tu = uwagi.filter(([, u]) => u).map(([e, u]) => `${e}\n${u}`).join("\n\n");
      if (p.osobneUwagi && tu) pliki.push({ nazwa: `${rdzen}_uwagi.txt`, tresc: (grupa.length > 1 ? "--- UWAGI AI ---\n\n" : "") + tu, typ: "text/plain" });
    };
    if (p.scal || st.length === 1) komplet(p.nazwa, st, p.nazwa);
    else st.forEach((s) => komplet(`${p.nazwa}_${s.idx}`, [s], `${p.nazwa} – ${s.plik || ""}`));
    return { pliki, komunikaty };
  }

  // ===================================================================
  // BŁĘDY API
  // ===================================================================

  function opisBledu(kod, tresc) {
    const niski = String(tresc || "").toLowerCase();
    if (kod === "siec") return "Brak połączenia z internetem lub przekroczony czas odpowiedzi";
    if (kod === 401 || kod === 403 || (kod === 400 && (niski.includes("api key") || niski.includes("api_key") || niski.includes("permission"))))
      return "Nieprawidłowy klucz API lub brak uprawnień (sprawdź klucz w Ustawieniach)";
    if (kod === 404) return "Wybrany model jest niedostępny – wybierz inny z listy";
    if (limitDzienny(kod, tresc)) return "Wyczerpany dzienny limit zapytań tego modelu – wybierz inny model albo spróbuj jutro";
    if (kod === 429) return "Przekroczono limit zapytań – spróbuj ponownie za chwilę";
    if (typeof kod === "number" && kod >= 500) return `Serwer Google chwilowo niedostępny (kod ${kod})`;
    return String(tresc || "Nieznany błąd").slice(0, 300);
  }
  // Wyczerpany dzienny limit zapytań modelu (ponawianie nie ma sensu).
  function limitDzienny(kod, tresc) { const t = String(tresc || ""); return kod === 429 && (t.includes("PerDay") || t.toLowerCase().includes("per day")); }
  const modelNiedostepny = (kod, tresc) => limitDzienny(kod, tresc) || kod === 404;
  const czyPonowic = (kod, tresc) => !limitDzienny(kod, tresc) && (kod === "siec" || [408, 429, 500, 502, 503, 504].includes(kod));

  function powodBrakuTekstu(odp) {
    try {
      if (odp.promptFeedback && odp.promptFeedback.blockReason) return `Zablokowano zapytanie (powód: ${odp.promptFeedback.blockReason})`;
      const c = (odp.candidates || [])[0];
      if (c && c.finishReason) return `Model przerwał odpowiedź (powód: ${c.finishReason})`;
    } catch (e) { /* nic */ }
    return "Brak tekstu w odpowiedzi modelu";
  }

  function tekstOdpowiedzi(odp) {
    const c = (odp.candidates || [])[0];
    const czesci = (c && c.content && c.content.parts) || [];
    return czesci.filter((x) => !x.thought && typeof x.text === "string").map((x) => x.text).join("");
  }

  // ===================================================================
  // ORIENTACJA STRONY – analiza lokalna (jak uklad_tekstu w wersji na Maca)
  // ===================================================================

  /** szary: tablica jasności 0–255 (w×h, wierszami). Zwraca maskę atramentu (Uint8Array). */
  function mapaAtramentu(szary, w, h) {
    const r = 12, n = 2 * r + 1;
    const pozioma = new Uint8Array(w * h), tlo = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {          // rozmycie poziome (krawędzie powielane, jak w PIL BoxBlur)
      const o = y * w; let suma = 0;
      for (let k = -r; k <= r; k++) suma += szary[o + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        pozioma[o + x] = Math.round(suma / n);
        suma += szary[o + Math.min(w - 1, x + r + 1)] - szary[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {          // rozmycie pionowe
      let suma = 0;
      for (let k = -r; k <= r; k++) suma += pozioma[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        tlo[y * w + x] = Math.round(suma / n);
        suma += pozioma[Math.min(h - 1, y + r + 1) * w + x] - pozioma[Math.max(0, y - r) * w + x];
      }
    }
    const maska = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) maska[i] = tlo[i] - szary[i] > 22 ? 1 : 0;
    return maska;
  }

  function mediana(t) {
    if (!t.length) return 0;
    const s = t.slice().sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** „Prążkowość” profilu wierszy w pionowych pasach (transpozycja=true liczy dla kolumn). */
  function silaLinii(maska, w, h, transpozycja, pasy = 6) {
    const W = transpozycja ? h : w, H = transpozycja ? w : h;
    const v = transpozycja ? (r, c) => maska[c * w + r] : (r, c) => maska[r * w + c];
    const r0 = Math.trunc(H * 0.15), r1 = Math.trunc(H * 0.85), c0 = Math.trunc(W * 0.15), c1 = Math.trunc(W * 0.85);
    const hh = r1 - r0, ww = c1 - c0, wyniki = [];
    for (let k = 0; k < pasy; k++) {
      const a = c0 + Math.floor(k * ww / pasy), b = c0 + Math.floor((k + 1) * ww / pasy);
      const prof = new Float64Array(hh);
      for (let r = 0; r < hh; r++) { let s = 0; for (let c = a; c < b; c++) s += v(r0 + r, c); prof[r] = s; }
      let srednia = 0; for (const x of prof) srednia += x; srednia /= hh || 1;
      if (srednia < 0.5) continue;
      const roznice = new Float64Array(hh); let sr = 0;
      for (let i = 0; i < hh; i++) {
        let s = 0; for (let j = i - 30; j <= i + 30; j++) if (j >= 0 && j < hh) s += prof[j];
        roznice[i] = prof[i] - s / 61; sr += roznice[i];
      }
      sr /= hh; let war = 0; for (const x of roznice) war += (x - sr) * (x - sr);
      wyniki.push(Math.sqrt(war / hh) / (srednia + 1e-6));
    }
    return mediana(wyniki);
  }

  /** 'poziomy' | 'pionowy' (strona na boku) | 'niepewny' */
  function ukladTekstu(szary, w, h) {
    const m = mapaAtramentu(szary, w, h);
    const poz = silaLinii(m, w, h, false), pion = silaLinii(m, w, h, true);
    if (poz > pion * 1.15) return { uklad: "poziomy", poz, pion };
    if (pion > poz * 1.15) return { uklad: "pionowy", poz, pion };
    return { uklad: "niepewny", poz, pion };
  }

  /** Najtańszy sensowny model do pytania o orientację. */
  function modelDoOrientacji(dostepne, glowny) {
    const warunki = [(m) => m.includes("flash-lite") && !m.includes("preview"), (m) => m.includes("flash-lite"),
                     (m) => m.includes("flash") && !m.includes("preview") && !m.includes("image")];
    for (const war of warunki) {
      const k = dostepne.filter(war).sort(porownajNaturalnie).reverse();
      if (k.length) return k[0];
    }
    return glowny;
  }

  const POLECENIE_ORIENTACJI = "Każdy z obrazów {lista} to to samo zdjęcie strony tekstu pisanego ręcznie, obrócone na różne sposoby. " +
    "Wskaż obraz, na którym tekst jest ustawiony prawidłowo do czytania: linijki biegną poziomo, litery stoją prosto " +
    "(nie do góry nogami), czyta się od lewej do prawej, a pierwsza linijka strony jest u góry. Odpowiedz wyłącznie literą obrazu.";

  /** Zapytanie o orientację: miniatury (base64 JPEG) w kolejności liter A, B, … */
  function zapytanieOrientacji(miniatury) {
    const litery = "ABCD".slice(0, miniatury.length).split("");
    const parts = [];
    miniatury.forEach((b64, i) => { parts.push({ text: `Obraz ${litery[i]}:` }); parts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } }); });
    parts.push({ text: POLECENIE_ORIENTACJI.replace("{lista}", litery.join(", ")) });
    return {
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { prawidlowy: { type: "STRING", enum: litery } }, required: ["prawidlowy"] } },
      safetySettings: KATEGORIE.map((c) => ({ category: c, threshold: "BLOCK_NONE" })),
    };
  }

  const API = {
    STALE, TYPY, POLOZENIA, MODEL_PRO_AUTO, SCHEMAT_STRONY,
    instrukcja, zapytanieStrony, normalizujStrone, odczytajOdpowiedz, stronaZTekstu, stronaBledu,
    statystyka, czyStronaTrudna, filtrujModele, listaModeliPro, wybierzModelPro, modelDlaTrudnych, modeleDlaTrudnych, jestPro, limitDzienny, modelNiedostepny,
    zlozDokument, sprawdzNumeracje, numerujStrony, odstep, rtfEsc, rtfRedakcyjny, rtfCzytelny,
    tekstCzytelny, plikiWynikowe, opisBledu, czyPonowic, powodBrakuTekstu, tekstOdpowiedzi, porownajNaturalnie,
    mapaAtramentu, silaLinii, ukladTekstu, modelDoOrientacji, zapytanieOrientacji, POLECENIE_ORIENTACJI,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.Silnik = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
