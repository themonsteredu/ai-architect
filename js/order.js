/* ===================================================================
   order.js  —  쌓는 순서 계산

   앱은 완성 상태만 검증하지만, 실물은 쌓아 올라가는 도중이 있습니다.
   순서를 잘못 잡으면 실물이 무너집니다.

   정렬 규칙
     1. 아래층부터
     2. 같은 층에서는 바깥쪽부터 안쪽으로
     3. 두 겹 벽은 앞뒤를 같은 층에서 함께 (번호가 연달아 붙습니다)
     4. 양쪽 기둥은 번갈아 (왼쪽 하나, 오른쪽 하나)

   받침 필요 구간 판정
     아래 벽돌 밖으로 튀어나온 벽돌 → ⚠️ 받침 블록을 괴고 쌓으세요
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;

  /* ①②③… 만들기 (없는 글자는 (21) 형태로) */
  function circled(n) {
    if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
    if (n >= 21 && n <= 35) return String.fromCharCode(0x3251 + n - 21);
    if (n >= 36 && n <= 50) return String.fromCharCode(0x32B1 + n - 36);
    return '(' + n + ')';
  }

  /* 이 벽돌이 아래 벽돌 밖으로 튀어나왔는가 */
  function overhangs(maps, b) {
    if (b.y === 0) return false;
    var fp = M.footprint(b);
    for (var i = 0; i < fp.length; i++) {
      if (!M.idAt(maps, fp[i], b.y - 1)) return true;
    }
    return false;
  }

  function compute(design) {
    var maps = M.buildMaps(design);
    var cols = CONFIG.cols;
    var top = M.topRow(design);
    var gate = design.meta.gate;
    var opening = design.meta.opening;
    var mid = (gate[0] + gate[1] + 1) / 2;
    var layers = [];
    var closed = App.Aesthetics.closedRow(design);
    var corbelStart = firstCorbelRow(design, maps);

    for (var y = 0; y <= top; y++) {
      var rowBricks = M.bricksInRow(design, y);
      if (!rowBricks.length) continue;

      var left = [], right = [], center = [];
      for (var i = 0; i < rowBricks.length; i++) {
        var cx = M.centerX(rowBricks[i]);
        if (cx < mid) left.push(rowBricks[i]);
        else if (cx > mid) right.push(rowBricks[i]);
        else center.push(rowBricks[i]);
      }
      /* 바깥쪽부터 안쪽으로 */
      left.sort(function (a, b) { return M.centerX(a) - M.centerX(b); });
      right.sort(function (a, b) { return M.centerX(b) - M.centerX(a); });

      /* 왼쪽 하나, 오른쪽 하나 번갈아 */
      var ordered = [];
      var n = Math.max(left.length, right.length);
      for (var k = 0; k < n; k++) {
        if (k < left.length) ordered.push(left[k]);
        if (k < right.length) ordered.push(right[k]);
      }
      for (var c = 0; c < center.length; c++) ordered.push(center[c]);   // 가운데(쐐기)는 맨 마지막

      /* 번호 붙이기 — 실물 벽돌 한 장에 번호 하나 */
      var num = 0, items = [], propCount = 0, corbelCount = 0;
      for (var j = 0; j < ordered.length; j++) {
        var b = ordered[j];
        var prop = overhangs(maps, b);
        if (prop) propCount++;
        if (prop) corbelCount++;
        var side = (M.centerX(b) < mid) ? 'left' : (M.centerX(b) > mid ? 'right' : 'center');
        var item = {
          brick: b,
          side: side,
          needsProp: prop,
          orient: b.orient,
          wythes: M.wythesOf(b),
          numbers: []
        };
        if (b.orient === 'head') {
          num += 1; item.numbers.push({ n: num, depth: 'both' });
        } else if (M.wythesOf(b) >= 2) {
          num += 1; item.numbers.push({ n: num, depth: 'front' });
          num += 1; item.numbers.push({ n: num, depth: 'back' });
        } else {
          num += 1; item.numbers.push({ n: num, depth: 'front' });
        }
        items.push(item);
      }

      /* 이 단의 안내 문구 */
      var notes = [];
      if (y === 0) {
        notes.push('받침판 위에 바로 놓습니다. 왼쪽 기둥 앞줄·뒷줄 → 오른쪽 기둥 앞줄·뒷줄, 바깥부터 안쪽으로.');
      } else {
        notes.push('바깥부터 안쪽으로, 왼쪽·오른쪽 번갈아 놓습니다.');
      }
      if (corbelCount > 0 && y === corbelStart) {
        notes.push('코벨 시작. 양쪽 번갈아, 반 장(' + CONFIG.cellMm + 'mm)씩만 안으로.');
      } else if (corbelCount > 0) {
        notes.push('코벨을 반 장씩 더 안으로 내밉니다.');
      }
      if (closed === y) {
        notes.push('문이 닫히는 단입니다. 가운데 벽돌을 맨 마지막에 올리세요.');
      }
      var hasDouble = false;
      for (var q = 0; q < items.length; q++) if (items[q].wythes >= 2 && items[q].orient === 'lie') hasDouble = true;
      if (hasDouble) notes.push('두 겹인 곳은 앞줄·뒷줄을 이어서 함께 놓습니다.');

      layers.push({
        row: y,
        label: (y + 1) + '층',
        items: items,
        count: num,
        rangeText: num > 0 ? (circled(1) + '~' + circled(num)) : '',
        needsProp: propCount > 0,
        notes: notes,
        opening: opening
      });
    }

    return layers;
  }

  /* 코벨이 처음 시작되는 단 */
  function firstCorbelRow(design, maps) {
    var top = M.topRow(design), found = -1;
    for (var y = 1; y <= top && found < 0; y++) {
      var rb = M.bricksInRow(design, y);
      for (var i = 0; i < rb.length; i++) {
        if (overhangs(maps, rb[i])) { found = y; break; }
      }
    }
    return found;
  }

  /* 도면 맨 위에 넣을 요약 텍스트 */
  function textSummary(layers) {
    var lines = [];
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      lines.push(L.label + ' (' + L.rangeText + ')' + (L.needsProp ? '  ⚠️ 받침 필요' : ''));
      lines.push('  ' + L.notes.join(' '));
    }
    return lines.join('\n');
  }

  App.Order = { compute: compute, circled: circled, overhangs: overhangs, textSummary: textSummary };

})(window);
