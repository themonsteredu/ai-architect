/* ===================================================================
   settings.js  —  강사 전용 설정 화면

   - 3자리 숫자 비밀번호로 진입
   - 벽돌 가로/세로/높이(mm), 벽돌 개수 상한, 받침판 크기(mm)
   - 길이 ÷ 폭 이 정확히 2가 아니면 경고 (진행은 가능)
   - 정답 도면 공개 On/Off
   - (나중에) 수업 슬라이드 보기

   ※ 이 비밀번호는 수업용 잠금장치입니다. 보안 장치가 아닙니다.
     (설정값은 이 태블릿의 브라우저에만 저장됩니다)
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var CONFIG = App.CONFIG;
  var doc = global.document;

  var modal, onSaved;
  var mode = 'pin';
  var bound = false;

  function $(sel) { return modal.querySelector(sel); }

  function open(afterSave) {
    onSaved = afterSave || function () {};
    modal = doc.getElementById('settings-modal');
    if (!bound) {
      /* 클릭 처리는 딱 한 번만 연결합니다 (다시 그려도 중복되지 않게) */
      modal.addEventListener('click', onModalClick);
      bound = true;
    }
    mode = 'pin';
    draw();
    modal.classList.add('open');
  }

  function onModalClick(e) {
    var act = e.target.getAttribute && e.target.getAttribute('data-act');
    if (!act) return;
    if (act === 'cancel') { close(); return; }
    if (mode === 'pin') { if (act === 'ok') submitPin(); return; }
    handleFormAction(act);
  }

  function close() {
    modal.classList.remove('open');
  }

  function draw() {
    modal.innerHTML = (mode === 'pin') ? pinHTML() : formHTML();
    if (mode === 'pin') bindPin(); else bindForm();
  }

  /* ---- 비밀번호 ---------------------------------------------------- */
  function pinHTML() {
    return '' +
      '<div class="modal-box modal-narrow">' +
      '  <h2>강사 설정</h2>' +
      '  <p class="modal-desc">3자리 숫자 비밀번호를 입력하세요.</p>' +
      '  <input id="pin-input" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off">' +
      '  <div id="pin-error" class="form-error"></div>' +
      '  <div class="modal-actions">' +
      '    <button class="btn" data-act="cancel">취소</button>' +
      '    <button class="btn btn-primary" data-act="ok">확인</button>' +
      '  </div>' +
      '</div>';
  }

  function submitPin() {
    var input = $('#pin-input');
    var err = $('#pin-error');
    if (input.value === CONFIG.pin) { mode = 'form'; draw(); }
    else { err.textContent = '비밀번호가 맞지 않습니다.'; input.value = ''; input.focus(); }
  }

  function bindPin() {
    var input = $('#pin-input');
    setTimeout(function () { input.focus(); }, 50);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitPin(); });
  }

  /* ---- 설정 폼 ------------------------------------------------------ */
  function num(id, label, value, unit, hint) {
    return '<label class="field"><span class="field-label">' + label + '</span>' +
           '<span class="field-input"><input id="' + id + '" type="number" step="0.1" value="' + value + '"><em>' + unit + '</em></span>' +
           (hint ? '<span class="field-hint">' + hint + '</span>' : '') + '</label>';
  }

  function typeGuideHTML() {
    var list = App.Foundation.list();
    var images = { narrow: 'narrow', wide: 'wide', strong: 'strong' };
    var h = [
      '<section class="corbel-type-guide" aria-labelledby="corbel-type-title">',
      '  <div class="corbel-type-head"><div>',
      '    <span>TEACHING GUIDE · 참고 해법</span>',
      '    <h3 id="corbel-type-title">검증을 통과하는 참고 해법 3가지</h3>',
      '  </div><strong>3 SOLUTIONS</strong></div>',
      '  <p>이 그림은 유일한 완성품이 아니라 앱의 솔버가 만든 참고 해법입니다. 학생의 유효 자리 선택에 따라 다른 모습도 검증을 통과할 수 있습니다.</p>',
      '  <div class="corbel-type-grid">'
    ];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var solved = App.Solver.solve(App.Foundation.create(f.id));
      var used = solved ? App.Model.totalCost(solved) : 0;
      var floors = solved ? App.Model.topRow(solved) + 1 : 0;
      var image = images[f.id] || 'narrow';
      h.push('<article class="corbel-type-card">' +
        '<div class="corbel-type-image"><img src="assets/corbel-completions/' + image + '.png" alt="' + f.name + '의 절단 없는 동일 규격 벽돌 정답 도면"></div>' +
        '<div class="corbel-type-copy"><span>TYPE 0' + (i + 1) + '</span><strong>' + f.name + '</strong>' +
        '<small>문 폭 ' + f.openMm + 'mm · ' + floors + '단 · ' + used + '/' + CONFIG.maxBricks + '장</small></div>' +
        '</article>');
    }
    h.push('  </div>',
      '  <div class="corbel-brick-note"><b>짧은 벽돌이 아닙니다</b><span>정면에서 정사각형으로 보이는 칸은 같은 19×9×9mm 벽돌을 바닥에서 90° 돌려, 긴 19mm 방향이 앞뒤로 놓인 상태입니다. 절단 벽돌은 사용하지 않습니다.</span></div>',
      '</section>');
    return h.join('');
  }

  function formHTML() {
    var c = CONFIG;
    return '' +
      '<div class="modal-box modal-wide">' +
      '  <h2>강사 설정</h2>' +
      '  <p class="modal-desc">벽돌 치수를 바꾸면 격자·검증·도면이 모두 자동으로 따라옵니다.</p>' +

           typeGuideHTML() +

      '  <fieldset class="form-group"><legend>벽돌</legend>' +
      '    <div class="form-row">' +
           num('f-len', '가로 (길이)', c.brickLength, 'mm') +
           num('f-wid', '세로 (폭)', c.brickWidth, 'mm', '격자 한 칸의 기준') +
           num('f-hei', '높이', c.brickHeight, 'mm', '한 단의 높이') +
      '    </div>' +
      '    <div id="ratio-box" class="ratio-box"></div>' +
      '  </fieldset>' +

      '  <fieldset class="form-group"><legend>수량 · 받침판</legend>' +
      '    <div class="form-row">' +
           num('f-max', '벽돌 개수 상한', c.maxBricks, '장') +
           num('f-bw', '받침판 가로', c.boardWidth, 'mm') +
           num('f-bd', '받침판 세로', c.boardDepth, 'mm') +
      '    </div>' +
      '    <div id="grid-box" class="ratio-box info"></div>' +
      '  </fieldset>' +

      '  <fieldset class="form-group"><legend>수업 진행</legend>' +
      '    <label class="switch-row"><input id="f-answer" type="checkbox"' + (c.showAnswer ? ' checked' : '') + '>' +
      '      <span>정답 도면 공개</span>' +
      '      <em>켜면 학생 화면에 「정답 도면」 버튼이 생깁니다. 연 학생에게는 기록이 남습니다.</em></label>' +
      '    <label class="field field-inline"><span class="field-label">설정 비밀번호 (3자리)</span>' +
      '      <span class="field-input"><input id="f-pin" type="text" inputmode="numeric" maxlength="3" value="' + c.pin + '"></span></label>' +
      '    <button class="btn btn-lesson" data-act="lesson" type="button"><span>수업 슬라이드 보기</span><em>코벨문 원리 · 역사 · 구조 · 실습 질문</em></button>' +
      '  </fieldset>' +

      '  <div id="form-error" class="form-error"></div>' +
      '  <div class="modal-actions">' +
      '    <button class="btn btn-danger-ghost" data-act="reset">기본값으로</button>' +
      '    <span class="spacer"></span>' +
      '    <button class="btn" data-act="cancel">닫기</button>' +
      '    <button class="btn btn-primary" data-act="save">저장</button>' +
      '  </div>' +
      '</div>';
  }

  function readForm() {
    return {
      brickLength: parseFloat($('#f-len').value),
      brickWidth: parseFloat($('#f-wid').value),
      brickHeight: parseFloat($('#f-hei').value),
      maxBricks: parseInt($('#f-max').value, 10),
      boardWidth: parseFloat($('#f-bw').value),
      boardDepth: parseFloat($('#f-bd').value),
      showAnswer: $('#f-answer').checked,
      pin: $('#f-pin').value
    };
  }

  function refreshPreview() {
    var v = readForm();
    var ratioBox = $('#ratio-box');
    var gridBox = $('#grid-box');
    var r = v.brickLength / v.brickWidth;

    if (!isFinite(r) || r <= 0) {
      ratioBox.className = 'ratio-box warn';
      ratioBox.textContent = '가로와 세로에 0보다 큰 숫자를 넣어 주세요.';
    } else if (Math.abs(r - 2) < 0.005) {
      ratioBox.className = 'ratio-box ok';
      ratioBox.textContent = '길이 ÷ 폭 = ' + r.toFixed(2) + ' — 엇갈려 쌓기가 딱 맞습니다.';
    } else if (Math.abs(r - 2) <= CONFIG.RATIO_TOLERANCE) {
      ratioBox.className = 'ratio-box ok';
      ratioBox.textContent = '길이 ÷ 폭 = ' + r.toFixed(2) + ' — 줄눈 여유만큼 길어서 정상입니다.';
    } else {
      ratioBox.className = 'ratio-box warn';
      ratioBox.textContent = '길이 ÷ 폭 = ' + r.toFixed(2) + ' — 엇갈려 쌓기가 맞지 않습니다 (그래도 진행할 수 있습니다)';
    }

    var cellMm = v.brickLength / 2;
    var cols = Math.max(6, Math.min(40, Math.floor(v.boardWidth / cellMm)));
    var rows = Math.max(10, Math.min(24, Math.round(cols * 0.9)));
    gridBox.textContent = '격자 ' + cols + '칸 × ' + rows + '단 ' +
      '(한 칸 = 반 장 = ' + (isFinite(cellMm) ? Math.round(cellMm * 10) / 10 : '?') + 'mm)';
  }

  function bindForm() {
    var ids = ['f-len', 'f-wid', 'f-hei', 'f-max', 'f-bw', 'f-bd'];
    for (var i = 0; i < ids.length; i++) {
      $('#' + ids[i]).addEventListener('input', refreshPreview);
    }
    refreshPreview();
  }

  function handleFormAction(act) {
    if (act === 'lesson') {
      if (App.Lesson) App.Lesson.open();
      return;
    }
    if (act === 'reset') {
      if (!global.confirm('모든 설정을 공장 출고값으로 되돌립니다. 지금 설계는 지워집니다. 계속할까요?')) return;
      CONFIG.resetToDefaults();
      close();
      onSaved({ restart: true });
      return;
    }

    if (act === 'save') {
      var v = readForm();
      var err = $('#form-error');
      if (!(v.brickLength > 0 && v.brickWidth > 0 && v.brickHeight > 0 && v.maxBricks > 0 && v.boardWidth > 0 && v.boardDepth > 0)) {
        err.textContent = '숫자를 모두 0보다 크게 넣어 주세요.';
        return;
      }
      if (String(v.pin).replace(/\D/g, '').length !== 3) {
        err.textContent = '비밀번호는 숫자 3자리여야 합니다.';
        return;
      }
      var dimsChanged = (v.brickLength !== CONFIG.brickLength || v.brickWidth !== CONFIG.brickWidth ||
                         v.brickHeight !== CONFIG.brickHeight || v.boardWidth !== CONFIG.boardWidth ||
                         v.boardDepth !== CONFIG.boardDepth);
      if (dimsChanged && !global.confirm('치수를 바꾸면 격자가 달라져서 지금 설계는 지워집니다. 계속할까요?')) return;

      CONFIG.update(v);
      close();
      onSaved({ restart: dimsChanged });
    }
  }

  App.Settings = { open: open };

})(window);
