/* ===================================================================
   sound.js  —  벽돌 부딪히는 효과음 1개

   음원 파일을 받지 않고 브라우저가 직접 소리를 만들어 냅니다.
   (다운로드 0바이트 — 태블릿에서 가볍게 돌아갑니다)
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var ctx = null;
  var muted = false;
  var lastPlay = 0;

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  /* 아이패드는 사용자가 화면을 한 번 만져야 소리가 납니다 */
  function unlock() {
    var c = ensure();
    if (c && c.state === 'suspended' && c.resume) c.resume();
  }

  function clack() {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    if (c.state === 'suspended' && c.resume) c.resume();

    var now = c.currentTime;
    if (now - lastPlay < 0.03) return;      // 너무 겹치지 않게
    lastPlay = now;

    /* 1) 딱 하고 부딪히는 소리 — 짧은 잡음 + 밴드패스 */
    var len = Math.floor(c.sampleRate * 0.07);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    var src = c.createBufferSource();
    src.buffer = buf;
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 1.1;
    var g1 = c.createGain();
    g1.gain.setValueAtTime(0.45, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    src.connect(bp); bp.connect(g1); g1.connect(c.destination);
    src.start(now); src.stop(now + 0.1);

    /* 2) 바닥에 닿는 둔한 소리 */
    var osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);
    var g2 = c.createGain();
    g2.gain.setValueAtTime(0.25, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g2); g2.connect(c.destination);
    osc.start(now); osc.stop(now + 0.13);
  }

  App.Sound = {
    clack: clack,
    unlock: unlock,
    setMuted: function (v) { muted = !!v; },
    isMuted: function () { return muted; }
  };

})(window);
