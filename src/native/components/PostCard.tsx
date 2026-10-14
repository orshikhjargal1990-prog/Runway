import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { MediaItem, Post, PostComment } from '../types';
import { colors } from '../theme';
import { createPostComment, fetchPostComments, setPostLiked, setUserFollowing } from '../../lib/runboostApi';

type Props = {
  post: Post;
  currentUserId?: string | null;
  onSocialChange?: (postId: string, patch: Partial<Pick<Post, 'likeCount' | 'commentCount' | 'likedByMe' | 'isFollowing'>>) => void;
  onOpenAuthor?: (post: Post) => void;
};

function VideoMedia({ uri, mode }: { uri: string; mode: 'card' | 'full' }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = false;
    instance.muted = mode === 'card';
    if (mode === 'card') instance.play();
  });

  useEffect(() => {
    if (mode !== 'card') return;
    const previewTimer = setTimeout(() => {
      player.pause();
      player.currentTime = 0;
    }, 5000);
    return () => clearTimeout(previewTimer);
  }, [mode, player]);

  return (
    <View style={mode === 'card' ? styles.media : styles.fullMedia}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit={mode === 'card' ? 'cover' : 'contain'}
        nativeControls={mode === 'full'}
      />
      {mode === 'card' ? (
        <View pointerEvents="none" style={styles.videoBadge}>
          <Text style={styles.videoBadgeText}>▶ PREVIEW</Text>
        </View>
      ) : null}
    </View>
  );
}

function Media({ item, mode }: { item: MediaItem; mode: 'card' | 'full' }) {
  if (item.type === 'video') return <VideoMedia uri={item.uri} mode={mode} />;

  return (
    <Image
      source={{ uri: item.uri }}
      resizeMode={mode === 'card' ? 'cover' : 'contain'}
      style={mode === 'card' ? styles.media : styles.fullMedia}
    />
  );
}

export function PostCard({ post, currentUserId, onSocialChange, onOpenAuthor }: Props) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [liked, setLiked] = useState(post.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [following, setFollowing] = useState(post.isFollowing ?? false);
  const [followSaving, setFollowSaving] = useState(false);
  const [cardWidth, setCardWidth] = useState(320);
  const mediaWidth = Math.max(240, cardWidth - 2);

  const sharePost = async () => {
    const mediaUrl = post.media[0]?.uri;
    await Share.share({
      title: post.title,
      message: `${post.user}: ${post.title}${post.description ? `\n${post.description}` : ''}${mediaUrl ? `\n${mediaUrl}` : ''}\n\nRUNBOOST дээр хуваалцав.`,
      url: mediaUrl
    });
  };

  const toggleLike = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount(count => Math.max(0, count + (nextLiked ? 1 : -1)));
    onSocialChange?.(post.id, {
      likedByMe: nextLiked,
      likeCount: Math.max(0, likeCount + (nextLiked ? 1 : -1)),
      commentCount
    });
    if (!currentUserId || currentUserId === 'demo-runner') return;

    try {
      await setPostLiked(post.id, currentUserId, nextLiked);
    } catch {
      setLiked(!nextLiked);
      setLikeCount(count => Math.max(0, count + (nextLiked ? -1 : 1)));
      onSocialChange?.(post.id, { likedByMe: !nextLiked, likeCount, commentCount });
      Alert.alert('Like хадгалагдсангүй', 'Интернэт холболтоо шалгаад дахин оролдоно уу.');
    }
  };

  const toggleFollow = async () => {
    if (!post.userId || followSaving) return;
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    onSocialChange?.(post.id, { isFollowing: nextFollowing });
    if (!currentUserId || currentUserId === 'demo-runner') return;

    setFollowSaving(true);
    try {
      await setUserFollowing(currentUserId, post.userId, nextFollowing);
    } catch {
      setFollowing(!nextFollowing);
      onSocialChange?.(post.id, { isFollowing: !nextFollowing });
      Alert.alert('Дагалтын төлөв хадгалагдсангүй', 'Интернэт холболтоо шалгаад дахин оролдоно уу.');
    } finally {
      setFollowSaving(false);
    }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    if (!currentUserId || currentUserId === 'demo-runner') return;
    setCommentsLoading(true);
    try {
      const loadedComments = await fetchPostComments(post.id);
      setComments(loadedComments);
      setCommentCount(loadedComments.length);
      onSocialChange?.(post.id, { likedByMe: liked, likeCount, commentCount: loadedComments.length });
    } catch {
      Alert.alert('Коммент ачаалсангүй', 'Интернэт холболтоо шалгана уу.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const addComment = async () => {
    const body = commentText.trim();
    if (!body || commentSaving) return;
    setCommentSaving(true);
    try {
      const comment = currentUserId && currentUserId !== 'demo-runner'
        ? await createPostComment({ postId: post.id, userId: currentUserId, body })
        : { id: `comment-${Date.now()}`, userId: 'demo-runner', user: 'Төгөлдөр', body, time: 'Яг одоо' };
      setComments(current => [...current, comment]);
      setCommentCount(count => count + 1);
      onSocialChange?.(post.id, { likedByMe: liked, likeCount, commentCount: commentCount + 1 });
      setCommentText('');
    } catch {
      Alert.alert('Коммент хадгалагдсангүй', 'Интернэт холболтоо шалгаад дахин оролдоно уу.');
    } finally {
      setCommentSaving(false);
    }
  };

  return (
    <View
      style={styles.card}
      onLayout={event => setCardWidth(Math.round(event.nativeEvent.layout.width))}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={`${post.user} профайл харах`}
          disabled={!onOpenAuthor}
          style={styles.authorButton}
          onPress={() => onOpenAuthor?.(post)}
        >
          {post.userAvatar ? (
            <Image source={{ uri: post.userAvatar }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: post.isMe ? colors.primary : colors.secondary }]}>
              <Text style={styles.avatarText}>{post.user.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.headerIdentity}>
            <Text style={styles.user}>{post.user}</Text>
            <Text style={styles.time}>{post.time}{post.distanceKm ? ` · ${post.distanceKm} км` : ''}</Text>
          </View>
        </Pressable>
        {!post.isMe && post.userId ? (
          <Pressable
            disabled={followSaving}
            onPress={toggleFollow}
            style={[styles.followButton, following && styles.friendButton, followSaving && styles.followButtonDisabled]}
          >
            <Text style={[styles.followButtonText, following && styles.friendButtonText]}>
              {following ? '✓ Найз' : '＋ Дагах'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {post.media.length > 0 && (
        <Pressable onPress={() => setGalleryOpen(true)}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {post.media.map(item => (
              <View key={item.id} style={{ width: mediaWidth }}>
                <Media item={item} mode="card" />
              </View>
            ))}
          </ScrollView>
          {post.media.length > 1 && <Text style={styles.swipeHint}>← swipe →</Text>}
        </Pressable>
      )}

      <View style={styles.body}>
        <Text style={styles.title}>{post.title}</Text>
        {post.description ? <Text style={styles.description}>{post.description}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={toggleLike} style={styles.actionButton} accessibilityLabel="Like">
            <Text style={[styles.actionIcon, liked && styles.likedIcon]}>{liked ? '♥' : '♡'}</Text>
            <Text style={[styles.actionCount, liked && styles.likedCount]}>{likeCount}</Text>
          </Pressable>
          <Pressable onPress={openComments} style={styles.actionButton} accessibilityLabel="Коммент">
            <Text style={styles.commentIcon}>◯</Text>
            <Text style={styles.actionCount}>{commentCount}</Text>
          </Pressable>
          <Pressable onPress={sharePost} style={[styles.share, styles.shareAtEnd]}>
            <Text style={styles.shareText}>↗ Хуваалцах</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={galleryOpen} transparent animationType="fade">
        <View style={styles.gallery}>
          <Pressable style={styles.close} onPress={() => setGalleryOpen(false)}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          {galleryOpen ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {post.media.map(item => <Media key={item.id} item={item} mode="full" />)}
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <Modal visible={commentsOpen} transparent animationType="slide" onRequestClose={() => setCommentsOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.commentBackdrop}
        >
          <Pressable style={styles.commentDismissArea} onPress={() => setCommentsOpen(false)} />
          <View style={styles.commentSheet}>
            <View style={styles.commentHandle} />
            <View style={styles.commentHeader}>
              <Text style={styles.commentHeading}>Комментууд</Text>
              <Pressable onPress={() => setCommentsOpen(false)} style={styles.commentClose}>
                <Text style={styles.commentCloseText}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.commentList} contentContainerStyle={styles.commentListContent}>
              {commentsLoading ? <Text style={styles.commentState}>Ачаалж байна...</Text> : null}
              {!commentsLoading && comments.length === 0 ? (
                <Text style={styles.commentState}>Анхны комментыг та бичээрэй.</Text>
              ) : null}
              {comments.map(comment => (
                <View key={comment.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{comment.user.charAt(0)}</Text></View>
                  <View style={styles.commentBubble}>
                    <View style={styles.commentMetaRow}>
                      <Text style={styles.commentUser}>{comment.user}</Text>
                      <Text style={styles.commentTime}>{comment.time}</Text>
                    </View>
                    <Text style={styles.commentBody}>{comment.body}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.commentComposer}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Коммент бичих..."
                placeholderTextColor="#84979E"
                style={styles.commentInput}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={addComment}
              />
              <Pressable
                disabled={!commentText.trim() || commentSaving}
                onPress={addComment}
                style={[styles.commentSend, (!commentText.trim() || commentSaving) && styles.commentSendDisabled]}
              >
                <Text style={styles.commentSendText}>↑</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(8,25,30,0.9)', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(220,244,248,0.3)', marginBottom: 14, shadowColor: '#02090c', shadowOpacity: 0.42, shadowRadius: 22, shadowOffset: { width: 0, height: 11 } },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  authorButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIdentity: { flex: 1, minWidth: 0 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.46)' },
  avatarImage: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.68)', backgroundColor: '#10262D' },
  avatarText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  user: { color: colors.text, fontSize: 11, fontWeight: '900' },
  time: { color: '#C9D7DD', fontSize: 9, fontWeight: '700', marginTop: 2 },
  media: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#000' },
  body: { padding: 10 },
  title: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: 4 },
  description: { color: '#D4E0E5', fontSize: 11, lineHeight: 16, marginBottom: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', paddingTop: 8 },
  actionButton: { height: 30, minWidth: 43, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { color: '#F4FAFC', fontSize: 22, lineHeight: 24 },
  likedIcon: { color: '#FF496C' },
  likedCount: { color: '#FF8DA3' },
  commentIcon: { color: '#F4FAFC', fontSize: 18, lineHeight: 20, transform: [{ rotate: '-25deg' }] },
  actionCount: { color: '#D8E3E8', fontSize: 11, fontWeight: '900' },
  share: { height: 30, alignItems: 'center', justifyContent: 'center' },
  shareAtEnd: { marginLeft: 'auto' },
  shareText: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  followButton: { marginLeft: 'auto', height: 28, minWidth: 68, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.accent },
  friendButton: { backgroundColor: 'rgba(57,255,136,0.12)', borderWidth: 1, borderColor: 'rgba(57,255,136,0.58)' },
  followButtonDisabled: { opacity: 0.5 },
  followButtonText: { color: '#102014', fontSize: 9, fontWeight: '900' },
  friendButtonText: { color: '#8CFFB7' },
  swipeHint: { position: 'absolute', top: 7, right: 7, color: colors.text, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  video: { width: '100%', height: '100%' },
  videoBadge: { position: 'absolute', left: 9, bottom: 9, borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(3,10,13,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  videoBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  gallery: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center' },
  close: { position: 'absolute', top: 50, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.text, fontSize: 32, lineHeight: 36 },
  fullMedia: { width: 390, height: 720, backgroundColor: '#000' },
  commentBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.46)' },
  commentDismissArea: { flex: 1 },
  commentSheet: { height: '72%', backgroundColor: '#09191E', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(220,244,248,0.28)', overflow: 'hidden' },
  commentHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 9 },
  commentHeader: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  commentHeading: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  commentClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  commentCloseText: { color: '#D8E3E8', fontSize: 26, lineHeight: 28 },
  commentList: { flex: 1 },
  commentListContent: { padding: 16, gap: 14 },
  commentState: { color: '#AFC1C8', textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 28 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  commentAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  commentBubble: { flex: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 11, paddingVertical: 9 },
  commentMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  commentUser: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  commentTime: { color: '#9FB0B7', fontSize: 8, fontWeight: '700' },
  commentBody: { color: '#D8E3E8', fontSize: 12, lineHeight: 17, marginTop: 4 },
  commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(3,13,16,0.92)' },
  commentInput: { flex: 1, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF', paddingHorizontal: 15, fontSize: 13 },
  commentSend: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  commentSendDisabled: { opacity: 0.35 },
  commentSendText: { color: '#102014', fontSize: 21, fontWeight: '900' }
});
