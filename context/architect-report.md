# Raport architektoniczny — moduł 4 (ścieżka 10xArchitect)

Projekt: **PatchQueue** · 2026-09-08

## 1. Opisane projekty

Wszystkie cztery artefakty powstały na **jednym repozytorium** — `paszq/patchqueue`.

|           |                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| Stack     | Astro 6 (SSR) z wyspami React 19, TypeScript 5, Tailwind 4, Supabase (logowanie i baza), Cloudflare Workers |
| Skala     | 51 plików źródłowych, ~4100 linii w `src/`, 4 migracje SQL, 72 commity                                      |
| Artefakty | L2, L3, L4 i L5 — wszystkie z tego repozytorium                                                             |

Produkt: kolejka łatania podatności, która łączy ocenę CVSS z ekspozycją i krytycznością
zasobu, na którym podatność stoi.

## 2. Mapa projektu (z L2)

Źródło: `context/map/repo-map.md`

- **Zero cykli zależności**, warstwy w jednym kierunku: widok i punkty końcowe → warstwa
  danych → reguła domenowa, która nie oddzwania do nikogo.
- **Lokalne centrum: warstwa danych.** Wówczas jeden plik na 335 linii, od którego zależało
  dziewięć modułów. Każda rozbudowa domyślnie lądowała właśnie tam.
- **Moduł głęboki: `src/lib/domain/priority.ts`** — cała logika produktu, zero zależności.
  Jedyny moduł, który da się zmienić bez dotykania reszty.
- **Strefa ryzyka numer jeden: `supabase/migrations/`.** Trzy guardraile produktu żyją
  w wyzwalaczach i politykach dostępu. Jedyną siatką są testy integracyjne.
- **Największy unknown to zasięg samego pomiaru.** `dependency-cruiser` nie parsuje `.astro`:
  pierwszy przebieg pokazał 27 modułów i zero naruszeń, nie widząc całej warstwy widoku.
  Po dołożeniu odczytu importów z frontmatteru krawędzi okazało się dwa razy więcej. SQL
  pozostaje poza zasięgiem i jest tak oznaczony.

## 3. Analiza ficzera (z L3)

Źródło: `context/changes/import-flow/research.md`

**Co badałem i dlaczego.** Wczytywanie znalezisk z zewnętrznych źródeł — jedyna funkcja
przechodząca przez wszystkie warstwy naraz. Wybór wynika wprost ze strefy ryzyka z mapy:
dopasowanie i zapis znalezisk mieszkają w `src/lib/services/`, czyli w tym samym lokalnym
centrum, które mapa wskazała jako najgęstsze.

**Przepływ w skrócie.** Wejściem jest plik CSV albo wklejony tekst; załącznik ma
pierwszeństwo. Adapter rozpoznaje format i tłumaczy obce kształty na jeden typ domenowy,
nie wiedząc nic o bazie. Warstwa danych dopasowuje znalezisko do zasobu po nazwie
komponentu, odrzuca duplikaty i zapisuje. Wraca podsumowanie: ile dodano, ile pominięto,
ilu wierszy nie zrozumiano.

**Dług techniczny — trzy ryzyka:**

1. **Walidacja identyfikatora obowiązuje tylko na jednej ścieżce wejścia.** Import wymaga
   poprawnego CVE, formularz ręczny przyjmuje dowolny łańcuch. Potwierdzone empirycznie:
   uruchomiłem wzorzec walidujący na danych produkcyjnych i `CVE-2026-252` — identyfikator,
   który pięć razy siedział na koncie demonstracyjnym — zostaje **odrzucony**, bo ma trzy
   cyfry w numerze przy wymaganych czterech do siedmiu. Nie mógł wejść importem; wszedł
   formularzem.
2. **Diagnostyka powstaje i ginie.** Adapter zapisuje numer linii i powód odrzucenia,
   warstwa danych buduje status i zdanie wyjaśniające dla każdego znaleziska — a punkt
   końcowy redukuje to do trzech liczb w adresie URL. Potwierdzone grepem: słowo `outcomes`
   nie występuje ani w punkcie końcowym, ani w widoku.
3. **Skupienie obowiązków w warstwie danych.** Potwierdzone **`ast-grep`**: wzorzec
   `$DB.from($TABLE)` wykazał 14 wywołań do bazy rozłożonych na trzy tabele w jednym
   pliku, przy 14 funkcjach eksportowanych. Blast radius: dziewięć modułów zależnych.

Weryfikacja wychwyciła też **błąd we własnej metodzie**: `ast-grep` nie dopasowuje
częściowych identyfikatorów, więc pierwsze zero przy funkcjach mapujących było fałszywe —
naprawdę były cztery. Każde zero potwierdzałem drugą metodą.

## 4. Plan refaktoryzacji (z L4)

Źródło: `context/changes/refactor-opportunities/research.md`, plan w
`context/changes/duplicate-items/plan.md`

**Co refaktoryzowane.** Reguła „ta sama podatność nie może stać dwa razy na tym samym
zasobie" istniała, ale obowiązywała wyłącznie w ścieżce wczytywania — w kodzie aplikacji,
nie w strukturze. Docelowy kształt: unikalny indeks w bazie na parze
(zasób, znormalizowany identyfikator), obowiązujący niezależnie od statusu pozycji
i niezależnie od tego, którą drogą przyszedł zapis.

**Czego świadomie NIE robimy.** Nie kasujemy istniejących duplikatów w migracji — jeśli są,
tworzenie indeksu ma zawieść głośno. Nie ruszamy sprawdzenia w warstwie aplikacji: zostaje
jako tania ścieżka dająca rzetelne podsumowanie, a baza jest siatką pod nim. Nie
wprowadzamy unikalności globalnej — ta sama podatność na dwóch zasobach to dwie różne
pozycje i to jest teza produktu.

**Fazy:**

| Faza                                                             | Weryfikacja                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Reguła w bazie: migracja z unikalnym indeksem                 | automatycznie — test integracyjny, czerwony przed migracją, zielony po            |
| 2. Tłumaczenie odmowy na komunikat i normalizacja identyfikatora | automatycznie — test przeglądowy przez formularz; ręcznie — czytelność komunikatu |

## 5. Domena według DDD (z L5)

Źródło: `context/domain/01-domain-distillation.md`, `03-anti-corruption-layer.md`

**Ubiquitous language:** _Zasób_ (element infrastruktury o znanej ekspozycji
i krytyczności) · _Podatność_ (słabość komponentu z oceną CVSS) · **Pozycja** (podatność
osadzona na konkretnym zasobie — dopiero to ma priorytet) · _Rozstrzygnięcie_ (załatanie
albo odrzucenie z powodem) · _Historia rozstrzygnięć_ (niezmienialny ślad).

**Najważniejszy rozjazd model-vs-kod:** dokumenty konsekwentnie mówią o zasobie jako
o **całości ze swoimi pozycjami**, a kod trzymał trzy niezależne tabele i trzy niezależne
moduły. Wszystkie niezmienniki tej całości były egzekwowane w bazie, czyli tam, gdzie nie
sięga ani analiza statyczna, ani testy jednostkowe.

**Niezmiennik #1 i jego agregat.** Zmiana ekspozycji przelicza priorytety wszystkich
otwartych pozycji zasobu i żadnej rozstrzygniętej. Należy do agregatu **Zasób wraz ze
swoimi pozycjami**, zaimplementowanego jako niezmienny `MonitoredAsset` — każda operacja
zwraca nową całość, więc nie da się zmienić zasobu i zapomnieć o jego pozycjach.
Destylacja oznaczyła ten niezmiennik jako _deklarowany, nie egzekwowany_, i miała rację:
audyt wymagań wykazał później, że strona szczegółów pozycji omija agregat i przelicza
priorytet także dla pozycji rozstrzygniętej.

**Anti-Corruption Layer.** Przecieka `@supabase/supabase-js`: **7 plików produkcyjnych,
19 wystąpień typu `SupabaseClient`** w warstwie danych i pomocniczej. Wybrany przeciek
numer jeden nie jest jednak tym najliczniejszym — to typ `User` w `src/env.d.ts`, bo wchodzi
do `App.Locals`, czyli globalnej przestrzeni frameworka, i jest **niewidoczny w imporcie**.
Widzi go każda strona i każdy punkt końcowy, nie importując pakietu. Reguła domenowa nie
przecieka wcale — pilnują tego dwie reguły `dependency-cruiser`.

## 6. Decyzje, które należą do mnie

Agent prowadził analizy i proponował rozwiązania; poniższe rozstrzygnięcia podjąłem sam,
w dwóch przypadkach wbrew jego rekomendacji.

Odrzuciłem propozycję umieszczenia danych logowania do konta demonstracyjnego na stronie
wejściowej — agent argumentował, że są i tak publiczne w repozytorium, ale uznałem, że
publiczna strona produktu nie jest miejscem na poświadczenia. Wybrałem publiczne
repozytorium z przepisaną historią zamiast rekomendowanego repozytorium prywatnego,
świadomie biorąc na siebie koszt przepisania i odtworzenia 43 odwołań do commitów.
Do agenta przeglądającego pull requesty wybrałem Sonnet 5 zamiast Opus 5, bo przegląd
małego PR-a względem planu nie wymaga najmocniejszego modelu — różnica to około
dwuipółkrotnie niższy koszt przy wyniku, który znalazł dwie realne luki. Zdecydowałem
też, że dowód załatania pozostaje nieobowiązkowy: wymuszenie go byłoby regułą domenową,
której w PRD nie ma, a ten projekt nie dodaje reguł bez zapisania ich najpierw
w wymaganiach.
