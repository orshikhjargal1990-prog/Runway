import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import type { Challenge } from '../types';
import { colors } from '../theme';
import { GoogleRouteMap } from '../components/GoogleRouteMap';
import type { Point, RouteOption } from '../routes';
import {
  readBackgroundRunSnapshot,
  startBackgroundRunTracking,
  stopBackgroundRunTracking
} from '../../lib/runTracking';

type Props = {
  activeChallenge: Challenge | null;
  routes: RouteOption[];
  selectedRouteId?: string | null;
  onOpenComposer: () => void;
  onLiveRunUpdate: (run: {
    routeId: string; routeTitle: string; distanceKm: number; durationSeconds: number;
    latitude: number | null; longitude: number | null; startedAt: string; paused: boolean;
  }) => Promise<void>;
  onLiveRunEnd: () => Promise<void>;
  onSaveRun: (run: {
    routeId: string;
    challengeId: string | null;
    distanceKm: number;
    durationSeconds: number;
    calories: number;
    coordinates: Point[];
    startedAt: string;
  }) => Promise<void>;
};

const EARTH_RADIUS_KM = 6371;

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

export function RunScreen({ activeChallenge, routes, selectedRouteId: incomingRouteId, onSaveRun, onLiveRunUpdate, onLiveRunEnd }: Props) {
  const fallbackRoute = routes[0];
  const [selectedRouteId, setSelectedRouteId] = useState(incomingRouteId ?? fallbackRoute.id);
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
  const liveCoordinatesRef = useRef<Point[]>([]);
  const startedAt = useRef<number | null>(null);
  const sessionStartedAt = useRef<number | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedSecondsRef = useRef(0);
  const pausedRef = useRef(false);
  const startPulse = useRef(new Animated.Value(0)).current;
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedRoute = useMemo(
    () => routes.find(route => route.id === selectedRouteId) ?? fallbackRoute,
    [fallbackRoute, routes, selectedRouteId]
  );
  const popularRoutes = useMemo(
    () => [...routes].sort((first, second) => second.recentActivities - first.recentActivities),
    [routes]
  );
  const activityLevel = selectedRoute.recentActivities >= 200
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
        routeId: selectedRoute.id,
        routeTitle: selectedRoute.title,
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
  }, [onLiveRunUpdate, running, selectedRoute.id, selectedRoute.title]);

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

  useEffect(() => {
    let cancelled = false;

    const focusCurrentLocation = async () => {
      if (incomingRouteId || running || hasFinishedRun) {
        return;
      }

      try {
        let permission = await Location.getForegroundPermissionsAsync();

        if (!permission.granted && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (!permission.granted) {
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });

        if (!cancelled) {
          setMapFocusCoordinate({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude
          });
        }
      } catch {
        if (!cancelled) {
          setMapFocusCoordinate(null);
        }
      }
    };

    focusCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, [hasFinishedRun, incomingRouteId, running]);

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

  const beginRunSession = (initialPoint?: Point) => {
    watcher.current?.remove();
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    if (replayTimer.current) clearInterval(replayTimer.current);
    replayTimer.current = null;
    setReplaying(false);
    const initialCoordinates = initialPoint ? [initialPoint] : [];
    liveCoordinatesRef.current = initialCoordinates;
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
      { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 1000 },
      (location: Location.LocationObject) => appendLiveCoordinate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      })
    );
  };

  const syncBackgroundSnapshot = async () => {
    const snapshot = await readBackgroundRunSnapshot();
    if (!snapshot) return;
    sessionStartedAt.current = snapshot.startedAt;
    startedAt.current = snapshot.startedAt;
    liveCoordinatesRef.current = snapshot.coordinates;
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
      beginRunSession(selectedRoute.center);
      Alert.alert('GPS хязгаарлагдмал байна', 'Байршлын зөвшөөрөлгүй тул гүйлтийг таймерын горимоор эхлүүллээ. GPS зөвшөөрвөл зай, маршрут бүрэн хэмжигдэнэ.');
      setStarting(false);
      return;
    }

    try {
      beginRunSession();

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      appendLiveCoordinate({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

      await startLocationWatcher();
      const backgroundStarted = await startBackgroundRunTracking({
        startedAt: sessionStartedAt.current ?? Date.now(),
        routeId: selectedRoute.id,
        routeTitle: selectedRoute.title,
        coordinates: liveCoordinatesRef.current
      });
      if (!backgroundStarted) {
        Alert.alert('Background зөвшөөрөл хэрэгтэй', 'Аппаас гарсан үед гүйлтийн мэдээллийг notification дээр харуулахын тулд байршлыг “Always allow” болгож зөвшөөрнө үү.');
      }
    } catch {
      if (liveCoordinatesRef.current.length === 0) appendLiveCoordinate(selectedRoute.center);
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
  };

  const resumeRun = async () => {
    if (!running || !paused) return;
    setPaused(false);
    startedAt.current = Date.now() - elapsedSeconds * 1000;
    elapsedTimer.current = setInterval(() => {
      if (startedAt.current) setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    try {
      await startLocationWatcher();
      await startBackgroundRunTracking({
        startedAt: sessionStartedAt.current ?? Date.now() - elapsedSeconds * 1000,
        routeId: selectedRoute.id,
        routeTitle: selectedRoute.title,
        coordinates: liveCoordinatesRef.current
      });
    } catch {
      Alert.alert('GPS холбогдсонгүй', 'Таймер үргэлжилнэ. Байршлын үйлчилгээг шалгана уу.');
    }
  };

  const finishRun = async () => {
    const backgroundSnapshot = await readBackgroundRunSnapshot();
    const finishedCoordinates = backgroundSnapshot?.coordinates.length
      ? backgroundSnapshot.coordinates
      : liveCoordinatesRef.current;
    const finishedDistance = getRouteDistance(finishedCoordinates);
    const runStartedAt = sessionStartedAt.current ? new Date(sessionStartedAt.current).toISOString() : new Date().toISOString();
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
    try {
      await onSaveRun({
        routeId: selectedRoute.id,
        challengeId: activeChallenge?.id ?? null,
        distanceKm: finishedDistance,
        durationSeconds: elapsedSeconds,
        calories: Math.round(finishedDistance * 62),
        coordinates: finishedCoordinates,
        startedAt: runStartedAt
      });
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

  const displayedMapCoordinates = hasFinishedRun
    ? savedRouteCoordinates.slice(0, Math.max(1, replayPointCount))
    : liveCoordinates;

  return (
    <View style={styles.root}>
      <MapBackdrop
        routeId={selectedRoute.id}
        routes={routes}
        liveCoordinates={displayedMapCoordinates}
        focusCoordinate={mapFocusCoordinate}
        fitRoute={hasFinishedRun}
        compactControls={hasFinishedRun}
      />

      <View pointerEvents="box-none" style={styles.overlay}>
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

            <View style={styles.liveRouteCard}><View><Text style={styles.liveRouteLabel}>СОНГОСОН МАРШРУТ</Text><Text style={styles.liveRouteTitle}>{selectedRoute.title}</Text></View><Text style={styles.liveRouteMeta}>{selectedRoute.distanceKm.toFixed(1)} км · {selectedRoute.difficulty}</Text></View>

            {paused ? (
              <View style={styles.pauseActions}>
                <Pressable style={styles.resumeButton} onPress={() => void resumeRun()}><Text style={styles.resumeIcon}>▶</Text><Text style={styles.resumeText}>Үргэлжлүүлэх</Text></Pressable>
                <Pressable style={styles.finishButton} onPress={() => void finishRun()}><Text style={styles.finishIcon}>■</Text><Text style={styles.finishText}>Гүйлт дуусгах</Text></Pressable>
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
                <View><Text style={styles.finishedEyebrow}>ГҮЙЛТ ДУУССАН</Text><Text style={styles.finishedTitle}>Таны гүйлтийн тойм</Text><Text style={styles.finishedArea}>{selectedRoute.title}</Text></View>
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
            </View>

            <Pressable style={styles.startAgainButton} onPress={start}>
              <Text style={styles.startAgainText}>ДАХИН ГҮЙХ</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.routeScroller}
              contentContainerStyle={styles.routeRow}
            >
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

            <View style={styles.reelCard}>
              <View style={styles.analysisHeader}>
                <View>
                  <Text style={styles.analysisEyebrow}>МАРШРУТЫН АНАЛИЗ</Text>
                  <Text style={styles.analysisTitle}>{activityLevel}</Text>
                </View>
              </View>
              <View style={styles.reelStats}>
                <View style={styles.reelStat}>
                  <Text style={styles.reelValue}>{selectedRoute.distanceKm.toFixed(1)} км</Text>
                  <Text style={styles.reelLabel}>замын урт</Text>
                </View>
                <View style={styles.reelStat}>
                  <Text style={styles.reelValue}>{selectedRoute.liveRunners}</Text>
                  <Text style={styles.reelLabel}>одоо гүйж байна</Text>
                </View>
                <View style={styles.reelStat}>
                  <Text style={styles.reelValue}>{selectedRoute.elevationM} м</Text>
                  <Text style={styles.reelLabel}>нийт өгсүүр</Text>
                </View>
              </View>

              <View style={styles.reelFooter}>
                <Text style={styles.reelDetail}>{selectedRoute.area} · {selectedRoute.difficulty} · {selectedRoute.avgPace}</Text>
                <Text style={styles.routeActivityText}>Сүүлийн үед {selectedRoute.recentActivities} гүйлт бүртгэгдсэн · {selectedRoute.estimatedDuration}</Text>
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
    </View>
  );
}

function MapBackdrop({ routeId, routes, liveCoordinates, focusCoordinate, fitRoute, compactControls }: { routeId: string; routes: RouteOption[]; liveCoordinates: Point[]; focusCoordinate?: Point | null; fitRoute?: boolean; compactControls?: boolean }) {
  const route = routes.find(item => item.id === routeId) ?? routes[0];
  return <GoogleRouteMap route={route} liveCoordinates={liveCoordinates} focusCoordinate={focusCoordinate ?? undefined} fitRoute={fitRoute} compactControls={compactControls} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, paddingHorizontal: 16, paddingTop: 46, backgroundColor: 'rgba(5,11,26,0.16)' },
  liveHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, borderRadius: 12, paddingHorizontal: 11, backgroundColor: 'rgba(6,18,24,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  pausedDot: { backgroundColor: '#FFC247' },
  liveHeaderText: { color: '#DCE8EC', fontSize: 8, fontWeight: '900' },
  routeScroller: { height: 50, flexGrow: 0, marginBottom: 12 },
  routeRow: { gap: 8, paddingBottom: 0 },
  routeCard: { width: 160, height: 56, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: 'rgba(8,13,26,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14 },
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
  pauseActions: { position: 'absolute', left: 0, right: 0, bottom: 112, flexDirection: 'row', gap: 10 },
  resumeButton: { flex: 1, height: 58, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.25, shadowRadius: 12 },
  resumeIcon: { color: '#06120e', fontSize: 15, fontWeight: '900' },
  resumeText: { color: '#06120e', fontSize: 12, fontWeight: '900' },
  finishButton: { flex: 1, height: 58, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E84C45', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  finishIcon: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  finishText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  finishedPanel: { flex: 1, justifyContent: 'flex-end', paddingBottom: 10 },
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
  startAgainButton: { alignSelf: 'center', marginTop: 8, paddingHorizontal: 18, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,15,28,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  startAgainText: { color: colors.text, fontSize: 12, fontWeight: '900' },
});
