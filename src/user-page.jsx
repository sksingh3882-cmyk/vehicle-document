import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './user-page.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const LOCAL_KEY = 'vehicle_document_expiry_app_supabase_v1';
const USER_KEY = 'vehicle_user_page_v1';
const CLOUD_ROW_ID = 'main';
const CATEGORIES = ['Bike', 'Car', 'Auto', 'Tempo', 'Mini Truck'];
const DOCS = ['Insurance', 'PUC', 'Fitness', 'Permit', 'Tax', 'RC'];

function safeParse(v, f) { try { return v ? JSON.parse(v) : f; } catch { return f; } }
function cleanMobile(v) { return String(v || '').replace(/\D/g, '').slice(-10); }
function formatDate(v) { return v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date missing'; }
function daysLeft(v) { if (!v) return null; const today = new Date(); today.setHours(0,0,0,0); const d = new Date(v); d.setHours(0,0,0,0); return Math.ceil((d - today) / 86400000); }
function getStatus(v) { const d = daysLeft(v); if (d === null) return { text: 'Date missing', tone: 'neutral' }; if (d < 0) return { text: 'Expired ' + Math.abs(d) + ' days ago', tone: 'danger' }; if (d <= 30) return { text: d + ' days left', tone: 'warn' }; return { text: 'Valid - ' + d + ' days left', tone: 'ok' }; }
function readLocal() { const data = safeParse(localStorage.getItem(LOCAL_KEY), []); return Array.isArray(data) ? data : []; }
function saveLocal(v) { localStorage.setItem(LOCAL_KEY, JSON.stringify(v)); }
async function loadVehicles() { const local = readLocal(); if (!supabase) return local; const { data, error } = await supabase.from('vehicles').select('data').eq('id', CLOUD_ROW_ID).maybeSingle(); if (error) return local; const cloud = Array.isArray(data?.data?.vehicles) ? data.data.vehicles : local; saveLocal(cloud); return cloud; }
async function saveVehicles(v) { saveLocal(v); if (!supabase) return false; const { error } = await supabase.from('vehicles').upsert({ id: CLOUD_ROW_ID, data: { vehicles: v }, updated_at: new Date().toISOString() }); return !error; }
function pdfReport(user, vehicle) { const rows = (vehicle.docs || []).map((d) => { const s = getStatus(d.expiryDate); return '<tr><td>' + d.name + '</td><td>' + formatDate(d.expiryDate) + '</td><td>' + s.text + '</td></tr>'; }).join(''); const w = window.open('', '_blank'); if (!w) return alert('Popup blocked'); w.document.write('<!doctype html><html><head><title>Vehicle Report</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:Arial,sans-serif;padding:18px;color:#0f172a}h1{color:#2563eb}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:10px;text-align:left}th{background:#eff6ff}button{background:#2563eb;color:white;border:0;border-radius:10px;padding:12px 16px;font-weight:bold}</style></head><body><h1>Vehicle Document Report</h1><p><b>Name:</b> '+user.name+'<br><b>Mobile:</b> '+user.mobile+'<br><b>Vehicle:</b> '+vehicle.vehicleNo+'</p><table><thead><tr><th>Document</th><th>Date</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table><br><button onclick="window.print()">Download / Save PDF</button></body></html>'); w.document.close(); }

function UserPage() {
  const [user, setUser] = useState(() => safeParse(localStorage.getItem(USER_KEY), null));
  const [vehicles, setVehicles] = useState([]);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState({ category: 'Car', vehicleNo: '', model: '' });
  const [docs, setDocs] = useState(DOCS.map((name) => ({ name, expiryDate: '' })));

  useEffect(() => { loadVehicles().then(setVehicles); }, []);
  const myVehicles = useMemo(() => user ? vehicles.filter((v) => cleanMobile(v.mobile) === cleanMobile(user.mobile)) : [], [vehicles, user]);
  const setField = (field, value) => setForm((old) => ({ ...old, [field]: field === 'vehicleNo' ? value.toUpperCase() : value }));
  const setDocDate = (index, value) => setDocs((old) => old.map((d, i) => i === index ? { ...d, expiryDate: value } : d));

  function login(e) { e.preventDefault(); const name = e.target.name.value.trim(); const mobile = cleanMobile(e.target.mobile.value); if (!name || mobile.length !== 10) return alert('Name aur 10 digit mobile number enter karo'); const next = { name, mobile }; localStorage.setItem(USER_KEY, JSON.stringify(next)); setUser(next); }
  async function submit() { const vehicle = { id: 'user-' + Date.now(), source: 'user-page', submittedBy: user.name, category: form.category, vehicleNo: form.vehicleNo.trim().toUpperCase(), model: form.model.trim(), owner: user.name, mobile: user.mobile, docs, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; const next = [vehicle, ...vehicles]; setMsg('Saving...'); const ok = await saveVehicles(next); setVehicles(next); setPreview(false); setForm({ category: 'Car', vehicleNo: '', model: '' }); setDocs(DOCS.map((name) => ({ name, expiryDate: '' }))); setMsg(ok ? 'Submitted successfully. Admin page me save ho gaya.' : 'Saved locally. Internet/Supabase check karo.'); }

  if (!user) return <div className="upPage"><a className="upAdmin" href="/admin">Admin Login</a><div className="upCard upLogin"><div className="upBadge">User Page</div><h1>Vehicle Document Validity</h1><p className="upText">Name aur mobile number se login/register karein.</p><form onSubmit={login}><input className="upInput" name="name" placeholder="Your Name" /><input className="upInput" name="mobile" placeholder="Mobile Number" inputMode="numeric" /><button className="upBtn">Continue</button></form></div></div>;

  return <div className="upPage"><a className="upAdmin" href="/admin">Admin Login</a><header className="upHero"><div><div className="upBadge">User Page</div><h1>Welcome, {user.name}</h1><p className="upText">{user.mobile}</p></div><button className="upBtn" onClick={() => { localStorage.removeItem(USER_KEY); setUser(null); }}>Logout</button></header>{msg && <div className="upStatus">{msg}</div>}<main className="upStack"><section className="upCard"><h2>Add Vehicle Details</h2><select className="upSelect" value={form.category} onChange={(e) => setField('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select><input className="upInput" placeholder="Vehicle No. JH05AB1234" value={form.vehicleNo} onChange={(e) => setField('vehicleNo', e.target.value)} /><input className="upInput" placeholder="Vehicle Model" value={form.model} onChange={(e) => setField('model', e.target.value)} /><label className="upFile">mParivahan Screenshot<input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => e.target.files?.[0] && setMsg('Screenshot selected: ' + e.target.files[0].name)} /></label><div className="upDocGrid">{docs.map((d, i) => <label className="upDoc" key={d.name}>{d.name}<input className="upInput" type="date" value={d.expiryDate} onChange={(e) => setDocDate(i, e.target.value)} /></label>)}</div><button className="upBtn" onClick={() => form.vehicleNo.trim() ? setPreview(true) : alert('Vehicle number enter karo')}>Preview</button></section><section className="upCard"><h2>My Vehicles</h2>{myVehicles.length === 0 ? <p className="upText">No vehicle submitted yet.</p> : myVehicles.map((v) => <div className="upVehicle" key={v.id}><b>{v.vehicleNo} - {v.model || v.category}</b>{(v.docs || []).map((d) => { const s = getStatus(d.expiryDate); return <div className="upDocRow" key={d.name}><span>{d.name}</span><span>{formatDate(d.expiryDate)}</span><span className={'upPill ' + s.tone}>{s.text}</span></div>; })}<button className="upBtn" onClick={() => pdfReport(user, v)}>Download PDF</button></div>)}</section></main>{preview && <div className="upModal"><div className="upCard"><h2>Preview & Confirm</h2><p className="upText"><b>{form.vehicleNo}</b> - {form.model || form.category}</p>{docs.map((d) => { const s = getStatus(d.expiryDate); return <div className="upDocRow" key={d.name}><span>{d.name}</span><span>{formatDate(d.expiryDate)}</span><span className={'upPill ' + s.tone}>{s.text}</span></div>; })}<button className="upBtn" onClick={submit}>Confirm & Submit</button> <button className="upBtn upBtnLight" onClick={() => setPreview(false)}>Back</button></div></div>}</div>;
}

createRoot(document.getElementById('root')).render(<UserPage />);
