import './style.css';
import './three-setup.js';
import { createPainted } from './painted.js';

(function () {
  if (location.search.indexOf('perf') > -1) window.__ct = [];
  var MARKS = []; function mark(n) { if (location.search.indexOf('perf') > -1) { MARKS.push(n + ':' + Math.round(performance.now())); window.__marks = MARKS; } }
  mark('start');
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
  var SCENE = (function () { try { var v = JSON.parse(localStorage.getItem('nook.settings.v1') || '{}'); return v && v.scene === '3d' ? '3d' : 'painted'; } catch (e) { return 'painted'; } })();
  document.documentElement.setAttribute('data-scene', SCENE);
  var room = SCENE !== '3d' ? createPainted($('#stage'), { base: import.meta.env.BASE_URL, reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches }) : (function () {
    var stage = $('#stage');
    function fail(msg) { var d = document.createElement('div'); d.className = 'fallback'; d.textContent = msg; stage.appendChild(d); return null; }
    if (!window.THREE) return fail('The library could not load. Check your connection and refresh.');
    THREE.ColorManagement.legacyMode = false;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { return fail('Your browser does not support 3D graphics (WebGL).'); }
    var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(DPR);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    stage.appendChild(renderer.domElement);
    var scene = new THREE.Scene(); scene.background = new THREE.Color('#2A1E17');
    scene.fog = new THREE.Fog('#2A1E17', 9, 26);                          // warm candle haze
    var camera = new THREE.PerspectiveCamera(60, 1, .05, 60); camera.rotation.order = 'YXZ';
    var envMats = [];
    try { var pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture; } catch (e) { /* reflections are optional */ }
    var ASSET = import.meta.env.BASE_URL + '3d/';                          // CC0 textures, models and HDRI from Poly Haven (polyhaven.com)
    new THREE.TextureLoader().load(ASSET + 'hdr/reading_room_1k.jpg', function (t) {   // reflections from a real reading room (panorama)
      try { t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding; var pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose(); } catch (e) { /* keep the fallback */ }
    });

    /* ---------- post: a soft roll-off and the painting's muted, warm grade (no bloom) ---------- */
    var composer = null, bloom = null, finalPass = null, ssao = null, plainPass = null;
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass && THREE.ShaderPass) {
      composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType }));
      ssao = THREE.SSAOPass ? new THREE.SSAOPass(scene, camera, 2, 2) : null;
      if (ssao) {
        ssao.kernelRadius = .12; ssao.minDistance = .00005; ssao.maxDistance = .004;     // contact shadows within ~25 cm
        ssao.beautyRenderTarget.texture.type = THREE.HalfFloatType;                       // no banding in the dark corners
        ssao.blurMaterial.fragmentShader = ssao.blurMaterial.fragmentShader.replace('vec3( result / ( 5.0 * 5.0 ) )', 'vec3( mix( 1.0, result / ( 5.0 * 5.0 ), .6 ) )');   // gentle, not sooty
        var aoHide = [], baseOverride = ssao.renderOverride.bind(ssao);
        ssao.renderOverride = function (r, m, rt, cc, ca) {                               // glows and glass don't cast occlusion
          aoHide.length = 0; scene.traverse(function (o) { if (o.visible && (o.isSprite || o.isPoints || (o.material && o.material.transparent))) { aoHide.push(o); o.visible = false; } });
          baseOverride(r, m, rt, cc, ca); aoHide.forEach(function (o) { o.visible = true; });
        };
        composer.addPass(ssao);
      } else composer.addPass(new THREE.RenderPass(scene, camera));
      if (ssao) { plainPass = new THREE.RenderPass(scene, camera); plainPass.enabled = false; composer.insertPass(plainPass, 0); }   // used instead when quality is Light
            finalPass = new THREE.ShaderPass({
        uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform sampler2D tDiffuse; uniform float exposure; uniform float time; uniform vec2 res; varying vec2 vUv;',
                    'vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }',
          'void main(){',
          '  vec3 c = toSRGB(1. - exp(-texture2D(tDiffuse, vUv).rgb * exposure));',
          '  float y = dot(c, vec3(.3, .59, .11));',
          '  c = mix(vec3(y), c, .82);',                                            // muted colour, like the painting
          '  c = c * .93 + vec3(.040, .022, .012);',                                // warm, lifted shadows
          '  c *= vec3(1.05, .975, .93);',
          '  float v = smoothstep(1.05, .3, length((vUv - .5) * vec2(1.1, 1.0)));',
          '  c *= mix(.72, 1., v);',
          '  gl_FragColor = vec4(c, 1.);',
          '}'
        ].join('\n')
      });
      composer.addPass(finalPass);
    } else { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputEncoding = THREE.sRGBEncoding; }

    /* ---------- helpers (everything extra-rounded) ---------- */
    var tag = null, RB = THREE.RoundedBoxGeometry;
    var matCache = {};
    function mat(c, o) {
      var key = null; if (typeof c === 'string') { key = c; if (o) { for (var ok in o) { var ov = o[ok]; if (ov !== null && typeof ov === 'object') { key = null; break; } key += '|' + ok + ':' + ov; } } }
      if (key && matCache[key]) return matCache[key];
      var m = mat0(c, o); if (key) matCache[key] = m; return m;
    }
    function mat0(c, o) { var env = o && o.env; if (o && 'env' in o) { o = Object.assign({}, o); delete o.env; } var m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .7, metalness: 0 }, o)); if (env != null) m.userData.env = env; return m; }
    function add(mesh, parent, cast) { mesh.castShadow = cast !== false; mesh.receiveShadow = true; if (tag) mesh.userData.hot = tag; if (!parent) mesh.userData.mergeable = true; (parent || scene).add(mesh); return mesh; }
    var boxCache = {};
    function geoBox(w, h, d, r) {
      var k = [w, h, d, r].join(','); if (boxCache[k]) return boxCache[k];
      var mn = Math.min(w, h, d), segs = mn < .08 ? 1 : mn < .3 ? 2 : 3;
      return boxCache[k] = RB ? new RB(w, h, d, segs, Math.min((r || .1) * .4, mn * .3)) : new THREE.BoxGeometry(w, h, d);
    }
    function box(w, h, d, m, x, y, z, parent, cast, r) { m = Array.isArray(m) || m.isMaterial ? m : mat(m); var bg = geoBox(w, h, d, r); if (m.userData && m.userData.metric) bg = metricUV(bg.clone(), m.userData.metric, m.userData.grainV, x * 3.1 + y * 1.7 + z * 2.3); var mesh = new THREE.Mesh(bg, m); mesh.position.set(x, y, z); return add(mesh, parent, cast); }
    function flat(w, h, d, m, x, y, z, parent, cast) { m = m.isMaterial ? m : mat(m); var fg = new THREE.BoxGeometry(w, h, d); if (m.userData.metric) metricUV(fg, m.userData.metric, m.userData.grainV, x * 3.1 + y * 1.7 + z * 2.3); var mesh = new THREE.Mesh(fg, m); mesh.position.set(x, y, z); return add(mesh, parent, cast === true); }
    function cyl(rt, rb, h, m, x, y, z, seg, parent) { m = m.isMaterial ? m : mat(m); var cg = new THREE.CylinderGeometry(rt, rb, h, seg || 32); if (m.userData.metric) metricCylUV(cg, (rt + rb) / 2, h, m.userData.metric, m.userData.grainV); var mesh = new THREE.Mesh(cg, m); mesh.position.set(x, y, z); return add(mesh, parent); }
    var ballCache = {};
    function ball(r, m, x, y, z, sx, sy, sz, parent) { var mesh = new THREE.Mesh(ballCache[r] || (ballCache[r] = new THREE.SphereGeometry(r, 24, 14)), m.isMaterial ? m : mat(m)); mesh.position.set(x, y, z); mesh.scale.set(sx || 1, sy || 1, sz || 1); return add(mesh, parent); }
    function capsule(r, len, m, x, y, z, parent) { var g = THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(r, len, 8, 16) : new THREE.CylinderGeometry(r, r, len + 2 * r, 16); var mesh = new THREE.Mesh(g, m.isMaterial ? m : mat(m)); mesh.position.set(x, y, z); return add(mesh, parent); }
    function rod(a, b, r, m, parent) { var dir = new THREE.Vector3().subVectors(b, a), len = dir.length(); var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m.isMaterial ? m : mat(m)); mesh.position.copy(a).addScaledVector(dir, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); return add(mesh, parent); }
    function canvasTex(w, h, draw, linear) { var c = document.createElement('canvas'); c.width = w; c.height = h; var t0 = performance.now(); draw(c.getContext('2d'), w, h); if (window.__ct) window.__ct.push([w + 'x' + h, Math.round(performance.now() - t0)]); var t = new THREE.CanvasTexture(c); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (!linear) t.encoding = THREE.sRGBEncoding; t.userData = { canvas: c, draw: draw }; return t; }
    function redraw(t) { var d = t.userData; d.draw(d.canvas.getContext('2d'), d.canvas.width, d.canvas.height); t.needsUpdate = true; }
    var glowTex = canvasTex(64, 64, function (x, w) { var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }, true);
    function glow(color, size, x, y, z, op) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: op == null ? .5 : op, fog: false })); s.scale.set(size, size, 1); s.position.set(x, y, z); scene.add(s); return s; }
    function spriteSet(n, draw, size) { var tex = canvasTex(64, 64, draw), arr = []; for (var k = 0; k < n; k++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); sp.scale.set(size, size, 1); sp.userData.t = k / n; scene.add(sp); arr.push(sp); } return arr; }
    function emissive(col, i) { return new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: i || 3, roughness: .4 }); }

    /* ---------- scanned materials: real wood grain, weave and pile, with normal and roughness maps ---------- */
    var texLoader = new THREE.TextureLoader(), pbrCache = {};
    var TEXMEAN = { dark_wood: '#5C2A17', wood_table_001: '#3D190A', old_wooden_floor_02: '#51300B', wool_boucle: '#756C60', curly_teddy_natural: '#E8D2BB', velour_velvet: '#AD2D47', brown_leather: '#502D0F' };
    function pbrSet(name) {
      if (pbrCache[name]) return pbrCache[name];
      function ld(kind, srgb) { var t = texLoader.load(ASSET + 'tex/' + name + '_' + kind + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (srgb) t.encoding = THREE.sRGBEncoding; return t; }
      return pbrCache[name] = { map: ld('diff', true), normalMap: ld('nor'), roughnessMap: ld('rough') };
    }
    function tintFor(name, base) { var c = new THREE.Color(base), m = new THREE.Color(TEXMEAN[name]); return new THREE.Color(Math.min(2.5, c.r / m.r), Math.min(2.5, c.g / m.g), Math.min(2.5, c.b / m.b)); }
    function pbrMat(name, base, o) {                 // o.tile: metres per texture repeat (boxes get real-size UVs); o.grainV: the texture's grain runs vertically
      o = o || {}; var st = pbrSet(name), ns = o.normal == null ? 1 : o.normal;
      var m = new THREE.MeshStandardMaterial({ color: base ? tintFor(name, base) : new THREE.Color(o.gain || 1, o.gain || 1, o.gain || 1), map: o.noMap ? null : st.map, normalMap: st.normalMap, normalScale: new THREE.Vector2(ns, ns), roughnessMap: o.flatRough ? null : st.roughnessMap, roughness: o.roughness == null ? 1 : o.roughness });
      if (o.env != null) m.userData.env = o.env;
      if (o.tile) { m.userData.metric = o.tile; m.userData.grainV = !!o.grainV; }
      return m;
    }
    function metricUV(geo, tile, grainV, seed) {     // UVs in metres, with u along each face's longer side so grain follows the board
      var p = geo.attributes.position, n = geo.attributes.normal; geo.computeBoundingBox();
      var bb = geo.boundingBox, ext = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z], ox = Math.abs(seed * 7.31) % 1, oy = Math.abs(seed * 3.77) % 1, out = new Float32Array(p.count * 2);
      for (var i = 0; i < p.count; i++) {
        var ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), k = ax > ay && ax > az ? 0 : ay > az ? 1 : 2;
        var a = k === 0 ? 1 : 0, b = k === 2 ? 1 : 2; if (ext[b] > ext[a]) { var t = a; a = b; b = t; }
        var P = [p.getX(i), p.getY(i), p.getZ(i)], u = P[a] / tile + ox, v = P[b] / tile + oy;
        out[i * 2] = grainV ? v : u; out[i * 2 + 1] = grainV ? u : v;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(out, 2)); return geo;
    }
    function metricCylUV(geo, r, h, tile, grainV) {  // turned parts: grain runs along the length
      var uv = geo.attributes.uv, circ = 2 * Math.PI * r;
      for (var i = 0; i < uv.count; i++) { var u = uv.getX(i) * circ / tile, v = uv.getY(i) * h / tile; uv.setXY(i, grainV ? u : v, grainV ? v : u); }
      return geo;
    }
    var gltfLoader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null, gltfCache = {};
    function model(name, parent, o) {                // a CC0 model, placed like any other prop; clicks reach it through the current tag
      o = o || {}; var g = new THREE.Group(), hot = tag; g.position.set(o.x || 0, o.y || 0, o.z || 0); g.rotation.y = o.ry || 0; g.scale.setScalar(o.s || 1); (parent || scene).add(g);
      if (!gltfLoader) return g;
      if (!gltfCache[name]) gltfCache[name] = new Promise(function (res, rej) { gltfLoader.load(ASSET + 'models/' + name + '/' + name + '.json', function (gl) { res(gl.scene); }, undefined, rej); });
      gltfCache[name].then(function (src) {
        var m = src.clone(true);
        m.traverse(function (c) {
          if (!c.isMesh) return; c.castShadow = true; c.receiveShadow = true; if (hot) c.userData.hot = hot;
          if (o.tint && (!o.tintOnly || o.tintOnly.test(c.material.name))) { c.material = c.material.clone(); c.material.color.set(o.tint); }
          if (envMats.indexOf(c.material) < 0) { c.material.userData.env = o.env == null ? .5 : o.env; envMats.push(c.material); }
        });
        g.add(m);
      }).catch(function () { /* the room still works without it */ });
      return g;
    }
    // sculpted shapes: a signed-distance description is turned into one smooth surface (no seams between parts)
    function sdEll(x, y, z, cx, cy, cz, rx, ry, rz) { var px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz, k0 = Math.sqrt(px * px + py * py + pz * pz), k1 = Math.sqrt(px * px / (rx * rx) + py * py / (ry * ry) + pz * pz / (rz * rz)); return k1 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); }
    function sdCap(x, y, z, a, b, ra, rb) { var pax = x - a[0], pay = y - a[1], paz = z - a[2], bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz))); return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h); }
    function smin(a, b, k) { var h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
    function furCoat(mesh, len, shells, density) {     // a soft coat: layered shells, each keeping fewer and thinner strand tips
      for (var i = 1; i <= shells; i++) (function (h) {
        var m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
        m.onBeforeCompile = function (sh) {
          sh.uniforms.uFur = { value: len * h }; sh.uniforms.uH = { value: h }; sh.uniforms.uDen = { value: density };
          sh.vertexShader = 'uniform float uFur;\nvarying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\ntransformed += normalize(objectNormal) * uFur;');
          sh.fragmentShader = 'uniform float uH;\nuniform float uDen;\nvarying vec3 vObj;\n' + sh.fragmentShader.replace('#include <color_fragment>', [
            '#include <color_fragment>',
            'vec3 cellP = vObj * uDen; vec3 cid = floor(cellP); vec3 cf = fract(cellP) - .5;',
            'float rnd = fract(sin(dot(cid, vec3(12.9898, 78.233, 37.719))) * 43758.5453);',
            'if (rnd < uH * .85 || length(cf) > (1. - uH) * .62) discard;',
            'diffuseColor.rgb *= mix(.78, 1.06, uH);'].join('\n'));
        };
        var shell = new THREE.Mesh(mesh.geometry, m); shell.castShadow = false; shell.receiveShadow = true; shell.userData.noMerge = true; shell.userData.noPick = true; mesh.add(shell);
      })(i / shells);
    }
    function sculpt(sdf, cx, cy, cz, half, res, material, colorAt) {
      if (!THREE.MarchingCubes) return new THREE.Mesh(new THREE.SphereGeometry(half * .5, 24, 16), material);
      var mc = new THREE.MarchingCubes(res, material, false, false, 90000), f = mc.field, hs = res / 2;
      for (var k = 0; k < res; k++) for (var j = 0; j < res; j++) for (var i = 0; i < res; i++) f[i + j * res + k * res * res] = -sdf(cx + (i - hs) / hs * half, cy + (j - hs) / hs * half, cz + (k - hs) / hs * half);
      mc.isolation = 0; mc.update();
      var n = mc.count, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), src = mc.geometry.attributes.position.array, srcN = mc.geometry.attributes.normal.array;
      for (var q = 0; q < n; q++) { pos[q * 3] = cx + src[q * 3] * half; pos[q * 3 + 1] = cy + src[q * 3 + 1] * half; pos[q * 3 + 2] = cz + src[q * 3 + 2] * half; var l = Math.hypot(srcN[q * 3], srcN[q * 3 + 1], srcN[q * 3 + 2]) || 1; nor[q * 3] = srcN[q * 3] / l; nor[q * 3 + 1] = srcN[q * 3 + 1] / l; nor[q * 3 + 2] = srcN[q * 3 + 2] / l; }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      if (colorAt) { var cols = new Float32Array(n * 3), c = new THREE.Color(); for (var v = 0; v < n; v++) { colorAt(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], c); cols[v * 3] = c.r; cols[v * 3 + 1] = c.g; cols[v * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); }
      mc.geometry.dispose();
      var mesh = new THREE.Mesh(geo, material); mesh.userData.noMerge = true; return mesh;
    }

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
            x.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0' : '255,220,170') + ',' + (bump ? 0 : .05 + r() * .17) + ')'; x.fillRect(0, q * ph2, w, ph2);
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
      o = o || {}; var tex = o.tex || 'dark_wood';
      return pbrMat(tex, o.raw ? null : base, { tile: o.tile || .8, grainV: tex === 'wood_table_001', env: o.env == null ? .45 : o.env, gain: o.gain, flatRough: o.roughness != null, roughness: o.roughness });
    }

    function muted(hex, sat, lum) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255, y = .3 * r + .59 * g + .11 * b; function f(c) { return Math.max(0, Math.min(255, Math.round((y + (c - y) * sat) * lum))); } return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1); }
    /* ---------- palette: deep, warm, a little worn ---------- */
    var shelfM = woodMat('#4A2C1C', { seed: 3, roughness: .45, bumpScale: .07, contrast: .6, lines: 110 }), shelfDark = woodMat('#33200F', { seed: 5, roughness: .5, bumpScale: .05, contrast: .4, lines: 70 }), shelfBack = mat('#241811', { roughness: .95 });
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
    var floorM = pbrMat('old_wooden_floor_02', '#5E3C26', { env: .35 }); floorM.roughness = 1;
    var wallTex = canvasTex(512, 512, function (x, w, h) {
      var sd = 91; function r() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
      x.fillStyle = '#4A382C'; x.fillRect(0, 0, w, h);
      for (var b = 0; b < 140; b++) { var gx = r() * w, gy = r() * h, gr = x.createRadialGradient(gx, gy, 0, gx, gy, 40 + r() * 90); gr.addColorStop(0, r() < .5 ? 'rgba(20,10,4,.13)' : 'rgba(255,214,170,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }
      for (var k = 0; k < 9000; k++) { x.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0' : '255,225,190') + ',' + (.015 + r() * .04) + ')'; x.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
      x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 1; for (var q = 0; q < 14; q++) { x.beginPath(); var px = r() * w, py = r() * h; x.moveTo(px, py); x.bezierCurveTo(px + 30 * (r() - .5), py + 40, px + 30 * (r() - .5), py + 80, px + 20 * (r() - .5), py + 120 * r()); x.stroke(); }
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(3, 2);
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
    var SKY = { morning: ['#71739E', '#7979A4', '#9381A8', '#CA8FA3', '#D89099', '#B57972'], day: ['#6B7AB8', '#7581BE', '#8C89C3', '#BF98BD', '#DD9BAB', '#C1847D'], golden: ['#636597', '#6B6B9B', '#80729F', '#B17E9A', '#BA7A85', '#9B655C'], night: ['#373967', '#3B3C6A', '#48406E', '#63476A', '#835666', '#7E534F'] };   // sampled from the painting's windows
    var TREES = { morning: ['#8E6F88', '#5E4A62', '#3C3145'], day: ['#8D7396', '#5C4E72', '#3A3350'], golden: ['#74566F', '#4A374F', '#2C2233'], night: ['#4A3A58', '#2E2540', '#1B1628'] };
    var skyTod = (function (h) { return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'golden' : 'night'; })(new Date().getHours());   // draw the right sky the first time
    var skyTex = canvasTex(1024, 720, function (x, w, h) {
      var c = SKY[skyTod], g = x.createLinearGradient(0, 0, 0, h);
      c.forEach(function (col, i) { g.addColorStop(i / (c.length - 1), col); });
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      var sd = 11; function rr() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
      if (skyTod === 'night') { x.fillStyle = '#F3E7D8'; for (var k = 0; k < 70; k++) { x.globalAlpha = .2 + (k % 5) / 12; x.beginPath(); x.arc(rr() * w, rr() * h * .5, .6 + rr() * .9, 0, 7); x.fill(); } x.globalAlpha = 1; }
      x.fillStyle = 'rgba(255,214,205,.10)'; if ('filter' in x) x.filter = 'blur(9px)';        // thin streaks of cloud
      for (var cl = 0; cl < 8; cl++) { x.beginPath(); x.ellipse(rr() * w, h * (.22 + rr() * .34), 90 + rr() * 150, 4 + rr() * 8, 0, 0, 7); x.fill(); }
      if ('filter' in x) x.filter = 'none';
      // painted trees: a trunk, forking boughs, and crowns made of many small leaf dabs so the edges stay lacy against the sky
      var T = TREES[skyTod];
      function dabs(cx, cy, rx, ry, n, size) { for (var i = 0; i < n; i++) { var a = rr() * 6.283, d = Math.sqrt(rr()), px = cx + Math.cos(a) * d * rx, py = cy + Math.sin(a) * d * ry; x.beginPath(); x.ellipse(px, py, size * (.6 + rr() * .9), size * (.35 + rr() * .5), rr() * 3, 0, 7); x.fill(); } }
      function bough(x0, y0, ang, len, wid, depth, leaf) {
        var x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
        x.lineWidth = wid; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2 + (rr() - .5) * len * .25, (y0 + y1) / 2, x1, y1); x.stroke();
        if (depth <= 0) { dabs(x1, y1, leaf * 1.5, leaf * 1.15, Math.round(leaf * 6), Math.max(2.2, leaf * .13)); return; }
        var n = 2 + (rr() > .6 ? 1 : 0); for (var b = 0; b < n; b++) bough(x1, y1, ang + (b - (n - 1) / 2) * .72 + (rr() - .5) * .35, len * (.62 + rr() * .16), wid * .62, depth - 1, leaf);
      }
      function tree(cx, base, height, color, leaf) { x.fillStyle = x.strokeStyle = color; bough(cx, base, -Math.PI / 2 + (rr() - .5) * .12, height * .34, height * .05, 4, leaf); }
      for (var f = 0; f < 15; f++) tree(f / 14 * w + (rr() - .5) * 40, h * .9, h * (.24 + rr() * .08), T[0], 22);
      x.fillStyle = T[0]; x.fillRect(0, h * .8, w, h * .2);
      for (var f2 = 0; f2 < 8; f2++) tree(f2 / 7 * w + (rr() - .5) * 70, h * 1.0, h * (.36 + rr() * .12), T[1], 30);
      x.fillStyle = T[1]; x.fillRect(0, h * .9, w, h * .1);
      tree(-w * .02, h * 1.08, h * .92, T[2], 50); tree(w * 1.02, h * 1.08, h * .96, T[2], 50); tree(w * .66, h * 1.08, h * .56, T[2], 34); tree(w * .3, h * 1.08, h * .5, T[2], 30);
    });

    mark('textures');
    /* ---------- the hall ---------- */
    var X = 5, Z0 = -8, Z1 = 4, HH = 5.6, ZC = (Z0 + Z1) / 2, ZL = Z1 - Z0;
    var floor = new THREE.Mesh(metricUV(new THREE.BoxGeometry(2 * X + .4, .2, ZL + .4), 2.4, false, 0), floorM); floor.position.set(0, -.1, ZC); add(floor, null, false);
    var wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: .95 });
    flat(2 * X + .4, HH + .2, .2, wallM, 0, HH / 2, Z0 - .1); flat(2 * X + .4, HH + .2, .2, wallM, 0, HH / 2, Z1 + .1);
    flat(.2, HH + .2, ZL + .4, wallM, -X - .1, HH / 2, ZC); flat(.2, HH + .2, ZL + .4, wallM, X + .1, HH / 2, ZC);
    var ceil = new THREE.Mesh(new THREE.BoxGeometry(2 * X + .4, .2, ZL + .4), new THREE.MeshBasicMaterial({ map: ceilTex, fog: false })); ceil.position.set(0, HH + .1, ZC); scene.add(ceil);
    for (var bz = Z0 + 1.5; bz < Z1; bz += 3) box(2 * X, .24, .3, shelfDark, 0, HH - .12, bz, null, false, .04);           // dark oak beams
    /* ---------- woven rugs: borders, medallions, fringe, worn pile ---------- */
    function rugTex(P, w, h) {
      return canvasTex(w, h, function (x, w, h) {
        var DW = w, DH = h, sc = w / 512; x.save(); x.scale(sc, sc); w = 512; h = h / sc;
        var sd = P.seed; function r() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
        var f = 18; x.clearRect(0, 0, w, h);
        x.strokeStyle = '#E4D8BE'; x.lineWidth = 2; for (var i = 3; i < w; i += 5) { [[f + 3, 1 + r() * 4], [h - f - 3, h - 1 - r() * 4]].forEach(function (e) { x.beginPath(); x.moveTo(i, e[0]); x.lineTo(i + (r() - .5) * 4, e[1]); x.stroke(); }); }
        var y0 = f, y1 = h - f, W = w, H = y1 - y0;
        x.fillStyle = P.border; x.fillRect(0, y0, W, H);
        x.fillStyle = P.trim; x.fillRect(8, y0 + 8, W - 16, 3); x.fillRect(8, y1 - 11, W - 16, 3); x.fillRect(8, y0 + 8, 3, H - 16); x.fillRect(W - 11, y0 + 8, 3, H - 16);
        var m = 34; x.fillStyle = P.field; x.fillRect(m, y0 + m, W - 2 * m, H - 2 * m);
        x.strokeStyle = P.accent; x.lineWidth = 2; x.strokeRect(m, y0 + m, W - 2 * m, H - 2 * m); x.strokeRect(m + 6, y0 + m + 6, W - 2 * m - 12, H - 2 * m - 12);
        for (var bx = 26; bx < W - 20; bx += 26) { [y0 + 21, y1 - 21].forEach(function (by) { x.fillStyle = P.accent; x.beginPath(); x.moveTo(bx, by - 7); x.lineTo(bx + 7, by); x.lineTo(bx, by + 7); x.lineTo(bx - 7, by); x.fill(); x.fillStyle = P.blush; x.beginPath(); x.arc(bx, by, 2.4, 0, 7); x.fill(); }); }
        for (var by2 = y0 + 46; by2 < y1 - 40; by2 += 26) { [21, W - 21].forEach(function (bx2) { x.fillStyle = P.accent; x.beginPath(); x.moveTo(bx2, by2 - 7); x.lineTo(bx2 + 7, by2); x.lineTo(bx2, by2 + 7); x.lineTo(bx2 - 7, by2); x.fill(); x.fillStyle = P.blush; x.beginPath(); x.arc(bx2, by2, 2.4, 0, 7); x.fill(); }); }
        var cx = W / 2, cy = (y0 + y1) / 2, mw = W * .3, mh = Math.min(H * .22, mw * 1.4);
        x.globalAlpha = .55; x.strokeStyle = P.accent; x.lineWidth = 1.2; for (var gx = m + 24; gx < W - m; gx += 30) for (var gy = y0 + m + 24; gy < y1 - m; gy += 30) { x.beginPath(); x.moveTo(gx, gy - 6); x.lineTo(gx + 6, gy); x.lineTo(gx, gy + 6); x.lineTo(gx - 6, gy); x.closePath(); x.stroke(); } x.globalAlpha = 1;
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) { x.fillStyle = P.border; x.beginPath(); x.moveTo(q[0] > 0 ? W - m - 6 : m + 6, q[1] > 0 ? y1 - m - 6 : y0 + m + 6); x.arc(q[0] > 0 ? W - m - 6 : m + 6, q[1] > 0 ? y1 - m - 6 : y0 + m + 6, W * .17, 0, 7); x.globalAlpha = .55; x.fill(); x.globalAlpha = 1; });
        x.fillStyle = P.border; x.beginPath(); x.moveTo(cx, cy - mh * 1.5); x.lineTo(cx + mw * 1.15, cy); x.lineTo(cx, cy + mh * 1.5); x.lineTo(cx - mw * 1.15, cy); x.fill();
        x.strokeStyle = P.accent; x.lineWidth = 3; x.stroke();
        x.fillStyle = P.trim; x.beginPath(); x.moveTo(cx, cy - mh); x.lineTo(cx + mw * .75, cy); x.lineTo(cx, cy + mh); x.lineTo(cx - mw * .75, cy); x.fill();
        x.fillStyle = P.field; x.beginPath(); x.moveTo(cx, cy - mh * .6); x.lineTo(cx + mw * .42, cy); x.lineTo(cx, cy + mh * .6); x.lineTo(cx - mw * .42, cy); x.fill();
        for (var pt = 0; pt < 8; pt++) { var pa = pt / 8 * 6.283; x.fillStyle = pt % 2 ? P.blush : P.accent; x.beginPath(); x.ellipse(cx + Math.cos(pa) * mw * .22, cy + Math.sin(pa) * mh * .36, 7, 4, pa, 0, 7); x.fill(); }
        x.fillStyle = P.blush; x.beginPath(); x.arc(cx, cy, 8, 0, 7); x.fill();
        x.restore(); for (var k = 0; k < DW * DH / 60; k++) { x.fillStyle = r() < .5 ? 'rgba(0,0,0,' + (.03 + r() * .06) + ')' : 'rgba(255,235,205,' + (.025 + r() * .05) + ')'; x.fillRect(r() * DW, f * sc + r() * (DH - 2 * f * sc), 1, 1 + (r() < .3 ? 1 : 0)); }
      });
    }
    function rug(cx, cz, wid, len, rot, P, hh) {
      P = Object.assign({}, P); ['field', 'border', 'accent', 'trim', 'blush'].forEach(function (k) { P[k] = muted(P[k], .42, .62); });
      var t = rugTex(P, 768, Math.round(768 * len / wid));
      var m = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: .55, roughness: 1, alphaTest: .5 }));
      m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, rot, 0); m.position.set(cx, .012 + (hh || 0), cz); m.receiveShadow = true; m.userData.noPick = true; scene.add(m); return m;
    }
    rug(.1, -.8, 3.1, 4.3, .04, { field: '#5A1E26', border: '#1F2A44', accent: '#C9A55C', trim: '#E8D7B5', blush: '#DDA7AB', seed: 41 });
    rug(-.15, -5.0, 2.4, 3.1, -.07, { field: '#2F4552', border: '#6B2E36', accent: '#CDAE6A', trim: '#E4D5B2', blush: '#E0AEB0', seed: 77 });

    /* ---------- books: many different bindings (leather with raised bands, gilt cloth, paperbacks, half-bound...), instanced ---------- */
    var PAL = ['#2C3A55', '#5A2A2E', '#3B4A3C', '#6B4A32', '#8A6A45', '#C9B48C', '#6B4A32', '#4A2B3A', '#7A5A3A', '#2E2A2A', '#9A7B4F', '#D8C7A5', '#40506A', '#6E3B34', '#7A5A3A'].map(function (c) { return muted(c, .62, .92); });
    function spineCanvas(design, base, seed) {
      return canvasTex(96, 384, function (x, w, h) {
        var sd = seed; function r() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
        var gilt = '#CDA85E', cream = '#E6D8B6', B = new THREE.Color(base), dk = B.clone().multiplyScalar(.6).getStyle(), mid = B.clone().multiplyScalar(.85).getStyle(), lt = B.clone().lerp(new THREE.Color('#FFF1D8'), .2).getStyle();
        x.fillStyle = base; x.fillRect(0, 0, w, h);
        var gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(.22, 'rgba(255,240,210,.14)'); gr.addColorStop(.5, 'rgba(255,240,210,.07)'); gr.addColorStop(.82, 'rgba(0,0,0,.14)'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
        var leather = design === 0 || design === 3 || design === 5;
        if (design === 3) { x.fillStyle = dk; x.fillRect(0, h * .6, w, h * .4); x.fillStyle = mid; for (var mb = 0; mb < 26; mb++) { x.globalAlpha = .35; x.beginPath(); x.ellipse(r() * w, r() * h * .6, 4 + r() * 18, 2 + r() * 5, r() * 3, 0, 7); x.fill(); } x.globalAlpha = 1; }
        for (var k = 0; k < (leather ? 2600 : 900); k++) { x.fillStyle = r() < .5 ? 'rgba(0,0,0,' + (.04 + r() * .08) + ')' : 'rgba(255,235,200,' + (.03 + r() * .06) + ')'; if (leather) x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); else { x.fillRect(r() * w, r() * h, 1, 2 + r() * 6); } }
        if (!leather) { x.strokeStyle = 'rgba(0,0,0,.05)'; for (var ln = 0; ln < h; ln += 3) { x.beginPath(); x.moveTo(0, ln); x.lineTo(w, ln); x.stroke(); } }
        function line(y, th, col) { x.fillStyle = col || gilt; x.fillRect(6, y, w - 12, th); }
        function band(y) { var bg = x.createLinearGradient(0, y, 0, y + 14); bg.addColorStop(0, lt); bg.addColorStop(.5, base); bg.addColorStop(1, dk); x.fillStyle = bg; x.fillRect(0, y, w, 14); x.fillStyle = gilt; x.fillRect(4, y - 2, w - 8, 1.5); x.fillRect(4, y + 15, w - 8, 1.5); }
        function label(y, hh, col) { x.fillStyle = col; x.fillRect(12, y, w - 24, hh); x.strokeStyle = gilt; x.lineWidth = 1.5; x.strokeRect(14, y + 2, w - 28, hh - 4); x.fillStyle = col === cream ? '#3A2A22' : gilt; var nl = 2 + Math.floor(r() * 2); for (var q = 0; q < nl; q++) { var lw = (w - 44) * (.45 + r() * .5); x.fillRect((w - lw) / 2, y + 10 + q * ((hh - 20) / nl), lw, 3); } }
        function ornament(cy) { x.fillStyle = gilt; x.beginPath(); x.moveTo(w / 2, cy - 9); x.lineTo(w / 2 + 6, cy); x.lineTo(w / 2, cy + 9); x.lineTo(w / 2 - 6, cy); x.fill(); x.fillRect(w / 2 - 14, cy - 1, 28, 2); }
        if (design === 0) { line(22, 2); line(28, 1.5); [74, 140, 206, 272].forEach(band); label(88, 44, dk); ornament(176); ornament(240); ornament(310); line(h - 30, 1.5); line(h - 24, 2); }
        else if (design === 1) { line(20, 3); line(28, 1.5); label(60, 130, dk); x.fillStyle = gilt; for (var t = 0; t < 4; t++) { var tw = (w - 40) * (.4 + r() * .5); x.fillRect((w - tw) / 2, 84 + t * 24, tw, 4); } x.beginPath(); x.arc(w / 2, 230, 8, 0, 7); x.fill(); line(h - 40, 1.5); line(h - 32, 3); }
        else if (design === 2) { x.fillStyle = cream; x.fillRect(0, 110, w, 130); x.fillStyle = '#2B2321'; for (var t2 = 0; t2 < 5; t2++) { var tw2 = (w - 30) * (.4 + r() * .5); x.fillRect((w - tw2) / 2, 128 + t2 * 20, tw2, 6); } x.fillStyle = dk; x.beginPath(); x.arc(w / 2, h - 46, 11, 0, 7); x.fill(); x.fillStyle = cream; x.fillRect(w / 2 - 4, h - 50, 8, 8); }
        else if (design === 3) { line(h * .6 - 3, 2); line(24, 1.5); label(60, 96, cream); [h * .6 + 20, h * .6 + 46].forEach(function (yy) { line(yy, 1.5); }); ornament(h * .6 + 100); }
        else if (design === 4) { x.fillStyle = cream; x.fillRect(14, 46 + r() * 20, w - 28, 66); x.fillStyle = '#3A2A22'; x.fillRect(22, 62 + r() * 8, w - 44, 4); x.fillRect(28, 76 + r() * 8, w - 56, 3); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, h - 36, w, 36); }
        else { [60, 112, 164, 216, 268, 320].forEach(band); label(76, 28, '#6A1F22'); label(180, 28, '#1F3A2E'); ornament(142); ornament(294); line(18, 2); line(h - 20, 2); }
        x.fillStyle = 'rgba(255,240,215,.1)'; x.fillRect(0, 0, w, 20); x.fillRect(0, h - 20, w, 20);                 // rubbed corners
        for (var sc = 0; sc < 5; sc++) { x.strokeStyle = 'rgba(255,235,205,' + (.05 + r() * .08) + ')'; x.lineWidth = .8; x.beginPath(); var sx = r() * w, sy = r() * h; x.moveTo(sx, sy); x.lineTo(sx + (r() - .5) * 26, sy + r() * 30); x.stroke(); }
        x.fillStyle = gr; x.fillRect(0, 0, w, h);
      });
    }
    function coverCanvas(base, seed) {
      return canvasTex(256, 96, function (x, w, h) {
        var sd = seed; function r() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
        x.fillStyle = base; x.fillRect(0, 0, w, h);
        for (var k = 0; k < 1400; k++) { x.fillStyle = r() < .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,235,200,.07)'; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
        x.strokeStyle = '#CDA85E'; x.lineWidth = 2; x.strokeRect(10, 10, w - 20, h - 20); x.lineWidth = 1; x.strokeRect(16, 16, w - 32, h - 32);
        x.fillStyle = '#CDA85E'; x.fillRect(w * .3, h * .42, w * .4, 4); x.fillRect(w * .38, h * .58, w * .24, 3);
        var gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,210,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      });
    }
    var SPINES = [[0, '#5A2A2E'], [0, '#2C3A55'], [0, '#3B4A3C'], [0, '#6B4A32'], [1, '#26324A'], [1, '#4A2B3A'], [1, '#6E3B34'], [2, '#D8C7A5'], [2, '#C9B48C'], [3, '#6E3B34'], [3, '#2E3B52'], [4, '#8A6A45'], [4, '#9A7B4F'], [5, '#40201F'], [5, '#243B2E'], [1, '#D9B3B0'], [4, '#E8D8C8'], [2, '#B98A8C'], [0, '#7A4B52'], [4, '#4A5A48']];
    var bookGeo = new RB(1, 1, 1, 2, .045), bookCap = 340;
    function mkBook(t, hot) { var m = new THREE.InstancedMesh(bookGeo, new THREE.MeshStandardMaterial({ map: t, normalMap: pbrSet('brown_leather').normalMap, normalScale: new THREE.Vector2(.45, .45), roughness: .62 }), bookCap); m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; m.userData.hot = 'library'; m.userData.n = 0; return m; }
    var uprights = SPINES.map(function (s, i) { return mkBook(spineCanvas(s[0], s[1], 17 + i * 53)); });
    var flatBooks = ['#4A2B3A', '#26324A', '#6B4A32', '#3B4A3C', '#D9B3B0', '#8A4A50'].map(function (c, i) { return mkBook(coverCanvas(c, 5 + i * 31)); });
    var bookMeshes = uprights.concat(flatBooks);
    var UPW = [], flatW = [];                                   // pick tables: blush / cream bindings are rarer
    SPINES.forEach(function (s, i) { var wgt = (s[1] === '#D9B3B0' || s[1] === '#E8D8C8' || s[1] === '#B98A8C') ? 1 : 3; for (var q = 0; q < wgt; q++) UPW.push(i); });
    var dummy = new THREE.Object3D(), col = new THREE.Color();
    function pickBook(list, wl) { for (var t = 0; t < 10; t++) { var m = list[wl ? wl[Math.floor(rnd() * wl.length)] : Math.floor(rnd() * list.length)]; if (m.userData.n < bookCap) return m; } return null; }
    function commit(m) { var v = .72 + rnd() * .32; m.setMatrixAt(m.userData.n, dummy.matrix); m.setColorAt(m.userData.n, col.setRGB(v, v * (.95 + rnd() * .05), v * (.9 + rnd() * .08))); m.userData.n++; }
    function putBook(axis, pos, y, fx, w, h, dp, lean) {
      var m = pickBook(uprights, UPW); if (!m) return;
      var al = Math.abs(lean), cy = y + h / 2 * Math.cos(al) + w / 2 * Math.sin(al), ds = (axis === 'x' ? -Math.sin(lean) : Math.sin(lean)) * h / 2;
      if (axis === 'x') { dummy.position.set(pos + ds, cy, fx); dummy.scale.set(w, h, dp); dummy.rotation.set(0, 0, lean); }
      else { dummy.position.set(fx, cy, pos + ds); dummy.scale.set(dp, h, w); dummy.rotation.set(lean, 0, 0); }
      dummy.updateMatrix(); commit(m);
    }
    function putFlats(axis, start, y, fx, n, len, dp) {
      var yy = y;
      for (var k = 0; k < n; k++) {
        var th = .035 + rnd() * .04, ln = len * (.82 + rnd() * .3), m = pickBook(flatBooks); if (!m) return;
        var pos = start + len / 2 + (rnd() - .5) * .04;
        if (axis === 'x') { dummy.position.set(pos, yy + th / 2, fx); dummy.scale.set(ln, th, dp); } else { dummy.position.set(fx, yy + th / 2, pos); dummy.scale.set(dp, th, ln); }
        dummy.rotation.set(0, (rnd() - .5) * .16, 0); dummy.updateMatrix(); commit(m); yy += th;
      }
      return yy;
    }

    /* ---------- soft contact shadows + flowers (instanced) + little shelf treasures ---------- */
    var blobTex = canvasTex(128, 128, function (x, w) { var g = x.createRadialGradient(64, 64, 6, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(.55, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }, true);
    function blob(x, z, sx, sz, op, rot) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: op, depthWrite: false, color: '#150B06' }));
      m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, rot || 0, 0); m.position.set(x, .032, z); m.userData.noPick = true; m.renderOrder = 2; scene.add(m); return m;
    }
    var FL = {}, flSphere = new THREE.SphereGeometry(1, 9, 6), flStem = new THREE.CylinderGeometry(1, 1, 1, 5, 1), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), Yup = new THREE.Vector3(0, 1, 0);
    function flMesh(key, color, geo, rough) {
      if (!FL[key]) { var m = new THREE.InstancedMesh(geo || flSphere, new THREE.MeshStandardMaterial({ color: color, roughness: rough || .7 }), 2600); m.castShadow = false; m.receiveShadow = false; m.count = 0; m.frustumCulled = false; m.userData.noPick = true; scene.add(m); FL[key] = m; }
      return FL[key];
    }
    function flPuff(g, key, color, x, y, z, sx, sy, sz, ry, rx) {                         // an instanced blob of petals/leaf, in g's local space
      var m = flMesh(key, color); tmpP.set(x, y, z); tmpS.set(sx, sy, sz); tmpQ.setFromEuler(new THREE.Euler(rx || 0, ry || 0, 0, 'YXZ'));
      tmpM.compose(tmpP, tmpQ, tmpS).premultiply(g.matrixWorld); m.setMatrixAt(m.count++, tmpM); m.instanceMatrix.needsUpdate = true;
    }
    function flStemTo(g, key, color, a, b, r) {
      var m = flMesh(key, color, flStem, .8), d = new THREE.Vector3().subVectors(b, a), L = d.length();
      tmpQ.setFromUnitVectors(Yup, d.normalize()); tmpP.copy(a).addScaledVector(d, L * .5); tmpS.set(r, L, r);
      tmpM.compose(tmpP, tmpQ, tmpS).premultiply(g.matrixWorld); m.setMatrixAt(m.count++, tmpM); m.instanceMatrix.needsUpdate = true;
    }
    var VASE = { cream: ['#EFE4D0', .26], blush: ['#E6BDBB', .3], sage: ['#AEB9A0', .35], glass: ['#CFE3E4', .08], bronze: ['#8A6A3A', .3] };
    var FBLOOM = { rose: [['#E9B5BC', '#DB97A4', '#F4D3D6'], .034], peony: [['#F1C6CE', '#E6A5B3', '#FBE0E3'], .05], cream: [['#F4EAD7', '#E7D8B9', '#FFF6E6'], .03], ranunc: [['#F6D2C0', '#EFB4A6', '#FFE6DA'], .03] };
    function flowerVase(parent, x, y, z, s, kind, vase, ry) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s || 1); g.rotation.y = ry || 0; (parent || scene).add(g); g.updateMatrixWorld(true);
      var vc = VASE[vase || 'cream'], tall = kind === 'lavender' || kind === 'dried';
      var prof = tall ? [[0, 0], [.04, 0], [.05, .03], [.048, .1], [.03, .16], [.028, .2], [.036, .215], [.03, .215], [0, .2]] : [[0, 0], [.05, 0], [.068, .05], [.062, .105], [.04, .15], [.044, .18], [.06, .195], [.052, .195], [0, .18]];
      var vm = new THREE.Mesh(new THREE.LatheGeometry(prof.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 32), mat(vc[0], { roughness: vc[1], env: .8, side: THREE.DoubleSide })); add(vm, g, true);
      var V3 = THREE.Vector3, top = tall ? .2 : .19, N = kind === 'bud' ? 3 : kind === 'peony' ? 5 : kind === 'rose' || kind === 'ranunc' ? 8 : kind === 'cream' ? 7 : 16;
      for (var i = 0; i < N; i++) {
        var a = i * 2.4 + rnd() * .4, d = (tall ? .01 : .02) + rnd() * (tall ? .05 : .075) + (i % 3) * .01, hy = top + (tall ? .22 + rnd() * .16 : .1 + rnd() * .12) - d * (tall ? .6 : 1.2), tip = new V3(Math.cos(a) * d, hy, Math.sin(a) * d);
        flStemTo(g, 'stem', '#4C6B42', new V3(Math.cos(a) * .008, top - .02, Math.sin(a) * .008), tip, .0028);
        if (kind === 'lavender') { for (var q = 0; q < 6; q++) flPuff(g, 'lav', '#8D7AB4', tip.x, tip.y - q * .012, tip.z, .006, .009, .006, 0); }
        else if (kind === 'dried') { flPuff(g, 'plume', '#E8D9BC', tip.x, tip.y + .02, tip.z, .009, .045, .009, 0); flPuff(g, 'plume2', '#CDB48C', tip.x, tip.y + .05, tip.z, .006, .03, .006, 0); }
        else {
          var B = FBLOOM[kind === 'bud' ? 'rose' : kind], r0 = B[1] * (.85 + rnd() * .3), np = kind === 'peony' ? 9 : kind === 'cream' ? 7 : 6, pk = 'b' + kind;
          for (var pp = 0; pp < np; pp++) { var pa = pp / np * 6.283 + rnd() * .35; flPuff(g, pk + '0', B[0][0], tip.x + Math.cos(pa) * r0 * .6, tip.y, tip.z + Math.sin(pa) * r0 * .6, r0 * .5, r0 * .16, r0 * .68, Math.PI / 2 - pa, -.5); }      // outer petals
          for (var pq = 0; pq < np - 2; pq++) { var qa = pq / (np - 2) * 6.283 + rnd() * .5; flPuff(g, pk + '1', B[0][1], tip.x + Math.cos(qa) * r0 * .3, tip.y + r0 * .22, tip.z + Math.sin(qa) * r0 * .3, r0 * .36, r0 * .14, r0 * .5, Math.PI / 2 - qa, -.95); }   // inner petals
          flPuff(g, pk + '2', B[0][2], tip.x, tip.y + r0 * .26, tip.z, r0 * .26, r0 * .26, r0 * .26, 0);                                                                                                                                                                  // heart
          if (i % 2) flPuff(g, 'leaf', '#3F6A3D', tip.x * .5, top + .06 + (i % 4) * .035, tip.z * .5, .045, .008, .018, a);
        }
      }
      return g;
    }
    var artTexes = [
      canvasTex(120, 150, function (x, w, h) { x.fillStyle = '#EFE4CB'; x.fillRect(0, 0, w, h); x.strokeStyle = '#5E7A4C'; x.lineWidth = 2; x.beginPath(); x.moveTo(60, 135); x.bezierCurveTo(55, 100, 70, 60, 58, 22); x.stroke(); for (var i = 0; i < 9; i++) { x.fillStyle = i % 3 === 2 ? '#E3A3B0' : '#6E8C5A'; x.beginPath(); x.ellipse(60 + (i % 2 ? 14 : -14), 38 + i * 11, 11, 4.5, i % 2 ? -.5 : .5, 0, 7); x.fill(); } x.fillStyle = '#E3A3B0'; x.beginPath(); x.arc(58, 20, 7, 0, 7); x.fill(); }),
      canvasTex(120, 150, function (x, w, h) { var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4A4A86'); g.addColorStop(.6, '#D98A98'); g.addColorStop(1, '#F2B880'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#2A2440'; x.beginPath(); x.moveTo(0, h); x.lineTo(0, 105); x.bezierCurveTo(30, 85, 60, 112, 90, 96); x.lineTo(w, 100); x.lineTo(w, h); x.fill(); }),
      canvasTex(120, 150, function (x, w, h) { x.fillStyle = '#E8DAC0'; x.fillRect(0, 0, w, h); x.fillStyle = '#2E2420'; x.beginPath(); x.ellipse(60, 70, 36, 46, 0, 0, 7); x.fill(); x.fillStyle = '#E8DAC0'; x.beginPath(); x.moveTo(52, 50); x.bezierCurveTo(70, 44, 80, 56, 74, 66); x.lineTo(70, 74); x.bezierCurveTo(76, 80, 70, 90, 60, 92); x.lineTo(54, 118); x.lineTo(40, 118); x.bezierCurveTo(44, 90, 44, 70, 52, 50); x.fill(); })
    ];
    var giltM = mat('#C9A24F', { metalness: .85, roughness: .35, env: 1 }), brassM = mat('#B88A3E', { metalness: .92, roughness: .3, env: 1.3 }), waxM = mat('#F1E6D0', { roughness: .6 });
    var globeTex = canvasTex(256, 128, function (x, w, h) { x.fillStyle = '#C9B58C'; x.fillRect(0, 0, w, h); x.fillStyle = '#7F9A86'; [[40, 40, 26, 16], [110, 60, 34, 22], [170, 36, 30, 14], [200, 84, 22, 14], [70, 96, 18, 10]].forEach(function (c) { x.beginPath(); x.ellipse(c[0], c[1], c[2], c[3], .3, 0, 7); x.fill(); }); x.strokeStyle = 'rgba(90,60,30,.35)'; for (var i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.stroke(); } });
    function putDecor(kind, wx, wy, wz, ry) {
      var g = new THREE.Group(); g.position.set(wx, wy, wz); g.rotation.y = ry; scene.add(g); g.updateMatrixWorld(true);
      if (kind === 0) { scene.remove(g); flowerVase(null, wx, wy, wz, .85 + rnd() * .3, ['rose', 'peony', 'cream', 'lavender', 'dried', 'ranunc'][Math.floor(rnd() * 6)], ['cream', 'blush', 'sage', 'bronze'][Math.floor(rnd() * 4)], ry); }
      else if (kind === 1) { var fw = .17 + rnd() * .06, fh = fw * 1.25, fr = new THREE.Group(); fr.position.set(0, fh / 2 + .01, -.05); fr.rotation.x = -.14; g.add(fr); box(fw, fh, .018, giltM, 0, 0, 0, fr, false, .01); var pm = new THREE.Mesh(new THREE.PlaneGeometry(fw - .04, fh - .04), new THREE.MeshStandardMaterial({ map: artTexes[Math.floor(rnd() * 3)], roughness: .8 })); pm.position.z = .0105; add(pm, fr, false); }
      else if (kind === 2) { cyl(.05, .06, .012, '#3A2416', 0, .006, 0, 24, g); cyl(.006, .006, .09, brassM, 0, .05, 0, 8, g); var gl = new THREE.Mesh(new THREE.SphereGeometry(.07, 24, 16), new THREE.MeshStandardMaterial({ map: globeTex, roughness: .5, envMapIntensity: .6 })); gl.position.y = .15; gl.rotation.z = .4; add(gl, g, true); var mr = new THREE.Mesh(new THREE.TorusGeometry(.082, .004, 6, 32), brassM); mr.position.y = .15; mr.rotation.set(0, .5, .4); add(mr, g, false); }
      else if (kind === 3) { [-.045, .045].forEach(function (cx, i) { var hh = i ? .2 : .26; var cs = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.04, 0], [.045, .012], [.02, .03], [.012, .08], [.022, hh * .5], [.016, hh * .56], [.026, hh * .6], [.026, hh * .62], [0, hh * .62]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 20), brassM); cs.position.x = cx; add(cs, g, true); cyl(.011, .011, hh * .5, waxM, cx, hh * .62 + hh * .25, 0, 12, g); }); }
      else if (kind === 4) { scene.remove(g); leafPlant(wx, wy, wz, .6 + rnd() * .2, ['#C9B79C', '#D7B4B0', '#9A5B3A'][Math.floor(rnd() * 3)], 9); }
      else if (kind === 6) { var yy6 = 0; [['#4A2B3A', .26, .05], ['#26324A', .22, .04], ['#6B4A32', .24, .045]].forEach(function (b, i) { var bk = box(b[1], b[2], .17, mat(b[0], { roughness: .6 }), (i - 1) * .006, yy6 + b[2] / 2, 0, g, true, .012); bk.rotation.y = (i - 1) * .12; yy6 += b[2]; }); cyl(.032, .028, .02, brassM, 0, yy6 + .01, 0, 20, g); }
      else if (kind === 7) { var bk7 = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.05, 0], [.06, .02], [.065, .14], [.06, .15], [0, .15]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 22), new THREE.MeshStandardMaterial({ color: '#B88A3E', metalness: .9, roughness: .34, envMapIntensity: 1.2, side: THREE.DoubleSide })); add(bk7, g, true); [-.025, 0, .025, .012].forEach(function (rx, i) { var sc = cyl(.012 + (i % 2) * .003, .012 + (i % 2) * .003, .26 + i * .03, mat(i % 2 ? '#E8D9B8' : '#D9C79F', { roughness: .85 }), rx, .2 + i * .015, (i % 2 ? .012 : -.012), 14, g); sc.rotation.z = rx * 2.5; }); }
      else if (kind === 8) { box(.26, .11, .17, mat('#5A2A2E', { roughness: .55 }), 0, .055, 0, g, true, .012); [-.13, .13].forEach(function (cx) { box(.012, .114, .174, brassM, cx, .055, 0, g, false, .004); }); box(.04, .03, .006, brassM, 0, .08, .088, g, false, .002); box(.16, .012, .171, brassM, 0, .104, 0, g, false, .003); }
      else if (kind === 9) { cyl(.05, .055, .02, brassM, 0, .01, 0, 24, g); var gl9 = new THREE.Mesh(new THREE.CylinderGeometry(.04, .045, .2, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#E8E4DA', transparent: true, opacity: .22, roughness: .04, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8 })); gl9.position.y = .12; add(gl9, g, false); cyl(.016, .016, .11, waxM, 0, .075, 0, 14, g); cyl(.045, .04, .014, brassM, 0, .227, 0, 24, g); var h9 = new THREE.Mesh(new THREE.TorusGeometry(.03, .004, 6, 20, Math.PI), brassM); h9.position.y = .234; add(h9, g, false); }
      else { var cb = new THREE.Group(); cb.position.y = .005; g.add(cb); box(.13, .15, .08, brassM, 0, .075, 0, cb, true, .03); var ck = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .008, 24), mat('#F4ECDA', { roughness: .4 })); ck.rotation.x = Math.PI / 2; ck.position.set(0, .085, .044); add(ck, cb, false); box(.006, .035, .004, '#2A1E18', 0, .095, .05, cb, false, .002); }
    }
    var DECO_KINDS = 10;
    function fillRun(axis, a0, a1, fixed, face, levels, maxH, depth) {
      levels.forEach(function (y) {
        var base = fixed + face * (depth / 2 - .15), a = a0 + .05, end = a1 - .05, wp = axis === 'x';
        var rotY = wp ? (face > 0 ? 0 : Math.PI) : (face > 0 ? Math.PI / 2 : -Math.PI / 2);
        var deco = rnd() < .3 ? { at: a0 + .3 + rnd() * (a1 - a0 - .8), w: .22 + rnd() * .16, kind: Math.floor(rnd() * DECO_KINDS) } : null;
        var flats = rnd() < .3 ? { n: 2 + Math.floor(rnd() * 3), len: .26 + rnd() * .1, atEnd: rnd() < .5 } : null;
        if (flats) { if (flats.atEnd) end -= flats.len + .05; else { putFlats(axis, a, y, base, flats.n, flats.len, .26); a += flats.len + .05; } }
        while (a < end - .03) {
          if (deco && !deco.done && a >= deco.at) { deco.done = true; var dc0 = a + deco.w / 2; putDecor(deco.kind, wp ? dc0 : base, y, wp ? base : dc0, rotY); a += deco.w; continue; }
          if (rnd() < .035) { a += .06 + rnd() * .2; continue; }
          var r = rnd(), w = r < .4 ? .035 + rnd() * .025 : r < .82 ? .06 + rnd() * .03 : .095 + rnd() * .04;
          var h = Math.min(maxH, maxH * (.64 + rnd() * .36)), dp = .2 + rnd() * .1, pull = rnd() < .22 ? face * (rnd() * .035) : (rnd() < .15 ? -face * .03 : 0);
          if (a + w > end) break;
          putBook(axis, a + w / 2, y, base + pull, w, h, dp, 0); a += w + (rnd() < .2 ? .008 + rnd() * .012 : .003);
        }
        if (flats && flats.atEnd) putFlats(axis, a1 - .05 - flats.len, y, base, flats.n, flats.len, .26);
        var rem = a1 - .05 - (flats && flats.atEnd ? flats.len + .05 : 0) - a;
        if (rem > .05 && rem < .45) { var lw = .05 + rnd() * .03, lh = Math.min(maxH, maxH * (.8 + rnd() * .2)), ll = Math.asin(Math.max(.03, Math.min(.5, (rem - lw) / lh))); var lp = a + rem - lw / 2; putBook(axis, lp, y, base, lw, lh, .24, wp ? ll : -ll); }
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
      // plinth, fluted pilasters on the dividers, a stepped cornice with a gilt line, and a soft shadow on the floor
      var fo = face * (depth / 2 + .04);
      if (axis === 'x') {
        box(len + .1, .09, depth + .12, shelfDark, mid, .045, fixed, null, false, .03);
        for (var s3 = a0; s3 <= a1 + .01; s3 += bay) { var px = Math.min(s3, a1); cyl(.032, .032, h - .3, shelfM, px, y0 + h / 2, fixed + fo, 10); box(.11, .06, .08, shelfM, px, y1 - .12, fixed + fo, null, false, .02); }
        box(len + .3, .09, depth + .3, shelfM, mid, y1 + .18, fixed, null, false, .04); box(len + .2, .012, depth + .22, gold, mid, y1 + .142, fixed, null, false, .005);
        blob(mid, fixed + face * .75, len + .5, 1.3, .45, 0);
      } else {
        box(depth + .12, .09, len + .1, shelfDark, fixed, .045, mid, null, false, .03);
        for (var s4 = a0; s4 <= a1 + .01; s4 += bay) { var pz = Math.min(s4, a1); cyl(.032, .032, h - .3, shelfM, fixed + fo, y0 + h / 2, pz, 10); box(.08, .06, .11, shelfM, fixed + fo, y1 - .12, pz, null, false, .02); }
        box(depth + .3, .09, len + .3, shelfM, fixed, y1 + .18, mid, null, false, .04); box(depth + .22, .012, len + .2, gold, fixed, y1 + .142, mid, null, false, .005);
        if (y0 < 1) blob(fixed + face * .75, mid, 1.3, len + .5, .45, 0);
      }
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
        blob(mid, z, a1 - a0 + .5, 1.5, .45, 0);
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
        '  col = mix(vec3(dot(col, vec3(.3, .59, .11))), col, 1.9);',
        '  gl_FragColor = vec4(max(col, vec3(0.)) * uBright, 1.);',
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
    var weaveBump = canvasTex(64, 64, function (x, w, h) { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (var i = 0; i < w; i += 3) { x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(i, 0, 1, h); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, i, w, 1); } }, true);
    weaveBump.wrapS = weaveBump.wrapT = THREE.RepeatWrapping; weaveBump.repeat.set(6, 6);
    var turnedGeo = new THREE.LatheGeometry([[0, 0], [.022, 0], [.03, .02], [.02, .05], [.024, .1], [.02, .3], [.034, .38], [.027, .43], [.04, .5], [.03, .57], [.034, .62], [.028, .7], [0, .7]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 18);
    function chair(x, z, rotY, cushion) {
      var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
      var wd = shelfM, dk = shelfDark;
      box(.5, .05, .48, dk, 0, .42, 0, g, true, .02);
      var seatM = new THREE.MeshStandardMaterial({ color: cushion || rose, bumpMap: weaveBump, bumpScale: .8, roughness: 1 });
      var cu = new THREE.Mesh(puffGeo(.44, .42, .09), seatM); cu.rotation.x = -Math.PI / 2; cu.position.y = .5; add(cu, g, true);
      [[-.21, -.2], [.21, -.2]].forEach(function (p) { var lg = new THREE.Mesh(turnedGeo, wd); lg.scale.set(1, .6, 1); lg.position.set(p[0], 0, p[1]); add(lg, g, true); });
      [[-.21, .2], [.21, .2]].forEach(function (p) { var lg = new THREE.Mesh(turnedGeo, wd); lg.scale.set(1, .6, 1); lg.position.set(p[0], 0, p[1]); add(lg, g, true); box(.034, .5, .034, wd, p[0], .67, p[1] + .01, g, true, .012); });
      box(.48, .075, .03, wd, 0, .93, .22, g, true, .015); box(.4, .03, .025, dk, 0, .74, .22, g, true, .01);
      for (var sp = -2; sp <= 2; sp++) cyl(.008, .008, .19, wd, sp * .085, .835, .22, 8, g);
      return g;
    }
    var deskWood = woodMat(null, { tex: 'wood_table_001', raw: true, gain: 1.5, tile: 1.2, env: .28, roughness: .5 });
    function table(x, z, len, wdt, o) {
      o = o || {}; var top = o.wood || peach, dk = shelfDark;
      box(wdt + .08, .026, len + .08, top, x, .792, z, null, true, .05);                  // overhanging moulded lip (surface stays at .805)
      box(wdt + .03, .03, len + .03, top, x, .764, z, null, true, .02);
      box(wdt - .04, .026, len - .04, dk, x, .736, z, null, true, .01);                    // underside moulding
      box(wdt - .14, .1, len - .14, dk, x, .675, z, null, true, .02);                      // apron
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
        var lg = new THREE.Mesh(turnedGeo, shelfM); lg.position.set(x + p[0] * (wdt / 2 - .09), 0, z + p[1] * (len / 2 - .09)); lg.scale.set(1.2, 1.04, 1.2); add(lg, null, true);
        cyl(.03, .026, .014, brassM, x + p[0] * (wdt / 2 - .09), .007, z + p[1] * (len / 2 - .09), 14);
      });
      if (o.wood) {
        [-1, 1].forEach(function (sd) {
          flat(wdt - .06, .002, .005, brassM, x, .8055, z + sd * (len / 2 - .02)); flat(.005, .002, len - .06, brassM, x + sd * (wdt / 2 - .02), .8055, z);                          // brass inlay line around the top
          box(wdt - .34, .055, .012, mat('#3E2616', { roughness: .4, env: .5 }), x, .675, z + sd * (len / 2 - .07 + .006), null, true, .005);                                       // end panels
          flat(wdt - .3, .003, .004, brassM, x, .706, z + sd * (len / 2 - .07 + .013)); flat(wdt - .3, .003, .004, brassM, x, .644, z + sd * (len / 2 - .07 + .013));
        });
      }
      if (o.drawers) [-1, 1].forEach(function (sd) { [-1, 1].forEach(function (k) {
        box(.02, .075, .72, mat('#4F2F1C', { roughness: .45, env: .5 }), x + sd * (wdt / 2 - .07 + .01), .685, z + k * .6, null, true, .01);
        [-.12, .12].forEach(function (q) { cyl(.008, .008, .05, brassM, x + sd * (wdt / 2 - .045), .685, z + k * .6 + q, 8).rotation.z = Math.PI / 2; });
        cyl(.007, .007, .004, brassM, x + sd * (wdt / 2 - .058), .665, z + k * .6, 10).rotation.z = Math.PI / 2;
      }); });
    }

    mark('shelves+window');
    /* ---------- YOUR table ---------- */
    tag = null;
    var DX = 0, DZ = -.55, DY = .8;
    table(DX, DZ + .6, 1.42, 2.3, { wood: deskWood });
    tag = 'lamp';
    var al = armLamp(DX - .74, DY, DZ + .2, 0);
    var armBulb = lampBulbs[lampBulbs.length - 1], armGlow = scene.children[scene.children.length - 1];
    tag = null;
    var lampLight = new THREE.PointLight('#FFD8B4', 1, 5, 2); lampLight.position.set(al.x, al.y, al.z); scene.add(lampLight);
    var deskSpot = new THREE.SpotLight('#FFE2C4', 1, 4, 1.0, .85, 1.6); deskSpot.position.set(al.x, al.y, al.z); deskSpot.target.position.set(DX - .2, DY, DZ + .62); deskSpot.castShadow = true; deskSpot.shadow.mapSize.set(1024, 1024); deskSpot.shadow.bias = -.0006; deskSpot.shadow.radius = 5; scene.add(deskSpot); scene.add(deskSpot.target);
    /* the notebook: the focal point of the desk. A leather-bound journal with curved, deckle-toned pages; what you write in the
       Notebook card is handwritten onto them. */
    tag = 'notebook';
    var NB = { title: '', lines: [], date: '', page: 1, total: 1, empty: true };
    var nbCtx = document.createElement('canvas').getContext('2d');
    var NBFONT = '33px Caveat, "Segoe Script", "Bradley Hand", cursive', NBPER = 17;
    function nbWrap(txt, maxW) {
      nbCtx.font = NBFONT; var out = [];
      String(txt).split('\n').forEach(function (para) {
        if (!para.trim()) { out.push(''); return; }
        var cur = ''; para.split(/\s+/).forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (nbCtx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }); out.push(cur);
      });
      return out;
    }
    function nbDraw(side) {
      return function (x, W, H) {
        var w = 512, h = 720, sd = side ? 71 : 29; function r() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
        x.save(); x.scale(W / w, H / h);
        x.fillStyle = '#F1E6CE'; x.fillRect(0, 0, w, h);
        var vg = x.createRadialGradient(w / 2, h / 2, h * .25, w / 2, h / 2, h * .75); vg.addColorStop(0, 'rgba(150,110,60,0)'); vg.addColorStop(1, 'rgba(150,110,60,.2)'); x.fillStyle = vg; x.fillRect(0, 0, w, h);   // gently aged edges
        for (var f = 0; f < 1400; f++) { x.strokeStyle = 'rgba(' + (r() < .5 ? '110,84,48' : '255,250,235') + ',' + (.03 + r() * .05) + ')'; x.lineWidth = .8; var fx = r() * w, fy = r() * h, fl = 2 + r() * 7, fa = r() * 6.283; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + Math.cos(fa) * fl, fy + Math.sin(fa) * fl); x.stroke(); }   // paper fibres
        for (var fo = 0; fo < 4; fo++) { var ox = r() * w, oy = r() * h, og = x.createRadialGradient(ox, oy, 0, ox, oy, 14 + r() * 22); og.addColorStop(0, 'rgba(170,120,60,.10)'); og.addColorStop(1, 'rgba(170,120,60,0)'); x.fillStyle = og; x.fillRect(ox - 40, oy - 40, 80, 80); }   // faint foxing
        var LH = 34, top = 78, left = side ? 40 : 54;
        x.strokeStyle = 'rgba(70,90,120,.26)'; x.lineWidth = 1.3; for (var ln = 0; ln <= NBPER; ln++) { x.beginPath(); x.moveTo(26, top + ln * LH); x.lineTo(w - 22, top + ln * LH); x.stroke(); }
        x.strokeStyle = 'rgba(190,80,90,.3)'; x.beginPath(); x.moveTo(side ? w - 36 : 40, 36); x.lineTo(side ? w - 36 : 40, h - 30); x.stroke();
        var lines = NB.lines.slice(side * NBPER, side * NBPER + NBPER);
        x.fillStyle = '#2A2942'; x.textBaseline = 'alphabetic';
        lines.forEach(function (t, i) { var isTitle = !side && i === 0 && NB.title; x.font = isTitle ? '700 38px Caveat, "Segoe Script", cursive' : NBFONT; x.fillText(t, left, top + (i + 1) * LH - 7); });
        if (!side) { x.font = '22px Caveat, "Segoe Script", cursive'; x.fillStyle = 'rgba(60,45,40,.62)'; x.fillText(NB.date, left, 48); }
        if (NB.empty && !side) { x.font = '28px Caveat, "Segoe Script", cursive'; x.fillStyle = 'rgba(60,45,40,.3)'; x.fillText('click the notebook to start writing...', left, top + LH - 7); }
        x.font = '20px Caveat, cursive'; x.fillStyle = 'rgba(60,45,40,.5)'; x.textAlign = 'center'; x.fillText(String(NB.page * 2 - 1 + side), w / 2, h - 14); x.textAlign = 'left';
        var gu = side ? x.createLinearGradient(0, 0, w * .22, 0) : x.createLinearGradient(w, 0, w * .78, 0); gu.addColorStop(0, 'rgba(45,25,12,.45)'); gu.addColorStop(1, 'rgba(45,25,12,0)'); x.fillStyle = gu; x.fillRect(0, 0, w, h);
        x.restore();
      };
    }
    var pageTexL = canvasTex(768, 1080, nbDraw(0)), pageTexR = canvasTex(768, 1080, nbDraw(1));
    function redrawNB() { redraw(pageTexL); redraw(pageTexR); }
    var pageML = new THREE.MeshStandardMaterial({ map: pageTexL, color: '#F2E8D6', roughness: .94 }), pageMR = new THREE.MeshStandardMaterial({ map: pageTexR, color: '#F2E8D6', roughness: .94 });
    var edgeTex = canvasTex(16, 64, function (x, w, h) { x.fillStyle = '#E9DDC2'; x.fillRect(0, 0, w, h); for (var q = 0; q < h; q += 2) { x.fillStyle = 'rgba(120,95,55,' + (.14 + (q % 6) * .02) + ')'; x.fillRect(0, q, w, 1); } });
    var pageEdge = new THREE.MeshStandardMaterial({ map: edgeTex, color: '#B7AC93', roughness: .95 });
    var skirtTex = edgeTex.clone(); skirtTex.wrapS = skirtTex.wrapT = THREE.RepeatWrapping; skirtTex.repeat.set(1, 60); skirtTex.needsUpdate = true;
    var skirtM = new THREE.MeshStandardMaterial({ map: skirtTex, color: '#B7AC93', roughness: .95 });
    var coverTex = canvasTex(512, 380, function (x, w, h) {
      x.fillStyle = '#4B1D23'; x.fillRect(0, 0, w, h);
      for (var k = 0; k < 14000; k++) { x.fillStyle = k % 2 ? 'rgba(0,0,0,.1)' : 'rgba(255,200,170,.05)'; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random(), 1 + Math.random()); }
      x.strokeStyle = '#C9A55C'; x.lineWidth = 4; x.strokeRect(10, 10, w - 20, h - 20); x.lineWidth = 2; x.strokeRect(20, 20, w - 40, h - 40);
    });
    var leatherSide = mat('#4B1D23', { roughness: .55, env: .6 }), coverTop = new THREE.MeshStandardMaterial({ map: coverTex, bumpMap: coverTex, bumpScale: .3, roughness: .55, envMapIntensity: .6 });
    var NBX = DX, NBZ = DZ + .72, NBW = .34, NBD = .44, NBG = .01;
    var underPageM = new THREE.MeshStandardMaterial({ color: '#EDE3CE', roughness: .95, side: THREE.DoubleSide });
    function pgY(d) { d = Math.max(0, Math.min(1, d)); return .026 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, d * 1.01))), .7) * (1 - .25 * d); }
    var nbG = new THREE.Group(); nbG.position.set(NBX, DY, NBZ); nbG.rotation.y = .035; scene.add(nbG);
    box(.78, .016, .52, [leatherSide, leatherSide, coverTop, leatherSide, leatherSide, leatherSide], 0, .008, 0, nbG, true, .01);                        // cover board
    [[-.39, -.26], [.39, -.26], [-.39, .26], [.39, .26]].forEach(function (c) { box(.038, .0025, .038, brassM, c[0] + (c[0] < 0 ? .015 : -.015), .0172, c[1] + (c[1] < 0 ? .015 : -.015), nbG, false, .001); });   // brass corners
    box(.012, .0022, .52, mat('#1A1A1F', { roughness: .8 }), .372, .0171, 0, nbG, false, .001);                                                       // elastic band across the rim
    var coilM = mat('#3B3632', { metalness: .85, roughness: .32, env: .9 }), coilG = new THREE.TorusGeometry(.0115, .00145, 8, 22);
    for (var ci = 0; ci < 18; ci++) { var ring = new THREE.Mesh(coilG, coilM); ring.position.set(0, .031, -NBD / 2 + .018 + ci * (NBD - .036) / 17); ring.rotation.z = .25; add(ring, nbG, false); }   // spiral binding
    [-1, 1].forEach(function (sd) {
      box(NBW, .016, NBD, [pageEdge, pageEdge, pageEdge, pageEdge, pageEdge, pageEdge], sd * (NBW / 2 + NBG), .024, 0, nbG, true, .003);                    // block of page edges
      var N = 30, g = new THREE.PlaneGeometry(NBW, NBD, N, 1); g.rotateX(-Math.PI / 2); var pp = g.attributes.position, prof = [];
      for (var i = 0; i < pp.count; i++) { var u = (pp.getX(i) + NBW / 2) / NBW, d = sd < 0 ? 1 - u : u; pp.setY(i, pgY(d)); }
      g.computeVertexNormals();
      var sheet = new THREE.Mesh(g, sd < 0 ? pageML : pageMR); sheet.position.set(sd * (NBW / 2 + NBG), .032, 0); add(sheet, nbG, true);
      for (var lay = 1; lay <= 5; lay++) {           // the pages beneath, each a touch out of line, so the edges read as separate sheets
        var under = new THREE.Mesh(g, underPageM); under.position.set(sd * (NBW / 2 + NBG + lay * .0012), .032 - lay * .0032, (lay % 2 ? .0018 : -.0012) * lay * .5); under.scale.set(1, 1 - lay * .14, 1); under.rotation.y = (lay % 2 ? .004 : -.003); add(under, nbG, false);
      }
      var sh = new THREE.Shape(); sh.moveTo(-NBW / 2, 0); for (var q = 0; q <= N; q++) { var uq = q / N, dq = sd < 0 ? 1 - uq : uq; sh.lineTo(-NBW / 2 + uq * NBW, pgY(dq)); } sh.lineTo(NBW / 2, 0); sh.closePath();
      [1, -1].forEach(function (fz) { var sk = new THREE.Mesh(new THREE.ShapeGeometry(sh), skirtM); sk.position.set(sd * (NBW / 2 + NBG), .032, fz * NBD / 2); if (fz < 0) sk.rotation.y = Math.PI; add(sk, nbG, false); });   // visible stacked page edges under the curve
    });
    var rib = new THREE.MeshPhysicalMaterial({ color: '#D9A2AA', roughness: .4, sheen: 1, sheenRoughness: .4, sheenColor: new THREE.Color('#FFE6E8'), side: THREE.DoubleSide });
    box(.011, .0016, .3, rib, .075, .0495, .04, nbG, false, .0008).rotation.z = -.04;                                                               // satin ribbon marker lying in the gutter side
    box(.011, .0016, .1, rib, .075, .036, .262, nbG, false, .0008).rotation.x = .75; box(.011, .004, .006, giltM, .075, .0305, .289, nbG, false, .001);
    tag = null;
    tag = 'mug';
    var MX = DX - .3, MZ = DZ + .26;
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
    tag = null;
    var steam = []; for (var st = 0; st < 3; st++) { var sp = glow('#FFFFFF', .16, MX, DY + .22, MZ, .3); sp.material = sp.material.clone(); sp.userData.t = st / 3; steam.push(sp); }
    /* the Pomodoro timer: brass drum case, enamel ring, ivory dial with a progress ring, and a window with the time */
    var deskClock = { time: '25:00', color: '#93AE96', running: false, frac: 1, label: 'FOCUS', sub: '' };
    var dcTex = canvasTex(512, 512, function (x, w, h) {
      var cx = w / 2, cy = h / 2, R = w / 2 - 4, serif = '"Young Serif", Georgia, serif', sans = 'Nunito, "Segoe UI", sans-serif';
      var g = x.createRadialGradient(cx, cy * .85, 20, cx, cy, R); g.addColorStop(0, '#FAF3E0'); g.addColorStop(1, '#E4D5B3'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
      x.strokeStyle = '#2E221B'; for (var i = 0; i < 60; i++) { var a = i / 60 * Math.PI * 2 - Math.PI / 2, big = i % 5 === 0, r0 = R - 10, r1 = R - (big ? 38 : 22); x.lineWidth = big ? 4 : 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.stroke(); }
      x.fillStyle = '#3A2A22'; x.font = '600 28px ' + serif; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (var n = 1; n <= 12; n++) { var an = n / 12 * Math.PI * 2 - Math.PI / 2; x.fillText(String(n * 5), cx + Math.cos(an) * (R - 62), cy + Math.sin(an) * (R - 62)); }
      var ringR = R - 108; x.lineCap = 'round'; x.lineWidth = 20; x.strokeStyle = 'rgba(60,40,30,.12)'; x.beginPath(); x.arc(cx, cy, ringR, 0, 7); x.stroke();
      if (deskClock.frac > .003) { x.strokeStyle = deskClock.color; x.beginPath(); x.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * deskClock.frac); x.stroke(); var ea = -Math.PI / 2 + Math.PI * 2 * deskClock.frac; x.fillStyle = '#FFF8E8'; x.strokeStyle = '#8E3530'; x.lineWidth = 4; x.beginPath(); x.arc(cx + Math.cos(ea) * ringR, cy + Math.sin(ea) * ringR, 9, 0, 7); x.fill(); x.stroke(); }
      x.fillStyle = '#1C1511'; x.beginPath(); if (x.roundRect) x.roundRect(cx - 104, cy - 44, 208, 88, 16); else x.rect(cx - 104, cy - 44, 208, 88); x.fill();
      x.strokeStyle = '#B88A3E'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#EBD3A0'; x.font = '600 58px ' + serif; x.fillText(deskClock.time, cx, cy + 4);
      x.fillStyle = '#8A6A45'; x.font = '800 20px ' + sans; x.fillText(deskClock.label, cx, cy - 66);
      if (deskClock.sub) { x.fillStyle = '#5A4636'; x.font = '700 22px ' + sans; x.fillText(deskClock.sub, cx, cy + 78); }
      if (deskClock.running) { x.fillStyle = '#E0883A'; x.beginPath(); x.arc(cx + 88, cy - 30, 6, 0, 7); x.fill(); }
    });
    tag = 'desk';
    var dc = new THREE.Group(); dc.position.set(DX + .1, DY, DZ - .02); dc.rotation.y = .12; scene.add(dc);
    var brs2 = mat('#B88A3E', { metalness: .92, roughness: .28, env: 1.4 }), enamelM = mat('#8E3530', { roughness: .22, metalness: .1, env: 1.1 });
    cyl(.085, .1, .018, brs2, 0, .009, 0, 40, dc); box(.05, .09, .03, brs2, 0, .06, -.02, dc, true, .01);
    [-.06, .06].forEach(function (fx) { cyl(.012, .016, .012, brs2, fx, .006, .045, 12, dc); });
    var bodyG = new THREE.Group(); bodyG.position.set(0, .165, 0); bodyG.rotation.x = -.18; dc.add(bodyG);
    var drum = new THREE.Mesh(new THREE.CylinderGeometry(.098, .098, .06, 48), brs2); drum.rotation.x = Math.PI / 2; add(drum, bodyG, true);
    var ering = new THREE.Mesh(new THREE.TorusGeometry(.1, .012, 14, 56), enamelM); ering.position.z = .028; add(ering, bodyG, false);
    var bezel = new THREE.Mesh(new THREE.TorusGeometry(.088, .006, 12, 56), brs2); bezel.position.z = .036; add(bezel, bodyG, false);
    var dial = new THREE.Mesh(new THREE.CircleGeometry(.087, 56), new THREE.MeshBasicMaterial({ map: dcTex, toneMapped: false })); dial.position.z = .031; add(dial, bodyG, false);
    var dglass = new THREE.Mesh(new THREE.CircleGeometry(.087, 56), new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: .07, roughness: .02, envMapIntensity: 2.4, depthWrite: false })); dglass.position.z = .04; dglass.userData.noPick = true; bodyG.add(dglass);
    var bellR = new THREE.Mesh(new THREE.TorusGeometry(.03, .005, 8, 24), brs2); bellR.position.set(0, .115, 0); add(bellR, bodyG, false); cyl(.01, .012, .02, brs2, 0, .104, 0, 14, bodyG);
    tag = null;

    /* ---------- cosy desk dressing: brass lamp, flowers, candle, bunny, stars, bows, titled books ---------- */
    var candles = [];
    function bow(parent, x, y, z, sc, rotY) {                 // a small satin bow: flat looped ribbon, knot and two soft tails
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; g.scale.setScalar(sc || 1); (parent || scene).add(g);
      var satin = new THREE.MeshPhysicalMaterial({ color: '#D9A2AA', roughness: .38, sheen: 1, sheenRoughness: .4, sheenColor: new THREE.Color('#FFE6E8'), side: THREE.DoubleSide });
      [-1, 1].forEach(function (sd) {
        var lp = new THREE.Mesh(new THREE.TorusGeometry(.017, .0045, 6, 24), satin); lp.scale.set(1.3, .8, .3); lp.position.set(sd * .022, .002, 0); lp.rotation.set(0, sd * .3, sd * .22); add(lp, g, false);
        var tl = new THREE.Mesh(new THREE.BoxGeometry(.009, .05, .0016), satin); tl.position.set(sd * .008, -.03, .002); tl.rotation.set(.1, 0, sd * .22); add(tl, g, false);
      });
      var kn = new THREE.Mesh(new THREE.BoxGeometry(.011, .013, .007), satin); kn.position.z = .002; add(kn, g, false);
      return g;
    }
    function starMesh(x, y, z, sc, glowy, hollow) {
      var sh = new THREE.Shape(); for (var i = 0; i < 10; i++) { var r = i % 2 ? .45 : 1, a = i / 10 * Math.PI * 2 + Math.PI / 2; if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
      if (hollow) { var ho = new THREE.Path(); for (var q = 0; q < 10; q++) { var rr = (q % 2 ? .45 : 1) * .6, aa = -(q / 10 * Math.PI * 2) + Math.PI / 2; if (q === 0) ho.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr); else ho.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ho.closePath(); sh.holes.push(ho); }
      var m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, hollow ? { depth: .1, bevelEnabled: true, bevelSize: .025, bevelThickness: .03, bevelSegments: 1 } : { depth: .3, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: '#E7BE62', emissive: '#FFC863', emissiveIntensity: glowy || .25, metalness: .7, roughness: .3 }));
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
      var inner = new THREE.Mesh(new THREE.SphereGeometry(.102, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#FFD49A', side: THREE.BackSide })); inner.position.copy(shade.position); inner.rotation.copy(shade.rotation); g.add(inner);
      var bm = emissive('#FFE0B0', 3), bulb = new THREE.Mesh(new THREE.SphereGeometry(.02, 16, 12), bm); bulb.position.set(.335, .47, 0); g.add(bulb); lampBulbs.push(bm);
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
      var heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .85 }), 900), hn = 0, dm = new THREE.Object3D(), fc = new THREE.Color();
      var sdv = 5; function r5() { sdv = (sdv * 16807) % 2147483647; return (sdv - 1) / 2147483646; }
      function floret(px, py, pz) { if (hn >= 900) return; dm.position.set(px, py, pz); dm.scale.setScalar(.0032 + r5() * .0028); dm.rotation.set(r5() * 3, r5() * 3, 0); dm.updateMatrix(); heads.setMatrixAt(hn, dm.matrix); heads.setColorAt(hn, fc.setRGB(1, .97 - r5() * .05, .95 - r5() * .08)); hn++; }
      for (var i = 0; i < 20; i++) {
        var a = r5() * 6.283, d = .03 + r5() * .13, hy = .2 + r5() * .2 - d * .4, base = new V(Math.cos(a) * .01, .03, Math.sin(a) * .01), tip = new V(Math.cos(a) * d, hy, Math.sin(a) * d);
        var mid = base.clone().lerp(tip, .55).add(new V((r5() - .5) * .03, 0, (r5() - .5) * .03));
        rod(base, mid, .0015, stemM, g).castShadow = false; rod(mid, tip, .0012, stemM, g).castShadow = false;
        if (r5() < .4) { var lf = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 4), stemM); lf.scale.set(.18, 1, .06); lf.position.copy(mid); lf.rotation.set(r5() - .5, r5() * 3, .5 + r5() * .5); add(lf, g, false); }
        for (var b = 0; b < 4; b++) {                 // little twigs from the tip, each ending in a cloud of florets
          var ta = r5() * 6.283, tl = .018 + r5() * .03, tw = tip.clone().add(new V(Math.cos(ta) * tl, .004 + r5() * .02, Math.sin(ta) * tl));
          rod(tip, tw, .0008, stemM, g).castShadow = false;
          for (var f = 0; f < 7; f++) floret(tw.x + (r5() - .5) * .022, tw.y + (r5() - .2) * .014, tw.z + (r5() - .5) * .022);
        }
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
      var cer = new THREE.MeshPhysicalMaterial({ color: '#F4EDE2', roughness: .28, clearcoat: .6, clearcoatRoughness: .25 });
      var bun = sculpt(function (x, y, z) {
        var d = sdEll(x, y, z, 0, .05, 0, .048, .052, .042);
        d = smin(d, sdEll(x, y, z, 0, .122, .01, .036, .033, .033), .03);
        d = smin(d, sdEll(x, y, z, 0, .022, -.04, .018, .018, .018), .02);
        d = smin(d, sdEll(x, y, z, -.022, .028, .03, .016, .012, .02), .015); d = smin(d, sdEll(x, y, z, .022, .028, .03, .016, .012, .02), .015);
        d = smin(d, sdCap(x, y, z, [-.012, .145, .004], [-.024, .215, -.004], .011, .008), .016); d = smin(d, sdCap(x, y, z, [.012, .145, .004], [.024, .215, -.004], .011, .008), .016);
        return Math.max(d, -y);
      }, 0, .11, 0, .125, 56, cer);
      bun.castShadow = true; add(bun, g);
      [-.013, .013].forEach(function (ex) { ball(.004, '#2A1E1C', ex, .135, .045, 1, 1, 1, g); });
      ball(.006, '#E9A6AC', 0, .124, .047, 1, .8, .8, g);
      bow(g, 0, .095, .03, .8, 0);
      return g;
    }
    function titleSpineTex(title, col, ink) {         // drawn upright: it wraps the rounded spine, title running along it
      return canvasTex(160, 640, function (x, w, h) {
        x.fillStyle = col; x.fillRect(0, 0, w, h);
        for (var k = 0; k < 1400; k++) { x.fillStyle = k % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'; x.fillRect((k * 37) % w, (k * 53) % h, 2, 2); }
        var sh = x.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(.5, 'rgba(255,255,255,.06)'); sh.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = sh; x.fillRect(0, 0, w, h);
        x.fillStyle = ink; [36, 46, h - 50, h - 40].forEach(function (y) { x.fillRect(18, y, w - 36, 3); });
        x.save(); x.translate(w / 2, h / 2); x.rotate(Math.PI / 2); x.font = 'italic 600 54px "Young Serif", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(title, 0, 4); x.restore();
      });
    }
    var pageEdgeTex = canvasTex(256, 64, function (x, w, h) { x.fillStyle = '#EDE2CB'; x.fillRect(0, 0, w, h); for (var k = 0; k < h; k += 2) { x.fillStyle = 'rgba(120,96,70,' + (.05 + (k * 7 % 5) * .02) + ')'; x.fillRect(0, k, w, 1); } });
    function titledBook(title, col, w, h, d, x, y, z, rotY) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
      var lth = pbrSet('brown_leather').normalMap, cover = new THREE.MeshStandardMaterial({ color: col, roughness: .62, normalMap: lth, normalScale: new THREE.Vector2(.5, .5) }), bd = .007;
      var pages = new THREE.MeshStandardMaterial({ map: pageEdgeTex, roughness: .95 });
      box(w, bd, d, cover, 0, -h / 2 + bd / 2, 0, g, true, .012); box(w, bd, d, cover, 0, h / 2 - bd / 2, 0, g, true, .012);   // boards
      box(w - .014, h - 2 * bd, d - .012, pages, -.001, 0, -.004, g, true, .004);                                               // page block, set in
      var sg = new THREE.CylinderGeometry(h / 2, h / 2, w, 28, 1, true, -Math.PI / 2, Math.PI); sg.rotateZ(Math.PI / 2);
      var spine = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: titleSpineTex(title, col, '#D9BC78'), roughness: .55, normalMap: lth, normalScale: new THREE.Vector2(.35, .35), side: THREE.DoubleSide }));
      spine.scale.z = .32; spine.position.z = d / 2 - .006; add(spine, g, true);
      return g;
    }
    tag = 'reading';
    var BKX = DX - .7, BKZ = DZ + .72;
    titledBook('Be Happy \u2661', '#3A4150', .32, .07, .23, BKX, DY + .035, BKZ, .06);            // stacked like the painting: Dream Big on top
    titledBook('Study Hard', '#3D4556', .30, .07, .22, BKX + .01, DY + .105, BKZ, -.05);
    titledBook('Dream Big', '#41475A', .29, .07, .21, BKX - .01, DY + .175, BKZ, .08);
    tag = null;
    flowerJar(DX - .5, DY, DZ + .12, 1.0);
    tag = 'candle'; candleJar(DX + .68, DY, DZ + .68); tag = null;
    bunny(DX + .84, DY, DZ + .62, 1.0, -.25);
    starMesh(DX - .42, DY + .014, DZ + .72, .018); starMesh(DX + .46, DY + .014, DZ + .84, .018);
    tag = 'mug'; bow(null, MX - .056, DY + .085, MZ + .004, .6, Math.PI / 2); tag = null;
    /* a leather writing surface and a few carefully placed things: ink and quill, fountain pens on a tray, letters, a pocket watch, a tassel bookmark, a bud vase */
    function fountainPen(parent, x, y, z, ry, barrelCol, capped) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(.8); (parent || scene).add(g);
      var lac = new THREE.MeshStandardMaterial({ color: barrelCol, roughness: .16, metalness: .25, envMapIntensity: 1.6 }), gold = mat('#C9A24F', { metalness: .95, roughness: .25, env: 1.5 });
      var body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.0035, 0], [.0062, .008], [.0078, .026], [.0084, .06], [.008, .092], [.0072, .108], [.0052, .118], [0, .119]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 20), lac);
      body.rotation.z = -Math.PI / 2; body.position.x = -.06; add(body, g, true);
      [.012, .094].forEach(function (bx) { var rg = cyl(.0088, .0088, .0032, gold, -.06 + bx, 0, 0, 20, g); rg.rotation.z = Math.PI / 2; });
      if (capped) {
        var cap = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.0075, 0], [.0093, .004], [.0098, .02], [.0098, .05], [.0092, .062], [.0065, .069], [0, .07]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 20), lac);
        cap.rotation.z = -Math.PI / 2; cap.position.x = .056; add(cap, g, true);
        box(.034, .0028, .0042, gold, .09, .0098, 0, g, false, .001); cyl(.0099, .0099, .003, gold, .062, 0, 0, 20, g).rotation.z = Math.PI / 2;
      } else {
        cyl(.0066, .0066, .016, gold, .067, 0, 0, 16, g).rotation.z = Math.PI / 2;
        var nib = new THREE.Mesh(new THREE.ConeGeometry(.0058, .026, 14), gold); nib.rotation.z = -Math.PI / 2; nib.scale.z = .45; nib.position.x = .088; add(nib, g, true);
        box(.012, .0006, .0005, mat('#2A1E18'), .096, .0018, 0, g, false, .0002);
      }
      return g;
    }
    fountainPen(null, NBX + .17, DY + .07, NBZ + .02, -.5, '#14141A', false);
    (function () {
      var sheetTex = canvasTex(256, 340, function (x, w, h) { x.fillStyle = '#F2EADA'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(70,90,120,.22)'; for (var y = 40; y < h - 10; y += 16) { x.beginPath(); x.moveTo(12, y); x.lineTo(w - 12, y); x.stroke(); } x.fillStyle = 'rgba(42,41,66,.55)'; for (var l = 0; l < 7; l++) x.fillRect(18, 34 + l * 16, 60 + ((l * 53) % 140), 1.6); });
      [[-.43, -.05, .32, .0], [-.37, -.14, -.18, .0012]].forEach(function (q) { var sh = new THREE.Mesh(new THREE.PlaneGeometry(.21, .28), new THREE.MeshStandardMaterial({ map: sheetTex, roughness: .95 })); sh.rotation.set(-Math.PI / 2, 0, q[2]); sh.position.set(NBX + q[0], .8062 + q[3], NBZ + q[1]); sh.receiveShadow = true; scene.add(sh); });
      var pg = new THREE.Group(); pg.position.set(NBX + .47, .8093, NBZ + .14); pg.rotation.y = 1.1; scene.add(pg);
      var body = new THREE.Mesh(new THREE.CylinderGeometry(.0042, .0042, .15, 6), mat('#2F4A3E', { roughness: .45 })); body.rotation.z = Math.PI / 2; add(body, pg, true);
      var wood = new THREE.Mesh(new THREE.ConeGeometry(.0042, .016, 6), mat('#D9B98C', { roughness: .8 })); wood.rotation.z = -Math.PI / 2; wood.position.x = .083; add(wood, pg, false);
      var lead = new THREE.Mesh(new THREE.ConeGeometry(.0013, .005, 6), mat('#2A2A2A', { roughness: .5 })); lead.rotation.z = -Math.PI / 2; lead.position.x = .0915; add(lead, pg, false);
      cyl(.0045, .0045, .012, brassM, -.081, 0, 0, 12, pg).rotation.z = Math.PI / 2; cyl(.0042, .0042, .01, '#E3A1A6', -.092, 0, 0, 12, pg).rotation.z = Math.PI / 2;
    })();

    tag = null;

    /* ---------- your study shelf ---------- */
    tag = 'shelf';
    var SHX = 1.95, SH = { z0: .05, z1: 1.95, levels: [.12, .7, 1.28, 1.86] };
    flat(.04, 2.42, SH.z1 - SH.z0 + .1, shelfBack, SHX + .22, 1.22, (SH.z0 + SH.z1) / 2);
    SH.levels.concat([2.42]).forEach(function (y) { box(.48, .06, SH.z1 - SH.z0 + .1, shelfDark, SHX, y - .03, (SH.z0 + SH.z1) / 2, null, true, .03); });
    [SH.z0 - .05, SH.z1 + .05].forEach(function (z) { box(.54, 2.5, .1, shelfM, SHX, 1.25, z, null, true, .05); });
    box(.62, .14, SH.z1 - SH.z0 + .3, shelfM, SHX, 2.52, (SH.z0 + SH.z1) / 2, null, true, .07);
    box(.02, .08, .4, brassM, SHX - .26, 2.36, (SH.z0 + SH.z1) / 2, null, false, .01);
    leafPlant(SHX, 2.59, SH.z0 + .3, 1.0, null, 14);
    var booksGroup = new THREE.Group(); scene.add(booksGroup);
    var cursor = { shelf: 0, z: SH.z0 }, userSpine = spineCanvas(0, '#C9C9C9', 3);
    function placeBook(b, animate) {
      if (cursor.z + b.w > SH.z1) { cursor.shelf++; cursor.z = SH.z0; }
      if (cursor.shelf >= SH.levels.length) return;
      var y = SH.levels[cursor.shelf], hgt = b.h * .85;
      var m = new THREE.Mesh(geoBox(.3, hgt, b.w, .025), new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color).multiplyScalar(.62), map: userSpine, bumpMap: userSpine, bumpScale: .5, roughness: .55, envMapIntensity: .3 }));
      m.position.set(SHX - .03, y + hgt / 2, cursor.z + b.w / 2); add(m, booksGroup);
      Object.assign(m.userData, { book: b, baseY: y + hgt / 2, baseX: SHX - .03, pull: 0, drop: animate ? 0 : 1 });
      cursor.z += b.w + .01;
    }
    books.forEach(function (b) { placeBook(b); });
    [[2, [.5, 1.05, 1.6]], [3, [.4, .95, 1.5]]].forEach(function (row, ri) { var yy = [SH.levels[2], SH.levels[3]][ri]; row[1].forEach(function (zz, k) { putDecor([0, 1, 2, 3, 5, 0, 1][(ri * 3 + k) % 7], SHX - .03, yy, SH.z0 + zz, -Math.PI / 2); }); });
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
    var velvetBump = canvasTex(128, 128, function (x, w, h) { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (var k = 0; k < 6000; k++) { x.fillStyle = 'rgba(' + (k % 2 ? '255,255,255' : '0,0,0') + ',' + (.03 + (k % 7) * .01) + ')'; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, true);
    velvetBump.wrapS = velvetBump.wrapT = THREE.RepeatWrapping; velvetBump.repeat.set(10, 10);
    function velvetM(c) { var st = pbrSet('velour_velvet'); return new THREE.MeshPhysicalMaterial({ color: c, roughness: .9, normalMap: st.normalMap, normalScale: new THREE.Vector2(.7, .7), sheen: .7, sheenRoughness: .45, sheenColor: new THREE.Color(c).lerp(new THREE.Color('#F2D2C0'), .5) }); }
    var plaidTex = canvasTex(128, 128, function (x, w, h) {
      x.fillStyle = '#7A2A30'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(232,214,184,.9)'; x.fillRect(0, 20, w, 5); x.fillRect(20, 0, 5, h); x.fillStyle = 'rgba(232,214,184,.5)'; x.fillRect(0, 84, w, 3); x.fillRect(84, 0, 3, h);
      x.fillStyle = 'rgba(30,38,66,.65)'; x.fillRect(0, 54, w, 22); x.fillRect(54, 0, 22, h);
      x.fillStyle = 'rgba(224,170,176,.5)'; x.fillRect(0, 100, w, 8); x.fillRect(100, 0, 8, h);
      for (var k = 0; k < w; k += 2) { x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(k, 0, 1, h); x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(0, k, w, 1); }
    });
    plaidTex.wrapS = plaidTex.wrapT = THREE.RepeatWrapping; plaidTex.repeat.set(2, 2);
    var plaidM = (function () { var st = pbrSet('wool_boucle'), mp = st.map.clone(), nm = st.normalMap.clone(); [mp, nm].forEach(function (t) { t.repeat.set(1.6, 1.6); t.needsUpdate = true; }); return new THREE.MeshStandardMaterial({ color: new THREE.Color('#E9C7A6'), map: mp, normalMap: nm, roughness: .95 }); })();
    var legWood = mat('#2A170D', { roughness: .4, env: .6 }), nailM = mat('#CDA85E', { metalness: .9, roughness: .3, env: 1.2 });
    function armchair(x, z, rotY, body) {             // a carved, buttoned armchair (CC0 model), upholstered in the room's brown velvet
      var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
      model('ArmChair_01', g, { ry: Math.PI, s: 1.15, tint: body, env: .35 });
      return g;
    }
    function throwOn(g, x, y, z, rx, rz, ry, w, d) { var m = box(w, .05, d, plaidM, x, y, z, g, true, .02); m.rotation.set(rx, ry || 0, rz); var fr = box(w, .02, .05, mat('#E4D8BE', { roughness: 1 }), 0, 0, d / 2 + .02, m, false, .01); return m; }
    function ottoman(x, z, rotY, c) { var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g); var v = velvetM(c); box(.62, .26, .5, v, 0, .25, 0, g, true, .12); ball(.3, v, 0, .38, 0, 1, .22, .8, g); [[-.26, -.2], [.26, -.2], [-.26, .2], [.26, .2]].forEach(function (p) { cyl(.022, .016, .12, legWood, p[0], .06, p[1], 10, g); }); return g; }
    /* ---------- soft furnishings: puffed pillows, textured fabrics, draped blankets, sheepskin ---------- */
    var knitBump = canvasTex(128, 128, function (x, w, h) {
      x.fillStyle = '#707070'; x.fillRect(0, 0, w, h);
      for (var row = 0; row < h; row += 10) for (var col2 = 0; col2 < w; col2 += 8) { var gx = x.createLinearGradient(col2, 0, col2 + 8, 0); gx.addColorStop(0, '#303030'); gx.addColorStop(.5, '#F0F0F0'); gx.addColorStop(1, '#303030'); x.fillStyle = gx; x.beginPath(); x.moveTo(col2, row + 10); x.lineTo(col2 + 4, row); x.lineTo(col2 + 8, row + 10); x.lineTo(col2 + 4, row + 6); x.closePath(); x.fill(); }
    }, true);
    knitBump.wrapS = knitBump.wrapT = THREE.RepeatWrapping; knitBump.repeat.set(5, 5);
    var woolBump = canvasTex(128, 128, function (x, w, h) { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (var k = 0; k < 2600; k++) { var a = Math.random() * 6.283, cx = Math.random() * w, cy = Math.random() * h, l = 4 + Math.random() * 9; x.strokeStyle = 'rgba(' + (k % 2 ? '255,255,255' : '0,0,0') + ',.22)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx, cy); x.quadraticCurveTo(cx + Math.cos(a) * l * .6, cy + Math.sin(a) * l, cx + Math.cos(a + .6) * l, cy + Math.sin(a + .6) * l); x.stroke(); } }, true);
    woolBump.wrapS = woolBump.wrapT = THREE.RepeatWrapping; woolBump.repeat.set(3, 3);
    var floralTex = canvasTex(128, 128, function (x, w, h) {
      x.fillStyle = '#EADBC4'; x.fillRect(0, 0, w, h);
      for (var i = 0; i < 16; i++) { var fx = (i % 4) * 32 + 16 + ((Math.floor(i / 4) % 2) * 16), fy = Math.floor(i / 4) * 32 + 16; x.fillStyle = '#7F9A78'; x.beginPath(); x.ellipse(fx + 8, fy + 3, 7, 3, .5, 0, 7); x.fill(); x.beginPath(); x.ellipse(fx - 8, fy + 4, 7, 3, -.5, 0, 7); x.fill(); x.fillStyle = '#D88F9C'; for (var p = 0; p < 5; p++) { x.beginPath(); x.arc(fx + Math.cos(p * 1.257) * 4.5, fy + Math.sin(p * 1.257) * 4.5, 3.6, 0, 7); x.fill(); } x.fillStyle = '#F2D8A8'; x.beginPath(); x.arc(fx, fy, 2.4, 0, 7); x.fill(); }
      for (var k = 0; k < w; k += 2) { x.fillStyle = 'rgba(0,0,0,.04)'; x.fillRect(k, 0, 1, h); }
    });
    var knitM = new THREE.MeshStandardMaterial({ color: '#E5D8C2', bumpMap: knitBump, bumpScale: 1.1, roughness: 1, side: THREE.DoubleSide });
    function puffGeo(w, h, d) {
      var g = new THREE.BoxGeometry(w, h, d, 14, 14, 4), p = g.attributes.position;
      for (var i = 0; i < p.count; i++) {
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = x / (w / 2), ny = y / (h / 2), f = (1 - Math.pow(Math.abs(nx), 3)) * (1 - Math.pow(Math.abs(ny), 3)), c = Math.abs(nx * ny);
        p.setZ(i, z * (.3 + .7 * Math.max(0, f))); p.setX(i, x * (1 - .07 * c)); p.setY(i, y * (1 - .07 * c));
      }
      g.computeVertexNormals(); return g;
    }
    function fabricM(c, kind) {
      if (kind === 'velvet') return velvetM(c);
      if (kind === 'knit') return new THREE.MeshStandardMaterial({ color: c, bumpMap: knitBump, bumpScale: 1.0, roughness: 1 });
      if (kind === 'floral') return new THREE.MeshStandardMaterial({ map: floralTex, bumpMap: weaveBump, bumpScale: .3, roughness: 1 });
      return new THREE.MeshStandardMaterial({ color: c, bumpMap: weaveBump, bumpScale: .4, roughness: 1 });
    }
    function pillow(parent, x, y, z, w, h, d, c, rot, kind) {
      var m = new THREE.Mesh(puffGeo(w, h, d), fabricM(c, kind)); m.position.set(x, y, z); m.rotation.set(rot[0], rot[1], rot[2]); add(m, parent, true);
      return m;
    }
    function drape(parent, x, y, z, w, d, rx, ry, m, fall) {
      var g = new THREE.PlaneGeometry(w, d, 28, 28); g.rotateX(-Math.PI / 2); var p = g.attributes.position;
      for (var i = 0; i < p.count; i++) {
        var px = p.getX(i), pz = p.getZ(i), t = (pz + d / 2) / d, yy = Math.sin(px * 11 + pz * 5) * .013 + Math.sin(px * 25 + pz * 9) * .005;
        if (t > fall) { var u = (t - fall) / (1 - fall); yy -= u * u * d * .5; p.setZ(i, pz - u * u * .08 * d); }
        p.setY(i, yy);
      }
      g.computeVertexNormals(); var mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, 0); return add(mesh, parent, true);
    }
    function sheepskin(x, z, ry) {
      var g = new THREE.Group(); g.position.set(x, .03, z); g.rotation.y = ry; scene.add(g);
      var wm = new THREE.MeshStandardMaterial({ color: '#EFE6D6', bumpMap: woolBump, bumpScale: 3.5, roughness: 1 });
      [[0, 0, .5, .34], [.28, .12, .22, .2], [-.3, -.14, .24, .22], [.2, -.2, .2, .17], [-.22, .2, .18, .16]].forEach(function (l) { var m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), wm); m.scale.set(l[2], .035, l[3]); m.position.set(l[0], 0, l[1]); m.receiveShadow = true; g.add(m); });
    }
    var arm = armchair(-3.25, 1.55, Math.PI / 2 + .35, '#5C3526', '#6B3F2D');
    pillow(arm, .22, .7, .2, .46, .4, .15, '#E2B8B8', [-.3, .2, .1], 'plain'); pillow(arm, -.18, .66, .22, .4, .38, .14, '#A9B49A', [-.25, -.25, -.12], 'knit'); pillow(arm, .02, .62, .08, .34, .3, .13, '#F0E4D0', [-.55, .1, .35], 'floral');
    var knit = canvasTex(64, 64, function (x) { x.fillStyle = '#6E1F28'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(214,196,160,.85)'; x.fillRect(0, 14, 64, 4); x.fillRect(14, 0, 4, 64); x.fillStyle = 'rgba(20,30,50,.55)'; x.fillRect(0, 36, 64, 12); x.fillRect(36, 0, 12, 64); x.fillStyle = 'rgba(0,0,0,.06)'; for (var k = 0; k < 64; k += 3) x.fillRect(k, 0, 1, 64); });
    knit.wrapS = knit.wrapT = THREE.RepeatWrapping; knit.repeat.set(3, 3);
    var blanketM = new THREE.MeshStandardMaterial({ map: knit, roughness: 1 });
    throwOn(arm, -.25, .86, .36, -1.25, 0, -.1, .6, .7); throwOn(arm, -.25, .56, .02, 0, 0, -.1, .6, .5);
    var TX = -3.35, TZ = .25;
    cyl(.32, .32, .05, peach, TX, .6, TZ, 48); capsule(.04, .5, '#6B4128', TX, .3, TZ); cyl(.2, .23, .04, '#6B4128', TX, .02, TZ, 32);
    var potM = mat('#F7EEDD', { roughness: .3 });
    ball(.12, potM, TX - .05, .72, TZ, 1, .85, 1); cyl(.04, .055, .05, potM, TX - .05, .83, TZ, 20); ball(.02, rose, TX - .05, .865, TZ);
    rod(new THREE.Vector3(TX + .04, .7, TZ), new THREE.Vector3(TX + .16, .8, TZ), .02, potM);
    cyl(.045, .038, .06, rose, TX + .14, .655, TZ + .16, 20);
    box(.22, .05, .3, '#3F5F7A', TX + .05, .65, TZ - .14, null, true, .02).rotation.y = .4;
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
    var drawerCols = [woodMat('#7B5434', { seed: 41, roughness: .5, bumpScale: .03, contrast: .5, lines: 70 }), woodMat('#6D4A2E', { seed: 43, roughness: .5, bumpScale: .03, contrast: .5, lines: 70 })], cardM = mat('#EFE5CF');
    for (var r = 0; r < 4; r++) for (var c = 0; c < 5; c++) {
      var dx = CX - .6 + c * .3, dy = .46 + r * .26;
      box(.27, .22, .04, drawerCols[(r + c) % 2], dx, dy, CZ - .28, null, false, .05);
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
    function leafPlant(x, y, z, s) {                 // small potted plants (CC0 model), sized like the old ones
      var k = s * .52; model('potted_plant_02', scene, { x: x, y: y + .097 * k, z: z, s: k, ry: (x * 7.1 + z * 3.3) % 6.283, env: .3 });
    }
    var plantN = 0;
    function plant(x, z, s) {                         // floor plants in terracotta pots (CC0 models)
      var big = plantN++ % 2 === 0; model(big ? 'potted_plant_01' : 'potted_plant_02', scene, { x: x, z: z, s: big ? s * 1.05 : s * 1.55, ry: x * 2.3 + z, env: .3 });
    }
    plant(-1.35, Z0 + .55, .9, cream); plant(1.35, Z0 + .55, .9, lilac); plant(X - .75, 2.0, 1.05, butter); plant(-1.9, Z1 - .5, .8, mint);

    /* ---------- Mochi ---------- */
    tag = 'cat';
    var knitC = canvasTex(128, 128, function (x, w, h) { x.fillStyle = '#EBDAD2'; x.fillRect(0, 0, w, h); x.fillStyle = '#D9A5A3'; for (var r = 0; r < h; r += 32) x.fillRect(0, r, w, 14); x.fillStyle = 'rgba(0,0,0,.06)'; for (var k = 0; k < w; k += 4) x.fillRect(k, 0, 2, h); });
    knitC.wrapS = knitC.wrapT = THREE.RepeatWrapping; knitC.repeat.set(3, 2);
    var cushion = ball(.33, pbrMat('curly_teddy_natural', '#EADBC8', { normal: 1.2 }), DX + .56, DY + .035, DZ + .18, .82, .24, .66);
    var cat = new THREE.Group(); cat.position.set(DX + .56, DY + .1, DZ + .18); cat.rotation.y = -.47; cat.scale.setScalar(.88); scene.add(cat);
    var furM = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .92, sheen: 1, sheenRoughness: .55, sheenColor: new THREE.Color('#FFE6CC') });
    function catSdf(x, y, z) {
      var R = .11, d = 1e9, prev = null;
      for (var a = 175; a <= 365; a += 19) {                                              // the spine curls round the back, hip on the left, shoulders on the right
        var r = a * Math.PI / 180, pt = [Math.cos(r) * R, .085, Math.sin(r) * R * .95], rad = .092 - Math.abs(a - 270) / 95 * .006;
        if (prev) d = smin(d, sdCap(x, y, z, prev[0], pt, prev[1], rad), .03); prev = [pt, rad];
      }
      d = smin(d, sdEll(x, y, z, 0, .068, -.012, .1, .068, .085), .05);                  // filled in the middle of the curl
      d = smin(d, sdEll(x, y, z, -.112, .088, -.004, .1, .098, .098), .05);              // haunch
      d = smin(d, sdEll(x, y, z, -.075, .03, .1, .058, .028, .034), .03);                // hind paw
      d = smin(d, sdEll(x, y, z, .055, .03, .128, .06, .027, .034), .025);               // front paws, the head rests on them
      d = smin(d, sdEll(x, y, z, .115, .03, .1, .052, .027, .032), .025);
      var T = [[-.19, .05, -.07], [-.215, .042, .05], [-.135, .036, .14], [-.02, .032, .165], [.06, .03, .165]];
      for (var t = 0; t < T.length - 1; t++) d = smin(d, sdCap(x, y, z, T[t], T[t + 1], .033 - t * .002, .031 - t * .002), .025);   // the tail wraps round the front
      return Math.max(d, .004 - y);                                                       // flat underneath, settled into the bed
    }
    function catHeadSdf(x, y, z) {
      var d = sdEll(x, y, z, 0, .004, 0, .074, .064, .068);
      d = smin(d, sdEll(x, y, z, 0, -.018, .012, .082, .05, .066), .04);                 // full cheeks
      d = smin(d, sdEll(x, y, z, 0, -.026, .058, .03, .023, .026), .025);                // muzzle
      return d;
    }
    function surfaceZ(sdf, x, y) { for (var zz = .2; zz > -.05; zz -= .0008) if (sdf(x, y, zz) < 0) return zz; return 0; }
    var cW = new THREE.Color('#F7F1E8'), cG = new THREE.Color('#E08E46'), cS = new THREE.Color('#B9682E');
    function sm2(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    function catColor(x, y, z, c) {                   // ginger back with soft tabby bands; white chest, paws, belly front and tail tip
      var white = sm2(.03, .09, z) * sm2(.11, .06, y) + sm2(.06, .03, y) * sm2(.07, .1, z) + sm2(.02, .06, x) * sm2(.13, .15, z) * sm2(.06, .04, y);
      var ph = Math.atan2(z, x), stripe = Math.pow(Math.max(0, Math.sin(ph * 17)), 3) * sm2(.09, .15, y) * sm2(.04, -.02, z);
      c.copy(cG).lerp(cS, stripe * .6).lerp(cW, Math.min(1, white));
      c.offsetHSL(0, 0, Math.sin(x * 210 + y * 170 + z * 190) * .012);
    }
    var catBody = sculpt(catSdf, -.02, .1, .02, .27, 76, furM, catColor); add(catBody, cat); furCoat(catBody, .009, 10, 620);
    var HEADY = .118, head = new THREE.Group(); head.position.set(.085, HEADY, .088); head.rotation.set(.12, .1, -.12); cat.add(head);
    var headM = sculpt(catHeadSdf, 0, -.005, .02, .11, 60, furM, function (x, y, z, c) {
      var w = sm2(-.004, -.02, y) * sm2(.02, .045, z) + sm2(.014, .006, Math.abs(x)) * sm2(.045, .06, z) * sm2(.03, .01, y);
      c.copy(cG).lerp(cS, Math.pow(Math.max(0, Math.sin(x * 95)), 3) * sm2(.025, .055, y) * .55).lerp(cW, Math.min(1, w));
    });
    add(headM, head); furCoat(headM, .006, 8, 700);
    var earM = new THREE.MeshPhysicalMaterial({ color: '#CF8649', roughness: .9, sheen: 1, sheenRoughness: .5, sheenColor: new THREE.Color('#FFE0C0') }), earIn = mat('#E8B3A6', { roughness: .9 });
    [-1, 1].forEach(function (sd) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(.03, .056, 24), earM); ear.position.set(sd * .045, .058, -.008); ear.rotation.set(-.15, 0, -sd * .38); ear.scale.z = .55; add(ear, head);
      var inner = new THREE.Mesh(new THREE.ConeGeometry(.02, .04, 20), earIn); inner.position.set(sd * .043, .054, .0); inner.rotation.copy(ear.rotation); inner.scale.z = .3; add(inner, head, false);
    });
    var lidM = mat('#4A2F22', { roughness: .7 });
    [-1, 1].forEach(function (sd) { var ex = sd * .03, ey = .002, lid = new THREE.Mesh(new THREE.TorusGeometry(.011, .0021, 6, 18, Math.PI), lidM); lid.position.set(ex, ey, surfaceZ(catHeadSdf, ex, ey) + .001); lid.rotation.set(0, sd * .35, Math.PI); add(lid, head, false); });
    ball(.0065, '#C97F78', 0, -.017, surfaceZ(catHeadSdf, 0, -.017) - .002, 1.2, .8, 1, head);   // nose
    tag = null;
    var zzz = spriteSet(3, function (x) { x.fillStyle = '#FFF6E2'; x.font = 'italic 400 50px "Young Serif", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', 32, 34); }, .15);
    var hearts = spriteSet(5, function (x) { x.fillStyle = '#F07A93'; x.font = '50px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♥', 32, 36); }, .15);

    /* ---------- brass pendants with opal glass globes ---------- */
    var chands = [], cloudM = new THREE.MeshStandardMaterial({ color: '#F6EAD3', emissive: '#FFD9A0', emissiveIntensity: 1, roughness: .35 });
    [-4.6, -1.2].forEach(function (z) {
      var y = 4.35, g = new THREE.Group(); g.position.set(0, y, z); scene.add(g);
      var brassP = mat('#B8893C', { metalness: .92, roughness: .28, env: 1.2 });
      cyl(.008, .008, HH - y - .1, brassP, 0, (HH - y) / 2 + .05, 0, 8, g).castShadow = false;
      cyl(.05, .08, .09, brassP, 0, .24, 0, 32, g); cyl(.085, .085, .016, brassP, 0, .18, 0, 32, g);
      var gl = new THREE.Mesh(new THREE.SphereGeometry(.18, 40, 28), cloudM); gl.scale.y = 1.12; gl.position.y = 0; g.add(gl);
      var fin = new THREE.Mesh(new THREE.ConeGeometry(.022, .07, 16), brassP); fin.rotation.x = Math.PI; fin.position.y = -.23; g.add(fin);
      var L = new THREE.PointLight('#FFCB8A', 1, 9, 2); L.position.set(0, y - .45, z); scene.add(L);
      chands.push({ light: L, glow: glow('#FFC880', 1.2, 0, y, z, .22), group: g, ph: z });
    });

    mark('desk+furniture');
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
    var lanStar = starMesh(0, 0, 0, .14, .9, true); scene.remove(lanStar); starLan.add(lanStar);
    var lanGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#FFC878', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .42, fog: false })); lanGlow.scale.set(.6, .6, 1); starLan.add(lanGlow);
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
    var sparkN = 60, sparkGeo = new THREE.BufferGeometry(), sp3 = new Float32Array(sparkN * 3), sph = new Float32Array(sparkN), ssz = new Float32Array(sparkN);
    for (var si = 0; si < sparkN; si++) { sp3[si * 3] = (Math.random() - .5) * 8.5; sp3[si * 3 + 1] = .6 + Math.random() * (HH - 1); sp3[si * 3 + 2] = Z0 + .5 + Math.random() * (ZL - 1); sph[si] = Math.random() * 6; ssz[si] = .035 + Math.random() * .04; }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp3, 3)); sparkGeo.setAttribute('ph', new THREE.BufferAttribute(sph, 1)); sparkGeo.setAttribute('sz', new THREE.BufferAttribute(ssz, 1));
    var sparkMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTex }, uT: { value: 0 }, uAmp: { value: .4 }, uScale: { value: 600 }, uStill: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float ph; attribute float sz; uniform float uT; uniform float uAmp; uniform float uScale; uniform float uStill; varying float vA; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, sz * uScale / -mv.z * 1.6); vA = (uStill > .5 ? .6 : max(0.0, sin(uT * 1.6 + ph))) * uAmp; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, .88, .68), c.a * vA); }'
    });
    var sparkPts = new THREE.Points(sparkGeo, sparkMat); sparkPts.frustumCulled = false; sparkPts.userData.noPick = true; scene.add(sparkPts);

    /* ---------- a second reading corner (asymmetry), window-seat dressing, vintage details, contact shadows ---------- */
    tag = null;
    function floorLamp(x, z, h) {
      var g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      cyl(.15, .17, .03, brassM, 0, .015, 0, 32, g); cyl(.03, .06, .07, brassM, 0, .06, 0, 24, g); cyl(.011, .011, h, brassM, 0, h / 2, 0, 10, g);
      var fm = new THREE.MeshStandardMaterial({ color: '#F4E0C6', emissive: '#FFD6A0', emissiveIntensity: 1.2, roughness: .9, side: THREE.DoubleSide, bumpMap: velvetBump, bumpScale: .3 });
      var sh = new THREE.Mesh(new THREE.CylinderGeometry(.15, .26, .3, 40, 1, true), fm); sh.position.y = h + .03; add(sh, g, false); lampBulbs.push(fm);
      var rimT = new THREE.Mesh(new THREE.TorusGeometry(.26, .006, 6, 40), mat('#E0A7AE', { roughness: .5 })); rimT.rotation.x = Math.PI / 2; rimT.position.y = h - .12; g.add(rimT);
      glow('#FFC880', 1.1, x, h + .03, z, .5);
      var L = new THREE.PointLight('#FFC584', .8, 5.5, 2); L.position.set(x, h + .05, z); scene.add(L);
      blob(x, z, .6, .6, .4);
    }
    function teacup(parent, x, y, z, s, ry) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s || 1); g.rotation.y = ry || 0; (parent || scene).add(g);
      var por = mat('#F3EBDD', { roughness: .22, env: .9, side: THREE.DoubleSide }), pink = mat('#E3A9B1', { roughness: .3, env: .8 });
      var sc = new THREE.Mesh(new THREE.LatheGeometry([[0, .002], [.055, .002], [.07, .01], [.074, .016], [.07, .017], [.064, .01], [.04, .007], [0, .007]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 32), por); add(sc, g, true);
      var cp = new THREE.Mesh(new THREE.LatheGeometry([[0, .01], [.025, .01], [.035, .02], [.042, .05], [.047, .075], [.044, .077], [.039, .07], [.032, .03], [.02, .02], [0, .018]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 32), por); add(cp, g, true);
      var rb = new THREE.Mesh(new THREE.TorusGeometry(.0455, .0016, 6, 32), nailM); rb.rotation.x = Math.PI / 2; rb.position.y = .076; g.add(rb);
      var bd = new THREE.Mesh(new THREE.TorusGeometry(.04, .003, 6, 32), pink); bd.rotation.x = Math.PI / 2; bd.position.y = .05; g.add(bd);
      var hd = new THREE.Mesh(new THREE.TorusGeometry(.02, .005, 8, 16, Math.PI), por); hd.rotation.z = -Math.PI / 2; hd.position.set(.046, .047, 0); add(hd, g, false);
      return g;
    }
    function teapot(x, y, z, s, ry) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s || 1); g.rotation.y = ry || 0; scene.add(g);
      var por = mat('#F3EBDD', { roughness: .22, env: .9 }), pink = mat('#E3A9B1', { roughness: .3, env: .8 });
      ball(.07, por, 0, .075, 0, 1, .85, 1, g); cyl(.03, .05, .02, por, 0, .027, 0, 24, g); ball(.028, por, 0, .145, 0, 1, .4, 1, g); ball(.009, pink, 0, .163, 0, 1, 1, 1, g);
      var bd = new THREE.Mesh(new THREE.TorusGeometry(.068, .004, 6, 32), pink); bd.rotation.x = Math.PI / 2; bd.position.y = .08; g.add(bd);
      rod(new THREE.Vector3(.055, .06, 0), new THREE.Vector3(.13, .13, 0), .012, por, g); var hd = new THREE.Mesh(new THREE.TorusGeometry(.04, .008, 8, 16, Math.PI * 1.2), por); hd.rotation.z = Math.PI * .4; hd.position.set(-.075, .08, 0); add(hd, g, false);
      return g;
    }
    var laceTex = canvasTex(128, 128, function (x, w) { x.fillStyle = '#F4ECDD'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); x.globalCompositeOperation = 'destination-out'; for (var i = 0; i < 16; i++) { var a = i / 16 * 6.283; x.beginPath(); x.arc(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52, 7, 0, 7); x.fill(); x.beginPath(); x.arc(64 + Math.cos(a + .2) * 36, 64 + Math.sin(a + .2) * 36, 4, 0, 7); x.fill(); } x.beginPath(); x.arc(64, 64, 24, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(64, 64, 8, 0, 7); x.fill(); });
    function doily(x, y, z, r) { var m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshStandardMaterial({ map: laceTex, transparent: true, roughness: 1, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(x, y + .002, z); m.receiveShadow = true; scene.add(m); }
    function floorStack(x, z, ry, cols, y0) { var yy = y0 || 0; cols.forEach(function (c, i) { var h = .045 + (i % 2) * .03, w = .3 - i * .03, d = .22 - i * .015; var b = box(w, h, d, mat(c, { roughness: .6, bumpMap: velvetBump, bumpScale: .4 }), x + (i % 2 ? .01 : -.008), yy + h / 2 + .012, z, null, true, .02); b.rotation.y = ry + (i - 1) * .15; yy += h; }); return yy; }
    function sideTable(x, z) { model('side_table_tall_01', scene, { x: x, z: z, s: .84, env: .45 }); }   // top at .64, like before

    // left corner: armchair gets the realistic build; ottoman + blush pillow
    // (the chair itself is created at the original spot below)

    // right corner
    var arm2 = armchair(-.75, -5.0, Math.PI - .3, '#5C3526', '#6B3F2D');
    pillow(arm2, -.2, .7, .2, .44, .4, .15, '#EFE3CF', [-.25, .25, .12], 'plain'); pillow(arm2, .22, .66, .18, .38, .34, .13, '#C9A0A4', [-.35, -.2, -.1], 'velvet'); pillow(arm2, -.02, .62, .08, .32, .28, .12, '#E8DAC4', [-.6, .1, .2], 'floral');
        ottoman(-.05, -4.35, .4, '#5A3A2E');
    floorLamp(1.2, -5.25, 1.55);
    sideTable(.5, -5.2); doily(.5, .64, -5.2, .22); teacup(null, .62, .64, -5.08, 1, .3);
    flowerVase(null, .42, .64, -5.28, 1.1, 'peony', 'blush', .4);
    floorStack(2.55, -2.65, .5, ['#4A2B3A', '#26324A', '#8A4A50', '#3B4A3C']);
    floorStack(4.2, 2.3, -.3, ['#6B4A32', '#D9B3B0', '#2C3A55']);
    rug(3.35, -1.95, 2.6, 2.3, .45, { field: '#E3D3B8', border: '#7A3B42', accent: '#B88C5A', trim: '#F3EBDA', blush: '#D9979F', seed: 123 });
    leafPlant(4.45, 0, -3.65, 2.1, '#C9B79C', 26);

    // left corner extras: ottoman, pillow, a second throw
    ottoman(-4.05, 2.15, -.3, '#5A3A2E');
    rug(-3.75, 1.65, 2.9, 2.1, .3, { field: '#B98A8C', border: '#E8DCC4', accent: '#6E8068', trim: '#CDA85E', blush: '#F2D4D2', seed: 99 });
    flowerVase(null, TX + .18, .64, TZ - .1, 1.2, 'rose', 'cream', .2);

    // window seat dressing: layered pillows, blush flowers, teacup, books, throws
    [[-2.4, '#C98E94', -.08, 'velvet', .62], [-1.75, '#EADCC6', .06, 'knit', .56], [.9, '#8E9E86', -.06, 'velvet', .6], [1.75, '#9C5058', .08, 'plain', .58], [2.4, '#EBC9C6', -.05, 'floral', .6]].forEach(function (pl, k) { pillow(null, pl[0], WB + .36, Z0 + .26 + (k % 2) * .03, pl[4], .46, .17, pl[1], [-.2, 0, pl[2]], pl[3]); });
    [[-2.15, '#EFE3CF', .35, 'plain'], [-1.5, '#C8A0A4', -.3, 'velvet'], [1.35, '#E9D7C3', .3, 'knit'], [2.1, '#8E4A50', -.25, 'velvet']].forEach(function (pl, k) { pillow(null, pl[0], WB + .22, Z0 + .5, .36, .3, .13, pl[1], [-.9, 0, pl[2]], pl[3]); });
    ball(.15, mat('#D9A5A3', { roughness: 1, bumpMap: weaveBump, bumpScale: .6 }), -.65, WB + .2, Z0 + .34, 1, .8, .8);
    drape(null, -.95, WB + .17, Z0 + .54, .9, .55, 0, .2, knitM, .85);
    flowerVase(null, .22, .9, Z0 + .36, 1.25, 'peony', 'blush', .3);
    teacup(null, -.3, .9, Z0 + .52, 1.1, 2.4);
    floorStack(.62, Z0 + .5, .2, ['#26324A', '#7A4B52'], .9);
    throwOn(null, 1.15, .93, Z0 + .5, 0, 0, .35, .85, .55);

    // soft layers: sheepskins, smaller kilims over the big rugs, a folded knit blanket on the ottoman
    sheepskin(-3.95, 2.55, .5); sheepskin(2.9, -2.9, -.4);
    rug(-3.6, 1.95, 1.5, 1.0, .75, { field: '#2F4A46', border: '#B98A8C', accent: '#D9B979', trim: '#EFE3CE', blush: '#E8B9BA', seed: 211 }, .006);
    rug(3.2, -1.3, 1.4, 1.0, -.2, { field: '#7A3B42', border: '#E3D3B8', accent: '#C9A55C', trim: '#EFE3CE', blush: '#E0AEB0', seed: 313 }, .006);
    rug(.1, -2.4, 1.0, 1.5, .1, { field: '#3A2F4E', border: '#C9A0A4', accent: '#D6B26E', trim: '#EFE3CE', blush: '#E8B9BA', seed: 417 }, .006);
    drape(null, -4.05, .4, 2.15, .55, .5, 0, .4, knitM, .7);
    // contact shadows: furniture settles into the floor
    blob(0, .05, 3.0, 2.0, .42, 0);
    [[-.8, -5.6], [-.8, -4.8], [.8, -5.6], [.8, -4.8], [-.85, -1.1], [.85, -1.1]].forEach(function (p) { blob(p[0], p[1], .85, .85, .4); });
    blob(-3.25, 1.55, 1.7, 1.6, .5, .3); blob(-.75, -5.0, 1.7, 1.6, .5, -.3); blob(-.05, -4.35, .95, .85, .4); blob(-4.05, 2.15, .95, .85, .4);
    blob(.5, -5.2, .9, .9, .4); blob(-3.35, .25, .85, .85, .4); blob(3.6, -6.85, .9, .9, .4); blob(-4.25, 3.35, 1.2, 1.0, .4); blob(3.2, Z1 - .33, 2.2, .95, .45);
    blob(-4.9, 1.75, 1.6, 3.0, .35); blob(1.95, 1.0, 1.0, 2.3, .4);
    [[-1.35, Z0 + .55], [1.35, Z0 + .55], [X - .75, 2.0], [-1.9, Z1 - .5]].forEach(function (p) { blob(p[0], p[1], .8, .8, .35); });

    /* ---------- lights ---------- */
    var hemi = new THREE.HemisphereLight('#F0CDB0', '#3A281E', 1); scene.add(hemi);
    var sun = new THREE.DirectionalLight('#fff4e2', 1.4); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 12; sun.shadow.blurSamples = 20; sun.shadow.bias = -.0004;
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 9, bottom: -9, near: 1, far: 40 }); sun.target.position.set(0, 0, -2); scene.add(sun); scene.add(sun.target);
    var bounce = new THREE.PointLight('#FFB98A', .4, 14, 2); bounce.position.set(0, 2.2, 1.6); scene.add(bounce);
    var LP = {
      morning: { sky: '#E8C4AE', ground: '#3A2A20', hemi: .46, sun: '#F2C8A8', sunI: .55, pos: [2, 7, -18], lamp: 1.0, chand: .18, fairy: .3, patchO: .1, dust: .4, fog: '#2B2019', skyB: 2.4 },
      day:     { sky: '#EAD0BC', ground: '#3E2C22', hemi: .54, sun: '#F2D0B4', sunI: .65, pos: [1, 10, -16], lamp: .9, chand: .18, fairy: .25, patchO: .1, dust: .4, fog: '#30241C', skyB: 2.6 },
      golden:  { sky: '#D8A890', ground: '#2E2019', hemi: .33, sun: '#F2AE82', sunI: .42, pos: [-3, 4, -18], lamp: 1.2, chand: .16, fairy: .35, patchO: .08, dust: .45, fog: '#1F1611', skyB: 2.2 },
      night:   { sky: '#9C8CA8', ground: '#251A1A', hemi: .25, sun: '#A49CC8', sunI: .12, pos: [2, 9, -16], lamp: 1.35, chand: .16, fairy: .4, patchO: .02, dust: .3, fog: '#140E10', skyB: 1.7 }
    };
    floaters.forEach(function (g) { g.visible = false; });
    mark('prelights');
    (function mergeStatic() {                      // thousands of little static pieces become a few hundred draw calls
      scene.updateMatrixWorld(true);
      var keep = [platter, cat, starLan, booksGroup].concat(chands.map(function (c) { return c.group; }), lanterns.map(function (l) { return l.g; }));
      function topOf(o) { while (o.parent && o.parent !== scene) o = o.parent; return o; }
      var groups = {}, all = [];
      scene.traverse(function (o) {
        if (!o.isMesh || o.isInstancedMesh || o.visible === false || Array.isArray(o.material) || o.userData.book || o.userData.noMerge) return;
        if (o.parent === scene && !o.userData.mergeable) return;
        var top = topOf(o); if (keep.indexOf(top) >= 0 || (top.isMesh && !top.userData.mergeable)) return;
        var m = o.material; if (!m || m.transparent || m.isShaderMaterial || o.matrixWorld.determinant() <= 0) return;
        var g = o.geometry; if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
        var key = [m.uuid, o.userData.hot || '', o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, g.index ? 1 : 0, o.userData.noPick ? 1 : 0, Object.keys(g.attributes).join()].join('|');
        (groups[key] = groups[key] || []).push(o);
      });
      Object.keys(groups).forEach(function (k) {
        var g = groups[k]; if (g.length < 2) return;
        var geos = g.map(function (m) { var geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); return geo; }), big = null;
        try { big = THREE.mergeBufferGeometries(geos, false); } catch (e) { big = null; }
        geos.forEach(function (x) { x.dispose(); });
        if (!big) return;
        var mesh = new THREE.Mesh(big, g[0].material); mesh.castShadow = g[0].castShadow; mesh.receiveShadow = g[0].receiveShadow;
        if (g[0].userData.hot) mesh.userData.hot = g[0].userData.hot; if (g[0].userData.noPick) mesh.userData.noPick = true;
        scene.add(mesh); g.forEach(function (m) { if (m.parent) m.parent.remove(m); });
      });
    })();
    mark('merged');
    scene.traverse(function (o) { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && envMats.indexOf(o.material) < 0) envMats.push(o.material); });
    envMats.forEach(function (m) { if (m.metalness > .5 && m.color) { m.color.lerp(new THREE.Color('#6E5A3E'), .42); m.roughness = Math.max(m.roughness, .46); } });
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
      desk:    { label: 'Pomodoro timer',   at: [DX + .1, DY + .36, DZ - .02], target: [DX + .1, DY + .2, DZ - .02], from: [.45, 1.6, 1.5], w: .75, h: .6 },
      notebook: { label: 'Notebook',        at: [NBX, DY + .17, NBZ], target: [NBX, DY + .03, NBZ], from: [.35, 1.75, 1.5], w: 1.05, h: .8 },
      reading: { label: 'Reading list',     at: [DX - .7, DY + .34, DZ + .72], target: [DX - .7, DY + .1, DZ + .72], from: [-.5, 1.7, 1.5], w: .8, h: .6 },
      lamp:    { label: 'Desk lamp',        at: [al.x, al.y + .22, al.z] },
      candle:  { label: 'Candle',           at: [DX + .68, DY + .22, DZ + .68] },
      mug:     { label: 'Tea break',        at: [MX, DY + .26, MZ] },
      cat:     { label: 'Mochi',            at: [DX + .56, DY + .34, DZ + .18], target: [DX + .56, DY + .12, DZ + .18], from: [.7, 1.45, 1.25],     w: 1.1, h: .7 },
      shelf:   { label: 'Your study shelf', at: [1.85, 2.85, 1.0],  target: [2.0, 1.25, 1.0],   from: [.2, 1.5, .9],     w: 2.2, h: 2.7 },
      library: { label: 'The stacks',       at: [2.75, 2.85, -4.3], target: [2.75, 1.1, -4.3],  from: [.4, 1.5, -2.4],   w: 3.0, h: 2.4 },
      window:  { label: 'Window seat',      at: [0, 4.8, -7.8],     target: [0, 2.3, -8],       from: [0, 1.8, -3.5],    w: 6.8, h: 4.6 },
      chair:   { label: 'Fireside chair',   at: [-3.25, 1.5, 1.55], target: [-4.0, 1.0, 1.6],   from: [-1.6, 1.7, .8],   w: 3.4, h: 2.6 },
      music:   { label: 'Gramophone',       at: [-4.25, 1.85, 3.35], target: [-4.25, 1.0, 3.35], from: [-2.7, 1.6, 2.2], w: 1.6, h: 1.7 },
      board:   { label: 'Card catalog',     at: [3.2, 1.85, 3.6],   target: [3.2, .9, 3.6],     from: [3.3, 1.5, 1.2],   w: 2.6, h: 1.9 }
    };
    var spotsEl = $('#spots');
    Object.keys(HOT).forEach(function (id) {
      var h = HOT[id]; h.atV = new THREE.Vector3().fromArray(h.at);
      var b = document.createElement('button'); b.className = 'spot'; b.innerHTML = '<span class="dot"></span><span class="tag">' + h.label + '</span>';
      b.onclick = function () { api.onOpen(id); }; spotsEl.appendChild(b); h.el = b;
    });

    var move = null, offR = 0, offB = 0, offL = 0, wantR = 0, wantB = 0, wantL = 0, focused = null;
    function angTo(from, to) { var d = new THREE.Vector3().subVectors(to, from); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; }
    function nearAngle(a, ref) { while (a - ref > Math.PI) a -= Math.PI * 2; while (a - ref < -Math.PI) a += Math.PI * 2; return a; }
    function goTo(pos, yaw, pitch) { move = { p0: camera.position.clone(), p1: pos, y0: look.yaw, y1: nearAngle(yaw, look.yaw), q0: look.pitch, q1: pitch, start: performance.now(), dur: 1500 }; }
    function focus(id, cardW, cardH, mobile) {
      var h = HOT[id]; if (!h || !h.from) return;
      if (!focused) homeLook = { yaw: look.yaw, pitch: look.pitch };
      focused = id;
      wantR = mobile ? 0 : cardW + 40; wantB = mobile ? cardH + 24 : 0; var navEl = document.getElementById('nav'); wantL = mobile || !navEl ? 0 : Math.round(navEl.getBoundingClientRect().right + 8);
      fovT = baseFov;
      var w = stage.clientWidth, ht = stage.clientHeight, fh = ht + wantB, tanV = Math.tan(baseFov * Math.PI / 360);
      var fw0 = mobile ? h.w * .62 : h.w, fh0 = mobile ? h.h * .8 : h.h;
      var dist = Math.max(fw0 / (2 * tanV * (w - wantR - wantL) / fh), fh0 / (2 * tanV * (ht - wantB) / fh));
      var tgt = new THREE.Vector3().fromArray(h.target);
      var pos = new THREE.Vector3().fromArray(h.from).sub(tgt).setLength(dist).add(tgt);
      pos.x = Math.max(-X + .7, Math.min(X - .7, pos.x)); pos.z = Math.max(Z0 + .7, Math.min(Z1 - .5, pos.z)); pos.y = Math.max(1.0, Math.min(2.6, pos.y));
      var a = angTo(pos, tgt); goTo(pos, a.yaw, a.pitch);
    }
    function home() { focused = null; wantR = 0; wantB = 0; wantL = 0; fovT = baseFov; var l = homeLook || { yaw: 0, pitch: -.04 }; goTo(SEAT.clone(), l.yaw, l.pitch); }

    var canvas = renderer.domElement, ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), hovered = null, hotHover = null, needsPick = false;
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
    canvas.addEventListener('pointerleave', function () { hovered = null; hotHover = null; stage.classList.remove('hovering'); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); fovT = Math.max(32, Math.min(76, fovT * Math.exp(e.deltaY * .001))); }, { passive: false });
    window.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input, button, [role="dialog"]')) return;
      var k = { ArrowLeft: [.12, 0], ArrowRight: [-.12, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }[e.key];
      if (k) { e.preventDefault(); look.ty += k[0]; look.tp = Math.max(-1, Math.min(1, look.tp + k[1])); }
    });

    function applyView() { var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; var fw = w + offR + offL, fh = h + offB; camera.aspect = fw / fh; camera.setViewOffset(fw, fh, offR, offB, w, h); camera.updateProjectionMatrix(); }
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
    var lampOnB = true, candleOnB = true, lampK = 1, candleK = 1;
    function ease(u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function loop() {
      requestAnimationFrame(loop);
      var dt = Math.min(clk.getDelta(), .05), t = clk.elapsedTime, k = 1 - Math.exp(-dt * 2.5);
      var ko = 1 - Math.exp(-dt * 6);
      if (Math.abs(offR - wantR) > .5 || Math.abs(offB - wantB) > .5 || Math.abs(offL - wantL) > .5) { offR += (wantR - offR) * ko; offB += (wantB - offB) * ko; offL += (wantL - offL) * ko; applyView(); }
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
      skyMat.uniforms.uBright.value = cur.skyB; skyMat.uniforms.uTime.value = reduce ? 0 : t;
      ceil.material.color.setScalar(.3 + cur.hemi * .75);
      var lampI = Math.max(cur.lamp, focusing ? 1.6 : 0) * (focusing ? 1.2 : 1);
      lampK += ((lampOnB ? 1 : 0) - lampK) * (1 - Math.exp(-dt * 8)); lampLight.intensity = lampI * .9 * lampK; deskSpot.intensity = lampI * 2.5 * lampK;
      envMats.forEach(function (m) { m.envMapIntensity = (m.userData.env == null ? .3 : m.userData.env) * (.4 + cur.hemi * .6); });
      lampBulbs.forEach(function (m) { m.emissiveIntensity = .55 + cur.lamp * .5; }); shadeMats.forEach(function (m) { m.emissiveIntensity = .08 + cur.lamp * .12; });
      armBulb.emissiveIntensity = armBulb.emissiveIntensity * lampK + .03; armBulb.color.setRGB(.45 + .55 * lampK, .4 + .5 * lampK, .32 + .36 * lampK); armGlow.material.opacity = .32 * lampK;
      var flick = reduce ? 1 : .85 + Math.sin(t * 23) * .06 + Math.sin(t * 37) * .05;
      candles.forEach(function (c) { var f = reduce ? 1 : .8 + Math.sin(t * 9 + c.ph) * .12 + Math.sin(t * 17 + c.ph * 2) * .08; c.light.intensity = (.5 + cur.lamp * .6) * f; c.fl.scale.set(.8 * f, 1.9 * (.9 + (f - .8) * .8), .8 * f); c.glow.material.opacity = Math.min(.9, .55 * f + cur.lamp * .1); });
      candleK += ((candleOnB ? 1 : 0) - candleK) * (1 - Math.exp(-dt * 7)); candles.forEach(function (c) { c.light.intensity *= candleK; c.glow.material.opacity *= candleK; c.fl.visible = candleK > .03; c.fl.scale.multiplyScalar(Math.max(candleK, .01)); });
      lanterns.forEach(function (l) { if (!reduce) { l.g.rotation.y = Math.sin(t * .5 + l.ph) * .5; l.g.position.y = l.y + Math.sin(t * .8 + l.ph) * .035; } });
      shafts.forEach(function (m, i) { m.material.color.copy(cur.sun); m.material.opacity = (.02 + cur.patchO * .26) * (reduce ? 1 : .85 + Math.sin(t * .35 + i * 2) * .15); });
      chands.forEach(function (c) { c.light.intensity = cur.chand * 1.3 * dim; c.glow.material.opacity = .05; if (!reduce) c.group.position.y = 4.35 + Math.sin(t * .7 + c.ph) * .04; });
      cloudM.emissiveIntensity = .25 + cur.chand * .8;
      fairyMats.forEach(function (m, i) { m.emissiveIntensity = (.8 + cur.fairy) * (reduce ? 1 : .8 + Math.sin(t * 1.8 + i * 2.1) * .2); });
      fairyGlows.forEach(function (g, i) { g.material.opacity = Math.min(.65, cur.fairy * .16) * (reduce ? 1 : .8 + Math.sin(t * 1.8 + (i % 4) * 2.1) * .2); });
      patch.material.color.copy(cur.sun); patch.material.opacity = cur.patchO;
      fireLight.intensity = 1.8 * flick; fireCore.material.emissiveIntensity = 3.5 + flick * 2.5;
      flames.forEach(function (fl, fi) { var s2 = reduce ? 1 : .8 + Math.sin(t * (11 + fi * 3) + fi) * .25; fl.scale.set(.42 * s2, .66 * s2, 1); fl.position.y = .4 + (s2 - .8) * .2; });
      candleM.emissiveIntensity = 4 * flick; mantelGlow.scale.setScalar(.45 * flick);
      bounce.intensity = .2 + cur.chand * .15;
      // floating books bob and turn; bubbles drift up; sparkles twinkle
      floaters.forEach(function (g) { if (reduce) return; g.position.y = g.userData.y + Math.sin(t * .8 + g.userData.ph) * .12; g.rotation.y = t * .25 + g.userData.ph; g.rotation.z = Math.sin(t * .6 + g.userData.ph) * .12; });
      bubbles.forEach(function (b) { if (reduce) return; b.position.y += b.userData.v * dt; b.position.x += Math.sin(t * .9 + b.userData.ph) * .002; if (b.position.y > HH - .3) b.position.y = .2; b.material.opacity = .04 + cur.dust * .12; });
      sparkMat.uniforms.uT.value = t; sparkMat.uniforms.uAmp.value = .08 + cur.fairy * .1; sparkMat.uniforms.uStill.value = reduce ? 1 : 0; sparkMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
      steam.forEach(function (s) { s.userData.t = (s.userData.t + dt * .35) % 1; var uu = s.userData.t; s.position.set(MX + Math.sin(uu * 6 + s.id) * .025, DY + .16 + uu * .3, MZ); s.material.opacity = Math.sin(uu * Math.PI) * .16; s.scale.setScalar(.06 + uu * .09); });
      rainMat.opacity = rainLevel ? .2 + rainLevel * .5 : 0;
      if (rainLevel) rainDrops.forEach(function (d) { d.position.y -= d.userData.v * dt; if (d.position.y < WB) d.position.y = WB + WS + .6; });
      if (playing && !reduce) platter.rotation.y -= dt * 3.5;
      notes.forEach(function (n, i) { n.userData.t = (n.userData.t + dt * .28) % 1; var uu = n.userData.t; n.position.set(RX + .15 + Math.sin(uu * 5 + i * 2) * .18, 1.6 + uu * .8, RZ - .3); n.material.opacity = playing ? Math.sin(uu * Math.PI) * .9 : 0; });
      var br = reduce ? 0 : Math.sin(t * (focusing ? 1.4 : 1.9)) * .03;
      catBody.scale.set(1 + br * .3, 1 + br, 1 + br * .3);
      catHop = Math.max(0, catHop - dt * 1.4);
      head.position.y = HEADY + Math.sin(catHop * Math.PI) * .05; head.rotation.z = Math.sin(catHop * Math.PI) * .3;
      head.getWorldPosition(tmpV); var hx = tmpV.x, hy = tmpV.y, hz = tmpV.z;
      zzz.forEach(function (z) { z.userData.t = (z.userData.t + dt * .3) % 1; var uu = z.userData.t; z.position.set(hx + uu * .2, hy + .15 + uu * .38, hz - uu * .08); z.material.opacity = focusing && !catHop ? Math.sin(uu * Math.PI) * .95 : 0; z.scale.setScalar(.08 + uu * .1); });
      petT = Math.max(0, petT - dt * .45);
      hearts.forEach(function (hs, i) { hs.userData.t = (hs.userData.t + dt * .6) % 1; var uu = hs.userData.t; hs.position.set(hx - .08 + Math.sin(uu * 4 + i * 1.3) * .16, hy + .1 + uu * .5, hz + Math.cos(i * 2) * .1); hs.material.opacity = petT > 0 ? Math.sin(uu * Math.PI) * Math.min(1, petT * 2) : 0; });
      if (needsPick && !pointers.size) { needsPick = false; var o = pick(); hovered = o && o.userData.book ? o : null; hotHover = o ? (o.userData.book ? 'library' : o.userData.hot || null) : null; stage.classList.toggle('hovering', !!o); }
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
        var on = hotHover === id || focused === id; if (hs.on !== on) { hs.on = on; hs.el.classList.toggle('on', on); }
      });
    }
    mark('loop-start');
    loop();

    if (location.search.indexOf('perf') > -1) window.__nook = { info: function () { renderer.info.reset(); renderer.render(scene, camera); var i = renderer.info; var kinds = { mesh: 0, nested: 0, sprite: 0, instanced: 0, groupsLeaf: {} }; scene.traverse(function (o) { if (o.isSprite) kinds.sprite++; else if (o.isInstancedMesh) kinds.instanced++; else if (o.isMesh) { kinds.mesh++; if (o.parent !== scene) { kinds.nested++; var gk = o.geometry.type + ':' + (o.parent.children.length); kinds.groupsLeaf[o.geometry.type] = (kinds.groupsLeaf[o.geometry.type] || 0) + 1; } } }); return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, kinds: kinds }; } };
    var api = {
      onOpen: function () {}, onClose: function () {}, onBook: function () {},
      setTod: setTod, focus: focus, home: home,
      setFocus: function (v) { focusing = v; }, setRain: function (v) { rainLevel = v; }, setPlaying: function (v) { playing = v; },
      addBook: function (b) { placeBook(b, true); },
      setDeskClock: function (time, color, running, frac, label, sub) { frac = frac == null ? 1 : frac; if (deskClock.time === time && deskClock.color === color && deskClock.running === running && deskClock.frac === frac && deskClock.label === label && deskClock.sub === sub) return; deskClock.time = time; deskClock.color = color; deskClock.running = running; deskClock.frac = frac; deskClock.label = label || 'FOCUS'; deskClock.sub = sub || ''; redraw(dcTex); },
      toggleLamp: function () { lampOnB = !lampOnB; return lampOnB; }, toggleCandle: function () { candleOnB = !candleOnB; return candleOnB; },
      setNotebook: function (title, text, date, page, total) { NB.title = title || ''; NB.empty = !(title || text); NB.lines = (title ? [title] : []).concat(text ? nbWrap(text, 512 - 100) : []); NB.date = date || ''; NB.page = page || 1; NB.total = total || 1; redrawNB(); },
      setReduce: function (v) { reduce = !!v; },
      setQuality: function (q) { if (ssao) { ssao.enabled = q !== 'light'; plainPass.enabled = !ssao.enabled; } var d = window.devicePixelRatio || 1; DPR = q === 'light' ? 1 : q === 'balanced' ? Math.min(d, 1.25) : Math.min(d, 1.75); renderer.setPixelRatio(DPR); resize(); },
      pet: function () { petT = 1.6; catHop = 1; }, hello: function () { catHop = 1; }
    };
    return api;
  })();
  if (SCENE !== '3d') { var hl = document.querySelector('#hint .long'); if (hl) hl.textContent = 'Hover or tap things in the library to use them'; var hs = document.querySelector('#hint .short'); if (hs) hs.textContent = 'Tap things in the library'; }

  /* ---------- cards ---------- */
  var CARDS = {
    desk: ['Pomodoro timer', 'Settle in'], notebook: ['My Notes', 'Write something down'], goals: ['Study Goals', 'Today\u2019s intentions'], settings: ['Settings', 'Make it yours'],
    reading: ['Reading list', 'Currently reading'], music: ['Gramophone', 'Ambience'], chair: ['Fireside chair', 'Currently reading'],
    library: ['The stacks', 'Books you have read'], shelf: ['Your study shelf', 'Your study sessions'], board: ['Card catalog', 'October'],
    window: ['Arched window', 'Time of day'], cat: ['Mochi, the library cat', 'Hello, Mochi']
  };
  var FOCUS_IDS = { desk: 1, notebook: 1, reading: 1, music: 1, chair: 1, library: 1, shelf: 1, board: 1, window: 1, cat: 1 };      // pages that lean the camera over to an object
  var SECT = { reading: 'chair' }, NAVKEY = { chair: 'reading' };
  var SLUG = { notebook: 'notes', desk: 'timer', goals: 'goals', settings: 'settings', music: 'ambience', reading: 'reading', chair: 'chair', library: 'stacks', shelf: 'shelf', board: 'catalog', window: 'window', cat: 'mochi' }, BYSLUG = {};
  Object.keys(SLUG).forEach(function (k) { BYSLUG[SLUG[k]] = k; });
  var card = $('#card'), openId = null, mobileMQ = window.matchMedia('(max-width: 900px)');
  function setNav(id) { document.querySelectorAll('[data-go]').forEach(function (b) { if ((NAVKEY[id] || id || 'room') === b.dataset.go) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
  function setHash(id, replace) { var h = '#/' + (id ? SLUG[id] : 'room'); if (location.hash === h) return; try { (replace ? history.replaceState : history.pushState).call(history, null, '', h); } catch (e) { location.hash = h; } }
  function openCard(id, fromRoute) {
    if (id === 'lamp') { if (room) { var lo = room.toggleLamp(); toast(lo ? 'Desk lamp on' : 'Desk lamp off'); } return; }
    if (id === 'candle') { if (room) { var co = room.toggleCandle(); toast(co ? 'Candle lit' : 'Candle blown out'); } return; }
    if (id === 'mug') { teaBreak(); id = 'desk'; }
    if (!CARDS[id]) return;
    openId = id; card.dataset.page = id;
    $('#cardKicker').textContent = CARDS[id][0]; $('#cardTitle').textContent = CARDS[id][1];
    document.querySelectorAll('.sect').forEach(function (s) { s.hidden = s.dataset.sect !== (SECT[id] || id); });
    if (id === 'notebook') setTimeout(function () { var t = $('#nbText'); if (t && openId === 'notebook' && !mobileMQ.matches) t.focus(); }, 520);
    card.hidden = false; card.scrollTop = 0; document.body.classList.add('card-open');
    requestAnimationFrame(function () { card.classList.add('open'); });
    $('#spots').classList.add('away'); $('#hint').style.opacity = 0;
    $('#nav').classList.remove('sheet-open'); $('#navMore').setAttribute('aria-expanded', 'false');
    setNav(id); if (!fromRoute) setHash(id);
    if (room) { if (FOCUS_IDS[id]) room.focus(id, card.offsetWidth, card.offsetHeight + (mobileMQ.matches ? 76 : 0), mobileMQ.matches); else room.home(); }
    if (id === 'cat' && room) room.hello();
  }
  function closeCard(fromRoute) {
    if (!openId) return;
    openId = null; card.classList.remove('open'); document.body.classList.remove('card-open');
    setTimeout(function () { if (!openId) card.hidden = true; }, 350);
    $('#spots').classList.remove('away'); $('#hint').style.opacity = 1;
    setNav(null); if (fromRoute !== true) setHash(null, true);
    if (room) room.home();
  }
  $('#cardClose').onclick = function () { closeCard(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { $('#nav').classList.remove('sheet-open'); closeCard(); } });
  if (room) { room.onOpen = openCard; room.onClose = closeCard; room.onBook = function (b) { showBook(b); if (openId !== 'shelf') openCard('shelf'); }; }
  setNav(null);

  /* ---------- the library menu ---------- */
  document.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { var g = b.dataset.go; $('#nav').classList.remove('sheet-open'); $('#navMore').setAttribute('aria-expanded', 'false'); if (g === 'room') closeCard(); else openCard(g); }); });
  $('#navSubToggle').onclick = function () { var o = $('#nav').classList.toggle('sub-open'); this.setAttribute('aria-expanded', String(o)); };
  $('#navMore').onclick = function () { var o = $('#nav').classList.toggle('sheet-open'); this.setAttribute('aria-expanded', String(o)); };
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('#nav')) { $('#nav').classList.remove('sheet-open'); $('#navMore').setAttribute('aria-expanded', 'false'); } });
  $('#navCollapse').onclick = function () { S.nav = !S.nav; applySettings(); saveSettings(); };

  /* ---------- time of day ---------- */
  var todMode = 'auto', lastTod = null;
  function autoTod(h) { return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'golden' : 'night'; }
  function renderWelcome(now) {
    var h = now.getHours(), g = h >= 5 && h < 12 ? 'Good morning!' : h >= 12 && h < 17 ? 'Good afternoon!' : h >= 17 && h < 22 ? 'Good evening!' : 'Hello, night owl!';
    var Q = ['A little progress each day adds up to big results \u2661', 'Small steps, every day. You are doing lovely \u2661', 'One page at a time is still a whole book \u2661', 'Be gentle with yourself and keep going \u2661', 'Your future self will thank you for today \u2661', 'Slow and steady fills the shelves \u2661', 'Rest is part of the work, too \u2661'];
    var day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    var ge = $('#wGreet'), qe = $('#wQuote'); if (ge) ge.firstChild.textContent = g + ' '; if (qe) qe.textContent = Q[day % Q.length];
  }
  function applyTod() {
    var now = new Date(), tod = todMode === 'auto' ? autoTod(now.getHours()) : todMode; renderWelcome(now);
    document.documentElement.setAttribute('data-tod', tod);
    if (room && tod !== lastTod) room.setTod(tod);
    lastTod = tod;
    var label = { morning: 'good morning', day: 'a bright afternoon', golden: 'golden hour', night: 'a quiet night' }[tod];
    var clockStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('#clockText').textContent = clockStr + ' · ' + label; $('#navClock').textContent = clockStr + ' · ' + label;
    $('#todNow').textContent = todMode === 'auto' ? 'Live follows your clock. It is ' + clockStr + ', so the room shows ' + label + '.' : 'Showing ' + label + '. Pick Live to follow your clock again.';
  }
  function setTodMode(m, silent) { todMode = m; document.querySelectorAll('.tods .chip').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tod === m); }); applyTod(); if (!silent) saveSettings(); }
  document.querySelectorAll('.tods .chip').forEach(function (b) { b.onclick = function () { setTodMode(b.dataset.tod); }; });
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
    $('#time').textContent = fmt(remaining); $('#dialArc').style.strokeDashoffset = String(326.73 * (1 - remaining / (minutes * 60)));
    $('#startBtn').textContent = running ? 'Pause' : started ? 'Resume' : (minutes === 5 ? 'Start break' : 'Start focus');
    $('#timeSub').textContent = running ? (minutes === 5 ? 'stretch, sip some tea' : 'Mochi is keeping you company') : started ? 'paused' : 'ready when you are';
    $('#timerPill').hidden = !running && !started;
    var wt = $('#wTime'); if (wt) { wt.textContent = fmt(remaining); $('#wSub').textContent = (minutes === 5 ? 'Tea break' : subject.name) + ' \u00b7 ' + (running ? (minutes === 5 ? 'resting' : 'focusing') : started ? 'paused' : minutes + ' minutes'); var wp = $('#wPlay'); wp.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#' + (running ? 'i-pause' : 'i-play') + '"/></svg>'; wp.setAttribute('aria-label', running ? 'Pause' : started ? 'Resume' : 'Start'); $('#wTimerCard').classList.toggle('is-running', running); }
    $('#pillTime').textContent = fmt(remaining); $('#pillSub').textContent = minutes === 5 ? 'Break' : subject.name; $('#pillDot').style.background = subject.c[0];
    if (room) { room.setFocus(running && minutes !== 5); room.setDeskClock(fmt(remaining), minutes === 5 ? '#C98E94' : subject.c[0], running, remaining / (minutes * 60), minutes === 5 ? 'BREAK' : running ? 'FOCUS' : started ? 'PAUSED' : 'READY', minutes === 5 ? 'tea time' : subject.name); }
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
  $('#wPlay').onclick = function () { $('#startBtn').onclick(); };
  $('#wReset').onclick = function () { $('#resetBtn').onclick(); };
  render();

  /* ---------- record player: ambience ---------- */
  var CH = [{ id: 'rain', icon: 'i-rain', name: 'Rain', v: 50 }, { id: 'fire', icon: 'i-fire', name: 'Crackling fire', v: 30 }, { id: 'wind', icon: 'i-leaf', name: 'Wind', v: 0 }, { id: 'clock', icon: 'i-clock', name: 'Clock ticking', v: 0 }];
  var ac = null, gains = {}, playing = false;
  CH.forEach(function (c) {
    var row = document.createElement('div'); row.className = 'ch';
    row.innerHTML = '<span class="ic-wrap" aria-hidden="true"><svg class="ic"><use href="#' + c.icon + '"/></svg></span><div><label for="v-' + c.id + '">' + c.name + '</label><input type="range" id="v-' + c.id + '" min="0" max="100" value="' + c.v + '"></div><output id="o-' + c.id + '">' + c.v + '</output>';
    $('#mix').appendChild(row);
    row.querySelector('input').oninput = function (e) { c.v = +e.target.value; $('#o-' + c.id).textContent = c.v; setLevel(c); };
  });
  if (room) room.setRain(0);
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
  function setLevel(c) { if (c.id === 'rain' && room) room.setRain(playing ? c.v / 100 : 0); if (ac) gains[c.id].gain.setTargetAtTime((c.v / 100) * SCALE[c.id], ac.currentTime, .15); }
  $('#playBtn').onclick = function () {
    if (!ac) initAudio();
    playing = !playing; if (playing) ac.resume(); else ac.suspend();
    if (room) { room.setPlaying(playing); room.setRain(playing ? CH[0].v / 100 : 0); }
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
  /* ---------- tea break (the mug) ---------- */
  function teaBreak() {
    if (running) { toast('Pause your session first to take a tea break'); return; }
    minutes = 5; remaining = 300; render();
    document.querySelectorAll('#lengths .chip').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.min === '5'); });
    toast('Tea break: five quiet minutes');
  }

  /* ---------- notebook (saved in this browser) ---------- */
  var NBKEY = 'nook.notebook.v1', nb = { pages: [], cur: 0 }, nbTimer = null, delArmed = null;
  function newPage() { return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: '', text: '', created: Date.now() }; }
  try { var rawNb = JSON.parse(localStorage.getItem(NBKEY) || 'null'); if (rawNb && Array.isArray(rawNb.pages) && rawNb.pages.length) { nb = rawNb; nb.cur = Math.min(Math.max(0, nb.cur | 0), nb.pages.length - 1); } } catch (e) {}
  if (!nb.pages.length) nb.pages.push(newPage());
  function saveNb() { try { localStorage.setItem(NBKEY, JSON.stringify(nb)); $('#nbSaved').textContent = 'Saved'; } catch (e) { $('#nbSaved').textContent = 'Could not save here'; } }
  function nbDate(p) { return new Date(p.created).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); }
  function words(t) { var m = t.trim().match(/\S+/g); return m ? m.length : 0; }
  function renderNb() {
    var p = nb.pages[nb.cur];
    $('#nbTitle').value = p.title; $('#nbText').value = p.text;
    $('#nbPos').textContent = 'Page ' + (nb.cur + 1) + ' of ' + nb.pages.length; $('#nbDate').textContent = nbDate(p);
    $('#nbPrev').disabled = nb.cur === 0; $('#nbNext').disabled = nb.cur === nb.pages.length - 1;
    $('#nbCount').textContent = words(p.text) + (words(p.text) === 1 ? ' word' : ' words');
    $('#nbDelete').textContent = nb.pages.length === 1 && !p.text && !p.title ? 'Nothing to clear' : nb.pages.length === 1 ? 'Clear page' : 'Delete page'; delArmed = null;
    if (room) room.setNotebook(p.title, p.text, nbDate(p), nb.cur + 1, nb.pages.length);
  }
  function nbEdited() {
    var p = nb.pages[nb.cur]; p.title = $('#nbTitle').value; p.text = $('#nbText').value;
    $('#nbCount').textContent = words(p.text) + (words(p.text) === 1 ? ' word' : ' words'); $('#nbSaved').textContent = 'Saving...';
    if (room) room.setNotebook(p.title, p.text, nbDate(p), nb.cur + 1, nb.pages.length);
    clearTimeout(nbTimer); nbTimer = setTimeout(saveNb, 350);
  }
  $('#nbText').oninput = nbEdited; $('#nbTitle').oninput = nbEdited;
  $('#nbPrev').onclick = function () { if (nb.cur > 0) { nb.cur--; saveNb(); renderNb(); } };
  $('#nbNext').onclick = function () { if (nb.cur < nb.pages.length - 1) { nb.cur++; saveNb(); renderNb(); } };
  $('#nbNew').onclick = function () { var last = nb.pages[nb.pages.length - 1]; if (!last.text && !last.title) { nb.cur = nb.pages.length - 1; renderNb(); $('#nbText').focus(); return; } nb.pages.push(newPage()); nb.cur = nb.pages.length - 1; saveNb(); renderNb(); $('#nbText').focus(); };
  $('#nbDelete').onclick = function () {
    var p = nb.pages[nb.cur]; if (nb.pages.length === 1 && !p.text && !p.title) return;
    if (delArmed !== p.id) { delArmed = p.id; $('#nbDelete').textContent = 'Tap again to confirm'; setTimeout(function () { if (delArmed === p.id) { delArmed = null; renderNb(); } }, 3000); return; }
    if (nb.pages.length === 1) { p.title = ''; p.text = ''; } else { nb.pages.splice(nb.cur, 1); nb.cur = Math.min(nb.cur, nb.pages.length - 1); }
    saveNb(); renderNb(); toast('Page removed');
  };
  renderNb();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderNb(); render(); });
  /* ---------- saved in this browser ---------- */
  var store = { get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } } };
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  /* ---------- study goals ---------- */
  var GKEY = 'nook.goals.v1', goalsData = store.get(GKEY, { days: {} }), SUGGEST = ['Read a chapter', 'Revise my notes', 'One focus session', 'Tidy my desk'], gAllDone = false;
  if (!goalsData || !goalsData.days) goalsData = { days: {} };
  Object.keys(goalsData.days).forEach(function (k) { var age = (Date.now() - new Date(k + 'T12:00:00').getTime()) / 864e5; if (age > 120) delete goalsData.days[k]; });
  function gToday() { var k = dayKey(); return goalsData.days[k] || (goalsData.days[k] = []); }
  function gSave() { store.set(GKEY, goalsData); }
  function prevUnfinished() {
    var today = dayKey(), keys = Object.keys(goalsData.days).filter(function (k) { return k < today && goalsData.days[k].length; }).sort();
    if (!keys.length) return [];
    var have = gToday().map(function (g) { return g.text.toLowerCase(); });
    return goalsData.days[keys[keys.length - 1]].filter(function (g) { return !g.done && have.indexOf(g.text.toLowerCase()) < 0; });
  }
  function renderGoals() {
    var list = gToday(), done = list.filter(function (g) { return g.done; }).length;
    $('#gList').innerHTML = list.map(function (g) { return '<li class="goal' + (g.done ? ' done' : '') + '" data-id="' + g.id + '"><button class="tick" type="button" role="checkbox" aria-checked="' + g.done + '" aria-label="' + esc(g.text) + '"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></button><span class="g-text">' + esc(g.text) + '</span><button class="g-del" type="button" aria-label="Remove ' + esc(g.text) + '">\u00d7</button></li>'; }).join('');
    $('#gDone').textContent = done; $('#gTotal').textContent = list.length; $('#gBar').style.width = list.length ? (100 * done / list.length) + '%' : '0%';
    $('#gEmpty').hidden = list.length > 0;
    $('#gSuggest').innerHTML = SUGGEST.filter(function (t) { return !list.some(function (g) { return g.text.toLowerCase() === t.toLowerCase(); }); }).slice(0, 3).map(function (t) { return '<button class="chip" type="button" data-s="' + esc(t) + '">+ ' + esc(t) + '</button>'; }).join('');
    $('#gClear').disabled = !done; $('#gCarry').disabled = !prevUnfinished().length;
    $('#wGoalCount').textContent = done + ' / ' + list.length;
    $('#wGoals').innerHTML = list.length ? list.slice(0, 4).map(function (g) { return '<li class="' + (g.done ? 'done' : '') + '"><button type="button" class="w-tick" role="checkbox" aria-checked="' + g.done + '" data-id="' + g.id + '" aria-label="' + esc(g.text) + '"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></button><span>' + esc(g.text) + '</span></li>'; }).join('') + (list.length > 4 ? '<li class="more">+ ' + (list.length - 4) + ' more</li>' : '') : '<li class="empty-w">What would make today feel well spent?</li>';
    var all = list.length > 0 && done === list.length; if (all && !gAllDone) toast('Every goal for today is done. Well done!'); gAllDone = all;
  }
  function addGoal(text) {
    text = String(text || '').trim().slice(0, 80); var list = gToday(); if (!text) return;
    if (list.length >= 12) { toast('That is plenty for one day. Finish a few first.'); return; }
    list.push({ id: uid(), text: text, done: false }); gSave(); renderGoals();
  }
  $('#gForm').onsubmit = function (e) { e.preventDefault(); var inp = $('#gInput'); addGoal(inp.value); inp.value = ''; inp.focus(); };
  $('#gSuggest').onclick = function (e) { var b = e.target.closest('[data-s]'); if (b) addGoal(b.dataset.s); };
  $('#gList').onclick = function (e) {
    var li = e.target.closest('.goal'); if (!li) return; var list = gToday(), g = list.filter(function (x) { return x.id === li.dataset.id; })[0]; if (!g) return;
    if (e.target.closest('.tick')) { g.done = !g.done; gSave(); renderGoals(); }
    else if (e.target.closest('.g-del')) { goalsData.days[dayKey()] = list.filter(function (x) { return x !== g; }); gSave(); renderGoals(); }
  };
  $('#gCarry').onclick = function () { var u = prevUnfinished(), list = gToday(), room12 = 12 - list.length; u.slice(0, room12).forEach(function (g) { list.push({ id: uid(), text: g.text, done: false }); }); gSave(); renderGoals(); toast(u.length ? 'Carried over ' + Math.min(u.length, room12) + (u.length === 1 ? ' goal' : ' goals') : 'Nothing to carry over'); };
  $('#gClear').onclick = function () { goalsData.days[dayKey()] = gToday().filter(function (g) { return !g.done; }); gSave(); renderGoals(); };
  $('#gFocus').onclick = function () { openCard('desk'); };
  $('#wGoals').onclick = function (e) { var b = e.target.closest('.w-tick'); if (!b) return; var g = gToday().filter(function (x) { return x.id === b.dataset.id; })[0]; if (g) { g.done = !g.done; gSave(); renderGoals(); } };
  gAllDone = (function () { var l = gToday(); return l.length > 0 && l.every(function (g) { return g.done; }); })();
  renderGoals();


  /* ---------- settings ---------- */
  var SKEY = 'nook.settings.v1', S = Object.assign({ scene: 'painted', reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches, hint: true, quality: window.innerWidth <= 900 ? 'balanced' : 'crisp', len: 25, nav: false, tod: 'auto' }, store.get(SKEY, {}) || {});
  function saveSettings() { S.tod = todMode; store.set(SKEY, S); }
  function pressGroup(sel, attr, val) { document.querySelectorAll(sel + ' .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset[attr] === String(val))); }); }
  function applySettings() {
    if (room) { room.setReduce(S.reduce); room.setQuality(S.quality); }
    $('#hint').hidden = !S.hint; $('#nav').classList.toggle('rail', !!S.nav); $('#navCollapse').setAttribute('aria-pressed', String(!!S.nav)); $('#navCollapse').setAttribute('aria-label', S.nav ? 'Expand the menu' : 'Collapse the menu');
    $('#setMotion').checked = !!S.reduce; $('#setHint').checked = !!S.hint; pressGroup('#setQuality', 'q', S.quality); pressGroup('#setScene', 'scene', S.scene === '3d' ? '3d' : 'painted'); pressGroup('#setLen', 'len', S.len);
  }
  function applyDefaultLen() { if (running || remaining < minutes * 60 || minutes === 5) return; minutes = S.len; remaining = minutes * 60; document.querySelectorAll('#lengths .chip').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.min === String(minutes)); }); render(); }
  $('#setScene').onclick = function (e) { var b = e.target.closest('[data-scene]'); if (!b || b.dataset.scene === (S.scene === '3d' ? '3d' : 'painted')) return; S.scene = b.dataset.scene; applySettings(); saveSettings(); toast(S.scene === '3d' ? 'Opening the 3D library...' : 'Opening the painted library...'); setTimeout(function () { location.reload(); }, 700); };
  $('#setMotion').onchange = function () { S.reduce = this.checked; applySettings(); saveSettings(); };
  $('#setHint').onchange = function () { S.hint = this.checked; applySettings(); saveSettings(); };
  $('#setQuality').onclick = function (e) { var b = e.target.closest('[data-q]'); if (b) { S.quality = b.dataset.q; applySettings(); saveSettings(); } };
  $('#setLen').onclick = function (e) { var b = e.target.closest('[data-len]'); if (b) { S.len = +b.dataset.len; applySettings(); saveSettings(); applyDefaultLen(); } };
  $('#setExport').onclick = function () {
    var out = ['Nook notebook', 'Exported ' + new Date().toLocaleString(), ''];
    nb.pages.forEach(function (p, i) { out.push('--- Page ' + (i + 1) + (p.title ? ': ' + p.title : '') + ' (' + nbDate(p) + ') ---', p.text || '(blank)', ''); });
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/plain' })); a.download = 'nook-notebook.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); toast('Notebook exported');
  };
  var wipeArmed = false;
  $('#setWipe').onclick = function () {
    var btn = this; if (!wipeArmed) { wipeArmed = true; btn.textContent = 'Tap again to clear'; setTimeout(function () { wipeArmed = false; btn.textContent = 'Clear notebook'; }, 3000); return; }
    wipeArmed = false; btn.textContent = 'Clear notebook'; nb.pages = [newPage()]; nb.cur = 0; saveNb(); renderNb(); toast('Notebook cleared');
  };
  setTodMode(S.tod || 'auto', true); applySettings(); applyDefaultLen();

  /* ---------- addresses: #/notes, #/timer, #/goals ... so the back button and shared links work ---------- */
  function route() { var m = /^#\/([a-z]+)/.exec(location.hash), id = m && BYSLUG[m[1]]; if (id) { if (openId !== id) openCard(id, true); } else if (openId) closeCard(true); }
  window.addEventListener('popstate', route); window.addEventListener('hashchange', route);
  route();

  /* ---------- reveal the room once the first frames are up ---------- */
  requestAnimationFrame(function () { requestAnimationFrame(function () { var ld = $('#loader'); if (!ld) return; ld.classList.add('done'); setTimeout(function () { ld.remove(); }, 900); }); });
})();
