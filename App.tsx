import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Challenge, MediaItem, Post, Runner, TabKey } from './src/native/types';
import { CHALLENGES, INITIAL_POSTS, RUNNERS } from './src/native/data';
import { RUN_ROUTES, type Point, type RouteOption } from './src/native/routes';
import { DEFAULT_CLUB_EVENTS, DEFAULT_RUNNING_CLUBS, type ClubEvent, type RunningClub } from './src/native/clubs';
import { Shell } from './src/native/components/Shell';
import { HomeScreen } from './src/native/screens/HomeScreen';
import { RunScreen } from './src/native/screens/RunScreen';
import { ExploreScreen } from './src/native/screens/ExploreScreen';
import { ProfileScreen } from './src/native/screens/ProfileScreen';
import { LoginScreen } from './src/native/screens/LoginScreen';
import { compactGalleryPhotos, isStableGalleryUri } from './src/native/mediaUtils';
import { ChallengeModal } from './src/native/components/ChallengeModal';
import { PostComposer } from './src/native/components/PostComposer';
import { AdminDashboard } from './src/admin/AdminDashboard';
import { ClubAdminDashboard } from './src/club-admin/ClubAdminDashboard';
import { getAdminChallenges } from './src/lib/adminChallengeContent';
import { getLocalClubContentOverrides, getLocalClubEvents, getLocalDeletedClubEventIds } from './src/lib/clubAdminApi';
import { getAdminMarathonChallenges } from './src/lib/marathonAdminContent';
import { supabase } from './src/lib/supabase';
import {
  createPost,
  fetchChallenges,
  fetchClubEvents,
  fetchJoinedClubEventIds,
  fetchJoinedChallengeIds,
  fetchPosts,
  fetchRunningClubs,
  fetchRoutes,
  ensureUserProfile,
  joinChallenge,
  leaveChallenge,
  clearActiveRun,
  saveRun,
  updateActiveRun,
  setClubEventParticipation,
  setClubMembership
} from './src/lib/runboostApi';
import type { RunInput } from './src/lib/runboostApi';
import { enqueuePendingRun, getPendingRunCount, syncPendingRuns } from './src/lib/pendingRunSync';

type Account = {
  id: string;
  name: string;
  email: string;
};

type ComposerDraft = {
  title?: string;
  description?: string;
  media?: MediaItem[];
  runMapMedia?: MediaItem;
};

type ProfileGalleryPhoto = { id: string; uri: string };
type ChallengeNotice = { title: string; message: string };

const localJoinedClubKey = 'runboost.joinedClubId';
const profileGalleryKey = 'runboost.profileGallery';

function isSingleRunChallenge(challenge: Challenge) {
  return challenge.completionMode === 'single_run' || (!challenge.completionMode && challenge.group === '5k');
}

function getLocalJoinedClubId() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(localJoinedClubKey);
}

function saveLocalJoinedClubId(clubId: string | null) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (clubId) window.localStorage.setItem(localJoinedClubKey, clubId);
  else window.localStorage.removeItem(localJoinedClubKey);
}

function addMediaToLocalProfileGallery(media: MediaItem[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const imageMedia = media.filter(item => item.type === 'image' && isStableGalleryUri(item.uri));
  if (!imageMedia.length) return;
  try {
    const raw = window.localStorage.getItem(profileGalleryKey);
    const parsed = raw ? JSON.parse(raw) as ProfileGalleryPhoto[] : [];
    const current = Array.isArray(parsed) ? compactGalleryPhotos(parsed) : [];
    const existingUris = new Set(current.map(photo => photo.uri));
    const nextPhotos = imageMedia
      .filter(item => !existingUris.has(item.uri))
      .map(item => ({ id: `post-gallery-${item.id}-${Date.now()}`, uri: item.uri }));
    if (!nextPhotos.length) return;
    window.localStorage.setItem(profileGalleryKey, JSON.stringify(compactGalleryPhotos([...nextPhotos, ...current])));
  } catch {
    // Profile gallery is local-only; post saving should not fail if gallery sync cannot run.
  }
}

function getInitialClubs() {
  const overrides = getLocalClubContentOverrides();
  const joinedClubId = getLocalJoinedClubId();
  return DEFAULT_RUNNING_CLUBS.map(club => {
    const local = overrides.find(item => item.clubId === club.id);
    const next = local ? {
      ...club,
      image: local.imageUrl,
      galleryImages: local.galleryImages.length ? local.galleryImages : club.galleryImages,
      socialLinks: local.socialLinks ?? club.socialLinks
    } : club;
    return { ...next, joined: joinedClubId === club.id };
  });
}

function getInitialClubEvents() {
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
  const localIds = new Set(localEvents.map(event => event.id));
  return [...localEvents, ...DEFAULT_CLUB_EVENTS.filter(event => !localIds.has(event.id) && !deletedEventIds.has(event.id))];
}

function getInitialChallenges() {
  const adminChallenges = getAdminChallenges();
  const adminIds = new Set(adminChallenges.map(challenge => challenge.id));
  return [...adminChallenges, ...getAdminMarathonChallenges(), ...CHALLENGES.filter(challenge => !adminIds.has(challenge.id))];
}

export default function App() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.startsWith('/club-admin')) {
    return <ClubAdminDashboard />;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return <AdminDashboard />;
  }

  return <MobileApp />;
}

function MobileApp() {
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [challenges, setChallenges] = useState<Challenge[]>(getInitialChallenges);
  const [routes, setRoutes] = useState<RouteOption[]>(RUN_ROUTES);
  const [clubs, setClubs] = useState<RunningClub[]>(getInitialClubs);
  const [clubEvents, setClubEvents] = useState(getInitialClubEvents);
  const [joinedClubEventIds, setJoinedClubEventIds] = useState<string[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [selectedChallengeProgressKm, setSelectedChallengeProgressKm] = useState(0);
  const [joinedChallengeIds, setJoinedChallengeIds] = useState<string[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [activeChallengeProgressKm, setActiveChallengeProgressKm] = useState(0);
  const [activeClubEventId, setActiveClubEventId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState<ComposerDraft | null>(null);
  const [profileGalleryAdditions, setProfileGalleryAdditions] = useState<MediaItem[]>([]);
  const [profileRunAdditions, setProfileRunAdditions] = useState<RunInput[]>([]);
  const [profileDashboardRefreshKey, setProfileDashboardRefreshKey] = useState(0);
  const pendingRunSyncing = useRef(false);
  const [followedRunners, setFollowedRunners] = useState<string[]>([]);
  const [hiddenRunnerIds, setHiddenRunnerIds] = useState<string[]>([]);
  const [challengeNotice, setChallengeNotice] = useState<ChallengeNotice | null>(null);

  useEffect(() => {
    const applySession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!session?.user) {
        setSignedIn(false);
        setCurrentUser(null);
        return;
      }

      setCurrentUser({
        id: session.user.id,
        name: typeof session.user.user_metadata.name === 'string' ? session.user.user_metadata.name : 'Гүйгч',
        email: session.user.email ?? ''
      });
      setSignedIn(true);
    };

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
      setAuthReady(true);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.id === 'demo-runner') return;
    let cancelled = false;

    Promise.allSettled([
      fetchPosts(currentUser.id),
      fetchChallenges(),
      fetchRoutes(),
      fetchJoinedChallengeIds(currentUser.id),
      fetchRunningClubs(currentUser.id),
      fetchClubEvents(),
      fetchJoinedClubEventIds(currentUser.id)
    ]).then(([postResult, challengeResult, routeResult, membershipResult, clubResult, eventResult, clubEventMembershipResult]) => {
      if (cancelled) return;
      if (postResult.status === 'fulfilled') setPosts(postResult.value);
      if (challengeResult.status === 'fulfilled' && challengeResult.value.length) setChallenges(challengeResult.value);
      if (routeResult.status === 'fulfilled' && routeResult.value.length) setRoutes(routeResult.value);
      if (membershipResult.status === 'fulfilled') setJoinedChallengeIds(membershipResult.value);
      if (clubResult.status === 'fulfilled' && clubResult.value.length) setClubs(clubResult.value);
      if (eventResult.status === 'fulfilled' && eventResult.value.length) setClubEvents(eventResult.value);
      if (clubEventMembershipResult.status === 'fulfilled') setJoinedClubEventIds(clubEventMembershipResult.value);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const joinedChallenges = useMemo(
    () => challenges.filter(challenge => joinedChallengeIds.includes(challenge.id)),
    [challenges, joinedChallengeIds]
  );

  const refreshCurrentUserData = async () => {
    if (!currentUser || currentUser.id === 'demo-runner') return;
    const [
      postResult,
      challengeResult,
      routeResult,
      membershipResult,
      clubResult,
      eventResult,
      clubEventMembershipResult
    ] = await Promise.allSettled([
      fetchPosts(currentUser.id),
      fetchChallenges(),
      fetchRoutes(),
      fetchJoinedChallengeIds(currentUser.id),
      fetchRunningClubs(currentUser.id),
      fetchClubEvents(),
      fetchJoinedClubEventIds(currentUser.id)
    ]);
    if (postResult.status === 'fulfilled') setPosts(postResult.value);
    if (challengeResult.status === 'fulfilled' && challengeResult.value.length) setChallenges(challengeResult.value);
    if (routeResult.status === 'fulfilled' && routeResult.value.length) setRoutes(routeResult.value);
    if (membershipResult.status === 'fulfilled') setJoinedChallengeIds(membershipResult.value);
    if (clubResult.status === 'fulfilled' && clubResult.value.length) setClubs(clubResult.value);
    if (eventResult.status === 'fulfilled' && eventResult.value.length) setClubEvents(eventResult.value);
    if (clubEventMembershipResult.status === 'fulfilled') setJoinedClubEventIds(clubEventMembershipResult.value);
  };

  useEffect(() => {
    if (!signedIn || !currentUser || currentUser.id === 'demo-runner') return;

    const syncQueuedRuns = async (showSyncedNotice = false) => {
      if (pendingRunSyncing.current) return;
      pendingRunSyncing.current = true;
      try {
        const syncedCount = await syncPendingRuns(saveRun, currentUser.id);
        if (syncedCount > 0) {
          setProfileDashboardRefreshKey(current => current + 1);
          await refreshCurrentUserData();
          if (showSyncedNotice) {
            Alert.alert('Гүйлт sync хийгдлээ', `${syncedCount} хадгалагдсан гүйлт Supabase руу илгээгдлээ.`);
          }
        }
      } finally {
        pendingRunSyncing.current = false;
      }
    };

    void syncQueuedRuns();
    const interval = setInterval(() => {
      void syncQueuedRuns(true);
    }, 20000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void syncQueuedRuns(true);
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [currentUser, signedIn]);

  const getJoinedIdsAfterRegister = (ids: string[], challenge: Challenge) => {
    const withoutSameGroup = ids.filter(id => {
      const existing = challenges.find(item => item.id === id);
      return existing?.group !== challenge.group;
    });
    return withoutSameGroup.includes(challenge.id) ? withoutSameGroup : [...withoutSameGroup, challenge.id];
  };

  const showChallengeRegistrationSuccess = () => {
    setChallengeNotice({
      title: 'Та амжилттай бүртгүүллээ',
      message: 'Гүйлтээ профайл хуудасны чэллэнжээс эхлүүлнэ үү.'
    });
  };

  const registerChallenge = async (challenge: Challenge) => {
    const previousJoinedIds = joinedChallengeIds;
    setJoinedChallengeIds(current => getJoinedIdsAfterRegister(current, challenge));
    setSelectedChallenge(challenge);

    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await joinChallenge(currentUser.id, challenge);
      } catch (error) {
        setJoinedChallengeIds(previousJoinedIds);
        Alert.alert('Бүртгэж чадсангүй', error instanceof Error ? error.message : 'Supabase холболт болон интернэтээ шалгана уу.');
        return;
      }
    }
    setProfileDashboardRefreshKey(current => current + 1);
    void refreshCurrentUserData();
    showChallengeRegistrationSuccess();
  };

  const handleRegisterChallenge = (challenge: Challenge) => {
    if (joinedChallengeIds.includes(challenge.id)) {
      setSelectedChallenge(challenge);
      return;
    }

    const sameGroup = challenges.find(item =>
      joinedChallengeIds.includes(item.id) && item.group === challenge.group
    );

    if (sameGroup) {
      setChallengeNotice({
        title: 'Өөр чэллэнжид бүртгэлтэй байна',
        message: `Та “${sameGroup.title}” чэллэнжид бүртгэлтэй байна. Тухайн чэллэнжээ дуусгасны дараа “${challenge.title}”-д бүртгүүлнэ үү.`
      });
      return;
    }

    void registerChallenge(challenge);
  };

  const handleLeaveChallenge = async (challenge: Challenge) => {
    const previousJoinedIds = joinedChallengeIds;
    setJoinedChallengeIds(current => current.filter(id => id !== challenge.id));
    if (activeChallengeId === challenge.id) {
      setActiveChallengeId(null);
      setActiveChallengeProgressKm(0);
      setActiveClubEventId(null);
    }
    setSelectedChallenge(null);
    setSelectedChallengeProgressKm(0);

    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await leaveChallenge(currentUser.id, challenge.id);
      } catch (error) {
        setJoinedChallengeIds(previousJoinedIds);
        Alert.alert('Чэлленжээс гарч чадсангүй', error instanceof Error ? error.message : 'Интернэт холболтоо шалгана уу.');
        return;
      }
    }
    setProfileDashboardRefreshKey(current => current + 1);
    void refreshCurrentUserData();
  };

  const handleToggleClubMembership = async (club: RunningClub) => {
    const nextJoined = !club.joined;
    return updateClubMembership(club, nextJoined);
  };

  const updateClubMembership = async (club: RunningClub, nextJoined: boolean) => {
    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await setClubMembership(currentUser.id, club.id, nextJoined);
      } catch {
        Alert.alert('Клубын төлөв local горимд хадгалагдлаа', 'Supabase холболт амжилтгүй байсан тул энэ төхөөрөмж дээр түр хадгаллаа.');
      }
    }
    setClubs(current => current.map(item => {
      if (item.id === club.id) {
        return {
          ...item,
          joined: nextJoined,
          memberCount: Math.max(0, item.memberCount + (nextJoined ? 1 : -1))
        };
      }
      if (nextJoined && item.joined) {
        return { ...item, joined: false, memberCount: Math.max(0, item.memberCount - 1) };
      }
      return item;
    }));
    saveLocalJoinedClubId(nextJoined ? club.id : null);
    void refreshCurrentUserData();
    return true;
  };

  const handleToggleClubEventParticipation = async (event: ClubEvent) => {
    const participating = !joinedClubEventIds.includes(event.id);
    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await setClubEventParticipation(currentUser.id, event.id, participating);
      } catch {
        Alert.alert('Арга хэмжээний бүртгэл local горимд хадгалагдлаа', 'Supabase холболт амжилтгүй байсан тул энэ төхөөрөмж дээр түр хадгаллаа.');
      }
    }
    setJoinedClubEventIds(current => participating ? [...current, event.id] : current.filter(id => id !== event.id));
    setClubEvents(current => current.map(item => item.id === event.id ? {
      ...item,
      participantCount: Math.max(0, item.participantCount + (participating ? 1 : -1))
    } : item));
    void refreshCurrentUserData();
    return true;
  };

  const handleSavePost = async (title: string, description: string, media: MediaItem[]) => {
    const galleryMedia = media.filter(item => item.type === 'image');
    const addLocalPost = () => {
      setPosts(prev => [{
        id: `post-${Date.now()}`,
        userId: currentUser?.id,
        user: currentUser?.name ?? 'Төгөлдөр',
        isMe: true,
        title,
        description,
        media,
        time: 'Яг одоо',
        distanceKm: 0,
        duration: '00:00'
      }, ...prev]);
      addMediaToLocalProfileGallery(galleryMedia);
      setProfileGalleryAdditions(current => [...galleryMedia, ...current]);
      setComposerOpen(false);
      setComposerDraft(null);
      setActiveTab('home');
    };
    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await ensureUserProfile(currentUser.id, currentUser.name, currentUser.email);
        await createPost({ userId: currentUser.id, title, description, media });
        addMediaToLocalProfileGallery(galleryMedia);
        setProfileGalleryAdditions(current => [...galleryMedia, ...current]);
        setPosts(await fetchPosts(currentUser.id));
        setComposerOpen(false);
        setComposerDraft(null);
        setActiveTab('home');
        return;
      } catch (error) {
        console.error('createPost failed', error);
        addLocalPost();
        Alert.alert(
          'Нийтлэл local хадгалагдлаа',
          `Supabase руу илгээж чадсангүй: ${error instanceof Error ? error.message : 'хүснэгт, Storage болон интернэт холболтоо шалгана уу.'}`
        );
        return;
      }
    }

    addLocalPost();
  };

  const visibleRunners: Runner[] = RUNNERS.filter(runner => !hiddenRunnerIds.includes(runner.id));

  const signIn = (account: Account) => {
    setCurrentUser(account);
    setSignedIn(true);
    setProfileRunAdditions([]);
    setActiveTab('home');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSignedIn(false);
    setActiveTab('home');
    setJoinedChallengeIds([]);
    setJoinedClubEventIds([]);
    setActiveChallengeId(null);
    setActiveChallengeProgressKm(0);
    setActiveClubEventId(null);
    setSelectedChallenge(null);
    setProfileRunAdditions([]);
  };

  if (!authReady) {
    return <SafeAreaProvider />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!signedIn ? (
        <LoginScreen
          onLogin={async (email, password) => {
            const normalizedEmail = email.trim().toLowerCase();
            const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

            if (error || !data.user) {
              return { ok: false, message: 'Имэйл эсвэл нууц үг буруу байна.' };
            }

            const userName = typeof data.user.user_metadata.name === 'string' ? data.user.user_metadata.name : 'Гүйгч';
            try {
              await ensureUserProfile(data.user.id, userName, normalizedEmail);
            } catch {
              return { ok: false, message: 'Профайл бүртгэлийг баазад хадгалж чадсангүй.' };
            }
            signIn({ id: data.user.id, name: userName, email: normalizedEmail });
            return { ok: true };
          }}
          onRegister={async (name, email, password) => {
            const normalizedEmail = email.trim().toLowerCase();
            const normalizedName = name.trim();
            const { data, error } = await supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: { data: { name: normalizedName } }
            });

            if (error) {
              return { ok: false, message: error.message };
            }

            let user = data.user;
            if (!data.session) {
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password
              });
              if (signInError || !signInData.user) {
                return { ok: false, message: 'Бүртгэл үүссэн ч шууд нэвтэрч чадсангүй. Supabase Auth дээр Confirm email тохиргоог унтраана уу.' };
              }
              user = signInData.user;
            }

            if (!user) {
              return { ok: false, message: 'Бүртгэл үүсгэж чадсангүй.' };
            }

            try {
              await ensureUserProfile(user.id, normalizedName, normalizedEmail);
            } catch {
              return { ok: false, message: 'Бүртгэлийг баазад хадгалж чадсангүй.' };
            }
            signIn({ id: user.id, name: normalizedName || 'Гүйгч', email: normalizedEmail });
            return { ok: true };
          }}
        />
      ) : (
        <Shell
          activeTab={activeTab}
          onTabChange={tab => {
            if (tab === 'run' && Platform.OS !== 'web') {
              setSelectedRouteId(null);
              setActiveChallengeId(null);
              setActiveChallengeProgressKm(0);
              setActiveClubEventId(null);
            }
            setActiveTab(tab);
          }}
        >
          {activeTab === 'home' && (
            <HomeScreen
              posts={posts}
              currentUserId={currentUser?.id ?? null}
              challenges={challenges}
              routes={routes}
              clubs={clubs}
              clubEvents={clubEvents}
              joinedClubEventIds={joinedClubEventIds}
              runners={visibleRunners}
              followedRunnerIds={followedRunners}
              joinedChallengeIds={joinedChallengeIds}
              onOpenComposer={() => {
                setComposerDraft(null);
                setComposerOpen(true);
              }}
              onOpenChallenge={setSelectedChallenge}
              onRegisterChallenge={handleRegisterChallenge}
              onOpenRoute={routeId => {
                setSelectedRouteId(routeId);
                setActiveChallengeId(null);
                setActiveChallengeProgressKm(0);
                setActiveClubEventId(null);
                setActiveTab('run');
              }}
              onToggleClubMembership={handleToggleClubMembership}
              onToggleClubEventParticipation={handleToggleClubEventParticipation}
              onToggleFollow={runnerId => {
                setFollowedRunners(prev => (
                  prev.includes(runnerId) ? prev.filter(id => id !== runnerId) : [...prev, runnerId]
                ));
              }}
              onRemoveRunner={runnerId => setHiddenRunnerIds(prev => [...prev, runnerId])}
              onPostSocialChange={(postId, patch) => {
                setPosts(current => {
                  const target = current.find(post => post.id === postId);
                  return current.map(post => {
                    const isSameAuthorFollowUpdate = patch.isFollowing !== undefined && target?.userId && post.userId === target.userId;
                    return post.id === postId || isSameAuthorFollowUpdate ? { ...post, ...patch } : post;
                  });
                });
              }}
            />
          )}
          {activeTab === 'run' && (
            <RunScreen
              activeChallenge={challenges.find(challenge => challenge.id === activeChallengeId) ?? null}
              activeChallengeProgressKm={activeChallengeProgressKm}
              activeClubEvent={clubEvents.find(event => event.id === activeClubEventId) ?? null}
              routes={routes}
              selectedRouteId={selectedRouteId}
              onOpenComposer={draft => {
                setComposerDraft(draft ?? null);
                setComposerOpen(true);
              }}
              onLiveRunUpdate={async run => {
                if (!currentUser || currentUser.id === 'demo-runner') return;
                await updateActiveRun({ ...run, userId: currentUser.id });
              }}
              onLiveRunEnd={async () => {
                if (!currentUser || currentUser.id === 'demo-runner') return;
                await clearActiveRun(currentUser.id);
              }}
              onExitFinishedRun={() => {
                setSelectedRouteId(null);
                setActiveChallengeId(null);
                setActiveChallengeProgressKm(0);
                setActiveClubEventId(null);
                setActiveTab('home');
              }}
              onSaveRun={async (run: {
                routeId: string | null;
                challengeId: string | null;
                distanceKm: number;
                durationSeconds: number;
                calories: number;
                coordinates: Point[];
                startedAt: string;
                completedAt: string;
              }) => {
                if (!currentUser || currentUser.id === 'demo-runner') {
                  setActiveChallengeId(null);
                  setActiveChallengeProgressKm(0);
                  setActiveClubEventId(null);
                  return;
                }
                const runInput: RunInput = { ...run, userId: currentUser.id };
                try {
                  await saveRun(runInput);
                } catch (error) {
                  await enqueuePendingRun(runInput);
                  const pendingCount = await getPendingRunCount(currentUser.id);
                  Alert.alert(
                    'Гүйлт local хадгалагдлаа',
                    `Интернэтгүй байна. ${pendingCount} гүйлт хүлээгдэж байна, сүлжээ ормогц автоматаар Supabase руу илгээгдэнэ.`
                  );
                }
                setProfileRunAdditions(current => [runInput, ...current].slice(0, 20));
                setActiveChallengeId(null);
                setActiveChallengeProgressKm(0);
                setActiveClubEventId(null);
                setProfileDashboardRefreshKey(current => current + 1);
                await refreshCurrentUserData().catch(() => undefined);
              }}
            />
          )}
          {activeTab === 'explore' && (
            <ExploreScreen
              challenges={challenges}
              joinedChallengeIds={joinedChallengeIds}
              onOpenChallenge={setSelectedChallenge}
              onRegisterChallenge={handleRegisterChallenge}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen
              currentUserId={currentUser?.id ?? 'demo-runner'}
              currentUserName={currentUser?.name ?? 'Гүйгч'}
              posts={posts.filter(post => post.isMe)}
              joinedChallenges={joinedChallenges}
              joinedClub={clubs.find(club => club.joined) ?? null}
              clubEvents={clubEvents}
              joinedClubEvents={clubEvents.filter(event => joinedClubEventIds.includes(event.id))}
              routes={routes}
              galleryAdditions={profileGalleryAdditions}
              savedRunAdditions={profileRunAdditions}
              dashboardRefreshKey={profileDashboardRefreshKey}
              onOpenChallenge={(challenge, progressKm) => {
                setSelectedChallengeProgressKm(progressKm);
                setSelectedChallenge(challenge);
              }}
              onStartChallengeRun={(challenge, progressKm) => {
                setActiveChallengeId(challenge.id);
                setActiveChallengeProgressKm(progressKm);
                setActiveClubEventId(null);
                setSelectedRouteId(null);
                setActiveTab('run');
              }}
              onStartClubEventRun={event => {
                setActiveChallengeId(null);
                setActiveChallengeProgressKm(0);
                setActiveClubEventId(event.id);
                setSelectedRouteId(null);
                setActiveTab('run');
              }}
              onCancelChallenge={challenge => void handleLeaveChallenge(challenge)}
              onCancelClubEvent={event => {
                if (joinedClubEventIds.includes(event.id)) {
                  void handleToggleClubEventParticipation(event);
                }
              }}
              onRegisterClubEvent={async event => {
                if (joinedClubEventIds.includes(event.id)) return true;
                return handleToggleClubEventParticipation(event);
              }}
              onLogout={() => void signOut()}
            />
          )}
        </Shell>
      )}

      {signedIn && selectedChallenge && (
        <ChallengeModal
          challenge={selectedChallenge}
          progressKm={selectedChallengeProgressKm}
          isJoined={joinedChallengeIds.includes(selectedChallenge.id)}
          isStarted={joinedChallengeIds.includes(selectedChallenge.id)}
          notice={challengeNotice}
          onNoticeClose={() => setChallengeNotice(null)}
          onClose={() => {
            setSelectedChallenge(null);
            setSelectedChallengeProgressKm(0);
            setChallengeNotice(null);
          }}
          onRegister={handleRegisterChallenge}
          onLeave={challenge => void handleLeaveChallenge(challenge)}
          onStartRun={challenge => {
            setActiveChallengeId(challenge.id);
            setActiveChallengeProgressKm(isSingleRunChallenge(challenge) ? 0 : selectedChallengeProgressKm);
            setActiveClubEventId(null);
            setSelectedChallenge(null);
            setSelectedChallengeProgressKm(0);
            setActiveTab('run');
          }}
        />
      )}

      {signedIn && composerOpen && (
        <PostComposer
          initialTitle={composerDraft?.title}
          initialDescription={composerDraft?.description}
          initialMedia={composerDraft?.media}
          runMapMedia={composerDraft?.runMapMedia}
          onCancel={() => {
            setComposerOpen(false);
            setComposerDraft(null);
          }}
          onSave={handleSavePost}
        />
      )}

    </SafeAreaProvider>
  );
}
