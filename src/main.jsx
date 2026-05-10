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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const cloudDocRef = doc(db, 'vehicleData', 'main');
const LOCAL_KEY = 'vehicle_document_expiry_app_v3';
const OLD_LOCAL_KEYS = ['vehicle_document_expiry_app_v2', 'vehicle_document_expiry_app'];

const defaultDocs = [
  { name: 'Insurance', expiryDate: '' },
  { name: 'PUC', expiryDate: '' },
  { name: 'Fitness', expiryDate: '' },
  { name: 'Permit', expiryDate: '' },
  { name: 'Tax', expiryDate: '' },
  { name: 'RC', expiryDate: '' }
];

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function cleanVehicle(vehicle) {
  return {
    id: vehicle.id || String(Date.now()) + '-' + Math.random().toString(16).slice(2),
    vehicleNo: (vehicle.vehicleNo || '').trim().toUpperCase(),
    owner: vehicle.owner || '',
    mobile: vehicle.mobile || '',
    docs: Array.isArray(vehicle.docs) && vehicle.docs.length ? vehicle.docs.map((item) => ({
      name: item.name || 'Document',
      expiryDate: item.expiryDate || ''
    })) : defaultDocs.map((item) => ({ ...item })),
    createdAt: vehicle.createdAt || new Date().toISOString(),
    updatedAt: vehicle.updatedAt || new Date().toISOString()
  };
}

function vehicleKey(vehicle) {
  return vehicle.id || vehicle.vehicleNo;
}

function mergeVehicles(localVehicles, cloudVehicles) {
  const merged = new Map();
  [...cloudVehicles, ...localVehicles].map(cleanVehicle).forEach((vehicle) => {
    const key = vehicleKey(vehicle);
    const old = merged.get(key);
    if (!old) {
      merged.set(key, vehicle);
      return;
    }
    const oldTime = new Date(old.updatedAt || old.createdAt || 0).getTime();
    const newTime = new Date(vehicle.updatedAt || vehicle.createdAt || 0).getTime();
    merged.set(key, newTime >= oldTime ? vehicle : old);
  });
  return Array.from(merged.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
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

function saveLocalVehicles(vehicles) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(vehicles));
}

function daysLeft(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateString);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / 86400000);
}

function formatDate(dateString) {
  if (!dateString) return 'Date missing';
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatus(expiryDate) {
  const days = daysLeft(expiryDate);
  if (days === null) return { label: 'Date missing', tone: 'neutral', urgent: false, rank: 4 };
  if (days < 0) return { label: 'Expired ' + Math.abs(days) + ' days ago', tone: 'danger', urgent: true, rank: 0 };
  if (days === 0) return { label: 'Expires today', tone: 'danger', urgent: true, rank: 1 };
  if (days <= 7) return { label: days + ' days left', tone: 'orange', urgent: true, rank: 2 };
  if (days <= 30) return { label: days + ' days left', tone: 'yellow', urgent: true, rank: 3 };
  return { label: days + ' days left', tone: 'green', urgent: false, rank: 5 };
}

function urgentDocs(vehicle) {
  return (vehicle.docs || []).filter((item) => getStatus(item.expiryDate).urgent);
}

function validDocs(vehicle) {
  return (vehicle.docs || []).filter((item) => {
    const d = daysLeft(item.expiryDate);
    return d !== null && d > 30;
  });
}

function whatsappNumber(number) {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? '91' + digits : digits;
}

function buildWhatsAppText(vehicle, onlyAlerts = true) {
  const docsToSend = onlyAlerts && urgentDocs(vehicle).length ? urgentDocs(vehicle) : (vehicle.docs || []);
  const lines = docsToSend
    .map((item) => '• ' + item.name + ': ' + formatDate(item.expiryDate) + ' (' + getStatus(item.expiryDate).label + ')')
    .join('\n');

  return 'Vehicle Document Alert\n\nVehicle: ' + vehicle.vehicleNo +
    '\nOwner: ' + (vehicle.owner || 'Not added') +
    (vehicle.mobile ? '\nMobile: ' + vehicle.mobile : '') +
    '\n\n' + (lines || 'No document date added.') +
    '\n\nPlease renew or verify documents.';
}

function App() {
  const [vehicles, setVehicles] = useState(loadLocalVehicles);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('Connecting cloud...');
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ vehicleNo: '', owner: '', mobile: '' });
  const remoteUpdateRef = useRef(false);
  const saveTimerRef = useRef(null);
  const firstCloudLoadRef = useRef(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      cloudDocRef,
      async (snapshot) => {
        const localVehicles = loadLocalVehicles();
        if (snapshot.exists()) {
          const cloudVehicles = (snapshot.data().vehicles || []).map(cleanVehicle);
          const mergedVehicles = mergeVehicles(localVehicles, cloudVehicles);
          remoteUpdateRef.current = true;
          setVehicles(mergedVehicles);
          saveLocalVehicles(mergedVehicles);
          setCloudStatus('Cloud synced • ' + mergedVehicles.length + ' vehicle');
          if (JSON.stringify(mergedVehicles) !== JSON.stringify(cloudVehicles)) {
            await setDoc(cloudDocRef, { vehicles: mergedVehicles, updatedAt: serverTimestamp() }, { merge: true });
          }
        } else {
          if (localVehicles.length > 0) {
            await setDoc(cloudDocRef, { vehicles: localVehicles, updatedAt: serverTimestamp() }, { merge: true });
          }
          setCloudStatus('Cloud ready • ' + localVehicles.length + ' vehicle');
        }
        setCloudReady(true);
        firstCloudLoadRef.current = false;
      },
      (error) => {
        setCloudStatus('Cloud error: ' + (error.code || 'local save active'));
        setCloudReady(false);
        firstCloudLoadRef.current = false;
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    saveLocalVehicles(vehicles);

    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      return;
    }

    if (!cloudReady || firstCloudLoadRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    setCloudStatus('Saving to cloud...');
    saveTimerRef.current = setTimeout(() => {
      setDoc(cloudDocRef, { vehicles, updatedAt: serverTimestamp() }, { merge: true })
        .then(() => setCloudStatus('Cloud synced • ' + vehicles.length + ' vehicle'))
        .catch((error) => setCloudStatus('Cloud save failed: ' + (error.code || 'local data safe')));
    }, 650);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [vehicles, cloudReady]);

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...vehicles].sort((a, b) => urgentDocs(b).length - urgentDocs(a).length || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (!q) return list;
    return list.filter((vehicle) =>
      [vehicle.vehicleNo, vehicle.owner, vehicle.mobile].some((item) => (item || '').toLowerCase().includes(q))
    );
  }, [vehicles, query]);

  const allAlerts = useMemo(() => vehicles.flatMap((vehicle) => urgentDocs(vehicle).map((docItem) => ({ vehicle, docItem, status: getStatus(docItem.expiryDate) }))).sort((a, b) => a.status.rank - b.status.rank), [vehicles]);
  const totalAlerts = allAlerts.length;

  function touchVehicle(vehicle) {
    return { ...vehicle, updatedAt: new Date().toISOString() };
  }

  function addVehicle(event) {
    event.preventDefault();
    if (!form.vehicleNo.trim()) return alert('Enter vehicle number');
    const exists = vehicles.some((item) => item.vehicleNo.toLowerCase() === form.vehicleNo.trim().toLowerCase());
    if (exists && !confirm('This vehicle already exists. Add again?')) return;

    const newVehicle = cleanVehicle({
      id: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
      vehicleNo: form.vehicleNo,
      owner: form.owner.trim(),
      mobile: form.mobile.trim(),
      docs: defaultDocs.map((item) => ({ ...item })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setVehicles((prev) => [newVehicle, ...prev]);
    setSelectedId(newVehicle.id);
    setForm({ vehicleNo: '', owner: '', mobile: '' });
  }

  function removeVehicle(id) {
    if (!confirm('Delete this vehicle?')) return;
    setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function updateVehicle(vehicleId, field, value) {
    setVehicles((prev) => prev.map((vehicle) => vehicle.id === vehicleId ? touchVehicle({ ...vehicle, [field]: field === 'vehicleNo' ? value.toUpperCase() : value }) : vehicle));
  }

  function updateDoc(vehicleId, index, field, value) {
    setVehicles((prev) => prev.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      const docs = [...(vehicle.docs || [])];
      docs[index] = { ...docs[index], [field]: value };
      return touchVehicle({ ...vehicle, docs });
    }));
  }

  function addCustomDoc(vehicleId) {
    setVehicles((prev) => prev.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      return touchVehicle({ ...vehicle, docs: [...(vehicle.docs || []), { name: 'New Document', expiryDate: '' }] });
    }));
  }

  function removeDoc(vehicleId, index) {
    setVehicles((prev) => prev.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      return touchVehicle({ ...vehicle, docs: (vehicle.docs || []).filter((_, i) => i !== index) });
    }));
  }

  function sendWhatsApp(vehicle) {
    const inputNumber = window.prompt('Enter WhatsApp number. Blank rakhenge to contact select hoga.', vehicle.mobile || '');
    if (inputNumber === null) return;
    const number = whatsappNumber(inputNumber);
    const text = buildWhatsAppText(vehicle, true);
    const url = number ? 'https://wa.me/' + number + '?text=' + encodeURIComponent(text) : 'https://wa.me/?text=' + encodeURIComponent(text);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function shareAllAlerts() {
    const text = totalAlerts ? allAlerts.map(({ vehicle, docItem }) => vehicle.vehicleNo + ' - ' + docItem.name + ': ' + formatDate(docItem.expiryDate) + ' (' + getStatus(docItem.expiryDate).label + ')').join('\n') : 'No urgent vehicle document alerts.';
    window.open('https://wa.me/?text=' + encodeURIComponent('Vehicle Document Alerts\n\n' + text), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <div className="badge">Vehicle Document Alert</div>
          <h1>Vehicle Document Tracker</h1>
          <p>Local save + Firebase cloud sync + WhatsApp alert share.</p>
          <p className={cloudStatus.includes('failed') || cloudStatus.includes('error') ? 'cloudStatus warn' : 'cloudStatus'}>{cloudStatus}</p>
        </div>
        <button className="alertBox" onClick={shareAllAlerts} title="Share all alerts on WhatsApp">
          <span>Total Alerts</span>
          <strong>{totalAlerts}</strong>
        </button>
      </header>

      <section className="grid">
        <form className="card addCard" onSubmit={addVehicle}>
          <h2>Add Vehicle</h2>
          <input placeholder="Vehicle No. JH05AB1234" value={form.vehicleNo} onChange={(event) => setForm({ ...form, vehicleNo: event.target.value.toUpperCase() })} />
          <input placeholder="Owner / Driver" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
          <input placeholder="WhatsApp Mobile" inputMode="tel" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
          <button>Add Vehicle</button>
        </form>

        <div className="card selectedAlerts">
          <div className="sectionHead"><h2>Expiry Alerts</h2><button className="ghostBtn" onClick={shareAllAlerts}>Share</button></div>
          {totalAlerts === 0 ? <div className="ok">No urgent alerts.</div> : allAlerts.map(({ vehicle, docItem, status }, index) => (
            <div className="alertItem" key={vehicle.id + docItem.name + index}>
              <div><b>{vehicle.vehicleNo} - {docItem.name}</b><small>{formatDate(docItem.expiryDate)}</small></div>
              <span className={'pill ' + status.tone}>{status.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card vehiclesTop">
        <h2>Vehicles ({filteredVehicles.length})</h2>
        <div className="search"><span>Search</span><input placeholder="Vehicle / owner / mobile" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </section>

      <main>
        {filteredVehicles.length === 0 ? <div className="card empty"><b>No vehicle added.</b><span>Add your first vehicle from the form above.</span></div> : filteredVehicles.map((vehicle) => {
          const open = selectedId === vehicle.id;
          return <div key={vehicle.id} className={'card vehicleCard ' + (open ? 'activeVehicle' : '')}>
            <div className="vehicleRow" onClick={() => setSelectedId(open ? null : vehicle.id)}>
              <div className="vehicleMain"><div><h2>{vehicle.vehicleNo}</h2><p>{vehicle.owner || 'Owner not added'} {vehicle.mobile ? '• ' + vehicle.mobile : ''}</p></div></div>
              <div className="vehicleStats"><span className="miniBadge danger">{urgentDocs(vehicle).length} Alert</span><span className="miniBadge green">{validDocs(vehicle).length} Valid</span></div>
            </div>
            <div className="vehicleActions">
              <button className="waBtn" onClick={(event) => { event.stopPropagation(); sendWhatsApp(vehicle); }}>WhatsApp</button>
              <button className="remove smallRemove" onClick={(event) => { event.stopPropagation(); removeVehicle(vehicle.id); }}>Delete</button>
            </div>
            {open && <>
              <div className="editVehicle">
                <input aria-label="Vehicle number" value={vehicle.vehicleNo} onChange={(event) => updateVehicle(vehicle.id, 'vehicleNo', event.target.value)} />
                <input aria-label="Owner" placeholder="Owner / Driver" value={vehicle.owner} onChange={(event) => updateVehicle(vehicle.id, 'owner', event.target.value)} />
                <input aria-label="Mobile" placeholder="WhatsApp Mobile" inputMode="tel" value={vehicle.mobile} onChange={(event) => updateVehicle(vehicle.id, 'mobile', event.target.value)} />
              </div>
              <div className="docs">
                {(vehicle.docs || []).map((docItem, index) => {
                  const status = getStatus(docItem.expiryDate);
                  return <div className="doc" key={docItem.name + index}>
                    <div className="docTitle"><input value={docItem.name} onChange={(event) => updateDoc(vehicle.id, index, 'name', event.target.value)} /><button onClick={() => removeDoc(vehicle.id, index)}>Delete</button></div>
                    <input type="date" value={docItem.expiryDate} onChange={(event) => updateDoc(vehicle.id, index, 'expiryDate', event.target.value)} />
                    <span className={'pill ' + status.tone}>{status.label}</span>
                  </div>;
                })}
              </div>
              <button className="custom" onClick={() => addCustomDoc(vehicle.id)}>+ Add Custom Document</button>
            </>}
          </div>;
        })}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
