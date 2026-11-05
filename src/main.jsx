import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Bike, CalendarDays, ChartNoAxesCombined, ChevronRight, Clock3, Dumbbell, Footprints, Gauge, LayoutDashboard, Plus, Search, Settings, Upload, UserRound, Waves } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './style.css';

const initialActivities = [
  { id: 1, date: '2026-11-04', type: 'Ciclismo', title: 'Uscita gravel', source: 'Garmin', duration: '2h 18m', distance: '54,8 km', elevation: '620 m', icon: Bike },
  { id: 2, date: '2026-11-03', type: 'Palestra', title: 'Full Body A', source: 'Manuale', duration: '58 min', distance: '—', elevation: '—', icon: Dumbbell },
  { id: 3, date: '2026-11-01', type: 'Running', title: 'Corsa facile', source: 'Strava', duration: '42 min', distance: '7,2 km', elevation: '48 m', icon: Footprints },
  { id: 4, date: '2026-10-30', type: 'Ciclismo', title: 'Allenamento endurance', source: 'Garmin', duration: '1h 46m', distance: '41,3 km', elevation: '390 m', icon: Bike },
];
const trend = [{day:'Lun',value:0},{day:'Mar',value:58},{day:'Mer',value:0},{day:'Gio',value:72},{day:'Ven',value:0},{day:'Sab',value:145},{day:'Dom',value:42}];
const nav = [
  {label:'Panoramica', icon:LayoutDashboard}, {label:'Registro attività', icon:Activity}, {label:'Calendario', icon:CalendarDays},
  {label:'Palestra', icon:Dumbbell}, {label:'Running', icon:Footprints}, {label:'Ciclismo', icon:Bike}, {label:'Statistiche', icon:ChartNoAxesCombined}, {label:'Impostazioni', icon:Settings}
];
function App(){
  const [active,setActive]=useState('Panoramica');
  const [activities,setActivities]=useState(initialActivities);
  const [query,setQuery]=useState('');
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({title:'',type:'Running',date:'2026-11-05',duration:'',distance:''});
  const filtered=useMemo(()=>activities.filter(a=>(active==='Registro attività'||active==='Panoramica'||active==='Calendario'||active==='Statistiche'||active==='Impostazioni'||a.type===active)&&`${a.title} ${a.type} ${a.source}`.toLowerCase().includes(query.toLowerCase())),[activities,active,query]);
  const addActivity=(e)=>{e.preventDefault();setActivities([{id:Date.now(),...form,source:'Manuale',elevation:'—',icon:form.type==='Ciclismo'?Bike:form.type==='Palestra'?Dumbbell:Footprints},...activities]);setShowForm(false);setForm({title:'',type:'Running',date:'2026-11-05',duration:'',distance:''});setActive('Registro attività');};
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Activity size={21}/></div><div><b>MY TRAINING</b><small>PERSONAL FITNESS HUB</small></div></div>
      <div className="nav-caption">WORKSPACE</div><nav>{nav.map(({label,icon:Icon})=><button key={label} className={`nav-item ${active===label?'selected':''}`} onClick={()=>setActive(label)}><Icon size={18}/><span>{label}</span>{label==='Registro attività'&&<span className="nav-count">{activities.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><div className="avatar"><UserRound size={18}/></div><div><b>Area personale</b><small>Account privato</small></div></div><div className="private-note">I tuoi dati, in un unico posto.</div></div>
    </aside>
    <main className="main"><header className="topbar"><div className="breadcrumb">My Training <ChevronRight size={14}/> <b>{active}</b></div><div className="top-actions"><span className="sync"><span className="dot"/> Demo locale</span><button className="icon-button" aria-label="Impostazioni" onClick={()=>setActive('Impostazioni')}><Settings size={18}/></button></div></header>
      <div className="content"><div className="page-heading"><div><div className="eyebrow">IL TUO PERCORSO, SOTTO CONTROLLO</div><h1>{active==='Panoramica'?'Buongiorno, Rikardo':active}</h1><p>Monitora le attività, consulta lo storico e segui i tuoi progressi.</p></div><button className="primary-button" onClick={()=>setShowForm(true)}><Plus size={17}/> Registra attività</button></div>
      {active==='Impostazioni'?<SettingsPage/>:<>
        <section className="stats-grid">
          <Stat icon={Activity} label="Attività registrate" value={activities.length} foot="Nel registro demo"/>
          <Stat icon={Clock3} label="Tempo questa settimana" value="5h 43m" foot="Dato dimostrativo"/>
          <Stat icon={Gauge} label="Distanza settimanale" value="103,3 km" foot="Corsa + ciclismo · demo"/>
          <Stat icon={Waves} label="Dislivello positivo" value="1.058 m" foot="Dato dimostrativo"/>
        </section>
        {active==='Panoramica'&&<section className="two-col"><div className="panel chart-panel"><div className="panel-heading"><div><h2>Attività della settimana</h2><p>Durata registrata, in minuti</p></div><span className="period">Ultimi 7 giorni</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6d8cff" stopOpacity={0.28}/><stop offset="100%" stopColor="#6d8cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#263248"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:12}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8290a6',fontSize:12}} width={32}/><Tooltip contentStyle={{background:'#172235',border:'1px solid #2a3850',borderRadius:10,color:'#fff'}}/><Area type="monotone" dataKey="value" stroke="#829aff" strokeWidth={2.5} fill="url(#fill)"/></AreaChart></ResponsiveContainer></div></div><div className="panel import-panel"><div className="panel-heading"><div><h2>Collega le piattaforme</h2><p>Importa le tue attività sportive</p></div><Upload size={19}/></div><Integration name="Garmin Connect" desc="Attività, dati e metriche" color="garmin"/><Integration name="Strava" desc="Corsa, ciclismo e percorsi" color="strava"/><div className="integration-foot">Le connessioni saranno attivate in una fase successiva.</div></div></section>}
        <section className="panel activity-panel"><div className="panel-heading activity-heading"><div><h2>{active==='Panoramica'?'Attività recenti':active==='Calendario'?'Storico attività':active==='Statistiche'?'Attività analizzate':'Registro attività'}</h2><p>Consulta e cerca gli allenamenti registrati</p></div><div className="search-wrap"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca attività..."/></div></div>
          <div className="activity-list">{filtered.length?filtered.map(a=><ActivityRow key={a.id} item={a}/>):<div className="empty">Nessuna attività trovata.</div>}</div><div className="panel-footer">Visualizzate {filtered.length} attività <button onClick={()=>setActive('Registro attività')}>Apri registro completo <ChevronRight size={15}/></button></div></section>
      </>}
      <footer>MY TRAINING <span>·</span> Prima versione dimostrativa · I dati mostrati sono di esempio</footer></div>
    </main>
    {showForm&&<div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="modal" onSubmit={addActivity} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">NUOVA REGISTRAZIONE</div><h2>Registra attività</h2></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)}>✕</button></div><label>Nome attività<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Es. Corsa al parco"/></label><div className="form-row"><label>Tipologia<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Running</option><option>Ciclismo</option><option>Palestra</option></select></label><label>Data<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label></div><div className="form-row"><label>Durata<input value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} placeholder="Es. 45 min"/></label><label>Distanza<input value={form.distance} onChange={e=>setForm({...form,distance:e.target.value})} placeholder="Es. 8 km"/></label></div><button className="primary-button full" type="submit">Salva attività</button></form></div>}
  </div>
}
function Stat({icon:Icon,label,value,foot}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{foot}</small></div>}
function Integration({name,desc,color}){return <div className="integration"><div className={`integration-logo ${color}`}>{color==='garmin'?'G':'S'}</div><div className="integration-text"><b>{name}</b><small>{desc}</small></div><span className="not-connected">Non collegato</span></div>}
function ActivityRow({item:a}){const Icon=a.icon||Activity;return <div className="activity-row"><div className={`activity-icon ${a.type.toLowerCase()}`}><Icon size={19}/></div><div className="activity-main"><b>{a.title}</b><small>{new Date(a.date+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})} <span>·</span> {a.type}</small></div><div className="activity-metric"><b>{a.distance}</b><small>Distanza</small></div><div className="activity-metric"><b>{a.duration||'—'}</b><small>Durata</small></div><div className="source-tag">{a.source}</div><ChevronRight className="row-arrow" size={17}/></div>}
function SettingsPage(){return <div className="panel settings-card"><h2>Impostazioni del progetto</h2><p>Questa prima versione è una demo frontend: i dati sono temporanei e restano nel browser solo durante la sessione.</p><div className="settings-line"><div><b>Autenticazione privata</b><small>Da configurare con Supabase Auth</small></div><span className="status-pending">Da configurare</span></div><div className="settings-line"><div><b>Database cloud</b><small>Archivio personale con policy di accesso</small></div><span className="status-pending">Da configurare</span></div><div className="settings-line"><div><b>Sincronizzazione Garmin e Strava</b><small>OAuth e funzioni server-side</small></div><span className="status-pending">Da configurare</span></div><div className="settings-line"><div><b>Pubblicazione GitHub Pages</b><small>Deploy tramite GitHub Actions</small></div><span className="status-pending">Da configurare</span></div></div>}

createRoot(document.getElementById('root')).render(<App/>);
