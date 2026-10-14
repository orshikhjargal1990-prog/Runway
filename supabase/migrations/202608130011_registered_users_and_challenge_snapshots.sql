alter table public.profiles
  add column if not exists email text;

update public.profiles profile
set email = auth_user.email
from auth.users auth_user
where auth_user.id = profile.id
  and profile.email is null;

drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile"
on public.profiles for insert
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Гүйгч'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = coalesce(public.profiles.email, excluded.email),
    name = coalesce(nullif(public.profiles.name, ''), excluded.name),
    updated_at = now();
  return new;
end;
$$;

alter table public.challenges
  drop constraint if exists challenges_challenge_group_check;
alter table public.challenges
  add constraint challenges_challenge_group_check check (challenge_group in ('5k', '10k', 'marathon'));

alter table public.challenge_members
  drop constraint if exists challenge_members_challenge_group_check;
alter table public.challenge_members
  add constraint challenge_members_challenge_group_check check (challenge_group in ('5k', '10k', 'marathon'));

create or replace function public.register_challenge_with_snapshot(
  target_challenge_id text,
  target_title text,
  target_org text,
  target_type text,
  target_group text,
  target_goal_km numeric,
  target_reward text,
  target_color text,
  target_image_url text,
  target_registration_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  target_user_id := auth.uid();
  if target_user_id is null then
    raise exception 'Authentication required';
  end if;

  if target_group not in ('5k', '10k', 'marathon') then
    raise exception 'Unsupported challenge group';
  end if;

  insert into public.challenges (
    id, title, org, type, challenge_group, goal_km, reward, color, image_url, registration_ends_at, enabled
  )
  values (
    target_challenge_id,
    target_title,
    target_org,
    case when target_type in ('Happy', 'Corporate') then target_type else 'Happy' end,
    target_group,
    greatest(target_goal_km, 0.01),
    target_reward,
    target_color,
    target_image_url,
    target_registration_ends_at,
    true
  )
  on conflict (id) do update set
    title = excluded.title,
    org = excluded.org,
    type = excluded.type,
    challenge_group = excluded.challenge_group,
    goal_km = excluded.goal_km,
    reward = excluded.reward,
    color = excluded.color,
    image_url = excluded.image_url,
    registration_ends_at = excluded.registration_ends_at,
    enabled = true,
    updated_at = now();

  delete from public.challenge_members
  where user_id = target_user_id
    and challenge_group = target_group;

  insert into public.challenge_members (challenge_id, user_id, challenge_group)
  values (target_challenge_id, target_user_id, target_group);
end;
$$;

grant execute on function public.register_challenge_with_snapshot(text,text,text,text,text,numeric,text,text,text,timestamptz) to authenticated;
