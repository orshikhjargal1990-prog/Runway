alter table public.challenges
  add column if not exists challenge_group text;

update public.challenges
set challenge_group = case when type = 'Happy' then '5k' else '10k' end
where challenge_group is null;

alter table public.challenges
  alter column challenge_group set not null;

alter table public.challenges
  drop constraint if exists challenges_challenge_group_check;
alter table public.challenges
  add constraint challenges_challenge_group_check check (challenge_group in ('5k', '10k'));

alter table public.challenge_members
  add column if not exists challenge_group text;

update public.challenge_members membership
set challenge_group = challenge.challenge_group
from public.challenges challenge
where challenge.id = membership.challenge_id
  and membership.challenge_group is null;

-- Preserve the newest membership when old data contains two active challenges in one group.
delete from public.challenge_members existing
where exists (
  select 1
  from public.challenge_members newer
  where newer.user_id = existing.user_id
    and newer.challenge_group = existing.challenge_group
    and (
      newer.joined_at > existing.joined_at
      or (newer.joined_at = existing.joined_at and newer.challenge_id > existing.challenge_id)
    )
);

alter table public.challenge_members
  alter column challenge_group set not null;

alter table public.challenge_members
  drop constraint if exists challenge_members_challenge_group_check;
alter table public.challenge_members
  add constraint challenge_members_challenge_group_check check (challenge_group in ('5k', '10k'));

create or replace function public.apply_challenge_member_group()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select challenge_group into new.challenge_group
  from public.challenges
  where id = new.challenge_id;
  return new;
end;
$$;

drop trigger if exists set_challenge_member_group on public.challenge_members;
create trigger set_challenge_member_group
before insert or update of challenge_id on public.challenge_members
for each row execute function public.apply_challenge_member_group();

create unique index if not exists challenge_members_one_active_per_group
  on public.challenge_members (user_id, challenge_group);

create or replace function public.set_my_active_challenge(target_challenge_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_group text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select challenge_group into target_group
  from public.challenges
  where id = target_challenge_id and enabled = true;

  if target_group is null then
    raise exception 'Challenge is unavailable';
  end if;

  delete from public.challenge_members
  where user_id = auth.uid() and challenge_group = target_group;

  insert into public.challenge_members (challenge_id, user_id, challenge_group)
  values (target_challenge_id, auth.uid(), target_group);
end;
$$;

create or replace function public.leave_my_challenge(target_challenge_id text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.challenge_members
  where user_id = auth.uid() and challenge_id = target_challenge_id;
$$;

grant execute on function public.set_my_active_challenge(text) to authenticated;
grant execute on function public.leave_my_challenge(text) to authenticated;
