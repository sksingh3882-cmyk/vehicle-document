(function(){
  const VEHICLE_KEY='vehicle_document_expiry_app_supabase_v1';
  const USER_KEY='vehicle_user_page_v1';
  const BANNER='/popup-banner.png';
  const state={filter:'green'};

  function cleanMobile(v){return String(v||'').replace(/\D/g,'').slice(-10)}
  function readUser(){try{return JSON.parse(localStorage.getItem(USER_KEY)||'null')}catch{return null}}
  function readVehicles(){try{const d=JSON.parse(localStorage.getItem(VEHICLE_KEY)||'[]');return Array.isArray(d)?d:[]}catch{return[]}}
  function myVehicles(){const u=readUser();if(!u)return[];return readVehicles().filter(v=>cleanMobile(v.mobile)===cleanMobile(u.mobile))}
  function esc(v){return String(v||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function daysLeft(date){if(!date)return null;const today=new Date();today.setHours(0,0,0,0);const d=new Date(date);d.setHours(0,0,0,0);return Math.ceil((d-today)/86400000)}
  function docMatch(doc,filter){const d=daysLeft(doc&&doc.expiryDate);if(filter==='red')return d!==null&&d<=0;if(filter==='yellow')return d!==null&&d>0&&d<=30;return d!==null&&d>30}
  function vehicleRows(filter){return myVehicles().map(v=>({vehicle:v,docs:Array.isArray(v.docs)?v.docs.filter(d=>docMatch(d,filter)):[]})).filter(r=>r.docs.length>0)}
  function label(filter){return filter==='red'?'Red Alert':filter==='yellow'?'Yellow Alert':'Green Alert'}
  function sub(filter){return filter==='red'?'Failed':filter==='yellow'?'Expiring':'Valid'}
  function validText(date){const d=daysLeft(date);if(d===null)return{txt:'Missing',color:'#64748b'};if(d<0)return{txt:Math.abs(d)+' days expired',color:'#dc2626'};return{txt:d+' days left',color:'#16a34a'}}
  function fmt(date){if(!date)return'Date missing';try{return new Date(date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}catch{return date}}

  function styles(){if(document.getElementById('userAlertBoxStyles'))return;const s=document.createElement('style');s.id='userAlertBoxStyles';s.textContent=`
    #userAlertPanel{background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:12px;margin:12px 0;box-shadow:0 8px 22px rgba(37,99,235,.08)}
    #userAlertBoxes{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:10px}
    .userAlertBox{border:0;color:#fff;border-radius:16px;padding:10px 6px;min-height:72px;font-weight:900;box-shadow:0 8px 18px rgba(15,23,42,.12)}
    .userAlertBox b{display:block;font-size:23px;line-height:1;margin:5px 0}.userAlertBox span{display:block;font-size:12px}.userAlertBox small{font-size:10px;font-weight:800}.userAlertBox.red{background:linear-gradient(135deg,#ef4444,#dc2626)}.userAlertBox.yellow{background:linear-gradient(135deg,#facc15,#d97706)}.userAlertBox.green{background:linear-gradient(135deg,#22c55e,#15803d)}
    #userAlertList{border-top:1px solid #e2e8f0;padding-top:8px}.userAlertTitle{font-size:17px;font-weight:900;margin:0 0 8px;color:#0f172a}.userAlertVehicle{width:100%;border:1px solid #e2e8f0;background:#fbfdff;border-radius:14px;padding:12px 14px;margin:7px 0;text-align:left;font-size:17px;font-weight:900;color:#0f172a;display:flex;justify-content:space-between;align-items:center}.userAlertVehicle:after{content:'›';font-size:28px;color:#64748b}.userAlertEmpty{padding:12px;border-radius:14px;background:#f8fafc;color:#64748b;font-weight:800;text-align:center}
    @media(max-width:768px){#userAlertPanel{margin:10px 0;padding:10px;border-radius:18px}.userAlertBox{min-height:65px;padding:8px 4px}.userAlertBox b{font-size:20px}.userAlertBox span{font-size:11px}.userAlertVehicle{font-size:15px;padding:11px 12px}}
  `;document.head.appendChild(s)}

  function ensurePanel(){styles();let panel=document.getElementById('userAlertPanel');if(panel)return panel;const hero=document.querySelector('.upHero');if(!hero)return null;panel=document.createElement('section');panel.id='userAlertPanel';hero.insertAdjacentElement('afterend',panel);return panel}

  function openNoPdfPopup(vehicle){
    const old=document.getElementById('userNoPdfVehiclePopup');if(old)old.remove();
    const docs=(vehicle.docs||[]).map(doc=>{const v=validText(doc.expiryDate);return `<div style="padding:6px 0;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:8px"><div><div style="font-size:15px;font-weight:900">${esc(doc.name)}</div><div style="margin-top:1px;font-size:13px;color:#334155">${esc(fmt(doc.expiryDate))}</div></div><div style="font-size:12px;color:${v.color};font-weight:900;text-align:right;white-space:nowrap">${esc(v.txt)}</div></div>`}).join('');
    const wrap=document.createElement('div');wrap.id='userNoPdfVehiclePopup';wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:8px';
    wrap.innerHTML=`<div style="width:92%;max-width:360px;background:white;border-radius:16px;overflow:hidden;max-height:88vh;overflow:auto;position:relative;box-shadow:0 18px 45px rgba(0,0,0,.28)"><img src="${BANNER}" style="width:100%;display:block"><button id="closeUserNoPdfPopup" style="position:absolute;top:7px;right:7px;width:30px;height:30px;border:none;border-radius:50%;background:white;font-size:20px;font-weight:900;line-height:1">×</button><div style="padding:10px"><div style="font-size:14px;line-height:1.35;margin-bottom:8px"><b>Name:</b> ${esc(vehicle.owner||vehicle.submittedBy||'Not added')}<br><b>Mobile:</b> ${esc(vehicle.mobile||'Not added')}<br><b>Vehicle:</b> ${esc(vehicle.vehicleNo||'Missing')}</div><div style="font-size:18px;font-weight:900;margin-bottom:6px">Document Details</div>${docs}<div style="margin-top:8px;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px"><div style="font-size:13px;font-weight:900">Realtime Vehicle Document Tracking System</div><div style="color:#2563eb;font-weight:900;margin-top:2px;font-size:12px">By Sanjay Singh</div></div></div></div>`;
    document.body.appendChild(wrap);wrap.onclick=e=>{if(e.target===wrap||e.target.id==='closeUserNoPdfPopup')wrap.remove()};
  }

  function render(){const panel=ensurePanel();if(!panel)return;const counts={red:vehicleRows('red').length,yellow:vehicleRows('yellow').length,green:vehicleRows('green').length};const rows=vehicleRows(state.filter);panel.innerHTML=`<div id="userAlertBoxes"><button class="userAlertBox red" data-user-alert="red"><span>Red Alert</span><b>${counts.red}</b><small>Failed Vehicles</small></button><button class="userAlertBox yellow" data-user-alert="yellow"><span>Yellow Alert</span><b>${counts.yellow}</b><small>Expiring Vehicles</small></button><button class="userAlertBox green" data-user-alert="green"><span>Green Alert</span><b>${counts.green}</b><small>Valid Vehicles</small></button></div><div id="userAlertList"><h3 class="userAlertTitle">${label(state.filter)} - ${sub(state.filter)} Vehicles (${rows.length})</h3></div>`;const list=panel.querySelector('#userAlertList');if(!rows.length){list.insertAdjacentHTML('beforeend','<div class="userAlertEmpty">No vehicles found.</div>');return}rows.forEach(({vehicle})=>{const btn=document.createElement('button');btn.className='userAlertVehicle';btn.type='button';btn.textContent=vehicle.vehicleNo||'Vehicle No Missing';btn.onclick=()=>openNoPdfPopup(vehicle);list.appendChild(btn)})}

  document.addEventListener('click',e=>{const box=e.target.closest('[data-user-alert]');if(box){state.filter=box.dataset.userAlert;render()}},true);
  setInterval(render,1200);
})();