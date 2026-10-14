import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, type ImageStyle, type StyleProp
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import type { Challenge, MediaItem, Post } from '../types';
import type { ClubEvent, RunningClub } from '../clubs';
import type { RouteOption } from '../routes';
import { RUNNERS } from '../data';
import { compactGalleryPhotos, imagePickerAssetToPersistableUri, isStableGalleryUri } from '../mediaUtils';
import { colors } from '../theme';
import {
  fetchConversationPreviews, fetchDirectMessages, fetchProfileDashboard, fetchProfileSummary,
  markConversationRead, sendDirectMessage, type ConversationPreview, type DirectMessage,
  updateProfileAvatar, type ProfileDashboardData, type ProfilePerson, type ProfileSummary, type RunInput
} from '../../lib/runboostApi';

type Props = {
  currentUserId: string;
  currentUserName: string;
  posts: Post[];
  joinedChallenges: Challenge[];
  joinedClub: RunningClub | null;
  clubEvents: ClubEvent[];
  joinedClubEvents: ClubEvent[];
  onOpenChallenge: (challenge: Challenge, progressKm: number) => void;
  onStartChallengeRun: (challenge: Challenge, progressKm: number) => void;
  onStartClubEventRun: (event: ClubEvent) => void;
  onCancelChallenge: (challenge: Challenge) => void;
  onCancelClubEvent: (event: ClubEvent) => void;
  onRegisterClubEvent: (event: ClubEvent) => boolean | Promise<boolean>;
  routes?: RouteOption[];
  galleryAdditions?: MediaItem[];
  savedRunAdditions?: RunInput[];
  dashboardRefreshKey?: number;
  onLogout: () => void;
};

type GroupChatContext = {
  id: string;
  title: string;
  subtitle: string;
  members: number;
};

type GroupChatMessage = {
  id: string;
  user: string;
  body: string;
  createdAt: string;
  mine?: boolean;
};

const REGISTRATION_TYPES = [
  { id: 'full', title: 'Бүтэн марафон / Энгийн/', distance: '42.2 км', age: '18+', price: '95,000₮', tone: '#EF476F' },
  { id: 'half', title: 'Хагас марафон / Энгийн/', distance: '21.1 км', age: '18+', price: '75,000₮', tone: '#4663E6' },
  { id: '10k', title: '10 км /Энгийн/', distance: '10 км', age: '16+', price: '45,000₮', tone: '#2FA55A' },
  { id: '5k', title: '5 км /Энгийн/', distance: '5 км', age: '16+', price: '30,000₮', tone: '#F5B82E' }
] as const;

const PARA_REGISTRATION_TYPES = [
  { id: 'para-full', title: 'Бүтэн марафон / Пара/', distance: '42.2 км', age: '18+', price: '0₮', tone: '#EF476F' },
  { id: 'para-half', title: 'Хагас марафон / Пара/', distance: '21.1км', age: '18+', price: '0₮', tone: '#4663E6' },
  { id: 'para-half-no-arm', title: 'Гар дутуу 21,1км', distance: '21,1 км', age: '18+', price: '0₮', tone: '#4663E6' },
  { id: 'para-10k', title: '10 км /Пара/', distance: '10 км', age: '16+', price: '0₮', tone: '#2FA55A' },
  { id: 'para-5k', title: '5 км /Пара/', distance: '5 км', age: '16+', price: '0₮', tone: '#F5B82E' },
  { id: 'para-wheelchair-1500', title: 'Тэргэнцэртэй 1500 м', distance: '1500 м', age: '16+', price: '0₮', tone: '#000000' },
  { id: 'para-hearing-1500', title: 'Сонсголын бэрхшээлтэй 1500м', distance: '1500 м', age: '16+', price: '0₮', tone: '#7C0AA3' },
  { id: 'para-sight-1500', title: 'Харааны бэрхшээлтэй 1500м', distance: '1500 м', age: '16+', price: '0₮', tone: '#7C0AA3' },
  { id: 'para-sit-1500', title: 'Саажилттай 1500м', distance: '1500 м', age: '16+', price: '0₮', tone: '#7C0AA3' },
  { id: 'para-mind-1000', title: 'Оюуны бэрхшээлтэй 1000м', distance: '1000 м', age: '16+', price: '0₮', tone: '#000000' }
] as const;

type RegistrationMode = 'regular' | 'para' | 'virtual';
type RegistrationTypeId = typeof REGISTRATION_TYPES[number]['id'] | typeof PARA_REGISTRATION_TYPES[number]['id'];
type RegistrationOption = typeof REGISTRATION_TYPES[number] | typeof PARA_REGISTRATION_TYPES[number];

type GalleryPhoto = { id: string; uri: string };
type WeeklyDay = ProfileDashboardData['weekly'][number];
type CalendarDayDetail = {
  date: Date;
  dateKey: string;
  runs: WeeklyDay['runs'];
  events: ClubEvent[];
};
const profileGalleryKey = 'runboost.profileGallery';

function getLocalProfileGallery(): GalleryPhoto[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(profileGalleryKey);
    const parsed = raw ? JSON.parse(raw) as GalleryPhoto[] : [];
    const photos = Array.isArray(parsed) ? compactGalleryPhotos(parsed) : [];
    if (photos.length !== parsed.length) window.localStorage.setItem(profileGalleryKey, JSON.stringify(photos));
    return photos;
  } catch {
    return [];
  }
}

function saveLocalProfileGallery(photos: GalleryPhoto[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(profileGalleryKey, JSON.stringify(compactGalleryPhotos(photos)));
  } catch {
    // Gallery is local-only; storage limits should not take the whole profile down.
  }
}

type CreatedGroupChat = {
  id: string;
  title: string;
  createdAt: string;
  memberIds: string[];
  pendingIds: string[];
  messages: GroupChatMessage[];
};

type FriendProfileDetails = {
  summary: ProfileSummary;
  weeklyKm: number;
  avgPace: string;
  activeChallenges: { id: string; title: string; org: string; progressKm: number; goalKm: number; image: string; rank: number }[];
  clubEvents: { id: string; title: string; clubName: string; date: string; location: string; distanceKm?: number; image: string }[];
  achievements: { id: string; title: string; meta: string; code: string }[];
  marathons: { id: string; title: string; year: string; distance: string; result: string }[];
  photos: { id: string; uri: string }[];
};

const DEMO_PEOPLE: ProfilePerson[] = RUNNERS.map(runner => ({
  id: runner.id,
  name: runner.name,
  avatarUrl: runner.avatar
}));

const DAY_LABELS = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];
const WORKOUT_SLIDES = [
  {
    kicker: 'Өнөөдрийн урам',
    title: 'Нэг алхам ч\nялалт болдог',
    subtitle: 'Өчигдрөөсөө 1% илүү бай.',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=700&q=80'
  },
  {
    kicker: 'Гүйгчийн бодол',
    title: 'Эхэлсэн хүн\nаль хэдийн түрүүлсэн',
    subtitle: 'Хэмнэлээ ол, зам өөрөө нээгдэнэ.',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=700&q=80'
  },
  {
    kicker: 'RunBoost',
    title: 'Амьсгаагаа сонс\nзорилгоо мэдэр',
    subtitle: 'Өнөөдрийн км маргаашийн хүч.',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=700&q=80'
  }
];

function PersonAvatar({ person, style }: { person: ProfilePerson; style: StyleProp<ImageStyle> }) {
  if (person.avatarUrl) return <Image source={{ uri: person.avatarUrl }} style={style} />;
  return <View style={[style, styles.fallbackAvatar]}><Text style={styles.fallbackAvatarText}>{person.name.charAt(0)}</Text></View>;
}

function buildDemoDashboard(userId: string, name: string, posts: Post[], challenges: Challenge[]): ProfileDashboardData {
  const postDistance = posts.reduce((sum, post) => sum + (post.distanceKm ?? 0), 0);
  const today = new Date();
  const distances = [4.2, 0, 6.8, 3.1, 0, 8.4, 5.6];
  return {
    profile: { id: userId, name, avatarUrl: RUNNERS[0].avatar },
    totalKm: postDistance || 128.4,
    totalRuns: Math.max(posts.length, 24),
    totalSeconds: 11 * 3600 + 42 * 60,
    previousWeekKm: 14.8,
    weekly: distances.map((distanceKm, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const durationSeconds = Math.round(distanceKm * (330 + index * 12));
      return {
        date: date.toISOString(),
        label: DAY_LABELS[date.getDay()],
        distanceKm,
        runs: distanceKm > 0 ? [{
          id: `demo-run-${index}`,
          routeId: ['sukhbaatar', 'garden', 'zaisan', 'tuul-river'][index % 4],
          distanceKm,
          durationSeconds,
          calories: Math.round(distanceKm * 68),
          paceSecondsPerKm: Math.round(durationSeconds / distanceKm),
          coordinates: [],
          startedAt: date.toISOString(),
          completedAt: date.toISOString()
        }] : []
      };
    }),
    following: DEMO_PEOPLE,
    followers: [...DEMO_PEOPLE].reverse(),
    challengeProgress: []
  };
}

function buildEmptyDashboard(userId: string, name: string): ProfileDashboardData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    profile: { id: userId, name },
    totalKm: 0,
    totalRuns: 0,
    totalSeconds: 0,
    previousWeekKm: 0,
    weekly: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return { date: date.toISOString(), label: DAY_LABELS[date.getDay()], distanceKm: 0, runs: [] };
    }),
    following: [],
    followers: [],
    challengeProgress: []
  };
}

function shortTime(date: string) {
  const value = new Date(date);
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function formatEventDate(date: string) {
  return new Date(date).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatHours(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}ц ${minutes}м`;
}

function formatPace(seconds: number | null) {
  if (!seconds) return '-- /км';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')} /км`;
}

function formatRunDate(date: string) {
  return new Date(date).toLocaleDateString('mn-MN', { month: 'long', day: 'numeric', weekday: 'long' });
}

function formatRunTime(date: string) {
  return new Date(date).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
}

function getDateKey(date: Date | string) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatCalendarMonth(date: Date) {
  return date.toLocaleDateString('mn-MN', { year: 'numeric', month: 'long' });
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      dateKey: getDateKey(date),
      inMonth: date.getMonth() === month,
      dayNumber: date.getDate()
    };
  });
}

function getRunSignature(run: {
  routeId: string | null;
  distanceKm: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string;
}) {
  return [
    run.routeId ?? 'custom',
    run.distanceKm.toFixed(3),
    run.durationSeconds,
    new Date(run.startedAt).toISOString(),
    new Date(run.completedAt).toISOString()
  ].join('|');
}

function mergeDashboardWithSavedRuns(dashboard: ProfileDashboardData, savedRuns: RunInput[]) {
  if (!savedRuns.length) return dashboard;
  const existingSignatures = new Set(
    dashboard.weekly.flatMap(day => day.runs).map(run => getRunSignature(run))
  );
  const additions = savedRuns
    .map(run => ({
      id: `local-${getRunSignature({
        routeId: run.routeId,
        distanceKm: run.distanceKm,
        durationSeconds: run.durationSeconds,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? run.startedAt
      })}`,
      routeId: run.routeId,
      distanceKm: run.distanceKm,
      durationSeconds: run.durationSeconds,
      calories: run.calories,
      paceSecondsPerKm: run.distanceKm > 0 ? Math.round(run.durationSeconds / run.distanceKm) : null,
      coordinates: run.coordinates,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? run.startedAt
    }))
    .filter(run => !existingSignatures.has(getRunSignature(run)));

  if (!additions.length) return dashboard;

  const weekly = dashboard.weekly.map(day => {
    const dayKey = getDateKey(day.date);
    const dayAdditions = additions.filter(run => getDateKey(run.completedAt) === dayKey);
    if (!dayAdditions.length) return day;
    return {
      ...day,
      runs: [...day.runs, ...dayAdditions],
      distanceKm: day.distanceKm + dayAdditions.reduce((sum, run) => sum + run.distanceKm, 0)
    };
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const previousWeekStart = new Date(today);
  previousWeekStart.setDate(today.getDate() - 7);
  const previousWeekKm = additions
    .filter(run => {
      const completedAt = new Date(run.completedAt);
      return completedAt >= previousWeekStart && completedAt < today;
    })
    .reduce((sum, run) => sum + run.distanceKm, 0);

  return {
    ...dashboard,
    totalKm: dashboard.totalKm + additions.reduce((sum, run) => sum + run.distanceKm, 0),
    totalRuns: dashboard.totalRuns + additions.length,
    totalSeconds: dashboard.totalSeconds + additions.reduce((sum, run) => sum + run.durationSeconds, 0),
    previousWeekKm: dashboard.previousWeekKm + previousWeekKm,
    weekly
  };
}

function isSingleRunChallenge(challenge: Challenge) {
  return challenge.completionMode === 'single_run' || (!challenge.completionMode && challenge.group === '5k');
}

function buildFriendProfileDetails(person: ProfilePerson, summary: ProfileSummary | null, challenges: Challenge[], events: ClubEvent[]): FriendProfileDetails {
  const seed = person.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const baseKm = summary?.totalKm ?? 180 + seed % 420;
  const runCount = summary?.runCount ?? 28 + seed % 46;
  const activeChallenges = challenges.slice(0, 3).map((challenge, index) => {
    const progressRatio = Math.min(0.94, 0.28 + (((seed + index * 17) % 54) / 100));
    return {
      id: challenge.id,
      title: challenge.title,
      org: challenge.org,
      progressKm: challenge.goalKm * progressRatio,
      goalKm: challenge.goalKm,
      image: challenge.image,
      rank: 3 + ((seed + index * 5) % 42)
    };
  });
  const eventOffset = seed % Math.max(events.length, 1);
  const clubEvents = events.length ? [0, 1, 2].map(index => events[(eventOffset + index) % events.length]).map(event => ({
    id: event.id,
    title: event.title,
    clubName: event.clubName,
    date: event.startsAt,
    location: event.location,
    distanceKm: event.distanceKm,
    image: event.image
  })) : [];
  const runnerPhotos = [
    person.avatarUrl,
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=80',
    'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=900&q=80',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=80',
    'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=900&q=80'
  ].filter(Boolean) as string[];
  return {
    summary: {
      totalKm: baseKm,
      runCount,
      postCount: summary?.postCount ?? 10 + seed % 22,
      followerCount: summary?.followerCount ?? 54 + seed % 150,
      followingCount: summary?.followingCount ?? 18 + seed % 64
    },
    weeklyKm: 18 + (seed % 38),
    avgPace: `${4 + seed % 3}:${String(20 + seed % 38).padStart(2, '0')} /км`,
    activeChallenges,
    clubEvents,
    achievements: [
      { id: 'steady', title: 'Тогтвортой гүйгч', meta: '7 хоногт 3+ гүйлт хийсэн', code: '3X' },
      { id: 'distance', title: '100 км давсан', meta: `${Math.round(baseKm)} км нийт зай`, code: '100' },
      { id: 'social', title: 'Клубын оролцогч', meta: 'Клубын эвентэд тогтмол оролцдог', code: 'CL' }
    ],
    marathons: [
      { id: 'ub', title: 'Ulaanbaatar Marathon', year: '2026', distance: seed % 2 ? '21.1 км' : '42.2 км', result: seed % 2 ? '1:56:24' : '4:08:17' },
      { id: 'trail', title: 'Bogd Khan Trail', year: '2025', distance: '15 км', result: '1:31:42' }
    ],
    photos: runnerPhotos.map((uri, index) => ({ id: `${person.id}-photo-${index}`, uri }))
  };
}

export function ProfileScreen({ currentUserId, currentUserName, posts, joinedChallenges, joinedClub, clubEvents, joinedClubEvents, onCancelChallenge, onCancelClubEvent, onRegisterClubEvent, onStartChallengeRun, onStartClubEventRun, routes = [], galleryAdditions = [], savedRunAdditions = [], dashboardRefreshKey = 0, onLogout }: Props) {
  const isDemo = currentUserId === 'demo-runner';
  const [dashboard, setDashboard] = useState(() => (
    isDemo ? buildDemoDashboard(currentUserId, currentUserName, posts, joinedChallenges) : buildEmptyDashboard(currentUserId, currentUserName)
  ));
  const [connectionMode, setConnectionMode] = useState<'following' | 'followers' | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<ProfilePerson | null>(null);
  const [personSummary, setPersonSummary] = useState<ProfileSummary | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [inboxQuery, setInboxQuery] = useState('');
  const [chatPerson, setChatPerson] = useState<ProfilePerson | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedChallengeDetail, setSelectedChallengeDetail] = useState<{ challenge: Challenge; completedKm: number; participants: number; rank: number | null } | null>(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState<ClubEvent | null>(null);
  const [eventRegistrationNotice, setEventRegistrationNotice] = useState<ClubEvent | null>(null);
  const [registrationPickerEvent, setRegistrationPickerEvent] = useState<ClubEvent | null>(null);
  const [qpayPayment, setQpayPayment] = useState<{ event: ClubEvent; option: RegistrationOption } | null>(null);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('regular');
  const [selectedRegistrationType, setSelectedRegistrationType] = useState<RegistrationTypeId>('half');
  const [clubDetailOpen, setClubDetailOpen] = useState(false);
  const [groupChat, setGroupChat] = useState<GroupChatContext | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupChatMessage[]>([]);
  const [groupMessageText, setGroupMessageText] = useState('');
  const [selectedGroupPerson, setSelectedGroupPerson] = useState<ProfilePerson | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>(getLocalProfileGallery);
  const [selectedGalleryPhoto, setSelectedGalleryPhoto] = useState<GalleryPhoto | null>(null);
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState<WeeklyDay | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<CalendarDayDetail | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [friendRequestIds, setFriendRequestIds] = useState<string[]>([]);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);
  const [createdGroups, setCreatedGroups] = useState<CreatedGroupChat[]>([]);
  const [workoutSlideIndex, setWorkoutSlideIndex] = useState(0);
  const galleryScrollRef = useRef<ScrollView>(null);
  const workoutSlideOpacity = useRef(new Animated.Value(1)).current;
  const workoutSlideLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDemo) {
      setDashboard(mergeDashboardWithSavedRuns(buildDemoDashboard(currentUserId, currentUserName, posts, joinedChallenges), savedRunAdditions));
      return;
    }
    fetchProfileDashboard(currentUserId).then(nextDashboard => {
      setDashboard(mergeDashboardWithSavedRuns(nextDashboard, savedRunAdditions));
    }).catch(() => {
      setDashboard(mergeDashboardWithSavedRuns(buildEmptyDashboard(currentUserId, currentUserName), savedRunAdditions));
    });
  }, [currentUserId, currentUserName, dashboardRefreshKey, isDemo, joinedChallenges, posts, savedRunAdditions]);

  useEffect(() => {
    const imageAdditions = galleryAdditions.filter(item => item.type === 'image' && isStableGalleryUri(item.uri));
    if (!imageAdditions.length) return;
    setGalleryPhotos(current => {
      const existingUris = new Set(current.map(photo => photo.uri));
      const nextPhotos = imageAdditions
        .filter(item => !existingUris.has(item.uri))
        .map(item => ({ id: `post-gallery-${item.id}`, uri: item.uri }));
      if (!nextPhotos.length) return current;
      const next = compactGalleryPhotos([...nextPhotos, ...current]);
      saveLocalProfileGallery(next);
      return next;
    });
  }, [galleryAdditions]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(workoutSlideOpacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true
        }),
        Animated.timing(workoutSlideLift, {
          toValue: -8,
          duration: 260,
          useNativeDriver: true
        })
      ]).start(() => {
        setWorkoutSlideIndex(current => (current + 1) % WORKOUT_SLIDES.length);
        workoutSlideLift.setValue(8);
        Animated.parallel([
          Animated.timing(workoutSlideOpacity, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true
          }),
          Animated.timing(workoutSlideLift, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true
          })
        ]).start();
      });
    }, 4300);
    return () => clearInterval(timer);
  }, [workoutSlideLift, workoutSlideOpacity]);

  const achievements = useMemo(() => [
    { id: 'first-run', icon: '01', title: 'Эхний гүйлт', meta: 'Анхны гүйлтээ дуусгасан', unlocked: dashboard.totalRuns >= 1 },
    { id: 'ten-km', icon: '10', title: '10 км клуб', meta: 'Нийт 10 км давсан', unlocked: dashboard.totalKm >= 10 },
    { id: 'streak', icon: '3×', title: 'Тогтвортой', meta: '7 хоногт 3 удаа гүйсэн', unlocked: dashboard.weekly.filter(day => day.distanceKm > 0).length >= 3 },
    { id: 'challenger', icon: 'C', title: 'Чэлленжер', meta: 'Чэлленжид нэгдсэн', unlocked: joinedChallenges.length > 0 }
  ].filter(item => item.unlocked), [dashboard, joinedChallenges.length]);

  const displayedGalleryPhotos = useMemo(() => {
    const photos = new Map<string, GalleryPhoto>();
    galleryPhotos.filter(photo => isStableGalleryUri(photo.uri)).forEach(photo => photos.set(photo.uri, photo));
    posts.forEach(post => {
      post.media.filter(item => item.type === 'image' && isStableGalleryUri(item.uri)).forEach(item => {
        if (!photos.has(item.uri)) {
          photos.set(item.uri, { id: `post-${post.id}-${item.id}`, uri: item.uri });
        }
      });
    });
    return Array.from(photos.values());
  }, [galleryPhotos, posts]);

  useEffect(() => {
    if (galleryIndex > Math.max(0, displayedGalleryPhotos.length - 1)) {
      setGalleryIndex(Math.max(0, displayedGalleryPhotos.length - 1));
    }
  }, [displayedGalleryPhotos.length, galleryIndex]);

  const weeklyTotal = dashboard.weekly.reduce((sum, day) => sum + day.distanceKm, 0);
  const weeklySeconds = dashboard.weekly.reduce((total, day) => (
    total + day.runs.reduce((sum, run) => sum + run.durationSeconds, 0)
  ), 0);
  const weeklyTrend = dashboard.previousWeekKm > 0
    ? Math.round(((weeklyTotal - dashboard.previousWeekKm) / dashboard.previousWeekKm) * 100)
    : weeklyTotal > 0 ? null : 0;
  const weeklyTrendText = weeklyTrend === null ? 'Шинэ' : `${weeklyTrend > 0 ? '+' : ''}${weeklyTrend}%`;
  const routesById = useMemo(() => new Map(routes.map(route => [route.id, route])), [routes]);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const runsByDate = useMemo(() => {
    const runsMap = new Map<string, WeeklyDay['runs']>();
    dashboard.weekly.forEach(day => runsMap.set(getDateKey(day.date), day.runs));
    return runsMap;
  }, [dashboard.weekly]);
  const eventsByDate = useMemo(() => {
    const eventsMap = new Map<string, ClubEvent[]>();
    joinedClubEvents.forEach(event => {
      const key = getDateKey(event.startsAt);
      eventsMap.set(key, [...(eventsMap.get(key) ?? []), event]);
    });
    return eventsMap;
  }, [joinedClubEvents]);
  const openCalendarDay = (date: Date, dateKey: string) => {
    setSelectedCalendarDay({
      date,
      dateKey,
      runs: runsByDate.get(dateKey) ?? [],
      events: eventsByDate.get(dateKey) ?? []
    });
  };

  useEffect(() => {
    if (!selectedCalendarDay) return;
    setSelectedCalendarDay(current => current ? {
      ...current,
      runs: runsByDate.get(current.dateKey) ?? [],
      events: eventsByDate.get(current.dateKey) ?? []
    } : current);
  }, [runsByDate, eventsByDate, selectedCalendarDay?.dateKey]);

  useEffect(() => {
    if (!selectedWeeklyDay) return;
    const nextDay = dashboard.weekly.find(day => day.date === selectedWeeklyDay.date);
    if (nextDay) setSelectedWeeklyDay(nextDay);
  }, [dashboard.weekly, selectedWeeklyDay?.date]);

  const openPerson = async (person: ProfilePerson) => {
    setConnectionMode(null);
    setInboxOpen(false);
    setSelectedPerson(person);
    setPersonSummary(null);
    setProfileOpen(true);
    if (!isDemo && person.id) {
      try {
        setPersonSummary(await fetchProfileSummary(person.id));
      } catch {
        setPersonSummary(null);
      }
    } else {
      setPersonSummary({ totalKm: 286.4, runCount: 54, postCount: 18, followerCount: 92, followingCount: 41 });
    }
  };

  const openInbox = async () => {
    setInboxOpen(true);
    if (isDemo) {
      setConversations(DEMO_PEOPLE.map((person, index) => ({
        person,
        message: index === 0 ? 'Маргааш өглөө хамт гүйх үү?' : 'Сайн гүйлт болжээ!',
        createdAt: new Date(Date.now() - index * 3600000).toISOString(),
        unread: index === 0 ? 2 : 0
      })));
      return;
    }
    try {
      setConversations(await fetchConversationPreviews(currentUserId));
    } catch {
      Alert.alert('Inbox ачаалсангүй', 'Supabase migration болон интернэт холболтоо шалгана уу.');
    }
  };

  const openChat = async (person: ProfilePerson) => {
    setProfileOpen(false);
    setInboxOpen(false);
    setChatPerson(person);
    if (isDemo) {
      setMessages([
        { id: 'd1', senderId: person.id, recipientId: currentUserId, body: 'Өглөөний мэнд. Өнөөдөр гүйх үү?', createdAt: new Date(Date.now() - 3800000).toISOString() },
        { id: 'd2', senderId: currentUserId, recipientId: person.id, body: 'Тэгье, 07:30-д паркийн үүдэнд уулзъя.', createdAt: new Date(Date.now() - 3500000).toISOString() }
      ]);
      return;
    }
    try {
      setMessages(await fetchDirectMessages(currentUserId, person.id));
      await markConversationRead(currentUserId, person.id);
    } catch {
      Alert.alert('Чат ачаалсангүй', 'Интернэт холболтоо шалгана уу.');
    }
  };

  useEffect(() => {
    if (!chatPerson || isDemo) return;
    const timer = setInterval(() => {
      fetchDirectMessages(currentUserId, chatPerson.id).then(setMessages).catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, [chatPerson, currentUserId, isDemo]);

  const sendMessage = async () => {
    const body = messageText.trim();
    if (!body || !chatPerson || sending) return;
    setSending(true);
    try {
      const message = isDemo
        ? { id: `dm-${Date.now()}`, senderId: currentUserId, recipientId: chatPerson.id, body, createdAt: new Date().toISOString() }
        : await sendDirectMessage(currentUserId, chatPerson.id, body);
      setMessages(current => [...current, message]);
      setMessageText('');
    } catch {
      Alert.alert('Мессеж илгээгдсэнгүй', 'Интернэт холболтоо шалгаад дахин оролдоно уу.');
    } finally {
      setSending(false);
    }
  };

  const openChallengeGroupChat = (detail: { challenge: Challenge; participants: number }) => {
    setSelectedChallengeDetail(null);
    setGroupChat({
      id: `challenge-${detail.challenge.id}`,
      title: `${detail.challenge.title} group chat`,
      subtitle: `${detail.challenge.org} · ${detail.challenge.group === '5k' ? '5 км' : detail.challenge.group === '10k' ? '10 км' : 'Холын зайн марафон'} чэлленж`,
      members: detail.participants
    });
    setGroupMessages([]);
  };

  const openEventGroupChat = (event: ClubEvent) => {
    setSelectedEventDetail(null);
    setGroupChat({
      id: `event-${event.id}`,
      title: `${event.title} group chat`,
      subtitle: `${event.clubName} · ${event.location}`,
      members: event.participantCount
    });
    setGroupMessages([]);
  };

  const openCreatedGroupChat = (chat: CreatedGroupChat) => {
    setInboxOpen(false);
    setGroupChat({
      id: chat.id,
      title: chat.title,
      subtitle: 'Өөрийн үүсгэсэн group chat',
      members: chat.memberIds.length
    });
    setGroupMessages(chat.messages);
  };

  const toggleInvite = (personId: string) => {
    setSelectedInviteIds(current => current.includes(personId) ? current.filter(id => id !== personId) : [...current, personId]);
  };

  const createGroupChat = () => {
    const inviteIds = selectedInviteIds;
    if (!groupName.trim() || inviteIds.length === 0) return;
    const now = new Date().toISOString();
    const chat: CreatedGroupChat = {
      id: `created-${Date.now()}`,
      title: groupName.trim(),
      createdAt: now,
      memberIds: [currentUserId],
      pendingIds: inviteIds,
      messages: []
    };
    setCreatedGroups(current => [chat, ...current]);
    setCreateGroupOpen(false);
    setGroupName('');
    setSelectedInviteIds([]);
  };

  const acceptGroupInvite = (chatId: string, personId: string) => {
    const person = dashboard.following.find(item => item.id === personId);
    if (!person) return;
    setCreatedGroups(current => current.map(chat => {
      if (chat.id !== chatId) return chat;
      return {
        ...chat,
        memberIds: chat.memberIds.includes(personId) ? chat.memberIds : [...chat.memberIds, personId],
        pendingIds: chat.pendingIds.filter(id => id !== personId)
      };
    }));
  };

  const sendGroupMessage = () => {
    const body = groupMessageText.trim();
    if (!body || !groupChat) return;
    setGroupMessages(current => [...current, {
      id: `group-${Date.now()}`,
      user: currentUserName,
      body,
      createdAt: new Date().toISOString(),
      mine: true
    }]);
    if (groupChat?.id.startsWith('created-')) {
      setCreatedGroups(current => current.map(chat => chat.id === groupChat.id ? {
        ...chat,
        messages: [...chat.messages, { id: `group-${Date.now()}`, user: currentUserName, body, createdAt: new Date().toISOString(), mine: true }]
      } : chat));
    }
    setGroupMessageText('');
  };

  const openGroupPerson = (name: string) => {
    if (name === 'System' || name === currentUserName) return;
    const existing = DEMO_PEOPLE.find(person => person.name === name || person.name.startsWith(name));
    setSelectedGroupPerson(existing ?? {
      id: `group-${name.toLowerCase().replaceAll(' ', '-')}`,
      name,
      avatarUrl: RUNNERS[Math.abs(name.length) % RUNNERS.length]?.avatar
    });
  };

  const sendFriendRequest = (person: ProfilePerson) => {
    setFriendRequestIds(current => current.includes(person.id) ? current : [...current, person.id]);
  };
  const changeProfileAvatar = async () => {
    if (avatarSaving) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Зөвшөөрөл хэрэгтэй', 'Профайлын зураг солихын тулд media library зөвшөөрөл өгнө үү.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
      base64: Platform.OS !== 'web'
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarSaving(true);
    const previousAvatarUrl = dashboard.profile.avatarUrl;
    try {
      const avatarUrl = await imagePickerAssetToPersistableUri(result.assets[0], { maxSize: 360, quality: 0.72 });
      setDashboard(current => ({ ...current, profile: { ...current.profile, avatarUrl } }));
      if (!isDemo) {
        await updateProfileAvatar(currentUserId, avatarUrl);
      }
    } catch (error) {
      setDashboard(current => ({ ...current, profile: { ...current.profile, avatarUrl: previousAvatarUrl } }));
      Alert.alert('Зураг хадгалж чадсангүй', error instanceof Error ? error.message : 'Дахин оролдоно уу.');
    } finally {
      setAvatarSaving(false);
    }
  };
  const addGalleryPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Зөвшөөрөл хэрэгтэй', 'Зургийн цомогт зураг нэмэхийн тулд media library зөвшөөрөл өгнө үү.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.78,
      base64: Platform.OS !== 'web'
    });
    if (result.canceled) return;
    const nextPhotos = await Promise.all(result.assets.map(async asset => ({
      id: `${asset.uri}-${Date.now()}`,
      uri: await imagePickerAssetToPersistableUri(asset, { maxSize: 820, quality: 0.72 })
    })));
    setGalleryPhotos(current => {
      const next = compactGalleryPhotos([...nextPhotos, ...current]);
      saveLocalProfileGallery(next);
      return next;
    });
  };
  const deleteGalleryPhoto = (photoId: string) => {
    setGalleryPhotos(current => {
      const next = current.filter(photo => photo.id !== photoId);
      saveLocalProfileGallery(next);
      return next;
    });
    setSelectedGalleryPhoto(null);
  };

  const connectionPeople = connectionMode === 'followers' ? dashboard.followers : dashboard.following;
  const visibleConversations = conversations.filter(item => item.person.name.toLowerCase().includes(inboxQuery.trim().toLowerCase()));
  const registeredClubEvents = joinedClub ? clubEvents.filter(event => event.clubId === joinedClub.id) : [];
  const joinedClubEventIdSet = useMemo(() => new Set(joinedClubEvents.map(event => event.id)), [joinedClubEvents]);
  const selectedFriendDetails = selectedPerson ? buildFriendProfileDetails(selectedPerson, personSummary, joinedChallenges, clubEvents) : null;
  const registerClubEvent = async (event: ClubEvent) => {
    if (!joinedClubEventIdSet.has(event.id)) {
      const registered = await onRegisterClubEvent(event);
      if (!registered) return;
      setEventRegistrationNotice(event);
    }
    setSelectedEventDetail(event);
  };
  const openClubEventDetail = (event: ClubEvent) => {
    setClubDetailOpen(false);
    setSelectedEventDetail(event);
  };
  const openQPayPayment = () => {
    if (!registrationPickerEvent) return;
    const option = registrationOptions.find(item => item.id === selectedRegistrationType) ?? registrationOptions[0];
    setQpayPayment({ event: registrationPickerEvent, option });
    setRegistrationPickerEvent(null);
  };
  const confirmQPayPayment = async () => {
    if (!qpayPayment) return;
    const target = qpayPayment.event;
    setQpayPayment(null);
    await registerClubEvent(target);
  };
  const registrationOptions = registrationMode === 'para' ? PARA_REGISTRATION_TYPES : REGISTRATION_TYPES;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BlurView intensity={38} tint="dark" style={styles.profileHeader}>
          <Pressable accessibilityLabel="Профайлын зураг солих" disabled={avatarSaving} style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarButtonPressed]} onPress={() => void changeProfileAvatar()}>
            <PersonAvatar person={dashboard.profile} style={styles.avatar} />
            <View style={styles.avatarEditBadge}><Text style={styles.avatarEditText}>{avatarSaving ? '...' : 'Солих'}</Text></View>
          </Pressable>
          <View style={styles.identity}>
            <Text style={styles.name}>{dashboard.profile.name}</Text>
            <Text style={styles.handle}>@{dashboard.profile.name.toLowerCase().replaceAll(' ', '.')}</Text>
          </View>
          <Pressable accessibilityLabel="Мессеж" onPress={openInbox} style={styles.inboxButton}>
            <View style={styles.chatIconBack} />
            <View style={styles.chatIconFront}>
              <View style={styles.chatIconTail} />
            </View>
            {conversations.some(item => item.unread > 0) ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          <Pressable accessibilityLabel="Гарах" onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.logoutIcon}>↪</Text>
          </Pressable>
        </BlurView>

        <View style={styles.statStrip}>
          <View style={styles.statItem}><Text style={styles.statValue}>{dashboard.totalKm.toFixed(1)}</Text><Text style={styles.statLabel}>Нийт км</Text></View>
          <View style={styles.statItem}><Text style={styles.statValue}>{dashboard.totalRuns}</Text><Text style={styles.statLabel}>Гүйлт</Text></View>
          <Pressable style={styles.statItem} onPress={() => setConnectionMode('following')}><Text style={styles.statValue}>{dashboard.following.length}</Text><Text style={styles.statLabel}>Дагасан</Text></Pressable>
          <Pressable style={styles.statItem} onPress={() => setConnectionMode('followers')}><Text style={styles.statValue}>{dashboard.followers.length}</Text><Text style={styles.statLabel}>Дагуулсан</Text></Pressable>
        </View>

        <View style={styles.workoutSlide}>
          <View style={styles.workoutCard}>
            <Animated.View style={[styles.workoutAnimatedLayer, { opacity: workoutSlideOpacity, transform: [{ translateY: workoutSlideLift }] }]}>
              <View style={styles.workoutCardCopy}>
                <Text style={styles.workoutCardKicker}>{WORKOUT_SLIDES[workoutSlideIndex].kicker}</Text>
                <Text style={styles.workoutCardTitle}>{WORKOUT_SLIDES[workoutSlideIndex].title}</Text>
                <View style={styles.workoutTimerRow}>
                  <Text style={styles.workoutTimer}>{WORKOUT_SLIDES[workoutSlideIndex].subtitle}</Text>
                  <View style={styles.workoutTimerIcon} />
                </View>
              </View>
              <Image source={{ uri: WORKOUT_SLIDES[workoutSlideIndex].image }} style={styles.workoutPersonImage} />
            </Animated.View>
            <View style={styles.workoutSlideDots}>
              {WORKOUT_SLIDES.map((_, index) => <View key={index} style={[styles.workoutSlideDot, index === workoutSlideIndex && styles.workoutSlideDotActive]} />)}
            </View>
          </View>
        </View>

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Сүүлийн 7 хоногийн гүйлт</Text><Text style={styles.sectionMeta}>{weeklyTotal.toFixed(1)} км · {formatHours(weeklySeconds)}</Text></View><Text style={styles.trend}>{weeklyTrendText}</Text></View>
        <View style={styles.chartPanel}>
          {dashboard.weekly.map((day, index) => {
            const active = index === dashboard.weekly.length - 1;
            return (
              <Pressable key={day.date} style={[styles.weekRunCard, active && styles.weekRunCardActive]} onPress={() => setSelectedWeeklyDay(day)}>
                <Text style={[styles.weekRunDistance, active && styles.weekRunDistanceActive]}>{day.distanceKm.toFixed(1)}</Text>
                <Text style={[styles.weekRunKmLabel, active && styles.weekRunKmLabelActive]}>км</Text>
                <Text style={[styles.dayLabel, active && styles.activeDay]}>{day.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>Календар</Text>
            <Text style={styles.sectionMeta}>Гүйлт болон төлөвлөсөн арга хэмжээ</Text>
          </View>
          <View style={styles.calendarNav}>
            <Pressable
              accessibilityLabel="Өмнөх сар"
              style={styles.calendarNavButton}
              onPress={() => setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              <Text style={styles.calendarNavText}>‹</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Дараагийн сар"
              style={styles.calendarNavButton}
              onPress={() => setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              <Text style={styles.calendarNavText}>›</Text>
            </Pressable>
          </View>
        </View>
        <BlurView intensity={34} tint="dark" style={styles.calendarPanel}>
          <View style={styles.calendarMonthRow}>
            <Text style={styles.calendarMonthTitle}>{formatCalendarMonth(calendarMonth)}</Text>
            <View style={styles.calendarLegend}>
              <View style={[styles.calendarLegendDot, styles.calendarRunDot]} />
              <Text style={styles.calendarLegendText}>Гүйлт</Text>
              <View style={[styles.calendarLegendDot, styles.calendarEventDot]} />
              <Text style={styles.calendarLegendText}>Event</Text>
            </View>
          </View>
          <View style={styles.calendarWeekHeader}>
            {DAY_LABELS.map(label => <Text key={label} style={styles.calendarWeekLabel}>{label}</Text>)}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map(day => {
              const runs = runsByDate.get(day.dateKey) ?? [];
              const events = eventsByDate.get(day.dateKey) ?? [];
              const hasRuns = runs.length > 0;
              const hasEvents = events.length > 0;
              const isToday = day.dateKey === getDateKey(new Date());
              return (
                <Pressable
                  key={day.dateKey}
                  style={[
                    styles.calendarDay,
                    !day.inMonth && styles.calendarDayMuted,
                    isToday && styles.calendarDayToday,
                    selectedCalendarDay?.dateKey === day.dateKey && styles.calendarDaySelected,
                    hasRuns && styles.calendarDayRun,
                    hasEvents && styles.calendarDayEvent
                  ]}
                  onPress={() => openCalendarDay(day.date, day.dateKey)}
                >
                  <Text style={[styles.calendarDayText, !day.inMonth && styles.calendarDayTextMuted, (hasRuns || hasEvents || isToday) && styles.calendarDayTextActive]}>{day.dayNumber}</Text>
                  {hasRuns || hasEvents ? (
                    <View style={styles.calendarDayDots}>
                      {hasRuns ? <View style={[styles.calendarMarkerDot, styles.calendarRunDot]} /> : null}
                      {hasEvents ? <View style={[styles.calendarMarkerDot, styles.calendarEventDot]} /> : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.calendarInlineDetail}>
            {selectedCalendarDay ? (
              <>
                <View style={styles.calendarInlineHead}>
                  <View>
                    <Text style={styles.savedDetailKicker}>Сонгосон өдөр</Text>
                    <Text style={styles.calendarInlineTitle}>{formatRunDate(selectedCalendarDay.date.toISOString())}</Text>
                  </View>
                  <View style={styles.calendarInlineStats}>
                    <Text style={styles.calendarInlineStat}>{selectedCalendarDay.runs.reduce((sum, run) => sum + run.distanceKm, 0).toFixed(1)} км</Text>
                    <Text style={styles.calendarInlineStat}>{selectedCalendarDay.events.length} event</Text>
                  </View>
                </View>
                {selectedCalendarDay.events.length ? (
                  <View style={styles.calendarDetailSection}>
                    <Text style={styles.calendarDetailSectionTitle}>Бүртгүүлсэн арга хэмжээ</Text>
                    {selectedCalendarDay.events.map(event => (
                      <Pressable key={event.id} style={styles.calendarEventRow} onPress={() => setSelectedEventDetail(event)}>
                        <Image source={{ uri: event.image }} style={styles.calendarEventImage} />
                        <View style={styles.flex}>
                          <Text style={styles.weeklyRunPlace} numberOfLines={1}>{event.title}</Text>
                          <Text style={styles.weeklyRunMeta} numberOfLines={1}>{event.clubName}</Text>
                          <Text style={styles.weeklyRunTime}>{formatEventDate(event.startsAt)} · {event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {selectedCalendarDay.runs.length ? (
                  <View style={styles.calendarDetailSection}>
                    <Text style={styles.calendarDetailSectionTitle}>Гүйсэн мэдээлэл</Text>
                    {selectedCalendarDay.runs.map(run => {
                      const route = run.routeId ? routesById.get(run.routeId) : null;
                      const placeTitle = route?.title ?? (run.coordinates.length ? 'Өөрийн маршрут' : 'Байршил бүртгэгдээгүй');
                      const placeMeta = route ? `${route.area} · ${route.difficulty}` : `${run.coordinates.length} цэгтэй маршрут`;
                      return (
                        <View key={run.id} style={styles.weeklyRunCard}>
                          {route?.image ? <Image source={{ uri: route.image }} style={styles.weeklyRunImage} /> : <View style={styles.weeklyRunImageFallback}><Text style={styles.weeklyRunPin}>⌖</Text></View>}
                          <View style={styles.weeklyRunBody}>
                            <Text style={styles.weeklyRunPlace} numberOfLines={1}>{placeTitle}</Text>
                            <Text style={styles.weeklyRunMeta} numberOfLines={1}>{placeMeta}</Text>
                            <View style={styles.weeklyRunMetricRow}>
                              <Text style={styles.weeklyRunMetric}>{run.distanceKm.toFixed(2)} км</Text>
                              <Text style={styles.weeklyRunMetric}>{formatPace(run.paceSecondsPerKm)}</Text>
                              <Text style={styles.weeklyRunMetric}>{Math.round(run.calories)} ккал</Text>
                            </View>
                            <Text style={styles.weeklyRunTime}>{formatRunTime(run.startedAt)} · {formatHours(run.durationSeconds)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                {!selectedCalendarDay.events.length && !selectedCalendarDay.runs.length ? (
                  <View style={styles.weeklyEmptyRun}>
                    <Text style={styles.emptyTitle}>Энэ өдөр мэдээлэл алга</Text>
                    <Text style={styles.emptyText}>Гүйлт эсвэл бүртгүүлсэн арга хэмжээтэй өдөр тод өнгөөр харагдана.</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.calendarInlineEmpty}>
                <Text style={styles.emptyTitle}>Өдөр сонгоно уу</Text>
                <Text style={styles.emptyText}>Тодорсон өдөр дээр дарахад тухайн өдрийн гүйлт, арга хэмжээ энд харагдана.</Text>
              </View>
            )}
          </View>
        </BlurView>

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Зургийн цомог</Text><Text style={styles.sectionMeta}>{displayedGalleryPhotos.length} зураг</Text></View><Pressable onPress={() => void addGalleryPhotos()}><Text style={styles.textAction}>Зураг нэмэх</Text></Pressable></View>
        {displayedGalleryPhotos.length ? (
          <View style={styles.galleryCoverflow}>
            <ScrollView
              ref={galleryScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={170}
              snapToAlignment="center"
              contentContainerStyle={styles.gallerySwipeTrack}
              onMomentumScrollEnd={event => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / 170);
                setGalleryIndex(Math.max(0, Math.min(displayedGalleryPhotos.length - 1, nextIndex)));
              }}
            >
              {displayedGalleryPhotos.map((photo, index) => {
                const active = index === galleryIndex;
                return (
                  <Pressable
                    key={photo.id}
                    style={[styles.galleryCoverCard, active && styles.galleryCoverCardActive]}
                    onPress={() => active ? setSelectedGalleryPhoto(photo) : setGalleryIndex(index)}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.galleryImage} />
                    {active ? <View style={styles.galleryGlassLabel}><Text style={styles.galleryGlassLabelText}>Харах</Text></View> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.galleryDots}>
              {displayedGalleryPhotos.map((photo, index) => (
                <Pressable
                  key={photo.id}
                  onPress={() => {
                    setGalleryIndex(index);
                    galleryScrollRef.current?.scrollTo({ x: index * 170, animated: true });
                  }}
                  style={[styles.galleryDot, index === galleryIndex && styles.galleryDotActive]}
                />
              ))}
            </View>
          </View>
        ) : (
          <BlurView intensity={34} tint="dark" style={styles.galleryEmptyCard}>
            <Text style={styles.emptyTitle}>Зураг нэмээгүй байна</Text>
            <Text style={styles.emptyText}>Өөрийн гүйлтийн мөчүүдийг цомогтоо хадгалаарай.</Text>
            <Pressable style={styles.galleryAddButton} onPress={() => void addGalleryPhotos()}>
              <Text style={styles.galleryAddButtonText}>Зураг нэмэх</Text>
            </Pressable>
          </BlurView>
        )}

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Бүртгэлтэй клуб</Text><Text style={styles.sectionMeta}>{joinedClub ? '1 үндсэн клуб' : 'Клуб сонгоогүй'}</Text></View></View>
        {joinedClub ? (
          <Pressable style={({ pressed }) => [pressed && styles.registeredClubCardPressed]} onPress={() => setClubDetailOpen(true)}>
            <BlurView intensity={38} tint="dark" style={styles.registeredClubCard}>
            <Image source={{ uri: joinedClub.image }} style={styles.registeredClubImage} />
            <View style={styles.registeredClubCopy}>
              <Text style={styles.registeredClubCity}>{joinedClub.city.toUpperCase()}</Text>
              <Text style={styles.registeredClubName} numberOfLines={1}>{joinedClub.name}</Text>
              <Text style={styles.registeredClubMeta} numberOfLines={1}>{joinedClub.memberCount.toLocaleString()} гишүүн · {joinedClub.weeklyKm.toLocaleString()} км / 7 хоног</Text>
              <Text style={styles.registeredClubContact} numberOfLines={1}>{joinedClub.meetingInfo}</Text>
            </View>
            <View style={styles.registeredClubBadge}><Text style={styles.registeredClubBadgeText}>НЭГДСЭН</Text></View>
            </BlurView>
          </Pressable>
        ) : (
          <View style={styles.emptyState}><Text style={styles.emptyTitle}>Бүртгэлтэй клуб алга</Text><Text style={styles.emptyText}>Home хэсгээс нэг клуб сонгож нэгдээрэй.</Text></View>
        )}

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Оролцож буй чэлленжүүд</Text><Text style={styles.sectionMeta}>{joinedChallenges.length} идэвхтэй</Text></View></View>
        {joinedChallenges.length ? joinedChallenges.map(challenge => {
          const stats = dashboard.challengeProgress.find(item => item.challengeId === challenge.id);
          const completedKm = stats?.totalKm ?? 0;
          const percent = Math.min(100, Math.round((completedKm / challenge.goalKm) * 100));
          const participantCount = stats?.participantCount ?? 1;
          const rank = stats?.rank ?? null;
          return <Pressable key={challenge.id} style={({ pressed }) => [pressed && styles.challengeCardPressed]} onPress={() => setSelectedChallengeDetail({ challenge, completedKm, participants: participantCount, rank })}><BlurView intensity={34} tint="dark" style={styles.challengeCard}><Image source={{ uri: challenge.image }} style={styles.challengeImage} /><View style={styles.challengeMain}><View style={styles.challengeTitleRow}><View style={styles.flex}><Text style={styles.challengeTitle} numberOfLines={1}>{challenge.title}</Text><Text style={styles.challengeOrg}>{challenge.org}</Text></View><View style={styles.rankBadge}><Text style={styles.rankValue}>{rank ? `#${rank}` : '--'}</Text><Text style={styles.rankLabel}>байр</Text></View></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View><View style={styles.progressMeta}><Text style={styles.progressText}>{completedKm.toFixed(1)} / {challenge.goalKm} км</Text><Text style={styles.progressText}>{percent}% · {participantCount} хүн</Text></View><View style={styles.continueRow}><Text style={styles.continueText}>Дэлгэрэнгүй харах</Text><Text style={styles.continueArrow}>›</Text></View></View></BlurView></Pressable>;
        }) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>Идэвхтэй чэлленж алга</Text><Text style={styles.emptyText}>Routes хэсгээс шинэ чэлленжид нэгдээрэй.</Text></View>}

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Оролцох арга хэмжээнүүд</Text><Text style={styles.sectionMeta}>{joinedClubEvents.length} төлөвлөсөн</Text></View></View>
        {joinedClubEvents.length ? joinedClubEvents.map(event => (
          <Pressable key={event.id} onPress={() => setSelectedEventDetail(event)}>
            <BlurView intensity={34} tint="dark" style={styles.profileEventCard}>
            <Image source={{ uri: event.image }} style={styles.profileEventImage} />
            <View style={styles.profileEventCopy}>
              <Text style={styles.profileEventDate}>{formatEventDate(event.startsAt)}</Text>
              <Text style={styles.profileEventTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.profileEventClub}>{event.clubName}</Text>
              <Text style={styles.profileEventMeta} numberOfLines={1}>{event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
            </View>
            <View style={styles.profileEventState}><Text style={styles.profileEventStateText}>ОРОЛЦОНО</Text></View>
            </BlurView>
          </Pressable>
        )) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>Оролцох арга хэмжээ алга</Text><Text style={styles.emptyText}>Онцлох клубын нүүрээс арга хэмжээнд оролцоорой.</Text></View>}

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Нээсэн амжилтууд</Text><Text style={styles.sectionMeta}>{achievements.length} badge</Text></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementRow}>
          {achievements.map(item => (
            <BlurView key={item.id} intensity={42} tint="dark" style={styles.achievementCard}>
              <View style={styles.achievementGlow} />
              <View style={styles.achievementTop}>
                <View style={styles.achievementIcon}>
                  <Text style={styles.achievementTrophy}>🏆</Text>
                  <Text style={styles.achievementIconText}>{item.icon}</Text>
                </View>
                <View style={styles.achievementUnlockedPill}><Text style={styles.achievementUnlockedText}>НЭЭГДСЭН</Text></View>
              </View>
              <Text style={styles.achievementTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.achievementMeta} numberOfLines={2}>{item.meta}</Text>
              <View style={styles.achievementFooterLine}>
                <View style={styles.achievementFooterFill} />
              </View>
              <Text style={styles.achievementRewardText}>RunBoost badge</Text>
            </BlurView>
          ))}
        </ScrollView>

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Найзууд</Text><Text style={styles.sectionMeta}>Профайлыг дарж үзнэ</Text></View><Pressable onPress={() => setConnectionMode('following')}><Text style={styles.textAction}>Бүгд</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
          {dashboard.following.map(person => <Pressable key={person.id} style={styles.personItem} onPress={() => openPerson(person)}><PersonAvatar person={person} style={styles.personAvatar} /><Text style={styles.personName} numberOfLines={1}>{person.name.split(' ')[0]}</Text></Pressable>)}
        </ScrollView>
      </ScrollView>

      <Modal visible={connectionMode !== null} animationType="slide" onRequestClose={() => setConnectionMode(null)}>
        <View style={styles.modalRoot}><View style={styles.modalHeader}><Pressable onPress={() => setConnectionMode(null)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.modalTitle}>Холбоосууд</Text><View style={styles.headerSpacer} /></View><View style={styles.segment}><Pressable style={[styles.segmentButton, connectionMode === 'following' && styles.activeSegment]} onPress={() => setConnectionMode('following')}><Text style={styles.segmentText}>Дагасан {dashboard.following.length}</Text></Pressable><Pressable style={[styles.segmentButton, connectionMode === 'followers' && styles.activeSegment]} onPress={() => setConnectionMode('followers')}><Text style={styles.segmentText}>Дагуулсан {dashboard.followers.length}</Text></Pressable></View><ScrollView contentContainerStyle={styles.listContent}>{connectionPeople.map(person => <Pressable key={person.id} style={styles.personRow} onPress={() => openPerson(person)}><PersonAvatar person={person} style={styles.rowAvatar} /><View style={styles.flex}><Text style={styles.rowName}>{person.name}</Text><Text style={styles.rowMeta}>Профайл харах</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</ScrollView></View>
      </Modal>

      <Modal visible={profileOpen} animationType="slide" onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.modalRoot}>
          <BlurView intensity={58} tint="dark" style={styles.modalHeader}>
            <Pressable onPress={() => setProfileOpen(false)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
            <View><Text style={styles.modalTitle}>Найзын профайл</Text><Text style={styles.modalSubtitle}>{selectedPerson?.name ?? ''}</Text></View>
            <View style={styles.headerSpacer} />
          </BlurView>
          {selectedPerson && selectedFriendDetails ? (
            <ScrollView contentContainerStyle={styles.friendProfileContent} showsVerticalScrollIndicator={false}>
              <View style={styles.friendHero}>
                <PersonAvatar person={selectedPerson} style={styles.friendHeroAvatar} />
                <View style={styles.flex}>
                  <Text style={styles.friendHeroName}>{selectedPerson.name}</Text>
                  <Text style={styles.friendHeroHandle}>@{selectedPerson.name.toLowerCase().replaceAll(' ', '.')}</Text>
                  <Text style={styles.friendHeroState}>Найз · идэвхтэй гүйгч</Text>
                </View>
              </View>
              <View style={styles.friendStatsGrid}>
                <View style={styles.friendStatCard}><Text style={styles.personStatValue}>{selectedFriendDetails.summary.totalKm.toFixed(1)}</Text><Text style={styles.personStatLabel}>нийт км</Text></View>
                <View style={styles.friendStatCard}><Text style={styles.personStatValue}>{selectedFriendDetails.summary.runCount}</Text><Text style={styles.personStatLabel}>гүйлт</Text></View>
                <View style={styles.friendStatCard}><Text style={styles.personStatValue}>{selectedFriendDetails.weeklyKm}</Text><Text style={styles.personStatLabel}>7 хоног км</Text></View>
                <View style={styles.friendStatCard}><Text style={styles.personStatValue}>{selectedFriendDetails.avgPace}</Text><Text style={styles.personStatLabel}>дундаж pace</Text></View>
              </View>
              <View style={styles.friendSection}><Text style={styles.friendSectionTitle}>Оролцож буй чэлленж</Text>{selectedFriendDetails.activeChallenges.map(item => {
                const percent = Math.round((item.progressKm / item.goalKm) * 100);
                return (
                  <View key={item.id} style={styles.friendChallengeRow}>
                    <Image source={{ uri: item.image }} style={styles.friendChallengeImage} />
                    <View style={styles.flex}>
                      <Text style={styles.friendItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.friendItemMeta}>{item.org} · #{item.rank}</Text>
                      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
                      <Text style={styles.friendItemMeta}>{item.progressKm.toFixed(1)} / {item.goalKm} км · {percent}%</Text>
                    </View>
                  </View>
                );
              })}</View>
              <View style={styles.friendSection}><Text style={styles.friendSectionTitle}>Клубын арга хэмжээ</Text>{selectedFriendDetails.clubEvents.map(event => (
                <View key={event.id} style={styles.friendEventRow}>
                  <Image source={{ uri: event.image }} style={styles.friendEventImage} />
                  <View style={styles.flex}>
                    <Text style={styles.friendItemTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.friendItemMeta}>{event.clubName}</Text>
                    <Text style={styles.friendItemMeta}>{formatEventDate(event.date)} · {event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
                  </View>
                </View>
              ))}</View>
              <View style={styles.friendSection}><Text style={styles.friendSectionTitle}>Хүрсэн амжилтууд</Text><View style={styles.friendAchievementGrid}>{selectedFriendDetails.achievements.map(item => (
                <View key={item.id} style={styles.friendAchievementCard}><View style={styles.friendAchievementIcon}><Text style={styles.friendAchievementCode}>{item.code}</Text></View><Text style={styles.friendAchievementTitle}>{item.title}</Text><Text style={styles.friendItemMeta}>{item.meta}</Text></View>
              ))}</View></View>
              <View style={styles.friendSection}><Text style={styles.friendSectionTitle}>Оролцсон марафон</Text>{selectedFriendDetails.marathons.map(item => (
                <View key={item.id} style={styles.marathonRow}><View><Text style={styles.friendItemTitle}>{item.title}</Text><Text style={styles.friendItemMeta}>{item.year} · {item.distance}</Text></View><Text style={styles.marathonResult}>{item.result}</Text></View>
              ))}</View>
              <View style={styles.friendSection}><Text style={styles.friendSectionTitle}>Зургууд</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendPhotoRow}>{selectedFriendDetails.photos.map(photo => <Image key={photo.id} source={{ uri: photo.uri }} style={styles.friendPhoto} />)}</ScrollView></View>
              <Pressable style={styles.messageButton} onPress={() => openChat(selectedPerson)}><Text style={styles.messageButtonText}>Мессеж бичих</Text></Pressable>
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <Modal visible={inboxOpen} animationType="slide" onRequestClose={() => setInboxOpen(false)}>
        <View style={styles.modalRoot}>
          <BlurView intensity={58} tint="dark" style={styles.modalHeader}>
            <Pressable onPress={() => setInboxOpen(false)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
            <View><Text style={styles.modalTitle}>Мессеж</Text><Text style={styles.modalSubtitle}>{dashboard.profile.name}</Text></View>
            <Pressable accessibilityLabel="Group chat үүсгэх" onPress={() => setCreateGroupOpen(true)} style={styles.createGroupIconButton}><Text style={styles.createGroupIconText}>+</Text></Pressable>
          </BlurView>
          <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={inboxQuery} onChangeText={setInboxQuery} placeholder="Хайх" placeholderTextColor="#82949B" style={styles.searchInput} /></View>
          <ScrollView contentContainerStyle={styles.listContent}>
            {createdGroups.map(chat => (
              <View key={chat.id} style={styles.createdGroupCard}>
                <Pressable style={styles.createdGroupMain} onPress={() => openCreatedGroupChat(chat)}>
                  <View style={styles.createdGroupAvatar}><Text style={styles.createdGroupAvatarText}>G</Text></View>
                  <View style={styles.flex}><Text style={styles.rowName}>{chat.title}</Text><Text style={styles.messagePreview}>{chat.memberIds.length} орсон · {chat.pendingIds.length} хүлээгдэж байна</Text></View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
                {chat.pendingIds.length ? <View style={styles.pendingInviteList}>{chat.pendingIds.map(personId => {
                  const person = dashboard.following.find(item => item.id === personId);
                  if (!person) return null;
                  return <Pressable key={personId} style={styles.acceptInviteButton} onPress={() => acceptGroupInvite(chat.id, personId)}><Text style={styles.acceptInviteText}>{person.name.split(' ')[0]} зөвшөөрөх</Text></Pressable>;
                })}</View> : null}
              </View>
            ))}
            {visibleConversations.length ? visibleConversations.map(item => <Pressable key={item.person.id} style={styles.conversationRow} onPress={() => openChat(item.person)}><PersonAvatar person={item.person} style={styles.conversationAvatar} /><View style={styles.flex}><Text style={styles.rowName}>{item.person.name}</Text><Text style={styles.messagePreview} numberOfLines={1}>{item.message}</Text></View><View style={styles.messageSide}><Text style={styles.messageTime}>{shortTime(item.createdAt)}</Text>{item.unread ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread}</Text></View> : null}</View></Pressable>) : <View style={styles.emptyInbox}><Text style={styles.emptyTitle}>Мессеж олдсонгүй</Text><Text style={styles.emptyText}>Найзынхаа профайлаас чат эхлүүлээрэй.</Text></View>}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={createGroupOpen} transparent animationType="fade" onRequestClose={() => setCreateGroupOpen(false)}>
        <View style={styles.profileModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateGroupOpen(false)} />
          <BlurView intensity={68} tint="dark" style={styles.createGroupModal}>
            <Pressable style={styles.modalClose} onPress={() => setCreateGroupOpen(false)}><Text style={styles.closeText}>×</Text></Pressable>
            <Text style={styles.createGroupTitle}>Group chat үүсгэх</Text>
            <TextInput value={groupName} onChangeText={setGroupName} placeholder="Group нэр" placeholderTextColor="#82949B" style={styles.groupNameInput} />
            <ScrollView style={styles.inviteList} contentContainerStyle={styles.inviteListContent}>
              {dashboard.following.map(person => {
                const selected = selectedInviteIds.includes(person.id);
                return (
                  <Pressable key={person.id} style={[styles.inviteRow, selected && styles.inviteRowSelected]} onPress={() => toggleInvite(person.id)}>
                    <PersonAvatar person={person} style={styles.rowAvatar} />
                    <View style={styles.flex}><Text style={styles.rowName}>{person.name}</Text><Text style={styles.rowMeta}>Найз · invite илгээх</Text></View>
                    <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}><Text style={styles.checkText}>{selected ? '✓' : ''}</Text></View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable disabled={!groupName.trim() || !selectedInviteIds.length} style={[styles.groupChatButton, (!groupName.trim() || !selectedInviteIds.length) && styles.sendDisabled]} onPress={createGroupChat}>
              <Text style={styles.groupChatButtonText}>Хүсэлт илгээж group үүсгэх</Text>
            </Pressable>
          </BlurView>
        </View>
      </Modal>

      <Modal visible={chatPerson !== null} animationType="slide" onRequestClose={() => setChatPerson(null)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <BlurView intensity={62} tint="dark" style={styles.chatHeader}><Pressable onPress={() => setChatPerson(null)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>{chatPerson ? <><PersonAvatar person={chatPerson} style={styles.chatAvatar} /><View style={styles.flex}><Text style={styles.rowName}>{chatPerson.name}</Text><Text style={styles.onlineText}>Идэвхтэй</Text></View></> : null}</BlurView>
          <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>{messages.map(message => { const mine = message.senderId === currentUserId; return <View key={message.id} style={[styles.bubbleWrap, mine && styles.myBubbleWrap]}><View style={[styles.bubble, mine && styles.myBubble]}><Text style={[styles.bubbleText, mine && styles.myBubbleText]}>{message.body}</Text></View><Text style={styles.bubbleTime}>{shortTime(message.createdAt)}</Text></View>; })}</ScrollView>
          <BlurView intensity={62} tint="dark" style={styles.composer}><TextInput value={messageText} onChangeText={setMessageText} placeholder="Мессеж..." placeholderTextColor="#82949B" style={styles.messageInput} returnKeyType="send" onSubmitEditing={sendMessage} /><Pressable disabled={!messageText.trim() || sending} onPress={sendMessage} style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendDisabled]}><Text style={styles.sendText}>↑</Text></Pressable></BlurView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(selectedChallengeDetail)} transparent animationType="fade" onRequestClose={() => setSelectedChallengeDetail(null)}>
        <View style={styles.detailBackdropRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedChallengeDetail(null)} />
          {selectedChallengeDetail ? (
            <View style={styles.savedDetailCard}>
              <Image source={{ uri: selectedChallengeDetail.challenge.image }} style={styles.savedDetailImage} />
              <Text style={styles.savedDetailKicker}>{selectedChallengeDetail.challenge.org}</Text>
              <Text style={styles.savedDetailTitle}>{selectedChallengeDetail.challenge.title}</Text>
              <View style={styles.savedDetailStats}>
                <View><Text style={styles.savedDetailValue}>{selectedChallengeDetail.completedKm.toFixed(1)} / {selectedChallengeDetail.challenge.goalKm}</Text><Text style={styles.savedDetailLabel}>км явц</Text></View>
                <View><Text style={styles.savedDetailValue}>{selectedChallengeDetail.rank ? `#${selectedChallengeDetail.rank}` : '--'}</Text><Text style={styles.savedDetailLabel}>байр</Text></View>
                <View><Text style={styles.savedDetailValue}>{selectedChallengeDetail.participants}</Text><Text style={styles.savedDetailLabel}>оролцогч</Text></View>
              </View>
              <Text style={styles.savedDetailBody}>
                {isSingleRunChallenge(selectedChallengeDetail.challenge)
                  ? 'Энэ чэлленж таны профайлд хадгалагдсан. Нэг удаагийн гүйлтээр зорилгоо биелүүлээрэй.'
                  : 'Энэ чэлленж таны профайлд хадгалагдсан. Гүйлтээ үргэлжлүүлж зорилгоо биелүүлээрэй.'}
              </Text>
              <Pressable style={styles.startChallengeRunButton} onPress={() => {
                const target = selectedChallengeDetail.challenge;
                const progressKm = isSingleRunChallenge(target) ? 0 : selectedChallengeDetail.completedKm;
                setSelectedChallengeDetail(null);
                onStartChallengeRun(target, progressKm);
              }}>
                <Text style={styles.startChallengeRunButtonText}>Гүйх</Text>
              </Pressable>
              <Pressable style={styles.groupChatSecondaryButton} onPress={() => openChallengeGroupChat(selectedChallengeDetail)}>
                <Text style={styles.groupChatSecondaryText}>Group chat-д орох</Text>
              </Pressable>
              <Pressable style={styles.cancelSavedButton} onPress={() => {
                const target = selectedChallengeDetail.challenge;
                Alert.alert('Чэлленж цуцлах уу?', `“${target.title}”-ийг профайлаас хасах уу?`, [
                  { text: 'Болих', style: 'cancel' },
                  { text: 'Цуцлах', style: 'destructive', onPress: () => { setSelectedChallengeDetail(null); onCancelChallenge(target); } }
                ]);
              }}>
                <Text style={styles.cancelSavedButtonText}>Чэлленж цуцлах</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={Boolean(selectedEventDetail)} transparent animationType="fade" onRequestClose={() => setSelectedEventDetail(null)}>
        <View style={styles.detailBackdropRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedEventDetail(null)} />
          {selectedEventDetail ? (
            <View style={styles.savedDetailCard}>
              <Pressable accessibilityLabel="Хаах" style={styles.savedDetailClose} onPress={() => setSelectedEventDetail(null)}>
                <Text style={styles.savedDetailCloseText}>×</Text>
              </Pressable>
              <Image source={{ uri: selectedEventDetail.image }} style={styles.savedDetailImage} />
              <Text style={styles.savedDetailKicker}>{selectedEventDetail.clubName}</Text>
              <Text style={styles.savedDetailTitle}>{selectedEventDetail.title}</Text>
              <View style={styles.savedEventMeta}>
                <Text style={styles.savedEventMetaText}>{formatEventDate(selectedEventDetail.startsAt)}</Text>
                <Text style={styles.savedEventMetaText}>{selectedEventDetail.location}{selectedEventDetail.distanceKm ? ` · ${selectedEventDetail.distanceKm} км` : ''}</Text>
                <Text style={styles.savedEventMetaText}>{selectedEventDetail.participantCount} бүртгэгдсэн</Text>
              </View>
              <Text style={styles.savedDetailBody}>{selectedEventDetail.description}</Text>
              {selectedEventDetail.advice.slice(0, 3).map((advice, index) => <Text key={`${advice}-${index}`} style={styles.savedAdvice}>• {advice}</Text>)}
              {joinedClubEventIdSet.has(selectedEventDetail.id) ? (
                <>
                  <Pressable style={styles.startChallengeRunButton} onPress={() => {
                    const target = selectedEventDetail;
                    setSelectedEventDetail(null);
                    onStartClubEventRun(target);
                  }}>
                    <Text style={styles.startChallengeRunButtonText}>Гүйлт эхлүүлэх</Text>
                  </Pressable>
                  <Pressable style={styles.groupChatButton} onPress={() => openEventGroupChat(selectedEventDetail)}>
                    <Text style={styles.groupChatButtonText}>Group chat-д орох</Text>
                  </Pressable>
                  <Pressable style={styles.cancelSavedButton} onPress={() => {
                    const target = selectedEventDetail;
                    setSelectedEventDetail(null);
                    onCancelClubEvent(target);
                  }}>
                    <Text style={styles.cancelSavedButtonText}>Оролцохоо цуцлах</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.groupChatButton} onPress={() => setRegistrationPickerEvent(selectedEventDetail)}>
                  <Text style={styles.groupChatButtonText}>Бүртгүүлэх</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={Boolean(eventRegistrationNotice)} transparent animationType="fade" onRequestClose={() => setEventRegistrationNotice(null)}>
        <View style={styles.detailBackdropRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEventRegistrationNotice(null)} />
          {eventRegistrationNotice ? (
            <View style={styles.registrationSuccessCard}>
              <View style={styles.registrationSuccessMark}><Text style={styles.registrationSuccessMarkText}>✓</Text></View>
              <Text style={styles.registrationSuccessTitle}>Амжилттай бүртгэгдлээ.</Text>
              <Text style={styles.registrationSuccessEvent}>{eventRegistrationNotice.title}</Text>
              <Pressable style={styles.registrationSuccessButton} onPress={() => setEventRegistrationNotice(null)}>
                <Text style={styles.registrationSuccessButtonText}>Ойлголоо</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={Boolean(registrationPickerEvent)} transparent animationType="fade" onRequestClose={() => setRegistrationPickerEvent(null)}>
        <View style={styles.detailBackdropRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRegistrationPickerEvent(null)} />
          {registrationPickerEvent ? (
            <View style={styles.registrationPickerCard}>
              <Pressable accessibilityLabel="Хаах" style={styles.registrationPickerClose} onPress={() => setRegistrationPickerEvent(null)}>
                <Text style={styles.registrationPickerCloseText}>×</Text>
              </Pressable>
              <Text style={styles.registrationStepText}>2/3: Гүйлт сонгох</Text>
              <View style={styles.registrationProgressRow}><View style={styles.registrationProgressActive} /><View style={styles.registrationProgressActive} /><View style={styles.registrationProgressRest} /></View>
              <View style={styles.registrationModeRow}>
                {[
                  { id: 'regular' as RegistrationMode, label: 'Энгийн' },
                  { id: 'para' as RegistrationMode, label: 'Пара' },
                  { id: 'virtual' as RegistrationMode, label: 'Цахим' }
                ].map(mode => (
                  <Pressable key={mode.id} style={styles.registrationModeItem} onPress={() => {
                    setRegistrationMode(mode.id);
                    setSelectedRegistrationType(mode.id === 'para' ? 'para-full' : 'half');
                  }}>
                    <View style={[styles.registrationRadio, registrationMode === mode.id && styles.registrationRadioActive]}>{registrationMode === mode.id ? <View style={styles.registrationRadioDot} /> : null}</View>
                    <Text style={styles.registrationModeText}>{mode.label}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.registrationTypeGrid}>
                {registrationOptions.map(item => {
                  const active = selectedRegistrationType === item.id;
                  return (
                    <Pressable key={item.id} style={[styles.registrationTypeCard, active && styles.registrationTypeCardActive]} onPress={() => setSelectedRegistrationType(item.id)}>
                      <View style={[styles.registrationTypeIcon, { backgroundColor: item.tone }]}><Text style={styles.registrationTypeIconText}>♕</Text></View>
                      <View style={styles.flex}>
                        <Text style={[styles.registrationTypeTitle, { color: item.tone }]}>{item.title}</Text>
                        <Text style={styles.registrationTypeMeta}>Зай: {item.distance}</Text>
                        <Text style={styles.registrationTypeMeta}>Нас: {item.age}</Text>
                      </View>
                      <View style={styles.registrationFeatureLine}><Text style={styles.registrationFeatureText}>✓ Энгийн дугаар</Text></View>
                      <View style={styles.registrationPriceRow}><Text style={styles.registrationPriceLabel}>Төлбөрийн дүн:</Text><Text style={styles.registrationPrice}>{item.price}</Text></View>
                      <Pressable style={[styles.registrationPayButton, active && styles.registrationPayButtonActive]} onPress={() => active && openQPayPayment()}>
                        <Text style={[styles.registrationPayText, active && styles.registrationPayTextActive]}>Төлбөр төлөх</Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={Boolean(qpayPayment)} transparent animationType="fade" onRequestClose={() => setQpayPayment(null)}>
        <View style={styles.detailBackdropRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setQpayPayment(null)} />
          {qpayPayment ? (
            <View style={styles.qpayCard}>
              <Pressable accessibilityLabel="Хаах" style={styles.registrationPickerClose} onPress={() => setQpayPayment(null)}>
                <Text style={styles.registrationPickerCloseText}>×</Text>
              </Pressable>
              <Text style={styles.qpayBrand}>QPay</Text>
              <Text style={styles.qpayTitle}>Төлбөр төлөх</Text>
              <Text style={styles.qpaySubtitle}>{qpayPayment.event.title}</Text>
              <View style={styles.qpayQr}>
                {Array.from({ length: 49 }).map((_, index) => (
                  <View key={index} style={[styles.qpayQrCell, (index % 3 === 0 || index % 7 === 1 || index === 24) && styles.qpayQrCellDark]} />
                ))}
              </View>
              <View style={styles.qpayInfoBox}>
                <View><Text style={styles.qpayInfoLabel}>Төрөл</Text><Text style={styles.qpayInfoValue}>{qpayPayment.option.title}</Text></View>
                <View><Text style={styles.qpayInfoLabel}>Төлөх дүн</Text><Text style={styles.qpayAmount}>{qpayPayment.option.price}</Text></View>
              </View>
              <Text style={styles.qpayHint}>QPay апп эсвэл банкны апп-аар QR уншуулж төлбөрөө төлнө үү.</Text>
              <Pressable style={styles.qpayPrimaryButton} onPress={() => void confirmQPayPayment()}>
                <Text style={styles.qpayPrimaryText}>Төлбөр төлөгдсөн</Text>
              </Pressable>
              <Pressable style={styles.qpaySecondaryButton} onPress={() => {
                setRegistrationPickerEvent(qpayPayment.event);
                setQpayPayment(null);
              }}>
                <Text style={styles.qpaySecondaryText}>Буцах</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={clubDetailOpen && Boolean(joinedClub)} animationType="slide" onRequestClose={() => setClubDetailOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setClubDetailOpen(false)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
            <View><Text style={styles.modalTitle}>Клубын дэлгэрэнгүй</Text><Text style={styles.modalSubtitle}>Бүртгэлтэй клуб</Text></View>
            <View style={styles.headerSpacer} />
          </View>
          {joinedClub ? (
            <ScrollView contentContainerStyle={styles.clubDetailContent} showsVerticalScrollIndicator={false}>
              <Image source={{ uri: joinedClub.image }} style={styles.clubDetailHero} />
              <Text style={styles.clubDetailCity}>{joinedClub.city.toUpperCase()}</Text>
              <Text style={styles.clubDetailName}>{joinedClub.name}</Text>
              <Text style={styles.clubDetailDescription}>{joinedClub.description}</Text>
              <View style={styles.clubDetailStats}>
                <View style={styles.clubDetailStat}><Text style={styles.clubDetailValue}>{joinedClub.memberCount.toLocaleString()}</Text><Text style={styles.clubDetailLabel}>Гишүүн</Text></View>
                <View style={styles.clubDetailDivider} />
                <View style={styles.clubDetailStat}><Text style={styles.clubDetailValue}>{joinedClub.weeklyKm.toLocaleString()}</Text><Text style={styles.clubDetailLabel}>7 хоногийн км</Text></View>
                <View style={styles.clubDetailDivider} />
                <View style={styles.clubDetailStat}><Text style={styles.clubDetailValue}>{joinedClub.totalKm.toLocaleString()}</Text><Text style={styles.clubDetailLabel}>Нийт км</Text></View>
              </View>
              <View style={styles.clubDetailSection}>
                <Text style={styles.clubDetailSectionTitle}>Холбоо барих</Text>
                <Text style={styles.clubDetailContact}>{joinedClub.meetingInfo}</Text>
              </View>
              <View style={styles.clubDetailSection}>
                <Text style={styles.clubDetailSectionTitle}>Клубын арга хэмжээ</Text>
                {registeredClubEvents.length ? registeredClubEvents.map(event => (
                  <Pressable key={event.id} style={styles.clubDetailEventRow} onPress={() => openClubEventDetail(event)}>
                    <Image source={{ uri: event.image }} style={styles.clubDetailEventImage} />
                    <View style={styles.flex}>
                      <Text style={styles.clubDetailEventDate}>{formatEventDate(event.startsAt)}</Text>
                      <Text style={styles.clubDetailEventTitle} numberOfLines={1}>{event.title}</Text>
                      <Text style={styles.clubDetailEventMeta} numberOfLines={1}>{event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
                    </View>
                    <Pressable style={styles.clubDetailRegisterButton} onPress={pressEvent => {
                      pressEvent.stopPropagation();
                      openClubEventDetail(event);
                    }}>
                      <Text style={styles.clubDetailRegisterText}>Дэлгэрэнгүй</Text>
                    </Pressable>
                  </Pressable>
                )) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>Арга хэмжээ алга</Text><Text style={styles.emptyText}>Энэ клубт одоогоор төлөвлөсөн арга хэмжээ алга.</Text></View>}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <Modal visible={Boolean(groupChat)} animationType="slide" onRequestClose={() => setGroupChat(null)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <BlurView intensity={62} tint="dark" style={styles.chatHeader}>
            <Pressable onPress={() => setGroupChat(null)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
            {groupChat ? <View style={styles.flex}><Text style={styles.rowName}>{groupChat.title}</Text><Text style={styles.onlineText}>{groupChat.subtitle} · {groupChat.members} хүн</Text></View> : null}
          </BlurView>
          <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
            {groupMessages.map(message => (
              <View key={message.id} style={[styles.bubbleWrap, message.mine && styles.myBubbleWrap]}>
                {!message.mine ? (
                  <Pressable onPress={() => openGroupPerson(message.user)}>
                    <Text style={styles.groupSender}>{message.user}</Text>
                  </Pressable>
                ) : null}
                <View style={[styles.bubble, message.mine && styles.myBubble]}>
                  <Text style={[styles.bubbleText, message.mine && styles.myBubbleText]}>{message.body}</Text>
                </View>
                <Text style={styles.bubbleTime}>{shortTime(message.createdAt)}</Text>
              </View>
            ))}
          </ScrollView>
          <BlurView intensity={62} tint="dark" style={styles.composer}>
            <TextInput
              value={groupMessageText}
              onChangeText={setGroupMessageText}
              placeholder="Group chat..."
              placeholderTextColor="#82949B"
              style={styles.messageInput}
              returnKeyType="send"
              onSubmitEditing={sendGroupMessage}
            />
            <Pressable disabled={!groupMessageText.trim()} onPress={sendGroupMessage} style={[styles.sendButton, !groupMessageText.trim() && styles.sendDisabled]}>
              <Text style={styles.sendText}>↑</Text>
            </Pressable>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(selectedGroupPerson)} transparent animationType="fade" onRequestClose={() => setSelectedGroupPerson(null)}>
        <View style={styles.profileModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedGroupPerson(null)} />
          <View style={styles.profileModal}>
            {selectedGroupPerson ? (
              <>
                <Pressable style={styles.modalClose} onPress={() => setSelectedGroupPerson(null)}><Text style={styles.closeText}>×</Text></Pressable>
                <PersonAvatar person={selectedGroupPerson} style={styles.largeAvatar} />
                <Text style={styles.largeName}>{selectedGroupPerson.name}</Text>
                <Text style={styles.friendState}>Group chat оролцогч</Text>
                <View style={styles.personStats}>
                  <View><Text style={styles.personStatValue}>128.4</Text><Text style={styles.personStatLabel}>км</Text></View>
                  <View><Text style={styles.personStatValue}>24</Text><Text style={styles.personStatLabel}>гүйлт</Text></View>
                  <View><Text style={styles.personStatValue}>18</Text><Text style={styles.personStatLabel}>пост</Text></View>
                </View>
                <Pressable
                  disabled={friendRequestIds.includes(selectedGroupPerson.id)}
                  style={[styles.messageButton, friendRequestIds.includes(selectedGroupPerson.id) && styles.friendRequestedButton]}
                  onPress={() => sendFriendRequest(selectedGroupPerson)}
                >
                  <Text style={styles.messageButtonText}>{friendRequestIds.includes(selectedGroupPerson.id) ? 'Хүсэлт илгээгдсэн' : 'Найзын хүсэлт илгээх'}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedWeeklyDay)} transparent animationType="fade" onRequestClose={() => setSelectedWeeklyDay(null)}>
        <View style={styles.detailBackdropRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedWeeklyDay(null)} />
          {selectedWeeklyDay ? (
            <View style={styles.weeklyDetailCard}>
              <Pressable accessibilityLabel="Хаах" style={styles.savedDetailClose} onPress={() => setSelectedWeeklyDay(null)}>
                <Text style={styles.savedDetailCloseText}>×</Text>
              </Pressable>
              <Text style={styles.savedDetailKicker}>Сүүлийн 7 хоногийн гүйлт</Text>
              <Text style={styles.savedDetailTitle}>{formatRunDate(selectedWeeklyDay.date)}</Text>
              <View style={styles.weeklyDetailStats}>
                <View><Text style={styles.savedDetailValue}>{selectedWeeklyDay.distanceKm.toFixed(1)} км</Text><Text style={styles.savedDetailLabel}>нийт зай</Text></View>
                <View><Text style={styles.savedDetailValue}>{selectedWeeklyDay.runs.length}</Text><Text style={styles.savedDetailLabel}>гүйлт</Text></View>
                <View><Text style={styles.savedDetailValue}>{formatHours(selectedWeeklyDay.runs.reduce((sum, run) => sum + run.durationSeconds, 0))}</Text><Text style={styles.savedDetailLabel}>хугацаа</Text></View>
              </View>
              <ScrollView style={styles.weeklyRunList} contentContainerStyle={styles.weeklyRunListContent} showsVerticalScrollIndicator={false}>
                {selectedWeeklyDay.runs.length ? selectedWeeklyDay.runs.map(run => {
                  const route = run.routeId ? routesById.get(run.routeId) : null;
                  const placeTitle = route?.title ?? (run.coordinates.length ? 'Өөрийн маршрут' : 'Байршил бүртгэгдээгүй');
                  const placeMeta = route ? `${route.area} · ${route.difficulty}` : `${run.coordinates.length} цэгтэй маршрут`;
                  return (
                    <View key={run.id} style={styles.weeklyRunCard}>
                      {route?.image ? <Image source={{ uri: route.image }} style={styles.weeklyRunImage} /> : <View style={styles.weeklyRunImageFallback}><Text style={styles.weeklyRunPin}>⌖</Text></View>}
                      <View style={styles.weeklyRunBody}>
                        <Text style={styles.weeklyRunPlace} numberOfLines={1}>{placeTitle}</Text>
                        <Text style={styles.weeklyRunMeta} numberOfLines={1}>{placeMeta}</Text>
                        <View style={styles.weeklyRunMetricRow}>
                          <Text style={styles.weeklyRunMetric}>{run.distanceKm.toFixed(2)} км</Text>
                          <Text style={styles.weeklyRunMetric}>{formatPace(run.paceSecondsPerKm)}</Text>
                          <Text style={styles.weeklyRunMetric}>{Math.round(run.calories)} ккал</Text>
                        </View>
                        <Text style={styles.weeklyRunTime}>{formatRunTime(run.startedAt)} · {formatHours(run.durationSeconds)}</Text>
                      </View>
                    </View>
                  );
                }) : (
                  <View style={styles.weeklyEmptyRun}>
                    <Text style={styles.emptyTitle}>Энэ өдөр гүйлт алга</Text>
                    <Text style={styles.emptyText}>Гүйлт хийсэн өдрөө дарвал газар, зай, pace зэрэг мэдээлэл энд харагдана.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={Boolean(selectedGalleryPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedGalleryPhoto(null)}>
        <View style={styles.galleryModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedGalleryPhoto(null)} />
          {selectedGalleryPhoto ? (
            <View style={styles.galleryPreviewCard}>
              <Pressable accessibilityLabel="Хаах" style={styles.savedDetailClose} onPress={() => setSelectedGalleryPhoto(null)}>
                <Text style={styles.savedDetailCloseText}>×</Text>
              </Pressable>
              <Image source={{ uri: selectedGalleryPhoto.uri }} style={styles.galleryPreviewImage} />
              <Pressable style={styles.galleryDeleteButton} onPress={() => deleteGalleryPhoto(selectedGalleryPhoto.id)}>
                <Text style={styles.galleryDeleteButtonText}>Зураг устгах</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050B10' },
  content: { paddingHorizontal: 16, paddingTop: 46, paddingBottom: 118 },
  profileHeader: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 26, padding: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4 },
  avatarButton: { width: 66, height: 66, borderRadius: 33 },
  avatarButtonPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(168,255,24,0.74)', backgroundColor: '#10262D' },
  avatarEditBadge: { position: 'absolute', left: 5, right: 5, bottom: 2, minHeight: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: 'rgba(7,20,25,0.88)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.5)' },
  avatarEditText: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  fallbackAvatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#17464C' },
  fallbackAvatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  identity: { flex: 1, minWidth: 0 },
  name: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  handle: { color: '#AFC1C8', fontSize: 11, fontWeight: '700', marginTop: 4 },
  inboxButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  logoutButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,73,108,0.16)', borderWidth: 1, borderColor: 'rgba(255,73,108,0.32)' },
  logoutIcon: { color: '#FF8AA0', fontSize: 22, lineHeight: 24, fontWeight: '900' },
  inboxIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', transform: [{ rotate: '-24deg' }] },
  messengerIconBack: { position: 'absolute', width: 24, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', transform: [{ translateX: -4 }, { translateY: 3 }] },
  messengerIconFront: { width: 25, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  messengerBolt: { width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#102014', transform: [{ rotate: '-35deg' }, { translateY: -1 }] },
  chatIconBack: { position: 'absolute', width: 21, height: 17, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', transform: [{ translateX: -5 }, { translateY: 4 }] },
  chatIconFront: { width: 25, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  chatIconTail: { position: 'absolute', right: 3, bottom: -3, width: 8, height: 8, borderRadius: 2, backgroundColor: colors.accent, transform: [{ rotate: '45deg' }] },
  unreadDot: { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF496C', borderWidth: 1, borderColor: '#071419' },
  statStrip: { minHeight: 82, flexDirection: 'row', alignItems: 'stretch', gap: 9, marginTop: 14 },
  statItem: { flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.accent, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', shadowColor: '#B6FF2E', shadowOpacity: 0.42, shadowRadius: 14, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  statValue: { color: '#071419', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#071419', fontSize: 8, fontWeight: '900', marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.13)' },
  sectionHead: { minHeight: 52, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  sectionMeta: { color: '#AFC1C8', fontSize: 10, fontWeight: '700', marginTop: 4 },
  trend: { color: colors.accent, fontSize: 11, fontWeight: '900', borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(182,255,46,0.1)', paddingHorizontal: 8, paddingVertical: 5 },
  workoutSlide: { minHeight: 132, borderRadius: 28, padding: 12, marginTop: 18, backgroundColor: '#071014', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', shadowColor: '#000000', shadowOpacity: 0.34, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 6 },
  workoutCard: { minHeight: 108, flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingLeft: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', shadowColor: '#B6FF2E', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  workoutAnimatedLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  workoutCardCopy: { flex: 1, zIndex: 2, paddingVertical: 12, paddingRight: 112 },
  workoutCardKicker: { color: '#7B8A8F', fontSize: 8, fontWeight: '900' },
  workoutCardTitle: { color: '#071419', fontSize: 15, lineHeight: 18, fontWeight: '900', marginTop: 5 },
  workoutTimerRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginTop: 10, backgroundColor: 'rgba(182,255,46,0.2)' },
  workoutTimer: { color: '#26330F', fontSize: 9, fontWeight: '900' },
  workoutTimerIcon: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  workoutPersonImage: { position: 'absolute', right: -6, bottom: -3, width: 156, height: 116, resizeMode: 'cover' },
  workoutSlideDots: { position: 'absolute', right: 16, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 3 },
  workoutSlideDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(7,20,25,0.22)' },
  workoutSlideDotActive: { width: 14, backgroundColor: colors.accent },
  chartPanel: { minHeight: 92, flexDirection: 'row', alignItems: 'stretch', gap: 8, borderRadius: 22, padding: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' },
  chartGrid: { position: 'absolute', left: 12, right: 12, top: 28, height: 100, justifyContent: 'space-between' },
  chartBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  chartColumn: { width: 34, height: 154, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 12, minHeight: 4, borderRadius: 6, backgroundColor: '#3C6B70' },
  activeBar: { backgroundColor: colors.accent },
  barValue: { color: '#C8D6DB', fontSize: 8, fontWeight: '800', marginBottom: 5 },
  weekRunCard: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#111C21', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  weekRunCardActive: { backgroundColor: colors.accent, borderColor: 'rgba(255,255,255,0.45)', shadowColor: '#B6FF2E', shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  weekRunDistance: { color: '#DDE8EB', fontSize: 12, fontWeight: '900' },
  weekRunDistanceActive: { color: '#071419' },
  weekRunKmLabel: { color: '#82949B', fontSize: 7, fontWeight: '900', marginTop: 2 },
  weekRunKmLabelActive: { color: '#071419' },
  dayLabel: { color: '#82949B', fontSize: 8, fontWeight: '900', marginTop: 7 },
  activeDay: { color: '#071419' },
  calendarNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calendarNavButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  calendarNavText: { color: '#FFFFFF', fontSize: 23, lineHeight: 25, fontWeight: '900' },
  calendarPanel: { borderRadius: 22, padding: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' },
  calendarMonthRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  calendarMonthTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  calendarLegend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calendarLegendDot: { width: 8, height: 8, borderRadius: 4 },
  calendarLegendText: { color: '#AFC1C8', fontSize: 8, fontWeight: '900' },
  calendarWeekHeader: { flexDirection: 'row', marginBottom: 6 },
  calendarWeekLabel: { flex: 1, textAlign: 'center', color: '#82949B', fontSize: 9, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  calendarDay: { width: '13.15%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 5, paddingBottom: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  calendarDayMuted: { opacity: 0.36 },
  calendarDayToday: { borderColor: 'rgba(255,255,255,0.46)' },
  calendarDaySelected: { borderColor: colors.accent, borderWidth: 2, shadowColor: '#B6FF2E', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  calendarDayRun: { backgroundColor: 'rgba(182,255,46,0.17)', borderColor: 'rgba(182,255,46,0.46)' },
  calendarDayEvent: { borderColor: 'rgba(70,199,255,0.55)' },
  calendarDayText: { color: '#DDE8EB', fontSize: 12, fontWeight: '900' },
  calendarDayTextMuted: { color: '#82949B' },
  calendarDayTextActive: { color: '#FFFFFF' },
  calendarDayDots: { minHeight: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 4 },
  calendarMarkerDot: { width: 5, height: 5, borderRadius: 3 },
  calendarRunDot: { backgroundColor: colors.accent },
  calendarEventDot: { backgroundColor: '#46C7FF' },
  calendarInlineDetail: { marginTop: 12, gap: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  calendarInlineHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  calendarInlineTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginTop: 3 },
  calendarInlineStats: { alignItems: 'flex-end', gap: 4 },
  calendarInlineStat: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  calendarInlineEmpty: { minHeight: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 18, padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  calendarDetailSection: { gap: 10 },
  calendarDetailSectionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  calendarEventRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, padding: 10, backgroundColor: 'rgba(70,199,255,0.09)', borderWidth: 1, borderColor: 'rgba(70,199,255,0.2)' },
  calendarEventImage: { width: 70, height: 72, borderRadius: 13, backgroundColor: '#10262D' },
  weeklyDetailCard: { width: '100%', maxWidth: 390, maxHeight: '82%', borderRadius: 22, padding: 16, backgroundColor: '#0A1D22', borderWidth: 1, borderColor: 'rgba(220,244,248,0.24)' },
  weeklyDetailStats: { minHeight: 74, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 14, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.07)' },
  weeklyRunList: { marginTop: 14 },
  weeklyRunListContent: { paddingBottom: 4, gap: 10 },
  weeklyRunCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, padding: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  weeklyRunImage: { width: 72, height: 84, borderRadius: 13, backgroundColor: '#10262D' },
  weeklyRunImageFallback: { width: 72, height: 84, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.12)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.32)' },
  weeklyRunPin: { color: colors.accent, fontSize: 24, fontWeight: '900' },
  weeklyRunBody: { flex: 1, minWidth: 0 },
  weeklyRunPlace: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  weeklyRunMeta: { color: '#9FB2B9', fontSize: 9, fontWeight: '800', marginTop: 4 },
  weeklyRunMetricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  weeklyRunMetric: { color: '#102014', fontSize: 9, fontWeight: '900', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.accent },
  weeklyRunTime: { color: '#C7D7DD', fontSize: 9, fontWeight: '800', marginTop: 9 },
  weeklyEmptyRun: { minHeight: 124, alignItems: 'center', justifyContent: 'center', borderRadius: 18, padding: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  registeredClubCard: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, padding: 11, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.32)', marginBottom: 10 },
  registeredClubCardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  registeredClubImage: { width: 92, height: 92, borderRadius: 13 },
  registeredClubCopy: { flex: 1, minWidth: 0, paddingRight: 58 },
  registeredClubCity: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  registeredClubName: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 4 },
  registeredClubMeta: { color: '#C7D7DD', fontSize: 9, fontWeight: '800', marginTop: 6 },
  registeredClubContact: { color: '#94AAB1', fontSize: 9, fontWeight: '700', marginTop: 5 },
  registeredClubBadge: { position: 'absolute', right: 11, top: 11, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(168,255,24,0.14)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.38)' },
  registeredClubBadgeText: { color: colors.accent, fontSize: 7, fontWeight: '900' },
  challengeCard: { minHeight: 128, flexDirection: 'row', borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', marginBottom: 10 },
  challengeCardPressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  challengeImage: { width: 94, height: '100%', backgroundColor: '#10262D' },
  challengeMain: { flex: 1, padding: 12 },
  challengeTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  challengeTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  challengeOrg: { color: '#9FB2B9', fontSize: 9, fontWeight: '700', marginTop: 3 },
  rankBadge: { width: 44, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.12)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.32)' },
  rankValue: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  rankLabel: { color: '#B9C9CE', fontSize: 7, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 16, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 4, backgroundColor: colors.accent },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  progressText: { color: '#B9C9CE', fontSize: 8, fontWeight: '800' },
  continueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 8 },
  continueText: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  continueArrow: { color: colors.accent, fontSize: 16, lineHeight: 16 },
  profileEventCard: { minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 22, padding: 10, marginBottom: 9, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  profileEventImage: { width: 76, height: 82, borderRadius: 11, backgroundColor: '#10262D' },
  profileEventCopy: { flex: 1, minWidth: 0 },
  profileEventDate: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  profileEventTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginTop: 4 },
  profileEventClub: { color: '#B5C8CE', fontSize: 9, fontWeight: '800', marginTop: 3 },
  profileEventMeta: { color: '#8FA3AA', fontSize: 8, fontWeight: '700', marginTop: 5 },
  profileEventState: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: 'rgba(57,255,136,0.12)', borderWidth: 1, borderColor: 'rgba(57,255,136,0.3)' },
  profileEventStateText: { color: colors.accent, fontSize: 6, fontWeight: '900' },
  emptyState: { minHeight: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  emptyTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  emptyText: { color: '#9FB2B9', fontSize: 10, fontWeight: '700', marginTop: 5 },
  achievementRow: { gap: 12, paddingRight: 16 },
  achievementCard: { width: 168, minHeight: 184, borderRadius: 20, padding: 13, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.34)' },
  achievementGlow: { position: 'absolute', right: -24, top: -28, width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(168,255,24,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  achievementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  achievementIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,255,24,0.15)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.5)' },
  achievementTrophy: { position: 'absolute', top: 5, right: 6, fontSize: 13 },
  achievementIconText: { color: colors.accent, fontSize: 16, fontWeight: '900', marginTop: 8 },
  achievementUnlockedPill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  achievementUnlockedText: { color: '#DDF9C9', fontSize: 7, fontWeight: '900' },
  achievementTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginTop: 15 },
  achievementMeta: { color: '#B7C9CF', fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 6, minHeight: 28 },
  achievementFooterLine: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 14 },
  achievementFooterFill: { width: '100%', height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  achievementRewardText: { color: colors.accent, fontSize: 9, fontWeight: '900', marginTop: 10 },
  galleryCoverflow: { minHeight: 258, paddingVertical: 14, overflow: 'hidden' },
  gallerySwipeTrack: { gap: 14, paddingHorizontal: 92, alignItems: 'center' },
  galleryCoverCard: { width: 156, height: 190, borderRadius: 24, overflow: 'hidden', backgroundColor: '#10262D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 9 }, elevation: 5, transform: [{ scale: 0.9 }] },
  galleryCoverCardActive: { borderColor: 'rgba(182,255,46,0.7)', shadowColor: '#B6FF2E', shadowOpacity: 0.28, shadowRadius: 16, transform: [{ scale: 1 }] },
  galleryImage: { width: '100%', height: '100%' },
  galleryGlassLabel: { position: 'absolute', left: 10, right: 10, bottom: 10, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,11,16,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  galleryGlassLabelText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  galleryDots: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 },
  galleryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.26)' },
  galleryDotActive: { width: 18, backgroundColor: colors.accent },
  galleryEmptyCard: { minHeight: 134, alignItems: 'center', justifyContent: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 16 },
  galleryAddButton: { height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 14, backgroundColor: colors.accent },
  galleryAddButtonText: { color: '#102014', fontSize: 12, fontWeight: '900' },
  galleryModalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.72)' },
  galleryPreviewCard: { width: '100%', maxWidth: 390, borderRadius: 26, overflow: 'hidden', padding: 12, backgroundColor: '#0A1D22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  galleryPreviewImage: { width: '100%', height: 420, borderRadius: 20, backgroundColor: '#10262D' },
  galleryDeleteButton: { height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'rgba(255,73,108,0.14)', borderWidth: 1, borderColor: 'rgba(255,73,108,0.45)' },
  galleryDeleteButtonText: { color: '#FF8BA3', fontSize: 12, fontWeight: '900' },
  textAction: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  peopleRow: { gap: 12, paddingRight: 16 },
  personItem: { width: 64, alignItems: 'center' },
  personAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#10262D', borderWidth: 2, borderColor: 'rgba(182,255,46,0.62)' },
  personName: { color: '#D9E5E9', fontSize: 9, fontWeight: '800', marginTop: 6, maxWidth: 64 },
  modalRoot: { flex: 1, backgroundColor: '#061016' },
  modalHeader: { minHeight: 76, paddingTop: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(18,31,39,0.42)' },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  backText: { color: '#FFFFFF', fontSize: 34, lineHeight: 36, fontWeight: '300' },
  modalTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  modalSubtitle: { color: '#8FA2A9', fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  headerSpacer: { width: 42 },
  createGroupIconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  createGroupIconText: { color: '#102014', fontSize: 24, lineHeight: 26, fontWeight: '900' },
  segment: { flexDirection: 'row', margin: 14, borderRadius: 12, padding: 3, backgroundColor: 'rgba(255,255,255,0.07)' },
  segmentButton: { flex: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  activeSegment: { backgroundColor: 'rgba(182,255,46,0.16)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.28)' },
  segmentText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  listContent: { paddingHorizontal: 14, paddingBottom: 30 },
  clubDetailContent: { padding: 16, paddingBottom: 36 },
  clubDetailHero: { width: '100%', height: 210, borderRadius: 18, backgroundColor: '#10262D' },
  clubDetailCity: { color: colors.accent, fontSize: 10, fontWeight: '900', marginTop: 17 },
  clubDetailName: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 5 },
  clubDetailDescription: { color: '#C8D8DE', fontSize: 12, lineHeight: 19, fontWeight: '700', marginTop: 10 },
  clubDetailStats: { minHeight: 78, flexDirection: 'row', alignItems: 'center', marginTop: 17, borderRadius: 16, backgroundColor: 'rgba(10,29,34,0.9)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.2)' },
  clubDetailStat: { flex: 1, alignItems: 'center' },
  clubDetailValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  clubDetailLabel: { color: '#AFC1C8', fontSize: 8, fontWeight: '800', marginTop: 5 },
  clubDetailDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.14)' },
  clubDetailSection: { marginTop: 22 },
  clubDetailSectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginBottom: 10 },
  clubDetailContact: { color: '#EAF5F7', fontSize: 12, lineHeight: 18, fontWeight: '800', borderRadius: 14, padding: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  clubDetailEventRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, padding: 10, marginBottom: 9, backgroundColor: 'rgba(10,29,34,0.9)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.18)' },
  clubDetailEventImage: { width: 66, height: 66, borderRadius: 11, backgroundColor: '#10262D' },
  clubDetailEventDate: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  clubDetailEventTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', marginTop: 4 },
  clubDetailEventMeta: { color: '#AFC1C8', fontSize: 9, fontWeight: '700', marginTop: 4 },
  clubDetailRegisterButton: { minWidth: 86, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.accent },
  clubDetailRegisterText: { color: '#102014', fontSize: 9, fontWeight: '900' },
  personRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  rowAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#10262D' },
  rowName: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  rowMeta: { color: '#8FA2A9', fontSize: 9, fontWeight: '700', marginTop: 3 },
  chevron: { color: '#8FA2A9', fontSize: 26 },
  profileModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.66)' },
  profileModal: { width: '100%', maxWidth: 360, minHeight: 360, alignItems: 'center', borderRadius: 18, padding: 22, backgroundColor: '#0A1D22', borderWidth: 1, borderColor: 'rgba(220,244,248,0.24)' },
  modalClose: { position: 'absolute', right: 12, top: 12, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#B9C9CE', fontSize: 28 },
  largeAvatar: { width: 94, height: 94, borderRadius: 47, borderWidth: 3, borderColor: colors.accent, backgroundColor: '#10262D' },
  largeName: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 14 },
  friendState: { color: colors.accent, fontSize: 10, fontWeight: '900', marginTop: 5 },
  personStats: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', marginTop: 24 },
  personStatValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  personStatLabel: { color: '#8FA2A9', fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  messageButton: { width: '100%', height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, marginTop: 24 },
  messageButtonText: { color: '#102014', fontSize: 12, fontWeight: '900' },
  friendRequestedButton: { opacity: 0.64, backgroundColor: 'rgba(255,255,255,0.12)' },
  searchBox: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, borderRadius: 18, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.11)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  searchIcon: { color: '#AFC1C8', fontSize: 18 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '700', paddingVertical: 0 },
  conversationRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, paddingHorizontal: 10, marginBottom: 9, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' },
  conversationAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#10262D' },
  messagePreview: { color: '#92A5AC', fontSize: 10, fontWeight: '700', marginTop: 4 },
  messageSide: { alignItems: 'flex-end', gap: 6 },
  messageTime: { color: '#82949B', fontSize: 8, fontWeight: '700' },
  unreadBadge: { minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  unreadText: { color: '#102014', fontSize: 8, fontWeight: '900' },
  notificationCard: { minHeight: 44, justifyContent: 'center', borderRadius: 18, paddingHorizontal: 13, marginBottom: 8, backgroundColor: 'rgba(182,255,46,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: colors.accent, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  notificationText: { color: '#DFFFD1', fontSize: 10, fontWeight: '800' },
  createdGroupCard: { borderRadius: 20, padding: 10, marginBottom: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  createdGroupMain: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 },
  createdGroupAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  createdGroupAvatarText: { color: colors.accent, fontSize: 16, fontWeight: '900' },
  pendingInviteList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 10 },
  acceptInviteButton: { minHeight: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  acceptInviteText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  emptyInbox: { alignItems: 'center', marginTop: 80 },
  chatHeader: { minHeight: 78, paddingTop: 18, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(18,31,39,0.42)' },
  chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10262D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  onlineText: { color: colors.accent, fontSize: 8, fontWeight: '800', marginTop: 3 },
  messages: { flex: 1 },
  messagesContent: { padding: 14, gap: 9, justifyContent: 'flex-end', flexGrow: 1 },
  bubbleWrap: { alignSelf: 'flex-start', maxWidth: '78%' },
  myBubbleWrap: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 20, borderBottomLeftRadius: 7, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  myBubble: { borderBottomLeftRadius: 20, borderBottomRightRadius: 7, backgroundColor: 'rgba(182,255,46,0.92)', borderColor: 'rgba(255,255,255,0.46)' },
  bubbleText: { color: '#FFFFFF', fontSize: 12, lineHeight: 17 },
  myBubbleText: { color: '#102014', fontWeight: '700' },
  bubbleTime: { color: '#758990', fontSize: 7, marginTop: 3 },
  composer: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 18 : 10, overflow: 'hidden', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(18,31,39,0.42)' },
  messageInput: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 15, color: '#FFFFFF', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' },
  sendDisabled: { opacity: 0.35 },
  sendText: { color: '#102014', fontSize: 20, fontWeight: '900' },
  detailBackdropRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.62)' },
  savedDetailCard: { width: '100%', maxWidth: 390, borderRadius: 22, padding: 16, backgroundColor: '#0A1D22', borderWidth: 1, borderColor: 'rgba(220,244,248,0.24)' },
  savedDetailClose: { position: 'absolute', right: 10, top: 10, zIndex: 3, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#132227', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  savedDetailCloseText: { color: '#FFFFFF', fontSize: 24, lineHeight: 26, fontWeight: '700' },
  savedDetailImage: { width: '100%', height: 145, borderRadius: 16, backgroundColor: '#10262D' },
  savedDetailKicker: { color: colors.accent, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: 14 },
  savedDetailTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 5 },
  savedDetailStats: { minHeight: 74, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 14, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.07)' },
  savedDetailValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  savedDetailLabel: { color: '#9FB2B9', fontSize: 8, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  savedDetailBody: { color: '#C7D7DD', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 14 },
  savedEventMeta: { gap: 6, marginTop: 12 },
  savedEventMetaText: { color: '#C7D7DD', fontSize: 11, fontWeight: '800' },
  savedAdvice: { color: '#9FB2B9', fontSize: 10, lineHeight: 16, fontWeight: '700', marginTop: 7 },
  groupChatButton: { height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18, backgroundColor: colors.accent },
  startChallengeRunButton: { height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18, backgroundColor: colors.accent },
  startChallengeRunButtonText: { color: '#102014', fontSize: 13, fontWeight: '900' },
  groupChatSecondaryButton: { height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 9, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  groupChatSecondaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  groupChatButtonText: { color: '#102014', fontSize: 13, fontWeight: '900' },
  registrationSuccessCard: { width: '100%', maxWidth: 330, alignItems: 'center', borderRadius: 22, padding: 20, backgroundColor: '#0A1D22', borderWidth: 1, borderColor: 'rgba(220,244,248,0.24)' },
  registrationSuccessMark: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  registrationSuccessMarkText: { color: '#102014', fontSize: 27, fontWeight: '900' },
  registrationSuccessTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '900', textAlign: 'center', marginTop: 15 },
  registrationSuccessEvent: { color: colors.accent, fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 9 },
  registrationSuccessButton: { height: 44, alignSelf: 'stretch', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 18, backgroundColor: colors.accent },
  registrationSuccessButtonText: { color: '#102014', fontSize: 12, fontWeight: '900' },
  registrationPickerCard: { width: '100%', maxWidth: 390, maxHeight: '88%', borderRadius: 22, padding: 16, backgroundColor: '#0A1D22', borderWidth: 1, borderColor: 'rgba(220,244,248,0.24)' },
  registrationPickerClose: { position: 'absolute', right: 10, top: 10, zIndex: 3, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#132227', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  registrationPickerCloseText: { color: '#FFFFFF', fontSize: 23, lineHeight: 25, fontWeight: '800' },
  registrationStepText: { color: colors.accent, fontSize: 14, fontWeight: '900', marginRight: 36 },
  registrationProgressRow: { flexDirection: 'row', gap: 4, marginTop: 10 },
  registrationProgressActive: { flex: 1, height: 4, borderRadius: 3, backgroundColor: colors.accent },
  registrationProgressRest: { flex: 1, height: 4, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)' },
  registrationModeRow: { flexDirection: 'row', gap: 18, marginTop: 20, marginBottom: 14 },
  registrationModeItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  registrationRadio: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  registrationRadioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  registrationRadioDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#102014' },
  registrationModeText: { color: '#DCEAEC', fontSize: 12, fontWeight: '800' },
  registrationTypeGrid: { gap: 12, paddingBottom: 4 },
  registrationTypeCard: { borderRadius: 18, padding: 14, backgroundColor: 'rgba(10,29,34,0.94)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.18)' },
  registrationTypeCardActive: { borderColor: 'rgba(168,255,24,0.62)', backgroundColor: 'rgba(17,42,38,0.98)' },
  registrationTypeIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  registrationTypeIconText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  registrationTypeTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900', marginBottom: 8 },
  registrationTypeMeta: { color: '#B7C9CF', fontSize: 11, fontWeight: '800', marginTop: 2 },
  registrationFeatureLine: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingVertical: 7, marginTop: 10 },
  registrationFeatureText: { color: '#AFC1C8', fontSize: 11, fontWeight: '700' },
  registrationPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  registrationPriceLabel: { color: '#C7D7DD', fontSize: 11, fontWeight: '900' },
  registrationPrice: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  registrationPayButton: { height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  registrationPayButtonActive: { backgroundColor: colors.accent, borderColor: 'rgba(255,255,255,0.42)' },
  registrationPayText: { color: '#9FB2B9', fontSize: 12, fontWeight: '900' },
  registrationPayTextActive: { color: '#102014' },
  qpayCard: { width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: 24, padding: 20, backgroundColor: '#0A1D22', borderWidth: 1, borderColor: 'rgba(220,244,248,0.24)' },
  qpayBrand: { color: colors.accent, fontSize: 24, fontWeight: '900', letterSpacing: 0 },
  qpayTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 8 },
  qpaySubtitle: { color: '#AFC1C8', fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  qpayQr: { width: 158, height: 158, flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 10, borderRadius: 18, marginTop: 18, backgroundColor: '#FFFFFF' },
  qpayQrCell: { width: 16, height: 16, borderRadius: 3, backgroundColor: '#FFFFFF' },
  qpayQrCellDark: { backgroundColor: '#0A1D22' },
  qpayInfoBox: { alignSelf: 'stretch', gap: 11, borderRadius: 16, padding: 13, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  qpayInfoLabel: { color: '#8FA2A9', fontSize: 9, fontWeight: '800' },
  qpayInfoValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', marginTop: 4 },
  qpayAmount: { color: colors.accent, fontSize: 18, fontWeight: '900', marginTop: 4 },
  qpayHint: { color: '#AFC1C8', fontSize: 10, lineHeight: 15, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  qpayPrimaryButton: { height: 46, alignSelf: 'stretch', borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 16, backgroundColor: colors.accent },
  qpayPrimaryText: { color: '#102014', fontSize: 13, fontWeight: '900' },
  qpaySecondaryButton: { height: 42, alignSelf: 'stretch', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  qpaySecondaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  createGroupModal: { width: '100%', maxWidth: 390, maxHeight: '82%', borderRadius: 24, padding: 18, overflow: 'hidden', backgroundColor: 'rgba(18,31,39,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#000000', shadowOpacity: 0.36, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 8 },
  createGroupTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginRight: 34 },
  groupNameInput: { height: 46, borderRadius: 18, paddingHorizontal: 14, marginTop: 16, color: '#FFFFFF', fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  inviteList: { marginTop: 12 },
  inviteListContent: { paddingBottom: 4 },
  inviteRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingHorizontal: 9, marginBottom: 7, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  inviteRowSelected: { backgroundColor: 'rgba(182,255,46,0.13)', borderColor: 'rgba(255,255,255,0.28)' },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', backgroundColor: 'rgba(255,255,255,0.07)' },
  checkCircleSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { color: '#102014', fontSize: 12, fontWeight: '900' },
  cancelSavedButton: { height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18, backgroundColor: 'rgba(255,73,108,0.14)', borderWidth: 1, borderColor: 'rgba(255,73,108,0.42)' },
  cancelSavedButtonText: { color: '#FF8EA6', fontSize: 13, fontWeight: '900' },
  groupSender: { color: colors.accent, fontSize: 9, fontWeight: '900', marginBottom: 4, marginLeft: 4 },
  systemSender: { color: '#8FA2A9' },
  friendProfileContent: { padding: 16, paddingBottom: 38 },
  friendHero: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  friendHeroAvatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.accent, backgroundColor: '#10262D' },
  friendHeroName: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  friendHeroHandle: { color: '#9FB2B9', fontSize: 10, fontWeight: '800', marginTop: 4 },
  friendHeroState: { color: colors.accent, fontSize: 10, fontWeight: '900', marginTop: 8 },
  friendStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  friendStatCard: { width: '48%', minHeight: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(10,29,34,0.92)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.16)' },
  friendSection: { marginTop: 22 },
  friendSectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  friendChallengeRow: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, padding: 10, marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  friendChallengeImage: { width: 74, height: 74, borderRadius: 13, backgroundColor: '#10262D' },
  friendItemTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  friendItemMeta: { color: '#9FB2B9', fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 4 },
  friendEventRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, padding: 10, marginBottom: 9, backgroundColor: 'rgba(10,29,34,0.92)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.16)' },
  friendEventImage: { width: 62, height: 62, borderRadius: 12, backgroundColor: '#10262D' },
  friendAchievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  friendAchievementCard: { width: '48%', minHeight: 128, borderRadius: 17, padding: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  friendAchievementIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.18)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.32)' },
  friendAchievementCode: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  friendAchievementTitle: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '900', marginTop: 10 },
  marathonRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 16, padding: 12, marginBottom: 9, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  marathonResult: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  friendPhotoRow: { gap: 10, paddingRight: 16 },
  friendPhoto: { width: 132, height: 132, borderRadius: 16, backgroundColor: '#10262D' },
  systemBubble: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' }
});
