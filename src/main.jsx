import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Activity, Bike, CalendarDays, ChartNoAxesCombined, ChevronRight, Clock3, Dumbbell, Footprints, Gauge, LayoutDashboard, Plus, Search, Settings, Upload, UserRound, Waves, LogOut, Trash2, Pencil } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
        {active==='Impostazioni' ? <SettingsPage email={session.user.email}/> : active==='Palestra' ? <GymPage userId={session.user.id}/> : <>
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
  return <div className="gym-page">
    {error && <div className="notice error">{error}</div>}{notice && <div className="notice">{notice}</div>}
    <div className="gym-intro panel"><div><div className="eyebrow">ALLENAMENTO CON I PESI</div><h2>Il tuo diario palestra</h2><p>Registra esercizi, serie, ripetizioni, carichi e recuperi. I dati vengono salvati nel tuo archivio personale.</p></div><button className="primary-button" onClick={openForm}><Plus size={17}/> Nuovo allenamento</button></div>
    <div className="gym-summary"><div className="stat-card"><div className="stat-top"><span>Allenamenti</span><Dumbbell size={18}/></div><strong>{sessions.length}</strong><small>Sessioni registrate</small></div><div className="stat-card"><div className="stat-top"><span>Serie registrate</span><Activity size={18}/></div><strong>{totalSets}</strong><small>Totale serie nello storico</small></div></div>
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

function Stat({icon:Icon,label,value,foot}) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{foot}</small></div>; }
function Integration({name,desc,color}) { return <div className="integration"><div className={`integration-logo ${color}`}>{color==='garmin'?'G':'S'}</div><div className="integration-text"><b>{name}</b><small>{desc}</small></div><span className="not-connected">Non collegato</span></div>; }
function ActivityRow({item:a,onEdit,onDelete}) { const Icon=a.icon||Activity; return <div className="activity-row"><div className={`activity-icon ${a.type.toLowerCase()}`}><Icon size={19}/></div><div className="activity-main"><b>{a.title}</b><small>{new Date(a.date+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})} <span>·</span> {a.type}</small></div><div className="activity-metric"><b>{a.distance}</b><small>Distanza</small></div><div className="activity-metric"><b>{a.duration}</b><small>Durata</small></div><div className="source-tag">{a.source}</div><button className="edit-button" title="Modifica attività" aria-label="Modifica attività" onClick={()=>onEdit(a)}><Pencil size={15}/></button><button className="delete-button" title="Elimina attività" aria-label="Elimina attività" onClick={()=>onDelete(a.id)}><Trash2 size={16}/></button></div>; }
function SettingsPage({email}) { return <div className="panel settings-card"><h2>Impostazioni del progetto</h2><p>Il tuo account è autenticato e le attività vengono salvate nel database Supabase.</p><div className="settings-line"><div><b>Account personale</b><small>{email}</small></div><span className="status-active">Attivo</span></div><div className="settings-line"><div><b>Database cloud</b><small>Archivio personale protetto da policy RLS</small></div><span className="status-active">Collegato</span></div><div className="settings-line"><div><b>Sincronizzazione Garmin e Strava</b><small>OAuth e importazione da sviluppare</small></div><span className="status-pending">Non attiva</span></div><div className="settings-line"><div><b>Pubblicazione GitHub Pages</b><small>Deploy tramite GitHub Actions</small></div><span className="status-active">Attiva</span></div></div>; }

createRoot(document.getElementById('root')).render(<App/>);
