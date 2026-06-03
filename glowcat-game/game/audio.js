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
  // ---- BGM 음악 엔진 상태 ----
  // 동시에 두 보이스(이전/새 테마)를 가질 수 있어 크로스페이드 시 둘 다 추적한다.
  music: {
    theme: null,        // 현재 활성 테마 이름
    voices: [],         // [{ theme, def, bus(GainNode), timer, scheduled:[], step, nextTime, fading }]
  },
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

    } else if (name === 'hover') {
      // UI 호버: 짧고 맑은 고음 핑(triangle).
      const o = S.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(1320, t + 0.05);
      const g = S.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(S.master);
      o.start(t); o.stop(t + 0.1);

    } else if (name === 'select') {
      // UI 결정: 두 음 상행(확정감). sine, 부드럽게.
      const freqs = [660, 990];
      freqs.forEach((f, i) => {
        const o = S.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t + i * 0.06);
        const g = S.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.09, t + i * 0.06 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.16);
        o.connect(g); g.connect(S.master);
        o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.18);
      });
    }
    // 알 수 없는 name → 무음(throw 금지).
  } catch (e) { /* 무음 폴백 */ }
}

// ---------------------------------------------------------------------------
// BGM 음악 엔진 — 멜로디가 흐르는 스테이지별 루프 BGM
//
// 설계:
//  - 룩어헤드 스케줄러: setInterval(LOOKAHEAD_MS)로 깨어나 SCHEDULE_AHEAD초
//    앞 구간의 노트를 ctx.currentTime 기준 절대 시각으로 예약 → 타이밍 드리프트 방지.
//  - 각 테마는 스케일/진행/음색/템포를 배열·상수로 정의해 갈아끼우는 구조.
//  - 노트는 ADSR 비슷한 짧은 게인 엔벨로프 + 끝나면 osc.stop()으로 자동 해제(누수 방지).
//  - 테마 전환은 크로스페이드(이전 voice 페이드아웃→정리, 새 voice 페이드인).
//  - 정지·전환 시 interval과 예약된 노드를 반드시 정리.
//  - 음역/볼륨은 ambient/drone과 겹쳐도 뭉개지지 않게 분리(멜로디 중고음, 패드 저음·소volume).
// ---------------------------------------------------------------------------

const MUSIC_MELODY_VOL = 0.075; // 멜로디 노트 피크(0.06~0.09 범위)
const MUSIC_PAD_VOL = 0.035;    // 패드(멜로디보다 작게)
const MUSIC_BASS_VOL = 0.05;    // 저음 드론/펄스
const LOOKAHEAD_MS = 120;       // 스케줄러 깨어나는 주기
const SCHEDULE_AHEAD = 0.9;     // 미리 예약할 구간(초)
const MUSIC_FADE = 1.6;         // 크로스페이드 시간(초)

// 평균율 주파수 헬퍼: A4=440 기준 반음(semitone) 오프셋 → Hz.
function midiHz(semisFromA4) {
  return 440 * Math.pow(2, semisFromA4 / 12);
}

// 테마 정의. 각 테마는 한 '스텝'(시간 격자)마다 어떤 노트를 칠지 패턴 배열로 기술한다.
// patterns의 각 원소: { t: 스텝오프셋, note: 반음(A4=0), dur: 길이초, vol: 0~1, voice: 'mel'|'pad'|'bass', type: 파형 }
// stepDur(초)와 steps(루프 총 스텝수)로 루프 길이를 결정.
//
// 음정 표기(A4=0 기준 반음): A2=-24 A3=-12 C4=-9 D4=-7 E4=-5 F4=-4 G4=-2 A4=0
//   B4=2 C5=3 D5=5 E5=7 F5=8 G5=10 A5=12 ...  (단음계/도리안 위주)
const MUSIC_THEMES = {
  // intro: 매우 희소·저음·거의 앰비언트. 드문 단음 + 낮은 드론. 불안/적막.
  intro: {
    stepDur: 0.95,
    steps: 16,
    melType: 'sine',
    padType: 'sine',
    bassType: 'sine',
    melVol: 0.85,
    padVol: 0.7,
    // A 단조 분위기, 거의 정적. 낮은 드론 패드가 길게 깔리고 멜로디는 드물게.
    patterns: [
      // 길게 깔리는 저음 드론(루트 A2, 5도 E3) — 루프마다 갱신.
      { t: 0,  note: -24, dur: 8.0, vol: 0.9, voice: 'bass', type: 'sine' },     // A2
      { t: 0,  note: -17, dur: 8.0, vol: 0.55, voice: 'pad', type: 'sine' },     // E3
      { t: 8,  note: -24, dur: 7.0, vol: 0.9, voice: 'bass', type: 'sine' },
      { t: 8,  note: -22, dur: 7.0, vol: 0.5, voice: 'pad', type: 'sine' },      // B2(단2도 암시 긴장)
      // 드문 단음(높지 않게). 적막을 깨는 한두 점.
      { t: 3,  note: 0,   dur: 2.2, vol: 0.6, voice: 'mel', type: 'sine' },      // A4
      { t: 10, note: 3,   dur: 2.0, vol: 0.55, voice: 'mel', type: 'sine' },     // C5
      { t: 13, note: -2,  dur: 2.6, vol: 0.5, voice: 'mel', type: 'sine' },      // G4
    ],
  },

  // room(챕터1 방): A 단조. 부드러운 아르페지오 + 따뜻하지만 쓸쓸한 멜로디 + 낮은 패드. 잔잔.
  room: {
    stepDur: 0.34,
    steps: 32,
    melType: 'triangle',
    padType: 'sine',
    bassType: 'sine',
    melVol: 1.0,
    padVol: 0.8,
    // 흐르는 8분음 아르페지오(Am - F - C - G 풍 진행)를 한 마디 8스텝씩.
    patterns: [
      // 마디1: Am (A C E A) 아르페지오
      { t: 0,  note: -12, dur: 0.5, vol: 0.7, voice: 'mel', type: 'triangle' },  // A3
      { t: 2,  note: -9,  dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // C4
      { t: 4,  note: -5,  dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // E4
      { t: 6,  note: 0,   dur: 0.7, vol: 0.7, voice: 'mel', type: 'triangle' },  // A4
      // 마디2: F (F A C F)
      { t: 8,  note: -16, dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // F3
      { t: 10, note: -12, dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // A3
      { t: 12, note: -9,  dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // C4
      { t: 14, note: -4,  dur: 0.7, vol: 0.7, voice: 'mel', type: 'triangle' },  // F4
      // 마디3: C (C E G C) — 살짝 밝아짐
      { t: 16, note: -9,  dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // C4
      { t: 18, note: -5,  dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // E4
      { t: 20, note: -2,  dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // G4
      { t: 22, note: 3,   dur: 0.7, vol: 0.7, voice: 'mel', type: 'triangle' },  // C5
      // 마디4: G (G B D B) — 끝에 단2도 긴장(쓸쓸함)
      { t: 24, note: -2,  dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // G4
      { t: 26, note: 2,   dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // B4
      { t: 28, note: 5,   dur: 0.5, vol: 0.6, voice: 'mel', type: 'triangle' },  // D5
      { t: 30, note: 1,   dur: 0.7, vol: 0.5, voice: 'mel', type: 'triangle' },  // A#4(반음 긴장)
      // 낮은 패드(코드 루트, 마디마다) — 길게.
      { t: 0,  note: -24, dur: 2.8, vol: 0.5, voice: 'pad', type: 'sine' },      // A2
      { t: 8,  note: -28, dur: 2.8, vol: 0.5, voice: 'pad', type: 'sine' },      // F2
      { t: 16, note: -33, dur: 2.8, vol: 0.5, voice: 'pad', type: 'sine' },      // C2
      { t: 24, note: -26, dur: 2.8, vol: 0.5, voice: 'pad', type: 'sine' },      // G2
      // 아주 낮은 서브 드론(전체 깔개)
      { t: 0,  note: -36, dur: 11.0, vol: 0.45, voice: 'bass', type: 'sine' },   // A1
      // [B변주] 마디2·4 끝 옥타브 응답(여리게) — 단조로움 완화, 그리움 강조
      { t: 14, note: 8,  dur: 0.5, vol: 0.35, voice: 'mel', type: 'triangle' },  // F5
      { t: 31, note: 7,  dur: 0.6, vol: 0.30, voice: 'mel', type: 'triangle' },  // E5
    ],
  },

  // house(챕터2 집): D 단조, 약간 더 긴장. 낮은 펄스/맥동 추가, 템포 살짝↑.
  house: {
    stepDur: 0.30,
    steps: 32,
    melType: 'triangle',
    padType: 'sine',
    bassType: 'sine',
    melVol: 1.0,
    padVol: 0.75,
    // D 단조(Dm - Bb - Gm - A 풍). 8분 펄스 베이스로 맥동감.
    patterns: [
      // 멜로디(D 단조 + 도리안 색채)
      { t: 0,  note: 5,   dur: 0.45, vol: 0.7, voice: 'mel', type: 'triangle' }, // D5
      { t: 3,  note: 8,   dur: 0.4,  vol: 0.55, voice: 'mel', type: 'triangle' },// F5
      { t: 5,  note: 7,   dur: 0.45, vol: 0.6, voice: 'mel', type: 'triangle' }, // E5(긴장)
      { t: 8,  note: 5,   dur: 0.5,  vol: 0.65, voice: 'mel', type: 'triangle' },// D5
      { t: 11, note: 2,   dur: 0.4,  vol: 0.55, voice: 'mel', type: 'triangle' },// B4
      { t: 13, note: 3,   dur: 0.45, vol: 0.6, voice: 'mel', type: 'triangle' }, // C5
      { t: 16, note: -2,  dur: 0.5,  vol: 0.6, voice: 'mel', type: 'triangle' }, // G4
      { t: 19, note: 0,   dur: 0.4,  vol: 0.55, voice: 'mel', type: 'triangle' },// A4
      { t: 21, note: 2,   dur: 0.45, vol: 0.55, voice: 'mel', type: 'triangle' },// B4
      { t: 24, note: 0,   dur: 0.5,  vol: 0.6, voice: 'mel', type: 'triangle' }, // A4
      { t: 27, note: 4,   dur: 0.4,  vol: 0.55, voice: 'mel', type: 'triangle' },// C#5(화성단음계 이끔음 긴장)
      { t: 29, note: 5,   dur: 0.6,  vol: 0.65, voice: 'mel', type: 'triangle' },// D5
      // 낮은 펄스(맥동) 베이스 — 8분마다 짧게 끊어 두근거림.
      { t: 0,  note: -19, dur: 0.22, vol: 0.7, voice: 'bass', type: 'sine' },    // D3
      { t: 4,  note: -19, dur: 0.22, vol: 0.55, voice: 'bass', type: 'sine' },
      { t: 8,  note: -19, dur: 0.22, vol: 0.65, voice: 'bass', type: 'sine' },
      { t: 12, note: -19, dur: 0.22, vol: 0.5, voice: 'bass', type: 'sine' },
      { t: 16, note: -22, dur: 0.22, vol: 0.65, voice: 'bass', type: 'sine' },   // Bb2
      { t: 20, note: -22, dur: 0.22, vol: 0.5, voice: 'bass', type: 'sine' },
      { t: 24, note: -24, dur: 0.22, vol: 0.65, voice: 'bass', type: 'sine' },   // A2
      { t: 28, note: -24, dur: 0.22, vol: 0.55, voice: 'bass', type: 'sine' },
      // 패드(코드 루트, 마디마다)
      { t: 0,  note: -31, dur: 2.6, vol: 0.5, voice: 'pad', type: 'sine' },      // D2
      { t: 8,  note: -34, dur: 2.6, vol: 0.5, voice: 'pad', type: 'sine' },      // Bb1
      { t: 16, note: -38, dur: 2.6, vol: 0.5, voice: 'pad', type: 'sine' },      // G1
      { t: 24, note: -36, dur: 2.6, vol: 0.5, voice: 'pad', type: 'sine' },      // A1
      // [B변주] 불안 가속 16분 2연타 + 이끔음 선행
      { t: 22, note: 5,  dur: 0.18, vol: 0.5, voice: 'mel', type: 'triangle' },  // D5
      { t: 23, note: 7,  dur: 0.22, vol: 0.5, voice: 'mel', type: 'triangle' },  // E5
      { t: 26, note: 4,  dur: 0.3,  vol: 0.5, voice: 'mel', type: 'triangle' },  // C#5 이끔음
    ],
  },

  // park(챕터3 공원): 더 넓고 멜랑콜리. 넓은 음정·여백 많은 멜로디, 약간 밝되 시린 느낌.
  park: {
    stepDur: 0.42,
    steps: 32,
    melType: 'sine',
    padType: 'triangle',
    bassType: 'sine',
    melVol: 0.95,
    padVol: 0.7,
    // E 도리안 느낌(밝되 시린). 넓은 도약 + 긴 여백.
    patterns: [
      // 멜로디: 넓게 벌어진 음정, 쉼이 많음.
      { t: 0,  note: 7,   dur: 1.4, vol: 0.65, voice: 'mel', type: 'sine' },     // E5
      { t: 4,  note: 14,  dur: 1.2, vol: 0.6, voice: 'mel', type: 'sine' },      // F#6 영역(넓은 도약)
      { t: 8,  note: 9,   dur: 1.6, vol: 0.6, voice: 'mel', type: 'sine' },      // F#5
      { t: 14, note: 5,   dur: 1.4, vol: 0.55, voice: 'mel', type: 'sine' },     // D5
      { t: 18, note: 12,  dur: 1.2, vol: 0.6, voice: 'mel', type: 'sine' },      // A5
      { t: 22, note: 16,  dur: 1.0, vol: 0.55, voice: 'mel', type: 'sine' },     // C#6(도리안 6도, 시린 밝음)
      { t: 26, note: 7,   dur: 1.8, vol: 0.6, voice: 'mel', type: 'sine' },      // E5
      // 높은 반짝임(가끔, 여백 채우기) — 감5도 암시로 긴장 한 점.
      { t: 11, note: 18,  dur: 0.8, vol: 0.4, voice: 'mel', type: 'sine' },      // D#6
      { t: 30, note: 13,  dur: 1.0, vol: 0.4, voice: 'mel', type: 'sine' },      // A#5(감5도 긴장)
      // 패드(넓은 보이싱, 길게)
      { t: 0,  note: -17, dur: 7.0, vol: 0.45, voice: 'pad', type: 'triangle' }, // E3
      { t: 0,  note: -10, dur: 7.0, vol: 0.35, voice: 'pad', type: 'triangle' }, // B3
      { t: 16, note: -15, dur: 6.5, vol: 0.45, voice: 'pad', type: 'triangle' }, // F#3
      { t: 16, note: -8,  dur: 6.5, vol: 0.35, voice: 'pad', type: 'triangle' }, // C#4
      // 아주 낮은 서브
      { t: 0,  note: -29, dur: 14.0, vol: 0.4, voice: 'bass', type: 'sine' },    // E1
      // [B변주] 메아리 모티프(주제 음 4스텝 뒤 옥타브 아래 반향, 공간감)
      { t: 4,  note: -5, dur: 1.2, vol: 0.28, voice: 'mel', type: 'sine' },      // E4
      { t: 24, note: 0,  dur: 1.4, vol: 0.26, voice: 'mel', type: 'sine' },      // A4
    ],
  },

  // haru(2층·하루의 방): 가장 무겁고 사적인 슬픔. 느린 하행 단음(탄식) + 멈춘 오르골 파편 + 어두운 패드.
  haru: {
    stepDur: 0.6, steps: 24, melType: 'sine', padType: 'sine', bassType: 'sine', melVol: 0.85, padVol: 0.7,
    patterns: [
      // 느린 하행(D 단조 탄식): D5 → C5 → A4 → F4 → G4(풀리지 않는 반음)
      { t: 0,  note: 5,   dur: 1.6, vol: 0.6,  voice: 'mel', type: 'sine' },     // D5
      { t: 4,  note: 3,   dur: 1.6, vol: 0.55, voice: 'mel', type: 'sine' },     // C5
      { t: 8,  note: 0,   dur: 1.8, vol: 0.55, voice: 'mel', type: 'sine' },     // A4
      { t: 13, note: -4,  dur: 2.2, vol: 0.5,  voice: 'mel', type: 'sine' },     // F4
      { t: 18, note: -2,  dur: 1.4, vol: 0.45, voice: 'mel', type: 'sine' },     // G4
      // 멀리서 깨진 오르골 파편(높고 여리게)
      { t: 6,  note: 16,  dur: 0.6, vol: 0.24, voice: 'mel', type: 'triangle' }, // C#6
      { t: 20, note: 12,  dur: 0.7, vol: 0.22, voice: 'mel', type: 'triangle' }, // A5
      // 어두운 패드(Dm 루트+단3도, 쳐지는 하강)
      { t: 0,  note: -19, dur: 7.0, vol: 0.5,  voice: 'pad', type: 'sine' },     // D3
      { t: 0,  note: -16, dur: 7.0, vol: 0.35, voice: 'pad', type: 'sine' },     // F3
      { t: 12, note: -21, dur: 6.5, vol: 0.5,  voice: 'pad', type: 'sine' },     // C3
      // 아주 낮은 서브 드론
      { t: 0,  note: -31, dur: 15.0, vol: 0.45, voice: 'bass', type: 'sine' },   // D2
      // [B변주] 멈춘 오르골 파편 한 점(더 멀리·여리게) — 잔향 강화
      { t: 15, note: 19, dur: 0.5, vol: 0.18, voice: 'mel', type: 'triangle' },  // F6
    ],
  },

  // town(집 근처·길거리·상가): 거니는 듯 그리운 일상. 따뜻하되 시린 C장조 산책 멜로디.
  town: {
    stepDur: 0.32, steps: 32, melType: 'triangle', padType: 'sine', bassType: 'sine', melVol: 0.95, padVol: 0.7,
    patterns: [
      // 산책 멜로디(C - Am - F - G 풍)
      { t: 0,  note: 3,   dur: 0.5, vol: 0.65, voice: 'mel', type: 'triangle' }, // C5
      { t: 2,  note: 7,   dur: 0.5, vol: 0.6,  voice: 'mel', type: 'triangle' }, // E5
      { t: 4,  note: 10,  dur: 0.6, vol: 0.6,  voice: 'mel', type: 'triangle' }, // G5
      { t: 7,  note: 7,   dur: 0.5, vol: 0.55, voice: 'mel', type: 'triangle' }, // E5
      { t: 8,  note: 0,   dur: 0.5, vol: 0.6,  voice: 'mel', type: 'triangle' }, // A4
      { t: 10, note: 3,   dur: 0.5, vol: 0.55, voice: 'mel', type: 'triangle' }, // C5
      { t: 12, note: 7,   dur: 0.6, vol: 0.55, voice: 'mel', type: 'triangle' }, // E5
      { t: 15, note: 5,   dur: 0.5, vol: 0.5,  voice: 'mel', type: 'triangle' }, // D5
      { t: 16, note: -4,  dur: 0.5, vol: 0.6,  voice: 'mel', type: 'triangle' }, // F4
      { t: 18, note: 0,   dur: 0.5, vol: 0.55, voice: 'mel', type: 'triangle' }, // A4
      { t: 20, note: 5,   dur: 0.6, vol: 0.55, voice: 'mel', type: 'triangle' }, // D5
      { t: 23, note: 3,   dur: 0.5, vol: 0.5,  voice: 'mel', type: 'triangle' }, // C5
      { t: 24, note: -2,  dur: 0.5, vol: 0.6,  voice: 'mel', type: 'triangle' }, // G4
      { t: 26, note: 2,   dur: 0.5, vol: 0.55, voice: 'mel', type: 'triangle' }, // B4
      { t: 28, note: 7,   dur: 0.6, vol: 0.55, voice: 'mel', type: 'triangle' }, // E5
      { t: 30, note: 9,   dur: 0.7, vol: 0.5,  voice: 'mel', type: 'triangle' }, // F#5(그리운 6도)
      // 부드러운 패드(코드 루트)
      { t: 0,  note: -21, dur: 2.6, vol: 0.45, voice: 'pad', type: 'sine' },     // C3
      { t: 8,  note: -24, dur: 2.6, vol: 0.45, voice: 'pad', type: 'sine' },     // A2
      { t: 16, note: -28, dur: 2.6, vol: 0.45, voice: 'pad', type: 'sine' },     // F2
      { t: 24, note: -26, dur: 2.6, vol: 0.45, voice: 'pad', type: 'sine' },     // G2
      // 낮은 서브
      { t: 0,  note: -33, dur: 11.0, vol: 0.4, voice: 'bass', type: 'sine' },    // C2
      // [B변주] 후반 3도 하모니(동행감) + 베이스 워킹 디딤
      { t: 24, note: -7, dur: 0.5, vol: 0.32, voice: 'mel', type: 'triangle' },  // D4
      { t: 28, note: 3,  dur: 0.6, vol: 0.32, voice: 'mel', type: 'triangle' },  // C5
      { t: 4,  note: -28, dur: 0.4, vol: 0.35, voice: 'bass', type: 'sine' },    // F2 디딤
      { t: 20, note: -26, dur: 0.4, vol: 0.35, voice: 'bass', type: 'sine' },    // G2 디딤
    ],
  },

  // blank(빈자리·엔딩): 가장 텅 빈 공간. 낮은 드론 + 해소 없는 4도 + 멀리서 단 하나의 부름.
  blank: {
    stepDur: 1.1, steps: 16, melType: 'sine', padType: 'sine', bassType: 'sine', melVol: 0.8, padVol: 0.65,
    patterns: [
      { t: 0,  note: -24, dur: 9.0, vol: 0.85, voice: 'bass', type: 'sine' },    // A2
      { t: 0,  note: -19, dur: 9.0, vol: 0.4,  voice: 'pad', type: 'sine' },     // D3(4도 — 해소 없는 공허)
      { t: 8,  note: -24, dur: 8.0, vol: 0.85, voice: 'bass', type: 'sine' },
      { t: 8,  note: -17, dur: 8.0, vol: 0.4,  voice: 'pad', type: 'sine' },     // E3
      // 멀리서 들리는 단 하나의 부름(아주 여리게)
      { t: 5,  note: 0,   dur: 3.0, vol: 0.4,  voice: 'mel', type: 'sine' },     // A4
      { t: 12, note: -5,  dur: 3.4, vol: 0.32, voice: 'mel', type: 'sine' },     // E4(가라앉음)
    ],
  },

  // title: 서정적·기대감. 부드러운 아르페지오(triangle) + 노래하는 메인 훅(sine). C/Am 교차. 12.8s 루프.
  title: {
    stepDur: 0.40, steps: 32, melType: 'sine', padType: 'triangle', bassType: 'sine', melVol: 0.95, padVol: 0.65,
    patterns: [
      { t: 0,  note: 0,  dur: 0.45, vol: 0.34, voice: 'mel', type: 'triangle' },
      { t: 1,  note: 3,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' },
      { t: 2,  note: 7,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' },
      { t: 3,  note: 12, dur: 0.45, vol: 0.28, voice: 'mel', type: 'triangle' },
      { t: 8,  note: -4, dur: 0.45, vol: 0.32, voice: 'mel', type: 'triangle' },
      { t: 9,  note: 0,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' },
      { t: 10, note: 3,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' },
      { t: 11, note: 8,  dur: 0.45, vol: 0.28, voice: 'mel', type: 'triangle' },
      { t: 16, note: 3,  dur: 0.45, vol: 0.32, voice: 'mel', type: 'triangle' },
      { t: 17, note: 7,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' },
      { t: 18, note: 10, dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' },
      { t: 19, note: 15, dur: 0.45, vol: 0.28, voice: 'mel', type: 'triangle' },
      { t: 24, note: 2,  dur: 0.45, vol: 0.32, voice: 'mel', type: 'triangle' },
      { t: 25, note: 5,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' },
      { t: 26, note: 10, dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' },
      { t: 27, note: 14, dur: 0.45, vol: 0.28, voice: 'mel', type: 'triangle' },
      { t: 4,  note: 7,  dur: 1.1, vol: 0.62, voice: 'mel', type: 'sine' },
      { t: 6,  note: 10, dur: 0.9, vol: 0.60, voice: 'mel', type: 'sine' },
      { t: 12, note: 12, dur: 1.4, vol: 0.64, voice: 'mel', type: 'sine' },
      { t: 20, note: 15, dur: 1.0, vol: 0.60, voice: 'mel', type: 'sine' },
      { t: 22, note: 14, dur: 0.9, vol: 0.55, voice: 'mel', type: 'sine' },
      { t: 28, note: 10, dur: 0.7, vol: 0.55, voice: 'mel', type: 'sine' },
      { t: 30, note: 7,  dur: 1.6, vol: 0.52, voice: 'mel', type: 'sine' },
      { t: 0,  note: -9,  dur: 3.0, vol: 0.42, voice: 'pad', type: 'triangle' },
      { t: 0,  note: -5,  dur: 3.0, vol: 0.38, voice: 'pad', type: 'triangle' },
      { t: 8,  note: -4,  dur: 3.0, vol: 0.42, voice: 'pad', type: 'triangle' },
      { t: 8,  note: 0,   dur: 3.0, vol: 0.38, voice: 'pad', type: 'triangle' },
      { t: 16, note: -5,  dur: 3.0, vol: 0.42, voice: 'pad', type: 'triangle' },
      { t: 16, note: -2,  dur: 3.0, vol: 0.38, voice: 'pad', type: 'triangle' },
      { t: 24, note: -7,  dur: 3.0, vol: 0.42, voice: 'pad', type: 'triangle' },
      { t: 24, note: 2,   dur: 3.0, vol: 0.36, voice: 'pad', type: 'triangle' },
      { t: 0,  note: -24, dur: 1.5, vol: 0.6, voice: 'bass', type: 'sine' },
      { t: 4,  note: -29, dur: 1.5, vol: 0.5, voice: 'bass', type: 'sine' },
      { t: 8,  note: -28, dur: 1.5, vol: 0.6, voice: 'bass', type: 'sine' },
      { t: 12, note: -33, dur: 1.5, vol: 0.5, voice: 'bass', type: 'sine' },
      { t: 16, note: -33, dur: 1.5, vol: 0.6, voice: 'bass', type: 'sine' },
      { t: 20, note: -26, dur: 1.5, vol: 0.5, voice: 'bass', type: 'sine' },
      { t: 24, note: -26, dur: 1.5, vol: 0.6, voice: 'bass', type: 'sine' },
      { t: 28, note: -31, dur: 1.7, vol: 0.5, voice: 'bass', type: 'sine' },
    ],
  },

  // memory: 깨달음(회상 몽타주). 잔잔→점층 차오름. F major 상승 모티프. 14.72s 루프.
  memory: {
    stepDur: 0.46, steps: 32, melType: 'triangle', padType: 'sine', bassType: 'sine', melVol: 0.95, padVol: 0.7,
    patterns: [
      { t: 0,  note: 0,  dur: 1.1, vol: 0.48, voice: 'mel', type: 'triangle' },
      { t: 3,  note: 3,  dur: 1.1, vol: 0.50, voice: 'mel', type: 'triangle' },
      { t: 6,  note: 8,  dur: 1.4, vol: 0.55, voice: 'mel', type: 'triangle' },
      { t: 8,  note: 7,  dur: 1.0, vol: 0.55, voice: 'mel', type: 'triangle' },
      { t: 11, note: 10, dur: 1.2, vol: 0.60, voice: 'mel', type: 'triangle' },
      { t: 14, note: 12, dur: 1.4, vol: 0.62, voice: 'mel', type: 'triangle' },
      { t: 16, note: 8,  dur: 1.0, vol: 0.58, voice: 'mel', type: 'triangle' },
      { t: 19, note: 12, dur: 1.1, vol: 0.62, voice: 'mel', type: 'triangle' },
      { t: 22, note: 15, dur: 1.5, vol: 0.68, voice: 'mel', type: 'triangle' },
      { t: 24, note: 12, dur: 1.0, vol: 0.60, voice: 'mel', type: 'triangle' },
      { t: 27, note: 10, dur: 1.0, vol: 0.56, voice: 'mel', type: 'triangle' },
      { t: 29, note: 8,  dur: 1.8, vol: 0.54, voice: 'mel', type: 'triangle' },
      { t: 0,  note: -4, dur: 3.4, vol: 0.40, voice: 'pad', type: 'sine' },
      { t: 0,  note: 0,  dur: 3.4, vol: 0.34, voice: 'pad', type: 'sine' },
      { t: 0,  note: -9, dur: 3.4, vol: 0.30, voice: 'pad', type: 'sine' },
      { t: 8,  note: -5, dur: 3.4, vol: 0.40, voice: 'pad', type: 'sine' },
      { t: 8,  note: -2, dur: 3.4, vol: 0.34, voice: 'pad', type: 'sine' },
      { t: 16, note: -4, dur: 3.4, vol: 0.40, voice: 'pad', type: 'sine' },
      { t: 16, note: 0,  dur: 3.4, vol: 0.34, voice: 'pad', type: 'sine' },
      { t: 24, note: -7, dur: 3.4, vol: 0.40, voice: 'pad', type: 'sine' },
      { t: 24, note: -4, dur: 3.4, vol: 0.34, voice: 'pad', type: 'sine' },
      { t: 0,  note: -28, dur: 2.6, vol: 0.55, voice: 'bass', type: 'sine' },
      { t: 6,  note: -33, dur: 1.2, vol: 0.40, voice: 'bass', type: 'sine' },
      { t: 8,  note: -33, dur: 2.6, vol: 0.55, voice: 'bass', type: 'sine' },
      { t: 16, note: -31, dur: 2.6, vol: 0.55, voice: 'bass', type: 'sine' },
      { t: 24, note: -34, dur: 3.0, vol: 0.55, voice: 'bass', type: 'sine' },
      { t: 0,  note: -40, dur: 15.0, vol: 0.34, voice: 'bass', type: 'sine' },
    ],
  },

  // ending_reunite: 재회 엔딩. 감격·따뜻한 클라이맥스. D major, 루트 D 종지. 14.08s 루프.
  ending_reunite: {
    stepDur: 0.44, steps: 32, melType: 'sine', padType: 'triangle', bassType: 'sine', melVol: 1.0, padVol: 0.72,
    patterns: [
      { t: 0,  note: 9,  dur: 1.0, vol: 0.66, voice: 'mel', type: 'sine' },
      { t: 2,  note: 12, dur: 1.0, vol: 0.68, voice: 'mel', type: 'sine' },
      { t: 4,  note: 17, dur: 1.6, vol: 0.74, voice: 'mel', type: 'sine' },
      { t: 8,  note: 14, dur: 1.0, vol: 0.66, voice: 'mel', type: 'sine' },
      { t: 10, note: 12, dur: 1.0, vol: 0.62, voice: 'mel', type: 'sine' },
      { t: 12, note: 9,  dur: 1.4, vol: 0.60, voice: 'mel', type: 'sine' },
      { t: 16, note: 7,  dur: 1.0, vol: 0.62, voice: 'mel', type: 'sine' },
      { t: 18, note: 9,  dur: 1.0, vol: 0.64, voice: 'mel', type: 'sine' },
      { t: 20, note: 12, dur: 1.0, vol: 0.66, voice: 'mel', type: 'sine' },
      { t: 22, note: 14, dur: 1.4, vol: 0.70, voice: 'mel', type: 'sine' },
      { t: 24, note: 17, dur: 1.0, vol: 0.70, voice: 'mel', type: 'sine' },
      { t: 26, note: 12, dur: 1.0, vol: 0.64, voice: 'mel', type: 'sine' },
      { t: 28, note: 9,  dur: 1.0, vol: 0.60, voice: 'mel', type: 'sine' },
      { t: 30, note: 5,  dur: 2.0, vol: 0.62, voice: 'mel', type: 'sine' },
      { t: 0,  note: -7, dur: 3.2, vol: 0.42, voice: 'pad', type: 'triangle' },
      { t: 0,  note: -3, dur: 3.2, vol: 0.36, voice: 'pad', type: 'triangle' },
      { t: 0,  note: 0,  dur: 3.2, vol: 0.32, voice: 'pad', type: 'triangle' },
      { t: 8,  note: -2, dur: 3.2, vol: 0.42, voice: 'pad', type: 'triangle' },
      { t: 8,  note: 2,  dur: 3.2, vol: 0.36, voice: 'pad', type: 'triangle' },
      { t: 12, note: 0,  dur: 1.6, vol: 0.40, voice: 'pad', type: 'triangle' },
      { t: 12, note: 4,  dur: 1.6, vol: 0.34, voice: 'pad', type: 'triangle' },
      { t: 16, note: -7, dur: 3.2, vol: 0.42, voice: 'pad', type: 'triangle' },
      { t: 16, note: -1, dur: 3.2, vol: 0.36, voice: 'pad', type: 'triangle' },
      { t: 16, note: 2,  dur: 3.2, vol: 0.32, voice: 'pad', type: 'triangle' },
      { t: 24, note: -7, dur: 4.0, vol: 0.44, voice: 'pad', type: 'triangle' },
      { t: 24, note: -3, dur: 4.0, vol: 0.38, voice: 'pad', type: 'triangle' },
      { t: 24, note: 0,  dur: 4.0, vol: 0.34, voice: 'pad', type: 'triangle' },
      { t: 0,  note: -31, dur: 1.6, vol: 0.6, voice: 'bass', type: 'sine' },
      { t: 4,  note: -24, dur: 1.6, vol: 0.5, voice: 'bass', type: 'sine' },
      { t: 8,  note: -26, dur: 1.6, vol: 0.6, voice: 'bass', type: 'sine' },
      { t: 12, note: -24, dur: 1.6, vol: 0.55, voice: 'bass', type: 'sine' },
      { t: 16, note: -22, dur: 1.6, vol: 0.6, voice: 'bass', type: 'sine' },
      { t: 20, note: -24, dur: 1.6, vol: 0.5, voice: 'bass', type: 'sine' },
      { t: 24, note: -31, dur: 3.4, vol: 0.62, voice: 'bass', type: 'sine' },
      { t: 0,  note: -43, dur: 14.5, vol: 0.36, voice: 'bass', type: 'sine' },
    ],
  },

  // ending_stray: 길고양이(새 삶) 엔딩. 차분·존엄한 희망. G Lydian, 열린 채 끝. 16.64s 루프.
  ending_stray: {
    stepDur: 0.52, steps: 32, melType: 'sine', padType: 'sine', bassType: 'sine', melVol: 0.9, padVol: 0.68,
    patterns: [
      { t: 0,  note: 5,  dur: 1.6, vol: 0.58, voice: 'mel', type: 'sine' },
      { t: 3,  note: 10, dur: 1.6, vol: 0.60, voice: 'mel', type: 'sine' },
      { t: 6,  note: 14, dur: 2.0, vol: 0.62, voice: 'mel', type: 'sine' },
      { t: 10, note: 16, dur: 1.8, vol: 0.56, voice: 'mel', type: 'sine' },
      { t: 14, note: 12, dur: 2.2, vol: 0.55, voice: 'mel', type: 'sine' },
      { t: 18, note: 10, dur: 1.8, vol: 0.52, voice: 'mel', type: 'sine' },
      { t: 21, note: 14, dur: 1.6, vol: 0.54, voice: 'mel', type: 'sine' },
      { t: 24, note: 17, dur: 2.0, vol: 0.56, voice: 'mel', type: 'sine' },
      { t: 28, note: 12, dur: 1.4, vol: 0.46, voice: 'mel', type: 'sine' },
      { t: 30, note: 10, dur: 2.4, vol: 0.44, voice: 'mel', type: 'sine' },
      { t: 0,  note: -2, dur: 4.0, vol: 0.40, voice: 'pad', type: 'sine' },
      { t: 0,  note: 2,  dur: 4.0, vol: 0.34, voice: 'pad', type: 'sine' },
      { t: 0,  note: -7, dur: 4.0, vol: 0.30, voice: 'pad', type: 'sine' },
      { t: 8,  note: -3, dur: 4.0, vol: 0.40, voice: 'pad', type: 'sine' },
      { t: 8,  note: 0,  dur: 4.0, vol: 0.32, voice: 'pad', type: 'sine' },
      { t: 16, note: -5, dur: 4.0, vol: 0.40, voice: 'pad', type: 'sine' },
      { t: 16, note: -2, dur: 4.0, vol: 0.34, voice: 'pad', type: 'sine' },
      { t: 16, note: 2,  dur: 4.0, vol: 0.28, voice: 'pad', type: 'sine' },
      { t: 24, note: -9, dur: 4.0, vol: 0.40, voice: 'pad', type: 'sine' },
      { t: 24, note: -5, dur: 4.0, vol: 0.32, voice: 'pad', type: 'sine' },
      { t: 24, note: 4,  dur: 4.0, vol: 0.24, voice: 'pad', type: 'sine' },
      { t: 0,  note: -26, dur: 3.6, vol: 0.55, voice: 'bass', type: 'sine' },
      { t: 8,  note: -31, dur: 3.6, vol: 0.50, voice: 'bass', type: 'sine' },
      { t: 16, note: -29, dur: 3.6, vol: 0.52, voice: 'bass', type: 'sine' },
      { t: 24, note: -33, dur: 3.6, vol: 0.52, voice: 'bass', type: 'sine' },
      { t: 0,  note: -38, dur: 17.0, vol: 0.34, voice: 'bass', type: 'sine' },
    ],
  },
};

// 한 노트를 ctx 절대시각 startAbs에 스케줄. voice 종류별 음색/엔벨로프/필터를 분리.
// 생성한 노드는 자동 stop되며, voice.scheduled에 등록해 강제 정리(전환/정지)에도 대비.
function scheduleNote(voice, p, startAbs) {
  if (!ready()) return;
  try {
    const def = voice.def;
    const hz = midiHz(p.note);
    const dur = p.dur;
    const o = S.ctx.createOscillator();
    o.type = p.type || (p.voice === 'pad' ? def.padType : p.voice === 'bass' ? def.bassType : def.melType);
    o.frequency.value = hz;

    const g = S.ctx.createGain();

    // voice별 음역 분리용 로우/하이 필터 + 볼륨 스케일.
    let peak;
    let attack, release;
    let outNode = g;
    if (p.voice === 'pad') {
      peak = MUSIC_PAD_VOL * (p.vol != null ? p.vol : 1) * (def.padVol || 1);
      attack = Math.min(0.8, dur * 0.35);
      release = Math.min(2.5, dur * 0.6);
      const lp = S.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;     // 패드는 어둡게(멜로디와 음색 분리)
      lp.Q.value = 0.5;
      o.connect(lp);
      lp.connect(g);
    } else if (p.voice === 'bass') {
      peak = MUSIC_BASS_VOL * (p.vol != null ? p.vol : 1);
      attack = Math.min(0.05, dur * 0.2);
      release = Math.min(0.5, dur * 0.5);
      const lp = S.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;     // 저음만
      o.connect(lp);
      lp.connect(g);
    } else { // 'mel'
      peak = MUSIC_MELODY_VOL * (p.vol != null ? p.vol : 1) * (def.melVol || 1);
      attack = 0.02;
      release = Math.min(0.9, dur * 0.7);
      const hp = S.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 180;     // 멜로디는 저음과 분리(중고음역)
      o.connect(hp);
      hp.connect(g);
    }
    if (peak <= 0) peak = 0.0001;

    // ADSR 비슷한 엔벨로프(클릭 방지 위해 0.0001부터).
    const t0 = startAbs;
    const tEnd = startAbs + dur;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, Math.max(t0 + attack, tEnd - release));
    g.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    g.connect(voice.bus);
    o.start(t0);
    o.stop(tEnd + 0.05); // 끝나면 자동 해제(누수 방지)

    // 강제 정리 대비 추적(완료된 노드는 onended에서 제거).
    const entry = { o: o, g: g };
    voice.scheduled.push(entry);
    o.onended = function () {
      try { o.disconnect(); } catch (e) { /* no-op */ }
      try { g.disconnect(); } catch (e) { /* no-op */ }
      const idx = voice.scheduled.indexOf(entry);
      if (idx >= 0) voice.scheduled.splice(idx, 1);
    };
  } catch (e) { /* 무음 폴백 */ }
}

// 한 voice의 룩어헤드 틱: nextTime 이전(SCHEDULE_AHEAD 이내)에 들어오는 모든 노트를 예약.
function musicTick(voice) {
  if (!ready()) { return; }
  const def = voice.def;
  const loopDur = def.steps * def.stepDur;
  const horizon = now() + SCHEDULE_AHEAD;

  // nextTime: 다음에 예약할 절대 시각. step: 현재 루프 내 스텝 위치(정수 진행).
  while (voice.nextTime < horizon) {
    const loopStart = voice.nextTime - (voice.step * def.stepDur);
    // 이번 스텝에 시작하는 모든 패턴 노트 예약.
    for (let i = 0; i < def.patterns.length; i++) {
      const p = def.patterns[i];
      if (p.t === voice.step) {
        scheduleNote(voice, p, voice.nextTime);
      }
    }
    voice.step += 1;
    voice.nextTime += def.stepDur;
    if (voice.step >= def.steps) {
      voice.step = 0; // 루프 반복(nextTime은 그대로 이어져 드리프트 없음)
      // loopStart 사용 안 함(연속 진행). 변수는 가독성 참고용.
      void loopStart;
    }
  }
}

// voice 하나를 완전히 정리(interval + 예약 노드 + 버스).
function teardownVoice(voice, fadeOut) {
  if (!voice) return;
  if (voice.timer !== null) {
    clearInterval(voice.timer);
    voice.timer = null;
  }
  const t = now();
  try {
    if (voice.bus) {
      if (fadeOut) {
        ramp(voice.bus.gain, 0, t, MUSIC_FADE);
      } else {
        ramp(voice.bus.gain, 0, t, 0.05);
      }
    }
  } catch (e) { /* no-op */ }
  const killAt = t + (fadeOut ? MUSIC_FADE : 0.05);
  // 예약된 노드 강제 정리(페이드 후).
  const sched = voice.scheduled.slice();
  for (let i = 0; i < sched.length; i++) {
    stopNode(sched[i].o, killAt + 0.05);
    stopNode(sched[i].g, killAt + 0.05);
  }
  voice.scheduled.length = 0;
  // 버스도 페이드 끝나면 끊기.
  const bus = voice.bus;
  if (bus) {
    setTimeout(function () {
      try { bus.disconnect(); } catch (e) { /* no-op */ }
    }, (fadeOut ? MUSIC_FADE : 0.05) * 1000 + 120);
  }
}

// 새 테마 voice를 생성·시작(페이드인 + 스케줄러 가동).
function startVoice(theme) {
  const def = MUSIC_THEMES[theme];
  if (!def || !ready()) return null;
  try {
    const bus = S.ctx.createGain();
    bus.gain.value = 0.0001;
    bus.connect(S.master);
    const t = now();
    ramp(bus.gain, 1, t, MUSIC_FADE); // 버스 자체는 1까지(노트 볼륨은 노트별로 작게)

    const voice = {
      theme: theme,
      def: def,
      bus: bus,
      timer: null,
      scheduled: [],
      step: 0,
      nextTime: now() + 0.12, // 살짝 앞에서 시작
    };

    musicTick(voice); // 즉시 첫 구간 예약
    voice.timer = setInterval(function () {
      // 컨텍스트가 죽으면 안전 정지.
      if (!ready()) { teardownVoice(voice, false); return; }
      musicTick(voice);
    }, LOOKAHEAD_MS);

    return voice;
  } catch (e) {
    return null;
  }
}

// 공개 API: 스테이지별 루프 멜로디 BGM. theme 전환 시 크로스페이드, null/'stop'이면 정지.
function music(theme) {
  // 정규화.
  if (theme === 'stop') theme = null;

  // 컨텍스트 없으면 상태만 보관하고 무음 폴백(throw 금지).
  if (!ready()) {
    S.music.theme = theme;
    return;
  }

  // 같은 테마 재요청 → 무시(중복 생성 방지).
  if (theme === S.music.theme && S.music.voices.length > 0) return;

  // 정지 또는 전환: 기존 voice 전부 페이드아웃 정리.
  const old = S.music.voices.slice();
  S.music.voices.length = 0;
  for (let i = 0; i < old.length; i++) {
    teardownVoice(old[i], true);
  }

  S.music.theme = theme;
  if (!theme) return; // 정지면 여기서 끝.

  // 알 수 없는 테마 → 무음(throw 금지).
  if (!MUSIC_THEMES[theme]) return;

  const voice = startVoice(theme);
  if (voice) S.music.voices.push(voice);
}

const Audio2 = {
  init: init,
  setMuted: setMuted,
  toggleMute: toggleMute,
  ambient: ambient,
  chime: chime,
  drone: drone,
  heartbeat: heartbeat,
  heartbeatPulse: heartbeatPulse,
  sfx: sfx,
  music: music,
};

if (typeof window !== 'undefined') window.Audio2 = Audio2;
