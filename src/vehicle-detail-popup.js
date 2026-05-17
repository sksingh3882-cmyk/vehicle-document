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
      .vehicleDetailOverlay{position:fixed;inset:0;background:rgba(15,23,42,.68);z-index:999999;padding:12px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
      .vehicleDetailModal{width:100%;max-width:780px;max-height:92vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 28px 80px rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.8);position:relative}
      .vehicleDetailClose{position:absolute;right:12px;top:12px;width:38px;height:38px;border-radius:50%;border:1px solid #dbeafe;background:#fff;color:#0f172a;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:3;box-shadow:0 8px 18px rgba(15,23,42,.12)}
      .vehicleDetailHero{position:relative;background:linear-gradient(180deg,#eaf3ff,#fff);border-radius:24px 24px 0 0;overflow:hidden;text-align:center;padding:0}
      .vehicleDetailHero img{width:100%;display:block;aspect-ratio:16/7;object-fit:cover;object-position:center}
      .vehicleDetailBody{margin:-16px 18px 18px;background:#fff;border-radius:20px;position:relative;z-index:2;padding:18px;box-shadow:0 12px 30px rgba(37,99,235,.08);border:1px solid #e2e8f0}
      .vehicleInfoGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;border-bottom:1px solid #e2e8f0;padding-bottom:14px;margin-bottom:14px}
      .vehicleInfoBox{display:flex;align-items:center;gap:10px;min-width:0}
      .vehicleInfoIcon{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:21px;background:#eff6ff;color:#2563eb;flex:0 0 auto}
      .vehicleInfoBox:nth-child(2) .vehicleInfoIcon{background:#f3e8ff;color:#9333ea}.vehicleInfoBox:nth-child(3) .vehicleInfoIcon{background:#dcfce7;color:#16a34a}
      .vehicleInfoBox small{display:block;color:#64748b;font-weight:800;font-size:12px;margin-bottom:3px}.vehicleInfoBox b{display:block;color:#0f172a;font-size:17px;line-height:1.15;word-break:break-word}
      .vehicleDocTitle{display:flex;align-items:center;gap:8px;margin:4px 0 12px;font-size:18px;color:#0f172a;font-weight:900}.vehicleDocTitle span{color:#64748b}
      .vehicleDocRow{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border:1px solid #e2e8f0;border-radius:16px;padding:11px;margin-bottom:9px;background:#fbfdff}
      .vehicleDocIcon{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;background:#dbeafe;color:#2563eb}.vehicleDocRow:nth-child(3n) .vehicleDocIcon{background:#dcfce7;color:#16a34a}.vehicleDocRow:nth-child(4n) .vehicleDocIcon{background:#ffedd5;color:#f97316}.vehicleDocRow:nth-child(5n) .vehicleDocIcon{background:#fce7f3;color:#db2777}
      .vehicleDocMain b{display:block;color:#0f172a;font-size:15px}.vehicleDocMain small{display:block;color:#64748b;font-size:12px;margin-top:2px}.vehicleDocStatus{text-align:right}.vehicleDocPill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:6px 10px;font-weight:900;font-size:12px;margin-bottom:4px}.vehicleDocPill.ok{background:#dcfce7;color:#16a34a}.vehicleDocPill.warn{background:#fef9c3;color:#a16207}.vehicleDocPill.danger{background:#fee2e2;color:#dc2626}.vehicleDocPill.neutral{background:#e2e8f0;color:#475569}.vehicleDocStatus small{display:block;color:#334155;font-size:12px;font-weight:700}
      .vehicleDetailFooter{background:#eff6ff;color:#1e3a8a;border-radius:14px;padding:12px;text-align:center;font-weight:900;margin-top:12px}
      .vehicleClickableHint{cursor:pointer}
      @media(max-width:768px){.vehicleDetailOverlay{align-items:flex-start;padding:8px}.vehicleDetailModal{border-radius:18px;max-height:96vh}.vehicleDetailHero img{aspect-ratio:16/9}.vehicleDetailBody{margin:-8px 8px 8px;border-radius:16px;padding:12px}.vehicleInfoGrid{grid-template-columns:1fr;gap:9px}.vehicleInfoIcon{width:40px;height:40px}.vehicleInfoBox b{font-size:15px}.vehicleDocRow{grid-template-columns:auto 1fr;gap:10px}.vehicleDocStatus{grid-column:1/3;text-align:left;padding-left:56px}.vehicleDetailClose{right:8px;top:8px;width:34px;height:34px;font-size:22px}.vehicleDocTitle{font-size:16px}}
    `;
    document.head.appendChild(style);
  }

  function openVehiclePopup(vehicle) {
    if (!vehicle) return;
    addStyles();
    const old = document.getElementById('vehicleDetailOverlay');
    if (old) old.remove();

    const docs = Array.isArray(vehicle.docs) ? vehicle.docs : [];
    const rows = docs.length ? docs.map((doc) => {
      const s = statusInfo(doc.expiryDate);
      return '<div class="vehicleDocRow"><div class="vehicleDocIcon">📄</div><div class="vehicleDocMain"><b>' + esc(doc.name || 'Document') + '</b><small>Vehicle document validity status</small></div><div class="vehicleDocStatus"><span class="vehicleDocPill ' + s.cls + '">● ' + esc(s.label) + '</span><small>' + esc(s.date) + '</small></div></div>';
    }).join('') : '<div class="vehicleDocRow"><div class="vehicleDocIcon">📄</div><div class="vehicleDocMain"><b>No documents added</b><small>Please add document details</small></div><div class="vehicleDocStatus"><span class="vehicleDocPill neutral">● Missing</span><small>Date missing</small></div></div>';

    const anyDanger = docs.some((doc) => ['danger', 'warn'].includes(statusInfo(doc.expiryDate).cls));
    const footer = anyDanger ? 'Some documents need attention. Please review and renew on time.' : 'All documents are verified and up to date.';

    const overlay = document.createElement('div');
    overlay.id = 'vehicleDetailOverlay';
    overlay.className = 'vehicleDetailOverlay';
    overlay.innerHTML = '<div class="vehicleDetailModal"><button class="vehicleDetailClose" type="button" aria-label="Close">×</button><div class="vehicleDetailHero"><img src="' + BANNER_SRC + '" alt="Realtime Vehicle Document Tracking System" /></div><div class="vehicleDetailBody"><div class="vehicleInfoGrid"><div class="vehicleInfoBox"><div class="vehicleInfoIcon">👤</div><div><small>Name</small><b>' + esc(vehicle.owner || vehicle.submittedBy || 'Not added') + '</b></div></div><div class="vehicleInfoBox"><div class="vehicleInfoIcon">📞</div><div><small>Mobile No.</small><b>' + esc(vehicle.mobile || 'Not added') + '</b></div></div><div class="vehicleInfoBox"><div class="vehicleInfoIcon">🚗</div><div><small>Vehicle No.</small><b>' + esc(vehicle.vehicleNo || 'Vehicle No Missing') + '</b></div></div></div><div class="vehicleDocTitle"><span>▣</span> Document Details</div>' + rows + '<div class="vehicleDetailFooter">🛡️ ' + esc(footer) + '</div></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('.vehicleDetailClose')) overlay.remove();
    });
  }

  function attachClicks() {
    addStyles();
    document.querySelectorAll('.upVehicle, .vehicleCard, .vehicleAlertItem, .alertItem').forEach((el) => {
      if (el.dataset.vehiclePopupReady === 'yes') return;
      el.dataset.vehiclePopupReady = 'yes';
      el.classList.add('vehicleClickableHint');
      el.addEventListener('click', (event) => {
        if (event.target.closest('button,input,select,a')) return;
        const vehicle = findVehicleFromText(el.textContent || '');
        if (vehicle) {
          event.stopPropagation();
          openVehiclePopup(vehicle);
        }
      }, true);
    });
  }

  window.openVehicleDetailPopup = openVehiclePopup;
  const timer = setInterval(attachClicks, 700);
  setTimeout(() => clearInterval(timer), 20000);
  document.addEventListener('visibilitychange', attachClicks);
})();
