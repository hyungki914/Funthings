/* main.js — 통합부(렌더·입력·루프·HUD). 전역 ASSETS / Core / DATA / Audio2 사용. */
(function () {
  "use strict";
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const D = DATA.chapter1;
  const TILE = D.tile, NW = D.cols * TILE, NH = D.rows * TILE;   // 네이티브 352x224
  const S = Math.max(1, Math.floor(cv.width / NW));               // 정수 스케일(=3)
  const C = Core.C;

  // ── 에셋 로드 ──────────────────────────────────────────────
  const IMG = {}; let toLoad = 0, loaded = 0, ready = false;
  for (const k in ASSETS) {
    toLoad++; const im = new Image();
    im.onload = () => { if (++loaded >= toLoad) ready = true; };
    im.onerror = () => { if (++loaded >= toLoad) ready = true; };
    im.src = ASSETS[k]; IMG[k] = im;
  }

  // ── 상태 ──────────────────────────────────────────────────
  let phase = "title";                  // title | play | recall | setback | cleared
  const st = Core.newState(D);
  const px = (t) => t * TILE + TILE / 2;
  const player = { x: px(D.spawn[0]), y: px(D.spawn[1]), vx: 0, vy: 0, dir: Math.PI/2,
                   facing: "down", flip: false, animT: 0, frame: 0, step: 0, w: 10, h: 8 };
  const colls = D.collision.map(([c, r, w, h]) => ({ x: c*TILE, y: r*TILE, w: w*TILE, h: h*TILE }));
  const safes = (D.safeZones||[]).map(([c, r, w, h]) => ({ x: c*TILE, y: r*TILE, w: w*TILE, h: h*TILE }));
  const door = D.door ? { x: px(D.door.tile[0]), y: px(D.door.tile[1]) } : null;
  const murks = (D.murks||[]).map(m => ({
    id:m.id, wp:0, x:px(m.patrol[0][0]), y:px(m.patrol[0][1]),
    patrol:m.patrol.map(p=>({x:px(p[0]),y:px(p[1])})),
    speed:m.speed||38, sightPx:(m.sightTiles||3.3)*TILE, fov:(m.fovDeg||90)*Math.PI/180,
    faceAngle:0, chasing:false, lost:0 }));
  let recall = null, hintTimer = 0, hintTarget = null, setbackT = 0, flash = 0, muted = false, shake = 0;
  let trail = [], trailCD = 0, projecting = false; const illuminated = new Set();

  // ── 입력 ──────────────────────────────────────────────────
  const keys = {}; const edge = {};
  function setKey(e, v) {
    const k = (e.key || "").toLowerCase();   // 모든 키 소문자 정규화(shift/arrow/tab 포함)
    if (v && !keys[k]) edge[k] = true;
    keys[k] = v;
    if (["arrowup","arrowdown","arrowleft","arrowright"," ","tab"].includes(k) && e.preventDefault) e.preventDefault();
  }
  addEventListener("keydown", e => setKey(e, true));
  addEventListener("keyup", e => setKey(e, false));
  cv.addEventListener("mousedown", () => { firstGesture(); if (phase === "title") phase = "play"; else if (phase === "recall") closeRecall(); });
  function firstGesture() { try { if (window.Audio2) { Audio2.init(); Audio2.ambient(true); } } catch (e) {} }
  addEventListener("keydown", firstGesture, { once: true });
  function clearEdges() { for (const k in edge) edge[k] = false; }

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
    if (phase === "recall") { if (edge[" "] || edge["enter"]) closeRecall(); return; }
    if (phase === "setback") { setbackT -= dt; if (setbackT <= 0) phase = "play"; clearEdges(); return; }
    if (phase === "journal") { if (edge["tab"] || edge["escape"]) phase = "play"; clearEdges(); return; }
    if (edge["tab"]) { phase = "journal"; clearEdges(); return; }   // 기억 일지 열기

    // 이동 입력
    const stealth = keys["shift"];
    const sp = stealth ? C.STEALTH_SPEED : C.PLAYER_SPEED;
    let ix = (keys["d"]||keys["arrowright"]?1:0) - (keys["a"]||keys["arrowleft"]?1:0);
    let iy = (keys["s"]||keys["arrowdown"]?1:0) - (keys["w"]||keys["arrowup"]?1:0);
    if (ix && iy) { const inv = 1/Math.sqrt(2); ix *= inv; iy *= inv; }
    player.vx = ix * sp; player.vy = iy * sp;
    const moving = (ix || iy) ? true : false;

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

    // 기억 비추기(Q) — 빛 자원 소모 콘. 숨은 조각 드러냄 + Murk 밀어냄
    illuminated.clear(); projecting = false;
    if (keys["q"] && st.light > 0) {
      projecting = true;
      st.light = Math.max(0, st.light - C.PROJECT_COST * dt);
      for (const s of D.shards) {
        if (s.hidden && !isDone(s)) { const c = shardCenter(s);
          if (Core.inCone(player.x, player.y, player.dir, C.PROJECT_LEN, C.PROJECT_HALFDEG, c.x, c.y)) illuminated.add(s.id); }
      }
    }

    // 발자국 추적(L) — 가장 가까운 미발견 코어로 시안 발자국 흔적(무료, 쿨다운)
    if (trailCD > 0) trailCD -= dt;
    if (edge["l"] && trailCD <= 0) {
      let best = null, bd = 1e9;
      for (const s of D.shards) if (s.type === "core" && !isDone(s)) { const c = shardCenter(s), dd = dist(player.x, player.y, c.x, c.y); if (dd < bd) { bd = dd; best = c; } }
      if (best) { trail = []; const n = 7; for (let i = 1; i <= n; i++) trail.push({ x: player.x + (best.x - player.x) * i / n, y: player.y + (best.y - player.y) * i / n, age: 0 }); trailCD = C.TRAIL_CD; }
    }
    for (const p of trail) p.age += dt; trail = trail.filter(p => p.age < C.TRAIL_LIFE);

    // Murk
    let danger = false;
    for (const m of murks) {
      if (projecting && Core.inCone(player.x, player.y, player.dir, C.PROJECT_LEN, C.PROJECT_HALFDEG, m.x, m.y)) {
        const dd = dist(player.x, player.y, m.x, m.y) || 1;
        m.x += (m.x - player.x) / dd * 46 * dt; m.y += (m.y - player.y) / dd * 46 * dt; m.chasing = false;
      }
      const sees = Core.murkSees({ x: m.x, y: m.y, faceAngle: m.faceAngle, sight: m.sightPx, fov: m.fov }, player.x, player.y)
                   && !stealth || (Core.murkSees({ x:m.x,y:m.y,faceAngle:m.faceAngle,sight:m.sightPx*0.6,fov:m.fov }, player.x, player.y) && stealth);
      if (sees) { m.chasing = true; m.lost = 0; }
      else if (m.chasing) { m.lost += dt; if (m.lost > 2.5) m.chasing = false; }
      let ax, ay, spd;
      if (m.chasing) { ax = player.x; ay = player.y; spd = m.speed * 1.35; danger = true; }
      else { const w = m.patrol[m.wp]; ax = w.x; ay = w.y; spd = m.speed;
             if (dist(m.x, m.y, w.x, w.y) < 3) m.wp = (m.wp + 1) % m.patrol.length; }
      const d = dist(m.x, m.y, ax, ay) || 1;
      const nx = (ax - m.x) / d, ny = (ay - m.y) / d;
      m.x += nx * spd * dt; m.y += ny * spd * dt;
      if (Math.abs(nx) + Math.abs(ny) > 0.01) m.faceAngle = Math.atan2(ny, nx);
      if (dist(m.x, m.y, player.x, player.y) < 11) {
        if (Core.contact(st)) { flash = 0.18; shake = 4; if (window.Audio2) Audio2.sfx("contact"); }
      }
      if (dist(m.x, m.y, player.x, player.y) < m.sightPx * 0.6) danger = true;
    }

    // 게이지 tick
    const inSafe = !!inAny(player.x, player.y, player.w, player.h, safes);
    Core.tick(st, dt, { inSafe, inDanger: danger, moving });

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

    // 힌트
    if (edge["h"] && Core.useHint(st).ok) {
      let best = null, bd = 1e9;
      for (const s of D.shards) if (!isDone(s) && s.type === "core") {
        const c = shardCenter(s), dd = dist(player.x, player.y, c.x, c.y);
        if (dd < bd) { bd = dd; best = c; }
      }
      hintTarget = best; hintTimer = 2.2;
    }
    if (hintTimer > 0) hintTimer -= dt;

    // 음소거
    if (edge["m"] && window.Audio2) { muted = !muted; Audio2.setMuted(muted); }

    // 위험 오디오
    if (window.Audio2) { Audio2.drone(danger ? 0.8 : 0); Audio2.heartbeat(st.mem <= 2 ? 96 : 0); }

    // 클리어
    if (Core.chapterClear(st) && door && dist(player.x, player.y, door.x, door.y) < 14) phase = "cleared";

    if (flash > 0) flash -= dt; if (shake > 0) shake -= dt * 24;
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
    // 기억 비추기 콘
    if (projecting) { const h = C.PROJECT_HALFDEG * Math.PI / 180; ctx.save(); ctx.globalAlpha = 0.2;
      ctx.shadowColor = "#34e2e2"; ctx.shadowBlur = 6; ctx.fillStyle = "#9af6f6";
      ctx.beginPath(); ctx.moveTo(player.x, player.y - 4);
      ctx.arc(player.x, player.y - 4, C.PROJECT_LEN, player.dir - h, player.dir + h); ctx.closePath(); ctx.fill(); ctx.restore(); }

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
          ctx.save();
          if (player.facing === "side" && player.flip) { ctx.translate(player.x, 0); ctx.scale(-1, 1); ctx.translate(-player.x, 0); }
          glow(() => ctx.drawImage(sp, Math.round(player.x - sp.width/2), Math.round(player.y - sp.height + 6)), "#8ef548", 3);
          ctx.restore();
        }
      } else {
        const m = e.m;
        if (IMG.murk) glow(() => ctx.drawImage(IMG.murk, Math.round(m.x - IMG.murk.width/2), Math.round(m.y - IMG.murk.height/2)), m.chasing ? "#ff5a5a" : "#7a5cff", m.chasing ? 5 : 2);
      }
    }

    // 힌트 화살표
    if (hintTimer > 0 && hintTarget) {
      const a = Math.atan2(hintTarget.y - player.y, hintTarget.x - player.x);
      ctx.save(); ctx.translate(player.x + Math.cos(a)*16, player.y + Math.sin(a)*16); ctx.rotate(a);
      ctx.fillStyle = "#8ef548"; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-3,-4); ctx.lineTo(-3,4); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // 피격 플래시
    if (flash > 0) { ctx.fillStyle = `rgba(255,90,90,${Math.min(0.5, flash)})`; ctx.fillRect(0, 0, NW, NH); }

    ctx.restore();
    drawHUD();
    if (phase === "title") overlayTitle();
    if (phase === "recall" && recall) overlayRecall();
    if (phase === "setback") overlayCenter("…어둡다. 여기는…", "#9ab", "기억이 흩어졌다 — 마지막 안전한 곳으로");
    if (phase === "cleared") overlayCenter("챕터 1 클리어 · 「지로의 방」", "#8ef548", "지로가 첫 기억들을 되찾았다.");
    if (phase === "journal" && window.Journal) { try { Journal.draw(ctx, cv, st, DATA, IMG); } catch (e) { console.error(e); } }
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
    // 빛 자원
    const lx = x0 + 40 + C.MEM_MAX * pipW + 8;
    ctx.fillStyle = "#6b8a8c"; ctx.fillText("빛", x0 + 40 + C.MEM_MAX*pipW + 8, y0 - 16);
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
    // 코어 카운터(좌상단)
    ctx.fillStyle = "rgba(10,16,20,.85)"; rrect(14, 14, 150, 30, 8); ctx.fill();
    ctx.fillStyle = "#8ef548"; ctx.font = "bold 14px 'Noto Sans KR',sans-serif";
    ctx.fillText("코어 기억 " + (st.coreOrder ? st.coreOrder.length : 0) + " / " + st.coresNeeded, 26, 34);
    // 빛 게이지 바(코어 카운터 아래)
    ctx.fillStyle = "#16262a"; ctx.fillRect(26, 50, 100, 6);
    ctx.fillStyle = "#34e2e2"; ctx.fillRect(26, 50, 100 * (st.light / C.LIGHT_MAX), 6);
    ctx.fillStyle = "#6b8a8c"; ctx.font = "11px 'Noto Sans KR',sans-serif";
    ctx.fillText("빛 " + (st.light||0).toFixed(1) + "   [Q] 비추기 · [H] 힌트", 132, 56);
    ctx.fillStyle = trailCD > 0 ? "#5a7375" : "#8ef548";
    ctx.fillText(trailCD > 0 ? "[L] 발자국 추적  " + trailCD.toFixed(0) + "s" : "[L] 발자국 추적  준비", 26, 70);
    ctx.fillStyle = "#5a7375"; ctx.fillText("[Tab] 기억 일지", 26, 86);
    ctx.restore();
  }
  function paw(cx, cy, col) { ctx.fillStyle = col; ctx.beginPath();
    ctx.ellipse(cx, cy + 3, 5, 4, 0, 0, 7); ctx.fill();
    for (const [dx, dy, r] of [[-4,-3,2],[0,-5,2.2],[4,-3,2]]) { ctx.beginPath(); ctx.arc(cx+dx, cy+dy, r, 0, 7); ctx.fill(); } }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  function hudText(t, x, y, col, size, center) { ctx.save(); ctx.font = `bold ${size}px 'Noto Sans KR',sans-serif`;
    ctx.fillStyle = col; ctx.textAlign = center ? "center" : "left"; ctx.fillText(t, x, y); ctx.restore(); }

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
  requestAnimationFrame(frame);
})();
