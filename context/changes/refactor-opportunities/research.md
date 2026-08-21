---
change_id: refactor-opportunities
created: 2026-08-21
last_updated: 2026-08-21
tags: [research, architektura, verified]
verified_at_commit: 55a2837
inputs:
  - context/map/repo-map.md
  - context/map/artifact-2-structure.md
---

# Okazje do refaktoru — badanie

## Kandydaci — klasyfikacja do audytu

| # | Problem | Klasyfikacja | Uzasadnienie |
|---|---|---|---|
| 1 | `recordDecision` wykonuje dwa niezależne zapisy bez transakcji | **KANDYDAT** | Naprawa przenosi operację do bazy — zmienia strukturę, nie tylko treść |
| 2 | Warstwa danych skupia pięć obowiązków w jednym pliku | **KANDYDAT** | Rozdzielenie zmienia strukturę modułów |
| 3 | Obsługa błędu powtórzona 12×, adnotacja kształtu odpowiedzi 10× | **KANDYDAT** | Wyodrębnienie abstrakcji zmienia strukturę |
| 4 | SQL poza zasięgiem analizy statycznej | nie-kandydat | Luka w narzędziach, nie w strukturze kodu |
| 5 | `PriorityBadge.astro` importuje moduł domenowy z pominięciem warstwy danych | nie-kandydat | Import wyłącznie typu; brak sprzężenia w czasie wykonania |
| 6 | Formularze uwierzytelniania odziedziczone po starterze | nie-kandydat | Naprawione dwoma poprawkami; struktura nie jest problemem |

---

## Kandydat 1 — dwa zapisy bez transakcji przy rozstrzygnięciu

### Obecny kształt

`src/lib/services/patchqueue.ts:232-250` — `recordDecision` wykonuje kolejno:

1. `insert` do `decisions` (linia 233) — **evidence**
2. `update` statusu w `vulnerabilities` (linia 241) — **evidence**

Między nimi nie ma żadnego mechanizmu spójności. W całym `src/lib/` nie występuje ani
jedno wywołanie `rpc(`, słowo `transaction` ani `begin` — **evidence**, sprawdzone
grepem po katalogu.

**Konsekwencja.** Jeśli drugi zapis się nie powiedzie, historia twierdzi, że pozycję
odrzucono, a pozycja zostaje otwarta i wraca do kolejki. Odwrotna kolejność jest
niemożliwa, bo insert idzie pierwszy — więc rozbieżność ma zawsze ten sam kierunek:
**ślad decyzji wyprzedza stan**.

Waga tego jest wyższa niż zwykłej niespójności, bo tabela `decisions` jest
z założenia tylko do dopisywania — nie ma polityki `UPDATE` ani `DELETE`
(`supabase/migrations/20260820150000_initial_schema.sql:186-191`) — **evidence**.
Błędnego wpisu nie da się poprawić ani usunąć **żadną ścieżką dostępną aplikacji**.
Rozbieżność jest trwała.

To uderza wprost w guardrail z PRD (`prd.md:69`): *„raz zapisane rozstrzygnięcie nie
znika i pozostaje dostępne wraz z uzasadnieniem"*. Guardrail chroni przed zniknięciem
zapisu. Nie chroni przed zapisem, który nigdy nie powinien powstać — **inference**.

### Intencjonalność

**Przypadkowa złożoność.** Kod powstał w jednym commicie `721dace` obejmującym całą
ścieżkę główną — **evidence**, `git log` po tym pliku zwraca jeden wpis. W żadnym
dokumencie kontekstowym nie pada słowo o transakcyjności ani spójności zapisu —
**evidence**, grep po `context/`. Nie ma śladu decyzji „świadomie rezygnujemy z
atomowości"; jest ślad tego, że pytanie nie padło.

### Wykonalność migracji

Docelowy kształt: **jedna funkcja w bazie** wywoływana przez `rpc`, wykonująca oba
zapisy w jednej transakcji. Baza już zawiera funkcje z wyzwalaczami
(`refuse_asset_delete_with_open_items`), więc to nie jest nowa kategoria abstrakcji w
tym projekcie — **evidence**.

- **Blast radius:** jeden punkt końcowy (`src/pages/api/decisions/index.ts`) i jedna
  funkcja warstwy danych. Dziewięć modułów zależy od warstwy danych, ale tylko jeden od
  tej funkcji — **evidence**, grep po `recordDecision`.
- **Osłony:** trzy testy integracyjne dotykają rozstrzygnięć, jeden test przeglądowy
  przechodzi pełną ścieżkę odrzucenia i przywrócenia — **evidence**.
- **Pierwszy krok:** test integracyjny, który wymusza rozbieżność — wpis w historii przy
  nieudanej zmianie statusu — i pokazuje, że dziś zostaje trwale. Czerwony przed migracją.

---

## Kandydat 2 — pięć obowiązków w jednym pliku

### Obecny kształt

`src/lib/services/patchqueue.ts`, 335 linii, **14 eksportowanych funkcji** — evidence,
potwierdzone `ast-grep` i grepem niezależnie. Obowiązki:

| Obowiązek | Dowód |
|---|---|
| Mapowanie wierszy na kontrakty | 4 funkcje (raport: 3): `toAsset:51`, `toVulnerability:64`, `toDecision:77`, `joinedAsset:296` |
| Operacje na zasobach | 5 funkcji, linie 100–160 |
| Operacje na podatnościach | 4 funkcje, linie 168–220 |
| Rozstrzygnięcia | 2 funkcje, linie 232–260 |
| Budowanie i porządkowanie kolejki | 3 funkcje, linie 270–340 |

14 wywołań do bazy rozłożonych na trzy tabele: `assets` 5, `vulnerabilities` 7,
`decisions` 2 — **evidence**, `ast-grep` po wzorcu `$DB.from($TABLE)`.

Dziewięć modułów importuje ten plik — **evidence**. Żaden punkt końcowy nie sięga do
bazy z jego pominięciem — **evidence**, grep po `supabase` w `src/pages/api/` poza
uwierzytelnianiem daje pustkę. Dyscyplina jest zachowana; problemem jest gęstość, nie
przecieki.

### Intencjonalność

**Świadome ograniczenie, które właśnie przestaje wystarczać.** Jeden plik dla warstwy
danych był rozsądny przy trzech tabelach i jednym źródle danych. Roadmapa przewiduje
dołożenie wczytywania z zewnętrznych źródeł o różnych formatach
(`roadmap.md` §Parked) — **evidence**. To wprowadzi szósty obowiązek, obcy pozostałym:
tłumaczenie cudzych kształtów danych na model domenowy.

### Wykonalność migracji

Docelowy kształt: podział wzdłuż pojęć domenowych — zasoby, podatności,
rozstrzygnięcia, kolejka — z mapowaniem wierszy jako wspólną podstawą. Nowa abstrakcja
nie jest potrzebna; wystarczy rozdzielenie istniejącej.

- **Blast radius:** dziewięć modułów importujących. Można to jednak zrobić bez ich
  dotykania, zachowując dotychczasowy plik jako punkt wejścia re-eksportujący części —
  **inference**.
- **Osłony:** brak testów jednostkowych warstwy danych. Osłoną są testy integracyjne
  (10) i przeglądowe (6), oba przechodzące przez prawdziwą bazę — **evidence**.
- **Pierwszy krok:** wydzielić mapowanie wierszy do osobnego modułu. Najmniejszy,
  odwracalny ruch, który nie zmienia niczyjego importu.

---

## Kandydat 3 — powtórzenie w obsłudze wyniku zapytania

### Obecny kształt

- Blok `if (error !== null) throw new DataAccessError(error.message);` — **12 wystąpień**,
  linie 105, 115, 133, 144, 154, 184, 199, 205, 214, 258, 307, 332 — **evidence**,
  `ast-grep` i grep zgodne.
- Adnotacja `{ data: X | null; error: { message: string } | null }` — **10 wystąpień** —
  **evidence**, grep.

Adnotacja nie jest ozdobna: bez niej klient bazy zwraca `any` i lint odrzuca kod. To
obejście braku wygenerowanych typów schematu — **inference**.

### Intencjonalność

**Przypadkowa złożoność, ale o znanym źródle.** Powtórzenie wynika z tego, że projekt
nie generuje typów schematu z bazy. Dostawca udostępnia do tego narzędzie; nie zostało
użyte — **evidence**, brak jakiegokolwiek pliku z typami bazy w repozytorium.

### Wykonalność migracji

Dwie niezależne ścieżki:

1. Wygenerować typy schematu — usuwa potrzebę 10 adnotacji u źródła.
2. Wyodrębnić funkcję zdejmującą wynik zapytania — skraca 12 bloków do jednego.

- **Blast radius:** wyłącznie wnętrze warstwy danych; żaden import się nie zmienia — **evidence**.
- **Pierwszy krok:** wygenerować typy, bo to zdejmuje przyczynę, a nie objaw.

---

## Refactor opportunities (ranked)

### 1. Rozstrzygnięcie jako jedna operacja w bazie

**Obecny → docelowy:** dwa niezależne zapisy z aplikacji → jedna funkcja w bazie
wywoływana przez `rpc`, wykonująca oba zapisy w transakcji.

**Dlaczego pierwsze miejsce:** to jedyny kandydat, w którym koszt długu nie jest
wygodą pracy, lecz **trwałym uszkodzeniem danych**, którego aplikacja nie potrafi
naprawić — tabela historii nie przyjmuje poprawek ani usunięć. Pozostali dwaj
kandydaci spowalniają zmiany; ten kłamie w audycie. Koszt zmiany jest przy tym
najniższy z całej trójki: jeden punkt końcowy, jedna funkcja, wzorzec obecny już
w projekcie.

**Blast radius:** 1 punkt końcowy, 1 funkcja warstwy danych, 1 nowa migracja.
**Ścieżka:** test wymuszający rozbieżność → funkcja w bazie → przepięcie warstwy danych → usunięcie starej ścieżki.
**Pierwszy krok:** test integracyjny, czerwony przed migracją.

### 2. Podział warstwy danych wzdłuż pojęć domenowych

**Obecny → docelowy:** jeden plik, 14 funkcji, pięć obowiązków → moduły zasobów,
podatności, rozstrzygnięć i kolejki na wspólnym mapowaniu wierszy.

**Dlaczego drugie miejsce:** dług jest realny, ale dziś **nie boli** — dyscyplina jest
zachowana, nic nie przecieka. Zacznie boleć przy najbliższej rozbudowie, bo wczytywanie
z zewnętrznych źródeł dołoży obowiązek obcy pozostałym. Robić przed tą rozbudową,
nie po.

**Blast radius:** 9 modułów importujących, ale do zera przy zachowaniu punktu wejścia.
**Ścieżka:** wydzielić mapowanie → wydzielić moduły po kolei → dopiero na końcu rozważyć usunięcie punktu wejścia.
**Pierwszy krok:** mapowanie wierszy do osobnego modułu.

### 3. Zdjęcie powtórzeń przez wygenerowanie typów schematu

**Obecny → docelowy:** 10 ręcznych adnotacji i 12 identycznych bloków → typy
generowane z bazy plus jedna funkcja zdejmująca wynik.

**Dlaczego trzecie miejsce:** czysty szum. Nie grozi błędem i nie blokuje rozbudowy, ale
maskuje różnice — przy 12 identycznych blokach ten jeden, który jest inny, przestaje
rzucać się w oczy. Tani do zrobienia, więc wart zrobienia; ostatni, bo nic od niego
nie zależy.

**Blast radius:** wnętrze jednego pliku.
**Pierwszy krok:** wygenerować typy schematu.

## Rozważeni i odrzuceni

| Kandydat | Dlaczego odrzucony |
|---|---|
| SQL poza analizą statyczną | Luka narzędziowa, nie strukturalna. Odnotowana w mapie jako `unknown`; naprawą jest test, nie refaktor. |
| Import typu domenowego w komponencie widoku | Wyłącznie typ, znika przy kompilacji. Zero sprzężenia w czasie wykonania. |
| Formularze uwierzytelniania ze startera | Dwa realne błędy już naprawione i pokryte testami regresji. Kształt nie jest przyczyną. |
| Brak testów jednostkowych warstwy danych | Wejście do oceny kosztu, nie kandydat: to brak osłony, nie problem strukturalny. Podnosi ryzyko kandydata 2. |

## Weryfikacja twierdzeń (ast-grep)

Każde twierdzenie strukturalne sprawdzone narzędziem; każde zero potwierdzone drugą
metodą, zgodnie z zasadą, że zero z `ast-grep` może znaczyć „nie ma" albo „zły wzorzec".

| Twierdzenie | Werdykt | Dowód | Metoda |
|---|---|---|---|
| 14 eksportowanych funkcji w warstwie danych | potwierdzone | `patchqueue.ts` | wzorzec `export function $N($$$): $R { $$$ }` + grep |
| Blok obsługi błędu powtórzony 12× | potwierdzone | linie 105, 115, 133, 144, 154, 184, 199, 205, 214, 258, 307, 332 | wzorzec dosłowny + grep, wyniki zgodne |
| Adnotacja kształtu odpowiedzi 10× | potwierdzone | `patchqueue.ts` | grep |
| 3 funkcje mapujące wiersz na kontrakt | **doprecyzowane: 4** | `toAsset:51`, `toVulnerability:64`, `toDecision:77`, `joinedAsset:296` | wzorzec `function $N(row: $T): $R { $$$ }` |
| 14 wywołań do bazy: assets 5, vulnerabilities 7, decisions 2 | potwierdzone | `patchqueue.ts` | wzorzec `$DB.from($T)` |
| 9 modułów importuje warstwę danych | potwierdzone | 5 punktów końcowych + 4 strony | grep po ścieżce importu |
| **Zero** wywołań `rpc` i transakcji w `src/lib` | potwierdzone | — | wzorzec `$X.rpc($$$)` = 0, grep po `rpc(\|transaction\|BEGIN` = 0 |
| **Zero** punktów końcowych omijających warstwę danych | potwierdzone | — | grep po `supabase` w `src/pages/api/` poza uwierzytelnianiem = 0 |
| Tabela `decisions` bez polityk UPDATE i DELETE | potwierdzone | tylko `decisions_select` i `decisions_insert` | grep po `create policy decisions_` |
| `recordDecision` zaczyna się w linii 232 | potwierdzone | `patchqueue.ts:232` | grep |

### Uwagi metodyczne

**Wzorzec bez `async` łapie także funkcje asynchroniczne.** Pierwsze liczenie rozbiłem
na dwa wzorce — z `async` i bez — i zsumowałem, dostając 27 przy 14 rzeczywistych
funkcjach. Wzorzec `export function` dopasowuje również `export async function`, więc
sumowanie liczyło je dwa razy. Twierdzenie z raportu było poprawne; błędna była moja
arytmetyka przy sprawdzaniu.

**Zero z `ast-grep` przy funkcjach mapujących było fałszywe.** Pierwszy wzorzec
`function to$N($ROW)` zwrócił zero, bo `ast-grep` nie dopasowuje częściowych
identyfikatorów — `to$N` nie jest wzorcem nazwy zaczynającej się od „to". Klasyczny grep
znalazł trzy funkcje, a poprawiony wzorzec cztery. To jest dokładnie ten przypadek,
przed którym instrukcja każe potwierdzać zera drugą metodą: bez tego kroku zapisałbym
w raporcie „brak funkcji mapujących" przy czterech istniejących.

**Korekta liczby nie zmienia rankingu.** Czwarta funkcja (`joinedAsset`) normalizuje
kształt osadzonej relacji, więc wzmacnia kandydata 2 zamiast go podważać — to kolejny
obowiązek w tym samym pliku. Pozycje kandydatów pozostają bez zmian.
