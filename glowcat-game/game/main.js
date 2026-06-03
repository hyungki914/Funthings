/* main.js — 통합부(렌더·입력·루프·HUD). 전역 ASSETS / Core / DATA / Audio2 사용. */
(function () {
  "use strict";
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  try { cv.setAttribute("tabindex", "0"); cv.style.outline = "none"; cv.focus(); } catch (e) {}  // 키 포커스 확보

  const C = Core.C;
  // 서사 순서대로 — 존재하는 챕터만 체이닝(10스테이지)
  const CHAPTERS = ["chapter1", "chapter2", "chapter3", "chapter4", "chapter5",
                    "chapter6", "chapter7", "chapter8", "chapter9", "chapter10"].filter(k => DATA[k]);
  let chapterIdx = 0;
  let D, TILE, NW, NH, S, st, colls, safes, door, murks, echoes;   // loadStage()에서 채움
  let shards = [];                                                   // 이번 진행의 조각(랜덤 배치된 사본)
  let RANDOMIZE = true;                                              // 매 진행마다 조각·적 위치 랜덤
  let camX = 0, camY = 0, VIEWW = 0, VIEWH = 0;                      // 카메라(스크롤) — 큰 맵은 추적, 작은 맵은 중앙
  const px = (t) => t * TILE + TILE / 2;
  const toSX = (wx) => (wx - camX) * S;                              // 월드→화면 px (HUD 오버레이용)
  const toSY = (wy) => (wy - camY) * S;
  function updateCamera() {
    VIEWW = cv.width / S; VIEWH = cv.height / S;
    camX = NW <= VIEWW ? (NW - VIEWW) / 2 : clamp(player.x - VIEWW / 2, 0, NW - VIEWW);   // 작으면 중앙, 크면 추적+클램프
    camY = NH <= VIEWH ? (NH - VIEWH) / 2 : clamp(player.y - VIEWH / 2, 0, NH - VIEWH);
  }

  // ── 에셋 로드 ──────────────────────────────────────────────
  const IMG = {}; let toLoad = 0, loaded = 0, ready = false;
  const tick = () => { if (++loaded >= toLoad) ready = true; };
  for (const k in ASSETS) {
    toLoad++; const im = new Image(); im.onload = tick; im.onerror = tick; im.src = ASSETS[k]; IMG[k] = im;
  }
  // 원화 일러스트(스테이지 깨달음 + 엔딩) — illust.js 의 ILL
  const ILLIMG = {};
  if (typeof ILL !== "undefined") for (const k in ILL) {
    toLoad++; const im = new Image(); im.onload = tick; im.onerror = tick; im.src = ILL[k]; ILLIMG[k] = im;
  }
  const stageIll = () => ILLIMG["s" + (chapterIdx + 1)];   // 현재 스테이지 깨달음 원화

  // ── 상태 ──────────────────────────────────────────────────
  let phase = "title";   // title | intro | play | recall | setback | journal | realize | choice | ending | transition
  const player = { x: 0, y: 0, vx: 0, vy: 0, dir: Math.PI/2,
                   facing: "down", flip: false, animT: 0, frame: 0, step: 0, w: 10, h: 8 };
  let recall = null, hintTimer = 0, hintTarget = null, setbackT = 0, flash = 0, muted = false, shake = 0;
  let trail = [], trailCD = 0, projecting = false; const illuminated = new Set();
  const AURA_R = 54;              // 기억 비추기 펄스 반경
  let lowLightTip = 0, auraFx = 0, revealT = 0, projInvuln = 0, hintMsgT = 0, stealthShown = false; let hintMsg = "";
  // 온보딩/피드백 상태
  let elapsed = 0, lTutDone = false, corePulse = 0; let toasts = [];   // toasts: {text,color,t}
  let sawMurk = false, sawEcho = false, playerNoise = 0;
  // 인트로(콜드 오픈) / 스테이지 전환 / 스테이지 진입 장소 카드
  let introT = 0, transT = 0, veil = 0, hasNext = false, stageCardT = 0;
  function showStageCard() { stageCardT = 2.6; }
  // 깨달음(회상 몽타주) / 최종 선택 / 엔딩
  let realizeT = 0, realizeI = 0, realizeLines = [], choiceSel = 0, endingType = null;
  // 마음(희망↔체념) 미터 — 중간 분기 선택 누적 → 엔딩 분기. 보스(공백) 상태.
  let hope = 0, branchSel = 0, boss = null;
  // 진행 저장(클리어 스테이지) + 스테이지 선택/시퀀스 재생
  let clearedMax = -1, selIdx = 0, realizeReview = false, realizeIllKey = null, hoverKey = null;
  const SAVE_KEY = "ziro_progress_v1";
  function loadProgress() { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); if (typeof v.clearedMax === "number") clearedMax = v.clearedMax; } catch (e) {} }
  function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ clearedMax })); } catch (e) {} }
  function markCleared(idx) { if (idx > clearedMax) { clearedMax = idx; saveProgress(); } }
  // 연출: 환경 파티클(ambient) + 조각 수집 링 FX
  let ambientKind = null, particles = [], collectFx = null;
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
    phase = "play"; veil = 0.8; showStageCard(); clearEdges();
    if (window.Audio2 && Audio2.music) try { Audio2.music(D.music || "room"); } catch (e) {}
  }
  function beginTransition() {
    phase = "transition"; transT = 0; hasNext = (chapterIdx + 1) < CHAPTERS.length;
    if (window.Audio2) try { if (Audio2.music) Audio2.music(null); Audio2.drone(0); Audio2.heartbeat(0); if (Audio2.chime) Audio2.chime(); } catch (e) {}  // 위험 오디오 정지 + 클리어 스팅어
  }
  // 깨달음(회상 몽타주) — 이 챕터에서 되찾은 코어 기억의 회상 → 챕터 깨달음(epiphany)을 한 줄씩.
  //   마지막 줄 이후: 최종 챕터면 choice(받아들이기/다시 잊기), 아니면 다음 챕터 전환.
  function beginRealize() {
    realizeReview = false; realizeIllKey = null; markCleared(chapterIdx);   // 클리어 저장
    realizeLines = [];
    for (const id of (st.coreOrder || [])) {            // 획득 순서대로 코어 회상 회고
      const s = shards.find(x => x.id === id);
      if (s && s.recall) realizeLines.push({ kind: "memory", text: s.recall });
    }
    for (const line of (D.epiphany || [])) realizeLines.push({ kind: "epiphany", text: line });
    if (!realizeLines.length) { beginTransition(); return; }   // 데이터 없으면 곧장 전환(폴백)
    realizeI = 0; realizeT = 0; phase = "realize";
    if (window.Audio2) try { Audio2.drone(0); Audio2.heartbeat(0); if (Audio2.music) Audio2.music("memory"); if (Audio2.chime) Audio2.chime(); } catch (e) {}  // 깨달음 BGM
  }
  // 챕터 매니저 — 맵/엔티티를 idx 챕터로 (재)초기화 (data에 chapter2/3 추가 시 체이닝)
  // ── 랜덤 레이아웃: 도달 가능한 빈 타일 위에 조각·적 patrol을 재배치(리플레이성) ──
  function tileFree(D, c, r) {
    if (c < 1 || c >= D.cols - 1 || r < 2 || r >= D.rows - 1) return false;
    return !D.collision.some(q => c >= q[0] && c < q[0] + q[2] && r >= q[1] && r < q[1] + q[3]);
  }
  function reachableTiles(D) {                          // 스폰에서 4방향 플러드필(빈 타일만)
    const seen = new Set(), key = (c, r) => c + "," + r, sp = D.spawn, stack = [[sp[0], sp[1]]];
    seen.add(key(sp[0], sp[1]));
    while (stack.length) { const [c, r] = stack.pop();
      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nc = c+dc, nr = r+dr;
        if (tileFree(D, nc, nr) && !seen.has(key(nc, nr))) { seen.add(key(nc, nr)); stack.push([nc, nr]); } } }
    return [...seen].map(s => s.split(",").map(Number));
  }
  function makeLayout(D) {
    const orig = { shards: D.shards.map(s => ({ ...s })), murkP: (D.murks||[]).map(m => m.patrol), echoP: (D.echoes||[]).map(m => m.patrol) };
    if (!RANDOMIZE) return orig;
    const reach = reachableTiles(D);
    if (reach.length < D.shards.length + 8) return orig;            // 너무 좁으면 원본
    const sp = D.spawn, d2 = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2;
    const shuffle = a => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pool = shuffle(reach.filter(t => d2(t, sp) >= 9));        // 스폰서 ≥3타일
    const placed = [], shardsOut = [];
    for (const s of D.shards) {
      let tile = null, pi = -1;
      for (let i = 0; i < pool.length; i++) { if (placed.every(p => d2(p, pool[i]) >= 4)) { tile = pool[i]; pi = i; break; } }  // 서로 ≥2타일
      if (!tile) return orig;
      pool.splice(pi, 1); placed.push(tile); shardsOut.push({ ...s, tile: [tile[0], tile[1]] });
    }
    const genPatrol = () => {                                       // 빈 타일 사각 루프(모서리·변 모두 빈칸)
      for (let tn = 0; tn < 50; tn++) {
        const a = reach[(Math.random()*reach.length)|0], w = 2 + ((Math.random()*3)|0), h = 2 + ((Math.random()*2)|0);
        const pts = [];
        for (let x = a[0]; x <= a[0]+w; x++) { pts.push([x, a[1]]); pts.push([x, a[1]+h]); }
        for (let y = a[1]; y <= a[1]+h; y++) { pts.push([a[0], y]); pts.push([a[0]+w, y]); }
        if (pts.every(p => tileFree(D, p[0], p[1]))) return [[a[0],a[1]],[a[0]+w,a[1]],[a[0]+w,a[1]+h],[a[0],a[1]+h]];
      }
      return null;
    };
    const murkP = (D.murks||[]).map((m, i) => genPatrol() || orig.murkP[i]);
    const echoP = (D.echoes||[]).map((m, i) => genPatrol() || orig.echoP[i]);
    return { shards: shardsOut, murkP, echoP };
  }

  function loadStage(idx) {
    chapterIdx = idx; D = DATA[CHAPTERS[idx]];
    TILE = D.tile; NW = D.cols * TILE; NH = D.rows * TILE;
    S = Math.max(1, Math.round(cv.width / (22 * TILE)));   // 고정 게임플레이 줌(22타일 기준 ≈ 3). 맵 크기와 무관 → 스크롤 가능.
    st = Core.newState(D);
    colls = D.collision.map(([c, r, w, h]) => ({ x: c*TILE, y: r*TILE, w: w*TILE, h: h*TILE }));
    safes = (D.safeZones || []).map(([c, r, w, h]) => ({ x: c*TILE, y: r*TILE, w: w*TILE, h: h*TILE }));
    door = D.door ? { x: px(D.door.tile[0]), y: px(D.door.tile[1]) } : null;
    const L = makeLayout(D);                              // 매 진행마다 조각·적 위치 랜덤 배치(리플레이성)
    shards = L.shards;
    murks = (D.murks || []).map((m, i) => { const pt = L.murkP[i]; return { id:m.id, wp:0, x:px(pt[0][0]), y:px(pt[0][1]),
      patrol:pt.map(p => ({ x:px(p[0]), y:px(p[1]) })), speed:m.speed||38, sightPx:(m.sightTiles||3.3)*TILE,
      fov:(m.fovDeg||90), faceAngle:0, chasing:false, lost:0, warded:0 }; });
    echoes = (D.echoes || []).map((m, i) => { const pt = L.echoP[i]; return { id:m.id, wp:0, x:px(pt[0][0]), y:px(pt[0][1]),
      patrol:pt.map(p => ({ x:px(p[0]), y:px(p[1]) })), speed:m.speed||34, hearPx:(m.hearTiles||3.5)*TILE,
      chasing:false, lost:0, tx:0, ty:0, warded:0 }; });
    player.x = px(D.spawn[0]); player.y = px(D.spawn[1]); player.vx = player.vy = 0;
    player.facing = "down"; player.flip = false; player.frame = 0; player.step = 0; player.dir = Math.PI/2;
    trail = []; illuminated.clear(); nearShard = null; hintTimer = 0; toasts = [];
    elapsed = 0; lTutDone = false; sawMurk = false; sawEcho = false; playerNoise = 0; corePulse = 0; flash = 0; shake = 0;
    collectFx = null; initAmbient();
    boss = D.boss ? { hp: D.boss.hp || 2, max: D.boss.hp || 2, x: px(D.boss.tile[0]), y: px(D.boss.tile[1]),
                      t: 0, hit: 0, struck: false, dispelled: false } : null;
    updateCamera();   // 첫 프레임 카메라 정렬
  }

  // ── 환경 파티클(ambient): dust(실내 먼지)·leaves(야외 낙엽)·motes(빈자리 빛입자). 경량(≤24). ──
  function initAmbient() {
    ambientKind = D.ambient || null; particles = [];
    if (!ambientKind) return;
    const n = ambientKind === "motes" ? 22 : 18;
    for (let i = 0; i < n; i++) particles.push(newParticle());
  }
  function newParticle() {
    const w = cv.width, h = cv.height, R = Math.random;
    if (ambientKind === "leaves") return { x: R()*w, y: R()*h, vx: 12+R()*16, vy: 6+R()*10, r: 2+R()*2, a: 0.12+R()*0.12, ph: R()*6 };
    if (ambientKind === "motes")  return { x: R()*w, y: R()*h, vx: (R()-0.5)*6, vy: -(8+R()*12), r: 1+R()*1.6, a: 0.15+R()*0.2, ph: 0 };
    return { x: R()*w, y: R()*h, vx: (R()-0.5)*8, vy: (R()-0.3)*6, r: 0.8+R()*1.2, a: 0.06+R()*0.08, ph: 0 };  // dust
  }
  function updateAmbient(dt) {
    if (!ambientKind) return;
    for (const p of particles) {
      p.x += p.vx*dt; p.y += p.vy*dt;
      if (ambientKind === "leaves") { p.x += Math.sin(performance.now()/600 + p.ph)*0.3;
        if (p.x > cv.width+12 || p.y > cv.height+12) { Object.assign(p, newParticle()); p.x = -10; p.y = Math.random()*cv.height*0.6; } }
      else if (ambientKind === "motes") { if (p.y < -12) { Object.assign(p, newParticle()); p.y = cv.height+10; } }
      else { if (p.x < -12 || p.x > cv.width+12 || p.y < -12 || p.y > cv.height+12) Object.assign(p, newParticle()); }
    }
  }
  function drawAmbient() {
    if (!ambientKind || !particles.length) return;
    ctx.save();
    ctx.fillStyle = ambientKind === "leaves" ? "#7a9a4a" : ambientKind === "motes" ? "#9af6f6" : "#9fb6b6";
    for (const p of particles) { ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function gotoTitle() { hope = 0; loadStage(0); phase = "title"; if (window.Audio2 && Audio2.music) try { Audio2.music("title"); } catch (e) {} }
  // 스테이지 선택 메뉴 / 선택 시작 / 시퀀스(깨달음) 재생
  function openSelect() { selIdx = Math.max(0, Math.min(CHAPTERS.length - 1, clearedMax + 1)); phase = "select"; clearEdges();
    if (window.Audio2) try { if (Audio2.music) Audio2.music("title"); if (Audio2.sfx) Audio2.sfx("select"); } catch (e) {} }
  function startStage(idx) {
    if (idx < 0 || idx > clearedMax + 1 || idx >= CHAPTERS.length) return;
    loadStage(idx); phase = "play"; veil = 0.8; showStageCard(); clearEdges();
    if (window.Audio2) try { if (Audio2.sfx) Audio2.sfx("select"); if (Audio2.music) Audio2.music(D.music || "room"); } catch (e) {}
  }
  function startReview(idx) {                                   // 클리어한 스테이지의 깨달음 시퀀스 다시 보기
    if (idx < 0 || idx > clearedMax || idx >= CHAPTERS.length) return;
    const Dr = DATA[CHAPTERS[idx]]; realizeLines = [];
    for (const s of Dr.shards) if (s.type === "core" && s.recall) realizeLines.push({ kind: "memory", text: s.recall });
    for (const line of (Dr.epiphany || [])) realizeLines.push({ kind: "epiphany", text: line });
    realizeIllKey = "s" + (idx + 1); realizeReview = true; realizeI = 0; realizeT = 0; phase = "realize"; clearEdges();
    if (window.Audio2) try { if (Audio2.music) Audio2.music("memory"); if (Audio2.sfx) Audio2.sfx("select"); } catch (e) {}
  }

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
    if (v) { if (phase === "title") { if (k === "tab") openSelect(); else startIntro(); } else if (phase === "intro") skipIntro(); }
    if (GAMEKEYS.includes(k) && e.preventDefault) e.preventDefault();  // 브라우저 단축키 가로채기 방지
  }
  addEventListener("keydown", e => setKey(e, true));
  addEventListener("keyup", e => setKey(e, false));
  function firstGesture() { try { if (window.Audio2) { Audio2.init(); if ((phase === "title" || phase === "select") && Audio2.music) Audio2.music("title"); } } catch (e) {} }  // 첫 제스처로 오디오 활성 + 타이틀 BGM
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
      { id: "h",     label: "직감",   x: bx - 156,  y: by + 4,    r: R,  hold: false },
    ];
  }
  const touchToggleRect = () => ({ x: cv.width - 150, y: 78, w: 136, h: 26 });
  function hitBtn(x, y) { for (const b of touchButtons()) if ((x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r) return b; return null; }
  // 타이틀 메뉴 + 스테이지 선택 화면 지오메트리(렌더·포인터 공용)
  const titleStartRect = () => ({ x: cv.width/2 - 130, y: cv.height/2 + 36, w: 260, h: 42 });
  const titleContinueRect = () => ({ x: cv.width/2 - 130, y: cv.height/2 + 86, w: 260, h: 36 });
  const titleSelectRect = () => ({ x: cv.width/2 - 130, y: cv.height/2 + 130, w: 260, h: 36 });
  function selGrid() { const M = 60, G = 18, cols = 5; const cw = (cv.width - 2*M - (cols-1)*G) / cols; return { M, G, cols, cw, ch: cw*9/16 }; }
  function selCardRect(i) { const g = selGrid(); const r = Math.floor(i/g.cols), c = i % g.cols;
    return { x: g.M + c*(g.cw + g.G), y: 150 + r*(g.ch + 64), w: g.cw, h: g.ch }; }
  const selBackRect = () => ({ x: 24, y: 24, w: 96, h: 30 });
  const selStartBtn = () => ({ x: cv.width/2 - 224, y: cv.height - 74, w: 210, h: 36 });
  const selReviewBtn = () => ({ x: cv.width/2 + 14, y: cv.height - 74, w: 210, h: 36 });
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function onPointerDown(e) {
    try { cv.focus(); } catch (er) {} firstGesture();
    if (e.pointerType === "touch") touchUI = true;
    const p = canvasXY(e);
    const tr = touchToggleRect();                                   // 터치 조작 토글 (어느 페이즈든)
    if (p.x >= tr.x && p.x <= tr.x + tr.w && p.y >= tr.y && p.y <= tr.y + tr.h) { touchUI = !touchUI; return; }
    if (phase === "title") {
      if (clearedMax >= 0 && inRect(p, titleContinueRect())) { startStage(Math.min(clearedMax + 1, CHAPTERS.length - 1)); return; }
      if (inRect(p, titleSelectRect())) { openSelect(); return; }
      startIntro(); return;        // 시작 버튼 또는 빈 공간 → 처음부터
    }
    if (phase === "select") {
      if (inRect(p, selBackRect())) { phase = "title"; return; }
      if (selIdx <= clearedMax + 1 && inRect(p, selStartBtn())) { startStage(selIdx); return; }
      if (selIdx <= clearedMax && inRect(p, selReviewBtn())) { startReview(selIdx); return; }
      for (let i = 0; i < CHAPTERS.length; i++) {
        const r = selCardRect(i);
        if (p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h+22) { selIdx = i; return; }   // 탭 = 포커스
      }
      return;
    }
    if (phase === "intro") { skipIntro(); return; }
    if (phase === "recall") { closeRecall(); return; }
    if (phase === "realize") { edge[" "] = true; return; }              // 탭하여 다음 줄
    if (phase === "branch" || phase === "choice") {                     // 선택지 탭 = 선택+결정
      const oy0 = phase === "branch" ? cv.height/2 + 2 : cv.height/2 - 14, w = 540, x = (cv.width - w)/2;
      for (let i = 0; i < 2; i++) { const oy = oy0 + i*70;
        if (p.x >= x && p.x <= x+w && p.y >= oy && p.y <= oy+56) {
          if (phase === "branch") branchSel = i; else choiceSel = i; edge[" "] = true; return; } }
      return;
    }
    if (phase === "ending") { edge[" "] = true; return; }
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
    if (phase === "title" || phase === "select") {       // 메뉴 호버 효과음
      const p = canvasXY(e); let hk = null;
      if (phase === "title") { if (inRect(p, titleStartRect())) hk = "t:start"; else if (clearedMax >= 0 && inRect(p, titleContinueRect())) hk = "t:cont"; else if (inRect(p, titleSelectRect())) hk = "t:sel"; }
      else { if (inRect(p, selBackRect())) hk = "s:back"; else if (inRect(p, selStartBtn())) hk = "s:start";
        else if (inRect(p, selReviewBtn())) hk = "s:rev"; else for (let i = 0; i < CHAPTERS.length; i++) { const r = selCardRect(i); if (p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h) { hk = "s:" + i; break; } } }
      if (hk !== hoverKey) { hoverKey = hk; if (hk && window.Audio2 && Audio2.sfx) try { Audio2.sfx("hover"); } catch (er) {} }
    }
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
    if (phase === "select") {                                   // 스테이지 선택 메뉴
      const cols = 5, n = CHAPTERS.length, pre = selIdx;
      if (edge["arrowleft"] || edge["a"]) selIdx = (selIdx + n - 1) % n;
      if (edge["arrowright"] || edge["d"]) selIdx = (selIdx + 1) % n;
      if (edge["arrowup"] || edge["w"]) selIdx = (selIdx - cols + n) % n;
      if (edge["arrowdown"] || edge["s"]) selIdx = (selIdx + cols) % n;
      if (selIdx !== pre && window.Audio2 && Audio2.sfx) try { Audio2.sfx("hover"); } catch (e) {}
      if (edge["escape"] || edge["tab"]) { if (window.Audio2 && Audio2.sfx) Audio2.sfx("select"); phase = "title"; clearEdges(); return; }
      if (edge[" "] || edge["enter"]) { if (selIdx <= clearedMax + 1) startStage(selIdx); }
      if (edge["r"] && selIdx <= clearedMax) startReview(selIdx);
      clearEdges(); return;
    }
    if (phase === "intro") { introT += dt; if (introT >= INTRO_END) endIntro(); clearEdges(); return; }
    if (phase === "transition") {
      transT += dt;
      if (hasNext && transT > 2.6) {                          // 다음 챕터 자동 로드(체이닝)
        loadStage(chapterIdx + 1); phase = "play"; veil = 0.8; showStageCard();
        if (window.Audio2 && Audio2.music) try { Audio2.music(D.music || "room"); } catch (e) {}
      } else if (!hasNext && transT > 1.2 && (edge[" "] || edge["enter"])) { gotoTitle(); }
      clearEdges(); return;
    }
    if (phase === "realize") {                          // 회상 몽타주: 한 줄씩(자동 ~4.2s 또는 키/탭)
      realizeT += dt;
      if (realizeReview && edge["escape"]) { realizeReview = false; realizeIllKey = null; openSelect(); clearEdges(); return; }
      if (edge[" "] || edge["enter"] || realizeT > 4.2) {
        realizeT = 0; realizeI++;
        if (realizeI >= realizeLines.length) {
          if (realizeReview) { realizeReview = false; realizeIllKey = null; openSelect(); }  // 시퀀스 보기 → 메뉴로
          else if (D.isFinal) { phase = "choice"; choiceSel = hope >= 0 ? 0 : 1; }   // 걸어온 마음이 기본값(희망→재회)
          else if (D.branch) { phase = "branch"; branchSel = 0; }                     // 중간 마음의 분기
          else beginTransition();
        } else if (window.Audio2 && Audio2.chime) try { Audio2.chime(); } catch (e) {}
      }
      clearEdges(); return;
    }
    if (phase === "branch") {                            // 중간 분기: 희망(0,+1) / 체념(1,−1)
      const pb2 = branchSel;
      if (edge["w"] || edge["s"] || edge["arrowup"] || edge["arrowdown"]) branchSel ^= 1;
      if (branchSel !== pb2 && window.Audio2 && Audio2.sfx) try { Audio2.sfx("hover"); } catch (e) {}
      if (edge[" "] || edge["enter"]) {
        hope += branchSel === 0 ? 1 : -1;
        const fb = (D.branch.options[branchSel] || {}).feedback;
        if (window.Audio2 && Audio2.sfx) Audio2.sfx("select");
        beginTransition(); if (fb) toasts.push({ text: fb, color: branchSel === 0 ? "#8ef548" : "#9fc5c5", t: 3.2 });
      }
      clearEdges(); return;
    }
    if (phase === "choice") {                            // 최종 선택: 찾아 나선다=재회(0) / 받아들인다=길고양이(1)
      const pc = choiceSel;
      if (edge["w"] || edge["s"] || edge["arrowup"] || edge["arrowdown"]) choiceSel ^= 1;
      if (choiceSel !== pc && window.Audio2 && Audio2.sfx) try { Audio2.sfx("hover"); } catch (e) {}
      if (edge[" "] || edge["enter"]) {
        endingType = choiceSel === 0 ? "reunite" : "stray"; phase = "ending"; transT = 0;
        if (window.Audio2) try { Audio2.drone(0); Audio2.heartbeat(0); if (Audio2.sfx) Audio2.sfx("select");
          if (Audio2.music) Audio2.music(endingType === "reunite" ? "ending_reunite" : "ending_stray"); } catch (e) {}
      }
      clearEdges(); return;
    }
    if (phase === "ending") { transT += dt;
      if (transT > 3.0) { if (edge["tab"]) { openSelect(); } else if (edge[" "] || edge["enter"]) { gotoTitle(); } }
      clearEdges(); return; }
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
        for (const m of murks.concat(echoes)) if (dist(player.x, player.y, m.x, m.y) <= AURA_R + 10) {
          m.chasing = false; m.warded = 2.0; m.lost = 0;
          const dd = dist(player.x, player.y, m.x, m.y) || 1;
          m.x += (m.x - player.x) / dd * 18; m.y += (m.y - player.y) / dd * 18;   // 한 번 밀어냄
        }
        // 보스 '공백' — 모은 기억(코어 3)이 다 모였을 때, 빛으로 비추면 갈라진다(가벼운 연출형)
        if (boss && !boss.dispelled && Core.chapterClear(st) && dist(player.x, player.y, boss.x, boss.y) <= AURA_R + 28) {
          boss.hp -= 1; boss.hit = 0.7; flash = 0.14; shake = 3;
          if (boss.hp <= 0) { boss.dispelled = true; boss.exitT = 1.4; toasts.push({ text: "공백이 흩어진다 — 빛만이 남는다", color: "#9af6f6", t: 2.4 }); }
          else toasts.push({ text: "기억의 빛이 공백을 갈라낸다  (" + (boss.max - boss.hp) + "/" + boss.max + ")", color: "#9af6f6", t: 2.0 });
        } else
        toasts.push({ text: "기억의 빛 — 그림자가 물러나 제자리로 돌아간다", color: "#9af6f6", t: 1.8 });
        if (window.Audio2 && Audio2.chime) try { Audio2.chime(); } catch (e) {}
      } else if (lowLightTip <= 0) { toasts.push({ text: "빛이 부족하다 — 기억을 모으거나 안전지대에서 회복", color: "#9fc5c5", t: 2.0 }); lowLightTip = 2.0; }
    }
    // 노출 창(revealT) 동안 근처 숨은 기억 표시
    if (revealT > 0) for (const s of shards) if (s.hidden && !isDone(s) && dist(player.x, player.y, shardCenter(s).x, shardCenter(s).y) <= 76) illuminated.add(s.id);

    // 발자국 추적(L) — 가장 가까운 미발견 코어로 시안 발자국 흔적(무료, 쿨다운)
    if (edge["l"]) lTutDone = true;
    if (trailCD > 0) trailCD -= dt;
    if (edge["l"] && trailCD <= 0) {
      let best = null, bd = 1e9;
      for (const s of shards) if (s.type === "core" && !isDone(s)) { const c = shardCenter(s), dd = dist(player.x, player.y, c.x, c.y); if (dd < bd) { bd = dd; best = c; } }
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

    // Echo (청각 감지) — 플레이어 소음(이동)으로 추적. 멈추거나 은신하면 안 들린다.
    const noiseR = !moving ? 0 : (stealth ? 26 : 74);   // 정지=무소음, 은신=작게, 일반=큼
    playerNoise = noiseR;
    for (const m of echoes) {
      if (m.warded > 0) m.warded -= dt;
      const warded = m.warded > 0;
      const heard = !warded && noiseR > 0 && dist(m.x, m.y, player.x, player.y) <= noiseR;
      if (heard) { m.chasing = true; m.lost = 0; m.tx = player.x; m.ty = player.y;
        if (!sawEcho) { sawEcho = true; toasts.push({ text: "속삭이는 잔상(Echo) — 소리로 쫓는다 · 멈추거나 은신하면 안 들린다", color: "#9af6f6", t: 3.4 }); } }
      else if (m.chasing) { m.lost += dt; if (m.lost > 1.8) m.chasing = false; }
      let ax, ay, spd;
      if (warded) { const w = nearestWp(m); ax = w.x; ay = w.y; spd = m.speed; }
      else if (m.chasing) { ax = m.tx; ay = m.ty; spd = m.speed * 1.2; danger = true;
        if (dist(m.x, m.y, m.tx, m.ty) < 5 && !heard) m.chasing = false; }   // 마지막 소리 지점 도착 + 무음 → 포기
      else { const w = m.patrol[m.wp]; ax = w.x; ay = w.y; spd = m.speed; if (dist(m.x, m.y, w.x, w.y) < 3) m.wp = (m.wp + 1) % m.patrol.length; }
      const d = dist(m.x, m.y, ax, ay) || 1, nx = (ax - m.x) / d, ny = (ay - m.y) / d;
      m.x += nx * spd * dt; m.y += ny * spd * dt;
      if (dist(m.x, m.y, player.x, player.y) < 11 && !warded && projInvuln <= 0) {
        if (Core.contact(st)) { flash = 0.18; shake = 4; if (window.Audio2) Audio2.sfx("contact"); }
      }
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
    for (const s of shards) {
      if (isDone(s)) continue;
      if (s.hidden && !illuminated.has(s.id)) continue;   // 숨은 조각은 비출 때만
      if (dist(player.x, player.y, shardCenter(s).x, shardCenter(s).y) < (s.radius||1.3) * TILE) { nearShard = s; break; }
    }
    if (edge["e"] && nearShard) doCollect(nearShard);

    // 직감(H) — 빛 소모 없이, 지금 무엇을 해야 하는지 한 줄만 알려준다(목표 알림). 위치는 안 보여줌.
    if (edge["h"]) {
      const got = st.coreOrder ? st.coreOrder.length : 0;
      hintMsg = (got >= st.coresNeeded) ? "충분해… 이제 출구를 찾자." : "아직 찾아야 할 기억이 남아있는 것 같다…";
      hintMsgT = 3.4;
    }
    if (hintMsgT > 0) hintMsgT -= dt;

    // 음소거
    if (edge["m"] && window.Audio2) { muted = !muted; Audio2.setMuted(muted); }

    // 위험 오디오
    if (window.Audio2) { Audio2.drone(danger ? 0.8 : 0); Audio2.heartbeat(st.mem <= 2 ? 96 : 0); }

    // 보스(공백) 틱 — 피격 점멸·해소 후 잠시 뒤 깨달음
    if (boss) {
      boss.t += dt; if (boss.hit > 0) boss.hit -= dt;
      if (boss.dispelled) { boss.exitT -= dt; if (boss.exitT <= 0) { beginRealize(); clearEdges(); return; } }
    }
    // 클리어 → 깨달음(회상 몽타주) → (최종) 선택/엔딩 또는 다음 챕터 전환
    if (!boss && Core.chapterClear(st) && door && dist(player.x, player.y, door.x, door.y) < 14) beginRealize();

    updateCamera();   // 플레이어 이동 후 카메라 추적
    updateAmbient(dt);
    if (stageCardT > 0) stageCardT -= dt;
    if (collectFx) { collectFx.t -= dt; if (collectFx.t <= 0) collectFx = null; }
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
    const cc = shardCenter(s); collectFx = { x: cc.x, y: cc.y, type: s.type, t: 0.55 };   // 수집 링 FX
    if (s.type === "false") { flash = 0.18; shake = 4; }
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
    ctx.scale(S, S); ctx.translate(-camX + sx, -camY + sy);   // 카메라 오프셋 적용

    if (!ready) { ctx.restore(); hudText("로딩…", cv.width/2, cv.height/2, "#34e2e2", 20, true); return; }

    // 배경 — 현재 챕터의 bgKey(room1/room2/room3) 사용
    const bg = IMG[D.bgKey] || IMG.room1;
    if (bg && bg.width) ctx.drawImage(bg, 0, 0, NW, NH);
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
    for (const s of shards) {
      if (isDone(s) || s.hidden) continue;
      const c = shardCenter(s), d = dist(player.x, player.y, c.x, c.y);
      if (d > 120) continue;
      const fal = s.type === "false";
      const a = Math.max(0.1, Math.min(0.55, 1 - d / 120)) * (0.6 + 0.4 * Math.sin(performance.now() / (fal ? 170 : 320)));
      ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = fal ? "#caa15a" : "#34e2e2"; ctx.shadowBlur = 5;
      ctx.fillStyle = fal ? "#caa15a" : "#34e2e2";
      ctx.beginPath(); ctx.arc(c.x, c.y - 1, fal ? 2.0 : 2.6, 0, 7); ctx.fill(); ctx.restore();
    }

    // 보스 '공백(The Blank)' — 거대한 자아 그림자. 코어 3 모으면 비추기로 해소(가벼운 연출형).
    if (boss && !boss.dispelled) {
      const ready = Core.chapterClear(st), r = 16 * (boss.hp / boss.max) + 12, pul = 0.5 + 0.5*Math.sin(boss.t*2.2);
      ctx.save();
      const g = ctx.createRadialGradient(boss.x, boss.y, 2, boss.x, boss.y, r+22);
      g.addColorStop(0, "rgba(18,14,32,0.96)"); g.addColorStop(0.55, "rgba(30,22,52,0.7)"); g.addColorStop(1, "rgba(18,14,32,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(boss.x, boss.y, r+22, 0, 7); ctx.fill();
      ctx.fillStyle = "#191228";
      for (const [ox, oy, rr] of [[0,0,r],[-r*0.5,2,r*0.6],[r*0.5,1,r*0.6],[0,-r*0.5,r*0.55]])   // 뭉치는 그림자
        { ctx.beginPath(); ctx.arc(boss.x+ox, boss.y+oy + Math.sin(boss.t*3+ox)*1.5, rr, 0, 7); ctx.fill(); }
      ctx.fillStyle = ready ? "#caa1ff" : "#7a5cff";                                              // 눈
      ctx.beginPath(); ctx.ellipse(boss.x-6, boss.y-3, 2.3, 3.4, 0, 0, 7); ctx.ellipse(boss.x+6, boss.y-3, 2.3, 3.4, 0, 0, 7); ctx.fill();
      if (ready) { ctx.globalAlpha = 0.4 + 0.45*pul; ctx.strokeStyle = "#9af6f6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(boss.x, boss.y, r+20, 0, 7); ctx.stroke(); }
      if (boss.hit > 0) { ctx.globalAlpha = Math.min(1, boss.hit/0.7); ctx.fillStyle = "rgba(154,246,246,0.55)"; ctx.beginPath(); ctx.arc(boss.x, boss.y, r+26, 0, 7); ctx.fill(); }
      ctx.restore();
    }

    // 근처 조각만 표시(글로우 OFF·3단 발견)
    if (nearShard && IMG.shard) {
      const c = shardCenter(nearShard);
      glow(() => ctx.drawImage(IMG.shard, c.x - IMG.shard.width/2, c.y - IMG.shard.height/2), "#34e2e2", 8);
      tag("조사 [E]", c.x, c.y - 14);
    }

    // 소음 고리 — 이동 시 소리가 퍼진다(Echo가 듣는 범위). 멈추면 사라짐.
    if (playerNoise > 0 && echoes.length) {
      const pr = playerNoise * (0.75 + 0.25 * Math.sin(performance.now() / 200));
      ctx.save(); ctx.globalAlpha = 0.16; ctx.strokeStyle = "#9af6f6"; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(player.x, player.y, pr, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }

    // y정렬: murk/echo/player
    const ents = [...murks.map(m => ({ y: m.y, m })), ...echoes.map(m => ({ y: m.y, ee: m })), { y: player.y, p: true }];
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
      } else if (e.ee) {
        const m = e.ee;                                         // Echo(청각): 시야콘 없음. 추격 시 붉은 고리.
        if (m.chasing) { ctx.save(); ctx.globalAlpha = 0.14; ctx.strokeStyle = "#ff7a7a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.x, m.y, 15, 0, 7); ctx.stroke(); ctx.restore(); }
        if (IMG.echo) glow(() => ctx.drawImage(IMG.echo, Math.round(m.x - IMG.echo.width/2), Math.round(m.y - IMG.echo.height/2)), m.chasing ? "#ff5a5a" : "#9af6f6", m.chasing ? 5 : 3);
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

    // (직감 H의 메시지는 HUD 단계에서 캔버스 px로 그린다 — drawGuide)

    // 조각 수집 링 — core 시안 / echo 흰빛 / false 차가운 황색(채도 빠짐)
    if (collectFx) {
      const f = collectFx.t / 0.55, t = 1 - f, rr = 6 + 22 * t;
      const col = collectFx.type === "core" ? "154,246,246" : collectFx.type === "false" ? "202,161,90" : "230,240,240";
      ctx.save(); ctx.globalAlpha = 0.7 * f; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(collectFx.x, collectFx.y - 2, rr, 0, 7); ctx.stroke();
      if (collectFx.type !== "false") { ctx.globalAlpha = 0.25 * f; ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(collectFx.x, collectFx.y - 2, rr*0.6, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    // 피격 플래시
    if (flash > 0) { ctx.fillStyle = `rgba(255,90,90,${Math.min(0.5, flash)})`; ctx.fillRect(0, 0, NW, NH); }

    ctx.restore();
    if (phase === "play" || phase === "recall") drawAmbient();
    drawHUD();
    if (phase === "play") { drawGuide(); if (stageCardT > 0) overlayStageCard(); }
    if (phase === "title") overlayTitle();
    if (phase === "select") overlaySelect();
    if (phase === "recall" && recall) overlayRecall();
    if (phase === "setback") overlayCenter("…어둡다. 여기는…", "#9ab", "방금 떠올린 기억이 다시 어둠에 잠겼다 · 같은 자리에서 되찾을 수 있다");
    if (phase === "cleared") overlayCenter("챕터 1 클리어 · 「지로의 방」", "#8ef548", "지로가 첫 기억들을 되찾았다.");
    if (phase === "intro") overlayIntro();
    if (phase === "realize") overlayRealize();
    if (phase === "branch") overlayBranch();
    if (phase === "choice") overlayChoice();
    if (phase === "ending") overlayEnding();
    if (phase === "transition") overlayTransition();
    if (phase === "journal" && window.Journal) { try {
      const meta = { idx: chapterIdx, clearedMax, hope, stages: CHAPTERS.map((k, i) => ({
        title: DATA[k].title, epiphany: DATA[k].epiphany || [], cleared: i <= clearedMax, current: i === chapterIdx })) };
      Journal.draw(ctx, cv, st, D, IMG, meta);
    } catch (e) { console.error(e); } }
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
      const usesLight = (b.id === "q");          // 비추기만 빛 소모. 직감(H)은 무료.
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
      ctx.fillText("CHAPTER " + (chapterIdx + 1) + " · 클리어", cv.width / 2, cv.height / 2 - 12);
      ctx.fillStyle = "#eafaff"; ctx.font = "20px 'Noto Sans KR',sans-serif";
      ctx.fillText("「" + (D.title || "") + "」", cv.width / 2, cv.height / 2 + 22);
      ctx.fillStyle = "#9fb6b6"; ctx.font = "14px 'Noto Sans KR',sans-serif";
      ctx.fillText(hasNext ? "지로가 첫 기억들을 되찾았다 — 다음 이야기로…" : "지로가 첫 기억들을 되찾았다.", cv.width / 2, cv.height / 2 + 54);
      if (!hasNext) { ctx.fillStyle = "#8ef548"; ctx.font = "13px 'Noto Sans KR',sans-serif"; ctx.fillText("[Space] 처음으로", cv.width / 2, cv.height / 2 + 86); }
    }
    ctx.restore();
  }

  // 스테이지 진입 장소 카드 — 화면 정중앙 대형 타이포(페이드 인/아웃)
  function overlayStageCard() {
    const total = 2.6, t = stageCardT;
    const a = t > total - 0.4 ? (total - t) / 0.4 : t < 0.7 ? t / 0.7 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.textAlign = "center";
    const cy = cv.height / 2;
    const g = ctx.createLinearGradient(0, cy - 78, 0, cy + 78);
    g.addColorStop(0, "rgba(4,7,11,0)"); g.addColorStop(0.5, "rgba(4,7,11,0.6)"); g.addColorStop(1, "rgba(4,7,11,0)");
    ctx.fillStyle = g; ctx.fillRect(0, cy - 78, cv.width, 156);
    ctx.fillStyle = "#34e2e2"; ctx.font = "bold 19px 'Noto Sans KR',sans-serif";
    ctx.fillText("STAGE " + (chapterIdx + 1), cv.width / 2, cy - 20);
    ctx.shadowColor = "rgba(52,226,226,0.5)"; ctx.shadowBlur = 16;
    ctx.fillStyle = "#eafaff"; ctx.font = "bold 46px 'Noto Sans KR',sans-serif";
    ctx.fillText(D.title || "", cv.width / 2, cy + 28); ctx.shadowBlur = 0;
    ctx.globalAlpha *= 0.6; ctx.strokeStyle = "#34e2e2"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cv.width/2 - 80, cy + 46); ctx.lineTo(cv.width/2 + 80, cy + 46); ctx.stroke();
    ctx.restore();
  }

  // 원화를 화면 가득(cover) 그린다 + 상·하단 스크림(텍스트 가독)
  function drawIllCover(img, alpha) {
    ctx.fillStyle = "#04070b"; ctx.fillRect(0, 0, cv.width, cv.height);
    if (img && img.width) {
      const r = Math.max(cv.width / img.width, cv.height / img.height), w = img.width*r, h = img.height*r;
      ctx.save(); ctx.globalAlpha = alpha; const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, (cv.width - w)/2, (cv.height - h)/2, w, h); ctx.imageSmoothingEnabled = sm; ctx.restore();
    }
  }
  function scrim(yTop, yBot, a0, a1) {
    ctx.save(); const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, "rgba(3,5,9," + a0 + ")"); g.addColorStop(1, "rgba(3,5,9," + a1 + ")");
    ctx.fillStyle = g; ctx.fillRect(0, yTop, cv.width, yBot - yTop); ctx.restore();
  }

  // 깨달음(회상 몽타주) — 풀스크린 원화 + 하단 텍스트
  function overlayRealize() {
    ctx.save();
    const line = realizeLines[Math.min(realizeI, realizeLines.length - 1)];
    if (!line) { ctx.fillStyle = "#04070b"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); return; }
    const epi = line.kind === "epiphany", appear = Math.min(1, realizeT / 0.8);
    drawIllCover(ILLIMG[realizeIllKey] || stageIll(), 0.55 + 0.45*appear);   // 풀스크린 키아트
    scrim(cv.height - 230, cv.height, 0, 0.92); scrim(0, 70, 0.55, 0);       // 하단 텍스트존 + 상단 살짝
    const baseY = cv.height - 150;
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.85 * appear; ctx.fillStyle = epi ? "#8ef548" : "#34e2e2"; ctx.font = "14px 'Noto Sans KR',sans-serif";
    ctx.fillText(epi ? "— 깨달음 —" : "— 되찾은 기억 —", cv.width/2, baseY);
    ctx.globalAlpha = appear; ctx.fillStyle = epi ? "#eafaff" : "#dff1f1";
    ctx.font = (epi ? "bold 22px" : "20px") + " 'Noto Sans KR',sans-serif";
    wrapCenter(line.text, cv.width/2, baseY + 34, cv.width - 180, 30);
    const n = realizeLines.length, dotY = cv.height - 42;
    for (let i = 0; i < n; i++) { ctx.globalAlpha = i <= realizeI ? 0.95 : 0.3;
      ctx.fillStyle = i <= realizeI ? (realizeLines[i].kind === "epiphany" ? "#8ef548" : "#34e2e2") : "#27343a";
      ctx.beginPath(); ctx.arc(cv.width/2 - (n-1)*7 + i*14, dotY, 3, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 0.55; ctx.fillStyle = "#7f9b9b"; ctx.font = "12px 'Noto Sans KR',sans-serif";
    ctx.fillText(realizeReview ? "아무 키 / 클릭 — 계속  ·  [Esc] 메뉴" : "아무 키 / 클릭 — 계속", cv.width/2, cv.height - 22);
    ctx.restore();
  }

  // 두 선택지 카드 공통 렌더
  function drawOptionCards(opts, sel, oy0) {
    for (let i = 0; i < 2; i++) {
      const oy = oy0 + i*70, s = sel === i, w = 540, x = (cv.width - w)/2;
      ctx.fillStyle = s ? "rgba(52,226,226,.14)" : "rgba(10,16,20,.72)"; rrect(x, oy, w, 56, 10); ctx.fill();
      ctx.strokeStyle = s ? opts[i].c : "#27343a"; ctx.lineWidth = s ? 2.5 : 1; rrect(x, oy, w, 56, 10); ctx.stroke();
      ctx.textAlign = "center"; ctx.fillStyle = s ? "#eafaff" : "#9fb6b6"; ctx.font = "bold 20px 'Noto Sans KR',sans-serif";
      ctx.fillText(opts[i].t, cv.width/2, oy + 25);
      ctx.fillStyle = "#7f9b9b"; ctx.font = "13px 'Noto Sans KR',sans-serif"; ctx.fillText(opts[i].s, cv.width/2, oy + 45);
    }
  }

  // 중간 분기 — 마음의 갈림(희망/체념). D.branch = {q, options:[{label,sub,feedback},...]}
  function overlayBranch() {
    const B = D.branch; if (!B) return;
    ctx.save(); ctx.fillStyle = "#05070c"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.textAlign = "center"; ctx.fillStyle = "#9fb6b6"; ctx.font = "14px 'Noto Sans KR',sans-serif";
    ctx.fillText("— 마음의 갈림 —", cv.width/2, cv.height/2 - 96);
    ctx.fillStyle = "#eafaff"; ctx.font = "bold 22px 'Noto Sans KR',sans-serif";
    wrapCenter(B.q, cv.width/2, cv.height/2 - 56, cv.width - 220, 30);
    drawOptionCards([
      { t: B.options[0].label, s: B.options[0].sub, c: "#8ef548" },
      { t: B.options[1].label, s: B.options[1].sub, c: "#34e2e2" }
    ], branchSel, cv.height/2 + 2);
    ctx.fillStyle = "#5a7375"; ctx.font = "13px 'Noto Sans KR',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("↑↓ / W S 선택   ·   [Space] 결정", cv.width/2, cv.height - 34);
    ctx.restore();
  }

  // 최종 선택 — 찾아 나선다(재회) / 받아들인다(새 삶). 걸어온 '마음'이 기본값을 비춘다.
  function overlayChoice() {
    ctx.save();
    ctx.fillStyle = "#05070c"; ctx.fillRect(0, 0, cv.width, cv.height);
    const t = performance.now() / 1000;
    ctx.globalAlpha = 0.5 + 0.18 * Math.sin(t * 1.4);
    const g = ctx.createRadialGradient(cv.width/2, cv.height/2 - 40, 8, cv.width/2, cv.height/2 - 40, 240);
    g.addColorStop(0, "rgba(154,246,246,0.10)"); g.addColorStop(1, "rgba(5,7,12,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cv.width/2, cv.height/2 - 40, 240, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.textAlign = "center";
    ctx.fillStyle = "#9fb6b6"; ctx.font = "15px 'Noto Sans KR',sans-serif";
    ctx.fillText("공백이 옅어지자, 두 갈래 길이 환하게 열린다.", cv.width/2, cv.height/2 - 116);
    ctx.fillStyle = "#eafaff"; ctx.font = "bold 24px 'Noto Sans KR',sans-serif";
    ctx.fillText("이제, 어디로 가겠는가?", cv.width/2, cv.height/2 - 78);
    drawOptionCards([
      { t: "다시 만나러", s: "공백 너머로 — 끝까지 하루를 찾아 나선다", c: "#8ef548" },
      { t: "여기를 떠나", s: "이 자리를 두고 — 새 온기 속에서 살아간다", c: "#34e2e2" }
    ], choiceSel, cv.height/2 - 14);
    const mind = hope > 0 ? "여기까지 걸어온 길이, 다시 만나러 가는 발끝을 비춘다" : hope < 0 ? "여기까지 걸어온 길이, 이 자리를 떠나는 발끝을 비춘다" : "마음은, 아직 어느 쪽도 아니다";
    ctx.fillStyle = "#6b8a8c"; ctx.font = "13px 'Noto Sans KR',sans-serif"; ctx.fillText(mind, cv.width/2, cv.height/2 + 132);
    ctx.fillStyle = "#5a7375"; ctx.fillText("↑↓ / W S 선택   ·   [Space] 결정", cv.width/2, cv.height - 32);
    ctx.restore();
  }

  // 엔딩 — 재회(reunite, 따뜻한 그린) / 새 삶(stray, 차분한 시안 새벽). 둘 다 비극 아님.
  function overlayEnding() {
    const re = endingType === "reunite", fade = Math.min(1, transT / 1.4);
    ctx.save();
    const g = ctx.createRadialGradient(cv.width/2, cv.height/2, 20, cv.width/2, cv.height/2, cv.height);
    if (re) { g.addColorStop(0, "rgba(26,36,18,1)"); g.addColorStop(1, "rgba(6,10,6,1)"); }
    else    { g.addColorStop(0, "rgba(16,30,36,1)"); g.addColorStop(1, "rgba(5,9,12,1)"); }
    ctx.fillStyle = g; ctx.globalAlpha = fade; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1;
    // 엔딩 원화 — 풀스크린 + 하단 텍스트 스크림
    drawIllCover(ILLIMG[endingType], fade); scrim(cv.height - 250, cv.height, 0, 0.93);
    if (transT < 1.0) { ctx.restore(); return; }
    const ap = Math.min(1, (transT - 1.0) / 1.0); ctx.globalAlpha = ap; ctx.textAlign = "center";
    const ty = cv.height - 188;                                          // 텍스트 안착(원화 패널 아래)
    if (re) {
      ctx.fillStyle = "#8ef548"; ctx.font = "16px 'Noto Sans KR',sans-serif";
      ctx.fillText("— 재회 엔딩 —", cv.width/2, ty);
      ctx.fillStyle = "#eafaff"; ctx.font = "18px 'Noto Sans KR',sans-serif";
      wrapCenter("끊겼던 발자국 끝에서, 익숙한 발소리가 다가온다.", cv.width/2, ty + 30, cv.width - 200, 26);
      ctx.fillStyle = "#9fc5c5"; ctx.font = "15px 'Noto Sans KR',sans-serif";
      ctx.fillText("나를 부르는 그 목소리 — 더는 흐리지 않다. 또렷하다.", cv.width/2, ty + 60);
    } else {
      ctx.fillStyle = "#34e2e2"; ctx.font = "16px 'Noto Sans KR',sans-serif";
      ctx.fillText("— 새 아침 엔딩 —", cv.width/2, ty);
      ctx.fillStyle = "#eafaff"; ctx.font = "18px 'Noto Sans KR',sans-serif";
      wrapCenter("나는 이 자리를 떠나기로 했다. 기다림이 아니라, 걸음으로.", cv.width/2, ty + 30, cv.width - 200, 26);
      ctx.fillStyle = "#9fc5c5"; ctx.font = "15px 'Noto Sans KR',sans-serif";
      ctx.fillText("하루가 길고양이들에게 물을 내주던 그 마음을, 이제 내가 잇는다.", cv.width/2, ty + 60);
    }
    const np = Math.min(1, (transT - 2.4) / 1.0);
    if (np > 0) {
      ctx.globalAlpha = np; ctx.shadowColor = "#34e2e2"; ctx.shadowBlur = 24;
      ctx.fillStyle = "#9bf24a"; ctx.font = "bold 38px 'Noto Sans KR',sans-serif";
      ctx.fillText("지로  ·  Ziro", cv.width/2, ty + 100); ctx.shadowBlur = 0;
      ctx.fillStyle = "#cfe6e6"; ctx.font = "14px 'Noto Sans KR',sans-serif";
      ctx.fillText(re ? "하루가 다시, 내 이름을 부른다." : "어디에 있든 — 나는, 나다.", cv.width/2, ty + 126);
    }
    // 명확한 종료 표식 — '엔딩'임을 분명히(다음 스테이지 없음)
    const fin = Math.min(1, (transT - 3.0) / 0.8);
    if (fin > 0) {
      ctx.globalAlpha = fin; ctx.letterSpacing = "6px";
      ctx.fillStyle = re ? "#8ef548" : "#34e2e2"; ctx.font = "bold 22px 'Noto Sans KR',sans-serif";
      ctx.fillText("막 — THE END", cv.width/2, 64); ctx.letterSpacing = "0px";
      ctx.globalAlpha = fin * (0.6 + 0.4 * Math.sin(performance.now() / 420));
      ctx.fillStyle = "#cfe6e6"; ctx.font = "14px 'Noto Sans KR',sans-serif";
      ctx.fillText("플레이해 주셔서 고맙습니다.   [Space] 처음 화면으로     ·     [Tab] 스테이지 선택", cv.width/2, cv.height - 26);
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
    ctx.fillText("빛 " + Math.floor(st.light||0) + "   [Q]비추기 · [H]직감", 132, 56);
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
    if (keys["shift"]) { ctx.save(); ctx.textAlign = "center"; ctx.font = "bold 12px 'Noto Sans KR',sans-serif"; ctx.fillStyle = "#7fb0b3"; ctx.fillText("은신 중", toSX(player.x), toSY(player.y) - 42); ctx.restore(); }
    // 상단 중앙: STAGE N. 장소명 (상시 표시)
    ctx.save(); ctx.textAlign = "center";
    const sLabel = "STAGE " + (chapterIdx + 1) + ".  " + (D.title || "");
    ctx.font = "bold 13px 'Noto Sans KR',sans-serif"; const slw = ctx.measureText(sLabel).width + 28;
    ctx.fillStyle = "rgba(8,14,18,.7)"; rrect((W - slw)/2, 8, slw, 22, 7); ctx.fill();
    ctx.fillStyle = "#9af6f6"; ctx.fillText(sLabel, W/2, 23); ctx.restore();
    // 목표 배너(상단 중앙)
    ctx.save();
    const bw = 380, bx = (W - bw) / 2, by = 38;
    ctx.fillStyle = "rgba(8,14,18,.82)"; rrect(bx, by, bw, 34, 10); ctx.fill();
    ctx.textAlign = "left"; ctx.font = "bold 14px 'Noto Sans KR',sans-serif";
    if (done && boss) { ctx.fillStyle = "#9af6f6"; ctx.textAlign = "center"; ctx.fillText("[Q] 모은 기억의 빛으로 공백을 비춰라", W / 2, by + 22); }
    else if (done) { ctx.fillStyle = "#34e2e2"; ctx.textAlign = "center"; ctx.fillText("문이 열렸다 — 위쪽 ↑ 문으로 가라", W / 2, by + 22); }
    else {
      ctx.fillStyle = "#eafaff"; ctx.fillText(boss ? "목표 · 기억을 모아 공백을 마주하라" : "목표 · 코어 기억 모으기", bx + 14, by + 22);
      const dotx = bx + 200;
      for (let i = 0; i < need; i++) { ctx.beginPath(); ctx.arc(dotx + i * 20, by + 16, 6, 0, 7); ctx.fillStyle = i < cores ? "#8ef548" : "#27343a"; ctx.fill(); }
      ctx.fillStyle = "#9fc5c5"; ctx.font = "12px 'Noto Sans KR',sans-serif"; ctx.fillText("빛나는 기억에 다가가 [E]", dotx + need * 20 + 8, by + 22);
    }
    ctx.restore();
    // 클리어 시 문 방향 화살표(상단) — 보스 스테이지는 제외
    if (done && door && !boss) { ctx.save(); ctx.textAlign = "center"; ctx.font = "bold 26px sans-serif"; ctx.fillStyle = "#34e2e2";
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 200); ctx.fillText("↑", clamp(toSX(door.x), 30, cv.width - 30), 72); ctx.restore(); }
    // 진행 토스트(좌상단 코어 카운터 아래)
    let ty = 92; ctx.save(); ctx.textAlign = "left"; ctx.font = "bold 14px 'Noto Sans KR',sans-serif";
    for (const t of toasts) { const a = Math.min(1, t.t); ctx.globalAlpha = a;
      const tw = ctx.measureText(t.text).width + 20;
      ctx.fillStyle = "rgba(8,14,18,.88)"; rrect(14, ty, tw, 24, 8); ctx.fill();
      ctx.globalAlpha = a; ctx.fillStyle = t.color; ctx.fillText(t.text, 24, ty + 16); ty += 28; }
    ctx.restore();
    // L 코치마크(첫 코어 전, 무입력 후) — 빈 방 문제 직격
    if (cores === 0 && elapsed > 3 && !lTutDone && trail.length === 0) {
      const spx = toSX(player.x), spy = toSY(player.y);
      ctx.save(); ctx.textAlign = "center"; ctx.font = "bold 13px 'Noto Sans KR',sans-serif";
      const txt = "[L] 발자국 추적 — 기억의 흔적을 따라가자";
      const tw = ctx.measureText(txt).width + 20;
      ctx.fillStyle = "rgba(8,14,18,.92)"; rrect(spx - tw / 2, spy - 74, tw, 26, 8); ctx.fill();
      ctx.fillStyle = "#8ef548"; ctx.fillText(txt, spx, spy - 56); ctx.restore();
    }
    // 직감(H) 목표 메시지 — 텍스트 창(위치는 안 알려주고 '무엇을 할지'만)
    if (hintMsgT > 0) {
      ctx.save(); ctx.textAlign = "center"; ctx.font = "16px 'Noto Sans KR',sans-serif";
      const bw = Math.max(280, ctx.measureText(hintMsg).width + 44), bx = (W - bw) / 2, by = Math.round(cv.height * 0.6);
      ctx.globalAlpha = Math.min(1, hintMsgT / 0.6);
      ctx.fillStyle = "rgba(6,12,16,.9)"; rrect(bx, by, bw, 42, 10); ctx.fill();
      ctx.strokeStyle = "#34e2e2"; ctx.lineWidth = 1.5; rrect(bx, by, bw, 42, 10); ctx.stroke();
      ctx.fillStyle = "#cfe6e6"; ctx.fillText(hintMsg, W / 2, by + 26); ctx.restore();
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

  function menuButton(r, label, sub, hovered, enabled, accent) {
    ctx.save(); ctx.globalAlpha = enabled ? 1 : 0.4;
    ctx.fillStyle = hovered ? "rgba(52,226,226,.20)" : "rgba(8,14,20,.74)"; rrect(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = hovered ? "#9af6f6" : (accent || "#2a6e72"); ctx.lineWidth = hovered ? 2.5 : 1.5; rrect(r.x, r.y, r.w, r.h, 10); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillStyle = hovered ? "#eafaff" : "#cfe6e6"; ctx.font = "bold 17px 'Noto Sans KR',sans-serif";
    ctx.fillText(label, r.x + r.w/2, r.y + (sub ? r.h/2 : r.h/2 + 6));
    if (sub) { ctx.fillStyle = "#7f9b9b"; ctx.font = "11px 'Noto Sans KR',sans-serif"; ctx.fillText(sub, r.x + r.w/2, r.y + r.h - 7); }
    ctx.restore();
  }
  function overlayTitle() {
    ctx.save();
    drawIllCover(ILLIMG.title, 1);                                       // 서정적 타이틀 일러스트(풀스크린)
    scrim(0, cv.height, 0.25, 0.55); scrim(cv.height - 240, cv.height, 0, 0.5);
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(52,226,226,0.55)"; ctx.shadowBlur = 26;
    ctx.fillStyle = "#eafaff"; ctx.font = "bold 52px 'Noto Sans KR',sans-serif";
    ctx.fillText("잊혀진 발자국", cv.width/2, cv.height/2 - 60); ctx.shadowBlur = 0;
    ctx.fillStyle = "#9af6f6"; ctx.font = "16px 'Noto Sans KR',sans-serif"; ctx.letterSpacing = "3px";
    ctx.fillText("L O S T   P A W P R I N T", cv.width/2, cv.height/2 - 30); ctx.letterSpacing = "0px";
    ctx.fillStyle = "#bcd6d6"; ctx.font = "14px 'Noto Sans KR',sans-serif";
    ctx.fillText("기억을 잃은 검은 고양이 지로, 흐려진 발자국을 따라 하루를 찾아서", cv.width/2, cv.height/2 - 2);
    // 메뉴 버튼들
    const has = clearedMax >= 0;
    menuButton(titleStartRect(), "▶  처음부터", "아무 키로도 시작", hoverKey === "t:start", true, "#8ef548");
    menuButton(titleContinueRect(), has ? "이어하기 — STAGE " + (Math.min(clearedMax + 1, CHAPTERS.length - 1) + 1) : "이어하기", has ? null : "아직 진행 없음", hoverKey === "t:cont", has, "#34e2e2");
    menuButton(titleSelectRect(), "스테이지 선택  ·  [Tab]", "클리어한 장면 다시 보기 (" + Math.max(0, clearedMax + 1) + "/" + CHAPTERS.length + ")", hoverKey === "t:sel", true, "#34e2e2");
    ctx.restore();
  }

  // 스테이지 선택 — 클리어/잠금/다음 카드 그리드 + 시작/시퀀스 버튼
  function overlaySelect() {
    ctx.save();
    ctx.fillStyle = "#060a0f"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.textAlign = "center"; ctx.fillStyle = "#eafaff"; ctx.font = "bold 30px 'Noto Sans KR',sans-serif";
    ctx.fillText("스테이지 선택", cv.width/2, 64);
    ctx.fillStyle = "#34e2e2"; ctx.font = "14px 'Noto Sans KR',sans-serif";
    ctx.fillText("클리어한 장면을 다시 보거나, 그 지점부터 다시 시작합니다", cv.width/2, 90);
    const bk = selBackRect(); ctx.fillStyle = "rgba(10,16,20,.8)"; rrect(bk.x, bk.y, bk.w, bk.h, 8); ctx.fill();
    ctx.strokeStyle = "#2a4a4e"; ctx.lineWidth = 1.5; rrect(bk.x, bk.y, bk.w, bk.h, 8); ctx.stroke();
    ctx.fillStyle = "#9fc5c5"; ctx.font = "13px 'Noto Sans KR',sans-serif"; ctx.fillText("← 뒤로", bk.x + bk.w/2, bk.y + 20);
    for (let i = 0; i < CHAPTERS.length; i++) {
      const r = selCardRect(i), cleared = i <= clearedMax, avail = i === clearedMax + 1, locked = i > clearedMax + 1, foc = selIdx === i;
      ctx.save(); rrect(r.x, r.y, r.w, r.h, 8); ctx.clip();
      const img = ILLIMG["s" + (i + 1)];
      if (!locked && img && img.width) { const rr = Math.max(r.w/img.width, r.h/img.height), w = img.width*rr, h = img.height*rr;
        const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(img, r.x+(r.w-w)/2, r.y+(r.h-h)/2, w, h); ctx.imageSmoothingEnabled = sm;
      } else { ctx.fillStyle = "#0c1014"; ctx.fillRect(r.x, r.y, r.w, r.h); }
      if (locked) { ctx.fillStyle = "rgba(4,6,10,.8)"; ctx.fillRect(r.x, r.y, r.w, r.h); }
      else if (avail) { ctx.fillStyle = "rgba(4,6,10,.3)"; ctx.fillRect(r.x, r.y, r.w, r.h); }
      ctx.restore();
      ctx.strokeStyle = foc ? "#34e2e2" : cleared ? "#2a6e72" : "#243036"; ctx.lineWidth = foc ? 3 : 1.5; rrect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
      ctx.textAlign = "left"; ctx.fillStyle = locked ? "#5a7375" : "#eafaff"; ctx.font = "bold 14px 'Noto Sans KR',sans-serif";
      ctx.fillText(("0" + (i + 1)).slice(-2), r.x + 8, r.y + 20);
      if (cleared) { ctx.fillStyle = "#8ef548"; ctx.font = "bold 16px 'Noto Sans KR',sans-serif"; ctx.fillText("✓", r.x + r.w - 20, r.y + 21); }
      else if (avail) { ctx.fillStyle = "#34e2e2"; ctx.font = "bold 11px 'Noto Sans KR',sans-serif"; ctx.fillText("NEW", r.x + r.w - 32, r.y + 20); }
      else { ctx.textAlign = "center"; ctx.fillStyle = "#56707a"; ctx.font = "13px 'Noto Sans KR',sans-serif"; ctx.fillText("잠김", r.x + r.w/2, r.y + r.h/2 + 5); }
      ctx.textAlign = "center"; ctx.fillStyle = locked ? "#5a7375" : foc ? "#eafaff" : "#bcd6d6"; ctx.font = "13px 'Noto Sans KR',sans-serif";
      ctx.fillText(locked ? "???" : "「" + (DATA[CHAPTERS[i]].title || "") + "」", r.x + r.w/2, r.y + r.h + 18);
    }
    // 포커스 액션 버튼
    const cleared = selIdx <= clearedMax, avail = selIdx === clearedMax + 1;
    const sb = selStartBtn(); ctx.save(); ctx.globalAlpha = (cleared || avail) ? 1 : 0.4;
    ctx.fillStyle = "rgba(52,226,226,.16)"; rrect(sb.x, sb.y, sb.w, sb.h, 9); ctx.fill();
    ctx.strokeStyle = "#34e2e2"; ctx.lineWidth = 2; rrect(sb.x, sb.y, sb.w, sb.h, 9); ctx.stroke();
    ctx.fillStyle = "#eafaff"; ctx.font = "bold 15px 'Noto Sans KR',sans-serif"; ctx.textAlign = "center";
    ctx.fillText(cleared ? "▶ 여기서 다시 시작" : "▶ 시작", sb.x + sb.w/2, sb.y + 24); ctx.restore();
    const rb = selReviewBtn(); ctx.save(); ctx.globalAlpha = cleared ? 1 : 0.3;
    ctx.fillStyle = "rgba(142,245,72,.12)"; rrect(rb.x, rb.y, rb.w, rb.h, 9); ctx.fill();
    ctx.strokeStyle = "#8ef548"; ctx.lineWidth = 2; rrect(rb.x, rb.y, rb.w, rb.h, 9); ctx.stroke();
    ctx.fillStyle = "#d6ff9a"; ctx.font = "bold 15px 'Noto Sans KR',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("↻ 시퀀스 다시 보기", rb.x + rb.w/2, rb.y + 24); ctx.restore();
    ctx.textAlign = "center"; ctx.fillStyle = "#5a7375"; ctx.font = "12px 'Noto Sans KR',sans-serif";
    ctx.fillText("← → ↑ ↓ 이동   ·   [Space] 시작   ·   [R] 시퀀스   ·   [Esc] 뒤로", cv.width/2, cv.height - 20);
    ctx.restore();
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
  // 중앙 정렬 줄바꿈(세로 중앙) — 회상/엔딩 본문용. 호출 전 textAlign='center' 가정.
  function wrapCenter(t, cx, y, maxw, lh) {
    const words = (t||"").split(/\s+/); const lines = []; let line = "";
    for (const w of words) { const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxw && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line);
    let yy = y - (lines.length - 1) * lh / 2;
    for (const l of lines) { ctx.fillText(l, cx, yy); yy += lh; }
  }

  // ── 루프 ──────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) { let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
    try { update(dt); } catch (e) { console.error(e); }
    draw(); requestAnimationFrame(frame); }
  // 디버그 스냅샷(테스트용, 무해): 상태 읽기 전용
  if (typeof window !== 'undefined') {
    window.__ziro = () => ({ phase, px: player.x, py: player.y, mem: st ? st.mem : 0, ch: chapterIdx,
                             camX, camY, nw: NW, nh: NH, realizeI, realizeLen: realizeLines.length, choiceSel, endingType });
    window.__loadStage = (i) => { loadStage(i); phase = "play"; };
    window.__debugClear = () => { for (const s of shards) if (s.type === "core") Core.collect(st, s); if (boss) boss.dispelled = true; beginRealize(); };  // 테스트용
    window.__hope = (v) => { if (typeof v === "number") hope = v; return hope; };
    window.__collectCores = () => { for (const s of shards) if (s.type === "core") Core.collect(st, s); };  // 보스 테스트용(해소 안 함)
    window.__layoutCheck = () => { const occ = (c,r) => D.collision.some(q => c>=q[0]&&c<q[0]+q[2]&&r>=q[1]&&r<q[1]+q[3]); let bad = 0;
      for (const s of shards) if (occ(s.tile[0], s.tile[1])) bad++;
      for (const m of murks.concat(echoes)) for (const p of m.patrol) if (occ(Math.round((p.x-TILE/2)/TILE), Math.round((p.y-TILE/2)/TILE))) bad++;
      return { bad, shards: shards.length, idx: chapterIdx }; };
    window.__boss = () => boss ? { hp: boss.hp, dispelled: boss.dispelled } : null;
    window.__title = () => gotoTitle();
    window.__sel = () => ({ phase, selIdx, clearedMax });
  }
  loadProgress();               // 저장된 클리어 진행 로드(스테이지 선택 해금)
  loadStage(0);                 // 첫 챕터 초기화(맵·엔티티·상태)
  requestAnimationFrame(frame);
})();
