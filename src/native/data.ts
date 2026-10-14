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
    description: 'Өглөөний богино гүйлтээр идэвхтэй амьдралыг дэмжих community challenge.',
    organizerInfo: 'Coffee Bean нь хотын өглөөний хөдөлгөөн, найзуудтайгаа хамт гүйх соёлыг дэмждэг кофе брэнд.',
    rewardInfo: '25 км зорилгоо биелүүлсэн оролцогчдод free latte эрх, finisher badge болон partner coupon олгоно.',
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
    description: 'Хаврын улирлыг 100 км-ийн хуримтлуулдаг гүйлтээр эхлүүлэх community challenge.',
    organizerInfo: 'RunSync Community нь сонирхогч гүйгчдийг тогтмол хөдөлгөөн, эерэг өрсөлдөөнөөр нэгтгэдэг клуб.',
    rewardInfo: 'Зорилгоо дүүргэсэн гүйгчдэд digital certificate, profile badge болон leaderboard recognition нэмэгдэнэ.',
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
    description: 'Байгууллагын ажилтнуудын эрүүл амьдрал, багийн идэвхийг дэмжих corporate challenge.',
    organizerInfo: 'Unitel Group ажилтнууд болон running community-д зориулан эрүүл хэв маягийг дэмжих challenge зохион байгуулж байна.',
    rewardInfo: '50 км зорилго биелүүлсэн оролцогчдод digital certificate, leaderboard badge болон байгууллагын дотоод урамшуулал олгоно.',
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
    description: 'Ажилтнуудын өдөр тутмын алхам, гүйлтийн идэвхийг нэмэх богино хугацааны challenge.',
    organizerInfo: 'MCS Group нь ажилтнуудын эрүүл мэнд, багийн оролцоог дэмжих дотоод хөтөлбөрийн хүрээнд зохион байгуулж байна.',
    rewardInfo: '20 км зорилгоо биелүүлсэн оролцогчдод finisher badge, багийн leaderboard оноо болон дотоод шагнал нэмэгдэнэ.',
    registrationEndsInSeconds: 2 * 86400 + 3 * 3600
  }
];

export const MARATHON_CHALLENGES: Challenge[] = [
  {
    id: 'marathon-ub-42',
    title: 'Улаанбаатар 42K',
    org: 'RunBoost Marathon',
    type: 'Happy',
    group: 'marathon',
    goalKm: 42.2,
    reward: '42K medal',
    color: '#f43f5e',
    image: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=80',
      'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=900&q=80',
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=80'
    ],
    description: 'Хотын төвөөр нэг өдөр зохион байгуулагдах холын зайн марафон. Оролцогч гүйлтээ хэсэгчлэн тасалж оруулахгүй, бүртгэсэн төрөлдөө тохирсон өдөр, цагт замаа бүрэн туулна.',
    organizerInfo: 'RunBoost Marathon нь хотын марафон, цахим гүйлтийн эвентүүдийг зохион байгуулдаг running platform баг.',
    rewardInfo: 'Ангиллаа амжилттай дуусгасан оролцогч бүрт 42K medal, finisher certificate болон profile badge олгоно.',
    registrationInfo: 'Биеэр болон цахимаар оролцох боломжтой. Төрлөө сонгоод бүртгэлээ баталгаажуулна.',
    registrationEndsInSeconds: 12 * 86400
  },
  {
    id: 'marathon-bogd-trail',
    title: 'Богд хан Trail 50K',
    org: 'Nomad Trail Club',
    type: 'Happy',
    group: 'marathon',
    goalKm: 50,
    reward: 'Trail badge',
    color: '#22c55e',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900&q=80',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&q=80'
    ],
    description: 'Уулын зам, шороон trail бүхий нэг өдрийн холын зайн марафон. Гүйлтийг тухайн өдөр тасралтгүй хийж бүртгүүлэх бөгөөд дараа нь хэсэгчлэн нэмж оруулахгүй.',
    organizerInfo: 'Nomad Trail Club нь уулын замын гүйлт, outdoor safety, trail community-г хөгжүүлдэг клуб.',
    rewardInfo: 'Trail badge, finisher certificate болон top finisher leaderboard recognition олгоно.',
    registrationInfo: 'Биеэр trail route дээр, эсвэл баталгаажсан цахим GPS гүйлтээр оролцоно.',
    registrationEndsInSeconds: 16 * 86400
  },
  {
    id: 'marathon-steppe-ultra',
    title: 'Steppe Ultra 70K',
    org: 'Mongolia Ultra',
    type: 'Corporate',
    group: 'marathon',
    goalKm: 70,
    reward: 'Ultra patch',
    color: '#f59e0b',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900&q=80',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=80',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80'
    ],
    description: 'Тал хээрийн урт замд зориулагдсан endurance марафон. Энэ нь өдөр бүр бага багаар км цуглуулах challenge биш, event өдөр нэг удаагийн гүйлтээр үр дүнгээ баталгаажуулна.',
    organizerInfo: 'Mongolia Ultra нь холын зайн endurance гүйлт, ultra community event-үүд дээр төвлөрдөг зохион байгуулагч.',
    rewardInfo: 'Ultra patch, digital certificate болон category leaderboard recognition олгоно.',
    registrationInfo: 'Checkpoint, усны цэг, цахим оролцооны баталгаажуулалтын заавар бүртгэл дээр харагдана.',
    registrationEndsInSeconds: 21 * 86400
  },
  {
    id: 'marathon-night-42',
    title: 'Night Marathon 42K',
    org: 'City Runners',
    type: 'Happy',
    group: 'marathon',
    goalKm: 42.2,
    reward: 'Night finisher',
    color: '#6366f1',
    image: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=80',
      'https://images.unsplash.com/photo-1486218119243-13883505764c?w=900&q=80',
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=80'
    ],
    description: 'Оройн гэрэлт хотын маршрутаар нэг өдөр гүйх марафон. Оролцогч бүр сонгосон ангиллынхаа зайг event-ийн заасан цагт бүрэн гүйж дуусгана.',
    organizerInfo: 'City Runners нь хотын гүйлтийн соёл, оройн group run event-үүдийг хөгжүүлдэг community.',
    rewardInfo: 'Night finisher badge, reflective kit coupon болон finish certificate олгоно.',
    registrationInfo: 'Гэрэл ойлгогч хэрэгсэлтэй оролцох шаардлагатай. Цахим оролцогч GPS баталгаажуулалт илгээнэ.',
    registrationEndsInSeconds: 9 * 86400
  },
  {
    id: 'marathon-river-55',
    title: 'Tuul River 55K',
    org: 'River Run Crew',
    type: 'Happy',
    group: 'marathon',
    goalKm: 55,
    reward: 'River medal',
    color: '#06b6d4',
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&q=80',
      'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=900&q=80',
      'https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=80'
    ],
    description: 'Туул гол дагасан урт маршрутын марафон. Энэ event нь тухайн өдөр замаа бүтнээр нь туулж баталгаажуулах зарчимтай.',
    organizerInfo: 'River Run Crew нь голын эргийн маршрут, байгальд ээлтэй running event зохион байгуулдаг баг.',
    rewardInfo: 'River medal, finisher certificate болон partner reward draw-д оролцох эрх олгоно.',
    registrationInfo: 'Биеэр оролцогчид старт дээр ирж дугаараа авна. Цахим оролцогчид event өдөр GPS гүйлтээ илгээнэ.',
    registrationEndsInSeconds: 18 * 86400
  },
  {
    id: 'marathon-century-100',
    title: 'Century Ultra 100K',
    org: 'RunBoost Elite',
    type: 'Corporate',
    group: 'marathon',
    goalKm: 100,
    reward: 'Elite trophy',
    color: '#a8ff18',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&q=80',
      'https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=80',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=80'
    ],
    description: '100 км-ийн ultra марафон. Оролцогчид заасан өдөр урт зайн гүйлтээ нэг event хэлбэрээр хийж баталгаажуулна, олон өдөр хувааж оруулах боломжгүй.',
    organizerInfo: 'RunBoost Elite нь өндөр түвшний ultra runner-үүдэд зориулсан endurance event зохион байгуулдаг баг.',
    rewardInfo: 'Elite trophy, ultra finisher certificate болон тусгай profile recognition олгоно.',
    registrationInfo: 'Урьдчилсан баталгаажуулалт шаардлагатай. Биеэр, цахим, элит багцын аль нэгийг сонгоно.',
    registrationEndsInSeconds: 30 * 86400
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
