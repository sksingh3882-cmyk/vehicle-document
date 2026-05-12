(function () {
  const STYLE_ID = 'vehicleListToggleStyle';
  const BUTTON_ID = 'vehicleListToggleBtn';
  let isVisible = false;

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '\n      .vehicleListHidden{display:none!important}\n      #vehicleListToggleBtn{background:#0f172a!important;color:#fff!important;border:0!important;border-radius:12px!important;padding:10px 14px!important;font-weight:800!important;font-size:13px!important;min-width:112px!important}\n      @media(max-width:768px){#vehicleListToggleBtn{width:100%;padding:11px 14px!important}.vehiclesTop .sectionActions{width:100%;display:flex;gap:8px}}\n    ';
    document.head.appendChild(style);
  }

  function findVehicleList() {
    const vehiclesTop = document.querySelector('.vehiclesTop');
    if (!vehiclesTop) return null;
    let next = vehiclesTop.nextElementSibling;
    while (next && next.tagName !== 'MAIN') next = next.nextElementSibling;
    return next;
  }

  function applyState(button) {
    const list = findVehicleList();
    if (!list) return;
    list.classList.toggle('vehicleListHidden', !isVisible);
    button.textContent = isVisible ? 'Hide Vehicles' : 'Show Vehicles';
  }

  function setupToggle() {
    addStyles();
    const vehiclesTop = document.querySelector('.vehiclesTop');
    const list = findVehicleList();
    if (!vehiclesTop || !list) return;

    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.onclick = function () {
        isVisible = !isVisible;
        applyState(button);
      };
      vehiclesTop.appendChild(button);
    }

    applyState(button);
  }

  const timer = setInterval(setupToggle, 800);
  setTimeout(function () {
    clearInterval(timer);
    setupToggle();
  }, 15000);
})();
