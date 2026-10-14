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
        when c.challenge_group = '5k' then coalesce(max(r.distance_km), 0)::numeric
        else coalesce(sum(r.distance_km), 0)::numeric
      end as total_km
    from public.challenge_members cm
    join public.challenges c on c.id = cm.challenge_id
    left join public.runs r
      on r.challenge_id = cm.challenge_id and r.user_id = cm.user_id
    group by cm.challenge_id, cm.user_id, c.challenge_group
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
