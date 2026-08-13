import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, type ImageStyle, type StyleProp
} from 'react-native';
import type { Challenge, Post } from '../types';
import type { ClubEvent } from '../clubs';
import { RUNNERS } from '../data';
import { colors } from '../theme';
import {
  fetchConversationPreviews, fetchDirectMessages, fetchProfileDashboard, fetchProfileSummary,
  markConversationRead, sendDirectMessage, type ConversationPreview, type DirectMessage,
  type ProfileDashboardData, type ProfilePerson, type ProfileSummary
} from '../../lib/runboostApi';

type Props = {
  currentUserId: string;
  currentUserName: string;
  posts: Post[];
  joinedChallenges: Challenge[];
  joinedClubEvents: ClubEvent[];
  onOpenChallenge: (challenge: Challenge, progressKm: number) => void;
};

const DEMO_PEOPLE: ProfilePerson[] = RUNNERS.map(runner => ({
  id: runner.id,
  name: runner.name,
  avatarUrl: runner.avatar
}));

const DAY_LABELS = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];

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
    weekly: distances.map((distanceKm, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return { date: date.toISOString(), label: DAY_LABELS[date.getDay()], distanceKm };
    }),
    following: DEMO_PEOPLE,
    followers: [...DEMO_PEOPLE].reverse(),
    challengeProgress: challenges.map((challenge, index) => ({
      challengeId: challenge.id,
      totalKm: challenge.goalKm * (index === 0 ? 0.68 : 0.34),
      rank: index + 4,
      participantCount: 186 + index * 62
    }))
  };
}

function formatHours(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}ц ${minutes}м`;
}

function shortTime(date: string) {
  const value = new Date(date);
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function formatEventDate(date: string) {
  return new Date(date).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ProfileScreen({ currentUserId, currentUserName, posts, joinedChallenges, joinedClubEvents, onOpenChallenge }: Props) {
  const isDemo = currentUserId === 'demo-runner';
  const [dashboard, setDashboard] = useState(() => buildDemoDashboard(currentUserId, currentUserName, posts, joinedChallenges));
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

  useEffect(() => {
    if (isDemo) {
      setDashboard(buildDemoDashboard(currentUserId, currentUserName, posts, joinedChallenges));
      return;
    }
    fetchProfileDashboard(currentUserId).then(setDashboard).catch(() => {
      setDashboard(buildDemoDashboard(currentUserId, currentUserName, posts, joinedChallenges));
    });
  }, [currentUserId, currentUserName, isDemo, joinedChallenges, posts]);

  const weeklyTotal = dashboard.weekly.reduce((sum, day) => sum + day.distanceKm, 0);
  const chartMax = Math.max(...dashboard.weekly.map(day => day.distanceKm), 1);
  const achievements = useMemo(() => [
    { id: 'first-run', icon: '01', title: 'Эхний гүйлт', meta: 'Анхны гүйлтээ дуусгасан', unlocked: dashboard.totalRuns >= 1 },
    { id: 'ten-km', icon: '10', title: '10 км клуб', meta: 'Нийт 10 км давсан', unlocked: dashboard.totalKm >= 10 },
    { id: 'streak', icon: '3×', title: 'Тогтвортой', meta: '7 хоногт 3 удаа гүйсэн', unlocked: dashboard.weekly.filter(day => day.distanceKm > 0).length >= 3 },
    { id: 'challenger', icon: 'C', title: 'Чэлленжер', meta: 'Чэлленжид нэгдсэн', unlocked: joinedChallenges.length > 0 }
  ].filter(item => item.unlocked), [dashboard, joinedChallenges.length]);

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

  const connectionPeople = connectionMode === 'followers' ? dashboard.followers : dashboard.following;
  const visibleConversations = conversations.filter(item => item.person.name.toLowerCase().includes(inboxQuery.trim().toLowerCase()));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <PersonAvatar person={dashboard.profile} style={styles.avatar} />
          <View style={styles.identity}>
            <Text style={styles.name}>{dashboard.profile.name}</Text>
            <Text style={styles.handle}>@{dashboard.profile.name.toLowerCase().replaceAll(' ', '.')}</Text>
          </View>
          <Pressable accessibilityLabel="Мессеж" onPress={openInbox} style={styles.inboxButton}>
            <Text style={styles.inboxIcon}>⌁</Text>
            {conversations.some(item => item.unread > 0) ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        </View>

        <View style={styles.statStrip}>
          <View style={styles.statItem}><Text style={styles.statValue}>{dashboard.totalKm.toFixed(1)}</Text><Text style={styles.statLabel}>Нийт км</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statValue}>{dashboard.totalRuns}</Text><Text style={styles.statLabel}>Гүйлт</Text></View>
          <View style={styles.statDivider} />
          <Pressable style={styles.statItem} onPress={() => setConnectionMode('following')}><Text style={styles.statValue}>{dashboard.following.length}</Text><Text style={styles.statLabel}>Дагасан</Text></Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statItem} onPress={() => setConnectionMode('followers')}><Text style={styles.statValue}>{dashboard.followers.length}</Text><Text style={styles.statLabel}>Дагуулсан</Text></Pressable>
        </View>

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>7 хоногийн гүйлт</Text><Text style={styles.sectionMeta}>{weeklyTotal.toFixed(1)} км · {formatHours(dashboard.totalSeconds)}</Text></View><Text style={styles.trend}>+12%</Text></View>
        <View style={styles.chartPanel}>
          <View style={styles.chartGrid}><View /><View /><View /></View>
          <View style={styles.chartBars}>
            {dashboard.weekly.map((day, index) => {
              const height = Math.max(4, (day.distanceKm / chartMax) * 112);
              return <View key={day.date} style={styles.chartColumn}><Text style={styles.barValue}>{day.distanceKm ? day.distanceKm.toFixed(1) : ''}</Text><View style={[styles.bar, { height }, index === 6 && styles.activeBar]} /><Text style={[styles.dayLabel, index === 6 && styles.activeDay]}>{day.label}</Text></View>;
            })}
          </View>
        </View>

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Оролцож буй чэлленжүүд</Text><Text style={styles.sectionMeta}>{joinedChallenges.length} идэвхтэй</Text></View></View>
        {joinedChallenges.length ? joinedChallenges.map(challenge => {
          const stats = dashboard.challengeProgress.find(item => item.challengeId === challenge.id);
          const completedKm = stats?.totalKm ?? challenge.goalKm * 0.42;
          const percent = Math.min(100, Math.round((completedKm / challenge.goalKm) * 100));
          return <Pressable key={challenge.id} style={({ pressed }) => [styles.challengeCard, pressed && styles.challengeCardPressed]} onPress={() => onOpenChallenge(challenge, completedKm)}><Image source={{ uri: challenge.image }} style={styles.challengeImage} /><View style={styles.challengeMain}><View style={styles.challengeTitleRow}><View style={styles.flex}><Text style={styles.challengeTitle} numberOfLines={1}>{challenge.title}</Text><Text style={styles.challengeOrg}>{challenge.org}</Text></View><View style={styles.rankBadge}><Text style={styles.rankValue}>#{stats?.rank ?? 4}</Text><Text style={styles.rankLabel}>байр</Text></View></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View><View style={styles.progressMeta}><Text style={styles.progressText}>{completedKm.toFixed(1)} / {challenge.goalKm} км</Text><Text style={styles.progressText}>{percent}% · {stats?.participantCount ?? 248} хүн</Text></View><View style={styles.continueRow}><Text style={styles.continueText}>Гүйлтээ үргэлжлүүлэх</Text><Text style={styles.continueArrow}>›</Text></View></View></Pressable>;
        }) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>Идэвхтэй чэлленж алга</Text><Text style={styles.emptyText}>Routes хэсгээс шинэ чэлленжид нэгдээрэй.</Text></View>}

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Оролцох арга хэмжээнүүд</Text><Text style={styles.sectionMeta}>{joinedClubEvents.length} төлөвлөсөн</Text></View></View>
        {joinedClubEvents.length ? joinedClubEvents.map(event => (
          <View key={event.id} style={styles.profileEventCard}>
            <Image source={{ uri: event.image }} style={styles.profileEventImage} />
            <View style={styles.profileEventCopy}>
              <Text style={styles.profileEventDate}>{formatEventDate(event.startsAt)}</Text>
              <Text style={styles.profileEventTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.profileEventClub}>{event.clubName}</Text>
              <Text style={styles.profileEventMeta} numberOfLines={1}>{event.location}{event.distanceKm ? ` · ${event.distanceKm} км` : ''}</Text>
            </View>
            <View style={styles.profileEventState}><Text style={styles.profileEventStateText}>ОРОЛЦОНО</Text></View>
          </View>
        )) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>Оролцох арга хэмжээ алга</Text><Text style={styles.emptyText}>Онцлох клубын нүүрээс арга хэмжээнд оролцоорой.</Text></View>}

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Нээсэн амжилтууд</Text><Text style={styles.sectionMeta}>{achievements.length} badge</Text></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementRow}>
          {achievements.map(item => <View key={item.id} style={styles.achievementCard}><View style={styles.achievementIcon}><Text style={styles.achievementIconText}>{item.icon}</Text></View><Text style={styles.achievementTitle}>{item.title}</Text><Text style={styles.achievementMeta}>{item.meta}</Text></View>)}
        </ScrollView>

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Найзууд</Text><Text style={styles.sectionMeta}>Профайлыг дарж үзнэ</Text></View><Pressable onPress={() => setConnectionMode('following')}><Text style={styles.textAction}>Бүгд</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
          {dashboard.following.map(person => <Pressable key={person.id} style={styles.personItem} onPress={() => openPerson(person)}><PersonAvatar person={person} style={styles.personAvatar} /><Text style={styles.personName} numberOfLines={1}>{person.name.split(' ')[0]}</Text></Pressable>)}
        </ScrollView>
      </ScrollView>

      <Modal visible={connectionMode !== null} animationType="slide" onRequestClose={() => setConnectionMode(null)}>
        <View style={styles.modalRoot}><View style={styles.modalHeader}><Pressable onPress={() => setConnectionMode(null)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.modalTitle}>Холбоосууд</Text><View style={styles.headerSpacer} /></View><View style={styles.segment}><Pressable style={[styles.segmentButton, connectionMode === 'following' && styles.activeSegment]} onPress={() => setConnectionMode('following')}><Text style={styles.segmentText}>Дагасан {dashboard.following.length}</Text></Pressable><Pressable style={[styles.segmentButton, connectionMode === 'followers' && styles.activeSegment]} onPress={() => setConnectionMode('followers')}><Text style={styles.segmentText}>Дагуулсан {dashboard.followers.length}</Text></Pressable></View><ScrollView contentContainerStyle={styles.listContent}>{connectionPeople.map(person => <Pressable key={person.id} style={styles.personRow} onPress={() => openPerson(person)}><PersonAvatar person={person} style={styles.rowAvatar} /><View style={styles.flex}><Text style={styles.rowName}>{person.name}</Text><Text style={styles.rowMeta}>Профайл харах</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</ScrollView></View>
      </Modal>

      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.profileModalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileOpen(false)} /><View style={styles.profileModal}>{selectedPerson ? <><Pressable style={styles.modalClose} onPress={() => setProfileOpen(false)}><Text style={styles.closeText}>×</Text></Pressable><PersonAvatar person={selectedPerson} style={styles.largeAvatar} /><Text style={styles.largeName}>{selectedPerson.name}</Text><Text style={styles.friendState}>✓ Найз</Text><View style={styles.personStats}><View><Text style={styles.personStatValue}>{personSummary?.totalKm.toFixed(1) ?? '—'}</Text><Text style={styles.personStatLabel}>км</Text></View><View><Text style={styles.personStatValue}>{personSummary?.postCount ?? '—'}</Text><Text style={styles.personStatLabel}>пост</Text></View><View><Text style={styles.personStatValue}>{personSummary?.followerCount ?? '—'}</Text><Text style={styles.personStatLabel}>дагагч</Text></View></View><Pressable style={styles.messageButton} onPress={() => openChat(selectedPerson)}><Text style={styles.messageButtonText}>Мессеж бичих</Text></Pressable></> : null}</View></View>
      </Modal>

      <Modal visible={inboxOpen} animationType="slide" onRequestClose={() => setInboxOpen(false)}>
        <View style={styles.modalRoot}><View style={styles.modalHeader}><Pressable onPress={() => setInboxOpen(false)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.modalTitle}>Мессеж</Text><Text style={styles.modalSubtitle}>{dashboard.profile.name}</Text></View><View style={styles.headerSpacer} /></View><View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={inboxQuery} onChangeText={setInboxQuery} placeholder="Хайх" placeholderTextColor="#82949B" style={styles.searchInput} /></View><ScrollView contentContainerStyle={styles.listContent}>{visibleConversations.length ? visibleConversations.map(item => <Pressable key={item.person.id} style={styles.conversationRow} onPress={() => openChat(item.person)}><PersonAvatar person={item.person} style={styles.conversationAvatar} /><View style={styles.flex}><Text style={styles.rowName}>{item.person.name}</Text><Text style={styles.messagePreview} numberOfLines={1}>{item.message}</Text></View><View style={styles.messageSide}><Text style={styles.messageTime}>{shortTime(item.createdAt)}</Text>{item.unread ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread}</Text></View> : null}</View></Pressable>) : <View style={styles.emptyInbox}><Text style={styles.emptyTitle}>Мессеж олдсонгүй</Text><Text style={styles.emptyText}>Найзынхаа профайлаас чат эхлүүлээрэй.</Text></View>}</ScrollView></View>
      </Modal>

      <Modal visible={chatPerson !== null} animationType="slide" onRequestClose={() => setChatPerson(null)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.chatHeader}><Pressable onPress={() => setChatPerson(null)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>{chatPerson ? <><PersonAvatar person={chatPerson} style={styles.chatAvatar} /><View style={styles.flex}><Text style={styles.rowName}>{chatPerson.name}</Text><Text style={styles.onlineText}>Идэвхтэй</Text></View></> : null}</View>
          <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>{messages.map(message => { const mine = message.senderId === currentUserId; return <View key={message.id} style={[styles.bubbleWrap, mine && styles.myBubbleWrap]}><View style={[styles.bubble, mine && styles.myBubble]}><Text style={[styles.bubbleText, mine && styles.myBubbleText]}>{message.body}</Text></View><Text style={styles.bubbleTime}>{shortTime(message.createdAt)}</Text></View>; })}</ScrollView>
          <View style={styles.composer}><TextInput value={messageText} onChangeText={setMessageText} placeholder="Мессеж..." placeholderTextColor="#82949B" style={styles.messageInput} returnKeyType="send" onSubmitEditing={sendMessage} /><Pressable disabled={!messageText.trim() || sending} onPress={sendMessage} style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendDisabled]}><Text style={styles.sendText}>↑</Text></Pressable></View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071419' },
  content: { paddingHorizontal: 16, paddingTop: 46, paddingBottom: 118 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.accent, backgroundColor: '#10262D' },
  fallbackAvatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#17464C' },
  fallbackAvatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  identity: { flex: 1, minWidth: 0 },
  name: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  handle: { color: '#AFC1C8', fontSize: 11, fontWeight: '700', marginTop: 4 },
  inboxButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  inboxIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', transform: [{ rotate: '-24deg' }] },
  unreadDot: { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF496C', borderWidth: 1, borderColor: '#071419' },
  statStrip: { minHeight: 76, flexDirection: 'row', alignItems: 'center', marginTop: 20, borderRadius: 16, backgroundColor: 'rgba(10,29,34,0.86)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.22)' },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  statLabel: { color: '#AFC1C8', fontSize: 8, fontWeight: '800', marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.13)' },
  sectionHead: { minHeight: 52, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  sectionMeta: { color: '#AFC1C8', fontSize: 10, fontWeight: '700', marginTop: 4 },
  trend: { color: colors.accent, fontSize: 11, fontWeight: '900', borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(182,255,46,0.1)', paddingHorizontal: 8, paddingVertical: 5 },
  chartPanel: { height: 188, borderRadius: 16, paddingHorizontal: 12, paddingTop: 17, paddingBottom: 10, backgroundColor: 'rgba(10,29,34,0.86)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.22)', overflow: 'hidden' },
  chartGrid: { position: 'absolute', left: 12, right: 12, top: 28, height: 100, justifyContent: 'space-between' },
  chartBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  chartColumn: { width: 34, height: 154, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 12, minHeight: 4, borderRadius: 6, backgroundColor: '#3C6B70' },
  activeBar: { backgroundColor: colors.accent },
  barValue: { color: '#C8D6DB', fontSize: 8, fontWeight: '800', marginBottom: 5 },
  dayLabel: { color: '#82949B', fontSize: 9, fontWeight: '800', marginTop: 7 },
  activeDay: { color: colors.accent },
  challengeCard: { minHeight: 128, flexDirection: 'row', borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(10,29,34,0.9)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.22)', marginBottom: 10 },
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
  profileEventCard: { minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, padding: 10, marginBottom: 9, backgroundColor: 'rgba(10,29,34,0.9)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.22)' },
  profileEventImage: { width: 76, height: 82, borderRadius: 11, backgroundColor: '#10262D' },
  profileEventCopy: { flex: 1, minWidth: 0 },
  profileEventDate: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  profileEventTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginTop: 4 },
  profileEventClub: { color: '#B5C8CE', fontSize: 9, fontWeight: '800', marginTop: 3 },
  profileEventMeta: { color: '#8FA3AA', fontSize: 8, fontWeight: '700', marginTop: 5 },
  profileEventState: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: 'rgba(57,255,136,0.12)', borderWidth: 1, borderColor: 'rgba(57,255,136,0.3)' },
  profileEventStateText: { color: colors.accent, fontSize: 6, fontWeight: '900' },
  emptyState: { minHeight: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(10,29,34,0.7)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.18)' },
  emptyTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  emptyText: { color: '#9FB2B9', fontSize: 10, fontWeight: '700', marginTop: 5 },
  achievementRow: { gap: 10, paddingRight: 16 },
  achievementCard: { width: 142, minHeight: 148, borderRadius: 16, padding: 12, backgroundColor: 'rgba(10,29,34,0.86)', borderWidth: 1, borderColor: 'rgba(220,244,248,0.22)' },
  achievementIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,255,46,0.12)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.38)' },
  achievementIconText: { color: colors.accent, fontSize: 14, fontWeight: '900' },
  achievementTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', marginTop: 12 },
  achievementMeta: { color: '#9FB2B9', fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 5 },
  textAction: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  peopleRow: { gap: 12, paddingRight: 16 },
  personItem: { width: 64, alignItems: 'center' },
  personAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#10262D', borderWidth: 2, borderColor: 'rgba(182,255,46,0.62)' },
  personName: { color: '#D9E5E9', fontSize: 9, fontWeight: '800', marginTop: 6, maxWidth: 64 },
  modalRoot: { flex: 1, backgroundColor: '#071419' },
  modalHeader: { minHeight: 74, paddingTop: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#FFFFFF', fontSize: 34, lineHeight: 36, fontWeight: '300' },
  modalTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  modalSubtitle: { color: '#8FA2A9', fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  headerSpacer: { width: 42 },
  segment: { flexDirection: 'row', margin: 14, borderRadius: 12, padding: 3, backgroundColor: 'rgba(255,255,255,0.07)' },
  segmentButton: { flex: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  activeSegment: { backgroundColor: 'rgba(182,255,46,0.16)', borderWidth: 1, borderColor: 'rgba(182,255,46,0.28)' },
  segmentText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  listContent: { paddingHorizontal: 14, paddingBottom: 30 },
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
  searchBox: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, borderRadius: 12, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  searchIcon: { color: '#AFC1C8', fontSize: 18 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '700', paddingVertical: 0 },
  conversationRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  conversationAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#10262D' },
  messagePreview: { color: '#92A5AC', fontSize: 10, fontWeight: '700', marginTop: 4 },
  messageSide: { alignItems: 'flex-end', gap: 6 },
  messageTime: { color: '#82949B', fontSize: 8, fontWeight: '700' },
  unreadBadge: { minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  unreadText: { color: '#102014', fontSize: 8, fontWeight: '900' },
  emptyInbox: { alignItems: 'center', marginTop: 80 },
  chatHeader: { minHeight: 76, paddingTop: 18, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10262D' },
  onlineText: { color: colors.accent, fontSize: 8, fontWeight: '800', marginTop: 3 },
  messages: { flex: 1 },
  messagesContent: { padding: 14, gap: 8, justifyContent: 'flex-end', flexGrow: 1 },
  bubbleWrap: { alignSelf: 'flex-start', maxWidth: '78%' },
  myBubbleWrap: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.1)' },
  myBubble: { borderBottomLeftRadius: 16, borderBottomRightRadius: 4, backgroundColor: colors.accent },
  bubbleText: { color: '#FFFFFF', fontSize: 12, lineHeight: 17 },
  myBubbleText: { color: '#102014', fontWeight: '700' },
  bubbleTime: { color: '#758990', fontSize: 7, marginTop: 3 },
  composer: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingBottom: Platform.OS === 'ios' ? 16 : 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  messageInput: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 14, color: '#FFFFFF', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  sendDisabled: { opacity: 0.35 },
  sendText: { color: '#102014', fontSize: 20, fontWeight: '900' }
});
