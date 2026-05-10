import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import './style.css';

const firebaseConfig = {
  apiKey: 'AIzaSyBgpT7D9-mgQg-TLS5SHA2LaSlqp6-EBEc',
  authDomain: 'vehicle-document-c23e2.firebaseapp.com',
  projectId: 'vehicle-document-c23e2',
  storageBucket: 'vehicle-document-c23e2.firebasestorage.app',
  messagingSenderId: '620277943671',
  appId: '1:620277943671:web:8246b0d76605142ffe2572'
};

const db = getFirestore(initializeApp(firebaseConfig));
const cloudDocRef = doc(db, 'vehicleData', 'main');
const LOCAL_KEY = 'vehicle_document_expiry_app_v3';
const OLD_LOCAL_KEYS = ['vehicle_document_expiry_app_v2', 'vehicle_document_expiry_app'];
const defaultDocs = ['Insurance', 'PUC', 'Fitness', 'Permit', 'Tax', 'RC'].map((name) => ({ name, expiryDate: '' }));

function safeParse(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function cleanVehicle(vehicle) {
  return {
    id: vehicle.id || String(Date.now()) + '-' + Math.random().toString(16).slice(2),
    vehicleNo: (vehicle.vehicleNo || '').trim().toUpperCase(),
    model: vehicle.model || '',
    owner: vehicle.owner || '',
    mobile: vehicle.mobile || '',
    docs: Array.isArray(vehicle.docs) && vehicle.docs.length ? vehicle.docs.map((item) => ({ name: item.name || 'Document', expiryDate: item.expiryDate || '' })) : defaultDocs.map((item) => ({ ...item })),
    createdAt: vehicle.createdAt || new Date().toISOString(),
    updatedAt: vehicle.updatedAt || new Date().toISOString()
  };
}
function loadLocalVehicles() {
  const current = safeParse(localStorage.getItem(LOCAL_KEY), null);
  if (Array.isArray(current)) return current.map(cleanVehicle);
  for (const key of OLD_LOCAL_KEYS) {
    const oldData = safeParse(localStorage.getItem(key), null);
    if (Array.isArray(oldData)) {
      const migrated = oldData.map(cleanVehicle);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }
  return [];
}
function saveLocalVehicles(vehicles) { localStorage.setItem(LOCAL_KEY, JSON.stringify(vehicles)); }
function mergeVehicles(localVehicles, cloudVehicles) {
  const map = new Map();
  [...cloudVehicles, ...localVehicles].map(cleanVehicle).forEach((vehicle) => {
    const key = vehicle.id || vehicle.vehicleNo;
    const old = map.get(key);
    if (!old) return map.set(key, vehicle);
    const oldTime = new Date(old.updatedAt || old.createdAt || 0).getTime();
    const newTime = new Date(vehicle.updatedAt || vehicle.createdAt || 0).getTime();
    map.set(key, newTime >= oldTime ? vehicle : old);
  });
  return Array.from(map.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
function daysLeft(dateString) {
  if (!dateString) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateString); expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / 86400000);
}
function formatDate(dateString) { return dateString ? new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date missing'; }
function getStatus(expiryDate) {
  const days = daysLeft(expiryDate);
  if (days === null) return { label: 'Date missing', tone: 'neutral', urgent: false, rank: 4 };
  if (days < 0) return { label: 'Expired ' + Math.abs(days) + ' days ago', tone: 'danger', urgent: true, rank: 0 };
  if (days === 0) return { label: 'Expires today', tone: 'danger', urgent: true, rank: 1 };
  if (days <= 7) return { label: days + ' days left', tone: 'orange', urgent: true, rank: 2 };
  if (days <= 30) return { label: days + ' days left', tone: 'yellow', urgent: true, rank: 3 };
  return { label: days + ' days left', tone: 'green', urgent: false, rank: 5 };
}
function urgentDocs(vehicle) { return (vehicle.docs || []).filter((item) => getStatus(item.expiryDate).urgent); }
function validDocs(vehicle) { return (vehicle.docs || []).filter((item) => { const d = daysLeft(item.expiryDate); return d !== null && d > 30; }); }
function whatsappNumber(number) { const digits = (number || '').replace(/\D/g, ''); return !digits ? '' : digits.length === 10 ? '91' + digits : digits; }
function buildWhatsAppText(vehicle) {
  const docs = urgentDocs(vehicle).length ? urgentDocs(vehicle) : (vehicle.docs || []);
  const details = docs.map((item) => item.name + ': ' + formatDate(item.expiryDate) + ' (' + getStatus(item.expiryDate).label + ')').join('\n');
  return 'Vehicle Document Alert\n' +
    (vehicle.owner || 'Vehicle Owner') + '\n' +
    'Vehicle Model "' + (vehicle.model || vehicle.vehicleNo || 'Name') + '"\n\n' +
    'Your vehicle Validation is\n' +
    'Vehicle validation details\n' +
    (details || 'No document date added.') + '\n\n' +
    'Please Renew your vehicle Document Soon to Avoid Any Type of Penalty';
}

function App() {
  const [vehicles, setVehicles] = useState(loadLocalVehicles);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('Connecting cloud...');
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ vehicleNo: '', model: '', owner: '', mobile: '' });
  const remoteUpdateRef = useRef(false);
  const saveTimerRef = useRef(null);
  const firstCloudLoadRef = useRef(true);

  async function saveCloud(nextVehicles, label = 'Cloud synced') {
    setCloudStatus('Saving to cloud...');
    try {
      await setDoc(cloudDocRef, { vehicles: nextVehicles.map(cleanVehicle), updatedAt: serverTimestamp() }, { merge: true });
      setCloudReady(true);
      setCloudStatus(label + ' • ' + nextVehicles.length + ' vehicle');
      return true;
    } catch (error) {
      setCloudStatus('Cloud save failed: ' + (error.code || error.message || 'unknown'));
      return false;
    }
  }

  useEffect(() => {
    const unsubscribe = onSnapshot(cloudDocRef, async (snapshot) => {
      const localVehicles = loadLocalVehicles();
      if (snapshot.exists()) {
        const cloudVehicles = (snapshot.data().vehicles || []).map(cleanVehicle);
        const merged = mergeVehicles(localVehicles, cloudVehicles);
        remoteUpdateRef.current = true;
        setVehicles(merged);
        saveLocalVehicles(merged);
        setCloudReady(true);
        setCloudStatus('Cloud synced • ' + merged.length + ' vehicle');
        if (JSON.stringify(merged) !== JSON.stringify(cloudVehicles)) await saveCloud(merged, 'Cloud merged');
      } else {
        setCloudReady(true);
        setCloudStatus('Cloud ready • ' + localVehicles.length + ' vehicle');
        if (localVehicles.length) await saveCloud(localVehicles, 'Cloud created');
      }
      firstCloudLoadRef.current = false;
    }, (error) => {
      setCloudReady(false);
      setCloudStatus('Cloud error: ' + (error.code || error.message || 'unknown'));
      firstCloudLoadRef.current = false;
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    saveLocalVehicles(vehicles);
    if (remoteUpdateRef.current) { remoteUpdateRef.current = false; return; }
    if (!cloudReady || firstCloudLoadRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveCloud(vehicles), 650);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [vehicles, cloudReady]);

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...vehicles].sort((a, b) => urgentDocs(b).length - urgentDocs(a).length || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return q ? list.filter((vehicle) => [vehicle.vehicleNo, vehicle.model, vehicle.owner, vehicle.mobile].some((item) => (item || '').toLowerCase().includes(q))) : list;
  }, [vehicles, query]);
  const allAlerts = useMemo(() => vehicles.flatMap((vehicle) => urgentDocs(vehicle).map((docItem) => ({ vehicle, docItem, status: getStatus(docItem.expiryDate) }))).sort((a, b) => a.status.rank - b.status.rank), [vehicles]);
  const totalAlerts = allAlerts.length;
  const touchVehicle = (vehicle) => ({ ...vehicle, updatedAt: new Date().toISOString() });

  function addVehicle(event) {
    event.preventDefault();
    if (!form.vehicleNo.trim()) return alert('Enter vehicle number');
    if (vehicles.some((item) => item.vehicleNo.toLowerCase() === form.vehicleNo.trim().toLowerCase()) && !confirm('This vehicle already exists. Add again?')) return;
    const newVehicle = cleanVehicle({ id: String(Date.now()) + '-' + Math.random().toString(16).slice(2), vehicleNo: form.vehicleNo, model: form.model.trim(), owner: form.owner.trim(), mobile: form.mobile.trim(), docs: defaultDocs.map((item) => ({ ...item })) });
    const next = [newVehicle, ...vehicles];
    setVehicles(next); setSelectedId(newVehicle.id); setForm({ vehicleNo: '', model: '', owner: '', mobile: '' }); saveCloud(next, 'Cloud synced');
  }
  function removeVehicle(id) { if (confirm('Delete this vehicle?')) setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== id)); if (selectedId === id) setSelectedId(null); }
  function updateVehicle(vehicleId, field, value) { setVehicles((prev) => prev.map((vehicle) => vehicle.id === vehicleId ? touchVehicle({ ...vehicle, [field]: field === 'vehicleNo' ? value.toUpperCase() : value }) : vehicle)); }
  function updateDoc(vehicleId, index, field, value) { setVehicles((prev) => prev.map((vehicle) => { if (vehicle.id !== vehicleId) return vehicle; const docs = [...(vehicle.docs || [])]; docs[index] = { ...docs[index], [field]: value }; return touchVehicle({ ...vehicle, docs }); })); }
  function addCustomDoc(vehicleId) { setVehicles((prev) => prev.map((vehicle) => vehicle.id === vehicleId ? touchVehicle({ ...vehicle, docs: [...(vehicle.docs || []), { name: 'New Document', expiryDate: '' }] }) : vehicle)); }
  function removeDoc(vehicleId, index) { setVehicles((prev) => prev.map((vehicle) => vehicle.id === vehicleId ? touchVehicle({ ...vehicle, docs: (vehicle.docs || []).filter((_, i) => i !== index) }) : vehicle)); }
  function sendWhatsApp(vehicle) { const inputNumber = window.prompt('Enter WhatsApp number. Blank rakhenge to contact select hoga.', vehicle.mobile || ''); if (inputNumber === null) return; const number = whatsappNumber(inputNumber); const url = (number ? 'https://wa.me/' + number : 'https://wa.me/') + '?text=' + encodeURIComponent(buildWhatsAppText(vehicle)); window.open(url, '_blank', 'noopener,noreferrer'); }
  function shareAllAlerts() { const text = totalAlerts ? allAlerts.map(({ vehicle, docItem }) => vehicle.vehicleNo + ' - ' + (vehicle.model || 'Model not added') + ' - ' + docItem.name + ': ' + formatDate(docItem.expiryDate) + ' (' + getStatus(docItem.expiryDate).label + ')').join('\n') : 'No urgent vehicle document alerts.'; window.open('https://wa.me/?text=' + encodeURIComponent('Vehicle Document Alerts\n\n' + text), '_blank', 'noopener,noreferrer'); }

  return <div className="page">
    <header className="hero"><div><div className="badge">Vehicle Document Alert</div><h1>Vehicle Document Tracker</h1><p>Local save + Firebase cloud sync + WhatsApp alert share.</p><p className={cloudStatus.includes('failed') || cloudStatus.includes('error') ? 'cloudStatus warn' : 'cloudStatus'}>{cloudStatus}</p><button className="syncBtn" onClick={() => saveCloud(vehicles, 'Manual cloud sync')}>Sync Now</button></div><button className="alertBox" onClick={shareAllAlerts}><span>Total Alerts</span><strong>{totalAlerts}</strong></button></header>
    <section className="grid"><form className="card addCard" onSubmit={addVehicle}><h2>Add Vehicle</h2><input placeholder="Vehicle No. JH05AB1234" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value.toUpperCase() })} /><input placeholder="Vehicle Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /><input placeholder="Owner / Driver Name" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /><input placeholder="WhatsApp Mobile" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /><button>Add Vehicle</button></form><div className="card selectedAlerts"><div className="sectionHead"><h2>Expiry Alerts</h2><button className="ghostBtn" onClick={shareAllAlerts}>Share</button></div>{totalAlerts === 0 ? <div className="ok">No urgent alerts.</div> : allAlerts.map(({ vehicle, docItem, status }, index) => <div className="alertItem" key={vehicle.id + docItem.name + index}><div><b>{vehicle.vehicleNo} - {vehicle.model || 'Model not added'} - {docItem.name}</b><small>{formatDate(docItem.expiryDate)}</small></div><span className={'pill ' + status.tone}>{status.label}</span></div>)}</div></section>
    <section className="card vehiclesTop"><h2>Vehicles ({filteredVehicles.length})</h2><div className="search"><span>Search</span><input placeholder="Vehicle / model / owner / mobile" value={query} onChange={(e) => setQuery(e.target.value)} /></div></section>
    <main>{filteredVehicles.length === 0 ? <div className="card empty"><b>No vehicle added.</b><span>Add your first vehicle from the form above.</span></div> : filteredVehicles.map((vehicle) => { const open = selectedId === vehicle.id; return <div key={vehicle.id} className={'card vehicleCard ' + (open ? 'activeVehicle' : '')}><div className="vehicleRow" onClick={() => setSelectedId(open ? null : vehicle.id)}><div className="vehicleMain"><div><h2>{vehicle.vehicleNo}</h2><p>{vehicle.model ? vehicle.model + ' • ' : ''}{vehicle.owner || 'Owner not added'} {vehicle.mobile ? '• ' + vehicle.mobile : ''}</p></div></div><div className="vehicleStats"><span className="miniBadge danger">{urgentDocs(vehicle).length} Alert</span><span className="miniBadge green">{validDocs(vehicle).length} Valid</span></div></div><div className="vehicleActions"><button className="waBtn" onClick={(e) => { e.stopPropagation(); sendWhatsApp(vehicle); }}>WhatsApp</button><button className="remove smallRemove" onClick={(e) => { e.stopPropagation(); removeVehicle(vehicle.id); }}>Delete</button></div>{open && <><div className="editVehicle"><input value={vehicle.vehicleNo} onChange={(e) => updateVehicle(vehicle.id, 'vehicleNo', e.target.value)} /><input placeholder="Vehicle Model" value={vehicle.model || ''} onChange={(e) => updateVehicle(vehicle.id, 'model', e.target.value)} /><input placeholder="Owner / Driver Name" value={vehicle.owner} onChange={(e) => updateVehicle(vehicle.id, 'owner', e.target.value)} /><input placeholder="WhatsApp Mobile" inputMode="tel" value={vehicle.mobile} onChange={(e) => updateVehicle(vehicle.id, 'mobile', e.target.value)} /></div><div className="docs">{(vehicle.docs || []).map((docItem, index) => { const status = getStatus(docItem.expiryDate); return <div className="doc" key={docItem.name + index}><div className="docTitle"><input value={docItem.name} onChange={(e) => updateDoc(vehicle.id, index, 'name', e.target.value)} /><button onClick={() => removeDoc(vehicle.id, index)}>Delete</button></div><input type="date" value={docItem.expiryDate} onChange={(e) => updateDoc(vehicle.id, index, 'expiryDate', e.target.value)} /><span className={'pill ' + status.tone}>{status.label}</span></div>; })}</div><button className="custom" onClick={() => addCustomDoc(vehicle.id)}>+ Add Custom Document</button></>}</div>; })}</main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
