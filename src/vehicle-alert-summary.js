(function () {
  const STORAGE_KEY = 'vehicle_document_expiry_app_supabase_v1';
  const state = { filter: 'green' };

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

  function openPremiumPopup(vehicle) {
    if (window.openVehicleDetailPopup) {
      window.openVehicleDetailPopup(vehicle);
    } else {
      alert((vehicle.vehicleNo || 'Vehicle') + ' details loading. Please refresh once.');
    }
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
      item.innerHTML = '<div><b>' + (vehicle.vehicleNo || 'Vehicle No Missing') + '</b><small>' + docs.length + ' document(s) in this alert. Tap vehicle number to view full details.</small></div>';
      item.onclick = () => openPremiumPopup(vehicle);
      panel.appendChild(item);
    });
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