// 통합 스모크 — core.js + data.js 전 10스테이지 정합 검증(DOM 불필요).
//   · 핵심 규칙(수집/후퇴/시야) · 전 챕터 스키마/좌표(조각·스폰·안전지대 FREE)
//   · 적 patrol 의 '구간(leg)'까지 샘플링해 가구 관통 차단.
import { createRequire } from "node:module";
import assert from "node:assert";
const require = createRequire(import.meta.url);
const Core = require("./core.js");
const DATA = require("./data.js");

// ── 핵심 규칙(챕터1 기준) ──
const D = DATA.chapter1;
const st = Core.newState(D);
assert.equal(st.coresNeeded, 3, "coresNeeded=3");
const cores = D.shards.filter(s => s.type === "core");
cores.slice(0, 3).forEach(s => { assert.equal(Core.collect(st, s).ok, true, "collect ok " + s.id); });
assert.equal(Core.chapterClear(st), true, "코어 3 → 클리어");
st.mem = 1; for (let i = 0; i < 5; i++) { st.iframe = 0; Core.contact(st); }
assert.equal(Core.setbackIfDead(st), true, "mem<=0 → setback");
assert.equal(Core.chapterClear(st), false, "후퇴로 클리어 해제");
const sealed = cores.slice(0, 3).find(s => !st.collected.has(s.id));
Core.collect(st, sealed); assert.equal(Core.chapterClear(st), true, "재획득 → 다시 클리어");

// ── Murk 시야: fov는 '도(°)' 전달(이중변환 회귀 차단) ──
{
  const m = D.murks[0], mx = m.patrol[0][0]*D.tile+8, my = m.patrol[0][1]*D.tile+8;
  const sight = (m.sightTiles||3.3)*D.tile, fov = m.fovDeg||90;
  const sees = (ox, oy) => Core.murkSees({ x:mx, y:my, faceAngle:0, sight, fov }, ox, oy);
  assert.equal(sees(mx+20, my), true, "정면 감지");
  assert.equal(sees(mx+20, my+15), true, "37° 이내 감지(이중변환이면 실패)");
  assert.equal(sees(mx-20, my), false, "등 뒤 미감지");
  assert.equal(sees(mx+10, my+40), false, "76° 밖 미감지");
}
console.log("SMOKE OK — 핵심 규칙(수집/후퇴/시야) 정합.");

// ── 전 20스테이지 스키마/좌표/patrol-leg 검증 (main.js CHAPTERS 순서) ──
const ORDER = ["chapter1","chapter2","chapter_entry","chapter3","chapter4",
  "chapter5","chapter_busstop","chapter_avenue","chapter6","chapter_alley",
  "chapter7","chapter_toclinic","chapter_clinicfront","chapter_rooftop","chapter8",
  "chapter_plaza","chapter_lamplane","chapter9","chapter_emptystreet","chapter10"];
const inRect = (c, r, q) => c >= q[0] && c < q[0]+q[2] && r >= q[1] && r < q[1]+q[3];
const inAny  = (c, r, qs) => qs.some(q => inRect(c, r, q));
let totalShards = 0, scrolls = [];

for (const key of ORDER) {
  const C = DATA[key];
  assert.ok(C, key + " 존재");
  const tag = key + "(" + C.title + ")";
  assert.ok(C.cols >= 12 && C.rows >= 10, tag + " 크기");
  assert.ok(typeof C.bgKey === "string", tag + " bgKey");
  assert.equal(C.coresNeeded, 3, tag + " coresNeeded=3");
  assert.ok(Array.isArray(C.epiphany) && C.epiphany.length >= 4, tag + " epiphany≥4");
  assert.ok(Array.isArray(C.identityLabels) && C.identityLabels.length === 5, tag + " 라벨5");
  if (C.cols > 22 || C.rows > 14) scrolls.push(key + " " + C.cols + "×" + C.rows);

  const walls = C.collision, furn = C.collision.slice(4);   // 앞4=테두리
  // 테두리 4개 형태 점검
  assert.deepEqual(walls[0], [0,0,C.cols,2], tag + " 상단벽");
  assert.deepEqual(walls[1], [0,C.rows-1,C.cols,1], tag + " 하단벽");
  assert.deepEqual(walls[2], [0,0,1,C.rows], tag + " 좌벽");
  assert.deepEqual(walls[3], [C.cols-1,0,1,C.rows], tag + " 우벽");

  // 스폰 FREE
  assert.ok(!inAny(C.spawn[0], C.spawn[1], walls), tag + " 스폰 FREE " + C.spawn);
  // 문 존재
  assert.ok(C.door && Array.isArray(C.door.tile), tag + " door");

  // 조각: 스키마 + 충돌 밖 + 코어수/슬롯
  const cs = C.shards.filter(s => s.type === "core");
  assert.ok(cs.length >= C.coresNeeded, tag + " 코어≥" + C.coresNeeded + " (" + cs.length + ")");
  for (const s of C.shards) {
    assert.ok(s.id && ["core","echo","false"].includes(s.type), tag + " 조각타입 " + s.id);
    assert.ok(typeof s.recall === "string" && s.recall.length > 4, tag + " recall " + s.id);
    assert.ok(!inAny(s.tile[0], s.tile[1], walls), tag + " 조각 충돌밖 " + s.id + " " + s.tile);
    if (s.type === "core") assert.ok(s.identitySlot >= 0 && s.identitySlot <= 4, tag + " core slot " + s.id);
    else assert.ok(s.identitySlot == null, tag + " 비코어 slot null " + s.id);
    totalShards++;
  }
  // 안전지대: 가구 밖
  for (const z of (C.safeZones || [])) for (const q of furn)
    assert.ok(!(z[0] < q[0]+q[2] && z[0]+z[2] > q[0] && z[1] < q[1]+q[3] && z[1]+z[3] > q[1]), tag + " 안전지대 가구밖 " + z);

  // 적 patrol: waypoint + leg 샘플이 가구 비관통
  for (const e of [...(C.murks||[]), ...(C.echoes||[])]) {
    assert.ok(Array.isArray(e.patrol) && e.patrol.length >= 2, tag + " patrol " + e.id);
    const p = e.patrol;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i+1) % p.length];
      assert.ok(!inAny(a[0], a[1], furn), tag + " waypoint 가구밖 " + e.id + " " + a);
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) * 4));
      for (let s = 1; s < steps; s++) {
        const cx = Math.floor(a[0] + (b[0]-a[0]) * s/steps), cy = Math.floor(a[1] + (b[1]-a[1]) * s/steps);
        assert.ok(!inAny(cx, cy, furn), tag + " patrol-leg 가구관통 " + e.id + " @" + cx + "," + cy);
      }
    }
  }
  // 상태 생성 무오류
  Core.newState(C);
}

assert.equal(DATA.chapter10.isFinal, true, "ch10 isFinal");
assert.ok(!DATA.chapter9.isFinal, "ch9 비최종");
console.log("SMOKE OK — 전 20스테이지 정합. 조각 합계 " + totalShards + " / 스크롤 맵: " + scrolls.join(", "));
