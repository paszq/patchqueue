---
change_id: import-flow
title: Badanie ścieżki wczytywania znalezisk z zewnętrznych źródeł
status: preparing
created: 2026-09-02
updated: 2026-09-02
archived_at: null
---

## Notes

Research wybranego ficzera (artefakt L3 bloku Architekt). Wybrana funkcja: wczytywanie
znalezisk z zewnętrznych źródeł — jedyna w tym produkcie, która przechodzi przez wszystkie
warstwy naraz: formularz, punkt końcowy, warstwę tłumaczącą obce formaty, warstwę danych
i bazę.

Pytanie badawcze nie brzmiało „jak to działa", tylko: **gdzie realnie mieszka każda
decyzja, co dzieje się przy błędzie i które reguły obowiązują tylko na jednej z dwóch
ścieżek wejścia**. Ostatnia część wzięła się z zaobserwowanego przypadku: zmiana
`duplicate-items` pokazała, że reguła o duplikatach obowiązywała wyłącznie przy
wczytywaniu, a nie przy ręcznym dopisaniu. Badanie sprawdza, czy to był wyjątek, czy wzorzec.
