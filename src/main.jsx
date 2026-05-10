import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, Car, FileText, Plus, Search, Trash2, AlertTriangle, CheckCircle2, MessageCircle, ChevronDown, ChevronRight } from 'lucide-react';
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

function formatDate(dateString) {
  if (!dateString) return 'Date missing';
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
  return vehicle.docs.filter((doc) => getStatus(doc.expiryDate).urgent);
}

function validDocs(vehicle) {
  return vehicle.docs.filter((doc) => {
    const d = daysLeft(doc.expiryDate);
    return d !== null && d > 30;
  });
}

function whatsappNumber(mobile) {
  const digits = (mobile || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function App() {
  const [vehicles, setVehicles] = useState(loadVehicles);
  const [selectedId, setSelectedId] = useState(null);
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
    return vehicles.flatMap((vehicle) => vehicle.docs.map((doc) => ({ vehicle, doc, status: getStatus(doc.expiryDate), days: daysLeft(doc.expiryDate) })).filter((item) => item.status.urgent)).sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  }, [vehicles]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedId);
  const selectedAlerts = selectedVehicle ? urgentDocs(selectedVehicle) : [];

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
    setSelectedId(newVehicle.id);
    setForm({ vehicleNo: '', owner: '', mobile: '' });
  }

  function removeVehicle(id) {
    if (!confirm('Is vehicle ko delete karna hai?')) return;
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    if (selectedId === id) setSelectedId(null);
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

  function sendWhatsApp(vehicle) {
    const number = whatsappNumber(vehicle.mobile);
    const urgent = urgentDocs(vehicle);
    const docs = urgent.length ? urgent : vehicle.docs;
    const lines = docs.map((doc) => `• ${doc.name}: ${formatDate(doc.expiryDate)} (${getStatus(doc.expiryDate).label})`).join('\n');
    const text = `Vehicle Document Alert\n\nVehicle: ${vehicle.vehicleNo}\nOwner: ${vehicle.owner || 'Not added'}\n\n${lines}\n\nPlease renew/verify documents.`;
    const url = number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="page compactPage">
      <header className="hero compactHero">
        <div>
          <div className="badge"><Bell size={14} /> Vehicle Document Alert</div>
          <h1>Document Tracker</h1>
          <p>Tap vehicle number to view only that vehicle documents.</p>
        </div>
        <div className="alertBox compactAlertBox"><span>Total Alerts</span><strong>{alertDocs.length}</strong></div>
      </header>

      <section className="grid compactGrid">
        <form onSubmit={addVehicle} className="card addCard">
          <h2><Plus size={17} /> Add Vehicle</h2>
          <input placeholder="Vehicle No. JH05AB1234" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} />
          <input placeholder="Owner / Driver" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          <input placeholder="WhatsApp Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <button>Add Vehicle</button>
        </form>

        <div className="card selectedAlerts">
          <h2><AlertTriangle size={17} /> {selectedVehicle ? selectedVehicle.vehicleNo : 'Select Vehicle'}</h2>
          {!selectedVehicle ? <div className="ok smallInfo">Vehicle no. par tap karo.</div> : selectedAlerts.length === 0 ? <div className="ok"><CheckCircle2 size={17} /> Is vehicle me urgent alert nahi hai.</div> : selectedAlerts.map((doc, idx) => {
            const status = getStatus(doc.expiryDate);
            return <div className="alertItem compactItem" key={idx}><div><b>{doc.name}</b><small>{formatDate(doc.expiryDate)}</small></div><span className={`pill ${status.tone}`}>{status.label}</span></div>;
          })}
        </div>
      </section>

      <section className="card vehiclesTop compactTop">
        <h2><Car size={18} /> Vehicles ({filteredVehicles.length})</h2>
        <div className="search"><Search size={15} /><input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </section>

      <main>
        {filteredVehicles.length === 0 ? <div className="card empty"><Car size={34} /><b>Vehicle add nahi hai.</b><span>Upar form se pehla vehicle add karein.</span></div> : filteredVehicles.map((vehicle) => {
          const open = selectedId === vehicle.id;
          const alerts = urgentDocs(vehicle).length;
          const valid = validDocs(vehicle).length;
          return <div key={vehicle.id} className={`card vehicleCard compactVehicle ${open ? 'activeVehicle' : ''}`}>
            <div className="vehicleRow" onClick={() => setSelectedId(open ? null : vehicle.id)}>
              <div className="vehicleMain">
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <div><h2>{vehicle.vehicleNo}</h2><p>{vehicle.owner || 'Owner not added'} {vehicle.mobile ? `• ${vehicle.mobile}` : ''}</p></div>
              </div>
              <div className="vehicleStats"><span className="miniBadge danger">{alerts} Alert</span><span className="miniBadge green">{valid} Valid</span></div>
            </div>
            <div className="vehicleActions">
              <button className="waBtn" onClick={(e) => { e.stopPropagation(); sendWhatsApp(vehicle); }}><MessageCircle size={15} /> WhatsApp</button>
              <button className="remove smallRemove" onClick={(e) => { e.stopPropagation(); removeVehicle(vehicle.id); }}><Trash2 size={15} /> Delete</button>
            </div>
            {open && <>
              <div className="docs compactDocs">
                {vehicle.docs.map((doc, index) => {
                  const status = getStatus(doc.expiryDate);
                  return <div className="doc compactDoc" key={index}>
                    <div className="docTitle"><FileText size={15} /><input value={doc.name} onChange={(e) => updateDocName(vehicle.id, index, e.target.value)} /><button onClick={() => removeDoc(vehicle.id, index)}><Trash2 size={14} /></button></div>
                    <input type="date" value={doc.expiryDate} onChange={(e) => updateDoc(vehicle.id, index, e.target.value)} />
                    <span className={`pill ${status.tone}`}>{status.label}</span>
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
