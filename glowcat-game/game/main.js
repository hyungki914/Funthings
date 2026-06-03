/* main.js — 통합부(렌더·입력·루프·HUD). 전역 ASSETS / Core / DATA / Audio2 사용. */
(function () {
  "use strict";
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  try { cv.setAttribute("tabindex", "0"); cv.style.outline = "none"; cv.focus(); } catch (e) {}  // 키 포커스 확보

  const C = Core.C;
  // 존재하는 챕터만 순서대로 — data.js에 chapter2/3 추가 시 자동 체이닝
  const CHAPTERS = ["chapter1", "chapter2", "chapter3"].filter(k => DATA[k]);
  let chapterIdx = 0;
  let D, TILE, NW, NH, S, st, colls, safes, door, murks;   // loadStage()에서 채움
  const px = (t) => t * TILE + TILE / 2;

  // ── 에셋 로드 ──────────────────────────────────────────────
  const IMG = {}; let toLoad = 0, loaded = 0, ready = false;
  for (const k in ASSETS) {
    toLoad++; const im = new Image();
    im.onload = () => { if (++loaded >= toLoad) ready = true; };
    im.onerror = () => { if (++loaded >= toLoad) ready = true; };
    im.src = ASSETS[k]; IMG[k] = im;
  }

  // ── 상태 ──────────────────────────────────────────────────
  let phase = "title";   // title | intro | play | recall | setback | journal | transition
  const player = { x: 0, y: 0, vx: 0, vy: 0, dir: Math.PI/2,
                   facing: "down", flip: false, animT: 0, frame: 0, step: 0, w: 10, h: 8 };
  let recall = null, hintTimer = 0, hintTarget = null, setbackT = 0, flash = 0, muted = false, shake = 0;
  let trail = [], trailCD = 0, projecting = false; const illuminated = new Set();
  const AURA_R = 54;              // 기억 비추기 펄스 반경
  let lowLightTip = 0, auraFx = 0, revealT = 0, projInvuln = 0, insightT = 0, stealthShown = false;
  // 온보딩/피드백 상태
  let elapsed = 0, lTutDone = false, corePulse = 0; let toasts = [];   // toasts: {text,color,t}
  let sawMurk = false;
  // 인트로(콜드 오픈) / 스테이지 전환
  let introT = 0, transT = 0, veil = 0, hasNext = false;
  const INTRO = [
    { at: 0.0, line: "…어둡다." },
    { at: 2.2, line: "여기는… 어디지." },
    { at: 4.6, line: "나는… 나는 누… ?" },
    { at: 6.6, line: "무언가 빠져나가고 있어 — 흩어지기 전에, 붙잡아야 해." },
  ];
  const INTRO_END = 9.0;
  function startIntro() {
    phase = "intro"; introT = 0; firstGesture();
    if (window.Audio2) try { if (Audio2.music) Audio2.music("intro"); if (Audio2.heartbeatPulse) Audio2.heartbeatPulse(); } catch (e) {}  // 콜드오픈: 심장박동 1회
  }
  function skipIntro() { if (introT < 0.5) return; endIntro(); }
  function endIntro() {                       // 검정→방 페이드인(veil) + 스킵키 누수 방지(clearEdges)
    phase = "play"; veil = 0.8; clearEdges();
    if (window.Audio2 && Audio2.music) try { Audio2.music(D.music || "room"); } catch (e) {}
  }
  function beginTransition() {
    phase = "transition"; transT = 0; hasNext = (chapterIdx + 1) < CHAPTERS.length;
    if (window.Audio2) try { if (Audio2.music) Audio2.music(null); Audio2.drone(0); Audio2.heartbeat(0); if (Audio2.chime) Audio2.chime(); } catch (e) {}  // 위험 오디오 정지 + 클리어 스팅어
  }
  // 챕터 매니저 — 맵/엔티티를 idx 챕터로 (재)초기화 (data에 chapter2/3 추가 시 체이닝)
  function loadStage(idx) {
    chapterIdx = idx; D = DATA[CHAPTERS[idx]];
    TILE = D.tile; NW = D.cols * TILE; NH = D.rows * TILE; S = Math.max(1, Math.floor(cv.width / NW));
    st = Core.newState(D);
    colls = D.collision.map(([c, r, w, h]) => ({ x: c*TILE, y: r*TILE, w: w*TILE, h: h*TILE }));
    safes = (D.safeZones || []).map(([c, r, w, h]) => ({ x: c*TILE, y: r*TILE, w: w*TILE, h: h*TILE }));
    door = D.door ? { x: px(D.door.tile[0]), y: px(D.door.tile[1]) } : null;
    murks = (D.murks || []).map(m => ({ id:m.id, wp:0, x:px(m.patrol[0][0]), y:px(m.patrol[0][1]),
      patrol:m.patrol.map(p => ({ x:px(p[0]), y:px(p[1]) })), speed:m.speed||38, sightPx:(m.sightTiles||3.3)*TILE,
      fov:(m.fovDeg||90), faceAngle:0, chasing:false, lost:0 }));
    player.x = px(D.spawn[0]); player.y = px(D.spawn[1]); player.vx = player.vy = 0;
    player.facing = "down"; player.flip = false; player.frame = 0; player.step = 0; player.dir = Math.PI/2;
    trail = []; illuminated.clear(); nearShard = null; hintTimer = 0; toasts = [];
    elapsed = 0; lTutDone = false; sawMurk = false; corePulse = 0; flash = 0; shake = 0;
  }
  function gotoTitle() { loadStage(0); phase = "title"; if (window.Audio2 && Audio2.music) try { Audio2.music(null); } catch (e) {} }

  // ── 입력 ──────────────────────────────────────────────────
  const keys = {}; const edge = {};
  // 물리 키 코드 매핑 — 한글 IME/레이아웃과 무관하게 동작(WASD가 ㅈㅁㄴㅇ로 들어와도 OK).
  const CODEMAP = {
    KeyW:"w", KeyA:"a", KeyS:"s", KeyD:"d", KeyE:"e", KeyL:"l", KeyQ:"q", KeyH:"h", KeyM:"m",
    ArrowUp:"arrowup", ArrowDown:"arrowdown", ArrowLeft:"arrowleft", ArrowRight:"arrowright",
    Space:" ", Enter:"enter", NumpadEnter:"enter", Tab:"tab", Escape:"escape",
    ShiftLeft:"shift", ShiftRight:"shift"
  };
  const GAMEKEYS = ["w","a","s","d","e","l","q","h","m","tab","shift"," ","arrowup","arrowdown","arrowleft","arrowright"];
  function setKey(e, v) {
    const k = CODEMAP[e.code] || (e.key || "").toLowerCase();   // e.code 우선 → IME 영향 없음
    if (v && !keys[k]) edge[k] = true;
    keys[k] = v;
    if (v) { if (phase === "title") startIntro(); else if (phase === "intro") skipIntro(); }
    if (GAMEKEYS.includes(k) && e.preventDefault) e.preventDefault();  // 브라우저 단축키 가로채기 방지
  }
  addEventListener("keydown", e => setKey(e, true));
  addEventListener("keyup", e => setKey(e, false));
  function firstGesture() { try { if (window.Audio2) Audio2.init(); } catch (e) {} }  // BGM은 music()이 담당
  addEventListener("keydown", firstGesture, { once: true });
  function clearEdges() { for (const k in edge) edge[k] = false; }

  // ── 터치/포인터 조작 (키보드 없는 태블릿·터치패드) ────────────────
  let touchUI = (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) || (typeof window !== "undefined" && "ontouchstart" in window);
  const touch = { joyId: null, joyCx: 0, joyCy: 0, jx: 0, jy: 0, sneak: false, holdQ: null };
  function canvasXY(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / Math.max(1, r.width)), y: (e.clientY - r.top) * (cv.height / Math.max(1, r.height)) }; }
  function touchButtons() {                       // 우하단 스킬 버튼 (캔버스 px)
    const W = cv.width, H = cv.height, R = 33, bx = W - 66, by = H - 70;
    return [
      { id: "e",     label: "조사",   x: bx,        y: by,        r: 41, hold: false },
      { id: "q",     label: "비추기", x: bx - 98,   y: by - 8,    r: R,  hold: false },
      { id: "l",     label: "추적",   x: bx - 74,   y: by - 84,   r: R,  hold: false },
      { id: "shift", label: "은신",   x: bx + 2,    y: by - 100,  r: R,  hold: "toggle" },
      { id: "tab",   label: "일지",   x: bx - 156,  y: by - 66,   r: R,  hold: false },
      { id: "h",     label: "힌트",   x: bx - 156,  y: by + 4,    r: R,  hold: false },
    ];
  }
  const touchToggleRect = () => ({ x: cv.width - 150, y: 78, w: 136, h: 26 });
  function hitBtn(x, y) { for (const b of touchButtons()) if ((x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r) return b; return null; }

  function onPointerDown(e) {
    try { cv.focus(); } catch (er) {} firstGesture();
    if (e.pointerType === "touch") touchUI = true;
    const p = canvasXY(e);
    const tr = touchToggleRect();                                   // 터치 조작 토글 (어느 페이즈든)
    if (p.x >= tr.x && p.x <= tr.x + tr.w && p.y >= tr.y && p.y <= tr.y + tr.h) { touchUI = !touchUI; return; }
    if (phase === "title") { startIntro(); return; }
    if (phase === "intro") { skipIntro(); return; }
    if (phase === "recall") { closeRecall(); return; }
    if (phase === "transition") { if (!hasNext) gotoTitle(); return; }
    if (phase === "journal") { edge["tab"] = true; return; }        // 탭하여 닫기
    if (phase !== "play" || !touchUI) return;
    const b = hitBtn(p.x, p.y);
    if (b) {
      if (b.hold === true) { keys[b.id] = true; touch.holdQ = e.pointerId; }
      else if (b.hold === "toggle") { touch.sneak = !touch.sneak; }
      else { edge[b.id] = true; }
      return;
    }
    if (p.x < cv.width * 0.5) { touch.joyId = e.pointerId; touch.joyCx = p.x; touch.joyCy = p.y; touch.jx = 0; touch.jy = 0; }  // 좌측 = 가상 조이스틱
  }
  function onPointerMove(e) {
    if (touch.joyId !== e.pointerId) return;
    const p = canvasXY(e), dx = p.x - touch.joyCx, dy = p.y - touch.joyCy, mag = Math.hypot(dx, dy);
    if (mag < 8) { touch.jx = 0; touch.jy = 0; } else { const m = Math.min(1, mag / 60); touch.jx = (dx / mag) * m; touch.jy = (dy / mag) * m; }
  }
  function onPointerUp(e) {
    if (touch.joyId === e.pointerId) { touch.joyId = null; touch.jx = 0; touch.jy = 0; }
    if (touch.holdQ === e.pointerId) { keys["q"] = false; touch.holdQ = null; }
  }
  cv.addEventListener("pointerdown", onPointerDown);
  cv.addEventListener("pointermove", onPointerMove);
  cv.addEventListener("pointerup", onPointerUp);
  cv.addEventListener("pointercancel", onPointerUp);

  // ── 헬퍼 ──────────────────────────────────────────────────
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function aabb(x, y, w, h, r) { return x - w/2 < r.x + r.w && x + w/2 > r.x && y - h/2 < r.y + r.h && y + h/2 > r.y; }
  function inAny(x, y, w, h, list) { for (const r of list) if (aabb(x, y, w, h, r)) return r; return null; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function shardCenter(s) { return { x: px(s.tile[0]), y: px(s.tile[1]) }; }
  function isDone(s) { return st.collected.has ? st.collected.has(s.id) : (st.collected.indexOf?.(s.id) >= 0); }

  // ── 업데이트 ──────────────────────────────────────────────
  function update(dt) {
    if (phase === "title" || phase === "cleared") return;
    if (phase === "intro") { introT += dt; if (introT >= INTRO_END) endIntro(); clearEdges(); return; }
    if (phase === "transition") {
      transT += dt;
      if (hasNext && transT > 2.6) {                          // 다음 챕터 자동 로드(체이닝)
        loadStage(chapterIdx + 1); phase = "play"; veil = 0.8;
        if (window.Audio2 && Audio2.music) try { Audio2.music(D.music || "room"); } catch (e) {}
      } else if (!hasNext && transT > 1.2 && (edge[" "] || edge["enter"])) { gotoTitle(); }
      clearEdges(); return;
    }
    if (phase === "recall") { if (edge[" "] || edge["enter"]) closeRecall(); clearEdges(); return; }
    if (phase === "setback") { setbackT -= dt; if (setbackT <= 0) phase = "play"; clearEdges(); return; }
    if (phase === "journal") { if (edge["tab"] || edge["escape"]) phase = "play"; clearEdges(); return; }
    if (edge["tab"]) { phase = "journal"; clearEdges(); return; }   // 기억 일지 열기
    elapsed += dt;

    // 이동 입력 (키보드 + 가상 조이스틱)
    const stealth = keys["shift"] || touch.sneak;
    const sp = stealth ? C.STEALTH_SPEED : C.PLAYER_SPEED;
    let ix, iy;
    if (touch.joyId !== null && Math.hypot(touch.jx, touch.jy) > 0.01) { ix = touch.jx; iy = touch.jy; }  // 조이스틱(아날로그)
    else {
      ix = (keys["d"]||keys["arrowright"]?1:0) - (keys["a"]||keys["arrowleft"]?1:0);
      iy = (keys["s"]||keys["arrowdown"]?1:0) - (keys["w"]||keys["arrowup"]?1:0);
      if (ix && iy) { const inv = 1/Math.sqrt(2); ix *= inv; iy *= inv; }
    }
    player.vx = ix * sp; player.vy = iy * sp;
    const moving = (Math.abs(ix) + Math.abs(iy)) > 0.06;

    // 충돌 분리 이동
    moveAxis("x", player.vx * dt);
    moveAxis("y", player.vy * dt);
    player.x = clamp(player.x, TILE + player.w/2, NW - TILE - player.w/2);
    player.y = clamp(player.y, TILE + player.h/2, NH - TILE - player.h/2);

    // 방향/애니
    if (moving) {
      if (Math.abs(ix) >= Math.abs(iy) && ix !== 0) { player.facing = "side"; player.flip = ix > 0; }
      else player.facing = "down";
      player.dir = Math.atan2(player.vy, player.vx);
      player.animT += dt; if (player.animT > 0.16) { player.animT = 0; player.frame ^= 1; player.step = (player.step||0) + 1; }
    } else player.frame = 0;

    // 기억 비추기(Q) — 빛 1 소모 펄스. 그림자가 추격을 멈추고 제자리(순찰)로 복귀 + 숨은 기억 드러냄.
    illuminated.clear();
    if (lowLightTip > 0) lowLightTip -= dt;
    if (auraFx > 0) auraFx -= dt; if (revealT > 0) revealT -= dt; if (projInvuln > 0) projInvuln -= dt;
    if (edge["q"]) {
      if (st.light >= 1) {
        st.light -= 1; auraFx = 0.6; revealT = 3.0; projInvuln = 0.5;
        for (const m of murks) if (dist(player.x, player.y, m.x, m.y) <= AURA_R + 10) {
          m.chasing = false; m.warded = 2.0; m.lost = 0;
          const dd = dist(player.x, player.y, m.x, m.y) || 1;
          m.x += (m.x - player.x) / dd * 18; m.y += (m.y - player.y) / dd * 18;   // 한 번 밀어냄
        }
        toasts.push({ text: "기억의 빛 — 그림자가 물러나 제자리로 돌아간다", color: "#9af6f6", t: 1.8 });
        if (window.Audio2 && Audio2.chime) try { Audio2.chime(); } catch (e) {}
      } else if (lowLightTip <= 0) { toasts.push({ text: "빛이 부족하다 — 기억을 모으거나 안전지대에서 회복", color: "#9fc5c5", t: 2.0 }); lowLightTip = 2.0; }
    }
    // 노출 창(revealT) 동안 근처 숨은 기억 표시
    if (revealT > 0) for (const s of D.shards) if (s.hidden && !isDone(s) && dist(player.x, player.y, shardCenter(s).x, shardCenter(s).y) <= 76) illuminated.add(s.id);

    // 발자국 추적(L) — 가장 가까운 미발견 코어로 시안 발자국 흔적(무료, 쿨다운)
    if (edge["l"]) lTutDone = true;
    if (trailCD > 0) trailCD -= dt;
    if (edge["l"] && trailCD <= 0) {
      let best = null, bd = 1e9;
      for (const s of D.shards) if (s.type === "core" && !isDone(s)) { const c = shardCenter(s), dd = dist(player.x, player.y, c.x, c.y); if (dd < bd) { bd = dd; best = c; } }
      if (best) { trail = []; const n = 7; for (let i = 1; i <= n; i++) trail.push({ x: player.x + (best.x - player.x) * i / n, y: player.y + (best.y - player.y) * i / n, age: 0 }); trailCD = C.TRAIL_CD; }
    }
    for (const p of trail) p.age += dt; trail = trail.filter(p => p.age < C.TRAIL_LIFE);

    // 은신 안내(1회)
    if (stealth && !stealthShown) { stealthShown = true; toasts.push({ text: "은신: 느리지만 잘 안 들킨다 · 멈추면 거의 안 보인다", color: "#7fb0b3", t: 2.8 }); }

    // Murk
    let danger = false;
    const nearestWp = (m) => { let bw = m.patrol[0], bd = 1e9; for (const w of m.patrol) { const dd = (w.x - m.x) ** 2 + (w.y - m.y) ** 2; if (dd < bd) { bd = dd; bw = w; } } return bw; };
    for (const m of murks) {
      if (m.warded > 0) m.warded -= dt;
      const warded = m.warded > 0;                                   // 비추기로 물러난 상태 → 제자리 복귀, 감지/공격 안 함
      const sm = stealth ? (moving ? 0.45 : 0.28) : 1.0;             // 은신: 정지하면 거의 안 보임
      const sees = !warded && Core.murkSees({ x: m.x, y: m.y, faceAngle: m.faceAngle, sight: m.sightPx * sm, fov: m.fov }, player.x, player.y);
      if (sees) { m.chasing = true; m.lost = 0;
        if (!sawMurk) { sawMurk = true; toasts.push({ text: "들켰다! [은신]으로 천천히 — 멈추면 거의 안 보인다", color: "#ff7a7a", t: 3.0 }); } }
      else if (m.chasing) { m.lost += dt * (stealth ? 2.4 : 1); if (m.lost > 2.2) m.chasing = false; }
      let ax, ay, spd;
      if (warded) { const w = nearestWp(m); ax = w.x; ay = w.y; spd = m.speed; }   // 제자리(가까운 순찰점)로 복귀
      else if (m.chasing) { ax = player.x; ay = player.y; spd = m.speed * 1.35; danger = true; }
      else { const w = m.patrol[m.wp]; ax = w.x; ay = w.y; spd = m.speed; if (dist(m.x, m.y, w.x, w.y) < 3) m.wp = (m.wp + 1) % m.patrol.length; }
      const d = dist(m.x, m.y, ax, ay) || 1, nx = (ax - m.x) / d, ny = (ay - m.y) / d;
      m.x += nx * spd * dt; m.y += ny * spd * dt;
      if (Math.abs(nx) + Math.abs(ny) > 0.01) m.faceAngle = Math.atan2(ny, nx);
      if (dist(m.x, m.y, player.x, player.y) < 11 && !warded && projInvuln <= 0) {   // 물러난 동안/펄스 직후엔 피격 무효
        if (Core.contact(st)) { flash = 0.18; shake = 4; if (window.Audio2) Audio2.sfx("contact"); }
      }
      if (!warded && dist(m.x, m.y, player.x, player.y) < m.sightPx * 0.55) danger = true;
    }

    // 게이지 tick
    const inSafe = !!inAny(player.x, player.y, player.w, player.h, safes);
    Core.tick(st, dt, { inSafe, inDanger: danger, moving });
    if (inSafe) st.light = Math.min(C.LIGHT_MAX, st.light + 0.6 * dt);   // 안전지대에서 빛도 회복

    // 후퇴
    if (st.mem <= 0 && Core.setbackIfDead(st)) {
      const z = safes[0]; if (z) { player.x = z.x + z.w/2; player.y = z.y + z.h/2; }
      phase = "setback"; setbackT = 1.6; flash = 0.4; if (window.Audio2) Audio2.sfx("setback");
    }

    // 근처 조각 & 상호작용
    nearShard = null;
    for (const s of D.shards) {
      if (isDone(s)) continue;
      if (s.hidden && !illuminated.has(s.id)) continue;   // 숨은 조각은 비출 때만
      if (dist(player.x, player.y, shardCenter(s).x, shardCenter(s).y) < (s.radius||1.3) * TILE) { nearShard = s; break; }
    }
    if (edge["e"] && nearShard) doCollect(nearShard);

    // 통찰(H) — 빛 1 소모. 주변의 모든 미발견 기억을 드러내고 거짓을 ✗로 표시(추적 L과 차별화).
    if (edge["h"]) {
      if (Core.useHint(st).ok) { insightT = 5.0; toasts.push({ text: "통찰 — 숨은 기억까지 드러난다 (✗ = 거짓)", color: "#8ef548", t: 2.2 }); }
      else toasts.push({ text: "빛이 부족하다 — 안전지대에서 회복", color: "#9fc5c5", t: 2.0 });
    }
    if (insightT > 0) insightT -= dt;

    // 음소거
    if (edge["m"] && window.Audio2) { muted = !muted; Audio2.setMuted(muted); }

    // 위험 오디오
    if (window.Audio2) { Audio2.drone(danger ? 0.8 : 0); Audio2.heartbeat(st.mem <= 2 ? 96 : 0); }

    // 클리어 → 전환 시퀀스(부드러운 페이드 + 챕터 카드)
    if (Core.chapterClear(st) && door && dist(player.x, player.y, door.x, door.y) < 14) beginTransition();

    if (flash > 0) flash -= dt; if (shake > 0) shake -= dt * 24;
    if (veil > 0) veil = Math.max(0, veil - dt);   // 방 진입 페이드인
    if (corePulse > 0) corePulse -= dt;
    for (const t of toasts) t.t -= dt; toasts = toasts.filter(t => t.t > 0);
    clearEdges();
  }

  let nearShard = null;

  function moveAxis(axis, d) {
    if (!d) return;
    if (axis === "x") { player.x += d; const r = inAny(player.x, player.y, player.w, player.h, colls); if (r) player.x = d > 0 ? r.x - player.w/2 : r.x + r.w + player.w/2; }
    else { player.y += d; const r = inAny(player.x, player.y, player.w, player.h, colls); if (r) player.y = d > 0 ? r.y - player.h/2 : r.y + r.h + player.h/2; }
  }

  function doCollect(s) {
    const res = Core.collect(st, s) || {};
    if (res.ok === false) return;
    recall = { text: res.recallText || s.recall || "", type: res.type || s.type };
    phase = "recall";
    if (s.type === "core") {
      toasts.push({ text: "코어 기억 " + st.coreOrder.length + " / " + st.coresNeeded + " 회복!", color: "#8ef548", t: 2.4 });
      corePulse = 0.7;
      if (Core.chapterClear(st)) toasts.push({ text: "문이 열렸다 — 위쪽 ↑ 으로", color: "#34e2e2", t: 3.4 });
    } else if (s.type === "echo") toasts.push({ text: "에코 기억 — 옛 흔적을 떠올렸다", color: "#9fc5c5", t: 2.0 });
    else if (s.type === "false") toasts.push({ text: "⚠ 거짓된 기억 — 기억이 깎였다", color: "#ff7a7a", t: 2.6 });
    if (window.Audio2) { if (s.type === "false") Audio2.sfx("contact"); else Audio2.chime(); }
  }
  function closeRecall() { recall = null; phase = "play"; }

  // ── 렌더 ──────────────────────────────────────────────────
  function spriteFor() {
    if (player.facing === "side") return player.frame ? IMG.ziro_s1 : IMG.ziro_s0;
    if (!player.frame) return IMG.ziro_d0;                  // idle
    return ((player.step||0) & 1) ? IMG.ziro_d2 : IMG.ziro_d1;  // 보행 두 프레임 교차
  }

  function draw() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const sx = (Math.random() - 0.5) * 2 * Math.max(0, shake), sy = (Math.random() - 0.5) * 2 * Math.max(0, shake);
    ctx.scale(S, S); ctx.translate(sx, sy);

    if (!ready) { ctx.restore(); hudText("로딩…", NW*S/2, NH*S/2, "#34e2e2", 20, true); return; }

    // 배경
    if (IMG.room1 && IMG.room1.width) ctx.drawImage(IMG.room1, 0, 0, NW, NH);
    else { ctx.fillStyle = "#10140d"; ctx.fillRect(0, 0, NW, NH); }

    // 문(클리어 가능 시 빛남)
    if (door && Core.chapterClear(st)) {
      ctx.save(); ctx.globalAlpha = 0.6 + 0.3*Math.sin(performance.now()/200);
      ctx.fillStyle = "#34e2e2"; ctx.fillRect(door.x-7, door.y-7, 14, 14); ctx.restore();
    }

    // 발자국 추적 흔적
    for (const p of trail) { const a = 1 - p.age / C.TRAIL_LIFE; ctx.save(); ctx.globalAlpha = 0.55 * a; ctx.fillStyle = "#34e2e2";
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 2.2, 1.6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - 1.6, p.y - 1.6, 0.8, 0, 7); ctx.arc(p.x + 1.6, p.y - 1.6, 0.8, 0, 7); ctx.fill(); ctx.restore(); }
    // 기억 비추기 펄스 — 확장하는 빛 고리(그림자를 밀어냄)
    if (auraFx > 0) {
      const f = auraFx / 0.6, t = 1 - f, ar = AURA_R * (0.45 + 0.75 * t), cyx = player.x, cyy = player.y - 2;
      ctx.save();
      const g = ctx.createRadialGradient(cyx, cyy, 3, cyx, cyy, ar);
      g.addColorStop(0, "rgba(154,246,246," + (0.32 * f) + ")"); g.addColorStop(0.7, "rgba(52,226,226," + (0.13 * f) + ")"); g.addColorStop(1, "rgba(52,226,226,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cyx, cyy, ar, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.8 * f; ctx.strokeStyle = "#9af6f6"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cyx, cyy, ar, 0, 7); ctx.stroke();
      ctx.restore();
    }

    // 환경 단서: 미발견 조각을 거리 비례로 흐릿하게(글로우 OFF 보완 — '여기 뭔가 있다').
    //   숨은 조각은 제외(Q로만). 거짓은 차갑게 깜빡여 미묘한 '어긋남' 신호.
    for (const s of D.shards) {
      if (isDone(s) || s.hidden) continue;
      const c = shardCenter(s), d = dist(player.x, player.y, c.x, c.y);
      if (d > 120) continue;
      const fal = s.type === "false";
      const a = Math.max(0.1, Math.min(0.55, 1 - d / 120)) * (0.6 + 0.4 * Math.sin(performance.now() / (fal ? 170 : 320)));
      ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = fal ? "#caa15a" : "#34e2e2"; ctx.shadowBlur = 5;
      ctx.fillStyle = fal ? "#caa15a" : "#34e2e2";
      ctx.beginPath(); ctx.arc(c.x, c.y - 1, fal ? 2.0 : 2.6, 0, 7); ctx.fill(); ctx.restore();
    }

    // 근처 조각만 표시(글로우 OFF·3단 발견)
    if (nearShard && IMG.shard) {
      const c = shardCenter(nearShard);
      glow(() => ctx.drawImage(IMG.shard, c.x - IMG.shard.width/2, c.y - IMG.shard.height/2), "#34e2e2", 8);
      tag("조사 [E]", c.x, c.y - 14);
    }

    // y정렬: murk/player
    const ents = [...murks.map(m => ({ y: m.y, m })), { y: player.y, p: true }];
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.p) {
        const sp = spriteFor();
        if (sp && sp.width) {
          const sneak = !!keys["shift"];                          // 은신: 흐려지고 글로우 약화(피드백)
          ctx.save(); if (sneak) ctx.globalAlpha = 0.6;
          if (player.facing === "side" && player.flip) { ctx.translate(player.x, 0); ctx.scale(-1, 1); ctx.translate(-player.x, 0); }
          glow(() => ctx.drawImage(sp, Math.round(player.x - sp.width/2), Math.round(player.y - sp.height + 6)), sneak ? "#2a3d2a" : "#8ef548", sneak ? 1 : 3);
          ctx.restore();
        }
      } else {
        const m = e.m;
        // 시야콘 (감지 범위 — 평시 보라/추격 빨강/물러남 약하게). 은신 중이면 흐려져 '덜 보임'을 전달.
        const hf = (m.fov * Math.PI / 180) / 2, sneaking = (keys["shift"] || touch.sneak);
        const cAlpha = (m.warded > 0 ? 0.03 : (m.chasing ? 0.18 : 0.08)) * (sneaking ? 0.45 : 1);
        ctx.save(); ctx.globalAlpha = cAlpha; ctx.fillStyle = m.chasing ? "#ff5a5a" : "#7a5cff";
        ctx.beginPath(); ctx.moveTo(m.x, m.y);
        ctx.arc(m.x, m.y, m.sightPx * (sneaking ? 0.5 : 1), m.faceAngle - hf, m.faceAngle + hf); ctx.closePath(); ctx.fill(); ctx.restore();
        if (IMG.murk) glow(() => ctx.drawImage(IMG.murk, Math.round(m.x - IMG.murk.width/2), Math.round(m.y - IMG.murk.height/2)), m.chasing ? "#ff5a5a" : "#7a5cff", m.chasing ? 5 : 2);
      }
    }

    // 통찰(H) — 미발견 기억을 드러냄: 코어/에코는 ●(코어 더 큼), 거짓은 ✗
    if (insightT > 0) {
      const a = Math.min(1, insightT) * (0.65 + 0.35 * Math.sin(performance.now() / 150));
      for (const s of D.shards) {
        if (isDone(s)) continue;
        const c = shardCenter(s);
        ctx.save(); ctx.globalAlpha = a;
        if (s.type === "false") {
          ctx.strokeStyle = "#caa15a"; ctx.lineWidth = 2; ctx.shadowColor = "#caa15a"; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.moveTo(c.x - 4, c.y - 5); ctx.lineTo(c.x + 4, c.y + 3);
          ctx.moveTo(c.x + 4, c.y - 5); ctx.lineTo(c.x - 4, c.y + 3); ctx.stroke();
        } else {
          const col = s.type === "core" ? "#34e2e2" : "#9fc5c5";
          ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(c.x, c.y - 1, s.type === "core" ? 3.4 : 2.4, 0, 7); ctx.fill();
        }
        ctx.restore();
      }
    }

    // 피격 플래시
    if (flash > 0) { ctx.fillStyle = `rgba(255,90,90,${Math.min(0.5, flash)})`; ctx.fillRect(0, 0, NW, NH); }

    ctx.restore();
    drawHUD();
    if (phase === "play") drawGuide();
    if (phase === "title") overlayTitle();
    if (phase === "recall" && recall) overlayRecall();
    if (phase === "setback") overlayCenter("…어둡다. 여기는…", "#9ab", "방금 떠올린 기억이 다시 어둠에 잠겼다 · 같은 자리에서 되찾을 수 있다");
    if (phase === "cleared") overlayCenter("챕터 1 클리어 · 「지로의 방」", "#8ef548", "지로가 첫 기억들을 되찾았다.");
    if (phase === "intro") overlayIntro();
    if (phase === "transition") overlayTransition();
    if (phase === "journal" && window.Journal) { try { Journal.draw(ctx, cv, st, D, IMG); } catch (e) { console.error(e); } }
    if (veil > 0) { ctx.save(); ctx.fillStyle = "rgba(3,5,9," + Math.min(1, veil / 0.8) + ")"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); }
    drawTouch();
  }

  // 화면 터치 조작(가상 조이스틱 + 스킬 버튼) + 토글
  function drawTouch() {
    if (!ready) return;
    const tr = touchToggleRect();
    ctx.save(); ctx.fillStyle = "rgba(10,16,20,.78)"; rrect(tr.x, tr.y, tr.w, tr.h, 8); ctx.fill();
    ctx.fillStyle = touchUI ? "#8ef548" : "#8aa7a9"; ctx.font = "12px 'Noto Sans KR',sans-serif"; ctx.textAlign = "center";
    ctx.fillText(touchUI ? "터치 조작: 켜짐" : "터치 조작: 꺼짐", tr.x + tr.w / 2, tr.y + 17); ctx.restore();
    if (!touchUI || phase !== "play") return;
    // 가상 조이스틱(좌하단; 터치 중엔 누른 위치)
    const jcx = touch.joyId !== null ? touch.joyCx : 124, jcy = touch.joyId !== null ? touch.joyCy : cv.height - 120;
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#34e2e2"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(jcx, jcy, 56, 0, 7); ctx.stroke();
    ctx.fillStyle = "rgba(52,226,226,.22)"; ctx.beginPath(); ctx.arc(jcx + touch.jx * 44, jcy + touch.jy * 44, 24, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.fillStyle = "#6b8a8c"; ctx.font = "11px 'Noto Sans KR',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("드래그하여 이동", jcx, jcy + 78); ctx.restore();
    // 스킬 버튼(우하단)
    for (const b of touchButtons()) {
      const usesLight = (b.id === "q" || b.id === "h");
      const noLight = usesLight && st.light < 1;
      const on = (b.id === "shift" && touch.sneak) || (b.id === "q" && auraFx > 0);
      ctx.save(); ctx.globalAlpha = noLight ? 0.5 : 1;
      ctx.fillStyle = on ? "rgba(52,226,226,.35)" : "rgba(10,16,20,.82)";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.strokeStyle = on ? "#9af6f6" : "#34e2e2"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke();
      ctx.fillStyle = "#eafaff"; ctx.font = "bold 13px 'Noto Sans KR',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x, b.y); ctx.textBaseline = "alphabetic";
      if (usesLight) { ctx.font = "bold 10px 'Noto Sans KR',sans-serif"; ctx.fillStyle = noLight ? "#ff7a7a" : "#9af6f6"; ctx.fillText("빛 " + Math.floor(st.light), b.x, b.y + b.r + 11); }
      ctx.restore();
    }
  }

  // 인트로(콜드 오픈) — 어둠 속에서 눈을 뜨는 지로 + 흐릿한 독백 (01 §2-1)
  function overlayIntro() {
    ctx.save();
    ctx.fillStyle = "#03060a"; ctx.fillRect(0, 0, cv.width, cv.height);
    const eo = Math.min(1, Math.max(0, (introT - 1.0) / 1.6));   // 눈 서서히 켜짐
    if (eo > 0) {
      ctx.globalAlpha = eo * 0.92; ctx.fillStyle = "#9bf24a"; ctx.shadowColor = "#34e2e2"; ctx.shadowBlur = 18;
      const cy = cv.height / 2 - 50;
      ctx.beginPath(); ctx.ellipse(cv.width / 2 - 28, cy, 13, 19, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cv.width / 2 + 28, cy, 13, 19, 0, 0, 7); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    let cur = INTRO[0]; for (const b of INTRO) if (introT >= b.at) cur = b;
    ctx.globalAlpha = Math.min(1, (introT - cur.at) / 0.6);
    ctx.textAlign = "center"; ctx.fillStyle = "#cfe6e6"; ctx.font = "20px 'Noto Sans KR',sans-serif";
    ctx.fillText(cur.line, cv.width / 2, cv.height / 2 + 70);
    ctx.globalAlpha = 0.5; ctx.fillStyle = "#5a7375"; ctx.font = "13px 'Noto Sans KR',sans-serif";
    ctx.fillText("아무 키 / 클릭 — 건너뛰기", cv.width / 2, cv.height - 40);
    ctx.restore();
  }

  // 스테이지 전환 — 페이드 아웃 + 챕터 카드
  function overlayTransition() {
    const fade = Math.min(1, transT / 1.0);
    ctx.save();
    ctx.fillStyle = "rgba(3,5,9," + fade + ")"; ctx.fillRect(0, 0, cv.width, cv.height);
    if (transT > 1.0) {
      ctx.globalAlpha = Math.min(1, (transT - 1.0) / 0.7); ctx.textAlign = "center";
      ctx.fillStyle = "#8ef548"; ctx.font = "bold 30px 'Noto Sans KR',sans-serif";
      ctx.fillText("CHAPTER 1 · 클리어", cv.width / 2, cv.height / 2 - 12);
      ctx.fillStyle = "#eafaff"; ctx.font = "20px 'Noto Sans KR',sans-serif";
      ctx.fillText("「지로의 방」", cv.width / 2, cv.height / 2 + 22);
      ctx.fillStyle = "#9fb6b6"; ctx.font = "14px 'Noto Sans KR',sans-serif";
      ctx.fillText(hasNext ? "지로가 첫 기억들을 되찾았다 — 다음 이야기로…" : "지로가 첫 기억들을 되찾았다.", cv.width / 2, cv.height / 2 + 54);
      if (!hasNext) { ctx.fillStyle = "#8ef548"; ctx.font = "13px 'Noto Sans KR',sans-serif"; ctx.fillText("[Space] 처음으로", cv.width / 2, cv.height / 2 + 86); }
    }
    ctx.restore();
  }

  function glow(fn, color, blur) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore(); }
  function tag(t, x, y) { ctx.save(); ctx.font = "6px sans-serif"; ctx.textAlign = "center";
    const w = ctx.measureText(t).width + 6; ctx.fillStyle = "rgba(6,14,18,.85)"; ctx.fillRect(x - w/2, y - 7, w, 9);
    ctx.fillStyle = "#bfffff"; ctx.fillText(t, x, y); ctx.restore(); }

  // ── HUD (스케일 1:1, 픽셀 위 오버레이) ─────────────────────
  function drawHUD() {
    if (!ready) return;
    const W = cv.width;
    // 메모리 미터(발바닥 10칸)
    const pipW = 16, x0 = 16, y0 = cv.height - 28;
    ctx.save();
    ctx.fillStyle = "rgba(10,16,20,.85)"; rrect(x0 - 10, y0 - 12, pipW*10 + 64, 30, 8); ctx.fill();
    ctx.font = "13px 'Noto Sans KR',sans-serif"; ctx.fillStyle = st.mem <= 2 ? "#ff7a7a" : "#bfffff";
    ctx.textAlign = "left"; ctx.fillText("기억", x0, y0 + 8);
    for (let i = 0; i < C.MEM_MAX; i++) {
      const fillAmt = clamp(st.mem - i, 0, 1);
      const cx = x0 + 40 + i * pipW + 7, cy = y0 + 3;
      paw(cx, cy, "#16262a");                       // 빈칸
      if (fillAmt >= 1) paw(cx, cy, st.mem <= 2 ? "#ff5a5a" : "#34e2e2");
      else if (fillAmt > 0) { ctx.save(); ctx.beginPath(); ctx.rect(cx - 6, cy - 7, 6, 14); ctx.clip(); paw(cx, cy, "#34e2e2"); ctx.restore(); }
    }
    ctx.font = "11px 'Noto Sans KR',sans-serif"; ctx.fillStyle = "#9fc5c5";
    ctx.fillText("생명 — 0이 되면 후퇴", x0, y0 - 16);
    // 정체성 + 코어 카운터(우상단)
    ctx.fillStyle = "rgba(10,16,20,.85)"; rrect(W - 230, 14, 216, 56, 8); ctx.fill();
    const idn = (st.identity || 0);
    ctx.fillStyle = "#0e0f13"; ctx.beginPath(); ctx.arc(W - 200, 42, 20, 0, 7); ctx.fill();
    ctx.strokeStyle = "#34e2e2"; ctx.lineWidth = 2; ctx.stroke();
    if (idn <= 0 || !IMG.ziro_d0) { ctx.fillStyle = "#34e2e2"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center"; ctx.fillText("?", W - 200, 50); }
    else ctx.drawImage(IMG.ziro_d0, W - 218, 24, 36, 38);
    ctx.textAlign = "left"; ctx.fillStyle = "#eafaff"; ctx.font = "bold 15px 'Noto Sans KR',sans-serif";
    ctx.fillText(idn > 0 && D.identityLabels[idn-1] ? D.identityLabels[idn-1] : "정체 미상", W - 170, 38);
    ctx.fillStyle = "#6b8a8c"; ctx.font = "12px 'Noto Sans KR',sans-serif";
    ctx.fillText("정체성 " + idn + " / 5", W - 170, 58);
    // 코어 카운터(좌상단) — 주 목표 지표. 획득 시 펄스.
    ctx.fillStyle = "rgba(10,16,20,.85)"; rrect(14, 14, 160, 30, 8); ctx.fill();
    const cp = corePulse > 0 ? corePulse : 0;
    ctx.fillStyle = cp > 0 ? "#d6ff9a" : "#8ef548"; ctx.font = "bold " + (15 + Math.round(cp * 8)) + "px 'Noto Sans KR',sans-serif";
    ctx.fillText("코어 기억 " + (st.coreOrder ? st.coreOrder.length : 0) + " / " + st.coresNeeded, 26, 35);
    // 빛 게이지 바(코어 카운터 아래)
    ctx.fillStyle = "#16262a"; ctx.fillRect(26, 50, 100, 6);
    ctx.fillStyle = "#34e2e2"; ctx.fillRect(26, 50, 100 * (st.light / C.LIGHT_MAX), 6);
    ctx.fillStyle = "#9fc5c5"; ctx.font = "11px 'Noto Sans KR',sans-serif";
    ctx.fillText("빛 " + Math.floor(st.light||0) + "   [Q]비추기 · [H]통찰", 132, 56);
    ctx.fillStyle = trailCD > 0 ? "#8aa7a9" : "#8ef548";
    ctx.fillText(trailCD > 0 ? "[L] 발자국 추적  " + trailCD.toFixed(0) + "s" : "[L] 발자국 추적 (사용가능)", 26, 70);
    ctx.fillStyle = "#9fc5c5"; ctx.fillText("[Tab] 기억 일지", 26, 86);
    ctx.restore();
  }
  function paw(cx, cy, col) { ctx.fillStyle = col; ctx.beginPath();
    ctx.ellipse(cx, cy + 3, 5, 4, 0, 0, 7); ctx.fill();
    for (const [dx, dy, r] of [[-4,-3,2],[0,-5,2.2],[4,-3,2]]) { ctx.beginPath(); ctx.arc(cx+dx, cy+dy, r, 0, 7); ctx.fill(); } }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  function hudText(t, x, y, col, size, center) { ctx.save(); ctx.font = `bold ${size}px 'Noto Sans KR',sans-serif`;
    ctx.fillStyle = col; ctx.textAlign = center ? "center" : "left"; ctx.fillText(t, x, y); ctx.restore(); }

  // ── 인게임 가이드(온보딩/피드백) ─────────────────────────
  function drawGuide() {
    if (!ready) return;
    const W = cv.width, cores = (st.coreOrder ? st.coreOrder.length : 0), need = st.coresNeeded;
    const done = cores >= need;
    if (keys["shift"]) { ctx.save(); ctx.textAlign = "center"; ctx.font = "bold 12px 'Noto Sans KR',sans-serif"; ctx.fillStyle = "#7fb0b3"; ctx.fillText("은신 중", player.x * S, player.y * S - 42); ctx.restore(); }
    // 목표 배너(상단 중앙)
    ctx.save();
    const bw = 380, bx = (W - bw) / 2, by = 12;
    ctx.fillStyle = "rgba(8,14,18,.82)"; rrect(bx, by, bw, 34, 10); ctx.fill();
    ctx.textAlign = "left"; ctx.font = "bold 14px 'Noto Sans KR',sans-serif";
    if (done) { ctx.fillStyle = "#34e2e2"; ctx.textAlign = "center"; ctx.fillText("문이 열렸다 — 위쪽 ↑ 문으로 가라", W / 2, by + 22); }
    else {
      ctx.fillStyle = "#eafaff"; ctx.fillText("목표 · 코어 기억 모으기", bx + 14, by + 22);
      const dotx = bx + 158;
      for (let i = 0; i < need; i++) { ctx.beginPath(); ctx.arc(dotx + i * 20, by + 16, 6, 0, 7); ctx.fillStyle = i < cores ? "#8ef548" : "#27343a"; ctx.fill(); }
      ctx.fillStyle = "#9fc5c5"; ctx.font = "12px 'Noto Sans KR',sans-serif"; ctx.fillText("빛나는 기억에 다가가 [E]", dotx + need * 20 + 6, by + 22);
    }
    ctx.restore();
    // 클리어 시 문 방향 화살표(상단)
    if (done && door) { ctx.save(); ctx.textAlign = "center"; ctx.font = "bold 26px sans-serif"; ctx.fillStyle = "#34e2e2";
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 200); ctx.fillText("↑", door.x * S, 72); ctx.restore(); }
    // 진행 토스트(좌상단 코어 카운터 아래)
    let ty = 92; ctx.save(); ctx.textAlign = "left"; ctx.font = "bold 14px 'Noto Sans KR',sans-serif";
    for (const t of toasts) { const a = Math.min(1, t.t); ctx.globalAlpha = a;
      const tw = ctx.measureText(t.text).width + 20;
      ctx.fillStyle = "rgba(8,14,18,.88)"; rrect(14, ty, tw, 24, 8); ctx.fill();
      ctx.globalAlpha = a; ctx.fillStyle = t.color; ctx.fillText(t.text, 24, ty + 16); ty += 28; }
    ctx.restore();
    // L 코치마크(첫 코어 전, 무입력 후) — 빈 방 문제 직격
    if (cores === 0 && elapsed > 3 && !lTutDone && trail.length === 0) {
      const spx = player.x * S, spy = player.y * S;
      ctx.save(); ctx.textAlign = "center"; ctx.font = "bold 13px 'Noto Sans KR',sans-serif";
      const txt = "[L] 발자국 추적 — 기억의 흔적을 따라가자";
      const tw = ctx.measureText(txt).width + 20;
      ctx.fillStyle = "rgba(8,14,18,.92)"; rrect(spx - tw / 2, spy - 74, tw, 26, 8); ctx.fill();
      ctx.fillStyle = "#8ef548"; ctx.fillText(txt, spx, spy - 56); ctx.restore();
    }
    // 조작 힌트(하단) — 이 스테이지에서 쓰는 단축키만(data의 controls). 터치 모드에선 숨김(버튼이 대신).
    if (!touchUI && (cores === 0 || elapsed < 16)) {
      const list = (D.controls && D.controls.length) ? D.controls
        : [["이동", "WASD"], ["조사", "E"], ["추적", "L"], ["일지", "Tab"]];
      const txt = list.map(c => "[" + c[1] + "] " + c[0]).join("   ·   ");
      ctx.save(); ctx.textAlign = "center"; ctx.font = "12px 'Noto Sans KR',sans-serif";
      const tw = ctx.measureText(txt).width + 24;
      ctx.fillStyle = "rgba(8,14,18,.75)"; rrect((W - tw) / 2, cv.height - 74, tw, 22, 8); ctx.fill();
      ctx.fillStyle = "#bcd6d6"; ctx.fillText(txt, W / 2, cv.height - 59); ctx.restore();
    }
  }

  function overlayTitle() {
    ctx.save(); ctx.fillStyle = "rgba(4,6,10,.72)"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.textAlign = "center"; ctx.fillStyle = "#eafaff"; ctx.font = "bold 44px 'Noto Sans KR',sans-serif";
    ctx.fillText("잊혀진 발자국", cv.width/2, cv.height/2 - 40);
    ctx.fillStyle = "#34e2e2"; ctx.font = "18px 'Noto Sans KR',sans-serif";
    ctx.fillText("LOST PAWPRINT — 지로 · 챕터 1 「지로의 방」", cv.width/2, cv.height/2 - 6);
    ctx.fillStyle = "#cfe6e6"; ctx.font = "16px 'Noto Sans KR',sans-serif";
    ctx.fillText("코어 기억 3개를 찾아 문을 열어라.  닿으면 기억이 흐려진다.", cv.width/2, cv.height/2 + 30);
    ctx.fillStyle = "#8ef548"; ctx.font = "bold 18px 'Noto Sans KR',sans-serif";
    ctx.fillText("▶ 클릭 / 아무 키로 시작", cv.width/2, cv.height/2 + 66); ctx.restore();
  }
  function overlayRecall() {
    ctx.save(); ctx.fillStyle = "rgba(3,6,10,.78)"; ctx.fillRect(0, 0, cv.width, cv.height);
    const w = Math.min(760, cv.width - 80), x = (cv.width - w)/2, y = cv.height/2 - 70;
    ctx.fillStyle = "#070d11"; ctx.strokeStyle = recall.type === "false" ? "#caa15a" : "#34e2e2"; ctx.lineWidth = 2;
    rrect(x, y, w, 140, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = recall.type === "false" ? "#e8c884" : "#34e2e2"; ctx.textAlign = "left";
    ctx.font = "bold 16px 'Noto Sans KR',sans-serif";
    ctx.fillText(recall.type === "false" ? "[회상 — 무언가 어긋난다]" : "[회상]", x + 24, y + 34);
    ctx.fillStyle = "#eef7f7"; ctx.font = "18px 'Noto Sans KR',sans-serif";
    wrap(recall.text, x + 24, y + 66, w - 48, 26);
    ctx.fillStyle = "#6b8a8c"; ctx.font = "14px 'Noto Sans KR',sans-serif"; ctx.textAlign = "right";
    ctx.fillText("[Space] 계속", x + w - 20, y + 124); ctx.restore();
  }
  function overlayCenter(title, col, sub) {
    ctx.save(); ctx.fillStyle = "rgba(3,5,9,.8)"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.textAlign = "center"; ctx.fillStyle = col; ctx.font = "bold 34px 'Noto Sans KR',sans-serif";
    ctx.fillText(title, cv.width/2, cv.height/2 - 6);
    if (sub) { ctx.fillStyle = "#9fb6b6"; ctx.font = "16px 'Noto Sans KR',sans-serif"; ctx.fillText(sub, cv.width/2, cv.height/2 + 28); }
    ctx.restore();
  }
  function wrap(t, x, y, maxw, lh) { const words = (t||"").split(/\s+/); let line = "", yy = y;
    for (const w of words) { const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxw && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = test; }
    if (line) ctx.fillText(line, x, yy); }

  // ── 루프 ──────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) { let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
    try { update(dt); } catch (e) { console.error(e); }
    draw(); requestAnimationFrame(frame); }
  // 디버그 스냅샷(테스트용, 무해): 상태 읽기 전용
  if (typeof window !== 'undefined') window.__ziro = () => ({ phase, px: player.x, py: player.y, mem: st ? st.mem : 0, ch: chapterIdx });
  loadStage(0);                 // 첫 챕터 초기화(맵·엔티티·상태)
  requestAnimationFrame(frame);
})();
