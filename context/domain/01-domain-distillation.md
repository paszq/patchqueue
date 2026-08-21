---
title: Destylacja domeny PatchQueue
created: 2026-08-21
type: domain-distillation
---

# Destylacja domeny

> Dokument jest **mapą**, nie kodem. Cytaty zweryfikowane.

## Krok 0 — Kontekst

Źródła: `context/foundation/prd.md`, `tech-stack.md`, `shape-notes.md`, `README.md`.
Stack: Astro 6 / React 19 / TypeScript / Supabase. Warstwy: reguła domenowa
(`src/lib/domain`), warstwa danych (`src/lib/services`), punkty końcowe
(`src/pages/api`), widok (`src/pages`, `src/components`), persystencja z regułami
(`supabase/migrations`).

Cecha wyróżniająca tego repozytorium: **część reguł domenowych żyje w bazie**, nie w
kodzie aplikacji — w wyzwalaczach i ograniczeniach. Analiza statyczna ich nie widzi
(patrz `context/map/repo-map.md`, sekcja Ograniczenia), więc każde pojęcie sprawdzam w
obu miejscach.

## Krok 1 — Ubiquitous Language

| Pojęcie | Definicja | Źródło | Gdzie żyje w kodzie |
|---|---|---|---|
| **Zasób** | Element infrastruktury opisany komponentem i wersją, dla którego znamy ekspozycję i krytyczność | `prd.md:144` | `src/lib/services/assets.ts`, tabela `assets` |
| **Ekspozycja** | Osiągalność zasobu: z sieci publicznej / tylko wewnętrznie / odcięty | `prd.md:199-204` | `priority.ts:14` |
| **Krytyczność** | Znaczenie zasobu dla działania: wysoka / średnia / niska | `prd.md:199-204` | `priority.ts:15` |
| **Podatność** | Znana słabość komponentu, opisana identyfikatorem i oceną CVSS | `prd.md:172` | tabela `vulnerabilities` |
| **Ocena CVSS** | Powszechna miara wagi podatności, 0–10, niezależna od kontekstu | `prd.md:199` | `priority.ts` — wejście reguły |
| **Pozycja** | Podatność osadzona na konkretnym zasobie — dopiero to ma priorytet | `prd.md:199-205` | `QueueEntry` w `src/types.ts` |
| **Priorytet** | Klasa pilności wyliczona z oceny, ekspozycji i krytyczności | `prd.md:199` | `priority.ts:97` |
| **Termin** | Data, do której pozycja powinna zostać rozstrzygnięta | `prd.md:205` | `priority.ts:124` |
| **Kolejka** | Otwarte pozycje uporządkowane priorytetem | `prd.md:71` | `priority.ts:156`, `services/queue.ts` |
| **Rozstrzygnięcie** | Zamknięcie pozycji: załatana albo odrzucona z powodem | `prd.md:69` | `services/decisions.ts:25`, funkcja `record_decision` w bazie |
| **Historia rozstrzygnięć** | Niezmienialny ślad wszystkich decyzji o pozycji | `prd.md:69` | tabela `decisions` — bez polityk UPDATE i DELETE |
| **Znalezisko** | Wpis z zewnętrznego źródła, jeszcze nieosadzony na zasobie | `roadmap.md` §Parked | `domain/import/finding.ts` |
| **Źródło** | Obcy format, z którego wczytujemy znaleziska | `prd.md` §Non-Goals (wykluczone z MVP) | `domain/import/adapters.ts` |
| **Właściciel** | Konto, do którego należą dane | `prd.md:73` | polityki dostępu w bazie |
| **Segment / DMZ** | — | rozważone w `shape-notes.md`, odrzucone | **BRAK w kodzie** — świadomie |

## Krok 2 — Subdomeny

| Obszar | Kategoria | Uzasadnienie |
|---|---|---|
| Wyliczenie priorytetu z kontekstu zasobu | **Core** | To jest teza produktu: `prd.md:199` — ta sama podatność ma inny priorytet zależnie od tego, gdzie stoi. Bez tego produkt jest arkuszem posortowanym po CVSS |
| Trwałość i kompletność śladu decyzji | **Core** | `prd.md:69` — guardrail. To odpowiedź na jeden z trzech bólów z `shape-notes.md`: brak śladu, co świadomie odrzucono |
| Wyznaczanie terminu i wykrywanie przekroczeń | **Supporting** | Wzmacnia rdzeń, ale sam w sobie nie odróżnia produktu. Runda kontrolna w `shape-notes.md` wprost uznała termin bez egzekwowania za dekorację |
| Tłumaczenie obcych formatów źródeł | **Supporting** | Zdejmuje ból rozproszenia źródeł, ale nie jest przewagą — każdy mógłby napisać parser |
| Zarządzanie zasobami i podatnościami | **Supporting** | Konieczne, żeby rdzeń miał na czym działać |
| Uwierzytelnianie i izolacja kont | **Generic** | Rozwiązane w całości przez dostawcę i mechanizm bazy; produkt nic tu nie wnosi |
| Interfejs i nawigacja | **Generic** | Standardowe formularze i tabele |

## Krok 3 — Kandydaci na agregaty i ich niezmienniki

### A. Zasób wraz ze swoimi pozycjami

| Niezmiennik | Źródło | Status egzekwowania |
|---|---|---|
| Zasobu z nierozstrzygniętymi pozycjami nie da się usunąć | `prd.md:144` | **egzekwowany** — wyzwalacz `refuse_asset_delete_with_open_items`, migracja `20260820150000:123` |
| Zmiana ekspozycji przelicza priorytety wszystkich otwartych pozycji zasobu, a rozstrzygniętych nie | `prd.md` US-02 | **deklarowany, nie egzekwowany** — priorytet nie jest przechowywany, więc przeliczenie następuje przy odczycie. Działa poprawnie, ale niezmiennik nie ma strażnika: nic nie zabrania w przyszłości zapisać priorytetu w wierszu i rozjechać go ze stanem zasobu |
| Pozycja zawsze należy do tego samego właściciela co jej zasób | schemat | **egzekwowany** przez polityki dostępu i klucz obcy |

### B. Pozycja wraz z historią rozstrzygnięć

| Niezmiennik | Źródło | Status |
|---|---|---|
| Odrzucenie bez powodu jest niemożliwe | `prd.md:172` | **egzekwowany** — ograniczenie `decisions_rejection_needs_reason`, migracja `20260820150000:80` |
| Zapisane rozstrzygnięcie nie znika i nie da się go zmienić | `prd.md:69` | **egzekwowany** — brak polityk UPDATE i DELETE oraz wyzwalacz `refuse_vulnerability_delete_with_history`, migracja `20260821090000:39` |
| Stan pozycji zawsze zgadza się z ostatnim wpisem w historii | `prd.md:69` + US-04 | **egzekwowany od 2026-08-21** — funkcja `record_decision` wykonuje oba zapisy w jednej transakcji. Wcześniej: ignorowany, patrz `context/changes/refactor-opportunities/research.md` |

### C. Ocena priorytetu

| Niezmiennik | Źródło | Status |
|---|---|---|
| Ta sama podatność na zasobie wystawionym nigdy nie niżej niż na odciętym | `prd.md:71` | **egzekwowany konstrukcyjnie** — wagi ściśle malejące, `priority.ts:14-15`; test wyczerpujący na pełnej siatce kombinacji |

## Krok 4 — Rozjazdy MODEL vs KOD

| Dokument mówi | Kod robi | Dowód |
|---|---|---|
| „Zasób ma pozycje, a jego zmiana wpływa na nie wszystkie" (US-02) | Zasób i pozycje są niezależnymi zbiorami wierszy; nie ma bytu, który by je wiązał i pilnował ich wspólnych zasad | `services/assets.ts:45` zmienia zasób, nic nie wie o pozycjach |
| Niezmiennik usuwania zasobu (`prd.md:144`) | Egzekwuje go **baza**, a warstwa aplikacji tylko przekazuje komunikat błędu dalej | `services/assets.ts:60` — brak jakiejkolwiek reguły, jest `delete` i propagacja błędu |
| Pozycja to podatność **osadzona na zasobie** — dopiero razem mają priorytet (`prd.md:199-205`) | W kodzie „pozycja" nie istnieje jako byt; jest wierszem podatności, do którego przy odczycie doklejany jest zasób | `services/queue.ts` — `QueueEntry` powstaje dopiero w warstwie danych, nie w domenie |
| Znalezisko z zewnętrznego źródła to **coś innego niż podatność** — nie ma jeszcze zasobu | Rozróżnienie istnieje i jest czyste | `domain/import/finding.ts` — `ImportedFinding` jest osobnym typem |

**Najważniejszy rozjazd:** dokumenty konsekwentnie mówią o zasobie jako o **całości ze swoimi pozycjami**, a kod trzyma trzy niezależne tabele i trzy niezależne moduły. Wszystkie trzy niezmienniki tej całości są dziś egzekwowane w bazie — co działa, ale oznacza, że **wiedza domenowa mieszka poza kodem domenowym**, tam gdzie nie sięga ani analiza statyczna, ani testy jednostkowe.

## Krok 5 — Ranking

**#1 — Zasób wraz ze swoimi pozycjami.**

Wartość: to jedyny kandydat, którego niezmienniki są dziś rozproszone między trzy
miejsca — wyzwalacz w bazie, warstwę danych i regułę liczoną przy odczycie. Ryzyko:
niezmiennik „zmiana ekspozycji przelicza wszystkie otwarte pozycje" nie ma dziś żadnego
strażnika w kodzie; działa wyłącznie dlatego, że priorytet nie jest przechowywany.
Pierwsza optymalizacja, która zapisze priorytet w wierszu — a jest to naturalny pomysł
przy rosnącej kolejce — cicho go złamie.

**#2 — Pozycja z historią.** Niezmienniki są mocne i egzekwowane, w tym od niedawna ten
najtrudniejszy. Wartość refaktoru byłaby porządkująca, nie ochronna.

**#3 — Ocena priorytetu.** Już jest bytem domenowym: czysta funkcja, zero zależności,
niezmiennik gwarantowany konstrukcyjnie. Nie ma tu czego naprawiać.

## Podsumowanie

Artefakt zbiera czternaście pojęć domenowych z dokumentów i kodu, przypisuje im
subdomeny i wskazuje trzech kandydatów na agregaty wraz z ich niezmiennikami. Rdzeń
produktu to dwa obszary: wyliczenie priorytetu z kontekstu zasobu oraz trwałość śladu
decyzji — reszta jest wspierająca albo generyczna. Najciekawszy wynik dotyczy tego,
gdzie mieszka wiedza domenowa: wszystkie twarde niezmienniki są egzekwowane w bazie, a
nie w kodzie domenowym, więc analiza statyczna i testy jednostkowe ich nie widzą.
Największy rozjazd model-kod polega na tym, że dokumenty mówią o zasobie jako całości ze
swoimi pozycjami, a kod trzyma trzy niezależne tabele i moduły. Kandydatem numer jeden
jest właśnie ta całość, bo jeden z jej niezmienników — przeliczanie po zmianie
ekspozycji — nie ma dziś strażnika i działa wyłącznie dzięki temu, że priorytetu nie
przechowujemy. Najbardziej prawdopodobna przyszła optymalizacja złamałaby go po cichu.
