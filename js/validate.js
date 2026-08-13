/* ===================================================================
   validate.js  —  "세워보기" 검증

   순서
     1. 구조 규칙을 다시 전부 검사 (지우다가 깨졌을 수 있음)
     2. 문이 닫혔는지 확인 (코벨 아치가 가운데에서 만났는지)
     3. 무게중심 검사 (단마다 평균 내기)
     4. 미적 규칙은 통과/실패와 상관없이 안내만
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var M = App.Model;

  function run(design) {
    var aesthetics = App.Aesthetics.check(design);

    /* 1. 구조 규칙 */
    var structural = App.Rules.validateAll(design);
    if (!structural.ok) {
      return {
        status: 'collapse',
        title: '무너졌어요',
        reason: structural.message,
        detail: '규칙에 어긋난 벽돌이 있습니다.',
        culpritId: structural.brickId,
        aesthetics: aesthetics
      };
    }

    /* 2. 무게중심 — 문이 아직 안 닫혔더라도 기울면 넘어집니다 */
    var bal = App.Balance.analyze(design);
    if (!bal.ok) {
      var culprit = App.Balance.culpritOf(bal.worst);
      /* 기울어진 쪽에 얹혀 있던 벽돌들도 같이 쏟아집니다 */
      var fallIds = [];
      for (var m = 0; m < bal.worst.members.length; m++) {
        if (!bal.worst.members[m].fixed) fallIds.push(bal.worst.members[m].id);
      }
      return {
        status: 'collapse',
        title: '무너졌어요',
        reason: '무게중심이 받침 밖으로 나갔습니다.',
        detail: App.Balance.explain(bal.worst),
        culpritId: culprit ? culprit.id : null,
        fallIds: fallIds,
        aesthetics: aesthetics
      };
    }

    /* 3. 문이 닫혔는가 */
    var closed = App.Aesthetics.closedRow(design);
    if (closed < 0) {
      var gap = App.Aesthetics.minGap(design);
      return {
        status: 'incomplete',
        title: '아직 문이 닫히지 않았어요',
        reason: '가운데가 ' + gap + '칸 벌어져 있습니다.',
        detail: '양쪽에서 반 장씩 번갈아 내밀어 가운데에서 만나게 하세요.',
        aesthetics: aesthetics
      };
    }

    /* 통과 */
    var advisories = [];
    for (var i = 0; i < aesthetics.length; i++) if (!aesthetics[i].ok) advisories.push(aesthetics[i]);

    return {
      status: 'ok',
      title: '완성! 무너지지 않습니다',
      reason: '구조 규칙과 무게중심을 모두 통과했습니다.',
      detail: advisories.length
        ? '더 예쁘게 만들 수 있는 점이 ' + advisories.length + '가지 있어요.'
        : '미적 규칙까지 모두 지켰어요. 훌륭합니다!',
      bricks: M.totalCost(design),
      closedRow: closed,
      aesthetics: aesthetics
    };
  }

  App.Validate = { run: run };

})(window);
