---
bootstrapped_at: 2026-08-20T14:26:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: PatchQueue
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

# Dziennik weryfikacji szkieletu — PatchQueue

## Hand-off

Ze `context/foundation/tech-stack.md`, decyzja z 2026-08-20:

Astro 6 z wyspami React 19, TypeScript, Tailwind CSS 4, Supabase na logowanie i bazę,
Cloudflare Pages na wdrożenie, Vitest na testy jednostkowe, Playwright na testy
przeglądowe, GitHub Actions na pipeline.

Wybór podjęty wprost, bez pełnego przebiegu `10x-tech-stack-selector`: stack kursowy
jest najlepiej udokumentowany dla agenta, a przy terminie 14 września skrócenie fazy
wyboru kupuje czas na dwa dodatkowe bloki. Karta `10x-astro-starter` pokrywa całą tę
listę jednym repozytorium, więc została użyta zamiast składania szkieletu z części.

## Pre-scaffold verification

| Sygnał | Wartość | Waga | Uwagi |
| --- | --- | --- | --- |
| pakiet npm | nie dotyczy | — | `cmd_template` używa `git clone`, nie `create-*` |
| repozytorium | `przeprogramowani/10x-astro-starter` osiągalne, gałąź `master` | fresh | sprawdzone przez `git ls-remote` |
| data ostatniej zmiany | ostatni commit 2026-05-17 | aged | trzy miesiące; poniżej progu „stale" |
| API GitHuba | nie uruchomione | — | `gh` niedostępny w środowisku; zastąpione odczytem daty commita po sklonowaniu |

## Scaffold log

**Rozwiązane wywołanie**: `git clone --depth 1 https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold`

Kod wyjścia 0. Historia startera odrzucona przez usunięcie `.bootstrap-scaffold/.git`
przed przeniesieniem, zgodnie ze strategią `git-clone`.

Przeniesienie do katalogu głównego — 18 pozycji, jedna kolizja:

| Pozycja | Rozstrzygnięcie |
| --- | --- |
| `.gitignore` | doklejony do istniejącego, z nagłówkiem oddzielającym |
| `.env.example`, `.github`, `.husky`, `.nvmrc`, `.prettierrc.json`, `.vscode` | przeniesione |
| `astro.config.mjs`, `components.json`, `eslint.config.js`, `tsconfig.json`, `wrangler.jsonc` | przeniesione |
| `package.json`, `package-lock.json`, `public`, `src`, `supabase`, `README.md`, `CLAUDE.md` | przeniesione |
| `context/`, `.claude/`, `.git/` | nietknięte |

Starter niesie gotowe: rejestrację, logowanie, wylogowanie, potwierdzenie adresu,
klienta Supabase z sesją w ciasteczkach, middleware chroniące trasy oraz przykładową
stronę za logowaniem. To pokrywa większość fundamentu F-02 i przekroju S-01.

**Dołożone po scaffoldzie** (starter tego nie ma): Vitest, Playwright, skrypt
`typecheck`, `vitest.config.ts`, `playwright.config.ts`, katalog `e2e/`.

## Post-scaffold audit

Stan po instalacji: 23 podatności (1 krytyczna, 13 wysokich, 7 średnich, 2 niskie).
Po `npm audit fix` bez łamania wersji głównych: **4** (2 wysokie, 1 średnia, 1 niska).
Krytyczna (`tar`, przemyt plików przez nagłówki PAX) — usunięta.

### Próba domknięcia pozostałych — nieudana, wycofana

Wszystkie cztery pozostałe znikają dopiero po skoku na Astro 7. Ścieżka wyglądała
czysto: `@astrojs/cloudflare` 14.2.3 deklaruje `astro: ^7.2.0`. Podniesienie wykonano
i audyt spadł do jednego ostrzeżenia niskiej wagi, ale **build przestał przechodzić**:

```
Could not find the prerender entry point in the build output.
This is likely a bug in Astro.
```

Zdiagnozowane: bez adaptera Cloudflare build przechodzi, z adapterem pęka —
niezgodność `@astrojs/cloudflare` 14.2.3 z Astro 7.2.4, niezależna od naszej
konfiguracji (sprawdzono warianty z `output: "server"`, bez `output` oraz bez
integracji `sitemap`). Zmiana wycofana, bezpieczne poprawki z `npm audit fix`
zachowane.

### Pozostałe znaleziska — świadomie przyjęte

| Pakiet | Waga | Charakter | Dlaczego przyjęte |
| --- | --- | --- | --- |
| `astro` 6.4.8 | wysoka | bezpośrednia | XSS przez nieoescapowane nazwy atrybutów w rozproszeniu propsów oraz przez animacje przejść widoku. Linia 6.x nie ma łatki — 6.4.8 jest jej ostatnią wersją. Aplikacja nie rozprasza atrybutów pochodzących od użytkownika ani nie używa przejść widoku. Do ponownego rozpatrzenia, gdy adapter Cloudflare dogoni Astro 7. |
| `@astrojs/cloudflare` | średnia | bezpośrednia | Dziedziczy wyłącznie po `astro` powyżej. |
| `sharp` | wysoka | przechodnia | Podatności `libvips` w przetwarzaniu obrazów. Aplikacja nie przetwarza obrazów wprowadzanych przez użytkownika; pakiet wchodzi przez narzędzia budowania. |
| `esbuild` | niska | przechodnia | Odczyt plików przy serwerze deweloperskim, wyłącznie na Windowsie. Środowisko to macOS, a serwer deweloperski nie jest wystawiony. |

Ta tabela jest jednocześnie pierwszym ćwiczeniem z domeny, którą buduje ten projekt:
waga sama w sobie nie przesądza o działaniu — przesądza ekspozycja i kontekst.

## Hints recorded but not acted on

- `deployment_defaults: [cloudflare]` — konfiguracja Cloudflare obecna w
  `wrangler.jsonc`, ale wdrożenie nie zostało uruchomione. Wymaga konta.
- `gotchas: "Supabase RLS must be configured early or auth gaps creep in"` — odnotowane;
  realizowane jako fundament F-02 wraz z własnym testem izolacji danych.
- `gotchas: "edge runtime constrains long-running tasks"` — bez znaczenia dla obecnego
  zakresu; dotyczyłoby dopiero wsparcia generatywnego z FR-017.
- `runtime_version: node 22` — środowisko ma node 24.16.0. Build, lint, testy i
  kontrola typów przechodzą; różnica odnotowana, nie wymuszona.

## Stan bramek jakości

```
lint       OK
typecheck  OK
test       OK   (Vitest, bez testów — zdejmowane przy S-03)
build      OK
```

## Next steps

1. F-02 `account-isolation` — konfiguracja projektu Supabase, polityki dostępu na
   poziomie wierszy i test dowodzący, że drugie konto nie sięga do danych pierwszego.
   Blokada: konto u dostawcy.
2. F-03 `verification-pipeline` — rozszerzenie `.github/workflows/ci.yml` o kontrolę
   typów, testy jednostkowe i przeglądowe. Blokada: repozytorium zdalne.
3. S-01 `first-sign-in` — pusta kolejka z wyjaśnieniem; logowanie w większości gotowe
   ze startera.
