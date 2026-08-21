---
title: Warstwa chroniąca przed przeciekiem dostawcy danych
created: 2026-08-21
type: refactor-plan
---

# Przeciekająca zależność — diagnoza i plan

> Dokument jest **planem**, nie implementacją. Nie zmienia kodu produkcyjnego.

## Krok 0 — Kontekst

Stack według `context/foundation/tech-stack.md`: Astro 6, React 19, TypeScript,
Tailwind 4, Supabase (logowanie + baza), Cloudflare. Warstwy kodu: reguła domenowa
(`src/lib/domain`), warstwa danych (`src/lib/services`), punkty końcowe
(`src/pages/api`), strony i komponenty.

**Deklaracja z dokumentu bazowego.** `tech-stack.md:28-30` zapisuje jako świadomie
przyjęte ryzyko: *„Zależność od jednego dostawcy przy logowaniu i bazie. Awaria albo
zmiana warunków po stronie dostawcy dotyka obu naraz."* Dokument nie deklaruje
wymienialności — przyjmuje sprzężenie. To istotne dla oceny: **nie ma tu rozjazdu
intencja-vs-kod**, jest świadomie zaciągnięty dług, którego koszt warto teraz wycenić.

## Krok 1 — Identyfikacja przecieków

Pakiet `@supabase/supabase-js` zna dziś **7 plików produkcyjnych** (poza testami i
skryptem seed):

| Plik | Co dokładnie zna | Charakter |
|---|---|---|
| `src/lib/supabase.ts:1-3` | `createServerClient`, `parseCookieHeader` | uzasadniony — to jest adapter |
| `src/env.d.ts:3` | typ `User` dostawcy | **przeciek do kontraktu globalnego frameworka** |
| `src/lib/api.ts:8` | typ `SupabaseClient` w kontrakcie `Session` | przeciek do warstwy pomocniczej |
| `src/lib/services/assets.ts` | `SupabaseClient` w sygnaturach 5 funkcji | przeciek do warstwy danych |
| `src/lib/services/vulnerabilities.ts` | `SupabaseClient` w sygnaturach 4 funkcji | jw. |
| `src/lib/services/decisions.ts` | `SupabaseClient` w sygnaturach 2 funkcji | jw. |
| `src/lib/services/queue.ts` | `SupabaseClient` w sygnaturach 3 funkcji | jw. |

Łącznie **19 wystąpień typu `SupabaseClient`** w `src/`.

Czego przecieku **nie ma** — warto odnotować, bo to zawęża problem:

- Strony i komponenty **nie znają pakietu dostawcy**. Sprawdzone: grep po `@supabase`
  w `src/pages/` i `src/components/` nie zwraca nic.
- Reguła domenowa nie zna żadnej zależności zewnętrznej. Pilnują tego dwie reguły w
  `.dependency-cruiser.cjs` (`domain-stays-pure`, `domain-no-external-io`).
- Żaden punkt końcowy nie sięga do bazy z pominięciem warstwy danych.

## Krok 2 — Klasyfikacja i wybór #1

| Oś przecieku | Dotknięte pliki | Koszt wymiany dziś | Werdykt |
|---|---|---|---|
| **Typ `User` w `App.Locals`** | 1 deklaracja + 5 miejsc czytających | wysoki nieproporcjonalnie do rozmiaru | **#1** |
| `SupabaseClient` w sygnaturach warstwy danych | 4 pliki, 19 wystąpień | średni, mechaniczny | #2 |
| `createServerClient` w adapterze | 1 plik | zerowy — to jego rola | nie jest przeciekiem |

**Wybór #1: typ `User` dostawcy w globalnym kontrakcie frameworka.**

Uzasadnienie: to jedyny przeciek, który wchodzi do **kontraktu narzucanego przez
framework wszystkim plikom naraz**. `App.Locals` jest globalną przestrzenią nazw Astro —
każda strona i każdy punkt końcowy widzi `Astro.locals.user` z typem dostawcy, nawet
jeśli nigdy nie zaimportuje jego pakietu. Przeciek jest niewidoczny w imporcie i przez
to trudniejszy do wykrycia niż pozostałe. Drugi w kolejności przeciek dotyczy większej
liczby plików, ale jest jawny i mechaniczny do wymiany.

## Krok 3 — Diagnoza

`src/env.d.ts:1-5` — cała treść pliku:

```ts
declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}
```

Miejsca czytające, każde związane tym typem: `src/middleware.ts`, `src/lib/api.ts`,
`src/components/Topbar.astro`, `src/components/app/AppShell.astro`,
`src/pages/dashboard.astro` — **evidence**, grep po `locals.user`.

Co z tego wynika w praktyce: `AppShell.astro` wyświetla wyłącznie `user.email`, a
`api.ts` używa wyłącznie `user.id`. Aplikacja potrzebuje **dwóch pól**, a przyjmuje
kontrakt typu, który dostawca definiuje jako obiekt kilkunastopolowy razem z metadanymi
i tożsamościami zewnętrznymi. Zmiana kształtu tego typu po stronie dostawcy przechodzi
wprost do kompilacji naszych widoków.

**Groźny wariant, który tu nie zachodzi.** Warto odnotować, bo bywa najkosztowniejszy:
biblioteka serwerowa wciągnięta do paczki klienta. Nie zachodzi — komponenty React
formularzy nie importują pakietu dostawcy; wysyłają zwykłe formularze do punktów
końcowych.

## Krok 4 — Projekt

**Byt domenowy.** Value object `AuthenticatedUser` w `src/lib/domain/identity.ts` —
jedyne miejsce wiedzy o tym, kim jest zalogowany użytkownik z punktu widzenia produktu:

```ts
export interface AuthenticatedUser {
  readonly id: string;      // klucz właścicielski wierszy
  readonly email: string;   // jedyne, co pokazujemy w interfejsie
}

export function isSameUser(a: AuthenticatedUser, b: AuthenticatedUser): boolean;
```

**Port.** Wąski interfejs domenowy, który zna reszta kodu:

```ts
export interface SessionReader {
  currentUser(): Promise<AuthenticatedUser | null>;
}
```

**Adapter.** `src/lib/adapters/supabase-session.ts` — jedyne miejsce znające typ `User`
dostawcy i wykonujące konwersję:

```ts
function toAuthenticatedUser(raw: User): AuthenticatedUser {
  return { id: raw.id, email: raw.email ?? "" };
}
```

`src/env.d.ts` przestaje odwoływać się do pakietu dostawcy:

```ts
declare namespace App {
  interface Locals {
    user: import("@/lib/domain/identity").AuthenticatedUser | null;
  }
}
```

Analogicznie dla przecieku #2: port `DataStore` w warstwie danych i adapter trzymający
`SupabaseClient`, dzięki czemu sygnatury 14 funkcji przestają wymieniać typ dostawcy.

## Krok 5 — Dowód izolacji

Po zmianie wymiana dostawcy dotyka wyłącznie:

- `src/lib/supabase.ts` — tworzenie klienta
- `src/lib/adapters/supabase-session.ts` — konwersja użytkownika
- `src/lib/adapters/supabase-store.ts` — konwersja zapytań (przeciek #2)

**Nie dotyka:** żadnej migracji, żadnego punktu końcowego, żadnej strony, żadnego
komponentu, reguły domenowej ani testów przeglądowych. Widok dostaje gotowy byt
domenowy o dwóch polach zamiast obiektu biblioteki.

Before/after dla `env.d.ts`: dziś kontrakt globalny frameworka wskazuje na pakiet
zewnętrzny; po zmianie wskazuje na własny moduł domenowy.

## Krok 6 — Weryfikacja i plan

**Kryterium sukcesu, sprawdzalne jedną komendą:**

```bash
grep -rl "@supabase" src/ | grep -v "src/lib/adapters/\|src/lib/supabase.ts"
# ma nie zwrócić nic
```

Dziś zwraca 6 plików: `env.d.ts`, `api.ts` i cztery moduły warstwy danych.

**Fazy, zgodnie z konwencją projektu — jedna zmiana, jeden folder w `context/changes/`:**

1. `identity-value-object` — value object i adapter sesji; `env.d.ts` odcięty od dostawcy.
2. `data-store-port` — port i adapter warstwy danych; 19 wystąpień typu znika z sygnatur.
3. Reguła w `.dependency-cruiser.cjs`: import pakietu dostawcy dozwolony wyłącznie w
   `src/lib/adapters/` i `src/lib/supabase.ts` — tak, żeby przeciek nie wrócił po cichu.

**Kolejność wobec innych prac.** Ten refaktor nie jest pilny: koszt długu to dziś
kilkanaście linii przy hipotetycznej wymianie dostawcy, której projekt nie planuje.
Wyżej w kolejce stoi wczytywanie z zewnętrznych źródeł, bo to jest rozbudowa, której
brak blokuje domknięcie jednego z trzech bólów z PRD. Punkt 3 planu — regułę w
narzędziu — warto jednak dołożyć od razu, bo kosztuje nic, a zatrzymuje pogorszenie.

## Podsumowanie

Pakiet dostawcy zna dziś siedem plików produkcyjnych, ale przecieki rozkładają się
bardzo nierówno. Najgroźniejszy nie jest ten najliczniejszy: typ `User` wpisany w
`App.Locals` wchodzi do kontraktu narzucanego przez framework wszystkim plikom naraz i
jest niewidoczny w imporcie, przez co trudniej go zauważyć niż dziewiętnastu wystąpień
`SupabaseClient` w sygnaturach warstwy danych. Aplikacja potrzebuje z tego typu dwóch
pól, a przyjmuje kilkanaście. Warstwy widoku i reguła domenowa są czyste — pierwsza
nie zna pakietu wcale, drugą pilnują reguły w analizie statycznej. Plan wprowadza value
object `AuthenticatedUser`, wąski port sesji i adapter, po czym to samo dla warstwy
danych; kryterium sukcesu jest sprawdzalne jednym grepem. Refaktor jest jednak mniej
pilny niż rozbudowa o wczytywanie z zewnętrznych źródeł, więc zostaje zaplanowany, a
nie wykonany od razu — poza jedną tanią częścią, regułą w narzędziu, która zatrzymuje
dalsze rozlewanie się zależności.
