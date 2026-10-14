create or replace function public.apply_active_run_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();

  if new.event_id is not null then
    select club_id into new.club_id from public.club_events where id = new.event_id;
  else
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
  end if;

  new.updated_at := now();
  return new;
end;
$$;
