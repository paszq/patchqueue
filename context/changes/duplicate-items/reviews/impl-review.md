<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Unikalność pozycji na zasobie

- **Plan**: `context/changes/duplicate-items/plan.md`
- **Scope**: Full plan (CI review on PR #1)
- **Date**: 2026-09-02
- **CI run**: https://github.com/paszq/patchqueue/actions/runs/33666624841
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Test Coverage | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Update path that triggers the same collision has no test coverage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Test Coverage
- **Location**: `src/lib/services/vulnerabilities.ts:17-25,54-67`
- **Detail**: `translate()` (L17-25) is shared by both `createVulnerability` and `updateVulnerability` (L54-67), and the plan's Phase 2 contract explicitly says the normalization/translation applies "do zapisu i aktualizacji" (create and update). `tests/integration/duplicate-items.test.ts` only drives the rule through inserts; `e2e/main-flow.spec.ts` only exercises "add, then add duplicate." Neither exercises editing an existing item's identifier into a collision with a sibling item on the same asset, so the update branch of `translate()` — including whether its "przywróć ją do kolejki" wording still reads correctly for an edit-collision rather than a create-collision — is unverified.
- **Fix**: Add one integration case in `tests/integration/duplicate-items.test.ts` that updates an item's identifier to collide with another item on the same asset and asserts the same `expectUniqueness`-style rejection through the update path.
- **Decision**: PENDING

### F2 — Integration/E2E/db-push verification commands could not be executed in this CI review environment

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — no code change; environment/process note
- **Dimension**: Success Criteria
- **Location**: N/A (review environment)
- **Detail**: This review environment has no `SUPABASE_URL`/`SUPABASE_KEY` and no Playwright browser binaries, so `npx supabase db push`, the integration suites under `tests/integration/` (including the new `duplicate-items.test.ts`), and `npx playwright test` could not run here — the integration test files fail closed with "Brak SUPABASE_URL / SUPABASE_KEY w pipelinie" rather than being skipped, identically for the two pre-existing integration files and the new one, so this is an environment gap, not a regression from this diff. `npm run lint`, `npm run typecheck`, and `npm run build` all pass (62/62 unit tests also pass). Per CLAUDE.md, the repo's own CI workflow (`.github/workflows/ci.yml`) currently runs only lint + build, and wiring up test execution is tracked separately as F-03 `verification-pipeline` — this review's inability to independently re-run the integration/E2E suites is consistent with that known gap. The author's `change.md` records a local run with real Supabase infra (3 failures before the migration, 4/4 green after, 82 unit/integration + 15 review tests green) — this review could not independently confirm that claim.
- **Fix**: Provision `SUPABASE_URL`/`SUPABASE_KEY` (and Playwright browsers) for the environment this review skill runs in, once F-03 `verification-pipeline` wires test execution into CI.
- **Decision**: PENDING

### F3 — Import path still surfaces a raw DB error on the exact race this migration was added to close

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — no code change needed; already a deliberate, documented scope boundary
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/import.ts:115`
- **Detail**: The new migration's own comment justifies itself partly by closing the race between two concurrent imports of the same report — a case the app-level `seen` set in `importFindings` cannot catch. If that race actually fires, `importFindings` still throws `new DataAccessError(error.message)` (L115), a raw Postgres message naming the index, surfaced to the user via `messageOf(error)` in the import endpoint — not the friendly, product-language translation added to `createVulnerability`/`updateVulnerability` in this PR. The plan explicitly excludes touching `importFindings` ("Nie ruszamy importFindings"), so this is a knowingly accepted gap, not an oversight, but it means the stated goal ("the user sees a message naming the cause, not a DB error") is left unmet for the one call site the migration's own rationale calls out as the reason for existing at the DB layer.
- **Fix**: If this race is judged worth handling, translate `23505` in `importFindings`'s catch path the same way `vulnerabilities.ts` does; otherwise, no action needed — this is acceptable as scoped.
- **Decision**: PENDING

<!-- End of report -->
