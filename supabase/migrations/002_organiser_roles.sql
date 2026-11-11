-- Catalyst 1.0 · update 002: organiser roles (editor = full control, viewer = read-only)
-- For databases that already ran the original schema.sql. Safe to run more than once.

-- 1. Role column. New organisers default to 'viewer', so a mistake never grants edit rights.
alter table public.organisers add column if not exists role text not null default 'viewer';
do $$
begin
  alter table public.organisers add constraint organisers_role_check check (role in ('editor', 'viewer'));
exception when duplicate_object then null;
end;
$$;

-- 2. Role helpers
create or replace function public.organiser_role()
returns text language sql stable security definer set search_path = public, auth as $$
  select o.role from auth.users u
  join public.organisers o on lower(o.email) = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null
  limit 1;
$$;

create or replace function public.is_organiser()   -- any organiser: read
returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.organiser_role() is not null;
$$;

create or replace function public.can_edit()        -- editors only: write
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(public.organiser_role() = 'editor', false);
$$;

create or replace function public.whoami_organiser()
returns json language sql stable security definer set search_path = public, auth as $$
  select json_build_object('email', o.email, 'name', o.name, 'role', o.role)
  from auth.users u join public.organisers o on lower(o.email) = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

grant execute on function public.can_edit() to anon, authenticated;
grant execute on function public.organiser_role() to authenticated;

-- 3. Privileged trigger paths now require an editor
create or replace function public.investors_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.can_edit() then
    new.invite_token := old.invite_token;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create or replace function public.notices_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.can_edit() then
    new := old;
    new.read_at := coalesce(old.read_at, now());
  end if;
  return new;
end;
$$;

-- 4. Organiser actions: editors only
create or replace function public.reorder_startups(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit() then raise exception 'Organiser editors only'; end if;
  update public.startups s set position = x.ord
    from unnest(p_ids) with ordinality as x(id, ord)
   where s.id = x.id;
end;
$$;

create or replace function public.set_pitching(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit() then raise exception 'Organiser editors only'; end if;
  update public.startups set status = 'done' where status = 'pitching' and (p_id is null or id <> p_id);
  if p_id is not null then
    update public.startups set status = 'pitching' where id = p_id;
  end if;
end;
$$;

create or replace function public.notify_request(p_request_id uuid)
returns public.notices language plpgsql security definer set search_path = public as $$
declare
  v_req public.requests;
  v_h public.request_handling;
  v_n public.notices;
begin
  if not public.can_edit() then raise exception 'Organiser editors only'; end if;
  select * into v_req from public.requests where id = p_request_id;
  select * into v_h from public.request_handling where request_id = p_request_id;
  if v_req.id is null or v_h.request_id is null or v_h.status <> 'approved' then
    raise exception 'Approve the request before notifying the investor';
  end if;
  insert into public.notices (investor_id, request_id, startup_id, type, room, meeting_at, deck_link, message)
  values (v_req.investor_id, v_req.id, v_req.startup_id, v_req.type, v_h.room, v_h.meeting_at, v_h.deck_link, v_h.message)
  returning * into v_n;
  update public.request_handling set notified_at = now() where request_id = p_request_id;
  return v_n;
end;
$$;

-- 5. Row-level security: organisers read, editors write
drop policy if exists settings_update on public.event_settings;
create policy settings_update on public.event_settings for update using (public.can_edit()) with check (public.can_edit());

drop policy if exists investors_update on public.investors;
create policy investors_update on public.investors for update
  using (id = public.current_investor_id() or public.can_edit())
  with check (id = public.current_investor_id() or public.can_edit());
drop policy if exists investors_insert on public.investors;
create policy investors_insert on public.investors for insert with check (public.can_edit());
drop policy if exists investors_delete on public.investors;
create policy investors_delete on public.investors for delete using (public.can_edit());

drop policy if exists startups_write on public.startups;
create policy startups_write on public.startups for all using (public.can_edit()) with check (public.can_edit());

drop policy if exists startup_private_all on public.startup_private;
drop policy if exists startup_private_select on public.startup_private;
create policy startup_private_select on public.startup_private for select using (public.is_organiser());
drop policy if exists startup_private_write on public.startup_private;
create policy startup_private_write on public.startup_private for all using (public.can_edit()) with check (public.can_edit());

drop policy if exists requests_delete on public.requests;
create policy requests_delete on public.requests for delete using (public.can_edit());

drop policy if exists handling_all on public.request_handling;
drop policy if exists handling_select on public.request_handling;
create policy handling_select on public.request_handling for select using (public.is_organiser());
drop policy if exists handling_write on public.request_handling;
create policy handling_write on public.request_handling for all using (public.can_edit()) with check (public.can_edit());

drop policy if exists notices_update on public.notices;
create policy notices_update on public.notices for update
  using (investor_id = public.current_investor_id() or public.can_edit());
drop policy if exists notices_write on public.notices;
create policy notices_write on public.notices for insert with check (public.can_edit());
drop policy if exists notices_delete on public.notices;
create policy notices_delete on public.notices for delete using (public.can_edit());
