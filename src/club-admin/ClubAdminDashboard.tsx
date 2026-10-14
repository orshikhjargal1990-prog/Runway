import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Building2, CalendarDays, CheckCircle2, Gauge, LogOut, Pencil, Plus, RefreshCw, Route, Save, Trash2, Upload, Users } from 'lucide-react/dist/cjs/lucide-react.js';
import { supabase } from '../lib/supabase';
import {
  createManagedEvent, deleteLocalClubEvent, deleteManagedEvent, fetchClubAdminData, findLocalClubAdminCredential, getClubAdminContext, getLocalClubContentOverrides,
  getLocalClubEvents, getLocalDeletedClubEventIds, saveLocalClubContentOverride, saveLocalClubEvent, subscribeToClubLiveRuns, updateManagedClub, updateManagedClubGallery, updateManagedEvent, updateRegistrationStatus,
  type ClubAdminContext, type ClubAdminEvent, type ClubAdminMember, type EventRegistration, type LiveRun
} from '../lib/clubAdminApi';
import { DEFAULT_CLUB_EVENTS, DEFAULT_RUNNING_CLUBS } from '../native/clubs';

type ViewKey = 'overview' | 'content' | 'members' | 'events' | 'live';
type ClubRow = { id:string; name:string; city:string; description:string; image_url:string; meeting_info:string; member_count:number; weekly_km:number; total_km:number; gallery_images:string[]; social_links?: { facebook?: string; instagram?: string; website?: string } };
type Data = { club: ClubRow; members: ClubAdminMember[]; events: ClubAdminEvent[]; registrations: EventRegistration[]; liveRuns: LiveRun[] };

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
function pace(seconds: number | null) { return seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}` : '--'; }
function speed(distanceKm: number, seconds: number) { return seconds > 0 ? `${((distanceKm / seconds) * 3600).toFixed(1)} км/ц` : '--'; }
function date(value: string) { return new Intl.DateTimeFormat('mn-MN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); }
function ago(value: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds} сек өмнө`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} мин өмнө` : date(value);
}
function datetimeInput(value: string) {
  const next = new Date(value);
  if (Number.isNaN(next.getTime())) return '';
  const offset = next.getTimezoneOffset() * 60000;
  return new Date(next.getTime() - offset).toISOString().slice(0, 16);
}
function buildLocalClubData(clubId: string): Data {
  const club = DEFAULT_RUNNING_CLUBS.find(item => item.id === clubId) ?? DEFAULT_RUNNING_CLUBS[0];
  const local = getLocalClubContentOverrides().find(item => item.clubId === club.id);
  const localEvents = getLocalClubEvents().filter(event => event.clubId === club.id);
  const localEventIds = new Set(localEvents.map(event => event.id));
  const deletedEventIds = new Set(getLocalDeletedClubEventIds());
  const defaultEvents = DEFAULT_CLUB_EVENTS.filter(event => event.clubId === club.id).map(event => ({
    id: event.id,
    title: event.title,
    location: event.location,
    startsAt: event.startsAt,
    distanceKm: event.distanceKm ?? null,
    imageUrl: event.image,
    description: event.description,
    advice: event.advice,
    enabled: true
  })).filter(event => !localEventIds.has(event.id) && !deletedEventIds.has(event.id));
  const mappedLocalEvents = localEvents.map(event => ({
    id: event.id,
    title: event.title,
    location: event.location,
    startsAt: event.startsAt,
    distanceKm: event.distanceKm,
    imageUrl: event.imageUrl,
    description: event.description,
    advice: event.advice,
    enabled: true
  }));
  return {
    club: {
      id: club.id, name: club.name, city: club.city, description: club.description, image_url: local?.imageUrl ?? club.image,
      meeting_info: club.meetingInfo, member_count: club.memberCount, weekly_km: club.weeklyKm, total_km: club.totalKm,
      gallery_images: local?.galleryImages?.length ? local.galleryImages : club.galleryImages,
      social_links: local?.socialLinks ?? club.socialLinks
    },
    members: [],
    events: [...mappedLocalEvents, ...defaultEvents],
    registrations: [],
    liveRuns: []
  };
}

export function ClubAdminDashboard() {
  const [context,setContext]=useState<ClubAdminContext|null>(null); const [data,setData]=useState<Data|null>(null);
  const [view,setView]=useState<ViewKey>('overview'); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [phone,setPhone]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [toast,setToast]=useState('');

  const load = useCallback(async () => {
    try {
      const nextContext = await getClubAdminContext();
      if (!nextContext) { setContext(null); setError(''); setLoading(false); return; }
      setContext(nextContext); setData(await fetchClubAdminData(nextContext.clubId) as Data); setLoading(false); setError('');
    } catch {
      setContext(null);
      setData(null);
      setError('');
      setLoading(false);
    }
  },[]);

  useEffect(()=>{ supabase.auth.getSession().then(({data:session})=>{ if(!session.session){setLoading(false);return;} void load(); }).catch(()=>setLoading(false)); },[load]);
  useEffect(()=>context ? subscribeToClubLiveRuns(context.clubId,()=>void load()) : undefined,[context,load]);
  const notify=(message:string)=>{setToast(message);window.setTimeout(()=>setToast(''),2600);};
  const signIn=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');
    const localCredential = findLocalClubAdminCredential(phone, password);
    if (localCredential) {
      setContext({ clubId: localCredential.clubId, clubName: localCredential.clubName, email: localCredential.phone });
      setData(buildLocalClubData(localCredential.clubId));
      setBusy(false);
      return;
    }
    setError('Утасны дугаар эсвэл нууц үг буруу байна.');
    setBusy(false);
  };

  if(loading)return <div className="ca-auth"><style>{styles}</style><div className="ca-loader">Клубын эрх шалгаж байна...</div></div>;
  if(!context||!data)return <div className="ca-auth"><style>{styles}</style><form className="ca-login" onSubmit={signIn}><div className="ca-logo"><b>↗ RUNBOOST</b><span>CLUB ADMIN</span></div><h1>Клубын удирдлага</h1><p>Супер админаас авсан утасны дугаар, нууц үгээр нэвтэрнэ.</p><label>Утасны дугаар<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="99112233" required/></label><label>Нууц үг<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="ca-error">{error}</div>}<button disabled={busy}>{busy?'Нэвтэрч байна...':'Нэвтрэх'}</button></form></div>;

  const nav:[ViewKey,string,React.ReactNode][]=[['overview','Хяналтын самбар',<Gauge key="overview" size={18}/>],['content','Клубын мэдээлэл',<Building2 key="content" size={18}/>],['members','Гишүүдийн гүйлт',<Users key="members" size={18}/>],['events','Арга хэмжээ',<CalendarDays key="events" size={18}/>],['live','Realtime гүйлт',<Activity key="live" size={18}/>]];
  return <div className="ca-root"><style>{styles}</style><aside><div className="ca-logo"><b>↗ RUNBOOST</b><span>CLUB ADMIN</span></div><div className="ca-club"><img src={data.club.image_url}/><div><strong>{data.club.name}</strong><small>{data.club.city}</small></div></div><nav>{nav.map(([key,label,icon])=><button key={key} className={view===key?'active':''} onClick={()=>setView(key)}>{icon}<span>{label}</span>{key==='live'&&data.liveRuns.length>0?<i>{data.liveRuns.length}</i>:null}</button>)}</nav><button className="ca-logout" onClick={()=>void supabase.auth.signOut().then(()=>{setContext(null);setData(null);})}><LogOut size={17}/>Гарах</button></aside><main><header><div><strong>{nav.find(item=>item[0]===view)?.[1]}</strong><small>{context.email}</small></div><button title="Шинэчлэх" onClick={()=>void load()}><RefreshCw size={17}/></button></header><section className="ca-content">
	    {view==='overview'&&<Overview data={data}/>} {view==='content'&&<Content club={data.club} onSaved={async(savedClub)=>{setData(current=>current?{...current,club:savedClub}:current);if(context.email.includes('@')) await load();notify('Клубын мэдээлэл хадгалагдлаа');}}/>} {view==='members'&&<Members members={data.members}/>} {view==='events'&&<Events clubId={context.clubId} clubName={data.club.name} events={data.events} registrations={data.registrations} liveRuns={data.liveRuns} onChanged={async(message='Өөрчлөлт хадгалагдлаа')=>{if(context.email.includes('@')) await load(); else setData(buildLocalClubData(context.clubId));notify(message);}}/>} {view==='live'&&<Live events={data.events} runs={data.liveRuns}/>} </section></main>{toast&&<div className="ca-toast"><CheckCircle2 size={16}/>{toast}</div>}</div>;
}

function Overview({data}:{data:Data}) { const total=data.members.reduce((s,m)=>s+m.totalKm,0),week=data.members.reduce((s,m)=>s+m.weeklyKm,0);return <><div className="ca-title"><div><h1>{data.club.name}</h1><p>Клубын үйл ажиллагааны өнөөдрийн тойм</p></div><span className="live-pill"><i/>Realtime идэвхтэй</span></div><div className="stat-grid"><Stat icon={<Users/>} label="Нийт гишүүн" value={data.members.length}/><Stat icon={<Route/>} label="Гишүүдийн нийт км" value={`${total.toFixed(1)} км`}/><Stat icon={<Activity/>} label="7 хоногийн км" value={`${week.toFixed(1)} км`}/><Stat icon={<CalendarDays/>} label="Төлөвлөсөн эвент" value={data.events.filter(e=>new Date(e.startsAt)>new Date()).length}/></div><div className="split"><section className="panel"><Head title="Сүүлийн идэвхтэй гүйгчид" meta={`${data.liveRuns.length} live`}/><LiveTable runs={data.liveRuns.slice(0,6)} events={data.events}/></section><section className="panel"><Head title="Ойрын арга хэмжээ" meta={`${data.events.length} нийт`}/><div className="event-mini">{data.events.slice(0,5).map(e=><div key={e.id}><time>{date(e.startsAt)}</time><span><strong>{e.title}</strong><small>{e.location}</small></span><b>{data.registrations.filter(r=>r.eventId===e.id&&r.status!=='cancelled').length}</b></div>)}</div></section></div></>; }
function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:string|number}){return <div className="stat"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>}
function Head({title,meta}:{title:string;meta:string}){return <div className="panel-head"><h2>{title}</h2><span>{meta}</span></div>}

function readImage(file: File, onLoad: (uri: string) => void) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const raw = String(reader.result);
    const image = new Image();
    image.onload = () => {
      const maxSide = 1200;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      onLoad(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => onLoad(raw);
    image.src = raw;
  };
  reader.readAsDataURL(file);
}

function Content({club,onSaved}:{club:ClubRow;onSaved:(club:ClubRow)=>Promise<void>}) {
  const [form,setForm]=useState(club);
  const [saving,setSaving]=useState(false);
  useEffect(()=>setForm(club),[club]);
  const gallery = form.gallery_images?.length ? form.gallery_images : [form.image_url];
  const save=async()=>{
    setSaving(true);
    saveLocalClubContentOverride({ clubId: club.id, imageUrl: form.image_url, galleryImages: gallery, socialLinks: form.social_links });
    try {
      await updateManagedClub(club.id,{name:form.name,city:form.city,description:form.description,image_url:form.image_url,meeting_info:form.meeting_info,social_links:form.social_links ?? {}});
      await updateManagedClubGallery(club.id, gallery);
    } catch {
      // Local credential mode still updates the app preview through localStorage.
    }
    await onSaved(form);
    setSaving(false);
  };
  const setCover=(file?:File)=>file&&readImage(file,image=>setForm({...form,image_url:image,gallery_images:gallery[0]===form.image_url?[image,...gallery.slice(1)]:gallery}));
  const addGallery=(files:FileList|null)=>files&&Array.from(files).forEach(file=>readImage(file,image=>setForm(current=>({...current,gallery_images:[...(current.gallery_images?.length?current.gallery_images:[current.image_url]),image]}))));
  return <>
    <div className="ca-title"><div><h1>Клубын хуудас</h1><p>Апп дээр харагдах cover зураг, gallery болон үндсэн мэдээлэл</p></div><button className="primary" disabled={saving} onClick={()=>void save()}><Save size={16}/>{saving?'Хадгалж байна':'Хадгалах'}</button></div>
    <section className="panel edit-grid">
      <div>
        <div className="cover"><img src={form.image_url}/><label><Upload size={15}/>Cover upload<input type="file" accept="image/*" onChange={e=>setCover(e.target.files?.[0])}/></label></div>
        <div className="club-gallery-admin"><div><strong>Gallery зураг</strong><label><Upload size={14}/>Зураг нэмэх<input multiple type="file" accept="image/*" onChange={e=>addGallery(e.target.files)}/></label></div>{gallery.map((image,index)=><figure key={`${image}-${index}`}><img src={image}/><button aria-label="Зураг устгах" onClick={()=>setForm({...form,gallery_images:gallery.filter((_,itemIndex)=>itemIndex!==index)})}><Trash2 size={14}/></button></figure>)}</div>
      </div>
      <div className="fields">
        <label>Клубын нэр<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>Хот<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
        <label className="wide">Нүүр зургийн URL<input value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})}/></label>
        <label className="wide">Холбоо барих<input value={form.meeting_info} onChange={e=>setForm({...form,meeting_info:e.target.value})} placeholder="Утас, имэйл"/></label>
        <div className="social-admin-panel">
          <strong>Social холбоосууд</strong>
          <small>App-ийн “Холбоо барих” хэсэгт icon хэлбэрээр харагдана.</small>
          <label>Facebook<input value={form.social_links?.facebook ?? ''} onChange={e=>setForm({...form,social_links:{...form.social_links,facebook:e.target.value}})} placeholder="https://facebook.com/club"/></label>
          <label>Instagram<input value={form.social_links?.instagram ?? ''} onChange={e=>setForm({...form,social_links:{...form.social_links,instagram:e.target.value}})} placeholder="https://instagram.com/club"/></label>
          <label>Web<input value={form.social_links?.website ?? ''} onChange={e=>setForm({...form,social_links:{...form.social_links,website:e.target.value}})} placeholder="https://club.mn"/></label>
        </div>
        <label className="wide">Дэлгэрэнгүй танилцуулга<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      </div>
    </section>
  </>;
}

function Members({members}:{members:ClubAdminMember[]}) {
  const [selectedId,setSelectedId]=useState(members[0]?.id ?? '');
  const selected = members.find(member => member.id === selectedId) ?? members[0] ?? null;
  useEffect(()=>{if(!members.some(member=>member.id===selectedId))setSelectedId(members[0]?.id ?? '');},[members,selectedId]);
  const maxDayKm = Math.max(1, ...(selected?.weeklyRuns.map(item => item.distanceKm) ?? [0]));
  return <><div className="ca-title"><div><h1>Гишүүдийн гүйлт</h1><p>7 хоногийн гүйлт, сүүлийн гүйлтийн огноо, маршрут, зай, темпийн дэлгэрэнгүй</p></div></div><section className="panel table-wrap"><table><thead><tr><th>Гишүүн</th><th>Нэгдсэн</th><th>7 хоног</th><th>Нийт км</th><th>Гүйлт</th><th>Сүүлийн гүйлт</th></tr></thead><tbody>{members.map(m=>{const last=m.recentRuns[0];return <tr key={m.id} className={selected?.id===m.id?'selected-row':''} onClick={()=>setSelectedId(m.id)}><td><div className="person">{m.avatarUrl?<img src={m.avatarUrl}/>:<i>{m.name[0]}</i>}<strong>{m.name}</strong></div></td><td>{date(m.joinedAt)}</td><td><b className="green">{m.weeklyKm.toFixed(1)} км</b></td><td><strong>{m.totalKm.toFixed(1)} км</strong></td><td>{m.runCount}</td><td>{last ? <span className="last-run">{date(last.completedAt)} · {last.routeTitle}</span> : <span className="muted">Гүйлт алга</span>}</td></tr>})}</tbody></table>{!members.length&&<Empty text="Клубт гишүүн алга"/>}</section>{selected&&<section className="member-detail-grid"><article className="panel member-week"><Head title={`${selected.name} · 7 хоног`} meta={`${selected.weeklyKm.toFixed(1)} км`}/><div className="week-chart">{selected.weeklyRuns.map(day=><div key={day.date} className="week-day"><span>{day.distanceKm?day.distanceKm.toFixed(1):''}</span><i style={{height:`${Math.max(6,(day.distanceKm/maxDayKm)*96)}px`}}/><small>{day.label}</small></div>)}</div></article><article className="panel member-recent"><Head title="Сүүлийн гүйлтүүд" meta={`${selected.recentRuns.length} бичлэг`}/><div className="table-wrap"><table><thead><tr><th>Сар өдөр</th><th>Хаана гүйсэн</th><th>Зай</th><th>Хугацаа</th><th>Темп</th></tr></thead><tbody>{selected.recentRuns.map(run=><tr key={run.id}><td>{date(run.completedAt)}</td><td><strong>{run.routeTitle}</strong>{run.routeArea?<small className="route-area">{run.routeArea}</small>:null}</td><td><strong>{run.distanceKm.toFixed(2)} км</strong></td><td>{duration(run.durationSeconds)}</td><td>{pace(run.paceSecondsPerKm)} /км</td></tr>)}</tbody></table>{!selected.recentRuns.length&&<Empty text="Энэ гишүүн гүйлт бүртгээгүй байна"/>}</div></article></section>}</> }

function Events({clubId,clubName,events,registrations,liveRuns,onChanged}:{clubId:string;clubName:string;events:ClubAdminEvent[];registrations:EventRegistration[];liveRuns:LiveRun[];onChanged:(message?:string)=>Promise<void>}) {
  const [editing,setEditing]=useState<ClubAdminEvent|null>(null);
  const [selected,setSelected]=useState(events[0]?.id??'');
  const [deleting,setDeleting]=useState('');
  const [now,setNow]=useState(Date.now());
  const selectedEvent = events.find(event => event.id === selected) ?? null;
  const selectedRegistrations = useMemo(()=>registrations.filter(registration=>registration.eventId===selected),[registrations,selected]);
  const selectedRuns = useMemo(()=>liveRuns.filter(run=>run.eventId===selected),[liveRuns,selected]);
  const selectedRunByUser = useMemo(()=>new Map(selectedRuns.map(run=>[run.userId,run])),[selectedRuns]);
  const eventTotalKm = selectedRuns.reduce((sum,run)=>sum+run.distanceKm,0);
  const eventAvgSpeed = selectedRuns.reduce((sum,run)=>sum+(run.durationSeconds>0?(run.distanceKm/run.durationSeconds)*3600:0),0)/(selectedRuns.length||1);
  useEffect(()=>{if(!events.some(event=>event.id===selected))setSelected(events[0]?.id??'');},[events,selected]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  const remove=async(event:ClubAdminEvent)=>{
    if(!window.confirm(`"${event.title}" арга хэмжээг устгах уу?`)) return;
    setDeleting(event.id);
    try {
      await deleteManagedEvent(clubId,event.id);
    } catch {
      deleteLocalClubEvent(event.id);
    }
    setDeleting('');
    await onChanged('Арга хэмжээ устгагдлаа');
  };
  return <><div className="ca-title"><div><h1>Арга хэмжээ</h1><p>Үүсгэсэн event-ийн бүртгэл болон тухайн цагийн live гүйцэтгэлийг хянах</p></div><button className="primary" onClick={()=>setEditing({id:'',title:'',location:'',startsAt:'',distanceKm:5,imageUrl:'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80',description:'',advice:[],enabled:true})}><Plus size={16}/>Эвент нэмэх</button></div><div className="event-layout"><section className="panel event-list"><Head title="Арга хэмжээнүүд" meta={`${events.length} эвент`}/>{events.map(e=><button key={e.id} className={selected===e.id?'active':''} onClick={()=>setSelected(e.id)}><time>{date(e.startsAt)}</time><span><strong>{e.title}</strong><small>{e.location}</small></span><b>{registrations.filter(r=>r.eventId===e.id&&r.status!=='cancelled').length}</b></button>)}</section><section className="panel table-wrap"><div className="event-detail-head"><Head title="Оролцогчид · realtime" meta={selectedEvent?.title??'Эвент сонгоно уу'}/>{selectedEvent&&<div className="event-manage-actions"><button title="Арга хэмжээ засах" onClick={()=>setEditing(selectedEvent)}><Pencil size={15}/><span>Засах</span></button><button title="Арга хэмжээ устгах" disabled={deleting===selectedEvent.id} onClick={()=>void remove(selectedEvent)}><Trash2 size={15}/><span>{deleting===selectedEvent.id?'Устгаж байна':'Устгах'}</span></button></div>}</div>{selectedEvent?<div className="event-live-summary"><div><span>Бүртгэлтэй</span><strong>{selectedRegistrations.filter(r=>r.status!=='cancelled').length}</strong></div><div><span>Одоо гүйж байна</span><strong>{selectedRuns.length}</strong></div><div><span>Live нийт км</span><strong>{eventTotalKm.toFixed(2)} км</strong></div><div><span>Дундаж хурд</span><strong>{selectedRuns.length?`${eventAvgSpeed.toFixed(1)} км/ц`:'--'}</strong></div></div>:null}<table className="event-participants-table"><thead><tr><th>Оролцогч</th><th>Бүртгэл</th><th>Төлөв</th><th>Live км</th><th>Цаг</th><th>Хурд</th><th>Темп</th><th>Шинэчлэлт</th><th>Live төлөв</th></tr></thead><tbody>{selectedRegistrations.map(r=>{const run=selectedRunByUser.get(r.userId);return <tr key={r.userId}><td><strong>{r.name}</strong></td><td>{date(r.joinedAt)}</td><td><select value={r.status} onChange={e=>void updateRegistrationStatus(r.eventId,r.userId,e.target.value as EventRegistration['status']).then(()=>onChanged())}><option value="registered">Бүртгүүлсэн</option><option value="confirmed">Баталгаажсан</option><option value="checked_in">Ирсэн</option><option value="cancelled">Цуцалсан</option></select></td><td>{run?<strong>{run.distanceKm.toFixed(2)} км</strong>:<span className="muted">--</span>}</td><td>{run?duration(run.durationSeconds):<span className="muted">--</span>}</td><td>{run?<strong>{speed(run.distanceKm,run.durationSeconds)}</strong>:<span className="muted">--</span>}</td><td>{run?`${pace(run.paceSecondsPerKm)} /км`:<span className="muted">--</span>}</td><td>{run?<span className={now-new Date(run.updatedAt).getTime()<15000?'fresh':'muted'}>{ago(run.updatedAt,now)}</span>:<span className="muted">Эхлээгүй</span>}</td><td>{run?<span className={`status ${run.status}`}>{run.status==='running'?'Гүйж байна':'Түр зогссон'}</span>:<span className="status idle">Хүлээгдэж байна</span>}</td></tr>})}</tbody></table>{!selectedRegistrations.length&&<Empty text="Оролцогч бүртгүүлээгүй байна"/>}{selectedRuns.some(run=>!selectedRegistrations.some(registration=>registration.userId===run.userId))?<><Head title="Бүртгэлгүй live оролцогч" meta="active_runs дээр байна"/><LiveTable runs={selectedRuns.filter(run=>!selectedRegistrations.some(registration=>registration.userId===run.userId))} events={events} now={now}/></>:null}</section></div>{editing&&<EventDialog clubId={clubId} clubName={clubName} event={editing.id?editing:null} onClose={()=>setEditing(null)} onSaved={async(message)=>{setEditing(null);await onChanged(message);}}/>}</>
}

function EventDialog({clubId,clubName,event,onClose,onSaved}:{clubId:string;clubName:string;event:ClubAdminEvent|null;onClose:()=>void;onSaved:(message:string)=>Promise<void>}) {
  const [form,setForm]=useState({
    title:event?.title ?? '',
    location:event?.location ?? '',
    startsAt:event ? datetimeInput(event.startsAt) : '',
    distanceKm:String(event?.distanceKm ?? 5),
    imageUrl:event?.imageUrl ?? 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80',
    description:event?.description ?? '',
    advice:event?.advice.join('\n') ?? ''
  });
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const setEventImage=(file?:File)=>file&&readImage(file,image=>setForm(current=>({...current,imageUrl:image})));
  const save=async()=>{
    setSaving(true);
    setError('');
    const startsAt = new Date(form.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      setError('Эхлэх огноо, цагийг зөв оруулна уу.');
      setSaving(false);
      return;
    }
    const payload = {title:form.title,location:form.location,startsAt:startsAt.toISOString(),distanceKm:Number(form.distanceKm)||null,imageUrl:form.imageUrl,description:form.description,advice:form.advice.split('\n').map(v=>v.trim()).filter(Boolean)};
    try {
      if (event?.id) await updateManagedEvent(clubId,event.id,payload);
      else await createManagedEvent(clubId,payload);
    } catch {
      try {
        saveLocalClubEvent({id:event?.id || undefined,clubId,clubName,...payload});
      } catch {
        setError('Арга хэмжээг хадгалж чадсангүй. Зургийн хэмжээ их байж магадгүй, жижиг зураг сонгоод дахин оролдоно уу.');
        setSaving(false);
        return;
      }
    }
    try {
      await onSaved(event?.id?'Арга хэмжээний мэдээлэл шинэчлэгдлээ':'Арга хэмжээ амжилттай хадгалагдлаа');
    } catch {
      setError('Хадгалсан боловч жагсаалтыг шинэчилж чадсангүй. Refresh хийгээд шалгана уу.');
    } finally {
      setSaving(false);
    }
  };
  return <div className="dialog-back"><form className="dialog" onSubmit={e=>{e.preventDefault();void save();}}>
    <h2>{event?'Арга хэмжээ засах':'Шинэ арга хэмжээ'}</h2>
    <label>Нэр<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
    <div className="two"><label>Байршил<input required value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Зай (км)<input type="number" value={form.distanceKm} onChange={e=>setForm({...form,distanceKm:e.target.value})}/></label></div>
    <label>Эхлэх огноо, цаг<input required type="datetime-local" value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})}/></label>
    <div className="event-image-picker">
      <img src={form.imageUrl}/>
      <label><Upload size={15}/>Зураг upload<input type="file" accept="image/*" onChange={e=>setEventImage(e.target.files?.[0])}/></label>
    </div>
    <label>Зургийн URL<input required value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})}/></label>
    <label>Тайлбар<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <label>Зөвлөмжүүд (мөр бүрээр)<textarea value={form.advice} onChange={e=>setForm({...form,advice:e.target.value})}/></label>
    {error&&<div className="ca-error">{error}</div>}
    <div><button type="button" className="secondary" onClick={onClose}>Болих</button><button className="primary" disabled={saving}>{saving?'Хадгалж байна':event?'Хадгалах':'Үүсгэх'}</button></div>
  </form></div>;
}

function Live({events,runs}:{events:ClubAdminEvent[];runs:LiveRun[]}) { const [eventId,setEventId]=useState('all');const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);const visible=useMemo(()=>runs.filter(r=>eventId==='all'||r.eventId===eventId),[eventId,runs]);const avgSpeed=visible.reduce((sum,r)=>sum+(r.durationSeconds>0?(r.distanceKm/r.durationSeconds)*3600:0),0)/(visible.length||1);return <><div className="ca-title"><div><h1>Realtime гүйлт</h1><p>Клубын арга хэмжээнд яг одоо оролцож буй хүмүүсийн хурд, цаг, км болон GPS шинэчлэлт</p></div><select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="all">Бүх live гүйлт</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></div><section className="live-summary"><div><i/><strong>{visible.length}</strong><span>Одоо гүйж байна</span></div><div><strong>{visible.reduce((s,r)=>s+r.distanceKm,0).toFixed(2)} км</strong><span>Live нийт зай</span></div><div><strong>{visible.length?`${avgSpeed.toFixed(1)} км/ц`:'--'}</strong><span>Дундаж хурд</span></div></section><section className="panel table-wrap"><LiveTable runs={visible} events={events} now={now}/>{!visible.length&&<Empty text="Одоогоор идэвхтэй гүйлт алга"/>}</section></> }
function LiveTable({runs,events,now=Date.now()}:{runs:LiveRun[];events?:ClubAdminEvent[];now?:number}){const eventNames=new Map((events??[]).map(event=>[event.id,event.title]));return <table><thead><tr><th>Гүйгч</th><th>Арга хэмжээ</th><th>Маршрут</th><th>Км</th><th>Цаг</th><th>Хурд</th><th>Темп</th><th>Шинэчлэлт</th><th>Төлөв</th></tr></thead><tbody>{runs.map(r=><tr key={r.userId}><td><div className="live-name"><i/><strong>{r.name}</strong></div></td><td>{r.eventId ? eventNames.get(r.eventId) ?? 'Клубын эвент' : <span className="muted">Event сонгоогүй</span>}</td><td>{r.routeTitle}</td><td><strong>{r.distanceKm.toFixed(2)} км</strong></td><td>{duration(r.durationSeconds)}</td><td><strong>{speed(r.distanceKm,r.durationSeconds)}</strong></td><td>{pace(r.paceSecondsPerKm)} /км</td><td><span className={now-new Date(r.updatedAt).getTime()<15000?'fresh':'muted'}>{ago(r.updatedAt,now)}</span></td><td><span className={`status ${r.status}`}>{r.status==='running'?'Гүйж байна':'Түр зогссон'}</span></td></tr>)}</tbody></table>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}

const styles=`
	  *{box-sizing:border-box}body{margin:0}.ca-root,.ca-auth{--lime:#a8ff18;--ink:#171b18;--muted:#727a73;--line:#e1e6e0;--bg:#f3f6f2;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0;color:var(--ink)}button,input,textarea,select{font:inherit;letter-spacing:0}.ca-auth{min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#101510,#eef2ea);padding:20px}.ca-login{width:min(420px,100%);background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.6);border-radius:14px;padding:32px;display:grid;gap:15px;box-shadow:0 25px 70px rgba(20,28,21,.22);backdrop-filter:blur(18px)}.ca-logo{display:flex;align-items:center;gap:8px}.ca-logo b{font-size:18px}.ca-logo b:first-letter{color:var(--lime)}.ca-logo span{font-size:8px;font-weight:900;background:var(--lime);padding:4px 6px}.ca-login h1{margin:22px 0 0;font-size:25px}.ca-login p{margin:-8px 0 6px;color:var(--muted);font-size:13px;line-height:1.55}.ca-login label,.dialog label{display:grid;gap:6px;font-size:10px;font-weight:800;color:#5d655e}.ca-login input,.dialog input,.dialog textarea{border:1px solid #d6ddd5;border-radius:7px;padding:12px;outline:0;background:#fff}.ca-login input:focus{border-color:#88c918;box-shadow:0 0 0 3px #edf7df}.ca-login button,.primary{height:44px;border:0;border-radius:7px;background:var(--lime);font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 15px}.ca-error{padding:10px;background:#fff0ed;color:#b5372c;font-size:12px;border-radius:5px}.ca-loader{color:var(--muted)}.ca-root{min-height:100vh;background:var(--bg)}.ca-root>aside{position:fixed;inset:0 auto 0 0;width:250px;background:#121613;color:#fff;padding:25px 16px;display:flex;flex-direction:column}.ca-club{display:flex;gap:10px;align-items:center;margin:30px 4px 18px;padding:12px;background:#1d231e;border-radius:6px}.ca-club img{width:38px;height:38px;object-fit:cover;border-radius:5px}.ca-club div{display:flex;flex-direction:column;min-width:0}.ca-club strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ca-club small{font-size:9px;color:#899189;margin-top:3px}.ca-root nav{display:grid;gap:4px}.ca-root nav button,.ca-logout{height:44px;border:0;border-radius:5px;background:transparent;color:#9ca49d;display:flex;align-items:center;gap:11px;padding:0 12px;text-align:left}.ca-root nav button span{flex:1}.ca-root nav button i{font-style:normal;font-size:9px;background:#a8ff18;color:#172000;padding:3px 6px;border-radius:9px}.ca-root nav button.active{background:#273026;color:#fff;box-shadow:inset 3px 0 var(--lime)}.ca-root nav button.active svg{color:var(--lime)}.ca-logout{margin-top:auto;border-top:1px solid #2b312c;border-radius:0}.ca-root>main{margin-left:250px;min-height:100vh}.ca-root header{height:68px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 30px;position:sticky;top:0;z-index:5}.ca-root header div{display:flex;flex-direction:column}.ca-root header strong{font-size:13px}.ca-root header small{font-size:9px;color:var(--muted);margin-top:3px}.ca-root header button{width:37px;height:37px;border:1px solid var(--line);background:#fff;border-radius:5px}.ca-content{padding:29px;max-width:1450px;margin:auto}.ca-title{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:22px}.ca-title h1{margin:0;font-size:25px}.ca-title p{margin:6px 0 0;color:var(--muted);font-size:12px}.live-pill{font-size:10px;color:#28783a;background:#e9f8e9;padding:7px 10px;border-radius:13px}.live-pill i,.live-name i{display:inline-block;width:7px;height:7px;background:#34b74e;border-radius:50%;margin-right:6px;box-shadow:0 0 0 4px rgba(52,183,78,.13)}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:17px}.stat{background:#fff;border:1px solid var(--line);border-radius:7px;padding:17px;display:flex;align-items:center;gap:12px}.stat>span{width:39px;height:39px;border-radius:6px;background:#eff8e7;color:#689f18;display:grid;place-items:center}.stat>span svg{width:18px}.stat>div{display:flex;flex-direction:column}.stat small{color:var(--muted);font-size:9px}.stat strong{font-size:19px;margin-top:4px}.panel{background:#fff;border:1px solid var(--line);border-radius:7px}.split{display:grid;grid-template-columns:1.6fr 1fr;gap:16px}.panel-head{height:56px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 17px}.panel-head h2{font-size:13px}.panel-head span{font-size:9px;color:var(--muted)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:680px}th{text-align:left;background:#fafbfa;color:#8a928b;font-size:9px;padding:11px 15px}td{border-top:1px solid #edf0ed;padding:13px 15px;font-size:11px;color:#5b625c}td strong{color:var(--ink)}.green{color:#39933f}.person{display:flex;align-items:center;gap:9px}.person img,.person i{width:30px;height:30px;border-radius:50%;object-fit:cover;background:#243127;color:#fff;display:grid;place-items:center;font-style:normal}.status{padding:5px 8px;border-radius:11px;font-size:9px;background:#e8f8ea;color:#278139}.status.paused{background:#fff3dc;color:#a9700d}.event-mini{padding:5px 16px}.event-mini>div{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)}.event-mini time{font-size:9px;color:#568513;width:78px}.event-mini span{display:flex;flex:1;flex-direction:column}.event-mini strong{font-size:10px}.event-mini small{font-size:9px;color:var(--muted);margin-top:3px}.event-mini b{font-size:11px}.edit-grid{padding:18px;display:grid;grid-template-columns:minmax(260px,.8fr) 1.2fr;gap:19px}.cover{height:330px;background:#202520;border-radius:6px;overflow:hidden;position:relative}.cover img{width:100%;height:100%;object-fit:cover}.cover label{position:absolute;right:12px;bottom:12px;height:36px;border-radius:6px;background:var(--lime);display:flex;align-items:center;gap:7px;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}.cover input,.club-gallery-admin input{display:none}.club-gallery-admin{margin-top:14px}.club-gallery-admin>div:first-child{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.club-gallery-admin strong{font-size:13px}.club-gallery-admin label{height:34px;border-radius:6px;background:#202520;color:#fff;display:flex;align-items:center;gap:7px;padding:0 10px;font-size:10px;font-weight:800;cursor:pointer}.club-gallery-admin figure{width:31%;height:88px;margin:0 2% 10px 0;display:inline-block;position:relative;border-radius:7px;overflow:hidden;background:#edf0ed}.club-gallery-admin figure img{width:100%;height:100%;object-fit:cover}.club-gallery-admin figure button{position:absolute;right:6px;top:6px;width:28px;height:28px;border:0;border-radius:5px;background:rgba(0,0,0,.68);color:#fff;display:grid;place-items:center}.fields{display:grid;grid-template-columns:1fr 1fr;gap:13px}.fields label{font-size:9px;font-weight:800;color:#626a63;display:flex;flex-direction:column;gap:6px}.fields .wide{grid-column:1/3}.fields input,.fields textarea,.ca-title select{border:1px solid #d9ded8;border-radius:5px;padding:10px;background:#fff;outline:0}.fields textarea{height:130px;resize:vertical}.event-layout{display:grid;grid-template-columns:320px 1fr;gap:15px}.event-list{overflow:hidden}.event-list>button{width:100%;border:0;border-bottom:1px solid var(--line);background:#fff;padding:13px;display:flex;align-items:center;gap:10px;text-align:left}.event-list>button.active{background:#f1f8ea}.event-list time{width:70px;font-size:9px;color:#5c8d17}.event-list button span{display:flex;flex:1;flex-direction:column}.event-list button strong{font-size:10px}.event-list button small{font-size:9px;color:var(--muted);margin-top:3px}.event-list button b{font-size:10px}.table-wrap select,.ca-title select{height:34px;border:1px solid #d9ded8;border-radius:5px;background:#fff;font-size:10px}.live-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:15px}.live-summary>div{background:#172019;color:#fff;border-radius:7px;padding:18px;display:flex;flex-direction:column}.live-summary strong{font-size:22px}.live-summary span{font-size:9px;color:#a7b0a8;margin-top:5px}.live-summary i{width:8px;height:8px;background:#42e765;border-radius:50%;margin-bottom:8px;box-shadow:0 0 0 5px rgba(66,231,101,.13)}.empty{padding:45px;text-align:center;color:var(--muted);font-size:11px}.dialog-back{position:fixed;inset:0;background:rgba(9,12,9,.64);display:grid;place-items:center;padding:20px;z-index:20}.dialog{width:min(600px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:8px;padding:22px;display:grid;gap:13px}.dialog h2{margin:0 0 4px}.dialog textarea{height:75px;resize:vertical}.dialog .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dialog>div:last-child{display:flex;justify-content:flex-end;gap:9px}.secondary{height:42px;border:1px solid var(--line);background:#fff;border-radius:5px;padding:0 15px}.ca-toast{position:fixed;right:22px;bottom:22px;background:#172019;color:#fff;padding:12px 15px;border-radius:6px;display:flex;gap:8px;align-items:center;font-size:11px}.ca-toast svg{color:var(--lime)}
.event-detail-head{display:flex;align-items:center;border-bottom:1px solid var(--line)}.event-detail-head .panel-head{flex:1;border-bottom:0}.event-manage-actions{display:flex;gap:8px;padding-right:12px}.event-manage-actions button{height:34px;border:1px solid #d9ded8;border-radius:6px;background:#fff;color:#303730;display:inline-flex;align-items:center;gap:6px;padding:0 10px;font-size:10px;font-weight:900}.event-manage-actions button:last-child{color:#b5372c}.event-manage-actions button:disabled{opacity:.55}.event-live-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:14px;border-bottom:1px solid var(--line);background:#fbfcfb}.event-live-summary>div{min-height:62px;border:1px solid #e3e9e2;border-radius:7px;background:#fff;padding:12px;display:flex;flex-direction:column;justify-content:center}.event-live-summary span{font-size:9px;color:var(--muted);font-weight:800}.event-live-summary strong{font-size:18px;color:#172019;margin-top:5px}.event-participants-table{min-width:1040px}.fresh{color:#2e963f;font-weight:900}.status.idle{background:#eef1ee;color:#697169}
.social-admin-panel{grid-column:1/3;display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:8px;background:#f7f9f6}.social-admin-panel>strong{font-size:13px;color:#202520}.social-admin-panel>small{font-size:10px;color:var(--muted);line-height:1.45;margin-top:-5px}.social-admin-panel label{display:grid;gap:6px;font-size:9px;font-weight:800;color:#626a63}.social-admin-panel input{height:40px;border:1px solid #d9ded8;border-radius:5px;padding:10px;background:#fff;outline:0}
.event-image-picker{height:190px;border-radius:8px;overflow:hidden;background:#202520;position:relative;border:1px solid #d6ddd5}.event-image-picker img{width:100%;height:100%;object-fit:cover;display:block}.event-image-picker label{position:absolute;right:12px;bottom:12px;height:38px;border-radius:7px;background:var(--lime);color:#11170f;display:flex;align-items:center;gap:7px;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}.event-image-picker input{display:none}
.selected-row{background:#f2fae9}.selected-row td{border-top-color:#d8eac8}.last-run{color:#4f5b51;font-size:10px}.muted{color:#8d968f}.member-detail-grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:15px;margin-top:15px}.week-chart{height:176px;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding:16px}.week-day{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0}.week-day span{height:17px;color:#526051;font-size:9px;font-weight:900}.week-day i{width:18px;border-radius:9px 9px 4px 4px;background:linear-gradient(180deg,var(--lime),#5da51b);box-shadow:0 8px 18px rgba(93,165,27,.18)}.week-day small{font-size:9px;color:var(--muted);margin-top:7px;white-space:nowrap}.member-recent table{min-width:760px}.route-area{display:block;color:var(--muted);font-size:9px;margin-top:4px}tbody tr{cursor:pointer}
@media(max-width:1000px){.stat-grid{grid-template-columns:1fr 1fr}.split,.event-layout,.edit-grid,.member-detail-grid{grid-template-columns:1fr}.event-live-summary{grid-template-columns:1fr 1fr}}@media(max-width:720px){.ca-root>aside{position:static;width:100%;height:auto}.ca-root nav{grid-template-columns:repeat(5,1fr);overflow:auto}.ca-root nav button{min-width:130px}.ca-logout{display:none}.ca-root>main{margin:0}.ca-content{padding:18px}.stat-grid,.live-summary,.event-live-summary{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.fields .wide,.social-admin-panel{grid-column:auto}.ca-title{align-items:flex-start;flex-direction:column}}
`;
