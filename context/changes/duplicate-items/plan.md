# Unikalność pozycji na zasobie — plan implementacji

## Overview

Reguła „ta sama podatność nie może stać dwa razy na tym samym zasobie" obowiązuje dziś
tylko przy wczytywaniu z zewnętrznego źródła. Ręczne dopisanie ją omija, bo nikt jej nie
sprawdza, a schemat o niej nie wie. Plan przenosi regułę do bazy i tłumaczy jej odmowę na
komunikat, tak jak przy pozostałych guardrailach tego produktu.

## Current State Analysis

- `importFindings` odrzuca duplikaty zbiorem `seen` zbudowanym ze wszystkich istniejących
  wierszy — bez filtrowania po statusie — i raportuje je jako `duplikat`
  (`src/lib/services/import.ts`).
- `createVulnerability` wykonuje czysty `insert` bez żadnego sprawdzenia
  (`src/lib/services/vulnerabilities.ts:16-32`).
- Punkt końcowy `POST /api/vulnerabilities` waliduje wyłącznie kształt pól, zod nie zna
  pojęcia duplikatu (`src/pages/api/vulnerabilities/index.ts:9-16`).
- W `supabase/migrations/` nie ma ani jednego ograniczenia `unique` — są tylko dwa
  ograniczenia `check` i wyzwalacze.
- `normalizeIdentifier` podnosi identyfikator do wielkich liter, ale wyłącznie na ścieżce
  wczytywania (`src/lib/domain/import/finding.ts`).

Skutek zaobserwowany na produkcji: pięć wierszy `CVE-2026-252` na jednym zasobie, każdy
z własnym identyfikatorem wiersza i własną, pustą historią.

## Desired End State

Próba zapisania pozycji o identyfikatorze, który już istnieje na tym zasobie, jest
odrzucana przez bazę — niezależnie od statusu istniejącej pozycji i niezależnie od tego,
czy żądanie przyszło z formularza, z wczytywania, czy z pominięciem aplikacji. Użytkownik
widzi komunikat nazywający przyczynę, a nie błąd bazy.

Weryfikacja: test integracyjny, który odróżnia odmowę przez regułę od odmowy przez brak
reguły, oraz test przeglądowy przechodzący ścieżkę użytkownika.

### Key Discoveries:

- Reguła już istnieje w produkcie, tylko w jednej ścieżce — to nie nowa funkcja, to
  domknięcie zasięgu istniejącej (`src/lib/services/import.ts`, zbiór `seen`).
- Wzorzec tłumaczenia odmowy z bazy na komunikat jest już w repozytorium i działa:
  `deleteAsset` przepuszcza treść odmowy wyzwalacza dalej
  (`src/lib/services/assets.ts`, komentarz nad funkcją).
- `tests/integration/atomic-decisions.test.ts:61-71` zawiera `expectDomainRejection` —
  gotowy wzorzec na odróżnienie odmowy przez regułę od odmowy przez brak reguły. Ten test
  powstał dokładnie po to, bo asercja „ma być błąd" raz już przeszła z niewłaściwego powodu.
- Migracje w tym projekcie nazywają się `YYYYMMDDHHmmss_short_description.sql` i są
  stosowane przez `npx supabase db push`.

## What We're NOT Doing

- Nie kasujemy istniejących duplikatów w migracji. Jeśli jakieś zostały, migracja ma
  zawieść głośno.
- Nie ruszamy `importFindings`. Jego zbiór `seen` zostaje jako tania ścieżka dająca
  użytkownikowi rzetelne podsumowanie („pominięto N, duplikat"); baza jest siatką pod nim,
  nie zamiast niego.
- Nie wprowadzamy unikalności globalnej ani per konto. Ta sama podatność na dwóch różnych
  zasobach to dwie różne pozycje — to jest teza produktu i nie wolno jej złamać.
- Nie zmieniamy zachowania przywracania pozycji do kolejki (FR-016).

## Implementation Approach

Najpierw reguła w bazie wraz z testem, który dowodzi, że to ona odmawia. Dopiero potem
warstwa aplikacji, która tę odmowę tłumaczy. Odwrotna kolejność dałaby komunikat
sprawdzany testem, który przechodzi także wtedy, gdy reguły nie ma.

## Critical Implementation Details

Indeks musi działać na znormalizowanej postaci identyfikatora — `upper(identifier)` —
bo ścieżka wczytywania podnosi go do wielkich liter, a formularz nie. Bez tego
`cve-2026-1111` i `CVE-2026-1111` byłyby dla bazy dwiema podatnościami, a dla człowieka
jedną. Normalizacja w formularzu i postać w indeksie muszą być tą samą decyzją, wprowadzoną
razem — rozdzielenie ich na dwie fazy zostawiłoby okno, w którym reguła jest obchodzona
zmianą wielkości liter.

## Phase 1: Reguła w bazie

### Overview

Unikalny indeks na parze (zasób, znormalizowany identyfikator), obowiązujący niezależnie
od statusu pozycji.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20260902<HHmmss>_unique_item_per_asset.sql`

**Intent**: Wprowadza ograniczenie unikalności dla pary zasób–identyfikator, żeby reguła
przestała zależeć od tego, którą ścieżką przyszedł zapis.

**Contract**: `create unique index ... on vulnerabilities (asset_id, upper(identifier))`.
Bez klauzuli filtrującej po statusie — unikalność obowiązuje także dla pozycji
rozstrzygniętych, zgodnie z rozstrzygnięciem domenowym w `change.md`. Komentarz w migracji
nazywa regułę w języku produktu, tak jak pozostałe obiekty w tym schemacie.

#### 2. Test integracyjny

**File**: `tests/integration/duplicate-items.test.ts`

**Intent**: Dowodzi, że duplikat jest odrzucany przez regułę, a nie przez przypadek, i że
odmowa dotyczy również pozycji już rozstrzygniętej.

**Contract**: Trzy przypadki na świeżym koncie — dopisanie tego samego identyfikatora
drugi raz na tym samym zasobie jest odrzucone; ten sam identyfikator na **innym** zasobie
przechodzi; identyfikator różniący się wyłącznie wielkością liter jest odrzucony. Odmowę
sprawdza funkcja odróżniająca naruszenie unikalności od braku indeksu — wzorzec
`expectDomainRejection` z `tests/integration/atomic-decisions.test.ts`.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się czysto: `npx supabase db push`
- Testy jednostkowe i integracyjne przechodzą: `npm test`
- Kontrola typów przechodzi: `npm run typecheck`
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- Test integracyjny jest czerwony przed zastosowaniem migracji i zielony po niej —
  potwierdza, że odmowa pochodzi z reguły, a nie skądinąd

---

## Phase 2: Tłumaczenie odmowy w warstwie aplikacji

### Overview

Użytkownik dostaje zdanie nazywające przyczynę, nie komunikat sterownika bazy. Ręczne
dopisanie normalizuje identyfikator tak samo jak wczytywanie.

### Changes Required:

#### 1. Normalizacja identyfikatora na ścieżce ręcznej

**File**: `src/pages/api/vulnerabilities/index.ts`

**Intent**: Sprowadza identyfikator do tej samej postaci, w jakiej trafia tam z wczytywania,
żeby reguła nie dawała się obejść zmianą wielkości liter.

**Contract**: Schemat zod podnosi `identifier` do wielkich liter po przycięciu białych
znaków. Dotyczy zapisu i aktualizacji.

#### 2. Komunikat zamiast błędu bazy

**File**: `src/lib/services/vulnerabilities.ts`

**Intent**: Zamienia naruszenie unikalności na zdanie w języku produktu, zgodnie ze
wzorcem, którym `deleteAsset` przepuszcza odmowę wyzwalacza.

**Contract**: `createVulnerability` i `updateVulnerability` rozpoznają naruszenie
unikalności po kodzie błędu i rzucają `DataAccessError` z treścią nazywającą podatność
i zasób oraz wskazującą przywrócenie jako właściwą drogę dla pozycji już rozstrzygniętej.

#### 3. Test przeglądowy

**File**: `e2e/main-flow.spec.ts`

**Intent**: Sprawdza ścieżkę użytkownika, nie samą regułę: dopisanie istniejącej podatności
kończy się czytelną odmową, a kolejka nie zyskuje drugiego wiersza.

**Contract**: Jeden scenariusz — dopisz podatność, dopisz ją ponownie, oczekuj komunikatu
w `role="alert"` i dokładnie jednej pozycji o tym identyfikatorze na zasobie.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe i integracyjne przechodzą: `npm test`
- Testy przeglądowe przechodzą: `npx playwright test`
- Kontrola typów przechodzi: `npm run typecheck`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Komunikat w interfejsie jest zrozumiały bez znajomości schematu bazy
- Wczytanie raportu zawierającego duplikat nadal raportuje go jako pominięty, a nie jako
  błąd całego wczytania

---

## Testing Strategy

### Unit Tests:

- Brak nowych. Reguła nie jest czystą funkcją — mieszka w bazie, więc test jednostkowy
  odtwarzałby ją zamiast sprawdzać. To ten sam powód, dla którego warstwa integracyjna
  tego projektu nie używa atrap.

### Integration Tests:

- Duplikat na tym samym zasobie odrzucony przez regułę
- Ten sam identyfikator na innym zasobie przechodzi
- Różnica wyłącznie w wielkości liter odrzucona
- Duplikat pozycji już rozstrzygniętej odrzucony

### Manual Testing Steps:

1. Wejdź w zasób z istniejącą pozycją, dopisz podatność o tym samym identyfikatorze
2. Sprawdź, że pojawia się komunikat nazywający przyczynę
3. Sprawdź, że kolejka nie ma drugiego wiersza
4. Wczytaj raport CSV zawierający identyfikator już obecny na zasobie i sprawdź, że
   podsumowanie nadal mówi „pominięto", a nie zgłasza błędu

## References

- `context/changes/duplicate-items/change.md` — diagnoza i rozstrzygnięcie domenowe
- `context/foundation/test-plan.md` §2 — ryzyko #1 i #2
- `context/foundation/prd.md` — FR-015, FR-016
- `tests/integration/atomic-decisions.test.ts` — wzorzec odróżniania odmowy przez regułę

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reguła w bazie

#### Automated

- [ ] 1.1 Migracja z unikalnym indeksem na (asset_id, upper(identifier))
- [ ] 1.2 Test integracyjny odróżniający odmowę przez regułę od braku reguły
- [ ] 1.3 Bramki jakości przechodzą po zastosowaniu migracji

#### Manual

- [ ] 1.4 Test czerwony przed migracją, zielony po niej

### Phase 2: Tłumaczenie odmowy w warstwie aplikacji

#### Automated

- [ ] 2.1 Normalizacja identyfikatora na ścieżce ręcznej
- [ ] 2.2 Naruszenie unikalności zamienione na komunikat w języku produktu
- [ ] 2.3 Test przeglądowy ścieżki użytkownika
- [ ] 2.4 Bramki jakości i testy przeglądowe przechodzą

#### Manual

- [ ] 2.5 Komunikat zrozumiały bez znajomości schematu; wczytywanie nadal raportuje duplikat jako pominięty
