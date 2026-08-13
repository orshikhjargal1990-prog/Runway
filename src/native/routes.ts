export type Point = {
  latitude: number;
  longitude: number;
};

export type RouteOption = {
  id: string;
  title: string;
  city: 'ulaanbaatar' | 'darkhan' | 'erdenet';
  area: string;
  distanceKm: number;
  liveRunners: number;
  elevationM: number;
  avgPace: string;
  difficulty: string;
  estimatedDuration: string;
  recentActivities: number;
  image: string;
  center: Point;
  coordinates: Point[];
};

export const RUN_ROUTES: RouteOption[] = [
  {
    id: 'sukhbaatar',
    title: 'Сүхбаатарын талбай',
    city: 'ulaanbaatar',
    area: 'Төв талбайн loop',
    distanceKm: 3.2,
    liveRunners: 32,
    elevationM: 18,
    avgPace: '5:10 /км',
    difficulty: 'Easy',
    estimatedDuration: '0h 18m',
    recentActivities: 96,
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&q=80',
    center: { latitude: 47.9187, longitude: 106.9176 },
    coordinates: [
      { latitude: 47.9195, longitude: 106.9142 },
      { latitude: 47.9204, longitude: 106.9174 },
      { latitude: 47.9187, longitude: 106.9208 },
      { latitude: 47.9167, longitude: 106.9194 },
      { latitude: 47.9174, longitude: 106.9156 },
      { latitude: 47.9195, longitude: 106.9142 }
    ]
  },
  {
    id: 'garden',
    title: 'Үндэсний цэцэрлэгт хүрээлэн',
    city: 'ulaanbaatar',
    area: 'Баянзүрх',
    distanceKm: 5.8,
    liveRunners: 124,
    elevationM: 42,
    avgPace: '5:45 /км',
    difficulty: 'Medium',
    estimatedDuration: '0h 34m',
    recentActivities: 122,
    image: 'https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=900&q=80',
    center: { latitude: 47.9038, longitude: 106.9435 },
    coordinates: [
      { latitude: 47.9074, longitude: 106.9359 },
      { latitude: 47.9092, longitude: 106.9438 },
      { latitude: 47.9051, longitude: 106.9511 },
      { latitude: 47.8996, longitude: 106.9483 },
      { latitude: 47.9007, longitude: 106.9384 },
      { latitude: 47.9074, longitude: 106.9359 }
    ]
  },
  {
    id: 'zaisan',
    title: 'Зайсан өгсүүр',
    city: 'ulaanbaatar',
    area: 'Hill climb',
    distanceKm: 4.4,
    liveRunners: 18,
    elevationM: 126,
    avgPace: '6:20 /км',
    difficulty: 'Hard',
    estimatedDuration: '0h 28m',
    recentActivities: 81,
    image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=900&q=80',
    center: { latitude: 47.8876, longitude: 106.9159 },
    coordinates: [
      { latitude: 47.8948, longitude: 106.9078 },
      { latitude: 47.8912, longitude: 106.9124 },
      { latitude: 47.8879, longitude: 106.9149 },
      { latitude: 47.8848, longitude: 106.9187 },
      { latitude: 47.8818, longitude: 106.9226 }
    ]
  },
  {
    id: 'tuul-river',
    title: 'Туул голын tempo',
    city: 'ulaanbaatar',
    area: 'Riverside',
    distanceKm: 6.4,
    liveRunners: 47,
    elevationM: 24,
    avgPace: '5:35 /км',
    difficulty: 'Medium',
    estimatedDuration: '0h 40m',
    recentActivities: 74,
    image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=900&q=80',
    center: { latitude: 47.8984, longitude: 106.8837 },
    coordinates: [
      { latitude: 47.9008, longitude: 106.8752 },
      { latitude: 47.8994, longitude: 106.8819 },
      { latitude: 47.8972, longitude: 106.8876 },
      { latitude: 47.8959, longitude: 106.8941 }
    ]
  },
  {
    id: 'national-park-10k',
    title: 'Үндэсний парк 10K',
    city: 'ulaanbaatar',
    area: 'Үндэсний парк · урт loop',
    distanceKm: 10,
    liveRunners: 86,
    elevationM: 48,
    avgPace: '5:38 /км',
    difficulty: 'Medium',
    estimatedDuration: '0h 56m',
    recentActivities: 318,
    image: 'https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=900&q=80',
    center: { latitude: 47.9015, longitude: 106.9461 },
    coordinates: [
      { latitude: 47.9074, longitude: 106.9359 },
      { latitude: 47.9093, longitude: 106.9421 },
      { latitude: 47.9081, longitude: 106.9507 },
      { latitude: 47.9044, longitude: 106.9552 },
      { latitude: 47.8988, longitude: 106.9531 },
      { latitude: 47.8957, longitude: 106.9464 },
      { latitude: 47.8982, longitude: 106.9380 },
      { latitude: 47.9031, longitude: 106.9345 },
      { latitude: 47.9074, longitude: 106.9359 }
    ]
  },
  {
    id: 'misheel-tuul-loop',
    title: 'Мишээл · Туулын loop',
    city: 'ulaanbaatar',
    area: 'Хан-Уул · голын эрэг',
    distanceKm: 8.2,
    liveRunners: 63,
    elevationM: 31,
    avgPace: '5:42 /км',
    difficulty: 'Easy',
    estimatedDuration: '0h 47m',
    recentActivities: 246,
    image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=900&q=80',
    center: { latitude: 47.8914, longitude: 106.8895 },
    coordinates: [
      { latitude: 47.8947, longitude: 106.8758 },
      { latitude: 47.8950, longitude: 106.8831 },
      { latitude: 47.8930, longitude: 106.8910 },
      { latitude: 47.8902, longitude: 106.8990 },
      { latitude: 47.8874, longitude: 106.8962 },
      { latitude: 47.8888, longitude: 106.8873 },
      { latitude: 47.8912, longitude: 106.8792 },
      { latitude: 47.8947, longitude: 106.8758 }
    ]
  },
  {
    id: 'yarmag-riverside',
    title: 'Яармагийн голын зам',
    city: 'ulaanbaatar',
    area: 'Яармаг · Riverside',
    distanceKm: 7.6,
    liveRunners: 51,
    elevationM: 27,
    avgPace: '5:50 /км',
    difficulty: 'Easy',
    estimatedDuration: '0h 45m',
    recentActivities: 204,
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&q=80',
    center: { latitude: 47.8757, longitude: 106.8380 },
    coordinates: [
      { latitude: 47.8790, longitude: 106.8232 },
      { latitude: 47.8782, longitude: 106.8317 },
      { latitude: 47.8760, longitude: 106.8401 },
      { latitude: 47.8737, longitude: 106.8494 },
      { latitude: 47.8719, longitude: 106.8460 },
      { latitude: 47.8737, longitude: 106.8367 },
      { latitude: 47.8758, longitude: 106.8276 },
      { latitude: 47.8790, longitude: 106.8232 }
    ]
  },
  {
    id: 'bogd-khan-trail',
    title: 'Богд хан уулын trail',
    city: 'ulaanbaatar',
    area: 'Зайсан · Дугуй цагаан',
    distanceKm: 11.8,
    liveRunners: 29,
    elevationM: 412,
    avgPace: '7:15 /км',
    difficulty: 'Hard',
    estimatedDuration: '1h 26m',
    recentActivities: 178,
    image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=900&q=80',
    center: { latitude: 47.8618, longitude: 106.9166 },
    coordinates: [
      { latitude: 47.8817, longitude: 106.9225 },
      { latitude: 47.8758, longitude: 106.9201 },
      { latitude: 47.8696, longitude: 106.9165 },
      { latitude: 47.8627, longitude: 106.9130 },
      { latitude: 47.8558, longitude: 106.9092 },
      { latitude: 47.8493, longitude: 106.9128 },
      { latitude: 47.8548, longitude: 106.9190 },
      { latitude: 47.8619, longitude: 106.9226 }
    ]
  },
  {
    id: 'darkhan-park',
    title: 'Дархан парк loop',
    city: 'darkhan',
    area: 'Шинэ Дархан',
    distanceKm: 4.9,
    liveRunners: 28,
    elevationM: 16,
    avgPace: '5:30 /км',
    difficulty: 'Easy',
    estimatedDuration: '0h 29m',
    recentActivities: 63,
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900&q=80',
    center: { latitude: 49.4867, longitude: 105.9228 },
    coordinates: [
      { latitude: 49.4891, longitude: 105.9178 },
      { latitude: 49.4904, longitude: 105.9239 },
      { latitude: 49.4867, longitude: 105.9284 },
      { latitude: 49.4835, longitude: 105.9246 },
      { latitude: 49.4849, longitude: 105.9185 },
      { latitude: 49.4891, longitude: 105.9178 }
    ]
  },
  {
    id: 'darkhan-riverside',
    title: 'Хараа голын зам',
    city: 'darkhan',
    area: 'Riverside',
    distanceKm: 7.2,
    liveRunners: 19,
    elevationM: 22,
    avgPace: '5:55 /км',
    difficulty: 'Medium',
    estimatedDuration: '0h 43m',
    recentActivities: 41,
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900&q=80',
    center: { latitude: 49.4647, longitude: 105.9655 },
    coordinates: [
      { latitude: 49.4686, longitude: 105.9554 },
      { latitude: 49.4661, longitude: 105.9612 },
      { latitude: 49.4639, longitude: 105.9678 },
      { latitude: 49.4614, longitude: 105.9739 }
    ]
  },
  {
    id: 'erdenet-park',
    title: 'Эрдэнэт төв парк',
    city: 'erdenet',
    area: 'Төвийн бүс',
    distanceKm: 5.1,
    liveRunners: 36,
    elevationM: 35,
    avgPace: '5:40 /км',
    difficulty: 'Easy',
    estimatedDuration: '0h 31m',
    recentActivities: 68,
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900&q=80',
    center: { latitude: 49.0275, longitude: 104.0446 },
    coordinates: [
      { latitude: 49.0301, longitude: 104.0398 },
      { latitude: 49.0312, longitude: 104.0452 },
      { latitude: 49.0276, longitude: 104.0499 },
      { latitude: 49.0244, longitude: 104.0461 },
      { latitude: 49.0253, longitude: 104.0406 },
      { latitude: 49.0301, longitude: 104.0398 }
    ]
  },
  {
    id: 'erdenet-hill',
    title: 'Уурхайчны өгсүүр',
    city: 'erdenet',
    area: 'Hill route',
    distanceKm: 8.4,
    liveRunners: 14,
    elevationM: 148,
    avgPace: '6:35 /км',
    difficulty: 'Hard',
    estimatedDuration: '0h 56m',
    recentActivities: 29,
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900&q=80',
    center: { latitude: 49.0504, longitude: 104.0771 },
    coordinates: [
      { latitude: 49.0428, longitude: 104.0618 },
      { latitude: 49.0472, longitude: 104.0691 },
      { latitude: 49.0504, longitude: 104.0771 },
      { latitude: 49.0549, longitude: 104.0856 }
    ]
  }
];
