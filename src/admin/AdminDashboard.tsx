import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, CalendarDays, Check, ChevronDown, CircleAlert, Flag, Gauge,
  Building2, LayoutDashboard, LogOut, Menu, MonitorPlay, Plus, Route, Search, Settings,
  ShieldCheck, TrendingUp, UserCheck, Users, X
} from 'lucide-react/dist/cjs/lucide-react.js';
import { LoginContentEditor } from './LoginContentEditor';
import { ClubContentEditor } from './ClubContentEditor';
import { supabase } from '../lib/supabase';

type Section = 'overview' | 'users' | 'events' | 'runs' | 'reports' | 'login-content' | 'club-content';
type UserStatus = 'active' | 'blocked';
type EventStatus = 'active' | 'draft' | 'ended';

type AdminUser = {
  id: number; name: string; email: string; joined: string; distance: number; runs: number; status: UserStatus;
};

type AdminEvent = {
  id: number; name: string; org: string; date: string; distance: number; participants: number; status: EventStatus;
};

const initialUsers: AdminUser[] = [
  { id: 1, name: 'Батболд Э.', email: 'batbold@run.mn', joined: '2026.08.11', distance: 124.8, runs: 38, status: 'active' },
  { id: 2, name: 'Солонго Р.', email: 'solongo@run.mn', joined: '2026.08.09', distance: 86.2, runs: 24, status: 'active' },
  { id: 3, name: 'Төгөлдөр Б.', email: 'runner@example.com', joined: '2026.08.04', distance: 52.7, runs: 17, status: 'active' },
  { id: 4, name: 'Анударь Ц.', email: 'anu@run.mn', joined: '2026.07.28', distance: 31.5, runs: 12, status: 'blocked' },
  { id: 5, name: 'Мөнх-Эрдэнэ Г.', email: 'munkh@run.mn', joined: '2026.07.22', distance: 208.4, runs: 61, status: 'active' },
  { id: 6, name: 'Номин А.', email: 'nomin@run.mn', joined: '2026.07.19', distance: 74.1, runs: 22, status: 'active' }
];

const initialEvents: AdminEvent[] = [
  { id: 1, name: 'Coffee Run', org: 'Coffee Bean', date: '2026.08.16', distance: 25, participants: 248, status: 'active' },
  { id: 2, name: 'Energy Run 2026', org: 'Unitel Group', date: '2026.08.23', distance: 50, participants: 186, status: 'active' },
  { id: 3, name: 'Намрын марафон', org: 'Runboost', date: '2026.09.12', distance: 42, participants: 0, status: 'draft' },
  { id: 4, name: 'Spring Kickoff', org: 'RunSync Community', date: '2026.05.18', distance: 100, participants: 392, status: 'ended' }
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
  { id: 'users' as Section, label: 'Хэрэглэгчид', icon: Users },
  { id: 'events' as Section, label: 'Эвентүүд', icon: CalendarDays },
  { id: 'runs' as Section, label: 'Гүйлтүүд', icon: Route },
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
  const [adminEmail, setAdminEmail] = useState('admin@vision.mn');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [users, setUsers] = useState(initialUsers);
  const [events, setEvents] = useState(initialEvents);
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
      {accessState === 'checking' ? <div className="admin-auth-check">Админы эрх шалгаж байна...</div> : <form onSubmit={signInAdmin}>
        <h1>{accessState === 'denied' ? 'Хандах эрхгүй' : 'Админ нэвтрэх'}</h1>
        <p>{accessState === 'denied' ? 'Админы эрхтэй хэрэглэгчээр дахин нэвтэрнэ үү.' : 'Контент өөрчлөхийн тулд Supabase админ бүртгэлээр нэвтэрнэ.'}</p>
        {accessState === 'denied' ? <button type="button" className="admin-auth-secondary" onClick={async () => { await supabase.auth.signOut(); setAccessState('signed-out'); setAuthError(''); }}>Өөр бүртгэлээр нэвтрэх</button> : <>
          <label>Имэйл<input type="email" value={adminEmail} onChange={event => setAdminEmail(event.target.value)} required /></label>
          <label>Нууц үг<input type="password" value={adminPassword} onChange={event => setAdminPassword(event.target.value)} required /></label>
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
          {section === 'events' && <EventsView events={filteredEvents} filter={filter} setFilter={setFilter} onAdd={() => setEventModal(true)} onDelete={(id) => { setEvents(prev => prev.filter(event => event.id !== id)); notify('Эвент устгагдлаа'); }}/>} 
          {section === 'runs' && <RunsView />}
          {section === 'club-content' && <ClubContentEditor notify={notify} />}
          {section === 'login-content' && <LoginContentEditor notify={notify} />}
          {section === 'reports' && <ReportsView reports={reports} resolve={(id) => { setReports(prev => prev.filter(report => report.id !== id)); notify('Гомдлыг шийдвэрлэсэнд тооцлоо'); }}/>} 
        </div>
      </main>

      {eventModal && <EventModal onClose={() => setEventModal(false)} onSave={(event) => { setEvents(prev => [{ ...event, id: Date.now(), participants: 0, status: 'draft' }, ...prev]); setEventModal(false); notify('Шинэ эвент нооргоор үүслээ'); }}/>} 
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

function UsersView({ users, filter, setFilter, toggle, notify }: { users: AdminUser[]; filter:string; setFilter:(v:string)=>void; toggle:(id:number)=>void; notify:(m:string)=>void }) {
  return <><PageTitle title="Хэрэглэгчид" subtitle={`${initialUsers.length.toLocaleString()} бүртгэлтэй хэрэглэгчийн удирдлага`} action={<button className="primary-button" onClick={() => notify('Урилгын холбоос хуулагдлаа')}><Plus size={17}/>Хэрэглэгч урих</button>}/><section className="panel table-panel"><div className="table-tools"><Toolbar filter={filter} setFilter={setFilter} options={[{value:'all',label:'Бүгд'},{value:'active',label:'Идэвхтэй'},{value:'blocked',label:'Хаагдсан'}]}/><span>{users.length} үр дүн</span></div><div className="table-scroll"><table><thead><tr><th>ХЭРЭГЛЭГЧ</th><th>ЭЛССЭН</th><th>НИЙТ ЗАМ</th><th>ГҮЙЛТ</th><th>ТӨЛӨВ</th><th></th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><div className="person-cell"><Avatar name={user.name}/><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td>{user.joined}</td><td><strong>{user.distance} км</strong></td><td>{user.runs}</td><td><Status kind={user.status}/></td><td><button className="row-action" title={user.status === 'active' ? 'Хэрэглэгч хаах' : 'Хэрэглэгч идэвхжүүлэх'} onClick={() => toggle(user.id)}>{user.status === 'active' ? <CircleAlert size={18}/> : <UserCheck size={18}/>}</button></td></tr>)}</tbody></table></div>{users.length === 0 && <Empty title="Хэрэглэгч олдсонгүй"/>}</section></>;
}

function EventsView({ events, filter, setFilter, onAdd, onDelete }: { events:AdminEvent[]; filter:string; setFilter:(v:string)=>void; onAdd:()=>void; onDelete:(id:number)=>void }) {
  return <><PageTitle title="Эвентүүд" subtitle="Уралдаан, чэллэнж болон байгууллагын эвентүүд" action={<button className="primary-button" onClick={onAdd}><Plus size={17}/>Шинэ эвент</button>}/><section className="panel table-panel"><div className="table-tools"><Toolbar filter={filter} setFilter={setFilter} options={[{value:'all',label:'Бүгд'},{value:'active',label:'Идэвхтэй'},{value:'draft',label:'Ноорог'},{value:'ended',label:'Дууссан'}]}/><span>{events.length} эвент</span></div><div className="event-list">{events.map(event => <article className="event-row" key={event.id}><div className="event-date"><strong>{event.date.slice(-2)}</strong><span>{Number(event.date.slice(5,7))} сар</span></div><div className="event-info"><h3>{event.name}</h3><p>{event.org}</p></div><div className="event-metric"><span>Зай</span><strong>{event.distance} км</strong></div><div className="event-metric"><span>Оролцогч</span><strong>{event.participants}</strong></div><Status kind={event.status}/><button className="row-action" aria-label="Эвент устгах" onClick={() => onDelete(event.id)}><X size={18}/></button></article>)}</div>{events.length === 0 && <Empty title="Эвент олдсонгүй"/>}</section></>;
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
  const [name,setName]=useState(''); const [org,setOrg]=useState(''); const [date,setDate]=useState(''); const [distance,setDistance]=useState('');
  const valid = name.trim() && org.trim() && date && Number(distance)>0;
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="admin-modal" role="dialog" aria-modal="true" aria-label="Шинэ эвент" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><h2>Шинэ эвент</h2><p>Үндсэн мэдээллийг бөглөж ноорог үүсгэнэ.</p></div><button aria-label="Хаах" onClick={onClose}><X size={20}/></button></div><div className="form-grid"><label className="span-2">Эвентийн нэр<input value={name} onChange={e=>setName(e.target.value)} placeholder="Жишээ: Улаанбаатар марафон" autoFocus/></label><label>Зохион байгуулагч<input value={org} onChange={e=>setOrg(e.target.value)} placeholder="Байгууллагын нэр"/></label><label>Огноо<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Зай (км)<input type="number" min="1" value={distance} onChange={e=>setDistance(e.target.value)} placeholder="10"/></label></div><div className="modal-actions"><button className="outline-button" onClick={onClose}>Болих</button><button className="primary-button" disabled={!valid} onClick={()=>valid&&onSave({name:name.trim(),org:org.trim(),date,distance:Number(distance)})}><Plus size={16}/>Ноорог үүсгэх</button></div></div></div>;
}

const styles = `
.admin-auth-root{min-height:100vh;display:grid;place-items:center;padding:24px;background:#eef1ed;color:#151817;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}.admin-auth-card{width:min(430px,100%);padding:32px;border:1px solid #dfe4dd;border-radius:8px;background:#fff;box-shadow:0 24px 70px rgba(22,30,24,.12)}.admin-auth-brand{display:flex;align-items:center;gap:8px;margin-bottom:38px}.admin-auth-brand span{color:#92ee00;font-size:34px;font-weight:900}.admin-auth-brand strong{font-size:20px}.admin-auth-brand em{padding:4px 7px;background:#151817;color:#fff;font-size:9px;font-style:normal;letter-spacing:1px}.admin-auth-card h1{margin:0 0 8px;font-size:26px}.admin-auth-card p{margin:0 0 26px;color:#69706b;font-size:14px;line-height:1.55}.admin-auth-card form{display:grid;gap:16px}.admin-auth-card label{display:grid;gap:7px;color:#464c48;font-size:12px;font-weight:800}.admin-auth-card input{width:100%;height:48px;padding:0 13px;border:1px solid #d8ddd7;border-radius:6px;outline:none;font:inherit;letter-spacing:0}.admin-auth-card input:focus{border-color:#80cf00;box-shadow:0 0 0 3px rgba(146,238,0,.16)}.admin-auth-submit,.admin-auth-secondary{height:48px;border:0;border-radius:6px;background:#a8ff18;color:#10130f;font:inherit;font-weight:900;cursor:pointer}.admin-auth-submit:disabled{cursor:wait;opacity:.65}.admin-auth-secondary{width:100%;background:#151817;color:#fff}.admin-auth-error{padding:11px 12px;border:1px solid #ffd2ce;border-radius:6px;background:#fff1ef;color:#b52b20;font-size:13px}.admin-auth-check{padding:36px 0;text-align:center;color:#69706b}
*{box-sizing:border-box}body{margin:0}.admin-root{--lime:#a8ff18;--ink:#131619;--muted:#6f767d;--line:#e5e8e5;--bg:#f4f6f3;width:100%;height:100vh;overflow:auto;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}.admin-root button,.admin-root input{font:inherit;letter-spacing:0}.admin-sidebar{position:fixed;inset:0 auto 0 0;width:248px;background:#111412;color:#fff;padding:26px 16px 18px;display:flex;flex-direction:column;z-index:20}.admin-brand{height:48px;display:flex;align-items:center;gap:8px;padding:0 10px;font-size:20px}.brand-arrow{color:var(--lime);font-size:38px;font-weight:900;line-height:0;transform:translateY(-2px)}.admin-brand em{font-style:normal;font-size:9px;letter-spacing:1.2px;color:#111;background:var(--lime);padding:4px 5px;border-radius:3px;margin-left:2px}.admin-sidebar nav{margin-top:30px;flex:1}.admin-sidebar nav p{font-size:10px;letter-spacing:1.4px;color:#626963;margin:22px 12px 9px}.admin-sidebar nav button{border:0;background:transparent;color:#9ca39d;width:100%;height:45px;border-radius:6px;display:flex;align-items:center;gap:12px;padding:0 12px;cursor:pointer;text-align:left;margin:3px 0}.admin-sidebar nav button:hover{background:#1c211d;color:#fff}.admin-sidebar nav button.active{background:#252c25;color:#fff;box-shadow:inset 3px 0 var(--lime)}.admin-sidebar nav button.active svg{color:var(--lime)}.admin-sidebar nav button span{flex:1}.admin-sidebar nav button b{font-size:11px;background:#ff5d49;color:#fff;border-radius:10px;padding:2px 6px}.sidebar-profile{border-top:1px solid #282d29;padding:17px 5px 0;display:flex;align-items:center;gap:10px}.sidebar-profile>span{display:flex;flex:1;min-width:0;flex-direction:column}.sidebar-profile strong{font-size:13px}.sidebar-profile small{font-size:10px;color:#737a74;margin-top:3px;overflow:hidden;text-overflow:ellipsis}.sidebar-profile button{border:0;background:transparent;color:#697069;padding:7px;cursor:pointer}.admin-avatar{width:38px;height:38px;border-radius:50%;background:#dce8ce;color:#34501b;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}.admin-avatar.small{width:32px;height:32px;font-size:10px}.admin-main{margin-left:248px;min-height:100vh}.admin-topbar{height:70px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 32px;position:sticky;top:0;z-index:10}.topbar-search{width:min(420px,48vw);height:40px;background:#f3f5f2;border:1px solid transparent;border-radius:6px;display:flex;align-items:center;gap:10px;padding:0 12px;color:#899089}.topbar-search:focus-within{background:#fff;border-color:#b9c2b6}.topbar-search input{border:0;outline:0;background:transparent;min-width:0;flex:1;color:var(--ink);font-size:13px}.topbar-search button{border:0;background:transparent;color:#818881;display:flex;cursor:pointer}.icon-button{margin-left:auto;position:relative;width:39px;height:39px;border:1px solid var(--line);border-radius:6px;background:#fff;display:grid;place-items:center;cursor:pointer}.icon-button i{position:absolute;width:7px;height:7px;background:#ff5346;border:2px solid #fff;border-radius:50%;right:8px;top:7px}.topbar-user{display:flex;align-items:center;gap:10px;margin-left:18px;padding-left:18px;border-left:1px solid var(--line)}.topbar-user>span{display:flex;flex-direction:column}.topbar-user strong{font-size:12px}.topbar-user small{font-size:10px;color:#899089;margin-top:2px}.mobile-menu{display:none;border:0;background:transparent;padding:7px}.admin-content{padding:32px;max-width:1500px;margin:0 auto}.page-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px}.page-title h1{font-size:26px;line-height:1.15;margin:0;font-weight:780}.page-title p{font-size:13px;color:var(--muted);margin:7px 0 0}.primary-button,.outline-button{height:40px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 15px;font-weight:700;font-size:12px;cursor:pointer}.primary-button{background:var(--lime);color:#172000;border:1px solid #96e716}.primary-button:hover{background:#9aee10}.primary-button:disabled{opacity:.45;cursor:not-allowed}.outline-button{border:1px solid #d8ddd6;background:#fff;color:#3b413c}.panel{background:#fff;border:1px solid var(--line);border-radius:8px}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:18px}.stat-card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:18px;display:grid;grid-template-columns:auto 1fr;column-gap:12px;min-width:0}.stat-icon{grid-row:1/3;width:39px;height:39px;border-radius:7px;display:grid;place-items:center}.stat-icon.lime{background:#edffd0;color:#548800}.stat-icon.blue{background:#e1f2ff;color:#177ab6}.stat-icon.orange{background:#fff0df;color:#d76c0b}.stat-icon.violet{background:#eee8ff;color:#7350c7}.stat-card>span{font-size:11px;color:var(--muted);align-self:end}.stat-card>strong{font-size:23px;margin-top:2px;overflow:hidden;text-overflow:ellipsis}.stat-card>small{grid-column:1/3;display:flex;align-items:center;gap:5px;color:#39a348;font-weight:700;font-size:10px;margin-top:16px}.stat-card>small em{font-style:normal;color:#959b96;font-weight:400}.overview-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(265px,1fr);gap:18px;margin-bottom:18px}.panel-head{display:flex;justify-content:space-between;align-items:center;padding:19px 20px;border-bottom:1px solid var(--line);gap:15px}.panel-head h2{font-size:15px;margin:0}.panel-head p{font-size:11px;color:var(--muted);margin:4px 0 0}.panel-head>button:not(.text-button){border:1px solid var(--line);background:#fff;border-radius:5px;padding:7px 9px;display:flex;align-items:center;gap:6px;font-size:11px;color:#555c56}.chart-area{height:245px;display:flex;padding:25px 22px 18px 15px}.chart-y{width:48px;display:flex;flex-direction:column;justify-content:space-between;color:#9aa09a;font-size:9px;padding-bottom:25px}.bars{flex:1;display:grid;grid-template-columns:repeat(7,1fr);gap:20px;border-bottom:1px solid var(--line);background:repeating-linear-gradient(to bottom,#fff 0,#fff 54px,#edf0ed 55px)}.bar-column{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;font-size:10px;color:#838a84}.bar-track{height:190px;width:min(28px,60%);display:flex;align-items:flex-end}.bar-track i{width:100%;display:block;background:#92de1d;border-radius:3px 3px 0 0;transition:height .3s}.bar-column:last-child .bar-track i{background:#222923}.all-good{font-size:10px;color:#31863e;display:flex;align-items:center;gap:5px}.all-good i{width:7px;height:7px;border-radius:50%;background:#49bd58}.health-panel{padding-bottom:12px}.health-score{padding:18px 20px 12px}.health-score>div{background:#f4f7f1;border-radius:6px;padding:16px;display:grid;grid-template-columns:auto 1fr;column-gap:12px;color:#5b8c16}.health-score strong{font-size:22px;color:#1b211c}.health-score span{font-size:10px;color:var(--muted)}.health-score svg{grid-row:1/3}.health-row{display:flex;justify-content:space-between;padding:9px 20px;font-size:11px}.health-row span{color:var(--muted)}.health-row strong{font-size:10px}.recent-panel{overflow:hidden}.text-button{border:0;background:transparent;color:#568c0d;font-size:11px;font-weight:700;cursor:pointer}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:720px}th{text-align:left;font-size:9px;letter-spacing:.6px;color:#919891;background:#fafbfa;padding:11px 18px;border-bottom:1px solid var(--line)}td{padding:13px 18px;border-bottom:1px solid #eef0ee;font-size:11px;color:#5e655f;white-space:nowrap}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#fbfcfa}td strong{color:#202520}.person-cell{display:flex;align-items:center;gap:10px}.person-cell>span:not(.admin-avatar){display:flex;flex-direction:column}.person-cell small{color:#8d948e;margin-top:3px}.muted{color:#979d98}.admin-status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:650;padding:5px 8px;border-radius:12px}.admin-status i{width:6px;height:6px;border-radius:50%}.status-active{color:#238039;background:#eaf8ed}.status-active i{background:#3dae50}.status-blocked{color:#a53d34;background:#fff0ee}.status-blocked i{background:#dd5c4d}.status-draft{color:#907014;background:#fff8dc}.status-draft i{background:#c49a21}.status-ended,.status-resolved{color:#6d746e;background:#eef0ee}.status-ended i,.status-resolved i{background:#899089}.status-open{color:#b04b33;background:#fff0eb}.status-open i{background:#e76345}.table-panel{overflow:hidden}.table-tools{height:57px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid var(--line)}.table-tools>span{font-size:10px;color:var(--muted)}.filter-tabs{display:flex;gap:4px}.filter-tabs button{border:0;background:transparent;padding:7px 11px;border-radius:5px;color:#747b75;font-size:11px;cursor:pointer}.filter-tabs button.active{background:#edf4e8;color:#426c08;font-weight:700}.row-action{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);background:#fff;border-radius:5px;color:#747b75;cursor:pointer}.row-action:hover{color:#d64d40;border-color:#e9b7b1}.event-list{padding:0 18px}.event-row{display:grid;grid-template-columns:58px minmax(180px,1fr) 100px 100px 90px 34px;gap:16px;align-items:center;padding:15px 0;border-bottom:1px solid #edf0ed}.event-row:last-child{border:0}.event-date{width:50px;height:50px;border-radius:6px;background:#202520;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}.event-date strong{font-size:17px}.event-date span{font-size:9px;color:#b5bbb5}.event-info h3{font-size:13px;margin:0}.event-info p{font-size:10px;color:var(--muted);margin:4px 0 0}.event-metric{display:flex;flex-direction:column}.event-metric span{font-size:9px;color:#919791}.event-metric strong{font-size:12px;margin-top:4px}.mini-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:18px}.mini-stats>div{background:#fff;border:1px solid var(--line);border-radius:7px;padding:16px;display:flex;align-items:center;gap:12px;color:#629c12}.mini-stats span{display:flex;flex-direction:column;color:var(--muted);font-size:10px}.mini-stats strong{color:var(--ink);font-size:16px;margin-top:3px}.report-summary{display:grid;grid-template-columns:repeat(2,minmax(0,260px));gap:15px;margin-bottom:18px}.report-summary>div{background:#fff;border:1px solid var(--line);border-radius:7px;padding:18px;display:grid;grid-template-columns:auto 1fr;column-gap:12px}.report-summary svg{grid-row:1/3;color:#e15b45}.report-summary strong{font-size:19px}.report-summary span{font-size:10px;color:var(--muted)}.report-list{padding:0 20px}.report-list article{display:flex;align-items:center;gap:14px;padding:18px 0;border-bottom:1px solid var(--line)}.report-list article:last-child{border:0}.report-icon{width:39px;height:39px;border-radius:6px;background:#fff0eb;color:#db6048;display:grid;place-items:center}.report-main{flex:1}.report-main>div{display:flex;align-items:center;gap:9px}.report-main>div>span{font-size:9px;color:#999f9a}.report-main h3{font-size:13px;margin:7px 0 4px}.report-main p{font-size:11px;color:var(--muted);margin:0}.report-main p b{color:#424843}.empty{text-align:center;padding:54px 20px;color:#919791;display:flex;flex-direction:column;align-items:center;gap:7px}.empty strong{font-size:13px;color:#525852}.empty span{font-size:10px}.modal-backdrop{position:fixed;inset:0;background:rgba(14,17,14,.62);display:grid;place-items:center;padding:20px;z-index:50}.admin-modal{width:min(580px,100%);background:#fff;border-radius:8px;box-shadow:0 25px 70px rgba(0,0,0,.28)}.modal-head{padding:21px 23px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between}.modal-head h2{margin:0;font-size:18px}.modal-head p{font-size:11px;color:var(--muted);margin:5px 0 0}.modal-head button{border:0;background:#f1f3f0;border-radius:5px;width:34px;height:34px;display:grid;place-items:center;cursor:pointer}.form-grid{padding:22px 23px;display:grid;grid-template-columns:1fr 1fr;gap:16px}.form-grid label{font-size:10px;font-weight:700;color:#565d57;display:flex;flex-direction:column;gap:7px}.form-grid label.span-2{grid-column:1/3}.form-grid input{height:42px;border:1px solid #daddd9;border-radius:5px;padding:0 11px;outline:0;color:#202520}.form-grid input:focus{border-color:#81bb2e;box-shadow:0 0 0 3px #edf7df}.modal-actions{padding:16px 23px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:9px}.admin-toast{position:fixed;right:24px;bottom:24px;background:#1b201c;color:#fff;border-radius:6px;padding:13px 16px;display:flex;align-items:center;gap:9px;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.22);z-index:70}.admin-toast svg{color:var(--lime)}.sidebar-scrim{display:none}
@media(max-width:1050px){.stats-grid{grid-template-columns:repeat(2,1fr)}.overview-grid{grid-template-columns:1fr}.event-row{grid-template-columns:58px minmax(180px,1fr) 90px 90px 34px}.event-row>.admin-status{display:none}}
@media(max-width:760px){.admin-sidebar{transform:translateX(-100%);transition:transform .2s}.admin-sidebar.is-open{transform:translateX(0)}.sidebar-scrim{display:block;position:fixed;inset:0;border:0;background:rgba(0,0,0,.45);z-index:15}.admin-main{margin-left:0}.admin-topbar{padding:0 14px;height:62px}.mobile-menu{display:flex;margin-right:8px}.topbar-search{width:auto;flex:1}.topbar-user{display:none}.admin-content{padding:22px 15px}.page-title{align-items:flex-start}.page-title h1{font-size:22px}.page-title .primary-button{padding:0 11px}.stats-grid{grid-template-columns:1fr 1fr;gap:10px}.stat-card{padding:14px}.stat-card>strong{font-size:19px}.stat-card>small em{display:none}.chart-area{padding-right:14px}.bars{gap:9px}.health-panel{min-width:0}.event-list{padding:0 12px}.event-row{grid-template-columns:52px minmax(130px,1fr) 68px 34px;gap:10px}.event-row .event-metric:nth-of-type(3){display:none}.event-row>.admin-status{display:none}.mini-stats{grid-template-columns:1fr}.report-summary{grid-template-columns:1fr 1fr}.report-list article{align-items:flex-start;flex-wrap:wrap}.report-list article>.outline-button{margin-left:53px}.form-grid{grid-template-columns:1fr}.form-grid label.span-2{grid-column:auto}}
@media(max-width:440px){.stats-grid{grid-template-columns:1fr}.page-title{flex-direction:column}.page-title .primary-button{width:100%}.report-summary{grid-template-columns:1fr}.filter-tabs{overflow-x:auto}.table-tools>span{display:none}.admin-toast{left:15px;right:15px;bottom:15px}.event-row{grid-template-columns:52px 1fr 34px}.event-row .event-metric{display:none}}
`;
