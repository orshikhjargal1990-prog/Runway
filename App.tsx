import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
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
import { ChallengeModal } from './src/native/components/ChallengeModal';
import { PostComposer } from './src/native/components/PostComposer';
import { AdminDashboard } from './src/admin/AdminDashboard';
import { ClubAdminDashboard } from './src/club-admin/ClubAdminDashboard';
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
  joinChallenge,
  leaveChallenge,
  clearActiveRun,
  saveRun,
  updateActiveRun,
  setClubEventParticipation,
  setClubMembership
} from './src/lib/runboostApi';

type Account = {
  id: string;
  name: string;
  email: string;
};

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
  const [challenges, setChallenges] = useState<Challenge[]>(CHALLENGES);
  const [routes, setRoutes] = useState<RouteOption[]>(RUN_ROUTES);
  const [clubs, setClubs] = useState(DEFAULT_RUNNING_CLUBS);
  const [clubEvents, setClubEvents] = useState(DEFAULT_CLUB_EVENTS);
  const [joinedClubEventIds, setJoinedClubEventIds] = useState<string[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [selectedChallengeProgressKm, setSelectedChallengeProgressKm] = useState(0);
  const [joinedChallengeIds, setJoinedChallengeIds] = useState<string[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [followedRunners, setFollowedRunners] = useState<string[]>([]);
  const [hiddenRunnerIds, setHiddenRunnerIds] = useState<string[]>([]);

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

  const registerChallenge = async (challenge: Challenge) => {
    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await joinChallenge(currentUser.id, challenge);
      } catch (error) {
        Alert.alert('Бүртгэж чадсангүй', error instanceof Error ? error.message : 'Supabase холболт болон интернэтээ шалгана уу.');
        return;
      }
    }
    setJoinedChallengeIds(prev => {
      const withoutSameGroup = prev.filter(id => {
        const existing = challenges.find(item => item.id === id);
        return existing?.group !== challenge.group;
      });
      return withoutSameGroup.includes(challenge.id) ? withoutSameGroup : [...withoutSameGroup, challenge.id];
    });
    setSelectedChallenge(challenge);
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
      const groupLabel = challenge.group === '5k' ? '5 км' : '10 км';
      Alert.alert(
        `${groupLabel} чэлленж идэвхтэй байна`,
        `Та “${sameGroup.title}” чэлленжид оролцож байна. Нэг хэрэглэгч ${groupLabel} ангилалд нэг л идэвхтэй чэлленжтэй байна. Эхлээд өмнөхөө дуусгах эсвэл түүнээс гараад “${challenge.title}”-д бүртгүүлнэ үү.`,
        [
          { text: 'Болих', style: 'cancel' },
          { text: 'Өмнөхийг нээх', onPress: () => setSelectedChallenge(sameGroup) },
          { text: 'Гараад бүртгүүлэх', style: 'destructive', onPress: () => void registerChallenge(challenge) }
        ]
      );
      return;
    }

    void registerChallenge(challenge);
  };

  const handleLeaveChallenge = async (challenge: Challenge) => {
    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await leaveChallenge(currentUser.id, challenge.id);
      } catch (error) {
        Alert.alert('Чэлленжээс гарч чадсангүй', error instanceof Error ? error.message : 'Интернэт холболтоо шалгана уу.');
        return;
      }
    }
    setJoinedChallengeIds(current => current.filter(id => id !== challenge.id));
    if (activeChallengeId === challenge.id) setActiveChallengeId(null);
    setSelectedChallenge(null);
    setSelectedChallengeProgressKm(0);
  };

  const handleToggleClubMembership = async (club: RunningClub) => {
    const nextJoined = !club.joined;
    const currentClub = clubs.find(item => item.joined && item.id !== club.id);

    if (nextJoined && currentClub) {
      Alert.alert(
        'Үндсэн клубээ солих уу?',
        `Та одоогоор “${currentClub.name}” клубын гишүүн байна. “${club.name}” клубт нэгдэхэд өмнөх клубээс автоматаар гарна. Бусад клубын арга хэмжээнд оролцох боломж хэвээр байна.`,
        [
          { text: 'Болих', style: 'cancel' },
          { text: 'Клуб солих', onPress: () => void updateClubMembership(club, true) }
        ]
      );
      return;
    }

    await updateClubMembership(club, nextJoined);
  };

  const updateClubMembership = async (club: RunningClub, nextJoined: boolean) => {
    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await setClubMembership(currentUser.id, club.id, nextJoined);
      } catch {
        Alert.alert('Клубын төлөв шинэчлэгдсэнгүй', 'Supabase холболт болон интернэтээ шалгана уу.');
        return;
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
  };

  const handleToggleClubEventParticipation = async (event: ClubEvent) => {
    const participating = !joinedClubEventIds.includes(event.id);
    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await setClubEventParticipation(currentUser.id, event.id, participating);
      } catch {
        Alert.alert('Оролцох төлөв шинэчлэгдсэнгүй', 'Supabase холболт болон интернэтээ шалгана уу.');
        return;
      }
    }
    setJoinedClubEventIds(current => participating ? [...current, event.id] : current.filter(id => id !== event.id));
    setClubEvents(current => current.map(item => item.id === event.id ? {
      ...item,
      participantCount: Math.max(0, item.participantCount + (participating ? 1 : -1))
    } : item));
  };

  const handleSavePost = async (title: string, description: string, media: MediaItem[]) => {
    if (currentUser && currentUser.id !== 'demo-runner') {
      try {
        await createPost({ userId: currentUser.id, title, description, media });
        setPosts(await fetchPosts(currentUser.id));
        setComposerOpen(false);
        setActiveTab('home');
        return;
      } catch {
        Alert.alert('Нийтлэл хадгалагдсангүй', 'Supabase хүснэгт, Storage болон интернэт холболтоо шалгана уу.');
        return;
      }
    }

    setPosts(prev => [{
      id: `post-${Date.now()}`,
      user: currentUser?.name ?? 'Төгөлдөр',
      isMe: true,
      title,
      description,
      media,
      time: 'Яг одоо',
      distanceKm: 0,
      duration: '00:00'
    }, ...prev]);
    setComposerOpen(false);
    setActiveTab('home');
  };

  const visibleRunners: Runner[] = RUNNERS.filter(runner => !hiddenRunnerIds.includes(runner.id));

  const signIn = (account: Account) => {
    setCurrentUser(account);
    setSignedIn(true);
    setActiveTab('home');
  };

  if (!authReady) {
    return <SafeAreaProvider />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!signedIn ? (
        <LoginScreen
          onQuickLogin={() => signIn({ id: 'demo-runner', name: 'Төгөлдөр', email: 'runner@example.com' })}
          onLogin={async (email, password) => {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error || !data.user) {
              return { ok: false, message: 'Имэйл эсвэл нууц үг буруу байна.' };
            }

            return { ok: true };
          }}
          onRegister={async (name, email, password) => {
            const normalizedEmail = email.trim().toLowerCase();
            const { data, error } = await supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: { data: { name: name.trim() } }
            });

            if (error) {
              return { ok: false, message: error.message };
            }

            if (!data.session) {
              return { ok: false, message: 'Имэйлээр ирсэн холбоосоор бүртгэлээ баталгаажуулна уу.' };
            }

            return { ok: true };
          }}
        />
      ) : (
        <Shell
          activeTab={activeTab}
          onTabChange={tab => {
            if (tab === 'run') {
              setSelectedRouteId(null);
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
              onOpenComposer={() => setComposerOpen(true)}
              onOpenChallenge={setSelectedChallenge}
              onRegisterChallenge={handleRegisterChallenge}
              onOpenRoute={routeId => {
                setSelectedRouteId(routeId);
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
              routes={routes}
              selectedRouteId={selectedRouteId}
              onOpenComposer={() => setComposerOpen(true)}
              onLiveRunUpdate={async run => {
                if (!currentUser || currentUser.id === 'demo-runner') return;
                await updateActiveRun({ ...run, userId: currentUser.id });
              }}
              onLiveRunEnd={async () => {
                if (!currentUser || currentUser.id === 'demo-runner') return;
                await clearActiveRun(currentUser.id);
              }}
              onSaveRun={async (run: {
                routeId: string;
                challengeId: string | null;
                distanceKm: number;
                durationSeconds: number;
                calories: number;
                coordinates: Point[];
                startedAt: string;
              }) => {
                if (!currentUser || currentUser.id === 'demo-runner') return;
                await saveRun({ ...run, userId: currentUser.id });
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
              joinedClubEvents={clubEvents.filter(event => joinedClubEventIds.includes(event.id))}
              onOpenChallenge={(challenge, progressKm) => {
                setSelectedChallengeProgressKm(progressKm);
                setSelectedChallenge(challenge);
              }}
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
          onClose={() => {
            setSelectedChallenge(null);
            setSelectedChallengeProgressKm(0);
          }}
          onRegister={handleRegisterChallenge}
          onLeave={challenge => {
            const completed = selectedChallengeProgressKm >= challenge.goalKm;
            Alert.alert(
              completed ? 'Чэлленж дуусгах уу?' : 'Чэлленжээс гарах уу?',
              completed
                ? `“${challenge.title}” зорилго биелсэн байна. Дуусгасны дараа энэ ангиллын өөр чэлленжид бүртгүүлэх боломжтой.`
                : `“${challenge.title}”-ээс гарсны дараа ${challenge.group === '5k' ? '5 км' : '10 км'} ангиллын өөр чэлленжид бүртгүүлэх боломжтой.`,
              [
                { text: 'Болих', style: 'cancel' },
                { text: completed ? 'Дуусгах' : 'Гарах', style: 'destructive', onPress: () => void handleLeaveChallenge(challenge) }
              ]
            );
          }}
          onStartRun={challenge => {
            setActiveChallengeId(challenge.id);
            setSelectedChallenge(null);
            setSelectedChallengeProgressKm(0);
            setActiveTab('run');
          }}
        />
      )}

      {signedIn && composerOpen && (
        <PostComposer
          onCancel={() => setComposerOpen(false)}
          onSave={handleSavePost}
        />
      )}
    </SafeAreaProvider>
  );
}
