/* ===================================================================
   lesson.js — 강사용 코벨문 수업 슬라이드

   외부 연결 없이 설정 화면에서 바로 여는 8장짜리 수업 자료입니다.
   학생에게는 완성 예시를 먼저 노출하지 않고, 강사만 PIN 뒤에서 봅니다.
   =================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var doc = global.document;
  var modal, stage, notes, count, dots, prev, next, notesBtn;
  var index = 0;
  var initialized = false;
  var lastFocus = null;

  var slides = [
    {
      kicker: '01 · WHAT IS A CORBEL?',
      title: '코벨문은 벽돌을 자르지 않고 공간을 덮는 방법입니다',
      body: '<div class="lesson-hero-copy"><p class="lesson-lead">벽돌을 수평으로 쌓되, 위층을 아래층보다 조금씩 안쪽으로 내밀어 양쪽 벽이 가운데에서 만나게 합니다.</p>' +
        '<div class="lesson-keyline"><b>핵심 질문</b><span>벽돌은 얼마나 내밀어도 넘어지지 않을까?</span></div></div>' +
        '<figure class="lesson-visual"><img src="assets/corbel-completions/narrow.png" alt="동일 규격 벽돌로 완성한 코벨문 정면 도면"><figcaption>이 앱의 벽돌은 모두 19 × 9 × 9mm로 같습니다.</figcaption></figure>',
      note: '처음에는 정답 모양보다 원리와 질문을 먼저 제시하세요. 코벨은 벽에서 돌출되어 위의 무게를 받치는 부재를 뜻하고, 코벨문은 이 원리를 층마다 반복해 빈 공간을 덮습니다.',
      source: 'Getty Research Institute, Art & Architecture Thesaurus, “corbel arches” (AAT 300001115).'
    },
    {
      kicker: '02 · HOW IT WORKS',
      title: '한 층씩 안으로 이동하면 문 위의 빈틈이 줄어듭니다',
      body: '<div class="lesson-before-after"><figure><img src="assets/corbel-foundations/narrow.png" alt="기초 2단 입체 시작 상태"><figcaption>① 기초 2단에서 시작</figcaption></figure>' +
        '<div class="lesson-arrow" aria-hidden="true">→</div><figure><img src="assets/corbel-completions/narrow.png" alt="완성된 코벨문 정면 도면"><figcaption>② 양쪽에서 조금씩 내밀기</figcaption></figure></div>' +
        '<div class="lesson-three"><span><b>수평층</b>각 층은 수평을 유지</span><span><b>작은 이동</b>한 번에 반 장 이내</span><span><b>가운데 만남</b>양쪽을 번갈아 쌓기</span></div>',
      note: '학생에게 손으로 두 책을 조금씩 내밀어 보는 동작을 시켜도 좋습니다. 아래층과 겹치는 면적이 남아 있어야 하며, 한쪽만 계속 올리기보다 좌우를 번갈아 쌓는 이유를 물어보세요.',
      source: 'Getty Research Institute, AAT 300001115; 코벨문 설계 앱의 구조 규칙.'
    },
    {
      kicker: '03 · MATERIAL RULE',
      title: '모든 모형은 같은 벽돌만 사용합니다',
      body: '<div class="lesson-material-rule"><div><strong>19 × 9 × 9<small>mm</small></strong><p>벽돌을 자르거나 다른 길이로 바꾸지 않습니다.</p></div>' +
        '<ul><li><b>가능</b> 길이 방향 · 바닥에서 90° 회전</li><li><b>가능</b> 앞뒤 한 겹 · 두 겹</li><li><b>불가능</b> 절단 · 접착 · 임의 크기</li></ul></div>' +
        '<div class="lesson-foundation-strip"><img src="assets/corbel-foundations/narrow.png" alt="좁은 문 기초"><img src="assets/corbel-foundations/wide.png" alt="넓은 문 기초"><img src="assets/corbel-foundations/strong.png" alt="튼튼한 기둥 기초"></div>',
      note: '세 종류의 차이는 벽돌 자체가 아니라 문 폭과 기둥 폭입니다. 정면에서 폭 9mm의 정사각형으로 보이는 것은 짧은 벽돌이 아니라, 같은 벽돌의 긴 방향을 앞뒤로 돌려놓아 끝면이 보이는 것입니다. 학생 화면에는 기초만 보이고 완성 모습은 보이지 않습니다.',
      source: '코벨문 설계 앱 기본 설정 및 기초 생성 규칙.'
    },
    {
      kicker: '04 · CORBEL vs TRUE ARCH',
      title: '코벨문은 ‘참 아치’와 힘을 전달하는 방식이 다릅니다',
      body: '<div class="lesson-compare"><section><span>CORBEL</span><h3>코벨문</h3><p>수평 벽돌을 층마다 안쪽으로 내밉니다.</p><ul><li>쐐기돌 없음</li><li>각 층은 수평</li><li>겹침과 무게중심이 중요</li></ul></section>' +
        '<section><span>TRUE ARCH</span><h3>참 아치</h3><p>쐐기 모양 돌을 방사형으로 배열합니다.</p><ul><li>중앙에 종석</li><li>돌의 방향이 곡선을 따름</li><li>압축력을 옆 지지대로 전달</li></ul></section></div>' +
        '<p class="lesson-bottom-callout">겉모양이 아치처럼 보여도, 수평층이면 구조적으로는 코벨입니다.</p>',
      note: '“가짜 아치”라는 말은 가치가 낮다는 뜻이 아니라 구조 분류입니다. 코벨 아치는 수평층을 내밀어 만들고, 참 아치는 쐐기돌이 방사형으로 힘을 전달합니다.',
      source: 'Getty Research Institute, AAT 300001115.'
    },
    {
      kicker: '05 · 5,000 YEARS AGO',
      title: '뉴그레인지의 사람들은 거대한 돌로 코벨 천장을 만들었습니다',
      body: '<div class="lesson-history"><div class="lesson-year">약 3200<small>BCE</small></div><div><p class="lesson-lead">아일랜드 뉴그레인지는 신석기시대에 만들어진 통로무덤입니다.</p>' +
        '<p>돌판을 위로 갈수록 안쪽으로 겹쳐 약 6m 높이의 코벨 볼트를 만들고, 마지막은 하나의 덮개돌로 닫았습니다.</p><blockquote>작은 모형과 같은 생각이 거대한 석재 천장에도 쓰였습니다.</blockquote></div></div>',
      note: '뉴그레인지는 약 5,000년 전 유적입니다. 학생에게 “무거운 돌을 올리는 장비가 부족했던 시대에 왜 이 방법이 유용했을까?”를 질문해 보세요.',
      source: 'World Heritage Ireland, Brú na Bóinne education pack and site information.'
    },
    {
      kicker: '06 · MYCENAE',
      title: '미케네의 톨로스 무덤은 코벨 기법을 기념비적 공간으로 키웠습니다',
      body: '<div class="lesson-history reverse"><div><p class="lesson-lead">그리스 미케네에는 둥근 평면 위로 돌을 내밀어 올린 코벨 톨로스 무덤이 남아 있습니다.</p>' +
        '<p>대표 사례인 ‘아트레우스의 보물창고’는 약 기원전 1250년에 완성된 것으로 알려져 있습니다.</p><blockquote>코벨은 문뿐 아니라 돔과 볼트에도 확장할 수 있습니다.</blockquote></div><div class="lesson-year">약 1250<small>BCE</small></div></div>',
      note: '뉴그레인지와 미케네는 시대와 지역이 다르지만, 수평 돌을 조금씩 내미는 같은 기본 아이디어를 보여 줍니다. 코벨 기법이 하나의 특정 문화에만 속한 발명처럼 단정하지 마세요.',
      source: 'UNESCO World Heritage Centre, Archaeological Sites of Mycenae and Tiryns; nomination dossier 941.'
    },
    {
      kicker: '07 · STRUCTURAL SAFETY',
      title: '안전한 코벨문은 네 가지 조건을 함께 만족합니다',
      body: '<div class="lesson-safety"><ol><li><b>무게중심</b><span>전체 무게중심이 받치는 벽돌 안에 있어야 합니다.</span></li>' +
        '<li><b>충분한 겹침</b><span>한 번에 너무 많이 내밀지 않습니다.</span></li><li><b>엇갈린 줄눈</b><span>세로 줄눈이 이어지지 않게 쌓습니다.</span></li>' +
        '<li><b>층별 완성</b><span>아래층 좌우를 채운 뒤 다음 층으로 올라갑니다.</span></li></ol>' +
        '<figure><img src="assets/corbel-completions/wide.png" alt="동일 규격 벽돌로 완성한 넓은 코벨문 정면 도면"><figcaption>폭이 넓을수록 더 많은 층과 신중한 균형이 필요합니다.</figcaption></figure></div>',
      note: '앱의 초록 점, 무게중심선, 무너짐 애니메이션을 각각 이 네 조건과 연결해 설명하세요. 실패는 벌점이 아니라 구조를 읽는 자료입니다.',
      source: '코벨문 설계 앱의 배치·균형·검증 규칙.'
    },
    {
      kicker: '08 · ARCHITECT CHALLENGE',
      title: '이제 모양을 따라 하지 말고 구조를 설명해 봅시다',
      body: '<div class="lesson-challenge"><div class="lesson-steps"><span><b>1</b>예측하기<small>어디에 놓으면 안전할까?</small></span><span><b>2</b>실험하기<small>초록 자리와 무너짐을 관찰</small></span>' +
        '<span><b>3</b>검증하기<small>360° 보기와 도면 확인</small></span><span><b>4</b>설명하기<small>왜 서 있는지 근거 말하기</small></span></div>' +
        '<div class="lesson-question"><strong>마지막 질문</strong><p>같은 벽돌 60장으로 더 넓고, 더 높고, 더 아름다운 문을 동시에 만들 수 있을까요?</p></div></div>',
      note: '마무리 발표에서는 완성 모양보다 근거를 평가하세요. “어디에서 무게를 받는가?”, “왜 이 층에서 반 장만 내밀었는가?”, “다시 만든다면 무엇을 바꿀 것인가?”를 묻습니다.',
      source: '수업용 탐구 질문 — 코벨문 설계 프로젝트.'
    }
  ];

  function init() {
    if (initialized) return;
    modal = doc.getElementById('lesson-modal');
    stage = doc.getElementById('lesson-stage');
    notes = doc.getElementById('lesson-notes');
    count = doc.getElementById('lesson-count');
    dots = doc.getElementById('lesson-dots');
    prev = doc.getElementById('btn-lesson-prev');
    next = doc.getElementById('btn-lesson-next');
    notesBtn = doc.getElementById('btn-lesson-notes');
    if (!modal || !stage) return;

    doc.getElementById('btn-lesson-close').onclick = close;
    prev.onclick = function () { go(index - 1); };
    next.onclick = function () { go(index + 1); };
    notesBtn.onclick = toggleNotes;
    dots.onclick = function (e) {
      var btn = e.target.closest ? e.target.closest('[data-slide]') : null;
      if (btn) go(parseInt(btn.getAttribute('data-slide'), 10));
    };
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    doc.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape' || e.keyCode === 27) close();
      if (e.key === 'ArrowLeft' || e.keyCode === 37) go(index - 1);
      if (e.key === 'ArrowRight' || e.keyCode === 39) go(index + 1);
    });
    initialized = true;
  }

  function open() {
    init();
    if (!initialized) return;
    lastFocus = doc.activeElement;
    index = 0;
    notes.hidden = true;
    notesBtn.setAttribute('aria-pressed', 'false');
    modal.classList.add('open');
    doc.body.classList.add('lesson-open');
    render();
    doc.getElementById('btn-lesson-close').focus();
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('open');
    doc.body.classList.remove('lesson-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function go(nextIndex) {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    render();
  }

  function toggleNotes() {
    notes.hidden = !notes.hidden;
    notesBtn.setAttribute('aria-pressed', notes.hidden ? 'false' : 'true');
    notesBtn.textContent = notes.hidden ? '강사 노트' : '노트 닫기';
  }

  function render() {
    var s = slides[index];
    stage.innerHTML = '<article class="lesson-slide lesson-slide-' + (index + 1) + '">' +
      '<header><span>' + s.kicker + '</span><h2>' + s.title + '</h2></header>' +
      '<div class="lesson-body">' + s.body + '</div>' +
      '<div class="lesson-page">CORBEL STUDIO · ' + (index + 1) + '</div></article>';
    count.textContent = (index + 1) + ' / ' + slides.length;
    notes.innerHTML = '<strong>강사 멘트</strong><p>' + s.note + '</p><small><b>출처</b> ' + s.source + '</small>';
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    next.textContent = index === slides.length - 1 ? '마지막 장' : '다음 →';

    var h = [];
    for (var i = 0; i < slides.length; i++) {
      h.push('<button type="button" data-slide="' + i + '" aria-label="' + (i + 1) + '번 슬라이드"' +
        (i === index ? ' class="on" aria-current="true"' : '') + '></button>');
    }
    dots.innerHTML = h.join('');
  }

  App.Lesson = { open: open, close: close };

})(window);
