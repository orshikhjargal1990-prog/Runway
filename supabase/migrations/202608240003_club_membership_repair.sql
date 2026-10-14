create table if not exists public.running_clubs (
  id text primary key,
  name text not null,
  city text not null,
  description text not null default '',
  image_url text not null,
  member_count integer not null default 0,
  weekly_km numeric not null default 0,
  rank integer not null,
  meeting_info text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id text not null references public.running_clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.running_clubs enable row level security;
alter table public.club_members enable row level security;

drop policy if exists "enabled clubs are readable" on public.running_clubs;
drop policy if exists "admins manage clubs" on public.running_clubs;
drop policy if exists "club memberships are readable" on public.club_members;
drop policy if exists "users join clubs" on public.club_members;
drop policy if exists "users leave clubs" on public.club_members;

create policy "enabled clubs are readable" on public.running_clubs for select using (enabled or public.is_admin());
create policy "admins manage clubs" on public.running_clubs for all using (public.is_admin()) with check (public.is_admin());
create policy "club memberships are readable" on public.club_members for select using (true);
create policy "users join clubs" on public.club_members for insert to authenticated with check (auth.uid() = user_id);
create policy "users leave clubs" on public.club_members for delete to authenticated using (auth.uid() = user_id);

create or replace function public.set_my_running_club(target_club_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.club_members where user_id = auth.uid();

  if target_club_id is not null then
    insert into public.club_members (club_id, user_id)
    values (target_club_id, auth.uid());
  end if;
end;
$$;

grant execute on function public.set_my_running_club(text) to authenticated;
