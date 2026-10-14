import type { LoginSlide } from '../content/loginSlides';
import type { Point, RouteOption } from '../native/routes';
import type { ClubEvent, RunningClub } from '../native/clubs';
import type { Challenge, MediaItem, Post, PostComment } from '../native/types';
import { getLocalClubContentOverrides, getLocalClubEvents, getLocalDeletedClubEventIds } from './clubAdminApi';
import { getAdminChallenges } from './adminChallengeContent';
import { getAdminMarathonChallenges } from './marathonAdminContent';
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

type ChallengeRow = {
  id: string;
  title: string;
  org: string;
  type: Challenge['type'];
  challenge_group: Challenge['group'];
  completion_mode?: Challenge['completionMode'] | null;
  goal_km: number | string;
  reward: string | null;
  color: string;
  image_url: string;
  description?: string | null;
  registration_info?: string | null;
  organizer_info?: string | null;
  reward_info?: string | null;
  registration_ends_at: string;
};

function defaultChallengeCompletionMode(group: Challenge['group']): NonNullable<Challenge['completionMode']> {
  return group === '5k' ? 'single_run' : 'cumulative';
}

function challengeCompletionMode(challenge: Pick<Challenge, 'group' | 'completionMode'>): NonNullable<Challenge['completionMode']> {
  return challenge.completionMode ?? defaultChallengeCompletionMode(challenge.group);
}

type RouteRow = {
  id: string;
  title: string;
  city: RouteOption['city'];
  area: string;
  distance_km: number | string;
  live_runners: number;
  elevation_m: number;
  avg_pace: string;
  difficulty: string;
  estimated_duration: string;
  recent_activities: number;
  image_url: string;
  center: Point;
  coordinates: Point[];
};

type ProfileRelation = { name: string; avatar_url?: string | null } | { name: string; avatar_url?: string | null }[] | null;

type PostRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  distance_km: number | string | null;
  duration_seconds: number | null;
  created_at: string;
  profiles: ProfileRelation;
  post_media: {
    id: string;
    type: MediaItem['type'];
    public_url: string;
    sort_order: number;
  }[] | null;
  post_likes: { user_id: string }[] | null;
  post_comments: { id: string }[] | null;
};

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { name: string } | { name: string }[] | null;
};

type LoginSlideRow = {
  id: string;
  eyebrow: string;
  title_before: string;
  accent: string;
  title_after: string;
  subtitle: string;
  media_type: LoginSlide['mediaType'];
  media_url: string;
  media_name: string;
  enabled: boolean;
};

type AdminProfileRow = {
  id: string;
  name: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at: string;
};

type AdminChallengeMemberRow = {
  challenge_id: string;
  challenge_group?: Challenge['group'] | null;
  joined_at: string;
  challenges: { title: string; org: string; goal_km: number | string; challenge_group?: Challenge['group'] | null } | { title: string; org: string; goal_km: number | string; challenge_group?: Challenge['group'] | null }[] | null;
};

type AdminRunRow = {
  id: string;
  route_id: string | null;
  challenge_id: string | null;
  distance_km: number | string;
  duration_seconds: number;
  calories: number;
  pace_seconds_per_km: number | null;
  started_at: string;
  completed_at: string;
  routes?: { title: string; area: string } | { title: string; area: string }[] | null;
  challenges?: { title: string; org: string } | { title: string; org: string }[] | null;
};

type AdminClubEventMemberRow = {
  event_id: string;
  joined_at: string;
  status: string;
  club_events: { title: string; location: string; starts_at: string; running_clubs?: { name: string } | { name: string }[] | null } | { title: string; location: string; starts_at: string; running_clubs?: { name: string } | { name: string }[] | null }[] | null;
};

type AdminCompetitionMemberRow = {
  user_id: string;
  joined_at: string;
  profiles: { name: string | null; email?: string | null } | { name: string | null; email?: string | null }[] | null;
};

type AdminCompetitionRunRow = {
  user_id: string;
  distance_km: number | string;
  duration_seconds: number;
  pace_seconds_per_km: number | null;
  completed_at: string;
};

export type RunInput = {
  userId: string;
  routeId: string | null;
  challengeId: string | null;
  distanceKm: number;
  durationSeconds: number;
  calories: number;
  coordinates: Point[];
  startedAt: string;
  completedAt?: string;
};

export type ProfilePerson = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export type ProfileDashboardData = {
  profile: ProfilePerson;
  totalKm: number;
  totalRuns: number;
  totalSeconds: number;
  previousWeekKm: number;
  weekly: {
    date: string;
    label: string;
    distanceKm: number;
    runs: {
      id: string;
      routeId: string | null;
      distanceKm: number;
      durationSeconds: number;
      calories: number;
      paceSecondsPerKm: number | null;
      coordinates: Point[];
      startedAt: string;
      completedAt: string;
    }[];
  }[];
  following: ProfilePerson[];
  followers: ProfilePerson[];
  challengeProgress: { challengeId: string; totalKm: number; rank: number; participantCount: number }[];
};

export type ProfileSummary = {
  totalKm: number;
  runCount: number;
  postCount: number;
  followerCount: number;
  followingCount: number;
};

export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
};

export type ConversationPreview = {
  person: ProfilePerson;
  message: string;
  createdAt: string;
  unread: number;
};

export type AdminRegisteredUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  joined: string;
  totalKm: number;
  runs: number;
  status: 'active' | 'blocked';
};

export type AdminUserChallenge = {
  challengeId: string;
  title: string;
  org: string;
  group: Challenge['group'];
  goalKm: number;
  joinedAt: string;
};

export type AdminUserRun = {
  id: string;
  routeTitle: string;
  challengeTitle?: string;
  distanceKm: number;
  durationSeconds: number;
  calories: number;
  paceSecondsPerKm?: number;
  startedAt: string;
  completedAt: string;
};

export type AdminUserEventHistory = {
  eventId: string;
  title: string;
  clubName: string;
  location: string;
  startsAt: string;
  joinedAt: string;
  status: string;
};

export type AdminRegisteredUserDetail = AdminRegisteredUser & {
  challenges: AdminUserChallenge[];
  eventHistory: AdminUserEventHistory[];
  runHistory: AdminUserRun[];
};

export type AdminCompetitionPerformance = {
  userId: string;
  name: string;
  email: string;
  rank: number;
  distanceKm: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
  progress: number;
  runCount: number;
  finished: boolean;
  lastRunAt: string;
};

type RunningClubRow = {
  id: string;
  name: string;
  city: string;
  description: string;
  image_url: string;
  member_count: number;
  weekly_km: number | string;
  total_km: number | string;
  rank: number;
  meeting_info: string;
  social_links?: RunningClub['socialLinks'] | null;
};

type ClubMediaRow = {
  club_id: string;
  public_url: string;
  sort_order: number;
};

type ClubEventRow = {
  id: string;
  club_id: string;
  title: string;
  location: string;
  starts_at: string;
  distance_km: number | string | null;
  image_url: string;
  description: string;
  advice: string[] | null;
  participant_count: number;
  running_clubs: { name: string } | { name: string }[] | null;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function formatPostTime(createdAt: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Яг одоо';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)} минутын өмнө`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)} цагийн өмнө`;
  return `${Math.floor(elapsedSeconds / 86400)} өдрийн өмнө`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return undefined;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function profileName(profile: ProfileRelation) {
  if (Array.isArray(profile)) return profile[0]?.name ?? 'Гүйгч';
  return profile?.name ?? 'Гүйгч';
}

function profileAvatar(profile: ProfileRelation) {
  if (Array.isArray(profile)) return profile[0]?.avatar_url ?? undefined;
  return profile?.avatar_url ?? undefined;
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatAdminDate(value: string) {
  return new Date(value).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fileExtension(uri: string, type: MediaItem['type']) {
  const dataMime = uri.match(/^data:([^;,]+)/)?.[1];
  if (dataMime === 'image/svg+xml') return 'svg';
  if (dataMime === 'image/png') return 'png';
  if (dataMime === 'image/webp') return 'webp';
  if (dataMime === 'image/jpeg') return 'jpg';
  if (dataMime === 'video/mp4') return 'mp4';
  const cleanUri = uri.split('?')[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  if (match) return match[1].toLowerCase();
  return type === 'video' ? 'mp4' : 'jpg';
}

function contentType(extension: string, type: MediaItem['type']) {
  const types: Record<string, string> = {
    gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg', mov: 'video/quicktime',
    mp4: 'video/mp4', png: 'image/png', svg: 'image/svg+xml', webm: 'video/webm', webp: 'image/webp'
  };
  return types[extension] ?? (type === 'video' ? 'video/mp4' : 'image/jpeg');
}

const base64Lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToArrayBuffer(value: string) {
  const clean = value.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const outputLength = Math.floor((clean.length * 3) / 4) - padding;
  const bytes = new Uint8Array(Math.max(0, outputLength));
  let buffer = 0;
  let bits = 0;
  let outputIndex = 0;

  for (const char of clean) {
    if (char === '=') break;
    const valueIndex = base64Lookup.indexOf(char);
    if (valueIndex < 0) continue;
    buffer = (buffer << 6) | valueIndex;
    bits += 6;
    if (bits >= 8 && outputIndex < bytes.length) {
      bits -= 8;
      bytes[outputIndex] = (buffer >> bits) & 0xff;
      outputIndex += 1;
    }
  }

  return bytes.buffer;
}

async function uriToArrayBuffer(uri: string) {
  const dataMatch = uri.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (dataMatch) {
    const encoded = dataMatch[3] ?? '';
    if (dataMatch[2]) return base64ToArrayBuffer(encoded);
    const value = decodeURIComponent(encoded);
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index);
    return bytes.buffer;
  }

  if (/^(file|content|asset-library):/.test(uri)) {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return base64ToArrayBuffer(base64);
    } catch (error) {
      throw new Error(`local media read: ${error instanceof Error ? error.message : 'файлыг уншиж чадсангүй'}`);
    }
  }

  const response = await fetch(uri);
  if (!response.ok) throw new Error('Медиа файлыг уншиж чадсангүй.');
  return response.arrayBuffer();
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const withMode = await supabase
    .from('challenges')
    .select('id,title,org,type,challenge_group,completion_mode,goal_km,reward,color,image_url,description,registration_info,organizer_info,reward_info,registration_ends_at')
    .eq('enabled', true)
    .order('registration_ends_at');
  const withoutMode = withMode.error?.message.includes('completion_mode')
    ? await supabase
      .from('challenges')
      .select('id,title,org,type,challenge_group,goal_km,reward,color,image_url,description,registration_info,organizer_info,reward_info,registration_ends_at')
      .eq('enabled', true)
      .order('registration_ends_at')
    : withMode;
  const { data, error } = withoutMode;
  throwIfError(error);

  const remoteChallenges = ((data ?? []) as ChallengeRow[]).map(row => ({
    id: row.id,
    title: row.title,
    org: row.org,
    type: row.type,
    group: row.challenge_group,
    completionMode: row.completion_mode ?? defaultChallengeCompletionMode(row.challenge_group),
    goalKm: Number(row.goal_km),
    reward: row.reward ?? undefined,
    color: row.color,
    image: row.image_url,
    description: row.description ?? undefined,
    registrationInfo: row.registration_info ?? undefined,
    organizerInfo: row.organizer_info ?? undefined,
    rewardInfo: row.reward_info ?? undefined,
    registrationEndsInSeconds: Math.max(0, Math.floor((new Date(row.registration_ends_at).getTime() - Date.now()) / 1000))
  }));
  const adminChallenges = getAdminChallenges();
  const remoteIds = new Set(remoteChallenges.map(challenge => challenge.id));
  return [
    ...adminChallenges.filter(challenge => !remoteIds.has(challenge.id)),
    ...getAdminMarathonChallenges().filter(challenge => !remoteIds.has(challenge.id)),
    ...remoteChallenges
  ];
}

export async function fetchRoutes(): Promise<RouteOption[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('id,title,city,area,distance_km,live_runners,elevation_m,avg_pace,difficulty,estimated_duration,recent_activities,image_url,center,coordinates')
    .eq('enabled', true)
    .order('title');
  throwIfError(error);

  return ((data ?? []) as RouteRow[]).map(row => ({
    id: row.id,
    title: row.title,
    city: row.city,
    area: row.area,
    distanceKm: Number(row.distance_km),
    liveRunners: row.live_runners,
    elevationM: row.elevation_m,
    avgPace: row.avg_pace,
    difficulty: row.difficulty,
    estimatedDuration: row.estimated_duration,
    recentActivities: row.recent_activities,
    image: row.image_url,
    center: row.center,
    coordinates: row.coordinates
  }));
}

export async function saveAdminRoute(route: RouteOption): Promise<RouteOption> {
  const { error } = await supabase.from('routes').upsert({
    id: route.id,
    title: route.title,
    city: route.city,
    area: route.area,
    distance_km: route.distanceKm,
    live_runners: route.liveRunners,
    elevation_m: route.elevationM,
    avg_pace: route.avgPace,
    difficulty: route.difficulty,
    estimated_duration: route.estimatedDuration,
    recent_activities: route.recentActivities,
    image_url: route.image,
    center: route.center,
    coordinates: route.coordinates,
    enabled: true,
    updated_at: new Date().toISOString()
  });
  throwIfError(error);
  return route;
}

export async function deleteAdminRoute(routeId: string): Promise<void> {
  const { error } = await supabase
    .from('routes')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('id', routeId);
  throwIfError(error);
}

export async function fetchRunningClubs(userId?: string): Promise<RunningClub[]> {
  const clubsQuery = () => supabase
    .from('running_clubs')
    .select('id,name,city,description,image_url,member_count,weekly_km,total_km,rank,meeting_info,social_links')
    .eq('enabled', true)
    .order('rank')
    .limit(10);
  const fallbackClubsQuery = () => supabase
    .from('running_clubs')
    .select('id,name,city,description,image_url,member_count,weekly_km,total_km,rank,meeting_info')
    .eq('enabled', true)
    .order('rank')
    .limit(10);
  const [initialClubsResult, membershipsResult, mediaResult] = await Promise.all([
    clubsQuery(),
    userId
      ? supabase.from('club_members').select('club_id').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('club_media').select('club_id,public_url,sort_order').order('sort_order')
  ]);
  const clubsResult = initialClubsResult.error?.message.includes('social_links')
    ? await fallbackClubsQuery()
    : initialClubsResult;
  throwIfError(clubsResult.error);
  throwIfError(membershipsResult.error);
  const joinedIds = new Set((membershipsResult.data ?? []).map(item => item.club_id as string));
  const mediaRows = mediaResult.error ? [] : (mediaResult.data ?? []) as ClubMediaRow[];
  const localOverrides = getLocalClubContentOverrides();

  return ((clubsResult.data ?? []) as RunningClubRow[]).map(club => {
    const local = localOverrides.find(item => item.clubId === club.id);
    const image = local?.imageUrl ?? club.image_url;
    const gallery = local?.galleryImages?.length
      ? local.galleryImages
      : mediaRows.filter(item => item.club_id === club.id).map(item => item.public_url);
    return {
      id: club.id,
      name: club.name,
      city: club.city,
      description: club.description,
      image,
      memberCount: club.member_count,
      weeklyKm: Number(club.weekly_km),
      totalKm: Number(club.total_km ?? 0),
      rank: club.rank,
      meetingInfo: club.meeting_info,
      socialLinks: local?.socialLinks ?? club.social_links ?? undefined,
      galleryImages: gallery.length ? gallery : [image],
      joined: joinedIds.has(club.id)
    };
  });
}

function imageDataExtension(uri: string) {
  const mime = uri.match(/^data:image\/([^;,]+)/)?.[1]?.toLowerCase() ?? 'jpg';
  return mime === 'jpeg' ? 'jpg' : mime;
}

async function uploadClubImage(clubId: string, uri: string, index: number) {
  if (!uri.startsWith('data:') && !uri.startsWith('blob:')) return uri;
  const extension = imageDataExtension(uri);
  const path = `${clubId}/${Date.now()}-${index}.${extension}`;
  const bytes = await uriToArrayBuffer(uri);
  const { error } = await supabase.storage.from('club-media').upload(path, bytes, {
    contentType: contentType(extension, 'image'),
    upsert: false
  });
  throwIfError(error);
  return supabase.storage.from('club-media').getPublicUrl(path).data.publicUrl;
}

export async function saveRunningClubs(clubs: RunningClub[]): Promise<RunningClub[]> {
  const normalized: RunningClub[] = [];
  for (const club of clubs) {
    const image = await uploadClubImage(club.id, club.image, -1);
    const galleryImages: string[] = [];
    for (const [index, uri] of club.galleryImages.entries()) {
      galleryImages.push(await uploadClubImage(club.id, uri, index));
    }
    normalized.push({ ...club, image, galleryImages });
  }

  const { error: clubError } = await supabase.from('running_clubs').upsert(normalized.map(club => ({
    id: club.id,
    name: club.name.trim(),
    city: club.city.trim(),
    description: club.description.trim(),
    image_url: club.image,
    member_count: club.memberCount,
    weekly_km: club.weeklyKm,
    total_km: club.totalKm,
    rank: club.rank,
    meeting_info: club.meetingInfo,
    social_links: club.socialLinks ?? {},
    enabled: true
  })));
  throwIfError(clubError);

  for (const club of normalized) {
    const { error: deleteError } = await supabase.from('club_media').delete().eq('club_id', club.id);
    throwIfError(deleteError);
    if (club.galleryImages.length) {
      const { error: mediaError } = await supabase.from('club_media').insert(club.galleryImages.map((url, index) => ({
        club_id: club.id,
        public_url: url,
        storage_path: url.includes('/club-media/') ? decodeURIComponent(url.split('/club-media/')[1]) : null,
        sort_order: index
      })));
      throwIfError(mediaError);
    }
  }
  return normalized;
}

export async function fetchClubEvents(): Promise<ClubEvent[]> {
  const { data, error } = await supabase
    .from('club_events')
    .select('id,club_id,title,location,starts_at,distance_km,image_url,description,advice,participant_count,running_clubs(name)')
    .eq('enabled', true)
    .order('starts_at');
  throwIfError(error);

  const remoteEvents = ((data ?? []) as unknown as ClubEventRow[]).map(event => ({
    id: event.id,
    clubId: event.club_id,
    clubName: Array.isArray(event.running_clubs) ? event.running_clubs[0]?.name ?? 'Гүйлтийн клуб' : event.running_clubs?.name ?? 'Гүйлтийн клуб',
    title: event.title,
    location: event.location,
    startsAt: event.starts_at,
    distanceKm: event.distance_km === null ? undefined : Number(event.distance_km),
    image: event.image_url,
    description: event.description,
    advice: event.advice ?? [],
    participantCount: event.participant_count
  }));
  const deletedEventIds = new Set(getLocalDeletedClubEventIds());
  const localEvents = getLocalClubEvents().filter(event => !deletedEventIds.has(event.id)).map(event => ({
    id: event.id,
    clubId: event.clubId,
    clubName: event.clubName,
    title: event.title,
    location: event.location,
    startsAt: event.startsAt,
    distanceKm: event.distanceKm ?? undefined,
    image: event.imageUrl,
    description: event.description,
    advice: event.advice,
    participantCount: event.participantCount
  }));
  const remoteIds = new Set(remoteEvents.map(event => event.id));
  return [...localEvents.filter(event => !remoteIds.has(event.id)), ...remoteEvents.filter(event => !deletedEventIds.has(event.id))];
}

export async function fetchJoinedClubEventIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('club_event_members').select('event_id').eq('user_id', userId);
  throwIfError(error);
  return (data ?? []).map(item => item.event_id as string);
}

export async function setClubEventParticipation(userId: string, eventId: string, participating: boolean): Promise<void> {
  if (participating) {
    const { error } = await supabase.from('club_event_members').upsert({
      user_id: userId,
      event_id: eventId,
      status: 'registered'
    });
    throwIfError(error);
    return;
  }
  const { error } = await supabase.from('club_event_members').delete().eq('user_id', userId).eq('event_id', eventId);
  throwIfError(error);
}

export async function setClubMembership(userId: string, clubId: string, joined: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_my_running_club', {
    target_club_id: joined ? clubId : null
  });
  throwIfError(error);
}

export async function fetchPosts(currentUserId?: string): Promise<Post[]> {
  const [{ data, error }, followingResult] = await Promise.all([
    supabase
    .from('posts')
    .select('id,user_id,title,description,distance_km,duration_seconds,created_at,profiles(name,avatar_url),post_media(id,type,public_url,sort_order),post_likes(user_id),post_comments(id)')
    .order('created_at', { ascending: false }),
    currentUserId
      ? supabase.from('follows').select('following_id').eq('follower_id', currentUserId)
      : Promise.resolve({ data: [], error: null })
  ]);
  throwIfError(error);
  throwIfError(followingResult.error);
  const followingIds = new Set((followingResult.data ?? []).map(item => item.following_id as string));

  return ((data ?? []) as unknown as PostRow[]).map(row => ({
    id: row.id,
    userId: row.user_id,
    user: profileName(row.profiles),
    userAvatar: profileAvatar(row.profiles),
    isMe: row.user_id === currentUserId,
    isFollowing: followingIds.has(row.user_id),
    title: row.title,
    description: row.description,
    media: (row.post_media ?? [])
      .sort((first, second) => first.sort_order - second.sort_order)
      .map(item => ({ id: item.id, type: item.type, uri: item.public_url })),
    time: formatPostTime(row.created_at),
    distanceKm: row.distance_km === null ? undefined : Number(row.distance_km),
    duration: formatDuration(row.duration_seconds),
    likeCount: row.post_likes?.length ?? 0,
    commentCount: row.post_comments?.length ?? 0,
    likedByMe: row.post_likes?.some(like => like.user_id === currentUserId) ?? false
  }));
}

export async function setUserFollowing(followerId: string, followingId: string, following: boolean): Promise<void> {
  if (following) {
    const { error } = await supabase.from('follows').upsert({ follower_id: followerId, following_id: followingId });
    throwIfError(error);
    return;
  }
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  throwIfError(error);
}

export async function setPostLiked(postId: string, userId: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase.from('post_likes').upsert({ post_id: postId, user_id: userId });
    throwIfError(error);
    return;
  }
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  throwIfError(error);
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id,user_id,body,created_at,profiles(name)')
    .eq('post_id', postId)
    .order('created_at');
  throwIfError(error);
  return ((data ?? []) as unknown as CommentRow[]).map(comment => ({
    id: comment.id,
    userId: comment.user_id,
    user: profileName(comment.profiles),
    body: comment.body,
    time: formatPostTime(comment.created_at)
  }));
}

export async function createPostComment(input: {
  postId: string;
  userId: string;
  body: string;
}): Promise<PostComment> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: input.postId, user_id: input.userId, body: input.body.trim() })
    .select('id,user_id,body,created_at,profiles(name)')
    .single();
  throwIfError(error);
  if (!data) throw new Error('Коммент үүссэнгүй.');
  const comment = data as unknown as CommentRow;
  return {
    id: comment.id,
    userId: comment.user_id,
    user: profileName(comment.profiles),
    body: comment.body,
    time: formatPostTime(comment.created_at)
  };
}

export async function createPost(input: {
  userId: string;
  title: string;
  description: string;
  media: MediaItem[];
}): Promise<void> {
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({ user_id: input.userId, title: input.title, description: input.description })
    .select('id')
    .single();
  if (postError) throw new Error(`posts insert: ${postError.message}`);
  if (!post) throw new Error('Нийтлэлийн мөр үүссэнгүй.');

  const uploadedPaths: string[] = [];
  try {
    for (const [index, item] of input.media.entries()) {
      const extension = fileExtension(item.uri, item.type);
      const path = `${input.userId}/${post.id}/${index}-${Date.now()}.${extension}`;
      const bytes = await uriToArrayBuffer(item.uri);
      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(path, bytes, { contentType: contentType(extension, item.type), upsert: false });
      if (uploadError) throw new Error(`post-media upload: ${uploadError.message}`);
      uploadedPaths.push(path);

      const publicUrl = supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
      const { error: mediaError } = await supabase.from('post_media').insert({
        post_id: post.id,
        type: item.type,
        storage_path: path,
        public_url: publicUrl,
        sort_order: index
      });
      if (mediaError) throw new Error(`post_media insert: ${mediaError.message}`);
    }
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from('post-media').remove(uploadedPaths);
    await supabase.from('posts').delete().eq('id', post.id);
    throw error;
  }
}

export async function fetchJoinedChallengeIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('challenge_members')
    .select('challenge_id')
    .eq('user_id', userId);
  throwIfError(error);
  return (data ?? []).map(item => item.challenge_id as string);
}

export async function ensureUserProfile(userId: string, name: string, email: string): Promise<void> {
  const normalizedName = name.trim() || 'Гүйгч';
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, name: normalizedName, email: normalizedEmail, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (!error) return;
  if (error.message.includes('email')) {
    const { error: fallbackError } = await supabase
      .from('profiles')
      .upsert({ id: userId, name: normalizedName, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    throwIfError(fallbackError);
    return;
  }
  throwIfError(error);
}

export async function updateProfileAvatar(userId: string, avatarUrl: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);
  throwIfError(error);
}

export async function joinChallenge(userId: string, challenge: Challenge) {
  const registrationEndsAt = new Date(Date.now() + challenge.registrationEndsInSeconds * 1000).toISOString();
  const completionMode = challengeCompletionMode(challenge);
  const v2Result = await supabase.rpc('register_challenge_with_snapshot_v2', {
    target_challenge_id: challenge.id,
    target_title: challenge.title,
    target_org: challenge.org,
    target_type: challenge.type,
    target_group: challenge.group,
    target_completion_mode: completionMode,
    target_goal_km: challenge.goalKm,
    target_reward: challenge.reward ?? null,
    target_color: challenge.color,
    target_image_url: challenge.image,
    target_registration_ends_at: registrationEndsAt
  });
  if (!v2Result.error) return;

  const { error } = await supabase.rpc('register_challenge_with_snapshot', {
    target_challenge_id: challenge.id,
    target_title: challenge.title,
    target_org: challenge.org,
    target_type: challenge.type,
    target_group: challenge.group,
    target_goal_km: challenge.goalKm,
    target_reward: challenge.reward ?? null,
    target_color: challenge.color,
    target_image_url: challenge.image,
    target_registration_ends_at: registrationEndsAt
  });
  if (!error) return;
  const { error: fallbackError } = await supabase.rpc('set_my_active_challenge', {
    target_challenge_id: challenge.id
  });
  if (!fallbackError) return;

  const snapshotWithMode = await supabase
    .from('challenges')
    .upsert({
      id: challenge.id,
      title: challenge.title,
      org: challenge.org,
      type: challenge.type,
      challenge_group: challenge.group,
      completion_mode: completionMode,
      goal_km: challenge.goalKm,
      reward: challenge.reward ?? null,
      color: challenge.color,
      image_url: challenge.image,
      registration_ends_at: registrationEndsAt,
      enabled: true
    });
  const snapshotError = snapshotWithMode.error?.message.includes('completion_mode')
    ? (await supabase
      .from('challenges')
      .upsert({
        id: challenge.id,
        title: challenge.title,
        org: challenge.org,
        type: challenge.type,
        challenge_group: challenge.group,
        goal_km: challenge.goalKm,
        reward: challenge.reward ?? null,
        color: challenge.color,
        image_url: challenge.image,
        registration_ends_at: registrationEndsAt,
        enabled: true
      })).error
    : snapshotWithMode.error;
  throwIfError(snapshotError);

  const { error: deleteError } = await supabase
    .from('challenge_members')
    .delete()
    .eq('user_id', userId)
    .eq('challenge_group', challenge.group);
  throwIfError(deleteError);

  const { error: insertError } = await supabase
    .from('challenge_members')
    .insert({ challenge_id: challenge.id, user_id: userId, challenge_group: challenge.group });
  throwIfError(insertError);
}

export async function fetchAdminRegisteredUsers(): Promise<AdminRegisteredUser[]> {
  const profileQuery = () => supabase.from('profiles').select('id,name,email,avatar_url,created_at').order('created_at', { ascending: false });
  const fallbackProfileQuery = () => supabase.from('profiles').select('id,name,avatar_url,created_at').order('created_at', { ascending: false });
  const profileResult = await profileQuery();
  const profilesResult = profileResult.error?.message.includes('email') ? await fallbackProfileQuery() : profileResult;
  throwIfError(profilesResult.error);

  const profiles = (profilesResult.data ?? []) as AdminProfileRow[];
  if (!profiles.length) return [];
  const ids = profiles.map(profile => profile.id);
  const { data: runRows, error: runError } = await supabase
    .from('runs')
    .select('user_id,distance_km')
    .in('user_id', ids);
  throwIfError(runError);

  const stats = new Map<string, { totalKm: number; runs: number }>();
  for (const row of runRows ?? []) {
    const userId = row.user_id as string;
    const current = stats.get(userId) ?? { totalKm: 0, runs: 0 };
    current.totalKm += Number(row.distance_km ?? 0);
    current.runs += 1;
    stats.set(userId, current);
  }

  return profiles.map(profile => {
    const stat = stats.get(profile.id) ?? { totalKm: 0, runs: 0 };
    return {
      id: profile.id,
      name: profile.name || 'Гүйгч',
      email: profile.email || 'Имэйл бүртгэгдээгүй',
      avatarUrl: profile.avatar_url ?? undefined,
      joined: formatAdminDate(profile.created_at),
      totalKm: Number(stat.totalKm.toFixed(1)),
      runs: stat.runs,
      status: 'active'
    };
  });
}

export async function fetchAdminRegisteredUserDetail(userId: string): Promise<AdminRegisteredUserDetail> {
  const profileQuery = () => supabase.from('profiles').select('id,name,email,avatar_url,created_at').eq('id', userId).single();
  const fallbackProfileQuery = () => supabase.from('profiles').select('id,name,avatar_url,created_at').eq('id', userId).single();
  const initialProfileResult = await profileQuery();
  const profileResult = initialProfileResult.error?.message.includes('email') ? await fallbackProfileQuery() : initialProfileResult;
  throwIfError(profileResult.error);
  if (!profileResult.data) throw new Error('Хэрэглэгч олдсонгүй.');

  const [challengeResult, runResult, eventResult] = await Promise.all([
    supabase
      .from('challenge_members')
      .select('challenge_id,challenge_group,joined_at,challenges(title,org,goal_km,challenge_group)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false }),
    supabase
      .from('runs')
      .select('id,route_id,challenge_id,distance_km,duration_seconds,calories,pace_seconds_per_km,started_at,completed_at,routes(title,area),challenges(title,org)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false }),
    supabase
      .from('club_event_members')
      .select('event_id,joined_at,status,club_events(title,location,starts_at,running_clubs(name))')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
  ]);
  throwIfError(challengeResult.error);
  throwIfError(runResult.error);
  throwIfError(eventResult.error);

  const profile = profileResult.data as AdminProfileRow;
  const runHistory = ((runResult.data ?? []) as unknown as AdminRunRow[]).map(run => {
    const route = relationOne(run.routes);
    const challenge = relationOne(run.challenges);
    return {
      id: run.id,
      routeTitle: route?.title ?? run.route_id ?? 'Маршрутгүй гүйлт',
      challengeTitle: challenge?.title,
      distanceKm: Number(run.distance_km),
      durationSeconds: Number(run.duration_seconds),
      calories: Number(run.calories),
      paceSecondsPerKm: run.pace_seconds_per_km ?? undefined,
      startedAt: run.started_at,
      completedAt: run.completed_at
    };
  });
  const totalKm = runHistory.reduce((sum, run) => sum + run.distanceKm, 0);

  return {
    id: profile.id,
    name: profile.name || 'Гүйгч',
    email: profile.email || 'Имэйл бүртгэгдээгүй',
    avatarUrl: profile.avatar_url ?? undefined,
    joined: formatAdminDate(profile.created_at),
    totalKm: Number(totalKm.toFixed(1)),
    runs: runHistory.length,
    status: 'active',
    challenges: ((challengeResult.data ?? []) as unknown as AdminChallengeMemberRow[]).map(member => {
      const challenge = relationOne(member.challenges);
      return {
        challengeId: member.challenge_id,
        title: challenge?.title ?? member.challenge_id,
        org: challenge?.org ?? 'RunBoost',
        group: member.challenge_group ?? challenge?.challenge_group ?? '5k',
        goalKm: Number(challenge?.goal_km ?? 0),
        joinedAt: member.joined_at
      };
    }),
    eventHistory: ((eventResult.data ?? []) as unknown as AdminClubEventMemberRow[]).map(member => {
      const event = relationOne(member.club_events);
      const club = relationOne(event?.running_clubs);
      return {
        eventId: member.event_id,
        title: event?.title ?? member.event_id,
        clubName: club?.name ?? 'Клуб',
        location: event?.location ?? '',
        startsAt: event?.starts_at ?? member.joined_at,
        joinedAt: member.joined_at,
        status: member.status
      };
    }),
    runHistory
  };
}

export async function fetchAdminCompetitionPerformance(competitionId: string, goalKm: number): Promise<AdminCompetitionPerformance[]> {
  const [memberResult, runResult] = await Promise.all([
    supabase
      .from('challenge_members')
      .select('user_id,joined_at,profiles(name,email)')
      .eq('challenge_id', competitionId),
    supabase
      .from('runs')
      .select('user_id,distance_km,duration_seconds,pace_seconds_per_km,completed_at')
      .eq('challenge_id', competitionId)
      .order('completed_at', { ascending: false })
  ]);
  throwIfError(memberResult.error);
  throwIfError(runResult.error);

  const rows = new Map<string, AdminCompetitionPerformance>();
  for (const member of (memberResult.data ?? []) as unknown as AdminCompetitionMemberRow[]) {
    const profile = relationOne(member.profiles);
    rows.set(member.user_id, {
      userId: member.user_id,
      name: profile?.name ?? 'Гүйгч',
      email: profile?.email ?? '',
      rank: 0,
      distanceKm: 0,
      durationSeconds: 0,
      paceSecondsPerKm: 0,
      progress: 0,
      runCount: 0,
      finished: false,
      lastRunAt: member.joined_at
    });
  }

  for (const run of (runResult.data ?? []) as unknown as AdminCompetitionRunRow[]) {
    const current = rows.get(run.user_id) ?? {
      userId: run.user_id,
      name: 'Гүйгч',
      email: '',
      rank: 0,
      distanceKm: 0,
      durationSeconds: 0,
      paceSecondsPerKm: 0,
      progress: 0,
      runCount: 0,
      finished: false,
      lastRunAt: run.completed_at
    };
    current.distanceKm += Number(run.distance_km);
    current.durationSeconds += run.duration_seconds;
    current.runCount += 1;
    current.lastRunAt = new Date(run.completed_at).getTime() > new Date(current.lastRunAt).getTime()
      ? run.completed_at
      : current.lastRunAt;
    rows.set(run.user_id, current);
  }

  return Array.from(rows.values())
    .map(row => ({
      ...row,
      distanceKm: Number(row.distanceKm.toFixed(2)),
      paceSecondsPerKm: row.distanceKm > 0 ? Math.round(row.durationSeconds / row.distanceKm) : 0,
      progress: Math.min(100, Math.round((row.distanceKm / goalKm) * 100)),
      finished: row.distanceKm >= goalKm
    }))
    .sort((first, second) => {
      if (first.finished !== second.finished) return first.finished ? -1 : 1;
      if (second.distanceKm !== first.distanceKm) return second.distanceKm - first.distanceKm;
      return first.durationSeconds - second.durationSeconds;
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function leaveChallenge(userId: string, challengeId: string) {
  const { error } = await supabase.rpc('leave_my_challenge', {
    target_challenge_id: challengeId
  });
  if (!error) return;
  const { error: fallbackError } = await supabase
    .from('challenge_members')
    .delete()
    .eq('user_id', userId)
    .eq('challenge_id', challengeId);
  throwIfError(fallbackError ?? error);
}

export async function saveRun(input: RunInput): Promise<void> {
  const pace = input.distanceKm > 0 ? Math.round(input.durationSeconds / input.distanceKm) : null;
  const { error } = await supabase.from('runs').insert({
    user_id: input.userId,
    route_id: input.routeId,
    challenge_id: input.challengeId,
    distance_km: input.distanceKm,
    duration_seconds: input.durationSeconds,
    calories: input.calories,
    pace_seconds_per_km: pace,
    coordinates: input.coordinates,
    started_at: input.startedAt,
    completed_at: input.completedAt ?? new Date().toISOString()
  });
  throwIfError(error);
}

export async function updateActiveRun(input: {
  userId: string;
  routeId: string | null;
  routeTitle: string;
  clubId?: string | null;
  eventId?: string | null;
  distanceKm: number;
  durationSeconds: number;
  latitude: number | null;
  longitude: number | null;
  startedAt: string;
  paused: boolean;
}): Promise<void> {
  const pace = input.distanceKm > 0 ? Math.round(input.durationSeconds / input.distanceKm) : null;
  const { error } = await supabase.from('active_runs').upsert({
    user_id: input.userId,
    club_id: input.clubId ?? null,
    event_id: input.eventId ?? null,
    route_id: input.routeId,
    route_title: input.routeTitle,
    distance_km: input.distanceKm,
    duration_seconds: input.durationSeconds,
    pace_seconds_per_km: pace,
    latitude: input.latitude,
    longitude: input.longitude,
    started_at: input.startedAt,
    status: input.paused ? 'paused' : 'running'
  });
  throwIfError(error);
}

export async function clearActiveRun(userId: string): Promise<void> {
  const { error } = await supabase.from('active_runs').delete().eq('user_id', userId);
  throwIfError(error);
}

function mapProfile(row: { id: string; name: string; avatar_url: string | null }): ProfilePerson {
  return { id: row.id, name: row.name, avatarUrl: row.avatar_url ?? undefined };
}

async function fetchProfilesByIds(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('profiles').select('id,name,avatar_url').in('id', ids);
  throwIfError(error);
  return (data ?? []).map(mapProfile);
}

export async function fetchProfileDashboard(userId: string): Promise<ProfileDashboardData> {
  const [profileResult, runsResult, followingResult, followersResult, progressResult] = await Promise.all([
    supabase.from('profiles').select('id,name,avatar_url').eq('id', userId).single(),
    supabase.from('runs').select('id,route_id,distance_km,duration_seconds,calories,pace_seconds_per_km,coordinates,started_at,completed_at').eq('user_id', userId).order('completed_at'),
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId),
    supabase.rpc('get_my_challenge_progress')
  ]);
  throwIfError(profileResult.error);
  throwIfError(runsResult.error);
  throwIfError(followingResult.error);
  throwIfError(followersResult.error);
  if (!profileResult.data) throw new Error('Профайл олдсонгүй.');

  const followingIds = (followingResult.data ?? []).map(item => item.following_id as string);
  const followerIds = (followersResult.data ?? []).map(item => item.follower_id as string);
  const people = await fetchProfilesByIds([...new Set([...followingIds, ...followerIds])]);
  const peopleById = new Map(people.map(person => [person.id, person]));
  const runs = (runsResult.data ?? []).map(run => ({
    id: String(run.id),
    routeId: run.route_id ? String(run.route_id) : null,
    distanceKm: Number(run.distance_km),
    durationSeconds: Number(run.duration_seconds),
    calories: Number(run.calories ?? 0),
    paceSecondsPerKm: run.pace_seconds_per_km === null ? null : Number(run.pace_seconds_per_km),
    coordinates: Array.isArray(run.coordinates) ? run.coordinates as Point[] : [],
    startedAt: String(run.started_at ?? run.completed_at),
    completedAt: String(run.completed_at)
  }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLabels = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    const dayRuns = runs.filter(run => {
        const completedAt = new Date(run.completedAt);
        return completedAt >= date && completedAt < nextDate;
      });
    const distanceKm = dayRuns.reduce((sum, run) => sum + run.distanceKm, 0);
    return { date: date.toISOString(), label: dayLabels[date.getDay()], distanceKm, runs: dayRuns };
  });
  const previousWeekStart = new Date(today);
  previousWeekStart.setDate(today.getDate() - 7);
  const previousWeekKm = runs
    .filter(run => {
      const completedAt = new Date(run.completedAt);
      return completedAt >= previousWeekStart && completedAt < today;
    })
    .reduce((sum, run) => sum + run.distanceKm, 0);

  const challengeProgress = progressResult.error ? [] : ((progressResult.data ?? []) as { challenge_id: string; total_km: number | string; rank: number; participant_count: number }[]).map(item => ({
    challengeId: item.challenge_id,
    totalKm: Number(item.total_km),
    rank: Number(item.rank),
    participantCount: Number(item.participant_count)
  }));

  return {
    profile: mapProfile(profileResult.data),
    totalKm: runs.reduce((sum, run) => sum + run.distanceKm, 0),
    totalRuns: runs.length,
    totalSeconds: runs.reduce((sum, run) => sum + run.durationSeconds, 0),
    previousWeekKm,
    weekly,
    following: followingIds.map(id => peopleById.get(id)).filter((person): person is ProfilePerson => Boolean(person)),
    followers: followerIds.map(id => peopleById.get(id)).filter((person): person is ProfilePerson => Boolean(person)),
    challengeProgress
  };
}

export async function fetchProfileSummary(userId: string): Promise<ProfileSummary> {
  const { data, error } = await supabase.rpc('get_profile_summary', { target_user_id: userId });
  throwIfError(error);
  const row = (data as { total_km: number | string; run_count: number; post_count: number; follower_count: number; following_count: number }[] | null)?.[0];
  return {
    totalKm: Number(row?.total_km ?? 0),
    runCount: Number(row?.run_count ?? 0),
    postCount: Number(row?.post_count ?? 0),
    followerCount: Number(row?.follower_count ?? 0),
    followingCount: Number(row?.following_count ?? 0)
  };
}

export async function fetchDirectMessages(userId: string, otherUserId: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('id,sender_id,recipient_id,body,created_at')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
    .order('created_at');
  throwIfError(error);
  return (data ?? []).map(message => ({
    id: message.id as string,
    senderId: message.sender_id as string,
    recipientId: message.recipient_id as string,
    body: message.body as string,
    createdAt: message.created_at as string
  }));
}

export async function fetchConversationPreviews(userId: string): Promise<ConversationPreview[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('sender_id,recipient_id,body,created_at,read_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200);
  throwIfError(error);
  const messages = data ?? [];
  const peopleIds = [...new Set(messages.map(message => message.sender_id === userId ? message.recipient_id : message.sender_id))] as string[];
  const people = await fetchProfilesByIds(peopleIds);
  const peopleById = new Map(people.map(person => [person.id, person]));
  return peopleIds.map(personId => {
    const conversation = messages.filter(message => message.sender_id === personId || message.recipient_id === personId);
    const latest = conversation[0];
    return {
      person: peopleById.get(personId) ?? { id: personId, name: 'Гүйгч' },
      message: String(latest?.body ?? ''),
      createdAt: String(latest?.created_at ?? new Date().toISOString()),
      unread: conversation.filter(message => message.recipient_id === userId && !message.read_at).length
    };
  });
}

export async function sendDirectMessage(senderId: string, recipientId: string, body: string): Promise<DirectMessage> {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, body: body.trim() })
    .select('id,sender_id,recipient_id,body,created_at')
    .single();
  throwIfError(error);
  if (!data) throw new Error('Мессеж илгээгдсэнгүй.');
  return {
    id: data.id as string,
    senderId: data.sender_id as string,
    recipientId: data.recipient_id as string,
    body: data.body as string,
    createdAt: data.created_at as string
  };
}

export async function markConversationRead(userId: string, otherUserId: string): Promise<void> {
  const { error } = await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .eq('sender_id', otherUserId)
    .is('read_at', null);
  throwIfError(error);
}

export async function fetchLoginSlides(): Promise<LoginSlide[]> {
  const { data, error } = await supabase
    .from('login_slides')
    .select('id,eyebrow,title_before,accent,title_after,subtitle,media_type,media_url,media_name,enabled')
    .order('sort_order');
  throwIfError(error);
  return ((data ?? []) as LoginSlideRow[]).map(row => ({
    id: row.id,
    eyebrow: row.eyebrow,
    titleBefore: row.title_before,
    accent: row.accent,
    titleAfter: row.title_after,
    subtitle: row.subtitle,
    mediaType: row.media_type,
    mediaUri: row.media_url,
    mediaName: row.media_name,
    enabled: row.enabled
  }));
}

export async function saveLoginSlidesToSupabase(slides: LoginSlide[]): Promise<LoginSlide[]> {
  const normalized: LoginSlide[] = [];

  for (const slide of slides) {
    if (!slide.mediaUri.startsWith('data:') && !slide.mediaUri.startsWith('blob:')) {
      normalized.push(slide);
      continue;
    }

    const mime = slide.mediaUri.match(/^data:([^;,]+)/)?.[1] ?? (slide.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
    const extension = slide.mediaName.split('.').pop()?.toLowerCase() ?? (slide.mediaType === 'video' ? 'mp4' : 'jpg');
    const path = `${slide.id}/${Date.now()}.${extension}`;
    const bytes = await uriToArrayBuffer(slide.mediaUri);
    const { error } = await supabase.storage.from('login-media').upload(path, bytes, { contentType: mime, upsert: true });
    throwIfError(error);
    normalized.push({ ...slide, mediaUri: supabase.storage.from('login-media').getPublicUrl(path).data.publicUrl });
  }

  const rows = normalized.map((slide, sortOrder) => ({
    id: slide.id,
    eyebrow: slide.eyebrow,
    title_before: slide.titleBefore,
    accent: slide.accent,
    title_after: slide.titleAfter,
    subtitle: slide.subtitle,
    media_type: slide.mediaType,
    media_url: slide.mediaUri,
    media_name: slide.mediaName,
    enabled: slide.enabled,
    sort_order: sortOrder,
    updated_at: new Date().toISOString()
  }));
  const { error } = await supabase.from('login_slides').upsert(rows);
  throwIfError(error);

  const ids = normalized.map(slide => slide.id);
  if (ids.length) {
    const quotedIds = ids.map(id => `"${id.replaceAll('"', '\\"')}"`).join(',');
    const { error: deleteError } = await supabase.from('login_slides').delete().not('id', 'in', `(${quotedIds})`);
    throwIfError(deleteError);
  }
  return normalized;
}
