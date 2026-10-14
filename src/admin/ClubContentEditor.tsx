import React, { useEffect, useState } from 'react';
import { Building2, Image as ImageIcon, Save, Trash2, Upload, UserPlus } from 'lucide-react/dist/cjs/lucide-react.js';
import { fetchRunningClubs, saveRunningClubs } from '../lib/runboostApi';
import {
  assignClubAdmin, deleteLocalClubAdminCredential, generateClubAdminPassword,
  getLocalClubAdminCredentials, saveLocalClubAdminCredential, type LocalClubAdminCredential
} from '../lib/clubAdminApi';
import { DEFAULT_RUNNING_CLUBS, type RunningClub } from '../native/clubs';

type Props = { notify: (message: string) => void };

function readImage(file: File, onLoad: (uri: string) => void, onError: () => void) {
  if (!file.type.startsWith('image/')) {
    onError();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result));
  reader.onerror = onError;
  reader.readAsDataURL(file);
}

export function ClubContentEditor({ notify }: Props) {
  const [clubs, setClubs] = useState<RunningClub[]>(DEFAULT_RUNNING_CLUBS);
  const [selectedId, setSelectedId] = useState(DEFAULT_RUNNING_CLUBS[0].id);
  const [saving, setSaving] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchRunningClubs().then(items => {
      if (!items.length) return;
      setClubs(items);
      setSelectedId(items[0].id);
    }).catch(() => undefined);
  }, []);

  const selected = clubs.find(club => club.id === selectedId) ?? clubs[0];
  const update = (patch: Partial<RunningClub>) => {
    setClubs(current => current.map(club => club.id === selected.id ? { ...club, ...patch } : club));
  };

  const selectCover = (file?: File) => {
    if (!file) return;
    readImage(file, image => update({ image }), () => notify('Зөвхөн зураг сонгоно уу'));
  };

  const addGalleryImages = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).forEach(file => readImage(
      file,
      image => setClubs(current => current.map(club => club.id === selected.id ? { ...club, galleryImages: [...club.galleryImages, image] } : club)),
      () => notify(`${file.name} зураг биш байна`)
    ));
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalized = await saveRunningClubs(clubs);
      setClubs(normalized);
      notify('Клубын мэдээлэл, зургууд хадгалагдлаа');
    } catch (error) {
      notify(error instanceof Error ? `Хадгалж чадсангүй: ${error.message}` : 'Клубын контентыг хадгалж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  if (!selected) return null;

  return <div className="club-editor">
    <style>{clubEditorStyles}</style>
    <div className="club-page-head">
      <div><h1>Клубын контент</h1><p>Аппын онцлох клубуудын мэдээлэл болон зургийн цомгийг удирдана.</p></div>
      <button className="primary-button" disabled={saving} onClick={save}><Save size={16}/>{saving ? 'Хадгалж байна...' : 'Өөрчлөлт хадгалах'}</button>
    </div>

    <div className="club-editor-layout">
      <aside className="club-list panel">
        <div className="club-list-title"><Building2 size={18}/><span><strong>Онцлох клубууд</strong><small>{clubs.length} клуб</small></span></div>
        {clubs.map(club => <button key={club.id} className={club.id === selected.id ? 'active' : ''} onClick={() => setSelectedId(club.id)}>
          <img src={club.image} alt=""/><span><strong>{club.name}</strong><small>{club.city}</small></span>
        </button>)}
      </aside>

      <section className="club-form panel">
        <div className="club-form-head"><div><ImageIcon size={18}/><span><strong>{selected.name}</strong><small>Апп дээр харагдах дэлгэрэнгүй мэдээлэл</small></span></div></div>
        <div className="club-form-body">
          <div className="club-cover-field">
            <img src={selected.image} alt={`${selected.name} нүүр зураг`}/>
            <label><Upload size={15}/>Нүүр зураг солих<input type="file" accept="image/*" onChange={event => selectCover(event.target.files?.[0])}/></label>
          </div>

          <div className="club-copy-grid">
            <label>КЛУБЫН НЭР<input value={selected.name} onChange={event => update({ name: event.target.value })}/></label>
            <label>ХОТ<input value={selected.city} onChange={event => update({ city: event.target.value })}/></label>
            <label>ГИШҮҮДИЙН ТОО<input type="number" min="0" value={selected.memberCount} onChange={event => update({ memberCount: Number(event.target.value) })}/></label>
            <label>7 ХОНОГИЙН НИЙТ КМ<input type="number" min="0" value={selected.weeklyKm} onChange={event => update({ weeklyKm: Number(event.target.value) })}/></label>
            <label>ГИШҮҮДИЙН НИЙТ ГҮЙСЭН КМ<input type="number" min="0" value={selected.totalKm} onChange={event => update({ totalKm: Number(event.target.value) })}/></label>
            <label className="wide">КЛУБЫН ТАЙЛБАР<textarea value={selected.description} onChange={event => update({ description: event.target.value })}/></label>
          </div>

          <div className="club-admin-access">
            <div><strong>Клубын админ эрх</strong><small>Supabase-д бүртгэлтэй хэрэглэгчийн имэйлээр энэ клубыг удирдах эрх олгоно.</small></div>
            <input type="email" value={adminEmail} onChange={event => setAdminEmail(event.target.value)} placeholder="club.admin@example.com" />
            <button disabled={assigning || !adminEmail.trim()} onClick={async () => {
              setAssigning(true);
              try {
                await assignClubAdmin(selected.id, adminEmail.trim());
                notify(`${adminEmail.trim()} хэрэглэгчид клубын админ эрх олголоо`);
                setAdminEmail('');
              } catch (error) {
                notify(error instanceof Error ? error.message : 'Эрх олгож чадсангүй');
              } finally { setAssigning(false); }
            }}><UserPlus size={15}/>{assigning ? 'Олгож байна...' : 'Эрх олгох'}</button>
          </div>

          <div className="gallery-editor-head"><div><strong>Клубын зургийн цомог</strong><small>Апп дээр хажуу тийш гүйлгэж харагдана.</small></div><label><Upload size={15}/>Зураг нэмэх<input multiple type="file" accept="image/*" onChange={event => addGalleryImages(event.target.files)}/></label></div>
          <div className="gallery-editor-grid">
            {selected.galleryImages.map((image, index) => <div key={`${image}-${index}`}><img src={image} alt={`Клубын зураг ${index + 1}`}/><span>{index + 1}</span><button aria-label="Зураг устгах" onClick={() => update({ galleryImages: selected.galleryImages.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15}/></button></div>)}
            {!selected.galleryImages.length && <p>Цомогт зураг алга байна.</p>}
          </div>
        </div>
      </section>
    </div>
  </div>;
}

export function ClubAdminAccessManager({ notify }: Props) {
  const [clubs, setClubs] = useState<RunningClub[]>(DEFAULT_RUNNING_CLUBS);
  const [selectedId, setSelectedId] = useState(DEFAULT_RUNNING_CLUBS[0].id);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(() => generateClubAdminPassword());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<LocalClubAdminCredential[]>([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchRunningClubs().then(items => {
      if (!items.length) return;
      setClubs(items);
      setSelectedId(items[0].id);
    }).catch(() => undefined);
    setCredentials(getLocalClubAdminCredentials());
  }, []);

  const selected = clubs.find(club => club.id === selectedId) ?? clubs[0];
  const resetForm = () => {
    setPhone('');
    setPassword(generateClubAdminPassword());
    setEditingId(null);
  };
  const refreshCredentials = () => setCredentials(getLocalClubAdminCredentials());

  if (!selected) return null;

  return <div className="club-editor">
    <style>{clubEditorStyles}</style>
    <div className="club-page-head">
      <div><h1>Клубын эрх</h1><p>Клуб тус бүрт админ хэрэглэгч оноож, тухайн клубын portal ашиглах эрх үүсгэнэ.</p></div>
    </div>
    <section className="panel club-access-page">
      <div className="club-access-hero">
        <img src={selected.image} alt=""/>
        <div>
          <strong>{selected.name}</strong>
          <small>{selected.city} · {selected.memberCount.toLocaleString()} гишүүн</small>
        </div>
      </div>
      <div className="club-access-grid">
        <label>КЛУБ СОНГОХ
          <select value={selected.id} onChange={event => setSelectedId(event.target.value)}>
            {clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        </label>
        <label>УТАСНЫ ДУГААР
          <input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="99112233" />
        </label>
        <label>НУУЦ ҮГ
          <div className="password-field"><input value={password} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setPassword(generateClubAdminPassword())}>Үүсгэх</button></div>
        </label>
        <button disabled={assigning || !phone.trim() || !password.trim()} onClick={() => {
          setAssigning(true);
          try {
            const saved = saveLocalClubAdminCredential({ id: editingId ?? undefined, clubId: selected.id, clubName: selected.name, phone, password });
            refreshCredentials();
            notify(`${saved.phone} дугаарт ${selected.name} клубын админ эрх ${editingId ? 'засагдлаа' : 'үүсгэлээ'}`);
            resetForm();
          } catch (error) {
            notify(error instanceof Error ? error.message : 'Эрх олгож чадсангүй');
          } finally { setAssigning(false); }
        }}><UserPlus size={16}/>{assigning ? 'Хадгалж байна...' : editingId ? 'Эрх засах' : 'Клубын эрх үүсгэх'}</button>
      </div>
      {editingId ? <button className="club-access-cancel" onClick={resetForm}>Засахаа болих</button> : null}
      <p className="club-access-note">Эрх авсан хэрэглэгч web дээр <b>/club-admin</b> хаягаар утасны дугаар, нууц үгээрээ нэвтэрнэ.</p>
      <div className="club-credential-list">
        <strong>Үүсгэсэн эрхүүд</strong>
        {credentials.map(item => <div key={item.id} className="club-credential-row">
          <span><b>{item.clubName}</b><small>{item.phone} · password: {item.password}</small></span>
          <button onClick={() => { setSelectedId(item.clubId); setPhone(item.phone); setPassword(item.password); setEditingId(item.id); }}>Засах</button>
          <button onClick={() => { deleteLocalClubAdminCredential(item.id); refreshCredentials(); notify('Клубын эрх устлаа'); }}>Устгах</button>
        </div>)}
        {!credentials.length ? <p>Одоогоор үүсгэсэн эрх алга.</p> : null}
      </div>
    </section>
  </div>;
}

const clubEditorStyles = `
	.club-admin-access{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1fr) auto;align-items:end;gap:12px;margin-top:20px;padding:16px;border:1px solid var(--line);border-radius:7px;background:#f7f9f6}.club-admin-access>div{display:flex;flex-direction:column}.club-admin-access strong{font-size:12px}.club-admin-access small{font-size:9px;color:var(--muted);margin-top:4px;line-height:1.45}.club-admin-access input{height:38px;border:1px solid #daddd9;border-radius:5px;padding:0 10px;outline:0}.club-admin-access button{height:38px;border:0;border-radius:5px;background:#202520;color:#fff;padding:0 12px;display:flex;align-items:center;gap:7px;font-size:10px;font-weight:800}.club-admin-access button:disabled{opacity:.5}
	.club-access-page{padding:20px}.club-access-hero{height:96px;border-radius:8px;background:#111412;color:#fff;display:flex;align-items:center;gap:14px;padding:14px;margin-bottom:18px}.club-access-hero img{width:68px;height:68px;border-radius:7px;object-fit:cover}.club-access-hero div{display:flex;flex-direction:column}.club-access-hero strong{font-size:18px}.club-access-hero small{font-size:11px;color:#b9c0ba;margin-top:5px}.club-access-grid{display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) minmax(260px,1.1fr) auto;gap:14px;align-items:end}.club-access-grid label{font-size:10px;font-weight:800;color:#606760;display:flex;flex-direction:column;gap:7px}.club-access-grid select,.club-access-grid input{height:42px;border:1px solid #daddd9;border-radius:6px;background:#fff;padding:0 11px;outline:0;color:#202520}.club-access-grid select:focus,.club-access-grid input:focus{border-color:#81bb2e;box-shadow:0 0 0 3px #edf7df}.club-access-grid>button,.password-field button{height:42px;border:0;border-radius:6px;background:#202520;color:#fff;padding:0 14px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:11px;font-weight:900;cursor:pointer}.club-access-grid button:disabled{opacity:.5;cursor:not-allowed}.password-field{display:grid;grid-template-columns:1fr auto;gap:8px}.club-access-cancel{margin-top:12px;border:1px solid #d8ddd6;background:#fff;border-radius:6px;height:36px;padding:0 12px}.club-access-note{margin:16px 0 0;color:var(--muted);font-size:12px;line-height:1.55}.club-access-note b{color:#202520}.club-credential-list{border-top:1px solid var(--line);margin-top:18px;padding-top:16px;display:grid;gap:9px}.club-credential-list>strong{font-size:13px}.club-credential-list>p{font-size:11px;color:var(--muted);margin:0}.club-credential-row{min-height:54px;border:1px solid var(--line);border-radius:7px;padding:9px;display:flex;align-items:center;gap:8px}.club-credential-row span{display:flex;flex:1;min-width:0;flex-direction:column}.club-credential-row b{font-size:12px}.club-credential-row small{font-size:10px;color:var(--muted);margin-top:3px}.club-credential-row button{height:32px;border:1px solid #d8ddd6;background:#fff;border-radius:5px;padding:0 9px;font-size:10px;font-weight:800}
	.club-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}.club-page-head h1{font-size:26px;line-height:1.15;margin:0}.club-page-head p{font-size:13px;color:var(--muted);margin:7px 0 0}.club-editor-layout{display:grid;grid-template-columns:250px minmax(460px,1fr);gap:16px;align-items:start}.club-list{overflow:hidden;padding:8px}.club-list-title{height:58px;display:flex;align-items:center;gap:10px;padding:0 9px;border-bottom:1px solid var(--line);margin-bottom:7px}.club-list-title>span,.club-list button>span,.club-form-head span{display:flex;flex:1;min-width:0;flex-direction:column}.club-list-title strong,.club-list button strong,.club-form-head strong{font-size:12px}.club-list-title small,.club-list button small,.club-form-head small{font-size:9px;color:var(--muted);margin-top:3px}.club-list button{width:100%;border:0;border-radius:6px;background:transparent;padding:8px;display:flex;align-items:center;gap:9px;text-align:left;cursor:pointer;color:#414741}.club-list button.active{background:#edf5e7;color:#375b08}.club-list button img{width:42px;height:42px;border-radius:5px;object-fit:cover}.club-list button strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.club-form{overflow:hidden}.club-form-head{height:66px;padding:0 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:9px}.club-form-head>div{display:flex;align-items:center;gap:9px}.club-form-body{padding:19px}.club-cover-field{height:250px;border-radius:7px;overflow:hidden;background:#161a17;position:relative}.club-cover-field>img{width:100%;height:100%;object-fit:cover}.club-cover-field>label{position:absolute;right:12px;bottom:12px;height:35px;border-radius:5px;padding:0 11px;background:var(--lime);display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;cursor:pointer}.club-cover-field input,.gallery-editor-head input{display:none}.club-copy-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:19px}.club-copy-grid label{font-size:9px;font-weight:750;color:#686f69;letter-spacing:.5px;display:flex;flex-direction:column;gap:7px}.club-copy-grid label.wide{grid-column:1/3}.club-copy-grid input,.club-copy-grid textarea{border:1px solid #daddd9;border-radius:5px;background:#fff;padding:10px;font-size:12px;color:#222;outline:0}.club-copy-grid input{height:40px}.club-copy-grid textarea{height:92px;resize:vertical}.club-copy-grid input:focus,.club-copy-grid textarea:focus{border-color:#81bb2e;box-shadow:0 0 0 3px #edf7df}.gallery-editor-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;border-top:1px solid var(--line);margin-top:21px;padding-top:18px}.gallery-editor-head>div{display:flex;flex-direction:column}.gallery-editor-head strong{font-size:13px}.gallery-editor-head small{font-size:9px;color:var(--muted);margin-top:4px}.gallery-editor-head label{height:35px;border-radius:5px;padding:0 11px;background:#202520;color:#fff;display:flex;align-items:center;gap:7px;font-size:10px;font-weight:800;cursor:pointer}.gallery-editor-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.gallery-editor-grid>div{aspect-ratio:4/3;border-radius:6px;overflow:hidden;position:relative;background:#edf0ed}.gallery-editor-grid img{width:100%;height:100%;object-fit:cover}.gallery-editor-grid span{position:absolute;left:7px;top:7px;width:22px;height:22px;border-radius:11px;background:rgba(0,0,0,.7);color:#fff;display:grid;place-items:center;font-size:9px}.gallery-editor-grid button{position:absolute;right:7px;top:7px;width:29px;height:29px;border:0;border-radius:5px;background:rgba(0,0,0,.72);color:#fff;display:grid;place-items:center;cursor:pointer}.gallery-editor-grid p{grid-column:1/4;background:#f6f8f5;border:1px dashed #ccd2cb;border-radius:6px;padding:34px;text-align:center;color:var(--muted);font-size:11px}
	@media(max-width:900px){.club-editor-layout{grid-template-columns:1fr}.club-list{display:flex;overflow-x:auto}.club-list-title{min-width:170px;border:0;margin:0}.club-list button{min-width:190px}.club-page-head{align-items:flex-start}.club-access-grid{grid-template-columns:1fr}}@media(max-width:580px){.club-page-head{flex-direction:column}.club-page-head .primary-button{width:100%}.club-copy-grid{grid-template-columns:1fr}.club-copy-grid label.wide{grid-column:auto}.gallery-editor-grid{grid-template-columns:repeat(2,1fr)}}
	`;
