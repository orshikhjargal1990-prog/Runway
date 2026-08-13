create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Гүйгч',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id text primary key,
  title text not null,
  org text not null,
  type text not null check (type in ('Happy', 'Corporate')),
  goal_km numeric(8,2) not null check (goal_km > 0),
  reward text,
  color text not null default '#a8ff18',
  image_url text not null,
  registration_ends_at timestamptz not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routes (
  id text primary key,
  title text not null,
  city text not null check (city in ('ulaanbaatar', 'darkhan', 'erdenet')),
  area text not null,
  distance_km numeric(8,2) not null check (distance_km > 0),
  live_runners integer not null default 0,
  elevation_m integer not null default 0,
  avg_pace text not null,
  difficulty text not null,
  estimated_duration text not null,
  recent_activities integer not null default 0,
  image_url text not null,
  center jsonb not null,
  coordinates jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.challenge_members (
  challenge_id text not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route_id text references public.routes(id) on delete set null,
  challenge_id text references public.challenges(id) on delete set null,
  distance_km numeric(8,3) not null default 0,
  duration_seconds integer not null default 0,
  calories integer not null default 0,
  pace_seconds_per_km integer,
  coordinates jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.login_slides (
  id text primary key,
  eyebrow text not null,
  title_before text not null,
  accent text not null,
  title_after text not null,
  subtitle text not null,
  media_type text not null check (media_type in ('image', 'video')),
  media_path text,
  media_url text not null,
  media_name text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists post_media_post_id_idx on public.post_media(post_id, sort_order);
create index if not exists runs_user_id_idx on public.runs(user_id, completed_at desc);
create index if not exists challenge_members_user_id_idx on public.challenge_members(user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Гүйгч'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, name, avatar_url)
select id, coalesce(nullif(raw_user_meta_data ->> 'name', ''), 'Гүйгч'), raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.routes enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.challenge_members enable row level security;
alter table public.runs enable row level security;
alter table public.login_slides enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "published challenges are readable" on public.challenges for select using (enabled or public.is_admin());
create policy "admins manage challenges" on public.challenges for all using (public.is_admin()) with check (public.is_admin());
create policy "published routes are readable" on public.routes for select using (enabled or public.is_admin());
create policy "admins manage routes" on public.routes for all using (public.is_admin()) with check (public.is_admin());
create policy "posts are readable" on public.posts for select using (true);
create policy "users create own posts" on public.posts for insert with check (auth.uid() = user_id);
create policy "users update own posts" on public.posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own posts" on public.posts for delete using (auth.uid() = user_id or public.is_admin());
create policy "post media are readable" on public.post_media for select using (true);
create policy "users add own post media" on public.post_media for insert with check (
  exists (select 1 from public.posts where posts.id = post_id and posts.user_id = auth.uid())
);
create policy "users delete own post media" on public.post_media for delete using (
  exists (select 1 from public.posts where posts.id = post_id and posts.user_id = auth.uid()) or public.is_admin()
);
create policy "users read own memberships" on public.challenge_members for select using (auth.uid() = user_id or public.is_admin());
create policy "users join challenges" on public.challenge_members for insert with check (auth.uid() = user_id);
create policy "users leave challenges" on public.challenge_members for delete using (auth.uid() = user_id or public.is_admin());
create policy "users read own runs" on public.runs for select using (auth.uid() = user_id or public.is_admin());
create policy "users create own runs" on public.runs for insert with check (auth.uid() = user_id);
create policy "users update own runs" on public.runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own runs" on public.runs for delete using (auth.uid() = user_id or public.is_admin());
create policy "published login slides are readable" on public.login_slides for select using (enabled or public.is_admin());
create policy "admins manage login slides" on public.login_slides for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-media', 'post-media', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']),
  ('login-media', 'login-media', true, 104857600, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads post media" on storage.objects for select using (bucket_id = 'post-media');
create policy "users upload own post media" on storage.objects for insert to authenticated with check (
  bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users update own post media" on storage.objects for update to authenticated using (
  bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text
) with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own post media" on storage.objects for delete to authenticated using (
  bucket_id = 'post-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
create policy "public reads login media" on storage.objects for select using (bucket_id = 'login-media');
create policy "admins upload login media" on storage.objects for insert to authenticated with check (bucket_id = 'login-media' and public.is_admin());
create policy "admins update login media" on storage.objects for update to authenticated using (bucket_id = 'login-media' and public.is_admin()) with check (bucket_id = 'login-media' and public.is_admin());
create policy "admins delete login media" on storage.objects for delete to authenticated using (bucket_id = 'login-media' and public.is_admin());

insert into public.challenges (id, title, org, type, goal_km, reward, color, image_url, registration_ends_at)
values
  ('happy-coffee', 'Coffee Run', 'Coffee Bean', 'Happy', 25, 'Free Latte', '#ff6b2c', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80', now() + interval '2 hours 15 minutes'),
  ('happy-spring', 'Spring Kickoff', 'RunSync Community', 'Happy', 100, null, '#22c55e', 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1200&q=80', now() + interval '4 days 1 hour'),
  ('corp-unitel', 'Energy Run 2026', 'Unitel Group', 'Corporate', 50, null, '#6366f1', 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80', now() + interval '7 days'),
  ('corp-mcs', 'Health First', 'MCS Group', 'Corporate', 20, null, '#10b981', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&q=80', now() + interval '2 days 3 hours')
on conflict (id) do nothing;

insert into public.routes (id, title, city, area, distance_km, live_runners, elevation_m, avg_pace, difficulty, estimated_duration, recent_activities, image_url, center, coordinates)
values
  ('sukhbaatar','Сүхбаатарын талбай','ulaanbaatar','Төв талбайн loop',3.2,32,18,'5:10 /км','Easy','0h 18m',96,'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&q=80','{"latitude":47.9187,"longitude":106.9176}','[{"latitude":47.9195,"longitude":106.9142},{"latitude":47.9204,"longitude":106.9174},{"latitude":47.9187,"longitude":106.9208},{"latitude":47.9167,"longitude":106.9194},{"latitude":47.9174,"longitude":106.9156},{"latitude":47.9195,"longitude":106.9142}]'),
  ('garden','Үндэсний цэцэрлэгт хүрээлэн','ulaanbaatar','Баянзүрх',5.8,124,42,'5:45 /км','Medium','0h 34m',122,'https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=900&q=80','{"latitude":47.9038,"longitude":106.9435}','[{"latitude":47.9074,"longitude":106.9359},{"latitude":47.9092,"longitude":106.9438},{"latitude":47.9051,"longitude":106.9511},{"latitude":47.8996,"longitude":106.9483},{"latitude":47.9007,"longitude":106.9384},{"latitude":47.9074,"longitude":106.9359}]'),
  ('zaisan','Зайсан өгсүүр','ulaanbaatar','Hill climb',4.4,18,126,'6:20 /км','Hard','0h 28m',81,'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=900&q=80','{"latitude":47.8876,"longitude":106.9159}','[{"latitude":47.8948,"longitude":106.9078},{"latitude":47.8912,"longitude":106.9124},{"latitude":47.8879,"longitude":106.9149},{"latitude":47.8848,"longitude":106.9187},{"latitude":47.8818,"longitude":106.9226}]'),
  ('tuul-river','Туул голын tempo','ulaanbaatar','Riverside',6.4,47,24,'5:35 /км','Medium','0h 40m',74,'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=900&q=80','{"latitude":47.8984,"longitude":106.8837}','[{"latitude":47.9008,"longitude":106.8752},{"latitude":47.8994,"longitude":106.8819},{"latitude":47.8972,"longitude":106.8876},{"latitude":47.8959,"longitude":106.8941}]'),
  ('darkhan-park','Дархан парк loop','darkhan','Шинэ Дархан',4.9,28,16,'5:30 /км','Easy','0h 29m',63,'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900&q=80','{"latitude":49.4867,"longitude":105.9228}','[{"latitude":49.4891,"longitude":105.9178},{"latitude":49.4904,"longitude":105.9239},{"latitude":49.4867,"longitude":105.9284},{"latitude":49.4835,"longitude":105.9246},{"latitude":49.4849,"longitude":105.9185},{"latitude":49.4891,"longitude":105.9178}]'),
  ('darkhan-riverside','Хараа голын зам','darkhan','Riverside',7.2,19,22,'5:55 /км','Medium','0h 43m',41,'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900&q=80','{"latitude":49.4647,"longitude":105.9655}','[{"latitude":49.4686,"longitude":105.9554},{"latitude":49.4661,"longitude":105.9612},{"latitude":49.4639,"longitude":105.9678},{"latitude":49.4614,"longitude":105.9739}]'),
  ('erdenet-park','Эрдэнэт төв парк','erdenet','Төвийн бүс',5.1,36,35,'5:40 /км','Easy','0h 31m',68,'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900&q=80','{"latitude":49.0275,"longitude":104.0446}','[{"latitude":49.0301,"longitude":104.0398},{"latitude":49.0312,"longitude":104.0452},{"latitude":49.0276,"longitude":104.0499},{"latitude":49.0244,"longitude":104.0461},{"latitude":49.0253,"longitude":104.0406},{"latitude":49.0301,"longitude":104.0398}]'),
  ('erdenet-hill','Уурхайчны өгсүүр','erdenet','Hill route',8.4,14,148,'6:35 /км','Hard','0h 56m',29,'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900&q=80','{"latitude":49.0504,"longitude":104.0771}','[{"latitude":49.0428,"longitude":104.0618},{"latitude":49.0472,"longitude":104.0691},{"latitude":49.0504,"longitude":104.0771},{"latitude":49.0549,"longitude":104.0856}]')
on conflict (id) do nothing;

insert into public.login_slides (id, eyebrow, title_before, accent, title_after, subtitle, media_type, media_url, media_name, sort_order)
values
  ('default-challenges','ЧЭЛЛЕНЖ','Зорилгоо ','чэлленжээр',E'\nэхлүүлээрэй','Сонирхолтой чэлленжид нэгдэж, ахиц бүрээ тэмдэглэн шинэ амжилтад хүрээрэй.','image','https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1400&q=85','runboost-challenge.jpg',0),
  ('default-routes','ГҮЙЛТИЙН ЗАМ','Хотын шилдэг ','маршрутаа',E'\nсонгоорой','Ойр орчмын гүйлтийн замуудыг нээж, зай болон түвшиндээ тохирох маршрутаар гүйгээрэй.','image','https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1400&q=85','runboost-routes.jpg',1),
  ('default-community','RUNBOOST НИЙГЭМЛЭГ','Гүйгчидтэй ','нэгдэж',E'\nгүйлтээ хуваалц','Өөрийн гүйлтээ постолж, бусдын амжилтаас урам авч, хамтдаа илүү хол гүйцгээе.','image','https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1400&q=85','runboost-community.jpg',2)
on conflict (id) do nothing;
