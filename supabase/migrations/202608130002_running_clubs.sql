create table if not exists public.running_clubs (
  id text primary key,
  name text not null,
  city text not null,
  description text not null default '',
  image_url text not null,
  member_count integer not null default 0,
  weekly_km numeric not null default 0,
  rank integer not null,
  meeting_info text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id text not null references public.running_clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table if not exists public.club_events (
  id text primary key,
  club_id text not null references public.running_clubs(id) on delete cascade,
  title text not null,
  location text not null,
  starts_at timestamptz not null,
  distance_km numeric,
  image_url text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.running_clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_events enable row level security;

create policy "enabled clubs are readable" on public.running_clubs for select using (enabled or public.is_admin());
create policy "admins manage clubs" on public.running_clubs for all using (public.is_admin()) with check (public.is_admin());
create policy "club memberships are readable" on public.club_members for select using (true);
create policy "users join clubs" on public.club_members for insert with check (auth.uid() = user_id);
create policy "users leave clubs" on public.club_members for delete using (auth.uid() = user_id);
create policy "enabled club events are readable" on public.club_events for select using (enabled or public.is_admin());
create policy "admins manage club events" on public.club_events for all using (public.is_admin()) with check (public.is_admin());

insert into public.running_clubs (id,name,city,description,image_url,member_count,weekly_km,rank,meeting_info) values
('club-1','Ulaanbaatar Runners','Улаанбаатар','Хотын бүх түвшний гүйгчдэд нээлттэй, долоо хоног бүр хамтын гүйлт зохион байгуулдаг клуб.','https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1000&q=80',842,3680,1,'Бямба бүр 07:30 · Сүхбаатарын талбай'),
('club-2','Nomad Trail Club','Улаанбаатар','Уул, trail маршрутаар гүйх дуртай гүйгчдийн нээлттэй клуб.','https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1000&q=80',624,3120,2,'Ням бүр 08:00 · Зайсангийн ам'),
('club-3','Pace Makers Mongolia','Улаанбаатар','Темп, интервал болон уралдааны бэлтгэлд төвлөрсөн performance клуб.','https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1000&q=80',518,2864,3,'Пүрэв бүр 19:00 · Үндэсний парк'),
('club-4','Darkhan Road Runners','Дархан','Дархан хотын road running нийгэмлэг.','https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1000&q=80',407,2410,4,'Бямба бүр 08:00 · Шинэ Дархан парк'),
('club-5','Erdenet Running Crew','Эрдэнэт','Эрдэнэт хотын бүх түвшний гүйгчдийн хамтын crew.','https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=1000&q=80',385,2186,5,'Ням бүр 08:00 · Төв парк'),
('club-6','Sunrise Striders','Улаанбаатар','Өглөө эрт гүйдэг хүмүүсийн эерэг community.','https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1000&q=80',342,1984,6,'Лхагва бүр 06:30 · Төв талбай'),
('club-7','Tuul River Runners','Улаанбаатар','Туул голын дагуух урт, темп гүйлтийн клуб.','https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1000&q=80',298,1756,7,'Бямба бүр 07:00 · Маршалын гүүр'),
('club-8','Zaisan Hill Club','Улаанбаатар','Өгсүүр болон hill repeat бэлтгэлийн клуб.','https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1000&q=80',264,1620,8,'Мягмар бүр 19:00 · Зайсан'),
('club-9','Weekend 5K','Улаанбаатар','Амралтын өдрийн тайван 5 км social run.','https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1000&q=80',221,1488,9,'Бямба бүр 09:00 · Үндэсний парк'),
('club-10','Run Girls Mongolia','Улаанбаатар','Эмэгтэй гүйгчдийг дэмждэг нээлттэй community.','https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=1000&q=80',196,1324,10,'Ням бүр 09:00 · Төв талбай')
on conflict (id) do nothing;

insert into public.club_events (id,club_id,title,location,starts_at,distance_km,image_url) values
('event-sunrise','club-1','Sunrise Social Run','Сүхбаатарын талбай','2026-08-15T07:30:00+08:00',5,'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1000&q=80'),
('event-trail','club-2','Богд хан уулын trail','Зайсангийн ам','2026-08-16T08:00:00+08:00',12,'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1000&q=80'),
('event-tempo','club-3','Tempo Thursday','Үндэсний цэцэрлэгт хүрээлэн','2026-08-20T19:00:00+08:00',8,'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1000&q=80'),
('event-darkhan','club-4','Darkhan Community 10K','Шинэ Дархан парк','2026-08-22T08:30:00+08:00',10,'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1000&q=80')
on conflict (id) do nothing;
