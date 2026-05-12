(function () {
  const originalOpen = window.open;
  let lastClickedVehicleNo = '';

  function cleanVehicleNo(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function extractVehicleNoFromText(text) {
    const value = String(text || '').trim();
    const match = value.match(/\b[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,5}\b/i);
    return match ? cleanVehicleNo(match[0]) : '';
  }

  function captureClickedVehicleNo(event) {
    const button = event.target && event.target.closest ? event.target.closest('.waBtn') : null;
    if (!button) return;

    const vehicleCard = button.closest('.vehicleCard');
    if (vehicleCard) {
      const heading = vehicleCard.querySelector('h2');
      const vehicleNo = extractVehicleNoFromText(heading && heading.textContent);
      if (vehicleNo) {
        lastClickedVehicleNo = vehicleNo;
        return;
      }
    }

    const alertRow = button.closest('.alertItem');
    if (alertRow) {
      const bold = alertRow.querySelector('b');
      const vehicleNo = extractVehicleNoFromText(bold && bold.textContent);
      if (vehicleNo) lastClickedVehicleNo = vehicleNo;
    }
  }

  function addVehicleNumberToText(text) {
    if (!text || !text.includes('Vehicle Document Alert')) return text;
    if (/Vehicle\s*(No|Number)\s*:/i.test(text)) return text;
    if (!lastClickedVehicleNo) return text;

    const line = 'Vehicle Number: ' + lastClickedVehicleNo;

    if (/Mobile Number:[^\n]*\n/i.test(text)) {
      return text.replace(/(Mobile Number:[^\n]*\n)/i, '$1' + line + '\n');
    }

    if (text.includes('Vehicle Category:')) {
      return text.replace('Vehicle Category:', line + '\nVehicle Category:');
    }

    return text.replace('Vehicle Document Alert ⚠️\n\n', 'Vehicle Document Alert ⚠️\n\n' + line + '\n');
  }

  document.addEventListener('click', captureClickedVehicleNo, true);

  window.open = function patchedOpen(url, target, features) {
    try {
      const value = String(url || '');
      if (value.includes('wa.me/') && value.includes('text=')) {
        const textIndex = value.indexOf('text=');
        const beforeText = value.slice(0, textIndex + 5);
        const encodedText = value.slice(textIndex + 5);
        const decodedText = decodeURIComponent(encodedText);
        const fixedText = addVehicleNumberToText(decodedText);
        return originalOpen.call(window, beforeText + encodeURIComponent(fixedText), target, features);
      }
    } catch (error) {
      // Fallback to original WhatsApp link if patch cannot parse it.
    }

    return originalOpen.call(window, url, target, features);
  };
})();
