-- Domkniecie luki w sladzie decyzji.
--
-- Guardrail z PRD mowi: raz zapisane rozstrzygniecie nie znika. Tabela decisions nie
-- ma polityk UPDATE ani DELETE, wiec z poziomu aplikacji jest nietykalna. Ale klucz
-- obcy `vulnerability_id ... on delete cascade` obchodzil to bokiem: usuniecie
-- podatnosci kasowalo takze jej historie, a kaskady wykonuja sie z pominieciem
-- polityk dostepu. Wystarczylo usunac pozycje, zeby wymazac dowod, ze cos swiadomie
-- odrzucono - czyli dokladnie to, przed czym guardrail mial chronic.
--
-- FR-009 pozwala usuwac podatnosci wprowadzone omylkowo. Pomylka z definicji nie ma
-- jeszcze historii rozstrzygniec, wiec te dwie rzeczy da sie pogodzic: usuwanie
-- zostaje mozliwe dopoki pozycja nie zostala rozstrzygnieta.

create or replace function public.refuse_vulnerability_delete_with_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision_count integer;
begin
  select count(*) into decision_count
    from public.decisions d
   where d.vulnerability_id = old.id;

  if decision_count > 0 then
    raise exception
      'Nie można usunąć pozycji z zapisaną historią rozstrzygnięć (wpisów: %). Ślad decyzji jest trwały.',
      decision_count
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists refuse_vulnerability_delete_with_history on public.vulnerabilities;
create trigger refuse_vulnerability_delete_with_history
  before delete on public.vulnerabilities
  for each row execute function public.refuse_vulnerability_delete_with_history();

-- Usuniecie zasobu nadal kasuje jego podatnosci kaskada, ale wyzwalacz z pierwszej
-- migracji nie pozwala usunac zasobu z otwartymi pozycjami, a ten nie pozwoli usunac
-- pozycji rozstrzygnietej. Zasob z historia pozostaje wiec nieusuwalny - i tak ma byc.
