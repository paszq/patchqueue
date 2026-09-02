# Raport architektoniczny — PatchQueue

**Blok 10xArchitect** · repozytorium `paszq/patchqueue` · 2026-09-02

Raport składa cztery artefakty modułu 4 w jedną odpowiedź na pytanie: **gdzie w tym
systemie naprawdę mieszka wiedza o produkcie, i co się dzieje, gdy mieszka nie tam, gdzie
myślimy.**

| Artefakt                       | Plik                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- |
| Mapa repozytorium (L2)         | `context/map/repo-map.md`                                                 |
| Research wybranej funkcji (L3) | `context/changes/import-flow/research.md`                                 |
| Plan refaktoryzacji (L4)       | `context/changes/refactor-opportunities/research.md`                      |
| Notatki o domenie (L5)         | `context/domain/01-domain-distillation.md`, `03-anti-corruption-layer.md` |

---

## Teza

PatchQueue jest małym systemem o czystej strukturze: zero cykli zależności, jeden kierunek
przepływu, reguła domenowa bez ani jednej zależności zewnętrznej. Wszystkie cztery badania
zgodnie pokazały, że **problem tego repozytorium nie leży w strukturze kodu, tylko
w rozmieszczeniu reguł.** Twarde reguły produktu są egzekwowane — ale w miejscach, które
wynikły z historii pisania, a nie z tego, czego reguła dotyczy. Skutkiem są luki, których
żadne narzędzie statyczne nie widzi, bo z punktu widzenia grafu zależności wszystko jest
w porządku.

---

## Co pokazał każdy artefakt

**Mapa repozytorium (L2)** — struktura jest zdrowa: 41 plików, zero cykli, warstwy w jednym
kierunku, moduł domenowy izolowany dwiema regułami `dependency-cruiser`. Najważniejsza część
mapy to jednak sekcja o **zasięgu pomiaru**: trzy guardraile produktu żyją w SQL-u, poza
zasięgiem jakiegokolwiek narzędzia w zestawieniu, a graf `.astro` powstał z wyrażenia
regularnego, nie z analizy składniowej. Mapa mówi, co od czego zależy — i wyłącznie tam,
gdzie sięgnęły narzędzia.

**Research funkcji wczytywania (L3)** — jedyna funkcja przechodząca przez wszystkie warstwy
naraz. Warstwa tłumacząca obce formaty jest wzorowa: port, trzy adaptery, parsowanie czyste
i pokryte 28 testami tabelarycznymi. Ale ścieżka ta **wie najwięcej, a mówi najmniej**.
Adapter zapisuje numer linii i powód odrzucenia każdego wiersza; warstwa danych buduje dla
każdego znaleziska status, nazwę zasobu i zdanie wyjaśniające. Punkt końcowy redukuje to
wszystko do trzech liczb w adresie URL. Słowo `outcomes` nie występuje ani w punkcie
końcowym, ani w widoku.

**Ranking refaktoru (L4)** — sześciu kandydatów, każde twierdzenie oznaczone jako _evidence_
albo _inference_, weryfikacja `ast-grep`. Trzech zakwalifikowanych, trzech odrzuconych
z uzasadnieniem — w tym import modułu domenowego przez komponent widoku, który wygląda na
naruszenie warstw, a jest importem wyłącznie typu.

**Destylacja domeny (L5)** — czternaście pojęć, trzej kandydaci na agregaty. Kluczowy
wynik: **wszystkie twarde niezmienniki są egzekwowane w bazie, nie w kodzie domenowym**,
więc ani analiza statyczna, ani testy jednostkowe ich nie widzą. Najgroźniejszy przypadek:
niezmiennik „zmiana ekspozycji przelicza wszystkie otwarte pozycje" nie miał **żadnego**
strażnika — działał wyłącznie dlatego, że priorytet nie jest przechowywany.

---

## Wątek przewodni: reguła mieszka w miejscu pierwszego użycia

Cztery badania, wykonane niezależnie i w różnym czasie, trafiły w ten sam wzorzec. Reguła
dotycząca **pozycji** zostaje zapisana tam, gdzie po raz pierwszy okazała się potrzebna —
a nie tam, gdzie pozycja jest definiowana. Trzy potwierdzone wystąpienia:

| #   | Reguła                                         | Gdzie mieszkała                         | Skutek                                                  |
| --- | ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| 1   | Ślad decyzji zgadza się ze stanem pozycji      | dwa niezależne zapisy w warstwie danych | rozbieżność **trwała**, bo historii nie da się poprawić |
| 2   | Ta sama podatność nie stoi dwa razy na zasobie | wyłącznie w ścieżce wczytywania         | formularz ręczny przepuszczał duplikaty                 |
| 3   | Identyfikator ma kształt CVE                   | wyłącznie w ścieżce wczytywania         | formularz przyjmuje `test`, `CVE-123`, dowolny łańcuch  |

Wystąpienia 1 i 2 zostały naprawione i oba przeniesione **do bazy** — bo baza chroni także
przed zapisem z pominięciem aplikacji i zamyka wyścigi, których sprawdzenie w kodzie zamknąć
nie może. Wystąpienie 3 stoi otwarte i jest opisane w pytaniach otwartych L3.

Najmocniejszy dowód nie pochodzi z analizy, tylko z danych produkcyjnych. Konto
demonstracyjne zawierało pięć pozycji `CVE-2026-252`. Ten identyfikator ma w numerze trzy
cyfry, a wzorzec walidujący przy wczytywaniu wymaga czterech do siedmiu — **nie mógł wejść
tą drogą**. Wszedł formularzem. Te same pięć wierszy jest jednocześnie dowodem na brak
reguły o duplikatach i na brak walidacji kształtu: **jedne dane, dwie niezależne luki, obie
po tej samej stronie.**

## Wątek drugi: wiedza gęstnieje w głąb, a rzednie w górę

Im bliżej bazy, tym więcej system wie o tym, co się właśnie stało. Im bliżej użytkownika,
tym mniej mu o tym mówi. Baza zna trzy guardraile, których nie widzi analiza statyczna.
Warstwa danych zna powód pominięcia każdego znaleziska. Użytkownik dostaje trzy liczby.

To ma konsekwencję, która wykracza poza wygodę: **skoro reguły mieszkają tam, gdzie
narzędzia nie sięgają, jedyną siatką są testy integracyjne.** Dlatego w tym projekcie
warstwa integracyjna nie używa atrap — atrapa odtwarzałaby regułę zamiast ją sprawdzać
i przeszłaby także po usunięciu migracji.

---

## Co z tego wykonano

- **Rozstrzygnięcie jako jedna operacja atomowa** (`bf9e5af`) — dwa zapisy przeniesione do
  funkcji w bazie, w jednej transakcji.
- **Podział warstwy danych wzdłuż pojęć domenowych** (`5cca7b1`) — 335 linii i 14 funkcji
  rozdzielone bez dotykania dziewięciu modułów zależnych, dzięki zachowaniu punktu wejścia.
- **Agregat „zasób wraz ze swoimi pozycjami"** (`5e7cb74`) — sprowadza niezmienniki całości
  do kodu domenowego, nie zabierając bazie roli ostatecznego strażnika.
- **Reguła unikalności pozycji** (`95450be`, `58a6b5c`) — trzecie wystąpienie wzorca,
  domknięte migracją i tłumaczeniem odmowy na język produktu.

## Co świadomie zostawiono

- **Warstwa odcinająca od dostawcy** — plan wyceniony (`03-anti-corruption-layer.md`),
  wykonanie odłożone. `tech-stack.md` przyjmuje sprzężenie z jednym dostawcą jako
  zaakceptowane ryzyko i nie deklaruje wymienialności, więc nie ma tu rozjazdu
  intencja-vs-kod — jest dług o znanym koszcie. Wybrany przeciek #1 nie jest tym
  najliczniejszym, tylko typem `User` w globalnej przestrzeni `App.Locals`: niewidoczny
  w imporcie, a więc trudniejszy do wykrycia niż dziewiętnaście jawnych.
- **Walidacja kształtu identyfikatora** — trzy możliwe umiejscowienia, każde o innym
  koszcie, opisane w pytaniach otwartych L3. Wymaga decyzji produktowej: czy formularz
  ręczny **ma** przyjmować identyfikatory spoza numeracji CVE. Dziś PRD nie zapisuje ani
  tego, ani przeciwieństwa.
- **Surowy błąd bazy przy wyścigu dwóch równoległych wczytań** — odnotowane przez agenta
  przeglądającego PR #1 jako ustalenie F3, świadomie poza zakresem tamtej zmiany.

---

## Czego ten raport nie mówi

- **Nic o zachowaniu w czasie wykonania ani o kosztach wydajnościowych.** Guardrail
  o czytelności kolejki przy stu pozycjach nie został zmierzony; w planie testów jest
  odnotowany jako należący do obserwowalności, nie do testu.
- **Nic o zależnościach wewnątrz bazy.** Graf obejmuje `.ts` i `.tsx` z analizy składniowej,
  `.astro` z wyrażenia regularnego, SQL wcale.
- **Historia jest za krótka na wnioski o współautorstwie i aktywności.** Dwa dni, jeden
  autor. Analiza „kto wie co" nie ma tu zastosowania — to ograniczenie metody wobec młodego
  repozytorium, nie wynik.

Rolę pamięci zespołu pełnią dokumenty kontekstowe. To świadome zastępstwo, nie ozdoba:
przy jednym autorze i agencie jako drugim wykonawcy dokument jest jedynym miejscem, w którym
uzasadnienie decyzji przeżywa sesję.
