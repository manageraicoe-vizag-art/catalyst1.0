-- Catalyst 1.0 · update 005: the projector stage screen.
--   1. A 'display' organiser role for the projector login (admin2): read-only, opens straight to the stage screen.
--   2. One shared stage row that editors (admin1) drive and every screen follows: who is on,
--      the pitch → Q&A → investor-interest timers (server time) and the deck's current slide.
--   3. A private 'decks' storage bucket: PDFs an editor uploads are shown on the projector.
-- Safe to run more than once. Run it in Supabase → SQL Editor.
--
-- Then create the projector login:
--   Authentication → Users → Add user (email + password, tick "Auto Confirm User"), and
--   insert into public.organisers (email, name, role) values ('display@rtih.in', 'Projector', 'display')
--     on conflict (email) do update set role = 'display';

-- 1. display role ------------------------------------------------------
alter table public.organisers drop constraint if exists organisers_role_check;
alter table public.organisers add constraint organisers_role_check check (role in ('editor', 'viewer', 'display'));

-- 2. stage -------------------------------------------------------------
-- mode 'running': the pitch timer starts at started_at, Q&A follows it, then the investor-interest
-- screen stays up until an editor starts the next pitch. pitch_secs = 0 starts straight at Q&A.
create table if not exists public.stage (
  id int primary key default 1 check (id = 1),
  startup_id uuid references public.startups(id) on delete set null,
  mode text not null default 'idle' check (mode in ('idle', 'running', 'break')),
  started_at timestamptz not null default now(),
  pitch_secs int not null default 300 check (pitch_secs >= 0),
  qa_secs int not null default 300 check (qa_secs >= 0),
  deck_page int not null default 1 check (deck_page >= 1),
  updated_at timestamptz not null default now()
);
insert into public.stage (id) values (1) on conflict (id) do nothing;

alter table public.stage enable row level security;
-- Not sensitive (who is on stage and the timer), and investors' phones show the interest prompt from it
drop policy if exists stage_select on public.stage;
create policy stage_select on public.stage for select using (true);
grant select on public.stage to anon, authenticated;
-- no insert/update/delete policies: every change goes through the functions below

-- Stage row plus the server clock, so every screen counts down from the same time
create or replace function public.stage_get()
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object('stage', row_to_json(s), 'now', now()) from public.stage s where s.id = 1;
$$;

-- Put a startup on stage (whoever was pitching becomes done) and start its pitch timer
create or replace function public.stage_start_pitch(p_id uuid, p_pitch_secs int default 300, p_qa_secs int default 300)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.can_edit() then
    raise exception 'Organiser editors only';
  end if;
  perform public.set_pitching(p_id);
  update public.stage
     set startup_id = p_id, mode = 'running', started_at = now(),
         pitch_secs = greatest(p_pitch_secs, 0), qa_secs = greatest(p_qa_secs, 0),
         deck_page = 1, updated_at = now()
   where id = 1;
end;
$$;

-- Jump to a phase: (running, startup, 300, 300) pitch · (running, startup, 0, 300) Q&A ·
-- (running, startup, 0, 0) investor interest · (idle, null, 0, 0) schedule · (break, null, 0, 0) lunch
create or replace function public.stage_set(p_mode text, p_startup uuid, p_pitch_secs int, p_qa_secs int)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.can_edit() then
    raise exception 'Organiser editors only';
  end if;
  update public.stage
     set mode = p_mode, started_at = now(),
         deck_page = case when startup_id is distinct from p_startup then 1 else deck_page end,
         startup_id = p_startup,
         pitch_secs = greatest(p_pitch_secs, 0), qa_secs = greatest(p_qa_secs, 0), updated_at = now()
   where id = 1;
end;
$$;

-- Add time to whichever timer is running now (pitch or Q&A)
create or replace function public.stage_add_time(p_secs int)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  s public.stage;
  e double precision;
begin
  if not public.can_edit() then
    raise exception 'Organiser editors only';
  end if;
  select * into s from public.stage where id = 1 for update;
  if s.mode <> 'running' then
    return;
  end if;
  e := extract(epoch from now() - s.started_at);
  if e < s.pitch_secs then
    update public.stage set pitch_secs = greatest(pitch_secs + p_secs, 0), updated_at = now() where id = 1;
  elsif e < s.pitch_secs + s.qa_secs then
    update public.stage set qa_secs = greatest(qa_secs + p_secs, 0), updated_at = now() where id = 1;
  end if;
end;
$$;

-- Current slide of the deck on screen. Any organiser, so the projector (with the clicker) can sync it.
create or replace function public.stage_slide(p_page int)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_organiser() then
    raise exception 'Organisers only';
  end if;
  update public.stage set deck_page = greatest(p_page, 1), updated_at = now() where id = 1;
end;
$$;

revoke execute on function public.stage_get() from public;
revoke execute on function public.stage_start_pitch(uuid, int, int) from public, anon;
revoke execute on function public.stage_set(text, uuid, int, int) from public, anon;
revoke execute on function public.stage_add_time(int) from public, anon;
revoke execute on function public.stage_slide(int) from public, anon;
grant execute on function public.stage_get() to anon, authenticated;
grant execute on function public.stage_start_pitch(uuid, int, int) to authenticated;
grant execute on function public.stage_set(text, uuid, int, int) to authenticated;
grant execute on function public.stage_add_time(int) to authenticated;
grant execute on function public.stage_slide(int) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.stage;
exception when duplicate_object then null;
          when undefined_object then null;
end;
$$;

-- 3. decks bucket ------------------------------------------------------
-- One PDF per startup at "<startup id>.pdf". Organisers (incl. the projector) read; editors upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('decks', 'decks', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists decks_read on storage.objects;
create policy decks_read on storage.objects for select to authenticated
  using (bucket_id = 'decks' and public.is_organiser());
drop policy if exists decks_insert on storage.objects;
create policy decks_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'decks' and public.can_edit());
drop policy if exists decks_update on storage.objects;
create policy decks_update on storage.objects for update to authenticated
  using (bucket_id = 'decks' and public.can_edit())
  with check (bucket_id = 'decks' and public.can_edit());
drop policy if exists decks_delete on storage.objects;
create policy decks_delete on storage.objects for delete to authenticated
  using (bucket_id = 'decks' and public.can_edit());
