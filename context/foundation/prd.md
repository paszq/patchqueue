---
project: "PatchQueue"
version: 1
status: draft
created: 2026-08-20
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 1
  hard_deadline: 2026-09-14
  after_hours_only: true
---

# PatchQueue

## Vision & Problem Statement

Listy podatności przychodzą do jednej osoby kilkoma kanałami naraz — z raportów
skanera, z biuletynów bezpieczeństwa i jako zgłoszenia od innych ludzi. Nie ma
jednego miejsca, które pokazywałoby cały obraz. W momencie, gdy przychodzi kolejna
partia rzędu kilkudziesięciu pozycji, trzeba ustalić kolejność działania, a sama
ocena CVSS do tego nie wystarcza: nie mówi, gdzie dany komponent stoi w tej
konkretnej sieci ani czy jest w ogóle wystawiony. Dziś powstaje jednorazowy arkusz
posortowany po ocenie CVSS. Nie zostaje w nim ślad tego, co zostało świadomie
odrzucone i dlaczego, więc przy następnym przeglądzie ta sama podatność wraca i ta
sama dyskusja odbywa się od nowa.

Istniejące komercyjne rozwiązania nie zamykają tego problemu z dwóch powodów.
Zakładają skalę, budżet i proces, których małe środowisko nie ma — koszt ich
wdrożenia przewyższa sam problem. I nie znają kontekstu tej konkretnej
infrastruktury: nie wiedzą, który zasób jest wystawiony do sieci publicznej, a który
stoi w segmencie odciętym, mimo że to właśnie ta wiedza przesądza o priorytecie. Ta
wiedza istnieje wyłącznie po stronie osoby prowadzącej infrastrukturę i to jej brak
dyskwalifikuje narzędzia zewnętrzne.

## User & Persona

Osoba odpowiedzialna za podatności w małej infrastrukturze, zarządzająca nią
samodzielnie. Sięga po produkt w momencie, w którym dostaje kolejną partię
podatności z wymieszanych źródeł i musi zdecydować, co idzie pierwsze.

Pierwsza wersja obsługuje wyłącznie tę jedną osobę: bez ról, bez przypisywania
właściciela, bez współdzielenia kolejki.

## Success Criteria

### Primary

- Użytkownik przechodzi pełną ścieżkę w jednej sesji: zakłada konto i loguje się,
  rejestruje zasób wraz z jego ekspozycją i krytycznością, dopisuje do niego
  podatność z oceną CVSS, widzi wyliczony priorytet i wyznaczony termin, odnajduje
  pozycję na właściwym miejscu kolejki i zamyka ją decyzją — załatane albo odrzucone
  z podanym powodem.
- Kolejka ustawia pozycje w innym porządku niż samo sortowanie po ocenie CVSS. To
  jest mierzalny dowód, że produkt podejmuje decyzję domenową, a nie tylko
  przechowuje zapisy.

### Secondary

- Użytkownik otrzymuje streszczenie podatności prostym językiem oraz propozycję
  kroków naprawczych, oznaczone jako treść wytworzona automatycznie.

### Guardrails

- Raz zapisane rozstrzygnięcie — załatane albo odrzucone z powodem — nie znika i
  pozostaje dostępne wraz z uzasadnieniem.
- Podatność na zasobie wystawionym do sieci publicznej nigdy nie ląduje w kolejce
  niżej niż ta sama podatność na zasobie odciętym.
- Przy stu i więcej pozycjach kolejka pozostaje czytelna i nie zwalnia.
- Zalogowany użytkownik nie ma dostępu do danych innego konta żadną ścieżką.

## User Stories

### US-01: Rozstrzygnięcie pierwszej podatności

- **Given** zalogowany użytkownik z zarejestrowanym zasobem wystawionym do sieci publicznej
- **When** dopisuje do tego zasobu podatność o wysokiej ocenie CVSS
- **Then** widzi przyznany priorytet wraz ze składnikami, z których powstał, oraz
  wyznaczony termin, a pozycja pojawia się na szczycie kolejki

#### Acceptance Criteria

- Kolejka układa pozycje inaczej niż samo sortowanie po ocenie CVSS
- Przy pozycji widoczne są wszystkie trzy składniki priorytetu, nie sama liczba
- Zamknięcie pozycji jako załatanej albo odrzuconej z powodem zdejmuje ją z kolejki
- Odrzucenie bez podania powodu nie jest możliwe
- Pusta kolejka pokazuje wyjaśnienie, a nie listę zerową

### US-02: Zmiana ekspozycji przestawia kolejkę

- **Given** zasób opisany jako odcięty od sieci publicznej, z otwartymi pozycjami
- **When** użytkownik zmienia jego ekspozycję na wystawioną do sieci publicznej
- **Then** wszystkie otwarte pozycje tego zasobu przesuwają się w kolejce w górę, a
  ich terminy zostają wyznaczone na nowo

#### Acceptance Criteria

- Przeliczenie obejmuje wszystkie otwarte pozycje zasobu, nie tylko przeglądaną
- Pozycje już rozstrzygnięte nie zmieniają swojego zapisanego rozstrzygnięcia

### US-03: Ochrona śladu decyzji przy usuwaniu

- **Given** zasób mający co najmniej jedną nierozstrzygniętą pozycję
- **When** użytkownik próbuje go usunąć
- **Then** produkt odmawia i wskazuje, które pozycje trzeba najpierw zamknąć

#### Acceptance Criteria

- Zasób bez otwartych pozycji daje się usunąć
- Komunikat odmowy nazywa konkretne pozycje blokujące usunięcie

### US-04: Powrót do rozstrzygniętej pozycji

- **Given** pozycja odrzucona wcześniej z podanym powodem
- **When** użytkownik ją odnajduje i przywraca do kolejki
- **Then** pozycja wraca na swoje miejsce według priorytetu, a wcześniejsze
  rozstrzygnięcie wraz z uzasadnieniem pozostaje widoczne w jej historii

#### Acceptance Criteria

- Przywrócenie nie kasuje ani nie nadpisuje wcześniejszego rozstrzygnięcia
- Historia pokazuje kolejne rozstrzygnięcia w porządku chronologicznym

## Functional Requirements

### Uwierzytelnianie

- FR-001: Użytkownik może założyć konto e-mailem i hasłem. Priority: must-have
- FR-002: Użytkownik może zalogować się i wylogować. Priority: must-have

### Zasoby

- FR-003: Użytkownik może zarejestrować zasób opisany nazwą, komponentem z wersją, poziomem ekspozycji i krytycznością. Priority: must-have
  > Socratic: Rozważony kontrargument — ekspozycja i krytyczność to subiektywne oceny, więc wynik
  > jest tak dobry jak zgadywanka na wejściu. Rozstrzygnięcie: wymaganie zostaje bez zmian. Ta
  > wiedza istnieje wyłącznie po stronie osoby prowadzącej infrastrukturę i to właśnie jej brak
  > dyskwalifikuje narzędzia zewnętrzne. Ręczne wprowadzenie jest tu cechą produktu, nie usterką.
- FR-004: Użytkownik może przeglądać listę swoich zasobów. Priority: must-have
- FR-005: Użytkownik może zmienić dane zasobu, w tym poziom ekspozycji. Priority: must-have
- FR-006: Użytkownik może usunąć zasób, o ile nie ma on nierozstrzygniętych pozycji; w przeciwnym razie produkt odmawia i wskazuje, co trzeba najpierw zamknąć. Priority: must-have

### Podatności

- FR-007: Użytkownik może dopisać do zasobu podatność opisaną identyfikatorem, oceną CVSS i opisem. Priority: must-have
- FR-008: Użytkownik może poprawić dane wprowadzonej podatności. Priority: must-have
- FR-009: Użytkownik może usunąć podatność wprowadzoną omyłkowo. Priority: must-have

### Priorytetyzacja

- FR-010: Użytkownik widzi priorytet pozycji wyliczony z oceny CVSS podatności oraz ekspozycji i krytyczności zasobu, którego dotyczy, wraz ze składnikami, z których ten priorytet powstał. Priority: must-have
  > Socratic: Rozważony kontrargument — istnieją gotowe modele priorytetyzacji, więc własny wzór
  > wynajduje koło i może dawać gorszą kolejność. Rozstrzygnięcie: wymaganie zostaje. Zewnętrzne
  > modele opisują, co jest atakowane na świecie, a nie co jest wystawione w tej konkretnej sieci
  > — są uzupełnieniem, nie zamiennikiem. Zarzut fałszywej precyzji zdjęty przez jawność:
  > użytkownik widzi składniki wyniku, nie samą liczbę. Włączenie zewnętrznych sygnałów
  > zaplanowane jako rozszerzenie poza pierwszą wersję.
- FR-011: Użytkownik widzi termin działania wyznaczony na podstawie priorytetu pozycji. Priority: must-have
  > Socratic: Rozważony kontrargument — termin, którego nikt nie egzekwuje, jest dekoracją; mija
  > po cichu dokładnie tak jak dziś w arkuszu. Rozstrzygnięcie: wymaganie zostaje, ale zostaje
  > wzmocnione przez FR-012 — kolejka oznacza pozycje po terminie wraz z liczbą dni opóźnienia.
  > To minimum, przy którym data cokolwiek zmienia; powiadomienia i eskalacja pozostają poza
  > pierwszą wersją.
- FR-012: Użytkownik widzi kolejkę uporządkowaną według priorytetu, z wyraźnym oznaczeniem pozycji po terminie i liczbą dni opóźnienia. Priority: must-have

### Decyzje

- FR-013: Użytkownik może zamknąć pozycję jako załataną. Priority: must-have
- FR-014: Użytkownik może odrzucić pozycję, podając powód. Priority: must-have
- FR-015: Użytkownik może wrócić do zamkniętej pozycji i zobaczyć podjęte rozstrzygnięcie wraz z uzasadnieniem. Priority: must-have
- FR-016: Użytkownik może przywrócić zamkniętą pozycję do kolejki; poprzednie rozstrzygnięcie pozostaje widoczne w historii. Priority: must-have

### Wsparcie generatywne

- FR-017: Użytkownik może poprosić o streszczenie podatności prostym językiem i propozycję kroków naprawczych, wyprowadzone wyłącznie z opisu, który sam wprowadził, i wyraźnie oznaczone jako treść wytworzona automatycznie. Priority: nice-to-have
  > Socratic: Rozważony kontrargument — treść wytworzona automatycznie potrafi brzmieć pewnie i
  > zawierać nieistniejącą wersję komponentu, a w bezpieczeństwie zła rada bywa gorsza niż żadna.
  > Rozstrzygnięcie: wymaganie zawężone. Treść powstaje wyłącznie z opisu wprowadzonego przez
  > użytkownika — nie są dopisywane wersje ani ścieżki spoza niego — i jest oznaczona jako
  > wytworzona automatycznie. Automatyczna kontrola jakości sprawdza, że numery wersji nie są
  > zmyślane.

## Non-Functional Requirements

- Wejście do kolejki i zmiana jej uporządkowania pozostają odczuwalnie natychmiastowe
  przy stu pozycjach.
- Każda operacja trwająca dłużej niż dwie sekundy przez cały swój czas informuje
  użytkownika, że trwa, i daje się przerwać.
- Całą podstawową ścieżkę da się przejść wyłącznie klawiaturą.
- Niedostępność albo wyczerpanie limitu funkcji wytwarzającej streszczenia nie odbiera
  dostępu do żadnej pozostałej funkcji produktu.
- Zalogowany użytkownik nie ma dostępu do danych innego konta żadną ścieżką.

## Business Logic

Produkt ustala kolejność łatania i termin działania, łącząc ocenę CVSS podatności z
ekspozycją i krytycznością zasobu, na którym ta podatność stoi.

Regułę zasilają trzy rzeczy podawane przez użytkownika: ocena CVSS wprowadzona wraz z
podatnością jako liczba od 0 do 10, poziom ekspozycji zasobu oraz jego krytyczność.
Ekspozycja przyjmuje trzy wartości — osiągalny z sieci publicznej, osiągalny wyłącznie
z sieci wewnętrznej, odcięty od świata zewnętrznego. Krytyczność przyjmuje trzy
wartości: niska, średnia, wysoka. Na wyjściu powstaje priorytet pozycji w jednej z czterech klas — krytyczny, wysoki,
średni, niski — wyznaczony na jego podstawie termin działania oraz miejsce w kolejce.
Terminy wynoszą trzy dni dla klasy krytycznej, czternaście dla wysokiej i sześćdziesiąt
dla średniej; klasa niska nie otrzymuje terminu. Konsekwencją reguły jest to, że ta sama podatność otrzymuje różny priorytet w
zależności od tego, na którym zasobie się znajduje — i to odróżnia kolejkę od listy
posortowanej po samej ocenie CVSS.

Użytkownik spotyka regułę w dwóch momentach: zaraz po dopisaniu podatności, gdy widzi
przyznany priorytet wraz ze składnikami, z których powstał, oraz przy zmianie
ekspozycji zasobu, kiedy związane z nim pozycje zmieniają miejsce w kolejce.
Rozstrzygnięcie pozycji jest trwałe i pozostaje dostępne wraz z uzasadnieniem także po
ponownym otwarciu pozycji.

## Access Control

Logowanie e-mailem i hasłem. Konto zakładane w produkcie, dostęp z dowolnego
urządzenia.

Model płaski — jedna rola. Nie ma administratora, członka ani gościa; nie ma
przypisywania właściciela ani współdzielenia kolejki. Konto istnieje po to, żeby
oddzielić dane jednego użytkownika od danych innego, nie po to, żeby różnicować
uprawnienia.

Dane wprowadzane do produktu są demonstracyjne — wymyślone zasoby, wersje i poziomy
ekspozycji. Nie trafia tam obraz prawdziwej infrastruktury.

## Non-Goals

- Wczytywanie list podatności z zewnętrznych źródeł o różnych formatach — raportów
  skanerów, biuletynów bezpieczeństwa, zgłoszeń od ludzi.
- Sięganie do publicznych baz podatności oraz do sygnałów mówiących, co jest realnie
  wykorzystywane w atakach.
- Powiadomienia, przypomnienia i eskalacja po przekroczeniu terminu.
- Praca zespołowa: role, przypisywanie właściciela, współdzielenie kolejki.
- Automatyczne wykrywanie zasobów i ich wersji.
- Aplikacja mobilna oraz praca bez połączenia z siecią.
- Wsparcie generatywne z FR-017 jest oznaczone jako nice-to-have i nie wchodzi do
  zakresu pierwszej wersji, jeśli rdzeń nie zostanie domknięty wcześniej.

## Open Questions

1. Jakie wagi otrzymują poszczególne poziomy ekspozycji i krytyczności w wyliczeniu
   priorytetu? — do rozstrzygnięcia na etapie implementacji, wraz z zestawem przypadków
   testowych. Wiążące ograniczenie pochodzi z guardrails: dobrana waga musi gwarantować,
   że ta sama podatność na zasobie osiągalnym z sieci publicznej nigdy nie znajdzie się
   w kolejce niżej niż na zasobie odciętym. Blokuje: nie.

### Rozstrzygnięte 2026-08-20

- Poziomy ekspozycji: osiągalny z sieci publicznej, osiągalny wyłącznie z sieci
  wewnętrznej, odcięty. Trzy poziomy.
- Krytyczność zasobu: niska, średnia, wysoka. Trzy poziomy.
- Terminy według klasy priorytetu: krytyczny trzy dni, wysoki czternaście, średni
  sześćdziesiąt, niski bez terminu.
- Ocena CVSS wprowadzana jako pojedyncza liczba od 0 do 10. Pełny zapis wektora
  pozostaje poza zakresem pierwszej wersji.
