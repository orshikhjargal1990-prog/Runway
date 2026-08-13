import type { LoginSlide } from '../content/loginSlides';
import type { Point, RouteOption } from '../native/routes';
import type { ClubEvent, RunningClub } from '../native/clubs';
import type { Challenge, MediaItem, Post, PostComment } from '../native/types';
import { supabase } from './supabase';

type ChallengeRow = {
  id: string;
  title: string;
  org: string;
  type: Challenge['type'];
  challenge_group: Challenge['group'];
  goal_km: number | string;
  reward: string | null;
  color: string;
  image_url: string;
  registration_ends_at: string;
};

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

export type RunInput = {
  userId: string;
  routeId: string | null;
  challengeId: string | null;
  distanceKm: number;
  durationSeconds: number;
  calories: number;
  coordinates: Point[];
  startedAt: string;
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
  weekly: { date: string; label: string; distanceKm: number }[];
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

function fileExtension(uri: string, type: MediaItem['type']) {
  const cleanUri = uri.split('?')[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  if (match) return match[1].toLowerCase();
  return type === 'video' ? 'mp4' : 'jpg';
}

function contentType(extension: string, type: MediaItem['type']) {
  const types: Record<string, string> = {
    gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg', mov: 'video/quicktime',
    mp4: 'video/mp4', png: 'image/png', webm: 'video/webm', webp: 'image/webp'
  };
  return types[extension] ?? (type === 'video' ? 'video/mp4' : 'image/jpeg');
}

async function uriToArrayBuffer(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Медиа файлыг уншиж чадсангүй.');
  return response.arrayBuffer();
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('id,title,org,type,challenge_group,goal_km,reward,color,image_url,registration_ends_at')
    .eq('enabled', true)
    .order('registration_ends_at');
  throwIfError(error);

  return ((data ?? []) as ChallengeRow[]).map(row => ({
    id: row.id,
    title: row.title,
    org: row.org,
    type: row.type,
    group: row.challenge_group,
    goalKm: Number(row.goal_km),
    reward: row.reward ?? undefined,
    color: row.color,
    image: row.image_url,
    registrationEndsInSeconds: Math.max(0, Math.floor((new Date(row.registration_ends_at).getTime() - Date.now()) / 1000))
  }));
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

export async function fetchRunningClubs(userId?: string): Promise<RunningClub[]> {
  const [clubsResult, membershipsResult, mediaResult] = await Promise.all([
    supabase
      .from('running_clubs')
      .select('id,name,city,description,image_url,member_count,weekly_km,total_km,rank,meeting_info')
      .eq('enabled', true)
      .order('rank')
      .limit(10),
    userId
      ? supabase.from('club_members').select('club_id').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('club_media').select('club_id,public_url,sort_order').order('sort_order')
  ]);
  throwIfError(clubsResult.error);
  throwIfError(membershipsResult.error);
  const joinedIds = new Set((membershipsResult.data ?? []).map(item => item.club_id as string));
  const mediaRows = mediaResult.error ? [] : (mediaResult.data ?? []) as ClubMediaRow[];

  return ((clubsResult.data ?? []) as RunningClubRow[]).map(club => ({
    id: club.id,
    name: club.name,
    city: club.city,
    description: club.description,
    image: club.image_url,
    memberCount: club.member_count,
    weeklyKm: Number(club.weekly_km),
    totalKm: Number(club.total_km ?? 0),
    rank: club.rank,
    meetingInfo: club.meeting_info,
    galleryImages: (() => {
      const gallery = mediaRows.filter(item => item.club_id === club.id).map(item => item.public_url);
      return gallery.length ? gallery : [club.image_url];
    })(),
    joined: joinedIds.has(club.id)
  }));
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

  return ((data ?? []) as unknown as ClubEventRow[]).map(event => ({
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
  throwIfError(postError);
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
      throwIfError(uploadError);
      uploadedPaths.push(path);

      const publicUrl = supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
      const { error: mediaError } = await supabase.from('post_media').insert({
        post_id: post.id,
        type: item.type,
        storage_path: path,
        public_url: publicUrl,
        sort_order: index
      });
      throwIfError(mediaError);
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

export async function joinChallenge(_userId: string, challenge: Challenge) {
  const { error } = await supabase.rpc('set_my_active_challenge', {
    target_challenge_id: challenge.id
  });
  throwIfError(error);
}

export async function leaveChallenge(_userId: string, challengeId: string) {
  const { error } = await supabase.rpc('leave_my_challenge', {
    target_challenge_id: challengeId
  });
  throwIfError(error);
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
    completed_at: new Date().toISOString()
  });
  throwIfError(error);
}

export async function updateActiveRun(input: {
  userId: string;
  routeId: string | null;
  routeTitle: string;
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
    supabase.from('runs').select('distance_km,duration_seconds,completed_at').eq('user_id', userId).order('completed_at'),
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId),
    supabase.rpc('get_my_challenge_progress')
  ]);
  throwIfError(profileResult.error);
  throwIfError(runsResult.error);
  throwIfError(followingResult.error);
  throwIfError(followersResult.error);
  throwIfError(progressResult.error);
  if (!profileResult.data) throw new Error('Профайл олдсонгүй.');

  const followingIds = (followingResult.data ?? []).map(item => item.following_id as string);
  const followerIds = (followersResult.data ?? []).map(item => item.follower_id as string);
  const people = await fetchProfilesByIds([...new Set([...followingIds, ...followerIds])]);
  const peopleById = new Map(people.map(person => [person.id, person]));
  const runs = (runsResult.data ?? []).map(run => ({
    distanceKm: Number(run.distance_km),
    durationSeconds: Number(run.duration_seconds),
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
    const distanceKm = runs
      .filter(run => {
        const completedAt = new Date(run.completedAt);
        return completedAt >= date && completedAt < nextDate;
      })
      .reduce((sum, run) => sum + run.distanceKm, 0);
    return { date: date.toISOString(), label: dayLabels[date.getDay()], distanceKm };
  });

  return {
    profile: mapProfile(profileResult.data),
    totalKm: runs.reduce((sum, run) => sum + run.distanceKm, 0),
    totalRuns: runs.length,
    totalSeconds: runs.reduce((sum, run) => sum + run.durationSeconds, 0),
    weekly,
    following: followingIds.map(id => peopleById.get(id)).filter((person): person is ProfilePerson => Boolean(person)),
    followers: followerIds.map(id => peopleById.get(id)).filter((person): person is ProfilePerson => Boolean(person)),
    challengeProgress: ((progressResult.data ?? []) as { challenge_id: string; total_km: number | string; rank: number; participant_count: number }[]).map(item => ({
      challengeId: item.challenge_id,
      totalKm: Number(item.total_km),
      rank: Number(item.rank),
      participantCount: Number(item.participant_count)
    }))
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
