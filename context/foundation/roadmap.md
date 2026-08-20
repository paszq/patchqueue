---
project: "PatchQueue"
version: 1
status: draft
created: 2026-08-20
updated: 2026-08-20
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: PatchQueue

> Wyprowadzone z `context/foundation/prd.md` (v1) oraz z rozpoznania stanu repozytorium.
> Dokument edytowany w miejscu; archiwizowany, gdy zostanie zastąpiony.
> Pozycje uporządkowane według zależności. Tabela „Jednym rzutem oka" jest indeksem.

## Vision recap

Podatności przychodzą kilkoma kanałami naraz i nie ma jednego miejsca, które
pokazywałoby cały obraz. Sama ocena CVSS nie wystarcza do ustalenia kolejności, bo nie
wie, czy dany zasób jest w ogóle wystawiony. Dziś powstaje jednorazowy arkusz, w którym
nie zostaje ślad tego, co świadomie odrzucono.

Cechą wyróżniającą produkt — tą jedną, po której usunięciu stałby się nieodróżnialny od
posortowanego arkusza — jest to, że ta sama podatność otrzymuje różny priorytet w
zależności od tego, na którym zasobie stoi.

## North star

**S-03: użytkownik dopisuje podatność i natychmiast widzi priorytet wraz ze składnikami,
z których powstał** — to najmniejszy pełny fragment, którego zadziałanie dowodzi
głównej tezy produktu; wszystko dalsze ma znaczenie tylko wtedy, gdy ten moment działa.

> „North star" oznacza tutaj najmniejszy przekrój przez wszystkie warstwy, którego
> udane dostarczenie potwierdza podstawową hipotezę produktową — umieszczony tak
> wcześnie, jak pozwalają na to jego zależności.

## At a glance

| ID | Change ID | Outcome (użytkownik może …) | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | project-scaffold | (fundament) szkielet aplikacji stoi, bramki jakości przechodzą lokalnie | — | NFR-01, NFR-03 | ready |
| F-02 | account-isolation | (fundament) konto rozdziela dane, izolacja wymuszana przez bazę | F-01 | NFR-05, Access Control | proposed |
| F-03 | verification-pipeline | (fundament) każda zmiana przechodzi lint, typy i testy automatycznie | F-01, S-01 | NFR-01, NFR-05 | proposed |
| S-01 | first-sign-in | założyć konto, zalogować się i zobaczyć pustą kolejkę z wyjaśnieniem | F-01, F-02 | US-01, FR-001, FR-002 | proposed |
| S-02 | asset-registry | zarejestrować zasób z ekspozycją i krytycznością oraz zobaczyć go na liście | S-01 | FR-003, FR-004 | proposed |
| S-03 | priority-visible | dopisać podatność i zobaczyć priorytet, jego składniki oraz termin | S-02 | US-01, FR-007, FR-010, FR-011 | proposed |
| S-04 | ordered-queue | zobaczyć kolejkę uporządkowaną priorytetem, z oznaczeniem pozycji po terminie | S-03 | US-01, FR-012, NFR-01 | proposed |
| S-05 | decision-trail | zamknąć pozycję jako załataną albo odrzuconą z powodem i wrócić do uzasadnienia | S-04 | US-01, FR-013, FR-014, FR-015 | proposed |
| S-06 | reopen-decision | przywrócić zamkniętą pozycję do kolejki bez utraty poprzedniego rozstrzygnięcia | S-05 | US-04, FR-016 | proposed |
| S-07 | exposure-recalc | zmienić ekspozycję zasobu i zobaczyć przeliczoną kolejkę | S-04 | US-02, FR-005 | proposed |
| S-08 | safe-removal | poprawiać i usuwać wpisy bez naruszenia śladu decyzji | S-05 | US-03, FR-006, FR-008, FR-009 | proposed |
| S-09 | grounded-summary | poprosić o streszczenie i kroki naprawcze wyprowadzone z własnego opisu | S-03, F-03 | FR-017, NFR-02, NFR-04 | blocked |

## Streams

Pomoc nawigacyjna — grupuje pozycje dzielące łańcuch zależności. Porządek wiążący
pozostaje w grafie zależności poniżej.

| Stream | Theme | Chain | Note |
| --- | --- | --- | --- |
| A | Ścieżka główna | `F-01` → `F-02` → `S-01` → `S-02` → `S-03` → `S-04` → `S-05` → `S-06` | Najkrótsza droga do potwierdzenia tezy produktu; przy celu „szybkość" to jedyny łańcuch, który musi zamknąć się w całości. |
| B | Weryfikacja automatyczna | `F-03` | Wchodzi zaraz po `S-01`, żeby każda kolejna pozycja lądowała już przez sprawdzoną bramkę. |
| C | Pełny cykl życia danych | `S-07` / `S-08` | Dołącza do strumienia A odpowiednio przy `S-04` i `S-05`; obie pozycje można prowadzić równolegle względem siebie. |
| D | Wsparcie generatywne | `S-09` | Osobno i na końcu — pozycja oznaczona jako nice-to-have, wstrzymana do czasu wyboru dostawcy. |

## Baseline

Stan repozytorium na 2026-08-20.

- **Frontend:** brak — nic poza dokumentami kontekstowymi.
- **Backend / API:** brak.
- **Dane:** brak.
- **Logowanie:** brak.
- **Wdrożenie / infrastruktura:** brak; konta u dostawców nie są jeszcze założone.
- **Obserwowalność:** brak i poza zakresem pierwszej wersji.
- **Obecne:** `context/foundation/{shape-notes,prd,tech-stack}.md`, 25 skilli kursowych
  w `.claude/skills/`, repozytorium git z trzema commitami.

## Foundations

### F-01: Szkielet aplikacji i bramki jakości

- **Outcome:** (fundament) projekt buduje się lokalnie, lint, kontrola typów i testy jednostkowe uruchamiają się jedną komendą.
- **Change ID:** project-scaffold
- **PRD refs:** NFR-01, NFR-03
- **Unlocks:** S-01 i wszystkie kolejne; ustanawia ścieżkę weryfikacji wymaganą przez F-03.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Najmniejszy możliwy szkielet. Rozdęcie tego kroku o gotowe biblioteki komponentów albo warstwę abstrakcji nad bazą jest głównym zagrożeniem dla terminu — fundament ma odblokować pierwszą pozycję, nie domknąć warstwę.
- **Status:** ready

### F-02: Konto i izolacja danych

- **Outcome:** (fundament) konto rozdziela dane, a niedostępność cudzych danych jest wymuszana przez bazę, nie przez kod aplikacji.
- **Change ID:** account-isolation
- **PRD refs:** NFR-05, sekcja Access Control
- **Unlocks:** S-01; usuwa blokujący niewiadomy element „czy izolacja rzeczywiście działa" przed dopisaniem jakichkolwiek danych.
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** konto u dostawcy bazy i logowania — do założenia przez użytkownika
- **Unknowns:**
  - Czy polityka dostępu jest faktycznie aktywna, czy tylko zapisana? — Owner: zespół. Block: nie, ale wymaga własnego testu, nie przeglądu konfiguracji.
- **Risk:** Reguły dostępu na poziomie wierszy łatwo skonfigurować pozornie. Fundament uznajemy za domknięty dopiero, gdy istnieje test pokazujący, że drugie konto nie sięga do danych pierwszego.
- **Status:** proposed

### F-03: Automatyczna weryfikacja zmian

- **Outcome:** (fundament) każda zmiana przed scaleniem przechodzi lint, kontrolę typów oraz testy jednostkowe i przeglądowe.
- **Change ID:** verification-pipeline
- **PRD refs:** NFR-01, NFR-05
- **Unlocks:** S-09 (testy treści wytwarzanych automatycznie); zabezpiecza ścieżkę weryfikacji dla S-02 i dalszych.
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02
- **Blockers:** repozytorium zdalne — do założenia przez użytkownika
- **Unknowns:** —
- **Risk:** Umieszczony po pierwszej pozycji, a nie przed nią — wcześniej nie miałby czego uruchamiać. Odkładanie go dalej oznacza, że kolejne pozycje wchodzą bez siatki bezpieczeństwa.
- **Status:** proposed

## Slices

### S-01: Pierwsze logowanie

- **Outcome:** użytkownik zakłada konto, loguje się i widzi pustą kolejkę z wyjaśnieniem, co dalej.
- **Change ID:** first-sign-in
- **PRD refs:** US-01, FR-001, FR-002
- **Prerequisites:** F-01, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pusty stan bywa traktowany jako detal i pomijany, a to pierwsza rzecz, jaką zobaczy oceniający. Kryterium akceptacji US-01 wymaga wyjaśnienia, nie listy zerowej.
- **Status:** proposed

### S-02: Rejestr zasobów

- **Outcome:** użytkownik rejestruje zasób z ekspozycją i krytycznością oraz widzi go na swojej liście.
- **Change ID:** asset-registry
- **PRD refs:** FR-003, FR-004
- **Prerequisites:** S-01
- **Parallel with:** F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Tu zapadają nazwy poziomów ekspozycji i krytyczności, na których opiera się cała reguła. Zmiana ich później oznacza migrację danych.
- **Status:** proposed

### S-03: Widoczny priorytet

- **Outcome:** użytkownik dopisuje podatność do zasobu i natychmiast widzi przyznany priorytet, jego trzy składniki oraz wyznaczony termin.
- **Change ID:** priority-visible
- **PRD refs:** US-01, FR-007, FR-010, FR-011
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Jakie wagi otrzymują poziomy ekspozycji i krytyczności? — Owner: zespół. Block: nie; rozstrzygane tabelą przypadków testowych, ograniczone guardrailem o zasobie wystawionym.
- **Risk:** Serce produktu. Reguła musi powstać jako czysta funkcja pokryta testami, zanim dotknie interfejsu — inaczej jej weryfikacja przeniesie się do testów przeglądowych, gdzie jest wolna i krucha.
- **Status:** proposed

### S-04: Uporządkowana kolejka

- **Outcome:** użytkownik widzi wszystkie otwarte pozycje uporządkowane priorytetem, z oznaczeniem tych po terminie i liczbą dni opóźnienia.
- **Change ID:** ordered-queue
- **PRD refs:** US-01, FR-012, NFR-01
- **Prerequisites:** S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Moment, w którym da się wykazać główne kryterium sukcesu — kolejka układa się inaczej niż sortowanie po samej ocenie CVSS. Wymaga danych demonstracyjnych dobranych tak, by ta różnica była widoczna.
- **Status:** proposed

### S-05: Ślad decyzji

- **Outcome:** użytkownik zamyka pozycję jako załataną albo odrzuconą z podanym powodem i może wrócić do rozstrzygnięcia wraz z uzasadnieniem.
- **Change ID:** decision-trail
- **PRD refs:** US-01, FR-013, FR-014, FR-015
- **Prerequisites:** S-04
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Domyka główny przepływ z kryterium Primary. Odrzucenie bez powodu musi być niemożliwe — to nie walidacja formularza, tylko guardrail produktu.
- **Status:** proposed

### S-06: Powrót do rozstrzygnięcia

- **Outcome:** użytkownik przywraca zamkniętą pozycję do kolejki, a poprzednie rozstrzygnięcie pozostaje widoczne w historii.
- **Change ID:** reopen-decision
- **PRD refs:** US-04, FR-016
- **Prerequisites:** S-05
- **Parallel with:** S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wymaga historii rozstrzygnięć zamiast pojedynczego pola stanu. Jeśli S-05 zapisze stan płasko, ta pozycja wymusi przebudowę zapisu.
- **Status:** proposed

### S-07: Przeliczenie po zmianie ekspozycji

- **Outcome:** użytkownik zmienia ekspozycję zasobu i widzi, że wszystkie jego otwarte pozycje zmieniły miejsce w kolejce i dostały nowe terminy.
- **Change ID:** exposure-recalc
- **PRD refs:** US-02, FR-005
- **Prerequisites:** S-04
- **Parallel with:** S-06, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Drugi moment, w którym użytkownik spotyka regułę. Przeliczenie musi objąć wszystkie otwarte pozycje zasobu, a pominąć rozstrzygnięte — łatwo o odwrotny błąd.
- **Status:** proposed

### S-08: Bezpieczne usuwanie

- **Outcome:** użytkownik poprawia i usuwa wpisy, a produkt odmawia usunięcia zasobu z nierozstrzygniętymi pozycjami i wskazuje, co zamknąć najpierw.
- **Change ID:** safe-removal
- **PRD refs:** US-03, FR-006, FR-008, FR-009
- **Prerequisites:** S-05
- **Parallel with:** S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Odmowa usunięcia jest regułą domenową, nie komunikatem interfejsu — musi obowiązywać niezależnie od drogi, którą przyszło żądanie.
- **Status:** proposed

### S-09: Streszczenie osadzone w opisie

- **Outcome:** użytkownik prosi o streszczenie podatności i kroki naprawcze wyprowadzone wyłącznie z opisu, który sam wprowadził, oznaczone jako treść wytworzona automatycznie.
- **Change ID:** grounded-summary
- **PRD refs:** FR-017, NFR-02, NFR-04
- **Prerequisites:** S-03, F-03
- **Parallel with:** —
- **Blockers:** wybór dostawcy modelu i klucz dostępu — decyzja odłożona do domknięcia rdzenia
- **Unknowns:**
  - Który dostawca spełnia kryterium: pojedynczy klucz, rozliczenie za użycie, brak abonamentu? — Owner: użytkownik. Block: tak.
- **Risk:** Jedyna pozycja oznaczona jako nice-to-have. Wchodzi wyłącznie wtedy, gdy strumień A jest zamknięty; w przeciwnym razie zostaje odłożona bez żalu.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| --- | --- | --- | --- | --- |
| F-01 | project-scaffold | Szkielet aplikacji i bramki jakości | tak | `/10x-plan project-scaffold` |
| F-02 | account-isolation | Konto i izolacja danych między kontami | nie | czeka na konto u dostawcy |
| F-03 | verification-pipeline | Automatyczna weryfikacja zmian przed scaleniem | nie | czeka na repozytorium zdalne |
| S-01 | first-sign-in | Pierwsze logowanie i pusta kolejka | nie | po F-02 |
| S-02 | asset-registry | Rejestr zasobów z ekspozycją i krytycznością | nie | po S-01 |
| S-03 | priority-visible | Widoczny priorytet ze składnikami i terminem | nie | po S-02; pozycja przewodnia |
| S-04 | ordered-queue | Kolejka uporządkowana priorytetem | nie | po S-03 |
| S-05 | decision-trail | Rozstrzygnięcie pozycji z uzasadnieniem | nie | po S-04 |
| S-06 | reopen-decision | Przywrócenie zamkniętej pozycji | nie | po S-05 |
| S-07 | exposure-recalc | Przeliczenie kolejki po zmianie ekspozycji | nie | po S-04 |
| S-08 | safe-removal | Bezpieczne poprawianie i usuwanie wpisów | nie | po S-05 |
| S-09 | grounded-summary | Streszczenie osadzone we wprowadzonym opisie | nie | wstrzymane do wyboru dostawcy |

## Open Roadmap Questions

1. **Jakie wagi otrzymują poszczególne poziomy ekspozycji i krytyczności w wyliczeniu priorytetu?** — Owner: zespół. Block: S-03, rozstrzygane tabelą przypadków przy planie tej pozycji.
2. **Który dostawca modelu spełnia kryterium pojedynczego klucza i rozliczenia za użycie?** — Owner: użytkownik. Block: S-09.

## Parked

- **Wczytywanie list z zewnętrznych źródeł o różnych formatach** — Why parked: PRD §Non-Goals; materiał na rozbudowę architektury po domknięciu rdzenia.
- **Sięganie do publicznych baz podatności i sygnałów o realnych atakach** — Why parked: PRD §Non-Goals; uzupełnienie reguły, nie jej zamiennik.
- **Powiadomienia, przypomnienia i eskalacja** — Why parked: PRD §Non-Goals; oznaczenie przekroczeń w S-04 jest przyjętym minimum.
- **Praca zespołowa: role, właściciel, współdzielenie** — Why parked: PRD §Non-Goals; persona jest jednoosobowa.
- **Automatyczne wykrywanie zasobów i wersji** — Why parked: PRD §Non-Goals.
- **Aplikacja mobilna i praca bez sieci** — Why parked: PRD §Non-Goals.

## Done

