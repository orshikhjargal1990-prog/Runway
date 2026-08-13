import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { Point } from '../native/routes';
import type { BackgroundRunSnapshot } from './runTracking';
import { supabase } from './supabase';

const TASK_NAME = 'runboost-active-run-location';
const STORAGE_KEY = 'runboost-active-run';
const NOTIFICATION_ID = 'runboost-active-run';
const CHANNEL_ID = 'active-run';

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function segmentDistance(start: Point, end: Point) {
  const latitudeDelta = radians(end.latitude - start.latitude);
  const longitudeDelta = radians(end.longitude - start.longitude);
  const startLatitude = radians(start.latitude);
  const endLatitude = radians(end.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6371 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function routeDistance(coordinates: Point[]) {
  return coordinates.reduce((total, point, index) => (
    index === 0 ? total : total + segmentDistance(coordinates[index - 1], point)
  ), 0);
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
}

async function showRunNotification(snapshot: BackgroundRunSnapshot) {
  const seconds = Math.max(0, Math.floor((Date.now() - snapshot.startedAt) / 1000));
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: 'Гүйлт үргэлжилж байна',
      body: `${snapshot.distanceKm.toFixed(2)} км  ·  ${duration(seconds)}  ·  ${snapshot.routeTitle}`,
      data: { screen: 'run' },
      sticky: true,
      autoDismiss: false
    },
    trigger: null
  });
}

if (!TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    if (!locations.length) return;

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const snapshot = JSON.parse(stored) as BackgroundRunSnapshot;
    const additions = locations.map(location => ({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    }));
    const coordinates = [...snapshot.coordinates, ...additions].slice(-5000);
    const next = {
      ...snapshot,
      coordinates,
      distanceKm: routeDistance(coordinates),
      updatedAt: Date.now()
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    await showRunNotification(next);
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const seconds = Math.max(0, Math.floor((Date.now() - next.startedAt) / 1000));
      const last = coordinates.at(-1);
      await supabase.from('active_runs').upsert({
        user_id: auth.user.id,
        route_id: next.routeId ?? null,
        route_title: next.routeTitle,
        distance_km: next.distanceKm,
        duration_seconds: seconds,
        pace_seconds_per_km: next.distanceKm > 0 ? Math.round(seconds / next.distanceKm) : null,
        latitude: last?.latitude ?? null,
        longitude: last?.longitude ?? null,
        started_at: new Date(next.startedAt).toISOString(),
        status: 'running'
      });
    }
  });
}

export async function startBackgroundRunTracking(input: {
  startedAt: number;
  routeId?: string;
  routeTitle: string;
  coordinates?: Point[];
}): Promise<boolean> {
  const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  if (!backgroundPermission.granted) return false;

  const notificationPermission = await Notifications.requestPermissionsAsync();
  if (!notificationPermission.granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Идэвхтэй гүйлт',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0],
      sound: null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
    });
  }

  const coordinates = input.coordinates ?? [];
  const snapshot: BackgroundRunSnapshot = {
    startedAt: input.startedAt,
    routeId: input.routeId,
    routeTitle: input.routeTitle,
    coordinates,
    distanceKm: routeDistance(coordinates),
    updatedAt: Date.now()
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  await showRunNotification(snapshot);

  const running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (!running) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 3,
      timeInterval: 3000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'RUNBOOST гүйлт идэвхтэй',
        notificationBody: 'Зай болон хугацааг хэмжиж байна.',
        notificationColor: '#39FF88',
        killServiceOnDestroy: false
      }
    });
  }
  return true;
}

export async function readBackgroundRunSnapshot(): Promise<BackgroundRunSnapshot | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) as BackgroundRunSnapshot : null;
}

export async function stopBackgroundRunTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
  await Notifications.dismissNotificationAsync(NOTIFICATION_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => undefined);
  await AsyncStorage.removeItem(STORAGE_KEY);
}
