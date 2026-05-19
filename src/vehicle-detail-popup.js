(function () {
  const STORAGE_KEY = 'vehicle_document_expiry_app_supabase_v1';
  const BANNER = '/popup-banner.png';

  function vehicles() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function esc(v) { return String(v || ''); }

  function findVehicle(text) {
    const upper = String(text || '').toUpperCase();
    return vehicles().find(v => upper.includes(String(v.vehicleNo || '').toUpperCase()));
  }

  function daysLeft(date) {
    if (!date) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(date); d.setHours(0,0,0,0);
    return Math.ceil((d - today) / 86400000);
  }

  function formatDate(date) {
    if (!date) return 'Date missing';
    try { return new Date(date).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }); }
    catch { return date; }
  }

  function validity(date) {
    const d = daysLeft(date);
    if (d === null) return { text:'Missing', color:'#64748b' };
    if (d < 0) return { text:`${Math.abs(d)} days expired`, color:'#dc2626' };
    return { text:`${d} days left`, color:'#16a34a' };
  }

  function pdfRows(vehicle) {
    return (vehicle.docs || []).map(doc => {
      const v = validity(doc.expiryDate);
      return `<tr><td>${esc(doc.name)}</td><td>${formatDate(doc.expiryDate)}</td><td style="color:${v.color};font-weight:700">${v.text}</td></tr>`;
    }).join('');
  }

  function openPdf(vehicle) {
    const html = `<!doctype html><html><head><title>Vehicle Report</title><style>
      @page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#fff;color:#111827}.page{width:100%}.banner{width:100%;border-radius:16px;overflow:hidden}.banner img{width:100%;display:block}.title{text-align:center;font-size:30px;font-weight:900;margin:18px 0}.info{border:2px solid #bfdbfe;border-radius:16px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.item small{display:block;color:#64748b;font-size:14px;margin-bottom:4px}.item div{font-size:18px;font-weight:800}.section{font-size:14px;font-weight:900;margin:18px 0 14px}table{width:100%;border-collapse:collapse}th{background:#2563eb;color:white;padding:14px;font-size:16px}td{border:1px solid #cbd5e1;padding:14px;font-size:16px;font-weight:700}.footer{margin-top:6px;border-radius:16px;padding:4px;text-align:center}.footer h1{margin:0;font-size:22px}.footer h2{margin:10px 0 4px;font-size:14px}.footer p{margin:0;color:#2563eb;font-size:11px;font-weight:900}
    </style></head><body><div class="page"><div class="banner"><img src="${BANNER}"></div><div class="title">VEHICLE DOCUMENT REPORT</div><div class="info"><div class="item"><small>Name</small><div>${esc(vehicle.owner || 'Not added')}</div></div><div class="item"><small>Vehicle No</small><div>${esc(vehicle.vehicleNo)}</div></div><div class="item"><small>Mobile No</small><div>${esc(vehicle.mobile || 'Not added')}</div></div><div class="item"><small>Model</small><div>${esc(vehicle.model || 'Not added')}</div></div></div><div class="section">📋 Document Details</div><table><thead><tr><th>Document</th><th>Expiry Date</th><th>Validity</th></tr></thead><tbody>${pdfRows(vehicle)}</tbody></table><div class="footer"><div style="color:#dc2626;font-size:13px;font-weight:900;line-height:1.5;margin-bottom:10px">Note:- All information is absolutely correct and has been uploaded in the app only after verification from the mParivahan app.</div><h1>Thank You!</h1><h2>Realtime Vehicle Document Tracking System</h2><p>By Sanjay Singh</p> </div></div><script>setTimeout(()=>window.print(),700)<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return alert('Popup blocked');
    w.document.write(html); w.document.close();
  }

  function popupDocs(vehicle) {
    return (vehicle.docs || []).map(doc => {
      const v = validity(doc.expiryDate);
      return `<div style="padding:6px 0;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:8px"><div><div style="font-size:15px;font-weight:900">${esc(doc.name)}</div><div style="margin-top:1px;font-size:13px;color:#334155">${formatDate(doc.expiryDate)}</div></div><div style="font-size:12px;color:${v.color};font-weight:900;text-align:right;white-space:nowrap">${v.text}</div></div>`;
    }).join('');
  }

  function openPopup(vehicle) {
    const old = document.getElementById('vehiclePopup');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'vehiclePopup';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:8px';
    wrap.innerHTML = `<div style="width:92%;max-width:360px;background:white;border-radius:16px;overflow:hidden;max-height:88vh;overflow:auto;position:relative;box-shadow:0 18px 45px rgba(0,0,0,.28)"><img src="${BANNER}" style="width:100%;display:block"><button id="closePopup" style="position:absolute;top:7px;right:7px;width:30px;height:30px;border:none;border-radius:50%;background:white;font-size:20px;font-weight:900;line-height:1">×</button><div style="padding:10px"><div style="font-size:14px;line-height:1.35;margin-bottom:8px"><b>Name:</b> ${esc(vehicle.owner || 'Not added')}<br><b>Mobile:</b> ${esc(vehicle.mobile || 'Not added')}<br><b>Vehicle:</b> ${esc(vehicle.vehicleNo)}</div><div style="font-size:18px;font-weight:900;margin-bottom:6px">Document Details</div>${popupDocs(vehicle)}<div style="margin-top:8px;text-align:center; border-top:1px solid #e2e8f0;padding-top:8px"><div style="color:#dc2626;font-size:11px;font-weight:900;line-height:1.4;margin-bottom:6px;text-align:center">Note:- All information is absolutely correct and has been uploaded in the app only after verification from the mParivahan app.</div><div style="font-size:13px;font-weight:900">Realtime Vehicle Document Tracking System</div><div style="color:#2563eb;font-weight:900;margin-top:2px;font-size:12px">By Sanjay Singh</div></div><button id="downloadPdfBtn" style="width:100%;margin-top:8px;border:none;background:#2563eb;color:white;padding:10px;border-radius:12px;font-size:14px;font-weight:900">Download PDF</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.onclick = (e) => {
      if (e.target === wrap || e.target.id === 'closePopup') wrap.remove();
      if (e.target.id === 'downloadPdfBtn') openPdf(vehicle);
    };
  }

  function attach() {
    document.querySelectorAll('.upVehicle,.vehicleAlertItem').forEach(el => {
      if (el.dataset.popupReady) return;
      el.dataset.popupReady = '1';
      el.style.cursor = 'pointer';
      el.addEventListener('click', e => {
        if (e.target.closest('button,a,input')) return;
        const vehicle = findVehicle(el.textContent);
        if (vehicle) { e.stopPropagation(); openPopup(vehicle); }
      }, true);
    });
  }
    window.openVehicleDetailPopup = openPopup;
  window.openPopupStyleVehiclePdf = openPdf;

  setInterval(attach,1000);
})();
