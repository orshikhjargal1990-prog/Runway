create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows(following_id);

alter table public.follows enable row level security;

create policy "follows are readable" on public.follows for select using (true);
create policy "users follow from own account" on public.follows for insert with check (auth.uid() = follower_id);
create policy "users unfollow from own account" on public.follows for delete using (auth.uid() = follower_id);
