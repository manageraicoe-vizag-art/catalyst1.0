-- Catalyst 1.0 · update 003: fund names entered by investors become suggestions for teammates.
-- Exposes fund NAMES only (no investor names or contact details). Safe to run more than once.

create or replace function public.fund_suggestions()
returns setof text
language sql stable security definer
set search_path = public
as $$
  select name from (
    select distinct on (lower(regexp_replace(trim(fund), '\s+', ' ', 'g')))
           regexp_replace(trim(fund), '\s+', ' ', 'g') as name, created_at
    from public.investors
    where trim(fund) <> ''
    order by lower(regexp_replace(trim(fund), '\s+', ' ', 'g')), created_at
  ) f
  order by lower(name);
$$;

grant execute on function public.fund_suggestions() to anon, authenticated;
