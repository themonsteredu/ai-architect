/* ===================================================================
   view3d.js  —  오프라인 360° 코벨문 입체 보기

   외부 라이브러리 없이 현재 2D 설계 데이터를 직육면체 면으로 변환해
   Canvas 2D에 원근 투영합니다. 설계·검증 계산은 읽기만 하며 바꾸지 않습니다.
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;
  var doc = global.document;

  var modal;
  var canvas;
  var ctx;
  var angleEl;
  var statusEl;
  var design = null;
  var yaw = -0.52;
  var pitch = 0.62;
  var dragging = false;
  var pointerId = null;
  var lastX = 0;
  var lastY = 0;
  var lastFocus = null;
  var animation = 0;
  var initialized = false;

  var TAU = Math.PI * 2;
  var PALETTES = {
    brick: {
      front: '#d56b48', back: '#752716', left: '#a94128', right: '#87301d',
      top: '#f1a07d', bottom: '#4f190f'
    },
    fixed: {
      front: '#7d8b85', back: '#3e4b46', left: '#5e6c66', right: '#4f5e58',
      top: '#aeb9b3', bottom: '#293630'
    },
    slab: {
      front: '#263b37', back: '#182a26', left: '#20332f', right: '#1b2e2a',
      top: '#3a534c', bottom: '#203530'
    }
  };

  function init() {
    if (initialized) return;
    modal = doc.getElementById('view3d-modal');
    canvas = doc.getElementById('view3d-canvas');
    angleEl = doc.getElementById('view3d-angle');
    statusEl = doc.getElementById('view3d-status');
    if (!modal || !canvas) return;

    ctx = canvas.getContext('2d');
    if (!ctx) return;

    doc.getElementById('btn-3d-close').onclick = close;
    doc.getElementById('btn-3d-reset').onclick = function () { animateTo(0, 0.62); };
    doc.getElementById('btn-3d-left').onclick = function () { animateTo(yaw - Math.PI / 4, pitch); };
    doc.getElementById('btn-3d-right').onclick = function () { animateTo(yaw + Math.PI / 4, pitch); };

    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('lostpointercapture', onPointerUp);

    global.addEventListener('resize', scheduleDraw);
    doc.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape' || e.keyCode === 27) close();
      if (e.key === 'ArrowLeft' || e.keyCode === 37) animateTo(yaw - Math.PI / 12, pitch);
      if (e.key === 'ArrowRight' || e.keyCode === 39) animateTo(yaw + Math.PI / 12, pitch);
      if (e.key === 'ArrowUp' || e.keyCode === 38) animateTo(yaw, clamp(pitch + 0.1, 0.1, 1.08));
      if (e.key === 'ArrowDown' || e.keyCode === 40) animateTo(yaw, clamp(pitch - 0.1, 0.1, 1.08));
    });
    initialized = true;
  }

  function open(nextDesign, opts) {
    init();
    if (!initialized || !nextDesign) return;
    design = nextDesign;
    lastFocus = doc.activeElement;
    dragging = false;
    yaw = -0.52;
    pitch = 0.62;

    var ok = opts && opts.status === 'ok';
    statusEl.textContent = ok ? '✓ 구조 검증 통과' : '○ 안전함 · 아직 설계 중';
    statusEl.className = 'view3d-status' + (ok ? '' : ' warn');
    modal.classList.add('open');
    doc.body.classList.add('view3d-open');
    global.requestAnimationFrame(function () {
      draw();
      doc.getElementById('btn-3d-close').focus();
    });
  }

  function close() {
    if (!modal) return;
    dragging = false;
    if (animation) global.cancelAnimationFrame(animation);
    animation = 0;
    modal.classList.remove('open');
    doc.body.classList.remove('view3d-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    pointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.classList.add('is-dragging');
    if (canvas.setPointerCapture) canvas.setPointerCapture(pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging || (pointerId !== null && e.pointerId !== pointerId)) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw += dx * 0.018;
    pitch = clamp(pitch - dy * 0.011, 0.1, 1.08);
    draw();
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!dragging || (pointerId !== null && e.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;
    canvas.classList.remove('is-dragging');
  }

  function animateTo(targetYaw, targetPitch) {
    if (!design) return;
    if (animation) global.cancelAnimationFrame(animation);
    var startYaw = yaw;
    var startPitch = pitch;
    var started = null;
    function step(now) {
      if (started === null) started = now;
      var t = Math.min(1, (now - started) / 240);
      var eased = 1 - Math.pow(1 - t, 3);
      yaw = startYaw + (targetYaw - startYaw) * eased;
      pitch = startPitch + (targetPitch - startPitch) * eased;
      draw();
      if (t < 1) animation = global.requestAnimationFrame(step);
      else animation = 0;
    }
    animation = global.requestAnimationFrame(step);
  }

  function scheduleDraw() {
    if (!modal || !modal.classList.contains('open')) return;
    global.requestAnimationFrame(draw);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function addCuboid(list, x, y, z, w, h, d, type, id) {
    list.push({ x: x, y: y, z: z, w: w, h: h, d: d, type: type, id: id || 0 });
  }

  function buildScene() {
    var cuboids = [];
    var cell = CONFIG.cellMm;
    var row = CONFIG.rowMm;
    var depthUnit = CONFIG.wytheMm;
    var minX = Infinity;
    var maxX = -Infinity;
    var maxY = row;
    var maxZ = depthUnit;
    var gap = Math.max(0.18, Math.min(cell, row, depthUnit) * 0.055);

    for (var i = 0; i < design.bricks.length; i++) {
      var b = design.bricks[i];
      var sp = M.spans(b.orient);
      var x = b.x * cell;
      var y = b.y * row;
      var w = sp.w * cell;
      var h = sp.h * row;
      var type = b.fixed ? 'fixed' : 'brick';

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);

      if (b.orient === 'head') {
        var headDepth = Math.min(CONFIG.brickLength, depthUnit * CONFIG.maxWythes);
        addCuboid(cuboids, x + gap / 2, y + gap / 2, gap / 2,
          Math.max(0.5, w - gap), Math.max(0.5, h - gap), Math.max(0.5, headDepth - gap), type, b.id);
        maxZ = Math.max(maxZ, headDepth);
      } else {
        var wythes = M.wythesOf(b);
        for (var zc = 0; zc < wythes; zc++) {
          addCuboid(cuboids, x + gap / 2, y + gap / 2, zc * depthUnit + gap / 2,
            Math.max(0.5, w - gap), Math.max(0.5, h - gap), Math.max(0.5, depthUnit - gap), type, b.id * 3 + zc);
        }
        maxZ = Math.max(maxZ, wythes * depthUnit);
      }
    }

    if (!isFinite(minX)) { minX = 0; maxX = CONFIG.boardWidth; }
    var modelW = Math.max(cell * 4, maxX - minX);
    var slabW = Math.min(CONFIG.boardWidth, modelW + cell * 2);
    var slabD = Math.min(CONFIG.boardDepth, Math.max(maxZ + depthUnit * 3, depthUnit * 5));
    var centerX = (minX + maxX) / 2;
    var centerZ = maxZ / 2;
    addCuboid(cuboids, centerX - slabW / 2, -row * 0.28, centerZ - slabD / 2,
      slabW, row * 0.22, slabD, 'slab', -1);

    return { cuboids: cuboids, centerX: centerX, centerY: maxY * 0.46, centerZ: centerZ };
  }

  function verticesOf(c) {
    var x = c.x, y = c.y, z = c.z, x2 = x + c.w, y2 = y + c.h, z2 = z + c.d;
    return [
      { x: x, y: y, z: z }, { x: x2, y: y, z: z },
      { x: x2, y: y2, z: z }, { x: x, y: y2, z: z },
      { x: x, y: y, z: z2 }, { x: x2, y: y, z: z2 },
      { x: x2, y: y2, z: z2 }, { x: x, y: y2, z: z2 }
    ];
  }

  function cameraPoint(p, scene) {
    var x = p.x - scene.centerX;
    var y = p.y - scene.centerY;
    var z = p.z - scene.centerZ;
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var rx = x * cy - z * sy;
    var rz = x * sy + z * cy;
    return {
      x: rx,
      y: y * cp + rz * sp,
      z: -y * sp + rz * cp
    };
  }

  function project(p) {
    var focal = 430;
    var factor = focal / Math.max(80, focal + p.z);
    return { x: p.x * factor, y: -p.y * factor, z: p.z };
  }

  function normalZ(points, ids) {
    var a = points[ids[0]], b = points[ids[1]], c = points[ids[2]];
    var abx = b.x - a.x, aby = b.y - a.y;
    var acx = c.x - a.x, acy = c.y - a.y;
    return abx * acy - aby * acx;
  }

  function colorVariation(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp((n >> 16) + amount, 0, 255);
    var g = clamp(((n >> 8) & 255) + amount, 0, 255);
    var b = clamp((n & 255) + amount, 0, 255);
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function draw() {
    if (!ctx || !design || !modal.classList.contains('open')) return;
    var width = Math.max(1, canvas.clientWidth);
    var height = Math.max(1, canvas.clientHeight);
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var targetW = Math.round(width * dpr);
    var targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var scene = buildScene();
    var faces = [];
    var bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    var definitions = [
      { name: 'front', ids: [0, 3, 2, 1] },
      { name: 'back', ids: [4, 5, 6, 7] },
      { name: 'right', ids: [1, 2, 6, 5] },
      { name: 'left', ids: [0, 4, 7, 3] },
      { name: 'top', ids: [3, 7, 6, 2] },
      { name: 'bottom', ids: [0, 1, 5, 4] }
    ];

    for (var i = 0; i < scene.cuboids.length; i++) {
      var cuboid = scene.cuboids[i];
      var source = verticesOf(cuboid);
      var camera = [];
      var screen = [];
      for (var v = 0; v < source.length; v++) {
        camera[v] = cameraPoint(source[v], scene);
        screen[v] = project(camera[v]);
        /* 받침판이 아니라 실제 벽돌을 기준으로 화면을 꽉 채웁니다. */
        if (cuboid.type !== 'slab') {
          bounds.minX = Math.min(bounds.minX, screen[v].x);
          bounds.maxX = Math.max(bounds.maxX, screen[v].x);
          bounds.minY = Math.min(bounds.minY, screen[v].y);
          bounds.maxY = Math.max(bounds.maxY, screen[v].y);
        }
      }

      for (var f = 0; f < definitions.length; f++) {
        var def = definitions[f];
        if (normalZ(screen, def.ids) >= 0) continue;
        var depth = 0;
        for (var q = 0; q < def.ids.length; q++) depth += camera[def.ids[q]].z;
        faces.push({
          points: screen,
          ids: def.ids,
          depth: depth / def.ids.length,
          name: def.name,
          type: cuboid.type,
          id: cuboid.id
        });
      }
    }

    var spanX = Math.max(1, bounds.maxX - bounds.minX);
    var spanY = Math.max(1, bounds.maxY - bounds.minY);
    var padX = width < 520 ? 38 : 52;
    var padY = height < 500 ? 52 : 82;
    var scale = Math.min((width - padX) / spanX, (height - padY) / spanY);
    var ox = width / 2 - (bounds.minX + bounds.maxX) * scale / 2;
    var oy = height / 2 - (bounds.minY + bounds.maxY) * scale / 2 - 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.72, Math.min(width * 0.25, 220), Math.min(height * 0.045, 25), 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* 받침판은 먼저 그려 불투명해도 구조물을 가리지 않게 한다 */
    faces.sort(function (a, b) {
      if (a.type === 'slab' && b.type !== 'slab') return -1;
      if (a.type !== 'slab' && b.type === 'slab') return 1;
      return b.depth - a.depth;
    });
    for (var j = 0; j < faces.length; j++) drawFace(faces[j], scale, ox, oy);

    var deg = Math.round((((yaw % TAU) + TAU) % TAU) * 180 / Math.PI);
    angleEl.textContent = deg + '°';
    canvas.setAttribute('aria-label', '코벨문 3D 모형, 현재 회전 각도 ' + deg + '도. 손가락으로 밀어 회전할 수 있습니다.');
  }

  function drawFace(face, scale, ox, oy) {
    var pts = [];
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < face.ids.length; i++) {
      var p = face.points[face.ids[i]];
      var sp = { x: ox + p.x * scale, y: oy + p.y * scale };
      pts.push(sp);
      minX = Math.min(minX, sp.x); maxX = Math.max(maxX, sp.x);
      minY = Math.min(minY, sp.y); maxY = Math.max(maxY, sp.y);
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();

    var palette = PALETTES[face.type] || PALETTES.brick;
    var variation = face.type === 'brick' ? ((Math.abs(face.id) % 5) - 2) * 2 : 0;
    var base = colorVariation(palette[face.name], variation);
    var gradient = ctx.createLinearGradient(minX, minY, maxX, maxY);
    gradient.addColorStop(0, base);
    gradient.addColorStop(1, colorVariation(palette[face.name], variation - 6));
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = face.type === 'slab' ? 1.35 : 1.45;
    ctx.strokeStyle = face.type === 'slab'
      ? 'rgba(7,18,15,.92)'
      : (face.type === 'fixed' ? 'rgba(29,43,38,.92)' : 'rgba(54,17,9,.92)');
    ctx.stroke();
    ctx.restore();

    if (face.name === 'top' && face.type !== 'slab') {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y + 1);
      ctx.lineTo(pts[1].x, pts[1].y + 1);
      ctx.strokeStyle = face.type === 'fixed' ? 'rgba(229,239,233,.3)' : 'rgba(255,235,222,.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  App.View3D = { open: open, close: close };

})(window);
