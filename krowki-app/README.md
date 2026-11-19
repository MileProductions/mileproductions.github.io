# Krówki z własnym projektem: konfigurator, backend i panel produkcji

Etap 1 z planu integracji ze sklepem krowki24.pl:

- **backend** zapisuje projekty z konfiguratora (projekt, PDF, podgląd, oryginały zdjęć) i nadaje im numer, np. `KR-2611-0042`,
- **PDF do druku w CMYK**: Ghostscript zamienia plik RGB z konfiguratora na PDF/X-3 w CMYK z profilem FOGRA39,
- **konfigurator dla wszystkich**: bez logowania i bez zapisu do newslettera. Klient podaje e-mail dopiero przy zapisie projektu (dostaje na niego numer projektu) i może dobrowolnie zapisać się do newslettera (potwierdzenie linkiem z maila, double opt-in). Konto w sklepie jest potrzebne dopiero przy zamówieniu,
- **panel produkcji** pod `/panel/`: lista projektów gotowych do druku, podgląd, powiązanie z numerem zamówienia w Shoperze, statusy „W produkcji” (klient dostaje maila) i „Zrealizowany”, pobieranie PDF, lista zapisów do newslettera (CSV) i usuwanie danych klienta (RODO).

Klient sam przygotowuje i akceptuje projekt. Nie ma ręcznej akceptacji przez grafika: po zapisaniu system automatycznie sprawdza plik (format siatki, spad, konwersja do CMYK) i projekt jest od razu „Gotowy do druku”. Jakość pilnuje konfigurator: blokuje zbyt małe zdjęcia i ostrzega przed tekstem przy krawędzi.

Statyczne demo na GitHub Pages (`/krówki/`) działa dalej bez zmian, w trybie pokazowym. Ten folder nie jest publikowany na Pages (`_config.yml`).

```
krowki-app/
  designer/   źródła konfiguratora (React + Vite), te same co w krowki-designer.zip, plus adapter do backendu
  server/     backend (Node.js 22, Express, SQLite, Ghostscript) i panel produkcji (server/panel)
  Dockerfile, docker-compose.yml   wszystko w jednym kontenerze
```

## Wersja testowa na GitHub Pages

`https://mileproductions.github.io/krowki-test/` (panel: `/krowki-test/panel/`, logowanie `produkcja@test.pl` / `krowki-test`).
GitHub Pages nie uruchamia serwera, więc backend udaje tam service worker (`pages-test/sw.js`): to samo API, dane w IndexedDB przeglądarki. Maile nie wychodzą („wysłane” maile, także link potwierdzający newsletter, są w panelu w zakładce „Maile (test)”), a PDF w CMYK powstaje tylko na prawdziwym serwerze. Konfigurator i panel to te same pliki co na serwerze.
Przebudowanie: `node pages-test/build.mjs` (z folderu `krowki-app/`).

## Jak to działa dla klienta

1. Klient otwiera konfigurator, np. `https://projektuj.krowki24.pl/` albo ramkę na stronie sklepu.
2. Projektuje od razu, bez logowania. Projekt zapisuje się w przeglądarce (autozapis).
3. W kroku 3 sprawdza podgląd, podaje imię i e-mail, opcjonalnie zaznacza newsletter, akceptuje projekt i klika **„Zapisz projekt do druku”**. Dostaje numer projektu na ekranie i w mailu oraz przycisk „Przejdź do sklepu” (`SHOP_PRODUCT_URL`), gdzie zamawia produkt i wpisuje numer projektu. Jeśli zaznaczył newsletter, dostaje osobny mail z linkiem potwierdzającym.
4. Serwer automatycznie sprawdza plik i robi PDF w CMYK. Projekt ma od razu status „Gotowy do druku”. Produkcja dostaje powiadomienie (`NOTIFY_EMAIL`), także gdy konwersja do CMYK się nie uda.
5. W panelu produkcja wpisuje numer zamówienia z Shopera („Zamówiony…”), potem „W produkcji” (mail do klienta) i „Zrealizowany”. Automatyczne powiązanie przez webhook Shopera to etap 2.

## Uruchomienie lokalnie

Wymagane: Node.js 22.13+, Ghostscript (`apt install ghostscript` / `brew install ghostscript`) i profil ICC FOGRA39 (na Linuksie pakiet `colord-data`, na macOS wskaż profil w `ICC_PROFILE`).

```bash
cd krowki-app/designer && npm ci && npm run build     # buduje konfigurator do designer/dist
cd ../server && npm ci
cp .env.example .env                                   # ustaw PUBLIC_URL=http://localhost:8080
npm run admin:add -- produkcja@firma.pl "Anna Kowalska"   # konto do panelu (zapyta o hasło)
npm start                                              # http://localhost:8080 i http://localhost:8080/panel/
npm test                                               # testy API (z konwersją CMYK, jeśli jest Ghostscript)
```

Bez `SMTP_URL` maile nie wychodzą, tylko trafiają do logu i do `data/outbox/`.

## Wdrożenie

Najprościej VPS z Dockerem i subdomena, np. `projektuj.krowki24.pl`:

```bash
cd krowki-app
cp server/.env.example .env     # uzupełnij: PUBLIC_URL, SMTP_URL, NOTIFY_EMAIL, SHOP_PRODUCT_URL, ALLOWED_ORIGINS
docker compose up -d --build
docker compose exec app npm run admin:add -- produkcja@krowki24.pl "Imię Nazwisko"
```

Przed kontenerem reverse proxy z HTTPS (Caddy albo nginx). Kopia zapasowa to wolumen `krowki-data` (baza `krowki.sqlite` i folder `files/`). Raz dziennie warto uruchamiać `docker compose exec app npm run cleanup`, który usuwa stare projekty po `RETENTION_DAYS` (RODO).

Wszystkie ustawienia są opisane w [`server/.env.example`](server/.env.example).

## Osadzenie w sklepie Shoper

**Ramka (zawsze działa):**

```html
<iframe src="https://projektuj.krowki24.pl/" style="width:100%;height:900px;border:0" allow="camera"></iframe>
```

Konfigurator w ramce działa od razu, bez logowania.

**Komponent (jeśli szablon sklepu pozwala na własne skrypty):**

```html
<script src="https://projektuj.krowki24.pl/embed/krowka-designer.js"></script>
<krowka-designer api-url="https://projektuj.krowki24.pl/api" primary-color="#8e3b16"></krowka-designer>
```

Domena sklepu musi być wtedy w `ALLOWED_ORIGINS`.

## API (skrót)

| Metoda i adres | Kto | Co robi |
| --- | --- | --- |
| `GET /api/config` | wszyscy | treść zgody, link do polityki prywatności, adres produktu |
| `POST /api/designs` (multipart: `design`, `pdf`, `preview`, `asset`…, `kg`, `pcs`, `total`, `customer` = JSON z `email`, `name`, `phone`, `notes`, `newsletter`) | wszyscy | zapis projektu, automatyczne sprawdzenie, numer, maile, kolejka CMYK; `newsletter: true` wysyła link potwierdzający |
| `GET /potwierdz?t=…` | link z maila | potwierdza zapis do newslettera |
| `/api/admin/*` | produkcja (cookie) | lista, szczegóły, status, pliki, newsletter CSV, usuwanie danych |

Hasła kont panelu są haszowane (scrypt), sesje panelu w ciasteczku `HttpOnly; SameSite=Strict`, zapytania zmieniające dane w panelu sprawdzają nagłówek `Origin`. Limity prób: logowanie do panelu i liczba zapisów projektów z jednego adresu IP.

## Plik do druku

- Konfigurator generuje PDF 76 × 79 mm (70 × 73 mm + 3 mm spadu, `TrimBox`/`BleedBox`), grafika 600 DPI w RGB. Backend odrzuca plik o innym formacie.
- Ghostscript zamienia go na CMYK z profilem `ICC_PROFILE` (domyślnie `FOGRA39L_coated.icc`) i dopisuje OutputIntent PDF/X-3. Obrazy nie są ponownie kompresowane stratnie ani zmniejszane. Wynik jest sprawdzany: format, ramki, wszystkie obrazy w CMYK.
- **Do potwierdzenia z drukarnią:** profil (papier do papierków bywa niepowlekany, wtedy np. FOGRA29 / PSO Uncoated) i rodzaj czerni. Cały papierek jest jednym obrazem, więc czarny tekst (też dopisek producenta) wychodzi jako czerń z 4 kolorów, nie czysty K. Jeśli drukarnia tego wymaga, kolejny krok to tekst jako wektor w PDF.

## Czego jeszcze nie ma (etap 2)

- Webhook zamówień Shopera i automatyczne „Zamówiony”, dodawanie do koszyka z numerem projektu.
- „Moje projekty” (np. po zalogowaniu kontem sklepu) i zapis szkicu na serwerze przed wysłaniem.
- Bezpośredni zapis do listy newslettera w Shoperze. Dziś: webhook `NEWSLETTER_WEBHOOK_URL` (np. Make/Zapier, MailerLite, Brevo) albo eksport CSV z panelu.
- Przechowywanie plików w S3 zamiast na dysku serwera (`server/src/storage.js` ma do tego mały interfejs).
