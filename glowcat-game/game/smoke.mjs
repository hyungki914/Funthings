// 통합 스모크 테스트 — core.js + data.js 를 함께 구동해 인터페이스/플로우 검증 (DOM 불필요).
import { createRequire } from "node:module";
import assert from "node:assert";
const require = createRequire(import.meta.url);
const Core = require("./core.js");
const DATA = require("./data.js");

const D = DATA.chapter1;
assert.ok(D && D.shards && D.shards.length >= 4, "data.chapter1.shards 존재");
const st = Core.newState(D);
assert.equal(st.coresNeeded, 3, "coresNeeded=3");
assert.equal(st.mem, Core.C.START_MEM, "초기 mem");

// 조각 스키마 점검
for (const s of D.shards) {
  assert.ok(s.id && s.type && Array.isArray(s.tile), "조각 필드(id/type/tile): " + JSON.stringify(s.tile));
  assert.ok(["core", "echo", "false"].includes(s.type), "type 유효: " + s.type);
  assert.ok(typeof s.recall === "string" && s.recall.length > 0, "recall 텍스트: " + s.id);
}
const cores = D.shards.filter(s => s.type === "core");
assert.ok(cores.length >= 3, "코어 ≥3 (" + cores.length + ")");

// 코어 3개 수집 → 정체성 상승 + 클리어
let id0 = st.identity;
cores.slice(0, 3).forEach((s, i) => {
  const r = Core.collect(st, s);
  assert.equal(r.ok, true, "collect ok: " + s.id);
  assert.ok(st.identity >= id0, "identity 비감소");
});
assert.equal(Core.chapterClear(st), true, "코어 3 → 클리어");
const idAfter = Core.identityState(st);
assert.ok(idAfter.unlocked >= 1, "정체성 unlocked");

// false 조각은 메모리 감소
const f = D.shards.find(s => s.type === "false");
if (f) { const before = st.mem; Core.collect(st, f); assert.ok(st.mem <= before, "false 조각 mem 감소"); }

// 접촉으로 0 → 후퇴: 마지막 코어 봉인, 클리어 해제
st.mem = 1;
for (let i = 0; i < 5; i++) { st.iframe = 0; Core.contact(st); }
const wasClear = Core.chapterClear(st);
const setback = Core.setbackIfDead(st);
assert.equal(setback, true, "mem<=0 → setback");
assert.equal(st.mem, Core.C.SETBACK_MEM, "후퇴 후 mem=SETBACK_MEM");
assert.equal(Core.chapterClear(st), false, "후퇴로 코어 1개 봉인 → 클리어 해제");

// 봉인 코어 재획득 → 다시 클리어
const sealedCore = cores.slice(0, 3).find(s => !st.collected.has(s.id));
assert.ok(sealedCore, "봉인된 코어 존재");
Core.collect(st, sealedCore);
assert.equal(Core.chapterClear(st), true, "재획득 → 다시 클리어");

// murk 시야: data의 murk 정의로 판정. ★ fov는 '도(°)'로 전달(core.js가 내부 rad 변환).
//   main.js가 라디안을 넘기던 '이중 변환' 버그(시야 90°→~1.6°)를 측면 케이스로 회귀 차단.
const m = D.murks[0];
const mx = m.patrol[0][0] * D.tile + 8, my = m.patrol[0][1] * D.tile + 8;
const fovDeg = m.fovDeg || 90, sight = (m.sightTiles || 3.3) * D.tile;
const sees = (ox, oy) => Core.murkSees({ x: mx, y: my, faceAngle: 0, sight, fov: fovDeg }, ox, oy);
assert.equal(sees(mx + 20, my), true, "정면 근접 감지");
assert.equal(sees(mx + 20, my + 15), true, "정면 약 37° 이내 감지 (이중변환이면 실패)"); // atan2(15,20)=36.9° < 45
assert.equal(sees(mx - 20, my), false, "등 뒤 미감지");
assert.equal(sees(mx + 10, my + 40), false, "측면 약 76° 밖 미감지");                  // atan2(40,10)=76° > 45
assert.equal(sees(mx + sight + 30, my), false, "사거리 밖 미감지");

console.log("SMOKE OK — core+data 통합 정합. 조각", D.shards.length, "/ 코어", cores.length, "/ murk", D.murks.length);

// ── 챕터2 「집」 스키마 + 좌표 검산 ──
const D2 = DATA.chapter2;
assert.ok(D2 && D2.bgKey === "room2", "chapter2 존재(room2)");
assert.equal(D2.shards.filter(s => s.type === "core").length, 3, "ch2 코어 3");
assert.ok(Array.isArray(D2.echoes) && D2.echoes.length >= 1, "ch2 Echo 존재");
const st2 = Core.newState(D2);
assert.equal(st2.coresNeeded, 3, "ch2 coresNeeded");
const inRect = (c, r, q) => c >= q[0] && c < q[0] + q[2] && r >= q[1] && r < q[1] + q[3];
for (const s of D2.shards) for (const q of D2.collision) assert.ok(!inRect(s.tile[0], s.tile[1], q), "ch2 조각 충돌밖: " + s.id);
assert.ok(!D2.collision.some(q => inRect(D2.spawn[0], D2.spawn[1], q)), "ch2 스폰 FREE");
for (const m of D2.murks.concat(D2.echoes)) for (const p of m.patrol) for (const q of D2.collision.slice(4)) assert.ok(!inRect(p[0], p[1], q), "ch2 순찰점 가구밖: " + m.id);
console.log("SMOKE2 OK — chapter2 집: 조각", D2.shards.length, "/ Echo", D2.echoes.length, "/ Murk", D2.murks.length);

// ── 챕터3 「공원」(최종) 스키마 + 좌표 검산 ──
const D3 = DATA.chapter3;
assert.ok(D3 && D3.bgKey === "room3", "chapter3 존재(room3)");
assert.equal(D3.isFinal, true, "chapter3 isFinal");
assert.equal(D3.shards.filter(s => s.type === "core").length, 3, "ch3 코어 3");
assert.ok(Array.isArray(D3.epiphany) && D3.epiphany.length >= 1, "ch3 epiphany 존재");
assert.ok(Array.isArray(D3.murks) && D3.murks.length >= 1 && Array.isArray(D3.echoes) && D3.echoes.length >= 1, "ch3 Murk+Echo 공존");
const st3 = Core.newState(D3);
assert.equal(st3.coresNeeded, 3, "ch3 coresNeeded");
for (const s of D3.shards) for (const q of D3.collision) assert.ok(!inRect(s.tile[0], s.tile[1], q), "ch3 조각 충돌밖: " + s.id);
assert.ok(!D3.collision.some(q => inRect(D3.spawn[0], D3.spawn[1], q)), "ch3 스폰 FREE");
for (const m of D3.murks.concat(D3.echoes)) for (const p of m.patrol) for (const q of D3.collision.slice(4)) assert.ok(!inRect(p[0], p[1], q), "ch3 순찰점 가구밖: " + m.id);
// 깨달음/엔딩 데이터 정합: 모든 챕터에 epiphany, 최종에만 isFinal
assert.ok(DATA.chapter1.epiphany && DATA.chapter2.epiphany && DATA.chapter3.epiphany, "전 챕터 epiphany 존재");
assert.ok(!DATA.chapter1.isFinal && !DATA.chapter2.isFinal, "ch1/ch2 비최종");
console.log("SMOKE3 OK — chapter3 공원(최종): 조각", D3.shards.length, "/ 깨달음", D3.epiphany.length, "줄 / isFinal");
