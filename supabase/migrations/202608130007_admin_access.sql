create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

insert into public.admin_users (user_id)
select id from auth.users where lower(email) = 'admin@vision.mn'
on conflict (user_id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@vision.mn'
    or exists (
      select 1 from public.admin_users where user_id = auth.uid()
    );
$$;

grant execute on function public.is_admin() to authenticated;
