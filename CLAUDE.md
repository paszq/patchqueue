# Rules for AI — PatchQueue

Guidance for the agent working in this repository.

## Project

PatchQueue orders vulnerability remediation by combining a vulnerability's CVSS score
with the exposure and criticality of the asset it sits on. Same vulnerability, different
asset, different priority — that is the product, and it is what separates it from a
spreadsheet sorted by CVSS.

Read before planning any change:

- `context/foundation/prd.md` — requirements (FR-001…FR-017), user stories, guardrails
- `context/foundation/roadmap.md` — vertical slices, dependency order, current position
- `context/foundation/tech-stack.md` — stack decision and accepted risks
- `context/foundation/shape-notes.md` — why the product is shaped this way

Per-change work lives in `context/changes/<change-id>/`. Use the roadmap's Change ID.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)
- `npm run typecheck` — `astro check`
- `npm test` — Vitest (unit; domain rules)
- `npm run test:e2e` — Playwright (user-facing flows)

Quality gates before declaring a change done: `lint`, `typecheck`, `test`, `build`.
Run `npx astro sync` first after any dependency change — lint fails on missing virtual
module types otherwise.

The npm cache in `~/.npm` contains root-owned entries; pass
`--cache <writable-dir>` if an install fails with EACCES.

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Domain rules — do not violate

- The priority rule lives in one module and is a pure function. It is never inlined into
  a route handler or a component, and never computed in two places.
- A vulnerability on an internet-facing asset must never rank below the same
  vulnerability on an isolated asset. This invariant is covered by unit tests.
- A recorded decision — patched, or rejected with a reason — is never deleted or
  overwritten. Reopening an item appends to its history; it does not replace it.
- Rejecting an item without a reason is impossible.
- Deleting an asset that still has unresolved items is refused, and the refusal names
  the blocking items. This is a domain rule, not form validation — it holds regardless
  of which path the request arrives through.
- Changing an asset's exposure recalculates every open item on it, and no resolved one.

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + build on every push and PR to master. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.

Extending this pipeline with typecheck, unit tests, E2E and an agent review pass is
tracked as F-03 `verification-pipeline` in the roadmap.

## Known accepted risks

See `context/changes/bootstrap-verification/verification.md` for the dependency audit
and the reasoning behind each finding left unresolved.
