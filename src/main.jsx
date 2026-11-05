import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Activity, Bike, CalendarDays, ChartNoAxesCombined, ChevronLeft, ChevronRight, Clock3, Dumbbell, Footprints, Gauge, LayoutDashboard, Plus, Search, Settings, Upload, UserRound, Waves, LogOut, Trash2, Pencil } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './style.css';

// La Publishable key è utilizzabile nel frontend. Non inserire qui Secret o service_role.
const supabase = createClient(
  'https://anzdfvelbfnhstodlucw.supabase.co',
  'sb_publishable_WlGSjVK8vRPWj77VioArQw_fpUfyc5a'
);

const trend = [{day:'Lun',value:0},{day:'Mar',value:58},{day:'Mer',value:0},{day:'Gio',value:72},{day:'Ven',value:0},{day:'Sab',value:145},{day:'Dom',value:42}];
const nav = [
  {label:'Panoramica', icon:LayoutDashboard}, {label:'Registro attività', icon:Activity}, {label:'Calendario', icon:CalendarDays},
  {label:'Palestra', icon:Dumbbell}, {label:'Running', icon:Footprints}, {label:'Ciclismo', icon:Bike}, {label:'Statistiche', icon:ChartNoAxesCombined}, {label:'Impostazioni', icon:Settings}
];

function numberFrom(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).trim().replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function durationToSeconds(value) {
  if (!value) return null;
  const s = String(value).trim().toLowerCase();
  const hours = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minutes = s.match(/(\d+(?:[.,]\d+)?)\s*m/);
  if (hours || minutes) return Math.round((hours ? numberFrom(hours[1]) * 3600 : 0) + (minutes ? numberFrom(minutes[1]) * 60 : 0));
  const n = numberFrom(s);
  return n === null ? null : Math.round(n * 60);
}
function secondsToDuration(value) {
  if (value == null) return '—';
  const h = Math.floor(value / 3600), m = Math.round((value % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}
function activityIcon(type) {
  return type === 'Ciclismo' ? Bike : type === 'Palestra' ? Dumbbell : type === 'Running' ? Footprints : Activity;
}
function fromDatabase(row) {
  return {
    id: row.id, date: row.started_at.slice(0, 10), type: row.activity_type, title: row.title,
    source: row.source === 'manual' ? 'Manuale' : row.source,
    duration: secondsToDuration(row.duration_seconds),
    distance: row.distance_meters == null ? '—' : `${(Number(row.distance_meters) / 1000).toLocaleString('it-IT', {maximumFractionDigits:1})} km`,
    elevation: row.elevation_gain_meters == null ? '—' : `${row.elevation_gain_meters} m`,
    icon: activityIcon(row.activity_type)
  };
}

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(data.session ? 'Account creato: accesso effettuato.' : 'Registrazione completata. Controlla la tua email per confermare l’account, poi accedi.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message || 'Errore durante l’autenticazione.');
    } finally { setBusy(false); }
  }
  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <div className="brand auth-brand"><div className="brand-mark"><Activity size={21}/></div><div><b>MY TRAINING</b><small>PERSONAL FITNESS HUB</small></div></div>
    <div className="eyebrow">AREA PERSONALE</div><h1>{mode === 'login' ? 'Bentornato' : 'Crea il tuo account'}</h1>
    <p>Accedi per consultare e salvare i tuoi allenamenti.</p>
    <label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@email.com"/></label>
    <label>Password<input type="password" required minLength="6" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Almeno 6 caratteri"/></label>
    {message && <div className="auth-message">{message}</div>}
    <button className="primary-button full" disabled={busy}>{busy ? 'Attendi…' : mode === 'login' ? 'Accedi' : 'Registrati'}</button>
    <button type="button" className="auth-switch" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('');}}>{mode==='login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}</button>
  </form></div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [active, setActive] = useState('Panoramica');
  const [activities, setActivities] = useState([]);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const emptyForm = () => ({title:'',type:'Running',date:new Date().toISOString().slice(0,10),duration:'',distance:''});
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setAuthReady(true); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session) { setActivities([]); return; }
      setLoading(true); setError('');
      const {data, error} = await supabase.from('activities').select('*').order('started_at', {ascending:false});
      if (cancelled) return;
      if (error) setError(`Errore caricamento attività: ${error.message}`);
      else setActivities((data || []).map(fromDatabase));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [session]);

  const filtered = useMemo(() => activities.filter(a =>
    (active === 'Registro attività' || active === 'Panoramica' || active === 'Calendario' || active === 'Statistiche' || active === 'Impostazioni' || a.type === active) &&
    `${a.title} ${a.type} ${a.source}`.toLowerCase().includes(query.toLowerCase())
  ), [activities, active, query]);

  function openNewActivity() { setEditingId(null); setForm(emptyForm()); setShowForm(true); }

  function openEditActivity(activity) {
    const distance = activity.distance === '—' ? '' : String(numberFrom(activity.distance) ?? '');
    setEditingId(activity.id);
    setForm({title:activity.title, type:activity.type, date:activity.date, duration:activity.duration === '—' ? '' : activity.duration, distance});
    setShowForm(true);
  }

  async function saveActivity(e) {
    e.preventDefault(); setSaving(true); setError(''); setNotice('');
    const km = numberFrom(form.distance);
    const payload = {
      activity_type: form.type,
      title: form.title.trim(),
      started_at: new Date(`${form.date}T12:00:00`).toISOString(),
      duration_seconds: durationToSeconds(form.duration),
      distance_meters: form.type === 'Palestra' || km === null ? null : km * 1000
    };
    const result = editingId
      ? await supabase.from('activities').update(payload).eq('id', editingId).select().single()
      : await supabase.from('activities').insert({...payload, user_id:session.user.id, source:'manual'}).select().single();
    if (result.error) setError(`${editingId ? 'Modifica' : 'Salvataggio'} non riuscita: ${result.error.message}`);
    else {
      const updated = fromDatabase(result.data);
      setActivities(previous => editingId ? previous.map(a => a.id === editingId ? updated : a).sort((a,b)=>b.date.localeCompare(a.date)) : [updated, ...previous]);
      setShowForm(false); setEditingId(null); setForm(emptyForm());
      setActive('Registro attività');
      setNotice(editingId ? 'Attività aggiornata nel cloud.' : 'Attività salvata nel cloud.');
    }
    setSaving(false);
  }

  async function deleteActivity(id) {
    if (!window.confirm('Vuoi eliminare definitivamente questa attività?')) return;
    setError(''); setNotice('');
    const {error} = await supabase.from('activities').delete().eq('id', id);
    if (error) setError(`Eliminazione non riuscita: ${error.message}`);
    else { setActivities(previous => previous.filter(a => a.id !== id)); setNotice('Attività eliminata.'); }
  }
  async function signOut() { await supabase.auth.signOut(); setActive('Panoramica'); }

  if (!authReady) return <div className="auth-screen"><div className="auth-card">Caricamento…</div></div>;
  if (!session) return <AuthScreen/>;

  const totalSeconds = activities.reduce((sum, a) => sum + (durationToSeconds(a.duration) || 0), 0);
  const totalMeters = activities.reduce((sum, a) => sum + (numberFrom(a.distance) || 0) * 1000, 0);
  const totalElevation = activities.reduce((sum, a) => sum + (numberFrom(a.elevation) || 0), 0);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={21}/></div><div><b>MY TRAINING</b><small>PERSONAL FITNESS HUB</small></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{nav.map(({label,icon:Icon})=><button key={label} className={`nav-item ${active===label?'selected':''}`} onClick={()=>setActive(label)}><Icon size={18}/><span>{label}</span>{label==='Registro attività'&&<span className="nav-count">{activities.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><div className="avatar"><UserRound size={18}/></div><div><b>Area personale</b><small>{session.user.email}</small></div></div><div className="private-note">I tuoi dati, in un unico posto.</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">My Training <ChevronRight size={14}/> <b>{active}</b></div><div className="top-actions"><span className="sync"><span className="dot"/> Cloud sincronizzato</span><button className="icon-button" aria-label="Esci" title="Esci" onClick={signOut}><LogOut size={17}/></button></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">IL TUO PERCORSO, SOTTO CONTROLLO</div><h1>{active==='Panoramica'?'Buongiorno':active}</h1><p>Monitora le attività, consulta lo storico e segui i tuoi progressi.</p></div>{active!=='Palestra' && <button className="primary-button" onClick={openNewActivity}><Plus size={17}/> Registra attività</button>}</div>
        {error && <div className="notice error">{error}</div>}{notice && <div className="notice">{notice}</div>}
        {active==='Impostazioni' ? <SettingsPage email={session.user.email}/> : active==='Palestra' ? <GymPage userId={session.user.id}/> : active==='Calendario' ? <CalendarPage activities={activities} userId={session.user.id}/> : active==='Statistiche' ? <StatisticsPage activities={activities} userId={session.user.id}/> : <>
          <section className="stats-grid">
            <Stat icon={Activity} label="Attività registrate" value={activities.length} foot="Nel tuo archivio cloud"/>
            <Stat icon={Clock3} label="Tempo registrato" value={secondsToDuration(totalSeconds)} foot="Totale delle attività"/>
            <Stat icon={Gauge} label="Distanza registrata" value={`${(totalMeters/1000).toLocaleString('it-IT',{maximumFractionDigits:1})} km`} foot="Corsa + ciclismo"/>
            <Stat icon={Waves} label="Dislivello positivo" value={`${totalElevation.toLocaleString('it-IT')} m`} foot="Quando disponibile"/>
          </section>
          {active==='Panoramica' && <section className="two-col">
            <div className="panel chart-panel"><div className="panel-heading"><div><h2>Attività della settimana</h2><p>Grafico dimostrativo, da collegare ai dati reali</p></div><span className="period">Esempio</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6d8cff" stopOpacity={0.28}/><stop offset="100%" stopColor="#6d8cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#263248"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:12}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:12}} width={32}/><Tooltip contentStyle={{background:'#172235',border:'1px solid #2a3850',borderRadius:10,color:'#fff'}}/><Area type="monotone" dataKey="value" stroke="#829aff" strokeWidth={2.5} fill="url(#fill)"/></AreaChart></ResponsiveContainer></div></div>
            <div className="panel import-panel"><div className="panel-heading"><div><h2>Collega le piattaforme</h2><p>Importa le tue attività sportive</p></div><Upload size={19}/></div><Integration name="Garmin Connect" desc="Integrazione da sviluppare" color="garmin"/><Integration name="Strava" desc="Integrazione da sviluppare" color="strava"/><div className="integration-foot">Le connessioni Garmin e Strava non sono ancora attive.</div></div>
          </section>}
          <section className="panel activity-panel">
            <div className="panel-heading activity-heading"><div><h2>{active==='Panoramica'?'Attività recenti':active==='Calendario'?'Storico attività':active==='Statistiche'?'Attività analizzate':'Registro attività'}</h2><p>Consulta e cerca gli allenamenti registrati</p></div><div className="search-wrap"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca attività..."/></div></div>
            {loading ? <div className="empty">Caricamento attività…</div> : <div className="activity-list">{filtered.length ? filtered.map(a=><ActivityRow key={a.id} item={a} onEdit={openEditActivity} onDelete={deleteActivity}/>) : <div className="empty">Nessuna attività trovata. Registra il tuo primo allenamento.</div>}</div>}
            <div className="panel-footer">Visualizzate {filtered.length} attività <button onClick={()=>setActive('Registro attività')}>Apri registro completo <ChevronRight size={15}/></button></div>
          </section>
        </>}
        <footer>MY TRAINING <span>·</span> Archivio personale su Supabase</footer>
      </div>
    </main>
    {showForm && <div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="modal" onSubmit={saveActivity} onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><div className="eyebrow">{editingId ? 'MODIFICA REGISTRAZIONE' : 'NUOVA REGISTRAZIONE'}</div><h2>{editingId ? 'Modifica attività' : 'Registra attività'}</h2></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)}>✕</button></div>
      <label>Nome attività<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Es. Corsa al parco"/></label>
      <div className="form-row"><label>Tipologia<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Running</option><option>Ciclismo</option><option>Palestra</option></select></label><label>Data<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label></div>
      <div className="form-row"><label>Durata<input value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} placeholder="Es. 45 min oppure 1h 20m"/></label><label>Distanza (km)<input value={form.distance} onChange={e=>setForm({...form,distance:e.target.value})} placeholder="Es. 8,5"/></label></div>
      <button className="primary-button full" type="submit" disabled={saving}>{saving?'Salvataggio…':editingId?'Salva modifiche':'Salva nel cloud'}</button>
    </form></div>}
  </div>;
}

function GymPage({userId}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [originalSetIds, setOriginalSetIds] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const emptySet = () => ({id:null, exercise_name:'', set_number:1, reps:'', weight_kg:'', rest_seconds:'', notes:''});
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [notes, setNotes] = useState('');
  const [sets, setSets] = useState([emptySet()]);
  const [selectedExercise, setSelectedExercise] = useState('');

  async function loadSessions() {
    setLoading(true); setError('');
    const {data, error} = await supabase.from('workout_sessions')
      .select('id,title,performed_at,notes,workout_sets(id,exercise_name,set_number,reps,weight_kg,rest_seconds,notes)')
      .order('performed_at', {ascending:false});
    if (error) setError(`Errore caricamento allenamenti: ${error.message}`);
    else setSessions(data || []);
    setLoading(false);
  }
  useEffect(() => { loadSessions(); }, [userId]);

  function openForm() {
    setEditingSessionId(null); setOriginalSetIds([]); setTitle(''); setDate(new Date().toISOString().slice(0,10)); setNotes(''); setSets([emptySet()]); setError(''); setNotice(''); setShowForm(true);
  }
  function openEditForm(session) {
    setEditingSessionId(session.id);
    setOriginalSetIds((session.workout_sets || []).map(item=>item.id));
    setTitle(session.title || '');
    setDate((session.performed_at || new Date().toISOString()).slice(0,10));
    setNotes(session.notes || '');
    setSets((session.workout_sets || []).slice().sort((a,b)=>a.set_number-b.set_number).map(item=>({...item, reps:item.reps ?? '', weight_kg:item.weight_kg ?? '', rest_seconds:item.rest_seconds ?? ''})));
    setError(''); setNotice(''); setShowForm(true);
  }
  function updateSet(index, field, value) {
    setSets(prev => prev.map((item,i) => i===index ? {...item,[field]:value} : item));
  }
  function addSet() { setSets(prev => [...prev, {...emptySet(), set_number:prev.length+1}]); }
  function removeSet(index) { setSets(prev => prev.filter((_,i)=>i!==index).map((item,i)=>({...item,set_number:i+1}))); }
  async function saveWorkout(e) {
    e.preventDefault(); setSaving(true); setError(''); setNotice('');
    const wasEditing = Boolean(editingSessionId);
    const validSets = sets.filter(s => s.exercise_name.trim());
    if (!title.trim()) { setError('Inserisci il nome dell’allenamento.'); setSaving(false); return; }
    if (!validSets.length) { setError('Inserisci almeno un esercizio.'); setSaving(false); return; }
    const sessionPayload = {title:title.trim(), performed_at:new Date(`${date}T12:00:00`).toISOString(), notes:notes.trim() || null};
    let sessionId = editingSessionId;
    if (editingSessionId) {
      const {error:sessionError} = await supabase.from('workout_sessions').update(sessionPayload).eq('id',editingSessionId).eq('user_id',userId);
      if (sessionError) { setError(`Modifica allenamento non riuscita: ${sessionError.message}`); setSaving(false); return; }
    } else {
      const {data:sessionRow, error:sessionError} = await supabase.from('workout_sessions').insert({...sessionPayload,user_id:userId}).select().single();
      if (sessionError) { setError(`Salvataggio allenamento non riuscito: ${sessionError.message}`); setSaving(false); return; }
      sessionId = sessionRow.id;
    }
    const rows = validSets.map((s,index) => ({
      ...(s.id ? {id:s.id} : {}), session_id:sessionId, exercise_name:s.exercise_name.trim(), set_number:Number(s.set_number)||index+1,
      reps:s.reps===''?null:Number(s.reps), weight_kg:s.weight_kg===''?null:Number(String(s.weight_kg).replace(',','.')),
      rest_seconds:s.rest_seconds===''?null:Number(s.rest_seconds), notes:(s.notes||'').trim()||null
    }));
    const existingIds = originalSetIds;
    const keepIds = rows.filter(r=>r.id).map(r=>r.id);
    const removedIds = existingIds.filter(id=>!keepIds.includes(id));
    const updates = rows.filter(r=>r.id);
    const inserts = rows.filter(r=>!r.id).map(({id,...r})=>r);
    let setsError = null;
    for (const row of updates) { const {id,...payload} = row; const result = await supabase.from('workout_sets').update(payload).eq('id',id); if (result.error) { setsError=result.error; break; } }
    if (!setsError && inserts.length) { const result = await supabase.from('workout_sets').insert(inserts); setsError=result.error; }
    if (!setsError && removedIds.length) { const result = await supabase.from('workout_sets').delete().in('id',removedIds); setsError=result.error; }
    if (setsError) { setError(`Dati delle serie non aggiornati completamente: ${setsError.message}. Ricarica lo storico e controlla l’allenamento.`); await loadSessions(); setSaving(false); return; }
    setShowForm(false); setEditingSessionId(null); setOriginalSetIds([]); setNotice(wasEditing ? 'Allenamento modificato nel cloud.' : 'Allenamento salvato nel cloud.'); await loadSessions(); setSaving(false);
  }
  async function deleteWorkout(id) {
    if (!window.confirm('Vuoi eliminare questo allenamento e tutte le sue serie?')) return;
    const {error} = await supabase.from('workout_sessions').delete().eq('id',id);
    if (error) setError(`Eliminazione non riuscita: ${error.message}`);
    else { setSessions(prev=>prev.filter(s=>s.id!==id)); setNotice('Allenamento eliminato.'); }
  }
  const totalSets = sessions.reduce((n,s)=>n+(s.workout_sets||[]).length,0);
  const exerciseNames = useMemo(() => {
    const names = new Map();
    sessions.forEach(session => (session.workout_sets || []).forEach(set => {
      const clean = (set.exercise_name || '').trim();
      if (clean) names.set(clean.toLocaleLowerCase('it-IT'), clean);
    }));
    return [...names.values()].sort((a,b)=>a.localeCompare(b,'it'));
  }, [sessions]);
  const currentExercise = exerciseNames.includes(selectedExercise) ? selectedExercise : (exerciseNames[0] || '');
  const exerciseProgress = useMemo(() => {
    if (!currentExercise) return [];
    return sessions.map(session => {
      const matching = (session.workout_sets || []).filter(set => (set.exercise_name || '').trim().toLocaleLowerCase('it-IT') === currentExercise.toLocaleLowerCase('it-IT'));
      if (!matching.length) return null;
      const loads = matching.map(set => set.weight_kg == null ? null : Number(set.weight_kg)).filter(value => value !== null && Number.isFinite(value));
      const volume = matching.reduce((sum,set) => {
        const weight = set.weight_kg == null ? 0 : Number(set.weight_kg);
        const reps = set.reps == null ? 0 : Number(set.reps);
        return sum + (Number.isFinite(weight) && Number.isFinite(reps) ? weight * reps : 0);
      },0);
      return {
        date: session.performed_at.slice(0,10),
        label: new Date(session.performed_at).toLocaleDateString('it-IT',{day:'2-digit',month:'short'}),
        maxWeight: loads.length ? Math.max(...loads) : null,
        volume: volume || 0,
        sets: matching.length
      };
    }).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
  }, [sessions, currentExercise]);
  const bestWeight = exerciseProgress.reduce((best,item)=>item.maxWeight == null ? best : Math.max(best,item.maxWeight),0);
  const latestWeight = [...exerciseProgress].reverse().find(item=>item.maxWeight != null)?.maxWeight ?? null;
  return <div className="gym-page">
    {error && <div className="notice error">{error}</div>}{notice && <div className="notice">{notice}</div>}
    <div className="gym-intro panel"><div><div className="eyebrow">ALLENAMENTO CON I PESI</div><h2>Il tuo diario palestra</h2><p>Registra esercizi, serie, ripetizioni, carichi e recuperi. I dati vengono salvati nel tuo archivio personale.</p></div><button className="primary-button" onClick={openForm}><Plus size={17}/> Nuovo allenamento</button></div>
    <div className="gym-summary"><div className="stat-card"><div className="stat-top"><span>Allenamenti</span><Dumbbell size={18}/></div><strong>{sessions.length}</strong><small>Sessioni registrate</small></div><div className="stat-card"><div className="stat-top"><span>Serie registrate</span><Activity size={18}/></div><strong>{totalSets}</strong><small>Totale serie nello storico</small></div></div>
    <section className="panel gym-progress">
      <div className="panel-heading gym-progress-heading"><div><h2>Progressione dei carichi</h2><p>Confronta il carico massimo e il volume per ogni esercizio</p></div><label className="progress-select-label">Esercizio<select value={currentExercise} onChange={e=>setSelectedExercise(e.target.value)} disabled={!exerciseNames.length}>{exerciseNames.length ? exerciseNames.map(name=><option key={name} value={name}>{name}</option>) : <option>Nessun esercizio</option>}</select></label></div>
      {!exerciseNames.length ? <div className="empty">Registra almeno un esercizio con un carico per iniziare a vedere la progressione.</div> : <>
        <div className="progress-kpis"><div><small>Miglior carico registrato</small><strong>{bestWeight ? `${bestWeight.toLocaleString('it-IT')} kg` : '—'}</strong></div><div><small>Ultimo carico massimo</small><strong>{latestWeight == null ? '—' : `${latestWeight.toLocaleString('it-IT')} kg`}</strong></div><div><small>Sessioni con questo esercizio</small><strong>{exerciseProgress.length}</strong></div></div>
        <div className="progress-charts"><div className="progress-chart-card"><div className="progress-chart-title"><b>Carico massimo per sessione</b><span>kg</span></div>{exerciseProgress.some(item=>item.maxWeight!==null) ? <div className="progress-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={exerciseProgress}><defs><linearGradient id="gymLoadFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#829aff" stopOpacity={0.3}/><stop offset="100%" stopColor="#829aff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#263248"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:11}} width={38}/><Tooltip labelFormatter={(_,payload)=>payload?.[0]?.payload?.date ? new Date(payload[0].payload.date+'T12:00:00').toLocaleDateString('it-IT') : ''} formatter={value=>[`${value} kg`,'Carico massimo']} contentStyle={{background:'#172235',border:'1px solid #2a3850',borderRadius:10,color:'#fff'}}/><Area type="monotone" dataKey="maxWeight" stroke="#829aff" strokeWidth={2.5} fill="url(#gymLoadFill)" connectNulls/></AreaChart></ResponsiveContainer></div> : <div className="empty">Per questo esercizio non sono ancora stati inseriti carichi.</div>}</div>
        <div className="progress-chart-card"><div className="progress-chart-title"><b>Volume per sessione</b><span>kg × ripetizioni</span></div><div className="progress-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={exerciseProgress}><defs><linearGradient id="gymVolumeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#52c7ae" stopOpacity={0.28}/><stop offset="100%" stopColor="#52c7ae" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#263248"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:11}} width={38}/><Tooltip formatter={value=>[`${Number(value).toLocaleString('it-IT')} kg·rip.`,'Volume']} contentStyle={{background:'#172235',border:'1px solid #2a3850',borderRadius:10,color:'#fff'}}/><Area type="monotone" dataKey="volume" stroke="#52c7ae" strokeWidth={2.5} fill="url(#gymVolumeFill)"/></AreaChart></ResponsiveContainer></div></div></div>
        <p className="progress-note">Il carico massimo è il peso più alto registrato in una serie di quella sessione. Il volume è calcolato sommando carico × ripetizioni; le serie senza carico o ripetizioni contribuiscono zero.</p>
      </>}
    </section>
    <section className="panel gym-history"><div className="panel-heading"><div><h2>Storico palestra</h2><p>Le sessioni più recenti sono mostrate per prime</p></div></div>
      {loading ? <div className="empty">Caricamento allenamenti…</div> : sessions.length===0 ? <div className="empty">Non hai ancora registrato allenamenti in palestra. Crea la tua prima sessione.</div> : <div className="gym-session-list">{sessions.map(session=><article className="gym-session" key={session.id}>
        <div className="gym-session-head"><div><b>{session.title}</b><small>{new Date(session.performed_at).toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'})} · {(session.workout_sets||[]).length} serie</small></div><div className="gym-session-actions"><button className="edit-button" title="Modifica allenamento" aria-label="Modifica allenamento" onClick={()=>openEditForm(session)}><Pencil size={15}/></button><button className="delete-button" title="Elimina allenamento" aria-label="Elimina allenamento" onClick={()=>deleteWorkout(session.id)}><Trash2 size={16}/></button></div></div>
        <div className="gym-set-list">{(session.workout_sets||[]).sort((a,b)=>a.exercise_name.localeCompare(b.exercise_name)||a.set_number-b.set_number).map(set=><div className="gym-set-row" key={set.id}><b>{set.exercise_name}</b><span>Serie {set.set_number}</span><span>{set.reps ?? '—'} rip.</span><span>{set.weight_kg==null?'—':`${set.weight_kg} kg`}</span><span>{set.rest_seconds==null?'—':`${set.rest_seconds}s rec.`}</span></div>)}</div>
        {session.notes && <p className="gym-notes">{session.notes}</p>}
      </article>)}</div>}
    </section>
    {showForm && <div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="modal gym-modal" onSubmit={saveWorkout} onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><div className="eyebrow">DIARIO ALLENAMENTO</div><h2>{editingSessionId ? 'Modifica allenamento' : 'Nuovo allenamento'}</h2></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)}>✕</button></div>
      <label>Nome allenamento<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Es. Full body A"/></label>
      <label>Data<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
      <div className="gym-form-heading"><b>Esercizi e serie</b><span>Una riga per ogni serie</span></div>
      <div className="gym-form-sets">{sets.map((set,index)=><div className="gym-form-set" key={set.id || index}>
        <label className="exercise-field">Esercizio<input required value={set.exercise_name} onChange={e=>updateSet(index,'exercise_name',e.target.value)} placeholder="Es. Squat"/></label>
        <div className="gym-fields"><label>Serie n.<input type="number" min="1" value={set.set_number} onChange={e=>updateSet(index,'set_number',e.target.value)}/></label><label>Ripetizioni<input type="number" min="0" value={set.reps} onChange={e=>updateSet(index,'reps',e.target.value)} placeholder="10"/></label><label>Carico (kg)<input type="number" min="0" step="0.5" value={set.weight_kg} onChange={e=>updateSet(index,'weight_kg',e.target.value)} placeholder="20"/></label><label>Recupero (sec)<input type="number" min="0" value={set.rest_seconds} onChange={e=>updateSet(index,'rest_seconds',e.target.value)} placeholder="90"/></label></div>
        <button type="button" className="remove-set-button" onClick={()=>removeSet(index)}>Rimuovi serie</button>
      </div>)}</div>
      <button type="button" className="secondary-button" onClick={addSet}><Plus size={15}/> Aggiungi serie / esercizio</button>
      <label>Note<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Eventuali note sull'allenamento"/></label>
      <button className="primary-button full" type="submit" disabled={saving}>{saving?'Salvataggio…':editingSessionId?'Salva modifiche':'Salva allenamento nel cloud'}</button>
    </form></div>}
  </div>;
}


function dateKey(date) {
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function CalendarPage({activities,userId}) {
  const [workouts,setWorkouts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [cursor,setCursor]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [selected,setSelected]=useState(()=>dateKey(new Date()));
  const [view,setView]=useState('month');
  useEffect(()=>{
    let cancelled=false;
    async function load(){
      setLoading(true);setError('');
      const {data,error}=await supabase.from('workout_sessions').select('id,title,performed_at').order('performed_at',{ascending:false});
      if(cancelled)return;
      if(error)setError(`Impossibile caricare gli allenamenti in palestra: ${error.message}`);
      else setWorkouts(data||[]);
      setLoading(false);
    }
    load();return()=>{cancelled=true;};
  },[userId]);
  const events=useMemo(()=>[
    ...activities.map(a=>({id:`activity-${a.id}`,date:a.date,title:a.title,type:a.type,detail:[a.duration!=='—'?a.duration:null,a.distance!=='—'?a.distance:null].filter(Boolean).join(' · '),kind:'activity'})),
    ...workouts.map(w=>({id:`workout-${w.id}`,date:w.performed_at.slice(0,10),title:w.title,type:'Palestra',detail:'Allenamento con i pesi',kind:'workout'}))
  ].sort((a,b)=>a.date.localeCompare(b.date)),[activities,workouts]);
  const eventsByDate=useMemo(()=>events.reduce((map,event)=>{(map[event.date] ||= []).push(event);return map;},{}),[events]);
  const monthStart=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const monthEnd=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
  const offset=(monthStart.getDay()+6)%7;
  const gridStart=new Date(monthStart);gridStart.setDate(monthStart.getDate()-offset);
  const monthCells=Array.from({length:42},(_,i)=>{const d=new Date(gridStart);d.setDate(gridStart.getDate()+i);return d;});
  const weekStart=new Date(cursor);weekStart.setDate(cursor.getDate()-((cursor.getDay()+6)%7));
  const visibleDays=view==='month'?monthCells:Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);return d;});
  const selectedEvents=eventsByDate[selected]||[];
  const monthLabel=cursor.toLocaleDateString('it-IT',{month:'long',year:'numeric'});
  function move(step){const next=new Date(cursor);if(view==='month')next.setMonth(next.getMonth()+step);else next.setDate(next.getDate()+step*7);setCursor(next);}
  function goToday(){const now=new Date();setCursor(new Date(now.getFullYear(),now.getMonth(),1));setSelected(dateKey(now));}
  return <div className="calendar-page">
    {error&&<div className="notice error">{error}</div>}
    <section className="panel calendar-panel">
      <div className="calendar-toolbar"><div><div className="eyebrow">IL TUO ARCHIVIO SPORTIVO</div><h2>{monthLabel}</h2><p>{events.length} attività e allenamenti registrati</p></div><div className="calendar-controls"><button className="secondary-button" onClick={goToday}>Oggi</button><button className="icon-button" aria-label="Periodo precedente" onClick={()=>move(-1)}><ChevronLeft size={17}/></button><button className="icon-button" aria-label="Periodo successivo" onClick={()=>move(1)}><ChevronRight size={17}/></button><div className="calendar-view-switch"><button className={view==='month'?'active':''} onClick={()=>setView('month')}>Mese</button><button className={view==='week'?'active':''} onClick={()=>setView('week')}>Settimana</button></div></div></div>
      <div className="calendar-legend"><span><i className="legend-dot running-dot"/> Running</span><span><i className="legend-dot cycling-dot"/> Ciclismo</span><span><i className="legend-dot gym-dot"/> Palestra</span><span><i className="legend-dot other-dot"/> Altre attività</span></div>
      <div className={`calendar-grid ${view==='week'?'week-view':''}`}>
        {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(day=><div className="calendar-weekday" key={day}>{day}</div>)}
        {visibleDays.map(day=>{const key=dateKey(day),dayEvents=eventsByDate[key]||[],outside=day.getMonth()!==cursor.getMonth();return <button key={key} className={`calendar-day ${outside&&view==='month'?'outside':''} ${selected===key?'chosen':''} ${key===dateKey(new Date())?'today':''}`} onClick={()=>setSelected(key)}><span className="calendar-day-number">{day.getDate()}</span><span className="calendar-day-events">{dayEvents.slice(0,3).map(event=><span key={event.id} className={`calendar-event ${event.type==='Running'?'running-event':event.type==='Ciclismo'?'cycling-event':event.type==='Palestra'?'gym-event':'other-event'}`}>{event.title}</span>)}{dayEvents.length>3&&<small>+{dayEvents.length-3} altre</small>}</span><span className="calendar-mobile-count">{dayEvents.length?`${dayEvents.length} att.`:''}</span></button>;})}
      </div>
      {loading&&<div className="calendar-loading">Caricamento allenamenti palestra…</div>}
    </section>
    <section className="panel calendar-detail"><div className="panel-heading"><div><h2>{new Date(selected+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2><p>Attività registrate in questa giornata</p></div><span className="period">{selectedEvents.length} {selectedEvents.length===1?'attività':'attività'}</span></div>
      {selectedEvents.length===0?<div className="empty">Nessun allenamento registrato in questa giornata.</div>:<div className="calendar-event-list">{selectedEvents.map(event=><article className="calendar-detail-event" key={event.id}><span className={`calendar-detail-icon ${event.type==='Running'?'running-event':event.type==='Ciclismo'?'cycling-event':event.type==='Palestra'?'gym-event':'other-event'}`}>{event.type==='Running'?<Footprints size={18}/>:event.type==='Ciclismo'?<Bike size={18}/>:event.type==='Palestra'?<Dumbbell size={18}/>:<Activity size={18}/>}</span><div><b>{event.title}</b><small>{event.type}{event.detail?` · ${event.detail}`:''}</small></div><span className="calendar-source">{event.kind==='workout'?'Diario palestra':'Registro attività'}</span></article>)}</div>}
    </section>
  </div>;
}


function StatisticsPage({activities,userId}) {
  const [period,setPeriod]=useState('month');
  const [customStart,setCustomStart]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10));
  const [customEnd,setCustomEnd]=useState(()=>new Date().toISOString().slice(0,10));
  const [workouts,setWorkouts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      setLoading(true);setError('');
      const {data,error}=await supabase.from('workout_sessions')
        .select('id,title,performed_at,workout_sets(id,exercise_name,reps,weight_kg)')
        .order('performed_at',{ascending:false});
      if(cancelled)return;
      if(error)setError(`Impossibile caricare i dati palestra: ${error.message}`);
      else setWorkouts(data||[]);
      setLoading(false);
    }
    load();return()=>{cancelled=true;};
  },[userId]);

  const today=new Date();
  const range=useMemo(()=>{
    const end=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    let start=new Date(end);
    if(period==='week'){start.setDate(start.getDate()-((start.getDay()+6)%7));}
    else if(period==='month'){start=new Date(end.getFullYear(),end.getMonth(),1);}
    else if(period==='year'){start=new Date(end.getFullYear(),0,1);}
    else {start=new Date(`${customStart}T00:00:00`);end.setTime(new Date(`${customEnd}T23:59:59`).getTime());}
    return {start,end};
  },[period,customStart,customEnd]);
  const inRange=(value)=>{const d=new Date(`${String(value).slice(0,10)}T12:00:00`);return d>=range.start&&d<=range.end;};
  const filteredActivities=activities.filter(a=>inRange(a.date));
  const filteredWorkouts=workouts.filter(w=>inRange(w.performed_at));
  const running=filteredActivities.filter(a=>a.type==='Running');
  const cycling=filteredActivities.filter(a=>a.type==='Ciclismo');
  const distanceFor=list=>list.reduce((sum,a)=>sum+(numberFrom(a.distance)||0),0);
  const durationSeconds=filteredActivities.reduce((sum,a)=>sum+(durationToSeconds(a.duration)||0),0);
  const elevation=filteredActivities.reduce((sum,a)=>sum+(numberFrom(a.elevation)||0),0);
  const allSets=filteredWorkouts.flatMap(w=>w.workout_sets||[]);
  const gymVolume=allSets.reduce((sum,s)=>sum+(Number(s.weight_kg)||0)*(Number(s.reps)||0),0);
  const totalSessions=filteredActivities.length+filteredWorkouts.length;
  const byType=[
    {name:'Running',count:running.length,distance:distanceFor(running),color:'running'},
    {name:'Ciclismo',count:cycling.length,distance:distanceFor(cycling),color:'cycling'},
    {name:'Palestra',count:filteredWorkouts.length,distance:0,color:'gym'},
    {name:'Altre attività',count:filteredActivities.filter(a=>!['Running','Ciclismo','Palestra'].includes(a.type)).length,distance:0,color:'other'}
  ];
  const chartData=useMemo(()=>{
    const map=new Map();
    const ensure=(key,label)=>{if(!map.has(key))map.set(key,{key,label,minutes:0,volume:0,activities:0});return map.get(key);};
    filteredActivities.forEach(a=>{const item=ensure(a.date,new Date(a.date+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short'}));item.minutes+=(durationToSeconds(a.duration)||0)/60;item.activities+=1;});
    filteredWorkouts.forEach(w=>{const date=w.performed_at.slice(0,10);const item=ensure(date,new Date(date+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short'}));item.activities+=1;item.volume+=(w.workout_sets||[]).reduce((sum,s)=>sum+(Number(s.weight_kg)||0)*(Number(s.reps)||0),0);});
    return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key));
  },[filteredActivities,filteredWorkouts]);
  const rangeLabel=period==='week'?'Questa settimana':period==='month'?'Questo mese':period==='year'?'Quest’anno':'Periodo personalizzato';
  return <div className="statistics-page">
    {error&&<div className="notice error">{error}</div>}
    <section className="panel statistics-toolbar"><div><div className="eyebrow">ANALISI DELLE PRESTAZIONI</div><h2>Le tue statistiche</h2><p>Riepilogo basato sulle attività e sugli allenamenti salvati nel cloud.</p></div><div className="statistics-filters"><label>Periodo<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="week">Settimana</option><option value="month">Mese</option><option value="year">Anno</option><option value="custom">Personalizzato</option></select></label>{period==='custom'&&<><label>Dal<input type="date" value={customStart} max={customEnd} onChange={e=>setCustomStart(e.target.value)}/></label><label>Al<input type="date" value={customEnd} min={customStart} onChange={e=>setCustomEnd(e.target.value)}/></label></>}</div></section>
    <div className="statistics-period-label">{rangeLabel} · {range.start.toLocaleDateString('it-IT')} – {range.end.toLocaleDateString('it-IT')}</div>
    <section className="stats-grid statistics-kpis">
      <Stat icon={Activity} label="Allenamenti" value={totalSessions} foot={`${filteredActivities.length} attività + ${filteredWorkouts.length} sessioni palestra`}/>
      <Stat icon={Clock3} label="Tempo registrato" value={secondsToDuration(durationSeconds)} foot="Durata disponibile nelle attività"/>
      <Stat icon={Footprints} label="Distanza running" value={`${distanceFor(running).toLocaleString('it-IT',{maximumFractionDigits:1})} km`} foot={`${running.length} sessioni`}/>
      <Stat icon={Bike} label="Distanza ciclismo" value={`${distanceFor(cycling).toLocaleString('it-IT',{maximumFractionDigits:1})} km`} foot={`${cycling.length} sessioni`}/>
      <Stat icon={Waves} label="Dislivello positivo" value={`${elevation.toLocaleString('it-IT',{maximumFractionDigits:0})} m`} foot="Solo dove il dato è disponibile"/>
      <Stat icon={Dumbbell} label="Volume palestra" value={`${gymVolume.toLocaleString('it-IT',{maximumFractionDigits:0})} kg`} foot={`${allSets.length} serie registrate · kg × ripetizioni`}/>
    </section>
    <section className="statistics-grid">
      <div className="panel statistics-chart-panel"><div className="panel-heading"><div><h2>Tempo di allenamento</h2><p>Minuti registrati per giornata</p></div><span className="period">{rangeLabel}</span></div>
        {chartData.length?<div className="statistics-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="statsDurationFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#829aff" stopOpacity={0.3}/><stop offset="100%" stopColor="#829aff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#263248"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:10}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:10}} width={35}/><Tooltip contentStyle={{background:'#172235',border:'1px solid #2a3850',borderRadius:10,color:'#fff'}} formatter={v=>[`${Math.round(v)} min`,'Durata']}/><Area type="monotone" dataKey="minutes" stroke="#829aff" strokeWidth={2.5} fill="url(#statsDurationFill)"/></AreaChart></ResponsiveContainer></div>:<div className="empty">Nessuna attività con durata nel periodo selezionato.</div>}
      </div>
      <div className="panel statistics-chart-panel"><div className="panel-heading"><div><h2>Volume palestra</h2><p>Kg × ripetizioni per giornata</p></div><span className="period">{rangeLabel}</span></div>
        {filteredWorkouts.length?<div className="statistics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#263248"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:10}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:10}} width={42}/><Tooltip contentStyle={{background:'#172235',border:'1px solid #2a3850',borderRadius:10,color:'#fff'}} formatter={v=>[`${Math.round(v).toLocaleString('it-IT')} kg`,'Volume']}/><Bar dataKey="volume" fill="#e9a77f" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>:<div className="empty">Nessuna sessione palestra nel periodo selezionato.</div>}
      </div>
    </section>
    <section className="panel statistics-breakdown"><div className="panel-heading"><div><h2>Attività per tipologia</h2><p>Distribuzione nel periodo selezionato</p></div></div><div className="statistics-type-list">{byType.map(item=><div className="statistics-type-row" key={item.name}><span className={`statistics-type-dot ${item.color}`}/><b>{item.name}</b><span>{item.count} {item.count===1?'sessione':'sessioni'}</span>{item.distance>0&&<strong>{item.distance.toLocaleString('it-IT',{maximumFractionDigits:1})} km</strong>}</div>)}</div></section>
    {loading&&<div className="statistics-loading">Aggiornamento dati palestra…</div>}
    <p className="statistics-footnote">Le statistiche riflettono esclusivamente i dati registrati in My Training. Le attività importate da Garmin e Strava non sono ancora collegate.</p>
  </div>;
}

function Stat({icon:Icon,label,value,foot}) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{foot}</small></div>; }
function Integration({name,desc,color}) { return <div className="integration"><div className={`integration-logo ${color}`}>{color==='garmin'?'G':'S'}</div><div className="integration-text"><b>{name}</b><small>{desc}</small></div><span className="not-connected">Non collegato</span></div>; }
function ActivityRow({item:a,onEdit,onDelete}) { const Icon=a.icon||Activity; return <div className="activity-row"><div className={`activity-icon ${a.type.toLowerCase()}`}><Icon size={19}/></div><div className="activity-main"><b>{a.title}</b><small>{new Date(a.date+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})} <span>·</span> {a.type}</small></div><div className="activity-metric"><b>{a.distance}</b><small>Distanza</small></div><div className="activity-metric"><b>{a.duration}</b><small>Durata</small></div><div className="source-tag">{a.source}</div><button className="edit-button" title="Modifica attività" aria-label="Modifica attività" onClick={()=>onEdit(a)}><Pencil size={15}/></button><button className="delete-button" title="Elimina attività" aria-label="Elimina attività" onClick={()=>onDelete(a.id)}><Trash2 size={16}/></button></div>; }
function SettingsPage({email}) { return <div className="panel settings-card"><h2>Impostazioni del progetto</h2><p>Il tuo account è autenticato e le attività vengono salvate nel database Supabase.</p><div className="settings-line"><div><b>Account personale</b><small>{email}</small></div><span className="status-active">Attivo</span></div><div className="settings-line"><div><b>Database cloud</b><small>Archivio personale protetto da policy RLS</small></div><span className="status-active">Collegato</span></div><div className="settings-line"><div><b>Sincronizzazione Garmin e Strava</b><small>OAuth e importazione da sviluppare</small></div><span className="status-pending">Non attiva</span></div><div className="settings-line"><div><b>Pubblicazione GitHub Pages</b><small>Deploy tramite GitHub Actions</small></div><span className="status-active">Attiva</span></div></div>; }

createRoot(document.getElementById('root')).render(<App/>);
