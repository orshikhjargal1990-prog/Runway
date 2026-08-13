create table if not exists public.club_media (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.running_clubs(id) on delete cascade,
  storage_path text,
  public_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.club_media enable row level security;
create policy "club media is readable" on public.club_media for select using (true);
create policy "admins manage club media" on public.club_media for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('club-media', 'club-media', true)
on conflict (id) do update set public = true;

create policy "public reads club media" on storage.objects for select using (bucket_id = 'club-media');
create policy "admins upload club media" on storage.objects for insert to authenticated with check (bucket_id = 'club-media' and public.is_admin());
create policy "admins update club media" on storage.objects for update to authenticated using (bucket_id = 'club-media' and public.is_admin()) with check (bucket_id = 'club-media' and public.is_admin());
create policy "admins delete club media" on storage.objects for delete to authenticated using (bucket_id = 'club-media' and public.is_admin());

insert into public.club_media (club_id, public_url, sort_order)
select id, image_url, 0 from public.running_clubs
where not exists (select 1 from public.club_media where club_id = running_clubs.id);
