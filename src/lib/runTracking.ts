import type { Point } from '../native/routes';

export type BackgroundRunSnapshot = {
  startedAt: number;
  routeId?: string;
  routeTitle: string;
  clubId?: string;
  eventId?: string;
  coordinates: Point[];
  distanceKm: number;
  updatedAt: number;
  notificationUpdatedAt?: number;
};

export async function startBackgroundRunTracking(_input: {
  startedAt: number;
  routeId?: string;
  routeTitle: string;
  clubId?: string;
  eventId?: string;
  coordinates?: Point[];
}): Promise<boolean> {
  return false;
}

export async function readBackgroundRunSnapshot(): Promise<BackgroundRunSnapshot | null> {
  return null;
}

export async function stopBackgroundRunTracking(): Promise<void> {}
