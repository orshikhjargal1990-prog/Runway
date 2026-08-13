import { Platform } from 'react-native';
import { fetchLoginSlides, saveLoginSlidesToSupabase } from '../lib/runboostApi';

export type LoginSlide = {
  id: string;
  eyebrow: string;
  titleBefore: string;
  accent: string;
  titleAfter: string;
  subtitle: string;
  mediaType: 'image' | 'video';
  mediaUri: string;
  mediaName: string;
  enabled: boolean;
};

export const DEFAULT_LOGIN_SLIDES: LoginSlide[] = [
  {
    id: 'default-challenges',
    eyebrow: 'ЧЭЛЛЕНЖ',
    titleBefore: 'Зорилгоо ',
    accent: 'чэлленжээр',
    titleAfter: '\nэхлүүлээрэй',
    subtitle: 'Сонирхолтой чэлленжид нэгдэж, ахиц бүрээ тэмдэглэн шинэ амжилтад хүрээрэй.',
    mediaType: 'image',
    mediaUri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1400&q=85',
    mediaName: 'runboost-challenge.jpg',
    enabled: true
  },
  {
    id: 'default-routes',
    eyebrow: 'ГҮЙЛТИЙН ЗАМ',
    titleBefore: 'Хотын шилдэг ',
    accent: 'маршрутаа',
    titleAfter: '\nсонгоорой',
    subtitle: 'Ойр орчмын гүйлтийн замуудыг нээж, зай болон түвшиндээ тохирох маршрутаар гүйгээрэй.',
    mediaType: 'image',
    mediaUri: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1400&q=85',
    mediaName: 'runboost-routes.jpg',
    enabled: true
  },
  {
    id: 'default-community',
    eyebrow: 'RUNBOOST НИЙГЭМЛЭГ',
    titleBefore: 'Гүйгчидтэй ',
    accent: 'нэгдэж',
    titleAfter: '\nгүйлтээ хуваалц',
    subtitle: 'Өөрийн гүйлтээ постолж, бусдын амжилтаас урам авч, хамтдаа илүү хол гүйцгээе.',
    mediaType: 'image',
    mediaUri: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1400&q=85',
    mediaName: 'runboost-community.jpg',
    enabled: true
  }
];

const DB_NAME = 'runboost-content';
const STORE_NAME = 'content';
const SLIDES_KEY = 'login-slides';
const CONTENT_VERSION = 2;
export const LOGIN_SLIDES_VERSION_KEY = 'runboost.loginSlides.version';

function openContentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadLoginSlides(): Promise<LoginSlide[]> {
  try {
    const remoteSlides = await fetchLoginSlides();
    if (remoteSlides.length) return remoteSlides;
  } catch {
    // Keep bundled content available until the database migration is applied.
  }

  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
    return DEFAULT_LOGIN_SLIDES;
  }

  try {
    const db = await openContentDb();
    return await new Promise(resolve => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(SLIDES_KEY);
      request.onsuccess = () => {
        const stored = request.result;
        if (stored?.version === CONTENT_VERSION && Array.isArray(stored.slides) && stored.slides.length) {
          resolve(stored.slides);
          return;
        }

        // Replace the original single-slide format with the three curated onboarding slides.
        db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
          version: CONTENT_VERSION,
          slides: DEFAULT_LOGIN_SLIDES
        }, SLIDES_KEY);
        resolve(DEFAULT_LOGIN_SLIDES);
      };
      request.onerror = () => resolve(DEFAULT_LOGIN_SLIDES);
    });
  } catch {
    return DEFAULT_LOGIN_SLIDES;
  }
}

export async function saveLoginSlides(slides: LoginSlide[]): Promise<void> {
  const savedSlides = await saveLoginSlidesToSupabase(slides);

  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
    return;
  }

  const db = await openContentDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
      version: CONTENT_VERSION,
      slides: savedSlides
    }, SLIDES_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  window.localStorage.setItem(LOGIN_SLIDES_VERSION_KEY, String(Date.now()));
  window.dispatchEvent(new Event('runboost-login-slides-updated'));
}
