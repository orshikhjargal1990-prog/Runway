create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_messages_participants_idx on public.direct_messages(sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages(recipient_id, read_at, created_at desc);

alter table public.direct_messages enable row level security;
grant select, insert, update, delete on public.direct_messages to authenticated;

create policy "participants read direct messages" on public.direct_messages for select using (
  auth.uid() = sender_id or auth.uid() = recipient_id
);
create policy "users send direct messages" on public.direct_messages for insert with check (
  auth.uid() = sender_id
);
create policy "recipients mark messages read" on public.direct_messages for update using (
  auth.uid() = recipient_id
) with check (auth.uid() = recipient_id);
create policy "senders delete own messages" on public.direct_messages for delete using (
  auth.uid() = sender_id
);

create or replace function public.get_my_challenge_progress()
returns table (challenge_id text, total_km numeric, rank bigint, participant_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select
      cm.challenge_id,
      cm.user_id,
      coalesce(sum(r.distance_km), 0)::numeric as total_km
    from public.challenge_members cm
    left join public.runs r
      on r.challenge_id = cm.challenge_id and r.user_id = cm.user_id
    group by cm.challenge_id, cm.user_id
  ), ranked as (
    select
      challenge_id,
      user_id,
      total_km,
      dense_rank() over (partition by challenge_id order by total_km desc) as rank,
      count(*) over (partition by challenge_id) as participant_count
    from totals
  )
  select challenge_id, total_km, rank, participant_count
  from ranked
  where user_id = auth.uid();
$$;

create or replace function public.get_profile_summary(target_user_id uuid)
returns table (total_km numeric, run_count bigint, post_count bigint, follower_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select sum(distance_km) from public.runs where user_id = target_user_id), 0)::numeric,
    (select count(*) from public.runs where user_id = target_user_id),
    (select count(*) from public.posts where user_id = target_user_id),
    (select count(*) from public.follows where following_id = target_user_id),
    (select count(*) from public.follows where follower_id = target_user_id);
$$;

grant execute on function public.get_my_challenge_progress() to authenticated;
grant execute on function public.get_profile_summary(uuid) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;
