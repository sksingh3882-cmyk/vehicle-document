(function () {
  const STORAGE_KEY = 'vehicle_document_expiry_app_supabase_v1';
  const TARGET_DOCS = ['Insurance', 'PUC', 'Fitness', 'Tax'];
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  function readVehicles() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function saveVehicles(vehicles) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/0/g, 'o').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeDate(raw) {
    if (!raw) return '';
    const clean = String(raw).replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();
    const months = { jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12 };
    const numeric = clean.match(/(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2,4})/);
    if (numeric) {
      let day = Number(numeric[1]);
      let month = Number(numeric[2]);
      let year = Number(numeric[3]);
      if (year < 100) year += 2000;
      if (month > 12 && day <= 12) {
        const temp = day; day = month; month = temp;
      }
      return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
    }
    const dayMonthYear = clean.match(/(\d{1,2})\s*[-\/\.]?\s*([A-Za-z]{3,9})\s*[-\/\.]?\s*(\d{2,4})/i);
    if (dayMonthYear) {
      const day = Number(dayMonthYear[1]);
      const month = months[dayMonthYear[2].toLowerCase()];
      let year = Number(dayMonthYear[3]);
      if (year < 100) year += 2000;
      if (month) return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
    }
    return '';
  }

  function getDatePattern() {
    return /(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4}|\d{1,2}\s*[-\/\.]?\s*[A-Za-z]{3,9}\s*[-\/\.]?\s*\d{2,4})/i;
  }

  function pickDateNearKeyword(text, keywords) {
    const lines = String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const datePattern = getDatePattern();
    for (let i = 0; i < lines.length; i++) {
      const lower = normalizeText(lines[i]);
      if (keywords.some((kw) => lower.includes(kw))) {
        const nearby = [lines[i], lines[i + 1] || '', lines[i + 2] || '', lines[i + 3] || ''].join(' ');
        const match = nearby.match(datePattern);
        const normalized = normalizeDate(match && match[1]);
        if (normalized) return normalized;
      }
    }
    return '';
  }

  function extractDates(text) {
    return {
      Insurance: pickDateNearKeyword(text, ['insurance', 'insur', 'policy']),
      PUC: pickDateNearKeyword(text, ['pucc', 'puc', 'pollution']),
      Fitness: pickDateNearKeyword(text, ['fitness', 'fit upto']),
      Tax: pickDateNearKeyword(text, ['tax valid', 'road tax'])
    };
  }

  function loadTesseract() {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) return resolve(window.Tesseract);
      const script = document.createElement('script');
      script.src = TESSERACT_URL;
      script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR library load failed'));
      script.onerror = () => reject(new Error('OCR library download failed'));
      document.head.appendChild(script);
    });
  }

  function ensureDoc(vehicle, docName, expiryDate) {
    const docs = Array.isArray(vehicle.docs) ? [...vehicle.docs] : [];
    const index = docs.findIndex((item) => String(item.name || '').toLowerCase() === docName.toLowerCase());
    if (index >= 0) docs[index] = { ...docs[index], expiryDate };
    else docs.push({ name: docName, expiryDate });
    return { ...vehicle, docs, updatedAt: new Date().toISOString() };
  }

  function applyExtractedData(vehicleId, extracted) {
    const vehicles = readVehicles();
    const next = vehicles.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      let updated = { ...vehicle };
      TARGET_DOCS.forEach((docName) => {
        if (extracted[docName]) updated = ensureDoc(updated, docName, extracted[docName]);
      });
      return updated;
    });
    saveVehicles(next);
  }

  function renderPreview(container, extracted) {
    const rows = TARGET_DOCS.map((docName) => '<label style="display:block;margin:8px 0;font-size:12px;font-weight:700">' + docName + '<input data-doc="' + docName + '" type="date" value="' + (extracted[docName] || '') + '" style="width:100%;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:10px" /></label>').join('');
    container.querySelector('.ocrPreview').innerHTML = rows;
  }

  function addPanel() {
    if (document.getElementById('screenshotImportPanel')) return;
    const vehiclesTop = document.querySelector('.vehiclesTop');
    if (!vehiclesTop) return;

    const panel = document.createElement('section');
    panel.id = 'screenshotImportPanel';
    panel.className = 'card';
    panel.style.marginBottom = '10px';

    panel.innerHTML = '<div class="sectionHead"><h2>Import Screenshot</h2></div><p style="font-size:12px;color:#64748b;margin:0 0 8px">Upload vehicle document screenshot to automatically detect Insurance, PUC, Fitness and Tax dates.</p><select class="ocrVehicle" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:12px;margin-bottom:8px"></select><input class="ocrFile" type="file" accept="image/*" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:12px;margin-bottom:8px" /><button class="ocrRead" style="background:#2563eb;color:white;border:0;border-radius:10px;padding:10px 14px;font-weight:700">Read Screenshot</button><div class="ocrStatus" style="font-size:12px;color:#64748b;margin-top:8px">No screenshot selected.</div><div class="ocrPreview" style="margin-top:8px"></div><button class="ocrApply" style="display:none;background:#16a34a;color:white;border:0;border-radius:10px;padding:10px 14px;font-weight:700;margin-top:8px">Confirm & Save Dates</button>';

    vehiclesTop.insertAdjacentElement('beforebegin', panel);

    const vehicleSelect = panel.querySelector('.ocrVehicle');
    const status = panel.querySelector('.ocrStatus');
    const fileInput = panel.querySelector('.ocrFile');
    const applyButton = panel.querySelector('.ocrApply');
    let extracted = {};

    function refreshVehicles() {
      const vehicles = readVehicles();
      const currentValue = vehicleSelect.value;
      if (!vehicles.length) {
        vehicleSelect.innerHTML = '<option value="">Loading vehicles...</option>';
        return false;
      }
      vehicleSelect.innerHTML = vehicles.map((vehicle) => '<option value="' + vehicle.id + '">' + (vehicle.vehicleNo || 'Vehicle') + ' - ' + (vehicle.model || 'Model') + '</option>').join('');
      if (currentValue) vehicleSelect.value = currentValue;
      return true;
    }

    refreshVehicles();
    const refreshTimer = setInterval(() => {
      if (refreshVehicles()) clearInterval(refreshTimer);
    }, 1500);
    vehicleSelect.addEventListener('focus', refreshVehicles);
    window.addEventListener('storage', refreshVehicles);

    panel.querySelector('.ocrRead').onclick = async () => {
      refreshVehicles();
      const file = fileInput.files && fileInput.files[0];
      if (!file) return alert('Pehle screenshot select karo.');

      try {
        status.textContent = 'OCR library loading...';
        const Tesseract = await loadTesseract();
        status.textContent = 'Reading screenshot...';
        const result = await Tesseract.recognize(file, 'eng', {
          logger: (m) => {
            if (m && m.status) {
              status.textContent = 'OCR: ' + m.status + (m.progress ? ' ' + Math.round(m.progress * 100) + '%' : '');
            }
          }
        });
        const text = result && result.data ? result.data.text : '';
        extracted = extractDates(text);
        renderPreview(panel, extracted);
        applyButton.style.display = 'inline-block';
        const foundCount = TARGET_DOCS.filter((docName) => extracted[docName]).length;
        status.textContent = foundCount + ' date found. Preview check karo.';
      } catch (error) {
        status.textContent = 'OCR failed: ' + (error.message || 'unknown error');
      }
    };

    applyButton.onclick = () => {
      refreshVehicles();
      const vehicleId = vehicleSelect.value;
      if (!vehicleId) return alert('Vehicle select nahi hai.');
      const edited = {};
      panel.querySelectorAll('.ocrPreview input[data-doc]').forEach((input) => {
        edited[input.dataset.doc] = input.value;
      });
      applyExtractedData(vehicleId, edited);
      alert('Vehicle Data Saved Successfully ✅');
      location.reload();
    };
  }

  const timer = setInterval(addPanel, 800);
  setTimeout(() => {
    clearInterval(timer);
    addPanel();
  }, 12000);
})();