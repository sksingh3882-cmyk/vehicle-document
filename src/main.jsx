import React from 'react';
import { createRoot } from 'react-dom/client';
import VisitorPage from './VisitorPage';
import './style.css';

const sampleVehicles = [
  {
    id: '1',
    vehicleNo: 'JH05AB1234',
    owner: 'Sanjay Singh',
    docs: [
      { name: 'Insurance', expiryDate: '2026-08-10' },
      { name: 'PUC', expiryDate: '2026-06-12' },
      { name: 'Fitness', expiryDate: '2025-12-01' },
    ],
  },
  {
    id: '2',
    vehicleNo: 'JH01CD5678',
    owner: 'Driver',
    docs: [
      { name: 'Insurance', expiryDate: '2025-09-11' },
      { name: 'Permit', expiryDate: '2025-10-22' },
      { name: 'Tax', expiryDate: '2026-01-15' },
    ],
  },
];

function App() {
  return (
    <VisitorPage
      vehicles={sampleVehicles}
      cloudStatus="Cloud synced"
    />
  );
}

createRoot(document.getElementById('root')).render(<App />);
