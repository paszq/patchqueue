---
change_id: priority-visible
title: Reguła priorytetu jako czysta funkcja z tabelą przypadków
status: in-progress
created: 2026-08-20
updated: 2026-08-20
archived_at: null
---

## Notes

Serce produktu: wyliczenie priorytetu i terminu z oceny CVSS, ekspozycji zasobu i jego
krytyczności. Realizowane najpierw jako moduł domenowy bez zależności od bazy, warstwy
HTTP i interfejsu — dzięki temu powstaje teraz, mimo że S-03 czeka na fundamenty.

Zakres tej zmiany to wyłącznie reguła i jej testy. Formularz dopisywania podatności oraz
prezentacja składników priorytetu wchodzą razem z resztą S-03, gdy F-02 będzie gotowe.

Otwarta niewiadoma z roadmapy do zamknięcia w tej zmianie: jakie wagi otrzymują poziomy
ekspozycji i krytyczności. Ograniczenie wiążące pochodzi z guardrails PRD — ta sama
podatność na zasobie osiągalnym z sieci publicznej nigdy nie może znaleźć się w kolejce
niżej niż na zasobie odciętym.

## Rozstrzygnięcie wag

Ekspozycja: publiczna 1,0 — wewnętrzna 0,6 — odcięta 0,3.
Krytyczność: wysoka 1,0 — średnia 0,75 — niska 0,5.
Wynik = ocena CVSS × waga ekspozycji × waga krytyczności, zaokrąglony do dwóch miejsc.
Progi klas: krytyczna od 7,0, wysoka od 4,5, średnia od 2,0, niska poniżej.

Uzasadnienie doboru: obie skale są ściśle malejące. Dzięki temu guardrail z PRD — ta
sama podatność na zasobie wystawionym nigdy nie niżej niż na odciętym — nie jest
założeniem, którego trzeba pilnować, tylko własnością konstrukcyjną iloczynu. Test
sprawdza to wyczerpująco na pełnej siatce: osiem wartości CVSS × trzy ekspozycje ×
trzy krytyczności, w obie strony po każdej ze skal.

Kalibracja progów wynika z tego, że wynik zachowuje skalę CVSS: przy zasobie
publicznym i krytycznym mnożniki wynoszą 1,0, więc wynik równa się ocenie CVSS, a progi
pokrywają się z potocznym rozumieniem wag. Dopiero mniejsza ekspozycja przesuwa pozycję
w dół.

## Co zostało poza tą zmianą

Formularz dopisywania podatności, prezentacja składników priorytetu i zapis do bazy —
wchodzą razem z resztą S-03, gdy fundament F-02 będzie gotowy. Moduł domenowy jest od
nich niezależny i już teraz w pełni pokryty testami.
