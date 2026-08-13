/* ===================================================================
   model.js  —  설계 데이터 구조

   벽돌 하나(=배치 단위)
     { id, x, y, orient:'lie'|'head', wythes:1|2, fixed:true? }
     x, y 는 격자 좌표. y=0 이 받침판 바로 위(1층).
     orient 'lie'  = 눕히기 (가로 2칸, 1겹)
     orient 'head' = 세우기 (가로 1칸, 앞뒤 2겹을 한 번에)
     wythes 1 = 앞줄만, 2 = 앞줄+뒷줄
     fixed  = 미리 깔아둔 기초 (지울 수 없음)

   좌표 약속
     - 칸 번호는 0부터. 벽돌이 차지하는 칸은 x, x+1, ...
     - "가장자리 위치"는 칸 경계로 셉니다. x칸에 놓인 눕히기 벽돌의
       왼쪽 가장자리 = x, 오른쪽 가장자리 = x+2.
     - 무게중심 계산용 중심 좌표도 같은 단위(칸 경계 기준)를 씁니다.
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App = global.App || {};
  var CONFIG = App.CONFIG;

  function spans(orient) {
    if (orient === 'head') return { w: CONFIG.headCols, h: CONFIG.headRows };
    return { w: CONFIG.lieCols, h: CONFIG.lieRows };
  }

  /* 이 벽돌이 실제로 몇 겹을 채우는가 */
  function wythesOf(b) {
    if (b.orient === 'head') return CONFIG.headWythes;
    return b.wythes || 1;
  }

  /* 실물 벽돌 몇 장이 드는가 */
  function cost(b) {
    if (b.orient === 'head') return 1;              // 세우기는 한 장으로 앞뒤를 채움
    return b.wythes || 1;                            // 눕히기는 겹 수만큼
  }

  function cellsOf(b) {
    var sp = spans(b.orient), out = [];
    for (var dx = 0; dx < sp.w; dx++) {
      for (var dy = 0; dy < sp.h; dy++) out.push({ x: b.x + dx, y: b.y + dy });
    }
    return out;
  }

  /* 아래쪽 발자국 (받침 검사에 씀) */
  function footprint(b) {
    var sp = spans(b.orient), out = [];
    for (var dx = 0; dx < sp.w; dx++) out.push(b.x + dx);
    return out;
  }

  function centerX(b) { return b.x + spans(b.orient).w / 2; }
  function rightEdge(b) { return b.x + spans(b.orient).w; }

  /* 앞줄/뒷줄 점유 지도를 만든다.  키는 "x,y" */
  function buildMaps(design) {
    var front = {}, back = {}, byId = {};
    for (var i = 0; i < design.bricks.length; i++) {
      var b = design.bricks[i];
      byId[b.id] = b;
      var wy = wythesOf(b);
      var cells = cellsOf(b);
      for (var c = 0; c < cells.length; c++) {
        var key = cells[c].x + ',' + cells[c].y;
        front[key] = b.id;
        if (wy >= 2) back[key] = b.id;
      }
    }
    return { front: front, back: back, byId: byId };
  }

  function idAt(maps, x, y) {
    var k = x + ',' + y;
    return maps.front[k] || maps.back[k] || null;
  }

  function totalCost(design) {
    var n = 0;
    for (var i = 0; i < design.bricks.length; i++) n += cost(design.bricks[i]);
    return n;
  }

  function bricksInRow(design, y) {
    var out = [];
    for (var i = 0; i < design.bricks.length; i++) if (design.bricks[i].y === y) out.push(design.bricks[i]);
    return out;
  }

  /* 한 단의 좌우 범위 (칸 경계 기준). 비어 있으면 null */
  function rowBBox(maps, y, cols) {
    var min = null, max = null;
    for (var x = 0; x < cols; x++) {
      if (idAt(maps, x, y)) {
        if (min === null) min = x;
        max = x + 1;
      }
    }
    return (min === null) ? null : { min: min, max: max };
  }

  /* 한 단 안에서 벽돌과 벽돌이 만나는 세로 이음매(줄눈) 위치들 */
  function jointsInRow(maps, y, cols) {
    var set = {};
    for (var x = 1; x < cols; x++) {
      var a = idAt(maps, x - 1, y);
      var b = idAt(maps, x, y);
      if (a && b && a !== b) set[x] = true;
    }
    return set;
  }

  /* 가장 높은 단 (비어 있으면 -1) */
  function topRow(design) {
    var t = -1;
    for (var i = 0; i < design.bricks.length; i++) if (design.bricks[i].y > t) t = design.bricks[i].y;
    return t;
  }

  /* 한 단에서 가로로 붙어 있는 덩어리들 */
  function groupsInRow(maps, y, cols) {
    var groups = [], cur = null;
    for (var x = 0; x < cols; x++) {
      if (idAt(maps, x, y)) {
        if (!cur) { cur = { a: x, b: x }; groups.push(cur); }
        else cur.b = x;
      } else cur = null;
    }
    return groups;
  }

  function cloneDesign(design) {
    var bricks = [];
    for (var i = 0; i < design.bricks.length; i++) {
      var b = design.bricks[i];
      bricks.push({ id: b.id, x: b.x, y: b.y, orient: b.orient, wythes: b.wythes, fixed: b.fixed });
    }
    return {
      bricks: bricks,
      nextId: design.nextId,
      meta: {
        foundationId: design.meta.foundationId,
        foundationName: design.meta.foundationName,
        gate: design.meta.gate.slice(),
        opening: design.meta.opening.slice(),
        piers: [design.meta.piers[0].slice(), design.meta.piers[1].slice()]
      },
      answerUsed: design.answerUsed
    };
  }

  function addBrick(design, b) {
    var brick = { id: design.nextId++, x: b.x, y: b.y, orient: b.orient, wythes: b.wythes || 1, fixed: !!b.fixed };
    if (brick.orient === 'head') brick.wythes = CONFIG.headWythes;
    design.bricks.push(brick);
    return brick;
  }

  function removeBrickById(design, id) {
    for (var i = 0; i < design.bricks.length; i++) {
      if (design.bricks[i].id === id) { design.bricks.splice(i, 1); return true; }
    }
    return false;
  }

  /* id 로 벽돌 찾기 */
  function get(design, id) {
    for (var i = 0; i < design.bricks.length; i++) if (design.bricks[i].id === id) return design.bricks[i];
    return null;
  }

  /* 이 벽돌이 딛고 있는 아래 벽돌들의 id */
  function supportersOf(maps, b) {
    if (b.y === 0) return [];
    var fp = footprint(b), seen = {}, out = [];
    for (var i = 0; i < fp.length; i++) {
      var id = idAt(maps, fp[i], b.y - 1);
      if (id && !seen[id]) { seen[id] = true; out.push(id); }
    }
    return out;
  }

  /* 이 벽돌 위에 (직접) 얹혀 있는 벽돌들의 id */
  function restingOn(design, maps, b) {
    var out = [], sp = spans(b.orient);
    for (var i = 0; i < design.bricks.length; i++) {
      var o = design.bricks[i];
      if (o.y !== b.y + sp.h) continue;
      var fp = footprint(o);
      for (var j = 0; j < fp.length; j++) {
        if (fp[j] >= b.x && fp[j] < b.x + sp.w) { out.push(o.id); break; }
      }
    }
    return out;
  }

  /* 이 벽돌 위에 얹힌 모든 벽돌 (연쇄) */
  function chainAbove(design, maps, startId) {
    var result = [], seen = {}, stack = [startId];
    seen[startId] = true;
    while (stack.length) {
      var id = stack.pop();
      var b = get(design, id);
      if (!b) continue;
      var ups = restingOn(design, maps, b);
      for (var i = 0; i < ups.length; i++) {
        if (!seen[ups[i]]) { seen[ups[i]] = true; result.push(ups[i]); stack.push(ups[i]); }
      }
    }
    return result;
  }

  App.Model = {
    spans: spans,
    wythesOf: wythesOf,
    cost: cost,
    cellsOf: cellsOf,
    footprint: footprint,
    centerX: centerX,
    rightEdge: rightEdge,
    buildMaps: buildMaps,
    idAt: idAt,
    totalCost: totalCost,
    bricksInRow: bricksInRow,
    rowBBox: rowBBox,
    jointsInRow: jointsInRow,
    groupsInRow: groupsInRow,
    topRow: topRow,
    cloneDesign: cloneDesign,
    addBrick: addBrick,
    removeBrickById: removeBrickById,
    get: get,
    supportersOf: supportersOf,
    restingOn: restingOn,
    chainAbove: chainAbove
  };

})(window);
