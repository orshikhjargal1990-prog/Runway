import type { Challenge } from '../native/types';

export type AdminChallengeEvent = {
  id: string;
  name: string;
  org: string;
  date: string;
  distance: number;
  participants: number;
  status: 'active' | 'draft' | 'ended';
  type: Challenge['type'];
  group: Challenge['group'];
  completionMode?: Challenge['completionMode'];
  reward: string;
  color: string;
  coverImage: string;
  description: string;
  registrationInfo: string;
  organizerInfo?: string;
  rewardInfo?: string;
};

const adminChallengeEventKey = 'runboost.adminChallengeEvents';

export function getAdminChallengeEvents(): AdminChallengeEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(adminChallengeEventKey);
    return raw ? JSON.parse(raw) as AdminChallengeEvent[] : [];
  } catch {
    return [];
  }
}

export function saveAdminChallengeEvent(input: Omit<AdminChallengeEvent, 'id' | 'participants' | 'status'> & { id?: string; participants?: number; status?: AdminChallengeEvent['status'] }) {
  const now = Date.now();
  const next: AdminChallengeEvent = {
    ...input,
    id: input.id ?? `admin-event-${now}`,
    participants: input.participants ?? 0,
    status: input.status ?? 'draft'
  };
  if (typeof window === 'undefined') return next;
  const current = getAdminChallengeEvents();
  const updated = current.some(event => event.id === next.id)
    ? current.map(event => event.id === next.id ? next : event)
    : [next, ...current];
  window.localStorage.setItem(adminChallengeEventKey, JSON.stringify(updated));
  return next;
}

export function deleteAdminChallengeEvent(id: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(adminChallengeEventKey, JSON.stringify(getAdminChallengeEvents().filter(event => event.id !== id)));
}

export function adminEventToChallenge(event: AdminChallengeEvent): Challenge {
  const registrationEndsAt = new Date(event.date);
  registrationEndsAt.setHours(23, 59, 59, 999);
  return {
    id: event.id,
    title: event.name,
    org: event.org,
    type: event.type,
    group: event.group,
    completionMode: event.completionMode ?? (event.group === '5k' ? 'single_run' : 'cumulative'),
    goalKm: event.distance,
    reward: event.reward || event.registrationInfo || `${event.distance} км`,
    color: event.color,
    image: event.coverImage,
    description: event.description,
    registrationInfo: event.registrationInfo,
    organizerInfo: event.organizerInfo,
    rewardInfo: event.rewardInfo,
    registrationEndsInSeconds: Math.max(0, Math.floor((registrationEndsAt.getTime() - Date.now()) / 1000))
  };
}

export function getAdminChallenges(): Challenge[] {
  return getAdminChallengeEvents()
    .filter(event => event.status === 'active')
    .map(adminEventToChallenge);
}
