# PatchQueue — dokumentacja zgłoszenia

**Produkt:** kolejka łatania podatności, która porządkuje pracę według tego, _gdzie_
podatność stoi, a nie tylko jak groźna jest sama w sobie. Ta sama podatność na serwerze
wystawionym do internetu i na maszynie odciętej od sieci dostaje inny priorytet i inny
termin. To odróżnia produkt od arkusza posortowanego po ocenie CVSS.

|                      |                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Aplikacja            | https://patchqueue.paszekkrystian-19.workers.dev                                          |
| Repozytorium         | https://github.com/paszq/patchqueue                                                       |
| Konto demonstracyjne | `demo@example.com` / `Demo12345!`                                                         |
| Stan                 | 28 commitów, 78 testów jednostkowych i integracyjnych, 14 przeglądowych, pipeline zielony |

### Ścieżka do przeklikania (2 minuty)

1. Zaloguj się kontem demonstracyjnym — dane są już wypełnione.
2. **Kolejka** — na górze stoi `CVE-2026-1111` z oceną **5.0**, a niżej `CVE-2026-9999`
   z oceną **9.8**. Pierwsza siedzi na serwerze wystawionym do internetu, druga na
   maszynie odciętej od sieci. Sortowanie po samej ocenie CVSS dałoby odwrotną kolejność
   — to jest teza produktu w jednym ekranie.
3. Kliknij **„Skąd ten priorytet"** przy dowolnej pozycji — rozwija się rozbicie wyniku
   na ocenę, wagę ekspozycji i wagę krytyczności.
4. Wejdź w pozycję → **Odrzuć** bez wpisania powodu. Formularz nie pozwoli, a gdyby
   żądanie ominęło formularz, odrzuci je ograniczenie w bazie.
5. Odrzuć z powodem, potem **przywróć** pozycję. Historia rozstrzygnięć rośnie o kolejny
   wpis — nic się nie nadpisuje.
6. Na innej pozycji wpisz **dowód załatania** i oznacz ją jako załataną. Dowód trafia do
   tej samej niezmienialnej historii co powód odrzucenia i zostaje tam po przywróceniu.
7. **Zasoby** → kolumna **Otwarte pozycje** pokazuje, gdzie zaległość rośnie. Wejdź w
   zasób i zmień jego ekspozycję: priorytety otwartych pozycji przeliczają się,
   rozstrzygnięte zostają nietknięte, a licznik spada dopiero po rozstrzygnięciu.
8. Spróbuj usunąć zasób z otwartymi pozycjami. Odmowa wymienia blokujące pozycje z nazwy.
9. **Wczytywanie** → załącz plik CSV z raportem skanera albo wklej jego treść. Znaleziska
   dopasowują się do zasobów po komponencie, powtórne wczytanie tego samego pliku niczego
   nie dubluje, a znalezisko bez pasującego zasobu jest raportowane jako pominięte, nie
   wchodzi po cichu.

---

## Blok 🚀 Builder

Produkt działa od logowania po rozstrzygnięcie, stoi pod publicznym adresem i jest
opisany dokumentami, z których korzysta agent.

**Reguła priorytetu jako czysta funkcja** — `src/lib/domain/priority.ts`, 0 zależności.
Wynik = ocena CVSS × waga ekspozycji × waga krytyczności. Obie skale są ściśle malejące,
więc guardrail „podatność na zasobie wystawionym nigdy nie niżej niż na odciętym"
(`context/foundation/prd.md`, sekcja Guardrails) nie jest założeniem, którego trzeba
pilnować, tylko własnością konstrukcyjną iloczynu. Test sprawdza to wyczerpująco na
pełnej siatce: 8 wartości CVSS × 3 ekspozycje × 3 krytyczności, w obie strony po każdej
ze skal — `src/lib/domain/priority.test.ts`. Uzasadnienie doboru wag i progów:
`context/changes/priority-visible/change.md`.
Commit: `131bed5`.

**Priorytet nie jest przechowywany.** Wynika z reguły i liczy się przy odczycie —
inaczej istniałby w dwóch miejscach i mógłby się rozjechać przy zmianie wag.

**Izolacja kont wymuszana przez bazę, nie przez kod aplikacji** — polityki dostępu na
poziomie wierszy w `supabase/migrations/20260820150000_initial_schema.sql`. Zapytanie bez
właściwego użytkownika nie zwraca cudzych danych niezależnie od tego, co zrobi warstwa
aplikacji. Dowód: `tests/integration/isolation.test.ts`.
Commit: `9eafa9c`, uzasadnienie: `context/changes/account-isolation/change.md`.

**Trzy guardraile produktu realizowane strukturalnie:**

| Guardrail                                         | Jak jest egzekwowany                                                                                                                                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rozstrzygnięcie nie znika i nie da się go zmienić | Tabela `decisions` nie ma polityki `UPDATE` ani `DELETE`. Skoro polityki nie ma, operacja jest odrzucana przez bazę                                                                                                     |
| Odrzucenie bez powodu jest niemożliwe             | Ograniczenie `decisions_rejection_needs_reason`                                                                                                                                                                         |
| Zasobu z otwartymi pozycjami nie da się usunąć    | Wyzwalacz `refuse_asset_delete_with_open_items` — świadomie wyzwalacz, nie klucz obcy `ON DELETE RESTRICT`, bo klucz blokowałby usunięcie także wtedy, gdy wszystkie pozycje są rozstrzygnięte, a reguła mówi co innego |

**Dokumenty kontekstowe:** `prd.md` (wymagania, historyjki, guardraile), `roadmap.md`
(dziewięć pionowych przekrojów), `tech-stack.md` (wybór stacku i przyjęte ryzyka),
`shape-notes.md` (dlaczego produkt wygląda tak, a nie inaczej). Wszystkie w
`context/foundation/`. Reguły dla agenta: `CLAUDE.md`.

Cała ścieżka główna S-01…S-08: commit `721dace`.

---

## Blok 🔧 Architekt

**Mapa repozytorium z jawnym zasięgiem pomiaru** — `context/map/repo-map.md`, złożona
z trzech artefaktów (terytorium z historii gita, struktura z `dependency-cruiser`,
kontrybutorzy). Wynik: zero cykli zależności, warstwy układają się w jeden kierunek,
najgęstszym punktem jest warstwa danych (jeden plik, 335 linii, dziewięciu zależnych).

Najważniejsze w tej mapie jest jednak to, czego **nie** obejmuje. Sekcja „Ograniczenia"
mówi wprost: trzy guardraile produktu żyją w SQL-u, poza zasięgiem jakiegokolwiek
narzędzia w zestawieniu, a graf `.astro` powstał z odczytu importów wyrażeniem
regularnym, nie z analizy składniowej. Mapa mówi, co od czego zależy — i wyłącznie tam,
gdzie sięgnęły narzędzia.
Commit: `276a3fc`.

**Ranking okazji do refaktoru zweryfikowany `ast-grep`** —
`context/changes/refactor-opportunities/research.md`. Sześciu kandydatów, każde
twierdzenie oznaczone jako **evidence** albo **inference**, trzech zakwalifikowanych do
audytu, trzech odrzuconych z uzasadnieniem. Odrzucenia są równie istotne: import modułu
domenowego w `PriorityBadge.astro` wygląda na naruszenie warstw, ale jest importem
wyłącznie typu — brak sprzężenia w czasie wykonania.
Commit: `44a598d`.

**Dwa wykonane refaktory:**

_Kandydat 1 — rozstrzygnięcie jako jedna operacja atomowa_ (`bf9e5af`). `recordDecision`
wykonywało dwa niezależne zapisy — wpis do historii i zmianę stanu pozycji — bez żadnego
mechanizmu spójności. Naprawione funkcją `record_decision` w bazie, migracja
`20260821140000_atomic_decision.sql`. Szerzej w sekcji o guardrailach poniżej.

_Kandydat 2 — podział warstwy danych wzdłuż pojęć domenowych_ (`5cca7b1`). Jeden plik
na 335 linii i 14 eksportowanych funkcji rozdzielony na `assets.ts`, `vulnerabilities.ts`,
`decisions.ts`, `queue.ts` i wspólne `rows.ts`, przy zachowaniu punktu wejścia
`patchqueue.ts` re-eksportującego części — dziewięć modułów zależnych nie musiało się
zmienić.

**Plan warstwy chroniącej przed przeciekiem dostawcy** —
`context/domain/03-anti-corruption-layer.md`. Siedem plików produkcyjnych zna pakiet
dostawcy, 19 wystąpień typu `SupabaseClient`. Wybrany przeciek #1 nie jest jednak tym
najliczniejszym: to typ `User` w `src/env.d.ts`, bo wchodzi do `App.Locals` — globalnej
przestrzeni nazw frameworka, którą widzi każda strona i każdy punkt końcowy, nawet bez
importu pakietu. Przeciek niewidoczny w imporcie jest trudniejszy do wykrycia niż
dziewiętnaście jawnych. **Plan świadomie nie został wykonany** — `tech-stack.md` przyjmuje
sprzężenie z jednym dostawcą jako zaakceptowane ryzyko, więc nie ma tu rozjazdu
intencja-vs-kod, jest dług, którego koszt został wyceniony.
Commity: `eaadb90`, `0bab983`.

**Destylacja domeny** — `context/domain/01-domain-distillation.md`. Czternaście pojęć
z dokumentów i kodu, przypisanie subdomen (Core / Supporting / Generic), trzech
kandydatów na agregaty z niezmiennikami i statusem egzekwowania każdego. Najciekawszy
wynik: **wszystkie twarde niezmienniki były egzekwowane w bazie, a nie w kodzie
domenowym** — więc ani analiza statyczna, ani testy jednostkowe ich nie widziały.
Commit: `94e810f`.

**Agregat: zasób wraz ze swoimi pozycjami** — `src/lib/domain/monitored-asset.ts`,
`5e7cb74`. Odpowiedź na kandydata #1 z destylacji. Jeden z jego niezmienników — „zmiana
ekspozycji przelicza wszystkie otwarte pozycje, a rozstrzygniętych nie" — nie miał
żadnego strażnika w kodzie; działał wyłącznie dlatego, że priorytet nie jest
przechowywany. Pierwsza naturalna optymalizacja przy rosnącej kolejce, czyli zapisanie
priorytetu w wierszu, złamałaby go po cichu. Agregat sprowadza tę wiedzę do kodu
domenowego, **nie zabierając bazie roli ostatecznego strażnika** — wyzwalacze zostają,
bo chronią też przed zapisem z pominięciem aplikacji.

---

## Blok 🏆 Champion

**Bramki jakości** — `npm run lint`, `typecheck`, `test`, `build`, plus pięć reguł
`dependency-cruiser`, z których dwie pilnują czystości domeny (`domain-stays-pure`,
`domain-no-external-io`). Dzięki nim zdanie „reguła domenowa nie zależy od niczego" jest
sprawdzane, a nie deklarowane.

**Pipeline** — `.github/workflows/ci.yml`, trzy zadania w zależności: `gates` →
`e2e` → `deploy`. Commit `6f09d10`, sekrety `7d2d0a8`.

**Ciągłe wdrażanie z weryfikacją żywej instancji** (`55a2837`) — po `wrangler deploy`
ten sam zestaw testów przeglądowych przechodzi raz jeszcze, tym razem przez opublikowaną
instancję, sterowany zmienną `BASE_URL`. Komentarz w workflow mówi, po co: _„wdrożenie,
którego nikt nie sprawdził, to tylko nadzieja"_. Ta sama konfiguracja pozwala uruchomić
zestaw przeciw produkcji lokalnie:

```bash
BASE_URL=https://patchqueue.paszekkrystian-19.workers.dev npx playwright test
```

**Strażnik przed cichym pomijaniem testów** (`7f9e7ad`) — opisany w następnej sekcji,
bo to on wykrył najpoważniejszą z pięciu usterek pomiaru.

**Agent przeglądający pull requesty** — `.github/workflows/impl-review.yml` leży gotowy:
odkrywa plan zmiany, sprawdza dryf implementacji względem planu, commituje raport na
gałąź i publikuje status `impl-review-ci/verdict`. Nie jest włączony — wymaga sekretu
`ANTHROPIC_API_KEY`, płatnego niezależnie od subskrypcji.

---

## Wątek przekrojowy: pięć razy zielony wynik znaczył „nie sprawdziłem"

To najmocniejsza rzecz, jaką ten projekt pokazał, i jedyny powód, dla którego opisuję ją
osobno zamiast rozdzielić między bloki. Pięć razy zestaw był zielony i pięć razy zieleń
nie znaczyła „jest dobrze", tylko „nie sprawdziłem". Za każdym razem wykrycie polegało na
zadaniu pytania **co dokładnie zostało sprawdzone**, zamiast **czy jest zielono**.

**1. Testy izolacji kont pomijane w pipelinie od początku.** Krok z testami nie
dostawał sekretów Supabase, więc dziesięć testów izolacji pomijało się cicho, a zadanie
i tak świeciło na zielono. Wykryte przez strażnika dodanego commitem wcześniej: testy
zgłaszają teraz błąd, gdy w pipelinie brakuje konfiguracji, a lokalnie nadal pomijają się
z ostrzeżeniem. Commit `7f9e7ad` był jednocześnie sprawdzianem — jeśli testy pomijały się
mimo dodanych sekretów, przebieg miał zaświecić na czerwono. Zaświecił.
Naprawa: `e989829`.

**2. Testy przeglądowe pomijane lokalnie.** Konfiguracja Playwrighta nie czytała `.env`,
więc proces uruchamiający testy nie widział konfiguracji i cały zestaw pomijał się po
cichu — mimo że serwer deweloperski działał poprawnie. Naprawa w `playwright.config.ts`:
jawne `process.loadEnvFile(".env")` z komentarzem tłumaczącym, przed czym to chroni.

**3. `dependency-cruiser` nie parsował `.astro`.** Raport „zero naruszeń" przy około
połowie systemu poza grafem — trzydzieści plików widoku po prostu nie istniało dla
narzędzia. Nie dało się tego naprawić w narzędziu, więc trafiło do sekcji „Ograniczenia"
mapy repozytorium jako jawnie odnotowany zasięg pomiaru, razem z informacją, że graf
`.astro` powstał z wyrażenia regularnego.

**4. `ast-grep` zwracał zero przy funkcjach mapujących.** Wzorzec nie obsługiwał
częściowych nazw, więc weryfikacja rankingu refaktoru wykazała zero tam, gdzie
naprawdę były cztery funkcje. Widać to w `research.md` jako zapis „4 funkcje (raport: 3)"
— rozbieżność między tym, co znalazło narzędzie, a tym, co znalazło niezależne
sprawdzenie, została zostawiona w dokumencie zamiast wygładzona.

**5. Asercja „ma być błąd" spełniana przez brak funkcji w bazie.** Najsubtelniejszy
przypadek. Test rozstrzygnięcia atomowego oczekiwał błędu — i dostawał go, ale z
niewłaściwego powodu: dopóki migracja nie została wgrana, błędem było „funkcja
`record_decision` nie istnieje", a nie odrzucenie przez regułę domenową. Test przechodził
zanim naprawa w ogóle powstała. Rozwiązanie w
`tests/integration/atomic-decisions.test.ts:61-71` — funkcja `expectDomainRejection`
odróżnia jedno od drugiego i zawodzi z wyraźnym komunikatem, gdy funkcji brakuje.

Wspólny mianownik: **narzędzie, które nic nie znalazło, i narzędzie, które nie
patrzyło, dają identyczny wynik na ekranie.** Rozróżnia je dopiero pytanie o zasięg.

---

## Wątek drugi: guardrail zabezpieczający jeden kierunek otworzył drugi

Historia rozstrzygnięć była chroniona mocno: tabela `decisions` nie ma polityki `UPDATE`
ani `DELETE`, więc wpisu nie da się zmienić ani skasować żadną ścieżką dostępną
aplikacji. Guardrail z PRD brzmiał: _„raz zapisane rozstrzygnięcie nie znika i pozostaje
dostępne wraz z uzasadnieniem"_.

Chronił przed zniknięciem zapisu. Nie chronił przed zapisem, który nigdy nie powinien
powstać. `recordDecision` wykonywało dwa niezależne zapisy bez transakcji: najpierw wpis
do historii, potem zmianę stanu pozycji. Gdy drugi zawiódł, historia twierdziła, że
pozycję odrzucono, a pozycja zostawała otwarta i wracała do kolejki. Kierunek rozbieżności
był zawsze ten sam — **ślad decyzji wyprzedzał stan** — a ponieważ historii nie da się
poprawić, rozbieżność była **trwała**. Ta sama niezmienialność, która chroniła ślad,
uniemożliwiała naprawę błędnego wpisu.

Wykryte przy rankingu refaktoru, nie przy pisaniu kodu. W żadnym dokumencie kontekstowym
nie padło słowo o transakcyjności — nie było śladu decyzji „świadomie rezygnujemy z
atomowości", był ślad tego, że pytanie nie padło.

Usterki nie dało się wywołać przez publiczne API: zapisy zawsze idą w tej samej
kolejności, a pierwszy chroni drugi przed większością błędów. To nie znaczyło, że
zagrożenie jest teoretyczne — znaczyło, że jego wywołanie wymaga awarii sieci albo
odrzucenia po stronie bazy między dwoma wywołaniami. Test odtwarza więc tę sekwencję
z drugim zapisem celowo naruszającym ograniczenie schematu i pokazuje, że rozbieżność
zostaje na stałe; test bliźniaczy robi to samo przez funkcję `record_decision` i oczekuje
wycofania obu zapisów.
Uzasadnienie: `context/changes/atomic-decisions/change.md`, naprawa: `bf9e5af`.

---

## Czego w tym projekcie nie ma — i dlaczego

| Rzecz                                                   | Powód                                                                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Warstwa odcinająca od dostawcy                          | Plan napisany i wyceniony, wykonanie świadomie odłożone — `tech-stack.md` przyjmuje sprzężenie jako ryzyko, nie deklaruje wymienialności |
| Agent przeglądający PR-y                                | Workflow gotowy, wymaga płatnego klucza API                                                                                              |
| Pojęcia „segment" i „DMZ"                               | Rozważone w `shape-notes.md` i odrzucone — zapisane w destylacji domeny jako świadomy brak, nie przeoczenie                              |
| Wczytywanie z zewnętrznych źródeł jako funkcja produktu | Poza MVP wg PRD; w kodzie istnieje tylko warstwa tłumacząca obce formaty (`src/lib/domain/import/`)                                      |

## Mapa dokumentów

| Plik                                         | Po co                                              |
| -------------------------------------------- | -------------------------------------------------- |
| `context/foundation/prd.md`                  | wymagania, historyjki, guardraile                  |
| `context/foundation/roadmap.md`              | przekroje i ich stan                               |
| `context/foundation/tech-stack.md`           | wybór stacku i przyjęte ryzyka                     |
| `context/foundation/shape-notes.md`          | dlaczego produkt wygląda tak, a nie inaczej        |
| `context/map/repo-map.md`                    | mapa repozytorium z jawnym zasięgiem pomiaru       |
| `context/domain/01-domain-distillation.md`   | pojęcia, subdomeny, niezmienniki                   |
| `context/domain/03-anti-corruption-layer.md` | plan odcięcia od dostawcy (niewykonany, świadomie) |
| `context/changes/*/`                         | po jednym folderze na zmianę, z uzasadnieniami     |
| `CLAUDE.md`                                  | komendy, konwencje i reguły domenowe dla agenta    |
