// =============================================================================
// journal.js — 『잊혀진 발자국』(지로 Ziro) 기억 일지 · 정체성 카드 오버레이 모듈
// -----------------------------------------------------------------------------
// 순수 그리기(렌더) 전용. 상태(st)·인자 절대 변경 금지(읽기 전용).
// main.js 가 phase==='journal' 일 때 매 프레임 Journal.draw(...) 호출.
// 호출 시점에 ctx.setTransform(1,0,0,1,0,0) 로 초기화돼 있음 →
//   캔버스 픽셀 좌표(cv.width × cv.height, 예 1056×672) 기준으로 그린다.
//
// API: Journal.draw(ctx, cv, st, DATA, IMG)
//   ctx  : CanvasRenderingContext2D (transform 초기화 상태)
//   cv   : canvas (cv.width / cv.height 사용)
//   st   : { mem, light, identity(0..5), coresNeeded, collected(Set),
//            coreOrder(Array), sealed(Set) }   ← 읽기 전용
//   DATA : DATA.chapter1 또는 챕터 형태 객체 ({ shards, identityLabels })
//   IMG  : 로드된 이미지 맵 (IMG.ziro_d0 등)
//
// 디자인 시스템 색 토큰(00_design_review / mockups 준수):
//   배경 dim rgba(4,7,11,.92) · 패널 #0a1014 · 라인 #1d3236
//   시안 #34e2e2(중립) · 연두 #8ef548(해금/긍정) · 위험 #ff5a5a
//   텍스트 #eafaff(주) / #8aa7a9(보조) / #5a7375(잠금)
//   거짓(false) 단서 강조 #caa15a
//   폰트 'Noto Sans KR',sans-serif
// =============================================================================

const Journal = (function () {
  "use strict";

  // ---- 색 토큰 ----------------------------------------------------------------
  var COL = {
    dim:      "rgba(4,7,11,.92)",
    panel:    "#0a1014",
    panelDk:  "#080c0f",   // 잠긴 칸(더 어두운 패널)
    panelHi:  "#10262a",   // 해금 칸 배경(시안 톤)
    line:     "#1d3236",
    lineDk:   "#243036",   // 잠긴 칸 테두리
    cyan:     "#34e2e2",   // 중립
    cyanDk:   "#2a6e72",   // 해금 칸 테두리(시안 톤 다운)
    lime:     "#8ef548",   // 해금/긍정
    danger:   "#ff5a5a",
    text:     "#eafaff",
    textSub:  "#8aa7a9",
    lock:     "#5a7375",   // 잠금 텍스트
    lockIcon: "#3a5557",   // 자물쇠 형태
    falseGold:"#caa15a",   // false 단서
    falseTxt: "#e8c884",   // false 텍스트(밝게)
    falsePnl: "#1a1408",   // false 패널
    falseLn:  "#3a2a14",   // false 테두리
    echo:     "#8aa7a9",   // echo 타입(보조 회색)
    portBg:   "#0e0f13",   // 초상 셀 배경
    portDk:   "#0a0d0f",   // 잠긴 초상 셀 배경
  };
  var FONT = "'Noto Sans KR',sans-serif";

  // ---- 그리기 헬퍼 ------------------------------------------------------------
  function rrect(ctx, x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    if (r < 0) r = 0;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 한 줄 말줄임(…) — maxw(px) 초과 시 잘라 '…' 부착. ctx.font 은 호출 전에 설정.
  function ellipsize(ctx, text, maxw) {
    text = (text == null ? "" : String(text));
    if (ctx.measureText(text).width <= maxw) return text;
    var ell = "…";
    var ellW = ctx.measureText(ell).width;
    if (maxw <= ellW) return ell;
    var lo = 0, hi = text.length, best = "";
    // 이진 탐색으로 들어가는 최대 글자 수 찾기
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var cand = text.slice(0, mid);
      if (ctx.measureText(cand).width + ellW <= maxw) { best = cand; lo = mid + 1; }
      else hi = mid - 1;
    }
    return best.replace(/\s+$/, "") + ell;
  }

  // 자물쇠 아이콘(걸쇠 + 몸통). cx,cy = 자물쇠 몸통 중앙 근처, s = 크기 배수.
  function lockIcon(ctx, cx, cy, s, color) {
    s = s || 1;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3 * s;
    // 걸쇠(U자)
    var shW = 10 * s;     // 걸쇠 폭
    var shTop = cy - 9 * s;
    ctx.beginPath();
    ctx.moveTo(cx - shW / 2, cy - 1 * s);
    ctx.lineTo(cx - shW / 2, shTop + shW / 2);
    ctx.arc(cx, shTop + shW / 2, shW / 2, Math.PI, 0);
    ctx.lineTo(cx + shW / 2, cy - 1 * s);
    ctx.stroke();
    // 몸통
    var bw = 18 * s, bh = 14 * s;
    rrect(ctx, cx - bw / 2, cy - 1 * s, bw, bh, 3 * s);
    ctx.fill();
    ctx.restore();
  }

  // 체크(✓) 마크
  function checkMark(ctx, x, y, size, color) {
    ctx.save();
    ctx.font = "bold " + size + "px " + FONT;
    ctx.fillStyle = color;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("✓", x, y);
    ctx.restore();
  }

  // ---- 초상 진화 셀(원형) -----------------------------------------------------
  // stage: 0=? 1=실루엣 2=눈 3=얼굴 4=이름.  active: 또렷 여부.
  // nameReveal: 이름(stage 4)을 공개할지(정체성===5일 때만 true). 이름은 최종 보상.
  function portraitCell(ctx, cx, cy, r, stage, active, IMG, nameReveal) {
    ctx.save();

    // 배경 원
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = active ? COL.portBg : COL.portDk;
    ctx.fill();

    // 테두리: 활성도에 따라 시안 → 라인
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? (stage >= 3 ? COL.cyan : "#2a4a4e") : COL.line;
    if (stage === 4) { ctx.setLineDash([4, 5]); }   // 이름 단계는 점선(미완)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 비활성 셀은 클립 안에서 흐리게 그림
    var fg = active ? 1 : 0.28;

    // 셀 내부를 원으로 클립(그림이 원 밖으로 새지 않게)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();

    var silCol = active ? "#1a2228" : "#12181c";
    var eyeCol = active ? COL.lime : "#3a4a30";

    if (stage === 0) {
      // ? 물음표
      ctx.globalAlpha = fg;
      ctx.fillStyle = active ? COL.cyan : COL.lock;
      ctx.font = "bold " + Math.round(r * 0.95) + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", cx, cy + 1);
    } else if (stage === 1) {
      // 실루엣: 귀 두 개 + 머리 타원
      ctx.globalAlpha = fg;
      ctx.fillStyle = silCol;
      // 귀
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.62, cy - r * 0.10);
      ctx.lineTo(cx - r * 0.34, cy - r * 0.82);
      ctx.lineTo(cx - r * 0.08, cy - r * 0.16);
      ctx.closePath();
      ctx.moveTo(cx + r * 0.62, cy - r * 0.10);
      ctx.lineTo(cx + r * 0.34, cy - r * 0.82);
      ctx.lineTo(cx + r * 0.08, cy - r * 0.16);
      ctx.closePath();
      ctx.fill();
      // 머리
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.12, r * 0.72, r * 0.64, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage === 2) {
      // 눈 두 개(빛남)
      ctx.globalAlpha = fg;
      ctx.fillStyle = eyeCol;
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.32, cy, r * 0.26, r * 0.33, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.32, cy, r * 0.26, r * 0.33, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage === 3) {
      // 얼굴: 가능하면 IMG.ziro_d0 사용, 없으면 절차적 얼굴
      var im = IMG && IMG.ziro_d0;
      if (im && im.width) {
        ctx.globalAlpha = fg;
        var prevSmooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;   // 픽셀아트 또렷하게
        // 원 안에 맞춰 비율 유지 스케일
        var box = r * 1.7;
        var scale = Math.min(box / im.width, box / im.height);
        var dw = im.width * scale, dh = im.height * scale;
        ctx.drawImage(im, Math.round(cx - dw / 2), Math.round(cy - dh / 2), Math.round(dw), Math.round(dh));
        ctx.imageSmoothingEnabled = prevSmooth;
      } else {
        // 절차적 얼굴(귀 + 눈 + 입)
        ctx.globalAlpha = fg;
        ctx.fillStyle = "#0d0d10";
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.72, cy - r * 0.18);
        ctx.lineTo(cx - r * 0.38, cy - r * 0.92);
        ctx.lineTo(cx - r * 0.08, cy - r * 0.22);
        ctx.closePath();
        ctx.moveTo(cx + r * 0.72, cy - r * 0.18);
        ctx.lineTo(cx + r * 0.38, cy - r * 0.92);
        ctx.lineTo(cx + r * 0.08, cy - r * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = active ? COL.cyan : "#2a4a4e";
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.62, cy - r * 0.30);
        ctx.lineTo(cx - r * 0.40, cy - r * 0.78);
        ctx.lineTo(cx - r * 0.20, cy - r * 0.30);
        ctx.closePath();
        ctx.moveTo(cx + r * 0.62, cy - r * 0.30);
        ctx.lineTo(cx + r * 0.40, cy - r * 0.78);
        ctx.lineTo(cx + r * 0.20, cy - r * 0.30);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = eyeCol;
        ctx.beginPath();
        ctx.ellipse(cx - r * 0.34, cy + r * 0.04, r * 0.30, r * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + r * 0.34, cy + r * 0.04, r * 0.30, r * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = active ? COL.cyan : "#2a4a4e";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.17, cy + r * 0.5);
        ctx.quadraticCurveTo(cx, cy + r * 0.66, cx + r * 0.17, cy + r * 0.5);
        ctx.stroke();
      }
    } else if (stage === 4) {
      // 이름 단계: 이름은 최종 보상 → 정체성===5(nameReveal)일 때만 'ZIRO' 공개.
      // 그 전(active여도)에는 '?'로 가린다.
      ctx.globalAlpha = fg;
      ctx.fillStyle = nameReveal ? COL.lime : (active ? COL.cyan : COL.lock);
      ctx.font = "bold " + Math.round(nameReveal ? r * 0.5 : r * 0.95) + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(nameReveal ? "ZIRO" : "?", cx, cy);
    }

    ctx.restore(); // 클립 해제
    ctx.restore();
  }

  // ---- 메인 그리기 ------------------------------------------------------------
  function draw(ctx, cv, st, DATA, IMG) {
    if (!ctx || !cv) return;

    // --- 인자 정규화(읽기 전용 복사 없이 안전 참조) -------------------------
    st = st || {};
    var W = cv.width, H = cv.height;

    // DATA 가 루트인지 챕터 형태인지 유연 처리
    var chap = (DATA && DATA.chapter1) ? DATA.chapter1 : (DATA || {});
    var shards = (chap && chap.shards) || [];
    var labels = (chap && chap.identityLabels) || [];

    var identity   = (typeof st.identity === "number") ? st.identity : 0;
    var coresNeed  = (typeof st.coresNeeded === "number") ? st.coresNeeded : (chap.coresNeeded || 0);
    // coreOrder 길이(획득 코어 수). 없으면 collected 내 core 개수로 폴백.
    var coreCount;
    if (st.coreOrder && typeof st.coreOrder.length === "number") {
      coreCount = st.coreOrder.length;
    } else {
      coreCount = 0;
      for (var ci = 0; ci < shards.length; ci++) {
        if (shards[ci].type === "core" && collectedHas(st, shards[ci].id)) coreCount++;
      }
    }

    // collected 멤버십(Set 우선, 배열 폴백)
    function collectedHas(state, id) {
      var c = state.collected;
      if (!c) return false;
      if (typeof c.has === "function") return c.has(id);
      if (typeof c.indexOf === "function") return c.indexOf(id) >= 0;
      return false;
    }

    ctx.save();
    ctx.textBaseline = "alphabetic";

    // === 0. 전체 dim 배경 =====================================================
    ctx.fillStyle = COL.dim;
    ctx.fillRect(0, 0, W, H);

    // 바깥 여백 / 레이아웃 기준
    var PAD = Math.round(W * 0.038);          // 좌우 바깥 여백
    if (PAD < 28) PAD = 28;
    var contentX = PAD;
    var contentW = W - PAD * 2;

    // === 1. 제목 ==============================================================
    var titleY = Math.round(H * 0.082);
    ctx.textAlign = "left";
    ctx.fillStyle = COL.text;
    ctx.font = "800 32px " + FONT;
    ctx.fillText("기억 일지 · 정체성", contentX, titleY);
    ctx.fillStyle = COL.cyan;
    ctx.font = "14px " + FONT;
    ctx.fillText("MEMORY JOURNAL · IDENTITY", contentX + 2, titleY + 22);
    // 우상단 진행 표기(정체성 n/5)
    ctx.textAlign = "right";
    ctx.fillStyle = COL.lime;
    ctx.font = "700 20px " + FONT;
    ctx.fillText(identity + " / 5 복원", W - PAD, titleY);

    // === 2. 초상 진화 행 ======================================================
    // 5개 원형 셀(? → 실루엣 → 눈 → 얼굴 → 이름). identity 단계까지 또렷.
    var rowY = titleY + 58;
    ctx.textAlign = "left";
    ctx.fillStyle = COL.textSub;
    ctx.font = "14px " + FONT;
    ctx.fillText("기억이 차오를수록 또렷해진다", contentX, rowY);

    var cellR = 34;
    var cyCell = rowY + 18 + cellR;
    var nCells = 5;
    // 셀 사이 간격을 contentW 안에 균등 분배
    var span = contentW - cellR * 2;
    var gap = (nCells > 1) ? span / (nCells - 1) : 0;
    var firstCx = contentX + cellR;

    for (var s = 0; s < nCells; s++) {
      var cx = Math.round(firstCx + gap * s);
      // 현재 identity 단계까지 또렷. identity=0 이면 첫 셀(?)만 약하게 활성.
      // 매핑: 셀 s 는 "정체성이 s단계 이상이면 또렷".
      //   identity=0 → 아무 단계도 완성 안 됨이지만, ?(stage0)는 항상 보이는 시작점.
      var active = (s === 0) ? true : (identity >= s);
      // identity 가 그 단계'에 도달'했을 때만 또렷: s번째 셀은 identity>=s.
      // 이름 셀(s===4)은 정체성===5 일 때만 공개(nameReveal).
      var nameReveal = (s === 4) && (identity >= 5);
      portraitCell(ctx, cx, cyCell, cellR, s, active, IMG, nameReveal);

      // 셀 사이 화살표(›)
      if (s < nCells - 1) {
        var ax = Math.round(cx + gap / 2);
        ctx.fillStyle = "#2a4a4e";
        ctx.font = "22px " + FONT;
        ctx.textAlign = "center";
        ctx.fillText("›", ax, cyCell + 7);
        ctx.textAlign = "left";
      }
    }
    // 단계 캡션
    var capNames = ["?", "실루엣", "눈", "얼굴", "이름"];
    ctx.fillStyle = COL.lock;
    ctx.font = "12px " + FONT;
    ctx.textAlign = "center";
    for (var cap = 0; cap < nCells; cap++) {
      var capx = Math.round(firstCx + gap * cap);
      ctx.fillStyle = ((cap === 0) || identity >= cap) ? COL.textSub : COL.lock;
      ctx.fillText(capNames[cap], capx, cyCell + cellR + 18);
    }

    // === 2열 패널 영역(좌: 정체성 / 우: 기억 목록) ============================
    var colsTop = cyCell + cellR + 34;
    var bottomReserve = 96;                    // 하단 미스터리 바 + 푸터 공간
    var colsH = H - colsTop - bottomReserve;
    if (colsH < 120) colsH = 120;
    var colGap = Math.round(W * 0.024);
    if (colGap < 18) colGap = 18;
    var leftW = Math.round((contentW - colGap) * 0.5);
    var rightW = contentW - colGap - leftW;
    var leftX = contentX;
    var rightX = contentX + leftW + colGap;

    // --- 좌 패널 배경 ---
    ctx.fillStyle = COL.panel;
    rrect(ctx, leftX, colsTop, leftW, colsH, 14); ctx.fill();
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1.5;
    rrect(ctx, leftX, colsTop, leftW, colsH, 14); ctx.stroke();
    // --- 우 패널 배경 ---
    ctx.fillStyle = COL.panel;
    rrect(ctx, rightX, colsTop, rightW, colsH, 14); ctx.fill();
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1.5;
    rrect(ctx, rightX, colsTop, rightW, colsH, 14); ctx.stroke();

    // === 3. 정체성 5슬롯 (좌 패널) ===========================================
    var lInX = leftX + 20;
    var lInW = leftW - 40;
    ctx.textAlign = "left";
    ctx.fillStyle = COL.lime;
    ctx.font = "700 17px " + FONT;
    ctx.fillText("정체성 카드", lInX, colsTop + 30);

    var slotTop = colsTop + 48;
    var slotN = 5;
    var slotGap = 12;
    var slotH = Math.floor((colsH - 48 - 20 - slotGap * (slotN - 1)) / slotN);
    if (slotH > 70) slotH = 70;
    if (slotH < 44) slotH = 44;

    // 정체성 슬롯의 "해금" 규칙: i < identity 이면 해금(연두 ✓), 아니면 잠금.
    // 이름 슬롯(index 3)은 identity<5 이면 'ZIRO'를 '?????'로 가림.
    var NAME_SLOT = 3;
    for (var i = 0; i < slotN; i++) {
      var sy = slotTop + i * (slotH + slotGap);
      var unlocked = (i < identity);
      var label = labels[i] != null ? String(labels[i]) : ("슬롯 " + (i + 1));

      // 패널
      if (unlocked) {
        ctx.fillStyle = COL.panelHi;
        rrect(ctx, lInX, sy, lInW, slotH, 12); ctx.fill();
        ctx.strokeStyle = COL.cyanDk; ctx.lineWidth = 1.5; ctx.setLineDash([]);
        rrect(ctx, lInX, sy, lInW, slotH, 12); ctx.stroke();
      } else {
        ctx.fillStyle = COL.panelDk;
        rrect(ctx, lInX, sy, lInW, slotH, 12); ctx.fill();
        ctx.strokeStyle = COL.lineDk; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        rrect(ctx, lInX, sy, lInW, slotH, 12); ctx.stroke();
        ctx.setLineDash([]);
      }

      // 좌측 아이콘 원
      var icR = Math.min(20, slotH / 2 - 6);
      var icCx = lInX + 16 + icR;
      var icCy = sy + slotH / 2;
      ctx.beginPath();
      ctx.arc(icCx, icCy, icR, 0, Math.PI * 2);
      ctx.fillStyle = unlocked ? "#10262a" : "#11181d";
      ctx.fill();
      if (unlocked) {
        // 해금: 슬롯 번호(또는 점) 표시
        ctx.fillStyle = COL.cyan;
        ctx.font = "700 16px " + FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), icCx, icCy + 1);
        ctx.textBaseline = "alphabetic";
      } else {
        // 잠금: 자물쇠
        lockIcon(ctx, icCx, icCy - 4, Math.min(1, icR / 18), COL.lockIcon);
      }

      // 텍스트 영역
      var txX = icCx + icR + 14;
      var txMaxW = lInX + lInW - txX - 30;     // 우측 상태 마크 공간 확보

      // 라벨(상단 보조) / 값(하단 강조)을 라벨 문자열에서 분리 시도.
      // identityLabels 예: "종: 고양이" / "이름: ? (지로)" / "왜 잊었나"
      var caption, value;
      var colonIdx = label.indexOf(":");
      if (colonIdx >= 0) {
        caption = label.slice(0, colonIdx).trim();
        value = label.slice(colonIdx + 1).trim();
      } else {
        caption = "";
        value = label;
      }

      // 이름 슬롯 마스킹: identity<5 이면 값은 '?????'(ZIRO 가림)
      var isName = (i === NAME_SLOT);
      if (isName) {
        if (caption === "") caption = "이름";
        if (identity >= 5) value = "ZIRO";       // 최종 보상 공개
        else value = "?????";                    // 가림
      }

      // 마지막 슬롯(진실)은 잠금 시 캡션을 '??? · 잠김' 으로
      var twoLine = (slotH >= 50);

      if (unlocked) {
        if (twoLine && caption) {
          ctx.fillStyle = COL.textSub;
          ctx.font = "13px " + FONT;
          ctx.textAlign = "left";
          ctx.fillText(ellipsize(ctx, caption, txMaxW), txX, sy + slotH / 2 - 6);
          ctx.fillStyle = COL.text;
          ctx.font = "700 19px " + FONT;
          ctx.fillText(ellipsize(ctx, value, txMaxW), txX, sy + slotH / 2 + 18);
        } else {
          ctx.fillStyle = COL.text;
          ctx.font = "700 18px " + FONT;
          ctx.textAlign = "left";
          ctx.fillText(ellipsize(ctx, (caption ? caption + " · " : "") + value, txMaxW), txX, sy + slotH / 2 + 6);
        }
        // 해금 ✓ (연두)
        checkMark(ctx, lInX + lInW - 14, sy + slotH / 2 + 8, 22, COL.lime);
      } else {
        // 잠금: 회색
        var lockCap = caption ? caption : "???";
        if (twoLine) {
          ctx.fillStyle = COL.lock;
          ctx.font = "13px " + FONT;
          ctx.textAlign = "left";
          ctx.fillText(ellipsize(ctx, lockCap + " · 잠김", txMaxW), txX, sy + slotH / 2 - 6);
          ctx.fillStyle = COL.lock;
          ctx.font = "700 19px " + FONT;
          ctx.fillText(ellipsize(ctx, value, txMaxW), txX, sy + slotH / 2 + 18);
        } else {
          ctx.fillStyle = COL.lock;
          ctx.font = "700 17px " + FONT;
          ctx.textAlign = "left";
          ctx.fillText(ellipsize(ctx, value + " · 잠김", txMaxW), txX, sy + slotH / 2 + 6);
        }
      }
    }

    // === 4. 수집한 기억 목록 (우 패널) =======================================
    var rInX = rightX + 20;
    var rInW = rightW - 40;
    ctx.textAlign = "left";
    ctx.fillStyle = COL.lime;
    ctx.font = "700 17px " + FONT;
    ctx.fillText("수집한 기억", rInX, colsTop + 30);
    // 타입 범례(우측)
    ctx.textAlign = "right";
    ctx.font = "12px " + FONT;
    ctx.fillStyle = COL.cyan;     ctx.fillText("● 코어", rightX + rightW - 150, colsTop + 30);
    ctx.fillStyle = COL.echo;     ctx.fillText("● 에코", rightX + rightW - 90,  colsTop + 30);
    ctx.fillStyle = COL.falseGold;ctx.fillText("● 거짓", rightX + rightW - 28,  colsTop + 30);
    ctx.textAlign = "left";

    var listTop = colsTop + 46;
    var listBottom = colsTop + colsH - 16;
    var nShards = shards.length || 1;
    var itemGap = 10;
    var itemH = Math.floor((listBottom - listTop - itemGap * (nShards - 1)) / Math.max(1, nShards));
    if (itemH > 64) itemH = 64;
    if (itemH < 38) itemH = 38;

    for (var k = 0; k < shards.length; k++) {
      var shd = shards[k];
      var iy = listTop + k * (itemH + itemGap);
      if (iy + itemH > listBottom + 2) break;   // 패널 넘침 방지(안전)

      var got = collectedHas(st, shd.id);
      var type = shd.type;
      var isCoreMissing = (!got && type === "core");

      // 타입색
      var tColor = (type === "core") ? COL.cyan
                 : (type === "echo") ? COL.echo
                 : (type === "false") ? COL.falseGold
                 : COL.textSub;

      // 좌측 노드 점(타임라인 느낌)
      var dotX = rInX + 8;
      var dotCy = iy + itemH / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotCy, 6, 0, Math.PI * 2);
      if (got) {
        ctx.fillStyle = tColor;
        ctx.fill();
      } else {
        ctx.fillStyle = COL.panel;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isCoreMissing ? COL.lock : tColor;
        ctx.setLineDash(isCoreMissing ? [3, 3] : []);
        ctx.beginPath();
        ctx.arc(dotX, dotCy, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 카드
      var cardX = dotX + 16;
      var cardW = rInX + rInW - cardX;
      if (got) {
        ctx.fillStyle = (type === "false") ? COL.falsePnl : COL.panelHi;
        rrect(ctx, cardX, iy, cardW, itemH, 10); ctx.fill();
        ctx.strokeStyle = (type === "false") ? COL.falseLn : COL.cyanDk;
        ctx.lineWidth = 1.5; ctx.setLineDash([]);
        rrect(ctx, cardX, iy, cardW, itemH, 10); ctx.stroke();
      } else {
        ctx.fillStyle = COL.panelDk;
        rrect(ctx, cardX, iy, cardW, itemH, 10); ctx.fill();
        ctx.strokeStyle = COL.lineDk;
        ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        rrect(ctx, cardX, iy, cardW, itemH, 10); ctx.stroke();
        ctx.setLineDash([]);
      }

      var txX2 = cardX + 14;
      var txMaxW2 = cardX + cardW - txX2 - 14;
      var twoLine2 = (itemH >= 46);

      if (got) {
        // 제목(타입 라벨) + 회상 앞부분
        var typeLabel = (type === "core") ? "코어 기억"
                      : (type === "echo") ? "에코"
                      : (type === "false") ? "거짓된 기억 ⚠" : "기억";
        var recallTxt = shd.recall != null ? String(shd.recall) : "";
        if (twoLine2) {
          ctx.fillStyle = (type === "false") ? COL.falseTxt : tColor;
          ctx.font = "700 14px " + FONT;
          ctx.fillText(ellipsize(ctx, typeLabel, txMaxW2), txX2, iy + itemH / 2 - 5);
          ctx.fillStyle = (type === "false") ? "#8a7a4a" : COL.textSub;
          ctx.font = "13px " + FONT;
          ctx.fillText(ellipsize(ctx, recallTxt, txMaxW2), txX2, iy + itemH / 2 + 16);
        } else {
          ctx.fillStyle = (type === "false") ? COL.falseTxt : tColor;
          ctx.font = "700 14px " + FONT;
          ctx.fillText(ellipsize(ctx, typeLabel + " — " + recallTxt, txMaxW2), txX2, iy + itemH / 2 + 5);
        }
      } else {
        // 미수집: 코어는 '??? (빠진 기억)' 빈칸, 그 외 미수집도 동일 처리
        var blankMain = isCoreMissing ? "???  (빠진 기억)" : "???";
        var blankSub = isCoreMissing ? "아직 되찾지 못한 코어 기억" : "미발견";
        if (twoLine2) {
          ctx.fillStyle = COL.lock;
          ctx.font = "700 14px " + FONT;
          ctx.fillText(ellipsize(ctx, blankMain, txMaxW2), txX2, iy + itemH / 2 - 5);
          ctx.fillStyle = COL.lock;
          ctx.font = "13px " + FONT;
          ctx.fillText(ellipsize(ctx, blankSub, txMaxW2), txX2, iy + itemH / 2 + 16);
        } else {
          ctx.fillStyle = COL.lock;
          ctx.font = "700 14px " + FONT;
          ctx.fillText(ellipsize(ctx, blankMain, txMaxW2), txX2, iy + itemH / 2 + 5);
        }
      }
    }

    // === 5. 하단 중심 미스터리 바 + 진행 =====================================
    var barH = 52;
    var barY = H - bottomReserve + 8;
    var barW = contentW;
    var barX = contentX;
    ctx.fillStyle = COL.panelDk;
    rrect(ctx, barX, barY, barW, barH, 12); ctx.fill();
    ctx.strokeStyle = COL.lineDk; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    rrect(ctx, barX, barY, barW, barH, 12); ctx.stroke();

    // 자물쇠(거짓 골드 톤 — 진실은 잠겨 있다)
    lockIcon(ctx, barX + 30, barY + barH / 2 - 4, 1, COL.falseGold);

    ctx.textAlign = "left";
    ctx.fillStyle = COL.falseTxt;
    ctx.font = "700 15px " + FONT;
    ctx.fillText("중심 미스터리 · 왜 나는 잊었는가", barX + 56, barY + 22);
    ctx.fillStyle = COL.textSub;
    ctx.font = "12px " + FONT;
    ctx.fillText("코어 기억을 모아 진실의 문을 연다", barX + 56, barY + 41);

    // 진행 바: coreOrder.length / coresNeeded
    var pbW = 180;
    var pbX = barX + barW - pbW - 24;
    var pbY = barY + barH / 2 - 5;
    var frac = (coresNeed > 0) ? Math.max(0, Math.min(1, coreCount / coresNeed)) : 0;
    ctx.fillStyle = "#16262a";
    rrect(ctx, pbX, pbY, pbW, 10, 5); ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = (frac >= 1) ? COL.lime : COL.cyan;
      rrect(ctx, pbX, pbY, Math.max(10, pbW * frac), 10, 5); ctx.fill();
    }
    // 진행 수치
    ctx.textAlign = "right";
    ctx.fillStyle = (frac >= 1) ? COL.lime : COL.text;
    ctx.font = "700 14px " + FONT;
    ctx.fillText(coreCount + " / " + coresNeed, pbX + pbW, pbY - 8);

    // === 6. 푸터 =============================================================
    ctx.textAlign = "center";
    ctx.fillStyle = COL.lock;
    ctx.font = "14px " + FONT;
    ctx.fillText("[Tab] 닫기", W / 2, H - 16);

    ctx.restore();
  }

  return { draw: draw };
})();

if (typeof window !== 'undefined') window.Journal = Journal;
if (typeof module !== 'undefined') module.exports = Journal;
