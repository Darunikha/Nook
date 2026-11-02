import './style.css';
import './three-setup.js';

(function () {
  var $ = function (s) { return document.querySelector(s); };
  var tt;
  function toast(t) { var e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { e.classList.remove('show'); }, 2400); }

  /* ---------- sample sessions ---------- */
  var SUBJECTS = [
    { id: 'bio', name: 'Biology', c: ['#7F9C83', '#6B8A70', '#93B096'] },
    { id: 'lit', name: 'Literature', c: ['#A8445C', '#C25E74', '#8E3A50'] },
    { id: 'math', name: 'Maths', c: ['#3E5E70', '#4E7287', '#2F4B5B'] },
    { id: 'hist', name: 'History', c: ['#C9952F', '#B07F22', '#D9A949'] },
    { id: 'art', name: 'Art', c: ['#8C6FB0', '#A387C4', '#765C99'] }
  ];
  var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var books = [], days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (var i = 0; i < 34; i++) {
    var s = SUBJECTS[Math.floor(rnd() * SUBJECTS.length)], mins = [25, 25, 25, 50, 50][Math.floor(rnd() * 5)];
    books.push({ s: s, mins: mins, color: s.c[Math.floor(rnd() * 3)], h: .44 + rnd() * .2, w: mins === 50 ? .12 + rnd() * .03 : .075 + rnd() * .03, when: days[i % 7] + ' ' + (1 + (i % 27)) + ' Oct' });
  }
  var calMins = []; for (var c = 0; c < 28; c++) calMins.push(c % 7 === 6 ? 0 : Math.floor(rnd() * 5) * 25);
  function totalMins() { return books.reduce(function (a, b) { return a + b.mins; }, 0); }
  function fmtHours(m) { return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; }
  function updateStats() {
    $('#sBooks').textContent = books.length; $('#sHours').textContent = fmtHours(totalMins());
    $('#catLine').textContent = 'Asleep on the end of your table, as usual. Mochi has kept you company for ' + fmtHours(totalMins()) + ' of studying.';
    $('#legend').innerHTML = SUBJECTS.map(function (s) {
      var n = books.filter(function (b) { return b.s === s; });
      return '<div><i style="background:' + s.c[0] + '"></i><span>' + s.name + '</span><span>' + n.length + ' books · ' + fmtHours(n.reduce(function (a, b) { return a + b.mins; }, 0)) + '</span></div>';
    }).join('');
    $('#cal').innerHTML = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d) { return '<span class="h">' + d + '</span>'; }).join('') +
      calMins.map(function (m, k) { var a = m ? .25 + m / 125 * .75 : 0; return '<span title="' + m + ' min" style="' + (m ? 'background: color-mix(in srgb, var(--accent) ' + Math.round(a * 100) + '%, var(--card-2)); color: ' + (a > .6 ? 'var(--accent-ink)' : 'var(--ink)') : '') + '">' + (k + 1) + '</span>'; }).join('');
    var wk = calMins.slice(21).reduce(function (a, b) { return a + b; }, 0);
    $('#calNote').textContent = 'This week: ' + fmtHours(wk) + ' across ' + calMins.slice(21).filter(Boolean).length + ' days.';
  }
  function showBook(b) { $('#bookNote').innerHTML = '<i style="background:' + b.color + '"></i><span><b>' + b.s.name + '</b> · ' + b.mins + ' minute session · ' + b.when + '</span>'; }
  updateStats();

  /* =====================================================================
     THE ROOM: an enclosed room seen from your seat (three.js)
     ===================================================================== */
  var room = (function () {
    var stage = $('#stage');
    function fail(msg) { var d = document.createElement('div'); d.className = 'fallback'; d.textContent = msg; stage.appendChild(d); return null; }
    if (!window.THREE) return fail('The library could not load. Check your connection and refresh.');
    THREE.ColorManagement.legacyMode = false;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { return fail('Your browser does not support 3D graphics (WebGL).'); }
    var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(DPR);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
    stage.appendChild(renderer.domElement);
    var scene = new THREE.Scene(); scene.background = new THREE.Color('#2A1E17');
    scene.fog = new THREE.Fog('#2A1E17', 9, 26);                          // warm candle haze
    var camera = new THREE.PerspectiveCamera(60, 1, .05, 60); camera.rotation.order = 'YXZ';
    var envMats = [];
    try { var pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture; } catch (e) { /* reflections are optional */ }

    /* ---------- post: soft bloom, then a warm grade ---------- */
    var composer = null, bloom = null, finalPass = null;
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass && THREE.ShaderPass) {
      composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType }));
      composer.addPass(new THREE.RenderPass(scene, camera));
      bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .28, .55, .94); composer.addPass(bloom);
      finalPass = new THREE.ShaderPass({
        uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform sampler2D tDiffuse; uniform float exposure; uniform float time; uniform vec2 res; varying vec2 vUv;',
          'vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }',
          'vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }',
          'void main(){',
          '  vec3 c = toSRGB(aces(texture2D(tDiffuse, vUv).rgb * exposure));',
          '  c = c * .97 + vec3(.022, .015, .008);',                                // lifted, warm shadows
          '  c = mix(c, c * vec3(1.03, 1.0, .95), .3);',                           // a whisper of honey
          '  float v = smoothstep(1.05, .35, length((vUv - .5) * vec2(1.1, 1.0)));',
          '  c *= mix(.8, 1., v);',
          '  float g = fract(sin(dot(vUv * res + time, vec2(12.9898, 78.233))) * 43758.5453);',
          '  c += (g - .5) * .014;',
          '  gl_FragColor = vec4(c, 1.);',
          '}'
        ].join('\n')
      });
      composer.addPass(finalPass);
    } else { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputEncoding = THREE.sRGBEncoding; }

    /* ---------- helpers (everything extra-rounded) ---------- */
    var tag = null, RB = THREE.RoundedBoxGeometry;
    function mat(c, o) { var env = o && o.env; if (o && 'env' in o) { o = Object.assign({}, o); delete o.env; } var m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .7, metalness: 0 }, o)); if (env != null) m.userData.env = env; return m; }
    function add(mesh, parent, cast) { mesh.castShadow = cast !== false; mesh.receiveShadow = true; if (tag) mesh.userData.hot = tag; (parent || scene).add(mesh); return mesh; }
    function geoBox(w, h, d, r) { return RB ? new RB(w, h, d, 4, Math.min((r || .1) * .4, Math.min(w, h, d) * .3)) : new THREE.BoxGeometry(w, h, d); }
    function box(w, h, d, m, x, y, z, parent, cast, r) { var mesh = new THREE.Mesh(geoBox(w, h, d, r), m.isMaterial ? m : mat(m)); mesh.position.set(x, y, z); return add(mesh, parent, cast); }
    function flat(w, h, d, m, x, y, z, parent, cast) { var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.isMaterial ? m : mat(m)); mesh.position.set(x, y, z); return add(mesh, parent, cast === true); }
    function cyl(rt, rb, h, m, x, y, z, seg, parent) { var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 32), m.isMaterial ? m : mat(m)); mesh.position.set(x, y, z); return add(mesh, parent); }
    function ball(r, m, x, y, z, sx, sy, sz, parent) { var mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), m.isMaterial ? m : mat(m)); mesh.position.set(x, y, z); mesh.scale.set(sx || 1, sy || 1, sz || 1); return add(mesh, parent); }
    function capsule(r, len, m, x, y, z, parent) { var g = THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(r, len, 8, 16) : new THREE.CylinderGeometry(r, r, len + 2 * r, 16); var mesh = new THREE.Mesh(g, m.isMaterial ? m : mat(m)); mesh.position.set(x, y, z); return add(mesh, parent); }
    function rod(a, b, r, m, parent) { var dir = new THREE.Vector3().subVectors(b, a), len = dir.length(); var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m.isMaterial ? m : mat(m)); mesh.position.copy(a).addScaledVector(dir, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); return add(mesh, parent); }
    function canvasTex(w, h, draw, linear) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (!linear) t.encoding = THREE.sRGBEncoding; t.userData = { canvas: c, draw: draw }; return t; }
    function redraw(t) { var d = t.userData; d.draw(d.canvas.getContext('2d'), d.canvas.width, d.canvas.height); t.needsUpdate = true; }
    var glowTex = canvasTex(64, 64, function (x, w) { var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }, true);
    function glow(color, size, x, y, z, op) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: op == null ? .5 : op, fog: false })); s.scale.set(size, size, 1); s.position.set(x, y, z); scene.add(s); return s; }
    function spriteSet(n, draw, size) { var tex = canvasTex(64, 64, draw), arr = []; for (var k = 0; k < n; k++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); sp.scale.set(size, size, 1); sp.userData.t = k / n; scene.add(sp); arr.push(sp); } return arr; }
    function emissive(col, i) { return new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: i || 3, roughness: .4 }); }

    /* ---------- procedural wood: colour grain + a matching bump map ---------- */
    function woodTex(base, o) {
      o = o || {};
      function paint(x, w, h, bump) {
        var sd = o.seed || 7; function r() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
        x.fillStyle = bump ? '#808080' : base; x.fillRect(0, 0, w, h);
        for (var i = 0; i < (o.lines || 150); i++) {
          var y = r() * h, a = (.03 + r() * .07) * (o.contrast || 1), th = .6 + r() * 1.6, ph = r() * 6, amp = 1 + r() * 5, dk = r() < .64;
          x.strokeStyle = bump ? (dk ? 'rgba(0,0,0,' + a * .9 + ')' : 'rgba(255,255,255,' + a * .6 + ')') : (dk ? 'rgba(18,9,4,' + a + ')' : 'rgba(255,224,184,' + a * .55 + ')');
          x.lineWidth = th; x.beginPath();
          for (var px = 0; px <= w; px += 16) { var yy = y + Math.sin(px * .012 + ph) * amp + Math.sin(px * .041 + ph * 2) * amp * .3; if (px === 0) x.moveTo(px, yy); else x.lineTo(px, yy); }
          x.stroke();
        }
        if (!bump) for (var k = 0; k < 1500; k++) { x.fillStyle = 'rgba(25,12,5,' + (.03 + r() * .05) + ')'; x.fillRect(r() * w, r() * h, 1 + r() * 5, .8); }
        if (o.planks) {
          var ph2 = h / o.planks;
          for (var q = 0; q < o.planks; q++) {
            x.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0' : '255,220,170') + ',' + (bump ? 0 : .04 + r() * .09) + ')'; x.fillRect(0, q * ph2, w, ph2);
            var sx = r() * w; x.fillStyle = bump ? '#000' : 'rgba(8,4,2,.75)'; x.fillRect(sx, q * ph2, 2.5, ph2);
            x.fillStyle = bump ? '#000' : 'rgba(8,4,2,.8)'; x.fillRect(0, q * ph2, w, 2.5);
          }
        }
      }
      var map = canvasTex(512, 512, function (x, w, h) { paint(x, w, h, false); });
      var bump = canvasTex(512, 512, function (x, w, h) { paint(x, w, h, true); }, true);
      [map, bump].forEach(function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
      return { map: map, bump: bump };
    }
    function woodMat(base, o) {
      o = o || {}; var w = woodTex(base, o);
      var m = mat('#ffffff', { map: w.map, bumpMap: w.bump, bumpScale: o.bumpScale || .25, roughness: o.roughness == null ? .5 : o.roughness, env: o.env == null ? .45 : o.env });
      return m;
    }

    /* ---------- palette: deep, warm, a little worn ---------- */
    var shelfM = woodMat('#4A2C1C', { seed: 3, roughness: .5 }), shelfDark = woodMat('#33200F', { seed: 5, roughness: .55 }), shelfBack = mat('#241811', { roughness: .95 });
    var peach = woodMat('#6B4529', { seed: 11, roughness: .46, env: .5, bumpScale: .06, contrast: .7, lines: 90 }), gold = mat('#C79A45', { metalness: .9, roughness: .3, env: 1 });
    var rose = '#8A4A50', mint = '#5C7766', cream = '#CDBE9E', butter = '#B58E4A', lilac = '#7B5B42', sky = '#5F7F93', peachC = '#A87B6A';

    /* ---------- textures ---------- */
    function spineTex(variant) {
      return canvasTex(64, 256, function (x, w, h) {
        var g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#d9d9d9'); g.addColorStop(.3, '#fafafa'); g.addColorStop(.7, '#ffffff'); g.addColorStop(1, '#dedede');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(255,255,255,1)';
        if (variant === 0) { x.fillRect(0, 22, w, 6); x.fillRect(0, h - 28, w, 6); }
        else { x.fillRect(0, 36, w, 4); x.fillRect(0, h - 40, w, 4); }
        x.fillStyle = 'rgba(60,35,20,.18)'; x.beginPath(); x.roundRect ? x.roundRect(12, 70, w - 24, 56, 10) : x.rect(12, 70, w - 24, 56); x.fill();
        x.fillStyle = 'rgba(255,255,255,.95)';
        if (variant === 0) { x.beginPath(); x.arc(w / 2, 98, 7, 0, 7); x.fill(); }                   // a little dot
        else { x.save(); x.translate(w / 2, 98); x.beginPath(); for (var i = 0; i < 10; i++) { var r = i % 2 ? 4 : 9, a = i / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); x.restore(); }   // a little star
      });
    }
    var spineA = spineTex(0), spineB = spineTex(1);
    var floorWood = woodTex('#6A4630', { seed: 21, planks: 10, lines: 190 });
    var floorTex = floorWood.map, floorBump = floorWood.bump;
    floorTex.repeat.set(3, 3.5); floorBump.repeat.set(3, 3.5);
    var wallTex = canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = '#4A382C'; x.fillRect(0, 0, w, h);
      for (var k = 0; k < 2500; k++) { x.fillStyle = 'rgba(' + (k % 2 ? '0,0,0' : '255,225,190') + ',' + (.02 + (k % 7) * .006) + ')'; x.fillRect((k * 53) % w, (k * 97) % h, 2 + k % 5, 2 + k % 4); }
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(4, 3);
    var ceilTex = canvasTex(512, 512, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2B1D15'); g.addColorStop(1, '#1D130D'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; for (var q = 0; q <= 8; q++) { x.beginPath(); x.moveTo(0, q * h / 8); x.lineTo(w, q * h / 8); x.stroke(); }
      for (var k = 0; k < 90; k++) { x.strokeStyle = 'rgba(255,220,170,.05)'; x.lineWidth = 1; var yy = (k * 37) % h; x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(w * .3, yy + 4, w * .7, yy - 4, w, yy); x.stroke(); }
    });
    var runnerTex = canvasTex(256, 1024, function (x, w, h) {
      x.fillStyle = '#5F1B26'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1D2742'; x.fillRect(0, 0, 38, h); x.fillRect(w - 38, 0, 38, h);
      x.strokeStyle = '#C79A45'; x.lineWidth = 3; x.strokeRect(46, -4, w - 92, h + 8); x.lineWidth = 2; x.strokeRect(10, -4, w - 20, h + 8);
      for (var y = 0; y < h; y += 64) { x.fillStyle = '#C79A45'; x.beginPath(); x.moveTo(19, y + 32); x.lineTo(28, y + 40); x.lineTo(19, y + 48); x.lineTo(10, y + 40); x.fill(); x.beginPath(); x.moveTo(w - 19, y + 32); x.lineTo(w - 10, y + 40); x.lineTo(w - 19, y + 48); x.lineTo(w - 28, y + 40); x.fill(); }
      for (var m = 0; m < 4; m++) {
        var cy = m * 256 + 128; x.fillStyle = '#1D2742'; x.beginPath(); x.moveTo(w / 2, cy - 84); x.lineTo(w / 2 + 52, cy); x.lineTo(w / 2, cy + 84); x.lineTo(w / 2 - 52, cy); x.fill();
        x.strokeStyle = '#C79A45'; x.lineWidth = 3; x.stroke(); x.fillStyle = '#E6D5AE'; x.beginPath(); x.moveTo(w / 2, cy - 42); x.lineTo(w / 2 + 26, cy); x.lineTo(w / 2, cy + 42); x.lineTo(w / 2 - 26, cy); x.fill();
        x.fillStyle = '#7A2431'; x.beginPath(); x.arc(w / 2, cy, 9, 0, 7); x.fill();
        [-1, 1].forEach(function (sd) { for (var d = -1; d <= 1; d += 2) { x.fillStyle = '#C79A45'; x.beginPath(); x.arc(w / 2 + sd * 82, cy + d * 56, 5, 0, 7); x.fill(); } });
      }
      for (var k = 0; k < 3000; k++) { x.fillStyle = 'rgba(' + (k % 2 ? '0,0,0' : '255,230,200') + ',' + (.03 + (k % 5) * .01) + ')'; x.fillRect((k * 47) % w, (k * 89) % h, 2, 2); }
    });
    runnerTex.wrapT = THREE.RepeatWrapping; runnerTex.repeat.set(1, 3);
    var SKY = { morning: ['#8FB8E8', '#F7C9C0', '#FDE3C4'], day: ['#6FB4E8', '#BFE1F5', '#EAF6FB'], golden: ['#34327F', '#8A5AA8', '#E58AA0', '#F6B073'], night: ['#0B0F2B', '#1A2150', '#39406E'] };
    var TREES = { morning: ['#B7C7B0', '#7C9A78', '#46664A', null], day: ['#9DC4A6', '#5E8C66', '#2F5A3C', null], golden: ['#6A4C86', '#33284F', '#17122A', '#E58AA0'], night: ['#151B3E', '#0C1030', '#05071A', null] };
    var skyTod = 'day';
    var skyTex = canvasTex(1024, 720, function (x, w, h) {
      var c = SKY[skyTod], g = x.createLinearGradient(0, 0, 0, h);
      c.forEach(function (col, i) { g.addColorStop(i / (c.length - 1), col); });
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      var sd = 11; function rr() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
      if (skyTod === 'night') {
        x.fillStyle = '#FFF6D8'; for (var k = 0; k < 120; k++) { x.globalAlpha = .35 + (k % 5) / 9; x.beginPath(); x.arc(rr() * w, rr() * h * .62, .9 + rr() * 1.3, 0, 7); x.fill(); }
        x.globalAlpha = 1; var mx = w * .66, my = h * .2, mg = x.createRadialGradient(mx, my, 10, mx, my, 150); mg.addColorStop(0, 'rgba(230,238,255,.5)'); mg.addColorStop(1, 'rgba(230,238,255,0)'); x.fillStyle = mg; x.fillRect(0, 0, w, h);
        x.fillStyle = '#F2EEDF'; x.beginPath(); x.arc(mx, my, 30, 0, 7); x.fill(); x.fillStyle = 'rgba(150,150,140,.28)'; [[-10, -7, 8], [9, 5, 10], [-4, 12, 6], [11, -11, 5]].forEach(function (m) { x.beginPath(); x.arc(mx + m[0], my + m[1], m[2], 0, 7); x.fill(); });
      } else {
        var sp = { morning: [.3, .74], day: [.7, .2], golden: [.5, .8] }[skyTod], R = skyTod === 'golden' ? 420 : 240;
        var sg = x.createRadialGradient(w * sp[0], h * sp[1], 0, w * sp[0], h * sp[1], R);
        sg.addColorStop(0, skyTod === 'golden' ? 'rgba(255,214,150,.95)' : 'rgba(255,250,235,1)'); sg.addColorStop(.4, skyTod === 'golden' ? 'rgba(255,150,130,.45)' : 'rgba(255,245,225,.5)'); sg.addColorStop(1, 'rgba(255,200,160,0)'); x.fillStyle = sg; x.fillRect(0, 0, w, h);
      }
      x.fillStyle = skyTod === 'night' ? 'rgba(110,120,175,.26)' : skyTod === 'golden' ? 'rgba(255,170,170,.42)' : 'rgba(255,255,255,.55)'; if ('filter' in x) x.filter = 'blur(10px)';
      for (var cl = 0; cl < 7; cl++) { var cxx = rr() * w, cyy = h * (.18 + rr() * .42), cw = 70 + rr() * 110; for (var k2 = 0; k2 < 5; k2++) { x.beginPath(); x.ellipse(cxx + (k2 - 2) * cw * .6, cyy + Math.sin(k2 * 2.1) * 5, cw * (.8 + (k2 % 2) * .3), cw * .16, 0, 0, 7); x.fill(); } }
      if ('filter' in x) x.filter = 'none';
      // layers of treetops: hazy far line, mid trees, then big near crowns at the edges
      var T = TREES[skyTod];
      function crowns(color, baseY, n, rad, x0, x1, rim) {
        x.fillStyle = color;
        for (var i = 0; i < n; i++) {
          var cx = x0 + rr() * (x1 - x0), cy = baseY - rr() * rad * .7, r = rad * (.55 + rr() * .6);
          for (var b = 0; b < 9; b++) { var a = rr() * 6.283, d = rr() * r * .8, rb = r * (.38 + rr() * .4); x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * .8, rb, 0, 7); x.fill(); }
          x.fillRect(cx - r * .05, cy, r * .1, h - cy);
        }
        x.fillRect(0, baseY + rad * .35, w, h);
        if (rim) { x.fillStyle = rim; x.globalAlpha = .55; for (var k = 0; k < n * 14; k++) { var rx = x0 + rr() * (x1 - x0), ry = baseY - rr() * rad * 1.1; x.beginPath(); x.arc(rx, ry, 1.2 + rr() * 1.8, 0, 7); x.fill(); } x.globalAlpha = 1; }
      }
      x.globalAlpha = .75; crowns(T[0], h * .68, 16, 46, 0, w, null); x.globalAlpha = 1;
      crowns(T[1], h * .76, 14, 70, 0, w, T[3]);
      crowns(T[2], h * .62, 5, 150, -20, w * .3, T[3]); crowns(T[2], h * .6, 5, 150, w * .7, w + 20, T[3]);
      crowns(T[2], h * .9, 8, 60, 0, w, null);
    });

    /* ---------- the hall ---------- */
    var X = 5, Z0 = -8, Z1 = 4, HH = 5.6, ZC = (Z0 + Z1) / 2, ZL = Z1 - Z0;
    var floor = new THREE.Mesh(new THREE.BoxGeometry(2 * X + .4, .2, ZL + .4), new THREE.MeshStandardMaterial({ map: floorTex, bumpMap: floorBump, bumpScale: .3, roughness: .38 })); floor.position.set(0, -.1, ZC); add(floor, null, false);
    var wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: .95 });
    flat(2 * X + .4, HH + .2, .2, wallM, 0, HH / 2, Z0 - .1); flat(2 * X + .4, HH + .2, .2, wallM, 0, HH / 2, Z1 + .1);
    flat(.2, HH + .2, ZL + .4, wallM, -X - .1, HH / 2, ZC); flat(.2, HH + .2, ZL + .4, wallM, X + .1, HH / 2, ZC);
    var ceil = new THREE.Mesh(new THREE.BoxGeometry(2 * X + .4, .2, ZL + .4), new THREE.MeshBasicMaterial({ map: ceilTex, fog: false })); ceil.position.set(0, HH + .1, ZC); scene.add(ceil);
    for (var bz = Z0 + 1.5; bz < Z1; bz += 3) box(2 * X, .24, .3, shelfDark, 0, HH - .12, bz, null, false, .04);           // dark oak beams
    var runner = new THREE.Mesh(geoBox(1.9, .03, 10.5, .015), new THREE.MeshStandardMaterial({ map: runnerTex, roughness: .95, bumpMap: runnerTex, bumpScale: .5 })); runner.position.set(0, .015, -2.6); add(runner, null, false);

    /* ---------- books: two instanced meshes ---------- */
    var PAL = ['#2C3A55', '#5A2A2E', '#3B4A3C', '#6B4A32', '#8A6A45', '#C9B48C', '#26324A', '#4A2B3A', '#7A5A3A', '#2E2A2A', '#9A7B4F', '#D8C7A5', '#40506A', '#6E3B34', '#7A4B52'];
    var MAXB = 2600;
    var bookMeshes = [spineA, spineB].map(function (t) { var m = new THREE.InstancedMesh(geoBox(1, 1, 1, .12), new THREE.MeshStandardMaterial({ map: t, roughness: .55 }), MAXB); m.castShadow = false; m.receiveShadow = true; m.userData.hot = 'library'; m.userData.n = 0; return m; });
    var dummy = new THREE.Object3D(), col = new THREE.Color();
    function fillRun(axis, a0, a1, fixed, face, levels, maxH, depth) {
      levels.forEach(function (y) {
        var a = a0 + .04;
        while (a < a1 - .06) {
          if (rnd() < .05) { a += .1 + rnd() * .18; continue; }
          var w = .055 + rnd() * .06, h = Math.min(maxH, .3 + rnd() * .2), bm = bookMeshes[rnd() < .5 ? 0 : 1];
          if (a + w > a1 || bm.userData.n >= MAXB) break;
          var lean = rnd() < .05 ? .18 : 0, off = fixed + face * (depth / 2 - .15), dp = .24 + rnd() * .04;
          if (axis === 'x') { dummy.position.set(a + w / 2, y + h / 2, off); dummy.scale.set(w, h, dp); dummy.rotation.set(0, 0, lean); }
          else { dummy.position.set(off, y + h / 2, a + w / 2); dummy.scale.set(dp, h, w); dummy.rotation.set(lean, 0, 0); }
          dummy.updateMatrix(); bm.setMatrixAt(bm.userData.n, dummy.matrix);
          bm.setColorAt(bm.userData.n, col.set(PAL[Math.floor(rnd() * PAL.length)]));
          bm.userData.n++; a += w + .006;
        }
      });
    }
    function shelfRun(axis, a0, a1, fixed, face, y0, y1, levels, depth, bay) {
      var len = a1 - a0, mid = (a0 + a1) / 2, h = y1 - y0, back = fixed - face * (depth / 2 - .02);
      if (axis === 'x') {
        flat(len, h, .04, shelfBack, mid, y0 + h / 2, back);
        levels.concat([y1]).forEach(function (y) { box(len, .06, depth, shelfDark, mid, y - .03, fixed, null, false, .03); });
        for (var s = a0; s <= a1 + .01; s += bay) box(.1, h, depth + .06, shelfM, Math.min(s, a1), y0 + h / 2, fixed, null, false, .05);
        box(len + .14, .14, depth + .16, shelfM, mid, y1 + .07, fixed, null, false, .07);
      } else {
        flat(.04, h, len, shelfBack, back, y0 + h / 2, mid);
        levels.concat([y1]).forEach(function (y) { box(depth, .06, len, shelfDark, fixed, y - .03, mid, null, false, .03); });
        for (var s2 = a0; s2 <= a1 + .01; s2 += bay) box(depth + .06, h, .1, shelfM, fixed, y0 + h / 2, Math.min(s2, a1), null, false, .05);
        box(depth + .16, .14, len + .14, shelfM, fixed, y1 + .07, mid, null, false, .07);
      }
      fillRun(axis, a0, a1, fixed, face, levels, (levels[1] - levels[0]) - .09, depth);
    }
    var LOW = [.1, .68, 1.26, 1.84, 2.42], UP = [3.14, 3.7, 4.26, 4.82];
    tag = 'library';
    shelfRun('z', Z0 + .3, .45, -X + .24, 1, 0, 2.86, LOW, .46, 1.2);
    shelfRun('z', Z0 + .3, Z1 - .2, X - .24, -1, 0, 2.86, LOW, .46, 1.2);
    shelfRun('z', Z0 + .3, Z1 - .2, -X + .24, 1, 3.04, 5.36, UP, .46, 1.2);
    shelfRun('z', Z0 + .3, Z1 - .2, X - .24, -1, 3.04, 5.36, UP, .46, 1.2);
    var TALL = [.1, .68, 1.26, 1.84, 2.42, 3.0, 3.58, 4.16, 4.74];
    shelfRun('x', -X + .5, -3.1, Z0 + .26, 1, 0, 5.3, TALL, .46, 1.05);
    shelfRun('x', 3.1, X - .5, Z0 + .26, 1, 0, 5.3, TALL, .46, 1.05);
    var STACK = [.1, .64, 1.18, 1.72];
    [-6.1, -4.3].forEach(function (z) {
      [-1, 1].forEach(function (side) {
        var a0 = side < 0 ? -3.75 : 1.75, a1 = side < 0 ? -1.75 : 3.75, mid = (a0 + a1) / 2;
        flat(a1 - a0, 2.2, .04, shelfBack, mid, 1.1, z);
        STACK.concat([2.22]).forEach(function (y) { box(a1 - a0, .06, .66, shelfDark, mid, y - .03, z, null, false, .03); });
        [a0, mid, a1].forEach(function (x) { box(.1, 2.26, .72, shelfM, x, 1.13, z, null, false, .05); });
        box(a1 - a0 + .16, .14, .8, shelfM, mid, 2.3, z, null, false, .07);
        fillRun('x', a0, a1, z + .17, 1, STACK, .46, .36); fillRun('x', a0, a1, z - .17, -1, STACK, .46, .36);
        // pom-pom plant on top of each stack
        leafPlant(mid + side * .5, 2.37, z, 1.15, null, 16);
      });
    });
    tag = null;
    bookMeshes.forEach(function (m) { m.count = m.userData.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); });

    /* ---------- balcony: puffy rail, flower vines, star lights ---------- */
    var colM = mat('#4A2C1C', { roughness: .5, env: .4 });
    var fairyCols = ['#FFD9A0', '#FFCB85', '#FFE0B0', '#FFD39A'];
    var fairyMats = fairyCols.map(function (c) { return emissive(c, 3); }), fairyGlows = [];
    var leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.bezierCurveTo(.055, .02, .075, .075, 0, .135); leafShape.bezierCurveTo(-.075, .075, -.055, .02, 0, 0);
    var leafGeo = new THREE.ShapeGeometry(leafShape, 6);
    var vines = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .55, side: THREE.DoubleSide }), 3200), nv = 0;
    var blossoms = new THREE.InstancedMesh(new THREE.SphereGeometry(.028, 10, 8), mat('#ffffff', { roughness: .7 }), 320), nb = 0;
    var IVY = ['#2F5A33', '#3C6B3A', '#4A7A45', '#26502F', '#6E9A5E'], BLOOM = ['#E9B6BC', '#F6E7DD', '#D98F9A'];
    function ivyStrand(x, y0, z, len, nx, nz) {      // a trailing strand of ivy leaves; (nx, nz) is the way the leaves face
      for (var k = 0; k < len; k++) {
        var yy = y0 - k * .07 - rnd() * .03, xx = x + (nx ? nx * (.02 + Math.sin(k * .9 + z * 5) * .03) : Math.sin(k * .9 + x * 5) * .03), zz = z + (nx ? Math.sin(k * 1.3 + z) * .04 : 0);
        for (var q = 0; q < 2 && nv < 3200; q++) {
          dummy.position.set(xx + (nx ? 0 : (q ? .02 : -.02)), yy - q * .03, zz + (nx ? (q ? .02 : -.02) : 0));
          dummy.rotation.set((rnd() - .5) * .8, Math.atan2(nx, nz) + (rnd() - .5) * 1.2, Math.PI + (rnd() - .5) * 1.4);
          dummy.scale.setScalar(.7 + rnd() * .8); dummy.updateMatrix(); vines.setMatrixAt(nv, dummy.matrix); vines.setColorAt(nv, col.set(IVY[Math.floor(rnd() * IVY.length)])); nv++;
        }
        if (rnd() < .1 && nb < 320) { dummy.position.set(xx, yy, zz); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.8 + rnd() * .6); dummy.updateMatrix(); blossoms.setMatrixAt(nb, dummy.matrix); blossoms.setColorAt(nb, col.set(BLOOM[Math.floor(rnd() * 3)])); nb++; }
      }
    }
    [-1, 1].forEach(function (s) {
      var ex = s * (X - 1.02);
      box(1.06, .16, ZL - .1, peach, s * (X - .53), 2.95, ZC, null, false, .07);
      capsule(.05, ZL - .3, shelfM, ex, 3.78, ZC).rotation.x = Math.PI / 2;
      for (var z = Z0 + .3; z < Z1 - .1; z += 2.4) { cyl(.13, .15, 2.88, colM, ex + s * .05, 1.44, z, 32); cyl(.17, .17, .05, shelfDark, ex + s * .05, 2.9, z, 32); }
      for (var zb = Z0 + .2; zb < Z1 - .1; zb += .26) { cyl(.02, .02, .74, shelfM, ex, 3.4, zb, 8).castShadow = false; }
      for (var zi = Z0 + .45; zi < Z1 - .3; zi += .3) ivyStrand(ex + s * .03, 2.88, zi + Math.sin(zi * 3) * .05, 5 + Math.floor(rnd() * 9), -s, 0);
      for (var zf = Z0 + .25, kf = 0; zf < Z1 - .1; zf += .32, kf++) {
        var sag = Math.sin(((zf - Z0) % 1.6) / 1.6 * Math.PI) * .12;
        var b = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), fairyMats[kf % 4]); b.position.set(ex - s * .03, 3.7 - sag, zf); scene.add(b);
        fairyGlows.push(glow(fairyCols[kf % 4], .26, b.position.x, b.position.y, b.position.z, .4));
      }
    });
    var ladderM = mat('#A4734C', { roughness: .55 });
    function ladder(base, top, width, axisZ) {
      var off = axisZ ? new THREE.Vector3(0, 0, width / 2) : new THREE.Vector3(width / 2, 0, 0);
      rod(base.clone().sub(off), top.clone().sub(off), .032, ladderM); rod(base.clone().add(off), top.clone().add(off), .032, ladderM);
      for (var r = 1; r < 11; r++) { var p = new THREE.Vector3().lerpVectors(base, top, r / 11); rod(p.clone().sub(off), p.clone().add(off), .022, ladderM); }
    }
    ladder(new THREE.Vector3(-3.3, 0, Z0 + 1.0), new THREE.Vector3(-3.3, 5.1, Z0 + .45), .46, false);
    ladder(new THREE.Vector3(X - 1.05, 0, -5.4), new THREE.Vector3(X - .5, 2.8, -5.4), .46, true);

    /* ---------- three tall arched windows + a deep window seat ---------- */
    tag = 'window';
    var WWn = 1.7, WB = .78, WR = WWn / 2, WS = 3.2, WCX = [-2.0, 0, 2.0], SPAN = 2.0 + WR, WTOT = WS + WR;
    // The sky is drawn through a "wet glass" shader: water beads bend the view like tiny lenses, drops slide down and leave
    // clear trails, and the rest of the pane is lightly fogged. With no rain it is just the sky.
    var skyMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: skyTex }, uTime: { value: 0 }, uRain: { value: 0 }, uBright: { value: 1.3 }, uAsp: { value: 2 * SPAN / WTOT } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform sampler2D map; uniform float uTime; uniform float uRain; uniform float uBright; varying vec2 vUv;',
        'uniform float uAsp;',
        'float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }',
        'float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
        // beads of water stuck to the glass: xy = refraction, z = clear mask, w = highlight, rim darkening in a second out value
        'vec4 beads(vec2 p, float scale, float density, float seed, out float rim){',
        '  vec2 g = p * scale; vec2 id = floor(g) + seed; vec2 f = fract(g) - .5;',
        '  vec2 c = (vec2(h21(id), h21(id + 17.3)) - .5) * .3;',
        '  float rad = mix(.12, .34, pow(h21(id + 9.1), 1.6));',
        '  float present = step(h21(id + 3.7), density);',
        '  vec2 q = (f - c) / rad; float l = length(q);',
        '  float m = smoothstep(1., .9, l) * present;',
        '  vec3 n = normalize(vec3(q, sqrt(max(0., 1. - l * l)) + .12));',
        '  float spec = pow(max(dot(n, normalize(vec3(-.5, .65, .6))), 0.), 24.) * m;',
        '  rim = smoothstep(.55, .98, l) * m;',
        '  return vec4(-q * m * (.9 - .3 * l), m, spec);',
        '}',
        // drops sliding down in strips, each leaving a wet trail above it
        'vec4 runs(vec2 uv, float t, float rain, out float trailClear){',
        '  float N = 8.; float col = floor(uv.x * N); vec4 acc = vec4(0.); trailClear = 0.;',
        '  vec2 P = uv * vec2(uAsp, 1.);',
        '  for (int k = -1; k <= 1; k++) {',
        '    float ci = col + float(k);',
        '    float act = step(h11(ci * 7.13 + 1.), rain * 1.05);',
        '    float sp = .035 + .05 * h11(ci * 5.7); float cyc = t * sp + h11(ci * 9.3); float seed = floor(cyc); float fy = fract(cyc);',
        '    float st = fy * 5.; float yv = 1.02 - (floor(st) + smoothstep(0., .35, fract(st))) / 5.;',
        '    float x0 = (ci + .15 + .7 * h11(ci * 3.1 + seed * 1.7)) / N * uAsp;',
        '    float xw = x0 + .0035 * sin(yv * 47. + ci * 3.) * (1. - yv * .3);',
        '    float rr = .0115 + .006 * h11(ci * 2.3 + seed);',
        '    vec2 d = (P - vec2(xw, yv)) / vec2(rr * .85, rr * 1.25); float l = length(d);',
        '    float m = smoothstep(1., .88, l) * act;',
        '    acc.xy += -d * m * (.9 - .3 * l); acc.z = max(acc.z, m);',
        '    vec3 n = normalize(vec3(d, sqrt(max(0., 1. - l * l)) + .12));',
        '    acc.w += pow(max(dot(n, normalize(vec3(-.5, .65, .6))), 0.), 24.) * m;',
        '    float above = P.y - yv;',
        '    float tw = .0042 + .0016 * h11(ci + seed);',
        '    float tr = smoothstep(tw, tw * .35, abs(P.x - xw - .0015 * sin(P.y * 70. + ci))) * step(0., above) * step(P.y, 1.02) * exp(-above * 1.5) * act;',
        '    trailClear = max(trailClear, tr);',
        '  }',
        '  return acc;',
        '}',
        'void main(){',
        '  vec2 uv = vUv; vec2 P = uv * vec2(uAsp, 1.);',
        '  float rain = uRain; vec3 col;',
        '  if (rain < .001) { col = texture2D(map, uv).rgb; }',
        '  else {',
        '    float rim1, rim2;',
        '    vec4 b1 = beads(P, 17., rain * .55, 0., rim1);',
        '    vec4 b2 = beads(P + .013, 38., rain * .85, 31., rim2);',
        '    float tc; vec4 r = runs(uv, uTime, rain, tc);',
        '    vec2 disp = (b1.xy * .012 + b2.xy * .0065 + r.xy * .0085) * vec2(1. / uAsp, 1.);',
        '    vec3 sharp = texture2D(map, clamp(uv + disp, .001, .999)).rgb;',
        '    float b = .015 * rain; vec3 blur = texture2D(map, uv).rgb;',
        '    for (int i = 0; i < 8; i++) { float a = float(i) * .7854; vec2 o = vec2(cos(a) / uAsp * .6, sin(a)) * b * (i % 2 == 0 ? 1. : .55); blur += texture2D(map, clamp(uv + o, .001, .999)).rgb; }',
        '    blur /= 9.;',
        '    float clear = clamp(max(max(b1.z, b2.z * .9), max(r.z, tc * .85)), 0., 1.);',
        '    vec3 mist = mix(blur, vec3(.30, .35, .52), .14 * rain);',
        '    col = mix(mist * mix(1., .8, rain), sharp * 1.08, clear);',
        '    col *= 1. - (rim1 + rim2 * .8) * .16;',
        '    col += vec3(1., .97, .9) * (b1.w + b2.w * .8 + r.w) * .9;',
        '  }',
        '  gl_FragColor = vec4(col * uBright, 1.);',
        '}'
      ].join('\n')
    });
    var frameM = mat('#3A2416', { roughness: .5, env: .35 }), skyM = null;
    WCX.forEach(function (cx) {
      var shape = new THREE.Shape(); shape.moveTo(-WR, 0); shape.lineTo(WR, 0); shape.lineTo(WR, WS); shape.absarc(0, WS, WR, 0, Math.PI, false); shape.lineTo(-WR, 0);
      var sg = new THREE.ShapeGeometry(shape, 32), uvA = sg.attributes.uv, posA = sg.attributes.position;
      for (var ui = 0; ui < uvA.count; ui++) uvA.setXY(ui, (posA.getX(ui) + cx + SPAN) / (2 * SPAN), posA.getY(ui) / WTOT);
      var wm = new THREE.Mesh(sg, skyMat); wm.position.set(cx, WB, Z0 + .02); add(wm, null, false); if (!skyM) skyM = wm;
      capsule(.06, WS, frameM, cx - WR - .03, WB + WS / 2, Z0 + .08).castShadow = false; capsule(.06, WS, frameM, cx + WR + .03, WB + WS / 2, Z0 + .08).castShadow = false;
      var arch = new THREE.Mesh(new THREE.TorusGeometry(WR + .03, .06, 16, 48, Math.PI), frameM); arch.position.set(cx, WB + WS, Z0 + .08); add(arch, null, false);
      [-.28, .28].forEach(function (mx) { var hh = WS + Math.sqrt(WR * WR - mx * mx); flat(.032, hh, .05, frameM, cx + mx, WB + hh / 2, Z0 + .07); });
      [1.0, 2.0, 3.0].forEach(function (my) { flat(WWn, .032, .05, frameM, cx, WB + my, Z0 + .07); });
      box(WWn + .3, .07, .24, shelfDark, cx, WB, Z0 + .12, null, false, .02);
    });
    [-2.95, -1.0, 1.0, 2.95].forEach(function (px) { box(.28, WS + .6, .24, shelfM, px, WB + (WS + .6) / 2, Z0 + .12, null, true, .03); });
    box(2 * SPAN + .8, .24, .32, shelfDark, 0, WB + WTOT + .22, Z0 + .16, null, true, .04);
    box(2 * SPAN + .4, WB - .06, .74, peach, 0, (WB - .06) / 2, Z0 + .38, null, true, .08);
    box(2 * SPAN + .3, .16, .68, mat('#E6D3BC', { roughness: .95 }), 0, WB + .04, Z0 + .4, null, true, .06);
    [[-2.4, '#B9777D', -.1], [-1.7, '#E8DAC4', .08], [.9, '#7E8F78', -.08], [1.75, '#8A4A50', .1], [2.4, '#E9C3C0', -.06]].forEach(function (pl, k) { box(.6, .45, .2, mat(pl[1], { roughness: .95 }), pl[0], WB + .3, Z0 + .2 + (k % 2) * .03, null, true, .1).rotation.z = pl[2]; });
    ball(.17, mat('#D9A5A3', { roughness: .95 }), -.6, WB + .25, Z0 + .3, 1, .8, .7);
    var rainMat = { opacity: 0 }, rainDrops = [];
    [-2.95, -1.0, 1.0, 2.95].forEach(function (px) { [-.08, 0, .08].forEach(function (o, k) { ivyStrand(px + o, 4.88, Z0 + .34 + k * .03, 12 + Math.floor(rnd() * 9), 0, 1); }); });
    vines.count = nv; vines.instanceColor.needsUpdate = true; vines.castShadow = false; scene.add(vines);
    blossoms.count = nb; if (blossoms.instanceColor) blossoms.instanceColor.needsUpdate = true; blossoms.userData.noPick = true; scene.add(blossoms);
    tag = null;

    var patchTex = canvasTex(256, 448, function (x, w, h) { x.save(); x.beginPath(); x.moveTo(14, h - 10); x.lineTo(14, h * .3); x.arc(w / 2, h * .3, w / 2 - 14, Math.PI, 0); x.lineTo(w - 14, h - 10); x.closePath(); x.clip(); x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 34; for (var cx = 0; cx < 4; cx++) for (var cy = 0; cy < 4; cy++) x.fillRect(20 + cx * 57, 26 + cy * 104, 48, 92); x.restore(); }, true);
    var patch = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), new THREE.MeshBasicMaterial({ map: patchTex, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    patch.rotation.x = -Math.PI / 2; patch.position.set(0, .035, -5.0); scene.add(patch);

    /* ---------- tables, chairs, mushroom lamps ---------- */
    var lampBulbs = [], shadeMats = [];
    function mushroomLamp(x, y, z, cap) {           // a brass banker's lamp with a glass shade
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = x < .1 ? .75 : -.75; scene.add(g);
      var brass = mat('#B8893C', { metalness: .92, roughness: .26, env: 1.3 });
      cyl(.09, .105, .03, brass, 0, .015, 0, 48, g); cyl(.07, .09, .025, brass, 0, .042, 0, 48, g); cyl(.011, .011, .2, brass, 0, .16, 0, 14, g);
      cyl(.02, .02, .03, brass, 0, .26, 0, 16, g);
      var sm = new THREE.MeshStandardMaterial({ color: cap, emissive: cap, emissiveIntensity: .3, roughness: .12, metalness: .05, side: THREE.DoubleSide });
      var shade = new THREE.Mesh(new THREE.CylinderGeometry(.078, .078, .3, 48, 1, true, Math.PI / 2, Math.PI), sm); shade.rotation.x = Math.PI / 2; shade.position.y = .295; add(shade, g);
      var bm = emissive('#FFE2B8', 3); var bl = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .16, 12), bm); bl.rotation.x = Math.PI / 2; bl.position.y = .285; g.add(bl);
      lampBulbs.push(bm); shadeMats.push(sm); return g;
    }
    function chair(x, z, rotY, cushion) {
      var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
      box(.5, .08, .5, peach, 0, .47, 0, g, true, .04);
      [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]].forEach(function (p) { capsule(.03, .38, '#6B4128', p[0], .23, p[1], g); });
      box(.5, .5, .08, peach, 0, .78, .22, g, true, .04); box(.44, .1, .44, cushion || rose, 0, .54, 0, g, true, .05);
    }
    function table(x, z, len, wdt) {
      box(wdt, .09, len, peach, x, .76, z, null, true, .045);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { capsule(.045, .62, '#6B4128', x + p[0] * (wdt / 2 - .12), .37, z + p[1] * (len / 2 - .14)); });
    }
    table(0, -5.2, 2.0, 1.1); mushroomLamp(0, .8, -5.6, '#1F5A44'); mushroomLamp(0, .8, -4.8, '#A8601E');
    [-.8, .8].forEach(function (x) { chair(x, -5.6, x < 0 ? Math.PI / 2 : -Math.PI / 2, mint); chair(x, -4.8, x < 0 ? Math.PI / 2 : -Math.PI / 2, butter); });
    box(.3, .06, .22, '#7A5C86', .25, .83, -5.0, null, true, .03); box(.28, .06, .2, '#D9A35B', .27, .89, -5.02, null, true, .03);

    /* ---------- YOUR table ---------- */
    tag = 'desk';
    var DX = 0, DZ = -.55, DY = .8;
    table(DX, DZ, 2.4, 1.2);
    chair(-.85, DZ - .55, Math.PI / 2, mint); chair(.85, DZ - .55, -Math.PI / 2, rose);
    var al = armLamp(DX + .47, DY, DZ + .22, Math.PI);
    var lampLight = new THREE.PointLight('#FFC98A', 1, 5, 2); lampLight.position.set(al.x, al.y, al.z); scene.add(lampLight);
    var pageTex = canvasTex(256, 360, function (x, w, h) {
      x.fillStyle = '#EFE3CA'; x.fillRect(0, 0, w, h);
      for (var k = 0; k < 900; k++) { x.fillStyle = 'rgba(120,90,50,' + (.015 + (k % 5) * .006) + ')'; x.fillRect((k * 53) % w, (k * 89) % h, 2, 2); }
      x.fillStyle = 'rgba(55,38,26,.5)'; for (var ln = 0; ln < 23; ln++) { var lw = w * (.6 + ((ln * 37) % 11) / 40); x.fillRect(26, 34 + ln * 13.4, ln % 6 === 5 ? lw * .5 : lw, 1.5); }
      var gu = x.createLinearGradient(0, 0, w, 0); gu.addColorStop(0, 'rgba(60,40,20,.35)'); gu.addColorStop(.18, 'rgba(60,40,20,0)'); x.fillStyle = gu; x.fillRect(0, 0, w, h);
    });
    var pageM = new THREE.MeshStandardMaterial({ map: pageTex, roughness: .92 });
    box(.56, .03, .4, mat('#4B1D23', { roughness: .55, env: .6 }), DX - .08, DY + .015, DZ + .82, null, true, .012);
    box(.26, .025, .37, pageM, DX - .215, DY + .036, DZ + .82, null, true, .01).rotation.z = .08;
    box(.26, .025, .37, pageM, DX + .055, DY + .036, DZ + .82, null, true, .01).rotation.z = -.08;
    capsule(.009, .2, mat('#15151A', { roughness: .25, metalness: .3, env: 1 }), DX + .27, DY + .02, DZ + .82).rotation.set(Math.PI / 2, 0, .5);
    var MX = DX - .45, MZ = DZ + .5;
    /* a proper hollow mug: glazed wall, rounded rim, handle, saucer and a latte-art top */
    var mugG = new THREE.Group(); mugG.position.set(MX, DY, MZ); scene.add(mugG);
    var glaze = mat('#ECE5D5', { roughness: .2, metalness: .04, env: .9, side: THREE.DoubleSide });
    var saucer = new THREE.Mesh(new THREE.LatheGeometry([[0, .004], [.07, .004], [.088, .012], [.093, .018], [.09, .019], [.084, .012], [.06, .009], [0, .009]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 48), mat('#ECE5D5', { roughness: .22, env: .9, side: THREE.DoubleSide }));
    saucer.position.y = -.003; add(saucer, mugG);
    var mugProfile = [[0, .008], [.03, .008], [.039, .011], [.0445, .024], [.0475, .065], [.0498, .12], [.0508, .131], [.049, .1345], [.0462, .133], [.0447, .127], [.0432, .1], [.0422, .04], [.0405, .024], [.03, .02], [0, .02]];
    add(new THREE.Mesh(new THREE.LatheGeometry(mugProfile.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 56), glaze), mugG);
    var rimBand = new THREE.Mesh(new THREE.TorusGeometry(.0488, .0017, 8, 56), mat('#C79A45', { roughness: .3, metalness: .9, env: 1 })); rimBand.rotation.x = Math.PI / 2; rimBand.position.y = .1325; add(rimBand, mugG, false);
    var mugHandle = new THREE.Mesh(new THREE.TorusGeometry(.03, .0085, 14, 32, Math.PI), glaze); mugHandle.rotation.z = Math.PI / 2; mugHandle.scale.y = .8; mugHandle.position.set(-.047, .075, 0); add(mugHandle, mugG);
    var latteTex = canvasTex(256, 256, function (x, w, h) {
      var gr = x.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2); gr.addColorStop(0, '#8A5A3A'); gr.addColorStop(1, '#5A3520'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.fillStyle = '#F2DFC4'; x.beginPath(); x.moveTo(w / 2, h * .72); x.bezierCurveTo(w * .16, h * .5, w * .26, h * .22, w / 2, h * .38); x.bezierCurveTo(w * .74, h * .22, w * .84, h * .5, w / 2, h * .72); x.fill();
      x.strokeStyle = '#F2DFC4'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(w / 2, h * .44); x.lineTo(w / 2, h * .8); x.stroke();
    });
    var tea = new THREE.Mesh(new THREE.CircleGeometry(.0422, 48), new THREE.MeshStandardMaterial({ map: latteTex, roughness: .18 })); tea.rotation.x = -Math.PI / 2; tea.position.y = .102; add(tea, mugG, false);
    var steam = []; for (var st = 0; st < 3; st++) { var sp = glow('#FFFFFF', .16, MX, DY + .22, MZ, .3); sp.material = sp.material.clone(); sp.userData.t = st / 3; steam.push(sp); }
    var deskClock = { time: '25:00', color: '#93AE96', running: false };
    var dcTex = canvasTex(256, 128, function (x, w, h) { x.fillStyle = '#16110E'; x.fillRect(0, 0, w, h); x.fillStyle = deskClock.color; x.fillRect(0, h - 8, w, 8); x.fillStyle = '#EBD3A0'; x.font = '600 74px "Young Serif", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(deskClock.time, w / 2, h / 2 + 10); if (deskClock.running) { x.fillStyle = '#E0883A'; x.beginPath(); x.arc(w - 18, 24, 6, 0, 7); x.fill(); } });
    var dc = new THREE.Group(); dc.position.set(DX - .1, DY + .11, DZ + .38); scene.add(dc);
    box(.34, .2, .1, mat('#8F6A30', { metalness: .85, roughness: .34, env: 1.2 }), 0, 0, 0, dc, true, .05);
    var dcFace = new THREE.Mesh(new THREE.PlaneGeometry(.26, .13), new THREE.MeshBasicMaterial({ map: dcTex, toneMapped: false })); dcFace.position.z = .052; add(dcFace, dc, false);

    /* ---------- cosy desk dressing: brass lamp, flowers, candle, bunny, stars, bows, titled books ---------- */
    var candles = [];
    function bow(parent, x, y, z, sc, rotY) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; g.scale.setScalar(sc || 1); (parent || scene).add(g);
      var satin = mat('#E8B4BB', { roughness: .32, env: .7 });
      [-1, 1].forEach(function (sd) {
        var lp = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), satin); lp.scale.set(.034, .022, .007); lp.position.set(sd * .033, 0, 0); lp.rotation.z = sd * .35; add(lp, g, false);
        var tl = new THREE.Mesh(new THREE.BoxGeometry(.011, .05, .003), satin); tl.position.set(sd * .014, -.034, 0); tl.rotation.z = sd * .3; add(tl, g, false);
      });
      var kn = new THREE.Mesh(new THREE.SphereGeometry(.011, 10, 8), satin); kn.scale.z = .8; add(kn, g, false);
      return g;
    }
    function starMesh(x, y, z, sc, glowy) {
      var sh = new THREE.Shape(); for (var i = 0; i < 10; i++) { var r = i % 2 ? .45 : 1, a = i / 10 * Math.PI * 2 + Math.PI / 2; if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
      var m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .3, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: '#E7BE62', emissive: '#FFC863', emissiveIntensity: glowy || .25, metalness: .7, roughness: .3 }));
      m.scale.setScalar(sc); m.position.set(x, y, z); return add(m, null, false);
    }
    function armLamp(x, y, z, rotY) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; scene.add(g);
      var brass = mat('#B88A3E', { metalness: .92, roughness: .28, env: 1.3 }), V = THREE.Vector3;
      cyl(.085, .1, .024, brass, 0, .012, 0, 40, g); cyl(.045, .075, .03, brass, 0, .039, 0, 40, g);
      rod(new V(0, .05, 0), new V(.06, .38, 0), .009, brass, g); ball(.016, brass, .06, .38, 0, 1, 1, 1, g);
      rod(new V(.06, .38, 0), new V(.26, .5, 0), .008, brass, g); ball(.015, brass, .26, .5, 0, 1, 1, 1, g);
      var shade = new THREE.Mesh(new THREE.SphereGeometry(.105, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), mat('#B88A3E', { metalness: .9, roughness: .32, env: 1.2, side: THREE.DoubleSide }));
      shade.position.set(.31, .505, 0); shade.rotation.z = .55; add(shade, g);
      var bm = emissive('#FFE0B0', 3), bulb = new THREE.Mesh(new THREE.SphereGeometry(.03, 16, 12), bm); bulb.position.set(.335, .47, 0); g.add(bulb); lampBulbs.push(bm);
      var gp = new V(.335, .47, 0).applyAxisAngle(new V(0, 1, 0), rotY || 0);
      glow('#FFD9A0', .3, x + gp.x, y + gp.y, z + gp.z, .32);
      return { x: x + gp.x, y: y + gp.y, z: z + gp.z };
    }
    function flowerJar(x, y, z, sc) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(sc || 1); scene.add(g);
      var glass = new THREE.MeshStandardMaterial({ color: '#D5E6E8', transparent: true, opacity: .26, roughness: .04, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 });
      var jar = new THREE.Mesh(new THREE.CylinderGeometry(.062, .056, .14, 36, 1, true), glass); jar.position.y = .07; add(jar, g, false);
      var wtr = new THREE.Mesh(new THREE.CylinderGeometry(.054, .05, .085, 28), new THREE.MeshStandardMaterial({ color: '#CFE8EE', transparent: true, opacity: .2, roughness: .05, depthWrite: false })); wtr.position.y = .045; add(wtr, g, false);
      var jb = new THREE.Mesh(new THREE.CylinderGeometry(.056, .056, .012, 28), glass); jb.position.y = .006; add(jb, g, false);
      var stemM = mat('#6E8A5E', { roughness: .8 }), V = THREE.Vector3;
      var heads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFF2E0', emissiveIntensity: .18, roughness: .8 }), 260), hn = 0, dm = new THREE.Object3D();
      var sdv = 5; function r5() { sdv = (sdv * 16807) % 2147483647; return (sdv - 1) / 2147483646; }
      for (var i = 0; i < 24; i++) {
        var a = r5() * 6.283, d = .03 + r5() * .15, hy = .26 + r5() * .22 - d * .5, tip = new V(Math.cos(a) * d, hy, Math.sin(a) * d);
        rod(new V(Math.cos(a) * .012, .03, Math.sin(a) * .012), tip, .0016, stemM, g).castShadow = false;
        for (var f = 0; f < 9 && hn < 260; f++) { var fa = r5() * 6.283, fd = r5() * .035, fh = r5() * .03; dm.position.set(tip.x + Math.cos(fa) * fd, tip.y + fh, tip.z + Math.sin(fa) * fd); dm.scale.setScalar(.006 + r5() * .006); dm.rotation.set(0, 0, 0); dm.updateMatrix(); heads.setMatrixAt(hn++, dm.matrix); }
      }
      heads.count = hn; heads.castShadow = false; if (tag) heads.userData.hot = tag; g.add(heads);
      return g;
    }
    function candleJar(x, y, z) {
      var g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
      var glass = new THREE.MeshStandardMaterial({ color: '#E4D2B8', transparent: true, opacity: .32, roughness: .06, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 });
      var jr = new THREE.Mesh(new THREE.CylinderGeometry(.052, .05, .09, 32, 1, true), glass); jr.position.y = .045; add(jr, g, false);
      cyl(.04, .04, .06, mat('#F2E4CF', { roughness: .6 }), 0, .035, 0, 24, g);
      cyl(.0025, .0025, .016, '#2A1A10', 0, .073, 0, 6, g).castShadow = false;
      var fm = emissive('#FFB458', 5), fl = new THREE.Mesh(new THREE.SphereGeometry(.011, 12, 10), fm); fl.scale.set(.8, 1.9, .8); fl.position.y = .095; g.add(fl);
      var gl = glow('#FFB566', .26, x, y + .1, z, .8);
      var L = new THREE.PointLight('#FFB070', .5, 2.2, 2); L.position.set(x, y + .12, z); scene.add(L);
      candles.push({ fl: fl, glow: gl, light: L, ph: candles.length * 1.7 });
      return g;
    }
    function bunny(x, y, z, sc, rotY) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; g.scale.setScalar(sc || 1); scene.add(g);
      var cer = mat('#F7F0E6', { roughness: .32, env: .6 });
      ball(.05, cer, 0, .055, 0, 1, 1.1, .9, g); ball(.036, cer, 0, .13, .012, 1, .95, .95, g); ball(.018, cer, 0, .03, -.045, 1, 1, 1, g);
      [-.017, .017].forEach(function (ex, i) { var ear = capsule(.0105, .045, cer, ex, .19, 0, g); ear.rotation.z = (i ? -1 : 1) * .15; });
      [-.013, .013].forEach(function (ex) { ball(.004, '#2A1E1C', ex, .135, .045, 1, 1, 1, g); });
      ball(.006, '#E9A6AC', 0, .124, .047, 1, .8, .8, g);
      bow(g, 0, .095, .03, .8, 0);
      return g;
    }
    function titleSpineTex(title, col, ink) {
      return canvasTex(512, 128, function (x, w, h) {
        var gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
        x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = gr; x.fillRect(0, 0, w, h);
        for (var k = 0; k < 600; k++) { x.fillStyle = 'rgba(255,255,255,' + (.02 + (k % 4) * .01) + ')'; x.fillRect((k * 37) % w, (k * 53) % h, 2, 1); }
        x.strokeStyle = ink; x.lineWidth = 3; x.strokeRect(14, 14, w - 28, h - 28); x.lineWidth = 1.5; x.strokeRect(22, 22, w - 44, h - 44);
        x.fillStyle = ink; x.font = 'italic 600 46px "Young Serif", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(title, w / 2, h / 2 + 3);
      });
    }
    function titledBook(title, col, w, h, d, x, y, z, rotY) {
      var edge = mat(col, { roughness: .55, env: .4 }), pages = mat('#EFE3CA', { roughness: .9 });
      var face = new THREE.MeshStandardMaterial({ map: titleSpineTex(title, col, '#E6C77C'), roughness: .5, envMapIntensity: .5 });
      var mesh = new THREE.Mesh(geoBox(w, h, d, .03), [edge, edge, edge, edge, face, pages]); mesh.position.set(x, y, z); mesh.rotation.y = rotY; return add(mesh, null, true);
    }
    titledBook('Dream Big', '#2A3550', .32, .07, .23, DX + .38, DY + .035, DZ - .12, .06);
    titledBook('Study Hard', '#2F3A55', .30, .07, .22, DX + .37, DY + .105, DZ - .12, -.05);
    titledBook('Be Happy \u2661', '#33503F', .29, .07, .21, DX + .39, DY + .175, DZ - .12, .08);
    flowerJar(DX - .5, DY, DZ - .1, 1.1);
    candleJar(DX - .3, DY, DZ + .1);
    bunny(DX + .52, DY, DZ + .5, 1.2, -.5);
    bow(null, MX, DY + .075, MZ + .052, 1.1, 0);
    var st1 = starMesh(DX + .28, DY + .012, DZ + .56, .035); st1.rotation.set(-Math.PI / 2, 0, .4);
    var st2 = starMesh(DX - .22, DY + .012, DZ - .5, .03); st2.rotation.set(-Math.PI / 2, 0, -.3);
    
    tag = null;

    /* ---------- your study shelf ---------- */
    tag = 'shelf';
    var SHX = 1.95, SH = { z0: .05, z1: 1.95, levels: [.12, .7, 1.28, 1.86] };
    flat(.04, 2.42, SH.z1 - SH.z0 + .1, shelfBack, SHX + .22, 1.22, (SH.z0 + SH.z1) / 2);
    SH.levels.concat([2.42]).forEach(function (y) { box(.48, .06, SH.z1 - SH.z0 + .1, shelfDark, SHX, y - .03, (SH.z0 + SH.z1) / 2, null, true, .03); });
    [SH.z0 - .05, SH.z1 + .05].forEach(function (z) { box(.54, 2.5, .1, shelfM, SHX, 1.25, z, null, true, .05); });
    box(.62, .14, SH.z1 - SH.z0 + .3, shelfM, SHX, 2.52, (SH.z0 + SH.z1) / 2, null, true, .07);
    box(.03, .14, .5, gold, SHX - .26, 2.36, (SH.z0 + SH.z1) / 2, null, false, .015);
    leafPlant(SHX, 2.59, SH.z0 + .3, 1.0, null, 14);
    var booksGroup = new THREE.Group(); scene.add(booksGroup);
    var cursor = { shelf: 0, z: SH.z0 };
    function placeBook(b, animate) {
      if (cursor.z + b.w > SH.z1) { cursor.shelf++; cursor.z = SH.z0; }
      if (cursor.shelf >= SH.levels.length) return;
      var y = SH.levels[cursor.shelf], hgt = b.h * .85;
      var m = new THREE.Mesh(geoBox(.3, hgt, b.w, .025), new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color).lerp(new THREE.Color('#FFFFFF'), .35), map: spineA, roughness: .5, envMapIntensity: .3 }));
      m.position.set(SHX - .03, y + hgt / 2, cursor.z + b.w / 2); add(m, booksGroup);
      Object.assign(m.userData, { book: b, baseY: y + hgt / 2, baseX: SHX - .03, pull: 0, drop: animate ? 0 : 1 });
      cursor.z += b.w + .01;
    }
    books.forEach(function (b) { placeBook(b); });
    tag = null;
    ball(.26, mat('#2F4B66', { roughness: .35, env: .8 }), 3.85, 1.05, .7); capsule(.03, .6, '#6B4128', 3.85, .42, .7); cyl(.22, .26, .05, '#6B4128', 3.85, .03, .7);
    var meridian = new THREE.Mesh(new THREE.TorusGeometry(.3, .016, 10, 48), gold); meridian.position.set(3.85, 1.05, .7); meridian.rotation.y = .5; add(meridian);

    /* ---------- fireplace + puffy armchair ---------- */
    tag = 'chair';
    var FZ = 1.75, FX = -X;
    var stoneTex = canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = '#3B322B'; x.fillRect(0, 0, w, h);
      for (var row = 0; row < 8; row++) { var bx = -((row % 2) * 40), bh = h / 8; while (bx < w) { var bw = 70 + ((bx * 7 + row * 13) % 40); var tone = 92 + ((bx * 31 + row * 17) % 36); x.fillStyle = 'rgb(' + tone + ',' + (tone - 8) + ',' + (tone - 18) + ')'; x.fillRect(bx + 2, row * bh + 2, bw - 4, bh - 4); for (var q = 0; q < 40; q++) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(bx + 2 + (q * 29) % (bw - 4), row * bh + 2 + (q * 17) % (bh - 4), 3, 2); } bx += bw; } }
    });
    stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.repeat.set(1.5, 2.5);
    box(.62, 2.8, 2.4, new THREE.MeshStandardMaterial({ map: stoneTex, bumpMap: stoneTex, bumpScale: .8, roughness: .9 }), FX + .31, 1.4, FZ, null, false, .05);
    box(.2, .14, 2.7, peach, FX + .68, 1.5, FZ, null, true, .07);
    var fbox = new THREE.Mesh(geoBox(.42, .85, 1.2, .2), mat('#1A110C')); fbox.position.set(FX + .45, .48, FZ); add(fbox, null, false);
    box(1.0, .08, 2.0, mat('#7D6A58'), FX + .62, .04, FZ, null, false, .04);
    [[-.1, .25], [.1, -.2], [0, 0]].forEach(function (p, k) { var lg = capsule(.06, .5, '#5A3624', FX + .45 + p[0] * .3, .12 + k * .05, FZ + p[1]); lg.rotation.x = Math.PI / 2; lg.rotation.z = p[0]; });
    var fireCore = new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 12), emissive('#FF8A3D', 6)); fireCore.scale.set(1, 1.3, 2); fireCore.position.set(FX + .5, .3, FZ); scene.add(fireCore);
    var fireLight = new THREE.PointLight('#FF8A3D', 2, 7, 2); fireLight.position.set(FX + 1.0, .7, FZ); scene.add(fireLight);
    var flames = []; for (var f = 0; f < 5; f++) flames.push(glow(f % 2 ? '#FF9E40' : '#FFC860', .5, FX + .55, .4, FZ - .3 + f * .15, .7));
    var candleM = emissive('#FFC070', 5);
    [[-.8, .18], [-.62, .26]].forEach(function (c) { cyl(.045, .045, c[1], '#F7EEDD', FX + .66, 1.57 + c[1] / 2, FZ + c[0], 20); var fl = new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), candleM); fl.scale.y = 1.8; fl.position.set(FX + .66, 1.61 + c[1], FZ + c[0]); scene.add(fl); });
    var mantelGlow = glow('#FFB060', .45, FX + .66, 1.9, FZ - .7, .5);
    ball(.12, sky, FX + .65, 1.69, FZ + .85, 1, 1.1, 1);
    var paint = canvasTex(200, 150, function (x) {
      var g = x.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#2D3B52'); g.addColorStop(.55, '#B26B3E'); g.addColorStop(1, '#E3A55C'); x.fillStyle = g; x.fillRect(0, 0, 200, 150);
      x.fillStyle = 'rgba(255,230,180,.9)'; x.beginPath(); x.arc(138, 78, 16, 0, 7); x.fill();
      x.fillStyle = '#2A3A34'; x.beginPath(); x.moveTo(0, 150); x.lineTo(0, 100); x.bezierCurveTo(40, 80, 70, 110, 110, 95); x.bezierCurveTo(150, 82, 180, 100, 200, 92); x.lineTo(200, 150); x.fill();
      x.fillStyle = '#18221E'; x.beginPath(); x.moveTo(0, 150); x.lineTo(0, 124); x.bezierCurveTo(50, 108, 100, 130, 150, 118); x.bezierCurveTo(175, 112, 190, 120, 200, 116); x.lineTo(200, 150); x.fill();
      for (var k = 0; k < 600; k++) { x.fillStyle = 'rgba(' + (k % 2 ? '0,0,0' : '255,220,170') + ',.05)'; x.fillRect((k * 47) % 200, (k * 31) % 150, 3, 2); }
    });
    box(.06, .92, 1.18, '#C9A25A', FX + .64, 2.3, FZ, null, false, .06);
    var pm = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .76), new THREE.MeshStandardMaterial({ map: paint, roughness: .9 })); pm.position.set(FX + .675, 2.3, FZ); pm.rotation.y = Math.PI / 2; add(pm, null, false);
    var arm = new THREE.Group(); arm.position.set(-3.25, 0, 1.55); arm.rotation.y = Math.PI / 2 + .35; scene.add(arm);
    var velvet = mat('#28483C', { roughness: .85, env: .2 }), velvet2 = mat('#33594A', { roughness: .85, env: .2 });
    box(1.1, .42, .95, velvet, 0, .34, 0, arm, true, .2); box(.9, .2, .8, velvet2, 0, .62, -.04, arm, true, .1); box(1.12, 1.02, .3, velvet, 0, .84, .4, arm, true, .15);
    capsule(.15, .7, velvet, -.55, .58, 0, arm).rotation.x = Math.PI / 2; capsule(.15, .7, velvet, .55, .58, 0, arm).rotation.x = Math.PI / 2;
    [[-.42, -.36], [.42, -.36], [-.42, .36], [.42, .36]].forEach(function (p) { ball(.05, '#6B4128', p[0], .05, p[1], 1, 1, 1, arm); });
    box(.42, .34, .16, mint, .18, .88, .2, arm, true, .12).rotation.set(-.3, .2, .1);
    var knit = canvasTex(64, 64, function (x) { x.fillStyle = '#6E1F28'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(214,196,160,.85)'; x.fillRect(0, 14, 64, 4); x.fillRect(14, 0, 4, 64); x.fillStyle = 'rgba(20,30,50,.55)'; x.fillRect(0, 36, 64, 12); x.fillRect(36, 0, 12, 64); x.fillStyle = 'rgba(0,0,0,.06)'; for (var k = 0; k < 64; k += 3) x.fillRect(k, 0, 1, 64); });
    knit.wrapS = knit.wrapT = THREE.RepeatWrapping; knit.repeat.set(3, 3);
    var blanketM = new THREE.MeshStandardMaterial({ map: knit, roughness: 1 });
    box(.6, .06, .9, blanketM, -.25, .92, .5, arm, true, .03).rotation.x = -1.1; box(.6, .06, .55, blanketM, -.25, .74, .05, arm, true, .03);
    var TX = -3.35, TZ = .25;
    cyl(.32, .32, .05, peach, TX, .6, TZ, 48); capsule(.04, .5, '#6B4128', TX, .3, TZ); cyl(.2, .23, .04, '#6B4128', TX, .02, TZ, 32);
    var potM = mat('#F7EEDD', { roughness: .3 });
    ball(.12, potM, TX - .05, .72, TZ, 1, .85, 1); cyl(.04, .055, .05, potM, TX - .05, .83, TZ, 20); ball(.02, rose, TX - .05, .865, TZ);
    rod(new THREE.Vector3(TX + .04, .7, TZ), new THREE.Vector3(TX + .16, .8, TZ), .02, potM);
    cyl(.045, .038, .06, rose, TX + .14, .655, TZ + .16, 20);
    box(.22, .05, .3, '#3F5F7A', TX + .05, .65, TZ - .14, null, true, .02).rotation.y = .4;
    var rug2 = cyl(1.2, 1.2, .025, '#3A1C22', -3.6, .013, FZ, 64); rug2.castShadow = false;
    var rugRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, .025, 10, 64), mat('#B58E4A', { roughness: .6 })); rugRing.rotation.x = -Math.PI / 2; rugRing.position.set(-3.6, .03, FZ); add(rugRing, null, false);
    [['#8E4A4A', .2], ['#D9A35B', -.1], ['#4D5B7A', .3]].forEach(function (b, k) { box(.42, .09, .3, b[0], -2.35, .045 + k * .09, 2.75, null, true, .04).rotation.y = b[1]; });
    tag = null;

    /* ---------- gramophone ---------- */
    tag = 'music';
    var GX = -4.25, GZ = 3.35;
    box(.8, .7, .55, peach, GX, .35, GZ, null, true, .1); box(.44, .15, .4, '#2B2018', GX, .78, GZ, null, true, .05);
    var platter = new THREE.Group(); platter.position.set(GX, .87, GZ); scene.add(platter);
    cyl(.17, .17, .015, '#1E1A1A', 0, 0, 0, 48, platter); cyl(.055, .055, .017, '#7A2431', 0, .001, 0, 32, platter); box(.03, .004, .15, '#4A4040', .1, .009, 0, platter, false, .002);
    rod(new THREE.Vector3(GX + .16, .87, GZ - .13), new THREE.Vector3(GX + .16, 1.13, GZ - .13), .02, gold);
    var hornPts = []; for (var hp = 0; hp <= 24; hp++) { var ht = hp / 24; hornPts.push(new THREE.Vector2(.016 + .27 * Math.pow(ht, 3.4) + .02 * ht, -.3 + .6 * ht)); }
    var horn = new THREE.Mesh(new THREE.LatheGeometry(hornPts, 56), new THREE.MeshStandardMaterial({ color: '#B8893C', metalness: .92, roughness: .25, envMapIntensity: 1.2, side: THREE.DoubleSide }));
    horn.position.set(GX + .12, 1.33, GZ - .08); horn.rotation.set(-.8, 0, -.5); add(horn);
    var RX = GX, RZ = GZ;
    tag = null;
    var notes = spriteSet(3, function (x) { x.fillStyle = '#FFF2D6'; x.font = '700 50px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♪', 32, 34); }, .2);

    /* ---------- card catalog + doors ---------- */
    tag = 'board';
    var CX = 3.2, CZ = Z1 - .33;
    box(1.6, 1.15, .55, peach, CX, .85, CZ, null, true, .1);
    [[-.66, .14], [.66, .14], [-.66, -.14], [.66, -.14]].forEach(function (p) { ball(.07, '#6B4128', CX + p[0], .07, CZ + p[1]); capsule(.035, .14, '#6B4128', CX + p[0], .2, CZ + p[1]); });
    var drawerCols = ['#B07E55', '#A0704A', '#B88A60', '#A87A52', '#C09068'], cardM = mat('#FBF3E2');
    for (var r = 0; r < 4; r++) for (var c = 0; c < 5; c++) {
      var dx = CX - .6 + c * .3, dy = .46 + r * .26;
      box(.27, .22, .04, drawerCols[(r + c) % 5], dx, dy, CZ - .28, null, false, .05);
      ball(.022, gold, dx, dy + .04, CZ - .31); flat(.09, .04, .01, cardM, dx, dy - .04, CZ - .305);
    }
    leafPlant(CX + .5, 1.425, CZ, .9, null, 14);
    tag = null;
    box(2.4, 3.3, .14, '#5A3826', 0, 1.65, Z1 - .03, null, false, .12);
    [-.57, .57].forEach(function (x) { box(1.08, 3.05, .08, '#7A5236', x, 1.55, Z1 - .09, null, false, .1); box(.76, 1.1, .03, '#6A4630', x, 2.35, Z1 - .14, null, false, .08); box(.76, 1.1, .03, '#6A4630', x, .95, Z1 - .14, null, false, .08); });
    ball(.05, gold, -.1, 1.35, Z1 - .16); ball(.05, gold, .1, 1.35, Z1 - .16);
    var sign = canvasTex(256, 64, function (x, w, h) { x.fillStyle = '#3A2418'; x.fillRect(0, 0, w, h); x.fillStyle = '#E6C483'; x.font = '400 30px "Young Serif", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Quiet, please', w / 2, h / 2 + 2); });
    var signM = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .3), new THREE.MeshStandardMaterial({ map: sign })); signM.position.set(0, 3.55, Z1 - .02); signM.rotation.y = Math.PI; scene.add(signM);

    /* ---------- pom-pom plants ---------- */
    function leafPlant(x, y, z, s, potCol, n) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g);
      var clay = mat(potCol || '#9A5B3A', { roughness: .75, env: .25 });
      cyl(.095, .068, .15, clay, 0, .075, 0, 32, g); cyl(.108, .108, .028, clay, 0, .16, 0, 32, g); cyl(.092, .092, .012, '#2A1B12', 0, .17, 0, 24, g).castShadow = false;
      var greens = ['#2D5A33', '#3A6B3A', '#26502F', '#4A7A45', '#335F38'], sd = Math.floor(x * 131 + z * 71 + 5);
      function r() { sd = (sd * 16807 + 11) % 2147483647; return (sd % 1000) / 1000; }
      for (var i = 0; i < (n || 16); i++) {
        var ln = .16 + r() * .16, tilt = .25 + r() * 1.0, a = i * 2.39996 + r() * .5;
        var pv = new THREE.Group(); pv.position.y = .17; pv.rotation.set(-tilt, a, 0, 'YXZ'); g.add(pv);
        var lf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(greens[i % 5], { roughness: .55, side: THREE.DoubleSide })); lf.scale.set(.03 + r() * .018, .006, ln); lf.position.z = ln * .95; lf.rotation.z = (r() - .5) * .5; add(lf, pv, false);
      }
      return g;
    }
    function plant(x, z, s, potCol) {
      leafPlant(x, 0, z, s * 2.6, potCol === cream ? '#B7A07A' : null, 28);
    }
    plant(-1.35, Z0 + .55, .9, cream); plant(1.35, Z0 + .55, .9, lilac); plant(X - .75, 2.0, 1.05, butter); plant(-1.9, Z1 - .5, .8, mint);

    /* ---------- Mochi ---------- */
    tag = 'cat';
    var knitC = canvasTex(128, 128, function (x, w, h) { x.fillStyle = '#EBDAD2'; x.fillRect(0, 0, w, h); x.fillStyle = '#D9A5A3'; for (var r = 0; r < h; r += 32) x.fillRect(0, r, w, 14); x.fillStyle = 'rgba(0,0,0,.06)'; for (var k = 0; k < w; k += 4) x.fillRect(k, 0, 2, h); });
    knitC.wrapS = knitC.wrapT = THREE.RepeatWrapping; knitC.repeat.set(3, 2);
    var cushion = ball(.33, new THREE.MeshStandardMaterial({ map: knitC, bumpMap: knitC, bumpScale: .5, roughness: 1 }), DX + .05, DY + .06, DZ - .78, 1, .3, .86);
    var cat = new THREE.Group(); cat.position.set(DX + .05, DY + .13, DZ - .78); cat.rotation.y = 2.0; cat.scale.setScalar(.62); scene.add(cat);
    var furTexC = canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = '#A8733E'; x.fillRect(0, 0, w, h);
      var fs = 17; function fr() { fs = (fs * 16807) % 2147483647; return (fs - 1) / 2147483646; }
      for (var f = 0; f < 12000; f++) { x.strokeStyle = f % 3 ? 'rgba(255,225,180,.08)' : 'rgba(40,22,10,.12)'; x.lineWidth = 1; var fx = fr() * w, fy = fr() * h, an = (fr() - .5) * 1.6; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + Math.cos(an) * 7, fy + Math.sin(an) * 7); x.stroke(); }
    });
    furTexC.wrapS = furTexC.wrapT = THREE.RepeatWrapping; furTexC.repeat.set(5, 3);
    var fur = new THREE.MeshStandardMaterial({ map: furTexC, bumpMap: furTexC, bumpScale: .25, roughness: 1 }), furDark = mat('#6E4520', { roughness: 1, env: .1 }), furLight = mat('#D9C3A0', { roughness: 1, env: .1 });
    var catBody = ball(.42, fur, 0, .2, 0, 1, .52, .78, cat);
    ball(.1, furDark, -.05, .38, -.05, 1.6, .25, 1.4, cat); ball(.12, furDark, -.2, .34, .1, 1.2, .22, 1, cat);
    var tail = new THREE.Mesh(new THREE.TorusGeometry(.36, .065, 12, 32, Math.PI * 1.05), fur); tail.rotation.x = -Math.PI / 2; tail.rotation.z = 2.2; tail.position.set(0, .08, .05); add(tail, cat);
    var head = new THREE.Group(); head.position.set(.38, .2, .22); cat.add(head);
    ball(.21, fur, 0, 0, 0, 1, .92, 1, head); ball(.11, furLight, .12, -.06, .1, 1, .7, 1, head);
    var earL = new THREE.Mesh(new THREE.ConeGeometry(.075, .15, 16), fur); earL.position.set(-.04, .19, -.09); earL.rotation.set(-.3, 0, .1); add(earL, head);
    var earR = new THREE.Mesh(new THREE.ConeGeometry(.075, .15, 16), fur); earR.position.set(.1, .18, .05); earR.rotation.set(.3, 0, -.35); add(earR, head);
    var dark = mat('#4A3020');
    var eye1 = new THREE.Mesh(new THREE.TorusGeometry(.028, .008, 6, 12, Math.PI), dark); eye1.position.set(.15, .04, .1); eye1.rotation.set(0, -.8, Math.PI); add(eye1, head, false);
    var eye2 = new THREE.Mesh(new THREE.TorusGeometry(.028, .008, 6, 12, Math.PI), dark); eye2.position.set(.08, .04, .16); eye2.rotation.set(0, -.8, Math.PI); add(eye2, head, false);
    ball(.018, '#A9645C', .19, -.03, .16, 1, 1, 1, head);
    ball(.035, '#C98A80', .17, -.01, .02, 1, .6, 1, head); ball(.035, '#C98A80', .02, -.01, .19, 1, .6, 1, head);
    var furV = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    (function paintCalico() {        // white, orange and cream patches painted per vertex so they never stretch
      var cw = new THREE.Color('#F2E8D8'), co = new THREE.Color('#D88D4C'), cd = new THREE.Color('#B8743A'), c = new THREE.Color();
      function nz(px, py, pz) { return Math.sin(px * 6.1 + 1.3) * Math.sin(py * 5.3 + .7) + Math.sin(pz * 6.7 + 2.1) * Math.sin(px * 4.1 + py * 3.7) + .5 * Math.sin((px + pz) * 9.3); }
      cat.traverse(function (o) {
        if (!o.isMesh || o.material !== fur) return;
        o.updateMatrix(); var pos = o.geometry.attributes.position, cols = new Float32Array(pos.count * 3), v = new THREE.Vector3();
        for (var i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrix); var n = nz(v.x, v.y, v.z);
          c.copy(cw); if (n > .5) c.copy(co); if (n > 1.1) c.copy(cd);
          c.offsetHSL(0, 0, (Math.sin(v.x * 80 + v.y * 60 + v.z * 70) * .5 + .5) * .06 - .03);
          cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
        }
        o.geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3)); o.material = furV;
      });
    })();
    tag = null;
    var zzz = spriteSet(3, function (x) { x.fillStyle = '#FFF6E2'; x.font = '600 52px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', 32, 34); }, .15);
    var hearts = spriteSet(5, function (x) { x.fillStyle = '#F07A93'; x.font = '50px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♥', 32, 36); }, .15);

    /* ---------- brass pendants with opal glass globes ---------- */
    var chands = [], cloudM = new THREE.MeshStandardMaterial({ color: '#FFF3DE', emissive: '#FFD9A0', emissiveIntensity: 1, roughness: .3 });
    [-4.6, -1.2].forEach(function (z) {
      var y = 4.35, g = new THREE.Group(); g.position.set(0, y, z); scene.add(g);
      var brassP = mat('#B8893C', { metalness: .92, roughness: .28, env: 1.2 });
      cyl(.008, .008, HH - y - .1, brassP, 0, (HH - y) / 2 + .05, 0, 8, g).castShadow = false;
      cyl(.06, .09, .1, brassP, 0, .26, 0, 32, g); cyl(.1, .1, .02, brassP, 0, .2, 0, 32, g);
      var gl = new THREE.Mesh(new THREE.SphereGeometry(.25, 40, 28), cloudM); gl.position.y = 0; g.add(gl);
      var fin = new THREE.Mesh(new THREE.ConeGeometry(.03, .08, 16), brassP); fin.rotation.x = Math.PI; fin.position.y = -.28; g.add(fin);
      var L = new THREE.PointLight('#FFCB8A', 1, 9, 2); L.position.set(0, y - .45, z); scene.add(L);
      chands.push({ light: L, glow: glow('#FFC880', 2.0, 0, y, z, .3), group: g, ph: z });
    });

    /* ---------- reading-nook details: wall sconces, a hanging star, a side table, soft light shafts ---------- */
    var lanterns = [], shafts = [];
    function sconce(x, y, z, rotY) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; scene.add(g);
      var brass = mat('#B88A3E', { metalness: .92, roughness: .28, env: 1.3 }), V = THREE.Vector3;
      box(.05, .16, .02, brass, 0, 0, 0, g, false, .008);
      rod(new V(0, 0, .02), new V(0, 0, .14), .008, brass, g); cyl(.012, .012, .05, brass, 0, .02, .14, 12, g);
      var sm = new THREE.MeshStandardMaterial({ color: '#F6E3C2', emissive: '#FFD9A0', emissiveIntensity: 1.2, roughness: .8, side: THREE.DoubleSide });
      var sh = new THREE.Mesh(new THREE.CylinderGeometry(.045, .075, .12, 28, 1, true), sm); sh.position.set(0, .08, .14); add(sh, g, false);
      lampBulbs.push(sm);
      var wp = new V(0, .08, .14).applyAxisAngle(new V(0, 1, 0), rotY || 0);
      glow('#FFC880', .8, x + wp.x, y + wp.y, z + wp.z, .55);
    }
    [-2.95, -1.0, 1.0, 2.95].forEach(function (px) { sconce(px, 2.75, Z0 + .26, 0); });
    var starLan = new THREE.Group(); starLan.position.set(1.0, 3.85, -6.5); scene.add(starLan);
    cyl(.002, .002, HH - 3.85, '#C79A45', 0, (HH - 3.85) / 2, 0, 6, starLan).castShadow = false;
    var lanStar = starMesh(0, 0, 0, .17, 1.6); scene.remove(lanStar); starLan.add(lanStar);
    var lanGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#FFC878', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .7, fog: false })); lanGlow.scale.set(.9, .9, 1); starLan.add(lanGlow);
    lanterns.push({ g: starLan, y: 3.85, ph: 1.2 });
    (function sideNook() {                  // a round table with a fabric-shaded lamp and roses, tucked beside the window seat
      var tx = 3.6, tz = -6.85;
      cyl(.3, .3, .035, peach, tx, .62, tz, 48); cyl(.045, .06, .58, '#3A2416', tx, .31, tz, 16); cyl(.22, .25, .04, '#3A2416', tx, .02, tz, 32);
      var cer = mat('#E8DDC9', { roughness: .3, env: .6 }), ly = .64;
      cyl(.035, .06, .2, cer, tx - .08, ly + .1, tz, 24); cyl(.012, .012, .1, '#B88A3E', tx - .08, ly + .25, tz, 10);
      var fm = new THREE.MeshStandardMaterial({ color: '#F3E1C4', emissive: '#FFD9A0', emissiveIntensity: 1.2, roughness: .9, side: THREE.DoubleSide });
      var fs = new THREE.Mesh(new THREE.CylinderGeometry(.09, .17, .2, 32, 1, true), fm); fs.position.set(tx - .08, ly + .36, tz); add(fs, null, false); lampBulbs.push(fm);
      glow('#FFC880', 1.0, tx - .08, ly + .36, tz, .5);
      var vase = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.05, 0], [.06, .05], [.05, .11], [.03, .15], [.034, .19], [.045, .2], [.04, .2], [0, .19]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 32), mat('#EFE6D6', { roughness: .3, env: .7, side: THREE.DoubleSide }));
      vase.position.set(tx + .14, ly, tz + .05); add(vase, null, true);
      var rg = new THREE.Group(); rg.position.set(tx + .14, ly + .19, tz + .05); scene.add(rg);
      var petal = mat('#E8B4BB', { roughness: .65 }), inner = mat('#D98F9A', { roughness: .6 }), leafM = mat('#3C6B3A', { roughness: .6 });
      for (var i = 0; i < 9; i++) {
        var a = i * 2.4, d = .02 + (i % 3) * .035, hy = .1 + (i % 4) * .035 + Math.random() * .02, hx = Math.cos(a) * d, hz = Math.sin(a) * d;
        rod(new THREE.Vector3(0, -.02, 0), new THREE.Vector3(hx, hy, hz), .0025, leafM, rg).castShadow = false;
        ball(.034, petal, hx, hy + .02, hz, 1, .9, 1, rg); ball(.022, inner, hx, hy + .035, hz, 1, .8, 1, rg);
        if (i % 2) { var lf = ball(.02, leafM, hx * .6, hy * .55, hz * .6, 1.6, .25, 1, rg); lf.rotation.y = a; }
      }
    })();
    var shaftTex = canvasTex(64, 256, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      var gh = x.createLinearGradient(0, 0, w, 0); gh.addColorStop(0, 'rgba(0,0,0,1)'); gh.addColorStop(.5, 'rgba(0,0,0,0)'); gh.addColorStop(1, 'rgba(0,0,0,1)');
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = gh; x.fillRect(0, 0, w, h);
    }, true);
    WCX.forEach(function (cx) {
      var sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 5.4), new THREE.MeshBasicMaterial({ map: shaftTex, color: '#FFD9A0', transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      sh.position.set(cx * .85, 2.7, -5.7); sh.rotation.x = -.5; sh.userData.noPick = true; scene.add(sh); shafts.push(sh);
    });

    /* ---------- little extras: floating books, drifting bubbles, sparkles ---------- */
    var floaters = [], bubbles = [];
    var starTex = canvasTex(64, 64, function (x) { x.translate(32, 32); x.fillStyle = '#FFFFFF'; x.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? 6 : 28, a = i / 8 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); }, true);
    var sparkles = [];
    for (var si = 0; si < 60; si++) {
      var ss = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ['#FFE9C4', '#FFDDB0', '#FFD3A0'][si % 3], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      ss.scale.setScalar(.035 + Math.random() * .04);
      ss.position.set((Math.random() - .5) * 8.5, .6 + Math.random() * (HH - 1), Z0 + .5 + Math.random() * (ZL - 1)); ss.userData.ph = Math.random() * 6; scene.add(ss); sparkles.push(ss);
    }

    /* ---------- lights ---------- */
    var hemi = new THREE.HemisphereLight('#ffffff', '#5a3e2c', 1); scene.add(hemi);
    var sun = new THREE.DirectionalLight('#fff4e2', 1.4); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 12; sun.shadow.blurSamples = 20; sun.shadow.bias = -.0004;
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 9, bottom: -9, near: 1, far: 40 }); sun.target.position.set(0, 0, -2); scene.add(sun); scene.add(sun.target);
    var bounce = new THREE.PointLight('#FFB98A', .4, 14, 2); bounce.position.set(0, 2.2, 1.6); scene.add(bounce);
    var LP = {
      morning: { sky: '#FFE9D2', ground: '#5A3E2C', hemi: .8, sun: '#FFE2BC', sunI: 1.8, pos: [2, 7, -18], lamp: .5, chand: .5, fairy: 1.4, patchO: .25, dust: .6, fog: '#3B2C22', skyB: 1.4 },
      day:     { sky: '#FFF3E4', ground: '#5E4230', hemi: .9, sun: '#FFF4E2', sunI: 2.0, pos: [1, 10, -16], lamp: .4, chand: .4, fairy: 1.1, patchO: .26, dust: .6, fog: '#46362A', skyB: 1.5 },
      golden:  { sky: '#F4B6C8', ground: '#4A2E20', hemi: .62, sun: '#FF9F5A', sunI: 2.1, pos: [-3, 4, -18], lamp: .9, chand: .8, fairy: 2.2, patchO: .38, dust: .9, fog: '#33231A', skyB: 1.4 },
      night:   { sky: '#6A78B8', ground: '#1E1620', hemi: .16, sun: '#9FB4FF', sunI: .3, pos: [2, 9, -16], lamp: 1.5, chand: .55, fairy: 3.4, patchO: .08, dust: .3, fog: '#0E0B10', skyB: 1.0 }
    };
    scene.traverse(function (o) { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && envMats.indexOf(o.material) < 0) envMats.push(o.material); });
    var target = LP.day, first = true;
    var cur = { sky: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(), fog: new THREE.Color(), hemi: 1, sunI: 1, lamp: .5, chand: .3, fairy: 1, patchO: .3, dust: .5, skyB: 1.3, pos: new THREE.Vector3() };
    var NUMS = ['hemi', 'sunI', 'lamp', 'chand', 'fairy', 'patchO', 'dust', 'skyB'];
    function setTod(tod) {
      target = LP[tod]; skyTod = tod; redraw(skyTex);
      if (first) { cur.sky.set(target.sky); cur.ground.set(target.ground); cur.sun.set(target.sun); cur.fog.set(target.fog); NUMS.forEach(function (p) { cur[p] = target[p]; }); cur.pos.fromArray(target.pos); first = false; }
    }

    /* =====================================================================
       Looking around from your seat; tapping floats you over to things.
       ===================================================================== */
    var SEAT = new THREE.Vector3(0, 1.18, 1.3);
    var look = { yaw: 0, pitch: -.04, ty: 0, tp: -.04 }, homeLook = null;
    var baseFov = 60, fovT = 60;
    camera.position.copy(SEAT);
    var HOT = {
      desk:    { label: 'Your table',       at: [-.15, 1.1, .0],    target: [0, .85, -.1],      from: [.6, 1.85, 1.6],   w: 1.8, h: 1.1 },
      cat:     { label: 'Mochi',            at: [.15, 1.22, -1.33], target: [.05, .95, -1.33],  from: [.5, 1.5, .3],     w: 1.1, h: .7 },
      shelf:   { label: 'Your study shelf', at: [1.85, 2.85, 1.0],  target: [2.0, 1.25, 1.0],   from: [.2, 1.5, .9],     w: 2.2, h: 2.7 },
      library: { label: 'The stacks',       at: [2.75, 2.85, -4.3], target: [2.75, 1.1, -4.3],  from: [.4, 1.5, -2.4],   w: 3.0, h: 2.4 },
      window:  { label: 'Window seat',      at: [0, 4.8, -7.8],     target: [0, 2.3, -8],       from: [0, 1.8, -3.5],    w: 6.8, h: 4.6 },
      chair:   { label: 'Fireside chair',   at: [-3.25, 1.5, 1.55], target: [-4.0, 1.0, 1.6],   from: [-1.6, 1.7, .8],   w: 3.4, h: 2.6 },
      music:   { label: 'Gramophone',       at: [-4.25, 1.85, 3.35], target: [-4.25, 1.0, 3.35], from: [-2.7, 1.6, 2.2], w: 1.6, h: 1.7 },
      board:   { label: 'Card catalog',     at: [3.2, 1.85, 3.6],   target: [3.2, .9, 3.6],     from: [2.4, 1.6, 1.8],   w: 2.6, h: 1.9 }
    };
    var spotsEl = $('#spots');
    Object.keys(HOT).forEach(function (id) {
      var h = HOT[id]; h.atV = new THREE.Vector3().fromArray(h.at);
      var b = document.createElement('button'); b.className = 'spot'; b.innerHTML = '<span class="dot"></span><span class="tag">' + h.label + '</span>';
      b.onclick = function () { api.onOpen(id); }; spotsEl.appendChild(b); h.el = b;
    });

    var move = null, offR = 0, offB = 0, wantR = 0, wantB = 0, focused = null;
    function angTo(from, to) { var d = new THREE.Vector3().subVectors(to, from); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; }
    function nearAngle(a, ref) { while (a - ref > Math.PI) a -= Math.PI * 2; while (a - ref < -Math.PI) a += Math.PI * 2; return a; }
    function goTo(pos, yaw, pitch) { move = { p0: camera.position.clone(), p1: pos, y0: look.yaw, y1: nearAngle(yaw, look.yaw), q0: look.pitch, q1: pitch, start: performance.now(), dur: 1500 }; }
    function focus(id, cardW, cardH, mobile) {
      if (!focused) homeLook = { yaw: look.yaw, pitch: look.pitch };
      focused = id; var h = HOT[id];
      wantR = mobile ? 0 : cardW + 40; wantB = mobile ? cardH + 24 : 0;
      fovT = baseFov;
      var w = stage.clientWidth, ht = stage.clientHeight, fh = ht + wantB, tanV = Math.tan(baseFov * Math.PI / 360);
      var dist = Math.max(h.w / (2 * tanV * (w - wantR) / fh), h.h / (2 * tanV * (ht - wantB) / fh));
      var tgt = new THREE.Vector3().fromArray(h.target);
      var pos = new THREE.Vector3().fromArray(h.from).sub(tgt).setLength(dist).add(tgt);
      pos.x = Math.max(-X + .7, Math.min(X - .7, pos.x)); pos.z = Math.max(Z0 + .7, Math.min(Z1 - .5, pos.z)); pos.y = Math.max(1.0, Math.min(2.6, pos.y));
      var a = angTo(pos, tgt); goTo(pos, a.yaw, a.pitch);
    }
    function home() { focused = null; wantR = 0; wantB = 0; fovT = baseFov; var l = homeLook || { yaw: 0, pitch: -.04 }; goTo(SEAT.clone(), l.yaw, l.pitch); }

    var canvas = renderer.domElement, ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), hovered = null, needsPick = false;
    var pointers = new Map(), downAt = null, pinch = 0;
    function setMouse(e) { var r = canvas.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
    function pick() {
      ray.setFromCamera(mouse, camera);
      var hits = ray.intersectObjects(scene.children, true);
      for (var k = 0; k < hits.length; k++) {
        var o = hits[k].object; if (o.isSprite || o === patch || o.isLine || o.isPoints || o === vines || o === ceil || (o.userData && o.userData.noPick)) continue;
        if (hits[k].distance > 14) return null;
        while (o && !o.userData.hot && !o.userData.book) o = o.parent;
        return o || null;
      }
      return null;
    }
    canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); downAt = [e.clientX, e.clientY]; if (pointers.size === 2) { var p = Array.from(pointers.values()); pinch = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); } });
    canvas.addEventListener('pointermove', function (e) {
      setMouse(e); needsPick = e.pointerType === 'mouse';
      var prev = pointers.get(e.pointerId); if (!prev) return;
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size === 1 && !move) { var s = camera.fov / 60 * .0042; look.ty += (e.clientX - prev[0]) * s; look.tp = Math.max(-1.0, Math.min(1.0, look.tp + (e.clientY - prev[1]) * s)); }
      else if (pointers.size === 2) { var p = Array.from(pointers.values()), d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); if (pinch) fovT = Math.max(32, Math.min(76, fovT * pinch / d)); pinch = d; }
    });
    function up(e) {
      pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0;
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
      downAt = null; setMouse(e); var o = pick();
      if (!o) { if (focused) api.onClose(); return; }
      if (o.userData.book) { o.userData.pull = 1; setTimeout(function () { if (hovered !== o) o.userData.pull = 0; }, 900); api.onBook(o.userData.book); }
      else api.onOpen(o.userData.hot);
    }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', function (e) { pointers.delete(e.pointerId); });
    canvas.addEventListener('pointerleave', function () { hovered = null; stage.classList.remove('hovering'); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); fovT = Math.max(32, Math.min(76, fovT * Math.exp(e.deltaY * .001))); }, { passive: false });
    window.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input, button, [role="dialog"]')) return;
      var k = { ArrowLeft: [.12, 0], ArrowRight: [-.12, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }[e.key];
      if (k) { e.preventDefault(); look.ty += k[0]; look.tp = Math.max(-1, Math.min(1, look.tp + k[1])); }
    });

    function applyView() { var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; var fw = w + offR, fh = h + offB; camera.aspect = fw / fh; camera.setViewOffset(fw, fh, offR, offB, w, h); camera.updateProjectionMatrix(); }
    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false);
      if (composer) { composer.setPixelRatio(DPR); composer.setSize(w, h); finalPass.uniforms.res.value.set(w * DPR, h * DPR); }
      var nbf = w / h < .8 ? 74 : w / h < 1.2 ? 66 : 60;
      if (nbf !== baseFov) { fovT = nbf; camera.fov = nbf; } baseFov = nbf;
      applyView();
    }
    new ResizeObserver(resize).observe(stage); resize();

    /* ---------- loop ---------- */
    var clk = new THREE.Clock(), reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var focusing = false, rainLevel = 0, playing = false, catHop = 0, petT = 0, tmpV = new THREE.Vector3(), tmpC = new THREE.Color();
    function ease(u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function loop() {
      requestAnimationFrame(loop);
      var dt = Math.min(clk.getDelta(), .05), t = clk.elapsedTime, k = 1 - Math.exp(-dt * 2.5);
      var ko = 1 - Math.exp(-dt * 6);
      if (Math.abs(offR - wantR) > .5 || Math.abs(offB - wantB) > .5) { offR += (wantR - offR) * ko; offB += (wantB - offB) * ko; applyView(); }
      if (move) {
        var u = reduce ? 1 : Math.min(1, (performance.now() - move.start) / move.dur), e = ease(u);
        camera.position.lerpVectors(move.p0, move.p1, e);
        look.yaw = look.ty = move.y0 + (move.y1 - move.y0) * e; look.pitch = look.tp = move.q0 + (move.q1 - move.q0) * e;
        if (u >= 1) move = null;
      } else { var kl = 1 - Math.exp(-dt * 10); look.yaw += (look.ty - look.yaw) * kl; look.pitch += (look.tp - look.pitch) * kl; }
      var sway = reduce || move ? 0 : Math.sin(t * .6) * .004;
      camera.rotation.set(look.pitch + sway, look.yaw, 0);
      if (Math.abs(camera.fov - fovT) > .05) { camera.fov += (fovT - camera.fov) * (1 - Math.exp(-dt * 8)); camera.updateProjectionMatrix(); }
      cur.sky.lerp(tmpC.set(target.sky), k); cur.ground.lerp(tmpC.set(target.ground), k); cur.sun.lerp(tmpC.set(target.sun), k); cur.fog.lerp(tmpC.set(target.fog), k);
      NUMS.forEach(function (p) { cur[p] += (target[p] - cur[p]) * k; });
      cur.pos.lerp(tmpV.fromArray(target.pos), k);
      var dim = focusing ? .85 : 1;
      hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.ground); hemi.intensity = cur.hemi * dim;
      sun.color.copy(cur.sun); sun.intensity = cur.sunI * dim; sun.position.copy(cur.pos);
      scene.fog.color.copy(cur.fog); scene.background.copy(cur.fog);
      skyMat.uniforms.uBright.value = cur.skyB; skyMat.uniforms.uTime.value = reduce ? 0 : t; skyMat.uniforms.uRain.value += (rainLevel - skyMat.uniforms.uRain.value) * (1 - Math.exp(-dt * 2.5));
      ceil.material.color.setScalar(.3 + cur.hemi * .75);
      var lampI = Math.max(cur.lamp, focusing ? 1.6 : 0) * (focusing ? 1.2 : 1);
      lampLight.intensity = lampI * .45;
      envMats.forEach(function (m) { m.envMapIntensity = (m.userData.env == null ? .3 : m.userData.env) * (.4 + cur.hemi * .6); });
      lampBulbs.forEach(function (m) { m.emissiveIntensity = 1.0 + cur.lamp * 1.4; }); shadeMats.forEach(function (m) { m.emissiveIntensity = .12 + cur.lamp * .25; });
      var flick = reduce ? 1 : .85 + Math.sin(t * 23) * .06 + Math.sin(t * 37) * .05;
      candles.forEach(function (c) { var f = reduce ? 1 : .8 + Math.sin(t * 9 + c.ph) * .12 + Math.sin(t * 17 + c.ph * 2) * .08; c.light.intensity = (.25 + cur.lamp * .25) * f; c.fl.scale.set(.8 * f, 1.9 * (.9 + (f - .8) * .8), .8 * f); c.glow.material.opacity = Math.min(.9, .55 * f + cur.lamp * .1); });
      lanterns.forEach(function (l) { if (!reduce) { l.g.rotation.y = Math.sin(t * .5 + l.ph) * .5; l.g.position.y = l.y + Math.sin(t * .8 + l.ph) * .035; } });
      shafts.forEach(function (m, i) { m.material.color.copy(cur.sun); m.material.opacity = (.02 + cur.patchO * .26) * (reduce ? 1 : .85 + Math.sin(t * .35 + i * 2) * .15); });
      chands.forEach(function (c) { c.light.intensity = cur.chand * 1.3 * dim; c.glow.material.opacity = Math.min(.6, .12 + cur.chand * .2); if (!reduce) c.group.position.y = 4.35 + Math.sin(t * .7 + c.ph) * .04; });
      cloudM.emissiveIntensity = .5 + cur.chand * 1.2;
      fairyMats.forEach(function (m, i) { m.emissiveIntensity = (.8 + cur.fairy) * (reduce ? 1 : .8 + Math.sin(t * 1.8 + i * 2.1) * .2); });
      fairyGlows.forEach(function (g, i) { g.material.opacity = Math.min(.65, cur.fairy * .16) * (reduce ? 1 : .8 + Math.sin(t * 1.8 + (i % 4) * 2.1) * .2); });
      patch.material.color.copy(cur.sun); patch.material.opacity = cur.patchO;
      fireLight.intensity = 1.8 * flick; fireCore.material.emissiveIntensity = 3.5 + flick * 2.5;
      flames.forEach(function (fl, fi) { var s2 = reduce ? 1 : .8 + Math.sin(t * (11 + fi * 3) + fi) * .25; fl.scale.set(.42 * s2, .66 * s2, 1); fl.position.y = .4 + (s2 - .8) * .2; });
      candleM.emissiveIntensity = 4 * flick; mantelGlow.scale.setScalar(.45 * flick);
      bounce.intensity = .2 + cur.chand * .15;
      // floating books bob and turn; bubbles drift up; sparkles twinkle
      floaters.forEach(function (g) { if (reduce) return; g.position.y = g.userData.y + Math.sin(t * .8 + g.userData.ph) * .12; g.rotation.y = t * .25 + g.userData.ph; g.rotation.z = Math.sin(t * .6 + g.userData.ph) * .12; });
      bubbles.forEach(function (b) { if (reduce) return; b.position.y += b.userData.v * dt; b.position.x += Math.sin(t * .9 + b.userData.ph) * .002; if (b.position.y > HH - .3) b.position.y = .2; b.material.opacity = .25 + cur.dust * .45; });
      sparkles.forEach(function (s) { var tw = reduce ? .6 : Math.max(0, Math.sin(t * 1.6 + s.userData.ph)); s.material.opacity = tw * (.25 + cur.fairy * .18); });
      steam.forEach(function (s) { s.userData.t = (s.userData.t + dt * .35) % 1; var uu = s.userData.t; s.position.set(MX + Math.sin(uu * 6 + s.id) * .025, DY + .16 + uu * .3, MZ); s.material.opacity = Math.sin(uu * Math.PI) * .16; s.scale.setScalar(.06 + uu * .09); });
      rainMat.opacity = rainLevel ? .2 + rainLevel * .5 : 0;
      if (rainLevel) rainDrops.forEach(function (d) { d.position.y -= d.userData.v * dt; if (d.position.y < WB) d.position.y = WB + WS + .6; });
      if (playing && !reduce) platter.rotation.y -= dt * 3.5;
      notes.forEach(function (n, i) { n.userData.t = (n.userData.t + dt * .28) % 1; var uu = n.userData.t; n.position.set(RX + .15 + Math.sin(uu * 5 + i * 2) * .18, 1.6 + uu * .8, RZ - .3); n.material.opacity = playing ? Math.sin(uu * Math.PI) * .9 : 0; });
      var br = reduce ? 0 : Math.sin(t * (focusing ? 1.4 : 1.9)) * .03;
      catBody.scale.set(1 + br * .5, .52 + br, .78 + br * .5);
      catHop = Math.max(0, catHop - dt * 1.4);
      head.position.y = .2 + Math.sin(catHop * Math.PI) * .12; head.rotation.z = Math.sin(catHop * Math.PI) * .3;
      head.getWorldPosition(tmpV); var hx = tmpV.x, hy = tmpV.y, hz = tmpV.z;
      zzz.forEach(function (z) { z.userData.t = (z.userData.t + dt * .3) % 1; var uu = z.userData.t; z.position.set(hx + uu * .2, hy + .15 + uu * .38, hz - uu * .08); z.material.opacity = focusing && !catHop ? Math.sin(uu * Math.PI) * .95 : 0; z.scale.setScalar(.08 + uu * .1); });
      petT = Math.max(0, petT - dt * .45);
      hearts.forEach(function (hs, i) { hs.userData.t = (hs.userData.t + dt * .6) % 1; var uu = hs.userData.t; hs.position.set(hx - .08 + Math.sin(uu * 4 + i * 1.3) * .16, hy + .1 + uu * .5, hz + Math.cos(i * 2) * .1); hs.material.opacity = petT > 0 ? Math.sin(uu * Math.PI) * Math.min(1, petT * 2) : 0; });
      if (needsPick && !pointers.size) { needsPick = false; var o = pick(); hovered = o && o.userData.book ? o : null; stage.classList.toggle('hovering', !!o); }
      booksGroup.children.forEach(function (m) {
        var ud = m.userData; if (!ud.book) return;
        m.position.x += (ud.baseX - ((m === hovered || ud.pull) ? .1 : 0) - m.position.x) * Math.min(1, dt * 12);
        if (ud.drop < 1) { ud.drop = Math.min(1, ud.drop + dt * 1.4); var ee = 1 - Math.pow(1 - ud.drop, 3); m.position.y = ud.baseY + (1 - ee) * .9 + Math.abs(Math.sin(ud.drop * Math.PI * 2.2) * (1 - ud.drop) * .07); }
      });
      if (composer) { finalPass.uniforms.time.value = t % 100; composer.render(); } else renderer.render(scene, camera);
      var w = stage.clientWidth, h = stage.clientHeight;
      Object.keys(HOT).forEach(function (id) {
        var hs = HOT[id]; tmpV.copy(hs.atV).project(camera);
        var x = (tmpV.x * .5 + .5) * w, y = (-tmpV.y * .5 + .5) * h;
        var hidden = tmpV.z > 1 || x < -60 || x > w + 60 || y < -40 || y > h + 40;
        var tx = Math.max(8, Math.min(x - 15, w - (hs.el.offsetWidth || 120) - 8)), ty = Math.max(70, Math.min(y - 14, h - 90));
        hs.el.style.transform = 'translate(' + Math.round(tx) + 'px,' + Math.round(ty) + 'px)';
        hs.el.style.visibility = hidden ? 'hidden' : 'visible';
      });
    }
    loop();

    var api = {
      onOpen: function () {}, onClose: function () {}, onBook: function () {},
      setTod: setTod, focus: focus, home: home,
      setFocus: function (v) { focusing = v; }, setRain: function (v) { rainLevel = v; }, setPlaying: function (v) { playing = v; },
      addBook: function (b) { placeBook(b, true); },
      setDeskClock: function (time, color, running) { if (deskClock.time === time && deskClock.color === color && deskClock.running === running) return; deskClock.time = time; deskClock.color = color; deskClock.running = running; redraw(dcTex); },
      pet: function () { petT = 1.6; catHop = 1; }, hello: function () { catHop = 1; }
    };
    return api;
  })();

  /* ---------- cards ---------- */
  var CARDS = {
    desk: ['Your reading table', 'Settle in'], music: ['Gramophone', 'Ambience'], chair: ['Fireside chair', 'Currently reading'],
    library: ['The stacks', 'Books you have read'], shelf: ['Your study shelf', 'Your study sessions'], board: ['Card catalog', 'October'],
    window: ['Arched window', 'Time of day'], cat: ['Mochi, the library cat', 'Hello, Mochi']
  };
  var card = $('#card'), openId = null, mobileMQ = window.matchMedia('(max-width: 640px)');
  function openCard(id) {
    if (!CARDS[id]) return;
    openId = id;
    $('#cardKicker').textContent = CARDS[id][0]; $('#cardTitle').textContent = CARDS[id][1];
    document.querySelectorAll('.sect').forEach(function (s) { s.hidden = s.dataset.sect !== id; });
    card.hidden = false;
    requestAnimationFrame(function () { card.classList.add('open'); });
    $('#spots').classList.add('away'); $('#hint').style.opacity = 0;
    if (room) room.focus(id, card.offsetWidth, card.offsetHeight, mobileMQ.matches);
    if (id === 'cat' && room) room.hello();
  }
  function closeCard() {
    if (!openId) return;
    openId = null; card.classList.remove('open');
    setTimeout(function () { if (!openId) card.hidden = true; }, 350);
    $('#spots').classList.remove('away'); $('#hint').style.opacity = 1;
    if (room) room.home();
  }
  $('#cardClose').onclick = closeCard;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCard(); });
  if (room) { room.onOpen = openCard; room.onClose = closeCard; room.onBook = function (b) { showBook(b); if (openId !== 'shelf') openCard('shelf'); }; }

  /* ---------- time of day ---------- */
  var todMode = 'auto', lastTod = null;
  function autoTod(h) { return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'golden' : 'night'; }
  function applyTod() {
    var now = new Date(), tod = todMode === 'auto' ? autoTod(now.getHours()) : todMode;
    document.documentElement.setAttribute('data-tod', tod);
    if (room && tod !== lastTod) room.setTod(tod);
    lastTod = tod;
    var label = { morning: 'good morning', day: 'a bright afternoon', golden: 'golden hour', night: 'a quiet night' }[tod];
    var clockStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('#clockText').textContent = clockStr + ' · ' + label;
    $('#todNow').textContent = todMode === 'auto' ? 'Live follows your clock. It is ' + clockStr + ', so the room shows ' + label + '.' : 'Showing ' + label + '. Pick Live to follow your clock again.';
  }
  document.querySelectorAll('.tods .chip').forEach(function (b) { b.onclick = function () { todMode = b.dataset.tod; document.querySelectorAll('.tods .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); applyTod(); }; });
  applyTod(); setInterval(applyTod, 30000);

  /* ---------- focus timer ---------- */
  var subject = SUBJECTS[0], minutes = 25, remaining = 25 * 60, running = false, tick = null, endAt = 0;
  SUBJECTS.forEach(function (s, i) {
    var b = document.createElement('button'); b.className = 'chip'; b.setAttribute('aria-pressed', i === 0);
    b.innerHTML = '<i style="background:' + s.c[0] + '"></i>' + s.name;
    b.onclick = function () { subject = s; document.querySelectorAll('#subjects .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); render(); };
    $('#subjects').appendChild(b);
  });
  document.querySelectorAll('#lengths .chip').forEach(function (b) { b.onclick = function () { if (running) return; minutes = +b.dataset.min; remaining = minutes * 60; render(); document.querySelectorAll('#lengths .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }; });
  function fmt(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function render() {
    var started = remaining < minutes * 60;
    $('#time').textContent = fmt(remaining); $('#prog').style.width = (100 * (1 - remaining / (minutes * 60))) + '%';
    $('#startBtn').textContent = running ? 'Pause' : started ? 'Resume' : (minutes === 5 ? 'Start break' : 'Start focus');
    $('#timeSub').textContent = running ? (minutes === 5 ? 'stretch, sip some tea' : 'Mochi is keeping you company') : started ? 'paused' : 'ready when you are';
    $('#timerPill').hidden = !running && !started;
    $('#pillTime').textContent = fmt(remaining); $('#pillSub').textContent = minutes === 5 ? 'Break' : subject.name; $('#pillDot').style.background = subject.c[0];
    if (room) { room.setFocus(running && minutes !== 5); room.setDeskClock(fmt(remaining), subject.c[0], running); }
  }
  function finish() {
    clearInterval(tick); running = false;
    if (minutes !== 5) {
      var b = { s: subject, mins: minutes, color: subject.c[Math.floor(Math.random() * 3)], h: .48 + Math.random() * .16, w: minutes === 50 ? .13 : .085, when: 'Today' };
      books.push(b); if (room) room.addBook(b); updateStats(); showBook(b);
      toast('A new ' + subject.name + ' book for your shelf');
    } else toast('Break over. Ready for another round?');
    remaining = minutes * 60; render();
  }
  $('#startBtn').onclick = function () {
    if (running) { running = false; clearInterval(tick); render(); return; }
    running = true; endAt = Date.now() + remaining * 1000;
    tick = setInterval(function () { remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000)); render(); if (!remaining) finish(); }, 250);
    render();
  };
  $('#resetBtn').onclick = function () { running = false; clearInterval(tick); remaining = minutes * 60; render(); };
  $('#skipBtn').onclick = finish;
  $('#timerPill').onclick = function () { openCard('desk'); };
  render();

  /* ---------- record player: ambience ---------- */
  var CH = [{ id: 'rain', icon: '🌧️', name: 'Rain', v: 50 }, { id: 'fire', icon: '🔥', name: 'Crackling fire', v: 30 }, { id: 'wind', icon: '🍃', name: 'Wind', v: 0 }, { id: 'clock', icon: '🕰️', name: 'Clock ticking', v: 0 }];
  var ac = null, gains = {}, playing = false;
  CH.forEach(function (c) {
    var row = document.createElement('div'); row.className = 'ch';
    row.innerHTML = '<span class="ic" aria-hidden="true">' + c.icon + '</span><div><label for="v-' + c.id + '">' + c.name + '</label><input type="range" id="v-' + c.id + '" min="0" max="100" value="' + c.v + '"></div><output id="o-' + c.id + '">' + c.v + '</output>';
    $('#mix').appendChild(row);
    row.querySelector('input').oninput = function (e) { c.v = +e.target.value; $('#o-' + c.id).textContent = c.v; setLevel(c); };
  });
  if (room) room.setRain(CH[0].v / 100);
  function noiseBuffer(type) { var len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0), last = 0; for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; if (type === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } return buf; }
  function loopSrc(buf) { var s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
  function initAudio() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    var master = ac.createGain(); master.gain.value = .8; master.connect(ac.destination);
    var white = noiseBuffer('white'), brown = noiseBuffer('brown');
    ['rain', 'fire', 'wind', 'clock'].forEach(function (k) { gains[k] = ac.createGain(); gains[k].gain.value = 0; gains[k].connect(master); });
    var rf = ac.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1400; rf.Q.value = .35; loopSrc(white).connect(rf); rf.connect(gains.rain);
    var ff = ac.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 420; loopSrc(brown).connect(ff); ff.connect(gains.fire);
    setInterval(function () {
      if (!playing || !CH[1].v || Math.random() > .35) return;
      var s = ac.createBufferSource(); s.buffer = white; var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800 + Math.random() * 2500;
      var g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.4 + Math.random() * .6, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .03 + Math.random() * .05);
      s.connect(hp); hp.connect(g); g.connect(gains.fire); s.start(t, Math.random() * 2, .1);
    }, 70);
    var wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 1.4;
    var lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .08; lg.gain.value = 220; lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    loopSrc(brown).connect(wf); wf.connect(gains.wind);
    setInterval(function () {
      if (!playing || !CH[3].v) return;
      var s = ac.createBufferSource(); s.buffer = white; var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 6;
      var g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(1.6, t); g.gain.exponentialRampToValueAtTime(.0001, t + .035);
      s.connect(bp); bp.connect(g); g.connect(gains.clock); s.start(t, 0, .05);
    }, 1000);
    CH.forEach(setLevel);
  }
  var SCALE = { rain: .5, fire: 1.2, wind: 1.6, clock: 1 };
  function setLevel(c) { if (c.id === 'rain' && room) room.setRain(c.v / 100); if (ac) gains[c.id].gain.setTargetAtTime((c.v / 100) * SCALE[c.id], ac.currentTime, .15); }
  $('#playBtn').onclick = function () {
    if (!ac) initAudio();
    playing = !playing; if (playing) ac.resume(); else ac.suspend();
    if (room) room.setPlaying(playing);
    this.textContent = playing ? 'Lift the needle' : 'Play the record';
  };

  /* ---------- reading chair ---------- */
  var pg = 142, total = 272;
  function addPages(n) { pg = Math.min(total, pg + n); var pct = Math.round(pg / total * 100); $('#pBar').style.width = pct + '%'; $('#pText').textContent = pg + ' of ' + total + ' pages'; $('#pPct').textContent = pct + '%'; if (pg === total) toast('Finished Piranesi! It joins the stacks.'); }
  $('#add10').onclick = function () { addPages(10); };
  $('#add25').onclick = function () { addPages(25); };

  /* ---------- Mochi ---------- */
  var purrs = ['Mochi purrs like a tiny engine', 'Mochi does a slow blink at you', 'Mochi rolls over for belly rubs', 'Mochi kneads the rug happily'];
  $('#petBtn').onclick = function () { if (room) room.pet(); toast(purrs[Math.floor(Math.random() * purrs.length)]); };
  $('#wakeBtn').onclick = function () { if (room) room.hello(); toast('Mochi lifts her head and mrrps'); };
})();
