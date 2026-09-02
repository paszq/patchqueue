<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Unikalność pozycji na zasobie

- **Plan**: `context/changes/duplicate-items/plan.md`
- **Scope**: Full plan (CI review on PR #1)
- **Date**: 2026-09-02
- **CI run**: https://github.com/paszq/patchqueue/actions/runs/33672256570
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

### F1 — Update-path collision is now proven at the DB level, but the friendly-message translation on that same path is still unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Test Coverage
- **Location**: `src/lib/services/vulnerabilities.ts:65` (also `tests/integration/duplicate-items.test.ts:146-165`, `src/pages/items/[id].astro:192-205`)
- **Detail**: A prior run of this review flagged that `translate()` (shared by `createVulnerability` and `updateVulnerability`, and named explicitly by the plan's Phase 2 contract — "dotyczy zapisu i aktualizacji") had no test driving it through the update path. Commit 6b43be4 responded by adding `odrzuca zmianę identyfikatora na kolidujący z inną pozycją tego zasobu` to `duplicate-items.test.ts`. That test proves the DB unique index rejects an `UPDATE` that collides with a sibling row — a real gap worth closing, and now closed — but it goes through the raw Supabase client directly against the `vulnerabilities` table (mirroring this file's own documented scope: "Czego te testy NIE dowodzą: że warstwa aplikacji ładnie tłumaczy odmowę"). It never calls `updateVulnerability`, so `translate()`'s branch inside the `updateVulnerability` catch path (L65) still has no test exercising it. This path is reachable by a real user: `src/pages/items/[id].astro:192-205` renders an `#edit-identifier` field that posts `_action=update` to `/api/vulnerabilities/{id}`, i.e. editing an existing item's identifier into a collision is a normal UI action, not a hypothetical. Neither `main-flow.spec.ts` (still only exercises the create-form duplicate case, added in commit 19273eb) nor any unit/integration test confirms the user sees the same "już zapisana na tym zasobie... przywróć ją do kolejki" message when the collision is triggered by an edit rather than a new entry.
- **Fix**: Add one e2e case (or a service-level test against `updateVulnerability` directly) that edits an existing item's identifier to collide with a sibling item on the same asset and asserts the same friendly `role="alert"` message the create-path test already checks in `main-flow.spec.ts:495-529`.
- **Decision**: PENDING

### F2 — Integration/E2E/db-push verification commands could not be executed in this CI review environment

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — no code change; environment/process note
- **Dimension**: Success Criteria
- **Location**: N/A (review environment)
- **Detail**: Unchanged from the prior review of this PR. This environment has no `SUPABASE_URL`/`SUPABASE_KEY` and no Playwright browser binaries, so `npx supabase db push`, the integration suites under `tests/integration/` (including `duplicate-items.test.ts`), and `npx playwright test` still fail closed here with "Brak SUPABASE_URL / SUPABASE_KEY w pipelinie" rather than being skipped — identically across all three integration files, so this is an environment gap, not a regression from the new commit. `npm run lint`, `npm run typecheck`, and `npm run build` all pass; 62/62 unit tests pass. Per CLAUDE.md, wiring test execution into CI is tracked separately as F-03 `verification-pipeline`.
- **Fix**: Provision `SUPABASE_URL`/`SUPABASE_KEY` (and Playwright browsers) for the environment this review skill runs in, once F-03 `verification-pipeline` wires test execution into CI.
- **Decision**: PENDING

### F3 — Import path still surfaces a raw DB error on the exact race this migration was added to close

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — no code change needed; already a deliberate, documented scope boundary
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/import.ts:115`
- **Detail**: Unchanged from the prior review. `importFindings` still throws a raw `DataAccessError(error.message)` on a `23505` collision instead of the product-language translation `vulnerabilities.ts` now has. The plan explicitly excludes touching `importFindings` ("Nie ruszamy importFindings"), and commit 6b43be4's own message records the author consciously keeping this out of scope rather than missing it. No action expected.
- **Fix**: No action needed — accepted as scoped. If ever revisited, translate `23505` in `importFindings`'s catch path the same way `vulnerabilities.ts` does.
- **Decision**: PENDING

<!-- End of report -->
