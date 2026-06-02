// =============================================================================
// data.js — 『잊혀진 발자국』 챕터1 「지로의 방」 콘텐츠 데이터 모듈
// -----------------------------------------------------------------------------
// 규약: 10_build_plan.md §2-2 (DATA 스키마)
// 서사: 01_story_script.md §2 (챕터1 코어 회상) — 단, 최종 이름은 '지로(Ziro)'.
//   주인공: 지로(Ziro) / 주인: 하루
//
// 좌표계 (배경 'room1'과 정렬):
//   방 22(cols)×14(rows) 타일, 타일 16px, scale 4.
//   collision/safeZone/door/shard/murk 좌표는 모두 [col, row] (타일 단위, 0-base).
//   사각형 표기 [c, r, w, h] 는 cols [c..c+w-1], rows [r..r+h-1] 를 점유.
//
// 고정 가구 배치 (collision과 1:1):
//   벽 테두리:  상단 rows0~1 / 하단 row13 / 좌 col0 / 우 col21
//   침대:        (2,8,4,4)   = cols 2~5,  rows 8~11
//   책상+모니터: (15,3,5,2)  = cols 15~19, rows 3~4
//   게임기:      (9,3,2,2)   = cols 9~10,  rows 3~4
//   옷장:        (17,9,3,3)  = cols 17~19, rows 9~11
//   러그(장식,비충돌): cols 8~11, rows 7~9
// =============================================================================

const DATA = {};

DATA.chapter1 = {
  tile: 16,
  cols: 22,
  rows: 14,
  scale: 4,
  bgKey: 'room1',

  // 스폰: 러그 위(floor). [10,9] 는 러그 영역(cols8~11,rows7~9) 안 + 충돌 밖. (검산: FREE)
  spawn: [10, 9],

  coresNeeded: 3,

  // 막힌 사각형 [c,r,w,h] — 벽 테두리 4개 + 가구 4개.
  collision: [
    [0, 0, 22, 2],   // 상단 벽 (rows 0~1 전체)
    [0, 13, 22, 1],  // 하단 벽 (row 13 전체)
    [0, 0, 1, 14],   // 좌측 벽 (col 0 전체)
    [21, 0, 1, 14],  // 우측 벽 (col 21 전체)
    [2, 8, 4, 4],    // 침대        cols 2~5,  rows 8~11
    [15, 3, 5, 2],   // 책상+모니터 cols 15~19, rows 3~4
    [9, 3, 2, 2],    // 게임기      cols 9~10,  rows 3~4
    [17, 9, 3, 3]    // 옷장        cols 17~19, rows 9~11
  ],

  // 안전지대(회복) — 침대 앞 floor. [2,12,4,1] = cols 2~5, row 12. (검산: 4칸 모두 FREE)
  safeZones: [
    [2, 12, 4, 1]
  ],

  // 문: 상단 벽에 박힌 출구. [10,1] 은 의도적으로 상단 벽(collision) 안에 위치 —
  // floor 타일이 아니라 '벽의 문'이며, coresNeeded 충족 시 개방되는 챕터 출구다.
  door: { tile: [10, 1], requires: 'cores' },

  // ---------------------------------------------------------------------------
  // shards — 8개 (core×3 + echo×4 + false×1). 모두 floor 위, 충돌/가구와 비겹침.
  //   ※ echo 중 hidden:true 2개는 '기억 비추기(빛)'로 비출 때만 보이는 조각(main.js 처리).
  //
  //   좌표 검산 (collision/가구 사각형 안에 들어가지 않음을 직접 확인):
  //   가구 사각형(cols[c..c+w-1], rows[r..r+h-1]):
  //     상단벽 rows0~1 / 하단벽 row13 / 좌벽 col0 / 우벽 col21
  //     침대 cols2~5,rows8~11 · 책상 cols15~19,rows3~4 · 게임기 cols9~10,rows3~4 · 옷장 cols17~19,rows9~11
  //   ┌──────────────────────────┬─────────┬──────────────────────────────────────────────┐
  //   │ shard                     │ tile    │ 판정                                           │
  //   ├──────────────────────────┼─────────┼──────────────────────────────────────────────┤
  //   │ core 이름표 목걸이        │ [9,5]   │ FREE — 게임기(9~10,3~4) 바로 아래 (row5∉3~4)   │
  //   │ core 빛바랜 사진          │ [16,5]  │ FREE — 책상(15~19,3~4) 바로 아래 (row5∉3~4)    │
  //   │ core 일기장 한 페이지     │ [4,6]   │ FREE — 침대(2~5,8~11) 위쪽 (row6∉8~11)         │
  //   │ echo 창틀 발톱 자국       │ [20,12] │ FREE — 옷장(17~19,9~11) 피해 우하단 (col20∉우벽)│
  //   │ echo 창틀 발톱(hidden)    │ [20,2]  │ FREE — col20(∉우벽21,∉책상≤19) · row2(∉상단벽0~1)│
  //   │ echo 게임기 발자국 스티커 │ [10,5]  │ FREE — 게임기(9~10,3~4) 아래 (row5∉3~4)        │
  //   │ echo 장난감 쥐(hidden)    │ [6,12]  │ FREE — 침대(2~5,…) 옆(col6∉2~5)·row12(∉하단벽13)│
  //   │ false 하루가 손 흔든다    │ [13,11] │ FREE — 방 중앙 하단, 충돌밖                     │
  //   └──────────────────────────┴─────────┴──────────────────────────────────────────────┘
  //   (전 좌표 어느 collision 사각형에도 포함되지 않음을 직접 검산 — 모두 FREE.)
  //
  //   gainMem/gainLight 는 core.js 의 상수(CORE_GAIN/ECHO_GAIN/FALSE_HIT 등)를 따른다.
  //   main 통합 시 값이 없으면 core.js 상수를 사용하므로 여기서는 type 정확성이 핵심.
  //   (echo 는 작은 회복을 의도하나 상수 우선 — gainMem:0 명시. false 는 줍는 순간
  //    메모리 감소를 core.js 가 처리하므로 아래 gain 값은 형식상 둔다.)
  // ---------------------------------------------------------------------------
  shards: [
    {
      id: 'core_nametag',
      type: 'core',
      tile: [9, 5],            // 게임기 앞 floor (검산: FREE)
      radius: 1.3,
      identitySlot: 0,         // '종: 고양이'
      recall: '따뜻한 손이 내 목에 무언가를 채워준다. 찰칵 — 작은 금속음. 글자는 흐려서 읽히지 않는다… 그래도, 이건 내 것이었다.',
      gainMem: 2,
      gainLight: 1
    },
    {
      id: 'core_photo',
      type: 'core',
      tile: [16, 5],           // 책상 앞 floor (검산: FREE)
      radius: 1.3,
      identitySlot: 1,         // '사는 곳: 하루의 집'
      recall: '창가에 앉은 나, 그리고 흐릿한 사람의 뒷모습. 쏟아지는 햇살. 여기는… 낯설지 않다. 내가 살던 곳이야.',
      gainMem: 2,
      gainLight: 1
    },
    {
      id: 'core_diary',
      type: 'core',
      tile: [4, 6],            // 침대 위쪽 floor (검산: FREE)
      radius: 1.3,
      identitySlot: 3,         // '이름: ? (지로)'
      recall: "사람의 손글씨: '오늘도 너는 창가에서 나를 기다렸지.' 이름이 적혀 있던 자리는 — 누군가 찢어낸 듯 비어 있다.",
      gainMem: 2,
      gainLight: 1
    },
    {
      id: 'echo_clawmarks',
      type: 'echo',
      tile: [20, 12],          // 옷장 피한 우하단 floor (검산: FREE)
      radius: 1.3,
      identitySlot: null,
      recall: '창틀에 깊게 팬 발톱 자국. 여기서 오래… 무언가를 기다렸던 것 같다.',
      gainMem: 0,              // echo: 회복 작게 (실제 적용은 core.js 상수 우선)
      gainLight: 1
    },
    {
      id: 'echo_window',
      type: 'echo',
      tile: [20, 2],           // 우상단 창가 floor. col20(우벽21 밖, 책상≤19 밖)·row2(상단벽0~1 밖) (검산: FREE)
      radius: 1.3,
      hidden: true,            // 기억 비추기(빛)로 비출 때만 보이는 조각 (main.js 처리)
      identitySlot: null,
      recall: '창틀에 긁힌 발톱 자국. 여기서 오래… 밖을 봤던 것 같다. 누군가를 기다리며.',
      gainMem: 0,              // echo: 회복 작게 (실제 적용은 core.js 상수 우선)
      gainLight: 1
    },
    {
      id: 'echo_console',
      type: 'echo',
      tile: [10, 5],           // 게임기(9~10,3~4) 아래 floor. row5∉3~4 (검산: FREE)
      radius: 1.2,
      identitySlot: null,
      recall: '게임기 옆 작은 발자국 스티커. 하루가 붙여준 거였나.',
      gainMem: 0,              // echo: 회복 작게 (실제 적용은 core.js 상수 우선)
      gainLight: 1
    },
    {
      id: 'echo_bed',
      type: 'echo',
      tile: [6, 12],           // 침대 앞 floor. 침대(2~5,8~11) 옆 col6∉2~5 · row12∉하단벽13 (검산: FREE)
      radius: 1.2,
      hidden: true,            // 기억 비추기(빛)로 비출 때만 보이는 조각 (main.js 처리)
      identitySlot: null,
      recall: '침대 밑, 빛바랜 장난감 쥐. 한참을 같이 굴렸던 감각만 남아 있다.',
      gainMem: 0,              // echo: 회복 작게 (실제 적용은 core.js 상수 우선)
      gainLight: 1
    },
    {
      id: 'false_hana_waves',
      type: 'false',
      tile: [13, 11],          // 방 중앙 하단 floor (검산: FREE)
      radius: 1.3,
      identitySlot: null,
      recall: '하루가 웃으며 손을 흔든다 — 그런데 배경의 꽃은 이미 시들어 있다. 이건… 진짜가 아니야.',
      gainMem: -2,            // false: 줍는 순간 메모리 감소(core.js FALSE_HIT 처리, 형식상 표기)
      gainLight: 0
    }
  ],

  // ---------------------------------------------------------------------------
  // murks — 1체. 우측 영역을 순환.
  //   단위: speed = px/s, sightTiles = 타일, fovDeg = 도(°).
  //
  //   patrol 검산: 사각 순환 [13,6]→[19,6]→[19,8]→[13,8] (cols 13~19, rows 6~8).
  //     - 모든 waypoint FREE.
  //     - 모든 직선 leg 가 collision 비겹침 (침대 2~5/8~11, 옷장 17~19/9~11 모두 회피).
  //   ※ 주의: 하단 변을 row 8 로 유지(옷장 rows 9~11 위)하여 옷장 관통을 차단.
  //     row 10 까지 내리면 [17~19,10] 구간이 옷장과 겹치므로 사용하지 않는다.
  // ---------------------------------------------------------------------------
  murks: [
    {
      id: 'murk_a',
      patrol: [[13, 6], [19, 6], [19, 8], [13, 8]],
      speed: 38,               // px/s
      sightTiles: 3.3,         // 타일
      fovDeg: 90
    }
  ],

  // 정체성 카드 라벨 (slot 0..4) — '?'에서 또렷해지는 진행. 이름은 최종 보상으로 예고.
  identityLabels: [
    '종: 고양이',
    '사는 곳: 하루의 집',
    '주인: 하루',
    '이름: ? (지로)',
    '왜 잊었나'
  ]
};

if (typeof window !== 'undefined') window.DATA = DATA;
if (typeof module !== 'undefined') module.exports = DATA;
