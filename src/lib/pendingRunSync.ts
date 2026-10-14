import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RunInput } from './runboostApi';

const PENDING_RUNS_KEY = 'runboost:pending-runs:v1';

export type PendingRun = RunInput & {
  localId: string;
  queuedAt: string;
  lastSyncError?: string;
};

async function readPendingRuns(): Promise<PendingRun[]> {
  const raw = await AsyncStorage.getItem(PENDING_RUNS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PendingRun[] : [];
  } catch {
    return [];
  }
}

async function writePendingRuns(runs: PendingRun[]) {
  await AsyncStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(runs));
}

export async function enqueuePendingRun(run: RunInput): Promise<PendingRun> {
  const pendingRun: PendingRun = {
    ...run,
    completedAt: run.completedAt ?? new Date().toISOString(),
    localId: `pending-run-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    queuedAt: new Date().toISOString()
  };
  const current = await readPendingRuns();
  await writePendingRuns([pendingRun, ...current]);
  return pendingRun;
}

export async function getPendingRunCount(userId?: string): Promise<number> {
  const runs = await readPendingRuns();
  return userId ? runs.filter(run => run.userId === userId).length : runs.length;
}

export async function syncPendingRuns(save: (run: RunInput) => Promise<void>, userId?: string): Promise<number> {
  const pendingRuns = await readPendingRuns();
  let syncedCount = 0;
  const remainingRuns: PendingRun[] = [];

  for (const pendingRun of pendingRuns) {
    if (userId && pendingRun.userId !== userId) {
      remainingRuns.push(pendingRun);
      continue;
    }

    const { localId: _localId, queuedAt: _queuedAt, lastSyncError: _lastSyncError, ...runInput } = pendingRun;
    try {
      await save(runInput);
      syncedCount += 1;
    } catch (error) {
      remainingRuns.push({
        ...pendingRun,
        lastSyncError: error instanceof Error ? error.message : 'Sync failed'
      });
    }
  }

  if (syncedCount > 0) {
    await writePendingRuns(remainingRuns);
  } else if (remainingRuns.length !== pendingRuns.length) {
    await writePendingRuns(remainingRuns);
  }

  return syncedCount;
}
