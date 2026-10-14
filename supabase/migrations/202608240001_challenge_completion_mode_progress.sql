alter table public.challenges
  add column if not exists completion_mode text not null default 'cumulative';

alter table public.challenges
  drop constraint if exists challenges_completion_mode_check;

alter table public.challenges
  add constraint challenges_completion_mode_check
  check (completion_mode in ('cumulative', 'single_run'));

update public.challenges
set completion_mode = case
  when challenge_group = '5k' then 'single_run'
  else 'cumulative'
end
where completion_mode is null
   or completion_mode not in ('cumulative', 'single_run');

update public.challenges
set completion_mode = 'single_run'
where challenge_group = '5k'
  and completion_mode = 'cumulative';

create or replace function public.register_challenge_with_snapshot_v2(
  target_challenge_id text,
  target_title text,
  target_org text,
  target_type text,
  target_group text,
  target_completion_mode text,
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
  normalized_completion_mode text;
begin
  target_user_id := auth.uid();
  if target_user_id is null then
    raise exception 'Authentication required';
  end if;

  if target_group not in ('5k', '10k', 'marathon') then
    raise exception 'Unsupported challenge group';
  end if;

  normalized_completion_mode := case
    when target_completion_mode in ('cumulative', 'single_run') then target_completion_mode
    when target_group = '5k' then 'single_run'
    else 'cumulative'
  end;

  insert into public.challenges (
    id, title, org, type, challenge_group, completion_mode, goal_km, reward, color, image_url, registration_ends_at, enabled
  )
  values (
    target_challenge_id,
    target_title,
    target_org,
    case when target_type in ('Happy', 'Corporate') then target_type else 'Happy' end,
    target_group,
    normalized_completion_mode,
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
    completion_mode = excluded.completion_mode,
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

grant execute on function public.register_challenge_with_snapshot_v2(text,text,text,text,text,text,numeric,text,text,text,timestamptz) to authenticated;

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
      case
        when coalesce(c.completion_mode, case when c.challenge_group = '5k' then 'single_run' else 'cumulative' end) = 'single_run'
          then coalesce(max(r.distance_km), 0)::numeric
        else coalesce(sum(r.distance_km), 0)::numeric
      end as total_km
    from public.challenge_members cm
    join public.challenges c on c.id = cm.challenge_id
    left join public.runs r
      on r.challenge_id = cm.challenge_id and r.user_id = cm.user_id
    group by cm.challenge_id, cm.user_id, c.challenge_group, c.completion_mode
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

grant execute on function public.get_my_challenge_progress() to authenticated;
