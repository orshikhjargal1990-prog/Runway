export type RunningClub = {
  id: string;
  name: string;
  city: string;
  description: string;
  image: string;
  memberCount: number;
  weeklyKm: number;
  totalKm: number;
  rank: number;
  meetingInfo: string;
  galleryImages: string[];
  joined?: boolean;
};

export type ClubEvent = {
  id: string;
  clubId: string;
  clubName: string;
  title: string;
  location: string;
  startsAt: string;
  distanceKm?: number;
  image: string;
  description: string;
  advice: string[];
  participantCount: number;
};

const clubImages = [
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1000&q=80',
  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1000&q=80',
  'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1000&q=80',
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1000&q=80',
  'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=1000&q=80'
];

const clubSeeds = [
  ['Ulaanbaatar Runners', 'Улаанбаатар', 842, 3680],
  ['Nomad Trail Club', 'Улаанбаатар', 624, 3120],
  ['Pace Makers Mongolia', 'Улаанбаатар', 518, 2864],
  ['Darkhan Road Runners', 'Дархан', 407, 2410],
  ['Erdenet Running Crew', 'Эрдэнэт', 385, 2186],
  ['Sunrise Striders', 'Улаанбаатар', 342, 1984],
  ['Tuul River Runners', 'Улаанбаатар', 298, 1756],
  ['Zaisan Hill Club', 'Улаанбаатар', 264, 1620],
  ['Weekend 5K', 'Улаанбаатар', 221, 1488],
  ['Run Girls Mongolia', 'Улаанбаатар', 196, 1324]
] as const;

export const DEFAULT_RUNNING_CLUBS: RunningClub[] = clubSeeds.map((club, index) => ({
  id: `club-${index + 1}`,
  name: club[0],
  city: club[1],
  memberCount: club[2],
  weeklyKm: club[3],
  totalKm: club[2] * (84 + index * 7),
  rank: index + 1,
  description: 'Хамтдаа тогтмол гүйж, хотын шинэ маршрутуудыг нээн, гишүүдийнхээ амжилтыг дэмждэг нээлттэй гүйлтийн клуб.',
  image: clubImages[index % clubImages.length],
  meetingInfo: index % 2 === 0 ? 'Бямба бүр 07:30 · Сүхбаатарын талбай' : 'Ням бүр 08:00 · Үндэсний цэцэрлэгт хүрээлэн',
  galleryImages: [
    clubImages[index % clubImages.length],
    clubImages[(index + 1) % clubImages.length],
    clubImages[(index + 2) % clubImages.length]
  ],
  joined: false
}));

export const DEFAULT_CLUB_EVENTS: ClubEvent[] = [
  { id: 'event-sunrise', clubId: 'club-1', clubName: 'Ulaanbaatar Runners', title: 'Sunrise Social Run', location: 'Сүхбаатарын талбай', startsAt: '2026-08-15T07:30:00+08:00', distanceKm: 5, image: clubImages[0], description: 'Хотын төвөөр тайван хэмнэлтэй 5 км хамтын гүйлт. Бүх түвшний гүйгчдэд нээлттэй.', advice: ['15 минутын өмнө ирж бүртгүүлээрэй.', 'Ус болон цаг агаарт тохирсон хувцас авчирна уу.', 'Өөрийн биед тохирсон хэмнэлээр гүйгээрэй.'], participantCount: 68 },
  { id: 'event-trail', clubId: 'club-2', clubName: 'Nomad Trail Club', title: 'Богд хан уулын trail', location: 'Зайсангийн ам', startsAt: '2026-08-16T08:00:00+08:00', distanceKm: 12, image: clubImages[1], description: 'Богд хан уулын шороон замаар өгсүүр, уруудалт хосолсон trail гүйлт.', advice: ['Trail ултай гутал өмсөнө үү.', '500 мл-ээс багагүй ус авчирна уу.', 'Анхны тусламжийн жижиг хэрэгсэлтэй байхыг зөвлөж байна.'], participantCount: 42 },
  { id: 'event-tempo', clubId: 'club-3', clubName: 'Pace Makers Mongolia', title: 'Tempo Thursday', location: 'Үндэсний цэцэрлэгт хүрээлэн', startsAt: '2026-08-20T19:00:00+08:00', distanceKm: 8, image: clubImages[2], description: 'Темпээ сайжруулах зорилготой халаалт, үндсэн 6 км, тайвшруулах гүйлтийн бэлтгэл.', advice: ['Гүйлтээс 2 цагийн өмнө хөнгөн хооллоорой.', 'GPS цаг эсвэл аппын tracking-аа бэлдэнэ үү.', 'Бэлтгэлийн өмнө сайн халаалт хийгээрэй.'], participantCount: 51 },
  { id: 'event-darkhan', clubId: 'club-4', clubName: 'Darkhan Road Runners', title: 'Darkhan Community 10K', location: 'Шинэ Дархан парк', startsAt: '2026-08-22T08:30:00+08:00', distanceKm: 10, image: clubImages[3], description: 'Дархан хотын гүйгчдийн нээлттэй 10 км community run.', advice: ['Дугаараа эхлэхээс 20 минутын өмнө авна уу.', 'Замын хөдөлгөөний зааврыг дагана уу.', 'Нарны хамгаалалт болон ус бэлдээрэй.'], participantCount: 73 }
];
