import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  onToggleClubMembership: (club: RunningClub) => void;
  onToggleClubEventParticipation: (event: ClubEvent) => void;
  onToggleFollow: (runnerId: string) => void;
  onRemoveRunner: (runnerId: string) => void;
  onPostSocialChange: (postId: string, patch: Partial<Pick<Post, 'likeCount' | 'commentCount' | 'likedByMe' | 'isFollowing'>>) => void;
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

function getWeatherSymbol(condition?: string) {
  const mood = getWeatherMood(condition);
  if (mood === 'rain') return '≋';
  if (mood === 'snow') return '✦';
  if (mood === 'storm') return 'ϟ';
  if (mood === 'cloudy') return '◒';
  return '☼';
}

function getAqiLabel(aqi: number | null) {
  if (aqi === null) {
    return 'Тодорхойгүй';
  }

  if (aqi <= 50) {
    return 'Сайн';
  }

  if (aqi <= 100) {
    return 'Дунд';
  }

  if (aqi <= 150) {
    return 'Эмзэг хүмүүст муу';
  }

  if (aqi <= 200) {
    return 'Муу';
  }

  if (aqi <= 300) {
    return 'Маш муу';
  }

  return 'Аюултай';
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
      {mood === 'clear' ? (
        <>
          <Animated.View style={[styles.sunGlow, { opacity: pulse }]} />
          <Animated.View style={[styles.weatherLightBand, { transform: [{ translateX: driftX }, { rotate: '-10deg' }] }]} />
        </>
      ) : null}
      {mood === 'cloudy' || mood === 'rain' || mood === 'storm' ? (
        <>
          <Animated.View style={[styles.cloudBand, styles.cloudBandOne, { transform: [{ translateX: driftX }] }]} />
          <Animated.View style={[styles.cloudBand, styles.cloudBandTwo, { transform: [{ translateX: reverseDriftX }] }]} />
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
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedAchievementCategory, setSelectedAchievementCategory] = useState<AchievementCategory>('distance');
  const [selectedRouteCity, setSelectedRouteCity] = useState<RouteCity>('ulaanbaatar');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [galleryImageIndex, setGalleryImageIndex] = useState<number | null>(null);
  const [clubPageOpen, setClubPageOpen] = useState(false);
  const [selectedClubEvent, setSelectedClubEvent] = useState<ClubEvent | null>(null);
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
        <WeatherMotionBackground mood={getWeatherMood(weather?.condition)} />
        <View style={styles.weatherContent}>
          <View style={styles.weatherHeaderRow}>
            <View>
              <Text style={styles.weatherLocation}>УЛААНБААТАР</Text>
              <Text style={styles.weatherDate}>{weather?.dateLabel ?? 'Цаг агаар'}{weather?.updatedAt ? ` · ${weather.updatedAt}` : ''}</Text>
            </View>
            <Text style={styles.weatherSymbol}>{getWeatherSymbol(weather?.condition)}</Text>
          </View>

          <View style={styles.weatherHeroRow}>
            <View style={styles.weatherMain}>
              <View style={styles.temperatureRow}>
                <Text style={styles.weatherTemp}>{weather ? `${weather.temperature > 0 ? '+' : ''}${weather.temperature}°` : '--°'}</Text>
                <View>
                  <Text style={styles.weatherCondition}>{weather?.condition ?? 'Шинэчилж байна'}</Text>
                  <View style={styles.runReadyBadge}><View style={styles.runReadyDot}/><Text style={styles.runReadyText}>{weather?.aqi !== null && weather?.aqi !== undefined && weather.aqi <= 100 ? 'ГҮЙХЭД ТОХИРОМЖТОЙ' : 'АНХААРАЛТАЙ ГҮЙХ'}</Text></View>
                </View>
              </View>
            </View>
            <View style={styles.aqiBadge}>
              <Text style={styles.aqiLabel}>АГААР</Text>
              <Text style={styles.aqiValue}>{weather?.aqi ?? '--'}</Text>
              <Text style={styles.aqiText}>{getAqiLabel(weather?.aqi ?? null)}</Text>
            </View>
          </View>

          <View style={styles.weatherMiniRow}>
            <View style={styles.weatherMiniStat}>
              <Text style={styles.weatherMiniLabel}>ЧИЙГШИЛ</Text>
              <Text style={styles.weatherMiniValue}>{weather ? `${weather.humidity}%` : '--'}</Text>
            </View>
            <View style={styles.weatherMiniDivider}/>
            <View style={styles.weatherMiniStat}>
              <Text style={styles.weatherMiniLabel}>САЛХИ</Text>
              <Text style={styles.weatherMiniValue}>{weather ? `${weather.windSpeed} м/с` : '--'}</Text>
            </View>
            <View style={styles.weatherMiniDivider}/>
            <View style={styles.weatherMiniStat}>
              <Text style={styles.weatherMiniLabel}>ТӨЛӨВ</Text>
              <Text style={styles.weatherMiniValue}>Одоо</Text>
            </View>
          </View>

          <View style={styles.weatherNoteRow}>
            <View style={styles.weatherNoteIcon}><Text style={styles.weatherNoteIconText}>i</Text></View>
            <Text numberOfLines={2} style={styles.weatherNote}>
              {weatherError ?? weather?.note ?? (weatherLoading ? 'Одоогийн цаг агаарын мэдээллийг шинэчилж байна.' : 'Цаг агаарын мэдээлэл түр боломжгүй байна.')}
              {weather?.isFallbackLocation ? ' Улаанбаатарын мэдээлэл ашиглав.' : ''}
            </Text>
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
            <Pressable key={event.id} style={styles.clubEventCard} onPress={() => setSelectedClubId(event.clubId)}>
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
        <Text style={styles.sectionLink}>Бүгдийг харах</Text>
      </View>

      <View style={styles.horizontalHintWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.runnerRow}>
          {runners.map(runner => {
            const followed = followedRunnerIds.includes(runner.id);
            return (
              <View key={runner.id} style={styles.runnerCard}>
                <View style={styles.runnerAvatar}>
                  <ImageBackground source={{ uri: runner.avatar }} imageStyle={styles.runnerImage} style={styles.runnerImageWrap} />
                </View>
                <Text style={styles.runnerName} numberOfLines={2}>{runner.name}</Text>
                <Text style={styles.runnerMeta}>{runner.totalKm.toLocaleString()} км гүйсэн</Text>
                <View style={styles.runnerActions}>
                  <Pressable
                    style={[styles.followButton, followed && styles.followingButton]}
                    onPress={() => onToggleFollow(runner.id)}
                  >
                    <Text style={styles.followText}>{followed ? 'Following' : 'Follow'}</Text>
                  </Pressable>
                  <Pressable style={styles.removeButton} onPress={() => onRemoveRunner(runner.id)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
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
              <PostCard post={post} currentUserId={currentUserId} onSocialChange={onPostSocialChange} />
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
                    <Text style={styles.clubModalEventsTitle}>Ойрын арга хэмжээ</Text>
                    {selectedClubEvents.map(event => (
                      <View key={event.id} style={styles.clubModalEventRow}>
                        <View style={styles.clubModalEventDate}><Text style={styles.clubModalEventDateText}>{formatClubEventDate(event.startsAt)}</Text></View>
                        <View style={styles.clubModalEventCopy}><Text style={styles.clubModalEventTitle}>{event.title}</Text><Text style={styles.clubModalEventMeta}>{event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text></View>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Pressable style={styles.clubVisitButton} onPress={() => setClubPageOpen(true)}>
                  <Text style={styles.clubVisitText}>Клуб руу зочлох</Text>
                  <Text style={styles.clubVisitArrow}>›</Text>
                </Pressable>

                <Pressable
                  style={[styles.clubJoinButton, selectedClub.joined && styles.clubLeaveButton]}
                  onPress={() => onToggleClubMembership(selectedClub)}
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
                <View style={styles.clubPageSectionHeader}><Text style={styles.clubPageSectionTitle}>Төлөвлөсөн арга хэмжээнүүд</Text><Text style={styles.clubPageSectionCount}>{selectedClubEvents.length}</Text></View>
                {selectedClubEvents.length ? selectedClubEvents.map(event => (
                  <View key={event.id} style={styles.clubPageEvent}>
                    <ImageBackground source={{ uri: event.image }} imageStyle={styles.clubPageEventImage} style={styles.clubPageEventImageWrap} />
                    <View style={styles.clubPageEventCopy}>
                      <Text style={styles.clubPageEventDate}>{formatClubEventDate(event.startsAt)}</Text>
                      <Text style={styles.clubPageEventTitle}>{event.title}</Text>
                      <Text style={styles.clubPageEventMeta}>{event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
                      <View style={styles.clubPageEventActions}>
                        <Pressable style={[styles.clubPageEventJoin, joinedClubEventIds.includes(event.id) && styles.clubPageEventJoined]} onPress={() => onToggleClubEventParticipation(event)}>
                          <Text style={[styles.clubPageEventJoinText, joinedClubEventIds.includes(event.id) && styles.clubPageEventJoinedText]}>{joinedClubEventIds.includes(event.id) ? 'Оролцоно' : 'Оролцох'}</Text>
                        </Pressable>
                        <Pressable style={styles.clubPageEventDetails} onPress={() => setSelectedClubEvent(event)}><Text style={styles.clubPageEventDetailsText}>Дэлгэрэнгүй</Text></Pressable>
                      </View>
                    </View>
                  </View>
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

              <Pressable style={[styles.clubPageJoin, selectedClub.joined && styles.clubPageJoined]} onPress={() => onToggleClubMembership(selectedClub)}>
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
                  <View style={styles.eventDetailMetaItem}><Text style={styles.eventDetailMetaValue}>{formatClubEventDate(selectedClubEvent.startsAt)}</Text><Text style={styles.eventDetailMetaLabel}>Огноо, цаг</Text></View>
                  <View style={styles.eventDetailMetaDivider} />
                  <View style={styles.eventDetailMetaItem}><Text style={styles.eventDetailMetaValue}>{selectedClubEvent.distanceKm ? `${selectedClubEvent.distanceKm} км` : 'Нээлттэй'}</Text><Text style={styles.eventDetailMetaLabel}>Зай</Text></View>
                  <View style={styles.eventDetailMetaDivider} />
                  <View style={styles.eventDetailMetaItem}><Text style={styles.eventDetailMetaValue}>{selectedClubEvent.participantCount}</Text><Text style={styles.eventDetailMetaLabel}>Оролцогч</Text></View>
                </View>
                <View style={styles.eventDetailSection}><Text style={styles.eventDetailSectionTitle}>Ерөнхий мэдээлэл</Text><Text style={styles.eventDetailDescription}>{selectedClubEvent.description}</Text><Text style={styles.eventDetailLocation}>⌖ {selectedClubEvent.location}</Text></View>
                <View style={styles.eventDetailSection}><Text style={styles.eventDetailSectionTitle}>Бэлтгэлийн зөвлөмж</Text>{selectedClubEvent.advice.map((advice, index) => <View key={`${advice}-${index}`} style={styles.eventAdviceRow}><View style={styles.eventAdviceNumber}><Text style={styles.eventAdviceNumberText}>{index + 1}</Text></View><Text style={styles.eventAdviceText}>{advice}</Text></View>)}</View>
                <Pressable style={[styles.eventDetailJoin, joinedClubEventIds.includes(selectedClubEvent.id) && styles.eventDetailJoined]} onPress={() => onToggleClubEventParticipation(selectedClubEvent)}><Text style={[styles.eventDetailJoinText, joinedClubEventIds.includes(selectedClubEvent.id) && styles.eventDetailJoinedText]}>{joinedClubEventIds.includes(selectedClubEvent.id) ? 'Оролцохоо болих' : 'Арга хэмжээнд оролцох'}</Text></Pressable>
              </ScrollView>
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
  weatherCard: { borderRadius: 22, minHeight: 242, marginBottom: 16, backgroundColor: 'rgba(9,28,32,0.7)', borderWidth: 1, borderColor: 'rgba(224,246,250,0.36)', shadowColor: '#02090c', shadowOpacity: 0.42, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, overflow: 'hidden' },
  weatherContent: { position: 'relative', zIndex: 2, padding: 18 },
  weatherMotionLayer: { ...StyleSheet.absoluteFillObject, opacity: 0.1 },
  weatherSkyGradient: { ...StyleSheet.absoluteFillObject },
  sunGlow: { position: 'absolute', right: 18, top: 18, width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(56,189,248,0.24)', shadowColor: '#7DD3FC', shadowOpacity: 0.5, shadowRadius: 28 },
  weatherLightBand: { position: 'absolute', left: -70, top: 18, width: 190, height: 46, borderRadius: 23, backgroundColor: 'rgba(125,211,252,0.14)' },
  cloudBand: { position: 'absolute', height: 48, borderRadius: 24, backgroundColor: 'rgba(148,163,184,0.18)' },
  cloudBandOne: { left: -32, top: 28, width: 172 },
  cloudBandTwo: { right: -42, top: 86, width: 210, backgroundColor: 'rgba(203,213,225,0.12)' },
  precipitationLayer: { ...StyleSheet.absoluteFillObject },
  rainStreak: { position: 'absolute', width: 2, height: 54, borderRadius: 1, backgroundColor: 'rgba(125,211,252,0.5)' },
  snowDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(240,249,255,0.72)' },
  stormFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.32)' },
  weatherHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  weatherLocation: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  weatherSymbol: { color: 'rgba(255,255,255,0.76)', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  weatherHeroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  weatherMain: { flex: 1, minWidth: 0 },
  weatherDate: { color: '#D2E0E6', fontSize: 10, fontWeight: '700', marginTop: 3 },
  temperatureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weatherTemp: { color: colors.text, fontSize: 48, fontWeight: '800', lineHeight: 54 },
  weatherCondition: { color: '#ffffff', fontSize: 13, fontWeight: '800', marginBottom: 6 },
  runReadyBadge: { alignSelf: 'flex-start', height: 22, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(215,255,192,0.14)', borderWidth: 1, borderColor: 'rgba(215,255,192,0.26)', paddingHorizontal: 8 },
  runReadyDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cfffad' },
  runReadyText: { color: '#dfffc7', fontSize: 7, fontWeight: '900' },
  aqiBadge: { width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(218,255,200,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.76)', shadowColor: '#d8ffc0', shadowOpacity: 0.2, shadowRadius: 14 },
  aqiLabel: { color: 'rgba(23,37,29,0.62)', fontSize: 7, fontWeight: '900' },
  aqiValue: { color: '#17251d', fontSize: 24, fontWeight: '900', lineHeight: 28 },
  aqiText: { color: '#314d3a', fontSize: 8, fontWeight: '800' },
  weatherMiniRow: { height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', marginTop: 13 },
  weatherMiniStat: { flex: 1, alignItems: 'center' },
  weatherMiniDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.16)' },
  weatherMiniLabel: { color: '#C4D2D9', fontSize: 7, fontWeight: '900' },
  weatherMiniValue: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 3 },
  weatherNoteRow: { minHeight: 40, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(8,16,22,0.2)', paddingHorizontal: 10, paddingVertical: 7, marginTop: 9 },
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
  sectionLink: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  achievementFilterRow: { gap: 8, paddingBottom: 10 },
  achievementFilter: { height: 34, borderRadius: 17, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,27,32,0.78)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)' },
  activeAchievementFilter: { backgroundColor: 'rgba(57,255,136,0.2)', borderColor: 'rgba(255,255,255,0.32)', shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 10 },
  achievementFilterText: { color: '#CAD8DE', fontSize: 11, fontWeight: '900' },
  activeAchievementFilterText: { color: colors.accent },
  runnerRow: { gap: 10, paddingBottom: 13 },
  runnerCard: { width: 150, backgroundColor: 'rgba(9,27,32,0.82)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(220,244,248,0.28)', padding: 12, alignItems: 'center', shadowColor: '#02090c', shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
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
  clubGallerySection: { marginTop: 20 },
  clubGalleryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 17, marginBottom: 10 },
  clubGalleryTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  clubGalleryCount: { color: '#B9CBD1', fontSize: 9, fontWeight: '800' },
  clubGalleryRow: { gap: 10, paddingHorizontal: 16, paddingRight: 24 },
  clubGalleryImageWrap: { width: 190, height: 126, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 9 },
  clubGalleryImage: { borderRadius: 12 },
  clubGalleryZoom: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,13,17,0.74)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  clubGalleryZoomText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  clubModalEvents: { marginHorizontal: 17, marginTop: 20 },
  clubModalEventsTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginBottom: 9 },
  clubModalEventRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', paddingVertical: 10 },
  clubModalEventDate: { width: 72 },
  clubModalEventDateText: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  clubModalEventCopy: { flex: 1 },
  clubModalEventTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  clubModalEventMeta: { color: '#BFD0D6', fontSize: 9, fontWeight: '700', marginTop: 3 },
  clubJoinButton: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 22, backgroundColor: colors.accent },
  clubLeaveButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  clubJoinText: { color: '#06120e', fontSize: 14, fontWeight: '900' },
  clubLeaveText: { color: '#FFFFFF' },
  clubVisitButton: { height: 48, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 22, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  clubVisitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  clubVisitArrow: { color: colors.accent, fontSize: 25, lineHeight: 27 },
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
