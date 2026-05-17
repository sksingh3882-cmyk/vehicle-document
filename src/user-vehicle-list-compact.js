(function () {
  const STORAGE_KEY = 'vehicle_document_expiry_app_supabase_v1';

  function readVehicles() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function findVehicle(text) {
    const upper = String(text || '').toUpperCase();
    return readVehicles().find((vehicle) => vehicle.vehicleNo && upper.includes(String(vehicle.vehicleNo).toUpperCase()));
  }

  function addStyles() {
    if (document.getElementById('compactUserVehicleStyles')) return;
    const style = document.createElement('style');
    style.id = 'compactUserVehicleStyles';
    style.textContent = `
      .upVehicle.compactUserVehicle {
        display: grid !important;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 12px;
        padding: 16px 18px !important;
        min-height: 66px;
        cursor: pointer;
        background: #ffffff !important;
      }
      .upVehicle.compactUserVehicle::before {
        content: '🚘';
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #eff6ff;
        color: #2563eb;
        font-size: 20px;
      }
      .upVehicle.compactUserVehicle::after {
        content: '›';
        color: #64748b;
        font-size: 32px;
        line-height: 1;
      }
      .upVehicle.compactUserVehicle b {
        margin: 0 !important;
        font-size: 20px;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: .2px;
      }
      .upVehicle.compactUserVehicle .upDocRow,
      .upVehicle.compactUserVehicle button {
        display: none !important;
      }
      @media (max-width: 768px) {
        .upVehicle.compactUserVehicle {
          padding: 14px 16px !important;
          min-height: 62px;
          border-radius: 16px;
        }
        .upVehicle.compactUserVehicle b {
          font-size: 18px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function compactList() {
    addStyles();
    document.querySelectorAll('.upVehicle').forEach((card) => {
      const vehicle = findVehicle(card.textContent || '');
      if (!vehicle) return;
      card.classList.add('compactUserVehicle');
      const title = card.querySelector('b');
      if (title) title.textContent = String(vehicle.vehicleNo || '').toUpperCase();
      card.querySelectorAll('.upDocRow, button').forEach((item) => {
        item.style.display = 'none';
      });
    });
  }

  const timer = setInterval(compactList, 700);
  setTimeout(() => clearInterval(timer), 20000);
  document.addEventListener('visibilitychange', compactList);
})();
