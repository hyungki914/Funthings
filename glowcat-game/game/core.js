// core.js — 『잊혀진 발자국』(지로 Ziro) 순수 규칙 로직 모듈
// DOM/Canvas 사용 금지. 순수 함수만. (10_build_plan §2-1, 03_systems_enemies v2.0)
// 전역 `Core` + Node export 둘 다 지원.
'use strict';

// ---- 상수 (10_build_plan §2-1) ----
const C = {
  MEM_MAX: 10,
  LIGHT_MAX: 6,
  START_MEM: 4,
  START_LIGHT: 2,
  CONTACT: -2,
  CORE_GAIN: +2,
  ECHO_GAIN: +1,
  FALSE_HIT: -2,
  HINT_COST: 1,
  REST_PER_S: 1.0,
  DECAY_PER_S: 0.2,
  IFRAME_S: 1.2,
  PLAYER_SPEED: 64,   // px/s (16px 타일 * 4 스케일 기준 보정)
  STEALTH_SPEED: 38,  // px/s
  SETBACK_MEM: 3,
  // 코어 동사 (v2 증분)
  PROJECT_COST: 0.8,  // 기억 비추기: 초당 빛 소모
  PROJECT_LEN: 46,    // 투사 콘 길이(px)
  PROJECT_HALFDEG: 32,// 투사 콘 반각(도)
  TRAIL_CD: 6.0,      // 발자국 추적 쿨다운(s)
  TRAIL_LIFE: 3.0,    // 발자국 잔존(s)
};

// ---- 헬퍼 ----
function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

// 각도를 -π..π 범위로 정규화
function normAngle(a) {
  const TWO_PI = Math.PI * 2;
  // ((a + π) mod 2π) - π  (음수 mod 보정 포함)
  let r = (a + Math.PI) % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r - Math.PI;
}

// ---- 상태 생성 (§2-1 / §2-2 스키마 입력) ----
function newState(data) {
  data = data || {};
  return {
    mem: C.START_MEM,
    light: C.START_LIGHT,
    iframe: 0,
    coresNeeded: data.coresNeeded,
    collected: new Set(),   // 수집한 조각 id
    coreOrder: [],          // 코어 획득 순서 (후퇴 봉인용)
    sealed: new Set(),      // 임시 봉인된 코어 id
    identity: 0,            // 0..5 정체성 해금 단계
    _coreSlots: {},         // (내부) 코어 id -> identitySlot, 정체성 재계산용
  };
}

// ---- 조각 수집 ----
function collect(state, shard) {
  if (state.collected.has(shard.id)) {
    return { ok: false };
  }
  let gainMem = 0;
  let gainLight = 0;
  const type = shard.type;

  if (type === 'core') {
    gainMem = C.CORE_GAIN;
    gainLight = 1;
    state.identity = Math.max(state.identity, shard.identitySlot + 1);
    state.coreOrder.push(shard.id);
    if (state._coreSlots) state._coreSlots[shard.id] = shard.identitySlot;
  } else if (type === 'echo') {
    gainMem = C.ECHO_GAIN;
    gainLight = 1;
  } else if (type === 'false') {
    gainMem = C.FALSE_HIT;
    gainLight = 0;
  }

  state.mem = clamp(state.mem + gainMem, 0, C.MEM_MAX);
  state.light = clamp(state.light + gainLight, 0, C.LIGHT_MAX);
  state.collected.add(shard.id);

  return {
    ok: true,
    type,
    recallText: shard.recall,
    gainMem,
    gainLight,
    identitySlot: shard.identitySlot,
  };
}

// ---- 적 접촉 ----
function contact(state) {
  if (state.iframe > 0) return false; // 무적 프레임 중 = 무피해
  state.mem = clamp(state.mem + C.CONTACT, 0, C.MEM_MAX);
  state.iframe = C.IFRAME_S;
  return true;
}

// ---- 시간 진행: 회복/감소/iframe 감소 ----
function tick(state, dt, ctx) {
  ctx = ctx || {};
  state.iframe = Math.max(0, state.iframe - dt);
  if (ctx.inSafe) {
    state.mem = Math.min(C.MEM_MAX, state.mem + C.REST_PER_S * dt);
  } else if (ctx.inDanger) {
    state.mem = Math.max(0, state.mem - C.DECAY_PER_S * dt);
  }
}

// ---- 힌트(직감) 사용: 빛 자원 소모 ----
function useHint(state) {
  if (state.light >= C.HINT_COST) {
    state.light -= C.HINT_COST;
    return { ok: true };
  }
  return { ok: false };
}

// ---- 후퇴(Setback): mem<=0 → 최근 코어 1개 임시봉인 + 안전지대 복귀 신호 ----
function setbackIfDead(state) {
  if (state.mem > 0) return false;

  // 가장 최근 획득한 코어를 봉인
  const lastCoreId = state.coreOrder.pop();
  if (lastCoreId !== undefined) {
    state.sealed.add(lastCoreId);
    state.collected.delete(lastCoreId);
  }

  // 남은 코어 기준으로 정체성 재계산
  state.identity = recomputeIdentity(state);

  state.mem = C.SETBACK_MEM;
  return true;
}

// 봉인 처리 후 남은 코어 슬롯으로 정체성 재계산 (없으면 0)
function recomputeIdentity(state) {
  let maxSlot = -1;
  const coreSlots = state._coreSlots || {};
  for (const id of state.coreOrder) {
    const slot = coreSlots[id];
    if (typeof slot === 'number' && slot > maxSlot) maxSlot = slot;
  }
  return maxSlot < 0 ? 0 : maxSlot + 1;
}

// ---- Murk 시야 감지 (거리 + 각도. LoS는 호출측 보강) ----
function murkSees(murk, px, py) {
  const dx = px - murk.x;
  const dy = py - murk.y;
  const dist = Math.hypot(dx, dy);
  if (dist > murk.sight) return false;
  if (dist === 0) return true; // 동일 위치는 항상 감지
  const toPlayer = Math.atan2(dy, dx);
  const diff = Math.abs(normAngle(toPlayer - murk.faceAngle));
  const halfFov = (murk.fov * Math.PI / 180) / 2;
  return diff <= halfFov;
}

// ---- 정체성 상태 ----
function identityState(state) {
  const portraits = ['q', 'silhouette', 'eyes', 'face', 'name'];
  const unlocked = state.identity;
  const portrait = portraits[Math.min(unlocked, 4)];
  return { unlocked, portrait, label: portrait };
}

// ---- 챕터 클리어: 보유 코어 수 >= 필요 수 (봉인된 건 제외) ----
function chapterClear(state) {
  return state.coreOrder.length >= state.coresNeeded;
}

// 투사 콘 판정(순수): (ox,oy)에서 faceAngle 방향 len·halfDeg 콘 안에 (px,py)가 드는가
function inCone(ox, oy, faceAngle, len, halfDeg, px, py) {
  const dx = px - ox, dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > len) return false;
  if (dist < 0.0001) return true;
  const a = normAngle(Math.atan2(dy, dx) - faceAngle);
  return Math.abs(a) <= halfDeg * Math.PI / 180;
}

const Core = {
  C,
  clamp,
  normAngle,
  inCone,
  newState,
  collect,
  contact,
  tick,
  useHint,
  setbackIfDead,
  murkSees,
  identityState,
  chapterClear,
};

if (typeof window !== 'undefined') window.Core = Core;
if (typeof module !== 'undefined') module.exports = Core;
