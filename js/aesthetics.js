/* ===================================================================
   aesthetics.js  —  미적 규칙 (안내만, 막지 않음)

   구조상 무너지진 않지만 지키면 결과물이 예뻐지는 규칙들입니다.
     1. 좌우 대칭      가운데 문 기준 양쪽이 같아야 함
     2. 탑은 문보다 작게 탑 높이는 문 높이의 절반 이하
     3. 위로 갈수록 좁게
     4. 줄눈은 엇갈리게
     5. 홀수로 세기     계단은 3단, 총안은 3개나 5개
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;

  /* 문이 닫힌 단 (양쪽 코벨이 만난 단). 아직이면 -1 */
  function closedRow(design) {
    var maps = M.buildMaps(design);
    var op = design.meta.opening;
    var top = M.topRow(design);
    for (var y = 1; y <= top; y++) {
      var all = true;
      for (var x = op[0]; x <= op[1]; x++) {
        if (!M.idAt(maps, x, y)) { all = false; break; }
      }
      if (all) return y;
    }
    return -1;
  }

  /* 아직 남은 문 틈 (칸 수). 0 이면 닫힘 */
  function minGap(design) {
    var maps = M.buildMaps(design);
    var op = design.meta.opening;
    var top = M.topRow(design);
    var best = op[1] - op[0] + 1;
    for (var y = 1; y <= top; y++) {
      var empty = 0, any = false;
      for (var x = op[0]; x <= op[1]; x++) {
        if (M.idAt(maps, x, y)) any = true; else empty++;
      }
      if (any || empty < best) best = Math.min(best, empty);
    }
    return best;
  }

  function mirrorX(design, b) {
    var gate = design.meta.gate;
    var axis2 = gate[0] + gate[1] + 1;              // 2 × 대칭축
    return axis2 - b.x - M.spans(b.orient).w;
  }

  function check(design) {
    var maps = M.buildMaps(design);
    var cols = CONFIG.cols;
    var top = M.topRow(design);
    var out = [];

    /* --- 1. 좌우 대칭 ------------------------------------------------ */
    (function () {
      var key = {}, i, b;
      for (i = 0; i < design.bricks.length; i++) {
        b = design.bricks[i];
        key[b.x + ',' + b.y + ',' + b.orient] = M.wythesOf(b);
      }
      var badRow = null, mismatches = 0;
      for (i = 0; i < design.bricks.length; i++) {
        b = design.bricks[i];
        var mx = mirrorX(design, b);
        var found = key[mx + ',' + b.y + ',' + b.orient];
        if (found === undefined) {
          mismatches++;
          if (badRow === null || b.y < badRow) badRow = b.y;
        }
      }
      /* 좌/우 높이 비교 (더 친절한 문구용) */
      var gate = design.meta.gate;
      var mid = (gate[0] + gate[1] + 1) / 2;
      var lh = -1, rh = -1;
      for (i = 0; i < design.bricks.length; i++) {
        b = design.bricks[i];
        if (M.centerX(b) < mid) { if (b.y > lh) lh = b.y; }
        else if (M.centerX(b) > mid) { if (b.y > rh) rh = b.y; }
      }
      var msg;
      if (mismatches === 0) msg = '양쪽이 똑같아요.';
      else if (lh > rh) msg = '왼쪽이 오른쪽보다 ' + (lh - rh) + '단 높습니다';
      else if (rh > lh) msg = '오른쪽이 왼쪽보다 ' + (rh - lh) + '단 높습니다';
      else msg = (badRow + 1) + '단에서 왼쪽과 오른쪽 모양이 다릅니다';

      out.push({ key: 'symmetry', title: '좌우 대칭', ok: mismatches === 0, message: msg });
    })();

    /* --- 2. 탑은 문보다 작게 ------------------------------------------ */
    (function () {
      var cr = closedRow(design);
      if (cr < 0) {
        out.push({ key: 'tower', title: '탑은 문보다 작게', ok: true, message: '아직 문이 닫히지 않았어요 — 문을 먼저 완성하세요.' });
        return;
      }
      var doorH = cr;                      // 문 높이 = 열려 있던 단 수
      var towerH = top - cr;               // 문이 닫힌 단 위로 올라간 단 수
      if (towerH <= 0) {
        out.push({ key: 'tower', title: '탑은 문보다 작게', ok: true, message: '탑이 아직 없어요 (문 높이 ' + doorH + '단).' });
        return;
      }
      var limit = Math.floor(doorH / 2);
      out.push({
        key: 'tower', title: '탑은 문보다 작게', ok: towerH <= limit,
        message: '문 ' + doorH + '단, 탑 ' + towerH + '단 (탑은 ' + limit + '단 이하가 예뻐요).'
      });
    })();

    /* --- 3. 위로 갈수록 좁게 ------------------------------------------ */
    (function () {
      var prev = null, badRow = null;
      for (var y = 0; y <= top; y++) {
        var bb = M.rowBBox(maps, y, cols);
        if (!bb) continue;
        var w = bb.max - bb.min;
        if (prev !== null && w > prev && badRow === null) badRow = y;
        prev = w;
      }
      out.push({
        key: 'taper', title: '위로 갈수록 좁게', ok: badRow === null,
        message: badRow === null ? '위로 갈수록 좁아지고 있어요.' : (badRow + 1) + '단이 아래 단보다 넓습니다'
      });
    })();

    /* --- 4. 줄눈은 엇갈리게 ------------------------------------------- */
    (function () {
      var badRow = null;
      for (var y = 1; y <= top; y++) {
        var J = App.Rules.joints({ maps: maps, cols: cols, _joints: {} }, y - 1);
        var rowBricks = M.bricksInRow(design, y);
        for (var i = 0; i < rowBricks.length; i++) {
          var b = rowBricks[i], w = M.spans(b.orient).w;
          if (J[b.x] || J[b.x + w]) { badRow = y; break; }
        }
        if (badRow !== null) break;
      }
      out.push({
        key: 'bond', title: '줄눈은 엇갈리게', ok: badRow === null,
        message: badRow === null ? '줄눈이 모두 반 장씩 엇갈려 있어요.' : (badRow + 1) + '단에 통줄눈이 있습니다'
      });
    })();

    /* --- 5. 홀수로 세기 ------------------------------------------------ */
    (function () {
      if (top < 0) {
        out.push({ key: 'odd', title: '홀수로 세기', ok: true, message: '아직 쌓은 벽돌이 없어요.' });
        return;
      }
      var groups = M.groupsInRow(maps, top, cols);
      var n = groups.length;
      var isOdd = (n % 2) === 1;
      out.push({
        key: 'odd', title: '홀수로 세기', ok: isOdd,
        message: '맨 윗단 덩어리가 ' + n + '개예요' + (isOdd ? ' (홀수 좋아요).' : ' — 3개나 5개로 하면 더 예뻐요.')
      });
    })();

    return out;
  }

  App.Aesthetics = { check: check, closedRow: closedRow, minGap: minGap, mirrorX: mirrorX };

})(window);
