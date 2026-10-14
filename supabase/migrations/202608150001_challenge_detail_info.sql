alter table public.challenges
  add column if not exists description text,
  add column if not exists registration_info text,
  add column if not exists organizer_info text,
  add column if not exists reward_info text;

update public.challenges
set
  description = coalesce(description, 'Өглөөний богино гүйлтээр идэвхтэй амьдралыг дэмжих community challenge.'),
  registration_info = coalesce(registration_info, 'Бүртгэл дуусахаас өмнө challenge-д нэгдээд гүйлтээ эхлүүлнэ.'),
  organizer_info = coalesce(organizer_info, 'Coffee Bean нь хотын өглөөний хөдөлгөөн, найзуудтайгаа хамт гүйх соёлыг дэмждэг кофе брэнд.'),
  reward_info = coalesce(reward_info, '25 км зорилгоо биелүүлсэн оролцогчдод free latte эрх, finisher badge болон partner coupon олгоно.')
where id = 'happy-coffee';

update public.challenges
set
  description = coalesce(description, 'Хаврын улирлыг 100 км-ийн хуримтлуулдаг гүйлтээр эхлүүлэх community challenge.'),
  registration_info = coalesce(registration_info, 'Бүртгэл нээлттэй хугацаанд challenge-д нэгдээд гүйлт бүрээ ахицад нэмнэ.'),
  organizer_info = coalesce(organizer_info, 'RunSync Community нь сонирхогч гүйгчдийг тогтмол хөдөлгөөн, эерэг өрсөлдөөнөөр нэгтгэдэг клуб.'),
  reward_info = coalesce(reward_info, 'Зорилгоо дүүргэсэн гүйгчдэд digital certificate, profile badge болон leaderboard recognition нэмэгдэнэ.')
where id = 'happy-spring';

update public.challenges
set
  description = coalesce(description, 'Байгууллагын ажилтнуудын эрүүл амьдрал, багийн идэвхийг дэмжих corporate challenge.'),
  registration_info = coalesce(registration_info, 'Байгууллагын бүртгэлтэй оролцогчид challenge-д нэгдээд гүйлтээ хуримтлуулна.'),
  organizer_info = coalesce(organizer_info, 'Unitel Group ажилтнууд болон running community-д зориулан эрүүл хэв маягийг дэмжих challenge зохион байгуулж байна.'),
  reward_info = coalesce(reward_info, '50 км зорилго биелүүлсэн оролцогчдод digital certificate, leaderboard badge болон байгууллагын дотоод урамшуулал олгоно.')
where id = 'corp-unitel';

update public.challenges
set
  description = coalesce(description, 'Ажилтнуудын өдөр тутмын алхам, гүйлтийн идэвхийг нэмэх богино хугацааны challenge.'),
  registration_info = coalesce(registration_info, 'Бүртгүүлсэн оролцогч бүр гүйлтээ challenge ахицад нэмэх боломжтой.'),
  organizer_info = coalesce(organizer_info, 'MCS Group нь ажилтнуудын эрүүл мэнд, багийн оролцоог дэмжих дотоод хөтөлбөрийн хүрээнд зохион байгуулж байна.'),
  reward_info = coalesce(reward_info, '20 км зорилгоо биелүүлсэн оролцогчдод finisher badge, багийн leaderboard оноо болон дотоод шагнал нэмэгдэнэ.')
where id = 'corp-mcs';
