import { supabase } from './supabase';

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export type ClubAdminContext = { clubId: string; clubName: string; email: string };
export type LocalClubAdminCredential = {
  id: string;
  clubId: string;
  clubName: string;
  phone: string;
  password: string;
  createdAt: string;
  updatedAt: string;
};
export type LocalClubContentOverride = {
  clubId: string;
  imageUrl: string;
  galleryImages: string[];
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    website?: string;
  };
  updatedAt: string;
};
export type LocalClubEvent = {
  id: string;
  clubId: string;
  clubName: string;
  title: string;
  location: string;
  startsAt: string;
  distanceKm: number | null;
  imageUrl: string;
  description: string;
  advice: string[];
  participantCount: number;
  createdAt: string;
};
export type ClubAdminMember = {
  id: string; name: string; avatarUrl?: string; joinedAt: string;
  totalKm: number; weeklyKm: number; runCount: number;
  weeklyRuns: { date: string; label: string; distanceKm: number; runCount: number }[];
  recentRuns: {
    id: string;
    routeTitle: string;
    routeArea?: string;
    distanceKm: number;
    durationSeconds: number;
    paceSecondsPerKm: number | null;
    completedAt: string;
  }[];
};
export type ClubAdminEvent = {
  id: string; title: string; location: string; startsAt: string; distanceKm: number | null;
  imageUrl: string; description: string; advice: string[]; enabled: boolean;
};
export type EventRegistration = {
  eventId: string; userId: string; name: string; joinedAt: string;
  status: 'registered' | 'confirmed' | 'checked_in' | 'cancelled';
};
export type LiveRun = {
  userId: string; name: string; eventId: string | null; routeTitle: string;
  distanceKm: number; durationSeconds: number; paceSecondsPerKm: number | null;
  latitude: number | null; longitude: number | null; updatedAt: string; status: 'running' | 'paused';
};

export async function getClubAdminContext(): Promise<ClubAdminContext | null> {
  const { data, error } = await supabase.rpc('get_my_club_admin_context');
  fail(error);
  const row = data?.[0];
  return row ? { clubId: row.club_id, clubName: row.club_name, email: row.email } : null;
}

export async function assignClubAdmin(clubId: string, email: string) {
  const { error } = await supabase.rpc('assign_club_admin', { target_club_id: clubId, target_email: email });
  fail(error);
}

const localCredentialKey = 'runboost.clubAdminCredentials';
const localClubContentKey = 'runboost.clubContentOverrides';
const localClubEventKey = 'runboost.clubEvents';
const localDeletedClubEventKey = 'runboost.deletedClubEvents';

export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

export function generateClubAdminPassword() {
  return `RUN-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function getLocalClubAdminCredentials(): LocalClubAdminCredential[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(localCredentialKey);
    return raw ? JSON.parse(raw) as LocalClubAdminCredential[] : [];
  } catch {
    return [];
  }
}

export function saveLocalClubAdminCredential(input: Omit<LocalClubAdminCredential, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const credentials = getLocalClubAdminCredentials();
  const now = new Date().toISOString();
  const existing = input.id ? credentials.find(item => item.id === input.id) : credentials.find(item => item.clubId === input.clubId && normalizePhone(item.phone) === normalizePhone(input.phone));
  const next: LocalClubAdminCredential = {
    id: existing?.id ?? `club-admin-${Date.now()}`,
    clubId: input.clubId,
    clubName: input.clubName,
    phone: normalizePhone(input.phone),
    password: input.password,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const updated = existing
    ? credentials.map(item => item.id === existing.id ? next : item)
    : [next, ...credentials];
  window.localStorage.setItem(localCredentialKey, JSON.stringify(updated));
  return next;
}

export function deleteLocalClubAdminCredential(id: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(localCredentialKey, JSON.stringify(getLocalClubAdminCredentials().filter(item => item.id !== id)));
}

export function findLocalClubAdminCredential(phone: string, password: string) {
  const normalizedPhone = normalizePhone(phone);
  return getLocalClubAdminCredentials().find(item => normalizePhone(item.phone) === normalizedPhone && item.password === password) ?? null;
}

export function getLocalClubContentOverrides(): LocalClubContentOverride[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(localClubContentKey);
    return raw ? JSON.parse(raw) as LocalClubContentOverride[] : [];
  } catch {
    return [];
  }
}

export function saveLocalClubContentOverride(input: Omit<LocalClubContentOverride, 'updatedAt'>) {
  if (typeof window === 'undefined') return input;
  const next = { ...input, updatedAt: new Date().toISOString() };
  const updated = getLocalClubContentOverrides().some(item => item.clubId === input.clubId)
    ? getLocalClubContentOverrides().map(item => item.clubId === input.clubId ? next : item)
    : [next, ...getLocalClubContentOverrides()];
  window.localStorage.setItem(localClubContentKey, JSON.stringify(updated));
  return next;
}

export function getLocalClubEvents(): LocalClubEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(localClubEventKey);
    return raw ? JSON.parse(raw) as LocalClubEvent[] : [];
  } catch {
    return [];
  }
}

export function getLocalDeletedClubEventIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(localDeletedClubEventKey);
    return raw ? JSON.parse(raw) as string[] : [];
  } catch {
    return [];
  }
}

export function saveLocalClubEvent(input: Omit<LocalClubEvent, 'id' | 'createdAt' | 'participantCount'> & { id?: string; participantCount?: number }) {
  if (typeof window === 'undefined') return input;
  const existing = input.id ? getLocalClubEvents().find(item => item.id === input.id) : null;
  const next: LocalClubEvent = {
    ...input,
    id: input.id ?? `local-event-${Date.now()}`,
    participantCount: input.participantCount ?? existing?.participantCount ?? 0,
    createdAt: existing?.createdAt ?? new Date().toISOString()
  };
  const updated = existing
    ? getLocalClubEvents().map(item => item.id === existing.id ? next : item)
    : [next, ...getLocalClubEvents()];
  window.localStorage.setItem(localClubEventKey, JSON.stringify(updated));
  window.localStorage.setItem(localDeletedClubEventKey, JSON.stringify(getLocalDeletedClubEventIds().filter(id => id !== next.id)));
  return next;
}

export function deleteLocalClubEvent(eventId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(localClubEventKey, JSON.stringify(getLocalClubEvents().filter(item => item.id !== eventId)));
  window.localStorage.setItem(localDeletedClubEventKey, JSON.stringify(Array.from(new Set([eventId, ...getLocalDeletedClubEventIds()]))));
}

export async function fetchClubAdminData(clubId: string) {
  const [clubResult, mediaResult, memberResult, runResult, eventResult, registrationResult, liveResult] = await Promise.all([
    supabase.from('running_clubs').select('*').eq('id', clubId).single(),
    supabase.from('club_media').select('public_url,sort_order').eq('club_id', clubId).order('sort_order'),
    supabase.from('club_members').select('user_id,joined_at,profiles(id,name,avatar_url)').eq('club_id', clubId),
    supabase.from('runs').select('id,user_id,route_id,distance_km,duration_seconds,pace_seconds_per_km,completed_at,routes(title,area)'),
    supabase.from('club_events').select('*').eq('club_id', clubId).order('starts_at'),
    supabase.from('club_event_members').select('event_id,user_id,joined_at,status,profiles(name)'),
    supabase.from('active_runs').select('user_id,event_id,route_title,distance_km,duration_seconds,pace_seconds_per_km,latitude,longitude,updated_at,status,profiles(name)').eq('club_id', clubId)
  ]);
  [clubResult.error, mediaResult.error, memberResult.error, runResult.error, eventResult.error, registrationResult.error, liveResult.error].forEach(fail);

  const memberRows = memberResult.data ?? [];
  const memberIds = new Set(memberRows.map(row => row.user_id));
  const memberRuns = (runResult.data ?? []).filter(run => memberIds.has(run.user_id));
  const weekAgo = Date.now() - 7 * 86400000;
  const profile = (value: unknown) => Array.isArray(value) ? value[0] : value as { id?: string; name?: string; avatar_url?: string } | null;
  const members: ClubAdminMember[] = memberRows.map(row => {
    const runs = memberRuns.filter(run => run.user_id === row.user_id);
    const person = profile(row.profiles);
    const weeklyRuns = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(Date.now() - (6 - index) * 86400000);
      const dayKey = day.toISOString().slice(0, 10);
      const dayRuns = runs.filter(run => run.completed_at?.slice(0, 10) === dayKey);
      return {
        date: dayKey,
        label: new Intl.DateTimeFormat('mn-MN', { weekday: 'short' }).format(day),
        distanceKm: dayRuns.reduce((sum, run) => sum + Number(run.distance_km), 0),
        runCount: dayRuns.length
      };
    });
    const recentRuns = [...runs]
      .sort((first, second) => new Date(second.completed_at).getTime() - new Date(first.completed_at).getTime())
      .slice(0, 8)
      .map(run => {
        const route = (Array.isArray(run.routes) ? run.routes[0] : run.routes) as { title?: string; area?: string } | null;
        return {
          id: run.id,
          routeTitle: route?.title ?? run.route_id ?? 'Маршрутгүй гүйлт',
          routeArea: route?.area,
          distanceKm: Number(run.distance_km),
          durationSeconds: Number(run.duration_seconds),
          paceSecondsPerKm: run.pace_seconds_per_km,
          completedAt: run.completed_at
        };
      });
    return {
      id: row.user_id, name: person?.name ?? 'Гүйгч', avatarUrl: person?.avatar_url,
      joinedAt: row.joined_at, runCount: runs.length,
      totalKm: runs.reduce((sum, run) => sum + Number(run.distance_km), 0),
      weeklyKm: runs.filter(run => new Date(run.completed_at).getTime() >= weekAgo).reduce((sum, run) => sum + Number(run.distance_km), 0),
      weeklyRuns,
      recentRuns
    };
  });
  const events: ClubAdminEvent[] = (eventResult.data ?? []).map(row => ({
    id: row.id, title: row.title, location: row.location, startsAt: row.starts_at,
    distanceKm: row.distance_km === null ? null : Number(row.distance_km), imageUrl: row.image_url,
    description: row.description, advice: row.advice ?? [], enabled: row.enabled
  }));
  const registrations: EventRegistration[] = (registrationResult.data ?? [])
    .filter(row => events.some(event => event.id === row.event_id))
    .map(row => ({
      eventId: row.event_id, userId: row.user_id, joinedAt: row.joined_at, status: row.status,
      name: profile(row.profiles)?.name ?? 'Гүйгч'
    }));
  const liveRuns: LiveRun[] = (liveResult.data ?? []).map(row => ({
    userId: row.user_id, name: profile(row.profiles)?.name ?? 'Гүйгч', eventId: row.event_id,
    routeTitle: row.route_title, distanceKm: Number(row.distance_km), durationSeconds: row.duration_seconds,
    paceSecondsPerKm: row.pace_seconds_per_km, latitude: row.latitude, longitude: row.longitude,
    updatedAt: row.updated_at, status: row.status
  }));
  return { club: { ...clubResult.data, gallery_images: (mediaResult.data ?? []).map(row => row.public_url) }, members, events, registrations, liveRuns };
}

export async function updateManagedClub(clubId: string, values: Record<string, unknown>) {
  const { error } = await supabase.from('running_clubs').update(values).eq('id', clubId);
  fail(error);
}

export async function updateManagedClubGallery(clubId: string, galleryImages: string[]) {
  const { error: deleteError } = await supabase.from('club_media').delete().eq('club_id', clubId);
  fail(deleteError);
  if (!galleryImages.length) return;
  const { error } = await supabase.from('club_media').insert(galleryImages.map((url, index) => ({
    club_id: clubId,
    public_url: url,
    sort_order: index
  })));
  fail(error);
}

function imageDataExtension(uri: string) {
  const mime = uri.match(/^data:image\/([^;,]+)/)?.[1]?.toLowerCase() ?? 'jpg';
  return mime === 'jpeg' ? 'jpg' : mime;
}

function imageContentType(extension: string) {
  const types: Record<string, string> = {
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  };
  return types[extension] ?? 'image/jpeg';
}

async function uploadClubAdminImage(clubId: string, uri: string) {
  if (!uri.startsWith('data:') && !uri.startsWith('blob:')) return uri;
  const extension = imageDataExtension(uri);
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Зургийг уншиж чадсангүй.');
  const path = `${clubId}/events/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('club-media').upload(path, await response.arrayBuffer(), {
    contentType: imageContentType(extension),
    upsert: false
  });
  fail(error);
  return supabase.storage.from('club-media').getPublicUrl(path).data.publicUrl;
}

export async function createManagedEvent(clubId: string, event: Omit<ClubAdminEvent, 'id' | 'enabled'>) {
  const imageUrl = await uploadClubAdminImage(clubId, event.imageUrl);
  const { error } = await supabase.from('club_events').insert({
    id: `club-event-${Date.now()}`, club_id: clubId, title: event.title, location: event.location,
    starts_at: event.startsAt, distance_km: event.distanceKm, image_url: imageUrl,
    description: event.description, advice: event.advice, enabled: true
  });
  fail(error);
}

export async function updateManagedEvent(clubId: string, eventId: string, event: Omit<ClubAdminEvent, 'id' | 'enabled'>) {
  const imageUrl = await uploadClubAdminImage(clubId, event.imageUrl);
  const { error } = await supabase.from('club_events').update({
    title: event.title, location: event.location, starts_at: event.startsAt,
    distance_km: event.distanceKm, image_url: imageUrl, description: event.description,
    advice: event.advice, enabled: true
  }).eq('id', eventId).eq('club_id', clubId);
  fail(error);
}

export async function deleteManagedEvent(clubId: string, eventId: string) {
  const { error } = await supabase.from('club_events').delete().eq('id', eventId).eq('club_id', clubId);
  fail(error);
}

export async function updateRegistrationStatus(eventId: string, userId: string, status: EventRegistration['status']) {
  const { error } = await supabase.from('club_event_members').update({ status }).eq('event_id', eventId).eq('user_id', userId);
  fail(error);
}

export function subscribeToClubLiveRuns(clubId: string, onChange: () => void) {
  const channel = supabase.channel(`club-live-${clubId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'active_runs', filter: `club_id=eq.${clubId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'club_event_members' }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
