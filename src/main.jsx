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
    'Vehicle validation details\n' +
    (details || 'No document date added.') + '\n\n' +
    'Please Renew your vehicle Document Soon to Avoid Any Type of Penalty';
}

createRoot(document.getElementById('root')).render(<div />);
