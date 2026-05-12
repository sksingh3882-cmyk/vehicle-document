(function () {
  const STORAGE_KEY = 'vehicle_document_expiry_app_supabase_v1';
  const originalOpen = window.open;

  function readVehicles() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function normalize(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function findVehicleFromMessage(message) {
    const vehicles = readVehicles();
    const upperMessage = normalize(message);

    return vehicles.find((vehicle) => {
      const vehicleNo = normalize(vehicle.vehicleNo);
      if (vehicleNo && upperMessage.includes(vehicleNo)) return true;

      const model = normalize(vehicle.model);
      const mobile = String(vehicle.mobile || '').replace(/\D/g, '');
      return model && mobile && upperMessage.includes(model) && upperMessage.includes(mobile);
    }) || null;
  }

  function addVehicleNumberToText(text) {
    if (!text || !text.includes('Vehicle Document Alert')) return text;
    if (/Vehicle\s*(No|Number)\s*:/i.test(text)) return text;

    const vehicle = findVehicleFromMessage(text);
    if (!vehicle || !vehicle.vehicleNo) return text;

    return text.replace(
      'Vehicle Category:',
      'Vehicle Number: ' + vehicle.vehicleNo + '\nVehicle Category:'
    );
  }

  window.open = function patchedOpen(url, target, features) {
    try {
      const value = String(url || '');
      if (value.includes('wa.me/') && value.includes('text=')) {
        const splitUrl = value.split('text=');
        const beforeText = splitUrl[0];
        const encodedText = splitUrl.slice(1).join('text=');
        const decodedText = decodeURIComponent(encodedText);
        const fixedText = addVehicleNumberToText(decodedText);
        if (fixedText !== decodedText) {
          return originalOpen.call(window, beforeText + 'text=' + encodeURIComponent(fixedText), target, features);
        }
      }
    } catch (error) {
      // Fallback to original WhatsApp link if patch cannot parse it.
    }

    return originalOpen.call(window, url, target, features);
  };
})();
