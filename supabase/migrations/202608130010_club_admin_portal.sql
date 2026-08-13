create table if not exists public.club_admins (
  club_id text not null references public.running_clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.club_admins enable row level security;

create or replace function public.is_club_admin(target_club_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.club_admins
    where club_id = target_club_id and user_id = auth.uid()
  );
$$;

create or replace function public.get_my_club_admin_context()
returns table (club_id text, club_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select ca.club_id, rc.name, au.email::text
  from public.club_admins ca
  join public.running_clubs rc on rc.id = ca.club_id
  join auth.users au on au.id = ca.user_id
  where ca.user_id = auth.uid()
  order by ca.created_at
  limit 1;
$$;

create or replace function public.assign_club_admin(target_club_id text, target_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_user_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select id into target_user_id from auth.users where lower(email) = lower(trim(target_email));
  if target_user_id is null then raise exception 'Энэ имэйлээр бүртгэлтэй хэрэглэгч олдсонгүй'; end if;
  delete from public.club_admins where user_id = target_user_id;
  insert into public.club_admins (club_id, user_id) values (target_club_id, target_user_id)
  on conflict (club_id, user_id) do nothing;
end;
$$;

grant execute on function public.is_club_admin(text) to authenticated;
grant execute on function public.get_my_club_admin_context() to authenticated;
grant execute on function public.assign_club_admin(text,text) to authenticated;
grant select on public.club_admins to authenticated;
grant select, update on public.running_clubs to authenticated;
grant select, insert, update, delete on public.club_events to authenticated;
grant select, update on public.club_event_members to authenticated;
grant select on public.club_members to authenticated;
grant select on public.runs to authenticated;

create policy "club admins read own assignments" on public.club_admins for select
using (user_id = auth.uid() or public.is_admin());
create policy "platform admins manage club admins" on public.club_admins for all
using (public.is_admin()) with check (public.is_admin());

create policy "club admins update own club" on public.running_clubs for update
using (public.is_club_admin(id)) with check (public.is_club_admin(id));
create policy "club admins manage own events" on public.club_events for all
using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));
create policy "club admins read own member runs" on public.runs for select using (
  exists (
    select 1 from public.club_members cm
    where cm.user_id = runs.user_id and public.is_club_admin(cm.club_id)
  )
);

alter table public.club_event_members
  add column if not exists status text not null default 'registered';
alter table public.club_event_members
  drop constraint if exists club_event_members_status_check;
alter table public.club_event_members
  add constraint club_event_members_status_check check (status in ('registered','confirmed','checked_in','cancelled'));

create policy "club admins manage own event registrations" on public.club_event_members for update
using (
  exists (select 1 from public.club_events ce where ce.id = event_id and public.is_club_admin(ce.club_id))
) with check (
  exists (select 1 from public.club_events ce where ce.id = event_id and public.is_club_admin(ce.club_id))
);

create table if not exists public.active_runs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  club_id text references public.running_clubs(id) on delete set null,
  event_id text references public.club_events(id) on delete set null,
  route_id text references public.routes(id) on delete set null,
  route_title text not null default 'Чөлөөт гүйлт',
  distance_km numeric(8,3) not null default 0,
  duration_seconds integer not null default 0,
  pace_seconds_per_km integer,
  latitude double precision,
  longitude double precision,
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  status text not null default 'running' check (status in ('running','paused'))
);

create or replace function public.apply_active_run_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  select club_id into new.club_id from public.club_members where user_id = auth.uid() limit 1;
  select cem.event_id into new.event_id
  from public.club_event_members cem
  join public.club_events ce on ce.id = cem.event_id
  where cem.user_id = auth.uid()
    and cem.status <> 'cancelled'
    and ce.starts_at between now() - interval '8 hours' and now() + interval '2 hours'
  order by abs(extract(epoch from (ce.starts_at - now())))
  limit 1;
  if new.event_id is not null then
    select club_id into new.club_id from public.club_events where id = new.event_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists active_run_context on public.active_runs;
create trigger active_run_context before insert or update on public.active_runs
for each row execute function public.apply_active_run_context();

alter table public.active_runs enable row level security;
grant select, insert, update, delete on public.active_runs to authenticated;
create policy "users manage own active run" on public.active_runs for all
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "club admins read own live runs" on public.active_runs for select
using (club_id is not null and public.is_club_admin(club_id));

create policy "club admins upload own club media" on storage.objects for insert to authenticated
with check (bucket_id = 'club-media' and public.is_club_admin((storage.foldername(name))[1]));
create policy "club admins update own club media" on storage.objects for update to authenticated
using (bucket_id = 'club-media' and public.is_club_admin((storage.foldername(name))[1]))
with check (bucket_id = 'club-media' and public.is_club_admin((storage.foldername(name))[1]));
create policy "club admins delete own club media" on storage.objects for delete to authenticated
using (bucket_id = 'club-media' and public.is_club_admin((storage.foldername(name))[1]));

do $$ begin
  alter publication supabase_realtime add table public.active_runs;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.club_event_members;
exception when duplicate_object then null; end $$;
