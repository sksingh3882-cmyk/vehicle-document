(function () {
  const STORAGE_KEY = 'vehicle_document_expiry_app_supabase_v1';
  const BANNER_SRC = '/banner.png';

  function readVehicles() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
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

  function formatDate(value) {
    if (!value) return 'Date missing';
    try {
      return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return value;
    }
  }

  function statusInfo(expiryDate) {
    const days = daysLeft(expiryDate);
    if (days === null) return { label: 'Date missing', date: 'Date missing', cls: 'neutral', foot: 'Some document dates are missing.' };
    if (days < 0) return { label: 'Expired', date: 'Expired on: ' + formatDate(expiryDate), cls: 'danger', foot: 'Some documents need renewal.' };
    if (days === 0) return { label: 'Expires Today', date: 'Expires today', cls: 'danger', foot: 'Some documents need renewal.' };
    if (days <= 30) return { label: 'Expiring Soon', date: 'Valid till: ' + formatDate(expiryDate), cls: 'warn', foot: 'Some documents are expiring soon.' };
    return { label: 'Active', date: 'Valid till: ' + formatDate(expiryDate), cls: 'ok', foot: 'All listed documents are verified and up to date.' };
  }

  function esc(value) {
    return String(value || '').replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function findVehicleFromText(text) {
    const vehicles = readVehicles();
    const upper = String(text || '').toUpperCase();
    return vehicles.find((v) => v.vehicleNo && upper.includes(String(v.vehicleNo).toUpperCase())) || null;
  }

  function addStyles() {
    if (document.getElementById('vehicleDetailPopupStyles')) return;
    const style = document.createElement('style');
    style.id = 'vehicleDetailPopupStyles';
    style.textContent = `
      .vehicleDetailOverlay{position:fixed;inset:0;background:rgba(15,23,42,.68);z-index:999999;padding:10px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
      .vehicleDetailModal{width:100%;max-width:620px;max-height:86vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.8);position:relative}
      .vehicleDetailClose{position:absolute;right:10px;top:10px;width:34px;height:34px;border-radius:50%;border:1px solid #dbeafe;background:#fff;color:#0f172a;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:3;box-shadow:0 8px 18px rgba(15,23,42,.12)}
      .vehicleDetailHero{position:relative;background:linear-gradient(180deg,#eaf3ff,#fff);border-radius:20px 20px 0 0;overflow:hidden;text-align:center;padding:0}
      .vehicleDetailHero img{width:100%;display:block;aspect-ratio:16/7;object-fit:cover;object-position:center}
      .vehicleDetailBody{margin:-10px 12px 12px;background:#fff;border-radius:16px;position:relative;z-index:2;padding:14px;box-shadow:0 8px 24px rgba(37,99,235,.08);border:1px solid #e2e8f0}
      .vehicleInfoGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:12px}
      .vehicleInfoBox{display:flex;align-items:center;gap:8px;min-width:0}.vehicleInfoIcon{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;background:#eff6ff;color:#2563eb;flex:0 0 auto}
      .vehicleInfoBox:nth-child(2) .vehicleInfoIcon{background:#f3e8ff;color:#9333ea}.vehicleInfoBox:nth-child(3) .vehicleInfoIcon{background:#dcfce7;color:#16a34a}
      .vehicleInfoBox small{display:block;color:#64748b;font-weight:800;font-size:11px;margin-bottom:2px}.vehicleInfoBox b{display:block;color:#0f172a;font-size:15px;line-height:1.1;word-break:break-word}
      .vehicleDocTitle{display:flex;align-items:center;gap:8px;margin:4px 0 10px;font-size:16px;color:#0f172a;font-weight:900}.vehicleDocTitle span{color:#64748b}
      .vehicleDocRow{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:14px;padding:9px;margin-bottom:8px;background:#fbfdff}
      .vehicleDocIcon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;background:#dbeafe;color:#2563eb}.vehicleDocRow:nth-child(3n) .vehicleDocIcon{background:#dcfce7;color:#16a34a}.vehicleDocRow:nth-child(4n) .vehicleDocIcon{background:#ffedd5;color:#f97316}.vehicleDocRow:nth-child(5n) .vehicleDocIcon{background:#fce7f3;color:#db2777}
      .vehicleDocMain b{display:block;color:#0f172a;font-size:14px}.vehicleDocMain small{display:block;color:#64748b;font-size:11px;margin-top:2px}.vehicleDocStatus{text-align:right}.vehicleDocPill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 8px;font-weight:900;font-size:11px;margin-bottom:4px}.vehicleDocPill.ok{background:#dcfce7;color:#16a34a}.vehicleDocPill.warn{background:#fef9c3;color:#a16207}.vehicleDocPill.danger{background:#fee2e2;color:#dc2626}.vehicleDocPill.neutral{background:#e2e8f0;color:#475569}.vehicleDocStatus small{display:block;color:#334155;font-size:11px;font-weight:700}
      .vehicleDetailFooter{background:#eff6ff;color:#1e3a8a;border-radius:12px;padding:10px;text-align:center;font-weight:900;margin-top:10px;font-size:13px}
      .vehicleClickableHint{cursor:pointer}
      @media(max-width:768px){.vehicleDetailOverlay{align-items:center;padding:6px}.vehicleDetailModal{max-width:94vw;border-radius:16px;max-height:84vh}.vehicleDetailHero img{aspect-ratio:16/9}.vehicleDetailBody{margin:-6px 6px 6px;border-radius:14px;padding:10px}.vehicleInfoGrid{grid-template-columns:1fr;gap:8px}.vehicleInfoIcon{width:34px;height:34px}.vehicleInfoBox b{font-size:14px}.vehicleDocRow{grid-template-columns:auto 1fr;gap:8px}.vehicleDocStatus{grid-column:1/3;text-align:left;padding-left:48px}.vehicleDetailClose{right:6px;top:6px;width:30px;height:30px;font-size:20px}.vehicleDocTitle{font-size:15px}}
    `;
    document.head.appendChild(style);
  }

  window.openVehicleDetailPopup = function(){};
})();