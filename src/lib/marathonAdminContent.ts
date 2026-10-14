import { MARATHON_CHALLENGES } from '../native/data';
import { DEFAULT_MARATHON_REGISTRATION_CATEGORIES } from '../native/marathonRegistration';
import type { Challenge } from '../native/types';

const marathonContentKey = 'runboost.adminMarathonChallenges';

function withDefaults(challenge: Challenge): Challenge {
  return {
    ...challenge,
    group: 'marathon',
    galleryImages: challenge.galleryImages?.length ? challenge.galleryImages : [challenge.image],
    marathonRegistrationCategories: challenge.marathonRegistrationCategories?.length
      ? challenge.marathonRegistrationCategories
      : DEFAULT_MARATHON_REGISTRATION_CATEGORIES
  };
}

export function getAdminMarathonChallenges(): Challenge[] {
  if (typeof window === 'undefined') return MARATHON_CHALLENGES.map(withDefaults);
  try {
    const raw = window.localStorage.getItem(marathonContentKey);
    const saved = raw ? JSON.parse(raw) as Challenge[] : null;
    return (saved?.length ? saved : MARATHON_CHALLENGES).map(withDefaults);
  } catch {
    return MARATHON_CHALLENGES.map(withDefaults);
  }
}

export function saveAdminMarathonChallenges(challenges: Challenge[]) {
  const normalized = challenges.map(withDefaults);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(marathonContentKey, JSON.stringify(normalized));
  }
  return normalized;
}
