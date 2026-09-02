# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-02

## 1. Strategy

Testy w tym projekcie podlegają trzem regułom, od których nie ma odstępstwa:

1. **Koszt × sygnał.** Wygrywa najtańszy test dający realny sygnał dla danego ryzyka.
   Nie awansujemy testu do poziomu przeglądowego dlatego, że „tak bezpieczniej", i nie
   dokładamy warstwy oceniającej obraz nad deterministycznym porównaniem, które i tak
   łapie regresję.
2. **Obawy użytkownika są dowodem pierwszej kategorii.** Ryzyko zakotwiczone w zdaniu
   „zespół boi się X, a awaria ujawniłaby się gdzieś w obszarze Y" waży tyle samo, co
   linia z PRD albo dane o częstotliwości zmian.
3. **Ryzyka są scenariuszami, nie miejscami w kodzie.** Ten dokument opisuje, _co może
   zawieść_ i _dlaczego uważamy to za prawdopodobne_ — na podstawie dokumentów, wywiadu
   i sygnałów z repozytorium (częstotliwość zmian, struktura, stan bazy testowej). NIE
   twierdzi, że wie, która linia odpowiada za awarię. Tę wiedzę wytwarza
   `/10x-research` w ramach każdego przekroju wdrożenia. Jeśli plan i research nie
   zgadzają się co do tego, gdzie mieszka awaria, prawdą jest research.

Zasięg skanu punktów zapalnych użyty do ważenia prawdopodobieństwa: `src/`,
`supabase/`, `e2e/`, `tests/`.

## 2. Risk Map

Najważniejsze scenariusze awarii, przed którymi produkt musi się bronić, uporządkowane
według wpływu × prawdopodobieństwa. Ryzyka są opisane językiem użytkownika i biznesu,
nie nazwami testów. Kolumna „Dowód" cytuje to, _co wywindowało ryzyko na listę_ — nigdy
konkretnego pliku jako miejsca awarii (patrz §1, zasada 3).

| #   | Ryzyko (scenariusz awarii)                                                                                                               | Wpływ  | Prawd. | Dowód (nie kotwica)                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Znalezisko z obcego źródła nie trafia do kolejki albo ląduje pod niewłaściwym zasobem, a podsumowanie importu tego nie ujawnia           | High   | High   | wywiad Q1; hot-spot `src/lib/services/` — 13 commitów/30d; `roadmap.md` §Parked (kolejne źródła w planie)              |
| 2   | Guardrail egzekwowany wyłącznie w bazie przestaje działać po migracji, a warstwa aplikacji nadal twierdzi, że reguła obowiązuje          | High   | High   | wywiad Q3; hot-spot `supabase/migrations/` — 3 commity/30d; `repo-map.md` §Strefy ryzyka; `prd.md` FR-006, FR-014      |
| 3   | Zabezpieczenie przestaje chronić, a pipeline nadal świeci na zielono — test pomija się cicho albo spełnia asercję z niewłaściwego powodu | High   | High   | historia projektu — pięć udokumentowanych wystąpień; hot-spot `e2e/` — 11 commitów/30d, `tests/integration/` — 5       |
| 4   | Kolejka podaje priorytet niezgodny z regułą, a wynik wygląda wiarygodnie, więc nikt go nie kwestionuje                                   | High   | Medium | wywiad Q1; `prd.md` §Guardrails; `context/domain/01-domain-distillation.md` — niezmiennik przeliczania bez strażnika   |
| 5   | Zalogowany użytkownik sięga po dane innego konta ścieżką, której polityka dostępu nie obejmuje                                           | High   | Medium | `prd.md` NFR-05 oraz guardrail „żadną ścieżką"; hot-spot `src/lib/services/` — 13 commitów/30d                         |
| 6   | Ślad decyzji rozjeżdża się ze stanem pozycji, a rozbieżności nie da się cofnąć                                                           | High   | Low    | `prd.md` §Guardrails, FR-015, FR-016; `context/changes/refactor-opportunities/research.md` — kandydat 1, już wystąpiło |
| 7   | Treść z obcego pliku przechodzi do bazy bez walidacji po stronie serwera albo wywala żądanie, zamiast zostać odrzucona z podanym powodem | Medium | Medium | wywiad Q1; `prd.md` §Non-Goals; soczewka nadużyć — nieufne wejście                                                     |

**Odrzucone przy przebiegu kwestionującym.** „Brak ścieżki awaryjnej przy
niedostępności dostawcy" — opisuje mechanizm, którego nie ma, więc test musiałby
najpierw dopisać zabezpieczenie; to nie defekt, tylko brak funkcji. „Kolejka zwalnia
przy stu i więcej pozycjach" — guardrail istnieje (`prd.md` §Guardrails), ale wysoki
wpływ przy niskim prawdopodobieństwie należy do obserwowalności, nie do testu;
odnotowane zamiast dopychania mapy.

### Risk Response Guidance

| Ryzyko | Co dowiedzie ochrony                                                                                                     | Co zakwestionować                                                                                                            | Kontekst do ugruntowania przez `/10x-research`                                                           | Najtańsza prawdopodobna warstwa | Antywzorzec do uniknięcia                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| #1     | Znalezisko bez dopasowania jest raportowane jako pominięte i widoczne w podsumowaniu, a nie znika bez śladu              | Że „dodano N" wystarczy — liczba dodanych nie mówi nic o tym, ile znalezisk zniknęło po cichu                                | Reguła dopasowania do zasobu, zachowanie przy wielu kandydatach, źródło prawdy dla wykrywania duplikatów | integracyjna                    | Test wyłącznie ścieżki szczęśliwej: jeden wiersz, jeden zasób, jeden wynik               |
| #2     | Operacja łamiąca guardrail zostaje odrzucona **przez regułę**, a komunikat nazywa to, co ją zablokowało                  | Że „przyszedł błąd" znaczy „reguła zadziałała" — brak funkcji albo literówka w nazwie dają identyczny wynik                  | Które reguły żyją w wyzwalaczach i ograniczeniach, jak ich odmowa dociera do warstwy aplikacji           | integracyjna                    | Asercja „ma być błąd" bez rozróżnienia, jaki to błąd                                     |
| #3     | Brak konfiguracji, brak funkcji w bazie i pominięty zestaw kończą się **czerwonym** przebiegiem, nie cichym pominięciem  | Że zielony przebieg znaczy „sprawdzone" — narzędzie, które nic nie znalazło, i takie, które nie patrzyło, wyglądają tak samo | Zasięg każdego narzędzia pomiaru: co realnie parsuje, co pomija, gdzie kończy się jego widzenie          | bramka                          | Bramka, która przy braku wejścia przechodzi zamiast zawodzić                             |
| #4     | Ta sama podatność na zasobie wystawionym nigdy nie stoi niżej niż na odciętym, dla pełnej siatki kombinacji              | Że wystarczy kilka przykładów — reguła jest iloczynem, więc łamie się dopiero na konkretnych parach                          | Czy priorytet jest wyliczany, czy przechowywany; co przelicza się przy zmianie zasobu, a co nie          | jednostkowa                     | Asercja przepisana z implementacji zamiast z wymagania — test zaklepałby własny błąd     |
| #5     | Zapytanie z sesji konta A nie zwraca ani jednego wiersza konta B, także dla nowo dodanych tabel i punktów końcowych      | Że filtrowanie w warstwie aplikacji wystarcza — izolacja ma trzymać niezależnie od tego, co zrobi kod                        | Gdzie kończy się polityka dostępu, a zaczyna filtrowanie w kodzie; które ścieżki ją omijają              | integracyjna                    | Sprawdzenie tylko odczytu, z pominięciem zapisu, aktualizacji i usunięcia                |
| #6     | Nieudany drugi zapis wycofuje pierwszy; historia i stan pozycji nigdy nie rozchodzą się trwale                           | Że kolejność zapisów chroni sama z siebie — chroni do pierwszej awarii między nimi                                           | Granica transakcji, kontekst wywołania, zachowanie przy odrzuceniu po stronie bazy                       | integracyjna                    | Wywoływanie usterki wyłącznie przez publiczne API, które nie potrafi jej wywołać         |
| #7     | Wiersz niezrozumiały zostaje odrzucony z powodem i numerem linii, a żądanie kończy się czytelnym komunikatem, nie awarią | Że walidacja formularza wystarcza — plik omija formularz i wchodzi tą samą ścieżką                                           | Gdzie kończy się parsowanie, a zaczyna zapis; jakie ograniczenia rozmiaru i typu obowiązują realnie      | jednostkowa + integracyjna      | Testowanie wyłącznie poprawnych plików, bez wiersza uszkodzonego, pustego i nadmiarowego |

## 3. Phased Rollout

Każdy wiersz to odrębny przekrój wdrożenia, który otwiera własny folder zmiany przez
`/10x-new`. Status przesuwa się w prawo według słownika poniżej.

Przekroje 1–3 opisują pracę **wykonaną, zanim ten dokument powstał** — testy istniały
wcześniej, a plan przypisuje je wstecz do nazwanych ryzyk. Ich foldery zmian zawierają
`change.md` z uzasadnieniem, ale nie `plan.md`, bo nie przechodziły przez ten przepływ.

| #   | Nazwa przekroju                           | Cel                                                                              | Ryzyka | Rodzaje testów                           | Status      | Folder zmiany                                                            |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------- | ------ | ---------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| 1   | Rdzeń domeny i ścieżka główna             | Obronić regułę priorytetu i trwałość śladu decyzji na najtańszej warstwie        | #4, #6 | jednostkowe + integracyjne + przeglądowe | complete    | `context/changes/priority-visible/`, `context/changes/atomic-decisions/` |
| 2   | Izolacja kont wymuszana przez bazę        | Udowodnić, że konto nie sięga po cudze dane żadną ścieżką                        | #5     | integracyjne                             | complete    | `context/changes/account-isolation/`                                     |
| 3   | Strażnicy pomiaru                         | Sprawić, by test nie mógł przejść z niewłaściwego powodu                         | #3     | bramki                                   | complete    | —                                                                        |
| 4   | Guardraile w bazie sprawdzane po migracji | Odróżnić odmowę przez regułę od odmowy przez brak reguły, dla każdego guardrailu | #2     | integracyjne                             | not started | —                                                                        |
| 5   | Odporność wczytywania z obcych źródeł     | Nie zgubić ani nie dopisać znaleziska bez śladu w podsumowaniu                   | #1, #7 | jednostkowe + integracyjne               | not started | —                                                                        |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` →
`researched` → `planned` → `implementing` → `complete`.

## 4. Stack

| Warstwa                    | Narzędzie            | Wersja         | Uwagi                                                                                           |
| -------------------------- | -------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| jednostkowe + integracyjne | Vitest               | 4.1.11         | 78 testów w 5 plikach; integracyjne uderzają w prawdziwy projekt bazy, nie w atrapę             |
| przeglądowe                | Playwright           | 1.62.1         | 14 scenariuszy; `BASE_URL` kieruje ten sam zestaw na wdrożoną instancję                         |
| atrapy HTTP                | brak — świadomie     | —              | Reguła domenowa jest czysta, a integracja ma dotykać prawdziwej bazy; atrapa ukryłaby ryzyko #2 |
| analiza zależności         | dependency-cruiser   | 18.2.0         | 5 reguł, dwie pilnują czystości domeny; **nie parsuje `.astro`** — patrz ryzyko #3              |
| typy i lint                | TypeScript / ESLint  | 5.9.3 / 9.29.0 | `astro check` jako bramka osobna od lintu                                                       |
| dostępność                 | brak — nie planowane | —              | Poza zasięgiem MVP; nie wskazane przez żadne ryzyko z §2                                        |

**Stack grounding tools (current session):**

- Docs: brak — Context7 ani inny docs MCP nie jest dostępny w tej sesji; wersje wzięte z `package.json` i z uruchomionych narzędzi; checked: 2026-09-02
- Search: brak — Exa.ai ani wyszukiwarka MCP nie jest dostępna w tej sesji; checked: 2026-09-02
- Runtime/browser: Playwright dostępny lokalnie jako warstwa weryfikacji, także przeciw wdrożonej instancji; checked: 2026-09-02
- Provider/platform: GitHub Actions jako miejsce bramek; `gh` niezainstalowany, więc status przebiegów odczytywany z interfejsu, nie z terminala; Supabase jako źródło reguł egzekwowanych w bazie; checked: 2026-09-02

## 5. Quality Gates

| Bramka                              | Gdzie           | Wymagana?                              | Co łapie                                         |
| ----------------------------------- | --------------- | -------------------------------------- | ------------------------------------------------ |
| lint + kontrola typów               | lokalnie + CI   | wymagana                               | dryf składni i typów                             |
| reguły dependency-cruiser           | lokalnie + CI   | wymagana                               | przecieki do warstwy domenowej, cykle zależności |
| testy jednostkowe i integracyjne    | lokalnie + CI   | wymagana                               | regresje reguł domenowych i guardraili w bazie   |
| testy przeglądowe                   | CI              | wymagana                               | zerwane ścieżki użytkownika                      |
| błąd przy braku konfiguracji        | CI              | wymagana                               | ciche pomijanie zestawów testowych — ryzyko #3   |
| weryfikacja wdrożonej instancji     | CI po wdrożeniu | wymagana                               | awarie widoczne dopiero w środowisku docelowym   |
| przegląd implementacji przez agenta | CI na PR        | planowana — wymaga `ANTHROPIC_API_KEY` | dryf implementacji względem planu                |

## 6. Cookbook Patterns

### 6.1 Test reguły domenowej

- **Miejsce**: obok modułu, `src/lib/domain/<modul>.test.ts`.
- **Wzorzec**: tabela przypadków na pełnej siatce kombinacji, nie kilka przykładów.
  Reguła priorytetu jest iloczynem, więc łamie się na konkretnych parach, a nie „gdzieś".
- **Test wzorcowy**: `src/lib/domain/priority.test.ts` — 8 wartości CVSS × 3 ekspozycje
  × 3 krytyczności, sprawdzane w obie strony po każdej ze skal.
- **Uruchomienie**: `npm test`.

### 6.2 Test integracyjny reguły egzekwowanej w bazie

- **Miejsce**: `tests/integration/`.
- **Polityka atrap**: żadnych. Test uderza w prawdziwy projekt bazy, bo atrapa
  odtwarzałaby regułę zamiast ją sprawdzać — i przeszedłby nawet po usunięciu migracji.
- **Obowiązkowo**: odróżnij odmowę przez regułę od odmowy przez brak reguły. Wzorzec:
  `expectDomainRejection` w `tests/integration/atomic-decisions.test.ts`.
- **Uruchomienie**: `npm test` z `SUPABASE_URL` i `SUPABASE_KEY` w środowisku.

### 6.3 Test przeglądowy

- **Miejsce**: `e2e/main-flow.spec.ts`.
- **Wzorzec**: świeże konto na scenariusz, żeby testy nie dziedziczyły po sobie stanu.
  Formularze uwierzytelniania są wyspami Reacta — użyj `fillHydrated`, bo wypełnienie
  pola przed hydracją nie dociera do stanu komponentu.
- **Przeciw produkcji**: `BASE_URL=<adres> npx playwright test`.

### 6.4 Test punktu końcowego przyjmującego dane z zewnątrz

- **Rodzaj**: jednostkowy na parsowanie, integracyjny na zapis.
- **Wzorzec**: parsowanie jest czyste, więc pokrywa je tabela przypadków —
  `src/lib/domain/import/adapters.test.ts`. Zapis, dopasowanie i duplikaty wymagają bazy.
- **Obowiązkowo**: wiersz uszkodzony, pusty i nadmiarowy, nie tylko poprawny.

### 6.5 Bramka pomiaru

- **Zasada**: bramka przy braku wejścia ma **zawodzić**, nie przechodzić. Brak
  konfiguracji w pipelinie jest błędem, nie pominięciem.
- **Wzorzec**: `e2e/main-flow.spec.ts` i `tests/integration/isolation.test.ts` zgłaszają
  błąd, gdy w CI brakuje konfiguracji, a lokalnie pomijają się z ostrzeżeniem.

### 6.6 Notatki z przekrojów

- Przekroje 1–3 powstały przed tym dokumentem; ich wzorce zostały opisane wstecz.
  Pięć przypadków cichego pomijania testów opisanych w `SUBMISSION.md` to materiał
  źródłowy dla ryzyka #3 i dla §6.5.

## 7. What We Deliberately Don't Test

Brak wykluczeń. Na pytanie o negatywną przestrzeń (wywiad Q5) padła odpowiedź „testuj
wszystko, co ryzykowne" — o zakresie decyduje mapa ryzyka z §2, a nie lista obszarów
wyjętych z góry.

Zapisane jako świadoma decyzja, nie przeoczenie. Konsekwencja: wykluczenie czegokolwiek
wymaga najpierw wykazania, że dane ryzyko nie mieści się w §2 — a nie odwrotnie.
Kandydatem do ponownego rozważenia jest wydajność kolejki przy stu i więcej pozycjach:
guardrail istnieje w `prd.md`, ale odpowiedzią na niego jest obserwowalność, nie test.

## 8. Freshness Ledger

- Strategia (§1–§5) ostatnio przeglądana: 2026-09-02
- Wersje narzędzi ostatnio zweryfikowane: 2026-09-02
- Odniesienia do narzędzi wspieranych przez AI ostatnio zweryfikowane: 2026-09-02

Odśwież (`/10x-test-plan --refresh`), gdy:

- pojawi się nowe ryzyko z pierwszej trójki z roadmapy albo z archiwum,
- data `checked:` któregoś narzędzia będzie starsza niż trzy miesiące,
- zmieni się stack (nowy framework, nowy uruchamiacz testów),
- §7 przestanie odpowiadać temu, w co zespół faktycznie wierzy.
