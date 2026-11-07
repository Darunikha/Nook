// The painted library: the illustrated scene with living light (lamp, candle, sconces, star, relit per time of day), clear glass with an optional fine rain,
// drifting dust, steam from the mug, a time-of-day grade, handwriting on the open notebook, and clickable objects.
// It exposes the same small API as the 3D room, so the rest of the app does not care which scene is showing.

var IW = 1672, IH = 941;                                   // artwork size; every coordinate below is in artwork pixels

// clickable things in the painting: id -> label + a hit area (x, y, w, h)
var HOTSPOTS = [
  { id: 'notebook', label: 'My Notes', r: [512, 808, 636, 120] },
  { id: 'mug', label: 'Tea break', r: [522, 676, 138, 124] },
  { id: 'lamp', label: 'Desk lamp', r: [292, 382, 206, 142] },
  { id: 'candle', label: 'Candle', r: [1408, 722, 132, 148] },
  { id: 'cat', label: 'Mochi', r: [1012, 660, 372, 140] },
  { id: 'reading', label: 'Reading list', r: [38, 716, 372, 172] },
  { id: 'chair', label: 'Fireside chair', r: [592, 508, 324, 220] },
  { id: 'window', label: 'Arched window', r: [632, 20, 548, 450] },
  { id: 'library', label: 'The stacks', r: [214, 130, 400, 420] },
  { id: 'shelf', label: 'Your study shelf', r: [1192, 160, 140, 520] }
];
// lights in the painting
var LIGHTS = {                                              // small accents only: the light itself is in the painting's relight
  lamp: { x: 405, y: 494, r: 150, c: '255,205,150', a: .16 },
  candle: { x: 1475, y: 792, r: 70, c: '255,190,120', a: .24 },
  sconceL: { x: 445, y: 300, r: 48, c: '255,210,160', a: .12 },
  sconceT: { x: 563, y: 86, r: 38, c: '255,210,160', a: .10 },
  floor: { x: 1134, y: 468, r: 82, c: '255,212,165', a: .12 },
  star: { x: 990, y: 225, r: 36, c: '255,230,185', a: .16 }
};
var WINDOW = 'polygon(37.8% 4%, 41% 1.5%, 46.6% 0%, 52% 0%, 58% 1%, 61.4% 3%, 70.6% 3.5%, 70.6% 52.82%, 37.8% 52.82%)';                   // down to the top of the lower window frame (y = 497)

export function createPainted(stage, opts) {
  opts = opts || {};
  var reduce = !!opts.reduce;
  var api = {
    onOpen: function () {}, onClose: function () {}, onBook: function () {},
    focus: function () {}, home: function () {}, setFocus: function () {}, setPlaying: function () {}, setQuality: function () {}, setDeskClock: function () {},
    setTod: setTod, setRain: function (v) { rain = v; }, addBook: function () { sparkle(1262, 420); },
    pet: function () { hearts(); }, hello: function () { hearts(2); },
    toggleLamp: function () { lampOn = !lampOn; root.classList.toggle('lamp-off', !lampOn); return lampOn; },
    toggleCandle: function () { candleOn = !candleOn; root.classList.toggle('candle-off', !candleOn); return candleOn; },
    setNotebook: setNotebook, setReduce: function (v) { reduce = !!v; root.classList.toggle('still', reduce); if (depthView) depthView.setReduce(reduce); }
  };
  var lampOn = true, candleOn = true, rain = 0;

  /* ---------- build ---------- */
  var root = document.createElement('div'); root.className = 'painted'; stage.appendChild(root);
  var back = document.createElement('div'); back.className = 'backdrop'; back.style.backgroundImage = 'url(' + (opts.base || '/') + 'scene/library-dusk.webp)'; root.appendChild(back);
  var art = document.createElement('div'); art.className = 'art'; root.appendChild(art);
  var img = new Image(); img.className = 'art-img'; img.alt = ''; img.decoding = 'async'; img.src = (opts.base || '/') + 'scene/library-dusk.webp'; art.appendChild(img);
  // the sky for each time of day is graded into the painting itself (pixel by pixel, cool tones only), so there is no shape or edge over the windows
  var TODIMG = {};
  ['morning', 'day', 'night'].forEach(function (t) { var v = new Image(); v.className = 'art-img tod'; v.alt = ''; v.decoding = 'async'; art.appendChild(v); TODIMG[t] = v; });
  function layer(cls) { var d = document.createElement('div'); d.className = cls; art.appendChild(d); return d; }
  var rainCv = document.createElement('canvas'); rainCv.className = 'rain'; rainCv.width = 560; rainCv.height = 500; rainCv.style.cssText = 'left:630px;top:0;width:560px;height:500px'; rainCv.style.clipPath = 'polygon(0 0, 100% 0, 100% 99.4%, 0 99.4%)'; art.appendChild(rainCv);
  Object.keys(LIGHTS).forEach(function (k) {
    var L = LIGHTS[k], g = layer('glow glow-' + k);
    g.style.cssText = 'left:' + (L.x - L.r) + 'px;top:' + (L.y - L.r) + 'px;width:' + (2 * L.r) + 'px;height:' + (2 * L.r) + 'px;background:radial-gradient(circle, rgba(' + L.c + ',' + L.a + ') 0%, rgba(' + L.c + ',' + (L.a * .35) + ') 35%, rgba(' + L.c + ',0) 70%)';
  });
  var lampShade = layer('lamp-shade');                          // darkens the desk when the lamp is off
  var steam = layer('steam'); for (var s = 0; s < 3; s++) { var w = document.createElement('i'); w.style.animationDelay = (s * 1.3) + 's'; steam.appendChild(w); }
  var ink = layer('nb-ink');
  var dustCv = document.createElement('canvas'); dustCv.className = 'dust'; dustCv.width = IW / 2; dustCv.height = IH / 2; art.appendChild(dustCv);
  var fx = layer('fx');
  var hot = layer('hotspots');
  HOTSPOTS.slice().sort(function (a, b) { return b.r[2] * b.r[3] - a.r[2] * a.r[3]; }).forEach(function (h) {      // big areas first, so small objects sit on top
    var b = document.createElement('button'); b.type = 'button'; b.className = 'hs hs-' + h.id; b.setAttribute('aria-label', h.label);
    b.style.cssText = 'left:' + h.r[0] + 'px;top:' + h.r[1] + 'px;width:' + h.r[2] + 'px;height:' + h.r[3] + 'px';
    b.innerHTML = '<span class="hs-tag">' + h.label + '</span>';
    b.addEventListener('click', function () { api.onOpen(h.id); });
    hot.appendChild(b);
  });

  /* ---------- fit the painting to the window (cover), keep the desk in view ---------- */
  var scale = 1;
  // The framing always keeps the whole notebook in view: on desktops it sits in the free space between the menu and the
  // panels; on phones the painting is scaled so the notebook fits the width, with a soft-focus copy of the room behind it.
  var NB = { x0: 500, x1: 1160, y1: 935 };                     // the notebook (with a little margin), in artwork pixels
  function fit() {
    var W = stage.clientWidth, H = stage.clientHeight, mobile = W <= 900;
    var bar = mobile ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 66) : 0;
    var h = H - bar, cover = Math.max(W / IW, h / IH) * (opts.depth ? 1.035 : 1), s = cover;      // the 3D view keeps a little room at the edges
    if (mobile) s = Math.min(cover, Math.max(W / (NB.x1 - NB.x0 + 30), h / IH * .62));
    var L = 0, R = W;
    if (!mobile) {
      var nav = document.getElementById('nav'), wid = document.getElementById('widgets');
      if (nav) L = nav.getBoundingClientRect().right + 12;
      var cardEl = document.getElementById('card'), open = document.body.classList.contains('card-open');
      if (open && cardEl) R = cardEl.getBoundingClientRect().left - 12; else if (wid && getComputedStyle(wid).display !== 'none') R = wid.getBoundingClientRect().left - 12;
      if (R - L < 320) { L = 0; R = W; }
    }
    var x = (L + R) / 2 - (NB.x0 + NB.x1) / 2 * s;
    if (!mobile && !document.body.classList.contains('card-open')) x = Math.min(x, W - 10 - 1645 * s);      // keep the candle and bunny on screen
    var edge = opts.depth ? Math.min(18, Math.max(0, (IW * s - W) / 2)) : 0;
    if (IW * s >= W) x = Math.min(-edge, Math.max(W - IW * s + edge, x)); else x = (W - IW * s) / 2;
    var y;
    if (IH * s >= h) { y = Math.min((h - IH * s) * .55, h - 10 - NB.y1 * s); y = Math.max(y, h - IH * s); }
    else y = h - IH * s;                                        // smaller than the screen: sit on the bottom, room fades in above
    scale = s;
    fitPanels(W, mobile, x, y, s);
    art.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    art.style.setProperty('--inv', String(1 / s));
  }
  // The right-hand panels never cover the candle and bunny: they measure themselves against the room and tighten up, then
  // let the goals list scroll, rather than sitting on top of them.
  var KEEP = { x0: 1400, x1: 1645, y0: 712 };
  function fitPanels(W, mobile, x, y, s) {
    var wid = document.getElementById('widgets'); if (!wid) return;
    var tiers = ['', 'tight', 'tighter'];
    function setTier(t) { wid.classList.remove('tight', 'tighter'); if (t === 'tighter') wid.classList.add('tight', 'tighter'); else if (t) wid.classList.add(t); }
    if (mobile) { setTier(''); wid.style.maxHeight = ''; return; }
    var left = W - 18 - wid.offsetWidth, clash = x + KEEP.x1 * s > left && x + KEEP.x0 * s < W;
    var avail = Math.max(240, Math.round(y + KEEP.y0 * s - 12 - wid.offsetTop));
    wid.style.maxHeight = 'none';
    var i = 0;
    for (; i < tiers.length; i++) { setTier(tiers[i]); if (!clash || wid.offsetHeight <= avail) break; }
    wid.style.maxHeight = clash ? avail + 'px' : '';
  }
  var ro = new ResizeObserver(function () { requestAnimationFrame(fit); });
  ro.observe(stage); ['nav', 'widgets'].forEach(function (id) { var e = document.getElementById(id); if (e) ro.observe(e); });
  new MutationObserver(function () { requestAnimationFrame(fit); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  var goalsEl = document.getElementById('wGoals'); if (goalsEl) new MutationObserver(function () { requestAnimationFrame(fit); }).observe(goalsEl, { childList: true });
  fit(); setTimeout(function () { root.classList.add('framed'); }, 400); window.addEventListener('load', fit); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ---------- time of day: crossfade between versions of the painting ---------- */
  function setTod(t) {
    root.dataset.tod = t;
    if (depthView) Object.keys(TODIMG).forEach(function (k) { var v = TODIMG[k]; if (k === t && !v.src) v.src = (opts.base || '/') + 'scene/library-dusk-' + k + '.webp'; });
    if (depthView) depthView.tod(t);
    Object.keys(TODIMG).forEach(function (k) { var v = TODIMG[k]; if (k === t && !v.src) v.src = (opts.base || '/') + 'scene/library-dusk-' + k + '.webp'; v.classList.toggle('on', k === t); });
  }

  /* ---------- handwriting on the painted notebook (left page) ---------- */
  function setNotebook(title, text) {
    var lines = []; if (title) lines.push('<b>' + esc(title) + '</b>');
    String(text || '').split('\n').forEach(function (l) { if (lines.length < 5 && l.trim()) lines.push(esc(l.length > 34 ? l.slice(0, 33) + '…' : l)); });
    ink.innerHTML = lines.map(function (l) { return '<span>' + l + '</span>'; }).join('');
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- little moments ---------- */
  function hearts(n) {
    n = n || 5;
    for (var i = 0; i < n; i++) { var h = document.createElement('i'); h.className = 'heart'; h.textContent = '♥'; h.style.left = (1150 + Math.random() * 120) + 'px'; h.style.top = (650 + Math.random() * 30) + 'px'; h.style.animationDelay = (i * .18) + 's'; fx.appendChild(h); setTimeout(function (e) { e.remove(); }, 2600, h); }
  }
  function sparkle(x, y) { var s = document.createElement('i'); s.className = 'spark'; s.style.left = x + 'px'; s.style.top = y + 'px'; fx.appendChild(s); setTimeout(function () { s.remove(); }, 1600); }

  /* ---------- dust in the lamplight, rain on the glass ---------- */
  var dctx = dustCv.getContext('2d'), rctx = rainCv.getContext('2d');
  var motes = []; for (var m = 0; m < 46; m++) motes.push({ x: 120 + Math.random() * 640, y: 60 + Math.random() * 360, r: .6 + Math.random() * 1.3, vx: (Math.random() - .5) * 4, vy: -1 - Math.random() * 3, ph: Math.random() * 6 });
  var drops = []; for (var d = 0; d < 140; d++) drops.push({ x: Math.random() * 560, y: Math.random() * 500, len: 14 + Math.random() * 26, v: 520 + Math.random() * 260, a: .05 + Math.random() * .07 });
  var last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(.05, (now - last) / 1000); last = now; if (document.hidden) return;
    if (depthView) depthView.frame(dt);
    dctx.clearRect(0, 0, dustCv.width, dustCv.height);
    motes.forEach(function (p) {
      if (!reduce) { p.x += p.vx * dt + Math.sin(now / 1700 + p.ph) * .05; p.y += p.vy * dt; if (p.y < 20) { p.y = 420; p.x = 120 + Math.random() * 640; } }
      var tw = .35 + .35 * Math.sin(now / 900 + p.ph);
      var inWin = Math.max(0, Math.min(1, Math.min(p.x - 305, 602 - p.x, 260 - p.y) / 14));                   // never in front of the glass (artwork / 2)
      dctx.fillStyle = 'rgba(255,226,170,' + (tw * (lampOn ? .8 : .35) * (1 - inWin)) + ')'; dctx.beginPath(); dctx.arc(p.x, p.y, p.r, 0, 7); dctx.fill();
    });
    rctx.clearRect(0, 0, 560, 500);
    if (rain > .01) {                                        // optional weather: a few thin, faint streaks falling outside the glass
      var n = Math.round(drops.length * Math.min(1, rain) * .5);
      rctx.lineCap = 'round';
      for (var i = 0; i < n; i++) {
        var q = drops[i];
        if (!reduce) { q.y += q.v * dt; if (q.y > 500) { q.y = -q.len; q.x = Math.random() * 560; } }
        rctx.strokeStyle = 'rgba(225,230,250,' + q.a + ')'; rctx.lineWidth = .7;
        rctx.beginPath(); rctx.moveTo(q.x, q.y); rctx.lineTo(q.x - q.len * .06, q.y + q.len); rctx.stroke();
      }
    }
  }
  var depthView = null;
  if (opts.depth) {
    var movers = [];
    Object.keys(LIGHTS).forEach(function (k) { var e = art.querySelector('.glow-' + k); if (e) movers.push({ el: e, x: LIGHTS[k].x, y: LIGHTS[k].y, z: .5 }); });
    HOTSPOTS.forEach(function (h) { movers.push({ el: art.querySelector('.hs-' + h.id), x: h.r[0] + h.r[2] / 2, y: h.r[1] + h.r[3] / 2, z: .5 }); });
    movers.push({ el: ink, x: 660, y: 860, z: .5 }, { el: steam, x: 590, y: 730, z: .5 }, { el: rainCv, x: 900, y: 250, z: .5 }, { el: fx, x: 1190, y: 720, z: .5 });
    depthView = createDepthView(root, art, img, TODIMG, opts.base || '/', movers);
    if (depthView) root.classList.add('depth');
  }
  requestAnimationFrame(tick);
  if (reduce) root.classList.add('still');
  return api;
}

// The 3D view: the same painting, rendered with real parallax from a depth map. At rest it is pixel-for-pixel the painted
// view; dragging moves the viewpoint, so near things (lamp, mug, cat) shift against the room behind them.
function createDepthView(root, art, baseImg, todImgs, baseUrl, overlays) {
  var FOCUS = .5, RANGE = { x: .02, y: .008 };
  var cv = document.createElement('canvas'); cv.className = 'art-gl';
  var small = window.innerWidth <= 900;
  cv.width = small ? 1254 : 1672; cv.height = small ? 706 : 941;
  var gl = cv.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  var VS = 'attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }';
  var FS = [
    'precision highp float; uniform sampler2D ta, tb, td; uniform vec2 cam; uniform float mixv; varying vec2 v;',
    'const float F = ' + FOCUS.toFixed(2) + ';',
    'float D(vec2 u) { return pow(texture2D(td, u).r, .62); }',
    'void main() {',
    '  const int N = 22; float zp = 1.; vec2 up = v - cam * (1. - F); float dp = D(up); vec2 hit = up;',
    '  if (dp < 1.) { for (int i = 1; i <= N; i++) {',
    '    float z = 1. - float(i) / float(N); vec2 u = v - cam * (z - F); float d = D(u);',
    '    if (d >= z) { float a = zp - dp, b = d - z; hit = mix(up, u, a / max(a + b, .0001)); break; }',
    '    zp = z; up = u; dp = d; hit = u;',
    '  } }',
    '  gl_FragColor = vec4(mix(texture2D(ta, hit).rgb, texture2D(tb, hit).rgb, mixv), 1.);',
    '}'].join('\n');
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
  var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var ap = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  function tex(unit, name) {
    var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p[0], p[1]); });
    gl.uniform1i(gl.getUniformLocation(pr, name), unit); return t;
  }
  var tA = tex(0, 'ta'), tB = tex(1, 'tb'), tD = tex(2, 'td');
  function upload(t, unit, im) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); }
  var uCam = gl.getUniformLocation(pr, 'cam'), uMix = gl.getUniformLocation(pr, 'mixv');

  var ready = { art: false, depth: false }, dirty = true, mixv = 0, fading = false, wantTod = null;
  var cam = { x: 0, y: 0 }, drag = { x: 0, y: 0 }, hover = { x: 0, y: 0 }, reduce = false;
  function show() { if (ready.art && ready.depth && !cv.parentNode) { baseImg.parentNode.insertBefore(cv, baseImg.nextSibling); Object.keys(todImgs).forEach(function (k) { baseImg.parentNode.insertBefore(todImgs[k], cv); }); root.classList.add('depth-on'); dirty = true; } }
  function whenLoaded(im, fn) { if (im.complete && im.naturalWidth) fn(); else im.addEventListener('load', fn, { once: true }); }
  var curIm = null;
  function setImage(im) {                                       // crossfade to another version of the painting
    whenLoaded(im, function () {
      if (im === curIm) return;
      if (!curIm) { upload(tA, 0, im); upload(tB, 1, im); curIm = im; ready.art = true; show(); dirty = true; return; }
      upload(tB, 1, im); curIm = im; mixv = 0; fading = true; dirty = true;
    });
  }
  // depth: the texture, plus a readable copy so overlays (glows, clickable areas) move with what they sit on
  var depthData = null, dw = 0, dh = 0, di = new Image(); di.decoding = 'async';
  di.onload = function () {
    upload(tD, 2, di); ready.depth = true; show();
    try { var c = document.createElement('canvas'); dw = c.width = di.naturalWidth; dh = c.height = di.naturalHeight; var x = c.getContext('2d'); x.drawImage(di, 0, 0); depthData = x.getImageData(0, 0, dw, dh).data; } catch (e) { depthData = null; }
    overlays.forEach(function (o) { o.z = depthAt(o.x, o.y); }); moved();
  };
  di.src = baseUrl + 'scene/library-depth.webp';
  function depthAt(x, y) { if (!depthData) return FOCUS; var i = (Math.round(y / 941 * (dh - 1)) * dw + Math.round(x / 1672 * (dw - 1))) * 4; return Math.pow(depthData[i] / 255, .62); }
  function moved() { overlays.forEach(function (o) { o.el.style.translate = (cam.x * (o.z - FOCUS) * 1672).toFixed(2) + 'px ' + (cam.y * (o.z - FOCUS) * 941).toFixed(2) + 'px'; }); }

  /* looking around: drag anywhere on the room; a mouse also nudges the view slightly as it moves */
  var down = null, suppress = false;
  root.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, dx: drag.x, dy: drag.y, id: e.pointerId }; suppress = false; root.classList.add('looking'); });
  window.addEventListener('pointermove', function (e) {
    var W = window.innerWidth, H = window.innerHeight;
    if (down && e.pointerId === down.id) {
      var mx = e.clientX - down.x, my = e.clientY - down.y; if (Math.abs(mx) + Math.abs(my) > 6) suppress = true;
      drag.x = Math.max(-1, Math.min(1, down.dx + mx / (W * .32))); drag.y = Math.max(-1, Math.min(1, down.dy + my / (H * .32))); dirty = true;
    } else if (e.pointerType === 'mouse') { hover.x = (e.clientX / W - .5) * .3; hover.y = (e.clientY / H - .5) * .3; dirty = true; }
  });
  function up(e) { if (down && e.pointerId === down.id) { down = null; root.classList.remove('looking'); setTimeout(function () { suppress = false; }, 0); } }
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  root.addEventListener('click', function (e) { if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; } }, true);   // a drag is not a click
  cv.addEventListener('webglcontextlost', function () { cv.remove(); root.classList.remove('depth-on'); });                               // falls back to the still painting

  setImage(baseImg);
  return {
    tod: function (t) { wantTod = t; setImage(todImgs[t] || baseImg); },
    setReduce: function (v) { reduce = !!v; dirty = true; },
    frame: function (dt) {
      if (!ready.art || !ready.depth) return;
      var hx = reduce ? 0 : hover.x, hy = reduce ? 0 : hover.y, tx = Math.max(-1, Math.min(1, drag.x + hx)) * RANGE.x, ty = Math.max(-1, Math.min(1, drag.y + hy)) * RANGE.y;
      var k = reduce ? 1 : 1 - Math.exp(-dt * 7), nx = cam.x + (tx - cam.x) * k, ny = cam.y + (ty - cam.y) * k;
      if (Math.abs(nx - cam.x) + Math.abs(ny - cam.y) > 1e-6) { cam.x = nx; cam.y = ny; dirty = true; moved(); }
      if (fading) { mixv = reduce ? 1 : Math.min(1, mixv + dt / 1.2); dirty = true; if (mixv >= 1) { upload(tA, 0, curIm); mixv = 0; fading = false; } }
      if (!dirty) return;
      dirty = false; gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uCam, cam.x, cam.y); gl.uniform1f(uMix, mixv); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };
}
