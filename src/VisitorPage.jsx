import React, { useMemo, useState } from 'react';
import { Car, Cloud, Search, FileText } from 'lucide-react';

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
  if (days === null) return { label: 'Date missing', tone: 'neutral' };
  if (days < 0) return { label: `Expired ${Math.abs(days)} days ago`, tone: 'danger' };
  if (days === 0) return { label: 'Expires today', tone: 'danger' };
  if (days <= 7) return { label: `${days} days left`, tone: 'orange' };
  if (days <= 30) return { label: `${days} days left`, tone: 'yellow' };
  return { label: `${days} days left`, tone: 'green' };
}

function urgentCount(vehicle) {
  return (vehicle.docs || []).filter((docItem) => ['danger', 'orange', 'yellow'].includes(getStatus(docItem.expiryDate).tone)).length;
}

function validCount(vehicle) {
  return (vehicle.docs || []).filter((docItem) => {
    const d = daysLeft(docItem.expiryDate);
    return d !== null && d > 30;
  }).length;
}

export default function VisitorPage({ vehicles = [], cloudStatus = 'Cloud synced' }) {
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) => [vehicle.vehicleNo, vehicle.owner].some((item) => (item || '').toLowerCase().includes(q)));
  }, [vehicles, query]);

  return (
    <div className="page compactPage visitorPage">
      <header className="visitorHeader">
        <div>
          <h1>SANJAY VEHICLE MANAGEMENT SYSTEM</h1>
          <p className="cloudStatus"><Cloud size={13} /> {cloudStatus}</p>
        </div>
        <button className="menuBtn">☰</button>
      </header>

      <section className="card vehiclesTop compactTop">
        <h2><Car size={18} /> Vehicles ({filteredVehicles.length})</h2>
        <div className="search">
          <Search size={15} />
          <input placeholder="Search vehicle" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </section>

      <main>
        {filteredVehicles.length === 0 ? (
          <div className="card empty"><Car size={34} /><b>No vehicle added.</b><span>Please contact admin.</span></div>
        ) : (
          filteredVehicles.map((vehicle) => {
            const open = selectedId === vehicle.id;
            return (
              <div key={vehicle.id} className={`card vehicleCard visitorVehicle ${open ? 'activeVehicle' : ''}`}>
                <div className="visitorVehicleRow">
                  <div className="vehicleMain">
                    <Car size={22} />
                    <div>
                      <h2>{vehicle.vehicleNo}</h2>
                      <p>{urgentCount(vehicle)} Alerts • {validCount(vehicle)} Valid</p>
                    </div>
                  </div>
                  <button className="waBtn" onClick={() => setSelectedId(open ? null : vehicle.id)}>See Vehicle Data</button>
                </div>
                {open && (
                  <div className="docs compactDocs">
                    {(vehicle.docs || []).map((docItem, index) => {
                      const status = getStatus(docItem.expiryDate);
                      return (
                        <div className="doc compactDoc" key={`${docItem.name}-${index}`}>
                          <div className="docTitle"><FileText size={15} /><b>{docItem.name}</b></div>
                          <small>{formatDate(docItem.expiryDate)}</small>
                          <span className={`pill ${status.tone}`}>{status.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
