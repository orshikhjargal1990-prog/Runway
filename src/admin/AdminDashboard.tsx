import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Bell, CalendarDays, Check, ChevronDown, CircleAlert, Flag, Gauge,
  Building2, LayoutDashboard, LogOut, Menu, MonitorPlay, Plus, Route, Search, Settings,
  ShieldCheck, TrendingUp, UserCheck, UserPlus, Users, X
} from 'lucide-react/dist/cjs/lucide-react.js';
import { LoginContentEditor } from './LoginContentEditor';
import { ClubAdminAccessManager, ClubContentEditor } from './ClubContentEditor';
import { supabase } from '../lib/supabase';
import { deleteAdminChallengeEvent, getAdminChallengeEvents, saveAdminChallengeEvent, type AdminChallengeEvent } from '../lib/adminChallengeContent';
import { getAdminMarathonChallenges, saveAdminMarathonChallenges } from '../lib/marathonAdminContent';
import { deleteAdminRoute, fetchAdminCompetitionPerformance, fetchAdminRegisteredUserDetail, fetchAdminRegisteredUsers, fetchRoutes, saveAdminRoute, type AdminCompetitionPerformance, type AdminRegisteredUserDetail } from '../lib/runboostApi';
import { DEFAULT_MARATHON_REGISTRATION_CATEGORIES } from '../native/marathonRegistration';
import type { Challenge, MarathonRegistrationCategory, MarathonRegistrationOption } from '../native/types';
import { RUN_ROUTES, type Point, type RouteOption } from '../native/routes';

type Section = 'overview' | 'users' | 'events' | 'runs' | 'routes' | 'performance' | 'reports' | 'login-content' | 'club-content' | 'club-admins' | 'marathons';
type UserStatus = 'active' | 'blocked';
type EventStatus = 'active' | 'draft' | 'ended';

type AdminUser = {
  id: string; name: string; email: string; joined: string; totalKm: number; runs: number; status: UserStatus; avatarUrl?: string;
};

type AdminEvent = AdminChallengeEvent;
type CompetitionKind = 'event' | 'marathon';
type CompetitionOption = {
  id: string;
  title: string;
  org: string;
  goalKm: number;
  kind: CompetitionKind;
  status: EventStatus;
  participants: number;
};
type CompetitionLeaderboardRow = AdminCompetitionPerformance & {
  userId: string;
  name: string;
  email: string;
  rank: number;
  distanceKm: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
  progress: number;
  runCount: number;
  finished: boolean;
  lastRunAt: string;
};

const initialUsers: AdminUser[] = [
  { id: 'seed-1', name: 'Батболд Э.', email: 'batbold@run.mn', joined: '2026.08.11', totalKm: 124.8, runs: 38, status: 'active' },
  { id: 'seed-2', name: 'Солонго Р.', email: 'solongo@run.mn', joined: '2026.08.09', totalKm: 86.2, runs: 24, status: 'active' },
  { id: 'seed-3', name: 'Төгөлдөр Б.', email: 'runner@example.com', joined: '2026.08.04', totalKm: 52.7, runs: 17, status: 'active' },
  { id: 'seed-4', name: 'Анударь Ц.', email: 'anu@run.mn', joined: '2026.07.28', totalKm: 31.5, runs: 12, status: 'blocked' },
  { id: 'seed-5', name: 'Мөнх-Эрдэнэ Г.', email: 'munkh@run.mn', joined: '2026.07.22', totalKm: 208.4, runs: 61, status: 'active' },
  { id: 'seed-6', name: 'Номин А.', email: 'nomin@run.mn', joined: '2026.07.19', totalKm: 74.1, runs: 22, status: 'active' }
];

const initialEvents: AdminEvent[] = [
  { id: 'admin-seed-coffee', name: 'Coffee Run', org: 'Coffee Bean', date: '2026-08-16', distance: 25, participants: 248, status: 'active', type: 'Happy', group: '5k', reward: 'Free Latte', color: '#ff6b2c', coverImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80', description: 'Coffee Bean-тэй хамтарсан хотын хөгжилтэй гүйлтийн challenge.', registrationInfo: 'Бүртгэл 08 сарын 16 хүртэл нээлттэй.', organizerInfo: 'Coffee Bean нь хотын идэвхтэй амьдралын хэв маягийг дэмждэг кофе брэнд бөгөөд өглөөний гүйлтийн community event-үүд зохион байгуулдаг.', rewardInfo: 'Зорилгоо биелүүлсэн оролцогчдод free latte эрх, finisher badge болон partner coupon олгоно.' },
  { id: 'admin-seed-energy', name: 'Energy Run 2026', org: 'Unitel Group', date: '2026-08-23', distance: 50, participants: 186, status: 'active', type: 'Corporate', group: '10k', reward: '50 км', color: '#6366f1', coverImage: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80', description: 'Байгууллагын идэвх, эрүүл амьдралыг дэмжих corporate challenge.', registrationInfo: 'Unitel Group-ийн оролцогчдод нээлттэй.', organizerInfo: 'Unitel Group ажилтнуудын эрүүл мэнд, багийн идэвхийг дэмжих зорилгоор corporate challenge зохион байгуулж байна.', rewardInfo: '50 км зорилго биелүүлсэн оролцогчдод digital certificate, leaderboard badge болон байгууллагын дотоод шагнал олгоно.' },
  { id: 'admin-seed-autumn', name: 'Намрын марафон', org: 'Runboost', date: '2026-09-12', distance: 42, participants: 0, status: 'draft', type: 'Happy', group: '10k', reward: '42 км', color: '#22c55e', coverImage: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1200&q=80', description: 'Намрын улирлын гол марафон event.', registrationInfo: 'Бүртгэлийн дэлгэрэнгүй удахгүй.', organizerInfo: 'Runboost нь хотын гүйгчдэд зориулсан улирлын challenge, марафон event-үүд зохион байгуулдаг баг.', rewardInfo: '42 км зорилгоо биелүүлсэн оролцогчдод finisher certificate болон leaderboard badge олгоно.' },
  { id: 'admin-seed-spring', name: 'Spring Kickoff', org: 'RunSync Community', date: '2026-05-18', distance: 100, participants: 392, status: 'ended', type: 'Happy', group: '5k', reward: '100 км', color: '#10b981', coverImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&q=80', description: 'Хаврын улирлын community challenge.', registrationInfo: 'Event дууссан.', organizerInfo: 'RunSync Community нь гүйгчдийг тогтмол хөдөлгөөн, хамтын зорилгоор нэгтгэдэг community.', rewardInfo: 'Challenge дууссан оролцогчдод digital certificate болон profile badge хадгалагдсан.' }
];

const recentRuns = [
  { name: 'Мөнх-Эрдэнэ Г.', route: 'Үндэсний цэцэрлэгт хүрээлэн', distance: 12.4, duration: '01:08:22', pace: "5'30\"", time: '12 мин' },
  { name: 'Батболд Э.', route: 'Сүхбаатарын талбай', distance: 7.4, duration: '00:42:30', pace: "5'44\"", time: '38 мин' },
  { name: 'Солонго Р.', route: 'Туул голын зам', distance: 5.2, duration: '00:31:12', pace: "6'00\"", time: '1 цаг' },
  { name: 'Номин А.', route: 'Зайсан тойрог', distance: 8.8, duration: '00:49:41', pace: "5'38\"", time: '2 цаг' },
  { name: 'Төгөлдөр Б.', route: 'Богд хан уул', distance: 14.1, duration: '01:27:05', pace: "6'10\"", time: '3 цаг' }
];

const navItems = [
  { id: 'overview' as Section, label: 'Хяналтын самбар', icon: LayoutDashboard },
  { id: 'users' as Section, label: 'Бүртгэлтэй хэрэглэгч', icon: Users },
  { id: 'events' as Section, label: 'Эвентүүд', icon: CalendarDays },
  { id: 'marathons' as Section, label: 'Марафон', icon: Gauge },
  { id: 'performance' as Section, label: 'Гүйцэтгэл', icon: TrendingUp },
  { id: 'runs' as Section, label: 'Гүйлтүүд', icon: Route },
  { id: 'routes' as Section, label: 'Гүйлтийн газрууд', icon: Route },
  { id: 'club-admins' as Section, label: 'Клубын эрх', icon: UserPlus },
  { id: 'club-content' as Section, label: 'Клубын контент', icon: Building2 },
  { id: 'login-content' as Section, label: 'Нэвтрэх контент', icon: MonitorPlay },
  { id: 'reports' as Section, label: 'Тайлан, гомдол', icon: Flag, badge: 3 }
];

function Status({ kind }: { kind: UserStatus | EventStatus | 'open' | 'resolved' }) {
  const labels = { active: 'Идэвхтэй', blocked: 'Хаагдсан', draft: 'Ноорог', ended: 'Дууссан', open: 'Шинэ', resolved: 'Шийдсэн' };
  return <span className={`admin-status status-${kind}`}><i />{labels[kind]}</span>;
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return <span className={`admin-avatar ${small ? 'small' : ''}`}>{name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>;
}

export function AdminDashboard() {
  const [accessState, setAccessState] = useState<'checking' | 'signed-out' | 'denied' | 'ready'>('checking');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [users, setUsers] = useState(initialUsers);
  const [events, setEvents] = useState<AdminEvent[]>(() => {
    const saved = getAdminChallengeEvents();
    return saved.length ? saved : initialEvents;
  });
  const [marathons, setMarathons] = useState<Challenge[]>(() => getAdminMarathonChallenges());
  const [routes, setRoutes] = useState<RouteOption[]>(RUN_ROUTES);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [toast, setToast] = useState('');
  const [reports, setReports] = useState([
    { id: 1, reporter: 'Энхжин С.', target: 'Morning Run нийтлэл', reason: 'Зохисгүй агуулга', date: 'Өнөөдөр, 10:24', status: 'open' as const },
    { id: 2, reporter: 'Билгүүн Т.', target: 'runner_889 хэрэглэгч', reason: 'Хуурамч үзүүлэлт', date: 'Өчигдөр, 18:40', status: 'open' as const },
    { id: 3, reporter: 'Саруул Б.', target: 'Coffee Run сэтгэгдэл', reason: 'Спам', date: '08.10, 14:12', status: 'open' as const }
  ]);

  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setAccessState('signed-out');
        return;
      }
      const { data: allowed, error } = await supabase.rpc('is_admin');
      if (!active) return;
      setAccessState(!error && allowed === true ? 'ready' : 'denied');
      if (error) setAuthError('Админы эрхийг шалгаж чадсангүй. Supabase migration-аа ажиллуулна уу.');
    };
    void checkAccess();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void checkAccess());
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (accessState !== 'ready') return;
    let active = true;
    fetchAdminRegisteredUsers()
      .then(nextUsers => {
        if (active && nextUsers.length) setUsers(nextUsers);
      })
      .catch(() => notify('Хэрэглэгчдийн live датаг уншиж чадсангүй. Migration/RLS тохиргоог шалгана уу.'));
    return () => {
      active = false;
    };
  }, [accessState]);

  useEffect(() => {
    if (accessState !== 'ready') return;
    let active = true;
    fetchRoutes()
      .then(nextRoutes => {
        if (active && nextRoutes.length) setRoutes(nextRoutes);
      })
      .catch(() => notify('Гүйлтийн газруудын live датаг уншиж чадсангүй. Local жагсаалтаар харуулж байна.'));
    return () => {
      active = false;
    };
  }, [accessState]);

  const signInAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: adminEmail.trim().toLowerCase(), password: adminPassword });
    if (error) {
      setAuthError('Имэйл эсвэл нууц үг буруу байна.');
      setAuthBusy(false);
      return;
    }
    const { data: allowed, error: accessError } = await supabase.rpc('is_admin');
    setAccessState(!accessError && allowed === true ? 'ready' : 'denied');
    if (accessError || allowed !== true) setAuthError('Энэ хэрэглэгчид админы эрх олгогдоогүй байна.');
    setAuthBusy(false);
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const filteredUsers = useMemo(() => users.filter(user => {
    const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === 'all' || user.status === filter);
  }), [filter, query, users]);

  const filteredEvents = useMemo(() => events.filter(event => {
    const matchesQuery = `${event.name} ${event.org}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === 'all' || event.status === filter);
  }), [events, filter, query]);

  const selectSection = (next: Section) => {
    setSection(next); setQuery(''); setFilter('all'); setMenuOpen(false);
  };

  if (accessState !== 'ready') {
    return <div className="admin-auth-root"><style>{styles}</style><div className="admin-auth-card">
      <div className="admin-auth-brand"><span>↗</span><strong>RUNBOOST</strong><em>ADMIN</em></div>
      {accessState === 'checking' ? <div className="admin-auth-check">Админы эрх шалгаж байна...</div> : <form onSubmit={signInAdmin} autoComplete="off">
        <h1>{accessState === 'denied' ? 'Хандах эрхгүй' : 'Админ нэвтрэх'}</h1>
        <p>{accessState === 'denied' ? 'Админы эрхтэй хэрэглэгчээр дахин нэвтэрнэ үү.' : 'Контент өөрчлөхийн тулд Supabase админ бүртгэлээр нэвтэрнэ.'}</p>
        {accessState === 'denied' ? <button type="button" className="admin-auth-secondary" onClick={async () => { await supabase.auth.signOut(); setAccessState('signed-out'); setAuthError(''); }}>Өөр бүртгэлээр нэвтрэх</button> : <>
          <label>Имэйл<input type="email" name="runboost-admin-contact" value={adminEmail} onChange={event => setAdminEmail(event.target.value)} autoComplete="new-password" placeholder="admin@example.com" required /></label>
          <label>Нууц үг<input type="password" name="runboost-admin-key" value={adminPassword} onChange={event => setAdminPassword(event.target.value)} autoComplete="new-password" placeholder="••••••••" required /></label>
          {authError ? <div className="admin-auth-error">{authError}</div> : null}
          <button className="admin-auth-submit" disabled={authBusy}>{authBusy ? 'Шалгаж байна...' : 'Нэвтрэх'}</button>
        </>}
      </form>}
    </div></div>;
  }

  return (
    <div className="admin-root">
      <style>{styles}</style>
      <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin-brand"><span className="brand-arrow">↗</span><strong>RUNBOOST</strong><em>ADMIN</em></div>
        <nav>
          <p>УДИРДЛАГА</p>
          {navItems.map(item => <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => selectSection(item.id)}><item.icon size={19}/><span>{item.label}</span>{item.badge ? <b>{item.badge}</b> : null}</button>)}
          <p>СИСТЕМ</p>
          <button onClick={() => notify('Тохиргооны хэсэг удахгүй нэмэгдэнэ')}><Settings size={19}/><span>Тохиргоо</span></button>
        </nav>
        <div className="sidebar-profile"><Avatar name="Админ" small/><span><strong>Админ</strong><small>{adminEmail}</small></span><button aria-label="Гарах" onClick={() => void supabase.auth.signOut()}><LogOut size={17}/></button></div>
      </aside>
      {menuOpen && <button aria-label="Цэс хаах" className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu" aria-label="Цэс" onClick={() => setMenuOpen(true)}><Menu size={22}/></button>
          <div className="topbar-search"><Search size={18}/><input aria-label="Нийт хайлт" placeholder="Хэрэглэгч, эвент хайх..." value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Хайлт цэвэрлэх" onClick={() => setQuery('')}><X size={15}/></button>}</div>
          <button className="icon-button" aria-label="Мэдэгдэл"><Bell size={19}/><i /></button>
          <div className="topbar-user"><Avatar name="Админ" small/><span><strong>Админ</strong><small>Супер админ</small></span><ChevronDown size={15}/></div>
        </header>

        <div className="admin-content">
          {section === 'overview' && <Overview onGo={selectSection} />}
          {section === 'users' && <UsersView users={filteredUsers} filter={filter} setFilter={setFilter} toggle={(id) => setUsers(prev => prev.map(user => user.id === id ? { ...user, status: user.status === 'active' ? 'blocked' : 'active' } : user))} notify={notify}/>}
          {section === 'events' && <EventsView events={filteredEvents} filter={filter} setFilter={setFilter} onAdd={() => setEventModal(true)} onDelete={(id) => { deleteAdminChallengeEvent(id); setEvents(prev => prev.filter(event => event.id !== id)); notify('Эвент устгагдлаа'); }}/>}
          {section === 'marathons' && <MarathonAdminView marathons={marathons} onSave={(next) => { const saved = saveAdminMarathonChallenges(next); setMarathons(saved); notify('Марафоны мэдээлэл хадгалагдлаа'); }} />}
          {section === 'performance' && <CompetitionPerformanceView events={events} marathons={marathons} users={users} />}
          {section === 'runs' && <RunsView />}
          {section === 'routes' && <RoutesAdminView routes={routes} onSave={async (route) => {
            try {
              const saved = await saveAdminRoute(route);
              setRoutes(prev => [saved, ...prev.filter(item => item.id !== saved.id)].sort((a, b) => a.title.localeCompare(b.title)));
              notify('Гүйлтийн газар хадгалагдлаа');
            } catch {
              setRoutes(prev => [route, ...prev.filter(item => item.id !== route.id)].sort((a, b) => a.title.localeCompare(b.title)));
              notify('Supabase-д хадгалж чадсангүй. Энэ session-д local байдлаар нэмэгдлээ.');
            }
          }} onDelete={async (routeId) => {
            try {
              await deleteAdminRoute(routeId);
            } catch {
              notify('Supabase дээр устгаж чадсангүй. Энэ session-д local байдлаар хаслаа.');
            }
            setRoutes(prev => prev.filter(item => item.id !== routeId));
          }} />}
          {section === 'club-admins' && <ClubAdminAccessManager notify={notify} />}
          {section === 'club-content' && <ClubContentEditor notify={notify} />}
          {section === 'login-content' && <LoginContentEditor notify={notify} />}
          {section === 'reports' && <ReportsView reports={reports} resolve={(id) => { setReports(prev => prev.filter(report => report.id !== id)); notify('Гомдлыг шийдвэрлэсэнд тооцлоо'); }}/>}
        </div>
      </main>

      {eventModal && <EventModal onClose={() => setEventModal(false)} onSave={(event) => { const saved = saveAdminChallengeEvent({ ...event, status: 'active' }); setEvents(prev => [saved, ...prev.filter(item => item.id !== saved.id)]); setEventModal(false); notify('Шинэ эвент нүүр хуудсанд бэлэн боллоо'); }}/>}
      {toast && <div className="admin-toast"><Check size={17}/>{toast}</div>}
    </div>
  );
}

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function Overview({ onGo }: { onGo: (section: Section) => void }) {
  const stats = [
    { label: 'Нийт хэрэглэгч', value: '2,847', delta: '+12.5%', icon: Users, tone: 'lime' },
    { label: 'Энэ сарын гүйлт', value: '8,492', delta: '+8.2%', icon: Activity, tone: 'blue' },
    { label: 'Нийт зам', value: '42,680 км', delta: '+16.4%', icon: Route, tone: 'orange' },
    { label: 'Идэвхтэй эвент', value: '12', delta: '+2', icon: CalendarDays, tone: 'violet' }
  ];
  return <>
    <PageTitle title="Өдрийн мэнд, Админ" subtitle="2026 оны 8 сарын 12 · Системийн өнөөдрийн тойм" />
    <section className="stats-grid">{stats.map(stat => <article className="stat-card" key={stat.label}><div className={`stat-icon ${stat.tone}`}><stat.icon size={21}/></div><span>{stat.label}</span><strong>{stat.value}</strong><small><TrendingUp size={14}/>{stat.delta} <em>өмнөх сараас</em></small></article>)}</section>
    <section className="overview-grid">
      <article className="panel chart-panel"><div className="panel-head"><div><h2>Гүйлтийн идэвх</h2><p>Сүүлийн 7 хоногийн гүйлтийн тоо</p></div><button>7 хоног <ChevronDown size={14}/></button></div><div className="chart-area"><div className="chart-y"><span>1,200</span><span>900</span><span>600</span><span>300</span><span>0</span></div><div className="bars">{[62,75,58,88,82,67,94].map((height,index) => <div className="bar-column" key={index}><div className="bar-track"><i style={{height: `${height}%`}} /></div><span>{['Да','Мя','Лх','Пү','Ба','Бя','Ня'][index]}</span></div>)}</div></div></article>
      <article className="panel health-panel"><div className="panel-head"><div><h2>Системийн төлөв</h2><p>Бодит цагийн хяналт</p></div><span className="all-good"><i/>Хэвийн</span></div><div className="health-score"><div><Gauge size={32}/><strong>99.9%</strong><span>Ажиллагаа</span></div></div>{[['API хариу','124 ms'],['Өгөгдлийн сан','Хэвийн'],['Сүүлийн backup','2 цагийн өмнө']].map(row => <div className="health-row" key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></div>)}</article>
    </section>
    <section className="panel recent-panel"><div className="panel-head"><div><h2>Сүүлийн гүйлтүүд</h2><p>Апп дээр бүртгэгдсэн шинэ үйлдлүүд</p></div><button className="text-button" onClick={() => onGo('runs')}>Бүгдийг харах</button></div><RunTable compact/></section>
  </>;
}

function Toolbar({ filter, setFilter, options }: { filter: string; setFilter: (value: string) => void; options: {value:string; label:string}[] }) {
  return <div className="filter-tabs">{options.map(option => <button key={option.value} className={filter === option.value ? 'active' : ''} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div>;
}

function date(value: string) {
  return new Date(value).toLocaleDateString('mn-MN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function pace(seconds: number) {
  return `${Math.floor(seconds / 60)}'${String(seconds % 60).padStart(2, '0')}"`;
}

function buildCompetitionOptions(events: AdminEvent[], marathons: Challenge[]): CompetitionOption[] {
  return [
    ...events.map(event => ({
      id: event.id,
      title: event.name,
      org: event.org,
      goalKm: event.distance,
      kind: 'event' as const,
      status: event.status,
      participants: event.participants
    })),
    ...marathons.map(marathon => ({
      id: marathon.id,
      title: marathon.title,
      org: marathon.org,
      goalKm: marathon.goalKm,
      kind: 'marathon' as const,
      status: 'active' as const,
      participants: Math.max(24, Math.round(marathon.goalKm * 7))
    }))
  ];
}

function buildCompetitionLeaderboard(competition: CompetitionOption, users: AdminUser[]): CompetitionLeaderboardRow[] {
  const seed = competition.id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return users.map((user, index) => {
    const factor = ((seed + index * 17) % 48) / 100 + 0.62;
    const distanceKm = Number(Math.min(competition.goalKm * 1.08, Math.max(0, competition.goalKm * factor)).toFixed(2));
    const durationSeconds = Math.max(900, Math.round(distanceKm * (305 + ((seed + index * 23) % 110))));
    const progress = Math.min(100, Math.round((distanceKm / competition.goalKm) * 100));
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      rank: 0,
      distanceKm,
      durationSeconds,
      paceSecondsPerKm: distanceKm > 0 ? Math.round(durationSeconds / distanceKm) : 0,
      progress,
      runCount: Math.max(1, Math.round(distanceKm / Math.max(3, competition.goalKm / 8))),
      finished: distanceKm >= competition.goalKm,
      lastRunAt: new Date(Date.now() - (index + 1) * 36 * 60 * 60 * 1000).toISOString()
    };
  }).sort((first, second) => {
    if (first.finished !== second.finished) return first.finished ? -1 : 1;
    if (second.distanceKm !== first.distanceKm) return second.distanceKm - first.distanceKm;
    return first.durationSeconds - second.durationSeconds;
  }).map((row, index) => ({ ...row, rank: index + 1 }));
}

function UsersView({ users, filter, setFilter, toggle, notify }: { users: AdminUser[]; filter:string; setFilter:(v:string)=>void; toggle:(id:string)=>void; notify:(m:string)=>void }) {
  const [selectedUser, setSelectedUser] = useState<AdminRegisteredUserDetail | null>(null);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const openDetail = async (user: AdminUser) => {
    setLoadingUserId(user.id);
    try {
      setSelectedUser(await fetchAdminRegisteredUserDetail(user.id));
    } catch {
      setSelectedUser({ ...user, challenges: [], eventHistory: [], runHistory: [] });
      notify('Хэрэглэгчийн дэлгэрэнгүй live датаг уншиж чадсангүй.');
    } finally {
      setLoadingUserId(null);
    }
  };

  return <>
    <PageTitle title="Бүртгэлтэй хэрэглэгч" subtitle={`${users.length.toLocaleString()} хэрэглэгчийн мэдээлэл, чэлленж болон гүйлтийн түүх`} action={<button className="primary-button" onClick={() => notify('Урилгын холбоос хуулагдлаа')}><Plus size={17}/>Хэрэглэгч урих</button>}/>
    <section className="panel table-panel"><div className="table-tools"><Toolbar filter={filter} setFilter={setFilter} options={[{value:'all',label:'Бүгд'},{value:'active',label:'Идэвхтэй'},{value:'blocked',label:'Хаагдсан'}]}/><span>{users.length} үр дүн</span></div><div className="table-scroll"><table><thead><tr><th>ХЭРЭГЛЭГЧ</th><th>ЭЛССЭН</th><th>НИЙТ ЗАМ</th><th>ГҮЙЛТ</th><th>ТӨЛӨВ</th><th></th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><div className="person-cell"><Avatar name={user.name}/><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td>{user.joined}</td><td><strong>{user.totalKm} км</strong></td><td>{user.runs}</td><td><Status kind={user.status}/></td><td><div className="row-actions"><button className="detail-button" onClick={() => void openDetail(user)}>{loadingUserId === user.id ? 'Уншиж...' : 'Дэлгэрэнгүй'}</button><button className="row-action" title={user.status === 'active' ? 'Хэрэглэгч хаах' : 'Хэрэглэгч идэвхжүүлэх'} onClick={() => toggle(user.id)}>{user.status === 'active' ? <CircleAlert size={18}/> : <UserCheck size={18}/>}</button></div></td></tr>)}</tbody></table></div>{users.length === 0 && <Empty title="Хэрэглэгч олдсонгүй"/>}</section>
    {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
  </>;
}

function UserDetailModal({ user, onClose }: { user: AdminRegisteredUserDetail; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="admin-modal user-detail-modal" role="dialog" aria-modal="true" aria-label="Хэрэглэгчийн дэлгэрэнгүй" onMouseDown={event => event.stopPropagation()}><div className="modal-head"><div><h2>{user.name}</h2><p>{user.email} · {user.joined}-нд бүртгүүлсэн</p></div><button aria-label="Хаах" onClick={onClose}><X size={20}/></button></div><div className="user-detail-body"><section className="user-hero"><Avatar name={user.name}/><div><strong>{user.name}</strong><span>{user.email}</span></div><Status kind={user.status}/></section><div className="user-detail-stats"><div><strong>{user.totalKm}</strong><span>Нийт км</span></div><div><strong>{user.runs}</strong><span>Гүйлт</span></div><div><strong>{user.challenges.length}</strong><span>Чэлленж</span></div><div><strong>{user.eventHistory.length}</strong><span>Оролцсон</span></div></div><DetailBlock title="Бүртгүүлсэн чэлленжүүд" empty="Чэлленж бүртгэл алга">{user.challenges.map(item => <article key={`${item.challengeId}-${item.joinedAt}`}><strong>{item.title}</strong><span>{item.org} · {item.goalKm} км · {item.group}</span><small>{date(item.joinedAt)}</small></article>)}</DetailBlock><DetailBlock title="Оролцсон түүхүүд" empty="Арга хэмжээний түүх алга">{user.eventHistory.map(item => <article key={`${item.eventId}-${item.joinedAt}`}><strong>{item.title}</strong><span>{item.clubName} · {item.location}</span><small>{date(item.joinedAt)} · {item.status}</small></article>)}</DetailBlock><DetailBlock title="Гүйлтийн мэдээлэл" empty="Гүйлтийн мэдээлэл алга">{user.runHistory.map(item => <article key={item.id}><strong>{item.routeTitle}</strong><span>{item.challengeTitle ? `${item.challengeTitle} · ` : ''}{item.distanceKm.toFixed(2)} км · {duration(item.durationSeconds)}</span><small>{date(item.completedAt)} · {item.paceSecondsPerKm ? pace(item.paceSecondsPerKm) : '--'} /км</small></article>)}</DetailBlock></div></div></div>;
}

function DetailBlock({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return <section className="user-detail-block"><h3>{title}</h3>{children.length ? <div className="user-detail-list">{children}</div> : <p>{empty}</p>}</section>;
}

function EventsView({ events, filter, setFilter, onAdd, onDelete }: { events:AdminEvent[]; filter:string; setFilter:(v:string)=>void; onAdd:()=>void; onDelete:(id:string)=>void }) {
  return <><PageTitle title="Эвентүүд" subtitle="Нүүр хуудсанд харагдах challenge/event контент" action={<button className="primary-button" onClick={onAdd}><Plus size={17}/>Шинэ эвент</button>}/><section className="panel table-panel"><div className="table-tools"><Toolbar filter={filter} setFilter={setFilter} options={[{value:'all',label:'Бүгд'},{value:'active',label:'Идэвхтэй'},{value:'draft',label:'Ноорог'},{value:'ended',label:'Дууссан'}]}/><span>{events.length} эвент</span></div><div className="event-list">{events.map(event => <article className="event-row" key={event.id}><img className="event-cover-thumb" src={event.coverImage} alt=""/><div className="event-date"><strong>{new Date(event.date).getDate()}</strong><span>{new Date(event.date).getMonth()+1} сар</span></div><div className="event-info"><h3>{event.name}</h3><p>{event.org} · {event.group === '5k' ? '5 км Challenge' : '10+ км Challenge'} · {(event.completionMode ?? (event.group === '5k' ? 'single_run' : 'cumulative')) === 'single_run' ? 'Нэг удаагийн гүйлт' : 'Км хуримтлуулах'}</p><small>{event.description}</small></div><div className="event-metric"><span>Зай</span><strong>{event.distance} км</strong></div><div className="event-metric"><span>Оролцогч</span><strong>{event.participants}</strong></div><Status kind={event.status}/><button className="row-action" aria-label="Эвент устгах" onClick={() => onDelete(event.id)}><X size={18}/></button></article>)}</div>{events.length === 0 && <Empty title="Эвент олдсонгүй"/>}</section></>;
}

function CompetitionPerformanceView({ events, marathons, users }: { events: AdminEvent[]; marathons: Challenge[]; users: AdminUser[] }) {
  const competitions = useMemo(() => buildCompetitionOptions(events, marathons), [events, marathons]);
  const [selectedId, setSelectedId] = useState(competitions[0]?.id ?? '');
  const [remoteRows, setRemoteRows] = useState<AdminCompetitionPerformance[] | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const selected = competitions.find(item => item.id === selectedId) ?? competitions[0];
  const fallbackLeaderboard = useMemo(
    () => selected ? buildCompetitionLeaderboard(selected, users) : [],
    [selected, users]
  );
  const leaderboard = useMemo(
    () => remoteRows?.length ? remoteRows : fallbackLeaderboard,
    [fallbackLeaderboard, remoteRows]
  );
  const finishedCount = leaderboard.filter(row => row.finished).length;
  const averageProgress = leaderboard.length
    ? Math.round(leaderboard.reduce((sum, row) => sum + row.progress, 0) / leaderboard.length)
    : 0;
  const topFive = leaderboard.slice(0, 5);

  useEffect(() => {
    if (!selectedId && competitions[0]) setSelectedId(competitions[0].id);
  }, [competitions, selectedId]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoadingRows(true);
    fetchAdminCompetitionPerformance(selected.id, selected.goalKm)
      .then(rows => {
        if (active) setRemoteRows(rows);
      })
      .catch(() => {
        if (active) setRemoteRows(null);
      })
      .finally(() => {
        if (active) setLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  if (!selected) return <Empty title="Гүйцэтгэл харах эвент эсвэл марафон алга" />;

  return <>
    <PageTitle
      title="Оролцогчдын гүйцэтгэл"
      subtitle="Марафон болон эвентүүдийн rank, progress, pace, гүйлтийн мэдээлэл"
      action={<button className="outline-button">CSV татах</button>}
    />
    <section className="performance-layout">
      <aside className="panel competition-list">
        <div className="panel-head"><div><h2>Эвент / марафон</h2><p>Гүйцэтгэл харах тэмцээнээ сонгоно</p></div></div>
        {competitions.map(item => (
          <button key={item.id} className={selected.id === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>
            <span className={`competition-kind ${item.kind}`}>{item.kind === 'marathon' ? 'Марафон' : 'Эвент'}</span>
            <strong>{item.title}</strong>
            <small>{item.org} · {item.goalKm} км</small>
          </button>
        ))}
      </aside>
      <div className="performance-main">
        <section className="performance-summary">
          <div><Users/><span>Оролцогч<strong>{Math.max(selected.participants, leaderboard.length).toLocaleString()}</strong></span></div>
          <div><Check/><span>Finish<strong>{finishedCount}</strong></span></div>
          <div><TrendingUp/><span>Дундаж progress<strong>{averageProgress}%</strong></span></div>
          <div><Route/><span>Зорилтот зай<strong>{selected.goalKm} км</strong></span></div>
        </section>
        <section className="panel top-five-panel">
          <div className="panel-head"><div><h2>Эхний 5 байр</h2><p>{selected.kind === 'marathon' ? 'Марафоны тэргүүлэгч finisher-үүд' : 'Эвентийн тэргүүлэгч оролцогчид'}</p></div></div>
          <div className="top-five-grid">
            {topFive.map(row => (
              <article key={row.userId} className={`top-five-card place-${row.rank}`}>
                <span className="top-five-rank">#{row.rank}</span>
                <Avatar name={row.name} />
                <strong>{row.name}</strong>
                <small>{row.distanceKm.toFixed(2)} км · {row.progress}%</small>
                <div className="top-five-meta"><span>{duration(row.durationSeconds)}</span><span>{pace(row.paceSecondsPerKm)} /км</span></div>
              </article>
            ))}
          </div>
        </section>
        <section className="panel table-panel">
          <div className="panel-head"><div><h2>Бүх оролцогчдын гүйцэтгэл</h2><p>{selected.title} · {loadingRows ? 'Live гүйцэтгэл уншиж байна...' : remoteRows?.length ? 'Supabase live гүйцэтгэл' : selected.kind === 'marathon' ? 'Марафоны бүх finisher/in progress жагсаалт' : 'Эвентийн бүх оролцогчдын жагсаалт'}</p></div><Status kind={selected.status}/></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>БАЙР</th><th>ОРОЛЦОГЧ</th><th>ГҮЙЦЭТГЭЛ</th><th>ЗАЙ</th><th>ХУГАЦАА</th><th>ТЕМП</th><th>ГҮЙЛТ</th><th>СҮҮЛИЙН БҮРТГЭЛ</th></tr></thead>
              <tbody>{leaderboard.map(row => (
                <tr key={row.userId}>
                  <td><span className={`rank-badge rank-${row.rank <= 3 ? row.rank : 'other'}`}>#{row.rank}</span></td>
                  <td><div className="person-cell"><Avatar name={row.name} small/><span><strong>{row.name}</strong><small>{row.email}</small></span></div></td>
                  <td><div className="progress-cell"><span>{row.progress}%</span><i><b style={{ width: `${row.progress}%` }} /></i>{row.finished ? <em>Finished</em> : <em>In progress</em>}</div></td>
                  <td><strong>{row.distanceKm.toFixed(2)} км</strong></td>
                  <td>{duration(row.durationSeconds)}</td>
                  <td>{pace(row.paceSecondsPerKm)} /км</td>
                  <td>{row.runCount}</td>
                  <td className="muted">{date(row.lastRunAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  </>;
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Зураг уншиж чадсангүй'));
    reader.readAsDataURL(file);
  });
}

function MarathonAdminView({ marathons, onSave }: { marathons: Challenge[]; onSave: (marathons: Challenge[]) => void }) {
  const [selectedId, setSelectedId] = useState(marathons[0]?.id ?? '');
  const selected = marathons.find(item => item.id === selectedId) ?? marathons[0];
  const createMarathon = () => {
    const now = Date.now();
    const next: Challenge = {
      id: `admin-marathon-${now}`,
      title: 'Шинэ марафон',
      org: 'RunBoost Marathon',
      type: 'Happy',
      group: 'marathon',
      goalKm: 42.2,
      reward: 'Medal',
      color: '#EF476F',
      image: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1200&q=80',
      galleryImages: [],
      description: 'Марафоны дэлгэрэнгүй тайлбарыг энд оруулна.',
      organizerInfo: 'Зохион байгуулагч байгууллагын мэдээллийг энд оруулна.',
      rewardInfo: 'Шагнал урамшууллын дэлгэрэнгүй мэдээллийг энд оруулна.',
      registrationInfo: 'Бүртгэлийн мэдээллийг энд оруулна.',
      marathonRegistrationCategories: DEFAULT_MARATHON_REGISTRATION_CATEGORIES,
      registrationEndsInSeconds: 14 * 86400
    };
    onSave([next, ...marathons]);
    setSelectedId(next.id);
  };
  const updateSelected = (patch: Partial<Challenge>) => {
    if (!selected) return;
    onSave(marathons.map(item => item.id === selected.id ? { ...item, ...patch } : item));
  };
  const updateCategories = (categories: MarathonRegistrationCategory[]) => updateSelected({ marathonRegistrationCategories: categories });
  const categories = selected?.marathonRegistrationCategories ?? [];
  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    updateSelected({ image: await readImageFile(file) });
    event.target.value = '';
  };
  const uploadGallery = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !selected) return;
    const images = await Promise.all(files.map(readImageFile));
    updateSelected({ galleryImages: [...(selected.galleryImages ?? []), ...images] });
    event.target.value = '';
  };
  const toggleCategory = (categoryId: MarathonRegistrationCategory['id']) => updateCategories(categories.map(category => category.id === categoryId ? { ...category, enabled: !category.enabled } : category));
  const toggleOption = (categoryId: MarathonRegistrationCategory['id'], optionId: string) => updateCategories(categories.map(category => category.id === categoryId ? { ...category, options: category.options.map(option => option.id === optionId ? { ...option, enabled: option.enabled === false } : option) } : category));
  const updateOption = (categoryId: MarathonRegistrationCategory['id'], optionId: string, patch: Partial<MarathonRegistrationOption>) => updateCategories(categories.map(category => category.id === categoryId ? { ...category, options: category.options.map(option => option.id === optionId ? { ...option, ...patch } : option) } : category));

  if (!selected) return <Empty title="Марафон олдсонгүй" />;
  return <><PageTitle title="Марафоны бүртгэл" subtitle="Дэлгэрэнгүй мэдээлэл, cover/gallery зураг болон бүртгэлийн төрлүүд" action={<div className="title-actions"><button className="outline-button" onClick={createMarathon}><Plus size={16}/>Шинэ марафон</button><button className="primary-button" onClick={() => onSave(marathons)}>Хадгалах</button></div>}/><section className="marathon-admin-grid"><aside className="panel marathon-list">{marathons.map(marathon => <button key={marathon.id} className={selected.id === marathon.id ? 'active' : ''} onClick={() => setSelectedId(marathon.id)}><img src={marathon.image} alt=""/><span><strong>{marathon.title}</strong><small>{marathon.org}</small></span></button>)}</aside><article className="panel marathon-editor"><div className="panel-head"><div><h2>{selected.title}</h2><p>Нүүр хуудас болон дэлгэрэнгүй modal дээр шууд харагдана</p></div></div><div className="marathon-editor-body"><div className="marathon-cover-editor"><img src={selected.image} alt="Cover"/><label className="upload-button">Cover upload<input type="file" accept="image/*" onChange={event => void uploadCover(event)}/></label></div><div className="form-grid marathon-form"><label>Нэр<input value={selected.title} onChange={event => updateSelected({ title: event.target.value })}/></label><label>Зохион байгуулагч<input value={selected.org} onChange={event => updateSelected({ org: event.target.value })}/></label><label>Зай / км<input type="number" value={selected.goalKm} onChange={event => updateSelected({ goalKm: Number(event.target.value) })}/></label><label>Accent өнгө<input type="color" value={selected.color} onChange={event => updateSelected({ color: event.target.value })}/></label><label className="span-2">Дэлгэрэнгүй тайлбар<textarea value={selected.description ?? ''} onChange={event => updateSelected({ description: event.target.value })}/></label><label className="span-2">Компани / байгууллагын мэдээлэл<textarea value={selected.organizerInfo ?? ''} onChange={event => updateSelected({ organizerInfo: event.target.value })}/></label><label className="span-2">Шагнал урамшууллын дэлгэрэнгүй<textarea value={selected.rewardInfo ?? ''} onChange={event => updateSelected({ rewardInfo: event.target.value })}/></label><label className="span-2">Бүртгэлийн мэдээлэл<textarea value={selected.registrationInfo ?? ''} onChange={event => updateSelected({ registrationInfo: event.target.value })}/></label></div><div className="marathon-gallery-admin"><div className="marathon-admin-head"><strong>Галлерей</strong><label className="upload-button">Зураг upload<input type="file" accept="image/*" multiple onChange={event => void uploadGallery(event)}/></label></div><div className="marathon-gallery-list">{(selected.galleryImages ?? []).map((image, index) => <div key={`${image}-${index}`}><img src={image} alt=""/><button onClick={() => updateSelected({ galleryImages: (selected.galleryImages ?? []).filter((_, itemIndex) => itemIndex !== index) })}>Устгах</button></div>)}</div></div><div className="marathon-types-admin"><h3>Төрлүүдийн тохиргоо</h3>{categories.map(category => <section key={category.id} className="marathon-category-admin"><label className="admin-check"><input type="checkbox" checked={category.enabled} onChange={() => toggleCategory(category.id)}/>{category.title}</label><div className="marathon-option-list">{category.options.map(option => <div key={option.id} className="marathon-option-admin"><label className="admin-check"><input type="checkbox" checked={option.enabled !== false} onChange={() => toggleOption(category.id, option.id)}/>Идэвхтэй</label><input value={option.title} onChange={event => updateOption(category.id, option.id, { title: event.target.value })}/><input value={option.distance} onChange={event => updateOption(category.id, option.id, { distance: event.target.value })}/><input value={option.age} onChange={event => updateOption(category.id, option.id, { age: event.target.value })}/><input type="color" value={option.tone} onChange={event => updateOption(category.id, option.id, { tone: event.target.value })}/></div>)}</div></section>)}</div></div></article></section></>;
}

const routeCityBounds: Record<RouteOption['city'], { north: number; south: number; west: number; east: number }> = {
  ulaanbaatar: { north: 47.94, south: 47.84, west: 106.80, east: 107.00 },
  darkhan: { north: 49.51, south: 49.43, west: 105.90, east: 106.03 },
  erdenet: { north: 49.08, south: 49.00, west: 104.00, east: 104.15 }
};

function routeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9а-яөүёү\s-]/gi, '').replace(/\s+/g, '-').slice(0, 42) || `route-${Date.now()}`;
}

function routeDistanceKm(points: Point[]) {
  const toRad = (value: number) => value * Math.PI / 180;
  return points.slice(1).reduce((sum, point, index) => {
    const prev = points[index];
    const dLat = toRad(point.latitude - prev.latitude);
    const dLon = toRad(point.longitude - prev.longitude);
    const lat1 = toRad(prev.latitude);
    const lat2 = toRad(point.latitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return sum + 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);
}

function projectMapPoint(point: Point, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const latRad = point.latitude * Math.PI / 180;
  return {
    x: ((point.longitude + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
  };
}

function unprojectMapPoint(x: number, y: number, zoom: number): Point {
  const scale = 256 * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180) / Math.PI;
  return { latitude, longitude };
}

function pointToViewportPosition(point: Point, center: Point, zoom: number, size: { width: number; height: number }) {
  const projectedPoint = projectMapPoint(point, zoom);
  const projectedCenter = projectMapPoint(center, zoom);
  return {
    x: size.width / 2 + projectedPoint.x - projectedCenter.x,
    y: size.height / 2 + projectedPoint.y - projectedCenter.y
  };
}

function viewportPositionToPoint(x: number, y: number, center: Point, zoom: number, size: { width: number; height: number }): Point {
  const projectedCenter = projectMapPoint(center, zoom);
  return unprojectMapPoint(projectedCenter.x + x - size.width / 2, projectedCenter.y + y - size.height / 2, zoom);
}

function routeMapTiles(center: Point, zoom: number, size: { width: number; height: number }, theme: 'standard' | 'light' | 'contrast' | 'satellite') {
  const projectedCenter = projectMapPoint(center, zoom);
  const startX = Math.floor((projectedCenter.x - size.width / 2) / 256);
  const endX = Math.floor((projectedCenter.x + size.width / 2) / 256);
  const startY = Math.floor((projectedCenter.y - size.height / 2) / 256);
  const endY = Math.floor((projectedCenter.y + size.height / 2) / 256);
  const tiles: { id: string; src: string; left: number; top: number }[] = [];
  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      tiles.push({
        id: `${zoom}-${x}-${y}`,
        src: theme === 'satellite'
          ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`
          : `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        left: size.width / 2 + x * 256 - projectedCenter.x,
        top: size.height / 2 + y * 256 - projectedCenter.y
      });
    }
  }
  return tiles;
}

function emptyRoute(): RouteOption {
  return {
    id: `admin-route-${Date.now()}`,
    title: 'Шинэ гүйлтийн газар',
    city: 'ulaanbaatar',
    area: 'Дүүрэг / байршил',
    distanceKm: 5,
    liveRunners: 0,
    elevationM: 0,
    avgPace: '5:45 /км',
    difficulty: 'Easy',
    estimatedDuration: '0h 30m',
    recentActivities: 0,
    image: 'https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=900&q=80',
    center: { latitude: 47.9038, longitude: 106.9435 },
    coordinates: []
  };
}

function RoutesAdminView({ routes, onSave, onDelete }: { routes: RouteOption[]; onSave: (route: RouteOption) => void | Promise<void>; onDelete: (routeId: string) => void | Promise<void> }) {
  const [selectedId, setSelectedId] = useState(routes[0]?.id ?? '');
  const [draft, setDraft] = useState<RouteOption>(() => routes[0] ?? emptyRoute());
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; center: Point; moved: boolean } | null>(null);
  const [mapSize, setMapSize] = useState({ width: 760, height: 360 });
  const [mapCenter, setMapCenter] = useState(draft.center);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapMode, setMapMode] = useState<'draw' | 'pan'>('draw');
  const [mapTheme, setMapTheme] = useState<'standard' | 'light' | 'contrast' | 'satellite'>('satellite');
  const [showMapGrid, setShowMapGrid] = useState(true);
  const selected = routes.find(route => route.id === selectedId);
  const mapPoints = draft.coordinates.map(point => pointToViewportPosition(point, mapCenter, mapZoom, mapSize));
  const drawnDistance = routeDistanceKm(draft.coordinates);
  const mapTiles = useMemo(() => routeMapTiles(mapCenter, mapZoom, mapSize, mapTheme), [mapCenter, mapSize, mapTheme, mapZoom]);

  useEffect(() => {
    if (selected) {
      setDraft(selected);
      setMapCenter(selected.center);
    }
  }, [selected]);

  useEffect(() => {
    if (!selectedId && routes[0]) setSelectedId(routes[0].id);
  }, [routes, selectedId]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const updateSize = () => setMapSize({
      width: Math.max(320, element.clientWidth),
      height: Math.max(240, element.clientHeight)
    });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const updateDraft = (patch: Partial<RouteOption>) => setDraft(current => ({ ...current, ...patch }));
  const updateCity = (city: RouteOption['city']) => {
    const bounds = routeCityBounds[city];
    const center = { latitude: (bounds.north + bounds.south) / 2, longitude: (bounds.west + bounds.east) / 2 };
    setMapCenter(center);
    setDraft(current => ({
      ...current,
      city,
      center,
      coordinates: []
    }));
  };
  const addMapPoint = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mapMode !== 'draw' || dragRef.current?.moved) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const point = viewportPositionToPoint(x, y, mapCenter, mapZoom, mapSize);
    setDraft(current => ({
      ...current,
      center: current.coordinates.length ? current.center : point,
      coordinates: [...current.coordinates, point]
    }));
  };
  const startMapPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mapMode !== 'pan') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, center: mapCenter, moved: false };
  };
  const moveMapPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
    const projectedCenter = projectMapPoint(drag.center, mapZoom);
    setMapCenter(unprojectMapPoint(projectedCenter.x - dx, projectedCenter.y - dy, mapZoom));
  };
  const stopMapPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mapMode === 'pan' && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };
  const zoomMap = (direction: 1 | -1) => setMapZoom(current => Math.max(11, Math.min(17, current + direction)));
  const handleMapWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomMap(event.deltaY < 0 ? 1 : -1);
  };
  const resetMapView = () => setMapCenter(draft.center);
  const uploadRouteImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    updateDraft({ image: await readImageFile(file) });
    event.target.value = '';
  };
  const saveRoute = async () => {
    const coordinates = draft.coordinates.length ? draft.coordinates : [draft.center];
    const center = coordinates.reduce((sum, point) => ({
      latitude: sum.latitude + point.latitude / coordinates.length,
      longitude: sum.longitude + point.longitude / coordinates.length
    }), { latitude: 0, longitude: 0 });
    await onSave({
      ...draft,
      id: draft.id || routeSlug(draft.title),
      distanceKm: Number(draft.distanceKm) || Number(drawnDistance.toFixed(2)) || 1,
      elevationM: Number(draft.elevationM) || 0,
      liveRunners: Number(draft.liveRunners) || 0,
      recentActivities: Number(draft.recentActivities) || 0,
      center,
      coordinates
    });
    setSelectedId(draft.id);
  };

  return <>
    <PageTitle title="Гүйлтийн газрууд" subtitle="Route-ийн мэдээлэл, байршил болон map дээрх замыг админ зурж оруулна" action={<button className="primary-button" onClick={() => { const next = emptyRoute(); setSelectedId(next.id); setDraft(next); }}><Plus size={17}/>Шинэ газар</button>} />
    <section className="routes-admin-grid">
      <aside className="panel route-admin-list">
        <div className="panel-head"><div><h2>Бүртгэлтэй газрууд</h2><p>{routes.length} route</p></div></div>
        {routes.map(route => (
          <button key={route.id} className={draft.id === route.id ? 'active' : ''} onClick={() => setSelectedId(route.id)}>
            <img src={route.image} alt="" />
            <span><strong>{route.title}</strong><small>{route.area} · {route.distanceKm} км</small></span>
          </button>
        ))}
      </aside>
      <article className="panel route-editor">
        <div className="panel-head"><div><h2>{draft.title}</h2><p>Map дээр дарахад route-ийн цэг нэмэгдэнэ. Цэгүүд дарааллаараа холбогдоно.</p></div><button className="outline-button" onClick={() => void onDelete(draft.id)}><X size={16}/>Устгах</button></div>
        <div className="route-editor-body">
          <div className="route-map-toolbar">
            <div className="map-mode-tabs" aria-label="Map горим">
              <button className={mapMode === 'draw' ? 'active' : ''} onClick={() => setMapMode('draw')}>Зурах</button>
              <button className={mapMode === 'pan' ? 'active' : ''} onClick={() => setMapMode('pan')}>Хөдөлгөх</button>
            </div>
            <div className="route-map-zoom">
              <button onClick={() => zoomMap(-1)} aria-label="Zoom out">−</button>
              <span>{mapZoom}</span>
              <button onClick={() => zoomMap(1)} aria-label="Zoom in">+</button>
            </div>
            <label className="route-map-view">Харагдац<select value={mapTheme} onChange={event => setMapTheme(event.target.value as typeof mapTheme)}><option value="satellite">Satellite</option><option value="standard">Стандарт</option><option value="light">Цэвэр</option><option value="contrast">Тод</option></select></label>
            <label className="route-map-check"><input type="checkbox" checked={showMapGrid} onChange={event => setShowMapGrid(event.target.checked)} />Grid</label>
            <button className="outline-button" onClick={resetMapView}>Center</button>
          </div>
          <div
            ref={mapRef}
            className={`route-map-editor is-${mapMode} map-${mapTheme}`}
            onClick={addMapPoint}
            onPointerDown={startMapPan}
            onPointerMove={moveMapPan}
            onPointerUp={stopMapPan}
            onPointerCancel={stopMapPan}
            onWheel={handleMapWheel}
          >
            <div className="route-map-tiles">
              {mapTiles.map(tile => <img key={tile.id} src={tile.src} alt="" style={{ left: tile.left, top: tile.top }} />)}
            </div>
            {showMapGrid ? <div className="route-map-grid" /> : null}
            <svg viewBox={`0 0 ${mapSize.width} ${mapSize.height}`} preserveAspectRatio="none">
              {mapPoints.length > 1 ? <polyline points={mapPoints.map(point => `${point.x},${point.y}`).join(' ')} /> : null}
            </svg>
            {mapPoints.map((point, index) => <i key={`${point.x}-${point.y}-${index}`} style={{ left: point.x, top: point.y }}>{index + 1}</i>)}
            {!mapPoints.length ? <span className="route-map-empty">{mapMode === 'draw' ? 'Map дээр дарж цэг нэмнэ' : 'Map-аа чирж байрлуулна'}</span> : null}
          </div>
          <div className="route-map-actions">
            <button className="outline-button" onClick={() => updateDraft({ coordinates: draft.coordinates.slice(0, -1) })}>Сүүлийн цэг устгах</button>
            <button className="outline-button" onClick={() => updateDraft({ coordinates: [] })}>Зураг цэвэрлэх</button>
            <button className="outline-button" onClick={() => updateDraft({ distanceKm: Number(drawnDistance.toFixed(2)) })}>Зурсан зайгаар тооцох · {drawnDistance.toFixed(2)} км</button>
          </div>
          <div className="form-grid route-form">
            <label>Нэр<input value={draft.title} onChange={event => updateDraft({ title: event.target.value, id: draft.id.startsWith('admin-route-') ? routeSlug(event.target.value) : draft.id })} /></label>
            <label>Хот<select value={draft.city} onChange={event => updateCity(event.target.value as RouteOption['city'])}><option value="ulaanbaatar">Улаанбаатар</option><option value="darkhan">Дархан</option><option value="erdenet">Эрдэнэт</option></select></label>
            <label>Байршил / дүүрэг<input value={draft.area} onChange={event => updateDraft({ area: event.target.value })} /></label>
            <label>Зай / км<input type="number" value={draft.distanceKm} onChange={event => updateDraft({ distanceKm: Number(event.target.value) })} /></label>
            <label>Өндөршил / м<input type="number" value={draft.elevationM} onChange={event => updateDraft({ elevationM: Number(event.target.value) })} /></label>
            <label>Хүндийн түвшин<select value={draft.difficulty} onChange={event => updateDraft({ difficulty: event.target.value })}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
            <label>Дундаж pace<input value={draft.avgPace} onChange={event => updateDraft({ avgPace: event.target.value })} /></label>
            <label>Тооцоот хугацаа<input value={draft.estimatedDuration} onChange={event => updateDraft({ estimatedDuration: event.target.value })} /></label>
            <label>Live runners<input type="number" value={draft.liveRunners} onChange={event => updateDraft({ liveRunners: Number(event.target.value) })} /></label>
            <label>Recent activities<input type="number" value={draft.recentActivities} onChange={event => updateDraft({ recentActivities: Number(event.target.value) })} /></label>
            <div className="span-2 route-image-upload">
              <img src={draft.image} alt="Route preview" />
              <div>
                <strong>Замын зураг</strong>
                <span>URL бичихгүй, төхөөрөмжөөсөө зураг сонгож оруулна.</span>
                <label className="upload-button">Зураг upload<input type="file" accept="image/*" onChange={event => void uploadRouteImage(event)} /></label>
              </div>
            </div>
          </div>
          <div className="modal-actions route-save-actions"><span>{draft.coordinates.length} цэг зурсан · center {draft.center.latitude.toFixed(4)}, {draft.center.longitude.toFixed(4)}</span><button className="primary-button" disabled={!draft.title.trim() || draft.coordinates.length < 2} onClick={() => void saveRoute()}>Гүйлтийн газар хадгалах</button></div>
        </div>
      </article>
    </section>
  </>;
}

function RunTable({ compact = false }: { compact?: boolean }) {
  const rows = compact ? recentRuns.slice(0,4) : recentRuns;
  return <div className="table-scroll"><table><thead><tr><th>ХЭРЭГЛЭГЧ</th><th>МАРШРУТ</th><th>ЗАЙ</th><th>ХУГАЦАА</th><th>ТЕМП</th><th>БҮРТГЭСЭН</th></tr></thead><tbody>{rows.map((run,index) => <tr key={index}><td><div className="person-cell"><Avatar name={run.name} small/><strong>{run.name}</strong></div></td><td>{run.route}</td><td><strong>{run.distance} км</strong></td><td>{run.duration}</td><td>{run.pace} /км</td><td className="muted">{run.time}</td></tr>)}</tbody></table></div>;
}

function RunsView() {
  return <><PageTitle title="Гүйлтүүд" subtitle="Хэрэглэгчдийн бүртгэсэн гүйлтийн түүх ба үзүүлэлт"/><section className="mini-stats"><div><Activity/><span>Өнөөдөр<strong>428 гүйлт</strong></span></div><div><Route/><span>Нийт зай<strong>3,291 км</strong></span></div><div><TrendingUp/><span>Дундаж темп<strong>5:48 мин/км</strong></span></div></section><section className="panel table-panel"><div className="panel-head"><div><h2>Бүх гүйлт</h2><p>GPS-ээр баталгаажсан гүйлтүүд</p></div><button className="outline-button">CSV татах</button></div><RunTable/></section></>;
}

function ReportsView({ reports, resolve }: { reports: {id:number;reporter:string;target:string;reason:string;date:string;status:'open'}[]; resolve:(id:number)=>void }) {
  return <><PageTitle title="Тайлан, гомдол" subtitle="Хэрэглэгчдээс ирсэн контент болон бүртгэлийн гомдол"/><section className="report-summary"><div><Flag/><strong>{reports.length}</strong><span>Шийдвэр хүлээж байна</span></div><div><ShieldCheck/><strong>18</strong><span>Энэ сард шийдсэн</span></div></section><section className="panel report-list">{reports.map(report => <article key={report.id}><div className="report-icon"><Flag size={19}/></div><div className="report-main"><div><Status kind="open"/><span>{report.date}</span></div><h3>{report.reason}</h3><p><strong>{report.reporter}</strong> хэрэглэгч <b>{report.target}</b>-ийн талаар мэдээлсэн.</p></div><button className="outline-button" onClick={() => resolve(report.id)}><Check size={16}/>Шийдвэрлэх</button></article>)}{reports.length === 0 && <Empty title="Шинэ гомдол алга"/>}</section></>;
}

function Empty({ title }: { title: string }) { return <div className="empty"><Search size={25}/><strong>{title}</strong><span>Хайлт эсвэл шүүлтүүрээ өөрчилнө үү.</span></div>; }

function EventModal({ onClose, onSave }: { onClose:()=>void; onSave:(event:Omit<AdminEvent,'id'|'participants'|'status'>)=>void }) {
  const [name,setName]=useState('');
  const [org,setOrg]=useState('');
  const [date,setDate]=useState('');
  const [distance,setDistance]=useState('');
  const [type,setType]=useState<AdminEvent['type']>('Happy');
  const [group,setGroup]=useState<AdminEvent['group']>('5k');
  const [completionMode,setCompletionMode]=useState<NonNullable<AdminEvent['completionMode']>>('single_run');
  const [reward,setReward]=useState('');
  const [organizerInfo,setOrganizerInfo]=useState('');
  const [rewardInfo,setRewardInfo]=useState('');
  const [color,setColor]=useState('#a8ff18');
  const [coverImage,setCoverImage]=useState('https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80');
  const [description,setDescription]=useState('');
  const [registrationInfo,setRegistrationInfo]=useState('');
  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverImage(await readImageFile(file));
    event.target.value = '';
  };
  const valid = name.trim() && org.trim() && date && Number(distance)>0 && coverImage.trim() && description.trim();
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="admin-modal large" role="dialog" aria-modal="true" aria-label="Шинэ эвент" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><h2>Шинэ эвент</h2><p>Нүүр хуудсанд харагдах challenge cover, бүртгэл болон тайлбарын мэдээллийг бөглөнө.</p></div><button aria-label="Хаах" onClick={onClose}><X size={20}/></button></div><div className="event-editor-preview"><img src={coverImage} alt="Cover preview"/><div><strong>{name || 'Эвентийн нэр'}</strong><span>{org || 'Зохион байгуулагч'} · {group === '5k' ? '5 км' : '10+ км'} challenge</span><p>{description || 'Эвентийн тайлбар энд харагдана.'}</p></div></div><div className="form-grid event-form-grid"><label className="span-2">Эвентийн нэр<input value={name} onChange={e=>setName(e.target.value)} placeholder="Жишээ: Улаанбаатар марафон" autoFocus/></label><label>Зохион байгуулагч<input value={org} onChange={e=>setOrg(e.target.value)} placeholder="Байгууллагын нэр"/></label><label>Огноо<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Зай / goal км<input type="number" min="1" value={distance} onChange={e=>setDistance(e.target.value)} placeholder="10"/></label><label>Challenge төрөл<select value={type} onChange={e=>setType(e.target.value as AdminEvent['type'])}><option value="Happy">Happy</option><option value="Corporate">Corporate</option></select></label><label>Нүүр хэсгийн ангилал<select value={group} onChange={e=>setGroup(e.target.value as AdminEvent['group'])}><option value="5k">5 км Challenges</option><option value="10k">10+ км Challenges</option></select></label><label className="span-2">Гүйцэтгэх хэлбэр<select value={completionMode} onChange={e=>setCompletionMode(e.target.value as NonNullable<AdminEvent['completionMode']>)}><option value="cumulative">Гүйлт хураах - гүйсэн км нэмэгдсээр зорилгод хүрнэ</option><option value="single_run">Нэг удаа гүйж дуусгах - тухайн goal км-ээ нэг гүйлтээр дуусгана</option></select></label><label>Reward / товч текст<input value={reward} onChange={e=>setReward(e.target.value)} placeholder="Жишээ: Medal + Bib"/></label><label>Accent өнгө<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><div className="span-2 route-image-upload"><img src={coverImage} alt="Event cover preview"/><div><strong>Эвентийн cover зураг</strong><span>URL бичихгүй, төхөөрөмжөөсөө зураг сонгож оруулна.</span><label className="upload-button">Cover upload<input type="file" accept="image/*" onChange={event => void uploadCover(event)} /></label></div></div><label className="span-2">Эвентийн тайлбар<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Нүүр болон дэлгэрэнгүй дээр харагдах тайлбар"/></label><label className="span-2">Компани / байгууллагын мэдээлэл<textarea value={organizerInfo} onChange={e=>setOrganizerInfo(e.target.value)} placeholder="Зохион байгуулагчийн тухай, зорилго, брэнд/байгууллагын мэдээлэл"/></label><label className="span-2">Шагнал урамшууллын дэлгэрэнгүй<textarea value={rewardInfo} onChange={e=>setRewardInfo(e.target.value)} placeholder="Ялагч, finisher, coupon, badge зэрэг урамшууллын нөхцөл"/></label><label className="span-2">Бүртгэлийн мэдээлэл<textarea value={registrationInfo} onChange={e=>setRegistrationInfo(e.target.value)} placeholder="Бүртгэлийн хугацаа, төлбөр, шаардлага гэх мэт"/></label></div><div className="modal-actions"><button className="outline-button" onClick={onClose}>Болих</button><button className="primary-button" disabled={!valid} onClick={()=>valid&&onSave({name:name.trim(),org:org.trim(),date,distance:Number(distance),type,group,completionMode,reward:reward.trim(),color,coverImage:coverImage.trim(),description:description.trim(),organizerInfo:organizerInfo.trim(),rewardInfo:rewardInfo.trim(),registrationInfo:registrationInfo.trim()})}><Plus size={16}/>Нүүр хуудсанд нэмэх</button></div></div></div>;
}

const styles = `
.admin-auth-root{min-height:100vh;display:grid;place-items:center;padding:24px;background:#eef1ed;color:#151817;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}.admin-auth-card{width:min(430px,100%);padding:32px;border:1px solid #dfe4dd;border-radius:8px;background:#fff;box-shadow:0 24px 70px rgba(22,30,24,.12)}.admin-auth-brand{display:flex;align-items:center;gap:8px;margin-bottom:38px}.admin-auth-brand span{color:#92ee00;font-size:34px;font-weight:900}.admin-auth-brand strong{font-size:20px}.admin-auth-brand em{padding:4px 7px;background:#151817;color:#fff;font-size:9px;font-style:normal;letter-spacing:1px}.admin-auth-card h1{margin:0 0 8px;font-size:26px}.admin-auth-card p{margin:0 0 26px;color:#69706b;font-size:14px;line-height:1.55}.admin-auth-card form{display:grid;gap:16px}.admin-auth-card label{display:grid;gap:7px;color:#464c48;font-size:12px;font-weight:800}.admin-auth-card input{width:100%;height:48px;padding:0 13px;border:1px solid #d8ddd7;border-radius:6px;outline:none;font:inherit;letter-spacing:0}.admin-auth-card input:focus{border-color:#80cf00;box-shadow:0 0 0 3px rgba(146,238,0,.16)}.admin-auth-submit,.admin-auth-secondary{height:48px;border:0;border-radius:6px;background:#a8ff18;color:#10130f;font:inherit;font-weight:900;cursor:pointer}.admin-auth-submit:disabled{cursor:wait;opacity:.65}.admin-auth-secondary{width:100%;background:#151817;color:#fff}.admin-auth-error{padding:11px 12px;border:1px solid #ffd2ce;border-radius:6px;background:#fff1ef;color:#b52b20;font-size:13px}.admin-auth-check{padding:36px 0;text-align:center;color:#69706b}
*{box-sizing:border-box}body{margin:0}.admin-root{--lime:#a8ff18;--ink:#131619;--muted:#6f767d;--line:#e5e8e5;--bg:#f4f6f3;width:100%;height:100vh;overflow:auto;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}.admin-root button,.admin-root input{font:inherit;letter-spacing:0}.admin-sidebar{position:fixed;inset:0 auto 0 0;width:248px;background:#111412;color:#fff;padding:26px 16px 18px;display:flex;flex-direction:column;z-index:20}.admin-brand{height:48px;display:flex;align-items:center;gap:8px;padding:0 10px;font-size:20px}.brand-arrow{color:var(--lime);font-size:38px;font-weight:900;line-height:0;transform:translateY(-2px)}.admin-brand em{font-style:normal;font-size:9px;letter-spacing:1.2px;color:#111;background:var(--lime);padding:4px 5px;border-radius:3px;margin-left:2px}.admin-sidebar nav{margin-top:30px;flex:1}.admin-sidebar nav p{font-size:10px;letter-spacing:1.4px;color:#626963;margin:22px 12px 9px}.admin-sidebar nav button{border:0;background:transparent;color:#9ca39d;width:100%;height:45px;border-radius:6px;display:flex;align-items:center;gap:12px;padding:0 12px;cursor:pointer;text-align:left;margin:3px 0}.admin-sidebar nav button:hover{background:#1c211d;color:#fff}.admin-sidebar nav button.active{background:#252c25;color:#fff;box-shadow:inset 3px 0 var(--lime)}.admin-sidebar nav button.active svg{color:var(--lime)}.admin-sidebar nav button span{flex:1}.admin-sidebar nav button b{font-size:11px;background:#ff5d49;color:#fff;border-radius:10px;padding:2px 6px}.sidebar-profile{border-top:1px solid #282d29;padding:17px 5px 0;display:flex;align-items:center;gap:10px}.sidebar-profile>span{display:flex;flex:1;min-width:0;flex-direction:column}.sidebar-profile strong{font-size:13px}.sidebar-profile small{font-size:10px;color:#737a74;margin-top:3px;overflow:hidden;text-overflow:ellipsis}.sidebar-profile button{border:0;background:transparent;color:#697069;padding:7px;cursor:pointer}.admin-avatar{width:38px;height:38px;border-radius:50%;background:#dce8ce;color:#34501b;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}.admin-avatar.small{width:32px;height:32px;font-size:10px}.admin-main{margin-left:248px;min-height:100vh}.admin-topbar{height:70px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 32px;position:sticky;top:0;z-index:10}.topbar-search{width:min(420px,48vw);height:40px;background:#f3f5f2;border:1px solid transparent;border-radius:6px;display:flex;align-items:center;gap:10px;padding:0 12px;color:#899089}.topbar-search:focus-within{background:#fff;border-color:#b9c2b6}.topbar-search input{border:0;outline:0;background:transparent;min-width:0;flex:1;color:var(--ink);font-size:13px}.topbar-search button{border:0;background:transparent;color:#818881;display:flex;cursor:pointer}.icon-button{margin-left:auto;position:relative;width:39px;height:39px;border:1px solid var(--line);border-radius:6px;background:#fff;display:grid;place-items:center;cursor:pointer}.icon-button i{position:absolute;width:7px;height:7px;background:#ff5346;border:2px solid #fff;border-radius:50%;right:8px;top:7px}.topbar-user{display:flex;align-items:center;gap:10px;margin-left:18px;padding-left:18px;border-left:1px solid var(--line)}.topbar-user>span{display:flex;flex-direction:column}.topbar-user strong{font-size:12px}.topbar-user small{font-size:10px;color:#899089;margin-top:2px}.mobile-menu{display:none;border:0;background:transparent;padding:7px}.admin-content{padding:32px;max-width:1500px;margin:0 auto}.page-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px}.page-title h1{font-size:26px;line-height:1.15;margin:0;font-weight:780}.page-title p{font-size:13px;color:var(--muted);margin:7px 0 0}.primary-button,.outline-button{height:40px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 15px;font-weight:700;font-size:12px;cursor:pointer}.primary-button{background:var(--lime);color:#172000;border:1px solid #96e716}.primary-button:hover{background:#9aee10}.primary-button:disabled{opacity:.45;cursor:not-allowed}.outline-button{border:1px solid #d8ddd6;background:#fff;color:#3b413c}.panel{background:#fff;border:1px solid var(--line);border-radius:8px}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:18px}.stat-card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:18px;display:grid;grid-template-columns:auto 1fr;column-gap:12px;min-width:0}.stat-icon{grid-row:1/3;width:39px;height:39px;border-radius:7px;display:grid;place-items:center}.stat-icon.lime{background:#edffd0;color:#548800}.stat-icon.blue{background:#e1f2ff;color:#177ab6}.stat-icon.orange{background:#fff0df;color:#d76c0b}.stat-icon.violet{background:#eee8ff;color:#7350c7}.stat-card>span{font-size:11px;color:var(--muted);align-self:end}.stat-card>strong{font-size:23px;margin-top:2px;overflow:hidden;text-overflow:ellipsis}.stat-card>small{grid-column:1/3;display:flex;align-items:center;gap:5px;color:#39a348;font-weight:700;font-size:10px;margin-top:16px}.stat-card>small em{font-style:normal;color:#959b96;font-weight:400}.overview-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(265px,1fr);gap:18px;margin-bottom:18px}.panel-head{display:flex;justify-content:space-between;align-items:center;padding:19px 20px;border-bottom:1px solid var(--line);gap:15px}.panel-head h2{font-size:15px;margin:0}.panel-head p{font-size:11px;color:var(--muted);margin:4px 0 0}.panel-head>button:not(.text-button){border:1px solid var(--line);background:#fff;border-radius:5px;padding:7px 9px;display:flex;align-items:center;gap:6px;font-size:11px;color:#555c56}.chart-area{height:245px;display:flex;padding:25px 22px 18px 15px}.chart-y{width:48px;display:flex;flex-direction:column;justify-content:space-between;color:#9aa09a;font-size:9px;padding-bottom:25px}.bars{flex:1;display:grid;grid-template-columns:repeat(7,1fr);gap:20px;border-bottom:1px solid var(--line);background:repeating-linear-gradient(to bottom,#fff 0,#fff 54px,#edf0ed 55px)}.bar-column{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;font-size:10px;color:#838a84}.bar-track{height:190px;width:min(28px,60%);display:flex;align-items:flex-end}.bar-track i{width:100%;display:block;background:#92de1d;border-radius:3px 3px 0 0;transition:height .3s}.bar-column:last-child .bar-track i{background:#222923}.all-good{font-size:10px;color:#31863e;display:flex;align-items:center;gap:5px}.all-good i{width:7px;height:7px;border-radius:50%;background:#49bd58}.health-panel{padding-bottom:12px}.health-score{padding:18px 20px 12px}.health-score>div{background:#f4f7f1;border-radius:6px;padding:16px;display:grid;grid-template-columns:auto 1fr;column-gap:12px;color:#5b8c16}.health-score strong{font-size:22px;color:#1b211c}.health-score span{font-size:10px;color:var(--muted)}.health-score svg{grid-row:1/3}.health-row{display:flex;justify-content:space-between;padding:9px 20px;font-size:11px}.health-row span{color:var(--muted)}.health-row strong{font-size:10px}.recent-panel{overflow:hidden}.text-button{border:0;background:transparent;color:#568c0d;font-size:11px;font-weight:700;cursor:pointer}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:720px}th{text-align:left;font-size:9px;letter-spacing:.6px;color:#919891;background:#fafbfa;padding:11px 18px;border-bottom:1px solid var(--line)}td{padding:13px 18px;border-bottom:1px solid #eef0ee;font-size:11px;color:#5e655f;white-space:nowrap}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#fbfcfa}td strong{color:#202520}.person-cell{display:flex;align-items:center;gap:10px}.person-cell>span:not(.admin-avatar){display:flex;flex-direction:column}.person-cell small{color:#8d948e;margin-top:3px}.muted{color:#979d98}.admin-status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:650;padding:5px 8px;border-radius:12px}.admin-status i{width:6px;height:6px;border-radius:50%}.status-active{color:#238039;background:#eaf8ed}.status-active i{background:#3dae50}.status-blocked{color:#a53d34;background:#fff0ee}.status-blocked i{background:#dd5c4d}.status-draft{color:#907014;background:#fff8dc}.status-draft i{background:#c49a21}.status-ended,.status-resolved{color:#6d746e;background:#eef0ee}.status-ended i,.status-resolved i{background:#899089}.status-open{color:#b04b33;background:#fff0eb}.status-open i{background:#e76345}.table-panel{overflow:hidden}.table-tools{height:57px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid var(--line)}.table-tools>span{font-size:10px;color:var(--muted)}.filter-tabs{display:flex;gap:4px}.filter-tabs button{border:0;background:transparent;padding:7px 11px;border-radius:5px;color:#747b75;font-size:11px;cursor:pointer}.filter-tabs button.active{background:#edf4e8;color:#426c08;font-weight:700}.row-action{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);background:#fff;border-radius:5px;color:#747b75;cursor:pointer}.row-action:hover{color:#d64d40;border-color:#e9b7b1}.event-list{padding:0 18px}.event-row{display:grid;grid-template-columns:58px minmax(180px,1fr) 100px 100px 90px 34px;gap:16px;align-items:center;padding:15px 0;border-bottom:1px solid #edf0ed}.event-row:last-child{border:0}.event-date{width:50px;height:50px;border-radius:6px;background:#202520;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}.event-date strong{font-size:17px}.event-date span{font-size:9px;color:#b5bbb5}.event-info h3{font-size:13px;margin:0}.event-info p{font-size:10px;color:var(--muted);margin:4px 0 0}.event-metric{display:flex;flex-direction:column}.event-metric span{font-size:9px;color:#919791}.event-metric strong{font-size:12px;margin-top:4px}.mini-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:18px}.mini-stats>div{background:#fff;border:1px solid var(--line);border-radius:7px;padding:16px;display:flex;align-items:center;gap:12px;color:#629c12}.mini-stats span{display:flex;flex-direction:column;color:var(--muted);font-size:10px}.mini-stats strong{color:var(--ink);font-size:16px;margin-top:3px}.report-summary{display:grid;grid-template-columns:repeat(2,minmax(0,260px));gap:15px;margin-bottom:18px}.report-summary>div{background:#fff;border:1px solid var(--line);border-radius:7px;padding:18px;display:grid;grid-template-columns:auto 1fr;column-gap:12px}.report-summary svg{grid-row:1/3;color:#e15b45}.report-summary strong{font-size:19px}.report-summary span{font-size:10px;color:var(--muted)}.report-list{padding:0 20px}.report-list article{display:flex;align-items:center;gap:14px;padding:18px 0;border-bottom:1px solid var(--line)}.report-list article:last-child{border:0}.report-icon{width:39px;height:39px;border-radius:6px;background:#fff0eb;color:#db6048;display:grid;place-items:center}.report-main{flex:1}.report-main>div{display:flex;align-items:center;gap:9px}.report-main>div>span{font-size:9px;color:#999f9a}.report-main h3{font-size:13px;margin:7px 0 4px}.report-main p{font-size:11px;color:var(--muted);margin:0}.report-main p b{color:#424843}.empty{text-align:center;padding:54px 20px;color:#919791;display:flex;flex-direction:column;align-items:center;gap:7px}.empty strong{font-size:13px;color:#525852}.empty span{font-size:10px}.modal-backdrop{position:fixed;inset:0;background:rgba(14,17,14,.62);display:grid;place-items:center;padding:20px;z-index:50}.admin-modal{width:min(580px,100%);background:#fff;border-radius:8px;box-shadow:0 25px 70px rgba(0,0,0,.28)}.modal-head{padding:21px 23px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between}.modal-head h2{margin:0;font-size:18px}.modal-head p{font-size:11px;color:var(--muted);margin:5px 0 0}.modal-head button{border:0;background:#f1f3f0;border-radius:5px;width:34px;height:34px;display:grid;place-items:center;cursor:pointer}.form-grid{padding:22px 23px;display:grid;grid-template-columns:1fr 1fr;gap:16px}.form-grid label{font-size:10px;font-weight:700;color:#565d57;display:flex;flex-direction:column;gap:7px}.form-grid label.span-2{grid-column:1/3}.form-grid input{height:42px;border:1px solid #daddd9;border-radius:5px;padding:0 11px;outline:0;color:#202520}.form-grid input:focus{border-color:#81bb2e;box-shadow:0 0 0 3px #edf7df}.modal-actions{padding:16px 23px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:9px}.admin-toast{position:fixed;right:24px;bottom:24px;background:#1b201c;color:#fff;border-radius:6px;padding:13px 16px;display:flex;align-items:center;gap:9px;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.22);z-index:70}.admin-toast svg{color:var(--lime)}.sidebar-scrim{display:none}
.event-row{grid-template-columns:74px 58px minmax(180px,1fr) 100px 100px 90px 34px}.event-cover-thumb{width:74px;height:54px;border-radius:7px;object-fit:cover;background:#202520}.event-info small{display:block;max-width:520px;margin-top:5px;color:#8a928b;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.admin-modal.large{width:min(820px,100%);max-height:92vh;overflow:auto}.event-editor-preview{margin:18px 23px 0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#111713;color:#fff;display:grid;grid-template-columns:220px 1fr}.event-editor-preview img{width:100%;height:150px;object-fit:cover}.event-editor-preview div{padding:18px;display:flex;flex-direction:column;justify-content:center}.event-editor-preview strong{font-size:19px}.event-editor-preview span{color:var(--lime);font-size:11px;font-weight:900;margin-top:6px}.event-editor-preview p{color:#cdd7cf;font-size:12px;line-height:1.55;margin:10px 0 0}.event-form-grid{grid-template-columns:1fr 1fr}.form-grid select,.form-grid textarea{border:1px solid #daddd9;border-radius:5px;padding:10px 11px;outline:0;color:#202520;background:#fff;font:inherit;letter-spacing:0}.form-grid select{height:42px}.form-grid textarea{min-height:82px;resize:vertical}.form-grid input[type=color]{padding:4px}.form-grid select:focus,.form-grid textarea:focus{border-color:#81bb2e;box-shadow:0 0 0 3px #edf7df}
.marathon-admin-grid{display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px}.marathon-list{padding:10px}.marathon-list button{width:100%;border:0;background:transparent;border-radius:8px;display:flex;align-items:center;gap:10px;padding:9px;text-align:left;cursor:pointer}.marathon-list button.active,.marathon-list button:hover{background:#edf4e8}.marathon-list img{width:58px;height:42px;border-radius:6px;object-fit:cover;background:#202520}.marathon-list span{display:flex;min-width:0;flex-direction:column}.marathon-list strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.marathon-list small{font-size:10px;color:var(--muted);margin-top:3px}.marathon-editor{overflow:hidden}.marathon-editor-body{padding:18px}.marathon-cover-editor{display:grid;grid-template-columns:minmax(240px,360px) auto;align-items:end;gap:14px;margin-bottom:18px}.marathon-cover-editor img{width:100%;height:180px;border-radius:8px;object-fit:cover;background:#101511}.upload-button{height:38px;border-radius:6px;border:1px solid #d8ddd6;background:#fff;color:#3b413c;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;font-size:12px;font-weight:800;cursor:pointer}.upload-button input{display:none}.marathon-form{padding:0;margin-bottom:22px}.marathon-admin-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.marathon-gallery-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;margin-bottom:22px}.marathon-gallery-list div{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}.marathon-gallery-list img{width:100%;height:82px;object-fit:cover;display:block}.marathon-gallery-list button{width:100%;height:28px;border:0;background:#fff0ee;color:#b04b33;font-size:10px;font-weight:800;cursor:pointer}.marathon-types-admin h3{margin:0 0 12px;font-size:15px}.marathon-category-admin{border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:12px;background:#fbfcfa}.admin-check{display:inline-flex!important;align-items:center;gap:7px;font-size:12px;font-weight:900;color:#202520}.admin-check input{width:15px;height:15px}.marathon-option-list{display:grid;gap:8px;margin-top:10px}.marathon-option-admin{display:grid;grid-template-columns:90px minmax(180px,1fr) 90px 70px 48px;gap:8px;align-items:center}.marathon-option-admin input{height:34px;border:1px solid #daddd9;border-radius:5px;padding:0 8px;font:inherit;font-size:11px}.marathon-option-admin input[type=color]{padding:3px}
.title-actions{display:flex;gap:9px;align-items:center}.row-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}.detail-button{height:32px;border:1px solid #dfe5dc;background:#f8fbf4;color:#476d10;border-radius:5px;padding:0 10px;font-size:10px;font-weight:800;cursor:pointer}.detail-button:hover{border-color:#9bdc32;background:#eefadc}.user-detail-modal{width:min(860px,100%);max-height:92vh;overflow:auto}.user-detail-body{padding:20px 23px 23px;background:#f7faf5}.user-hero{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.user-hero>div{display:flex;flex:1;flex-direction:column;min-width:0}.user-hero strong{font-size:16px}.user-hero span{font-size:11px;color:var(--muted);margin-top:3px}.user-detail-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.user-detail-stats div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:13px}.user-detail-stats strong{display:block;font-size:18px}.user-detail-stats span{font-size:10px;color:var(--muted)}.user-detail-block{background:#fff;border:1px solid var(--line);border-radius:8px;margin-top:12px;padding:14px}.user-detail-block h3{font-size:13px;margin:0 0 10px}.user-detail-block>p{font-size:11px;color:var(--muted);margin:0}.user-detail-list{display:grid;gap:8px}.user-detail-list article{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;border:1px solid #eef1ec;border-radius:7px;padding:10px;background:#fbfdf9}.user-detail-list strong{font-size:12px}.user-detail-list span{font-size:10px;color:#687169;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.user-detail-list small{grid-row:1/3;grid-column:2;color:#8a928b;font-size:10px;align-self:center}
.performance-layout{display:grid;grid-template-columns:285px minmax(0,1fr);gap:18px}.competition-list{overflow:hidden}.competition-list button{width:100%;border:0;border-bottom:1px solid var(--line);background:#fff;text-align:left;padding:14px 16px;display:grid;gap:5px;cursor:pointer}.competition-list button:hover,.competition-list button.active{background:#f0f7e8}.competition-list button.active{box-shadow:inset 3px 0 var(--lime)}.competition-list strong{font-size:13px;color:#202520}.competition-list small{font-size:10px;color:var(--muted)}.competition-kind{width:max-content;border-radius:999px;padding:4px 8px;font-size:9px;font-weight:900}.competition-kind.event{background:#eaf8ed;color:#238039}.competition-kind.marathon{background:#eee8ff;color:#7350c7}.performance-main{min-width:0}.performance-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.performance-summary>div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px;display:flex;align-items:center;gap:10px;color:#629c12}.performance-summary span{display:flex;flex-direction:column;color:var(--muted);font-size:10px}.performance-summary strong{color:var(--ink);font-size:16px;margin-top:3px}.top-five-panel{overflow:hidden;margin-bottom:14px}.top-five-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;padding:14px}.top-five-card{position:relative;min-height:164px;border:1px solid var(--line);border-radius:8px;background:#fbfcfa;padding:16px 12px 12px;display:flex;flex-direction:column;align-items:center;text-align:center}.top-five-card.place-1{background:#fff9df;border-color:#ead37d;box-shadow:0 12px 28px rgba(148,105,0,.12)}.top-five-card.place-2{background:#f5f7fa;border-color:#ccd5df}.top-five-card.place-3{background:#fff4e8;border-color:#edc59b}.top-five-rank{position:absolute;top:9px;left:9px;border-radius:999px;padding:4px 8px;background:#202520;color:#fff;font-size:10px;font-weight:900}.top-five-card strong{font-size:12px;margin-top:10px;color:#202520}.top-five-card small{font-size:10px;color:var(--muted);margin-top:5px}.top-five-meta{width:100%;display:grid;grid-template-columns:1fr;gap:4px;margin-top:auto;padding-top:10px}.top-five-meta span{border-radius:5px;background:rgba(255,255,255,.72);border:1px solid rgba(0,0,0,.05);padding:5px;font-size:10px;font-weight:800;color:#3f463f}.rank-badge{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:28px;border-radius:14px;font-size:10px;font-weight:900;background:#eef0ee;color:#555c56}.rank-1{background:#fff7d6;color:#946900}.rank-2{background:#eef2f6;color:#526070}.rank-3{background:#fff0df;color:#a35a10}.progress-cell{min-width:150px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px}.progress-cell span{font-size:10px;font-weight:900;color:#202520}.progress-cell i{height:7px;border-radius:4px;background:#e5eae3;overflow:hidden}.progress-cell b{display:block;height:100%;border-radius:4px;background:var(--lime)}.progress-cell em{font-style:normal;font-size:9px;color:#778079}
.routes-admin-grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px}.route-admin-list{overflow:hidden}.route-admin-list button{width:100%;border:0;border-bottom:1px solid var(--line);background:#fff;text-align:left;padding:11px;display:flex;align-items:center;gap:10px;cursor:pointer}.route-admin-list button:hover,.route-admin-list button.active{background:#edf4e8}.route-admin-list button.active{box-shadow:inset 3px 0 var(--lime)}.route-admin-list img{width:68px;height:50px;border-radius:7px;object-fit:cover;background:#202520}.route-admin-list span{display:flex;flex-direction:column;min-width:0}.route-admin-list strong{font-size:12px;color:#202520;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.route-admin-list small{font-size:10px;color:var(--muted);margin-top:4px}.route-editor{overflow:hidden}.route-editor-body{padding:18px}.route-map-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.map-mode-tabs,.route-map-zoom{height:38px;display:inline-flex;align-items:center;border:1px solid #d8ddd6;border-radius:7px;background:#fff;overflow:hidden}.map-mode-tabs button,.route-map-zoom button{height:100%;border:0;border-right:1px solid #e5e9e3;background:#fff;color:#3f463f;padding:0 12px;font-size:12px;font-weight:900;cursor:pointer}.map-mode-tabs button:last-child,.route-map-zoom button:last-child{border-right:0}.map-mode-tabs button.active{background:#111412;color:var(--lime)}.route-map-zoom span{min-width:34px;text-align:center;font-size:11px;font-weight:900;color:#202520}.route-map-view,.route-map-check{height:38px;display:inline-flex!important;align-items:center;gap:7px;border:1px solid #d8ddd6;border-radius:7px;background:#fff;padding:0 10px;color:#555c56;font-size:11px;font-weight:800}.route-map-view select{height:28px;border:0;background:#f4f7f1;border-radius:5px;padding:0 7px;color:#202520;font:inherit;outline:0}.route-map-check input{width:15px;height:15px}.route-map-editor{height:360px;border-radius:10px;position:relative;overflow:hidden;cursor:crosshair;background:#dfe8da;border:1px solid #c9d3c4;box-shadow:inset 0 0 0 1px rgba(255,255,255,.55);touch-action:none;user-select:none}.route-map-editor.is-pan{cursor:grab}.route-map-editor.is-pan:active{cursor:grabbing}.route-map-tiles{position:absolute;inset:0;pointer-events:none}.route-map-tiles img{position:absolute;width:256px;height:256px;object-fit:cover;max-width:none;-webkit-user-drag:none;user-select:none}.map-light .route-map-tiles{filter:saturate(.72) brightness(1.08)}.map-contrast .route-map-tiles{filter:saturate(1.35) contrast(1.12) brightness(.92)}.map-satellite .route-map-tiles{filter:saturate(1.08) contrast(1.03)}.route-map-grid{position:absolute;inset:0;background:linear-gradient(90deg,rgba(17,20,18,.08) 1px,transparent 1px),linear-gradient(rgba(17,20,18,.08) 1px,transparent 1px);background-size:38px 38px;box-shadow:inset 0 0 0 999px rgba(245,249,241,.12);pointer-events:none}.route-map-editor svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}.route-map-editor polyline{fill:none;stroke:#111412;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 5px 6px rgba(0,0,0,.22))}.route-map-editor i{position:absolute;width:24px;height:24px;border-radius:50%;transform:translate(-50%,-50%);display:grid;place-items:center;background:var(--lime);border:2px solid #111412;color:#111412;font-size:10px;font-style:normal;font-weight:900;box-shadow:0 8px 16px rgba(0,0,0,.2);pointer-events:none}.route-map-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:999px;background:rgba(17,20,18,.84);color:#fff;padding:10px 14px;font-size:12px;font-weight:800;pointer-events:none}.route-map-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px}.route-form{padding:0}.route-image-upload{grid-column:1/3;border:1px solid var(--line);border-radius:8px;background:#fbfcfa;padding:12px;display:grid;grid-template-columns:minmax(180px,260px) 1fr;gap:14px;align-items:center}.route-image-upload img{width:100%;height:130px;border-radius:7px;object-fit:cover;background:#101511}.route-image-upload div{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.route-image-upload strong{font-size:13px;color:#202520}.route-image-upload span{font-size:11px;color:var(--muted)}.route-save-actions{align-items:center;justify-content:space-between}.route-save-actions span{font-size:11px;color:var(--muted)}
@media(max-width:1050px){.stats-grid{grid-template-columns:repeat(2,1fr)}.overview-grid{grid-template-columns:1fr}.event-row{grid-template-columns:74px 58px minmax(180px,1fr) 90px 90px 34px}.event-row>.admin-status{display:none}}
@media(max-width:760px){.admin-sidebar{transform:translateX(-100%);transition:transform .2s}.admin-sidebar.is-open{transform:translateX(0)}.sidebar-scrim{display:block;position:fixed;inset:0;border:0;background:rgba(0,0,0,.45);z-index:15}.admin-main{margin-left:0}.admin-topbar{padding:0 14px;height:62px}.mobile-menu{display:flex;margin-right:8px}.topbar-search{width:auto;flex:1}.topbar-user{display:none}.admin-content{padding:22px 15px}.page-title{align-items:flex-start}.page-title h1{font-size:22px}.page-title .primary-button{padding:0 11px}.stats-grid{grid-template-columns:1fr 1fr;gap:10px}.stat-card{padding:14px}.stat-card>strong{font-size:19px}.stat-card>small em{display:none}.chart-area{padding-right:14px}.bars{gap:9px}.health-panel{min-width:0}.event-list{padding:0 12px}.event-cover-thumb{display:none}.event-row{grid-template-columns:52px minmax(130px,1fr) 68px 34px;gap:10px}.event-row .event-metric:nth-of-type(3){display:none}.event-row>.admin-status{display:none}.event-editor-preview{grid-template-columns:1fr}.event-editor-preview img{height:170px}.mini-stats{grid-template-columns:1fr}.report-summary{grid-template-columns:1fr 1fr}.report-list article{align-items:flex-start;flex-wrap:wrap}.report-list article>.outline-button{margin-left:53px}.form-grid{grid-template-columns:1fr}.form-grid label.span-2{grid-column:auto}}
@media(max-width:440px){.stats-grid{grid-template-columns:1fr}.page-title{flex-direction:column}.page-title .primary-button{width:100%}.report-summary{grid-template-columns:1fr}.filter-tabs{overflow-x:auto}.table-tools>span{display:none}.admin-toast{left:15px;right:15px;bottom:15px}.event-row{grid-template-columns:52px 1fr 34px}.event-row .event-metric{display:none}}
`;
