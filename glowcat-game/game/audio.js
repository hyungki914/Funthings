// audio.js — 『잊혀진 발자국』(지로 Ziro) WebAudio 합성 사운드 모듈
// 외부 음원 파일 0 — 전부 오실레이터/노이즈 합성. (10_build_plan §2-4)
// 미스터리·서스펜스, 잔잔한 톤. 브라우저 자동재생 정책 대응(첫 제스처 후 resume).
//
// 안전 규약:
//  - window/AudioContext 참조는 함수 내부에서만. 모듈 로드 시 즉시 실행 금지.
//  - AudioContext 미지원/예외 시 무음으로 안전 폴백(throw 금지).
//  - ambient/drone/heartbeat는 토글 시 이전 노드/타이머를 반드시 정리(중복 생성 방지·누수 방지).
'use strict';

// ---- 볼륨 상수 (과하지 않게) ----
const MASTER_VOL = 0.3;    // 마스터 기본 게인
const AMBIENT_VOL = 0.05;  // 앰비언트 패드(아주 작게)

// ---- 모듈 내부 상태 (싱글톤) ----
// 모든 라이브 노드/타이머 핸들을 여기 모아 정리 누수를 방지한다.
const S = {
  ctx: null,          // AudioContext
  master: null,       // 마스터 GainNode
  muted: false,
  ambientNodes: null, // { oscs:[], gain, filter, lfo? }
  droneNodes: null,   // { osc, sub, noise, gain, filter }
  droneLevel: 0,
  heart: { timer: null, bpm: 0 }, // setTimeout 핸들 + 현재 bpm
};

// ---------------------------------------------------------------------------
// 내부 헬퍼 — 전부 폴백 안전(throw 금지)
// ---------------------------------------------------------------------------

// AudioContext 생성자 조회 (브라우저에서만 존재). 없으면 null.
function getCtor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

// 컨텍스트가 살아있고 사용 가능한지.
function ready() {
  return !!(S.ctx && S.master && S.ctx.state !== 'closed');
}

// 현재 시각(초). 컨텍스트 없으면 0.
function now() {
  return S.ctx ? S.ctx.currentTime : 0;
}

// 음소거 반영한 마스터 목표 게인.
function masterTarget() {
  return S.muted ? 0 : MASTER_VOL;
}

// 화이트노이즈 1초 버퍼 생성(짧은 SFX/드론 거칠기용). 실패 시 null.
function makeNoiseBuffer() {
  if (!S.ctx) return null;
  try {
    const len = Math.floor(S.ctx.sampleRate); // 1초
    const buf = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  } catch (e) {
    return null;
  }
}

// 게인 노드를 t0~t1에 걸쳐 부드럽게 변경(클릭 방지). 안전 가드 포함.
function ramp(param, value, t0, dur) {
  try {
    param.cancelScheduledValues(t0);
    param.setValueAtTime(param.value, t0);
    param.linearRampToValueAtTime(value, t0 + dur);
  } catch (e) { /* no-op */ }
}

// 노드 배열/단일 노드를 안전하게 정지·해제.
function stopNode(node, at) {
  if (!node) return;
  try {
    if (typeof node.stop === 'function') node.stop(at);
  } catch (e) { /* 이미 정지됨 등 */ }
  try {
    node.disconnect();
  } catch (e) { /* no-op */ }
}

// 여러 노드를 한 번에 정지.
function stopAll(nodes, at) {
  if (!nodes) return;
  for (let i = 0; i < nodes.length; i++) stopNode(nodes[i], at);
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

// AudioContext 생성(있으면 재사용). 사용자 제스처 핸들러에서 호출 → resume().
function init() {
  try {
    if (!S.ctx) {
      const Ctor = getCtor();
      if (!Ctor) return; // 미지원 → 무음 폴백
      S.ctx = new Ctor();
      S.master = S.ctx.createGain();
      S.master.gain.value = masterTarget();
      S.master.connect(S.ctx.destination);
    }
    // 자동재생 정책: 제스처 컨텍스트에서 resume.
    if (S.ctx.state === 'suspended' && typeof S.ctx.resume === 'function') {
      S.ctx.resume().catch(function () { /* 무시 */ });
    }
  } catch (e) {
    // 생성 실패 → 전체 무음 폴백
    S.ctx = null;
    S.master = null;
  }
}

// 마스터 게인 0/기본 토글.
function setMuted(flag) {
  S.muted = !!flag;
  if (!ready()) return;
  ramp(S.master.gain, masterTarget(), now(), 0.05);
}

function toggleMute() {
  setMuted(!S.muted);
  return S.muted;
}

// 잔잔한 패드: 저음 사인/삼각 디튠 2~3개 + 로우패스. 루프 대신 지속 오실레이터.
function ambient(on) {
  if (!ready()) return;

  // 항상 이전 것 먼저 정지(중복 생성 방지).
  if (S.ambientNodes) {
    const a = S.ambientNodes;
    const t = now();
    ramp(a.gain.gain, 0, t, 0.6);            // 부드럽게 페이드아웃
    stopAll(a.oscs, t + 0.7);
    stopNode(a.lfo, t + 0.7);
    stopNode(a.filter, t + 0.7);
    stopNode(a.gain, t + 0.7);
    S.ambientNodes = null;
  }
  if (!on) return;

  try {
    const t = now();
    const gain = S.ctx.createGain();
    gain.gain.value = 0;
    const filter = S.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;            // 따뜻하고 어두운 패드
    filter.Q.value = 0.6;

    // 저음역 디튠 보이싱(루트/5도/옥타브 살짝 어긋나게).
    const voices = [
      { f: 110.0, type: 'sine',     det: -4 }, // A2
      { f: 164.8, type: 'triangle', det: +5 }, // E3 (5도)
      { f: 220.0, type: 'sine',     det: -2 }, // A3 (옥타브)
    ];
    const oscs = [];
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      const o = S.ctx.createOscillator();
      o.type = v.type;
      o.frequency.value = v.f;
      try { o.detune.value = v.det; } catch (e) { /* 일부 환경 */ }
      o.connect(filter);
      o.start(t);
      oscs.push(o);
    }

    // 아주 느린 LFO로 필터 컷오프를 미세하게 흔들어 '숨쉬는' 느낌(서스펜스).
    let lfo = null;
    try {
      lfo = S.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07;            // ~14초 주기
      const lfoGain = S.ctx.createGain();
      lfoGain.gain.value = 90;               // ±90Hz 흔들림
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(t);
      // lfoGain은 lfo와 운명을 같이하므로 별도 추적 불필요(disconnect는 filter 해제 시 정리됨).
    } catch (e) {
      lfo = null;
    }

    filter.connect(gain);
    gain.connect(S.master);
    ramp(gain.gain, AMBIENT_VOL, t, 2.0);    // 천천히 페이드인

    S.ambientNodes = { oscs: oscs, gain: gain, filter: filter, lfo: lfo };
  } catch (e) {
    S.ambientNodes = null;
  }
}

// 기억 조각 획득: 맑은 종소리(사인 아르페지오 + 짧은 감쇠 엔벨로프).
function chime() {
  if (!ready()) return;
  try {
    const t = now();
    // A장조 계열 맑은 3음 아르페지오 (A5, C#6, E6).
    const notes = [880.0, 1108.7, 1318.5];
    const step = 0.10;     // 음 간격
    for (let i = 0; i < notes.length; i++) {
      const start = t + i * step;
      const o = S.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = notes[i];
      const g = S.ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.16, start + 0.01); // 빠른 어택
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9); // 종처럼 길게 감쇠
      o.connect(g);
      g.connect(S.master);
      o.start(start);
      o.stop(start + 1.0); // 끝나면 자동 해제(누수 방지)
    }
  } catch (e) { /* 무음 폴백 */ }
}

// 적 근접/위험: level(0~1) 비례 저음 드론 볼륨/거칠기. 0이면 페이드아웃.
function drone(level) {
  if (!ready()) return;
  let lv = (typeof level === 'number' && isFinite(level)) ? level : 0;
  if (lv < 0) lv = 0;
  if (lv > 1) lv = 1;
  S.droneLevel = lv;

  try {
    const t = now();

    // level<=0 → 페이드아웃 후 정지.
    if (lv <= 0.0001) {
      if (S.droneNodes) {
        const d = S.droneNodes;
        ramp(d.gain.gain, 0, t, 0.8);
        stopNode(d.osc, t + 1.0);
        stopNode(d.sub, t + 1.0);
        stopNode(d.noise, t + 1.0);
        stopNode(d.filter, t + 1.0);
        stopNode(d.gain, t + 1.0);
        S.droneNodes = null;
      }
      return;
    }

    // 아직 없으면 한 번만 생성(중복 생성 방지). 이후엔 파라미터만 갱신.
    if (!S.droneNodes) {
      const gain = S.ctx.createGain();
      gain.gain.value = 0;

      const filter = S.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      filter.Q.value = 1.0;

      const osc = S.ctx.createOscillator();
      osc.type = 'sawtooth';        // 거친 배음
      osc.frequency.value = 55;     // A1
      const sub = S.ctx.createOscillator();
      sub.type = 'sine';            // 묵직한 서브
      sub.frequency.value = 27.5;   // A0
      osc.connect(filter);
      sub.connect(filter);

      // 노이즈 한 줌으로 '거칠기' 부여(level로 양 조절).
      let noise = null;
      const noiseGain = S.ctx.createGain();
      noiseGain.gain.value = 0;
      const buf = makeNoiseBuffer();
      if (buf) {
        noise = S.ctx.createBufferSource();
        noise.buffer = buf;
        noise.loop = true;
        const nf = S.ctx.createBiquadFilter();
        nf.type = 'lowpass';
        nf.frequency.value = 400;
        noise.connect(nf);
        nf.connect(noiseGain);
        noiseGain.connect(gain);
        noise.start(t);
      }

      filter.connect(gain);
      gain.connect(S.master);
      osc.start(t);
      sub.start(t);

      S.droneNodes = {
        osc: osc, sub: sub, noise: noise,
        filter: filter, gain: gain, noiseGain: noiseGain,
      };
    }

    // level에 비례해 볼륨/거칠기/밝기 갱신(부드럽게).
    const d = S.droneNodes;
    ramp(d.gain.gain, 0.04 + 0.16 * lv, t, 0.4);     // 볼륨
    if (d.noiseGain) ramp(d.noiseGain.gain, 0.06 * lv, t, 0.4); // 거칠기
    ramp(d.filter.frequency, 180 + 260 * lv, t, 0.4); // 밝기(긴장↑)
  } catch (e) {
    S.droneNodes = null;
  }
}

// 한 번의 'lub-dub' 펄스 2타를 즉시 스케줄(저음 사인 + 빠른 감쇠).
function heartbeatPulse() {
  if (!ready()) return;
  try {
    const t = now();
    // lub(강) → dub(약), 약 0.16초 간격.
    const beats = [
      { at: 0.0,  freq: 55, peak: 0.22 },
      { at: 0.16, freq: 48, peak: 0.15 },
    ];
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const start = t + b.at;
      const o = S.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(b.freq * 1.6, start);
      o.frequency.exponentialRampToValueAtTime(b.freq, start + 0.06); // 살짝 떨어지는 '쿵'
      const g = S.ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(b.peak, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      o.connect(g);
      g.connect(S.master);
      o.start(start);
      o.stop(start + 0.3); // 자동 해제
    }
  } catch (e) { /* 무음 폴백 */ }
}

// 저(低)기억 심장박동: bpm으로 'lub-dub'를 반복 스케줄. bpm=0이면 정지.
function heartbeat(bpm) {
  // 항상 이전 타이머 정리(중복/누수 방지).
  if (S.heart.timer !== null) {
    clearTimeout(S.heart.timer);
    S.heart.timer = null;
  }
  const rate = (typeof bpm === 'number' && isFinite(bpm)) ? bpm : 0;
  S.heart.bpm = rate;

  if (rate <= 0) return;      // 정지
  if (!ready()) return;       // 컨텍스트 없으면 무음(상태만 보관)

  const periodMs = Math.max(250, 60000 / rate); // 과도한 빈도 방지(상한 240bpm)

  const loop = function () {
    // 정지/뮤트 후 잔여 콜백 안전 처리.
    if (S.heart.bpm <= 0) { S.heart.timer = null; return; }
    heartbeatPulse();
    // bpm이 도중에 바뀌면 다음 주기에 반영.
    const p = Math.max(250, 60000 / S.heart.bpm);
    S.heart.timer = setTimeout(loop, p);
  };

  heartbeatPulse();                          // 즉시 첫 박동
  S.heart.timer = setTimeout(loop, periodMs);
}

// 단발 효과음. name: 'contact' | 'setback' | 'step'.
function sfx(name) {
  if (!ready()) return;
  try {
    const t = now();

    if (name === 'contact') {
      // 피격: 짧은 노이즈 버스트 + 다운피치 톤.
      const buf = makeNoiseBuffer();
      if (buf) {
        const n = S.ctx.createBufferSource();
        n.buffer = buf;
        const nf = S.ctx.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.setValueAtTime(900, t);
        nf.frequency.exponentialRampToValueAtTime(200, t + 0.18); // 다운피치
        const ng = S.ctx.createGain();
        ng.gain.setValueAtTime(0.25, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        n.connect(nf); nf.connect(ng); ng.connect(S.master);
        n.start(t);
        n.stop(t + 0.22);
      }
      // 살짝 깔리는 톤으로 충격감 보강.
      const o = S.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
      const g = S.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(S.master);
      o.start(t); o.stop(t + 0.22);

    } else if (name === 'setback') {
      // 후퇴: 저음 역(reverse)스윕 느낌 — 낮은 데서 차오르다 뚝.
      const o = S.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(40, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.7); // 상승 스윕
      const filter = S.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, t);
      filter.frequency.exponentialRampToValueAtTime(900, t + 0.7);
      const g = S.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.6);  // 차오름(reverse swell)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.78); // 급정지
      o.connect(filter); filter.connect(g); g.connect(S.master);
      o.start(t); o.stop(t + 0.85);

    } else if (name === 'step') {
      // 발소리: 아주 약한 클릭(짧은 노이즈 핑).
      const buf = makeNoiseBuffer();
      if (buf) {
        const n = S.ctx.createBufferSource();
        n.buffer = buf;
        const nf = S.ctx.createBiquadFilter();
        nf.type = 'lowpass';
        nf.frequency.value = 1200;
        const ng = S.ctx.createGain();
        ng.gain.setValueAtTime(0.05, t);  // 아주 약하게
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        n.connect(nf); nf.connect(ng); ng.connect(S.master);
        n.start(t);
        n.stop(t + 0.06);
      }
    }
    // 알 수 없는 name → 무음(throw 금지).
  } catch (e) { /* 무음 폴백 */ }
}

const Audio2 = {
  init: init,
  setMuted: setMuted,
  toggleMute: toggleMute,
  ambient: ambient,
  chime: chime,
  drone: drone,
  heartbeat: heartbeat,
  sfx: sfx,
};

if (typeof window !== 'undefined') window.Audio2 = Audio2;
