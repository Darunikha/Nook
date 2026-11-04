// The painted library: the illustrated scene with living light (lamp, candle, sconces, star), clear glass with an optional fine rain,
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
var LIGHTS = {
  lamp: { x: 405, y: 494, r: 300, c: '255,196,120', a: .55 },
  candle: { x: 1475, y: 792, r: 120, c: '255,180,100', a: .6 },
  sconceL: { x: 445, y: 300, r: 90, c: '255,200,130', a: .35 },
  sconceT: { x: 563, y: 86, r: 70, c: '255,200,130', a: .3 },
  floor: { x: 1134, y: 468, r: 150, c: '255,205,140', a: .35 },
  star: { x: 990, y: 225, r: 60, c: '255,226,160', a: .5 }
};
var WINDOW = 'polygon(37.8% 4%, 41% 1.5%, 46.6% 0%, 52% 0%, 58% 1%, 61.4% 3%, 70.6% 3.5%, 70.6% 50%, 37.8% 50%)';

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
    setNotebook: setNotebook, setReduce: function (v) { reduce = !!v; root.classList.toggle('still', reduce); }
  };
  var lampOn = true, candleOn = true, rain = 0;

  /* ---------- build ---------- */
  var root = document.createElement('div'); root.className = 'painted'; stage.appendChild(root);
  var back = document.createElement('div'); back.className = 'backdrop'; back.style.backgroundImage = 'url(' + (opts.base || '/') + 'scene/library-dusk.webp)'; root.appendChild(back);
  var art = document.createElement('div'); art.className = 'art'; root.appendChild(art);
  var img = new Image(); img.className = 'art-img'; img.alt = ''; img.decoding = 'async'; img.src = (opts.base || '/') + 'scene/library-dusk.webp'; art.appendChild(img);
  function layer(cls) { var d = document.createElement('div'); d.className = cls; art.appendChild(d); return d; }
  var sky = layer('sky-tint'); sky.style.clipPath = WINDOW;
  var sheen = layer('glass-sheen'); sheen.style.clipPath = WINDOW;                 // a soft reflection on clear glass
  var rainCv = document.createElement('canvas'); rainCv.className = 'rain'; rainCv.width = 560; rainCv.height = 470; rainCv.style.cssText = 'left:630px;top:0;width:560px;height:470px'; art.appendChild(rainCv);
  layer('grade');
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
    var h = H - bar, cover = Math.max(W / IW, h / IH), s = cover;
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
    if (IW * s >= W) x = Math.min(0, Math.max(W - IW * s, x)); else x = (W - IW * s) / 2;
    var y;
    if (IH * s >= h) { y = Math.min((h - IH * s) * .55, h - 10 - NB.y1 * s); y = Math.max(y, h - IH * s); }
    else y = h - IH * s;                                        // smaller than the screen: sit on the bottom, room fades in above
    scale = s;
    art.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    art.style.setProperty('--inv', String(1 / s));
  }
  var ro = new ResizeObserver(function () { requestAnimationFrame(fit); });
  ro.observe(stage); ['nav', 'widgets'].forEach(function (id) { var e = document.getElementById(id); if (e) ro.observe(e); });
  new MutationObserver(function () { requestAnimationFrame(fit); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  fit(); setTimeout(function () { root.classList.add('framed'); }, 400); window.addEventListener('load', fit); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ---------- time of day: a gentle grade over the painting and the sky ---------- */
  function setTod(t) { root.dataset.tod = t; }

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
    dctx.clearRect(0, 0, dustCv.width, dustCv.height);
    motes.forEach(function (p) {
      if (!reduce) { p.x += p.vx * dt + Math.sin(now / 1700 + p.ph) * .05; p.y += p.vy * dt; if (p.y < 20) { p.y = 420; p.x = 120 + Math.random() * 640; } }
      var tw = .35 + .35 * Math.sin(now / 900 + p.ph);
      dctx.fillStyle = 'rgba(255,226,170,' + (tw * (lampOn ? .8 : .35)) + ')'; dctx.beginPath(); dctx.arc(p.x, p.y, p.r, 0, 7); dctx.fill();
    });
    rctx.clearRect(0, 0, 560, 470);
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
  requestAnimationFrame(tick);
  if (reduce) root.classList.add('still');
  return api;
}
