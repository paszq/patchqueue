# Artefakt 1 — Terytorium (historia gita)

Data: 2026-08-21

## ⚠ Ograniczenie metody, nie wynik analizy

Metoda zakłada repozytorium z roczną historią, w którym częstotliwość zmian mówi,
gdzie realnie toczy się praca i co jest ryzykowne. To repozytorium ma:

| | |
|---|---|
| commitów | 19 |
| historia | 2026-08-20 → 2026-08-21 (2 dni) |
| autorzy | 1 |

Przy takim oknie „najczęściej zmieniany plik" znaczy „plik, który poprawiałem
przedwczoraj", a nie „obszar obciążony długiem". **Rozkład aktywności nie niesie tu
sygnału i nie należy z niego wyciągać wniosków architektonicznych.** Podział na
kwartały i analiza autorów nie mają zastosowania.

Zamiast udawać taką analizę, ciężar mapy przenoszę na artefakt 2 — graf zależności,
który jest mierzalny niezależnie od wieku repozytorium.

## Co jednak widać

Ranking zmian czyta się jako ślad procesu wytwarzania, nie jako mapę ryzyka:

| Plik | Zmian | Co to mówi |
|---|---|---|
| `e2e/main-flow.spec.ts` | 5 | Rósł wraz z każdym naprawionym błędem zgłoszonym z użycia |
| `tests/integration/isolation.test.ts` | 4 | To samo — każdy guardrail dostał tu swój dowód |
| `playwright.config.ts` | 4 | Trzy różne przyczyny cichego pomijania testów |
| `.github/workflows/ci.yml` | 4 | Pipeline dorastał: bramki → sekrety → wdrożenie |
| `context/foundation/prd.md` | 4 | Dokument żył razem z decyzjami, nie zastygł po napisaniu |

Obserwacja warta odnotowania: **cztery z pięciu najczęściej zmienianych plików to
testy i konfiguracja weryfikacji**, nie kod produktu. W repozytorium legacy byłby to
sygnał ostrzegawczy — kruche testy. Tutaj oznacza coś przeciwnego: każdy błąd
zgłoszony z realnego użycia kończył się dopisaniem testu, który go łapie.

## Współzmiany

Przy 19 commitach analiza par katalogów daje szum. Jedyna powtarzalna zależność, jaka
się wyłania i ma sens niezależnie od próbki:

- `src/lib/services/` zmienia się razem z `src/pages/api/` i `src/pages/*.astro` —
  bo warstwa danych jest wspólnym punktem wejścia dla obu. Potwierdza to graf
  zależności w artefakcie 2 (9 modułów zależnych), więc nie jest to artefakt małej próbki.

## Wspólny mianownik

Nie ma pliku typu „config dotykany przez wszystkich". Najbliżej jest
`src/lib/services/patchqueue.ts` — ale to sprzężenie strukturalne, nie przypadkowe.
Wszystkie wskazane pliki istnieją w repozytorium na dzień sporządzenia mapy.
