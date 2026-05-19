(function(){
  const TESSERACT_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  function cleanVehicleNo(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function extractVehicleNo(text){
    const compact=String(text||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const match=compact.match(/[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,5}/);
    return match?cleanVehicleNo(match[0]):'';
  }
  function loadTesseract(){
    return new Promise(function(resolve,reject){
      if(window.Tesseract)return resolve(window.Tesseract);
      const script=document.createElement('script');
      script.src=TESSERACT_URL;
      script.onload=function(){window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR library load failed'));};
      script.onerror=function(){reject(new Error('OCR library download failed'));};
      document.head.appendChild(script);
    });
  }
  function getVehicleInput(){
    return Array.from(document.querySelectorAll('input')).find(function(input){
      const text=((input.placeholder||'')+' '+(input.name||'')+' '+(input.id||'')).toLowerCase();
      return text.includes('vehicle no')||text.includes('vehicle number')||text.includes('vehicleno');
    });
  }
  function setVehicleNo(no){
    const input=getVehicleInput();
    if(!input||!no)return;
    input.value=no;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  async function readVehicleNo(file){
    if(!file)return;
    try{
      const Tesseract=await loadTesseract();
      const result=await Tesseract.recognize(file,'eng');
      const no=extractVehicleNo(result&&result.data?result.data.text:'');
      if(no)setVehicleNo(no);
    }catch(error){}
  }
  document.addEventListener('change',function(event){
    const input=event.target;
    if(!input||input.type!=='file')return;
    const labelText=(input.closest('label')&&input.closest('label').textContent)||'';
    if(!/mparivahan|screenshot/i.test(labelText))return;
    setTimeout(function(){readVehicleNo(input.files&&input.files[0]);},400);
  },true);
})();
