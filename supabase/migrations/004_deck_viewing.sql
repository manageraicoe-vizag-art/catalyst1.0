-- Catalyst 1.0 · update 004: investors can view pitch decks directly (per-startup switch).
-- The deck link stays in the organiser-only table; registered investors get it through
-- open_deck(), which also records the view for RTIH. Safe to run more than once.

-- Public flag only (no URL): "this startup's deck can be viewed in the app"
alter table public.startups add column if not exists deck_available boolean not null default false;

-- Who opened which deck (organisers see all; an investor sees only their own)
create table if not exists public.deck_views (
  investor_id uuid not null references public.investors(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  views int not null default 1,
  primary key (investor_id, startup_id)
);
alter table public.deck_views enable row level security;
drop policy if exists deck_views_select on public.deck_views;
create policy deck_views_select on public.deck_views for select
  using (public.is_organiser() or investor_id = public.current_investor_id());
grant select on public.deck_views to authenticated;
revoke all on public.deck_views from anon;

-- Returns the deck link to a registered investor (or organiser) and logs the view.
create or replace function public.open_deck(p_startup uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_inv uuid := public.current_investor_id();
  v_url text;
begin
  if v_inv is null and not public.is_organiser() then
    raise exception 'Please enter your details first';
  end if;
  select p.deck_url into v_url
    from public.startups s
    join public.startup_private p on p.startup_id = s.id
   where s.id = p_startup
     and (s.deck_available or public.is_organiser())
     and coalesce(p.deck_url, '') <> '';
  if v_url is null then
    raise exception 'This deck is not available to view. You can request it from the RTIH team.';
  end if;
  if v_inv is not null then
    insert into public.deck_views (investor_id, startup_id) values (v_inv, p_startup)
    on conflict (investor_id, startup_id)
    do update set last_viewed_at = now(), views = public.deck_views.views + 1;
  end if;
  return v_url;
end;
$$;
grant execute on function public.open_deck(uuid) to authenticated;
revoke execute on function public.open_deck(uuid) from public, anon;  -- Postgres grants new functions to PUBLIC by default

-- Stream deck views to the organiser dashboard
do $$
begin
  alter publication supabase_realtime add table public.deck_views;
exception when duplicate_object then null;
          when undefined_object then null;
end;
$$;
