import type { MarathonRegistrationCategory } from './types';

export const DEFAULT_MARATHON_REGISTRATION_CATEGORIES: MarathonRegistrationCategory[] = [
  {
    id: 'regular',
    title: 'Энгийн',
    enabled: true,
    options: [
      { id: 'regular-full', title: 'Бүтэн марафон / Энгийн/', distance: '42.2 км', age: '18+', tone: '#EF476F', note: 'Энгийн дугаар', enabled: true },
      { id: 'regular-half', title: 'Хагас марафон / Энгийн/', distance: '21.1 км', age: '18+', tone: '#4663E6', note: 'Энгийн дугаар', enabled: true },
      { id: 'regular-10k', title: '10 км /Энгийн/', distance: '10 км', age: '16+', tone: '#2FA55A', note: 'Энгийн дугаар', enabled: true },
      { id: 'regular-5k', title: '5 км /Энгийн/', distance: '5 км', age: '16+', tone: '#F5B82E', note: 'Энгийн дугаар', enabled: true }
    ]
  },
  {
    id: 'para',
    title: 'Пара',
    enabled: true,
    options: [
      { id: 'para-full', title: 'Бүтэн марафон / Пара/', distance: '42.2 км', age: '18+', tone: '#EF476F', note: 'Пара дугаар', enabled: true },
      { id: 'para-half', title: 'Хагас марафон / Пара/', distance: '21.1 км', age: '18+', tone: '#4663E6', note: 'Пара дугаар', enabled: true },
      { id: 'para-half-no-arm', title: 'Гар дутуу 21.1км', distance: '21.1 км', age: '18+', tone: '#4663E6', note: 'Пара дугаар', enabled: true },
      { id: 'para-10k', title: '10 км /Пара/', distance: '10 км', age: '16+', tone: '#2FA55A', note: 'Пара дугаар', enabled: true },
      { id: 'para-5k', title: '5 км /Пара/', distance: '5 км', age: '16+', tone: '#F5B82E', note: 'Пара дугаар', enabled: true },
      { id: 'para-wheelchair-1500', title: 'Тэргэнцэртэй 1500 м', distance: '1500 м', age: '16+', tone: '#7C0AA3', note: 'Пара дугаар', enabled: true },
      { id: 'para-hearing-1500', title: 'Сонсголын бэрхшээлтэй 1500м', distance: '1500 м', age: '16+', tone: '#7C0AA3', note: 'Пара дугаар', enabled: true },
      { id: 'para-sight-1500', title: 'Харааны бэрхшээлтэй 1500м', distance: '1500 м', age: '16+', tone: '#7C0AA3', note: 'Пара дугаар', enabled: true },
      { id: 'para-sit-1500', title: 'Саажилттай 1500м', distance: '1500 м', age: '16+', tone: '#7C0AA3', note: 'Пара дугаар', enabled: true },
      { id: 'para-mind-1000', title: 'Оюуны бэрхшээлтэй 1000м', distance: '1000 м', age: '16+', tone: '#111111', note: 'Пара дугаар', enabled: true }
    ]
  },
  {
    id: 'guide',
    title: 'Хөтөч',
    enabled: true,
    options: [
      { id: 'guide-full', title: 'Бүтэн марафон / Хөтөч/', distance: '42.2 км', age: '18+', tone: '#EF476F', note: 'Хөтөч дугаар', enabled: true },
      { id: 'guide-half', title: 'Хагас марафон / Хөтөч/', distance: '21.1 км', age: '18+', tone: '#4663E6', note: 'Хөтөч дугаар', enabled: true },
      { id: 'guide-10k', title: '10 км /Хөтөч/', distance: '10 км', age: '16+', tone: '#2FA55A', note: 'Хөтөч дугаар', enabled: true },
      { id: 'guide-5k', title: '5 км /Хөтөч/', distance: '5 км', age: '16+', tone: '#F5B82E', note: 'Хөтөч дугаар', enabled: true }
    ]
  },
  {
    id: 'assistant',
    title: 'Туслах',
    enabled: true,
    options: [
      { id: 'assistant-start', title: 'Стартын туслах', distance: 'Start zone', age: '16+', tone: '#06B6D4', note: 'Туслах эрх', enabled: true },
      { id: 'assistant-course', title: 'Замын туслах', distance: 'Course', age: '16+', tone: '#22C55E', note: 'Туслах эрх', enabled: true },
      { id: 'assistant-water', title: 'Усны цэгийн туслах', distance: 'Aid station', age: '16+', tone: '#F5B82E', note: 'Туслах эрх', enabled: true },
      { id: 'assistant-finish', title: 'Finish туслах', distance: 'Finish zone', age: '16+', tone: '#EF476F', note: 'Туслах эрх', enabled: true }
    ]
  }
];
