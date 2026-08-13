alter table public.running_clubs
add column if not exists total_km numeric not null default 0;

update public.running_clubs
set total_km = greatest(total_km, member_count * 84)
where total_km = 0;
