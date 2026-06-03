// 헤드리스 구동 — DOM/Canvas/Image/rAF를 스텁해 main.js의 루프를 실제로 돌려
// 런타임 예외가 없는지 검증한다(렌더는 no-op). 브라우저 없이 통합 안정성 확인용.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// 전역 의존성(브라우저에선 <script> 전역) 주입
globalThis.ASSETS = require("./assets.js");
try { globalThis.ILL = require("./illust.js"); } catch (e) { /* 일러스트 없으면 main이 가드 */ }
globalThis.Core = require("./core.js");
globalThis.DATA = require("./data.js");
globalThis.window = globalThis;
require("./audio.js"); // window.Audio2 설정 (AudioContext 미지원 → 안전 폴백)
try { require("./journal.js"); } catch (e) { /* journal.js 아직 없으면 main이 가드 처리 */ }

// 스텁
const ctx = new Proxy({}, {
  get(_, p) {
    if (p === "measureText") return () => ({ width: 12 });
    if (p === "canvas") return fakeCanvas;
    if (p === "createRadialGradient" || p === "createLinearGradient") return () => ({ addColorStop() {} });
    return () => {};
  },
  set() { return true; },
});
const cvHandlers = {};
const fakeCanvas = { width: 1056, height: 672, getContext: () => ctx,
  addEventListener: (t, fn) => { cvHandlers[t] = fn; },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1056, height: 672 }) };
globalThis.document = { getElementById: () => fakeCanvas };
class FakeImage { set src(v) { this.width = 32; this.height = 34; this._src = v; if (this.onload) this.onload(); } }
globalThis.Image = FakeImage;
let theFrame = null;
globalThis.requestAnimationFrame = (fn) => { theFrame = fn; return 1; };
const winHandlers = {};
globalThis.addEventListener = (t, fn) => { (winHandlers[t] = winHandlers[t] || []).push(fn); };
let clock = 1000;                              // 합성 시계(프레임 dt와 동기)
globalThis.performance = { now: () => clock };

// main.js 로드(즉시 IIFE 실행 → 핸들러 등록 + 첫 rAF 캡처)
const code = readFileSync(new URL("./main.js", import.meta.url), "utf8");
(0, eval)(code);

function fire(type, ev) { (winHandlers[type] || []).forEach(fn => fn(ev)); }
const ev = (key, code) => ({ key, code, preventDefault() {} });

// ── 입력 회귀 검증: '키로 시작'(타이틀→플레이) + 물리코드(KeyD)로 이동(한글 IME 무관) ──
const s0 = window.__ziro ? window.__ziro() : null;
fire("keydown", ev("ㅇ", "KeyD"));            // 타이틀→인트로, d키 누름 유지(e.key=한글, e.code=KeyD)
let errors = 0, frames = 0;
for (let i = 0; i < 40; i++) { clock += 16; if (theFrame) theFrame(clock); }   // introT>0.5
fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space"));            // 인트로 건너뛰기 → play
for (let i = 0; i < 30; i++) { clock += 16; if (theFrame) theFrame(clock); }   // d 유지 → 우측 이동
const s1 = window.__ziro ? window.__ziro() : null;
if (s1) {
  if (s1.phase !== "play") { console.log("FAIL: 인트로 후 플레이 진입 안 됨 (phase=" + s1.phase + ")"); process.exit(1); }
  if (!(s1.px > s0.px + 1)) { console.log("FAIL: KeyD 물리코드 이동 안 됨 (px " + s0.px + "→" + s1.px + ")"); process.exit(1); }
  console.log("INPUT OK — 키로 시작/인트로 스킵 + KeyD 이동(IME 무관) px " + s0.px.toFixed(0) + "→" + s1.px.toFixed(0));
}
fire("keyup", ev("ㅇ", "KeyD"));

// ── 터치 회귀: 토글 ON → 가상 조이스틱 드래그로 이동 ──
const pev = (x, y, id, type) => ({ clientX: x, clientY: y, pointerId: id || 1, pointerType: type || "touch", preventDefault() {} });
const fireP = (t, e) => { if (cvHandlers[t]) cvHandlers[t](e); };
const tBefore = window.__ziro().px;
fireP("pointerdown", pev(914, 86, 9, "touch"));            // '터치 조작' 토글 ON
fireP("pointerdown", pev(120, 552, 1, "touch"));           // 좌하단 = 조이스틱 시작
fireP("pointermove", pev(180, 552, 1, "touch"));           // 오른쪽 드래그
for (let i = 0; i < 30; i++) { clock += 16; if (theFrame) theFrame(clock); }
const tAfter = window.__ziro().px;
fireP("pointerup", pev(180, 552, 1, "touch"));
if (!(tAfter > tBefore + 1)) { console.log("FAIL: 가상 조이스틱 이동 안 됨 (px " + tBefore.toFixed(0) + "→" + tAfter.toFixed(0) + ")"); process.exit(1); }
console.log("TOUCH OK — 토글 + 가상 조이스틱 이동 (px " + tBefore.toFixed(0) + "→" + tAfter.toFixed(0) + ")");

// ── 챕터2(집·Echo) 구동: loadStage(1) 후 이동(소음) → Echo 로직 무예외 + 이동 확인 ──
if (window.__loadStage) {
  window.__loadStage(1);
  const c2b = window.__ziro();
  if (c2b.ch !== 1) { console.log("FAIL: 챕터2 로드 안 됨 (ch=" + c2b.ch + ")"); process.exit(1); }
  fire("keydown", ev("ㅁ", "KeyD"));
  for (let i = 0; i < 40; i++) { clock += 16; if (theFrame) theFrame(clock); }
  fire("keyup", ev("ㅁ", "KeyD"));
  const c2a = window.__ziro();
  if (!(c2a.px > c2b.px + 1)) { console.log("FAIL: 챕터2 이동 안 됨 (px " + c2b.px.toFixed(0) + "→" + c2a.px.toFixed(0) + ")"); process.exit(1); }
  console.log("CHAPTER2 OK — 집 로드 + Echo 로직 무예외 이동 (px " + c2b.px.toFixed(0) + "→" + c2a.px.toFixed(0) + ")");
  window.__loadStage(0);   // 본 루프는 챕터1로 복귀
}

// ── 가로 스크롤 카메라(챕터6 길거리 40×14): 우측 이동 시 카메라가 따라가는지 ──
if (window.__loadStage) {
  if (window.__setRandom) window.__setRandom(false);       // 카메라 테스트는 결정적으로(랜덤 적 간섭 배제)
  window.__loadStage(8);                                   // 챕터6(길거리, cols40)
  const b = window.__ziro();
  if (!(b.nw >= 640)) { console.log("FAIL: 챕터6 가로 맵 아님 (nw=" + b.nw + ")"); process.exit(1); }
  const cam0 = b.camX;
  fire("keydown", ev("ㅁ", "KeyD"));
  for (let i = 0; i < 260; i++) { clock += 16; if (theFrame) theFrame(clock); }   // 충분히 우측으로(데드존 통과)
  fire("keyup", ev("ㅁ", "KeyD"));
  const a = window.__ziro();
  if (!(a.camX > cam0 + 10)) { console.log("FAIL: 가로 카메라 추적 안 됨 (camX " + cam0.toFixed(0) + "→" + a.camX.toFixed(0) + ")"); process.exit(1); }
  console.log("SCROLL OK — 챕터6 가로 스크롤 카메라 추적 (camX " + cam0.toFixed(0) + "→" + a.camX.toFixed(0) + ")");
  if (window.__setRandom) window.__setRandom(true);
  window.__loadStage(0);
}

// ── 깨달음→선택→엔딩 플로우(최종 챕터20): 코어 수집 후 회상 몽타주 → choice → ending 무예외 ──
if (window.__loadStage && window.__debugClear) {
  window.__loadStage(19);                                   // 챕터20(빈자리·최종) 로드
  const r0 = window.__ziro();
  if (r0.ch !== 19) { console.log("FAIL: 챕터20 로드 안 됨 (ch=" + r0.ch + ")"); process.exit(1); }
  window.__debugClear();                                  // 코어 3 수집 → beginRealize
  let r1 = window.__ziro();
  if (r1.phase !== "realize") { console.log("FAIL: 깨달음 진입 안 됨 (phase=" + r1.phase + ")"); process.exit(1); }
  const lines = r1.realizeLen;
  if (!(lines >= 3)) { console.log("FAIL: 회상 줄 수 부족 (" + lines + ")"); process.exit(1); }
  // 회상 줄을 스페이스로 끝까지 넘김 → choice 진입
  for (let i = 0; i < lines + 2 && window.__ziro().phase === "realize"; i++) {
    fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space"));
    clock += 16; if (theFrame) theFrame(clock);
  }
  r1 = window.__ziro();
  if (r1.phase !== "choice") { console.log("FAIL: 선택 화면 진입 안 됨 (phase=" + r1.phase + ")"); process.exit(1); }
  // '받아들인다(길고양이)'로 토글 후 결정 → ending(stray)
  fire("keydown", ev("s", "KeyS")); fire("keyup", ev("s", "KeyS")); clock += 16; if (theFrame) theFrame(clock);
  fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space")); clock += 16; if (theFrame) theFrame(clock);
  r1 = window.__ziro();
  if (r1.phase !== "ending") { console.log("FAIL: 엔딩 진입 안 됨 (phase=" + r1.phase + ")"); process.exit(1); }
  if (r1.endingType !== "stray") { console.log("FAIL: 엔딩 타입 (" + r1.endingType + ")"); process.exit(1); }
  // 엔딩 렌더 수 초간 무예외 + 스페이스로 타이틀 복귀
  for (let i = 0; i < 220; i++) { clock += 16; if (theFrame) theFrame(clock); }   // 엔딩 입력 허용(>3.0s)까지 대기
  fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space")); clock += 16; if (theFrame) theFrame(clock);
  const r2 = window.__ziro();
  if (r2.phase !== "title") { console.log("FAIL: 엔딩 후 타이틀 복귀 안 됨 (phase=" + r2.phase + ")"); process.exit(1); }
  console.log("ENDING OK — 챕터20 클리어→깨달음 " + lines + "줄→최종선택→길고양이 엔딩→타이틀 (endingType=" + r1.endingType + ")");
  window.__loadStage(0);
}

// ── 중간 분기(마음 미터): 챕터4 클리어 → 깨달음 → branch → 희망 선택(+1) → 전환 무예외 ──
if (window.__loadStage && window.__debugClear && window.__hope) {
  window.__hope(0); window.__loadStage(4);                 // 챕터4(하루의 방)
  window.__debugClear();
  for (let i = 0; i < 14 && window.__ziro().phase === "realize"; i++) {
    fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space")); clock += 16; if (theFrame) theFrame(clock);
  }
  let b = window.__ziro();
  if (b.phase !== "branch") { console.log("FAIL: 중간 분기 진입 안 됨 (phase=" + b.phase + ")"); process.exit(1); }
  fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space")); clock += 16; if (theFrame) theFrame(clock);  // 희망(0) 선택
  if (window.__hope() !== 1) { console.log("FAIL: 마음 미터 누적 안 됨 (hope=" + window.__hope() + ")"); process.exit(1); }
  b = window.__ziro();
  if (b.phase !== "transition") { console.log("FAIL: 분기 후 전환 안 됨 (phase=" + b.phase + ")"); process.exit(1); }
  console.log("BRANCH OK — 챕터4 깨달음→마음의 분기→희망(+1)→전환 (hope=" + window.__hope() + ")");
  window.__hope(0); window.__loadStage(0);
}
// ── 보스 '공백' 연출: 챕터20 코어 수집 후 기억 비추기(Q)로 2회 비춰 해소 → 깨달음 ──
if (window.__loadStage && window.__collectCores && window.__boss) {
  window.__loadStage(19); window.__collectCores();
  const b0 = window.__boss();
  if (!b0 || b0.hp !== 3) { console.log("FAIL: 보스 미존재/HP (" + JSON.stringify(b0) + ")"); process.exit(1); }
  for (let i = 0; i < 260; i++) { clock += 16; if (theFrame) theFrame(clock); }   // 파동 charge/burst 사이클 무예외 소크(스폰=안전거리)
  if (window.__ziro().phase !== "play" || window.__boss().dispelled) { console.log("FAIL: 보스 소크 중 비정상 종료"); process.exit(1); }
  for (let s = 0; s < 60 && !window.__boss().dispelled; s++) {           // 취약(idle) 창에서만 Q 타격
    if (window.__boss().phase === "idle") { fire("keydown", ev("q", "KeyQ")); clock += 16; if (theFrame) theFrame(clock); fire("keyup", ev("q", "KeyQ")); }
    for (let i = 0; i < 4; i++) { clock += 16; if (theFrame) theFrame(clock); }
  }
  if (!window.__boss().dispelled) { console.log("FAIL: 보스 미해소 (boss=" + JSON.stringify(window.__boss()) + ")"); process.exit(1); }
  for (let i = 0; i < 130; i++) { clock += 16; if (theFrame) theFrame(clock); }   // 해소 후 exitT → realize
  const ph = window.__ziro().phase;
  if (!(ph === "realize" || ph === "choice")) { console.log("FAIL: 보스 해소→깨달음 안 됨 (phase=" + ph + ", boss=" + JSON.stringify(window.__boss()) + ")"); process.exit(1); }
  console.log("BOSS OK — 챕터20 코어수집→Q로 공백 해소→깨달음(phase=" + ph + ")");
  window.__loadStage(0);
}

// ── 스테이지 선택 메뉴 + 진행 저장 + 시퀀스 재생: 타이틀→Tab→선택→시작/시퀀스 ──
if (window.__title && window.__sel) {
  const step = () => { clock += 16; if (theFrame) theFrame(clock); };
  window.__title();                                          // 타이틀로(진행 clearedMax 유지)
  const s0 = window.__sel();
  if (!(s0.clearedMax >= 0)) { console.log("FAIL: 진행 저장 안 됨 (clearedMax=" + s0.clearedMax + ")"); process.exit(1); }
  fire("keydown", ev("Tab", "Tab")); fire("keyup", ev("Tab", "Tab")); step();   // 스테이지 선택 열기
  if (window.__sel().phase !== "select") { console.log("FAIL: 스테이지 선택 진입 안 됨 (" + window.__sel().phase + ")"); process.exit(1); }
  fire("keydown", ev("ㅁ", "KeyD")); fire("keyup", ev("ㅁ", "KeyD")); step();    // 우로 이동(포커스)
  const selBefore = window.__sel().selIdx;
  fire("keydown", ev("r", "KeyR")); fire("keyup", ev("r", "KeyR")); step();      // 시퀀스 다시 보기
  if (window.__ziro().phase !== "realize") { console.log("FAIL: 시퀀스 재생 진입 안 됨 (" + window.__ziro().phase + ")"); process.exit(1); }
  for (let i = 0; i < 80 && window.__ziro().phase === "realize"; i++) { fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space")); step(); }
  if (window.__sel().phase !== "select") { console.log("FAIL: 시퀀스 후 메뉴 복귀 안 됨 (" + window.__sel().phase + ")"); process.exit(1); }
  fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space")); step();    // 여기서 시작
  if (window.__ziro().phase !== "play") { console.log("FAIL: 선택 스테이지 시작 안 됨 (" + window.__ziro().phase + ")"); process.exit(1); }
  console.log("SELECT OK — 타이틀→[Tab] 선택→[R] 시퀀스 재생→메뉴→[Space] 시작 (selIdx=" + selBefore + ", clearedMax=" + s0.clearedMax + ")");
  window.__title(); window.__loadStage(0);
}

// ── 랜덤 레이아웃 검증: 전 스테이지 반복 로드 → 조각·적 patrol이 가구 관통 없는지 ──
if (window.__loadStage && window.__layoutCheck) {
  let totalBad = 0, totalUnreach = 0, loads = 0;
  for (let n = 0; n < 20; n++) for (let s = 0; s < 20; s++) { window.__loadStage(s); const r = window.__layoutCheck(); totalBad += r.bad; totalUnreach += r.unreachable; loads++; }
  if (totalBad > 0) { console.log("FAIL: 랜덤 배치가 벽/가구에 겹침 (" + totalBad + "건 / " + loads + "회)"); process.exit(1); }
  if (totalUnreach > 0) { console.log("FAIL: 도달 불가 조각 발생 (" + totalUnreach + "건 / " + loads + "회)"); process.exit(1); }
  console.log("RANDOM OK — 전 20스테이지 " + loads + "회 랜덤 배치, 가구 관통 0 · 도달불가 0");
  window.__loadStage(0);
}

// ── 일시정지(ESC) + 접근성 토글: 열기→플래시감소 켜기→계속 ──
if (window.__loadStage) {
  if (window.__setRandom) window.__setRandom(false);
  window.__loadStage(0);
  fire("keydown", ev("Escape", "Escape")); fire("keyup", ev("Escape", "Escape")); clock += 16; if (theFrame) theFrame(clock);
  if (!window.__ziro().paused) { console.log("FAIL: ESC 일시정지 안 됨"); process.exit(1); }
  fire("keydown", ev("s", "KeyS")); fire("keyup", ev("s", "KeyS")); clock += 16; if (theFrame) theFrame(clock);  // '플래시 감소'로 이동
  fire("keydown", ev(" ", "Space")); fire("keyup", ev(" ", "Space")); clock += 16; if (theFrame) theFrame(clock);  // 토글 ON
  if (!window.__ziro().reduceFlash) { console.log("FAIL: 접근성 토글(플래시 감소) 안 됨"); process.exit(1); }
  fire("keydown", ev("Escape", "Escape")); fire("keyup", ev("Escape", "Escape")); clock += 16; if (theFrame) theFrame(clock);  // ESC 계속
  if (window.__ziro().paused) { console.log("FAIL: ESC 재개 안 됨"); process.exit(1); }
  console.log("PAUSE OK — ESC 일시정지 · 접근성 토글(플래시 감소) · 재개");
  if (window.__setRandom) window.__setRandom(true);
  window.__loadStage(0);
}

const walk = ["d", "d", "s", "s", "a", "w", "d", "s"];
try {
  for (let i = 0; i < 700; i++) {
    // 입력 패턴 변경
    if (i % 40 === 0) { const k = walk[(i / 40) % walk.length | 0]; fire("keydown", ev(k)); }
    if (i % 40 === 20) fire("keyup", ev(walk[((i - 20) / 40) % walk.length | 0]));
    if (i % 17 === 0) { fire("keydown", ev("e")); fire("keyup", ev("e")); }   // 조사 시도
    if (i % 90 === 0) { fire("keydown", ev("h")); fire("keyup", ev("h")); }   // 힌트
    if (i % 130 === 0) { fire("keydown", ev(" ")); fire("keyup", ev(" ")); }  // 회상 닫기
    if (i % 200 === 0) { fire("keydown", ev("Shift")); }                       // 은신
    if (i % 60 === 0) { fire("keydown", ev("m")); fire("keyup", ev("m")); }    // 음소거 토글
    if (i % 50 < 8) fire("keydown", ev("q")); else fire("keyup", ev("q"));     // 기억 비추기(홀드)
    if (i % 75 === 0) { fire("keydown", ev("l")); fire("keyup", ev("l")); }    // 발자국 추적
    if (i % 110 === 0) { fire("keydown", ev("Tab")); fire("keyup", ev("Tab")); } // 일지 토글
    clock += 16;
    if (theFrame) theFrame(clock);
    frames++;
  }
} catch (e) { errors++; console.error("RUNTIME ERROR:", e && e.stack || e); }

if (errors === 0) console.log(`HEADLESS OK — main.js ${frames} 프레임 무예외 구동(이동·조사·힌트·은신·음소거 입력 포함).`);
else { console.log("HEADLESS FAILED"); process.exit(1); }
