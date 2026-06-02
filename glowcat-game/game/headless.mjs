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

// 스텁
const ctx = new Proxy({}, {
  get(_, p) { if (p === "measureText") return () => ({ width: 12 }); if (p === "canvas") return fakeCanvas; return () => {}; },
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
globalThis.performance = { now: () => Date.now() };

// main.js 로드(즉시 IIFE 실행 → 핸들러 등록 + 첫 rAF 캡처)
const code = readFileSync(new URL("./main.js", import.meta.url), "utf8");
(0, eval)(code);

function fire(type, ev) { (winHandlers[type] || []).forEach(fn => fn(ev)); }
const ev = (key) => ({ key, preventDefault() {} });

// 시작(타이틀→플레이)
if (cvHandlers.mousedown) cvHandlers.mousedown();
fire("keydown", ev("a")); // 한 번 firstGesture(once) 소모 + 이동 시작

let t = 1000, errors = 0, frames = 0;
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
    t += 16;
    if (theFrame) theFrame(t);
    frames++;
  }
} catch (e) { errors++; console.error("RUNTIME ERROR:", e && e.stack || e); }

if (errors === 0) console.log(`HEADLESS OK — main.js ${frames} 프레임 무예외 구동(이동·조사·힌트·은신·음소거 입력 포함).`);
else { console.log("HEADLESS FAILED"); process.exit(1); }
