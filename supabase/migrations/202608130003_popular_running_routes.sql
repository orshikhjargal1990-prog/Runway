insert into public.routes (
  id, title, city, area, distance_km, live_runners, elevation_m, avg_pace,
  difficulty, estimated_duration, recent_activities, image_url, center, coordinates
) values
  ('national-park-10k','Үндэсний парк 10K','ulaanbaatar','Үндэсний парк · урт loop',10,86,48,'5:38 /км','Medium','0h 56m',318,'https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=900&q=80','{"latitude":47.9015,"longitude":106.9461}','[{"latitude":47.9074,"longitude":106.9359},{"latitude":47.9093,"longitude":106.9421},{"latitude":47.9081,"longitude":106.9507},{"latitude":47.9044,"longitude":106.9552},{"latitude":47.8988,"longitude":106.9531},{"latitude":47.8957,"longitude":106.9464},{"latitude":47.8982,"longitude":106.9380},{"latitude":47.9031,"longitude":106.9345},{"latitude":47.9074,"longitude":106.9359}]'),
  ('misheel-tuul-loop','Мишээл · Туулын loop','ulaanbaatar','Хан-Уул · голын эрэг',8.2,63,31,'5:42 /км','Easy','0h 47m',246,'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=900&q=80','{"latitude":47.8914,"longitude":106.8895}','[{"latitude":47.8947,"longitude":106.8758},{"latitude":47.8950,"longitude":106.8831},{"latitude":47.8930,"longitude":106.8910},{"latitude":47.8902,"longitude":106.8990},{"latitude":47.8874,"longitude":106.8962},{"latitude":47.8888,"longitude":106.8873},{"latitude":47.8912,"longitude":106.8792},{"latitude":47.8947,"longitude":106.8758}]'),
  ('yarmag-riverside','Яармагийн голын зам','ulaanbaatar','Яармаг · Riverside',7.6,51,27,'5:50 /км','Easy','0h 45m',204,'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&q=80','{"latitude":47.8757,"longitude":106.8380}','[{"latitude":47.8790,"longitude":106.8232},{"latitude":47.8782,"longitude":106.8317},{"latitude":47.8760,"longitude":106.8401},{"latitude":47.8737,"longitude":106.8494},{"latitude":47.8719,"longitude":106.8460},{"latitude":47.8737,"longitude":106.8367},{"latitude":47.8758,"longitude":106.8276},{"latitude":47.8790,"longitude":106.8232}]'),
  ('bogd-khan-trail','Богд хан уулын trail','ulaanbaatar','Зайсан · Дугуй цагаан',11.8,29,412,'7:15 /км','Hard','1h 26m',178,'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=900&q=80','{"latitude":47.8618,"longitude":106.9166}','[{"latitude":47.8817,"longitude":106.9225},{"latitude":47.8758,"longitude":106.9201},{"latitude":47.8696,"longitude":106.9165},{"latitude":47.8627,"longitude":106.9130},{"latitude":47.8558,"longitude":106.9092},{"latitude":47.8493,"longitude":106.9128},{"latitude":47.8548,"longitude":106.9190},{"latitude":47.8619,"longitude":106.9226}]')
on conflict (id) do update set
  title = excluded.title,
  city = excluded.city,
  area = excluded.area,
  distance_km = excluded.distance_km,
  live_runners = excluded.live_runners,
  elevation_m = excluded.elevation_m,
  avg_pace = excluded.avg_pace,
  difficulty = excluded.difficulty,
  estimated_duration = excluded.estimated_duration,
  recent_activities = excluded.recent_activities,
  image_url = excluded.image_url,
  center = excluded.center,
  coordinates = excluded.coordinates,
  enabled = true,
  updated_at = now();
