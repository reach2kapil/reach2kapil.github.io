const statusEl=document.querySelector('#status');
const countryNameEl=document.querySelector('#countryName');
const countryHintEl=document.querySelector('#countryHint');
const countrySearch=document.querySelector('#countrySearch');
const countryList=document.querySelector('#countryList');
const resetView=document.querySelector('#resetView');
const zoomIn=document.querySelector('#zoomIn');
const zoomOut=document.querySelector('#zoomOut');
let countries=[];
let stateRecords=[];
let selected=null;
const globe=Globe()(document.querySelector('#globe'))
  .backgroundColor('rgba(0,0,0,0)')
  .globeImageUrl('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg')
  .bumpImageUrl('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg')
  .showAtmosphere(true)
  .atmosphereColor('#76d9ff')
  .atmosphereAltitude(0.18)
  .polygonsTransitionDuration(0)
  .polygonCapColor(()=> 'rgba(255,255,255,0.015)')
  .polygonSideColor(()=> 'rgba(101,214,173,0.05)')
  .polygonStrokeColor(()=> 'rgba(215,248,235,0.72)')
  .polygonAltitude(0.003)
  .labelText('text')
  .labelLat('lat')
  .labelLng('lng')
  .labelColor(d=>d.kind==='state'?'rgba(213,238,231,.92)':'rgba(248,255,249,.95)')
  .labelSize(d=>d.kind==='state'?0.42:0.62)
  .labelDotRadius(0)
  .labelResolution(2)
  .pointsData([])
  .pointLat('lat')
  .pointLng('lng')
  .pointColor(()=> '#ffcf5a')
  .pointRadius(0.35)
  .pointAltitude(0.02);
globe.controls().autoRotate=true;
globe.controls().autoRotateSpeed=0.35;
function setStatus(text){statusEl.textContent=text;}
function centroid(feature){
  const polys=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  let ring=[];
  let score=-1;
  for(const poly of polys){
    const r=(poly[0]||[]).filter(p=>Array.isArray(p)&&p.length>=2);
    const s=r.length;
    if(s>score){ring=r;score=s;}
  }
  let x=0,y=0,z=0;
  for(const [lng,lat] of ring){
    const a=lng*Math.PI/180,b=lat*Math.PI/180;
    x+=Math.cos(b)*Math.cos(a);y+=Math.cos(b)*Math.sin(a);z+=Math.sin(b);
  }
  const n=ring.length||1;x/=n;y/=n;z/=n;
  return {lng:Math.atan2(y,x)*180/Math.PI,lat:Math.atan2(z,Math.sqrt(x*x+y*y))*180/Math.PI};
}
function updateLabels(){
  const pov=globe.pointOfView();
  const altitude=pov.altitude||2.5;
  const labels=[];
  if(selected && altitude<3.25) labels.push({text:selected.name,lat:selected.lat,lng:selected.lng,kind:'country'});
  if(selected && altitude<2.65){
    stateRecords.filter(s=>s.admin===selected.name).slice(0,90).forEach(s=>labels.push({...s,kind:'state'}));
  }
  globe.labelsData(labels);
}
function focusCountry(country){
  selected=country;
  globe.controls().autoRotate=false;
  countryNameEl.textContent=country.name;
  countryHintEl.textContent=`${country.lat.toFixed(1)} deg latitude, ${country.lng.toFixed(1)} deg longitude`;
  globe.pointsData([{lat:country.lat,lng:country.lng}]);
  globe.pointOfView({lat:country.lat,lng:country.lng,altitude:1.85},1000);
  setTimeout(updateLabels,1100);
}
function reset(){
  selected=null;
  globe.controls().autoRotate=true;
  countrySearch.value='';
  countryNameEl.textContent='Earth';
  countryHintEl.textContent='Drag to rotate. Scroll or pinch to zoom.';
  globe.pointsData([]).labelsData([]);
  globe.pointOfView({lat:12,lng:-95,altitude:2.6},800);
}
function zoom(delta){
  const pov=globe.pointOfView();
  const altitude=Math.max(0.75,Math.min(4.4,(pov.altitude||2.4)+delta));
  globe.pointOfView({...pov,altitude},450);
  setTimeout(updateLabels,500);
}
countrySearch.addEventListener('input',()=>{
  const value=countrySearch.value.trim().toLowerCase();
  const country=countries.find(c=>c.name.toLowerCase()===value);
  if(country) focusCountry(country);
});
resetView.addEventListener('click',reset);
zoomIn.addEventListener('click',()=>zoom(-0.42));
zoomOut.addEventListener('click',()=>zoom(0.42));
globe.controls().addEventListener('change',updateLabels);
Promise.all([
  fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json').then(r=>r.json()),
  fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson').then(r=>r.json())
]).then(([countryData,stateData])=>{
  countries=(countryData.features||[]).map(f=>({name:f.properties.name||f.properties.ADMIN,...centroid(f),feature:f})).sort((a,b)=>a.name.localeCompare(b.name));
  const frag=document.createDocumentFragment();
  countries.forEach(c=>{const opt=document.createElement('option');opt.value=c.name;frag.appendChild(opt);});
  countryList.appendChild(frag);
  globe.polygonsData(countries.map(c=>c.feature));
  stateRecords=(stateData.features||[]).map(f=>f.properties||{}).filter(p=>Number(p.labelrank||99)<=5 && p.name && p.admin && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))).map(p=>({text:p.name_en||p.name,admin:p.admin,lat:Number(p.latitude),lng:Number(p.longitude),rank:Number(p.labelrank||99)})).sort((a,b)=>a.admin.localeCompare(b.admin)||a.rank-b.rank||a.text.localeCompare(b.text));
  setStatus(`${countries.length} countries, ${stateRecords.length} states/provinces ready`);
}).catch(error=>{console.warn(error);setStatus('Could not load map data');});
window.addEventListener('resize',()=>globe.width(window.innerWidth).height(window.innerHeight));
reset();
