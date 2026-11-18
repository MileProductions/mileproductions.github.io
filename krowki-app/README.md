# Krówki z własnym projektem: konfigurator, backend i panel grafika

Etap 1 z planu integracji ze sklepem krowki24.pl:

- **backend** zapisuje projekty z konfiguratora (projekt, PDF, podgląd, oryginały zdjęć) i nadaje im numer, np. `KR-2611-0042`,
- **PDF do druku w CMYK**: Ghostscript zamienia plik RGB z konfiguratora na PDF/X-3 w CMYK z profilem FOGRA39,
- **dostęp przez newsletter** (wariant C): kto poda e-mail, zaznaczy zgodę i potwierdzi adres kodem albo linkiem z maila, może projektować. Konto w sklepie jest potrzebne dopiero przy zamówieniu,
- **panel grafika** pod `/panel/`: lista projektów, podgląd, akceptacja albo „do poprawy” z komentarzem (klient dostaje maila), powiązanie z numerem zamówienia w Shoperze, pobieranie PDF, lista zapisów do newslettera (CSV) i usuwanie danych klienta (RODO).

Statyczne demo na GitHub Pages (`/krówki/`) działa dalej bez zmian, w trybie pokazowym. Ten folder nie jest publikowany na Pages (`_config.yml`).

```
krowki-app/
  designer/   źródła konfiguratora (React + Vite), te same co w krowki-designer.zip, plus adapter do backendu
  server/     backend (Node.js 22, Express, SQLite, Ghostscript) i panel grafika (server/panel)
  Dockerfile, docker-compose.yml   wszystko w jednym kontenerze
```

## Jak to działa dla klienta

1. Klient otwiera konfigurator, np. `https://projektuj.krowki24.pl/` albo ramkę na stronie sklepu.
2. Podaje e-mail i zaznacza zgodę na newsletter. Dostaje maila z 6-cyfrowym kodem i przyciskiem. Wpisanie kodu albo kliknięcie przycisku potwierdza zapis (double opt-in) i otwiera projektanta. Przy kolejnej wizycie zgoda nie jest już potrzebna, wystarczy kod. Sesja trwa 90 dni.
3. Projektuje, w kroku 3 akceptuje projekt i klika **„Wyślij projekt do akceptacji”**. Dostaje numer projektu na ekranie i w mailu oraz przycisk „Przejdź do sklepu” (`SHOP_PRODUCT_URL`), gdzie zamawia produkt i wpisuje numer projektu.
4. Grafik dostaje powiadomienie (`NOTIFY_EMAIL`), w panelu akceptuje projekt albo odsyła go do poprawy z komentarzem. Klient dostaje maila w obu przypadkach.
5. Grafik ręcznie wpisuje numer zamówienia z Shopera („Zamówiony…”), potem „W produkcji” i „Zrealizowany”. Automatyczne powiązanie przez webhook Shopera to etap 2.

## Uruchomienie lokalnie

Wymagane: Node.js 22.13+, Ghostscript (`apt install ghostscript` / `brew install ghostscript`) i profil ICC FOGRA39 (na Linuksie pakiet `colord-data`, na macOS wskaż profil w `ICC_PROFILE`).

```bash
cd krowki-app/designer && npm ci && npm run build     # buduje konfigurator do designer/dist
cd ../server && npm ci
cp .env.example .env                                   # ustaw PUBLIC_URL=http://localhost:8080
npm run admin:add -- grafik@firma.pl "Anna Kowalska"   # konto do panelu (zapyta o hasło)
npm start                                              # http://localhost:8080 i http://localhost:8080/panel/
npm test                                               # testy API (z konwersją CMYK, jeśli jest Ghostscript)
```

Bez `SMTP_URL` maile nie wychodzą, tylko trafiają do logu i do `data/outbox/`, skąd można przepisać kod.

## Wdrożenie

Najprościej VPS z Dockerem i subdomena, np. `projektuj.krowki24.pl`:

```bash
cd krowki-app
cp server/.env.example .env     # uzupełnij: PUBLIC_URL, SMTP_URL, NOTIFY_EMAIL, SHOP_PRODUCT_URL, ALLOWED_ORIGINS
docker compose up -d --build
docker compose exec app npm run admin:add -- grafik@krowki24.pl "Imię Nazwisko"
```

Przed kontenerem reverse proxy z HTTPS (Caddy albo nginx). Kopia zapasowa to wolumen `krowki-data` (baza `krowki.sqlite` i folder `files/`). Raz dziennie warto uruchamiać `docker compose exec app npm run cleanup`, który usuwa stare projekty po `RETENTION_DAYS` (RODO).

Wszystkie ustawienia są opisane w [`server/.env.example`](server/.env.example).

## Osadzenie w sklepie Shoper

**Ramka (zawsze działa):**

```html
<iframe src="https://projektuj.krowki24.pl/" style="width:100%;height:900px;border:0" allow="camera"></iframe>
```

W ramce klient potwierdza dostęp kodem z maila. Link z maila otwiera konfigurator w nowej karcie.

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
| `POST /api/auth/request` `{email, consent}` | wszyscy | wysyła kod i link (zgoda wymagana przy pierwszym zapisie) |
| `POST /api/auth/verify` `{email, code}` | wszyscy | potwierdza zapis i zwraca token sesji |
| `GET /potwierdz?t=…` | link z maila | potwierdza i wraca do konfiguratora z sesją |
| `GET /api/me`, `POST /api/auth/logout` | klient | sesja |
| `POST /api/designs` (multipart: `design`, `pdf`, `preview`, `asset`…, `kg`, `pcs`, `total`, `customer`) | klient | zapis projektu, numer, maile, kolejka CMYK |
| `GET /api/designs`, `GET /api/designs/:numer` | klient | własne projekty i ich status |
| `/api/admin/*` | grafik (cookie) | lista, szczegóły, status, pliki, newsletter CSV, usuwanie danych |

Klient widzi tylko swoje projekty. Hasła grafików są haszowane (scrypt), sesje panelu w ciasteczku `HttpOnly; SameSite=Strict`, zapytania zmieniające dane w panelu sprawdzają nagłówek `Origin`. Limity prób: kody, logowanie, wysyłki.

## Plik do druku

- Konfigurator generuje PDF 76 × 79 mm (70 × 73 mm + 3 mm spadu, `TrimBox`/`BleedBox`), grafika 600 DPI w RGB. Backend odrzuca plik o innym formacie.
- Ghostscript zamienia go na CMYK z profilem `ICC_PROFILE` (domyślnie `FOGRA39L_coated.icc`) i dopisuje OutputIntent PDF/X-3. Obrazy nie są ponownie kompresowane stratnie ani zmniejszane. Wynik jest sprawdzany: format, ramki, wszystkie obrazy w CMYK.
- **Do potwierdzenia z drukarnią:** profil (papier do papierków bywa niepowlekany, wtedy np. FOGRA29 / PSO Uncoated) i rodzaj czerni. Cały papierek jest jednym obrazem, więc czarny tekst (też dopisek producenta) wychodzi jako czerń z 4 kolorów, nie czysty K. Jeśli drukarnia tego wymaga, kolejny krok to tekst jako wektor w PDF.

## Czego jeszcze nie ma (etap 2)

- Webhook zamówień Shopera i automatyczne „Zamówiony”, dodawanie do koszyka z numerem projektu.
- „Moje projekty” w konfiguratorze (API `GET /api/designs` już jest) i zapis szkicu na serwerze przed wysłaniem.
- Bezpośredni zapis do listy newslettera w Shoperze. Dziś: webhook `NEWSLETTER_WEBHOOK_URL` (np. Make/Zapier, MailerLite, Brevo) albo eksport CSV z panelu.
- Przechowywanie plików w S3 zamiast na dysku serwera (`server/src/storage.js` ma do tego mały interfejs).
