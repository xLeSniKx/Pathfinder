import { LEAFLET_CSS, LEAFLET_JS, PMTILES_JS, PROTOMAPS_JS } from './libs.generated';

const OFFLINE_FLAVOR = 'light';

const APP_CSS = `
  body, html { margin: 0; padding: 0; height: 100%; width: 100%; background: #2b2b2b; overflow: hidden; }
  #map { height: 100%; width: 100%; background: #2b2b2b; }
  .dark-tiles { filter: brightness(0.55) contrast(1.4) grayscale(0.4); }
  #fog-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000; }
  .bike-marker { width: 20px; height: 20px; background-color: var(--accent, #5EE6A8); border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px rgba(0, 0, 0, 0.45); }
  .leaflet-control-attribution { background: rgba(31, 31, 31, 0.7) !important; color: #999 !important; font-size: 10px; z-index: 1100; }
  #dbg { position: absolute; top: 110px; left: 8px; right: 8px; background: rgba(0, 0, 0, 0.75); color: #7CFC00; font: 10px monospace; white-space: pre-wrap; padding: 4px; z-index: 3000; pointer-events: none; }
`;

const APP_JS = `
(function () {
  var DEBUG = false; // поставьте true, чтобы снова увидеть отладочную панель

  function post(o) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o));
  }

  var info = {};
  var dbgEl = null;
  function dbg(k, v) {
    if (!DEBUG) return;
    info[k] = v;
    if (!dbgEl) {
      dbgEl = document.createElement('div');
      dbgEl.id = 'dbg';
      document.body.appendChild(dbgEl);
    }
    var s = '';
    for (var key in info) s += key + ': ' + info[key] + '\\n';
    dbgEl.textContent = s;
  }

  window.onerror = function (msg) {
    dbg('JS-ошибка', String(msg));
    post({ type: 'BASE_ERROR', message: String(msg) });
  };

  dbg('библиотеки', 'L=' + (typeof L) + ' pmtiles=' + (typeof pmtiles) + ' protomapsL=' + (typeof protomapsL));
  if (typeof L === 'undefined') { post({ type: 'LEAFLET_MISSING' }); return; }

  var THEME = { accent: '#5EE6A8', fog: '#0F1113', fogOpacity: 0.9, dark: true };
  var map = L.map('map', { zoomControl: false, attributionControl: false });
  map.setView([50, 20], 4);
  L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap contributors').addTo(map);

  var bikeIcon = L.divIcon({ className: 'bike-marker', iconSize: [20, 20], iconAnchor: [10, 10] });
  var marker = null;
  var trackLine = L.polyline([], { color: THEME.accent, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
  var segments = [];
  var fogPts = [];
  var radius = 45;
  var firstCentering = true;
  var lastRegions = [];
  var fogHoles = document.getElementById('fog-holes');
  var raf = 0;

  function applyTheme(t) {
    if (t) THEME = t;
    document.documentElement.style.setProperty('--accent', THEME.accent);
    var fr = document.getElementById('fog-rect');
    fr.setAttribute('fill', THEME.fog);
    fr.setAttribute('fill-opacity', String(THEME.fogOpacity));
    trackLine.setStyle({ color: THEME.accent });
    var bg = THEME.dark ? '#2b2b2b' : '#e8ebee';
    document.body.style.background = bg;
    document.getElementById('map').style.background = bg;
  }

  function reportSize() {
    var s = map.getSize();
    dbg('экран', s.x + 'x' + s.y + ', zoom ' + map.getZoom());
  }

  var pending = {};
  var nextReq = 1;
  var readsOk = 0;
  var readsErr = 0;

  function readBytes(region, offset, length) {
    return new Promise(function (resolve, reject) {
      var id = nextReq++;
      pending[id] = { resolve: resolve, reject: reject };
      post({ type: 'READ', id: id, region: region, offset: offset, length: length });
    });
  }

  function b64ToBuf(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function makeSource(region) {
    return {
      getKey: function () { return region; },
      getBytes: function (offset, length) {
        return readBytes(region, offset, length).then(function (buf) { return { data: buf }; });
      }
    };
  }

  var baseLayers = [];
  var tilesOk = 0;
  var tilesErr = 0;

  function hookLayer(layer) {
    layer.on('tileload', function () { tilesOk++; dbg('тайлы', tilesOk + ' ок / ' + tilesErr + ' ошибок'); });
    layer.on('tileerror', function () { tilesErr++; dbg('тайлы', tilesOk + ' ок / ' + tilesErr + ' ошибок'); });
  }

  function setBase(regions) {
    lastRegions = regions || [];
    for (var i = 0; i < baseLayers.length; i++) map.removeLayer(baseLayers[i]);
    baseLayers = [];
    var offline = false;
    var cls = THEME.dark ? 'dark-tiles' : '';
    dbg('скачано карт', lastRegions.length ? lastRegions.join(',') : 'нет');
    if (lastRegions.length && window.protomapsL && window.pmtiles) {
      try {
        for (var j = 0; j < lastRegions.length; j++) {
          var src = new pmtiles.PMTiles(makeSource(lastRegions[j]));
          var layer = protomapsL.leafletLayer({
            url: src, flavor: OFFLINE_FLAVOR, lang: 'ru',
            maxDataZoom: 14, maxZoom: 19, className: cls
          });
          hookLayer(layer);
          layer.addTo(map);
          baseLayers.push(layer);
        }
        offline = true;
      } catch (e) {
        dbg('ошибка офлайн-слоя', String(e));
        post({ type: 'BASE_ERROR', message: String(e) });
      }
    }
    if (!offline) {
      var t = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, subdomains: ['a', 'b', 'c'], className: cls
      });
      hookLayer(t);
      t.addTo(map);
      baseLayers.push(t);
    }
    dbg('режим', offline ? 'ОФЛАЙН' : 'интернет');
    post({ type: 'BASE_MODE', mode: offline ? 'offline' : 'online' });
  }

  function dest(ll, dist, bearingDeg) {
    var R = 6378137;
    var lat1 = ll[0] * Math.PI / 180, lon1 = ll[1] * Math.PI / 180;
    var b = bearingDeg * Math.PI / 180, d = dist / R;
    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
    var lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
  }

  function scheduleFog() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; drawFog(); });
  }

  function drawFog() {
    fogHoles.innerHTML = '';
    var size = map.getSize();
    var c = map.getCenter();
    var cp = map.latLngToContainerPoint(c);
    var ep = map.latLngToContainerPoint(dest([c.lat, c.lng], radius, 90));
    var pr = Math.abs(ep.x - cp.x);
    reportSize();
    if (pr < 2) { dbg('туман', fogPts.length + ' точек, радиус ' + Math.round(pr) + 'px (слишком мелко)'); return; }
    var frag = document.createDocumentFragment();
    var drawn = 0;
    for (var i = 0; i < fogPts.length && drawn < 2500; i++) {
      var pt = map.latLngToContainerPoint(fogPts[i]);
      if (pt.x < -pr || pt.y < -pr || pt.x > size.x + pr || pt.y > size.y + pr) continue;
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', pr);
      circle.setAttribute('fill', 'black');
      frag.appendChild(circle);
      drawn++;
    }
    fogHoles.appendChild(frag);
    dbg('туман', fogPts.length + ' точек, нарисовано ' + drawn + ', радиус ' + Math.round(pr) + 'px');
  }

  function addFog(p) {
    var last = fogPts.length ? fogPts[fogPts.length - 1] : null;
    if (!last || map.distance(last, p) >= radius / 3) fogPts.push(p);
  }

  function rebuildFog() {
    fogPts = [];
    for (var i = 0; i < segments.length; i++) {
      for (var j = 0; j < segments[i].length; j++) addFog(segments[i][j]);
    }
  }

  function setMarker(p) {
    if (!marker) marker = L.marker(p, { icon: bikeIcon }).addTo(map);
    else marker.setLatLng(p);
  }

  function init(segs, r, regions, theme) {
    map.invalidateSize();
    applyTheme(theme);
    segments = segs || [];
    radius = r || 45;
    setBase(regions);
    trackLine.setLatLngs(segments);
    rebuildFog();
    var lastSeg = segments.length ? segments[segments.length - 1] : null;
    if (lastSeg && lastSeg.length) {
      var lp = lastSeg[lastSeg.length - 1];
      setMarker(lp);
      map.setView(lp, 18);
      firstCentering = false;
      dbg('позиция', lp[0].toFixed(5) + ', ' + lp[1].toFixed(5));
    }
    scheduleFog();
  }

  function addPoint(lat, lon, newSeg) {
    var p = [lat, lon];
    if (newSeg || segments.length === 0) {
      segments.push([p]);
      trackLine.setLatLngs(segments);
    } else {
      segments[segments.length - 1].push(p);
      trackLine.addLatLng(p, trackLine.getLatLngs()[segments.length - 1]);
    }
    addFog(p);
    setMarker(p);
    if (firstCentering) { map.invalidateSize(); map.setView(p, 18); firstCentering = false; }
    dbg('позиция', lat.toFixed(5) + ', ' + lon.toFixed(5));
    scheduleFog();
  }

  document.addEventListener('message', function (event) {
    var d;
    try { d = JSON.parse(event.data); } catch (e) { return; }
    if (d.type === 'INIT') { dbg('INIT получен', 'да'); init(d.segments, d.radius, d.regions, d.theme); }
    else if (d.type === 'POINT') addPoint(d.lat, d.lon, d.newSegment);
        else if (d.type === 'SET_TRACK') {
      segments = d.segments || [];
      trackLine.setLatLngs(segments);
      rebuildFog();
      var ls = segments.length ? segments[segments.length - 1] : null;
      if (ls && ls.length) setMarker(ls[ls.length - 1]);
      scheduleFog();
    }
    else if (d.type === 'SET_RADIUS') { radius = d.meters; rebuildFog(); scheduleFog(); }
    else if (d.type === 'SET_THEME') { applyTheme(d.theme); setBase(lastRegions); }
    else if (d.type === 'CENTER') { if (marker) map.setView(marker.getLatLng(), 18); }
    else if (d.type === 'READ_RESULT') {
      var p1 = pending[d.id];
      if (!p1) return;
      delete pending[d.id];
      if (d.b64 && d.b64.slice(0, 4) === 'ERR:') {
        readsErr++;
        dbg('чтение файла', readsOk + ' ок / ' + readsErr + ' ошибок');
        dbg('ошибка чтения', d.b64.slice(4));
        p1.reject(new Error(d.b64));
      } else {
        readsOk++;
        dbg('чтение файла', readsOk + ' ок / ' + readsErr + ' ошибок');
        p1.resolve(b64ToBuf(d.b64));
      }
    } else if (d.type === 'READ_ERROR') {
      var p2 = pending[d.id];
      if (p2) { delete pending[d.id]; readsErr++; p2.reject(new Error('read failed')); }
    }
  });

  map.on('move', scheduleFog);
  map.on('zoom', scheduleFog);
  window.addEventListener('resize', function () { map.invalidateSize(); scheduleFog(); });
  setTimeout(function () { map.invalidateSize(); scheduleFog(); }, 300);
  reportSize();
  post({ type: 'MAP_LOADED' });
})();
`;

export function buildMapHtml(): string {
  return (
    '<!DOCTYPE html><html><head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />' +
    '<style>' + LEAFLET_CSS + '</style>' +
    '<style>' + APP_CSS + '</style>' +
    '</head><body>' +
    '<div id="map"></div>' +
    '<svg id="fog-overlay"><defs><mask id="fog-mask"><rect width="100%" height="100%" fill="white" /><g id="fog-holes"></g></mask></defs>' +
    '<rect id="fog-rect" width="100%" height="100%" fill="#0F1113" fill-opacity="0.9" mask="url(#fog-mask)" /></svg>' +
    '<script>' + LEAFLET_JS + '</script>' +
    '<script>' + PMTILES_JS + '</script>' +
    '<script>' + PROTOMAPS_JS + '</script>' +
    '<script>var OFFLINE_FLAVOR = ' + JSON.stringify(OFFLINE_FLAVOR) + ';' + APP_JS + '</script>' +
    '</body></html>'
  );
}