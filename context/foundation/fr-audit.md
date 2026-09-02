# Audyt wymagań FR-001…FR-017 względem kodu i testów

**Data**: 2026-09-02 · **Commit**: `6d386dd` · **Metoda**: każde wymaganie sprawdzone
osobno w kodzie, a tam gdzie to możliwe — odtworzone w działającej aplikacji.

Powód powstania: przy domykaniu zgłoszenia certyfikacyjnego okazało się, że **FR-015 był
spełniony w połowie** — zamknięta pozycja miała pokazywać rozstrzygnięcie _wraz
z uzasadnieniem_, a przy załataniu nie istniało pole, w które dałoby się je wpisać.
Wymaganie wyglądało na zrobione, bo działało dla odrzuceń. Ten audyt sprawdza, czy
pozostałe szesnaście nie ma podobnej połowicznej realizacji.

## Wynik zbiorczy

|                                | Liczba                   |
| ------------------------------ | ------------------------ |
| Spełnione w pełni, z dowodem   | 15                       |
| Spełnione z zastrzeżeniem      | 1 (FR-008)               |
| Świadomie niezrealizowane      | 1 (FR-017, nice-to-have) |
| **Naruszeń wymagań must-have** | **0**                    |

Znaleziono natomiast **jedną rozbieżność między dwoma własnymi artefaktami projektu** —
opisana na końcu, poza tabelą, bo nie jest naruszeniem żadnego FR.

## Wymagania

| FR  | Treść (skrót)                                                                  | Werdykt | Dowód                                                                                                                                                |
| --- | ------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 | Założenie konta e-mailem i hasłem                                              | ✅      | `api/auth/signup.ts`; używane przez wszystkie 16 testów przeglądowych                                                                                |
| 002 | Logowanie i wylogowanie                                                        | ✅      | `api/auth/{signin,signout}.ts`, przycisk w `AppShell.astro:47-52`; test „logowanie działa, gdy pola wypełnia autouzupełnianie"                       |
| 003 | Rejestracja zasobu: nazwa, komponent z wersją, ekspozycja, krytyczność         | ✅      | formularz `assets/index.astro`; helper `addAsset` w testach przeglądowych                                                                            |
| 004 | Przeglądanie listy zasobów                                                     | ✅      | `assets/index.astro`; od `a9ea6de` także liczba otwartych pozycji                                                                                    |
| 005 | Zmiana danych zasobu, w tym ekspozycji                                         | ✅      | `assets/[id].astro:195-205`                                                                                                                          |
| 006 | Odmowa usunięcia zasobu z otwartymi pozycjami, ze wskazaniem blokujących       | ✅      | wyzwalacz `refuse_asset_delete_with_open_items`; test „zasobu z otwartą pozycją nie da się usunąć" sprawdza, że komunikat **wymienia identyfikator** |
| 007 | Dopisanie podatności: identyfikator, ocena, opis                               | ✅      | formularz `assets/[id].astro`; helper `addVulnerability`                                                                                             |
| 008 | Poprawienie danych wprowadzonej podatności                                     | ⚠️      | formularz „Popraw dane" istnieje, ale **wyłącznie dla pozycji otwartej** — patrz niżej                                                               |
| 009 | Usunięcie podatności wprowadzonej omyłkowo                                     | ✅      | dostępne niezależnie od statusu; wyzwalacz `refuse_vulnerability_delete_with_history` odmawia, gdy istnieje historia — zgodnie z US-03               |
| 010 | Priorytet wraz ze składnikami, z których powstał                               | ✅      | `items/[id].astro` sekcja „Skąd ten priorytet"; kolumna SKŁADNIKI w kolejce; test sprawdza obecność rozbicia i wartości                              |
| 011 | Termin działania wyznaczony z priorytetu                                       | ✅      | `priority.ts` `deadlineFor`; kolumna TERMIN; testy jednostkowe terminów                                                                              |
| 012 | Kolejka wg priorytetu, oznaczenie po terminie z liczbą dni                     | ✅      | `queue.astro:47,111`; test „kolejka układa się inaczej niż sortowanie po samej ocenie CVSS"; `priority.test.ts` pokrywa stan po terminie             |
| 013 | Zamknięcie pozycji jako załatanej                                              | ✅      | test „od pustej kolejki do rozstrzygniętej pozycji"                                                                                                  |
| 014 | Odrzucenie z podaniem powodu                                                   | ✅      | ograniczenie `decisions_rejection_needs_reason`; test „odrzucenie bez powodu nie przechodzi"                                                         |
| 015 | Powrót do zamkniętej pozycji i zobaczenie rozstrzygnięcia wraz z uzasadnieniem | ✅      | **domknięte 2026-09-02** commitem `7432130`; test „dowód załatania trafia do historii i zostaje tam po przywróceniu"                                 |
| 016 | Przywrócenie do kolejki; poprzednie rozstrzygnięcie zostaje w historii         | ✅      | funkcja `record_decision`; test przywrócenia sprawdza, że wcześniejszy wpis nie znika                                                                |
| 017 | Streszczenie prostym językiem i propozycja kroków naprawczych                  | —       | **nice-to-have**, świadomie poza MVP: `shape-notes.md` §Non-Goals wyklucza wsparcie generatywne z zakresu zaliczeniowego                             |

## FR-008 — jedyne zastrzeżenie

Formularz „Popraw dane" jest renderowany wyłącznie w gałęzi `isOpen` w
`items/[id].astro`. Pozycji rozstrzygniętej nie da się więc poprawić — ani identyfikatora,
ani oceny, ani opisu.

FR-008 brzmi bez zastrzeżeń: _„Użytkownik może poprawić dane wprowadzonej podatności"_.
Literalnie czytane, ograniczenie jest niezgodne z wymaganiem.

**Ocena: to raczej niedookreślenie wymagania niż usterka produktu.** Zmiana oceny CVSS
albo identyfikatora pozycji, która została już rozstrzygnięta, zmieniałaby wstecz
okoliczności zapadłej decyzji — a cały ten projekt konsekwentnie tego zabrania. Obecne
zachowanie jest spójne z US-03 i z niezmiennikami śladu decyzji.

Do rozstrzygnięcia produktowego, nie do naprawy na ślepo: **albo** dopisać do FR-008
warunek „dopóki pozycja jest otwarta", **albo** świadomie dopuścić edycję rozstrzygniętej
pozycji. Dziś PRD nie zapisuje ani jednego, ani drugiego, więc interfejs milcząco
rozstrzygnął to za dokument.

## Wymagania niefunkcjonalne

| NFR | Treść                                                          | Werdykt                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | Wejście do kolejki i zmiana uporządkowania odczuwalnie szybkie | **niezmierzone** — plan testów odnotowuje to jako należące do obserwowalności, nie do testu                                                                                                                                                      |
| 02  | Operacja dłuższa niż dwie sekundy informuje o postępie         | **częściowo** — `SubmitButton` z `useFormStatus` obsługuje formularze uwierzytelniania; pozostałe są zwykłym POST-em z przeładowaniem strony, gdzie sygnał daje przeglądarka. Żadna operacja w tym produkcie nie zbliża się dziś do dwóch sekund |
| 03  | Całą podstawową ścieżkę da się przejść wyłącznie klawiaturą    | **niesprawdzone** — nic tego nie weryfikuje. Formularze są natywne, więc prawdopodobnie działa, ale to przypuszczenie, nie dowód                                                                                                                 |
| 04  | Niedostępność funkcji streszczeń nie psuje reszty              | **nie dotyczy** — FR-017 niezrealizowane                                                                                                                                                                                                         |
| 05  | Brak dostępu do danych innego konta żadną ścieżką              | ✅ polityki dostępu w bazie; `tests/integration/isolation.test.ts`                                                                                                                                                                               |

## Znalezisko poza tabelą: priorytet pozycji rozstrzygniętej przelicza się przy odczycie

**To nie jest naruszenie żadnego FR** — dlatego stoi osobno. Jest natomiast rozbieżnością
między dwoma artefaktami tego projektu.

**Co się dzieje.** Odtworzone w działającej aplikacji, nie wywnioskowane z kodu:

1. Zasób wystawiony do sieci publicznej, krytyczność wysoka, pozycja o ocenie CVSS 8.0 →
   priorytet **krytyczny 8.00**
2. Pozycja oznaczona jako **załatana** → nadal krytyczny 8.00
3. Ekspozycja zasobu zmieniona na **odcięty**
4. Powrót na tę samą, wciąż **rozstrzygniętą** pozycję → priorytet **średni 2.40**

**Dlaczego.** `getVulnerabilityWithAsset` w `services/queue.ts` woła `entryFor`, które
wylicza ocenę z **bieżących** danych zasobu bez rozróżnienia statusu pozycji. Strona
szczegółów pozycji nie korzysta z agregatu.

**Z czym to koliduje.** Agregat `MonitoredAsset.withExposure` implementuje regułę
poprawnie — przelicza wyłącznie pozycje otwarte — i tłumaczy to komentarzem:
_„rozstrzygnięcie zapadło w określonych okolicznościach i zmiana zasobu nie może go
zmieniać wstecz"_. `01-domain-distillation.md` zapisuje ten niezmiennik i już wtedy
oznaczył go jako **deklarowany, nie egzekwowany**. Przewidywał jednak inny mechanizm
złamania — zapisanie priorytetu w wierszu. Rzeczywisty mechanizm jest odwrotny: priorytet
**nie jest** przechowywany i właśnie dlatego przelicza się także tam, gdzie nie powinien.

**Czego to NIE narusza.** US-02 mówi: _„Pozycje już rozstrzygnięte nie zmieniają swojego
zapisanego rozstrzygnięcia"_. Zapisane rozstrzygnięcie — rodzaj, uzasadnienie, data —
jest nietknięte i pozostaje niezmienialne. Zmienia się wyłącznie liczba wyświetlana obok.

**Waga.** Niska dla użytkownika: kolejka pokazuje wyłącznie pozycje otwarte, więc
uporządkowanie nie jest dotknięte. Wysoka dla spójności modelu: agregat powstał właśnie po
to, żeby sprowadzić ten niezmiennik do kodu domenowego, a strona, która pokazuje liczbę,
go omija.

**Propozycja.** Przy odczycie rozstrzygniętej pozycji wyliczać ocenę z okoliczności
z chwili rozstrzygnięcia albo w ogóle nie pokazywać jej jako bieżącego priorytetu.
Pierwsze wymaga zapisania tych okoliczności — czego dziś nie robimy. Drugie jest tańsze
i uczciwsze: pozycja rozstrzygnięta nie ma priorytetu, bo nie stoi w kolejce.

## Wnioski

Szesnaście wymagań must-have jest zrealizowanych, jedno z nich (FR-015) domknięte dwie
godziny przed tym audytem, jedno (FR-008) węższe niż zapis w PRD z powodów, które produkt
konsekwentnie stosuje gdzie indziej.

Wzorzec z audytu FR-015 się nie powtórzył: nie znaleziono drugiego wymagania spełnionego
w połowie. Znaleziono natomiast trzecie wystąpienie **innego** wzorca, znanego z raportu
architektonicznego — reguła zaimplementowana w jednym miejscu i omijana przez drugie.
