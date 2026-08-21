---
change_id: atomic-decisions
title: Rozstrzygnięcie jako jedna operacja atomowa w bazie
status: in-progress
created: 2026-08-21
updated: 2026-08-21
archived_at: null
---

## Notes

Kandydat 1 z `context/changes/refactor-opportunities/research.md`.

Dwa niezależne zapisy — wpis do historii i zmiana stanu pozycji — bez mechanizmu
spójności. Gdy drugi zawiedzie, historia wyprzedza stan, a wpisu nie da się poprawić,
bo tabela historii nie przyjmuje zmian ani usunięć.

## Uwaga o testowalności

Usterki nie da się wywołać przez publiczne API aplikacji: zapisy zawsze idą w tej samej
kolejności, a pierwszy z nich chroni drugi przed większością błędów. To nie znaczy, że
zagrożenie jest teoretyczne — znaczy, że jego wywołanie wymaga awarii sieci albo
odrzucenia po stronie bazy między dwoma wywołaniami.

Test odtwarza więc tę samą sekwencję dwóch zapisów, z drugim celowo naruszającym
ograniczenie schematu, i pokazuje, że powstała rozbieżność jest trwała. Test bliźniaczy
robi to samo przez nową funkcję bazy i oczekuje wycofania obu zapisów.
