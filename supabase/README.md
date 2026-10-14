# Runboost Supabase setup

1. Supabase Dashboard-ийн **SQL Editor** хэсэгт `migrations` хавтасны SQL
   файлуудыг нэрийн дарааллаар ажиллуулна.
2. Шинэ хэрэглэгч бүртгүүлэхэд имэйл баталгаажуулалт шаардахгүй болгохын тулд
   Supabase Dashboard -> **Authentication** -> **Providers** -> **Email** хэсэгт
   **Confirm email** тохиргоог унтраана.
3. Админ хэрэглэгчээ эхлээд Auth хэсэгт бүртгээд, дараах SQL-ийн имэйлийг
   өөрийн админ имэйлээр солиод нэг удаа ажиллуулна.

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'admin@vision.mn';
```

4. Админ хэрэглэгч дахин нэвтэрсний дараа JWT шинэчлэгдэж, `/admin` дээрээс
   нэвтрэх слайдын текст болон зураг/видеог Supabase-д хадгална.

Frontend-д зөвхөн `EXPO_PUBLIC_SUPABASE_URL` болон publishable key ашиглана.
`service_role` key-г аппын код, `.env`, browser эсвэл mobile bundle-д хийж болохгүй.
