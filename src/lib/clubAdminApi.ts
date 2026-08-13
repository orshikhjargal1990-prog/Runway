import { supabase } from './supabase';

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export type ClubAdminContext = { clubId: string; clubName: string; email: string };
export type ClubAdminMember = {
  id: string; name: string; avatarUrl?: string; joinedAt: string;
  totalKm: number; weeklyKm: number; runCount: number;
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

export async function fetchClubAdminData(clubId: string) {
  const [clubResult, memberResult, runResult, eventResult, registrationResult, liveResult] = await Promise.all([
    supabase.from('running_clubs').select('*').eq('id', clubId).single(),
    supabase.from('club_members').select('user_id,joined_at,profiles(id,name,avatar_url)').eq('club_id', clubId),
    supabase.from('runs').select('user_id,distance_km,duration_seconds,completed_at'),
    supabase.from('club_events').select('*').eq('club_id', clubId).order('starts_at'),
    supabase.from('club_event_members').select('event_id,user_id,joined_at,status,profiles(name)'),
    supabase.from('active_runs').select('user_id,event_id,route_title,distance_km,duration_seconds,pace_seconds_per_km,latitude,longitude,updated_at,status,profiles(name)').eq('club_id', clubId)
  ]);
  [clubResult.error, memberResult.error, runResult.error, eventResult.error, registrationResult.error, liveResult.error].forEach(fail);

  const memberRows = memberResult.data ?? [];
  const memberIds = new Set(memberRows.map(row => row.user_id));
  const memberRuns = (runResult.data ?? []).filter(run => memberIds.has(run.user_id));
  const weekAgo = Date.now() - 7 * 86400000;
  const profile = (value: unknown) => Array.isArray(value) ? value[0] : value as { id?: string; name?: string; avatar_url?: string } | null;
  const members: ClubAdminMember[] = memberRows.map(row => {
    const runs = memberRuns.filter(run => run.user_id === row.user_id);
    const person = profile(row.profiles);
    return {
      id: row.user_id, name: person?.name ?? 'Гүйгч', avatarUrl: person?.avatar_url,
      joinedAt: row.joined_at, runCount: runs.length,
      totalKm: runs.reduce((sum, run) => sum + Number(run.distance_km), 0),
      weeklyKm: runs.filter(run => new Date(run.completed_at).getTime() >= weekAgo).reduce((sum, run) => sum + Number(run.distance_km), 0)
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
  return { club: clubResult.data, members, events, registrations, liveRuns };
}

export async function updateManagedClub(clubId: string, values: Record<string, unknown>) {
  const { error } = await supabase.from('running_clubs').update(values).eq('id', clubId);
  fail(error);
}

export async function createManagedEvent(clubId: string, event: Omit<ClubAdminEvent, 'id' | 'enabled'>) {
  const { error } = await supabase.from('club_events').insert({
    id: `club-event-${Date.now()}`, club_id: clubId, title: event.title, location: event.location,
    starts_at: event.startsAt, distance_km: event.distanceKm, image_url: event.imageUrl,
    description: event.description, advice: event.advice, enabled: true
  });
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
