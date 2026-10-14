import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Challenge, MediaItem } from '../types';
import type { ClubEvent } from '../clubs';
import { colors } from '../theme';
import { GoogleRouteMap } from '../components/GoogleRouteMap';
import { RUN_ROUTES, type Point, type RouteOption } from '../routes';
import {
  readBackgroundRunSnapshot,
  startBackgroundRunTracking,
  stopBackgroundRunTracking
} from '../../lib/runTracking';

function isSingleRunChallenge(challenge: Challenge | null) {
  return challenge?.completionMode === 'single_run' || (!challenge?.completionMode && challenge?.group === '5k');
}

type Props = {
  activeChallenge: Challenge | null;
  activeChallengeProgressKm?: number;
  activeClubEvent?: ClubEvent | null;
  routes: RouteOption[];
  selectedRouteId?: string | null;
  onOpenComposer: (draft?: {
    title?: string;
    description?: string;
    media?: MediaItem[];
    runMapMedia?: MediaItem;
  }) => void;
  onLiveRunUpdate: (run: {
    routeId: string | null; routeTitle: string; distanceKm: number; durationSeconds: number;
    clubId?: string | null; eventId?: string | null;
    latitude: number | null; longitude: number | null; startedAt: string; paused: boolean;
  }) => Promise<void>;
  onLiveRunEnd: () => Promise<void>;
  onExitFinishedRun: () => void;
  onSaveRun: (run: {
    routeId: string | null;
    challengeId: string | null;
    distanceKm: number;
    durationSeconds: number;
    calories: number;
    coordinates: Point[];
    startedAt: string;
    completedAt: string;
  }) => Promise<void>;
};

const EARTH_RADIUS_KM = 6371;
const CUSTOM_ROUTE_ID = 'custom-route';
const CUSTOM_ROUTE_TITLE = 'Өөрийн маршрут';
const MAX_ACCEPTED_ACCURACY_METERS = 50;
const MAX_FIRST_POINT_ACCURACY_METERS = 100;
const MIN_SEGMENT_DISTANCE_METERS = 2;
const MAX_RUNNING_SPEED_METERS_PER_SECOND = 4;
const MAX_RUNNING_SEGMENT_SPEED_METERS_PER_SECOND = 4.8;
type RunNotice = { title: string; message: string };

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceBetweenPoints(start: Point, end: Point) {
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getRouteDistance(coordinates: Point[]) {
  return coordinates.reduce((distance, point, index) => {
    if (index === 0) {
      return distance;
    }

    return distance + getDistanceBetweenPoints(coordinates[index - 1], point);
  }, 0);
}

function isValidPoint(point: Point) {
  return Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90
    && Math.abs(point.longitude) <= 180;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatPace(distanceKm: number, elapsedSeconds: number) {
  if (distanceKm <= 0 || elapsedSeconds <= 0) {
    return '--';
  }

  const secondsPerKm = Math.round(elapsedSeconds / distanceKm);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function escapeSvgText(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }[character] ?? character));
}

function createRunMapMedia(input: {
  coordinates: Point[];
  distanceKm: number;
  durationSeconds: number;
  pace: string;
  routeTitle: string;
}): MediaItem {
  const width = 1200;
  const height = 900;
  const mapLeft = 72;
  const mapTop = 76;
  const mapWidth = width - 144;
  const mapHeight = 560;
  const coordinates = input.coordinates.length > 1 ? input.coordinates : [
    { latitude: 47.9187, longitude: 106.9176 },
    { latitude: 47.9192, longitude: 106.9188 }
  ];
  const latitudes = coordinates.map(point => point.latitude);
  const longitudes = coordinates.map(point => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = Math.max(0.001, maxLatitude - minLatitude);
  const longitudeRange = Math.max(0.001, maxLongitude - minLongitude);
  const points = coordinates.map(point => {
    const x = mapLeft + ((point.longitude - minLongitude) / longitudeRange) * mapWidth;
    const y = mapTop + (1 - ((point.latitude - minLatitude) / latitudeRange)) * mapHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const start = points.split(' ')[0];
  const end = points.split(' ').at(-1) ?? start;
  const [startX, startY] = start.split(',');
  const [endX, endY] = end.split(',');
  const safeTitle = escapeSvgText(input.routeTitle);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06111f"/><stop offset="0.55" stop-color="#0b1828"/><stop offset="1" stop-color="#142033"/></linearGradient>
    <linearGradient id="route" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#39ff88"/><stop offset="1" stop-color="#06b6d4"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <path d="M120 158 H1080 M120 278 H1080 M120 398 H1080 M120 518 H1080 M240 96 V620 M420 96 V620 M600 96 V620 M780 96 V620 M960 96 V620" stroke="#ffffff" stroke-opacity="0.055" stroke-width="2"/>
  <polyline points="${points}" fill="none" stroke="#0a1220" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>
  <polyline points="${points}" fill="none" stroke="url(#route)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
  <circle cx="${startX}" cy="${startY}" r="18" fill="#06120e" stroke="#39ff88" stroke-width="8"/>
  <circle cx="${endX}" cy="${endY}" r="24" fill="#b6ff2e" stroke="#ffffff" stroke-opacity="0.65" stroke-width="6"/>
  <text x="72" y="704" fill="#b6ff2e" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900">RUNBOOST</text>
  <text x="72" y="746" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900">${safeTitle}</text>
  <text x="72" y="790" fill="#94a3b8" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700">Гүйлтийн мэп ба GPS зам</text>
  <g font-family="Inter, Arial, sans-serif" font-weight="900">
    <text x="690" y="724" fill="#94a3b8" font-size="20">ЗАЙ</text><text x="690" y="766" fill="#ffffff" font-size="40">${input.distanceKm.toFixed(2)} км</text>
    <text x="860" y="724" fill="#94a3b8" font-size="20">ХУГАЦАА</text><text x="860" y="766" fill="#ffffff" font-size="40">${formatDuration(input.durationSeconds)}</text>
    <text x="1040" y="724" fill="#94a3b8" font-size="20">ТЕМП</text><text x="1040" y="766" fill="#ffffff" font-size="40" text-anchor="end">${escapeSvgText(input.pace)} /км</text>
  </g>
</svg>`.trim();

  return {
    id: `run-map-${Date.now()}`,
    type: 'image',
    uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  };
}

export function RunScreen({ activeChallenge, activeChallengeProgressKm = 0, activeClubEvent = null, routes, selectedRouteId: incomingRouteId, onOpenComposer, onSaveRun, onLiveRunUpdate, onLiveRunEnd, onExitFinishedRun }: Props) {
  const insets = useSafeAreaInsets();
  const fallbackRoute = routes[0] ?? RUN_ROUTES[0];
  const [selectedRouteId, setSelectedRouteId] = useState(incomingRouteId ?? CUSTOM_ROUTE_ID);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [starting, setStarting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveCoordinates, setLiveCoordinates] = useState<Point[]>([]);
  const [savedRouteCoordinates, setSavedRouteCoordinates] = useState<Point[]>([]);
  const [mapFocusCoordinate, setMapFocusCoordinate] = useState<Point | null>(null);
  const [replayPointCount, setReplayPointCount] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [runNotice, setRunNotice] = useState<RunNotice | null>(null);
  const liveCoordinatesRef = useRef<Point[]>([]);
  const startedAt = useRef<number | null>(null);
  const sessionStartedAt = useRef<number | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedSecondsRef = useRef(0);
  const pausedRef = useRef(false);
  const lastAcceptedLocation = useRef<{ point: Point; timestamp: number } | null>(null);
  const startPulse = useRef(new Animated.Value(0)).current;
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const showRunNotice = (title: string, message: string) => setRunNotice({ title, message });

  const selectedRoute = useMemo(
    () => routes.find(route => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId]
  );
  const customMapRoute = useMemo<RouteOption>(() => ({
    ...fallbackRoute,
    id: CUSTOM_ROUTE_ID,
    title: CUSTOM_ROUTE_TITLE,
    coordinates: []
  }), [fallbackRoute]);
  const mapRoute = selectedRoute ?? customMapRoute;
  const selectedRouteTitle = selectedRoute?.title ?? CUSTOM_ROUTE_TITLE;
  const selectedRouteIdForSave = selectedRoute?.id ?? null;
  const popularRoutes = useMemo(
    () => [...routes].sort((first, second) => second.recentActivities - first.recentActivities),
    [routes]
  );
  const activityLevel = !selectedRoute
    ? 'Чөлөөт GPS гүйлт'
    : selectedRoute.recentActivities >= 200
    ? 'Маш өндөр идэвхтэй'
    : selectedRoute.recentActivities >= 80
      ? 'Идэвхтэй'
      : 'Тайван';
  const distanceKm = useMemo(() => getRouteDistance(liveCoordinates), [liveCoordinates]);
  const savedDistanceKm = useMemo(() => getRouteDistance(savedRouteCoordinates), [savedRouteCoordinates]);
  const calories = useMemo(() => Math.round(distanceKm * 62), [distanceKm]);
  const savedCalories = useMemo(() => Math.round(savedDistanceKm * 62), [savedDistanceKm]);
  const pace = useMemo(() => formatPace(distanceKm, elapsedSeconds), [distanceKm, elapsedSeconds]);
  const finishedPace = useMemo(() => formatPace(savedDistanceKm, elapsedSeconds), [savedDistanceKm, elapsedSeconds]);
  const hasFinishedRun = finished;

  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (!running || !sessionStartedAt.current) return;
    const publish = () => {
      const last = liveCoordinatesRef.current.at(-1);
      void onLiveRunUpdate({
        routeId: selectedRouteIdForSave,
        routeTitle: selectedRouteTitle,
        clubId: activeClubEvent?.clubId ?? null,
        eventId: activeClubEvent?.id ?? null,
        distanceKm: getRouteDistance(liveCoordinatesRef.current),
        durationSeconds: elapsedSecondsRef.current,
        latitude: last?.latitude ?? null,
        longitude: last?.longitude ?? null,
        startedAt: new Date(sessionStartedAt.current ?? Date.now()).toISOString(),
        paused: pausedRef.current
      }).catch(() => undefined);
    };
    publish();
    const timer = setInterval(publish, 5000);
    return () => clearInterval(timer);
  }, [activeClubEvent, onLiveRunUpdate, running, selectedRouteIdForSave, selectedRouteTitle]);

  useEffect(
    () => () => {
      watcher.current?.remove();
      if (elapsedTimer.current) {
        clearInterval(elapsedTimer.current);
      }
      if (replayTimer.current) clearInterval(replayTimer.current);
    },
    []
  );

  useEffect(() => {
    if (incomingRouteId && incomingRouteId !== selectedRouteId) {
      setSelectedRouteId(incomingRouteId);
      setMapFocusCoordinate(null);
    }
  }, [incomingRouteId, selectedRouteId]);

  const focusCurrentLocation = useCallback(async () => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        return false;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      setMapFocusCoordinate({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const focusInitialCurrentLocation = async () => {
      if ((incomingRouteId && incomingRouteId !== CUSTOM_ROUTE_ID) || running || hasFinishedRun) {
        return;
      }

      const focused = await focusCurrentLocation();
      if (!focused && !cancelled) {
        setMapFocusCoordinate(null);
      }
    };

    void focusInitialCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, [focusCurrentLocation, hasFinishedRun, incomingRouteId, running]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(startPulse, {
          duration: 1200,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(startPulse, {
          duration: 0,
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );

    if (!running && !hasFinishedRun) {
      animation.start();
    }

    return () => animation.stop();
  }, [hasFinishedRun, running, startPulse]);

  const startPulseStyle = {
    opacity: startPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.38, 0]
    }),
    transform: [
      {
        scale: startPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.22]
        })
      }
    ]
  };

  const appendLiveCoordinate = (point: Point) => {
    setLiveCoordinates(previousCoordinates => {
      const nextCoordinates = [...previousCoordinates, point];
      liveCoordinatesRef.current = nextCoordinates;
      return nextCoordinates;
    });
  };

  const appendLocationIfReliable = (location: Location.LocationObject) => {
    const point = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    };
    const accuracy = location.coords.accuracy ?? Number.POSITIVE_INFINITY;
    const timestamp = location.timestamp || Date.now();
    const previous = lastAcceptedLocation.current;

    if (!isValidPoint(point)) return;
    if (!previous && accuracy > MAX_FIRST_POINT_ACCURACY_METERS) return;
    if (previous && accuracy > MAX_ACCEPTED_ACCURACY_METERS) return;

    if (previous) {
      const distanceMeters = getDistanceBetweenPoints(previous.point, point) * 1000;
      const elapsedFromPrevious = Math.max(1, (timestamp - previous.timestamp) / 1000);
      const reportedSpeed = location.coords.speed ?? null;
      const segmentSpeed = distanceMeters / elapsedFromPrevious;

      if (distanceMeters < MIN_SEGMENT_DISTANCE_METERS) return;
      if (reportedSpeed !== null && reportedSpeed > MAX_RUNNING_SPEED_METERS_PER_SECOND) return;
      if (segmentSpeed > MAX_RUNNING_SEGMENT_SPEED_METERS_PER_SECOND) return;
    }

    lastAcceptedLocation.current = { point, timestamp };
    appendLiveCoordinate(point);
  };

  const beginRunSession = (initialPoint?: Point) => {
    watcher.current?.remove();
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    if (replayTimer.current) clearInterval(replayTimer.current);
    replayTimer.current = null;
    setReplaying(false);
    const initialCoordinates = initialPoint ? [initialPoint] : [];
    liveCoordinatesRef.current = initialCoordinates;
    lastAcceptedLocation.current = initialPoint ? { point: initialPoint, timestamp: Date.now() } : null;
    setLiveCoordinates(initialCoordinates);
    setSavedRouteCoordinates([]);
    setMapFocusCoordinate(null);
    setElapsedSeconds(0);
    setRunning(true);
    setPaused(false);
    setFinished(false);
    startedAt.current = Date.now();
    sessionStartedAt.current = startedAt.current;
    elapsedTimer.current = setInterval(() => {
      if (startedAt.current) {
        setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 1000);
  };

  const startLocationWatcher = async () => {
    watcher.current?.remove();
    watcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 2000 },
      appendLocationIfReliable
    );
  };

  const syncBackgroundSnapshot = async () => {
    const snapshot = await readBackgroundRunSnapshot();
    if (!snapshot) return;
    sessionStartedAt.current = snapshot.startedAt;
    startedAt.current = snapshot.startedAt;
    liveCoordinatesRef.current = snapshot.coordinates;
    lastAcceptedLocation.current = snapshot.coordinates.length
      ? { point: snapshot.coordinates[snapshot.coordinates.length - 1], timestamp: snapshot.updatedAt }
      : null;
    setLiveCoordinates(snapshot.coordinates);
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - snapshot.startedAt) / 1000)));
    setRunning(true);
    setPaused(false);
    setFinished(false);
  };

  useEffect(() => {
    void syncBackgroundSnapshot();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void syncBackgroundSnapshot();
    });
    return () => subscription.remove();
  }, []);

  const start = async () => {
    if (starting || running) return;
    setStarting(true);

    let permissionGranted = false;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      permissionGranted = permission.status === 'granted';
    } catch {
      permissionGranted = false;
    }

    if (!permissionGranted) {
      beginRunSession();
      Alert.alert('GPS хязгаарлагдмал байна', 'Байршлын зөвшөөрөлгүй тул гүйлтийг таймерын горимоор эхлүүллээ. GPS зөвшөөрвөл зай, маршрут бүрэн хэмжигдэнэ.');
      setStarting(false);
      return;
    }

    try {
      beginRunSession();

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      appendLocationIfReliable(currentLocation);

      await startLocationWatcher();
      const backgroundStarted = await startBackgroundRunTracking({
        startedAt: sessionStartedAt.current ?? Date.now(),
        routeId: selectedRouteIdForSave ?? undefined,
        routeTitle: selectedRouteTitle,
        clubId: activeClubEvent?.clubId,
        eventId: activeClubEvent?.id,
        coordinates: liveCoordinatesRef.current
      });
      if (!backgroundStarted) {
        Alert.alert('Background зөвшөөрөл хэрэгтэй', 'Аппаас гарсан үед гүйлтийн мэдээллийг notification дээр харуулахын тулд байршлыг “Always allow” болгож зөвшөөрнө үү.');
      }
    } catch {
      Alert.alert('GPS түр боломжгүй байна', 'Гүйлт таймерын горимоор үргэлжилж байна.');
    } finally {
      setStarting(false);
    }
  };

  const pauseRun = () => {
    if (!running || paused) return;
    setPaused(true);
    if (elapsedTimer.current) {
      clearInterval(elapsedTimer.current);
      elapsedTimer.current = null;
    }
    watcher.current?.remove();
    watcher.current = null;
    void stopBackgroundRunTracking();
    showRunNotice('Маш бага зай үлдлээ', 'Хичээгээрэй');
  };

  const resumeRun = async () => {
    if (!running || !paused) return;
    setPaused(false);
    if (!elapsedTimer.current) {
      startedAt.current = Date.now() - elapsedSeconds * 1000;
      elapsedTimer.current = setInterval(() => {
        if (startedAt.current) setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      }, 1000);
    }
    try {
      await startLocationWatcher();
      await startBackgroundRunTracking({
        startedAt: sessionStartedAt.current ?? Date.now() - elapsedSeconds * 1000,
        routeId: selectedRouteIdForSave ?? undefined,
        routeTitle: selectedRouteTitle,
        clubId: activeClubEvent?.clubId,
        eventId: activeClubEvent?.id,
        coordinates: liveCoordinatesRef.current
      });
    } catch {
      Alert.alert('GPS холбогдсонгүй', 'Таймер үргэлжилнэ. Байршлын үйлчилгээг шалгана уу.');
    }
  };

  const finishRun = async () => {
    const backgroundSnapshot = await readBackgroundRunSnapshot();
    const finishedCoordinates = (backgroundSnapshot?.coordinates.length ?? 0) > liveCoordinatesRef.current.length
      ? backgroundSnapshot?.coordinates ?? liveCoordinatesRef.current
      : liveCoordinatesRef.current;
    const finishedDistance = getRouteDistance(finishedCoordinates);
    const runStartedAt = sessionStartedAt.current ? new Date(sessionStartedAt.current).toISOString() : new Date().toISOString();
    const runCompletedAt = new Date().toISOString();
    setRunning(false);
    setPaused(false);
    setFinished(true);
    startedAt.current = null;
    if (elapsedTimer.current) {
      clearInterval(elapsedTimer.current);
      elapsedTimer.current = null;
    }
    watcher.current?.remove();
    watcher.current = null;
    await stopBackgroundRunTracking();
    await onLiveRunEnd().catch(() => undefined);
    sessionStartedAt.current = null;
    setSavedRouteCoordinates(finishedCoordinates);
    setReplayPointCount(finishedCoordinates.length);
    const singleRunChallenge = isSingleRunChallenge(activeChallenge);
    const challengeDistance = singleRunChallenge ? finishedDistance : activeChallengeProgressKm + finishedDistance;
    const challengeCompleted = Boolean(activeChallenge && challengeDistance >= activeChallenge.goalKm);
    const challengeIdForSave = singleRunChallenge && !challengeCompleted ? null : activeChallenge?.id ?? null;
    try {
      await onSaveRun({
        routeId: selectedRouteIdForSave,
        challengeId: challengeIdForSave,
        distanceKm: finishedDistance,
        durationSeconds: elapsedSeconds,
        calories: Math.round(finishedDistance * 62),
        coordinates: finishedCoordinates,
        startedAt: runStartedAt,
        completedAt: runCompletedAt
      });
      if (activeChallenge) {
        if (challengeCompleted) {
          showRunNotice('Баяр хүргэе', 'Та чэлленжээ амжилттай гүйцэтгэлээ. Баяр хүргэе!');
        } else if (singleRunChallenge) {
          showRunNotice('Таны чэллэнж биелсэнгүй', 'Гүйлтийн мэдээлэл ерөнхий үзүүлтэнд нэмэгдлээ. Дараагийн удаа илүү хичээгээрэй. Амжилт');
        } else {
          showRunNotice('Амжилттай бүртгэгдлээ', 'Таны гүйлт чэлленжд амжилттай бүртгэгдлээ.');
        }
      }
    } catch {
      Alert.alert('Гүйлт хадгалагдсангүй', 'Интернэт холболтоо шалгаад дахин оролдоно уу.');
    }
  };

  const playRoute = () => {
    if (savedRouteCoordinates.length < 2) {
      Alert.alert('Маршрут бичигдээгүй байна', 'Энэ гүйлтийн GPS цэг хангалтгүй байна. Дараагийн гүйлтдээ location зөвшөөрлөө асаана уу.');
      return;
    }
    if (replayTimer.current) clearInterval(replayTimer.current);
    setReplayPointCount(1);
    setReplaying(true);
    replayTimer.current = setInterval(() => {
      setReplayPointCount(current => {
        const step = Math.max(1, Math.ceil(savedRouteCoordinates.length / 80));
        const next = Math.min(savedRouteCoordinates.length, current + step);
        if (next >= savedRouteCoordinates.length) {
          if (replayTimer.current) clearInterval(replayTimer.current);
          replayTimer.current = null;
          setReplaying(false);
        }
        return next;
      });
    }, 70);
  };

  const openRunPostComposer = () => {
    const runMapMedia = createRunMapMedia({
      coordinates: savedRouteCoordinates,
      distanceKm: savedDistanceKm,
      durationSeconds: elapsedSeconds,
      pace: finishedPace,
      routeTitle: selectedRouteTitle
    });
    onOpenComposer({
      title: `${savedDistanceKm.toFixed(2)} км гүйлт`,
      description: `${selectedRouteTitle} · ${formatDuration(elapsedSeconds)} · ${finishedPace} /км`,
      runMapMedia
    });
  };

  const displayedMapCoordinates = hasFinishedRun
    ? savedRouteCoordinates.slice(0, Math.max(1, replayPointCount))
    : liveCoordinates;
  const overlayTopPadding = Math.max(insets.top + 12, 58);

  return (
    <View style={styles.root}>
      <MapBackdrop
        route={mapRoute}
        liveCoordinates={displayedMapCoordinates}
        focusCoordinate={mapFocusCoordinate}
        fitRoute={hasFinishedRun}
        compactControls={hasFinishedRun}
        showRouteInfo={Boolean(selectedRoute)}
      />

      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: overlayTopPadding }]}>
        {running ? <View style={styles.liveHeader}><View style={[styles.liveDot, paused && styles.pausedDot]} /><Text style={styles.liveHeaderText}>{paused ? 'ГҮЙЛТ ТҮР ЗОГССОН' : 'ГҮЙЛТ ҮРГЭЛЖИЛЖ БАЙНА'}</Text></View> : null}

        {running ? (
          <View pointerEvents="box-none" style={styles.runningPanel}>
            <View style={styles.distanceCard}>
              <Text style={styles.distanceValue}>{distanceKm.toFixed(2)}</Text>
              <Text style={styles.distanceLabel}>КИЛОМЕТР</Text>
            </View>

            <View style={styles.runningStats}>
              <View style={styles.runningStatCard}>
                <Text style={styles.runningStatIcon}>◷</Text>
                <Text style={styles.runningStatValue}>{formatDuration(elapsedSeconds)}</Text>
                <Text style={styles.runningStatLabel}>Duration</Text>
              </View>
              <View style={styles.runningStatCard}>
                <Text style={[styles.runningStatIcon, styles.paceIcon]}>ϟ</Text>
                <Text style={styles.runningStatValue}>{pace}</Text>
                <Text style={styles.runningStatLabel}>Pace</Text>
              </View>
              <View style={styles.runningStatCard}>
                <Text style={[styles.runningStatIcon, styles.calorieIcon]}>◇</Text>
                <Text style={styles.runningStatValue}>{calories}</Text>
                <Text style={styles.runningStatLabel}>Calories</Text>
              </View>
            </View>

            <View style={styles.liveRouteCard}><View><Text style={styles.liveRouteLabel}>{selectedRoute ? 'СОНГОСОН МАРШРУТ' : 'ӨӨРИЙН МАРШРУТ'}</Text><Text style={styles.liveRouteTitle}>{selectedRouteTitle}</Text></View><Text style={styles.liveRouteMeta}>{selectedRoute ? `${selectedRoute.distanceKm.toFixed(1)} км · ${selectedRoute.difficulty}` : 'GPS-ээр хэмжинэ'}</Text></View>

            {paused ? (
              <View style={styles.pauseActions}>
                <Pressable style={({ pressed }) => [styles.resumeButton, pressed && styles.actionButtonPressed]} onPress={() => void resumeRun()}>
                  <View style={styles.resumeIconWrap}><Text style={styles.resumeIcon}>▶</Text></View>
                  <Text style={styles.resumeText}>Үргэлжлүүлэх</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.finishButton, pressed && styles.actionButtonPressed]} onPress={() => void finishRun()}>
                  <View style={styles.finishIconWrap}><Text style={styles.finishIcon}>■</Text></View>
                  <Text style={styles.finishText}>Гүйлт дуусгах</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.liveStopButton} onPress={pauseRun}>
                <Text style={styles.liveStopIcon}>■</Text>
              </Pressable>
            )}
          </View>
        ) : hasFinishedRun ? (
          <View pointerEvents="box-none" style={styles.finishedPanel}>
            <View style={styles.finishedSummaryCard}>
              <View style={styles.finishedHeader}>
                <View><Text style={styles.finishedEyebrow}>ГҮЙЛТ ДУУССАН</Text><Text style={styles.finishedTitle}>Таны гүйлтийн тойм</Text><Text style={styles.finishedArea}>{selectedRouteTitle}</Text></View>
                <View style={styles.finishedCheck}><Text style={styles.finishedCheckText}>✓</Text></View>
              </View>

              <View style={styles.finishedDistanceHero}><Text style={styles.finishedDistanceValue}>{savedDistanceKm.toFixed(2)}</Text><Text style={styles.finishedDistanceUnit}>КИЛОМЕТР</Text></View>

              <View style={styles.finishedStatsRow}>
                <View style={styles.finishedStat}>
                  <Text style={styles.finishedLabel}>ТЕМП</Text>
                  <Text style={styles.finishedValue}>{finishedPace} /км</Text>
                </View>
                <View style={styles.finishedStat}>
                  <Text style={styles.finishedLabel}>ХУГАЦАА</Text>
                  <Text style={styles.finishedValue}>{formatDuration(elapsedSeconds)}</Text>
                </View>
                <View style={styles.finishedStat}>
                  <Text style={styles.finishedLabel}>ИЛЧЛЭГ</Text>
                  <Text style={styles.finishedValue}>{savedCalories}</Text>
                </View>
              </View>

              <View style={styles.replayProgress}><View style={[styles.replayProgressFill, { width: `${savedRouteCoordinates.length > 0 ? (replayPointCount / savedRouteCoordinates.length) * 100 : 0}%` }]} /></View>
              <Pressable style={styles.replayButton} onPress={playRoute}><Text style={styles.replayIcon}>{replaying ? '■' : '▶'}</Text><Text style={styles.replayText}>{replaying ? 'Маршрут тоглож байна' : 'Гүйсэн маршрутыг тоглуулах'}</Text></Pressable>

              <View style={styles.finishedActions}>
                <Pressable style={styles.postRunButton} onPress={openRunPostComposer}>
                  <Text style={styles.postRunIcon}>＋</Text>
                  <Text style={styles.postRunText}>Гүйлтээ постлох</Text>
                </Pressable>
                <Pressable style={styles.startAgainButton} onPress={start}>
                  <Text style={styles.startAgainText}>Дахин гүйх</Text>
                </Pressable>
                <Pressable style={styles.exitFinishedButton} onPress={onExitFinishedRun}>
                  <Text style={styles.exitFinishedText}>Гарах</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.routeScroller}
              contentContainerStyle={styles.routeRow}
            >
              <Pressable
                style={[styles.routeCard, styles.customRouteCard, selectedRouteId === CUSTOM_ROUTE_ID && styles.activeRouteCard]}
                onPress={() => {
                  setSelectedRouteId(CUSTOM_ROUTE_ID);
                  void focusCurrentLocation();
                }}
              >
                <View style={[styles.routePin, selectedRouteId === CUSTOM_ROUTE_ID && styles.activeRoutePin]} />
                <Text style={[styles.routeTitle, selectedRouteId === CUSTOM_ROUTE_ID && styles.activeRouteText]} numberOfLines={1}>{CUSTOM_ROUTE_TITLE}</Text>
                <Text style={styles.routeMeta}>GPS замаа өөрөө бичнэ</Text>
              </Pressable>
              {popularRoutes.map(route => {
                const active = route.id === selectedRouteId;
                const popular = route.recentActivities >= 150;
                return (
                  <Pressable
                    key={route.id}
                    style={[styles.routeCard, active && styles.activeRouteCard]}
                    onPress={() => {
                      setSelectedRouteId(route.id);
                      setMapFocusCoordinate(null);
                    }}
                  >
                    <View style={[styles.routePin, active && styles.activeRoutePin]} />
                    {popular ? <Text style={styles.popularRouteBadge}>ТҮГЭЭМЭЛ</Text> : null}
                    <Text style={[styles.routeTitle, active && styles.activeRouteText]} numberOfLines={1}>{route.title}</Text>
                    <Text style={styles.routeMeta}>{route.liveRunners} гүйж байна</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View pointerEvents="none" style={styles.reelCard}>
              <View style={styles.analysisHeader}>
                <View>
                  <Text style={styles.analysisEyebrow}>МАРШРУТЫН АНАЛИЗ</Text>
                  <Text style={styles.analysisTitle}>{activityLevel}</Text>
                </View>
              </View>
              <View style={styles.reelStats}>
                <View style={styles.reelStat}>
                  <Text style={styles.reelValue}>{selectedRoute ? `${selectedRoute.distanceKm.toFixed(1)} км` : 'GPS'}</Text>
                  <Text style={styles.reelLabel}>{selectedRoute ? 'замын урт' : 'зай хэмжилт'}</Text>
                </View>
                <View style={styles.reelStat}>
                  <Text style={styles.reelValue}>{selectedRoute ? selectedRoute.liveRunners : '--'}</Text>
                  <Text style={styles.reelLabel}>{selectedRoute ? 'одоо гүйж байна' : 'чөлөөт горим'}</Text>
                </View>
              </View>

              <View style={styles.reelFooter}>
                <Text style={styles.reelDetail}>{selectedRoute ? `${selectedRoute.area} · ${selectedRoute.difficulty} · ${selectedRoute.avgPace}` : 'Газар сонгохгүйгээр одоогийн байршлаасаа эхэлнэ'}</Text>
                <Text style={styles.routeActivityText}>{selectedRoute ? `Сүүлийн 7 хоногт ${selectedRoute.recentActivities} гүйгч гүйсэн` : 'START дарахад таны GPS цэгүүдээр маршрут үүснэ'}</Text>
                {activeChallenge ? <Text style={styles.challengeText}>{activeChallenge.title}</Text> : null}
              </View>
            </View>

            <View pointerEvents="box-none" style={styles.centerStage}>
              <Animated.View pointerEvents="none" style={[styles.startPulse, startPulseStyle]} />
              <Pressable disabled={starting} style={[styles.startButton, starting && styles.startButtonBusy]} onPress={start}>
                <Text style={styles.playIcon}>{starting ? '…' : '▶'}</Text>
                <Text style={styles.startText}>{starting ? 'ЭХЭЛЖ БАЙНА' : 'START'}</Text>
              </Pressable>
            </View>
          </>
        )}

      </View>
      <Modal visible={Boolean(runNotice)} transparent animationType="fade" onRequestClose={() => setRunNotice(null)}>
        <View style={styles.noticeOverlay}>
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>{runNotice?.title}</Text>
            <Text style={styles.noticeMessage}>{runNotice?.message}</Text>
            <Pressable style={styles.noticeButton} onPress={() => setRunNotice(null)}>
              <Text style={styles.noticeButtonText}>Ойлголоо</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MapBackdrop({ route, liveCoordinates, focusCoordinate, fitRoute, compactControls, showRouteInfo }: { route: RouteOption; liveCoordinates: Point[]; focusCoordinate?: Point | null; fitRoute?: boolean; compactControls?: boolean; showRouteInfo?: boolean }) {
  return <GoogleRouteMap route={route} liveCoordinates={liveCoordinates} focusCoordinate={focusCoordinate ?? undefined} fitRoute={fitRoute} compactControls={compactControls} showRouteInfo={showRouteInfo} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, paddingHorizontal: 16, backgroundColor: 'rgba(5,11,26,0.16)' },
  liveHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, borderRadius: 12, paddingHorizontal: 11, backgroundColor: 'rgba(6,18,24,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  pausedDot: { backgroundColor: '#FFC247' },
  liveHeaderText: { color: '#DCE8EC', fontSize: 8, fontWeight: '900' },
  routeScroller: { height: 64, flexGrow: 0, marginBottom: 12 },
  routeRow: { gap: 8, paddingBottom: 0 },
  routeCard: { width: 160, height: 56, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: 'rgba(8,13,26,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14 },
  customRouteCard: { backgroundColor: 'rgba(15,31,43,0.92)' },
  activeRouteCard: { borderColor: 'rgba(57,255,136,0.75)', backgroundColor: 'rgba(15,45,33,0.92)', shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 14 },
  routePin: { width: 24, height: 4, borderRadius: 2, backgroundColor: colors.routeUpcoming, marginBottom: 5 },
  popularRouteBadge: { position: 'absolute', right: 8, top: 7, color: colors.accent, fontSize: 6, fontWeight: '900' },
  activeRoutePin: { backgroundColor: colors.routeActive },
  routeTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  activeRouteText: { color: colors.text },
  routeMeta: { color: colors.muted, fontSize: 9, fontWeight: '800', marginTop: 2 },
  reelCard: { marginTop: 0, borderRadius: 22, padding: 14, backgroundColor: 'rgba(8,13,26,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 22 },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11 },
  analysisEyebrow: { color: colors.accent, fontSize: 7, fontWeight: '900' },
  analysisTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 },
  reelStats: { flexDirection: 'row', gap: 6 },
  reelStat: { flex: 1, borderRadius: 14, backgroundColor: 'rgba(20,30,48,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 8 },
  reelValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  reelLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', marginTop: 4 },
  reelFooter: { marginTop: 9, gap: 5 },
  reelDetail: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '800' },
  routeActivityText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  challengeText: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  centerStage: { position: 'absolute', left: 16, right: 16, bottom: 108, alignItems: 'center' },
  startPulse: { position: 'absolute', width: 108, height: 108, borderRadius: 54, backgroundColor: colors.primary },
  startButton: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: 'rgba(248,250,252,0.16)', shadowColor: colors.primary, shadowOpacity: 0.34, shadowRadius: 16 },
  startButtonBusy: { opacity: 0.72 },
  playIcon: { color: colors.bg, fontSize: 20, fontWeight: '900', marginBottom: 3 },
  startText: { color: colors.bg, fontSize: 13, fontWeight: '900', textAlign: 'center', maxWidth: 76 },
  runningPanel: { flex: 1, alignItems: 'center' },
  distanceCard: { width: '100%', borderRadius: 22, paddingVertical: 18, alignItems: 'center', backgroundColor: 'rgba(6,15,28,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18 },
  distanceValue: { color: '#F4F7FC', fontSize: 60, fontWeight: '900', lineHeight: 66 },
  distanceLabel: { color: '#A8B6C5', fontSize: 11, fontWeight: '900', marginTop: 1 },
  runningStats: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 14 },
  runningStatCard: { flex: 1, minHeight: 96, borderRadius: 17, padding: 11, justifyContent: 'center', backgroundColor: 'rgba(6,15,28,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10 },
  runningStatIcon: { color: colors.secondary, fontSize: 18, fontWeight: '900', marginBottom: 7 },
  paceIcon: { color: colors.accent },
  calorieIcon: { color: colors.primary },
  runningStatValue: { color: colors.text, fontSize: 19, fontWeight: '900' },
  runningStatLabel: { color: '#A7B5C3', fontSize: 9, fontWeight: '800', marginTop: 5 },
  liveRouteCard: { width: '100%', minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, borderRadius: 16, paddingHorizontal: 13, backgroundColor: 'rgba(6,15,28,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  liveRouteLabel: { color: colors.accent, fontSize: 7, fontWeight: '900' },
  liveRouteTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', marginTop: 3 },
  liveRouteMeta: { color: '#B4C2CC', fontSize: 9, fontWeight: '800' },
  liveStopButton: { position: 'absolute', bottom: 112, width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderWidth: 6, borderColor: 'rgba(248,250,252,0.17)', shadowColor: colors.danger, shadowOpacity: 0.38, shadowRadius: 15 },
  liveStopIcon: { color: colors.text, fontSize: 22, fontWeight: '900' },
  pauseActions: { position: 'absolute', left: 0, right: 0, bottom: 108, minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 24, backgroundColor: 'rgba(4,12,22,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  resumeButton: { flex: 1, height: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: 'rgba(168,255,24,0.94)', borderWidth: 1, borderColor: 'rgba(238,255,205,0.7)', shadowColor: colors.accent, shadowOpacity: 0.28, shadowRadius: 18 },
  finishButton: { flex: 1, height: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: 'rgba(234,67,62,0.9)', borderWidth: 1, borderColor: 'rgba(255,210,210,0.4)', shadowColor: '#E84C45', shadowOpacity: 0.2, shadowRadius: 16 },
  actionButtonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  resumeIconWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,18,14,0.16)' },
  finishIconWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  resumeIcon: { color: '#07150f', fontSize: 12, fontWeight: '900', marginLeft: 2 },
  finishIcon: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  resumeText: { color: '#07150f', fontSize: 12, fontWeight: '900' },
  finishText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  finishedPanel: { flex: 1, justifyContent: 'flex-end', paddingBottom: 74 },
  finishedSummaryCard: { width: '100%', borderRadius: 22, padding: 16, backgroundColor: 'rgba(5,14,24,0.95)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 22 },
  finishedHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  finishedEyebrow: { color: colors.accent, fontSize: 7, fontWeight: '900' },
  finishedCheck: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(57,255,136,0.15)', borderWidth: 1, borderColor: 'rgba(57,255,136,0.4)' },
  finishedCheckText: { color: colors.accent, fontSize: 17, fontWeight: '900' },
  finishedTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
  finishedArea: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800', marginTop: 3 },
  finishedDistanceHero: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 13 },
  finishedDistanceValue: { color: '#FFFFFF', fontSize: 38, lineHeight: 42, fontWeight: '900' },
  finishedDistanceUnit: { color: '#A8B7C2', fontSize: 8, fontWeight: '900' },
  finishedStatsRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  finishedStat: { flex: 1, minWidth: 0, borderRadius: 12, padding: 9, backgroundColor: 'rgba(255,255,255,0.06)' },
  finishedLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 7, fontWeight: '900' },
  finishedValue: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 4 },
  replayProgress: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 13 },
  replayProgressFill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  replayButton: { height: 43, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, backgroundColor: colors.accent },
  replayIcon: { color: '#06120e', fontSize: 12, fontWeight: '900' },
  replayText: { color: '#06120e', fontSize: 11, fontWeight: '900' },
  finishedActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  postRunButton: { flex: 1.35, height: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  postRunIcon: { color: colors.accent, fontSize: 15, fontWeight: '900' },
  postRunText: { color: colors.text, fontSize: 11, fontWeight: '900' },
  startAgainButton: { flex: 1, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,15,28,0.88)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.36)' },
  startAgainText: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  exitFinishedButton: { flex: 0.78, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  exitFinishedText: { color: '#DCE8EC', fontSize: 11, fontWeight: '900' },
  noticeOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.62)' },
  noticeCard: { width: '100%', maxWidth: 420, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#071016', padding: 22 },
  noticeTitle: { color: '#FFFFFF', fontSize: 21, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  noticeMessage: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  noticeButton: { height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, marginTop: 20 },
  noticeButtonText: { color: '#071016', fontSize: 15, fontWeight: '900' },
});
