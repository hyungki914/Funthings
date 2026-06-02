// ziro_standalone.html 안의 인라인 <script>들을 브라우저와 동일한 '전역 공유 스코프'로 합쳐
// 실행해 런타임/이름충돌 없이 도는지 검증(DOM 스텁). 보낼 산출물의 무결성 확인용.
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("./ziro_standalone.html", import.meta.url), "utf8");

// 인라인 스크립트 추출(외부 src 없음)
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1].replace(/<\\\/script>/g, "</script>"));
if (blocks.length < 6) { console.log("FAIL: 스크립트 블록", blocks.length, "개"); process.exit(1); }

// DOM/Canvas/Image/rAF 스텁
const ctx = new Proxy({}, { get(_, p) { if (p === "measureText") return () => ({ width: 12 }); if (p === "canvas") return fakeCanvas; return () => {}; }, set() { return true; } });
const cvHandlers = {};
const fakeCanvas = { width: 1056, height: 672, getContext: () => ctx, addEventListener: (t, fn) => { cvHandlers[t] = fn; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1056, height: 672 }) };
globalThis.window = globalThis;
globalThis.document = { getElementById: () => fakeCanvas };
class FakeImage { set src(v) { this.width = 32; this.height = 34; if (this.onload) this.onload(); } }
globalThis.Image = FakeImage;
let theFrame = null;
globalThis.requestAnimationFrame = (fn) => { theFrame = fn; return 1; };
const winHandlers = {};
globalThis.addEventListener = (t, fn) => { (winHandlers[t] = winHandlers[t] || []).push(fn); };
globalThis.performance = { now: () => Date.now() };
globalThis.module = undefined; // 브라우저처럼 module 미정의

// 브라우저와 동일: 모든 인라인 스크립트를 '하나의 전역 스코프'에서 순서대로 평가
try { (0, eval)(blocks.join("\n;\n")); }
catch (e) { console.log("FAIL: 합본 평가 오류:", e && e.message); process.exit(1); }

const fire = (type, ev) => (winHandlers[type] || []).forEach(fn => fn(ev));
const ev = (key) => ({ key, preventDefault() {} });
if (cvHandlers.mousedown) cvHandlers.mousedown();   // 시작
fire("keydown", ev("a"));
let t = 1000, err = 0, n = 0;
try {
  for (let i = 0; i < 400; i++) {
    if (i % 30 === 0) fire("keydown", ev(["d","s","a","w"][(i/30)%4|0]));
    if (i % 30 === 18) fire("keyup", ev(["d","s","a","w"][((i-18)/30)%4|0]));
    if (i % 17 === 0) { fire("keydown", ev("e")); fire("keyup", ev("e")); }
    if (i % 50 < 8) fire("keydown", ev("q")); else fire("keyup", ev("q"));
    if (i % 70 === 0) { fire("keydown", ev("l")); fire("keyup", ev("l")); }
    if (i % 90 === 0) { fire("keydown", ev("Tab")); fire("keyup", ev("Tab")); }
    t += 16; if (theFrame) theFrame(t); n++;
  }
} catch (e) { err++; console.log("FAIL: 런타임:", e && e.stack || e); }
console.log(err ? "FAIL" : `STANDALONE OK — 인라인 스크립트 ${blocks.length}블록, ${n}프레임 무예외 구동(전역 공유 스코프).`);
process.exit(err ? 1 : 0);
