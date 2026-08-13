/* ===================================================================
   balance.js  —  무게중심

   중학교 1학년 수준의 "평균" 계산입니다.
     각 단에서, 그 위에 얹혀 있는 벽돌들의 x좌표 평균을 냅니다.
     그 평균이 아래 단의 좌우 범위를 벗어나면 → 넘어집니다.

   예)  벽돌이 1, 2, 3번 칸에 있으면 (1+2+3)÷3 = 2번 → 받침(1~3) 안 → 안 넘어짐
        벽돌이 3, 4, 5번 칸에 있으면 (3+4+5)÷3 = 4번 → 받침(1~3) 밖 → 넘어짐

   문(門)은 기둥이 둘이므로, 한 단의 "받침"을 붙어 있는 덩어리별로 나눠서
   각 덩어리마다 따로 평균을 냅니다.
   양쪽 기둥에 함께 걸쳐 있는 벽돌(=아치가 닫힌 부분)은 양쪽이 같이 받치므로
   어느 한쪽의 계산에도 넣지 않습니다.
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;

  var EPS = 1e-9;

  /* 전체 무게중심 (화면의 세로 점선) */
  function overallCenter(design) {
    var sum = 0, mass = 0;
    for (var i = 0; i < design.bricks.length; i++) {
      var b = design.bricks[i], w = M.cost(b);
      sum += M.centerX(b) * w;
      mass += w;
    }
    if (mass === 0) return null;
    return sum / mass;
  }

  /* 맨 아래 단(받침판에 닿은 단)의 좌우 범위 */
  function baseRange(design) {
    var maps = M.buildMaps(design);
    var bb = M.rowBBox(maps, 0, CONFIG.cols);
    return bb ? [bb.min, bb.max] : null;
  }

  /* -----------------------------------------------------------------
     단마다 무게중심을 검사한다.
     반환: { ok, layers:[{row, groups:[{range, meanX, ok, members}]}], worst }
     ----------------------------------------------------------------- */
  function analyze(design) {
    var cols = CONFIG.cols;
    var maps = M.buildMaps(design);
    var top = M.topRow(design);
    var layers = [], worst = null;

    for (var y = 1; y <= top; y++) {
      var groups = M.groupsInRow(maps, y - 1, cols);
      if (!groups.length) continue;

      /* 아래 단의 각 칸이 몇 번 덩어리인지 */
      var groupOfCell = {};
      for (var g = 0; g < groups.length; g++) {
        for (var x = groups[g].a; x <= groups[g].b; x++) groupOfCell[x] = g;
      }

      /* 위쪽 벽돌들이 "어느 덩어리 위에 있는지" 아래에서 위로 따라 올라가며 계산 */
      var attribution = {};                     // brickId -> {groupIdx:true,...}
      for (var r = y; r <= top; r++) {
        var rowBricks = M.bricksInRow(design, r);
        for (var i = 0; i < rowBricks.length; i++) {
          var b = rowBricks[i];
          var set = {};
          var sups = M.supportersOf(maps, b);
          for (var s = 0; s < sups.length; s++) {
            var sb = maps.byId[sups[s]];
            if (!sb) continue;
            if (r === y) {
              var fp = M.footprint(sb);
              for (var f = 0; f < fp.length; f++) {
                if (groupOfCell[fp[f]] !== undefined) set[groupOfCell[fp[f]]] = true;
              }
            } else {
              var up = attribution[sb.id];
              for (var k in up) if (up.hasOwnProperty(k)) set[k] = true;
            }
          }
          attribution[b.id] = set;
        }
      }

      var layer = { row: y, groups: [] };
      for (var gi = 0; gi < groups.length; gi++) {
        var range = [groups[gi].a, groups[gi].b + 1];
        var sum = 0, mass = 0, members = [];
        for (var bi = 0; bi < design.bricks.length; bi++) {
          var bb = design.bricks[bi];
          if (bb.y < y) continue;
          var set2 = attribution[bb.id];
          if (!set2) continue;
          var keys = [];
          for (var kk in set2) if (set2.hasOwnProperty(kk)) keys.push(kk);
          if (keys.length !== 1 || Number(keys[0]) !== gi) continue;   // 여러 덩어리에 걸친 벽돌은 제외
          var w = M.cost(bb);
          sum += M.centerX(bb) * w;
          mass += w;
          members.push(bb);
        }
        if (mass === 0) {
          layer.groups.push({ range: range, meanX: null, ok: true, members: [] });
          continue;
        }
        var mean = sum / mass;
        var isOk = (mean >= range[0] - EPS) && (mean <= range[1] + EPS);
        var entry = { range: range, meanX: mean, ok: isOk, members: members };
        layer.groups.push(entry);

        if (!isOk) {
          var over = (mean < range[0]) ? (range[0] - mean) : (mean - range[1]);
          if (!worst || y < worst.row) {
            worst = { row: y, range: range, meanX: mean, over: over, members: members };
          }
        }
      }
      layers.push(layer);
    }

    return { ok: !worst, layers: layers, worst: worst };
  }

  /* 무너질 때 "원인이 된 벽돌" 하나를 고른다 (가장 많이 튀어나온 벽돌) */
  function culpritOf(worst) {
    if (!worst || !worst.members.length) return null;
    var side = (worst.meanX > worst.range[1]) ? 1 : -1;
    var best = null, bestScore = -Infinity;
    for (var i = 0; i < worst.members.length; i++) {
      var b = worst.members[i];
      var score = side * M.centerX(b) + b.y * 0.01;     // 바깥쪽 + 위쪽 우선
      if (b.fixed) score -= 1000;                       // 기초는 원인으로 삼지 않음
      if (score > bestScore) { bestScore = score; best = b; }
    }
    return best;
  }

  /* 사람이 읽는 설명 (수업에서 그대로 쓸 수 있게 숫자를 보여준다) */
  function explain(worst) {
    if (!worst) return null;
    var mean = Math.round(worst.meanX * 10) / 10;
    return worst.row + '단 위에 얹힌 벽돌들의 평균 위치 = ' + mean + '칸, ' +
           '받침 범위 = ' + worst.range[0] + '~' + worst.range[1] + '칸 → 범위를 벗어났습니다';
  }

  App.Balance = {
    overallCenter: overallCenter,
    baseRange: baseRange,
    analyze: analyze,
    culpritOf: culpritOf,
    explain: explain
  };

})(window);
