export type TabKey = 'home' | 'run' | 'explore' | 'profile';

export type ChallengeType = 'Happy' | 'Corporate';
export type ChallengeGroup = '5k' | '10k';

export type Challenge = {
  id: string;
  title: string;
  org: string;
  type: ChallengeType;
  group: ChallengeGroup;
  goalKm: number;
  reward?: string;
  color: string;
  image: string;
  registrationEndsInSeconds: number;
};

export type Runner = {
  id: string;
  name: string;
  totalKm: number;
  avatar: string;
};

export type MediaItem = {
  id: string;
  uri: string;
  type: 'image' | 'video';
};

export type Post = {
  id: string;
  userId?: string;
  user: string;
  userAvatar?: string;
  isMe: boolean;
  isFollowing?: boolean;
  title: string;
  description: string;
  media: MediaItem[];
  time: string;
  distanceKm?: number;
  duration?: string;
  likeCount?: number;
  commentCount?: number;
  likedByMe?: boolean;
};

export type PostComment = {
  id: string;
  user: string;
  userId: string;
  body: string;
  time: string;
};
