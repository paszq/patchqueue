---
change_id: duplicate-items
title: Ta sama podatność nie może stać dwa razy na tym samym zasobie
status: impl_reviewed
created: 2026-09-02
updated: 2026-09-02
archived_at: null
---

## Notes

Znalezione przez patrzenie na własną aplikację, nie przez czytanie kodu. Zrzut ekranu
kolejki do zgłoszenia certyfikacyjnego pokazał pięć identycznych pozycji `CVE-2026-252`
na jednym zasobie. Wyglądało to jak śmieci po ręcznym klikaniu — i było — ale pytanie
brzmiało, dlaczego aplikacja w ogóle na to pozwoliła.

## Diagnoza

Reguła „ta sama podatność nie może istnieć dwa razy na tym samym zasobie" **istnieje
w tym produkcie i jest egzekwowana — ale tylko w jednej z dwóch ścieżek wejścia**.

- Wczytywanie z zewnętrznego źródła odrzuca duplikaty: `importFindings` buduje zbiór
  `seen` z istniejących wierszy i raportuje pominięcie ze statusem `duplikat`.
- Ręczne dopisanie podatności nie sprawdza niczego: `createVulnerability` wykonuje czysty
  `insert`, a punkt końcowy waliduje wyłącznie kształt pól.
- W schemacie nie ma ani jednego ograniczenia unikalności — sprawdzone grepem po
  `supabase/migrations/`.

To jest ta sama klasa problemu, którą projekt zna z rankingu refaktoru: **reguła żyje
w jednym miejscu w kodzie, zamiast być własnością struktury.** Różnica jest taka, że
poprzednim razem chodziło o atomowość zapisu, a tutaj o zasięg obowiązywania reguły.

## Rozstrzygnięcie domenowe

Pytanie, które trzeba rozstrzygnąć, zanim powstanie migracja: czy podatność raz
**załatana** może wrócić na ten sam zasób jako nowy wpis?

**Nie.** Uzasadnienie: FR-016 daje na to osobny mechanizm — przywrócenie pozycji do
kolejki, które dopisuje wpis do historii. Gdyby wolno było dodać ten sam identyfikator
jako nową pozycję, historia tej samej podatności na tym samym zasobie rozpadłaby się na
dwa niezależne ślady, a FR-015 obiecuje coś przeciwnego: że wrócisz do zamkniętej pozycji
i zobaczysz rozstrzygnięcie wraz z uzasadnieniem. Dwie pozycje o tym samym identyfikatorze
to dwie połowy jednej historii, z których żadna nie jest kompletna.

Konsekwencja: unikalność obowiązuje **niezależnie od statusu**, a nie tylko wśród
otwartych pozycji. Zgadza się to również z tym, co już robi import — jego zbiór `seen`
powstaje ze wszystkich wierszy, bez filtrowania po statusie.

## Gdzie umieścić regułę

W bazie, jak każdy inny guardrail tego produktu. Powody:

1. Chroni także przed zapisem z pominięciem aplikacji — a taki zapis jest realny, co
   pokazało sprzątanie danych demonstracyjnych wykonane klientem Supabase.
2. Zamyka wyścig, którego zbiór `seen` w warstwie aplikacji nie zamyka: dwa równoległe
   wczytania tego samego raportu czytają stan przed zapisem drugiego.
3. Warstwa aplikacji nadal tłumaczy odmowę na czytelny komunikat — tak samo jak przy
   odmowie usunięcia zasobu z otwartymi pozycjami.

## Wielkość liter

`normalizeIdentifier` sprowadza identyfikator do wielkich liter przy wczytywaniu ze
źródła. Ręczny formularz nie robi nic. Bez tego `cve-2026-1111` i `CVE-2026-1111` byłyby
dla ograniczenia dwiema różnymi podatnościami, a dla człowieka jedną. Reguła musi więc
działać na znormalizowanej postaci po obu stronach.

## Istniejące dane

Migracja nie kasuje duplikatów. Jeśli w bazie są, tworzenie indeksu **zawiedzie i przebieg
stanie się czerwony** — co jest właściwym zachowaniem: usunięcie cudzych wierszy w migracji
jest decyzją, której nikt świadomie nie podjął, a cicha naprawa danych to dokładnie ta
klasa zachowania, przed którą ten projekt się broni.
