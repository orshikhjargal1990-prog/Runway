import React, { useEffect, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, Image as ImageIcon, MonitorPlay, Plus, Save,
  Trash2, Upload, Video
} from 'lucide-react/dist/cjs/lucide-react.js';
import {
  DEFAULT_LOGIN_SLIDES,
  loadLoginSlides,
  saveLoginSlides,
  type LoginSlide
} from '../content/loginSlides';

type Props = {
  notify: (message: string) => void;
};

export function LoginContentEditor({ notify }: Props) {
  const [slides, setSlides] = useState<LoginSlide[]>(DEFAULT_LOGIN_SLIDES);
  const [selectedId, setSelectedId] = useState(DEFAULT_LOGIN_SLIDES[0].id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLoginSlides().then(items => {
      setSlides(items);
      setSelectedId(items[0]?.id ?? DEFAULT_LOGIN_SLIDES[0].id);
    });
  }, []);

  const selectedIndex = Math.max(0, slides.findIndex(slide => slide.id === selectedId));
  const selected = slides[selectedIndex];

  const updateSelected = (patch: Partial<LoginSlide>) => {
    setSlides(current => current.map(slide => slide.id === selectedId ? { ...slide, ...patch } : slide));
  };

  const addSlide = () => {
    const slide: LoginSlide = {
      id: `slide-${Date.now()}`,
      eyebrow: 'ОНЦЛОХ МЭДЭЭ',
      titleBefore: 'Шинэ ',
      accent: 'слайдын',
      titleAfter: '\nгарчиг',
      subtitle: 'Слайдын тайлбар текстийг энд оруулна уу.',
      mediaType: 'image',
      mediaUri: DEFAULT_LOGIN_SLIDES[0].mediaUri,
      mediaName: 'default-running.jpg',
      enabled: true
    };
    setSlides(current => [...current, slide]);
    setSelectedId(slide.id);
  };

  const removeSlide = () => {
    if (slides.length === 1) {
      notify('Дор хаяж нэг слайд байх шаардлагатай');
      return;
    }
    const next = slides.filter(slide => slide.id !== selectedId);
    setSlides(next);
    setSelectedId(next[Math.max(0, selectedIndex - 1)].id);
  };

  const moveSlide = (direction: -1 | 1) => {
    const target = selectedIndex + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    setSlides(next);
  };

  const selectMedia = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      notify('Зураг эсвэл видео файл сонгоно уу');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateSelected({
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
      mediaUri: String(reader.result),
      mediaName: file.name
    });
    reader.onerror = () => notify('Файлыг уншиж чадсангүй');
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveLoginSlides(slides);
      notify('Нэвтрэх дэлгэцийн контент хадгалагдлаа');
    } catch (error) {
      notify(error instanceof Error ? `Хадгалж чадсангүй: ${error.message}` : 'Контентыг хадгалж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  if (!selected) return null;

  return <div className="content-editor">
    <style>{editorStyles}</style>
    <div className="content-page-head">
      <div><h1>Нэвтрэх контент</h1><p>Нэвтрэх дэлгэцийн слайд, текст, зураг болон видеог удирдана.</p></div>
      <button className="primary-button" disabled={saving} onClick={save}><Save size={16}/>{saving ? 'Хадгалж байна...' : 'Өөрчлөлт хадгалах'}</button>
    </div>

    <div className="content-layout">
      <aside className="slide-list panel">
        <div className="slide-list-head"><div><strong>Слайдууд</strong><span>{slides.length} контент</span></div><button aria-label="Слайд нэмэх" onClick={addSlide}><Plus size={18}/></button></div>
        <div className="slide-items">{slides.map((slide, index) => <button key={slide.id} className={slide.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(slide.id)}><span className="slide-thumb">{slide.mediaType === 'video' ? <Video size={17}/> : <ImageIcon size={17}/>}</span><span><strong>{slide.accent || `Слайд ${index + 1}`}</strong><small>{slide.mediaName}</small></span>{slide.enabled && <Check size={14}/>}</button>)}</div>
        <button className="add-slide-button" onClick={addSlide}><Plus size={16}/>Слайд нэмэх</button>
      </aside>

      <section className="editor-panel panel">
        <div className="editor-panel-head"><div><MonitorPlay size={19}/><span><strong>Слайд {selectedIndex + 1}</strong><small>Контент ба харагдах байдал</small></span></div><div><button title="Дээш зөөх" disabled={selectedIndex === 0} onClick={() => moveSlide(-1)}><ArrowUp size={17}/></button><button title="Доош зөөх" disabled={selectedIndex === slides.length - 1} onClick={() => moveSlide(1)}><ArrowDown size={17}/></button><button className="danger" title="Устгах" onClick={removeSlide}><Trash2 size={17}/></button></div></div>
        <div className="editor-body">
          <div className="media-field">
            <span className="field-label">АРЫН ЗУРАГ / ВИДЕО</span>
            <div className="media-preview">
              {selected.mediaType === 'video' ? <video key={selected.mediaUri} src={selected.mediaUri} autoPlay loop muted playsInline/> : <img src={selected.mediaUri} alt="Слайдын арын зураг"/>}
              <div><span>{selected.mediaType === 'video' ? <Video size={15}/> : <ImageIcon size={15}/>} {selected.mediaName}</span><label><Upload size={15}/>Файл солих<input type="file" accept="image/*,video/*" onChange={event => selectMedia(event.target.files?.[0])}/></label></div>
            </div>
            <small className="field-help">JPG, PNG, WEBP, GIF, MP4, WEBM, MOV формат дэмжинэ.</small>
          </div>

          <div className="copy-grid">
            <label>ДЭЭД АНГИЛАЛ<input value={selected.eyebrow} onChange={e => updateSelected({ eyebrow: e.target.value })}/></label>
            <label>ЭХНИЙ ТЕКСТ<input value={selected.titleBefore} onChange={e => updateSelected({ titleBefore: e.target.value })}/></label>
            <label>ОНЦЛОХ НОГООН ТЕКСТ<input value={selected.accent} onChange={e => updateSelected({ accent: e.target.value })}/></label>
            <label>ҮРГЭЛЖЛЭХ ТЕКСТ<textarea value={selected.titleAfter} onChange={e => updateSelected({ titleAfter: e.target.value })}/><small>Шинэ мөр гаргахдаа Enter дарна.</small></label>
            <label className="wide">ТАЙЛБАР ТЕКСТ<textarea value={selected.subtitle} onChange={e => updateSelected({ subtitle: e.target.value })}/></label>
          </div>

          <label className="enabled-toggle"><input type="checkbox" checked={selected.enabled} onChange={e => updateSelected({ enabled: e.target.checked })}/><span/><div><strong>Слайдыг нийтлэх</strong><small>Унтраавал нэвтрэх дэлгэц дээр харагдахгүй.</small></div></label>
        </div>
      </section>

      <aside className="phone-preview-panel">
        <div className="preview-label"><strong>Урьдчилан харах</strong><span>Гар утас</span></div>
        <div className="phone-frame">
          {selected.mediaType === 'video' ? <video key={selected.mediaUri} src={selected.mediaUri} autoPlay loop muted playsInline/> : <img src={selected.mediaUri} alt="Урьдчилан харах"/>}
          <div className="phone-shade"/><div className="phone-brand"><b>↗</b> RUNBOOST</div><div className="phone-copy"><span>{selected.eyebrow}</span><h2>{selected.titleBefore}<em>{selected.accent}</em>{selected.titleAfter}</h2><p>{selected.subtitle}</p><div className="phone-auth"><button>Нэвтрэх</button><button>Эхлэх</button></div></div>
        </div>
      </aside>
    </div>
  </div>;
}

const editorStyles = `
.content-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}.content-page-head h1{font-size:26px;line-height:1.15;margin:0}.content-page-head p{font-size:13px;color:var(--muted);margin:7px 0 0}.content-layout{display:grid;grid-template-columns:210px minmax(420px,1fr) 260px;gap:16px;align-items:start}.slide-list{overflow:hidden}.slide-list-head{height:66px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.slide-list-head>div{display:flex;flex-direction:column}.slide-list-head strong{font-size:13px}.slide-list-head span{font-size:10px;color:var(--muted);margin-top:3px}.slide-list-head button,.editor-panel-head button{width:32px;height:32px;border:1px solid var(--line);background:#fff;border-radius:5px;display:grid;place-items:center;cursor:pointer}.slide-items{padding:8px}.slide-items>button{width:100%;border:0;background:transparent;border-radius:5px;padding:9px 8px;display:flex;align-items:center;gap:9px;text-align:left;cursor:pointer;color:#555c56}.slide-items>button.active{background:#edf5e7;color:#375b08}.slide-items>button>span:nth-child(2){display:flex;flex:1;min-width:0;flex-direction:column}.slide-items strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.slide-items small{font-size:9px;color:#899089;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.slide-thumb{width:32px;height:32px;border-radius:5px;background:#e5e9e2;display:grid;place-items:center;flex:none}.slide-items>button.active .slide-thumb{background:#d9edc9}.add-slide-button{height:40px;margin:4px 8px 10px;width:calc(100% - 16px);border:1px dashed #cbd0ca;background:#fafbfa;border-radius:5px;color:#5e655f;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.editor-panel{overflow:hidden}.editor-panel-head{height:66px;padding:0 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.editor-panel-head>div{display:flex;align-items:center;gap:9px}.editor-panel-head span{display:flex;flex-direction:column}.editor-panel-head strong{font-size:13px}.editor-panel-head small{font-size:9px;color:var(--muted);margin-top:3px}.editor-panel-head button:disabled{opacity:.35}.editor-panel-head button.danger{color:#d04f42}.editor-body{padding:19px}.field-label,.copy-grid label{font-size:9px;font-weight:750;color:#686f69;letter-spacing:.5px}.media-preview{height:200px;border-radius:6px;overflow:hidden;background:#161a17;position:relative;margin-top:8px}.media-preview>img,.media-preview>video{width:100%;height:100%;object-fit:cover}.media-preview>div{position:absolute;left:0;right:0;bottom:0;padding:12px;background:rgba(8,10,8,.78);display:flex;align-items:center;justify-content:space-between;color:#fff;font-size:10px}.media-preview>div>span{display:flex;align-items:center;gap:6px;max-width:55%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.media-preview label{height:32px;background:var(--lime);color:#1c260c;border-radius:4px;padding:0 10px;display:flex;align-items:center;gap:6px;font-weight:800;cursor:pointer}.media-preview input{display:none}.field-help{display:block;font-size:9px;color:#969c97;margin-top:7px}.copy-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px}.copy-grid label{display:flex;flex-direction:column;gap:7px}.copy-grid label.wide{grid-column:1/3}.copy-grid input,.copy-grid textarea{border:1px solid #daddd9;border-radius:5px;background:#fff;padding:10px;font-size:12px;color:#222;outline:0;resize:vertical}.copy-grid input{height:40px}.copy-grid textarea{height:70px;min-height:70px}.copy-grid input:focus,.copy-grid textarea:focus{border-color:#81bb2e;box-shadow:0 0 0 3px #edf7df}.copy-grid label>small{font-size:9px;color:#949a95;font-weight:400;letter-spacing:0}.enabled-toggle{border-top:1px solid var(--line);margin-top:20px;padding-top:17px;display:flex;align-items:center;gap:10px;cursor:pointer}.enabled-toggle input{display:none}.enabled-toggle>span{width:36px;height:20px;border-radius:10px;background:#cdd2cd;position:relative;transition:.2s}.enabled-toggle>span:after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;left:2px;top:2px;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:.2s}.enabled-toggle input:checked+span{background:#78b91b}.enabled-toggle input:checked+span:after{transform:translateX(16px)}.enabled-toggle>div{display:flex;flex-direction:column}.enabled-toggle strong{font-size:11px}.enabled-toggle small{font-size:9px;color:var(--muted);margin-top:3px}.preview-label{display:flex;justify-content:space-between;margin:0 3px 9px;font-size:11px}.preview-label span{color:var(--muted);font-size:9px}.phone-frame{height:480px;border:7px solid #202420;border-radius:24px;background:#111;overflow:hidden;position:relative;box-shadow:0 15px 35px rgba(22,26,22,.15)}.phone-frame>img,.phone-frame>video{width:100%;height:100%;object-fit:cover}.phone-shade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.15),rgba(0,0,0,.25) 35%,rgba(0,0,0,.92))}.phone-brand{position:absolute;top:22px;left:17px;color:#fff;font-weight:800;font-size:11px}.phone-brand b{font-size:20px;color:var(--lime);margin-right:4px}.phone-copy{position:absolute;left:17px;right:17px;bottom:16px;color:#fff}.phone-copy>span{font-size:7px;font-weight:800}.phone-copy h2{white-space:pre-wrap;font-size:19px;line-height:22px;margin:8px 0;font-weight:900}.phone-copy h2 em{font-style:normal;color:var(--lime)}.phone-copy p{font-size:8px;line-height:12px;color:rgba(255,255,255,.76);margin:0}.phone-auth{height:28px;margin-top:10px;padding:3px;border:1px solid rgba(255,255,255,.18);border-radius:15px;background:rgba(8,12,9,.82);display:flex;gap:3px}.phone-auth>button{flex:1;border:0;border-radius:11px;background:rgba(7,9,8,.9);color:#fff;font-size:5px}.phone-auth>button:last-child{background:#fff;color:#151815;font-weight:800}.phone-preview-panel{position:sticky;top:92px}
@media(max-width:1180px){.content-layout{grid-template-columns:190px minmax(420px,1fr)}.phone-preview-panel{display:none}}
@media(max-width:820px){.content-layout{grid-template-columns:1fr}.slide-list{position:static}.content-page-head{align-items:flex-start}.slide-items{display:flex;overflow-x:auto}.slide-items>button{min-width:180px}.copy-grid{grid-template-columns:1fr}.copy-grid label.wide{grid-column:auto}}
@media(max-width:520px){.content-page-head{flex-direction:column}.content-page-head .primary-button{width:100%}.media-preview>div{align-items:flex-end}.media-preview>div>span{display:none}}
`;
