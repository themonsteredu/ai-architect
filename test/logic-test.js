/* ===================================================================
   test/logic-test.js — 계산 부분 자동 점검

   실행:  node test/logic-test.js
   화면(DOM) 없이 돌아가는 부분만 검사합니다.
   - 기초가 규칙을 지키는지
   - 5가지 구조 규칙이 제대로 막는지
   - 무게중심 평균 계산이 예시대로 나오는지
   - 정답 도면이 언제나 검증을 통과하는지
   - 벽돌 치수를 바꿔도 전부 따라오는지
   =================================================================== */
'use strict';

const path = require('path');

/* 브라우저 흉내 */
global.window = global;
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
global.window.localStorage = global.localStorage;

const files = ['config', 'model', 'rules', 'foundation', 'balance', 'aesthetics', 'order', 'validate', 'solver'];
for (const f of files) require(path.join(__dirname, '..', 'js', f + '.js'));

const App = global.App;
const { CONFIG, Model: M, Rules, Foundation, Balance, Aesthetics, Order, Validate, Solver } = App;

let pass = 0, fail = 0;
const failures = [];

function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}
function section(t) { console.log('\n' + t); }

/* ================================================================= */
section('1. 치수 원본 (config)');

ok(CONFIG.brickLength === 19 && CONFIG.brickWidth === 9 && CONFIG.brickHeight === 9, '기본 벽돌 19 × 9 × 9 mm');
ok(CONFIG.maxBricks === 60, '벽돌 상한 60장');
ok(CONFIG.cellMm === 9.5, '격자 한 칸 = 벽돌 길이의 절반 = 9.5mm', '실제 ' + CONFIG.cellMm);
ok(CONFIG.cols === 15, '받침판 150mm ÷ 9.5mm → 격자 15칸', '실제 ' + CONFIG.cols);
ok(CONFIG.lieCols === 2, '눕히기는 가로 2칸');
ok(CONFIG.headCols === 1, '세우기는 가로 1칸');
ok(CONFIG.headWythes === 2, '세우기는 앞뒤 2겹을 채움');
ok(CONFIG.ratioWarning === null, '기본 벽돌(19÷9=2.11)에는 빨간 경고가 뜨지 않음', CONFIG.ratioWarning);
ok(CONFIG.ratioNote === '길이 ÷ 폭 = 2.11 — 줄눈 여유만큼 길어서 정상입니다',
   '대신 줄눈 여유 안내가 뜸', CONFIG.ratioNote);

/* ================================================================= */
section('2. 기초 프리셋');

const presets = Foundation.list();
ok(presets.length === 3, '기초는 3가지 (좁은 문 / 넓은 문 / 튼튼한 기둥)');

for (const p of presets) {
  const d = Foundation.create(p.id);
  const v = Rules.validateAll(d);
  ok(v.ok, `[${p.name}] 기초 2단이 모든 구조 규칙을 지킴`, v.message);

  const rows = new Set(d.bricks.map(b => b.y));
  ok(rows.size === 2 && rows.has(0) && rows.has(1), `[${p.name}] 정확히 2단만 깔림 (3단 이상 금지)`);

  ok(d.bricks.every(b => b.fixed), `[${p.name}] 기초 벽돌은 지울 수 없게 표시됨`);

  const used = M.totalCost(d);
  ok(used === p.bricks, `[${p.name}] 미리 계산한 장수와 실제가 같음 (${used}장)`);
  ok(used <= CONFIG.maxBricks * 0.45,
     `[${p.name}] 기초가 예산의 절반을 넘지 않음 (${used}/${CONFIG.maxBricks}장)`);

  /* 두 단의 줄눈이 엇갈리는지 */
  const maps = M.buildMaps(d);
  const j0 = M.jointsInRow(maps, 0, CONFIG.cols);
  const j1 = M.jointsInRow(maps, 1, CONFIG.cols);
  const shared = Object.keys(j0).filter(k => j1[k]);
  ok(shared.length === 0, `[${p.name}] 아래단·윗단 줄눈이 겹치지 않음 (엇갈려 쌓기)`);

  /* 놓을 수 있는 자리가 여러 개인지 */
  const spots = countDistinctSpots(d);
  ok(spots >= 4, `[${p.name}] 시작하자마자 놓을 자리가 ${spots}군데 (여러 개여야 함)`);
}

function countDistinctSpots(design) {
  const set = new Set();
  for (const [o, w] of [['lie', 2], ['lie', 1], ['head', 2]]) {
    for (const s of Rules.allSpots(design, o, w)) set.add(o + w + ':' + s.x + ',' + s.y);
  }
  return set.size;
}

/* ================================================================= */
section('3. 구조 규칙 5가지가 실제로 막는지');

function fresh() { return Foundation.create('narrow'); }
function why(design, cand) {
  return Rules.canPlace(Rules.makeContext(design), cand);
}

{
  const d = fresh();
  const op = d.meta.opening;

  /* 받침 없음 — 문 한가운데 허공 */
  const r1 = why(d, { x: op[0], y: 5, orient: 'lie', wythes: 2 });
  ok(!r1.ok && r1.code === 'NO_SUPPORT' && r1.message === '아래에 받침이 없어요',
     '받침 없음 → "아래에 받침이 없어요"', r1.message);

  /* 절반 미만 걸침 — 기둥 끝에서 두 칸 튀어나오게 */
  const pier = d.meta.piers[0];               // [a,b]
  const r2 = why(d, { x: pier[1], y: 2, orient: 'lie', wythes: 2 });   // 한 칸 걸침 = 50%  → 통과
  const r3 = why(d, { x: pier[1] + 1, y: 2, orient: 'lie', wythes: 2 });// 0칸 걸침 → 받침 없음
  ok(r2.ok || r2.code === 'JOINT', '반 장(50%) 걸침은 허용되거나 줄눈 규칙에 걸림', r2.code);
  ok(!r3.ok, '기둥 밖으로 완전히 나가면 막힘', r3.code);

  /* 줄눈 일직선 */
  const maps = M.buildMaps(d);
  const j1 = Object.keys(M.jointsInRow(maps, 1, CONFIG.cols)).map(Number);
  const jx = j1.find(x => x >= pier[0] && x <= pier[1]);
  const r4 = why(d, { x: jx, y: 2, orient: 'lie', wythes: 2 });
  ok(!r4.ok && r4.code === 'JOINT' && r4.message === '줄눈이 일직선이 됩니다 — 반 장 옆으로',
     '아래 이음매 바로 위 → "줄눈이 일직선이 됩니다"', r4.message);

  /* 아래보다 넓어짐 */
  const gate = d.meta.gate;
  const r5 = why(d, { x: gate[0] - 2, y: 2, orient: 'lie', wythes: 2 });
  ok(!r5.ok, '아래 단 바깥으로 나가면 막힘', r5.code);
}

{
  /* 한 겹 3단 초과 — 기둥 위에 한 겹으로 계속 쌓아 본다 */
  const d = fresh();
  const pier = d.meta.piers[0];
  let placed = 0, blocked = null;
  for (let y = 2; y < 10; y++) {
    let done = false;
    for (let x = pier[0]; x <= pier[1] && !done; x++) {
      const cand = { x, y, orient: 'lie', wythes: 1 };
      const r = why(d, cand);
      if (r.ok) { M.addBrick(d, cand); placed++; done = true; }
      else if (r.code === 'THIN') blocked = r;
    }
    if (!done) break;
  }
  ok(placed === 3, '한 겹으로는 3단까지만 쌓임', '실제 ' + placed + '단');
  ok(blocked && blocked.message === '한 겹 벽은 3단까지 — 뒤에 한 겹 더 필요해요',
     '4단째 → "한 겹 벽은 3단까지 — 뒤에 한 겹 더 필요해요"', blocked && blocked.message);
}

{
  /* 한 겹 위에 두 겹을 올리면 뒷줄이 뜬다 */
  const d = fresh();
  const pier = d.meta.piers[0];
  let thinCand = null;
  for (let x = pier[0]; x <= pier[1]; x++) {
    const c = { x, y: 2, orient: 'lie', wythes: 1 };
    if (why(d, c).ok) { M.addBrick(d, c); thinCand = c; break; }
  }
  ok(!!thinCand, '한 겹 벽돌을 놓을 수 있다');
  const r = why(d, { x: thinCand.x, y: 3, orient: 'lie', wythes: 2 });
  ok(!r.ok && r.code === 'NO_SUPPORT_BACK', '한 겹 위에 두 겹 → 뒷줄 받침 없음으로 막힘', r.code);
}

/* ================================================================= */
section('4. 무게중심 평균 계산 (요청서의 예시 그대로)');

{
  function blank() {
    return {
      bricks: [], nextId: 1,
      meta: { foundationId: 't', foundationName: 't', gate: [0, 9], opening: [4, 5], piers: [[0, 3], [6, 9]] },
      answerUsed: false
    };
  }

  /* 받침은 1~3번 칸 (0-based 0,1,2 → 칸 경계 0~3) */
  function withBase(d) {
    for (const x of [0, 1, 2]) M.addBrick(d, { x, y: 0, orient: 'head', wythes: 2 });
    return d;
  }

  /* (가) 위 벽돌이 1·2·3번 칸 → 평균 = 2번 칸 → 받침(1~3) 안 → 안 넘어짐 */
  const inside = withBase(blank());
  for (const x of [0, 1, 2]) M.addBrick(inside, { x, y: 1, orient: 'head', wythes: 2 });
  const a1 = Balance.analyze(inside);
  ok(a1.ok, '위 벽돌이 1·2·3번 칸 → 평균이 받침 안 → 안 넘어짐');

  /* (나) 반 장씩 내밀어 위 벽돌 중심이 3·4·5번 칸 → 평균 = 4번 칸 → 받침 밖 → 넘어짐 */
  const outside = withBase(blank());
  M.addBrick(outside, { x: 2, y: 1, orient: 'lie', wythes: 2 });   // 중심 3
  M.addBrick(outside, { x: 3, y: 2, orient: 'lie', wythes: 2 });   // 중심 4
  M.addBrick(outside, { x: 4, y: 3, orient: 'lie', wythes: 2 });   // 중심 5
  const a2 = Balance.analyze(outside);
  ok(!a2.ok, '내민 벽돌 중심이 3·4·5번 칸 → 평균이 받침 밖 → 넘어짐');
  ok(a2.worst && Math.abs(a2.worst.meanX - 4) < 1e-9,
     '평균값이 (3+4+5)÷3 = 4 로 정확히 계산됨', a2.worst && a2.worst.meanX);
  ok(a2.worst && a2.worst.range[0] === 0 && a2.worst.range[1] === 3,
     '받침 범위가 0~3칸으로 잡힘', a2.worst && a2.worst.range.join('~'));
  ok(!!Balance.culpritOf(a2.worst), '무너짐의 원인이 된 벽돌을 하나 지목함');
  ok(/평균 위치/.test(Balance.explain(a2.worst)), '학생에게 보여줄 설명 문구가 만들어짐');
}

/* ================================================================= */
section('5. 정답 도면이 언제나 검증을 통과하는지');

for (const p of presets) {
  const solved = Solver.solve(Foundation.create(p.id));
  const res = Validate.run(solved);
  const used = M.totalCost(solved);
  ok(res.status === 'ok', `[${p.name}] 정답 설계가 "세워보기"를 통과함`, res.title + ' / ' + res.reason);
  ok(used <= CONFIG.maxBricks, `[${p.name}] 정답이 예산 안 (${used}/${CONFIG.maxBricks}장)`);
  ok(Aesthetics.closedRow(solved) > 0, `[${p.name}] 정답에서 문이 실제로 닫힘`);

  /* 쌓는 순서 */
  const layers = Order.compute(solved);
  let numbered = 0, prevRow = -1, rowsAscending = true;
  for (const L of layers) {
    if (L.row <= prevRow) rowsAscending = false;
    prevRow = L.row;
    for (const it of L.items) numbered += it.numbers.length;
    /* 층 안 번호가 1부터 연속인지 */
    const seq = [];
    for (const it of L.items) for (const n of it.numbers) seq.push(n.n);
    const okSeq = seq.every((v, i) => v === i + 1);
    if (!okSeq) ok(false, `[${p.name}] ${L.label} 번호가 1부터 연속`, seq.join(','));
  }
  ok(rowsAscending, `[${p.name}] 도면이 아래층부터 위층 순서`);
  ok(numbered === used, `[${p.name}] 도면 번호 총합 = 실제 벽돌 장수 (${numbered})`);

  /* 같은 층에서 바깥 → 안쪽 순서인지 (왼쪽 조각들만 뽑아 검사) */
  const gate = solved.meta.gate, mid = (gate[0] + gate[1] + 1) / 2;
  let outsideIn = true;
  for (const L of layers) {
    const lefts = L.items.filter(i => M.centerX(i.brick) < mid).map(i => M.centerX(i.brick));
    for (let i = 1; i < lefts.length; i++) if (lefts[i] < lefts[i - 1]) outsideIn = false;
  }
  ok(outsideIn, `[${p.name}] 같은 층에서 바깥쪽부터 안쪽으로 쌓는 순서`);

  /* 왼쪽/오른쪽 번갈아 */
  let alternates = true;
  for (const L of layers) {
    const sides = L.items.filter(i => i.side !== 'center').map(i => i.side);
    for (let i = 1; i < sides.length - 1; i++) {
      if (sides[i] === sides[i - 1] && sides[i] === sides[i + 1]) alternates = false;
    }
  }
  ok(alternates, `[${p.name}] 양쪽 기둥을 번갈아 쌓는 순서`);

  /* 받침 필요 구간이 표시되는지 */
  const anyProp = layers.some(L => L.needsProp);
  ok(anyProp, `[${p.name}] 코벨 구간에 "받침 필요" 표시가 있음`);
}

/* ================================================================= */
section('6. 학생이 쌓는 내내 놓을 자리가 여러 개인지');

{
  const d = Foundation.create('wide');
  let minSpots = Infinity, steps = 0;
  while (steps < 40) {
    /* 벽돌이 2장 이상 남아 있을 때만 센다 (다 쓰면 자리가 없는 게 당연) */
    if (CONFIG.maxBricks - M.totalCost(d) < 2) break;
    const n = countDistinctSpots(d);
    if (n === 0) break;
    minSpots = Math.min(minSpots, n);
    const mv = Solver.hint(d);
    if (!mv) break;
    M.addBrick(d, mv);
    steps++;
  }
  ok(steps > 5, '힌트를 따라 여러 단계 진행됨 (' + steps + '단계)');
  ok(minSpots >= 2, '진행 내내 놓을 수 있는 자리가 항상 2군데 이상 (조립 키트가 되지 않음)', '최소 ' + minSpots);
}

/* ================================================================= */
section('7. 힌트가 학생 설계를 바꾸지 않는지');

{
  const d = Foundation.create('narrow');
  M.addBrick(d, Solver.hint(d));
  const before = JSON.stringify(d.bricks);
  Solver.hint(d);
  ok(JSON.stringify(d.bricks) === before, '힌트를 눌러도 설계가 그대로 유지됨');
}

/* ================================================================= */
section('8. 벽돌 치수를 바꾸면 앱 전체가 따라오는지');

{
  /* 더 큰 벽돌 + 더 큰 받침판 + 더 많은 예산 */
  CONFIG.update({ brickLength: 24, brickWidth: 12, brickHeight: 12, boardWidth: 240, maxBricks: 80 });
  ok(CONFIG.cols === 20, '받침판 240mm / 벽돌 폭 12mm → 격자 20칸', '실제 ' + CONFIG.cols);
  ok(CONFIG.lieCols === 2, '길이 24 ÷ 폭 12 = 2 → 눕히기 여전히 2칸');
  ok(CONFIG.ratioOk && CONFIG.ratioWarning === null, '비율이 2라 경고 없음');

  const d2 = Foundation.create(Foundation.list()[0].id);
  ok(Rules.validateAll(d2).ok, '바뀐 치수에서도 기초가 구조 규칙을 지킴');

  const solved2 = Solver.solve(d2);
  const r2 = Validate.run(solved2);
  ok(r2.status === 'ok', '바뀐 치수에서도 정답 설계가 통과함', r2.title + ' / ' + r2.reason);
  ok(M.totalCost(solved2) <= 80, '바뀐 상한(80장) 안에서 해결 (' + M.totalCost(solved2) + '장)');
}

{
  /* 길이 ÷ 폭 이 2가 아닌 벽돌 → 경고는 뜨지만 진행은 가능해야 함 */
  CONFIG.update({ brickLength: 19, brickWidth: 9, brickHeight: 9, boardWidth: 150, maxBricks: 60 });
  CONFIG.update({ brickWidth: 8 });
  const warn = CONFIG.ratioWarning;
  ok(!CONFIG.ratioOk, '19 ÷ 8 은 2가 아니므로 비율 경고 상태');
  ok(warn === '길이 ÷ 폭 = 2.38 — 엇갈려 쌓기가 맞지 않습니다', '경고 문구가 요청서 형식과 같음', warn);

  const d3 = Foundation.create(Foundation.list()[0].id);
  ok(Rules.validateAll(d3).ok, '비율이 어긋나도 앱은 멈추지 않고 진행됨');
}

{
  /* 원래대로 되돌리기 */
  CONFIG.resetToDefaults();
  ok(CONFIG.brickWidth === 9 && CONFIG.cols === 15 && CONFIG.maxBricks === 60, '기본값 복구');
}

/* ================================================================= */
section('9. 초록색 자리는 언제나 "정말" 놓아도 되는 자리인지');

{
  /* 놓을 수 있다고 표시한 자리에 실제로 놓았을 때,
     이미 쌓아 둔 벽돌까지 포함해 전체가 규칙을 지켜야 합니다.
     (아래 빈틈을 나중에 메우면 위 벽돌이 통줄눈이 되는 문제가 있었음) */
  let checked = 0, broken = 0, firstBad = '';
  for (const pid of ['narrow', 'wide', 'strong']) {
    const base = Foundation.create(pid);
    /* 몇 단 쌓아 올린 중간 상태들에서 모두 확인 */
    for (let step = 0; step < 14; step++) {
      for (const [o, w] of [['lie', 2], ['lie', 1], ['head', 2]]) {
        for (const s of Rules.allSpots(base, o, w)) {
          const sim = M.cloneDesign(base);
          M.addBrick(sim, s);
          const v = Rules.validateAll(sim);
          checked++;
          if (!v.ok) {
            broken++;
            if (!firstBad) firstBad = `${pid} ${o}/${w} @${s.x},${s.y} → ${v.message}`;
          }
        }
      }
      const mv = Solver.hint(base);
      if (!mv || M.totalCost(base) + M.cost(mv) > CONFIG.maxBricks) break;
      M.addBrick(base, mv);
    }
  }
  ok(checked > 100, `충분히 많은 자리를 확인함 (${checked}군데)`);
  ok(broken === 0, '초록색 자리에 놓으면 전체 검증이 항상 통과함', firstBad);
}

/* ================================================================= */
console.log('\n' + '='.repeat(56));
console.log('통과 ' + pass + '개 / 실패 ' + fail + '개');
if (fail) {
  console.log('\n실패 목록:');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('모두 통과했습니다.');
