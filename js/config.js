/* ===================================================================
   config.js  —  치수 원본 (Single Source of Truth)

   ★★ 앱 전체에서 벽돌 치수를 정의하는 곳은 오직 이 파일 하나입니다. ★★
   다른 파일들은 숫자를 직접 쓰지 않고 반드시 CONFIG 에서 가져다 씁니다.
   벽돌이 바뀌면 여기(또는 강사 설정 화면)의 값만 바꾸면
   격자, 화면, 검증, 도면이 전부 자동으로 따라옵니다.
   =================================================================== */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'cobel.settings.v1';

  /* ---- 공장 출고값 (실물 미니 벽돌 기준) ---------------------------- */
  var DEFAULTS = {
    brickLength: 19,    // mm  벽돌 가로(길이)
    brickWidth: 9,      // mm  벽돌 세로(폭/두께)  ← 격자 한 칸의 기준
    brickHeight: 9,     // mm  벽돌 높이           ← 격자 한 단의 높이
    maxBricks: 60,      // 장   1인당 벽돌 상한
    boardWidth: 150,    // mm  받침판 가로
    boardDepth: 150,    // mm  받침판 세로
    pin: '1234',        // 강사 설정 4자리 비밀번호
    showAnswer: false   // 정답 도면 공개 On/Off
  };

  var current = load();

  function load() {
    var out = {};
    for (var k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) out[k] = DEFAULTS[k]; }
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var j in DEFAULTS) {
          if (DEFAULTS.hasOwnProperty(j) && saved[j] !== undefined && saved[j] !== null) {
            out[j] = saved[j];
          }
        }
      }
    } catch (e) { /* 저장소를 못 쓰는 환경이면 그냥 기본값 */ }
    return out;
  }

  function persist() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) { /* 무시 */ }
  }

  var listeners = [];

  function clampNum(v, lo, hi, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  var CONFIG = {

    /* ---- 원본 값 --------------------------------------------------- */
    get brickLength() { return current.brickLength; },
    get brickWidth()  { return current.brickWidth;  },
    get brickHeight() { return current.brickHeight; },
    get maxBricks()   { return current.maxBricks;   },
    get boardWidth()  { return current.boardWidth;  },
    get boardDepth()  { return current.boardDepth;  },
    get pin()         { return String(current.pin); },
    get showAnswer()  { return !!current.showAnswer; },

    /* ---- 격자 -------------------------------------------------------
       격자 가로 한 칸 = 벽돌 길이의 절반 (= "반 장")
       엇갈려 쌓기는 "반 장씩 밀어 쌓기"이므로, 반 장을 한 칸으로 잡아야
       화면 그림과 실물이 정확히 맞습니다.
       실물 벽돌은 줄눈 자리 때문에 길이가 폭의 2배보다 1mm쯤 깁니다
       (19 = 9 × 2 + 1). 그래서 "폭"이 아니라 "길이 ÷ 2"를 기준으로 씁니다.
       ---------------------------------------------------------------- */
    get cellMm()  { return current.brickLength / 2; },  // 격자 가로 한 칸
    get rowMm()   { return current.brickHeight; },      // 격자 한 단의 높이
    get wytheMm() { return current.brickWidth; },       // 한 겹(앞줄 또는 뒷줄)의 두께

    get cols() {                                    // 받침판 위 가로 칸 수
      return Math.max(6, Math.min(40, Math.floor(current.boardWidth / this.cellMm)));
    },
    get rows() {                                    // 쌓을 수 있는 최대 단 수
      return Math.max(10, Math.min(24, Math.round(this.cols * 0.9)));
    },

    /* ---- 벽돌이 격자에서 차지하는 칸 수 ------------------------------
       눕히기 : 길이가 가로로 → 가로 2칸(= 길이), 세로 1단, 두께 1겹
       세우기 : 벽돌을 돌려 마구리(짧은 면)가 앞에 오게 → 가로 1칸(= 반 장),
                세로 1단, 길이가 앞뒤로 들어가므로 앞뒤 2겹을 한 장으로 채움
       ---------------------------------------------------------------- */
    get lieCols()  { return 2; },
    get lieRows()  { return 1; },
    get headCols() { return 1; },
    get headRows() { return 1; },
    get headWythes() {                              // 세우기가 채우는 겹 수 (기본 2)
      return Math.max(1, Math.min(2, Math.round(current.brickLength / current.brickWidth)));
    },
    get maxWythes() { return 2; },                  // 이 앱은 앞줄/뒷줄 두 겹까지

    /* ---- 길이 ÷ 폭 비율 검사 -----------------------------------------
       길이가 폭의 2배여야 마구리(세우기) 한 장이 앞뒤 두 겹을 딱 채웁니다.
       줄눈 여유(19 = 9×2+1) 정도는 정상이라 경고하지 않습니다.
       엄격하게 보려면 RATIO_TOLERANCE 를 0 으로 바꾸세요.
       ---------------------------------------------------------------- */
    RATIO_TOLERANCE: 0.25,
    get ratio()   { return current.brickLength / current.brickWidth; },
    get ratioOk() { return Math.abs(this.ratio - 2) <= this.RATIO_TOLERANCE; },
    get ratioExact() { return Math.abs(this.ratio - 2) < 0.005; },
    get ratioText() { return (Math.round(this.ratio * 100) / 100).toFixed(2); },
    get ratioWarning() {
      if (this.ratioOk) return null;
      return '길이 ÷ 폭 = ' + this.ratioText + ' — 엇갈려 쌓기가 맞지 않습니다';
    },
    get ratioNote() {
      if (!this.ratioOk || this.ratioExact) return null;
      return '길이 ÷ 폭 = ' + this.ratioText + ' — 줄눈 여유만큼 길어서 정상입니다';
    },

    /* ---- 사람이 읽는 문구 ------------------------------------------ */
    get brickLabel() {
      return current.brickLength + ' × ' + current.brickWidth + ' × ' + current.brickHeight + ' mm';
    },
    get boardLabel() {
      return current.boardWidth + ' × ' + current.boardDepth + ' mm (가로 ' + this.cols + '칸)';
    },
    get cellLabel() {
      return '한 칸 = 반 장 = ' + (Math.round(this.cellMm * 10) / 10) + 'mm';
    },

    /* ---- 값 바꾸기 -------------------------------------------------- */
    update: function (patch) {
      if (patch.brickLength !== undefined) current.brickLength = clampNum(patch.brickLength, 3, 200, DEFAULTS.brickLength);
      if (patch.brickWidth  !== undefined) current.brickWidth  = clampNum(patch.brickWidth,  2, 100, DEFAULTS.brickWidth);
      if (patch.brickHeight !== undefined) current.brickHeight = clampNum(patch.brickHeight, 2, 100, DEFAULTS.brickHeight);
      if (patch.maxBricks   !== undefined) current.maxBricks   = Math.round(clampNum(patch.maxBricks, 4, 500, DEFAULTS.maxBricks));
      if (patch.boardWidth  !== undefined) current.boardWidth  = clampNum(patch.boardWidth,  40, 2000, DEFAULTS.boardWidth);
      if (patch.boardDepth  !== undefined) current.boardDepth  = clampNum(patch.boardDepth,  20, 2000, DEFAULTS.boardDepth);
      if (patch.pin         !== undefined) {
        var p = String(patch.pin).replace(/\D/g, '').slice(0, 4);
        if (p.length === 4) current.pin = p;
      }
      if (patch.showAnswer  !== undefined) current.showAnswer = !!patch.showAnswer;
      persist();
      for (var i = 0; i < listeners.length; i++) listeners[i]();
    },

    resetToDefaults: function () {
      for (var k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) current[k] = DEFAULTS[k]; }
      persist();
      for (var i = 0; i < listeners.length; i++) listeners[i]();
    },

    onChange: function (fn) { listeners.push(fn); },

    defaults: DEFAULTS
  };

  global.App = global.App || {};
  global.App.CONFIG = CONFIG;

})(window);
