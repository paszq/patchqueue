---
project: "PatchQueue"
context_type: greenfield
created: 2026-08-20
updated: 2026-08-20
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "kategoria bólu"
      decision: "dane rozproszone; paraliż przy ustalaniu kolejności; brak śladu decyzji"
    - topic: "insight wobec status quo"
      decision: "komercyjne platformy za ciężkie dla małej infrastruktury i nieświadome jej kontekstu ekspozycji"
    - topic: "model dostępu"
      decision: "logowanie e-mail + hasło; konto na serwerze; płaski model bez ról"
    - topic: "charakter danych"
      decision: "dane demonstracyjne, nie produkcyjne — instancja może stać publicznie"
    - topic: "przepływ MVP"
      decision: "ręczne wprowadzanie zasobu i podatności; import z wielu źródeł świadomie odłożony poza MVP"
    - topic: "usuwanie zasobu z otwartymi pozycjami"
      decision: "blokada — najpierw trzeba rozstrzygnąć otwarte pozycje"
    - topic: "odwracalność decyzji"
      decision: "pozycję można przywrócić do kolejki; poprzednia decyzja zostaje w historii"
    - topic: "zakres rundy kontrolnej"
      decision: "pytania kontrolne tylko do wymagań obarczonych ryzykiem; reszta wyprowadzona wprost z przepływu"
    - topic: "reguła działania"
      decision: "kolejność wynika z połączenia CVSS z ekspozycją i krytycznością zasobu"
    - topic: "nazwa projektu"
      decision: "PatchQueue"
    - topic: "zakres persony"
      decision: "pojedynczy użytkownik — właściciel infrastruktury; brak ról i współdzielenia w MVP"
  frs_drafted: 17
  quality_check_status: accepted
---

# Shape notes

## Vision & Problem Statement

Listy podatności CVE przychodzą do jednej osoby kilkoma kanałami naraz — z raportów
skanera, z biuletynów bezpieczeństwa i jako zgłoszenia od innych ludzi. Nie ma jednego
miejsca, które pokazywałoby cały obraz. W momencie, gdy przychodzi kolejna partia
rzędu kilkudziesięciu pozycji, trzeba ustalić kolejność działania — a sam wynik CVSS
do tego nie wystarcza, bo nie mówi, gdzie dany komponent stoi w tej konkretnej sieci
ani czy jest w ogóle wystawiony. Dziś powstaje jednorazowy arkusz, posortowany po
CVSS. Nie zostaje w nim ślad tego, co zostało świadomie odrzucone i dlaczego, więc
przy następnym skanie ta sama podatność wraca i ta sama dyskusja odbywa się od nowa.

Istniejące komercyjne platformy do zarządzania podatnościami nie zamykają tego
problemu z dwóch powodów. Zakładają skalę, budżet i proces, których małe środowisko
nie ma — koszt ich wdrożenia przewyższa sam problem. I nie znają kontekstu tej
konkretnej infrastruktury: nie wiedzą, który host jest wystawiony do internetu, a
który stoi w odciętym segmencie, mimo że to właśnie ta wiedza przesądza o priorytecie.

## User & Persona

Osoba odpowiedzialna za podatności w małej infrastrukturze, zarządzająca nią
samodzielnie. Sięga po narzędzie w momencie, w którym na jej biurku ląduje kolejna
partia podatności z wymieszanych źródeł i trzeba zdecydować, co idzie pierwsze.

Pierwsza wersja obsługuje jednego użytkownika — właściciela infrastruktury. Bez ról,
bez przypisywania właściciela, bez współdzielenia kolejki.

## Access Control

Logowanie e-mailem i hasłem. Konto zakładane w aplikacji, dane trzymane po stronie
serwera, dostęp z dowolnego urządzenia.

Model płaski — jedna rola. Nie ma administratora, członka ani gościa; nie ma
przypisywania właściciela ani współdzielenia kolejki. Konto istnieje po to, żeby
oddzielić dane jednego użytkownika od danych innego, nie po to, żeby różnicować
uprawnienia.

Dane wprowadzane do aplikacji są demonstracyjne — wymyślone hosty, wersje i poziomy
ekspozycji. Nie trafia tam obraz prawdziwej infrastruktury, więc wdrożona instancja
może być dostępna publicznie.

## Success Criteria

### Primary

Użytkownik przechodzi pełną ścieżkę w jednej sesji: zakłada konto i loguje się,
rejestruje zasób wraz z jego ekspozycją i krytycznością, dopisuje do niego
podatność z oceną CVSS, widzi wyliczony priorytet i wyznaczony termin, odnajduje
pozycję na właściwym miejscu kolejki i zamyka ją decyzją — załatane albo odrzucone
z podanym powodem. Decyzja zostaje zapisana trwale.

Kolejka ustawia pozycje inaczej niż zrobiłoby to samo sortowanie po CVSS. To jest
mierzalny dowód, że aplikacja podejmuje decyzję domenową, a nie tylko przechowuje
rekordy.

### Secondary

Model językowy streszcza opis podatności prostym językiem i proponuje kroki
naprawcze dla konkretnej wersji komponentu.

### Guardrails

- Raz zapisana decyzja — załatane albo odrzucone z powodem — nie znika i da się do
  niej wrócić wraz z uzasadnieniem.
- Podatność na zasobie wystawionym do internetu nigdy nie ląduje w kolejce niżej niż
  ta sama podatność na zasobie odciętym. Inwariant domenowy: kolejność wynika z
  ekspozycji, nie z samego CVSS.
- Przy stu i więcej pozycjach kolejka pozostaje czytelna i nie zwalnia.
- Wymóg nienegocjowalny, spoza wyboru użytkownika: zalogowany użytkownik nie ma
  dostępu do żadnego wiersza należącego do innego konta, żadną ścieżką.

## Budżet czasowy

- Rdzeń (przepływ Primary): 1 tydzień.
- Całość zgłoszenia wraz z rozbudową architektury i pipeline'em: do 2026-09-14.
- Praca po godzinach.

## Poza zakresem MVP

Import list z zewnętrznych źródeł o różnych formatach — raporty skanerów, biuletyny
bezpieczeństwa, zgłoszenia od ludzi. Świadomie odłożone: rozwiązanie tego problemu
wymaga warstwy tłumaczącej obce formaty na model domenowy, a jej budowa przed
pierwszym działającym przepływem podniosłaby próg wejścia bez żadnej wcześniejszej
wartości dla użytkownika.

## User Stories

### US-01: Rozstrzygnięcie pierwszej podatności

- **Given** zalogowany użytkownik z zarejestrowanym zasobem wystawionym do internetu
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
- **When** użytkownik zmienia jego ekspozycję na wystawioną do internetu
- **Then** wszystkie otwarte pozycje tego zasobu przesuwają się w kolejce w górę,
  a ich terminy zostają wyznaczone na nowo

#### Acceptance Criteria

- Przeliczenie obejmuje wszystkie otwarte pozycje zasobu, nie tylko przeglądaną
- Pozycje już rozstrzygnięte nie zmieniają swojego zapisanego rozstrzygnięcia

### US-03: Ochrona śladu decyzji przy usuwaniu

- **Given** zasób mający co najmniej jedną nierozstrzygniętą pozycję
- **When** użytkownik próbuje go usunąć
- **Then** aplikacja odmawia i wskazuje, które pozycje trzeba najpierw zamknąć

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
  > Socrates: Rozważony kontrargument — ekspozycja i krytyczność to subiektywne oceny, więc wynik
  > jest tak dobry jak zgadywanka na wejściu. Rozstrzygnięcie: wymaganie zostaje bez zmian. Ta
  > wiedza istnieje wyłącznie po stronie osoby prowadzącej infrastrukturę i to właśnie jej brak
  > dyskwalifikuje narzędzia zewnętrzne. Ręczne wprowadzenie jest tu cechą produktu, nie usterką.
- FR-004: Użytkownik może przeglądać listę swoich zasobów. Priority: must-have
- FR-005: Użytkownik może zmienić dane zasobu, w tym poziom ekspozycji. Priority: must-have
- FR-006: Użytkownik może usunąć zasób, o ile nie ma on nierozstrzygniętych pozycji; w przeciwnym razie aplikacja odmawia i wskazuje, co trzeba najpierw zamknąć. Priority: must-have

### Podatności

- FR-007: Użytkownik może dopisać do zasobu podatność opisaną identyfikatorem, oceną CVSS i opisem. Priority: must-have
- FR-008: Użytkownik może poprawić dane wprowadzonej podatności. Priority: must-have
- FR-009: Użytkownik może usunąć podatność wprowadzoną omyłkowo. Priority: must-have

### Priorytetyzacja

- FR-010: Aplikacja wylicza priorytet pozycji z oceny CVSS podatności oraz ekspozycji i krytyczności zasobu, którego dotyczy, i pokazuje składniki, z których ten priorytet powstał. Priority: must-have
  > Socrates: Rozważony kontrargument — istnieją gotowe modele priorytetyzacji (EPSS, katalog
  > podatności realnie atakowanych), więc własny wzór wynajduje koło i może dawać gorszą kolejność.
  > Rozstrzygnięcie: wymaganie zostaje. Zewnętrzne modele opisują, co jest atakowane na świecie,
  > a nie co jest wystawione w tej konkretnej sieci — są uzupełnieniem, nie zamiennikiem. Zarzut
  > fałszywej precyzji zdjęty przez jawność: użytkownik widzi składniki wyniku, nie samą liczbę.
  > Włączenie zewnętrznych sygnałów zaplanowane jako rozszerzenie poza MVP.
- FR-011: Aplikacja wyznacza termin działania na podstawie wyliczonego priorytetu. Priority: must-have
  > Socrates: Rozważony kontrargument — termin, którego nikt nie egzekwuje, jest dekoracją; mija
  > po cichu dokładnie tak jak dziś w arkuszu. Rozstrzygnięcie: wymaganie zostaje, ale zostaje
  > wzmocnione przez FR-012 — kolejka oznacza pozycje po terminie wraz z liczbą dni opóźnienia.
  > To minimum, przy którym data cokolwiek zmienia; powiadomienia i eskalacja pozostają poza MVP.
- FR-012: Użytkownik widzi kolejkę uporządkowaną według priorytetu, z wyraźnym oznaczeniem pozycji po terminie i liczbą dni opóźnienia. Priority: must-have

### Decyzje

- FR-013: Użytkownik może zamknąć pozycję jako załataną. Priority: must-have
- FR-014: Użytkownik może odrzucić pozycję, podając powód. Priority: must-have
- FR-015: Użytkownik może wrócić do zamkniętej pozycji i zobaczyć podjętą decyzję wraz z uzasadnieniem. Priority: must-have
- FR-016: Użytkownik może przywrócić zamkniętą pozycję do kolejki; poprzednia decyzja pozostaje widoczna w historii. Priority: must-have

### Wsparcie AI

- FR-017: Użytkownik może poprosić o streszczenie podatności prostym językiem i propozycję kroków naprawczych, wyprowadzone wyłącznie z opisu, który sam wprowadził, i wyraźnie oznaczone jako treść wygenerowana. Priority: nice-to-have
  > Socrates: Rozważony kontrargument — model potrafi wygenerować pewnie brzmiącą instrukcję z
  > nieistniejącą wersją pakietu, a w bezpieczeństwie zła rada bywa gorsza niż żadna.
  > Rozstrzygnięcie: wymaganie zawężone. Treść powstaje wyłącznie z opisu wprowadzonego przez
  > użytkownika — model nie dopisuje wersji ani ścieżek spoza niego — i jest oznaczona jako
  > wygenerowana. Automatyczne testy promptów w pipelinie sprawdzają, że numery wersji nie są
  > zmyślane.

## Business Logic

Aplikacja ustala kolejność łatania i termin działania, łącząc ocenę CVSS podatności
z ekspozycją i krytycznością zasobu, na którym ta podatność stoi.

Regułę zasilają trzy rzeczy podawane przez użytkownika: ocena CVSS wprowadzona wraz
z podatnością, poziom ekspozycji zasobu oraz jego krytyczność. Na wyjściu powstaje
priorytet pozycji, wyznaczony na jego podstawie termin działania oraz miejsce w
kolejce. Konsekwencją reguły jest to, że ta sama podatność otrzymuje różny priorytet
w zależności od tego, na którym zasobie się znajduje — i to właśnie odróżnia kolejkę
od listy posortowanej po samej ocenie CVSS.

Użytkownik spotyka regułę w dwóch momentach. Pierwszy raz zaraz po dopisaniu
podatności, gdy widzi przyznany priorytet wraz ze składnikami, z których powstał.
Drugi raz przy zmianie ekspozycji zasobu, kiedy pozycje z nim związane zmieniają
miejsce w kolejce.

Rozstrzygnięcie pozycji — załatana albo odrzucona z podanym powodem — jest trwałe i
pozostaje dostępne wraz z uzasadnieniem także po ponownym otwarciu pozycji.

## Non-Functional Requirements

- Wejście do kolejki i zmiana jej uporządkowania pozostają odczuwalnie natychmiastowe
  przy stu pozycjach.
- Każda operacja trwająca dłużej niż dwie sekundy — w praktyce odpowiedź modelu
  językowego — daje przez cały swój czas widoczny sygnał postępu i daje się przerwać.
- Całą podstawową ścieżkę da się przejść wyłącznie klawiaturą, bez sięgania po mysz.
- Niedostępność albo wyczerpanie limitu funkcji generatywnej nie odbiera dostępu do
  żadnej pozostałej funkcji aplikacji.
- Zalogowany użytkownik nie ma dostępu do danych innego konta żadną ścieżką.

## Non-Goals

- Import list podatności z zewnętrznych źródeł o różnych formatach — raportów
  skanerów, biuletynów bezpieczeństwa, zgłoszeń od ludzi.
- Pobieranie danych o podatnościach z publicznych baz oraz sygnałów mówiących, co
  jest realnie wykorzystywane w atakach.
- Powiadomienia, przypomnienia i eskalacja po przekroczeniu terminu.
- Praca zespołowa: role, przypisywanie właściciela, współdzielenie kolejki.
- Automatyczne wykrywanie zasobów i ich wersji w sieci.
- Aplikacja mobilna oraz praca bez połączenia z siecią.

## Ramy produktu

- Rodzaj produktu: aplikacja webowa.
- Skala: pojedynczy użytkownik, znikomy ruch, dane rzędu setek pozycji.
- Budżet czasowy: rdzeń tydzień, całość do 2026-09-14, praca po godzinach.

## Quality cross-check

Przeprowadzony 2026-08-20. Wszystkie elementy obecne, brak luk do przeniesienia
do pytań otwartych.
