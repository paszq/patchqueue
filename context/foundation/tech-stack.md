# Stack technologiczny — PatchQueue

Data decyzji: 2026-08-20
Powiązanie: `prd.md` (PatchQueue, greenfield, aplikacja webowa, rdzeń 1 tydzień)

## Decyzja

| Warstwa | Wybór | Dlaczego akurat to |
|---|---|---|
| Framework | Astro 6 z wyspami React 19 | Kolejka i formularze to kilka ekranów, z których większość jest statyczna. Astro renderuje je bez narzutu, a interaktywność wchodzi tylko tam, gdzie jest potrzebna. |
| Język | TypeScript | Reguła priorytetu operuje na zamkniętych zbiorach wartości — trzy poziomy ekspozycji, trzy krytyczności, cztery klasy priorytetu. Typy wyłapują nieobsłużony wariant w czasie kompilacji, zanim zrobi to użytkownik. |
| Style | Tailwind CSS 4 | Brak osobnej warstwy plików stylów do utrzymania przy jednoosobowym projekcie na termin. |
| Baza i logowanie | Supabase | Logowanie e-mailem i hasłem dostajemy gotowe, bez pisania go od zera — a wymóg izolacji danych między kontami realizuje mechanizm reguł dostępu na poziomie wierszy, wymuszany przez bazę, nie przez kod aplikacji. |
| Wdrożenie | Cloudflare Pages | Publiczny adres bez konfiguracji serwera, wdrożenie z gałęzi głównej. |
| Testy jednostkowe | Vitest | Reguła priorytetu jako czysta funkcja — najszybsza pętla zwrotna przy tabeli przypadków. |
| Testy E2E | Playwright | Wymóg obowiązkowy certyfikacji dotyczy testu z perspektywy użytkownika; Playwright jest też narzędziem z modułu 3. |
| Pipeline | GitHub Actions | Darmowy bez limitu na repozytorium publicznym, natywny dla agenta review z modułu 5. |

## Tryb wyboru

Wybór podjęty wprost, bez pełnego przebiegu `10x-tech-stack-selector`. Uzasadnienie:
stack kursowy jest najlepiej udokumentowany dla agenta, a przy terminie 14 września
skrócenie fazy wyboru kupuje czas na dwa dodatkowe bloki. Decyzja świadoma, nie
przejęta bezrefleksyjnie — poniżej jej koszty.

## Ryzyka przyjęte świadomie

- **Zależność od jednego dostawcy przy logowaniu i bazie.** Awaria albo zmiana
  warunków po stronie dostawcy dotyka obu naraz. Akceptowane: projekt ma jednego
  użytkownika i dane demonstracyjne.
- **Reguły dostępu na poziomie wierszy łatwo skonfigurować pozornie.** Polityka, która
  wygląda na aktywną, a nie jest, daje fałszywe poczucie izolacji. Wymaga własnego
  testu sprawdzającego, że konto B nie sięga do danych konta A — nie samego przeglądu
  konfiguracji.
- **Astro miesza renderowanie po stronie serwera i wyspy klienckie.** Przy nieuważnym
  podziale reguła priorytetu mogłaby zostać policzona w dwóch miejscach. Kontrola:
  reguła żyje w jednym module domenowym, wołanym wyłącznie po stronie serwera.

## Bramki jakości

```bash
npm run lint
npm run typecheck
npm run test          # Vitest
npm run test:e2e      # Playwright
```

## Poza stackiem — do rozstrzygnięcia przy FR-017

Dostawca modelu językowego dla streszczeń nie jest jeszcze wybrany. Wymaganie jest
oznaczone jako nice-to-have, więc decyzja zapada dopiero po domknięciu rdzenia.
Kryterium: dostęp przez pojedynczy klucz, rozliczenie za użycie, brak zobowiązania
abonamentowego.
