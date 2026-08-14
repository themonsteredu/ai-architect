/* ===================================================================
   app.js  —  설계 화면 (학생용 메인)

   - 정면에서 본 2D 격자 위에 벽돌을 클릭해서 놓음
   - 놓을 수 있는 자리는 초록색, 나머지는 클릭해도 안 놓아짐 (이유를 알려줌)
   - 상단에 사용량 표시,  60장을 넘으면 더 놓을 수 없음
   - 무게중심 세로 점선 (범위 안이면 초록, 벗어나면 빨강)
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;
  var Rules = App.Rules;
  var doc = global.document;

  var el = {};
  var state = {
    design: null,
    orient: 'lie',
    wythes: 2,
    tool: 'place',
    history: [],
    spots: [],
    cellPx: 30,
    rowPx: 30,
    busy: false,
    hint: null,
    elsById: {},
    lastResult: null
  };

  /* =================================================================
     시작
     ================================================================= */
  function boot() {
    el.usage = doc.getElementById('usage');
    el.usageBar = doc.getElementById('usage-bar');
    el.board = doc.getElementById('board');
    el.stage = doc.getElementById('stage');
    el.msg = doc.getElementById('msg');
    el.result = doc.getElementById('result');
    el.aesthetics = doc.getElementById('aesthetics');
    el.startModal = doc.getElementById('start-modal');
    el.bpModal = doc.getElementById('blueprint-modal');
    el.bpBody = doc.getElementById('blueprint-body');
    el.ratioWarn = doc.getElementById('ratio-warn');
    el.answerBtn = doc.getElementById('btn-answer');
    el.answerBadge = doc.getElementById('answer-badge');
    el.hintNote = doc.getElementById('hint-note');

    bindToolbar();
    bindTopbar();
    bindBoard();

    global.addEventListener('resize', function () { if (state.design) render(); });
    CONFIG.onChange(refreshChrome);

    refreshChrome();
    showStart();
  }

  /* 설정이 바뀌었을 때 화면 위쪽 정보 갱신 */
  function refreshChrome() {
    var w = CONFIG.ratioWarning;
    el.ratioWarn.textContent = w || '';
    el.ratioWarn.style.display = w ? '' : 'none';
    el.answerBtn.style.display = CONFIG.showAnswer ? '' : 'none';
  }

  /* =================================================================
     기초 고르기 화면
     ================================================================= */
  function showStart() {
    var list = App.Foundation.list();
    var h = ['<div class="modal-box modal-wide start-shell">',
      '<section class="architect-cover" id="architect-cover">',
      '<div class="architect-cover-copy">',
      '<span class="architect-cover-kicker">MIDDLE SCHOOL · CAREER EXPERIENCE</span>',
      '<p class="architect-cover-role">오늘의 직업 <b>건축가</b></p>',
      '<h1>벽돌의 균형으로<br><em>문을 설계하다</em></h1>',
      '<p class="architect-cover-desc">도면을 읽고, 구조를 실험하고, 실제 미니 벽돌로 완성하는 코벨문 건축 프로젝트</p>',
      '<div class="architect-cover-tags"><span>STRUCTURE</span><span>BALANCE</span><span>BLUEPRINT</span></div>',
      '<button class="btn btn-primary architect-cover-start" id="btn-cover-start" type="button">설계 시작하기 <span>→</span></button>',
      '</div>',
      '<div class="architect-cover-art" aria-hidden="true">' + architectCoverArt() + '</div>',
      '<div class="architect-cover-no">ARCHITECT LAB · PROJECT 01</div>',
      '</section>',
      '<section class="foundation-select" id="foundation-select" hidden>',
      '<h2>어떤 문으로 시작할까요?</h2>',
      '<p class="modal-desc">기초 2단은 미리 깔아 드립니다. 아래 그림은 <b>완성 예시가 아니라 시작 상태</b>입니다. 여기서부터 각자의 방법으로 문을 닫아 보세요.</p>',
      '<div class="preset-grid">'];

    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      h.push('<button class="preset" data-fid="' + f.id + '">' +
        '<div class="preset-art">' + presetArt(f) + '</div>' +
        '<div class="preset-name">' + f.name + '</div>' +
        '<div class="preset-desc">' + f.desc + '</div>' +
        '<div class="preset-meta">문 폭 ' + f.openMm + 'mm · 기초 ' + f.bricks + '장 · 남는 벽돌 ' + (CONFIG.maxBricks - f.bricks) + '장</div>' +
        '</button>');
    }
    h.push('</div>');
    h.push('<p class="modal-foot">벽돌 ' + CONFIG.brickLabel + ' · 1인당 ' + CONFIG.maxBricks + '장 · 받침판 ' + CONFIG.boardLabel + '</p>');
    h.push('</section>');
    h.push('</div>');

    el.startModal.innerHTML = h.join('');
    el.startModal.classList.add('open');

    el.startModal.onclick = function (e) {
      var coverBtn = e.target.closest ? e.target.closest('#btn-cover-start') : null;
      if (coverBtn) {
        doc.getElementById('architect-cover').hidden = true;
        doc.getElementById('foundation-select').hidden = false;
        el.startModal.scrollTop = 0;
        var firstPreset = el.startModal.querySelector('.preset');
        if (firstPreset) firstPreset.focus();
        return;
      }
      var btn = e.target.closest ? e.target.closest('.preset') : null;
      if (!btn) return;
      startWith(btn.getAttribute('data-fid'));
    };
  }

  function architectCoverArt() {
    return '<svg viewBox="0 0 520 430" role="img" aria-label="벽돌 코벨문 건축 도면">' +
      '<defs>' +
      '<pattern id="cover-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#89aab2" stroke-opacity=".16" stroke-width="1"/></pattern>' +
      '<linearGradient id="cover-brick" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e28a68"/><stop offset="1" stop-color="#a9452d"/></linearGradient>' +
      '<linearGradient id="cover-top" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0b39a"/><stop offset="1" stop-color="#cc6d4e"/></linearGradient>' +
      '</defs>' +
      '<rect width="520" height="430" rx="18" fill="#122f39"/><rect width="520" height="430" rx="18" fill="url(#cover-grid)"/>' +
      '<path d="M48 350L258 247l214 104-212 54z" fill="#0b2027" stroke="#7b9aa2" stroke-opacity=".42" stroke-width="2"/>' +
      '<g stroke="#6d2a1b" stroke-width="2">' +
      '<path d="M94 316l73-36 0 40-73 36z" fill="url(#cover-brick)"/><path d="M167 280l28 14v39l-28-13z" fill="#87301f"/><path d="M94 316l73-36 28 14-73 36z" fill="url(#cover-top)"/>' +
      '<path d="M111 270l73-36v40l-73 36z" fill="url(#cover-brick)"/><path d="M184 234l28 14v39l-28-13z" fill="#87301f"/><path d="M111 270l73-36 28 14-73 36z" fill="url(#cover-top)"/>' +
      '<path d="M137 226l73-36v40l-73 36z" fill="url(#cover-brick)"/><path d="M210 190l28 14v39l-28-13z" fill="#87301f"/><path d="M137 226l73-36 28 14-73 36z" fill="url(#cover-top)"/>' +
      '<path d="M426 316l-73-36v40l73 36z" fill="url(#cover-brick)"/><path d="M353 280l-28 14v39l28-13z" fill="#87301f"/><path d="M426 316l-73-36-28 14 73 36z" fill="url(#cover-top)"/>' +
      '<path d="M409 270l-73-36v40l73 36z" fill="url(#cover-brick)"/><path d="M336 234l-28 14v39l28-13z" fill="#87301f"/><path d="M409 270l-73-36-28 14 73 36z" fill="url(#cover-top)"/>' +
      '<path d="M383 226l-73-36v40l73 36z" fill="url(#cover-brick)"/><path d="M310 190l-28 14v39l28-13z" fill="#87301f"/><path d="M383 226l-73-36-28 14 73 36z" fill="url(#cover-top)"/>' +
      '<path d="M210 190l75-37 46 22-76 38z" fill="url(#cover-top)"/><path d="M210 190l45 23v40l-45-23z" fill="#bb5439"/><path d="M255 213l76-38v40l-76 38z" fill="#8f3422"/>' +
      '</g>' +
      '<g fill="none" stroke="#a9d8df" stroke-width="1.5" stroke-dasharray="6 6" opacity=".8"><path d="M68 374H454"/><path d="M68 366v16M454 366v16"/><path d="M260 72v274"/></g>' +
      '<g fill="#c9e1e5" font-family="sans-serif" font-size="12" font-weight="700"><text x="220" y="62">CENTER LINE</text><text x="211" y="400">150 mm BASE</text></g>' +
      '<circle cx="260" cy="72" r="5" fill="#dc7656"/>' +
      '</svg>';
  }

  /* 기초 미리보기 그림 */
  function presetArt(f) {
    var image = f.id === 'wide' ? 'wide' : (f.id === 'strong' ? 'strong' : 'narrow');
    return '<img src="assets/corbel-foundations/' + image + '.png" alt="' + f.name + '의 기초 2단 입체 시작 상태" draggable="false">' +
      '<span class="preset-art-badge">기초 2단 · 정답 아님</span>';
  }

  function startWith(fid) {
    state.design = App.Foundation.create(fid);
    state.history = [];
    state.hint = null;
    state.lastResult = null;
    el.startModal.classList.remove('open');
    clearResult();
    showMessage('기초 2단이 깔렸습니다. 초록색 자리를 눌러 벽돌을 놓아 보세요.', 'info');
    render();
  }

  /* =================================================================
     도구 모음
     ================================================================= */
  function bindToolbar() {
    doc.getElementById('toolbar').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;

      if (b.hasAttribute('data-orient')) { state.orient = b.getAttribute('data-orient'); state.tool = 'place'; }
      else if (b.hasAttribute('data-wythes')) { state.wythes = parseInt(b.getAttribute('data-wythes'), 10); state.tool = 'place'; }
      else if (b.hasAttribute('data-tool')) { state.tool = b.getAttribute('data-tool'); }
      else if (b.id === 'btn-undo') { undo(); return; }
      else if (b.id === 'btn-hint') { doHint(); return; }
      else if (b.id === 'btn-restart') { restart(); return; }
      render();
    });
  }

  function bindTopbar() {
    doc.getElementById('btn-check').onclick = doValidate;
    doc.getElementById('btn-blueprint').onclick = function () { openBlueprint(state.design, false); };
    doc.getElementById('btn-answer').onclick = openAnswer;
    doc.getElementById('btn-settings').onclick = function () {
      App.Settings.open(function (r) {
        refreshChrome();
        if (r && r.restart) showStart(); else render();
      });
    };
    doc.getElementById('btn-print').onclick = function () { global.print(); };
    doc.getElementById('btn-bp-close').onclick = function () { el.bpModal.classList.remove('open'); };
    doc.getElementById('btn-sound').onclick = function (e) {
      var muted = !App.Sound.isMuted();
      App.Sound.setMuted(muted);
      e.currentTarget.textContent = muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐';
    };
  }

  /* =================================================================
     격자 그리기
     ================================================================= */
  function layout() {
    var cols = CONFIG.cols;
    var ratio = CONFIG.rowMm / CONFIG.cellMm;

    /* 화면에 보여줄 단 수 — 쌓은 높이에 맞춰 늘어납니다.
       (빈 하늘을 크게 두면 벽돌이 작아져서 태블릿에서 누르기 어렵습니다) */
    var top = state.design ? M.topRow(state.design) : 1;
    state.visRows = Math.max(7, Math.min(CONFIG.rows, top + 5));

    var availW = Math.max(200, el.stage.clientWidth - 28);
    var availH = Math.max(200, el.stage.clientHeight - 56);
    var byW = Math.floor(availW / cols);
    var byH = Math.floor(availH / (state.visRows * ratio));
    var cell = Math.max(12, Math.min(46, Math.min(byW, byH)));
    state.cellPx = cell;
    state.rowPx = Math.max(10, Math.round(cell * ratio));
  }

  function render() {
    if (!state.design) return;
    layout();

    var cols = CONFIG.cols;
    var cw = state.cellPx, ch = state.rowPx;
    var design = state.design;

    el.board.style.width = (cols * cw) + 'px';
    el.board.style.height = (state.visRows * ch) + 'px';
    el.board.style.backgroundSize = cw + 'px ' + ch + 'px';

    state.spots = [];
    if (state.tool === 'place') {
      var all = Rules.allSpots(design, state.orient, state.wythes);
      for (var q = 0; q < all.length; q++) {
        if (all[q].y + all[q].h <= state.visRows) state.spots.push(all[q]);
      }
    }

    var h = [];

    /* 문 자리 표시 */
    var op = design.meta.opening;
    h.push('<div class="door-mark" style="left:' + (op[0] * cw) + 'px;width:' + ((op[1] - op[0] + 1) * cw) + 'px"><span>문</span></div>');

    /* 놓을 수 있는 자리 */
    for (var i = 0; i < state.spots.length; i++) {
      var s = state.spots[i];
      h.push('<div class="spot" style="left:' + (s.x * cw) + 'px;bottom:' + (s.y * ch) + 'px;width:' + (s.w * cw) + 'px;height:' + (s.h * ch) + 'px"></div>');
    }

    /* 벽돌 */
    for (var j = 0; j < design.bricks.length; j++) {
      var b = design.bricks[j];
      var sp = M.spans(b.orient);
      var cls = ['brick'];
      cls.push(M.wythesOf(b) >= 2 ? 'w2' : 'w1');
      if (b.orient === 'head') cls.push('head');
      if (b.fixed) cls.push('fixed');
      h.push('<div class="' + cls.join(' ') + '" data-id="' + b.id + '" style="left:' + (b.x * cw) + 'px;bottom:' + (b.y * ch) +
             'px;width:' + (sp.w * cw) + 'px;height:' + (sp.h * ch) + 'px"></div>');
    }

    /* 힌트 */
    if (state.hint) {
      var hs = M.spans(state.hint.orient);
      h.push('<div class="hint-spot" style="left:' + (state.hint.x * cw) + 'px;bottom:' + (state.hint.y * ch) +
             'px;width:' + (hs.w * cw) + 'px;height:' + (hs.h * ch) + 'px"></div>');
    }

    /* 미리보기 */
    h.push('<div class="ghost" id="ghost" hidden></div>');

    /* 무게중심 세로 점선 */
    var com = App.Balance.overallCenter(design);
    var base = App.Balance.baseRange(design);
    if (com !== null) {
      /* 받침판 위 범위 안에 있고, 단마다 하는 평균 검사도 통과해야 초록 */
      var inside = !!(base && com >= base[0] && com <= base[1]) && App.Balance.analyze(design).ok;
      h.push('<div class="com ' + (inside ? 'ok' : 'bad') + '" style="left:' + (com * cw) + 'px"><span>무게중심</span></div>');
      if (base) {
        h.push('<div class="base-range ' + (inside ? 'ok' : 'bad') + '" style="left:' + (base[0] * cw) + 'px;width:' + ((base[1] - base[0]) * cw) + 'px"></div>');
      }
    }

    el.board.innerHTML = h.join('');

    /* 애니메이션에 쓸 요소 모으기 */
    state.elsById = {};
    var nodes = el.board.querySelectorAll('.brick');
    for (var k = 0; k < nodes.length; k++) state.elsById[nodes[k].getAttribute('data-id')] = nodes[k];

    updateUsage();
    updateToolbarState();
    el.answerBadge.style.display = design.answerUsed ? '' : 'none';
  }

  function updateUsage() {
    var used = M.totalCost(state.design);
    var max = CONFIG.maxBricks;
    el.usage.textContent = '사용 ' + used + ' / ' + max + '장';
    var pct = Math.min(100, Math.round(used / max * 100));
    el.usageBar.style.width = pct + '%';
    el.usage.parentNode.classList.toggle('full', used >= max);
  }

  function updateToolbarState() {
    var btns = doc.querySelectorAll('#toolbar button[data-orient],#toolbar button[data-wythes],#toolbar button[data-tool]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], on = false;
      if (b.hasAttribute('data-orient')) on = (state.tool === 'place' && b.getAttribute('data-orient') === state.orient);
      if (b.hasAttribute('data-wythes')) on = (state.tool === 'place' && parseInt(b.getAttribute('data-wythes'), 10) === state.wythes);
      if (b.hasAttribute('data-tool')) on = (b.getAttribute('data-tool') === state.tool);
      b.classList.toggle('on', on);
    }
    doc.getElementById('btn-undo').disabled = state.history.length === 0;
    el.hintNote.textContent = state.tool === 'erase'
      ? '지우기 — 지울 벽돌을 누르세요 (기초는 못 지웁니다)'
      : (state.orient === 'lie' ? '길이 방향' : '90° 돌려놓기') + ' · ' + (state.wythes === 2 ? '두 겹 (앞뒤)' : '한 겹 (앞줄만)');
  }

  /* =================================================================
     클릭 처리
     ================================================================= */
  function bindBoard() {
    el.board.addEventListener('click', onClick);
    el.board.addEventListener('mousemove', onMove);
    el.board.addEventListener('mouseleave', function () {
      var g = doc.getElementById('ghost'); if (g) g.hidden = true;
    });
  }

  function pointFromEvent(e) {
    var r = el.board.getBoundingClientRect();
    var borderLeft = el.board.clientLeft || 0;
    var borderBottom = Math.max(0, r.height - el.board.clientHeight - (el.board.clientTop || 0));
    return {
      fx: (e.clientX - r.left - borderLeft) / state.cellPx,
      fy: (r.bottom - borderBottom - e.clientY) / state.rowPx
    };
  }

  function cellFromEvent(e) {
    var p = pointFromEvent(e);
    var c = { x: Math.floor(p.fx), y: Math.floor(p.fy), fx: p.fx, fy: p.fy };
    if (c.x < 0 || c.x >= CONFIG.cols || c.y < 0 || c.y >= state.visRows) return null;
    return c;
  }

  /* 클릭 지점을 품고 있는 초록 자리 중 가장 가까운 것 */
  function pickSpot(c, generous) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < state.spots.length; i++) {
      var s = state.spots[i];
      if (c.x < s.x || c.x >= s.x + s.w) continue;
      if (c.y < s.y || c.y >= s.y + s.h) continue;
      var d = Math.abs(c.fx - (s.x + s.w / 2)) + Math.abs(c.fy - (s.y + s.h / 2)) * 0.5;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best || !generous) return best;

    /* 손가락 탭은 유효 자리 둘레 약 12px까지 가장 가까운 자리로 보정 */
    var padX = Math.min(0.5, 12 / Math.max(1, state.cellPx));
    var padY = Math.min(0.5, 12 / Math.max(1, state.rowPx));
    for (var j = 0; j < state.spots.length; j++) {
      var near = state.spots[j];
      if (c.fx < near.x - padX || c.fx > near.x + near.w + padX ||
          c.fy < near.y - padY || c.fy > near.y + near.h + padY) continue;
      var dx = c.fx < near.x ? near.x - c.fx : (c.fx > near.x + near.w ? c.fx - near.x - near.w : 0);
      var dy = c.fy < near.y ? near.y - c.fy : (c.fy > near.y + near.h ? c.fy - near.y - near.h : 0);
      var nearD = dx * state.cellPx + dy * state.rowPx;
      if (nearD < bestD) { bestD = nearD; best = near; }
    }
    return best;
  }

  function onMove(e) {
    if (state.busy || state.tool !== 'place') return;
    var g = doc.getElementById('ghost');
    if (!g) return;
    var c = cellFromEvent(e);
    var s = c && pickSpot(c);
    if (!s) { g.hidden = true; return; }
    g.hidden = false;
    g.className = 'ghost ' + (state.wythes >= 2 ? 'w2' : 'w1') + (state.orient === 'head' ? ' head' : '');
    g.style.left = (s.x * state.cellPx) + 'px';
    g.style.bottom = (s.y * state.rowPx) + 'px';
    g.style.width = (s.w * state.cellPx) + 'px';
    g.style.height = (s.h * state.rowPx) + 'px';
  }

  /* 이미 차지된 칸을 누르면 겹치는 벽돌 자체를 알려준다 */
  function flashOccupied(id) {
    var node = state.elsById[id];
    if (!node) return;
    if (node._occupiedTimer) global.clearTimeout(node._occupiedTimer);
    node.classList.remove('occupied-flash');
    void node.offsetWidth;
    node.classList.add('occupied-flash');
    node._occupiedTimer = global.setTimeout(function () {
      node.classList.remove('occupied-flash');
      node._occupiedTimer = null;
    }, 900);
  }

  function onClick(e) {
    if (state.busy || !state.design) return;
    App.Sound.unlock();
    var c = cellFromEvent(e);
    if (!c) return;

    if (state.tool === 'erase') { eraseAt(c); return; }

    var spot = pickSpot(c, true);
    if (spot) { place(spot); return; }

    /* 이미 있는 벽돌 뒤에 한 겹 더 붙이기 */
    var maps = M.buildMaps(state.design);
    var id = M.idAt(maps, c.x, c.y);
    if (id) {
      var brick = maps.byId[id];
      if (state.wythes === 2 && M.wythesOf(brick) === 1) {
        var res = Rules.canThicken(Rules.makeContext(state.design), brick);
        if (res.ok) { thicken(brick); return; }
        flashOccupied(id);
        showMessage(res.message, 'no');
        return;
      }
      flashOccupied(id);
      showMessage((c.y + 1) + '층의 빨간 벽돌이 이미 이 칸을 차지하고 있어요.', 'no');
      return;
    }

    var why = explainAt(c);
    showMessage(why ? why.message : '여기에는 놓을 수 없어요.', 'no');
  }

  /* 왜 못 놓는지 가장 도움이 되는 이유를 고른다 */
  var RANK = { BUDGET: 9, JOINT: 8, HALF: 8, THIN: 8, WIDER: 7, NO_SUPPORT_BACK: 6, NO_SUPPORT: 5, OVERLAP: 2, OUT: 1 };
  function explainAt(c) {
    var ctx = Rules.makeContext(state.design);
    var sp = M.spans(state.orient);
    var best = null;
    for (var dx = 0; dx < sp.w; dx++) {
      var cand = { x: c.x - dx, y: c.y, orient: state.orient, wythes: state.wythes };
      var res = Rules.canPlace(ctx, cand);
      if (res.ok) continue;
      if (!best || (RANK[res.code] || 0) > (RANK[best.code] || 0)) best = res;
    }
    return best;
  }

  /* =================================================================
     동작
     ================================================================= */
  function pushHistory() {
    state.history.push(M.cloneDesign(state.design));
    if (state.history.length > 60) state.history.shift();
  }

  function place(spot) {
    pushHistory();
    M.addBrick(state.design, { x: spot.x, y: spot.y, orient: spot.orient, wythes: spot.wythes });
    state.hint = null;
    clearResult();
    App.Sound.clack();
    render();
    var left = CONFIG.maxBricks - M.totalCost(state.design);
    if (left <= 0) showMessage('벽돌을 모두 썼습니다. 지우고 다시 배치해 보세요.', 'no');
    else if (left <= 5) showMessage('벽돌이 ' + left + '장 남았습니다.', 'info');
    else showMessage('', 'none');
  }

  function thicken(brick) {
    pushHistory();
    brick.wythes = 2;
    clearResult();
    App.Sound.clack();
    render();
    showMessage('뒤에 한 겹을 더 붙였습니다 (벽돌 1장 추가).', 'info');
  }

  function eraseAt(c) {
    var maps = M.buildMaps(state.design);
    var id = M.idAt(maps, c.x, c.y);
    if (!id) return;
    var b = maps.byId[id];
    if (b.fixed) { showMessage('기초 벽돌은 지울 수 없어요. 처음부터 다시 하려면 「처음부터」를 누르세요.', 'no'); return; }

    var chain = M.chainAbove(state.design, maps, id);
    var removable = [id];
    for (var i = 0; i < chain.length; i++) if (!maps.byId[chain[i]].fixed) removable.push(chain[i]);

    pushHistory();
    for (var k = 0; k < removable.length; k++) M.removeBrickById(state.design, removable[k]);
    clearResult();
    render();
    showMessage(removable.length > 1
      ? '위에 얹혀 있던 ' + (removable.length - 1) + '장도 함께 지웠습니다. (되돌리기 가능)'
      : '벽돌을 지웠습니다.', 'info');
  }

  function undo() {
    if (!state.history.length) return;
    state.design = state.history.pop();
    state.hint = null;
    clearResult();
    render();
    showMessage('한 단계 되돌렸습니다.', 'info');
  }

  function restart() {
    if (!global.confirm('지금 설계를 지우고 기초 고르기부터 다시 시작합니다. 계속할까요?')) return;
    showStart();
  }

  function doHint() {
    if (!state.design) return;
    var mv = App.Solver.hint(state.design);
    if (!mv) {
      showMessage('지금 놓을 수 있는 자리를 찾지 못했어요. 벽돌을 하나 지우거나 「두 겹」으로 바꿔 보세요.', 'no');
      return;
    }
    state.orient = mv.orient;
    state.wythes = mv.wythes;
    state.tool = 'place';
    state.hint = mv;
    render();
    showMessage('반짝이는 자리에 ' + (mv.orient === 'lie' ? '길이 방향' : '같은 벽돌을 90° 돌려') + ' ' +
                (mv.wythes >= 2 ? '두 겹' : '한 겹') + '으로 놓아 보세요. (설계는 그대로입니다)', 'hint');
    global.setTimeout(function () {
      if (state.hint === mv) { state.hint = null; render(); }
    }, 4000);
  }

  /* =================================================================
     세워보기 (검증)
     ================================================================= */
  function doValidate() {
    if (!state.design || state.busy) return;
    App.Sound.unlock();
    var res = App.Validate.run(state.design);
    state.lastResult = res;
    showResult(res);

    if (res.status === 'collapse') {
      state.busy = true;
      var gate = state.design.meta.gate;
      App.Collapse.play({
        design: state.design,
        elsById: state.elsById,
        culpritId: res.culpritId,
        extraIds: res.fallIds || [],
        midX: (gate[0] + gate[1] + 1) / 2,
        onDone: function () { state.busy = false; render(); }
      });
    } else if (App.View3D) {
      App.View3D.open(state.design, { status: res.status });
    }
  }

  function showResult(res) {
    var cls = res.status === 'ok' ? 'ok' : (res.status === 'incomplete' ? 'warn' : 'bad');
    var h = ['<div class="result ' + cls + '">',
      '<div class="result-title">' + res.title + '</div>',
      '<div class="result-reason">' + res.reason + '</div>',
      '<div class="result-detail">' + (res.detail || '') + '</div>'];
    if (res.status !== 'collapse') {
      h.push('<button class="btn" id="btn-open-3d">360° 입체로 돌려보기</button>');
    }
    if (res.status === 'ok') {
      h.push('<button class="btn btn-primary" id="btn-open-bp">조립 도면 보기</button>');
    }
    h.push('</div>');
    el.result.innerHTML = h.join('');
    var open = doc.getElementById('btn-open-bp');
    if (open) open.onclick = function () { openBlueprint(state.design, false); };
    var open3d = doc.getElementById('btn-open-3d');
    if (open3d) open3d.onclick = function () { App.View3D.open(state.design, { status: res.status }); };

    /* 미적 규칙 안내 */
    var a = res.aesthetics || [];
    var ah = ['<div class="aes-title">더 예쁘게 만들기</div><ul class="aes-list">'];
    for (var i = 0; i < a.length; i++) {
      ah.push('<li class="' + (a[i].ok ? 'ok' : 'todo') + '"><b>' + a[i].title + '</b><span>' + a[i].message + '</span></li>');
    }
    ah.push('</ul>');
    el.aesthetics.innerHTML = ah.join('');
  }

  function clearResult() {
    el.result.innerHTML = '';
    el.aesthetics.innerHTML = '';
    state.lastResult = null;
  }

  function showMessage(text, kind) {
    if (!text) { el.msg.textContent = ''; el.msg.className = 'msg'; return; }
    el.msg.textContent = text;
    el.msg.className = 'msg ' + (kind || 'info');
  }

  /* =================================================================
     도면
     ================================================================= */
  function openBlueprint(design, isAnswer) {
    if (!design) return;
    if (!isAnswer) {
      var res = App.Validate.run(design);
      if (res.status !== 'ok') {
        showResult(res);
        showMessage('아직 도면을 낼 수 없어요 — 먼저 「세워보기」를 통과해야 합니다.', 'no');
        return;
      }
    }
    el.bpBody.innerHTML = App.Blueprint.render(design, { answer: isAnswer });
    el.bpModal.classList.add('open');
    el.bpModal.scrollTop = 0;
  }

  function openAnswer() {
    if (!CONFIG.showAnswer || !state.design) return;
    if (!global.confirm('정답 도면을 엽니다.\n연 사실이 화면에 기록으로 남습니다 (벌점이 아니라 기록입니다). 계속할까요?')) return;
    var fresh = App.Foundation.create(state.design.meta.foundationId);
    var solved = App.Solver.solve(fresh);
    state.design.answerUsed = true;
    render();
    openBlueprint(solved, true);
  }

  /* =================================================================
     Element.closest 가 없는 옛 브라우저 대비
     ================================================================= */
  if (!Element.prototype.closest) {
    Element.prototype.closest = function (sel) {
      var node = this;
      while (node && node.nodeType === 1) {
        if (node.matches ? node.matches(sel) : node.msMatchesSelector(sel)) return node;
        node = node.parentElement;
      }
      return null;
    };
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
