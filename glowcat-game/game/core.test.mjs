// core.test.mjs — Node 단위테스트 (node:test + node:assert)
// core.js 는 CommonJS 이므로 createRequire 로 로드.
// 실행: node --test core.test.mjs   또는   node core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('./core.js');

// 챕터1 유사 데이터(테스트용). §2-2 스키마 일부.
function makeData() {
  return { coresNeeded: 3 };
}
const coreShard = (id, slot, recall = '회상') =>
  ({ id, type: 'core', identitySlot: slot, recall });
const echoShard = (id, recall = '에코') =>
  ({ id, type: 'echo', identitySlot: 0, recall });
const falseShard = (id, recall = '거짓') =>
  ({ id, type: 'false', identitySlot: 0, recall });

// 1. newState 초기값
test('newState: 초기값 (mem=4, light=2, identity=0)', () => {
  const s = Core.newState(makeData());
  assert.equal(s.mem, 4);
  assert.equal(s.light, 2);
  assert.equal(s.identity, 0);
  assert.equal(s.iframe, 0);
  assert.equal(s.coresNeeded, 3);
  assert.ok(s.collected instanceof Set && s.collected.size === 0);
  assert.ok(s.sealed instanceof Set && s.sealed.size === 0);
  assert.deepEqual(s.coreOrder, []);
  // 상수도 스펙대로인지 확인
  assert.equal(Core.C.MEM_MAX, 10);
  assert.equal(Core.C.LIGHT_MAX, 6);
  assert.equal(Core.C.SETBACK_MEM, 3);
});

// 2. core 조각 collect → mem+2, light+1, identity 상승, coreOrder 증가; 재collect는 {ok:false}
test('collect(core): mem+2, light+1, identity 상승, coreOrder 증가; 재수집 거부', () => {
  const s = Core.newState(makeData());
  const r = Core.collect(s, coreShard('c1', 0, '나는 고양이'));
  assert.equal(r.ok, true);
  assert.equal(r.type, 'core');
  assert.equal(r.gainMem, 2);
  assert.equal(r.gainLight, 1);
  assert.equal(r.recallText, '나는 고양이');
  assert.equal(r.identitySlot, 0);
  assert.equal(s.mem, 6);          // 4 + 2
  assert.equal(s.light, 3);        // 2 + 1
  assert.equal(s.identity, 1);     // max(0, 0+1)
  assert.deepEqual(s.coreOrder, ['c1']);
  assert.ok(s.collected.has('c1'));

  // 재수집은 거부, 상태 불변
  const r2 = Core.collect(s, coreShard('c1', 0));
  assert.deepEqual(r2, { ok: false });
  assert.equal(s.mem, 6);
  assert.equal(s.coreOrder.length, 1);
});

// 3. false 조각 → mem-2
test('collect(false): mem-2', () => {
  const s = Core.newState(makeData());
  const r = Core.collect(s, falseShard('f1'));
  assert.equal(r.ok, true);
  assert.equal(r.type, 'false');
  assert.equal(r.gainMem, -2);
  assert.equal(r.gainLight, 0);
  assert.equal(s.mem, 2);          // 4 - 2
  assert.equal(s.light, 2);        // 불변
  assert.equal(s.identity, 0);     // 불변
});

// echo 보조 확인 + clamp(0 바닥)
test('collect(echo): mem+1, light+1; mem 바닥 0 clamp', () => {
  const s = Core.newState(makeData());
  Core.collect(s, echoShard('e1'));
  assert.equal(s.mem, 5);
  assert.equal(s.light, 3);
  // mem 바닥 clamp: false 조각으로 0 밑으로 못 내려감
  const s2 = Core.newState(makeData()); // mem 4
  Core.collect(s2, falseShard('f1')); // 2
  Core.collect(s2, falseShard('f2')); // 0
  Core.collect(s2, falseShard('f3')); // clamp 0
  assert.equal(s2.mem, 0);
});

// 4. contact → mem-2 & iframe>0, 연속 contact는 무피해(iframe)
test('contact: mem-2 + iframe 셋; 연속 contact 무피해', () => {
  const s = Core.newState(makeData());
  const hit = Core.contact(s);
  assert.equal(hit, true);
  assert.equal(s.mem, 2);              // 4 - 2
  assert.ok(s.iframe > 0);
  assert.equal(s.iframe, Core.C.IFRAME_S);

  // 무적 중 두 번째 접촉 = 무피해
  const hit2 = Core.contact(s);
  assert.equal(hit2, false);
  assert.equal(s.mem, 2);              // 변화 없음
});

// 5. tick: inSafe 회복 cap, inDanger 감소 floor 0, iframe 감소
test('tick: inSafe 회복(cap 10), inDanger 감소(floor 0), iframe 감소', () => {
  // inSafe 회복
  const s = Core.newState(makeData()); // mem 4
  Core.tick(s, 1.0, { inSafe: true });
  assert.equal(s.mem, 5);             // +REST_PER_S
  // cap 확인: 충분히 큰 dt 로 10 초과 금지
  Core.tick(s, 100, { inSafe: true });
  assert.equal(s.mem, Core.C.MEM_MAX);

  // inDanger 감소
  const d = Core.newState(makeData()); // mem 4
  Core.tick(d, 1.0, { inDanger: true });
  assert.ok(Math.abs(d.mem - 3.8) < 1e-9); // 4 - 0.2
  // floor 0 확인
  Core.tick(d, 1000, { inDanger: true });
  assert.equal(d.mem, 0);

  // iframe 감소 (그리고 0 미만 안 됨)
  const f = Core.newState(makeData());
  Core.contact(f); // iframe = 1.2
  Core.tick(f, 0.5, {});
  assert.ok(Math.abs(f.iframe - 0.7) < 1e-9);
  Core.tick(f, 10, {});
  assert.equal(f.iframe, 0);
});

// 6. useHint: 정상 차감 + light 부족 시 {ok:false}
test('useHint: light 차감; 부족 시 {ok:false}', () => {
  const s = Core.newState(makeData()); // light 2
  assert.deepEqual(Core.useHint(s), { ok: true });
  assert.equal(s.light, 1);
  assert.deepEqual(Core.useHint(s), { ok: true });
  assert.equal(s.light, 0);
  // 부족
  const r = Core.useHint(s);
  assert.equal(r.ok, false);
  assert.equal(s.light, 0);
});

// 7. setbackIfDead: mem>0 false; mem<=0 → 마지막 코어 봉인/제거, mem=3, identity 재계산, chapterClear 다시 false
test('setbackIfDead: 후퇴 봉인 로직', () => {
  const s = Core.newState(makeData());
  // 코어 3개 수집 → 클리어 조건 충족
  Core.collect(s, coreShard('c1', 0));
  Core.collect(s, coreShard('c2', 1));
  Core.collect(s, coreShard('c3', 2));
  assert.equal(s.identity, 3);
  assert.equal(Core.chapterClear(s), true);

  // mem>0 이면 후퇴 없음
  assert.equal(Core.setbackIfDead(s), false);

  // mem 을 0 으로 강제
  s.mem = 0;
  const did = Core.setbackIfDead(s);
  assert.equal(did, true);
  assert.equal(s.mem, Core.C.SETBACK_MEM); // 3
  // 마지막 코어(c3) 봉인 + collected/coreOrder 에서 제거
  assert.ok(s.sealed.has('c3'));
  assert.ok(!s.collected.has('c3'));
  assert.deepEqual(s.coreOrder, ['c1', 'c2']);
  // identity 재계산: 남은 코어 최대 slot(1) + 1 = 2
  assert.equal(s.identity, 2);
  // 클리어 다시 false (코어 2개 < 3)
  assert.equal(Core.chapterClear(s), false);

  // 봉인된 코어 재획득 허용 (sealed 라도 collected 에서 빠졌으니 collect 가능)
  const r = Core.collect(s, coreShard('c3', 2));
  assert.equal(r.ok, true);
  assert.deepEqual(s.coreOrder, ['c1', 'c2', 'c3']);
  assert.equal(s.identity, 3);
  assert.equal(Core.chapterClear(s), true);
});

// 코어 전부 빠지면 identity 0 으로
test('setbackIfDead: 코어 1개만일 때 봉인 후 identity 0', () => {
  const s = Core.newState(makeData());
  Core.collect(s, coreShard('c1', 0));
  assert.equal(s.identity, 1);
  s.mem = 0;
  Core.setbackIfDead(s);
  assert.deepEqual(s.coreOrder, []);
  assert.equal(s.identity, 0); // 남은 코어 없음
});

// 코어가 하나도 없는 상태에서 후퇴해도 안전 (pop undefined)
test('setbackIfDead: 코어 0개여도 안전', () => {
  const s = Core.newState(makeData());
  s.mem = 0;
  const did = Core.setbackIfDead(s);
  assert.equal(did, true);
  assert.equal(s.mem, Core.C.SETBACK_MEM);
  assert.equal(s.identity, 0);
  assert.equal(s.sealed.size, 0);
});

// 8. murkSees: 정면 가까이 true / 등 뒤 false / 사거리 밖 false
test('murkSees: 정면 가까이 true', () => {
  // faceAngle 0 = +x 방향, 시야 100px, fov 90도
  const murk = { x: 0, y: 0, faceAngle: 0, sight: 100, fov: 90 };
  // 정면 근접
  assert.equal(Core.murkSees(murk, 50, 0), true);
  // 정면 살짝 위(각도 45도 = fov/2 경계 안)
  assert.equal(Core.murkSees(murk, 50, 49), true);
});

test('murkSees: 등 뒤 false', () => {
  const murk = { x: 0, y: 0, faceAngle: 0, sight: 100, fov: 90 };
  // 등 뒤 (-x)
  assert.equal(Core.murkSees(murk, -50, 0), false);
  // 측면 90도 (fov 90 의 절반=45도 초과)
  assert.equal(Core.murkSees(murk, 0, 50), false);
});

test('murkSees: 사거리 밖 false', () => {
  const murk = { x: 0, y: 0, faceAngle: 0, sight: 100, fov: 90 };
  // 정면이지만 거리 150 > 100
  assert.equal(Core.murkSees(murk, 150, 0), false);
});

test('murkSees: 각도 정규화 경계 (faceAngle = π 부근, wraparound)', () => {
  // faceAngle = π (= -x 방향). 플레이어가 -x 쪽이면 정면.
  const murk = { x: 0, y: 0, faceAngle: Math.PI, sight: 100, fov: 90 };
  assert.equal(Core.murkSees(murk, -50, 0), true);  // 정면(-x)
  assert.equal(Core.murkSees(murk, 50, 0), false);  // 등 뒤(+x)
});

// 9. identityState portrait 단계, chapterClear 임계
test('identityState: portrait 단계 매핑', () => {
  const s = Core.newState(makeData());
  // identity 0..5 별 portrait
  const expect = ['q', 'silhouette', 'eyes', 'face', 'name'];
  for (let i = 0; i <= 4; i++) {
    s.identity = i;
    const st = Core.identityState(s);
    assert.equal(st.unlocked, i);
    assert.equal(st.portrait, expect[i]);
  }
  // identity 5 (최대 단계) → min(5,4) = 'name'
  s.identity = 5;
  assert.equal(Core.identityState(s).portrait, 'name');
  assert.equal(Core.identityState(s).unlocked, 5);
});

test('chapterClear: 임계 (코어 수 < / == / > coresNeeded)', () => {
  const s = Core.newState(makeData()); // coresNeeded 3
  assert.equal(Core.chapterClear(s), false);     // 0개
  Core.collect(s, coreShard('c1', 0));
  assert.equal(Core.chapterClear(s), false);     // 1개
  Core.collect(s, coreShard('c2', 1));
  assert.equal(Core.chapterClear(s), false);     // 2개
  Core.collect(s, coreShard('c3', 2));
  assert.equal(Core.chapterClear(s), true);      // 3개 == 임계
  Core.collect(s, coreShard('c4', 3));
  assert.equal(Core.chapterClear(s), true);      // 4개 > 임계
});

// 보너스: normAngle 정확성
test('normAngle: -π..π 정규화', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ~ ${b}`);
  // 방향 동일성(코사인/사인 일치)으로 비교 — ±π 경계 부호는 무관
  const sameDir = (a, b) =>
    assert.ok(
      Math.abs(Math.cos(a) - Math.cos(b)) < 1e-9 &&
        Math.abs(Math.sin(a) - Math.sin(b)) < 1e-9,
      `dir ${a} ~ ${b}`,
    );
  // 항상 -π..π 범위 내
  const inRange = (a) =>
    assert.ok(a >= -Math.PI - 1e-12 && a <= Math.PI + 1e-12, `range ${a}`);

  near(Core.normAngle(0), 0);
  near(Core.normAngle(1.5 * Math.PI), -0.5 * Math.PI);
  // ±π 경계: 표준 [-π, π) 컨벤션(atan2 와 동일) → 방향만 검증
  sameDir(Core.normAngle(Math.PI), Math.PI);
  inRange(Core.normAngle(Math.PI));

  // wraparound: 방향이 보존되고 범위 안에 들어오는지 확인
  for (const a of [-Math.PI, 2 * Math.PI, 3 * Math.PI, -3 * Math.PI, 10, -10]) {
    const r = Core.normAngle(a);
    inRange(r);
    sameDir(r, a);
  }
});
