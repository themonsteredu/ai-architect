/* ===================================================================
   blueprint.js  —  조립 도면 출력

   - 맨 앞에 완성 모습 한 장
   - 그 다음 층별로 한 장씩 (1층 도면, 2층 도면, ...)
   - 각 층 평면도에 "그 층 안에서의 순서 번호" 표시 (①②③...)
     (전체 통번호 1~60 은 쓰지 않습니다 — 숫자가 뭉개져서 못 읽습니다)
   - 받침이 필요한 구간에 ⚠️ 경고
   - 인쇄 가능
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;

  var uid = 0;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* 1부터 시작하는 칸 번호로 바꿔 표시 */
  function cellLabel(b) {
    var w = M.spans(b.orient).w;
    return (w === 1) ? (b.x + 1) + '칸' : (b.x + 1) + '~' + (b.x + w) + '칸';
  }

  function orientLabel(b) {
    return b.orient === 'head' ? '90° 돌려놓기' : '길이 방향';
  }

  /* ---------------------------------------------------------------
     정면도 (완성 모습)
     --------------------------------------------------------------- */
  function elevationSVG(design, opt) {
    opt = opt || {};
    var cw = opt.cell || 26;
    var ch = opt.row || Math.round(cw * (CONFIG.rowMm / CONFIG.cellMm));
    var cols = CONFIG.cols;
    var top = M.topRow(design);
    var usedRows = Math.max(top + 1, 3);
    var pad = 26;
    var W = cols * cw, H = usedRows * ch;
    var id = 'hx' + (++uid);
    var s = [];

    s.push('<svg class="bp-svg" viewBox="0 0 ' + (W + pad * 2) + ' ' + (H + pad * 2) + '" width="100%" preserveAspectRatio="xMidYMid meet">');
    s.push('<defs><pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
           '<rect width="6" height="6" fill="#fff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#b76348" stroke-width="2"/></pattern></defs>');
    s.push('<g transform="translate(' + pad + ',' + pad + ')">');

    /* 격자 */
    var x, y;
    for (x = 0; x <= cols; x++) {
      s.push('<line x1="' + (x * cw) + '" y1="0" x2="' + (x * cw) + '" y2="' + H + '" stroke="#cbd7d8" stroke-width="1"/>');
    }
    for (y = 0; y <= usedRows; y++) {
      s.push('<line x1="0" y1="' + (y * ch) + '" x2="' + W + '" y2="' + (y * ch) + '" stroke="#cbd7d8" stroke-width="1"/>');
    }

    /* 벽돌 */
    for (var i = 0; i < design.bricks.length; i++) {
      var b = design.bricks[i];
      var sp = M.spans(b.orient);
      var bx = b.x * cw;
      var by = (usedRows - 1 - b.y) * ch;
      var thin = M.wythesOf(b) === 1;
      s.push('<rect x="' + (bx + 1) + '" y="' + (by + 1) + '" width="' + (sp.w * cw - 2) + '" height="' + (ch - 2) +
             '" rx="2" fill="' + (thin ? 'url(#' + id + ')' : '#ead5cc') + '" stroke="#7c321f" stroke-width="1.6"/>');
      if (b.orient === 'head') {
        s.push('<line x1="' + (bx + 4) + '" y1="' + (by + ch / 2) + '" x2="' + (bx + cw - 4) + '" y2="' + (by + ch / 2) +
               '" stroke="#7c321f" stroke-width="1" stroke-dasharray="2 2"/>');
      }
    }

    /* 받침판 */
    s.push('<rect x="-6" y="' + H + '" width="' + (W + 12) + '" height="10" fill="#a88736" stroke="#6f591e" stroke-width="1"/>');
    s.push('<text x="' + (W / 2) + '" y="' + (H + 26) + '" text-anchor="middle" font-size="12" fill="#44545a">받침판 ' + CONFIG.boardWidth + 'mm</text>');

    /* 문 표시 */
    var op = design.meta.opening;
    var ox = op[0] * cw, ow = (op[1] - op[0] + 1) * cw;
    s.push('<line x1="' + ox + '" y1="' + (H + 14) + '" x2="' + (ox + ow) + '" y2="' + (H + 14) + '" stroke="#176ca7" stroke-width="2"/>');
    s.push('<text x="' + (ox + ow / 2) + '" y="' + (H + 11) + '" text-anchor="middle" font-size="11" fill="#176ca7">문 ' + (ow / cw * CONFIG.cellMm) + 'mm</text>');

    /* 높이 */
    s.push('<text x="-8" y="' + (ch / 2 + 4) + '" text-anchor="end" font-size="11" fill="#44545a">' + usedRows + '층</text>');

    s.push('</g></svg>');
    return s.join('');
  }

  /* ---------------------------------------------------------------
     층 평면도 (위에서 내려다본 그림)
     세로 방향은 앞줄 / 뒷줄 두 겹만 그립니다.
     --------------------------------------------------------------- */
  function planSVG(design, layer, opt) {
    opt = opt || {};
    var cw = opt.cell || 30;
    var dh = opt.depth || Math.round(cw * (CONFIG.cellMm / CONFIG.cellMm) * 1.0);
    var cols = CONFIG.cols;
    var pad = 34;
    var W = cols * cw, H = dh * 2;
    var s = [];
    var maps = M.buildMaps(design);
    var id = 'px' + (++uid);

    s.push('<svg class="bp-svg" viewBox="0 0 ' + (W + pad * 2) + ' ' + (H + pad * 2 + 16) + '" width="100%" preserveAspectRatio="xMidYMid meet">');
    s.push('<defs><pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
           '<rect width="6" height="6" fill="#fff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#b76348" stroke-width="2"/></pattern></defs>');
    s.push('<g transform="translate(' + pad + ',' + pad + ')">');

    /* 아래층 자리 (연한 회색) — 줄 맞추는 기준 */
    if (layer.row > 0) {
      for (var gx = 0; gx < cols; gx++) {
        var below = M.idAt(maps, gx, layer.row - 1);
        if (below) {
          var wy = M.wythesOf(maps.byId[below]);
          var gy = (wy >= 2) ? 0 : dh;
          var gh = (wy >= 2) ? H : dh;
          s.push('<rect x="' + (gx * cw) + '" y="' + gy + '" width="' + cw + '" height="' + gh + '" fill="#edf2f2"/>');
        }
      }
    }

    /* 격자 */
    var x, yy;
    for (x = 0; x <= cols; x++) s.push('<line x1="' + (x * cw) + '" y1="0" x2="' + (x * cw) + '" y2="' + H + '" stroke="#cbd7d8"/>');
    for (yy = 0; yy <= 2; yy++) s.push('<line x1="0" y1="' + (yy * dh) + '" x2="' + W + '" y2="' + (yy * dh) + '" stroke="#cbd7d8"/>');

    /* 이 층의 벽돌 */
    for (var i = 0; i < layer.items.length; i++) {
      var it = layer.items[i];
      var b = it.brick;
      var sp = M.spans(b.orient);
      var bx = b.x * cw, bw = sp.w * cw;
      var thin = it.wythes === 1;

      for (var n = 0; n < it.numbers.length; n++) {
        var entry = it.numbers[n];
        var ry, rh;
        if (entry.depth === 'both') { ry = 0; rh = H; }
        else if (entry.depth === 'back') { ry = 0; rh = dh; }
        else { ry = dh; rh = dh; }

        s.push('<rect x="' + (bx + 1.5) + '" y="' + (ry + 1.5) + '" width="' + (bw - 3) + '" height="' + (rh - 3) +
               '" rx="2" fill="' + (thin ? 'url(#' + id + ')' : '#f0ded7') + '" stroke="' + (it.needsProp ? '#c33b37' : '#7c321f') +
               '" stroke-width="' + (it.needsProp ? 2.4 : 1.6) + '"/>');

        var cxp = bx + bw / 2, cyp = ry + rh / 2;
        var r = Math.min(cw, rh) * 0.32;
        s.push('<circle cx="' + cxp + '" cy="' + cyp + '" r="' + r + '" fill="#fff" stroke="#183844" stroke-width="1.4"/>');
        s.push('<text x="' + cxp + '" y="' + (cyp + r * 0.42) + '" text-anchor="middle" font-size="' + (r * 1.15).toFixed(1) +
               '" font-weight="700" fill="#183844">' + entry.n + '</text>');
      }

      if (it.needsProp) {
        s.push('<text x="' + (bx + bw / 2) + '" y="-6" text-anchor="middle" font-size="13" fill="#c33b37">▼받침</text>');
      }
    }

    /* 앞/뒤 표시 */
    s.push('<text x="-8" y="' + (dh * 0.5 + 4) + '" text-anchor="end" font-size="12" fill="#44545a">뒷줄</text>');
    s.push('<text x="-8" y="' + (dh * 1.5 + 4) + '" text-anchor="end" font-size="12" fill="#44545a">앞줄</text>');
    s.push('<text x="' + (W / 2) + '" y="' + (H + 22) + '" text-anchor="middle" font-size="12" fill="#44545a">↑ 이쪽이 앞 (보는 쪽)</text>');

    /* 문 위치 */
    var op = layer.opening;
    s.push('<line x1="' + (op[0] * cw) + '" y1="-14" x2="' + ((op[1] + 1) * cw) + '" y2="-14" stroke="#176ca7" stroke-width="2" stroke-dasharray="5 3"/>');
    s.push('<text x="' + (((op[0] + op[1] + 1) / 2) * cw) + '" y="-18" text-anchor="middle" font-size="11" fill="#176ca7">문 자리</text>');

    /* 칸 눈금 (5칸마다) */
    for (x = 0; x < cols; x += 5) {
      s.push('<text x="' + (x * cw + cw / 2) + '" y="' + (H + 36) + '" text-anchor="middle" font-size="10" fill="#999">' + (x + 1) + '</text>');
    }

    s.push('</g></svg>');
    return s.join('');
  }

  /* 작은 정면도 — 지금 몇 층인지 표시 */
  function miniElevation(design, row) {
    var cw = 9, ch = 9;
    var cols = CONFIG.cols;
    var top = M.topRow(design);
    var usedRows = Math.max(top + 1, 3);
    var W = cols * cw, H = usedRows * ch;
    var s = ['<svg class="bp-mini" viewBox="-2 -2 ' + (W + 4) + ' ' + (H + 4) + '" width="' + (W + 4) + '">'];
    for (var i = 0; i < design.bricks.length; i++) {
      var b = design.bricks[i];
      var sp = M.spans(b.orient);
      var on = (b.y === row);
      s.push('<rect x="' + (b.x * cw) + '" y="' + ((usedRows - 1 - b.y) * ch) + '" width="' + (sp.w * cw) + '" height="' + ch +
             '" fill="' + (on ? '#c96f50' : '#e3e9e9') + '" stroke="' + (on ? '#7c321f' : '#aebbbc') + '" stroke-width="1"/>');
    }
    s.push('</svg>');
    return s.join('');
  }

  /* ---------------------------------------------------------------
     도면 전체 만들기
     --------------------------------------------------------------- */
  function render(design, options) {
    options = options || {};
    var layers = App.Order.compute(design);
    var total = M.totalCost(design);
    var closed = App.Aesthetics.closedRow(design);
    var op = design.meta.opening;
    var openMm = (op[1] - op[0] + 1) * CONFIG.cellMm;
    var propRows = [];
    for (var i = 0; i < layers.length; i++) if (layers[i].needsProp) propRows.push(layers[i].label);

    var h = [];

    /* ---- 1장 : 완성 모습 ---- */
    h.push('<section class="sheet">');
    h.push('<header class="sheet-head"><h1>코벨문 조립 도면' + (options.answer ? ' <span class="tag-answer">정답</span>' : '') + '</h1>');
    h.push('<div class="sheet-sub">' + esc(design.meta.foundationName) + ' · 총 ' + total + '장 / ' + CONFIG.maxBricks + '장</div></header>');
    h.push('<div class="bp-figure">' + elevationSVG(design, { cell: 26 }) + '</div>');
    h.push('<table class="bp-table"><tbody>');
    h.push('<tr><th>벽돌 규격</th><td>' + CONFIG.brickLabel + '</td><th>받침판</th><td>' + CONFIG.boardLabel + '</td></tr>');
    h.push('<tr><th>사용 벽돌</th><td>' + total + ' / ' + CONFIG.maxBricks + '장</td><th>전체 층수</th><td>' + layers.length + '층</td></tr>');
    h.push('<tr><th>문 크기</th><td>폭 ' + openMm + 'mm × 높이 ' + (closed >= 0 ? closed : '-') + '층</td>' +
           '<th>받침 필요</th><td>' + (propRows.length ? propRows.join(', ') : '없음') + '</td></tr>');
    h.push('</tbody></table>');
    h.push('<div class="bp-legend">' +
           '<span><i class="lg-solid"></i> 두 겹 (앞줄+뒷줄)</span>' +
           '<span><i class="lg-hatch"></i> 한 겹 (앞줄만)</span>' +
           '<span><i class="lg-prop"></i> 받침 블록을 괴고 쌓는 벽돌</span>' +
           '</div>');
    h.push('<div class="bp-howto"><b>쌓는 방법</b> — 1층부터 순서대로. 같은 층 안에서는 번호 순서대로 ' +
           '(바깥에서 안쪽으로, 왼쪽·오른쪽 번갈아). 두 겹인 곳은 앞줄과 뒷줄을 이어서 놓습니다.</div>');
    h.push('</section>');

    /* ---- 층별 도면 ---- */
    for (var L = 0; L < layers.length; L++) {
      var layer = layers[L];
      h.push('<section class="sheet">');
      h.push('<header class="sheet-head"><h1>' + layer.label + ' 도면 <span class="sheet-range">(' + layer.rangeText + ')</span>' +
             (layer.needsProp ? ' <span class="tag-warn">⚠️ 받침 필요</span>' : '') + '</h1>');
      h.push('<div class="sheet-sub">' + esc(layer.notes.join(' ')) + '</div></header>');
      h.push('<div class="bp-figure">' + planSVG(design, layer, { cell: 30, depth: 30 }) + '</div>');

      h.push('<div class="bp-side"><div class="bp-mini-wrap"><div class="bp-mini-label">이 층의 위치</div>' +
             miniElevation(design, layer.row) + '</div>');

      h.push('<table class="bp-order"><thead><tr><th>번호</th><th>자리</th><th>방향</th><th>앞/뒤</th><th>비고</th></tr></thead><tbody>');
      for (var k = 0; k < layer.items.length; k++) {
        var it = layer.items[k];
        for (var n = 0; n < it.numbers.length; n++) {
          var depthText = it.numbers[n].depth === 'both' ? '앞뒤 한 번에'
                        : it.numbers[n].depth === 'back' ? '뒷줄' : '앞줄';
          h.push('<tr' + (it.needsProp ? ' class="row-warn"' : '') + '>' +
                 '<td class="num">' + App.Order.circled(it.numbers[n].n) + '</td>' +
                 '<td>' + cellLabel(it.brick) + '</td>' +
                 '<td>' + orientLabel(it.brick) + '</td>' +
                 '<td>' + depthText + '</td>' +
                 '<td>' + (it.needsProp ? '⚠️ 받침 블록을 괴고 쌓으세요' : '') + '</td></tr>');
        }
      }
      h.push('</tbody></table></div>');
      h.push('</section>');
    }

    return h.join('');
  }

  App.Blueprint = { render: render, elevationSVG: elevationSVG, planSVG: planSVG };

})(window);
