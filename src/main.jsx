import React, { useEffect, useMemo, useState } from 'react';
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
const LOCAL_KEY = 'vehicle_document_expiry_app_v2';

const defaultDocs = [
  { name: 'Insurance', expiryDate: '' },
  { name: 'PUC', expiryDate: '' },
  { name: 'Fitness', expiryDate: '' },
  { name: 'Permit', expiryDate: '' },
  { name: 'Tax', expiryDate: '' },
  { name: 'RC', expiryDate: '' }
];

function loadLocalVehicles() {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
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
  if (days === null) return { label: 'Date missing', tone: 'neutral', urgent: false };
  if (days < 0) return { label: 'Expired ' + Math.abs(days) + ' days ago', tone: 'danger', urgent: true };
  if (days === 0) return { label: 'Expires today', tone: 'danger', urgent: true };
  if (days <= 7) return { label: days + ' days left', tone: 'orange', urgent: true };
  if (days <= 30) return { label: days + ' days left', tone: 'yellow', urgent: true };
  return { label: days + ' days left', tone: 'green', urgent: false };
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

function App() {
  const [vehicles, setVehicles] = useState(loadLocalVehicles);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('Connecting cloud...');
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ vehicleNo: '', owner: '', mobile: '' });

  useEffect(() => {
    const localVehicles = loadLocalVehicles();
    const unsubscribe = onSnapshot(
      cloudDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const cloudVehicles = snapshot.data().vehicles || [];
          setVehicles(cloudVehicles);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(cloudVehicles));
          setCloudStatus('Cloud synced');
        } else {
          if (localVehicles.length > 0) {
            await setDoc(cloudDocRef, { vehicles: localVehicles, updatedAt: serverTimestamp() });
          }
          setCloudStatus('Cloud ready');
        }
        setCloudReady(true);
      },
      () => {
        setCloudStatus('Cloud error - local data active');
        setCloudReady(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(vehicles));
    if (cloudReady) {
      setDoc(cloudDocRef, { vehicles, updatedAt: serverTimestamp() }, { merge: true })
        .then(() => setCloudStatus('Cloud synced'))
        .catch(() => setCloudStatus('Cloud save failed'));
    }
  }, [vehicles, cloudReady]);

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) =>
      [vehicle.vehicleNo, vehicle.owner, vehicle.mobile].some((item) => (item || '').toLowerCase().includes(q))
    );
  }, [vehicles, query]);

  const totalAlerts = useMemo(() => vehicles.reduce((sum, vehicle) => sum + urgentDocs(vehicle).length, 0), [vehicles]);

  function addVehicle(event) {
    event.preventDefault();
    if (!form.vehicleNo.trim()) return alert('Enter vehicle number');
    const newVehicle = {
      id: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
      vehicleNo: form.vehicleNo.trim().toUpperCase(),
      owner: form.owner.trim(),
      mobile: form.mobile.trim(),
      docs: defaultDocs.map((item) => ({ ...item })),
      createdAt: new Date().toISOString()
    };
    setVehicles((prev) => [newVehicle, ...prev]);
    setSelectedId(newVehicle.id);
    setForm({ vehicleNo: '', owner: '', mobile: '' });
  }

  function removeVehicle(id) {
    if (!confirm('Delete this vehicle?')) return;
    setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function updateDoc(vehicleId, index, field, value) {
    setVehicles((prev) => prev.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      const docs = [...(vehicle.docs || [])];
      docs[index] = { ...docs[index], [field]: value };
      return { ...vehicle, docs };
    }));
  }

  function addCustomDoc(vehicleId) {
    setVehicles((prev) => prev.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      return { ...vehicle, docs: [...(vehicle.docs || []), { name: 'New Document', expiryDate: '' }] };
    }));
  }

  function removeDoc(vehicleId, index) {
    setVehicles((prev) => prev.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      return { ...vehicle, docs: (vehicle.docs || []).filter((_, i) => i !== index) };
    }));
  }

  function sendWhatsApp(vehicle) {
    const inputNumber = window.prompt('Enter WhatsApp number. Leave blank to select contact.', vehicle.mobile || '');
    if (inputNumber === null) return;
    const number = whatsappNumber(inputNumber);
    const docsToSend = urgentDocs(vehicle).length ? urgentDocs(vehicle) : (vehicle.docs || []);
    const lines = docsToSend.map((item) => '• ' + item.name + ': ' + formatDate(item.expiryDate) + ' (' + getStatus(item.expiryDate).label + ')').join('\n');
    const text = 'Vehicle Document Alert\n\nVehicle: ' + vehicle.vehicleNo + '\nOwner: ' + (vehicle.owner || 'Not added') + '\n\n' + lines + '\n\nPlease renew or verify documents.';
    const url = number ? 'https://wa.me/' + number + '?text=' + encodeURIComponent(text) : 'https://wa.me/?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
  }

  return (
    <div className="page compactPage">
      <header className="hero compactHero">
        <div>
          <div className="badge">Vehicle Document Alert</div>
          <h1>Vehicle Document Tracker</h1>
          <p>Cloud connected vehicle document expiry management.</p>
          <p className="cloudStatus">{cloudStatus}</p>
        </div>
        <div className="alertBox compactAlertBox">
          <span>Total Alerts</span>
          <strong>{totalAlerts}</strong>
        </div>
      </header>

      <section className="grid compactGrid">
        <form className="card addCard" onSubmit={addVehicle}>
          <h2>Add Vehicle</h2>
          <input placeholder="Vehicle No. JH05AB1234" value={form.vehicleNo} onChange={(event) => setForm({ ...form, vehicleNo: event.target.value.toUpperCase() })} />
          <input placeholder="Owner / Driver" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
          <input placeholder="WhatsApp Mobile" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
          <button>Add Vehicle</button>
        </form>

        <div className="card selectedAlerts">
          <h2>Expiry Alerts</h2>
          {totalAlerts === 0 ? <div className="ok">No urgent alerts.</div> : vehicles.flatMap((vehicle) => urgentDocs(vehicle).map((docItem, index) => {
            const status = getStatus(docItem.expiryDate);
            return <div className="alertItem compactItem" key={vehicle.id + docItem.name + index}><div><b>{vehicle.vehicleNo} - {docItem.name}</b><small>{formatDate(docItem.expiryDate)}</small></div><span className={'pill ' + status.tone}>{status.label}</span></div>;
          }))}
        </div>
      </section>

      <section className="card vehiclesTop compactTop">
        <h2>Vehicles ({filteredVehicles.length})</h2>
        <div className="search"><span>Search</span><input placeholder="Vehicle / owner / mobile" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </section>

      <main>
        {filteredVehicles.length === 0 ? <div className="card empty"><b>No vehicle added.</b><span>Add your first vehicle from the form above.</span></div> : filteredVehicles.map((vehicle) => {
          const open = selectedId === vehicle.id;
          return <div key={vehicle.id} className={'card vehicleCard compactVehicle ' + (open ? 'activeVehicle' : '')}>
            <div className="vehicleRow" onClick={() => setSelectedId(open ? null : vehicle.id)}>
              <div className="vehicleMain"><div><h2>{vehicle.vehicleNo}</h2><p>{vehicle.owner || 'Owner not added'} {vehicle.mobile ? '• ' + vehicle.mobile : ''}</p></div></div>
              <div className="vehicleStats"><span className="miniBadge danger">{urgentDocs(vehicle).length} Alert</span><span className="miniBadge green">{validDocs(vehicle).length} Valid</span></div>
            </div>
            <div className="vehicleActions">
              <button className="waBtn" onClick={(event) => { event.stopPropagation(); sendWhatsApp(vehicle); }}>WhatsApp</button>
              <button className="remove smallRemove" onClick={(event) => { event.stopPropagation(); removeVehicle(vehicle.id); }}>Delete</button>
            </div>
            {open && <>
              <div className="docs compactDocs">
                {(vehicle.docs || []).map((docItem, index) => {
                  const status = getStatus(docItem.expiryDate);
                  return <div className="doc compactDoc" key={docItem.name + index}>
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
