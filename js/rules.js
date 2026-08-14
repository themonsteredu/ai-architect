/* ===================================================================
   rules.js  —  구조 규칙 (못 놓게 막는 자리)

   규칙마다 "왜 안 되는지" 한 줄 안내문이 붙습니다.
   이 안내문이 곧 수업 내용입니다.

     받침 없음        아래에 벽돌이 없음          "아래에 받침이 없어요"
     절반 미만 걸침    아래 벽돌에 절반 이상 얹혀야  "너무 많이 튀어나왔어요 — 절반 이하로"
     줄눈 일직선      아래층 이음매 바로 위 금지    "줄눈이 일직선이 됩니다 — 반 장 옆으로"
     한 겹 3단 초과   두께 1장인 벽은 3단까지      "한 겹 벽은 3단까지 — 뒤에 한 겹 더 필요해요"
     아래보다 넓어짐   위층이 아래층 밖으로 나감     "위로 갈수록 좁아져야 해요"
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;

  var SINGLE_WYTHE_LIMIT = 3;   // 한 겹으로 쌓을 수 있는 최대 단 수

  function ok() { return { ok: true }; }
  function fail(code, message) { return { ok: false, code: code, message: message }; }

  /* 검사에 필요한 것들을 한 번만 만들어 두고 재사용 */
  function makeContext(design) {
    var maps = M.buildMaps(design);
    return {
      design: design,
      maps: maps,
      cols: CONFIG.cols,
      rows: CONFIG.rows,
      opening: (design.meta && design.meta.opening) || null,
      used: M.totalCost(design),
      max: CONFIG.maxBricks,
      _joints: {},
      _bbox: {}
    };
  }

  function joints(ctx, y) {
    if (ctx._joints[y] === undefined) ctx._joints[y] = M.jointsInRow(ctx.maps, y, ctx.cols);
    return ctx._joints[y];
  }

  function bbox(ctx, y) {
    if (ctx._bbox[y] === undefined) ctx._bbox[y] = M.rowBBox(ctx.maps, y, ctx.cols);
    return ctx._bbox[y];
  }

  /* -----------------------------------------------------------------
     이 자리에 이 벽돌을 놓을 수 있는가?
     cand = { x, y, orient, wythes }
     skipAbove : 위층 벽돌까지 다시 보지는 않음 (내부에서만 씀)
     ----------------------------------------------------------------- */
  function canPlace(ctx, cand, skipAbove) {
    var sp = M.spans(cand.orient);
    var wy = M.wythesOf(cand);
    var fp = M.footprint(cand);
    var n = fp.length;
    var i, key;

    /* 0. 받침판 / 화면 밖 --------------------------------------------- */
    if (cand.x < 0 || cand.x + sp.w > ctx.cols) return fail('OUT', '받침판 밖입니다');
    if (cand.y < 0) return fail('OUT', '받침판 밖입니다');
    if (cand.y + sp.h > ctx.rows) return fail('OUT', '더 높이 쌓을 수 없어요');

    /* 1. 벽돌 상한 ---------------------------------------------------- */
    if (ctx.used + M.cost(cand) > ctx.max) {
      return fail('BUDGET', '벽돌을 다 썼어요 — ' + ctx.max + '장까지만 쓸 수 있어요');
    }

    /* 1-b. 문 자리 (땅바닥) -------------------------------------------
       바닥에는 받침 규칙이 없어서 문 한가운데에도 놓을 수 있어 버립니다.
       사람이 지나갈 자리이므로 맨 아래 단에서는 문 자리를 막습니다.
       (2단부터는 "받침 없음" 규칙이 알아서 막아 줍니다) */
    if (cand.y === 0 && ctx.opening) {
      for (i = 0; i < n; i++) {
        if (fp[i] >= ctx.opening[0] && fp[i] <= ctx.opening[1]) {
          return fail('DOORWAY', '여기는 문이 지나갈 자리예요 — 비워 두세요');
        }
      }
    }

    /* 2. 이미 벽돌이 있는 자리 ---------------------------------------- */
    var cells = M.cellsOf(cand);
    for (i = 0; i < cells.length; i++) {
      key = cells[i].x + ',' + cells[i].y;
      if (ctx.maps.front[key]) return fail('OVERLAP', '이미 벽돌이 있어요');
      if (wy >= 2 && ctx.maps.back[key]) return fail('OVERLAP', '이미 벽돌이 있어요');
    }

    /* 3. 받침 없음 / 4. 절반 미만 걸침 --------------------------------
       앞줄과 뒷줄을 각각 따로 검사합니다.
       (한 겹 벽 위에 두 겹 벽돌을 올리면 뒷줄이 허공에 뜹니다) */
    if (cand.y > 0) {
      var frontSup = 0, backSup = 0;
      for (i = 0; i < n; i++) {
        key = fp[i] + ',' + (cand.y - 1);
        if (ctx.maps.front[key]) frontSup++;
        if (ctx.maps.back[key]) backSup++;
      }
      if (frontSup === 0) return fail('NO_SUPPORT', '아래에 받침이 없어요');
      if (frontSup / n < 0.5) return fail('HALF', '너무 많이 튀어나왔어요 — 절반 이하로');
      if (wy >= 2) {
        if (backSup === 0) return fail('NO_SUPPORT_BACK', '뒷줄 아래에 받침이 없어요 — 아래도 두 겹이어야 해요');
        if (backSup / n < 0.5) return fail('HALF', '뒷줄이 너무 많이 튀어나왔어요 — 절반 이하로');
      }
    }

    /* 5. 줄눈 일직선 --------------------------------------------------- */
    if (cand.y > 0) {
      var J = joints(ctx, cand.y - 1);
      if (J[cand.x] || J[cand.x + sp.w]) {
        return fail('JOINT', '줄눈이 일직선이 됩니다 — 반 장 옆으로');
      }
    }

    /* 6. 한 겹 3단 초과 ------------------------------------------------ */
    if (wy === 1) {
      var run = 0, r = cand.y - 1;
      while (r >= 0) {
        var found = false, allThin = true;
        for (i = 0; i < n; i++) {
          var id = M.idAt(ctx.maps, fp[i], r);
          if (id) {
            found = true;
            if (M.wythesOf(ctx.maps.byId[id]) !== 1) allThin = false;
          }
        }
        if (!found || !allThin) break;
        run++; r--;
      }
      if (run >= SINGLE_WYTHE_LIMIT) {
        return fail('THIN', '한 겹 벽은 ' + SINGLE_WYTHE_LIMIT + '단까지 — 뒤에 한 겹 더 필요해요');
      }
    }

    /* 7. 아래보다 넓어짐 ------------------------------------------------
       한 단 전체의 좌우 폭이 아래 단의 좌우 폭 밖으로 나가면 안 됩니다.
       (문 안쪽으로 내미는 코벨은 폭 안쪽이므로 허용됩니다) */
    if (cand.y > 0) {
      var below = bbox(ctx, cand.y - 1);
      if (below) {
        var here = bbox(ctx, cand.y);
        var min = here ? Math.min(here.min, cand.x) : cand.x;
        var max = here ? Math.max(here.max, cand.x + sp.w) : (cand.x + sp.w);
        if (min < below.min || max > below.max) {
          return fail('WIDER', '위로 갈수록 좁아져야 해요');
        }
      }
    }

    /* 8. 위에 이미 얹혀 있는 벽돌을 어기게 만들지는 않는가 --------------
       빈틈을 나중에 메우면, 새로 생긴 이음매 때문에 위 벽돌이
       통줄눈이 되어 버릴 수 있습니다. 그런 자리는 미리 막습니다.
       (보통은 맨 위에 쌓으므로 이 검사는 건너뜁니다) */
    if (!skipAbove) {
      var aboveRow = cand.y + sp.h;
      var aboveBricks = M.bricksInRow(ctx.design, aboveRow);
      if (aboveBricks.length) {
        var withCand = M.cloneDesign(ctx.design);
        M.addBrick(withCand, cand);
        for (i = 0; i < aboveBricks.length; i++) {
          var ab = aboveBricks[i];
          var probe = M.cloneDesign(withCand);
          M.removeBrickById(probe, ab.id);
          var pctx = makeContext(probe);
          pctx.max = Infinity;
          var r = canPlace(pctx, ab, true);
          if (!r.ok) {
            return fail('BLOCKS_ABOVE', '여기에 놓으면 위 벽돌이 규칙에 어긋나요 — ' + r.message);
          }
        }
      }
    }

    return ok();
  }

  /* -----------------------------------------------------------------
     "뒤에 한 겹 더 붙이기" (한 겹 → 두 겹)
     ----------------------------------------------------------------- */
  function canThicken(ctx, brick) {
    if (!brick) return fail('NONE', '벽돌이 없어요');
    if (brick.orient === 'head') return fail('ALREADY', '90° 돌려놓은 벽돌은 긴 방향이 앞뒤를 이미 채우고 있어요');
    if (M.wythesOf(brick) >= 2) return fail('ALREADY', '이미 두 겹이에요');
    if (ctx.used + 1 > ctx.max) return fail('BUDGET', '벽돌을 다 썼어요');

    var fp = M.footprint(brick), n = fp.length, i, key;
    for (i = 0; i < n; i++) {
      key = fp[i] + ',' + brick.y;
      if (ctx.maps.back[key]) return fail('OVERLAP', '뒷줄에 이미 벽돌이 있어요');
    }
    if (brick.y > 0) {
      var backSup = 0;
      for (i = 0; i < n; i++) {
        key = fp[i] + ',' + (brick.y - 1);
        if (ctx.maps.back[key]) backSup++;
      }
      if (backSup === 0) return fail('NO_SUPPORT_BACK', '뒷줄 아래에 받침이 없어요 — 아래 단부터 두 겹으로');
      if (backSup / n < 0.5) return fail('HALF', '뒷줄이 너무 많이 튀어나왔어요 — 절반 이하로');
    }
    return ok();
  }

  /* -----------------------------------------------------------------
     지금 놓을 수 있는 자리 전부 찾기 (초록 표시용)
     ----------------------------------------------------------------- */
  function allSpots(design, orient, wythes) {
    var ctx = makeContext(design);
    var sp = M.spans(orient);
    var out = [];
    for (var y = 0; y < ctx.rows; y++) {
      for (var x = 0; x + sp.w <= ctx.cols; x++) {
        var cand = { x: x, y: y, orient: orient, wythes: wythes };
        if (canPlace(ctx, cand).ok) out.push({ x: x, y: y, orient: orient, wythes: wythes, w: sp.w, h: sp.h });
      }
    }
    return out;
  }

  /* -----------------------------------------------------------------
     완성된 설계 전체를 다시 검사 (지우기 등으로 깨졌을 수 있음)
     아래 단부터 하나씩 다시 놓아 보는 방식
     ----------------------------------------------------------------- */
  function validateAll(design) {
    var sorted = design.bricks.slice().sort(function (a, b) {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    var partial = {
      bricks: [], nextId: 1,
      meta: design.meta, answerUsed: design.answerUsed
    };
    for (var i = 0; i < sorted.length; i++) {
      var b = sorted[i];
      var ctx = makeContext(partial);
      ctx.max = Infinity;                     // 개수는 따로 확인
      var res = canPlace(ctx, b);
      if (!res.ok && res.code !== 'BUDGET') {
        return { ok: false, brickId: b.id, code: res.code, message: res.message };
      }
      partial.bricks.push(b);
    }
    return { ok: true };
  }

  App.Rules = {
    SINGLE_WYTHE_LIMIT: SINGLE_WYTHE_LIMIT,
    makeContext: makeContext,
    canPlace: canPlace,
    canThicken: canThicken,
    allSpots: allSpots,
    validateAll: validateAll,
    joints: joints
  };

})(window);
