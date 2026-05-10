import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, Car, FileText, Plus, Search, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './style.css';

const STORAGE_KEY = 'vehicle_document_expiry_app_v2';

const defaultDocs = [
  { name: 'Insurance', expiryDate: '' },
  { name: 'Pollution / PUC', expiryDate: '' },
  { name: 'Fitness', expiryDate: '' },
  { name: 'Permit', expiryDate: '' },
  { name: 'Tax', expiryDate: '' },
  { name: 'RC', expiryDate: '' },
];

function loadVehicles() {
  try {
    const savedV2 = localStorage.getItem(STORAGE_KEY);
    const savedV1 = localStorage.getItem('vehicle_document_expiry_app_v1');
    const saved = savedV2 || savedV1;
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
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
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

function App() {
  const [vehicles, setVehicles] = useState(loadVehicles);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ vehicleNo: '', owner: '', mobile: '' });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
      localStorage.setItem('vehicle_document_expiry_app_v1', JSON.stringify(vehicles));
    } catch (error) {
      console.error('Unable to save vehicle data', error);
    }
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => [v.vehicleNo, v.owner, v.mobile].some((item) => (item || '').toLowerCase().includes(q)));
  }, [vehicles, query]);

  const alertDocs = useMemo(() => {
    return vehicles.flatMap((vehicle) =>
      vehicle.docs
        .map((doc) => ({ vehicle, doc, status: getStatus(doc.expiryDate), days: daysLeft(doc.expiryDate) }))
        .filter((item) => item.status.urgent)
        .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
    );
  }, [vehicles]);

  function addVehicle(e) {
    e.preventDefault();
    if (!form.vehicleNo.trim()) return alert('Vehicle number add karein');
    const newVehicle = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      vehicleNo: form.vehicleNo.trim().toUpperCase(),
      owner: form.owner.trim(),
      mobile: form.mobile.trim(),
      docs: defaultDocs.map((doc) => ({ ...doc })),
      createdAt: new Date().toISOString(),
    };
    setVehicles((prev) => [newVehicle, ...prev]);
    setForm({ vehicleNo: '', owner: '', mobile: '' });
  }

  function removeVehicle(id) {
    if (!confirm('Is vehicle ko delete karna hai?')) return;
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }

  function updateDoc(vehicleId, index, value) {
    setVehicles((prev) => prev.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      const docs = [...vehicle.docs];
      docs[index] = { ...docs[index], expiryDate: value };
      return { ...vehicle, docs };
    }));
  }

  function updateDocName(vehicleId, index, value) {
    setVehicles((prev) => prev.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      const docs = [...vehicle.docs];
      docs[index] = { ...docs[index], name: value };
      return { ...vehicle, docs };
    }));
  }

  function addCustomDoc(vehicleId) {
    setVehicles((prev) => prev.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, docs: [...vehicle.docs, { name: 'New Document', expiryDate: '' }] } : vehicle));
  }

  function removeDoc(vehicleId, index) {
    setVehicles((prev) => prev.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, docs: vehicle.docs.filter((_, i) => i !== index) } : vehicle));
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <div className="badge"><Bell size={16} /> Vehicle Document Alert App</div>
          <h1>Vehicle Document Expiry Tracker</h1>
          <p>Insurance, PUC, Fitness, Permit, Tax aur RC expiry ka local alert system.</p>
        </div>
        <div className="alertBox"><span>Active alerts</span><strong>{alertDocs.length}</strong></div>
      </header>

      <section className="grid">
        <form onSubmit={addVehicle} className="card">
          <h2><Plus size={20} /> Add Vehicle</h2>
          <input placeholder="Vehicle No. जैसे JH05AB1234" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} />
          <input placeholder="Owner / Driver Name" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          <input placeholder="Mobile Number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <button>Vehicle Add Karo</button>
        </form>

        <div className="card alerts">
          <h2><AlertTriangle size={20} /> Expiry Alerts</h2>
          {alertDocs.length === 0 ? <div className="ok"><CheckCircle2 size={20} /> Abhi koi urgent expiry alert nahi hai.</div> : alertDocs.map(({ vehicle, doc, status }, idx) => (
            <div className="alertItem" key={idx}>
              <div><b>{vehicle.vehicleNo} - {doc.name}</b><small>Owner: {vehicle.owner || 'Not added'} {vehicle.mobile ? `• ${vehicle.mobile}` : ''}</small></div>
              <span className={`pill ${status.tone}`}>{status.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card vehiclesTop">
        <h2><Car size={20} /> Vehicles</h2>
        <div className="search"><Search size={18} /><input placeholder="Search vehicle, owner, mobile" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </section>

      <main>
        {filteredVehicles.length === 0 ? <div className="card empty"><Car size={42} /><b>Abhi vehicle add nahi hai.</b><span>Upar form se pehla vehicle add karein.</span></div> : filteredVehicles.map((vehicle) => (
          <div key={vehicle.id} className="card vehicleCard">
            <div className="vehicleHead">
              <div><h2><Car size={22} /> {vehicle.vehicleNo}</h2><p>{vehicle.owner || 'Owner not added'} {vehicle.mobile ? `• ${vehicle.mobile}` : ''}</p></div>
              <button className="remove" onClick={() => removeVehicle(vehicle.id)}><Trash2 size={17} /> Remove Vehicle</button>
            </div>
            <div className="docs">
              {vehicle.docs.map((doc, index) => {
                const status = getStatus(doc.expiryDate);
                return <div className="doc" key={index}>
                  <div className="docTitle"><FileText size={18} /><input value={doc.name} onChange={(e) => updateDocName(vehicle.id, index, e.target.value)} /><button onClick={() => removeDoc(vehicle.id, index)}><Trash2 size={16} /></button></div>
                  <input type="date" value={doc.expiryDate} onChange={(e) => updateDoc(vehicle.id, index, e.target.value)} />
                  <span className={`pill ${status.tone}`}>{status.label}</span>
                </div>;
              })}
            </div>
            <button className="custom" onClick={() => addCustomDoc(vehicle.id)}>+ Custom Document Add Karo</button>
          </div>
        ))}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
