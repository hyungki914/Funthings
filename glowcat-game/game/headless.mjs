// 헤드리스 구동 — DOM/Canvas/Image/rAF를 스텁해 main.js의 루프를 실제로 돌려
// 런타임 예외가 없는지 검증한다(렌더는 no-op). 브라우저 없이 통합 안정성 확인용.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// 전역 의존성(브라우저에선 <script> 전역) 주입
globalThis.ASSETS = require("./assets.js");
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
