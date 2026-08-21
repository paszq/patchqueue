-- Rozstrzygniecie pozycji jako jedna operacja atomowa.
--
-- Dotad aplikacja wykonywala dwa niezalezne zapisy: wpis do historii, a potem zmiane
-- stanu pozycji. Gdy drugi zawiodl, historia twierdzila ze pozycje rozstrzygnieto, a
-- pozycja zostawala otwarta. Tabela historii nie przyjmuje zmian ani usuniec, wiec
-- takiej rozbieznosci nie dalo sie naprawic zadna sciezka dostepna aplikacji.
--
-- Funkcja jest SECURITY INVOKER, wiec polityki dostepu na poziomie wierszy obowiazuja
-- tak samo jak przy zwyklych zapytaniach - uzytkownik nie siegnie przez nia po cudze
-- dane. Oba zapisy dzieja sie w jednej transakcji: albo oba, albo zaden.

create or replace function public.record_decision(
  p_vulnerability_id uuid,
  p_kind text,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision_id uuid;
  v_owner       uuid;
  v_reopened    boolean := p_kind = 'reopened';
begin
  -- Wlasciciel odczytany przez polityki dostepu: cudza pozycja nie bedzie widoczna.
  select v.user_id into v_owner
    from public.vulnerabilities v
   where v.id = p_vulnerability_id;

  if v_owner is null then
    raise exception 'Nie znaleziono pozycji % albo brak do niej dostępu', p_vulnerability_id
      using errcode = 'no_data_found';
  end if;

  insert into public.decisions (user_id, vulnerability_id, kind, reason)
       values (v_owner, p_vulnerability_id, p_kind, p_reason)
    returning id into v_decision_id;

  update public.vulnerabilities
     set status      = case when v_reopened then 'open' else p_kind end,
         resolved_at = case when v_reopened then null else now() end
   where id = p_vulnerability_id;

  if not found then
    raise exception 'Nie udało się zmienić stanu pozycji %', p_vulnerability_id
      using errcode = 'no_data_found';
  end if;

  return v_decision_id;
end;
$$;

comment on function public.record_decision is
  'Zapisuje rozstrzygnięcie i zmienia stan pozycji w jednej transakcji. Albo oba zapisy, albo żaden.';

revoke all on function public.record_decision(uuid, text, text) from public;
grant execute on function public.record_decision(uuid, text, text) to authenticated;
