# Projektant opakowań krówek – MVP

Aplikacja webowa, w której klient sam projektuje papierek krówki ze swoich zdjęć, widzi podgląd 3D, dostaje cenę i zamawia plik gotowy do druku. Zbudowana wg `prompt-aplikacja-opakowania-krowek.md` (etap 1 + część etapu 2).

## Uruchomienie

```bash
npm install
npm run dev        # strona samodzielna: http://localhost:5173
npm test           # testy logiki (siatka, DPI, strefa bezpieczna, wycena, szablony)
npm run build      # dist/app (strona) + dist/embed (moduł do sklepu + strona przykładowa)
npx vite preview   # podgląd zbudowanej strony
```

Wymagany Node.js 18+. Fonty ładują się z Google Fonts (potrzebny internet).

## Co działa

- **3 kroki:** 1. Wgraj zdjęcie lub wybierz wzór → 2. Dopasuj → 3. Zamów. Cena widoczna cały czas.
- **Start od efektu:** po wgraniu zdjęcia aplikacja sama kadruje je do przodu cukierka i dodaje napis; 4 propozycje układu jednym kliknięciem; 6 szablonów okolicznościowych z miejscami na zdjęcie.
- **Edytor na prawdziwej siatce 70 × 73 mm + 3 mm spadu:** różowy sześciokąt = przód, szare pole = odcinane. W trybie zaawansowanym linie zagięć i strefy bezpieczne.
- **Edycja obrazu:** zamiana, kadrowanie (dowolne, 36:21, kwadrat), obrót, skalowanie, jasność; w trybie zaawansowanym kontrast, nasycenie, temperatura, filtry (cz-b, sepia, vintage, ciepły), odbicia, krycie, przycięcie do kształtu przodu. Edycja niedestrukcyjna – do druku idzie oryginał w pełnej rozdzielczości.
- **Tekst:** 12 fontów z polskimi znakami, wielkość, kolor, pogrubienie, kursywa, wyrównanie; zaawansowane: odstęp liter, interlinia, obrys, obrót. Dwuklik w tekst = edycja.
- **Kształty, warstwy, kolejność, blokowanie, duplikowanie; cofnij/ponów (80 kroków); skróty:** Ctrl+Z / Ctrl+Y, Delete, strzałki (0,5 mm, Shift 5 mm), Esc.
- **Kontrola jakości na bieżąco:** ostrość (DPI), tekst przy krawędzi/zagięciu lub na zawiniętym końcu, za mały tekst, puste miejsce na zdjęcie – z przyciskiem „Napraw automatycznie”. Tekst przy przeciąganiu trzyma się formatu netto.
- **Podgląd:** mini 3D obok edytora (kliknij, aby powiększyć i obracać), w kroku 3: cukierek 3D, płaski papierek, „kilka sztuk”.
- **Wycena:** kg ↔ sztuki (95 szt./kg), progi rabatowe, od 25 kg wycena indywidualna. **Ceny przykładowe** – `src/config/pricing.ts`.
- **PDF do druku:** 76 × 79 mm, BleedBox = strona, TrimBox = 70 × 73 mm, grafika 600 DPI, dopisek producenta zawsze w górnej klapie, linie pomocnicze nie trafiają do pliku.
- **Autozapis** (IndexedDB, co ~1,5 s) i wznowienie projektu po powrocie.
- **Telefon:** układ pionowy, duże przyciski, wgrywanie z aparatu/galerii, przeciąganie palcem.

## Osadzenie w sklepie

`npm run build` tworzy `dist/embed/krowka-designer.js` (jeden plik) i `dist/embed/index.html` (przykładowa strona sklepu).

```html
<script src="https://twoj-serwer/krowka-designer.js"></script>
<krowka-designer
  token="PODPISANY_TOKEN_KLIENTA"
  login-url="/logowanie"
  primary-color="#8e3b16"></krowka-designer>
<script>
  document.querySelector('krowka-designer')
    .addEventListener('krowka:cart:add', (e) => {
      // e.detail: { designId, kg, pcs, total, pdf (Blob), preview (Blob), design (JSON) }
      // tu sklep dodaje produkt „Krówki z nadrukiem” do koszyka
    });
</script>
```

- Moduł to **Web Component z Shadow DOM** – style sklepu i modułu się nie mieszają.
- **Logowanie:** bez `token` moduł prosi o zalogowanie (link z `login-url`). Token (JWT) wydaje sklep; moduł odczytuje z niego `sub`, `name`, `email`, a podpis musi zweryfikować backend. Atrybut `demo` = testowy klient.
- **Backend:** z `api-url` (bez `token`) moduł prosi o e-mail i kod z maila (dostęp po zapisie do newslettera), a projekt wysyła do akceptacji: `POST {api-url}/designs` (multipart: design, pdf, preview, asset, kg, pcs, total, customer). Strona samodzielna bierze adres z `?api=` albo z `<meta name="krowka-api">`, który wstawia backend. Szczegóły: `../README.md`.
- **Bez backendu:** moduł wysyła zdarzenie `krowka:cart:add` (płatność i wysyłka zostają w sklepie).
- **Zdarzenia:** `krowka:design:saved`, `krowka:design:approved`, `krowka:cart:add`, `krowka:price:changed`, `krowka:auth:required` (w iframe także przez `postMessage`).
- Adaptery: `src/adapters/index.ts` (`AuthProvider`, `OrderProvider`).

## Struktura

```
src/config/template.ts    wymiary siatki ze specyfikacji (jedno źródło prawdy)
src/config/templates.ts   szablony okolicznościowe i propozycje układu
src/config/pricing.ts     ceny i progi (przykładowe)
src/lib/                  logika: kontrola jakości, filtry, obrazy, render, PDF, jednostki
src/components/           edytor (Konva), panel narzędzi, kadrowanie, podgląd 3D, podsumowanie
src/state/                stan + historia cofnij/ponów, autozapis
src/adapters/             logowanie i zamówienia (tryb samodzielny / sklep / backend)
src/main.tsx | embed.tsx  wejście: strona samodzielna | moduł <krowka-designer>
tests/                    testy Vitest
```

## Założenia (do potwierdzenia)

- Strefa bezpieczna: 2 mm od linii cięcia, 1,5 mm od zagięć (`SAFE_FROM_CUT`, `SAFE_FROM_FOLD`) – specyfikacja jej nie podaje.
- Podgląd 3D: przyjęto, że na tyle cukierka na wierzchu jest dolna klapa (19 mm); końce zawinięte uproszczone.
- Dopisek producenta: czarny, a na ciemnym tle biały.

## Jeszcze nie zrobione (kolejne etapy)

- Edycja szablonów i cen w panelu (backend, panel grafika i PDF w CMYK są już w `../server`, opis w `../README.md`).
- Wgrywanie PDF i HEIC (iPhone: wybór z galerii zwykle daje JPG), usuwanie tła z logo.
- Gesty dwoma palcami (szczypanie/obrót) – teraz rogi ramki.
- Płatności – docelowo w koszyku sklepu.
