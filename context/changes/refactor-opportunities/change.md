---
change_id: refactor-opportunities
title: Ranking okazji do refaktoru zweryfikowany narzędziem
status: in-progress
created: 2026-08-21
updated: 2026-08-21
archived_at: null
---

## Notes

Blok Architekt, krok drugi. Wejście: `context/map/repo-map.md` i artefakty mapy.

Metoda z modułu 4 przewiduje trzech subagentów badających każdego kandydata osobno.
Nie mam zgody na ich uruchamianie, więc te same trzy perspektywy — obecny kształt,
intencjonalność, wykonalność migracji — przeprowadzone są sekwencyjnie w jednej sesji.
Odnotowane, bo zmienia to niezależność ocen: jedna głowa widzi te same rzeczy trzy razy,
zamiast trzech głów niezależnie.

Twarda zasada tego kroku: żadnych zmian w kodzie, dowody przed interpretacją.
