const statusEl = document.querySelector('#status');
const countryNameEl = document.querySelector('#countryName');
const countryHintEl = document.querySelector('#countryHint');
const countrySearch = document.querySelector('#countrySearch');
const countryList = document.querySelector('#countryList');
const labelLayer = document.querySelector('#mapLabels');
const resetView = document.querySelector('#resetView');
const zoomIn = document.querySelector('#zoomIn');
const zoomOut = document.querySelector('#zoomOut');

let countries = [];
let stateRecords = [];
let selected = null;
let labelItems = [];

const globe = Globe()(document.querySelector('#globe'))
  .backgroundColor('rgba(0,0,0,0)')
  .globeImageUrl('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg')
  .bumpImageUrl('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg')
  .showAtmosphere(true)
  .atmosphereColor('#76d9ff')
  .atmosphereAltitude(0.18)
  .polygonsTransitionDuration(0)
  .polygonCapColor(() => 'rgba(255,255,255,0.015)')
  .polygonSideColor(() => 'rgba(101,214,173,0.05)')
  .polygonStrokeColor(() => 'rgba(215,248,235,0.72)')
  .polygonAltitude(0.003)
  .pointsData([])
  .pointLat('lat')
  .pointLng('lng')
  .pointColor(() => '#ffcf5a')
  .pointRadius(0.35)
  .pointAltitude(0.02);

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.35;

function setStatus(text) {
  statusEl.textContent = text;
}

function centroid(feature) {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  let ring = [];
  let bestLength = -1;

  for (const polygon of polygons) {
    const candidate = (polygon[0] || []).filter((point) => Array.isArray(point) && point.length >= 2);
    if (candidate.length > bestLength) {
      ring = candidate;
      bestLength = candidate.length;
    }
  }

  let x = 0;
  let y = 0;
  let z = 0;

  for (const [lng, lat] of ring) {
    const lngRad = (lng * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;
    x += Math.cos(latRad) * Math.cos(lngRad);
    y += Math.cos(latRad) * Math.sin(lngRad);
    z += Math.sin(latRad);
  }

  const total = ring.length || 1;
  x /= total;
  y /= total;
  z /= total;

  return {
    lng: (Math.atan2(y, x) * 180) / Math.PI,
    lat: (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI
  };
}

function clearLabels() {
  labelLayer.replaceChildren();
  labelItems = [];
}

function addLabel(record, kind) {
  const element = document.createElement('span');
  element.className = `map-label ${kind}`;
  element.textContent = record.text || record.name;
  labelLayer.appendChild(element);
  labelItems.push({ element, lat: record.lat, lng: record.lng, kind });
}

function rebuildLabels() {
  clearLabels();
  if (!selected) return;

  addLabel({ text: selected.name, lat: selected.lat, lng: selected.lng }, 'country');

  const altitude = globe.pointOfView().altitude || 2.5;
  if (altitude < 2.65) {
    stateRecords
      .filter((state) => state.admin === selected.name)
      .slice(0, 90)
      .forEach((state) => addLabel(state, 'state'));
  }

  updateLabelPositions();
}

function updateLabelPositions() {
  const altitude = globe.pointOfView().altitude || 2.5;

  for (const item of labelItems) {
    const show = item.kind === 'country' || altitude < 2.65;
    item.element.hidden = !show;
    if (!show) continue;

    const coords = globe.getScreenCoords(item.lat, item.lng, 0.03);
    if (!coords || !Number.isFinite(coords.x) || !Number.isFinite(coords.y)) {
      item.element.hidden = true;
      continue;
    }

    item.element.style.transform = `translate(${coords.x}px, ${coords.y}px) translate(-50%, -50%)`;
  }
}

function focusCountry(country) {
  selected = country;
  globe.controls().autoRotate = false;
  countryNameEl.textContent = country.name;
  countryHintEl.textContent = `${country.lat.toFixed(1)} deg latitude, ${country.lng.toFixed(1)} deg longitude`;
  globe.pointsData([{ lat: country.lat, lng: country.lng }]);
  globe.pointOfView({ lat: country.lat, lng: country.lng, altitude: 1.85 }, 1000);
  setTimeout(rebuildLabels, 1050);
}

function reset() {
  selected = null;
  globe.controls().autoRotate = true;
  countrySearch.value = '';
  countryNameEl.textContent = 'Earth';
  countryHintEl.textContent = 'Drag to rotate. Scroll or pinch to zoom.';
  globe.pointsData([]);
  clearLabels();
  globe.pointOfView({ lat: 12, lng: -95, altitude: 2.6 }, 800);
}

function zoom(delta) {
  const pov = globe.pointOfView();
  const altitude = Math.max(0.75, Math.min(4.4, (pov.altitude || 2.4) + delta));
  globe.pointOfView({ ...pov, altitude }, 450);
  setTimeout(rebuildLabels, 500);
}

countrySearch.addEventListener('input', () => {
  const value = countrySearch.value.trim().toLowerCase();
  const country = countries.find((item) => item.name.toLowerCase() === value);
  if (country) focusCountry(country);
});

resetView.addEventListener('click', reset);
zoomIn.addEventListener('click', () => zoom(-0.42));
zoomOut.addEventListener('click', () => zoom(0.42));
globe.controls().addEventListener('change', updateLabelPositions);

Promise.all([
  fetch('./data/countries.geo.json').then((response) => response.json()),
  fetch('./data/state-labels.json').then((response) => response.json())
])
  .then(([countryData, stateData]) => {
    countries = (countryData.features || [])
      .map((feature) => ({ name: feature.properties.name || feature.properties.ADMIN, ...centroid(feature), feature }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const fragment = document.createDocumentFragment();
    countries.forEach((country) => {
      const option = document.createElement('option');
      option.value = country.name;
      fragment.appendChild(option);
    });
    countryList.appendChild(fragment);

    stateRecords = (stateData || [])
      .map((state) => ({ ...state, lng: state.lon }))
      .sort((a, b) => a.admin.localeCompare(b.admin) || a.labelRank - b.labelRank || a.text.localeCompare(b.text));

    globe.polygonsData(countries.map((country) => country.feature));
    setStatus(`${countries.length} countries, ${stateRecords.length} states/provinces ready`);
  })
  .catch((error) => {
    console.warn(error);
    setStatus('Could not load map data');
  });

window.addEventListener('resize', () => globe.width(window.innerWidth).height(window.innerHeight));
reset();