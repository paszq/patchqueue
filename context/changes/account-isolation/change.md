---
change_id: account-isolation
title: Schemat danych i izolacja kont wymuszana przez bazę
status: in-progress
created: 2026-08-20
updated: 2026-08-20
archived_at: null
---

## Notes

Fundament F-02. Trzy tabele: zasoby, podatności i historia rozstrzygnięć.

Dwa guardrails z PRD są tu realizowane strukturalnie, a nie przez kod aplikacji:

- **Izolacja kont (NFR-05)** — polityki dostępu na poziomie wierszy. Zapytanie bez
  właściwego użytkownika nie zwraca cudzych danych niezależnie od tego, co zrobi
  warstwa aplikacji.
- **Nienaruszalność rozstrzygnięć** — tabela historii nie dostaje żadnej polityki
  UPDATE ani DELETE. Skoro polityki nie ma, operacja jest odrzucana przez bazę.
  Wpisu nie da się zmienić ani skasować z poziomu aplikacji, nawet przez pomyłkę.

Trzeci guardrail — odmowa usunięcia zasobu z otwartymi pozycjami (FR-006) — jako
wyzwalacz, nie klucz obcy z ON DELETE RESTRICT. Klucz blokowałby usunięcie także wtedy,
gdy wszystkie pozycje są już rozstrzygnięte, a reguła mówi co innego.

Priorytet nie jest przechowywany. Wynika z reguły w `src/lib/domain/priority.ts` i
liczony jest przy odczycie — inaczej istniałby w dwóch miejscach i mógłby się rozjechać
przy zmianie wag.
