/* ===================================================================
   foundation.js  —  미리 깔아둘 기초 2단

   빈 화면에서 시작하면 학생이 아무것도 못 합니다.
   양쪽 기둥 자리에 벽돌 2단을 미리 깔아 두고 시작합니다.
   (3단 이상은 깔지 않습니다 — 코벨 시작점까지 알려주는 셈이라 너무 많이 줍니다)

   두 단은 엇갈려 쌓기(막힌줄눈)로 자동 생성됩니다.
     아랫단 : 눕히기로 채우고, 한 칸 남으면 세우기로 마감
     윗단   : 세우기로 시작해서 눕히기, 한 칸 남으면 세우기로 마감
   이렇게 하면 두 단의 줄눈이 반 장씩 어긋납니다.
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var M = App.Model;

  var DEFS = [
    { id: 'narrow', name: '좁은 문',      desc: '문이 좁아 코벨을 조금만 내밀면 됩니다',   openW: 4, pierW: 4 },
    { id: 'wide',   name: '넓은 문',      desc: '문이 넓어 코벨을 여러 단 내밀어야 합니다', openW: 6, pierW: 4 },
    { id: 'strong', name: '튼튼한 기둥',   desc: '기둥이 두꺼워 안정적이지만 벽돌을 더 씁니다', openW: 4, pierW: 5 }
  ];

  /* 기둥 한 단 만들기 */
  function pierCourse(a, b, course) {
    var out = [], x = a, L = CONFIG.lieCols;
    if (course === 1) { out.push({ x: a, orient: 'head' }); x = a + 1; }
    while (x + L - 1 <= b) { out.push({ x: x, orient: 'lie' }); x += L; }
    while (x <= b) { out.push({ x: x, orient: 'head' }); x += 1; }
    return out;
  }

  /* 받침판 폭에 맞게 문/기둥 크기를 줄여 맞춤 */
  function fit(def) {
    var cols = CONFIG.cols;
    var openW = def.openW, pierW = def.pierW;
    while (openW + 2 * pierW > cols && pierW > 2) pierW--;
    while (openW + 2 * pierW > cols && openW > 2) openW--;
    if (openW + 2 * pierW > cols) return null;
    return { openW: openW, pierW: pierW };
  }

  function describe(def) {
    var f = fit(def);
    if (!f) return null;
    var gateW = f.openW + 2 * f.pierW;
    var gs = Math.floor((CONFIG.cols - gateW) / 2);
    var piers = [[gs, gs + f.pierW - 1], [gs + f.pierW + f.openW, gs + gateW - 1]];
    var opening = [gs + f.pierW, gs + f.pierW + f.openW - 1];

    /* 벽돌 장수 미리 계산 */
    var bricks = 0;
    for (var p = 0; p < 2; p++) {
      for (var c = 0; c < 2; c++) {
        var items = pierCourse(piers[p][0], piers[p][1], c);
        for (var i = 0; i < items.length; i++) {
          bricks += (items[i].orient === 'head') ? 1 : 2;   // 기초는 모두 두 겹
        }
      }
    }

    return {
      id: def.id,
      name: def.name,
      desc: def.desc,
      gate: [gs, gs + gateW - 1],
      opening: opening,
      piers: piers,
      openMm: f.openW * CONFIG.cellMm,
      bricks: bricks
    };
  }

  function list() {
    var out = [];
    for (var i = 0; i < DEFS.length; i++) {
      var d = describe(DEFS[i]);
      if (d) out.push(d);
    }
    return out;
  }

  /* 실제 설계 만들기 */
  function create(id) {
    var all = list();
    var chosen = null;
    for (var i = 0; i < all.length; i++) if (all[i].id === id) chosen = all[i];
    if (!chosen) chosen = all[0];

    var design = {
      bricks: [],
      nextId: 1,
      meta: {
        foundationId: chosen.id,
        foundationName: chosen.name,
        gate: chosen.gate.slice(),
        opening: chosen.opening.slice(),
        piers: [chosen.piers[0].slice(), chosen.piers[1].slice()]
      },
      answerUsed: false
    };

    /* 왼쪽 기둥을 만들고, 오른쪽은 그것을 좌우로 뒤집어 만듭니다.
       (그래야 기초부터 좌우 대칭이 됩니다) */
    var axis2 = chosen.gate[0] + chosen.gate[1] + 1;
    for (var c = 0; c < 2; c++) {
      var items = pierCourse(chosen.piers[0][0], chosen.piers[0][1], c);
      for (var k = 0; k < items.length; k++) {
        var w = (items[k].orient === 'head') ? CONFIG.headCols : CONFIG.lieCols;
        var xs = [items[k].x, axis2 - items[k].x - w];
        for (var s = 0; s < 2; s++) {
          M.addBrick(design, {
            x: xs[s], y: c,
            orient: items[k].orient,
            wythes: 2,            // 기초는 앞뒤 두 겹
            fixed: true
          });
        }
      }
    }
    return design;
  }

  App.Foundation = { list: list, create: create, pierCourse: pierCourse };

})(window);
