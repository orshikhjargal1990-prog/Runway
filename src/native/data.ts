import type { Challenge, Post, Runner } from './types';

export const CHALLENGES: Challenge[] = [
  {
    id: 'happy-coffee',
    title: 'Coffee Run',
    org: 'Coffee Bean',
    type: 'Happy',
    group: '5k',
    goalKm: 25,
    reward: 'Free Latte',
    color: '#ff6b2c',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80',
    registrationEndsInSeconds: 2 * 3600 + 15 * 60
  },
  {
    id: 'happy-spring',
    title: 'Spring Kickoff',
    org: 'RunSync Community',
    type: 'Happy',
    group: '5k',
    goalKm: 100,
    color: '#22c55e',
    image: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1200&q=80',
    registrationEndsInSeconds: 4 * 86400 + 3600
  },
  {
    id: 'corp-unitel',
    title: 'Energy Run 2026',
    org: 'Unitel Group',
    type: 'Corporate',
    group: '10k',
    goalKm: 50,
    color: '#6366f1',
    image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80',
    registrationEndsInSeconds: 7 * 86400
  },
  {
    id: 'corp-mcs',
    title: 'Health First',
    org: 'MCS Group',
    type: 'Corporate',
    group: '10k',
    goalKm: 20,
    color: '#10b981',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&q=80',
    registrationEndsInSeconds: 2 * 86400 + 3 * 3600
  }
];

export const RUNNERS: Runner[] = [
  { id: 'r1', name: 'Cory Wharton-Malcolm', totalKm: 12483, avatar: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=300&q=80' },
  { id: 'r2', name: 'Elia Viviani', totalKm: 18726, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80' },
  { id: 'r3', name: 'Solongo R.', totalKm: 6942, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&q=80' }
];

export const INITIAL_POSTS: Post[] = [
  {
    id: 'p1',
    userId: 'demo-batbold',
    user: 'Batbold E.',
    userAvatar: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=300&q=80',
    isMe: false,
    isFollowing: false,
    title: 'Өглөөний гүйлт амжилттай!',
    description: 'Сайхан өглөөний route байлаа.',
    media: [{ id: 'm1', type: 'image', uri: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1200&q=80' }],
    time: '2 цагийн өмнө',
    distanceKm: 7.4,
    duration: '42:30',
    likeCount: 12,
    commentCount: 2,
    likedByMe: false
  }
];
