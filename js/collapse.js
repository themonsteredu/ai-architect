/* ===================================================================
   collapse.js  —  무너짐 연출

   물리엔진을 쓰지 않습니다.
   정해진 애니메이션(회전 + 낙하 + 살짝 튀기기, 약 0.6초)만 씁니다.

     1) 원인이 된 벽돌이 빨갛게 반짝  (0.36초)
     2) 앞으로 넘어지며 떨어짐        (0.6초)
     3) 위에 얹힌 벽돌들이 0.05초씩 늦게 따라 떨어짐 (도미노)
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var M = App.Model;

  var FLASH = 360;      // ms
  var FALL = 600;       // ms
  var STAGGER = 50;     // ms
  var MAX_SOUNDS = 6;

  function play(opts) {
    var design = opts.design;
    var elsById = opts.elsById;
    var culpritId = opts.culpritId;
    var boardH = opts.boardHeight;
    var mid = opts.midX;
    var onDone = opts.onDone || function () {};

    var maps = M.buildMaps(design);
    var order = [];
    var seen = {};

    function push(id) {
      if (id == null || seen[id] || !elsById[id]) return;
      seen[id] = true;
      order.push(id);
    }
    function byHeight(a, b) {
      var ba = maps.byId[a], bb = maps.byId[b];
      if (!ba || !bb) return 0;
      if (ba.y !== bb.y) return ba.y - bb.y;
      return ba.x - bb.x;
    }

    if (culpritId != null && elsById[culpritId]) {
      /* 원인이 된 벽돌 → 그 위에 얹힌 벽돌 → 같이 기울던 나머지 */
      push(culpritId);
      var chain = M.chainAbove(design, maps, culpritId).sort(byHeight);
      for (var i = 0; i < chain.length; i++) push(chain[i]);

      var extra = (opts.extraIds || []).slice().sort(byHeight);
      for (var e = 0; e < extra.length; e++) {
        push(extra[e]);
        var sub = M.chainAbove(design, maps, extra[e]).sort(byHeight);
        for (var s = 0; s < sub.length; s++) push(sub[s]);
      }
    } else {
      /* 원인을 특정 못 하면 전체가 무너짐 */
      var all = design.bricks.slice().sort(function (a, b) { return b.y - a.y; });
      for (var j = 0; j < all.length; j++) push(all[j].id);
    }
    if (!order.length) { onDone(); return 0; }

    var culpritEl = elsById[order[0]];
    if (culpritEl) culpritEl.classList.add('flash');

    var soundsLeft = MAX_SOUNDS;

    global.setTimeout(function () {
      if (culpritEl) culpritEl.classList.remove('flash');

      for (var k = 0; k < order.length; k++) {
        (function (rank) {
          var id = order[rank];
          var el = elsById[id];
          var brick = maps.byId[id];
          if (!el || !brick) return;

          var rect = { bottom: parseFloat(el.style.bottom) || 0 };
          var dir = (M.centerX(brick) < mid) ? -1 : 1;
          var dy = rect.bottom + 4;
          var dx = dir * (rect.bottom * 0.45 + 10);
          var rot = dir * (68 + (rank % 5) * 5);

          el.style.setProperty('--fdx', dx.toFixed(1) + 'px');
          el.style.setProperty('--fdy', dy.toFixed(1) + 'px');
          el.style.setProperty('--frot', rot.toFixed(0) + 'deg');
          el.style.animationDelay = (rank * STAGGER) + 'ms';
          el.classList.add('falling');

          if (soundsLeft > 0) {
            soundsLeft--;
            global.setTimeout(function () { App.Sound.clack(); }, rank * STAGGER + FALL * 0.72);
          }
        })(k);
      }

      global.setTimeout(onDone, order.length * STAGGER + FALL + 250);
    }, FLASH);

    return FLASH + order.length * STAGGER + FALL + 250;
  }

  App.Collapse = { play: play };

})(window);
