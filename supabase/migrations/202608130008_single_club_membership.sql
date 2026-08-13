-- Keep the most recently joined club if legacy data contains multiple memberships.
delete from public.club_members existing
where exists (
  select 1
  from public.club_members newer
  where newer.user_id = existing.user_id
    and (
      newer.joined_at > existing.joined_at
      or (newer.joined_at = existing.joined_at and newer.club_id > existing.club_id)
    )
);

create unique index if not exists club_members_one_club_per_user
  on public.club_members (user_id);

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
