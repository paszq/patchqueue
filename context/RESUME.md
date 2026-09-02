# Punkt wznowienia — PatchQueue

Ostatnia aktualizacja: 2026-09-02 (wieczór)

## Gdzie to wszystko jest

|                      |                                                         |
| -------------------- | ------------------------------------------------------- |
| Kod lokalnie         | `~/projects/cve-triage`                                 |
| Repozytorium         | https://github.com/paszq/patchqueue                     |
| Aplikacja            | https://patchqueue.paszekkrystian-19.workers.dev        |
| Baza i logowanie     | Supabase, projekt `patchqueue` (`uokarnfdgmszlwshvoph`) |
| Konto demonstracyjne | `demo@example.com` / `Demo12345!`                       |

## Stan na dziś

Wszystkie trzy bloki certyfikacji domknięte wraz z dowodami wymaganymi przez formularze.
52 commity, 83 testy jednostkowe i integracyjne, 16 przeglądowych, pipeline zielony,
agent przeglądający PR-y uruchomiony i sprawdzony na prawdziwym PR, produkcja aktualna.

| Blok         | Co go broni                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 🚀 Builder   | logowanie z izolacją wymuszaną przez bazę, CRUD trzech pojęć, reguła priorytetu, cztery dokumenty kontekstowe, testy, publiczny adres        |
| 🔧 Architekt | mapa repozytorium, ranking refaktoru zweryfikowany `ast-grep`, dwa wykonane refaktory, plan ACL, destylacja domeny, agregat z niezmiennikami |
| 🏆 Champion  | bramki jakości, testy w CI, ciągłe wdrażanie z weryfikacją żywej instancji, strażnik przed cichym pomijaniem testów                          |

## Co zostało do zrobienia

**Zostało wyłącznie wysłanie dwóch formularzy.** Termin: **14 września 2026**.
Obie wysyłki muszą pójść w tym samym terminie — dosłać później się nie da.

| Formularz            | Adres                                                               | Co załączyć                                                         |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Builder              | https://baserow.io/form/g6rJ-njiGpV5lPxvot6iRxsXTh8Wb-AnRjy7s2Zck1c | link do repozytorium, zrzuty z `docs/screenshots/`                  |
| Architect + Champion | https://baserow.io/form/fwnBioduXc90QTli6lsCVL_YgRdTECPTCmwiVhu8d-E | `RAPORT-ARCHITEKTONICZNY.md`, zrzuty z `docs/screenshots/champion/` |

Treść merytoryczna zgłoszenia leży w `SUBMISSION.md`, po sekcji na blok.

### Znane, świadomie niedomknięte

Trzeci przebieg agenta przeglądającego uruchamia się, kosztuje 1,35 USD i kończy
wszystkimi krokami na zielono, **nie publikując raportu ani komentarza**. Sprawdzone
ponowieniem: powtarzalne. Skutek: krok „Check review verdict" odczytuje poprzedni plik
przeglądu, znajduje `APPROVED` i wystawia zielony status dla kodu, którego nikt nie
przejrzał. Diagnostyka wymaga włączenia `show_full_output` i kosztuje po 1,35 USD za
próbę, więc zatrzymana — opisane w `SUBMISSION.md` jako siódmy przypadek wzorca.

## Poprawki interfejsu z 2 września 2026

Trzy zmiany zgłoszone z użycia, każda pokryta testem przeglądowym, wdrożone
i sprawdzone na produkcji:

| Zmiana                                     | Commit    | Dlaczego to nie kosmetyka                                                                                                                                                                                          |
| ------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dowód załatania w historii rozstrzygnięć   | `7432130` | Domyka **FR-015** (must-have): zamknięta pozycja miała pokazywać rozstrzygnięcie _wraz z uzasadnieniem_, a przy załataniu nie było pola, w które dałoby się je wpisać. Wymaganie było spełnione tylko dla odrzuceń |
| Wczytywanie z załączonego pliku            | `80fc5ea` | Plik i pole tekstowe idą tą samą ścieżką — załącznik to inny sposób dostarczenia tekstu, nie drugi tor do utrzymania                                                                                               |
| Liczba otwartych pozycji na liście zasobów | `a9ea6de` | Lista pokazywała, co wpływa na priorytet, ale nie ile pracy na zasobie czeka                                                                                                                                       |

Dowód załatania został **nieobowiązkowy**. „Odrzucenie bez powodu jest niemożliwe" to
zapisana reguła domenowa; przymus przy załataniu byłby regułą nową, której w PRD nie
ma — do rozstrzygnięcia produktowego, nie do dopisania przy okazji.

## Materiał na dokumentację zgłoszenia

Najmocniejszy wątek, wart opisania osobno: **pięć razy w tym projekcie zielony wynik
znaczył „nie sprawdziłem", nie „jest dobrze"**.

1. Testy izolacji kont pomijane w pipelinie — krok nie dostawał sekretów (commit `e989829`)
2. Testy przeglądowe pomijane lokalnie — konfiguracja Playwrighta nie czytała `.env`
3. `dependency-cruiser` nie parsował `.astro` — „zero naruszeń" przy połowie systemu poza grafem
4. `ast-grep` zwracał zero przy funkcjach mapujących — wzorzec nie obsługuje częściowych nazw
5. Asercja „ma być błąd" spełniana przez brak funkcji w bazie, nie przez regułę domenową

Za każdym razem wykrycie polegało na zapytaniu _co dokładnie zostało sprawdzone_,
zamiast _czy jest zielono_.

Drugi wątek: **guardrail zabezpieczający jeden kierunek otworzył drugi**. Historia
rozstrzygnięć była chroniona przed usunięciem, ale nie przed zapisem, który nie powinien
powstać — dwa niezależne zapisy bez transakcji mogły ją trwale rozjechać ze stanem
pozycji. Wykryte przy rankingu refaktoru, naprawione funkcją w bazie.

## Rzeczy, których nie ma w repozytorium

`.env` i `.dev.vars` są w `.gitignore` i **istnieją tylko lokalnie**. Gdyby zniknęły,
odtworzyć je tak:

```
SUPABASE_URL=https://uokarnfdgmszlwshvoph.supabase.co
SUPABASE_KEY=sb_publishable_r0_cVYJdrlDhJH_TxNrX2g_11a-P433
```

Token GitHuba siedzi w pęku kluczy macOS — `git push` działa bez pytania.
Token Cloudflare **nie jest zapisany lokalnie**; jest w sekretach repozytorium, więc
wdrożenia z pipeline'u działają. Ręczne `wrangler deploy` wymagałoby podania go ponownie.

## Jak wrócić do pracy

```bash
cd ~/projects/cve-triage
npm run dev          # aplikacja na http://localhost:4321
```

Bramki jakości, gdyby coś było niejasne:

```bash
npm run lint && npm run typecheck && npm test && npm run build
npx playwright test                                    # lokalnie
BASE_URL=https://patchqueue.paszekkrystian-19.workers.dev npx playwright test   # przeciw produkcji
```

## Mapa dokumentów projektu

| Plik                                         | Po co                                                             |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `context/foundation/prd.md`                  | wymagania, historyjki, guardraile                                 |
| `context/foundation/roadmap.md`              | przekroje i ich stan                                              |
| `context/foundation/tech-stack.md`           | wybór stacku i przyjęte ryzyka                                    |
| `context/foundation/shape-notes.md`          | dlaczego produkt wygląda tak, a nie inaczej                       |
| `context/foundation/test-plan.md`            | mapa ryzyka, przekroje wdrożenia testów, kucharka                 |
| `context/foundation/fr-audit.md`             | audyt FR-001…FR-017 względem kodu i testów                        |
| `context/map/repo-map.md`                    | mapa repozytorium z jawnym zasięgiem pomiaru                      |
| `context/domain/01-domain-distillation.md`   | pojęcia, subdomeny, niezmienniki                                  |
| `context/domain/03-anti-corruption-layer.md` | plan odcięcia od dostawcy (niewykonany, świadomie)                |
| `SUBMISSION.md`                              | treść zgłoszenia — sekcja na blok, odnośniki do plików i commitów |
| `RAPORT-ARCHITEKTONICZNY.md`                 | raport bloku Architect, składa cztery artefakty modułu 4          |
| `context/changes/import-flow/research.md`    | research wybranej funkcji (artefakt L3)                           |
| `context/changes/*/`                         | po jednym folderze na zmianę, z uzasadnieniami                    |
| `CLAUDE.md`                                  | komendy, konwencje, reguły domenowe dla agenta                    |
