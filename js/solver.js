/* ===================================================================
   solver.js  —  도움 단계

   1단계 힌트 : 다음에 놓을 자리 한 칸만 반짝 (학생 설계는 그대로 유지)
   2단계 정답 : 강사가 설정에서 열어줘야 보임

   두 기능 모두 "지금 놓을 수 있는 자리"를 전부 만들어 보고
   점수가 가장 높은 자리를 고르는 방식입니다.
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;

  /* 문 열린 칸을 얼마나 메웠는지 (많을수록 아치가 진행됨) */
  function progress(design) {
    var maps = M.buildMaps(design);
    var op = design.meta.opening;
    var top = M.topRow(design);
    var sum = 0;
    for (var y = 1; y <= top; y++) {
      for (var x = op[0]; x <= op[1]; x++) if (M.idAt(maps, x, y)) sum++;
    }
    return sum;
  }

  /* 같은 단의 거울 자리에 이미 벽돌이 있는가 */
  function hasMirrorPartner(design, cand) {
    var mx = App.Aesthetics.mirrorX(design, cand);
    for (var i = 0; i < design.bricks.length; i++) {
      var b = design.bricks[i];
      if (b.y === cand.y && b.x === mx && b.orient === cand.orient) return true;
    }
    return false;
  }

  function sideCount(design, y, mid, side) {
    var n = 0;
    for (var i = 0; i < design.bricks.length; i++) {
      var b = design.bricks[i];
      if (b.y !== y) continue;
      var cx = M.centerX(b);
      if (side < 0 && cx < mid) n++;
      if (side > 0 && cx > mid) n++;
    }
    return n;
  }

  function candidates(design) {
    var out = [];
    var orients = ['lie', 'head'];
    var wytheOptions = [2, 1];
    for (var o = 0; o < orients.length; o++) {
      for (var w = 0; w < wytheOptions.length; w++) {
        if (orients[o] === 'head' && wytheOptions[w] === 1) continue;   // 세우기는 항상 두 겹
        var spots = App.Rules.allSpots(design, orients[o], wytheOptions[w]);
        for (var i = 0; i < spots.length; i++) out.push(spots[i]);
      }
    }
    return out;
  }

  /* -----------------------------------------------------------------
     다음에 놓기 좋은 자리 한 개 고르기
     goal 'close'  = 문을 닫는 것이 목표
     goal 'finish' = 문이 닫힌 뒤 위를 마무리하는 것이 목표
     ----------------------------------------------------------------- */
  function bestMove(design, goal, maxRow) {
    var cands = candidates(design);
    if (!cands.length) return null;

    var gate = design.meta.gate;
    var mid = (gate[0] + gate[1] + 1) / 2;
    var gapBefore = App.Aesthetics.minGap(design);
    var progBefore = progress(design);
    var rows = CONFIG.rows;

    var best = null, bestScore = -Infinity;

    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (maxRow !== undefined && c.y > maxRow) continue;

      /* 문 바깥으로 벗어난 자리는 쓰지 않는다 (문을 만드는 것이 목표) */
      if (c.x < gate[0] || c.x + c.w > gate[1] + 1) continue;

      var sim = M.cloneDesign(design);
      M.addBrick(sim, c);

      /* 무게중심이 무너지는 자리는 아예 후보에서 뺀다 */
      var bal = App.Balance.analyze(sim);
      if (!bal.ok) continue;

      /* 한 단을 다 채우고 나서 위로 올라간다 (실물을 쌓는 순서와 같게).
         그래서 "낮은 단"이 다른 어떤 점수보다 크게 앞섭니다. */
      var score = 10000 * (rows - c.y);

      if (goal === 'close') {
        var gapAfter = App.Aesthetics.minGap(sim);
        var progAfter = progress(sim);
        score += 900 * (progAfter - progBefore);
        if (gapAfter < gapBefore) score += 4000;
        if (gapAfter === 0) score += 60000;
      } else {
        /* 마무리 단계 — 낮고 대칭인 자리를 좋아함 */
        score += 40;
      }

      if (hasMirrorPartner(design, c)) score += 400;                // 좌우 대칭
      var side = (M.centerX(c) < mid) ? -1 : (M.centerX(c) > mid ? 1 : 0);
      if (side !== 0) {
        var mine = sideCount(design, c.y, mid, side);
        var other = sideCount(design, c.y, mid, -side);
        if (mine < other) score += 250;                             // 적은 쪽부터
        else if (mine > other) score -= 150;
      }
      /* 기초가 두 겹이므로 위도 두 겹으로 쌓아야 계속 올라갈 수 있다 */
      if (M.wythesOf(c) >= 2) score += 180;
      score -= 4 * M.cost(c);                                       // 벽돌 아끼기
      score += (c.orient === 'lie') ? 20 : 0;                       // 되도록 눕히기

      if (score > bestScore) { bestScore = score; best = c; }
    }

    return best;
  }

  /* 학생용 힌트 (한 자리) */
  function hint(design) {
    var goal = (App.Aesthetics.minGap(design) > 0) ? 'close' : 'finish';
    return bestMove(design, goal);
  }

  /* -----------------------------------------------------------------
     정답 도면 만들기
     ----------------------------------------------------------------- */
  function solve(base) {
    var d = M.cloneDesign(base);
    var added = [];
    var guard = 400;
    var fullStop = CONFIG.maxBricks;

    /* 1단계 — 문 닫기 (가장 중요하므로 예산을 아끼지 않습니다) */
    while (guard-- > 0 && App.Aesthetics.minGap(d) > 0) {
      if (M.totalCost(d) >= fullStop) break;
      var mv = bestMove(d, 'close');
      if (!mv) break;
      added.push(M.addBrick(d, mv).id);
    }

    /* 2단계 — 아치 위를 한 단 덮기 */
    var cr = App.Aesthetics.closedRow(d);
    if (cr >= 0) {
      guard = 200;
      while (guard-- > 0 && M.totalCost(d) < fullStop) {
        var mv2 = bestMove(d, 'finish', cr + 1);
        if (!mv2) break;
        added.push(M.addBrick(d, mv2).id);
      }
      /* 3단계 — 총안(성벽 위 홈) 3개 */
      addCrenellations(d, added, fullStop);
    }

    /* 4단계 — 예산이 모자라 한쪽만 올라간 맨 윗단은 걷어냅니다 (좌우 대칭) */
    trimTopToSymmetry(d);

    /* 안전장치 — 검증을 통과할 때까지 마지막에 넣은 것부터 뺀다 */
    var res = App.Validate.run(d);
    var safety = 400;
    while (res.status !== 'ok' && added.length && safety-- > 0) {
      M.removeBrickById(d, added.pop());
      res = App.Validate.run(d);
    }
    d.answerUsed = true;
    return d;
  }

  /* 맨 윗단에서 짝이 없는 벽돌(= 좌우 비대칭)을 걷어낸다 */
  function trimTopToSymmetry(d) {
    var guard = 40;
    while (guard-- > 0) {
      var top = M.topRow(d);
      if (top < 0) break;
      var rowB = M.bricksInRow(d, top);
      var orphans = [];
      for (var i = 0; i < rowB.length; i++) {
        var b = rowB[i];
        if (b.fixed) continue;
        var mx = App.Aesthetics.mirrorX(d, b);
        var found = false;
        for (var j = 0; j < rowB.length; j++) {
          if (rowB[j].x === mx && rowB[j].orient === b.orient && M.wythesOf(rowB[j]) === M.wythesOf(b)) { found = true; break; }
        }
        if (!found) orphans.push(b.id);
      }
      if (!orphans.length) break;
      for (var k = 0; k < orphans.length; k++) M.removeBrickById(d, orphans[k]);
    }
  }

  /* 맨 윗단에 총안 3개를 대칭으로 놓는다 */
  function addCrenellations(d, added, budgetStop) {
    var gate = d.meta.gate;
    var mid = (gate[0] + gate[1] + 1) / 2;
    var row = M.topRow(d) + 1;
    if (row >= CONFIG.rows) return;

    function valid(cand) {
      var ctx = App.Rules.makeContext(d);
      return App.Rules.canPlace(ctx, cand).ok;
    }
    function tryPlace(x, orient, wythes) {
      var cand = { x: x, y: row, orient: orient, wythes: wythes };
      if (M.totalCost(d) + M.cost(cand) > budgetStop) return false;
      if (!valid(cand)) return false;
      added.push(M.addBrick(d, cand).id);
      return true;
    }

    /* 가운데 하나 */
    var spots = App.Rules.allSpots(d, 'lie', 2).filter(function (s) { return s.y === row; });
    if (!spots.length) spots = App.Rules.allSpots(d, 'lie', 1).filter(function (s) { return s.y === row; });
    if (!spots.length) return;
    spots.sort(function (a, b) {
      return Math.abs(a.x + M.spans(a.orient).w / 2 - mid) - Math.abs(b.x + M.spans(b.orient).w / 2 - mid);
    });
    var center = spots[0];
    if (!tryPlace(center.x, center.orient, center.wythes)) return;

    /* 좌우 대칭으로 하나씩, 가운데와 한 칸 이상 떨어지게 */
    var pool = App.Rules.allSpots(d, 'lie', center.wythes).filter(function (s) { return s.y === row; });
    pool.sort(function (a, b) { return Math.abs(b.x - mid) - Math.abs(a.x - mid); });   // 바깥쪽부터
    for (var i = 0; i < pool.length; i++) {
      var s = pool[i];
      var w = M.spans(s.orient).w;
      if (s.x + w >= center.x && s.x <= center.x + M.spans(center.orient).w) continue;  // 붙어 있으면 건너뜀
      if (s.x + w === center.x || s.x === center.x + M.spans(center.orient).w) continue;
      var mx = App.Aesthetics.mirrorX(d, { x: s.x, orient: s.orient });
      var ok1 = tryPlace(s.x, s.orient, s.wythes);
      if (!ok1) continue;
      var ok2 = tryPlace(mx, s.orient, s.wythes);
      if (!ok2) { M.removeBrickById(d, added.pop()); continue; }
      break;
    }
  }

  App.Solver = { hint: hint, bestMove: bestMove, solve: solve, progress: progress };

})(window);
