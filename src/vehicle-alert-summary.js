(function () {
  const STORAGE_KEY = 'vehicle_document_expiry_app_supabase_v1';
  const state = { filter: 'green', query: '' };

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

  function vehicleText(vehicle) {
    return [vehicle.vehicleNo, vehicle.owner, vehicle.submittedBy, vehicle.mobile, vehicle.model, vehicle.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function getVehicleRows(filter) {
    const query = state.query.trim().toLowerCase();
    return readVehicles()
      .map((vehicle) => {
        const docs = Array.isArray(vehicle.docs) ? vehicle.docs.filter((doc) => docMatches(doc, filter)) : [];
        return { vehicle, docs };
      })
      .filter((row) => row.docs.length > 0)
      .filter((row) => !query || vehicleText(row.vehicle).includes(query))
      .sort((a, b) => String(a.vehicle.vehicleNo || '').localeCompare(String(b.vehicle.vehicleNo || '')));
  }

  function addSearchStyles() {
    if (document.getElementById('alertSearchStyles')) return;
    const style = document.createElement('style');
    style.id = 'alertSearchStyles';
    style.textContent = `
      #alertVehicleSearchWrap{max-width:100%;margin:10px 0 12px;background:#fff;border:1px solid #dbeafe;border-radius:22px;padding:10px;box-shadow:0 8px 22px rgba(37,99,235,.08)}
      #alertVehicleSearchBox{display:flex;align-items:center;gap:10px;background:#f8fbff;border:1px solid #dbeafe;border-radius:18px;padding:10px 12px}
      #alertVehicleSearchBox span{font-size:22px;color:#64748b;line-height:1}
      #alertVehicleSearchInput{width:100%;border:0;background:transparent;outline:none;font-size:16px;color:#0f172a;font-weight:700}
      #alertVehicleSearchInput::placeholder{color:#94a3b8;font-weight:600}
      #alertVehicleSearchClear{border:0;background:#eff6ff;color:#2563eb;font-weight:900;border-radius:14px;padding:8px 12px}
      @media(max-width:768px){#alertVehicleSearchWrap{margin:8px 0 10px;border-radius:18px;padding:8px}#alertVehicleSearchInput{font-size:15px}}
    `;
    document.head.appendChild(style);
  }

  function ensureSearch() {
    addSearchStyles();
    let wrap = document.getElementById('alertVehicleSearchWrap');
    if (wrap) return wrap;
    const target = document.querySelector('.summaryBoxes');
    if (!target) return null;
    wrap = document.createElement('div');
    wrap.id = 'alertVehicleSearchWrap';
    wrap.innerHTML = '<div id="alertVehicleSearchBox"><span>⌕</span><input id="alertVehicleSearchInput" type="search" placeholder="Search by vehicle number, owner name, mobile..." autocomplete="off" /><button id="alertVehicleSearchClear" type="button">Clear</button></div>';
    target.insertAdjacentElement('afterend', wrap);
    const input = wrap.querySelector('#alertVehicleSearchInput');
    const clear = wrap.querySelector('#alertVehicleSearchClear');
    input.value = state.query;
    input.addEventListener('input', () => {
      state.query = input.value;
      renderPanel();
    });
    clear.addEventListener('click', () => {
      state.query = '';
      input.value = '';
      renderPanel();
    });
    return wrap;
  }

  function updateSummaryBoxes() {
    const oldQuery = state.query;
    state.query = '';
    const counts = { red: getVehicleRows('red').length, yellow: getVehicleRows('yellow').length, green: getVehicleRows('green').length };
    state.query = oldQuery;
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
    const search = ensureSearch();
    if (!search) return null;
    panel = document.createElement('section');
    panel.id = 'vehicleAlertSummary';
    panel.className = 'card alertDetails';
    panel.style.marginBottom = '10px';
    search.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function openPremiumPopup(vehicle) {
    if (window.openVehicleDetailPopup) window.openVehicleDetailPopup(vehicle, true);
    else alert((vehicle.vehicleNo || 'Vehicle') + ' details loading. Please refresh once.');
  }

  function renderPanel() {
    hideOldDocumentPanel();
    ensureSearch();
    updateSummaryBoxes();
    const panel = ensurePanel();
    if (!panel) return;
    const rows = getVehicleRows(state.filter);
    const suffix = state.query ? ' - Search Results' : '';
    panel.innerHTML = '<div class="sectionHead"><h2>' + selectedTitle() + suffix + ' (' + rows.length + ')</h2><button class="ghostBtn" type="button" data-refresh-alerts>Refresh</button></div>';
    if (!rows.length) {
      panel.insertAdjacentHTML('beforeend', '<div class="ok">No vehicles found.</div>');
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