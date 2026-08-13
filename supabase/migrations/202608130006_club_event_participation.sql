alter table public.club_events add column if not exists description text not null default '';
alter table public.club_events add column if not exists advice jsonb not null default '[]'::jsonb;
alter table public.club_events add column if not exists participant_count integer not null default 0;

create table if not exists public.club_event_members (
  event_id text not null references public.club_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.club_event_members enable row level security;
create policy "event participation is readable" on public.club_event_members for select using (true);
create policy "users join club events" on public.club_event_members for insert with check (auth.uid() = user_id);
create policy "users leave club events" on public.club_event_members for delete using (auth.uid() = user_id);

update public.club_events set
  description = case id
    when 'event-sunrise' then 'Хотын төвөөр тайван хэмнэлтэй 5 км хамтын гүйлт. Бүх түвшний гүйгчдэд нээлттэй.'
    when 'event-trail' then 'Богд хан уулын шороон замаар өгсүүр, уруудалт хосолсон trail гүйлт.'
    when 'event-tempo' then 'Темпээ сайжруулах зорилготой халаалт, үндсэн 6 км, тайвшруулах гүйлтийн бэлтгэл.'
    else 'Клубын гишүүд болон сонирхогч гүйгчдэд зориулсан нээлттэй хамтын гүйлт.' end,
  advice = '["15 минутын өмнө ирж бүртгүүлээрэй.","Ус болон цаг агаарт тохирсон хувцас авчирна уу.","Өөрийн биед тохирсон хэмнэлээр гүйгээрэй."]'::jsonb,
  participant_count = case id when 'event-sunrise' then 68 when 'event-trail' then 42 when 'event-tempo' then 51 else 73 end;
