(function(){
  const USER_KEY='vehicle_user_page_v1';
  const VEHICLE_KEY='vehicle_document_expiry_app_supabase_v1';
  let ownerValue='';

  function injectOwnerInput(){
    if(document.getElementById('driverOwnerName')) return;
    const inputs=[...document.querySelectorAll('input.upInput')];
    const modelInput=inputs.find(i=>(i.placeholder||'').toLowerCase().includes('vehicle model'));
    if(!modelInput) return;
    const input=document.createElement('input');
    input.className='upInput';
    input.id='driverOwnerName';
    input.placeholder='Driver / Owner Name';
    input.autocomplete='name';
    input.addEventListener('input',()=>{ownerValue=input.value.trim();});
    modelInput.insertAdjacentElement('afterend',input);
  }

  function patchLatestOwner(){
    const owner=(document.getElementById('driverOwnerName')?.value||ownerValue||'').trim();
    if(!owner) return;
    try{
      const vehicles=JSON.parse(localStorage.getItem(VEHICLE_KEY)||'[]');
      if(!Array.isArray(vehicles)||!vehicles.length) return;
      vehicles[0].owner=owner;
      vehicles[0].driverOwner=owner;
      localStorage.setItem(VEHICLE_KEY,JSON.stringify(vehicles));
    }catch(e){}
  }

  document.addEventListener('click',function(e){
    const btn=e.target.closest('button');
    if(!btn) return;
    const text=(btn.textContent||'').trim();
    if(/Confirm/i.test(text)||/Submit/i.test(text)){
      setTimeout(patchLatestOwner,600);
      setTimeout(patchLatestOwner,1500);
    }
  },true);

  const oldSetItem=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(key,value){
    if(key===VEHICLE_KEY){
      const owner=(document.getElementById('driverOwnerName')?.value||ownerValue||'').trim();
      if(owner){
        try{
          const vehicles=JSON.parse(value||'[]');
          if(Array.isArray(vehicles)&&vehicles.length){
            vehicles[0].owner=owner;
            vehicles[0].driverOwner=owner;
            value=JSON.stringify(vehicles);
          }
        }catch(e){}
      }
    }
    return oldSetItem(key,value);
  };

  setInterval(injectOwnerInput,500);
})();