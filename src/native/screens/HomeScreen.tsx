import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, ImageBackground, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { Challenge, Post, Runner } from '../types';
import { colors, radius } from '../theme';
import { PostCard } from '../components/PostCard';
import type { RouteOption } from '../routes';
import type { ClubEvent, RunningClub } from '../clubs';

type Props = {
  posts: Post[];
  currentUserId: string | null;
  challenges: Challenge[];
  routes: RouteOption[];
  clubs: RunningClub[];
  clubEvents: ClubEvent[];
  joinedClubEventIds: string[];
  runners: Runner[];
  followedRunnerIds: string[];
  joinedChallengeIds: string[];
  onOpenComposer: () => void;
  onOpenChallenge: (challenge: Challenge) => void;
  onRegisterChallenge: (challenge: Challenge) => void;
  onOpenRoute: (routeId: string) => void;
  onToggleClubMembership: (club: RunningClub) => boolean | Promise<boolean>;
  onToggleClubEventParticipation: (event: ClubEvent) => void;
  onToggleFollow: (runnerId: string) => void;
  onRemoveRunner: (runnerId: string) => void;
  onPostSocialChange: (postId: string, patch: Partial<Pick<Post, 'likeCount' | 'commentCount' | 'likedByMe' | 'isFollowing'>>) => void;
};

type ProfilePreview = Runner & {
  postCount?: number;
  latestPostTitle?: string;
};

type WeatherInfo = {
  aqi: number | null;
  condition: string;
  dateLabel: string;
  humidity: number;
  isFallbackLocation: boolean;
  note: string;
  temperature: number;
  updatedAt: string;
  windSpeed: number;
};

type RunnerWeeklyRun = {
  id: string;
  label: string;
  dateLabel: string;
  distanceKm: number;
  duration: string;
  pace: string;
  calories: number;
  routeTitle: string;
  routeArea: string;
  image: string;
  completedAt: string;
};

type AchievementCategory =
  | 'distance'
  | 'streak'
  | 'club'
  | 'speed'
  | 'special'
  | 'discovery'
  | 'mongolia'
  | 'ultimate';

type Achievement = {
  id: string;
  category: AchievementCategory;
  icon: string;
  title: string;
  description: string;
  reward: string;
  progress: number;
  unlocked: boolean;
  newlyUnlocked?: boolean;
};

type WeatherMood = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm';
type RouteCity = RouteOption['city'];

const ULAANBAATAR_COORDINATES = {
  latitude: 47.9189,
  longitude: 106.9177
};

const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const scrollHintColors = ['rgba(35,45,53,0)', 'rgba(35,45,53,0.18)', 'rgba(35,45,53,0.42)'] as const;
const scrollHintStart = { x: 0, y: 0 };
const scrollHintEnd = { x: 1, y: 0 };
const marathonMedalImage = 'https://cdn-icons-png.flaticon.com/512/2583/2583344.png';

function getSeedValue(value: string) {
  return value.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function pickProfileItems<T>(items: T[], seed: string, count: number) {
  if (!items.length) return [];
  const offset = getSeedValue(seed) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)].slice(0, count);
}

function buildRunnerWeeklyRuns(runner: ProfilePreview | null, routes: RouteOption[]): RunnerWeeklyRun[] {
  if (!runner) return [];
  const seed = getSeedValue(runner.id);
  const labels = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];
  const fallbackRoute = routes[0];
  const today = new Date();

  return labels.map((label, index) => {
    const route = routes.length ? routes[(seed + index) % routes.length] : fallbackRoute;
    const distanceKm = Number((2.6 + ((seed + index * 17) % 58) / 10).toFixed(1));
    const durationMinutes = Math.round(distanceKm * (5.2 + ((seed + index) % 18) / 10));
    const paceMinutes = Math.floor(durationMinutes / distanceKm);
    const paceSeconds = Math.round(((durationMinutes / distanceKm) - paceMinutes) * 60);
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      id: `${runner.id}-week-${index}`,
      label,
      dateLabel: date.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric', weekday: 'long' }),
      distanceKm,
      duration: `${Math.floor(durationMinutes / 60)}ц ${String(durationMinutes % 60).padStart(2, '0')}м`,
      pace: `${paceMinutes}:${String(paceSeconds).padStart(2, '0')} /км`,
      calories: Math.round(distanceKm * 62),
      routeTitle: route?.title ?? 'Өөрийн маршрут',
      routeArea: route?.area ?? 'GPS зам',
      image: route?.image ?? runner.avatar,
      completedAt: date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
    };
  });
}
const weatherClearGradient = ['rgba(9,40,64,0.96)', 'rgba(8,76,62,0.88)', 'rgba(5,11,26,0.96)'] as const;
const weatherCloudGradient = ['rgba(30,41,59,0.98)', 'rgba(15,31,52,0.94)', 'rgba(5,11,26,0.96)'] as const;
const weatherRainGradient = ['rgba(15,23,42,0.98)', 'rgba(12,74,110,0.74)', 'rgba(5,11,26,0.98)'] as const;
const weatherSnowGradient = ['rgba(51,65,85,0.9)', 'rgba(14,116,144,0.54)', 'rgba(5,11,26,0.96)'] as const;
const routeCardWidth = 264;
const routeCardGap = 14;
const routeSnapInterval = routeCardWidth + routeCardGap;
const routeCityFilters: { key: RouteCity; label: string }[] = [
  { key: 'ulaanbaatar', label: 'Улаанбаатар' },
  { key: 'darkhan', label: 'Дархан' },
  { key: 'erdenet', label: 'Эрдэнэт' }
];

function formatClubEventDate(value: string) {
  return new Date(value).toLocaleString('mn-MN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getEventRegistrationCountdown(value: string) {
  const registrationEndsAt = new Date(value).getTime() - 60 * 60 * 1000;
  const remainingSeconds = Math.max(0, Math.floor((registrationEndsAt - Date.now()) / 1000));
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);

  if (remainingSeconds <= 0) {
    return 'Бүртгэл хаагдсан';
  }

  if (days > 0) {
    return `${days} өдөр ${hours} цаг`;
  }

  return `${hours} цаг ${minutes} мин`;
}

const ACHIEVEMENT_CATEGORIES: { key: AchievementCategory; label: string }[] = [
  { key: 'distance', label: 'Зай' },
  { key: 'streak', label: 'Дараалал' },
  { key: 'club', label: 'Клуб' },
  { key: 'speed', label: 'Хурд' },
  { key: 'special', label: 'Онцгой' },
  { key: 'discovery', label: 'Маршрут' },
  { key: 'mongolia', label: 'Монгол' },
  { key: 'ultimate', label: 'Домог' }
];

const ACHIEVEMENT_THEME: Record<AchievementCategory, { color: string; muted: string; trophy: string }> = {
  distance: { color: '#39FF88', muted: 'rgba(57,255,136,0.15)', trophy: '🏆' },
  streak: { color: '#B6FF2E', muted: 'rgba(182,255,46,0.14)', trophy: '🔥' },
  club: { color: '#06B6D4', muted: 'rgba(6,182,212,0.14)', trophy: '🏅' },
  speed: { color: '#F59E0B', muted: 'rgba(245,158,11,0.16)', trophy: '⚡' },
  special: { color: '#EC4899', muted: 'rgba(236,72,153,0.14)', trophy: '✦' },
  discovery: { color: '#14B8A6', muted: 'rgba(20,184,166,0.14)', trophy: '🧭' },
  mongolia: { color: '#EF4444', muted: 'rgba(239,68,68,0.13)', trophy: '⛰' },
  ultimate: { color: '#EAB308', muted: 'rgba(234,179,8,0.16)', trophy: '★' }
};

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-step', category: 'distance', icon: '⌁', title: 'First Step', description: 'Complete your first run', reward: '+50 XP', progress: 100, unlocked: true, newlyUnlocked: true },
  { id: '1k-runner', category: 'distance', icon: '1', title: '1 KM Runner', description: 'Run a total of 1 km', reward: '+100 XP', progress: 72, unlocked: false },
  { id: '5k-finisher', category: 'distance', icon: '5', title: '5 KM Finisher', description: 'Complete a 5 km run', reward: '5K badge', progress: 34, unlocked: false },
  { id: '10k-finisher', category: 'distance', icon: '10', title: '10 KM Finisher', description: 'Complete a 10 km run', reward: '10K badge', progress: 18, unlocked: false },
  { id: 'half-marathon', category: 'distance', icon: '21', title: 'Half Marathon', description: 'Complete 21.1 km', reward: 'Elite frame', progress: 8, unlocked: false },
  { id: 'marathon', category: 'distance', icon: '42', title: 'Marathon', description: 'Complete 42.2 km', reward: 'Legend medal', progress: 4, unlocked: false },
  { id: '3-day-streak', category: 'streak', icon: '3', title: '3 Day Streak', description: 'Run 3 days in a row', reward: '+150 XP', progress: 66, unlocked: false },
  { id: '7-day-streak', category: 'streak', icon: '7', title: '7 Day Streak', description: 'Run 7 days in a row', reward: 'Streak ring', progress: 28, unlocked: false },
  { id: '30-day-streak', category: 'streak', icon: '30', title: '30 Day Streak', description: 'Run 30 days in a row', reward: 'Gold streak', progress: 9, unlocked: false },
  { id: '100-day-streak', category: 'streak', icon: '100', title: '100 Day Streak', description: 'Run 100 days in a row', reward: 'Legend streak', progress: 2, unlocked: false },
  { id: '100k-club', category: 'club', icon: '100', title: '100 KM Club', description: 'Reach 100 total km', reward: 'Club badge', progress: 31, unlocked: false },
  { id: '500k-club', category: 'club', icon: '500', title: '500 KM Club', description: 'Reach 500 total km', reward: 'Silver club', progress: 6, unlocked: false },
  { id: '1000k-club', category: 'club', icon: '1K', title: '1000 KM Club', description: 'Reach 1000 total km', reward: 'Elite club', progress: 3, unlocked: false },
  { id: '5000k-legend', category: 'club', icon: '5K', title: '5000 KM Legend', description: 'Reach 5000 total km', reward: 'Legend profile', progress: 1, unlocked: false },
  { id: 'fast-5k', category: 'speed', icon: 'ϟ', title: 'Fast 5K', description: 'Set a fast 5K time', reward: 'Speed badge', progress: 44, unlocked: false },
  { id: 'fast-10k', category: 'speed', icon: 'ϟ', title: 'Fast 10K', description: 'Set a fast 10K time', reward: 'Tempo badge', progress: 20, unlocked: false },
  { id: 'speed-demon', category: 'speed', icon: 'PR', title: 'Speed Demon', description: 'Set a new personal record', reward: 'PR flare', progress: 80, unlocked: false },
  { id: 'sunrise-runner', category: 'special', icon: '☼', title: 'Sunrise Runner', description: 'Run before 7 AM', reward: 'Morning badge', progress: 100, unlocked: true },
  { id: 'night-runner', category: 'special', icon: '◐', title: 'Night Runner', description: 'Run after sunset', reward: 'Night badge', progress: 25, unlocked: false },
  { id: 'rain-runner', category: 'special', icon: '≈', title: 'Rain Runner', description: 'Run during rain', reward: 'Weather badge', progress: 0, unlocked: false },
  { id: 'winter-warrior', category: 'special', icon: '✦', title: 'Winter Warrior', description: 'Run in freezing weather', reward: 'Frost badge', progress: 0, unlocked: false },
  { id: 'city-explorer', category: 'discovery', icon: '◇', title: 'City Explorer', description: 'Complete 5 city routes', reward: 'Explorer badge', progress: 60, unlocked: false },
  { id: 'route-hunter', category: 'discovery', icon: '⌖', title: 'Route Hunter', description: 'Discover 10 routes', reward: 'Route frame', progress: 30, unlocked: false },
  { id: 'adventure-runner', category: 'discovery', icon: '△', title: 'Adventure Runner', description: 'Complete a new outdoor route', reward: 'Adventure badge', progress: 45, unlocked: false },
  { id: 'sukhbaatar-square', category: 'mongolia', icon: '□', title: 'Sukhbaatar Square Runner', description: 'Complete Sukhbaatar Square route', reward: 'UB badge', progress: 70, unlocked: false },
  { id: 'national-park', category: 'mongolia', icon: '◎', title: 'National Park Runner', description: 'Complete National Park route', reward: 'Park badge', progress: 38, unlocked: false },
  { id: 'bogd-khan', category: 'mongolia', icon: '▲', title: 'Bogd Khan Trail Runner', description: 'Complete Bogd Khan trail', reward: 'Trail badge', progress: 12, unlocked: false },
  { id: 'tuul-river', category: 'mongolia', icon: '≈', title: 'Tuul River Explorer', description: 'Complete Tuul River route', reward: 'River badge', progress: 18, unlocked: false },
  { id: 'run-app-legend', category: 'ultimate', icon: '★', title: 'Run App Legend', description: 'Unlock every major badge', reward: 'Legend status', progress: 7, unlocked: false }
];

function getWeatherCondition(weatherCode: number) {
  if (weatherCode === 0) {
    return 'Цэлмэг';
  }

  if ([1, 2, 3].includes(weatherCode)) {
    return 'Багавтар үүлтэй';
  }

  if ([45, 48].includes(weatherCode)) {
    return 'Манантай';
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return 'Бороотой';
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return 'Цастай';
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return 'Аянгатай';
  }

  return 'Тогтуун';
}

function getWeatherMood(condition?: string): WeatherMood {
  if (condition === 'Бороотой') {
    return 'rain';
  }

  if (condition === 'Цастай') {
    return 'snow';
  }

  if (condition === 'Аянгатай') {
    return 'storm';
  }

  if (condition === 'Манантай' || condition === 'Багавтар үүлтэй') {
    return 'cloudy';
  }

  return 'clear';
}

function WeatherSceneIcon({ mood }: { mood: WeatherMood }) {
  return (
    <View style={styles.weatherSceneIcon}>
      {mood !== 'snow' && mood !== 'storm' ? (
        <>
          <View style={styles.iconSun} />
          <View style={[styles.sunRay, styles.sunRayTop]} />
          <View style={[styles.sunRay, styles.sunRayRight]} />
          <View style={[styles.sunRay, styles.sunRayAngle]} />
        </>
      ) : null}
      <View style={styles.iconCloudMain} />
      <View style={styles.iconCloudLeft} />
      <View style={styles.iconCloudTop} />
      {mood === 'storm' ? <View style={styles.iconRainWrap}>{[0, 1, 2].map(index => <View key={index} style={[styles.iconRainDrop, { left: index * 16 }]} />)}</View> : null}
      {mood === 'snow' ? <Text style={styles.iconSnow}>✦</Text> : null}
    </View>
  );
}

function getRunningNote(weather: Pick<WeatherInfo, 'aqi' | 'condition' | 'temperature' | 'windSpeed'>) {
  const goodAir = weather.aqi === null || weather.aqi <= 100;
  const comfortableTemperature = weather.temperature >= -5 && weather.temperature <= 28;
  const calmWind = weather.windSpeed <= 8;
  const dryEnough = !['Бороотой', 'Цастай', 'Аянгатай'].includes(weather.condition);

  if (goodAir && comfortableTemperature && calmWind && dryEnough) {
    return 'Агаарын чанар гүйхэд маш таатай байна. Амжилт хүсье!';
  }

  if (!goodAir) {
    return 'Агаарын чанар сул байна. Богино, хөнгөн гүйлт сонгоорой.';
  }

  if (!dryEnough) {
    return 'Зам халтиргаатай байж магадгүй. Анхааралтай гүйгээрэй.';
  }

  if (!calmWind) {
    return 'Салхи ширүүн байна. Давхар хувцаслаж, хурдаа тохируулаарай.';
  }

  return 'Өнөөдрийн нөхцөл боломжийн байна. Биеэ сайн халаагаарай.';
}

function formatWeatherDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Өнөөдөр';
  }

  return `Өнөөдөр, ${date.getMonth() + 1}-р сарын ${date.getDate()}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function WeatherMotionBackground({ mood }: { mood: WeatherMood }) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(motion, {
        duration: mood === 'rain' || mood === 'snow' ? 2600 : 9000,
        toValue: 1,
        useNativeDriver: true
      })
    );

    animation.start();

    return () => animation.stop();
  }, [mood, motion]);

  const driftX = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 48]
  });
  const reverseDriftX = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [44, -36]
  });
  const fallY = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 110]
  });
  const pulse = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.28, 0.62, 0.28]
  });
  const flash = motion.interpolate({
    inputRange: [0, 0.08, 0.12, 1],
    outputRange: [0, 0.5, 0, 0]
  });

  return (
    <View pointerEvents="none" style={styles.weatherMotionLayer}>
      <LinearGradient
        colors={mood === 'clear' ? weatherClearGradient : mood === 'rain' ? weatherRainGradient : mood === 'snow' ? weatherSnowGradient : weatherCloudGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.weatherSkyGradient}
      />
      <LinearGradient
        colors={mood === 'clear' ? ['rgba(251,191,36,0.22)', 'rgba(14,165,233,0.06)', 'rgba(2,6,23,0.2)'] : mood === 'snow' ? ['rgba(226,232,240,0.24)', 'rgba(103,232,249,0.08)', 'rgba(2,6,23,0.28)'] : ['rgba(148,163,184,0.2)', 'rgba(56,189,248,0.08)', 'rgba(2,6,23,0.34)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.weatherAtmosphere}
      />
      <View style={styles.weatherHorizon} />
      {mood === 'clear' ? (
        <>
          <Animated.View style={[styles.sunGlow, { opacity: pulse }]} />
          <View style={styles.sunDisc} />
          <Animated.View style={[styles.weatherLightBand, { transform: [{ translateX: driftX }, { rotate: '-10deg' }] }]} />
        </>
      ) : null}
      {mood === 'cloudy' || mood === 'rain' || mood === 'storm' ? (
        <>
          <Animated.View style={[styles.cloudBand, styles.cloudBandOne, { transform: [{ translateX: driftX }] }]} />
          <Animated.View style={[styles.cloudBand, styles.cloudBandTwo, { transform: [{ translateX: reverseDriftX }] }]} />
          <Animated.View style={[styles.cloudBand, styles.cloudBandThree, { transform: [{ translateX: driftX }] }]} />
        </>
      ) : null}
      {mood === 'rain' || mood === 'storm' ? (
        <Animated.View style={[styles.precipitationLayer, { transform: [{ translateY: fallY }, { rotate: '-14deg' }] }]}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(index => (
            <View key={index} style={[styles.rainStreak, { left: 18 + index * 44, top: (index % 3) * 28 }]} />
          ))}
        </Animated.View>
      ) : null}
      {mood === 'snow' ? (
        <Animated.View style={[styles.precipitationLayer, { transform: [{ translateY: fallY }] }]}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(index => (
            <View key={index} style={[styles.snowDot, { left: 20 + index * 38, top: (index % 4) * 24 }]} />
          ))}
        </Animated.View>
      ) : null}
      {mood === 'storm' ? <Animated.View style={[styles.stormFlash, { opacity: flash }]} /> : null}
      <LinearGradient
        colors={['rgba(4,10,16,0.04)', 'rgba(4,10,16,0.34)', 'rgba(4,10,16,0.72)']}
        style={styles.weatherReadabilityShade}
      />
    </View>
  );
}

export function HomeScreen({
  posts,
  currentUserId,
  challenges,
  routes,
  clubs,
  clubEvents,
  joinedClubEventIds,
  runners,
  followedRunnerIds,
  joinedChallengeIds,
  onOpenComposer,
  onOpenChallenge,
  onOpenRoute,
  onToggleClubMembership,
  onToggleClubEventParticipation,
  onToggleFollow,
  onRemoveRunner,
  onPostSocialChange
}: Props) {
  const homeChallenges = challenges.filter(challenge => challenge.group === '5k');
  const corporateChallenges = challenges.filter(challenge => challenge.group === '10k');
  const marathonChallenges = challenges.filter(challenge => challenge.group === 'marathon');
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedAchievementCategory, setSelectedAchievementCategory] = useState<AchievementCategory>('distance');
  const [selectedRouteCity, setSelectedRouteCity] = useState<RouteCity>('ulaanbaatar');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [galleryImageIndex, setGalleryImageIndex] = useState<number | null>(null);
  const [clubPageOpen, setClubPageOpen] = useState(false);
  const [selectedClubEvent, setSelectedClubEvent] = useState<ClubEvent | null>(null);
  const [joinedEventNotice, setJoinedEventNotice] = useState<ClubEvent | null>(null);
  const [joinedClubNotice, setJoinedClubNotice] = useState<RunningClub | null>(null);
  const [selectedRunner, setSelectedRunner] = useState<ProfilePreview | null>(null);
  const [selectedRunnerRun, setSelectedRunnerRun] = useState<RunnerWeeklyRun | null>(null);
  const [runnerDirectoryOpen, setRunnerDirectoryOpen] = useState(false);
  const [runnerSearchQuery, setRunnerSearchQuery] = useState('');
  const askedWeatherPermission = useRef(false);
  const unlockPulse = useRef(new Animated.Value(0)).current;
  const routeScrollX = useRef(new Animated.Value(0)).current;
  const visibleAchievements = useMemo(
    () => ACHIEVEMENTS.filter(achievement => achievement.category === selectedAchievementCategory),
    [selectedAchievementCategory]
  );
  const visibleRoutes = useMemo(
    () => routes.filter(route => route.city === selectedRouteCity),
    [routes, selectedRouteCity]
  );
  const unlockedCount = ACHIEVEMENTS.filter(achievement => achievement.unlocked).length;
  const selectedClub = clubs.find(club => club.id === selectedClubId) ?? null;
  const selectedClubEvents = clubEvents.filter(event => event.clubId === selectedClubId);
  const profileCompletedEvents = useMemo(
    () => pickProfileItems(clubEvents, selectedRunner?.id ?? 'runner', 3),
    [clubEvents, selectedRunner?.id]
  );
  const profileCompletedChallenges = useMemo(
    () => pickProfileItems(challenges.filter(challenge => challenge.group !== 'marathon'), selectedRunner?.id ?? 'runner', 3),
    [challenges, selectedRunner?.id]
  );
  const profileCompletedMarathons = useMemo(
    () => pickProfileItems(challenges.filter(challenge => challenge.group === 'marathon'), selectedRunner?.id ?? 'runner', 2),
    [challenges, selectedRunner?.id]
  );
  const selectedRunnerWeeklyRuns = useMemo(
    () => buildRunnerWeeklyRuns(selectedRunner, routes),
    [routes, selectedRunner]
  );
  const selectedRunnerMaxWeeklyKm = Math.max(1, ...selectedRunnerWeeklyRuns.map(run => run.distanceKm));
  const activeRunners = useMemo<ProfilePreview[]>(
    () => [...runners]
      .sort((first, second) => second.totalKm - first.totalKm)
      .map(runner => {
        const runnerPosts = posts.filter(post => post.userId === runner.id || post.user === runner.name);
        return {
          ...runner,
          postCount: runnerPosts.length,
          latestPostTitle: runnerPosts[0]?.title
        };
      }),
    [posts, runners]
  );
  const visibleActiveRunners = useMemo(() => {
    const query = runnerSearchQuery.trim().toLowerCase();
    if (!query) return activeRunners;
    return activeRunners.filter(runner => runner.name.toLowerCase().includes(query));
  }, [activeRunners, runnerSearchQuery]);
  const selectedClubSocials = selectedClub ? [
    { key: 'facebook', icon: 'f', label: 'Facebook', url: selectedClub.socialLinks?.facebook, backgroundColor: '#1877F2', textColor: '#FFFFFF' },
    { key: 'instagram', icon: 'IG', label: 'Instagram', url: selectedClub.socialLinks?.instagram, backgroundColor: '#E4405F', textColor: '#FFFFFF' },
    { key: 'website', icon: 'www', label: 'Web', url: selectedClub.socialLinks?.website, backgroundColor: colors.accent, textColor: '#071006' }
  ] : [];
  const joinClubEventFromDetail = (event: ClubEvent) => {
    if (!joinedClubEventIds.includes(event.id)) {
      onToggleClubEventParticipation(event);
    }
    setSelectedClubEvent(null);
    setJoinedEventNotice(event);
  };
  const toggleClubMembership = async (club: RunningClub) => {
    const wasJoined = Boolean(club.joined);
    const changed = await onToggleClubMembership(club);
    if (changed && !wasJoined) {
      setJoinedClubNotice({ ...club, joined: true });
    }
  };
  const openSocialLink = (label: string, url?: string) => {
    const trimmed = url?.trim();
    if (!trimmed) {
      Alert.alert(label, 'Club admin дээр энэ social link-ийг оруулж хадгална уу.');
      return;
    }
    const target = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    void Linking.openURL(target).catch(() => Alert.alert(label, 'Энэ холбоосыг нээж чадсангүй.'));
  };
  const openPostAuthorProfile = (post: Post) => {
    const runnerMatch = runners.find(runner => runner.id === post.userId || runner.name === post.user);
    const authorPosts = posts.filter(item => (
      post.userId ? item.userId === post.userId : item.user === post.user
    ));
    setSelectedRunner({
      id: post.userId ?? `post-author-${post.user}`,
      name: post.user,
      avatar: post.userAvatar ?? runnerMatch?.avatar ?? 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=300&q=80',
      totalKm: runnerMatch?.totalKm ?? authorPosts.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0),
      postCount: authorPosts.length || 1,
      latestPostTitle: post.title
    });
  };

  const updateWeather = useCallback(async () => {
    setWeatherLoading(true);

    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (!permission.granted && permission.canAskAgain && !askedWeatherPermission.current) {
        askedWeatherPermission.current = true;
        permission = await Location.requestForegroundPermissionsAsync();
      }
      const location = permission.granted
        ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        : null;
      const latitude = location?.coords.latitude ?? ULAANBAATAR_COORDINATES.latitude;
      const longitude = location?.coords.longitude ?? ULAANBAATAR_COORDINATES.longitude;
      const query = `latitude=${latitude}&longitude=${longitude}`;
      const [weatherResponse, airQualityResponse] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?${query}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=ms&timezone=auto`
        ),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${query}&current=us_aqi&timezone=auto`)
      ]);

      if (!weatherResponse.ok || !airQualityResponse.ok) {
        throw new Error('Weather request failed');
      }

      const weatherJson = await weatherResponse.json();
      const airQualityJson = await airQualityResponse.json();
      const currentWeather = weatherJson.current;
      const currentAqi = airQualityJson.current?.us_aqi ?? null;
      const condition = getWeatherCondition(currentWeather.weather_code);
      const nextWeather = {
        aqi: typeof currentAqi === 'number' ? Math.round(currentAqi) : null,
        condition,
        dateLabel: formatWeatherDate(currentWeather.time),
        humidity: Math.round(currentWeather.relative_humidity_2m),
        isFallbackLocation: !permission.granted,
        note: getRunningNote({
          aqi: typeof currentAqi === 'number' ? currentAqi : null,
          condition,
          temperature: currentWeather.temperature_2m,
          windSpeed: currentWeather.wind_speed_10m
        }),
        temperature: Math.round(currentWeather.temperature_2m),
        updatedAt: formatUpdatedAt(currentWeather.time),
        windSpeed: Math.round(currentWeather.wind_speed_10m)
      };

      setWeather(nextWeather);
      setWeatherError(null);
    } catch {
      setWeatherError('Цаг агаар шинэчлэхэд алдаа гарлаа.');
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    updateWeather();
    const timer = setInterval(updateWeather, WEATHER_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [updateWeather]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(unlockPulse, {
          duration: 900,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(unlockPulse, {
          duration: 900,
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [unlockPulse]);

  const unlockPulseStyle = {
    opacity: unlockPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.2, 0.62]
    }),
    transform: [
      {
        scale: unlockPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1.08]
        })
      }
    ]
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../../assets/home-runner-blur.png')}
        resizeMode="cover"
        style={styles.backgroundMedia}
        imageStyle={styles.backgroundImage}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(5,18,22,0.42)', 'rgba(5,16,20,0.66)', 'rgba(3,11,15,0.88)']}
        style={styles.backgroundOverlay}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.brandMark}>⌁</Text>
        <View>
          <Text style={styles.brand}>RUN</Text>
          <Text style={styles.brandSub}>Performance platform</Text>
        </View>
      </View>

      <BlurView intensity={42} tint="dark" style={styles.weatherCard}>
        <WeatherMotionBackground mood="cloudy" />
        <View style={styles.weatherContent}>
          <View style={styles.weatherHeroRow}>
            <View style={styles.weatherMain}>
              <Text style={styles.weatherTemp}>{weather ? `${weather.temperature > 0 ? '+' : ''}${weather.temperature}°` : '--°'}</Text>
              <Text style={styles.weatherCondition}>{weatherError ? 'Мэдээлэл алга' : weather?.condition ?? (weatherLoading ? 'Шинэчилж байна' : 'Тодорхойгүй')}</Text>
              <View style={styles.runReadyBadge}>
                <View style={styles.runReadyDot}/>
                <Text style={styles.runReadyText}>{weather?.aqi !== null && weather?.aqi !== undefined && weather.aqi <= 100 ? 'ГҮЙХ/АЛХАХАД ТОХИРОМЖТОЙ' : 'АНХААРАЛТАЙ ГҮЙХ/АЛХАХ'}</Text>
              </View>
            </View>
            <WeatherSceneIcon mood={getWeatherMood(weather?.condition)} />
          </View>

          <View style={styles.weatherMiniRow}>
            <View style={styles.weatherMiniStat}>
              <Text style={styles.weatherMiniLabel}>МЭДРЭГДЭХ</Text>
              <Text style={styles.weatherMiniValue}>{weather ? `${weather.temperature > 0 ? '+' : ''}${weather.temperature}°` : '--'}</Text>
            </View>
            <View style={styles.weatherMiniDivider}/>
            <View style={styles.weatherMiniStat}>
              <Text style={styles.weatherMiniLabel}>ЧИЙГШИЛ</Text>
              <Text style={styles.weatherMiniValue}>{weather ? `${weather.humidity}%` : '--'}</Text>
            </View>
            <View style={styles.weatherMiniDivider}/>
            <View style={styles.weatherMiniStat}>
              <Text style={styles.weatherMiniLabel}>САЛХИ</Text>
              <Text style={styles.weatherMiniValue}>{weather ? `${weather.windSpeed} м/с` : '--'}</Text>
            </View>
          </View>
        </View>
      </BlurView>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Онцлох клубууд</Text>
          <Text style={styles.sectionSubtitle}>Энэ долоо хоногийн идэвхийн эрэмбэ</Text>
        </View>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubRow}>
          {clubs.map(club => (
            <Pressable key={club.id} style={styles.clubCard} onPress={() => setSelectedClubId(club.id)}>
              <ImageBackground source={{ uri: club.image }} imageStyle={styles.clubImage} style={styles.clubImageWrap}>
                <LinearGradient colors={['rgba(3,10,14,0.04)', 'rgba(3,10,14,0.92)']} style={styles.clubCardShade}>
                  <View style={styles.clubCardTop}>
                    {club.joined ? <View style={styles.clubJoinedPill}><Text style={styles.clubJoinedPillText}>НЭГДСЭН</Text></View> : null}
                  </View>
                  <View>
                    <Text numberOfLines={1} style={styles.clubName}>{club.name}</Text>
                    <Text style={styles.clubCity}>{club.city}</Text>
                    <View style={styles.clubStatsRow}>
                      <Text style={styles.clubStat}>{club.memberCount.toLocaleString()} гишүүн</Text>
                      <View style={styles.clubStatDot} />
                      <Text style={styles.clubStat}>{club.weeklyKm.toLocaleString()} км / 7 хоног</Text>
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </Pressable>
          ))}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Клубуудын арга хэмжээ</Text>
          <Text style={styles.sectionSubtitle}>Хамтдаа гүйх дараагийн боломжууд</Text>
        </View>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubEventRow}>
          {clubEvents.map(event => (
            <Pressable key={event.id} style={styles.clubEventCard} onPress={() => setSelectedClubEvent(event)}>
              <ImageBackground source={{ uri: event.image }} imageStyle={styles.clubEventImage} style={styles.clubEventImageWrap}>
                <View style={styles.clubEventDateBadge}><Text style={styles.clubEventDate}>{formatClubEventDate(event.startsAt)}</Text></View>
              </ImageBackground>
              <View style={styles.clubEventBody}>
                <Text numberOfLines={1} style={styles.clubEventTitle}>{event.title}</Text>
                <Text numberOfLines={1} style={styles.clubEventClub}>{event.clubName}</Text>
                <Text numberOfLines={1} style={styles.clubEventMeta}>{event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Хүрч болох амжилтууд</Text>
          <Text style={styles.sectionSubtitle}>{unlockedCount}/{ACHIEVEMENTS.length} badge нээгдсэн</Text>
        </View>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementFilterRow}>
          {ACHIEVEMENT_CATEGORIES.map(category => {
            const active = selectedAchievementCategory === category.key;

            return (
              <Pressable
                key={category.key}
                style={[styles.achievementFilter, active && styles.activeAchievementFilter]}
                onPress={() => setSelectedAchievementCategory(category.key)}
              >
                <Text style={[styles.achievementFilterText, active && styles.activeAchievementFilterText]}>{category.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementRow}>
          {visibleAchievements.map(achievement => {
            const achievementTheme = ACHIEVEMENT_THEME[achievement.category];

            return (
              <View
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  { borderColor: achievement.unlocked ? achievementTheme.color : colors.line },
                  achievement.unlocked ? styles.unlockedAchievementCard : styles.lockedAchievementCard
                ]}
              >
                <View style={[styles.achievementTopRow]}>
                  <View
                    style={[
                      styles.achievementIcon,
                      { backgroundColor: achievementTheme.muted, borderColor: achievement.unlocked ? achievementTheme.color : colors.line }
                    ]}
                  >
                    {achievement.newlyUnlocked ? (
                      <Animated.View style={[styles.unlockGlow, { backgroundColor: achievementTheme.color }, unlockPulseStyle]} />
                    ) : null}
                    <Text style={styles.trophyIcon}>{achievement.unlocked ? achievementTheme.trophy : '🔒'}</Text>
                  </View>
                  <View style={[styles.categoryChip, { backgroundColor: achievementTheme.muted }]}>
                    <Text style={[styles.categoryChipText, { color: achievementTheme.color }]}>
                      {achievement.unlocked ? 'Нээгдсэн' : `${achievement.progress}%`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>{achievement.description}</Text>
                <View style={styles.achievementProgressTrack}>
                  <View
                    style={[
                      styles.achievementProgressFill,
                      { backgroundColor: achievementTheme.color, width: `${achievement.progress}%` }
                    ]}
                  />
                </View>
                <View style={styles.achievementFooter}>
                  <Text style={[styles.achievementMeta, { color: achievementTheme.color }]}>
                    {achievement.icon} Badge
                  </Text>
                  <View style={[styles.rewardPill, { borderColor: achievementTheme.color }]}>
                    <Text style={styles.achievementReward}>{achievement.reward}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Холын зайн Марафон</Text>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryRow}>
          {marathonChallenges.map(challenge => (
            <Pressable key={challenge.id} style={styles.discoveryCard} onPress={() => onOpenChallenge(challenge)}>
              <ImageBackground source={{ uri: challenge.image }} imageStyle={styles.discoveryImage} style={styles.discoveryImageWrap}>
                <View style={styles.discoveryShade}>
                  <View style={styles.marathonMedalBadge}>
                    <Image source={{ uri: marathonMedalImage }} style={styles.marathonMedalImage} />
                  </View>
                  <View>
                    <Text style={styles.discoveryTitle}>{challenge.title}</Text>
                    <Text style={styles.discoveryMeta}>
                      {challenge.org} · {joinedChallengeIds.includes(challenge.id) ? 'Бүртгүүлсэн' : 'Оролцох'}
                    </Text>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>10+ км Challenges</Text>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryRow}>
          {corporateChallenges.map(challenge => (
            <Pressable key={challenge.id} style={styles.discoveryCard} onPress={() => onOpenChallenge(challenge)}>
              <ImageBackground source={{ uri: challenge.image }} imageStyle={styles.discoveryImage} style={styles.discoveryImageWrap}>
                <View style={styles.discoveryShade}>
                  <View style={styles.difficultyPill}>
                    <Text style={styles.difficultyText}>{challenge.goalKm}+ км</Text>
                  </View>
                  <View>
                    <Text style={styles.discoveryTitle}>{challenge.title}</Text>
                    <Text style={styles.discoveryMeta}>
                      {challenge.org} · {joinedChallengeIds.includes(challenge.id) ? 'Бүртгүүлсэн' : 'Оролцох'}
                    </Text>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>5 км Challenges</Text>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.challengeRow}>
          {homeChallenges.map(challenge => (
            <Pressable key={challenge.id} style={styles.challengeCard} onPress={() => onOpenChallenge(challenge)}>
              <ImageBackground source={{ uri: challenge.image }} imageStyle={styles.challengeImage} style={styles.challengeImageWrap}>
                <View style={styles.challengeShade}>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <Text style={styles.challengeReward}>{challenge.reward ?? `${challenge.goalKm} км`}</Text>
                  <Text style={styles.joinState}>
                    {joinedChallengeIds.includes(challenge.id) ? 'Бүртгүүлсэн' : 'Оролцох'}
                  </Text>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.routeFeatureHeader}>
        <Text style={styles.sectionLink}>Бүгдийг харах</Text>
        <Text style={styles.routeFeatureTitle}>Гүйлтийн газрууд</Text>
        <Text style={styles.routeFeatureSubtitle}>Хот сонгоод ойролцоох гүйх газруудыг хараарай</Text>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeCityRow}>
          {routeCityFilters.map(city => {
            const active = selectedRouteCity === city.key;

            return (
              <Pressable
                key={city.key}
                style={[styles.routeCityChip, active && styles.activeRouteCityChip]}
                onPress={() => {
                  routeScrollX.setValue(0);
                  setSelectedRouteCity(city.key);
                }}
              >
                <Text style={[styles.routeCityText, active && styles.activeRouteCityText]}>{city.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.horizontalHintWrap}>
        <Animated.ScrollView
          key={selectedRouteCity}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={routeSnapInterval}
          decelerationRate="fast"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: routeScrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          contentContainerStyle={styles.homeRouteRow}
        >
          {visibleRoutes.map((route, index) => {
            const inputRange = [
              (index - 1) * routeSnapInterval,
              index * routeSnapInterval,
              (index + 1) * routeSnapInterval
            ];
            const routeCardScale = routeScrollX.interpolate({
              inputRange,
              outputRange: [0.86, 1, 0.86],
              extrapolate: 'clamp'
            });
            const routeCardOpacity = routeScrollX.interpolate({
              inputRange,
              outputRange: [0.55, 1, 0.55],
              extrapolate: 'clamp'
            });
            const routeCardTranslateY = routeScrollX.interpolate({
              inputRange,
              outputRange: [22, 0, 22],
              extrapolate: 'clamp'
            });

            return (
              <Animated.View
                key={route.id}
                style={[
                  styles.homeRouteAnimatedCard,
                  {
                    opacity: routeCardOpacity,
                    transform: [{ translateY: routeCardTranslateY }, { scale: routeCardScale }]
                  }
                ]}
              >
                <Pressable style={styles.homeRouteCard} onPress={() => onOpenRoute(route.id)}>
                  <View pointerEvents="none" style={styles.homeRouteGlow} />
                  <ImageBackground source={{ uri: route.image }} imageStyle={styles.homeRouteImage} style={styles.homeRouteImageWrap}>
                    <View style={styles.homeRouteShade} />
                  </ImageBackground>
                  <View style={styles.homeRouteBody}>
                    <Text style={styles.homeRouteTitle} numberOfLines={1}>{route.title}</Text>
                    <View style={styles.homeRouteMetaRow}>
                      <View style={styles.homeRouteDifficulty}>
                        <Text style={styles.homeRouteDifficultyText}>{route.difficulty}</Text>
                      </View>
                      <Text style={styles.homeRouteMeta}>{route.distanceKm.toFixed(2)} km ({route.estimatedDuration}) · {route.elevationM} m</Text>
                    </View>
                    <Text style={styles.homeRouteArea}>Run · {route.area}</Text>
                    <Text style={styles.homeRouteRecent}>{route.recentActivities} recent activities</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.routeScrollEdgeHint} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Санал болгох гүйгчид</Text>
        <Pressable
          hitSlop={8}
          style={({ pressed }) => [styles.sectionLinkButton, pressed && styles.sectionLinkPressed]}
          onPress={() => setRunnerDirectoryOpen(true)}
        >
          <Text style={styles.sectionLink}>Бүгдийг харах</Text>
        </Pressable>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.runnerRow}>
          {runners.map(runner => {
            const followed = followedRunnerIds.includes(runner.id);
            return (
              <Pressable key={runner.id} style={({ pressed }) => [styles.runnerCard, pressed && styles.runnerCardPressed]} onPress={() => setSelectedRunner(runner)}>
                <View style={styles.runnerAvatar}>
                  <ImageBackground source={{ uri: runner.avatar }} imageStyle={styles.runnerImage} style={styles.runnerImageWrap} />
                </View>
                <Text style={styles.runnerName} numberOfLines={2}>{runner.name}</Text>
                <Text style={styles.runnerMeta}>{runner.totalKm.toLocaleString()} км гүйсэн</Text>
                <View style={styles.runnerActions}>
                  <Pressable
                    style={[styles.followButton, followed && styles.followingButton]}
                    onPress={event => {
                      event.stopPropagation();
                      onToggleFollow(runner.id);
                    }}
                  >
                    <Text style={styles.followText}>{followed ? 'Following' : 'Follow'}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.removeButton}
                    onPress={event => {
                      event.stopPropagation();
                      onRemoveRunner(runner.id);
                    }}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={scrollHintColors} start={scrollHintStart} end={scrollHintEnd} style={styles.scrollEdgeHint} />
      </View>

      <View style={styles.timelineHeader}>
        <View>
          <Text style={styles.sectionTitle}>Нийтлэлүүд</Text>
          <Text style={styles.sectionSubtitle}>Гүйгчдийн шинэ түүхүүд</Text>
        </View>
        <Pressable onPress={onOpenComposer} style={styles.addPostButton}>
          <Text style={styles.addPostIcon}>＋</Text>
        </Pressable>
      </View>

      {posts.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={314}
          decelerationRate="fast"
          contentContainerStyle={styles.postCarousel}
        >
          {posts.map(post => (
            <View key={post.id} style={styles.postSlide}>
              <PostCard
                post={post}
                currentUserId={currentUserId}
                onOpenAuthor={openPostAuthorProfile}
                onSocialChange={onPostSocialChange}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyTimeline}>
          <Text style={styles.emptyTimelineTitle}>Одоогоор нийтлэл алга</Text>
          <Text style={styles.emptyTimelineText}>Эхний гүйлтийн түүхээ хуваалцаарай.</Text>
        </View>
      )}

      </ScrollView>

      <Modal transparent visible={Boolean(selectedClub)} animationType="slide" onRequestClose={() => setSelectedClubId(null)}>
        <View style={styles.clubModalRoot}>
          <Pressable style={styles.clubModalBackdrop} onPress={() => setSelectedClubId(null)} />
          {selectedClub ? (
            <View style={styles.clubSheet}>
              <View style={styles.clubSheetHandle} />
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.clubSheetContent}>
                <ImageBackground source={{ uri: selectedClub.image }} imageStyle={styles.clubHeroImage} style={styles.clubHero}>
                  <LinearGradient colors={['rgba(4,12,16,0.05)', 'rgba(4,12,16,0.9)']} style={styles.clubHeroShade}>
                    <Pressable accessibilityLabel="Хаах" style={styles.clubCloseButton} onPress={() => setSelectedClubId(null)}>
                      <Text style={styles.clubCloseText}>×</Text>
                    </Pressable>
                    <View style={styles.clubHeroCopy}>
                      <Text style={styles.clubHeroMeta}>{selectedClub.city.toUpperCase()}</Text>
                      <Text style={styles.clubHeroTitle}>{selectedClub.name}</Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>

                <View style={styles.clubSheetStats}>
                  <View style={styles.clubSheetStat}><Text style={styles.clubSheetStatValue}>{selectedClub.memberCount.toLocaleString()}</Text><Text style={styles.clubSheetStatLabel}>Гишүүн</Text></View>
                  <View style={styles.clubSheetDivider} />
                  <View style={styles.clubSheetStat}><Text style={styles.clubSheetStatValue}>{selectedClub.weeklyKm.toLocaleString()}</Text><Text style={styles.clubSheetStatLabel}>7 хоногийн км</Text></View>
                </View>

                <Text style={styles.clubDescription}>{selectedClub.description}</Text>

                <View style={styles.clubModalContactSection}>
                  <Text style={styles.clubModalSectionTitle}>Холбоо барих</Text>
                  <Text style={styles.clubModalContact}>{selectedClub.meetingInfo}</Text>
                  <View style={styles.clubModalSocialRow}>
                    {selectedClubSocials.map(item => (
                      <Pressable
                        key={item.key}
                        accessibilityLabel={`${item.label} нээх`}
                        style={[
                          styles.clubModalSocialButton,
                          { backgroundColor: item.url ? item.backgroundColor : 'rgba(255,255,255,0.08)' },
                          !item.url && styles.clubModalSocialButtonDisabled
                        ]}
                        onPress={() => openSocialLink(item.label, item.url)}
                      >
                        <Text style={[
                          styles.clubModalSocialIcon,
                          item.key === 'website' && styles.clubModalSocialWebIcon,
                          { color: item.url ? item.textColor : '#92A4AA' }
                        ]}>{item.icon}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.clubGallerySection}>
                  <View style={styles.clubGalleryHeader}>
                    <Text style={styles.clubGalleryTitle}>Клубын зургууд</Text>
                    <Text style={styles.clubGalleryCount}>{(selectedClub.galleryImages.length || 1)} зураг</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubGalleryRow}>
                    {(selectedClub.galleryImages.length ? selectedClub.galleryImages : [selectedClub.image]).map((image, index) => (
                      <Pressable key={`${image}-${index}`} onPress={() => setGalleryImageIndex(index)}>
                        <ImageBackground source={{ uri: image }} imageStyle={styles.clubGalleryImage} style={styles.clubGalleryImageWrap}>
                          <View style={styles.clubGalleryZoom}><Text style={styles.clubGalleryZoomText}>↗</Text></View>
                        </ImageBackground>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {selectedClubEvents.length ? (
                  <View style={styles.clubModalEvents}>
                    <View style={styles.clubModalEventsHeader}>
                      <Text style={styles.clubModalEventsTitle}>Ойрын арга хэмжээ</Text>
                      <Text style={styles.clubModalEventsCount}>{selectedClubEvents.length} арга хэмжээ</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubModalEventRow}>
                      {selectedClubEvents.map(event => (
                        <Pressable key={event.id} style={styles.clubModalEventCard} onPress={() => setSelectedClubEvent(event)}>
                          <ImageBackground source={{ uri: event.image }} imageStyle={styles.clubModalEventImage} style={styles.clubModalEventImageWrap}>
                            <View style={styles.clubModalEventDate}><Text style={styles.clubModalEventDateText}>{formatClubEventDate(event.startsAt)}</Text></View>
                          </ImageBackground>
                          <View style={styles.clubModalEventCopy}>
                            <Text numberOfLines={2} style={styles.clubModalEventTitle}>{event.title}</Text>
                            <Text numberOfLines={1} style={styles.clubModalEventMeta}>{event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={styles.clubJoinInfoCard}>
                  <View style={styles.clubJoinInfoIcon}><Text style={styles.clubJoinInfoIconText}>{selectedClub.joined ? '✓' : '+'}</Text></View>
                  <View style={styles.clubJoinInfoCopy}>
                    <Text style={styles.clubJoinInfoTitle}>{selectedClub.joined ? 'Клубт нэгдсэн байна' : 'Клубт нэгдээд эхлээрэй'}</Text>
                    <Text style={styles.clubJoinInfoText}>
                      {selectedClub.joined
                        ? (selectedClubEvents[0] ? `Дараагийн арга хэмжээ: ${selectedClubEvents[0].title}` : 'Клубын шинэ арга хэмжээ, гүйлтүүд энд харагдана.')
                        : 'Нэгдсэний дараа клубын арга хэмжээ, гишүүдийн идэвх болон мэдэгдлүүдийг дагана.'}
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={[styles.clubJoinButton, selectedClub.joined && styles.clubLeaveButton]}
                  onPress={() => void toggleClubMembership(selectedClub)}
                >
                  <Text style={[styles.clubJoinText, selectedClub.joined && styles.clubLeaveText]}>{selectedClub.joined ? 'Клубээс гарах' : 'Клубт нэгдэх'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={clubPageOpen && Boolean(selectedClub)} animationType="slide" onRequestClose={() => setClubPageOpen(false)}>
        {selectedClub ? (
          <View style={styles.clubPageRoot}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.clubPageContent}>
              <ImageBackground source={{ uri: selectedClub.image }} style={styles.clubPageHero} imageStyle={styles.clubPageHeroImage}>
                <LinearGradient colors={['rgba(3,10,14,0.08)', 'rgba(3,10,14,0.94)']} style={styles.clubPageHeroShade}>
                  <Pressable accessibilityLabel="Клубын нүүр хаах" style={styles.clubPageBack} onPress={() => setClubPageOpen(false)}><Text style={styles.clubPageBackText}>‹</Text></Pressable>
                  <View>
                    <Text style={styles.clubPageCity}>{selectedClub.city.toUpperCase()}</Text>
                    <Text style={styles.clubPageTitle}>{selectedClub.name}</Text>
                    <Text style={styles.clubPageMembers}>{selectedClub.memberCount.toLocaleString()} гишүүн</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>

              <View style={styles.clubPageStats}>
                <View style={styles.clubPageStat}><Text style={styles.clubPageStatValue}>{selectedClub.totalKm.toLocaleString()}</Text><Text style={styles.clubPageStatLabel}>Гишүүдийн нийт км</Text></View>
                <View style={styles.clubPageStatDivider} />
                <View style={styles.clubPageStat}><Text style={styles.clubPageStatValue}>{selectedClub.weeklyKm.toLocaleString()}</Text><Text style={styles.clubPageStatLabel}>7 хоногийн км</Text></View>
                <View style={styles.clubPageStatDivider} />
                <View style={styles.clubPageStat}><Text style={styles.clubPageStatValue}>{selectedClubEvents.length}</Text><Text style={styles.clubPageStatLabel}>Төлөвлөсөн эвент</Text></View>
              </View>

              <View style={styles.clubPageSection}>
                <Text style={styles.clubPageSectionTitle}>Клубын тухай</Text>
                <Text style={styles.clubPageDescription}>{selectedClub.description}</Text>
              </View>

              <View style={styles.clubPageSection}>
                <Text style={styles.clubPageSectionTitle}>Холбоо барих</Text>
                <Text style={styles.clubPageContact}>{selectedClub.meetingInfo}</Text>
                <View style={styles.clubSocialRow}>
                  {selectedClubSocials.map(item => (
                    <Pressable
                      key={item.key}
                      accessibilityLabel={item.label}
                      style={[styles.clubSocialButton, { backgroundColor: item.backgroundColor }, !item.url?.trim() && styles.clubSocialButtonDisabled]}
                      onPress={() => openSocialLink(item.label, item.url)}
                    >
                      <Text style={[styles.clubSocialIcon, { color: item.textColor }, item.key === 'website' && styles.clubSocialWebIcon]}>{item.icon}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.clubPageSection}>
                <View style={styles.clubPageSectionHeader}><Text style={styles.clubPageSectionTitle}>Төлөвлөсөн арга хэмжээнүүд</Text><Text style={styles.clubPageSectionCount}>{selectedClubEvents.length}</Text></View>
                {selectedClubEvents.length ? selectedClubEvents.map(event => (
                  <Pressable key={event.id} style={styles.clubPageEvent} onPress={() => setSelectedClubEvent(event)}>
                    <ImageBackground source={{ uri: event.image }} imageStyle={styles.clubPageEventImage} style={styles.clubPageEventImageWrap} />
                    <View style={styles.clubPageEventCopy}>
                      <Text style={styles.clubPageEventDate}>{formatClubEventDate(event.startsAt)}</Text>
                      <Text style={styles.clubPageEventTitle}>{event.title}</Text>
                      <Text style={styles.clubPageEventMeta}>{event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
                      <View style={styles.clubPageEventActions}>
                        <Pressable style={[styles.clubPageEventJoin, joinedClubEventIds.includes(event.id) && styles.clubPageEventJoined]} onPress={pressEvent => {
                          pressEvent.stopPropagation();
                          joinClubEventFromDetail(event);
                        }}>
                          <Text style={[styles.clubPageEventJoinText, joinedClubEventIds.includes(event.id) && styles.clubPageEventJoinedText]}>{joinedClubEventIds.includes(event.id) ? 'Оролцоно' : 'Оролцох'}</Text>
                        </Pressable>
                        <Pressable style={styles.clubPageEventDetails} onPress={() => setSelectedClubEvent(event)}><Text style={styles.clubPageEventDetailsText}>Дэлгэрэнгүй</Text></Pressable>
                      </View>
                    </View>
                  </Pressable>
                )) : <View style={styles.clubPageEmpty}><Text style={styles.clubPageEmptyText}>Одоогоор төлөвлөсөн арга хэмжээ алга.</Text></View>}
              </View>

              <View style={styles.clubPageSection}>
                <Text style={styles.clubPageSectionTitle}>Клубын зургууд</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubPageGallery}>
                  {(selectedClub.galleryImages.length ? selectedClub.galleryImages : [selectedClub.image]).map((image, index) => (
                    <Pressable key={`${image}-page-${index}`} onPress={() => setGalleryImageIndex(index)}>
                      <ImageBackground source={{ uri: image }} imageStyle={styles.clubPageGalleryImage} style={styles.clubPageGalleryItem} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Pressable style={[styles.clubPageJoin, selectedClub.joined && styles.clubPageJoined]} onPress={() => void toggleClubMembership(selectedClub)}>
                <Text style={[styles.clubPageJoinText, selectedClub.joined && styles.clubPageJoinedText]}>{selectedClub.joined ? 'Клубээс гарах' : 'Клубт нэгдэх'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}
      </Modal>

      <Modal transparent visible={Boolean(selectedClubEvent)} animationType="slide" onRequestClose={() => setSelectedClubEvent(null)}>
        <View style={styles.eventDetailModalRoot}>
          <Pressable style={styles.eventDetailBackdrop} onPress={() => setSelectedClubEvent(null)} />
          {selectedClubEvent ? (
            <View style={styles.eventDetailSheet}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.eventDetailContent}>
                <ImageBackground source={{ uri: selectedClubEvent.image }} imageStyle={styles.eventDetailImage} style={styles.eventDetailHero}>
                  <LinearGradient colors={['rgba(3,10,14,0.08)', 'rgba(3,10,14,0.92)']} style={styles.eventDetailShade}>
                    <Pressable style={styles.eventDetailClose} onPress={() => setSelectedClubEvent(null)}><Text style={styles.eventDetailCloseText}>×</Text></Pressable>
                    <View><Text style={styles.eventDetailClub}>{selectedClubEvent.clubName}</Text><Text style={styles.eventDetailTitle}>{selectedClubEvent.title}</Text></View>
                  </LinearGradient>
                </ImageBackground>
                <View style={styles.eventDetailMetaRow}>
                  <View style={styles.eventDetailMetaItem}><Text style={styles.eventDetailMetaValue}>{formatClubEventDate(selectedClubEvent.startsAt)}</Text><Text style={styles.eventDetailMetaLabel}>Эхлэх цаг</Text></View>
                  <View style={styles.eventDetailMetaDivider} />
                  <View style={styles.eventDetailMetaItem}><Text style={styles.eventDetailMetaValue}>{getEventRegistrationCountdown(selectedClubEvent.startsAt)}</Text><Text style={styles.eventDetailMetaLabel}>Бүртгэл дуусах</Text></View>
                  <View style={styles.eventDetailMetaDivider} />
                  <View style={styles.eventDetailMetaItem}><Text style={styles.eventDetailMetaValue}>{selectedClubEvent.participantCount}</Text><Text style={styles.eventDetailMetaLabel}>Бүртгэгдсэн</Text></View>
                </View>
                <View style={styles.eventDetailQuickGrid}>
                  <View style={styles.eventDetailQuickItem}><Text style={styles.eventDetailQuickValue}>{selectedClubEvent.distanceKm ? `${selectedClubEvent.distanceKm} км` : 'Нээлттэй'}</Text><Text style={styles.eventDetailQuickLabel}>Гүйлтийн зай</Text></View>
                  <View style={styles.eventDetailQuickItem}><Text style={styles.eventDetailQuickValue}>{selectedClubEvent.location}</Text><Text style={styles.eventDetailQuickLabel}>Зохиогдох байршил</Text></View>
                </View>
                <View style={styles.eventDetailSection}><Text style={styles.eventDetailSectionTitle}>Тайлбар</Text><Text style={styles.eventDetailDescription}>{selectedClubEvent.description}</Text></View>
                <View style={styles.eventDetailSection}><Text style={styles.eventDetailSectionTitle}>Санамж</Text>{selectedClubEvent.advice.map((advice, index) => <View key={`${advice}-${index}`} style={styles.eventAdviceRow}><View style={styles.eventAdviceNumber}><Text style={styles.eventAdviceNumberText}>{index + 1}</Text></View><Text style={styles.eventAdviceText}>{advice}</Text></View>)}</View>
                <Pressable
                  disabled={joinedClubEventIds.includes(selectedClubEvent.id)}
                  style={[styles.eventDetailJoin, joinedClubEventIds.includes(selectedClubEvent.id) && styles.eventDetailJoined]}
                  onPress={() => joinClubEventFromDetail(selectedClubEvent)}
                >
                  <Text style={[styles.eventDetailJoinText, joinedClubEventIds.includes(selectedClubEvent.id) && styles.eventDetailJoinedText]}>{joinedClubEventIds.includes(selectedClubEvent.id) ? 'Профайлд нэмэгдсэн' : 'Арга хэмжээнд нэгдэх'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={Boolean(joinedEventNotice)} animationType="fade" onRequestClose={() => setJoinedEventNotice(null)}>
        <View style={styles.eventSuccessRoot}>
          <Pressable style={styles.eventSuccessBackdrop} onPress={() => setJoinedEventNotice(null)} />
          {joinedEventNotice ? (
            <View style={styles.eventSuccessCard}>
              <View style={styles.eventSuccessMark}><Text style={styles.eventSuccessMarkText}>✓</Text></View>
              <Text style={styles.eventSuccessTitle}>Танд амжилт хүсье</Text>
              <Text style={styles.eventSuccessBody}>Event таны профайлд нэмэгдлээ.</Text>
              <Text style={styles.eventSuccessEvent}>{joinedEventNotice.title}</Text>
              <Pressable style={styles.eventSuccessButton} onPress={() => setJoinedEventNotice(null)}>
                <Text style={styles.eventSuccessButtonText}>Ойлголоо</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={Boolean(joinedClubNotice)} animationType="fade" onRequestClose={() => setJoinedClubNotice(null)}>
        <View style={styles.eventSuccessRoot}>
          <Pressable style={styles.eventSuccessBackdrop} onPress={() => setJoinedClubNotice(null)} />
          {joinedClubNotice ? (
            <View style={styles.eventSuccessCard}>
              <View style={styles.eventSuccessMark}><Text style={styles.eventSuccessMarkText}>✓</Text></View>
              <Text style={styles.clubSuccessTitle}>Та амжилттай нэгдлээ</Text>
              <Text style={styles.clubSuccessBody}>Клуб таны профайлд орлоо. Баярлалаа.</Text>
              <Text style={styles.eventSuccessEvent}>{joinedClubNotice.name}</Text>
              <Pressable style={styles.eventSuccessButton} onPress={() => setJoinedClubNotice(null)}>
                <Text style={styles.eventSuccessButtonText}>Ойлголоо</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={runnerDirectoryOpen} animationType="slide" onRequestClose={() => setRunnerDirectoryOpen(false)}>
        <View style={styles.runnerDirectoryBackdrop}>
          <Pressable style={styles.runnerDirectoryScrim} onPress={() => setRunnerDirectoryOpen(false)} />
          <View style={styles.runnerDirectorySheet}>
            <View style={styles.runnerDirectoryHeader}>
              <View>
                <Text style={styles.runnerDirectoryEyebrow}>ИДЭВХТЭЙ ГҮЙГЧИД</Text>
                <Text style={styles.runnerDirectoryTitle}>Санал болгох гүйгчид</Text>
                <Text style={styles.runnerDirectorySubtitle}>{activeRunners.length} гүйгч нийт км-ээр эрэмбэлэгдсэн</Text>
              </View>
              <Pressable accessibilityLabel="Жагсаалт хаах" style={styles.runnerDirectoryClose} onPress={() => setRunnerDirectoryOpen(false)}>
                <Text style={styles.runnerDirectoryCloseText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.runnerSearchBox}>
              <Text style={styles.runnerSearchIcon}>⌕</Text>
              <TextInput
                value={runnerSearchQuery}
                onChangeText={setRunnerSearchQuery}
                placeholder="Нэрээр хайх"
                placeholderTextColor="#8FA1A8"
                style={styles.runnerSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {runnerSearchQuery ? (
                <Pressable accessibilityLabel="Хайлт цэвэрлэх" hitSlop={8} onPress={() => setRunnerSearchQuery('')}>
                  <Text style={styles.runnerSearchClear}>×</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.runnerDirectoryList}>
              {visibleActiveRunners.length ? visibleActiveRunners.map((runner, index) => {
                const followed = followedRunnerIds.includes(runner.id);
                const weeklyRuns = Math.max(3, Math.round(runner.totalKm / 420));
                return (
                  <Pressable
                    key={runner.id}
                    style={({ pressed }) => [styles.runnerDirectoryRow, pressed && styles.runnerDirectoryRowPressed]}
                    onPress={() => {
                      setRunnerDirectoryOpen(false);
                      setSelectedRunner(runner);
                    }}
                  >
                    <View style={styles.runnerRankBadge}><Text style={styles.runnerRankText}>#{index + 1}</Text></View>
                    <Image source={{ uri: runner.avatar }} style={styles.runnerDirectoryAvatar} />
                    <View style={styles.runnerDirectoryCopy}>
                      <Text style={styles.runnerDirectoryName} numberOfLines={1}>{runner.name}</Text>
                      <Text style={styles.runnerDirectoryMeta} numberOfLines={1}>{runner.totalKm.toLocaleString()} км · 7 хоногт {weeklyRuns} гүйлт</Text>
                      <View style={styles.runnerDirectoryPills}>
                        <Text style={styles.runnerDirectoryPill}>Active</Text>
                        {runner.latestPostTitle ? <Text style={styles.runnerDirectoryPostPill} numberOfLines={1}>{runner.latestPostTitle}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.runnerDirectoryActions}>
                      <Pressable
                        style={[styles.runnerDirectoryFollow, followed && styles.runnerDirectoryFollowing]}
                        onPress={event => {
                          event.stopPropagation();
                          onToggleFollow(runner.id);
                        }}
                      >
                        <Text style={styles.runnerDirectoryFollowText}>{followed ? '✓' : '+'}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.runnerDirectoryHide}
                        onPress={event => {
                          event.stopPropagation();
                          onRemoveRunner(runner.id);
                        }}
                      >
                        <Text style={styles.runnerDirectoryHideText}>×</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              }) : (
                <View style={styles.runnerDirectoryEmpty}>
                  <Text style={styles.runnerDirectoryEmptyTitle}>Илэрц олдсонгүй</Text>
                  <Text style={styles.runnerDirectoryEmptyText}>Нэрээ өөрөөр бичээд дахин хайна уу.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={Boolean(selectedRunner)} animationType="fade" onRequestClose={() => {
        setSelectedRunner(null);
        setSelectedRunnerRun(null);
      }}>
        <View style={styles.runnerProfileBackdrop}>
          <Pressable style={styles.runnerProfileScrim} onPress={() => {
            setSelectedRunner(null);
            setSelectedRunnerRun(null);
          }} />
          {selectedRunner ? (
            <View style={styles.runnerProfileCard}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.runnerProfileScrollContent}>
                <ImageBackground source={{ uri: selectedRunner.avatar }} imageStyle={styles.runnerProfileHeroImage} style={styles.runnerProfileHero}>
                  <LinearGradient colors={['rgba(4,12,16,0.08)', 'rgba(4,12,16,0.9)']} style={styles.runnerProfileHeroShade}>
                    <Pressable accessibilityLabel="Профайл хаах" style={styles.runnerProfileClose} onPress={() => {
                      setSelectedRunner(null);
                      setSelectedRunnerRun(null);
                    }}>
                      <Text style={styles.runnerProfileCloseText}>×</Text>
                    </Pressable>
                    <View>
                      <Image source={{ uri: selectedRunner.avatar }} style={styles.runnerProfileAvatar} />
                      <Text style={styles.runnerProfileName}>{selectedRunner.name}</Text>
                      <Text style={styles.runnerProfileHandle}>@{selectedRunner.name.toLowerCase().replace(/\s+/g, '.')}</Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>

                <View style={styles.runnerProfileStats}>
                  <View style={styles.runnerProfileStat}>
                    <Text style={styles.runnerProfileStatValue}>{selectedRunner.totalKm.toLocaleString()}</Text>
                    <Text style={styles.runnerProfileStatLabel}>нийт км</Text>
                  </View>
                  <View style={styles.runnerProfileDivider} />
                  <View style={styles.runnerProfileStat}>
                    <Text style={styles.runnerProfileStatValue}>{Math.max(18, Math.round(selectedRunner.totalKm / 72))}</Text>
                    <Text style={styles.runnerProfileStatLabel}>гүйлт</Text>
                  </View>
                  <View style={styles.runnerProfileDivider} />
                  <View style={styles.runnerProfileStat}>
                    <Text style={styles.runnerProfileStatValue}>{selectedRunner.postCount ?? Math.max(12, Math.round(selectedRunner.totalKm / 180))}</Text>
                    <Text style={styles.runnerProfileStatLabel}>пост</Text>
                  </View>
                </View>

                <View style={styles.runnerProfileBio}>
                  <Text style={styles.runnerProfileSectionTitle}>Товч мэдээлэл</Text>
                  <Text style={styles.runnerProfileBioText}>
                    {selectedRunner.latestPostTitle
                      ? `${selectedRunner.name} нийтэлсэн: “${selectedRunner.latestPostTitle}”. Route, challenge болон сүүлийн идэвхийг эндээс харна.`
                      : `${selectedRunner.name.split(' ')[0]} тогтвортой бэлтгэл хийдэг гүйгч. Route, challenge болон сүүлийн идэвхийг эндээс харна.`}
                  </Text>
                </View>

                <View style={styles.runnerProfileSection}>
                  <Text style={styles.runnerProfileSectionTitle}>7 хоногийн идэвх</Text>
                  <View style={styles.runnerProfileWeekRow}>
                    {selectedRunnerWeeklyRuns.map(run => (
                      <Pressable
                        key={run.id}
                        accessibilityLabel={`${run.label} өдрийн гүйлтийн мэдээлэл`}
                        hitSlop={6}
                        style={({ pressed }) => [styles.runnerProfileWeekColumn, pressed && styles.runnerProfileWeekColumnPressed]}
                        onPress={() => setSelectedRunnerRun(run)}
                      >
                        <Text style={styles.runnerProfileWeekDistance}>{run.distanceKm.toFixed(1)}</Text>
                        <View style={[styles.runnerProfileWeekBar, { height: 24 + (run.distanceKm / selectedRunnerMaxWeeklyKm) * 74 }]} />
                        <Text style={styles.runnerProfileWeekLabel}>{run.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.runnerProfileSection}>
                  <Text style={styles.runnerProfileSectionTitle}>Badge</Text>
                  <View style={styles.runnerProfileBadgeRow}>
                    {['5K', '10K', 'STREAK', 'PACE'].map(label => (
                      <View key={label} style={styles.runnerProfileBadge}>
                        <Text style={styles.runnerProfileBadgeText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.runnerProfileSection}>
                  <Text style={styles.runnerProfileSectionTitle}>Амжилттай оролцсон арга хэмжээнүүд</Text>
                  <View style={styles.runnerProfileCompletedList}>
                    {profileCompletedEvents.map(event => (
                      <View key={event.id} style={styles.runnerProfileCompletedRow}>
                        <Image source={{ uri: event.image }} style={styles.runnerProfileCompletedImage} />
                        <View style={styles.runnerProfileCompletedCopy}>
                          <Text style={styles.runnerProfileCompletedTitle} numberOfLines={1}>{event.title}</Text>
                          <Text style={styles.runnerProfileCompletedMeta} numberOfLines={1}>{event.clubName} · {event.distanceKm ? `${event.distanceKm} км` : 'Open run'}</Text>
                        </View>
                        <View style={styles.runnerProfileCompletedBadge}><Text style={styles.runnerProfileCompletedBadgeText}>✓</Text></View>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.runnerProfileSection}>
                  <Text style={styles.runnerProfileSectionTitle}>Дуусгасан challenge-үүд</Text>
                  <View style={styles.runnerProfileCompletedGrid}>
                    {profileCompletedChallenges.map(challenge => (
                      <View key={challenge.id} style={styles.runnerProfileChallengeTile}>
                        <Image source={{ uri: challenge.image }} style={styles.runnerProfileChallengeImage} />
                        <Text style={styles.runnerProfileChallengeTitle} numberOfLines={2}>{challenge.title}</Text>
                        <Text style={styles.runnerProfileChallengeMeta}>{challenge.goalKm} км · Completed</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.runnerProfileSection}>
                  <Text style={styles.runnerProfileSectionTitle}>Марафоны амжилт</Text>
                  <View style={styles.runnerProfileCompletedList}>
                    {profileCompletedMarathons.map(challenge => (
                      <View key={challenge.id} style={styles.runnerProfileMarathonRow}>
                        <View style={styles.runnerProfileMedal}><Text style={styles.runnerProfileMedalText}>42K</Text></View>
                        <View style={styles.runnerProfileCompletedCopy}>
                          <Text style={styles.runnerProfileCompletedTitle} numberOfLines={1}>{challenge.title}</Text>
                          <Text style={styles.runnerProfileCompletedMeta} numberOfLines={1}>{challenge.org} · finisher</Text>
                        </View>
                        <Text style={styles.runnerProfileMarathonStatus}>FINISH</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {selectedRunner.latestPostTitle ? (
                  <View style={styles.runnerProfileSection}>
                    <Text style={styles.runnerProfileSectionTitle}>Сүүлийн нийтлэл</Text>
                    <View style={styles.runnerProfileLatestPost}>
                      <Text style={styles.runnerProfileLatestPostTitle}>{selectedRunner.latestPostTitle}</Text>
                      <Text style={styles.runnerProfileLatestPostMeta}>{selectedRunner.name} · RUNBOOST feed</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.runnerProfileActions}>
                  <Pressable
                    style={[styles.runnerProfileFollowButton, followedRunnerIds.includes(selectedRunner.id) && styles.runnerProfileFollowingButton]}
                    onPress={() => onToggleFollow(selectedRunner.id)}
                  >
                    <Text style={styles.runnerProfileFollowText}>{followedRunnerIds.includes(selectedRunner.id) ? '✓ Найз' : '＋ Дагах'}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.runnerProfileRemoveButton}
                    onPress={() => {
                      onRemoveRunner(selectedRunner.id);
                      setSelectedRunner(null);
                      setSelectedRunnerRun(null);
                    }}
                  >
                    <Text style={styles.runnerProfileRemoveText}>Нуух</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={Boolean(selectedRunnerRun)} animationType="fade" onRequestClose={() => setSelectedRunnerRun(null)}>
        <View style={styles.runnerRunDetailBackdrop}>
          <Pressable style={styles.runnerRunDetailScrim} onPress={() => setSelectedRunnerRun(null)} />
          {selectedRunnerRun ? (
            <View style={styles.runnerRunDetailCard}>
              <ImageBackground source={{ uri: selectedRunnerRun.image }} imageStyle={styles.runnerRunDetailImage} style={styles.runnerRunDetailHero}>
                <LinearGradient colors={['rgba(4,12,16,0.08)', 'rgba(4,12,16,0.92)']} style={styles.runnerRunDetailHeroShade}>
                  <Pressable accessibilityLabel="Гүйлтийн мэдээлэл хаах" style={styles.runnerRunDetailClose} onPress={() => setSelectedRunnerRun(null)}>
                    <Text style={styles.runnerRunDetailCloseText}>×</Text>
                  </Pressable>
                  <Text style={styles.runnerRunDetailEyebrow}>ТУХАЙН ӨДРИЙН ГҮЙЛТ</Text>
                  <Text style={styles.runnerRunDetailTitle}>{selectedRunnerRun.routeTitle}</Text>
                  <Text style={styles.runnerRunDetailMeta}>{selectedRunnerRun.dateLabel} · {selectedRunnerRun.completedAt}</Text>
                </LinearGradient>
              </ImageBackground>

              <View style={styles.runnerRunDetailStats}>
                <View style={styles.runnerRunDetailStat}>
                  <Text style={styles.runnerRunDetailValue}>{selectedRunnerRun.distanceKm.toFixed(1)}</Text>
                  <Text style={styles.runnerRunDetailLabel}>км</Text>
                </View>
                <View style={styles.runnerRunDetailStat}>
                  <Text style={styles.runnerRunDetailValue}>{selectedRunnerRun.duration}</Text>
                  <Text style={styles.runnerRunDetailLabel}>хугацаа</Text>
                </View>
                <View style={styles.runnerRunDetailStat}>
                  <Text style={styles.runnerRunDetailValue}>{selectedRunnerRun.pace}</Text>
                  <Text style={styles.runnerRunDetailLabel}>темп</Text>
                </View>
              </View>

              <View style={styles.runnerRunDetailFooter}>
                <Text style={styles.runnerRunDetailRouteArea}>{selectedRunnerRun.routeArea}</Text>
                <Text style={styles.runnerRunDetailCalories}>{selectedRunnerRun.calories} ккал · {selectedRunner?.name ?? 'Гүйгч'}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={galleryImageIndex !== null && Boolean(selectedClub)} animationType="fade" onRequestClose={() => setGalleryImageIndex(null)}>
        <View style={styles.galleryLightbox}>
          <Pressable style={styles.galleryLightboxBackdrop} onPress={() => setGalleryImageIndex(null)} />
          {selectedClub && galleryImageIndex !== null ? (
            <>
              <ImageBackground
                resizeMode="contain"
                source={{ uri: (selectedClub.galleryImages.length ? selectedClub.galleryImages : [selectedClub.image])[galleryImageIndex] }}
                style={styles.galleryLightboxImage}
              />
              <View style={styles.galleryLightboxHeader}>
                <Text style={styles.galleryLightboxTitle}>{selectedClub.name}</Text>
                <Pressable accessibilityLabel="Зураг хаах" style={styles.galleryLightboxClose} onPress={() => setGalleryImageIndex(null)}><Text style={styles.galleryLightboxCloseText}>×</Text></Pressable>
              </View>
              <View style={styles.galleryLightboxControls}>
                <Pressable
                  accessibilityLabel="Өмнөх зураг"
                  style={styles.galleryLightboxArrow}
                  onPress={() => setGalleryImageIndex(current => current === null ? null : Math.max(0, current - 1))}
                ><Text style={styles.galleryLightboxArrowText}>‹</Text></Pressable>
                <Text style={styles.galleryLightboxIndex}>{galleryImageIndex + 1} / {(selectedClub.galleryImages.length || 1)}</Text>
                <Pressable
                  accessibilityLabel="Дараагийн зураг"
                  style={styles.galleryLightboxArrow}
                  onPress={() => setGalleryImageIndex(current => current === null ? null : Math.min((selectedClub.galleryImages.length || 1) - 1, current + 1))}
                ><Text style={styles.galleryLightboxArrowText}>›</Text></Pressable>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: '#071419', overflow: 'hidden' },
  scroll: { flex: 1, minHeight: 0 },
  backgroundMedia: { ...StyleSheet.absoluteFillObject },
  backgroundImage: { opacity: 0.98 },
  backgroundOverlay: { ...StyleSheet.absoluteFillObject },
  content: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10, marginBottom: 14 },
  brandMark: { width: 34, height: 34, borderRadius: 17, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', overflow: 'hidden', textAlign: 'center', lineHeight: 33, fontSize: 19, fontWeight: '900' },
  brand: { color: colors.text, fontSize: 20, fontWeight: '900' },
  brandSub: { color: '#D5E1E7', fontSize: 10, fontWeight: '800', marginTop: 1 },
  weatherCard: { borderRadius: 22, minHeight: 164, marginBottom: 16, backgroundColor: 'rgba(43,48,58,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#02090c', shadowOpacity: 0.42, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, overflow: 'hidden' },
  weatherContent: { position: 'relative', zIndex: 2, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 13 },
  weatherMotionLayer: { ...StyleSheet.absoluteFillObject, opacity: 1 },
  weatherSkyGradient: { ...StyleSheet.absoluteFillObject },
  weatherAtmosphere: { ...StyleSheet.absoluteFillObject },
  weatherHorizon: { position: 'absolute', left: -20, right: -20, bottom: -42, height: 82, borderTopLeftRadius: 120, borderTopRightRadius: 120, backgroundColor: 'rgba(255,255,255,0.05)' },
  weatherReadabilityShade: { ...StyleSheet.absoluteFillObject },
  sunGlow: { position: 'absolute', right: 18, top: 2, width: 116, height: 116, borderRadius: 58, backgroundColor: 'rgba(251,191,36,0.14)', shadowColor: '#FDE68A', shadowOpacity: 0.55, shadowRadius: 30 },
  sunDisc: { position: 'absolute', right: 42, top: 30, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(254,240,138,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.48)' },
  weatherLightBand: { position: 'absolute', left: -70, top: 12, width: 230, height: 58, borderRadius: 29, backgroundColor: 'rgba(226,232,240,0.12)' },
  cloudBand: { position: 'absolute', height: 58, borderRadius: 29, backgroundColor: 'rgba(203,213,225,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cloudBandOne: { left: -42, top: 20, width: 210 },
  cloudBandTwo: { right: -58, top: 72, width: 250, backgroundColor: 'rgba(148,163,184,0.18)' },
  cloudBandThree: { left: 72, top: 118, width: 220, height: 46, backgroundColor: 'rgba(226,232,240,0.1)' },
  precipitationLayer: { ...StyleSheet.absoluteFillObject },
  rainStreak: { position: 'absolute', width: 2, height: 62, borderRadius: 1, backgroundColor: 'rgba(186,230,253,0.72)' },
  snowDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(240,249,255,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  stormFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.38)' },
  weatherHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  weatherLocation: { color: 'rgba(255,255,255,0.78)', fontSize: 9, fontWeight: '800' },
  weatherSymbol: { color: 'rgba(255,255,255,0.76)', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  weatherHeroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  weatherMain: { flex: 1, minWidth: 0 },
  weatherDate: { color: 'rgba(255,255,255,0.62)', fontSize: 9, fontWeight: '700', marginTop: 3 },
  weatherSceneIcon: { width: 118, height: 82, position: 'relative', marginRight: 2, marginTop: 2 },
  iconSun: { position: 'absolute', right: 18, top: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8D84D', shadowColor: '#F8D84D', shadowOpacity: 0.42, shadowRadius: 14 },
  sunRay: { position: 'absolute', width: 5, height: 14, borderRadius: 3, backgroundColor: '#F8D84D' },
  sunRayTop: { right: 36, top: -8 },
  sunRayRight: { right: 0, top: 25, transform: [{ rotate: '90deg' }] },
  sunRayAngle: { right: 7, top: 3, transform: [{ rotate: '45deg' }] },
  iconCloudMain: { position: 'absolute', left: 14, bottom: 9, width: 80, height: 38, borderRadius: 19, backgroundColor: 'rgba(226,232,240,0.96)', shadowColor: '#FFFFFF', shadowOpacity: 0.18, shadowRadius: 10 },
  iconCloudLeft: { position: 'absolute', left: 8, bottom: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(203,213,225,0.98)' },
  iconCloudTop: { position: 'absolute', left: 39, bottom: 25, width: 47, height: 47, borderRadius: 24, backgroundColor: 'rgba(241,245,249,0.98)' },
  iconRainWrap: { position: 'absolute', left: 30, bottom: -2, width: 50, height: 18 },
  iconRainDrop: { position: 'absolute', top: 0, width: 2, height: 18, borderRadius: 1, backgroundColor: 'rgba(186,230,253,0.92)', transform: [{ rotate: '14deg' }] },
  iconSnow: { position: 'absolute', left: 47, bottom: -3, color: 'rgba(240,249,255,0.96)', fontSize: 20, fontWeight: '900' },
  temperatureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weatherTemp: { color: '#FFFFFF', fontSize: 52, fontWeight: '600', lineHeight: 58 },
  weatherCondition: { color: 'rgba(255,255,255,0.74)', fontSize: 18, fontWeight: '500', marginTop: -2 },
  runReadyBadge: { alignSelf: 'flex-start', height: 22, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, marginTop: 8 },
  runReadyDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cfffad' },
  runReadyText: { color: 'rgba(238,255,226,0.92)', fontSize: 7, fontWeight: '900' },
  aqiBadge: { width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(218,255,200,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.76)', shadowColor: '#d8ffc0', shadowOpacity: 0.2, shadowRadius: 14 },
  aqiLabel: { color: 'rgba(23,37,29,0.62)', fontSize: 7, fontWeight: '900' },
  aqiValue: { color: '#17251d', fontSize: 24, fontWeight: '900', lineHeight: 28 },
  aqiText: { color: '#314d3a', fontSize: 8, fontWeight: '800' },
  weatherMiniRow: { height: 44, flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 8, paddingTop: 9 },
  weatherMiniStat: { flex: 1, alignItems: 'flex-start' },
  weatherMiniDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 8 },
  weatherMiniLabel: { color: 'rgba(255,255,255,0.42)', fontSize: 9, fontWeight: '600' },
  weatherMiniValue: { color: 'rgba(255,255,255,0.86)', fontSize: 14, fontWeight: '600', marginTop: 3 },
  weatherNoteRow: { minHeight: 40, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(8,16,22,0.34)', paddingHorizontal: 10, paddingVertical: 7, marginTop: 9 },
  weatherNoteIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  weatherNoteIconText: { color: 'rgba(255,255,255,0.76)', fontSize: 10, fontWeight: '900' },
  weatherNote: { flex: 1, color: '#D7E3E8', fontSize: 9, fontWeight: '700', lineHeight: 13 },
  timelineHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, marginBottom: 10 },
  postCarousel: { gap: 14, paddingRight: 16, paddingBottom: 6 },
  postSlide: { width: 300 },
  addPostButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)' },
  addPostIcon: { color: colors.accent, fontSize: 23, fontWeight: '700', lineHeight: 25 },
  emptyTimeline: { minHeight: 140, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,27,32,0.8)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)', borderRadius: 16, marginBottom: 16, padding: 18 },
  emptyTimelineTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  emptyTimelineText: { color: '#C7D5DC', fontSize: 10, fontWeight: '700', marginTop: 5 },
  clubRow: { gap: 12, paddingRight: 16, paddingBottom: 10 },
  clubCard: { width: 244, height: 184, borderRadius: 18, overflow: 'hidden', backgroundColor: '#10242a', borderWidth: 1, borderColor: 'rgba(222,247,249,0.3)', shadowColor: '#02090c', shadowOpacity: 0.38, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  clubImageWrap: { flex: 1 },
  clubImage: { borderRadius: 17 },
  clubCardShade: { flex: 1, justifyContent: 'space-between', padding: 13 },
  clubCardTop: { minHeight: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  clubJoinedPill: { height: 27, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  clubJoinedPillText: { color: '#06120e', fontSize: 8, fontWeight: '900' },
  clubName: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  clubCity: { color: '#D7E5EA', fontSize: 10, fontWeight: '800', marginTop: 3 },
  clubStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  clubStat: { color: '#E9F2F5', fontSize: 9, fontWeight: '800' },
  clubStatDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  clubEventRow: { gap: 11, paddingRight: 16, paddingBottom: 10 },
  clubEventCard: { width: 226, minHeight: 198, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(8,27,32,0.94)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)' },
  clubEventImageWrap: { height: 112, alignItems: 'flex-start', justifyContent: 'flex-start', padding: 9 },
  clubEventImage: { borderTopLeftRadius: 15, borderTopRightRadius: 15 },
  clubEventDateBadge: { minHeight: 27, borderRadius: 8, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,17,21,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  clubEventDate: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  clubEventBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  clubEventTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  clubEventClub: { color: colors.accent, fontSize: 9, fontWeight: '900', marginTop: 4 },
  clubEventMeta: { color: '#C8D7DD', fontSize: 9, fontWeight: '700', marginTop: 6 },
  horizontalHintWrap: { position: 'relative' },
  scrollEdgeHint: { position: 'absolute', right: -1, top: 0, bottom: 10, width: 52, borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md },
  achievementRow: { gap: 10, paddingBottom: 13 },
  achievementCard: { width: 220, minHeight: 210, borderRadius: 18, padding: 14, backgroundColor: 'rgba(9,27,32,0.82)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.26)', shadowColor: '#02090c', shadowOpacity: 0.34, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  unlockedAchievementCard: { shadowColor: colors.accent, shadowOpacity: 0.18, shadowRadius: 16 },
  lockedAchievementCard: { opacity: 0.92 },
  achievementTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  achievementIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, overflow: 'hidden' },
  unlockGlow: { position: 'absolute', width: 58, height: 58, borderRadius: 29 },
  trophyIcon: { color: colors.text, fontSize: 28, fontWeight: '900' },
  categoryChip: { minWidth: 62, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  categoryChipText: { fontSize: 10, fontWeight: '900' },
  achievementTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  achievementDescription: { color: '#C9D7DD', fontSize: 11, fontWeight: '800', lineHeight: 15, marginTop: 6, minHeight: 34 },
  achievementProgressTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(71,85,105,0.58)', marginTop: 11, overflow: 'hidden' },
  achievementProgressFill: { height: 7, borderRadius: 4, backgroundColor: colors.secondary },
  achievementFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  achievementMeta: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  rewardPill: { minHeight: 25, borderRadius: 13, borderWidth: 1, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  achievementReward: { color: colors.text, fontSize: 10, fontWeight: '900' },
  discoveryRow: { gap: 10, paddingBottom: 13 },
  discoveryCard: { width: 226, height: 136, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(9,27,32,0.82)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.3)', shadowColor: '#02090c', shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  discoveryImageWrap: { flex: 1 },
  discoveryImage: { borderRadius: radius.md },
  discoveryShade: { flex: 1, justifyContent: 'space-between', padding: 13, backgroundColor: 'rgba(12,20,26,0.36)' },
  difficultyPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(57,255,136,0.9)' },
  difficultyText: { color: colors.bg, fontSize: 10, fontWeight: '900' },
  marathonMedalBadge: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(4,13,17,0.54)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  marathonMedalImage: { width: 38, height: 38 },
  discoveryTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  discoveryMeta: { color: 'rgba(248,250,252,0.76)', fontSize: 11, fontWeight: '800', marginTop: 4 },
  challengeRow: { gap: 10, paddingBottom: 13 },
  challengeCard: { width: 166, height: 92, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(9,27,32,0.82)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)', shadowColor: '#02090c', shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  challengeImageWrap: { flex: 1 },
  challengeImage: { borderRadius: radius.sm },
  challengeShade: { flex: 1, justifyContent: 'space-between', padding: 10, backgroundColor: 'rgba(12,20,26,0.42)' },
  challengeTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  challengeReward: { color: 'rgba(255,255,255,0.78)', fontSize: 8, fontWeight: '700' },
  joinState: { alignSelf: 'flex-start', color: colors.bg, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, overflow: 'hidden', fontSize: 8, fontWeight: '900' },
  routeFeatureHeader: { marginTop: 18, marginBottom: 14 },
  routeFeatureTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 18 },
  routeFeatureSubtitle: { color: '#D0DCE2', fontSize: 14, fontWeight: '700', marginTop: 5 },
  routeCityRow: { gap: 8, paddingBottom: 14 },
  routeCityChip: { height: 34, borderRadius: 17, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,27,32,0.78)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)' },
  activeRouteCityChip: { backgroundColor: 'rgba(57,255,136,0.2)', borderColor: 'rgba(255,255,255,0.34)', shadowColor: colors.primary, shadowOpacity: 0.24, shadowRadius: 10 },
  routeCityText: { color: '#C8D6DC', fontSize: 12, fontWeight: '900' },
  activeRouteCityText: { color: colors.accent },
  homeRouteRow: { gap: routeCardGap, paddingBottom: 26, paddingHorizontal: 48 },
  homeRouteAnimatedCard: { width: routeCardWidth },
  homeRouteCard: { width: routeCardWidth, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(9,27,32,0.86)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.3)', shadowColor: '#02090c', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  homeRouteGlow: { position: 'absolute', left: 18, right: 18, top: -4, height: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.36)', shadowColor: '#ffffff', shadowOpacity: 0.32, shadowRadius: 12, zIndex: 3 },
  homeRouteImageWrap: { height: 178 },
  homeRouteImage: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  homeRouteShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  homeRouteBody: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, backgroundColor: 'rgba(7,22,27,0.9)' },
  homeRouteTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  homeRouteMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  homeRouteDifficulty: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(132,204,22,0.78)', borderWidth: 1, borderColor: 'rgba(190,242,100,0.5)' },
  homeRouteDifficultyText: { color: colors.text, fontSize: 11, fontWeight: '900' },
  homeRouteMeta: { flex: 1, color: 'rgba(248,250,252,0.86)', fontSize: 13, fontWeight: '700' },
  homeRouteArea: { color: 'rgba(248,250,252,0.88)', fontSize: 15, fontWeight: '700', marginTop: 9 },
  homeRouteRecent: { color: '#C4D2D8', fontSize: 13, fontWeight: '700', marginTop: 18 },
  routeScrollEdgeHint: { position: 'absolute', right: -1, top: 0, bottom: 18, width: 58, borderTopRightRadius: 18, borderBottomRightRadius: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#C6D4DB', fontSize: 10, fontWeight: '800', marginTop: 3 },
  sectionLinkButton: { minHeight: 30, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  sectionLinkPressed: { opacity: 0.7 },
  sectionLink: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  achievementFilterRow: { gap: 8, paddingBottom: 10 },
  achievementFilter: { height: 34, borderRadius: 17, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,27,32,0.78)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)' },
  activeAchievementFilter: { backgroundColor: 'rgba(57,255,136,0.2)', borderColor: 'rgba(255,255,255,0.32)', shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 10 },
  achievementFilterText: { color: '#CAD8DE', fontSize: 11, fontWeight: '900' },
  activeAchievementFilterText: { color: colors.accent },
  runnerRow: { gap: 10, paddingBottom: 13 },
  runnerCard: { width: 150, backgroundColor: 'rgba(9,27,32,0.82)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)', padding: 12, alignItems: 'center', shadowColor: '#02090c', shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  runnerCardPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  runnerAvatar: { width: 52, height: 52, borderRadius: 17, borderWidth: 2, borderColor: colors.primary, overflow: 'hidden' },
  runnerImageWrap: { flex: 1 },
  runnerImage: { borderRadius: 13 },
  runnerName: { color: colors.text, fontSize: 12, fontWeight: '900', textAlign: 'center', minHeight: 31, marginTop: 7 },
  runnerMeta: { color: '#C6D4DA', fontSize: 8, marginBottom: 8 },
  runnerActions: { flexDirection: 'row', gap: 6 },
  followButton: { minWidth: 57, borderRadius: 999, alignItems: 'center', paddingVertical: 6, backgroundColor: colors.primary },
  followingButton: { backgroundColor: colors.secondary },
  followText: { color: colors.bg, fontSize: 9, fontWeight: '900' },
  removeButton: { minWidth: 57, borderRadius: 999, alignItems: 'center', paddingVertical: 6, borderWidth: 1, borderColor: colors.line },
  removeText: { color: '#D4E0E5', fontSize: 9, fontWeight: '900' },
  runnerDirectoryBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,7,10,0.7)' },
  runnerDirectoryScrim: { ...StyleSheet.absoluteFillObject },
  runnerDirectorySheet: { width: '100%', maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 18, backgroundColor: '#071A20', borderWidth: 1, borderColor: 'rgba(220,244,248,0.22)', overflow: 'hidden' },
  runnerDirectoryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingHorizontal: 18, paddingBottom: 14 },
  runnerDirectoryEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  runnerDirectoryTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 4 },
  runnerDirectorySubtitle: { color: '#9FB2B9', fontSize: 11, fontWeight: '800', marginTop: 5 },
  runnerDirectoryClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  runnerDirectoryCloseText: { color: '#D7E4E9', fontSize: 25, lineHeight: 27, fontWeight: '700' },
  runnerSearchBox: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 18, marginBottom: 12, borderRadius: 15, paddingHorizontal: 13, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  runnerSearchIcon: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  runnerSearchInput: { flex: 1, height: 44, color: '#FFFFFF', fontSize: 13, fontWeight: '800', padding: 0 },
  runnerSearchClear: { color: '#D7E4E9', fontSize: 20, lineHeight: 22, fontWeight: '800' },
  runnerDirectoryList: { gap: 10, paddingHorizontal: 18, paddingBottom: 24 },
  runnerDirectoryRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, padding: 10, backgroundColor: 'rgba(255,255,255,0.065)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.16)' },
  runnerDirectoryRowPressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
  runnerRankBadge: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.12)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.28)' },
  runnerRankText: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  runnerDirectoryAvatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#10262D', borderWidth: 2, borderColor: 'rgba(57,255,136,0.55)' },
  runnerDirectoryCopy: { flex: 1, minWidth: 0 },
  runnerDirectoryName: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  runnerDirectoryMeta: { color: '#AFC1C8', fontSize: 10, fontWeight: '800', marginTop: 4 },
  runnerDirectoryPills: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  runnerDirectoryPill: { color: '#071A20', fontSize: 8, fontWeight: '900', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.accent },
  runnerDirectoryPostPill: { flexShrink: 1, color: '#D7E4E9', fontSize: 8, fontWeight: '900', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.09)' },
  runnerDirectoryActions: { alignItems: 'center', gap: 7 },
  runnerDirectoryFollow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  runnerDirectoryFollowing: { backgroundColor: colors.secondary },
  runnerDirectoryFollowText: { color: '#071A20', fontSize: 16, fontWeight: '900' },
  runnerDirectoryHide: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  runnerDirectoryHideText: { color: '#D7E4E9', fontSize: 18, lineHeight: 20, fontWeight: '800' },
  runnerDirectoryEmpty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  runnerDirectoryEmptyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  runnerDirectoryEmptyText: { color: '#9FB2B9', fontSize: 11, fontWeight: '800', marginTop: 6 },
  runnerProfileBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 38, backgroundColor: 'rgba(0,7,10,0.7)' },
  runnerProfileScrim: { ...StyleSheet.absoluteFillObject },
  runnerProfileCard: { width: '100%', maxHeight: '94%', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', backgroundColor: '#091b20', borderWidth: 1, borderColor: 'rgba(220,244,248,0.24)', shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 28, shadowOffset: { width: 0, height: 16 } },
  runnerProfileScrollContent: { paddingBottom: 30 },
  runnerProfileHero: { height: 286, backgroundColor: '#10262D' },
  runnerProfileHeroImage: { opacity: 0.56 },
  runnerProfileHeroShade: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 22 },
  runnerProfileClose: { position: 'absolute', right: 14, top: 14, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(4,13,17,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  runnerProfileCloseText: { color: '#D7E4E9', fontSize: 25, lineHeight: 27, fontWeight: '700' },
  runnerProfileAvatar: { alignSelf: 'center', width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: colors.accent, backgroundColor: '#10262D' },
  runnerProfileName: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  runnerProfileHandle: { color: '#D5E3E8', fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  runnerProfileStats: { minHeight: 82, flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  runnerProfileStat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  runnerProfileStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  runnerProfileStatLabel: { color: '#9FB2B9', fontSize: 8, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  runnerProfileDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.14)' },
  runnerProfileBio: { borderRadius: 16, padding: 13, marginHorizontal: 16, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  runnerProfileBioText: { color: '#D5E2E6', fontSize: 11, lineHeight: 17, fontWeight: '800', marginTop: 7 },
  runnerProfileSection: { marginHorizontal: 16, marginTop: 16 },
  runnerProfileSectionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  runnerProfileWeekRow: { height: 138, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderRadius: 16, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  runnerProfileWeekColumn: { width: 34, alignItems: 'center', justifyContent: 'flex-end' },
  runnerProfileWeekColumnPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  runnerProfileWeekDistance: { height: 16, color: '#D7E4E9', fontSize: 8, fontWeight: '900', marginBottom: 4 },
  runnerProfileWeekBar: { width: 12, borderRadius: 6, backgroundColor: colors.accent },
  runnerProfileWeekLabel: { color: '#AFC1C8', fontSize: 9, fontWeight: '800', marginTop: 7 },
  runnerProfileBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  runnerProfileBadge: { minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(182,255,46,0.12)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.3)' },
  runnerProfileBadgeText: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  runnerProfileCompletedList: { gap: 9, marginTop: 10 },
  runnerProfileCompletedRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 9, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  runnerProfileCompletedImage: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#10262D' },
  runnerProfileCompletedCopy: { flex: 1, minWidth: 0 },
  runnerProfileCompletedTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  runnerProfileCompletedMeta: { color: '#9FB2B9', fontSize: 9, fontWeight: '800', marginTop: 4 },
  runnerProfileCompletedBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.16)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.38)' },
  runnerProfileCompletedBadgeText: { color: colors.accent, fontSize: 14, fontWeight: '900' },
  runnerProfileCompletedGrid: { flexDirection: 'row', gap: 9, marginTop: 10 },
  runnerProfileChallengeTile: { flex: 1, minHeight: 144, borderRadius: 16, padding: 9, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  runnerProfileChallengeImage: { width: '100%', height: 70, borderRadius: 11, backgroundColor: '#10262D' },
  runnerProfileChallengeTitle: { color: '#FFFFFF', fontSize: 11, lineHeight: 15, fontWeight: '900', marginTop: 8, minHeight: 30 },
  runnerProfileChallengeMeta: { color: colors.accent, fontSize: 8, fontWeight: '900', marginTop: 5 },
  runnerProfileMarathonRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 10, backgroundColor: 'rgba(182,255,46,0.08)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.24)' },
  runnerProfileMedal: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  runnerProfileMedalText: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  runnerProfileMarathonStatus: { color: colors.accent, fontSize: 8, fontWeight: '900', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden', backgroundColor: 'rgba(182,255,46,0.12)' },
  runnerProfileLatestPost: { borderRadius: 16, padding: 13, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  runnerProfileLatestPostTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  runnerProfileLatestPostMeta: { color: '#9FB2B9', fontSize: 10, fontWeight: '800', marginTop: 6 },
  runnerProfileActions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 18 },
  runnerProfileFollowButton: { flex: 1, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  runnerProfileFollowingButton: { backgroundColor: colors.secondary },
  runnerProfileFollowText: { color: '#102014', fontSize: 12, fontWeight: '900' },
  runnerProfileRemoveButton: { width: 92, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)', backgroundColor: 'rgba(255,255,255,0.06)' },
  runnerProfileRemoveText: { color: '#D9E7EB', fontSize: 12, fontWeight: '900' },
  runnerRunDetailBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,7,10,0.62)' },
  runnerRunDetailScrim: { ...StyleSheet.absoluteFillObject },
  runnerRunDetailCard: { width: '100%', maxWidth: 420, overflow: 'hidden', borderRadius: 24, backgroundColor: '#091b20', borderWidth: 1, borderColor: 'rgba(220,244,248,0.22)', shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 26, shadowOffset: { width: 0, height: 14 } },
  runnerRunDetailHero: { height: 170, backgroundColor: '#10262D' },
  runnerRunDetailImage: { opacity: 0.62 },
  runnerRunDetailHeroShade: { flex: 1, justifyContent: 'flex-end', padding: 16 },
  runnerRunDetailClose: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,13,17,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  runnerRunDetailCloseText: { color: '#D7E4E9', fontSize: 22, lineHeight: 24, fontWeight: '800' },
  runnerRunDetailEyebrow: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  runnerRunDetailTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 5 },
  runnerRunDetailMeta: { color: '#C6D4DA', fontSize: 10, fontWeight: '800', marginTop: 5 },
  runnerRunDetailStats: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  runnerRunDetailStat: { flex: 1, minHeight: 70, justifyContent: 'center', borderRadius: 16, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  runnerRunDetailValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  runnerRunDetailLabel: { color: '#9FB2B9', fontSize: 8, fontWeight: '900', marginTop: 5 },
  runnerRunDetailFooter: { padding: 14, gap: 5 },
  runnerRunDetailRouteArea: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  runnerRunDetailCalories: { color: '#9FB2B9', fontSize: 10, fontWeight: '800' },
  clubModalRoot: { flex: 1, justifyContent: 'flex-end' },
  clubModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,7,10,0.72)' },
  clubSheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', backgroundColor: '#091b20', borderWidth: 1, borderColor: 'rgba(221,247,249,0.28)' },
  clubSheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginTop: 9, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.34)' },
  clubSheetContent: { paddingBottom: 28 },
  clubHero: { height: 224 },
  clubHeroImage: { opacity: 0.94 },
  clubHeroShade: { flex: 1, justifyContent: 'space-between', padding: 16 },
  clubCloseButton: { alignSelf: 'flex-end', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,13,17,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  clubCloseText: { color: '#FFFFFF', fontSize: 25, lineHeight: 27, fontWeight: '500' },
  clubHeroCopy: { paddingRight: 18 },
  clubHeroMeta: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  clubHeroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 5 },
  clubSheetStats: { minHeight: 78, flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  clubSheetStat: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clubSheetStatValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  clubSheetStatLabel: { color: '#BFD0D6', fontSize: 8, fontWeight: '800', marginTop: 4 },
  clubSheetDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.16)' },
  clubDescription: { color: '#D5E2E6', fontSize: 12, lineHeight: 18, fontWeight: '700', marginHorizontal: 18, marginTop: 18 },
  clubModalContactSection: { marginHorizontal: 17, marginTop: 18 },
  clubModalSectionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginBottom: 9 },
  clubModalContact: { color: '#EAF5F7', fontSize: 11, lineHeight: 16, fontWeight: '800', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  clubModalSocialRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  clubModalSocialButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  clubModalSocialButtonDisabled: { opacity: 0.82 },
  clubModalSocialIcon: { fontSize: 15, fontWeight: '900' },
  clubModalSocialWebIcon: { fontSize: 9, letterSpacing: 0 },
  clubGallerySection: { marginTop: 20 },
  clubGalleryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 17, marginBottom: 10 },
  clubGalleryTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  clubGalleryCount: { color: '#B9CBD1', fontSize: 9, fontWeight: '800' },
  clubGalleryRow: { gap: 10, paddingHorizontal: 16, paddingRight: 24 },
  clubGalleryImageWrap: { width: 190, height: 126, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 9 },
  clubGalleryImage: { borderRadius: 12 },
  clubGalleryZoom: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,13,17,0.74)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  clubGalleryZoomText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  clubModalEvents: { marginTop: 20 },
  clubModalEventsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 17, marginBottom: 9 },
  clubModalEventsTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  clubModalEventsCount: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  clubModalEventRow: { gap: 10, paddingHorizontal: 17, paddingRight: 24 },
  clubModalEventCard: { width: 154, minHeight: 150, overflow: 'hidden', borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  clubModalEventImageWrap: { height: 80, alignItems: 'flex-start', justifyContent: 'flex-start', padding: 8 },
  clubModalEventImage: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  clubModalEventDate: { minHeight: 26, borderRadius: 8, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,17,21,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  clubModalEventDateText: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  clubModalEventCopy: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 11 },
  clubModalEventTitle: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  clubModalEventMeta: { color: '#BFD0D6', fontSize: 9, fontWeight: '700', marginTop: 3 },
  clubJoinInfoCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 22, padding: 14, borderRadius: 16, backgroundColor: 'rgba(168,255,24,0.1)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.32)' },
  clubJoinInfoIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  clubJoinInfoIconText: { color: '#06120e', fontSize: 22, lineHeight: 24, fontWeight: '900' },
  clubJoinInfoCopy: { flex: 1 },
  clubJoinInfoTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  clubJoinInfoText: { color: '#C8D9DE', fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 5 },
  clubJoinButton: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 22, backgroundColor: colors.accent },
  clubLeaveButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  clubJoinText: { color: '#06120e', fontSize: 14, fontWeight: '900' },
  clubLeaveText: { color: '#FFFFFF' },
  clubPageRoot: { flex: 1, backgroundColor: '#071419' },
  clubPageContent: { paddingBottom: 42 },
  clubPageHero: { height: 330 },
  clubPageHeroImage: { opacity: 0.96 },
  clubPageHeroShade: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 50, paddingBottom: 24 },
  clubPageBack: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,12,15,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  clubPageBackText: { color: '#FFFFFF', fontSize: 31, lineHeight: 33 },
  clubPageCity: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  clubPageTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 5 },
  clubPageMembers: { color: '#D5E2E6', fontSize: 11, fontWeight: '800', marginTop: 7 },
  clubPageStats: { minHeight: 86, flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: -15, borderRadius: 17, backgroundColor: 'rgba(13,37,42,0.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18 },
  clubPageStat: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  clubPageStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  clubPageStatLabel: { color: '#AEC1C8', fontSize: 7, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  clubPageStatDivider: { width: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.15)' },
  clubPageSection: { marginTop: 25, paddingHorizontal: 17 },
  clubPageSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clubPageSectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  clubPageSectionCount: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  clubPageDescription: { color: '#C8D8DE', fontSize: 12, lineHeight: 19, fontWeight: '700', marginTop: 10 },
  clubPageContact: { color: '#EAF5F7', fontSize: 12, lineHeight: 18, fontWeight: '800', marginTop: 10, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  clubSocialRow: { flexDirection: 'row', gap: 10, marginTop: 11 },
  clubSocialButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  clubSocialButtonDisabled: { opacity: 0.82 },
  clubSocialIcon: { fontSize: 16, fontWeight: '900' },
  clubSocialWebIcon: { fontSize: 10, letterSpacing: 0 },
  clubPageEvent: { minHeight: 126, flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  clubPageEventImageWrap: { width: 96, height: 96 },
  clubPageEventImage: { borderRadius: 10 },
  clubPageEventCopy: { flex: 1, justifyContent: 'center' },
  clubPageEventDate: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  clubPageEventTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginTop: 4 },
  clubPageEventMeta: { color: '#B8CAD0', fontSize: 9, fontWeight: '700', marginTop: 5 },
  clubPageEventActions: { flexDirection: 'row', gap: 7, marginTop: 9 },
  clubPageEventJoin: { height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.accent },
  clubPageEventJoined: { backgroundColor: 'rgba(57,255,136,0.12)', borderWidth: 1, borderColor: 'rgba(57,255,136,0.38)' },
  clubPageEventJoinText: { color: '#06120e', fontSize: 8, fontWeight: '900' },
  clubPageEventJoinedText: { color: colors.accent },
  clubPageEventDetails: { height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  clubPageEventDetailsText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  clubPageEmpty: { minHeight: 70, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  clubPageEmptyText: { color: '#AFC1C8', fontSize: 10, fontWeight: '700' },
  clubPageGallery: { gap: 10, paddingTop: 11, paddingRight: 17 },
  clubPageGalleryItem: { width: 180, height: 120 },
  clubPageGalleryImage: { borderRadius: 12 },
  clubPageJoin: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 28, backgroundColor: colors.accent },
  clubPageJoined: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  clubPageJoinText: { color: '#06120e', fontSize: 14, fontWeight: '900' },
  clubPageJoinedText: { color: '#FFFFFF' },
  eventDetailModalRoot: { flex: 1, justifyContent: 'flex-end' },
  eventDetailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,6,9,0.74)' },
  eventDetailSheet: { maxHeight: '91%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', backgroundColor: '#071419', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  eventDetailContent: { paddingBottom: 30 },
  eventDetailHero: { height: 235 },
  eventDetailImage: { opacity: 0.96 },
  eventDetailShade: { flex: 1, justifyContent: 'space-between', padding: 16 },
  eventDetailClose: { alignSelf: 'flex-end', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,12,15,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)' },
  eventDetailCloseText: { color: '#FFFFFF', fontSize: 27, lineHeight: 29 },
  eventDetailClub: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  eventDetailTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 5 },
  eventDetailMetaRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginTop: 15, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.07)' },
  eventDetailMetaItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  eventDetailMetaValue: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  eventDetailMetaLabel: { color: '#AFC1C8', fontSize: 7, fontWeight: '800', marginTop: 4 },
  eventDetailMetaDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.15)' },
  eventDetailQuickGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 15, marginTop: 12 },
  eventDetailQuickItem: { flex: 1, minHeight: 72, borderRadius: 14, padding: 12, justifyContent: 'space-between', backgroundColor: 'rgba(57,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(57,255,136,0.18)' },
  eventDetailQuickValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  eventDetailQuickLabel: { color: '#9FB4BC', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  eventDetailSection: { marginHorizontal: 17, marginTop: 22 },
  eventDetailSectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginBottom: 10 },
  eventDetailDescription: { color: '#C7D7DD', fontSize: 12, lineHeight: 19, fontWeight: '700' },
  eventDetailLocation: { color: colors.accent, fontSize: 10, fontWeight: '900', marginTop: 12 },
  eventAdviceRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  eventAdviceNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(57,255,136,0.13)' },
  eventAdviceNumberText: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  eventAdviceText: { flex: 1, color: '#C7D7DD', fontSize: 10, lineHeight: 15, fontWeight: '700' },
  eventDetailJoin: { height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 24, backgroundColor: colors.accent },
  eventDetailJoined: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  eventDetailJoinText: { color: '#06120e', fontSize: 13, fontWeight: '900' },
  eventDetailJoinedText: { color: '#FFFFFF' },
  eventSuccessRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  eventSuccessBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,6,9,0.72)' },
  eventSuccessCard: { width: '100%', maxWidth: 360, borderRadius: 22, padding: 22, alignItems: 'center', backgroundColor: '#071419', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  eventSuccessMark: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  eventSuccessMarkText: { color: '#06120e', fontSize: 28, fontWeight: '900' },
  eventSuccessTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 16 },
  eventSuccessBody: { color: '#C7D7DD', fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 7 },
  clubSuccessTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 23, fontWeight: '900', textAlign: 'center', marginTop: 14 },
  clubSuccessBody: { color: '#C7D7DD', fontSize: 11, lineHeight: 16, fontWeight: '800', textAlign: 'center', marginTop: 8, paddingHorizontal: 4 },
  eventSuccessEvent: { color: colors.accent, fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 13 },
  eventSuccessButton: { height: 46, alignSelf: 'stretch', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, backgroundColor: colors.accent },
  eventSuccessButtonText: { color: '#06120e', fontSize: 13, fontWeight: '900' },
  galleryLightbox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020506' },
  galleryLightboxBackdrop: { ...StyleSheet.absoluteFillObject },
  galleryLightboxImage: { width: '100%', height: '78%' },
  galleryLightboxHeader: { position: 'absolute', left: 18, right: 18, top: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  galleryLightboxTitle: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  galleryLightboxClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  galleryLightboxCloseText: { color: '#FFFFFF', fontSize: 27, lineHeight: 29 },
  galleryLightboxControls: { position: 'absolute', left: 18, right: 18, bottom: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  galleryLightboxArrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  galleryLightboxArrowText: { color: '#FFFFFF', fontSize: 30, lineHeight: 32 },
  galleryLightboxIndex: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }
});
