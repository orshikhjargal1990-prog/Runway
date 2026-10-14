create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  distance_km numeric(8,2),
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  type text not null check (type in ('image', 'video')),
  storage_path text not null,
  public_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists post_media_post_id_idx on public.post_media(post_id, sort_order);

alter table public.profiles add column if not exists email text;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;

drop policy if exists "users create own profile" on public.profiles;
drop policy if exists "profiles are readable" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "posts are readable" on public.posts;
drop policy if exists "users create own posts" on public.posts;
drop policy if exists "users update own posts" on public.posts;
drop policy if exists "users delete own posts" on public.posts;
drop policy if exists "post media are readable" on public.post_media;
drop policy if exists "users add own post media" on public.post_media;
drop policy if exists "users delete own post media" on public.post_media;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "posts are readable" on public.posts for select using (true);
create policy "users create own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own posts" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own posts" on public.posts for delete to authenticated using (auth.uid() = user_id or public.is_admin());
create policy "post media are readable" on public.post_media for select using (true);
create policy "users add own post media" on public.post_media for insert to authenticated with check (
  exists (select 1 from public.posts where posts.id = post_id and posts.user_id = auth.uid())
);
create policy "users delete own post media" on public.post_media for delete to authenticated using (
  exists (select 1 from public.posts where posts.id = post_id and posts.user_id = auth.uid()) or public.is_admin()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Гүйгч'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = coalesce(public.profiles.email, excluded.email),
    name = coalesce(nullif(public.profiles.name, ''), excluded.name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads post media" on storage.objects;
drop policy if exists "users upload own post media" on storage.objects;
drop policy if exists "users update own post media" on storage.objects;
drop policy if exists "users delete own post media" on storage.objects;

create policy "public reads post media" on storage.objects for select using (bucket_id = 'post-media');
create policy "users upload own post media" on storage.objects for insert to authenticated with check (
  bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users update own post media" on storage.objects for update to authenticated using (
  bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users delete own post media" on storage.objects for delete to authenticated using (
  bucket_id = 'post-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
