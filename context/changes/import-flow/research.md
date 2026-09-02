---
date: 2026-09-02T21:40:00+02:00
researcher: Krystian Paszek (z Claude Opus 5)
git_commit: d94df1b
branch: main
repository: paszq/patchqueue
topic: "Ścieżka wczytywania znalezisk z zewnętrznych źródeł — gdzie mieszka decyzja, co się dzieje przy błędzie, czego brakuje po drugiej stronie"
tags: [research, codebase, import, adapters, walidacja, symetria-wejsc, verified]
status: complete
last_updated: 2026-09-02
last_updated_by: Krystian Paszek
---

# Research: ścieżka wczytywania znalezisk z zewnętrznych źródeł

**Data**: 2026-09-02, 21:40 (+02:00)
**Commit**: `d94df1b`
**Gałąź**: `main`
**Repozytorium**: `paszq/patchqueue`

Każde twierdzenie oznaczone jako **evidence** (sprawdzone w kodzie lub uruchomione)
albo **inference** (wniosek). Wnioski nie są mieszane z faktami.

## Pytanie badawcze

Proces wczytywania znalezisk z zewnętrznych źródeł — od formularza i załącznika, przez
adaptery formatów, dopasowanie do zasobów i wykrywanie duplikatów, po zapis. Gdzie realnie
mieszka każda decyzja, co się dzieje przy błędzie, i **które ścieżki nie mają odpowiednika
w drugiej ścieżce wejścia**.

## Podsumowanie

Ścieżka wczytywania jest najlepiej zaprojektowaną częścią tego produktu i jednocześnie tą,
która najwięcej wie, a najmniej mówi. Warstwa tłumacząca obce formaty jest czysta,
odizolowana i wyczerpująco przetestowana. Problemy leżą na dwóch szwach — i oba są tej
samej natury: **informacja powstaje w jednej warstwie i nie dociera tam, gdzie jest
potrzebna.**

Trzy ustalenia, uporządkowane wagą:

1. **Formularz ręczny nie waliduje kształtu identyfikatora, a import waliduje.** Przez
   formularz można zapisać pozycję o identyfikatorze `test` albo `CVE-123`. Ten sam ciąg
   przez wczytywanie zostałby odrzucony z powodem i numerem linii. Dowód znaleziony
   w danych produkcyjnych, nie wymyślony.
2. **Diagnostyka per znalezisko powstaje i ginie w tej samej funkcji.** Warstwa danych
   buduje dla każdego znaleziska status, nazwę zasobu i zdanie wyjaśniające, po czym punkt
   końcowy redukuje to wszystko do trzech liczb w adresie URL.
3. **Decyzja „brak oceny znaczy zero" jest podzielona między dwie warstwy.** Domena mówi
   „nie wiem" (`null`), warstwa danych zamienia to na `0`. Reguła produktowa mieszka więc
   poza modułem domenowym.

## Ustalenia szczegółowe

### 1. Gdzie realnie mieszka każda decyzja

Prześledzone od żądania do zapisu — **evidence**, każdy wiersz zweryfikowany w kodzie.

| Decyzja                         | Miejsce                                                                                           | Warstwa               |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------- |
| Plik czy wklejony tekst         | `api/import/index.ts:34-35` — `upload instanceof File && upload.size > 0`                         | punkt końcowy         |
| Załącznik ma pierwszeństwo      | `api/import/index.ts:42`                                                                          | punkt końcowy         |
| Limit 2 MB                      | `api/import/index.ts:17,36-38`                                                                    | punkt końcowy         |
| Który format                    | `adapters.ts:246` `detectAdapter` albo jawny wybór użytkownika                                    | domena                |
| Separator CSV                   | `adapters.ts:60-62` — ustalany raz, z nagłówka                                                    | domena                |
| Jak nazywa się kolumna          | `adapters.ts:35-53` — `CSV_ALIASES`, dwujęzyczne                                                  | domena                |
| Czy identyfikator jest poprawny | `finding.ts:76-79` — `normalizeIdentifier`, regex CVE                                             | domena                |
| Jak czytać ocenę CVSS           | `finding.ts:61-73` — przecinek, sufiks, zakres 0–10                                               | domena                |
| Do którego zasobu pasuje        | `services/import.ts:31-39` — po nazwie komponentu, bez względu na wielkość liter                  | warstwa danych        |
| Co przy wielu kandydatach       | `services/import.ts:76-83` — `niejednoznaczne`, pomijane                                          | warstwa danych        |
| Co przy braku dopasowania       | `services/import.ts:62-74` — zasób domyślny albo `bez-zasobu`                                     | warstwa danych        |
| Czy duplikat                    | `services/import.ts:56,86-95` (zbiór `seen`) **oraz** unikalny indeks w bazie od `20260902172000` | warstwa danych + baza |
| **Brak oceny znaczy zero**      | `services/import.ts:100` — `finding.cvss ?? 0`                                                    | **warstwa danych**    |
| Priorytet i termin              | `domain/priority.ts` — przy odczycie, nie przy zapisie                                            | domena                |

**Wniosek — inference.** Podział jest czysty z jednym wyjątkiem: wiersz wytłuszczony.
`parseCvss` zwraca `null`, co znaczy „źródło nie podaje oceny" — to uczciwe stwierdzenie
niewiedzy i należy do domeny. Zamiana `null` na `0` jest natomiast **decyzją produktową**:
mówi, że pozycja bez oceny wchodzi do kolejki na samym dole i czeka na uzupełnienie,
zamiast nie wejść wcale albo dostać zmyśloną wartość. Ta decyzja jest dobrze uzasadniona
w komentarzu, ale mieszka w warstwie danych, gdzie nie sięga ani test jednostkowy domeny,
ani analiza czystości modułu domenowego.

### 2. Co się dzieje przy błędzie

Ścieżka ma **cztery poziomy niepowodzenia** i każdy zachowuje się inaczej — **evidence**.

| Rodzaj               | Zachowanie                                      | Czy użytkownik wie, co się stało |
| -------------------- | ----------------------------------------------- | -------------------------------- |
| Puste wejście        | komunikat „Załącz plik albo wklej treść"        | tak                              |
| Plik za duży         | komunikat z limitem                             | tak                              |
| Format nierozpoznany | „Nie rozpoznano formatu — wskaż go ręcznie"     | tak                              |
| Wiersz niezrozumiały | `RejectedLine{line, raw, reason}`               | **tylko liczba**                 |
| Znalezisko pominięte | `ImportOutcome{status, assetName, detail}`      | **tylko liczba**                 |
| Błąd zapisu do bazy  | `DataAccessError(error.message)` — surowa treść | nie                              |

Dwa ostatnie wiersze tabeli opisują ten sam problem i to jest najważniejsze ustalenie
tej sekcji.

`adapters.ts` starannie zapisuje **numer linii i powód** dla każdego odrzuconego wiersza
(`adapters.ts:103-106`, `164-167`, `212-215`). `services/import.ts` buduje dla każdego
znaleziska pełną diagnostykę: status (`dodane` / `duplikat` / `bez-zasobu` /
`niejednoznaczne`), nazwę dopasowanego zasobu oraz zdanie wyjaśniające — na przykład
_„nie ma zasobu z komponentem «postfix»"_, _„komponent «nginx» pasuje do 3 zasobów"_,
_„źródło nie podało oceny — uzupełnij ją ręcznie"_ (`services/import.ts:62-115`).

Po czym punkt końcowy bierze z tego **wyłącznie trzy liczby** i przekazuje je parametrami
adresu (`api/import/index.ts:60-65`). Sprawdzone: słowo `outcomes` nie występuje ani
w `api/import/index.ts`, ani w `import.astro` — **evidence**, grep po obu plikach nie
zwraca nic.

Użytkownik widzi „Dodano 0, pominięto 1, nie zrozumiano 0 wierszy" i nie ma **żadnej
drogi**, żeby dowiedzieć się, którego znaleziska to dotyczyło ani dlaczego. Informacja
istnieje, jest dokładna, i zostaje wyrzucona jedną warstwę przed odbiorcą.

**Inference.** To nie jest zaniedbanie warstwy tłumaczącej — ta zrobiła swoją robotę
wzorowo. To brakujący kontrakt między warstwą danych a widokiem: `ImportSummary` niesie
`outcomes`, ale nic nie zobowiązuje punktu końcowego, żeby je przekazał, a `URLSearchParams`
jest kanałem, przez który taka lista i tak by się nie zmieściła.

### 3. Czego nie ma po drugiej stronie — asymetria wejść

To jest sedno pytania badawczego. Produkt ma **dwie ścieżki wejścia** dla tego samego
pojęcia — pozycji na zasobie — i obowiązują w nich **różne reguły**.

| Reguła                                        | Wczytywanie                     | Ręczne dopisanie                              |
| --------------------------------------------- | ------------------------------- | --------------------------------------------- |
| Identyfikator musi być poprawnym CVE          | **tak** — `finding.ts:76-79`    | **nie** — dowolny łańcuch 1–100 znaków        |
| Identyfikator normalizowany do wielkich liter | tak                             | tak, **od `20260902`** (wcześniej nie)        |
| Duplikat na tym samym zasobie odrzucony       | tak — zbiór `seen`              | przez bazę, **od `20260902`** (wcześniej nie) |
| Ocena poza zakresem 0–10 odrzucona            | tak — `parseCvss` zwraca `null` | tak — zod                                     |
| Brak oceny dopuszczalny                       | tak, wchodzi z zerem            | nie, pole wymagane                            |
| Wiersz odrzucony z podaniem powodu            | tak (powód ginie, patrz §2)     | nie dotyczy                                   |

**Kluczowe ustalenie — evidence, sprawdzone uruchomieniem wzorca.**

Wzorzec walidujący identyfikator przy wczytywaniu to `/\b(CVE-\d{4}-\d{4,7})\b/i`.
Formularz ręczny nie waliduje kształtu w ogóle — `z.string().trim().min(1).max(100)`
(`api/vulnerabilities/index.ts:10-16`).

Uruchomione na kandydatach:

```
"CVE-2026-252"   -> ODRZUCONY przez import   (numer ma 3 cyfry, wzorzec wymaga 4–7)
"CVE-2026-1234"  -> PRZYJETY
"cve-2026-1111"  -> PRZYJETY
"test"           -> ODRZUCONY przez import
"CVE-123"        -> ODRZUCONY przez import
"ala ma kota"    -> ODRZUCONY przez import
```

Każdy z odrzuconych **przechodzi przez formularz ręczny bez żadnego sprzeciwu.**

Najmocniejszy dowód nie pochodzi z tej tabeli, tylko z danych produkcyjnych. Konto
demonstracyjne zawierało pięć pozycji o identyfikatorze `CVE-2026-252`. Ten identyfikator
**nie mógł wejść przez wczytywanie** — wzorzec go odrzuca. Wszedł formularzem. Ten sam
przypadek ujawnił brak reguły o duplikatach (zmiana `duplicate-items`) i jest jednocześnie
dowodem na brak walidacji kształtu. Jedne dane, dwie niezależne luki, obie po tej samej
stronie.

**Inference.** To nie są dwa osobne niedopatrzenia, tylko **jeden wzorzec**: reguły
dotyczące pozycji zostały zapisane tam, gdzie były potrzebne po raz pierwszy — w warstwie
tłumaczącej obce formaty — zamiast tam, gdzie definiuje się pozycję. Ścieżka ręczna
powstała wcześniej (`721dace`, cała ścieżka główna) i nigdy nie została do nich
doprowadzona. Zmiana `duplicate-items` naprawiła jedną z dwóch; druga stoi otwarta.

### 4. Co w tej ścieżce jest zrobione dobrze

Uczciwość badania wymaga odnotowania tego, co się broni — **evidence**.

- **Port i adaptery są prawdziwą granicą.** Poza `adapters.ts` nikt nie wie, że raport
  skanera ma kolumny, biuletyn myślniki, a lista bywa gołymi identyfikatorami. Warstwa
  danych i widok nie znają nawet liczby formatów.
- **Parsowanie jest czyste** — bez bazy, HTTP i zegara — więc 28 testów pokrywa je tabelą
  przypadków zamiast klikaniem. Trzy z nich złapały prawdziwe błędy (commit `0bab983`):
  separator wykrywany osobno w każdym wierszu rozjeżdżał się z nagłówkiem przy ocenie
  zapisanej przecinkiem; myślnik wewnątrz identyfikatora powodował branie gołej listy za
  biuletyn; ocena `"-1"` była czyszczona do `1`.
- **Rozpoznawanie formatu nie opiera się na kolejności w tablicy.** Ryzyko, że goła lista
  zostanie wzięta za biuletyn, jest zamknięte w samym `recognizes` biuletynu, który wymaga
  oceny albo treści po separatorze (`adapters.ts:138-147`) — a nie tym, że lista jest
  sprawdzana później. To istotne: kolejność w tablicy jest wtedy optymalizacją, nie regułą,
  której złamanie psuje zachowanie.
- **Pusta komórka znaczy „nie wiem", nie „pusty tekst"** — `blankToNull`, `adapters.ts:19-22`.

## Odniesienia do kodu

- `src/pages/import.astro` — formularz: załącznik, pole tekstowe, wybór formatu, zasób domyślny
- `src/pages/api/import/index.ts:34-46` — wybór źródła treści, limit rozmiaru, pierwszeństwo pliku
- `src/pages/api/import/index.ts:60-65` — redukcja podsumowania do trzech liczb
- `src/lib/domain/import/finding.ts:61-79` — `parseCvss` i `normalizeIdentifier`
- `src/lib/domain/import/adapters.ts:35-53` — aliasy kolumn CSV
- `src/lib/domain/import/adapters.ts:60-62` — ustalanie separatora raz, z nagłówka
- `src/lib/domain/import/adapters.ts:138-147` — rozpoznawanie biuletynu odporne na gołą listę
- `src/lib/services/import.ts:31-39` — dopasowanie do zasobu po komponencie
- `src/lib/services/import.ts:62-115` — budowanie diagnostyki, która nigdzie nie trafia
- `src/lib/services/import.ts:100` — `finding.cvss ?? 0`
- `src/pages/api/vulnerabilities/index.ts:10-16` — walidacja identyfikatora na ścieżce ręcznej
- `supabase/migrations/20260902172000_unique_item_per_asset.sql` — reguła unikalności

## Wnioski architektoniczne

**Wzorzec: reguła zapisana w miejscu pierwszego użycia, a nie w miejscu pojęcia.**
Ten projekt zna już ten wzorzec z dwóch przypadków — atomowości zapisu rozstrzygnięcia
i unikalności pozycji. Trzeci przypadek, walidacja kształtu identyfikatora, jest tej samej
rodziny i wciąż otwarty. Wspólny mianownik: reguła dotyczy **pozycji**, a mieszka
w module, który obsługuje **jedną drogę dojścia do pozycji**.

**Wzorzec: informacja gęstnieje w głąb, a rzednie w górę.** Im bliżej bazy, tym więcej
produkt wie o tym, co się właśnie stało; im bliżej użytkownika, tym mniej mu o tym mówi.
Adapter wie numer linii i powód. Warstwa danych wie, który zasób i dlaczego pominięto.
Użytkownik dostaje trzy liczby. Kanałem, który to ucina, jest `URLSearchParams` —
wybór z czasów, gdy podsumowanie było faktycznie trzema liczbami.

**Kontrast, który warto zachować.** `ImportedFinding` jest osobnym typem od `Vulnerability`
i to jest słuszne: znalezisko nie ma jeszcze zasobu, więc nie ma priorytetu i nie jest
pozycją. Ta granica jest w kodzie czysta i nie należy jej zacierać przy naprawianiu
asymetrii — walidacja kształtu identyfikatora powinna wejść do miejsca wspólnego dla obu
ścieżek, a nie polegać na tym, że ręczna zacznie używać `ImportedFinding`.

## Kontekst historyczny

- `context/changes/duplicate-items/change.md` — ta sama klasa problemu, rozpoznana
  i naprawiona; źródło pytania badawczego o pozostałe asymetrie
- `context/changes/refactor-opportunities/research.md` — kandydat 1 (dwa zapisy bez
  transakcji) to najwcześniejszy przypadek wzorca „reguła w jednym miejscu w kodzie"
- `context/domain/01-domain-distillation.md` — klasyfikuje tłumaczenie obcych formatów jako
  subdomenę **wspierającą**; niniejsze badanie tego nie podważa, ale pokazuje, że reguły
  o pozycji przeciekły do subdomeny wspierającej z subdomeny rdzeniowej
- `commit 0bab983` — wprowadzenie warstwy tłumaczącej wraz z opisem trzech błędów złapanych
  przez testy tabelaryczne

## Pytania otwarte

1. **Gdzie umieścić walidację kształtu identyfikatora, żeby obowiązywała obie ścieżki?**
   Trzy możliwości, każda z innym kosztem: ograniczenie `check` w bazie (spójne z resztą
   guardraili tego produktu, ale odcina przyszłe źródła używające innych numeracji niż CVE),
   wspólny moduł domenowy wołany przez oba punkty końcowe (elastyczne, ale reguła znów
   mieszka w kodzie, nie w strukturze), albo świadoma decyzja, że formularz ręczny **ma**
   przyjmować dowolny identyfikator, bo służy do wpisywania rzeczy spoza CVE. Trzecia opcja
   jest obroną obecnego stanu i wymagałaby zapisania w PRD — dziś nie jest tam zapisana
   ani ona, ani jej przeciwieństwo.
2. **Czy podsumowanie wczytywania powinno pokazywać listę pominiętych znalezisk?**
   Dane istnieją; brakuje kanału. `URLSearchParams` się nie nadaje, więc wymagałoby to
   zmiany kształtu odpowiedzi — prawdopodobnie renderowania wyniku zamiast przekierowania.
3. **Czy `finding.cvss ?? 0` powinno przenieść się do modułu domenowego?** Reguła jest
   produktowa i ma uzasadnienie, ale dziś jest niewidoczna dla testów domeny.
4. **Wyścig dwóch równoległych wczytań** kończy się surowym komunikatem bazy zamiast
   podsumowaniem z pozycją `duplikat`. Odnotowane przez agenta przeglądającego PR #1 jako
   ustalenie F3 i świadomie zostawione poza zakresem tamtej zmiany.
