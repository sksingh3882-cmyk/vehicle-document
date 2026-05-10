import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  Car,
  FileText,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Cloud,
  Lock,
  LogOut,
  Menu,
  Home,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import './style.css';

const firebaseConfig = {
  apiKey: 'AIzaSyBgpT7D9-mgQg-TLS5SHA2LaSlqp6-EBEc',
  authDomain: 'vehicle-document-c23e2.firebaseapp.com',
  projectId: 'vehicle-document-c23e2',
  storageBucket: 'vehicle-document-c23e2.firebasestorage.app',
  messagingSenderId: '620277943671',
  appId: '1:620277943671:web:8246b0d76605142ffe2572',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const cloudDocRef = doc(db, 'vehicleData', 'main');

const STORAGE_KEY = 'vehicle_document_expiry_app_v2';
const ADMIN_KEY = 'vehicle_document_admin_mode';
const ADMIN_PIN = '2468';

const defaultDocs = [
  { name: 'Insurance', expiryDate: '' },
  { name: 'PUC', expiryDate: '' },
  { name: 'Fitness', expiryDate: '' },
  { name: 'Permit', expiryDate: '' },
  { name: 'Tax', expiryDate: '' },
  { name: 'RC', expiryDate: '' },
];

function loadVehicles() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('vehicle_document_expiry_app_v1');
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
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatus(expiryDate) {
  const days = daysLeft(expiryDate);
  if (days === null) return { label: 'Date missing', tone: 'neutral', urgent: false };
  if (days < 0) return { label: `Expired ${Math.abs(days)} days ago`, tone: 'danger', urgent: true };
  if (days === 0) return { label: 'Expires today', tone: 'danger', urgent: true };
  if (days <= 7) return { label: `${days} days left`, tone: 'orange', urgent: true };
  if (days <= 30) return { label: `${days} days left`, tone: 'yellow', urgent: true };
  return { label: `${days} days left`, tone: 'green', urgent: false };
}

function urgentDocs(vehicle) {
  return (vehicle.docs || []).filter((docItem) => getStatus(docItem.expiryDate).urgent);
}

function validDocs(vehicle) {
  return (vehicle.docs || []).filter((docItem) => {
    const d = daysLeft(docItem.expiryDate);
    return d !== null && d > 30;
  });
}

function whatsappNumber(mobile) {
  const digits = (mobile || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

function App() {
  const [vehicles, setVehicles] = useState(loadVehicles);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('Connecting cloud...');
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem(ADMIN_KEY) === 'true');
  const [page, setPage] = useState(localStorage.getItem(ADMIN_KEY) === 'true' ? 'admin' : 'visitor');
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ vehicleNo: '', owner: '', mobile: '' });

  useEffect(() => {
    const localVehicles = loadVehicles();
    const unsubscribe = onSnapshot(
      cloudDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const cloudVehicles = snapshot.data().vehicles || [];
          setVehicles(cloudVehicles);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudVehicles));
          } catch {}
          setCloudStatus('Cloud synced');
        } else {
          if (localVehicles.length) {
            await setDoc(cloudDocRef, { vehicles: localVehicles, updatedAt: serverTimestamp() });
          }
          setCloudStatus('Cloud ready');
        }
        setCloudReady(true);
      },
      (error) => {
        console.error('Cloud sync error', error);
        setCloudStatus('Cloud error - local data only');
        setCloudReady(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
      localStorage.setItem('vehicle_document_expiry_app_v1', JSON.stringify(vehicles));
    } catch (error) {
      console.error('Unable to save vehicle data', error);
    }

    if (cloudReady && isAdmin) {
      setDoc(cloudDocRef, { vehicles, updatedAt: serverTimestamp() }, { merge: true })
        .then(() => setCloudStatus('Cloud synced'))
        .catch((error) => {
          console.error('Cloud save failed', error);
          setCloudStatus('Cloud save failed');
        });
    }
  }, [vehicles, cloudReady, isAdmin]);

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) =>
      [vehicle.vehicleNo, vehicle.owner, vehicle.mobile].some((item) => (item || '').toLowerCase().includes(q))
    );
  }, [vehicles, query]);

  const alertDocs = useMemo(() => {
    return vehicles
      .flatMap((vehicle) =>
        (vehicle.docs || [])
          .map((docItem) => ({ vehicle, doc: docItem, status: getStatus(docItem.expiryDate), days: daysLeft(docItem.expiryDate) }))
          .filter((item) => item.status.urgent)
      )
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  }, [vehicles]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedId);
  const selectedAlerts = selectedVehicle ? urgentDocs(selectedVehicle) : [];

  function enterAdmin() {
    const pin = window.prompt('Enter admin PIN');
    if (pin === ADMIN_PIN) {
      setIsAdmin(true);
      setPage('admin');
      localStorage.setItem(ADMIN_KEY, 'true');
    } else if (pin !== null) {
      alert('Incorrect PIN');
    }
  }

  function exitAdmin() {
    setIsAdmin(false);
    setPage('visitor');
    localStorage.removeItem(ADMIN_KEY);
  }

  function needAdmin() {
    if (!isAdmin) {
      alert('Admin mode required');
      return false;
    }
    return true;
  }

  function addVehicle(event) {
    event.preventDefault();
    if (!needAdmin()) return;
    if (!form.vehicleNo.trim()) return alert('Enter vehicle number');
    const newVehicle = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      vehicleNo: form.vehicleNo.trim().toUpperCase(),
      owner: form.owner.trim(),
      mobile: form.mobile.trim(),
      docs: defaultDocs.map((docItem) => ({ ...docItem })),
      createdAt: new Date().toISOString(),
    };
    setVehicles((prev) => [newVehicle, ...prev]);
    setSelectedId(newVehicle.id);
    setForm({ vehicleNo: '', owner: '', mobile: '' });
  }

  function removeVehicle(id) {
    if (!needAdmin()) return;
    if (!confirm('Delete this vehicle?')) return;
    setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function updateDoc(vehicleId, index, value) {
    if (!isAdmin) return;
    setVehicles((prev) =>
      prev.map((vehicle) => {
        if (vehicle.id !== vehicleId) return vehicle;
        const docs = [...(vehicle.docs || [])];
        docs[index] = { ...docs[index], expiryDate: value };
        return { ...vehicle, docs };
      })
    );
  }

  function updateDocName(vehicleId, index, value) {
    if (!isAdmin) return;
    setVehicles((prev) =>
      prev.map((vehicle) => {
        if (vehicle.id !== vehicleId) return vehicle;
        const docs = [...(vehicle.docs || [])];
        docs[index] = { ...docs[index], name: value };
        return { ...vehicle, docs };
      })
    );
  }

  function addCustomDoc(vehicleId) {
    if (!needAdmin()) return;
    setVehicles((prev) =>
      prev.map((vehicle) =>
        vehicle.id === vehicleId ? { ...vehicle, docs: [...(vehicle.docs || []), { name: 'New Document', expiryDate: '' }] } : vehicle
      )
    );
  }

  function removeDoc(vehicleId, index) {
    if (!needAdmin()) return;
    setVehicles((prev) =>
      prev.map((vehicle) =>
        vehicle.id === vehicleId ? { ...vehicle, docs: (vehicle.docs || []).filter((_, i) => i !== index) } : vehicle
      )
    );
  }

  function sendWhatsApp(vehicle) {
    const selectedNumber = window.prompt('Enter WhatsApp number. Leave blank to select a contact.', vehicle.mobile || '');
    if (selectedNumber === null) return;
    const number = whatsappNumber(selectedNumber);
    const urgent = urgentDocs(vehicle);
    const docsToSend = urgent.length ? urgent : vehicle.docs || [];
    const lines = docsToSend.map((docItem) => `• ${docItem.name}: ${formatDate(docItem.expiryDate)} (${getStatus(docItem.expiryDate).label})`).join('\n');
    const text = `Vehicle Document Alert\n\nVehicle: ${vehicle.vehicleNo}\nOwner: ${vehicle.owner || 'Not added'}\n\n${lines}\n\nPlease renew or verify documents.`;
    const url = number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  const VehicleDetails = ({ vehicle, admin }) => (
    <div className="docs compactDocs">
      {(vehicle.docs || []).map((docItem, index) => {
        const status = getStatus(docItem.expiryDate);
        return (
          <div className="doc compactDoc" key={`${docItem.name}-${index}`}>
            <div className="docTitle">
              <FileText size={15} />
              {admin ? <input value={docItem.name} onChange={(event) => updateDocName(vehicle.id, index, event.target.value)} /> : <b>{docItem.name}</b>}
              {admin && <button onClick={() => removeDoc(vehicle.id, index)}><Trash2 size={14} /></button>}
            </div>
            {admin ? (
              <input type="date" placeholder="YYYY-MM-DD" value={docItem.expiryDate} onChange={(event) => updateDoc(vehicle.id, index, event.target.value)} />
            ) : (
              <small>{formatDate(docItem.expiryDate)}</small>
            )}
            <span className={`pill ${status.tone}`}>{status.label}</span>
          </div>
        );
      })}
    </div>
  );

  if (page === 'visitor') {
    return (
      <div className="page compactPage visitorPage">
        <header className="visitorHeader">
          <div>
            <h1>SANJAY VEHICLE MANAGEMENT SYSTEM</h1>
            <p className="cloudStatus"><Cloud size={13} /> {cloudStatus}</p>
          </div>
          <button className="menuBtn" onClick={enterAdmin}><Menu size={20} /></button>
        </header>

        <section className="card vehiclesTop compactTop">
          <h2><Car size={18} /> Vehicles ({filteredVehicles.length})</h2>
          <div className="search"><Search size={15} /><input placeholder="Search vehicle" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        </section>

        <main>
          {filteredVehicles.length === 0 ? (
            <div className="card empty"><Car size={34} /><b>No vehicle added.</b><span>Please contact admin.</span></div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const open = selectedId === vehicle.id;
              const alerts = urgentDocs(vehicle).length;
              const valid = validDocs(vehicle).length;
              return (
                <div key={vehicle.id} className={`card vehicleCard visitorVehicle ${open ? 'activeVehicle' : ''}`}>
                  <div className="visitorVehicleRow">
                    <div className="vehicleMain">
                      <Car size={22} />
                      <div>
                        <h2>{vehicle.vehicleNo}</h2>
                        <p>{alerts} Alerts • {valid} Valid</p>
                      </div>
                    </div>
                    <button className="waBtn" onClick={() => setSelectedId(open ? null : vehicle.id)}>See Vehicle Data</button>
                  </div>
                  {open && <VehicleDetails vehicle={vehicle} admin={false} />}
                </div>
              );
            })
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="page compactPage">
      <header className="hero compactHero">
        <div>
          <div className="badge"><Bell size={14} /> Admin Panel</div>
          <h1>Vehicle Document Management</h1>
          <p>Admin can add, edit and remove vehicle records.</p>
          <p className="cloudStatus"><Cloud size={13} /> {cloudStatus}</p>
        </div>
        <div className="alertBox compactAlertBox"><span>Total Alerts</span><strong>{alertDocs.length}</strong></div>
      </header>

      <section className="card vehiclesTop compactTop">
        <h2><Lock size={16} /> Admin Mode</h2>
        <div className="vehicleActions">
          <button className="custom" onClick={() => setPage('visitor')}><Home size={14} /> Visitor Page</button>
          <button className="remove smallRemove" onClick={exitAdmin}><LogOut size={14} /> Logout</button>
        </div>
      </section>

      <section className="grid compactGrid">
        <form onSubmit={addVehicle} className="card addCard">
          <h2><Plus size={17} /> Add Vehicle</h2>
          <input placeholder="Vehicle No. JH05AB1234" value={form.vehicleNo} onChange={(event) => setForm({ ...form, vehicleNo: event.target.value.toUpperCase() })} />
          <input placeholder="Owner / Driver" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
          <input placeholder="Default WhatsApp Mobile" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
          <button>Add Vehicle</button>
        </form>

        <div className="card selectedAlerts">
          <h2><AlertTriangle size={17} /> {selectedVehicle ? selectedVehicle.vehicleNo : 'Select Vehicle'}</h2>
          {!selectedVehicle ? <div className="ok smallInfo">Tap a vehicle number.</div> : selectedAlerts.length === 0 ? <div className="ok"><CheckCircle2 size={17} /> No urgent alert for this vehicle.</div> : selectedAlerts.map((docItem, index) => {
            const status = getStatus(docItem.expiryDate);
            return <div className="alertItem compactItem" key={`${docItem.name}-${index}`}><div><b>{docItem.name}</b><small>{formatDate(docItem.expiryDate)}</small></div><span className={`pill ${status.tone}`}>{status.label}</span></div>;
          })}
        </div>
      </section>

      <section className="card vehiclesTop compactTop">
        <h2><Car size={18} /> Vehicle List ({filteredVehicles.length})</h2>
        <div className="search"><Search size={15} /><input placeholder="Search vehicle" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </section>

      <main>
        {filteredVehicles.length === 0 ? <div className="card empty"><Car size={34} /><b>No vehicle added.</b><span>Use the form above to add the first vehicle.</span></div> : filteredVehicles.map((vehicle) => {
          const open = selectedId === vehicle.id;
          const alerts = urgentDocs(vehicle).length;
          const valid = validDocs(vehicle).length;
          return (
            <div key={vehicle.id} className={`card vehicleCard compactVehicle ${open ? 'activeVehicle' : ''}`}>
              <div className="vehicleRow" onClick={() => setSelectedId(open ? null : vehicle.id)}>
                <div className="vehicleMain">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}<div><h2>{vehicle.vehicleNo}</h2><p>{vehicle.owner || 'Owner not added'} {vehicle.mobile ? `• ${vehicle.mobile}` : ''}</p></div></div>
                <div className="vehicleStats"><span className="miniBadge danger">{alerts} Alert</span><span className="miniBadge green">{valid} Valid</span></div>
              </div>
              <div className="vehicleActions">
                <button className="waBtn" onClick={(event) => { event.stopPropagation(); sendWhatsApp(vehicle); }}><MessageCircle size={15} /> Send</button>
                <button className="remove smallRemove" onClick={(event) => { event.stopPropagation(); removeVehicle(vehicle.id); }}><Trash2 size={15} /> Delete</button>
              </div>
              {open && <><VehicleDetails vehicle={vehicle} admin={true} /><button className="custom" onClick={() => addCustomDoc(vehicle.id)}>+ Add Custom Document</button></>}
            </div>
          );
        })}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
