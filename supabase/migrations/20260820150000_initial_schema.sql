-- PatchQueue — schemat początkowy
--
-- Trzy tabele: assets (zasoby), vulnerabilities (pozycje kolejki), decisions
-- (historia rozstrzygnięć). Priorytet i termin NIE są przechowywane — wynikają
-- z reguły w src/lib/domain/priority.ts i są liczone przy odczycie, żeby reguła
-- istniała w jednym miejscu.
--
-- Dwa guardraile z PRD są tu wymuszane przez bazę, nie przez kod aplikacji:
--   NFR-05  izolacja kont      -> polityki dostępu na poziomie wierszy
--   FR-015  trwałość decyzji   -> brak polityk UPDATE i DELETE na decisions

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------

create table if not exists public.assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 200),
  component    text not null check (length(trim(component)) between 1 and 200),
  version      text not null check (length(trim(version)) between 1 and 100),
  exposure     text not null check (exposure in ('public', 'internal', 'isolated')),
  criticality  text not null check (criticality in ('high', 'medium', 'low')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.assets.exposure is
  'Osiągalność zasobu: public (z sieci publicznej), internal (tylko wewnętrznie), isolated (odcięty). Pierwszy składnik reguły priorytetu.';
comment on column public.assets.criticality is
  'Znaczenie zasobu dla działania: high, medium, low. Drugi składnik reguły priorytetu.';

create index if not exists assets_user_id_idx on public.assets (user_id);

-- ---------------------------------------------------------------------------
-- vulnerabilities
-- ---------------------------------------------------------------------------

create table if not exists public.vulnerabilities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  asset_id     uuid not null references public.assets (id) on delete cascade,
  identifier   text not null check (length(trim(identifier)) between 1 and 100),
  cvss         numeric(3, 1) not null check (cvss >= 0 and cvss <= 10),
  description  text not null default '' check (length(description) <= 5000),
  status       text not null default 'open' check (status in ('open', 'patched', 'rejected')),
  opened_at    timestamptz not null default now(),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Pozycja otwarta nie ma daty rozstrzygnięcia; rozstrzygnięta musi ją mieć.
  constraint vulnerabilities_resolution_consistent check (
    (status = 'open' and resolved_at is null) or
    (status <> 'open' and resolved_at is not null)
  )
);

create index if not exists vulnerabilities_user_id_idx on public.vulnerabilities (user_id);
create index if not exists vulnerabilities_asset_id_idx on public.vulnerabilities (asset_id);
-- Kolejka czyta wyłącznie pozycje otwarte (NFR-01).
create index if not exists vulnerabilities_open_idx
  on public.vulnerabilities (user_id, opened_at)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- decisions — historia, wyłącznie do dopisywania
-- ---------------------------------------------------------------------------

create table if not exists public.decisions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  vulnerability_id  uuid not null references public.vulnerabilities (id) on delete cascade,
  kind              text not null check (kind in ('patched', 'rejected', 'reopened')),
  reason            text,
  created_at        timestamptz not null default now(),

  -- FR-014: odrzucenie bez podania powodu jest niemożliwe. Reguła domenowa,
  -- nie walidacja formularza — obowiązuje niezależnie od drogi żądania.
  constraint decisions_rejection_needs_reason check (
    kind <> 'rejected' or (reason is not null and length(trim(reason)) > 0)
  )
);

create index if not exists decisions_vulnerability_id_idx
  on public.decisions (vulnerability_id, created_at);

-- ---------------------------------------------------------------------------
-- FR-006: odmowa usunięcia zasobu z nierozstrzygniętymi pozycjami
--
-- Wyzwalacz, a nie ON DELETE RESTRICT: klucz obcy blokowałby usunięcie także
-- wtedy, gdy wszystkie pozycje są już zamknięte, a reguła mówi co innego.
-- ---------------------------------------------------------------------------

create or replace function public.refuse_asset_delete_with_open_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_count integer;
  open_list  text;
begin
  select count(*), string_agg(v.identifier, ', ' order by v.identifier)
    into open_count, open_list
    from public.vulnerabilities v
   where v.asset_id = old.id
     and v.status = 'open';

  if open_count > 0 then
    raise exception
      'Nie można usunąć zasobu z nierozstrzygniętymi pozycjami (%): %',
      open_count, open_list
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists refuse_asset_delete_with_open_items on public.assets;
create trigger refuse_asset_delete_with_open_items
  before delete on public.assets
  for each row execute function public.refuse_asset_delete_with_open_items();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists assets_touch_updated_at on public.assets;
create trigger assets_touch_updated_at
  before update on public.assets
  for each row execute function public.touch_updated_at();

drop trigger if exists vulnerabilities_touch_updated_at on public.vulnerabilities;
create trigger vulnerabilities_touch_updated_at
  before update on public.vulnerabilities
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Izolacja kont (NFR-05)
--
-- Polityki są granularne: osobna na operację i na rolę. Rola anon nie dostaje
-- żadnej — niezalogowany nie widzi niczego.
-- ---------------------------------------------------------------------------

alter table public.assets           enable row level security;
alter table public.vulnerabilities  enable row level security;
alter table public.decisions        enable row level security;

-- assets
create policy assets_select on public.assets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy assets_insert on public.assets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy assets_update on public.assets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy assets_delete on public.assets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- vulnerabilities
create policy vulnerabilities_select on public.vulnerabilities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy vulnerabilities_insert on public.vulnerabilities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vulnerabilities_update on public.vulnerabilities
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy vulnerabilities_delete on public.vulnerabilities
  for delete to authenticated using ((select auth.uid()) = user_id);

-- decisions: wyłącznie odczyt i dopisywanie.
--
-- Brak polityki UPDATE i brak polityki DELETE to nie przeoczenie. Przy włączonym
-- RLS operacja bez pasującej polityki jest odrzucana, więc raz zapisane
-- rozstrzygnięcie jest nieusuwalne z poziomu aplikacji. To realizacja guardrailu
-- z PRD: "raz zapisana decyzja nie znika".
create policy decisions_select on public.decisions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy decisions_insert on public.decisions
  for insert to authenticated with check ((select auth.uid()) = user_id);
