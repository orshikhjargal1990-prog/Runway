create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_idx on public.post_comments(post_id, created_at);
create index if not exists post_likes_user_id_idx on public.post_likes(user_id);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

create policy "post likes are readable" on public.post_likes for select using (true);
create policy "users add own likes" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "users remove own likes" on public.post_likes for delete using (auth.uid() = user_id);

create policy "post comments are readable" on public.post_comments for select using (true);
create policy "users add own comments" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "users update own comments" on public.post_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own comments" on public.post_comments for delete using (auth.uid() = user_id or public.is_admin());
