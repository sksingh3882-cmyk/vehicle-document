(function () {
  const STORAGE_KEY = 'vehicle_document_expiry_app_supabase_v1';
  const state = { filter: 'green', popup: null };

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

  function statusLabel(expiryDate) {
    const days = daysLeft(expiryDate);
    if (days === null) return 'Date missing';
    if (days < 0) return 'Failed ' + Math.abs(days) + ' days ago';
    if (days === 0) return 'Failed today';
    if (days <= 30) return days + ' days left';
    return days + ' days left';
  }

  function docMatches(doc, filter) {
    const d = daysLeft(doc && doc.expiryDate);
    if (filter === 'red') return d !== null && d <= 0;
    if (filter === 'yellow') return d !== null && d > 0 && d <= 30;
    return d !== null && d > 30;
  }

  function getVehicleRows(filter) {
    return readVehicles()
      .map((vehicle) => {
        const docs = Array.isArray(vehicle.docs) ? vehicle.docs.filter((doc) => docMatches(doc, filter)) : [];
        return { vehicle, docs };
      })
      .filter((row) => row.docs.length > 0)
      .sort((a, b) => String(a.vehicle.vehicleNo || '').localeCompare(String(b.vehicle.vehicleNo || '')));
  }

  function updateSummaryBoxes() {
    const counts = {
      red: getVehicleRows('red').length,
      yellow: getVehicleRows('yellow').length,
      green: getVehicleRows('green').length
    };
    document.querySelectorAll('.summaryBox').forEach((box) => {
      const text = box.textContent || '';
      let key = '';
      if (text.includes('Red Alert')) key = 'red';
      if (text.includes('Yellow Alert')) key = 'yellow';
      if (text.includes('Green Alert')) key = 'green';
      if (!key) return;
      const strong = box.querySelector('strong');
      const small = box.querySelector('small');
      if (strong) strong.textContent = String(counts[key]);
      if (small) small.textContent = key === 'red' ? 'Failed vehicles' : key === 'yellow' ? 'Expiring vehicles' : 'Valid vehicles';
      box.classList.toggle('activeSummary', state.filter === key);
    });
  }

  function selectedTitle() {
    if (state.filter === 'red') return 'Red Alert - Failed Vehicles';
    if (state.filter === 'yellow') return 'Yellow Alert - Expiring Vehicles';
    return 'Green Alert - Valid Vehicles';
  }

  function hideOldDocumentPanel() {
    document.querySelectorAll('.alertDetails').forEach((panel) => {
      if (panel.id !== 'vehicleAlertSummary') panel.style.display = 'none';
    });
  }

  function ensurePanel() {
    let panel = document.getElementById('vehicleAlertSummary');
    if (panel) return panel;
    const target = document.querySelector('.summaryBoxes');
    if (!target) return null;
    panel = document.createElement('section');
    panel.id = 'vehicleAlertSummary';
    panel.className = 'card alertDetails';
    panel.style.marginBottom = '10px';
    target.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function renderPanel() {
    hideOldDocumentPanel();
    updateSummaryBoxes();
    const panel = ensurePanel();
    if (!panel) return;
    const rows = getVehicleRows(state.filter);
    panel.innerHTML = '<div class="sectionHead"><h2>' + selectedTitle() + ' (' + rows.length + ')</h2><button class="ghostBtn" type="button" data-refresh-alerts>Refresh</button></div>';
    if (!rows.length) {
      panel.insertAdjacentHTML('beforeend', '<div class="ok">No vehicles in this category.</div>');
      return;
    }
    rows.forEach(({ vehicle, docs }) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'alertItem vehicleAlertItem';
      item.style.width = '100%';
      item.style.textAlign = 'left';
      item.style.background = '#fbfdff';
      item.innerHTML = '<div><b>' + (vehicle.vehicleNo || 'Vehicle No Missing') + ' - ' + (vehicle.category || 'Category') + ' - ' + (vehicle.model || 'Model not added') + '</b><small>' + (vehicle.owner || 'Owner not added') + (vehicle.mobile ? ' • ' + vehicle.mobile : '') + '</small><small>' + docs.length + ' document(s) in this category. Tap to view.</small></div>';
      item.onclick = () => openPopup(vehicle, docs);
      panel.appendChild(item);
    });
  }

  function openPopup(vehicle, docs) {
    closePopup();
    const overlay = document.createElement('div');
    overlay.id = 'vehicleAlertPopup';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:99999;padding:14px;display:flex;align-items:center;justify-content:center;';
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'width:100%;max-width:460px;max-height:86vh;overflow:auto;border-radius:18px;';
    card.innerHTML = '<div class="sectionHead"><h2>' + (vehicle.vehicleNo || 'Vehicle') + '</h2><button class="ghostBtn" type="button" data-close-alert-popup>Close</button></div><p style="margin:0 0 8px;color:#64748b;font-size:12px">' + (vehicle.category || 'Category') + ' • ' + (vehicle.model || 'Model not added') + '<br>' + (vehicle.owner || 'Owner not added') + (vehicle.mobile ? ' • ' + vehicle.mobile : '') + '</p>';
    docs.forEach((doc) => {
      const row = document.createElement('div');
      row.className = 'alertItem';
      row.innerHTML = '<div><b>' + (doc.name || 'Document') + '</b><small>' + formatDate(doc.expiryDate) + ' • ' + statusLabel(doc.expiryDate) + '</small></div>';
      card.appendChild(row);
    });
    overlay.appendChild(card);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-close-alert-popup]')) closePopup();
    });
    document.body.appendChild(overlay);
    state.popup = overlay;
  }

  function closePopup() {
    const old = document.getElementById('vehicleAlertPopup');
    if (old) old.remove();
    state.popup = null;
  }

  document.addEventListener('click', (event) => {
    const summary = event.target.closest('.summaryBox');
    if (summary) {
      const text = summary.textContent || '';
      if (text.includes('Red Alert')) state.filter = 'red';
      if (text.includes('Yellow Alert')) state.filter = 'yellow';
      if (text.includes('Green Alert')) state.filter = 'green';
      setTimeout(renderPanel, 0);
    }
    if (event.target.closest('[data-refresh-alerts]')) renderPanel();
  }, true);

  const timer = setInterval(renderPanel, 900);
  setTimeout(() => clearInterval(timer), 15000);
  window.addEventListener('storage', renderPanel);
  document.addEventListener('visibilitychange', renderPanel);
})();
