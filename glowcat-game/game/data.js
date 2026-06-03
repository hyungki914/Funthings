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
  title: '지로의 방',
  music: 'room',                 // BGM 테마 (audio.js Audio2.music)
  ambient: 'dust',               // 환경 파티클(창가 먼지)
  controls: [                    // 이 스테이지에서 쓰는 단축키만 표시
    ['이동', 'WASD/←↑↓→'], ['조사', 'E'], ['발자국 추적', 'L'], ['기억 비추기', 'Q'], ['기억 일지', 'Tab']
  ],

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
  //   │ false 하루가 손 흔든다    │ [16,11] │ FREE — 우중앙 하단(스폰 최근접 탈피, 첫행동≠함정) │
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
      recall: "'오늘도 너는 창가에서 나를 기다렸지.' 사람의 손글씨. 이름이 적혀 있던 자리는, 아직 내가 읽어내지 못한 채 비어 있다.",
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
      tile: [16, 11],          // 우중앙 하단 floor (옷장17~19 옆, col16 FREE). 스폰[10,9]서 ~101px — 코어보다 멀게(첫 행동이 함정이 되지 않도록)
      radius: 1.3,
      identitySlot: null,
      recall: '하루가 웃으며 손을 흔든다 — 그런데 그 모습이 자꾸 흐려져, 손을 뻗으면 닿지 않는다. 이건… 진짜가 아니야.',
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
    '하루는 어디에'
  ],

  // 깨달음(클리어 시 회상 몽타주 마지막에 이어지는 챕터 깨달음) — main.js overlayRealize
  epiphany: [
    '흩어졌던 조각들이, 천천히 맞물린다.',
    '이 방, 이 냄새, 창가에 쏟아지던 햇살 — 전부 내 것이었다.',
    '나는 누군가의 곁에서 살았다. 그 사람의 이름은… 하루.',
    '그런데 내 이름이 적혀 있던 자리만, 아직 비어 있다.'
  ]
};

// =============================================================================
// DATA.chapter2 — 「집」 (거실 + 주방). 배경키 'room2'. 신규 적 Echo(청각 감지).
//   가구(타일 c,r,w,h): 소파(2,3,4,2) · TV(2,9,3,2) · 주방카운터(15,3,5,2)
//     · 냉장고(18,9,2,3) · 식탁(9,8,3,2). 러그(장식) cols8~11 rows5~7.
//   ★ Echo: 소리(이동 소음)로 감지 → 멈추거나 은신하면 안 들림. Murk(시각)와 대비.
// =============================================================================
DATA.chapter2 = {
  tile: 16, cols: 22, rows: 14, scale: 4, bgKey: 'room2',
  title: '집',
  music: 'house',
  ambient: 'dust',
  controls: [['이동', 'WASD/←↑↓→'], ['조사', 'E'], ['발자국 추적', 'L'], ['기억 비추기', 'Q'], ['기억 일지', 'Tab']],
  spawn: [6, 12],                 // 좌하단 floor (검산: FREE)
  coresNeeded: 3,
  collision: [
    [0, 0, 22, 2], [0, 13, 22, 1], [0, 0, 1, 14], [21, 0, 1, 14],   // 벽
    [2, 3, 4, 2],    // 소파
    [2, 9, 3, 2],    // TV 스탠드
    [15, 3, 5, 2],   // 주방 카운터
    [18, 9, 2, 3],   // 냉장고
    [9, 8, 3, 2]     // 식탁
  ],
  safeZones: [[2, 5, 4, 1]],      // 소파 앞 = 회복
  door: { tile: [10, 1], requires: 'cores' },
  shards: [
    { id: 'c2_photo', type: 'core', tile: [6, 5], radius: 1.3, identitySlot: 1,
      recall: '소파 위에 걸린 액자. 나와 하루가 나란히 앉아 웃고 있다. 이 거실에서 — 우리는 함께였다.' },
    { id: 'c2_bowls', type: 'core', tile: [16, 6], radius: 1.3, identitySlot: 2,
      recall: '주방 바닥, 그릇 둘. 하나는 내 것, 하나는 작은 사람용 컵. 하루가 매일 여기서 나를 먹였다.' },
    { id: 'c2_blanket', type: 'core', tile: [13, 11], radius: 1.3, identitySlot: 0,
      recall: '리모컨 옆 담요. 저녁이면 하루가 나를 무릎에 올렸고 — 나는 그르렁거렸다. 나는, 고양이다.' },
    { id: 'c2_button', type: 'echo', tile: [4, 6], radius: 1.2, identitySlot: null,
      recall: '소파 밑에서 굴러나온 낡은 단추. 하루의 외투에서 떨어진 것.' },
    { id: 'c2_memo', type: 'echo', tile: [10, 11], radius: 1.2, hidden: true, identitySlot: null,
      recall: "식탁 밑에 붙은 작은 메모 — '아침 약, 잊지 말 것'. 하루는 챙겨야 할 게 많은 사람이었다." },
    { id: 'c2_false', type: 'false', tile: [16, 11], radius: 1.3, identitySlot: null,
      recall: '주방에서 하루가 나를 부르는 목소리 — 그런데 돌아보면 아무도 없고, 그릇만 가만히 놓여 있다. 이건… 진짜가 아니야.' }
  ],
  // 시각 감지(Murk) — 거실 좌측 순찰
  murks: [
    { id: 'murk_b', patrol: [[4, 6], [7, 6], [7, 8], [4, 8]], speed: 38, sightTiles: 3.3, fovDeg: 90 }
  ],
  // 청각 감지(Echo) — 주방/우측 순찰. hearTiles = 소리 들리는 반경(타일)
  echoes: [
    { id: 'echo_a', patrol: [[13, 6], [18, 6], [18, 8], [13, 8]], speed: 36, hearTiles: 3.6 }
  ],
  identityLabels: ['종: 고양이', '사는 곳: 하루의 집', '주인: 하루', '이름: ? (지로)', '하루는 어디에'],
  epiphany: [
    '거실, 주방, 무릎 위의 담요 — 우리는 분명, 함께였다.',
    '매일 같은 시간 같은 자리에서, 나는 하루를 기다렸다.',
    '그런데 어느 아침부터, 집이 너무 조용해졌다.',
    '하루는 — 어디로 간 걸까.'
  ]
};

// 공통 단축키 & 정체성 라벨(반복 축약). 이름 공개 전/후 두 종.
const CTRL = [['이동', 'WASD/←↑↓→'], ['조사', 'E'], ['발자국 추적', 'L'], ['기억 비추기', 'Q'], ['기억 일지', 'Tab']];
const LBL  = ['종: 고양이', '사는 곳: 하루의 집', '주인: 하루', '이름: ? (지로)', '하루는 어디에'];
const LBLN = ['종: 고양이', '사는 곳: 하루의 집', '주인: 하루', '이름: 지로 (Ziro)', '하루는 어디에 — 갑자기 멀리, 아직 돌아오지 않은'];

// =============================================================================
// DATA.chapter3 — 「2층 복도·계단」 (세로 스크롤 18×26). bgKey 'hall2f'.
//   위로 오를수록 무거워지는 공기. 수직 카메라 + 외길 추격 도입.
// =============================================================================
DATA.chapter3 = {
  tile: 16, cols: 18, rows: 26, scale: 4, bgKey: 'hall2f',
  title: '2층으로', music: 'haru', ambient: 'dust', controls: CTRL,
  spawn: [9, 24], coresNeeded: 3,
  collision: [
    [0, 0, 18, 2], [0, 25, 18, 1], [0, 0, 1, 26], [17, 0, 1, 26],   // 테두리
    [1, 4, 5, 1],    // 상단 난간 좌
    [12, 4, 5, 1],   // 상단 난간 우
    [7, 7, 4, 2],    // 2층 수납장(복도 중앙)
    [1, 11, 3, 2],   // 좌 책장
    [14, 11, 3, 2],  // 우 책장
    [6, 15, 6, 2],   // 계단참 난간(가로)
    [2, 19, 4, 2],   // 하단 신발장
    [13, 19, 3, 2]   // 하단 화분
  ],
  safeZones: [[8, 12, 2, 1], [8, 22, 2, 1]],
  door: { tile: [8, 1], requires: 'cores' },
  shards: [
    { id: 'c_step_photo', type: 'core', tile: [3, 6], radius: 1.3, identitySlot: 0,
      recall: '계단 한 칸 한 칸에 내 작은 발자국이 배어 있다. 하루를 따라, 이 길을 수없이 올랐다.' },
    { id: 'c_step_rail', type: 'core', tile: [14, 8], radius: 1.3, identitySlot: 2,
      recall: '난간 끝, 닳아 반들거리는 자리. 하루의 손이 매일 여기를 잡았다. 손의 온기까지 닳아버린 듯.' },
    { id: 'c_step_door', type: 'core', tile: [4, 17], radius: 1.3, identitySlot: 3,
      recall: '복도 끝, 반쯤 닫힌 문 하나. 그 앞에서 나는 늘 멈춰 섰다 — 들어가도 될지, 알 수 없어서.' },
    { id: 'e_step_frame', type: 'echo', tile: [9, 9], radius: 1.2, identitySlot: null, obj: 'frame',
      recall: '빛바랜 액자 하나. 한쪽이 일부러 뒤집힌 채다 — 차마 보지 못한 한 장.' },
    { id: 'e_step_slipper', type: 'echo', tile: [15, 16], radius: 1.2, hidden: true, identitySlot: null,
      recall: '계단참에 놓인 한 켤레의 실내화. 급히 나간 듯, 한 짝이 비뚜로 놓여 있다.' },
    { id: 'f_step', type: 'false', tile: [4, 21], radius: 1.3, identitySlot: null,
      recall: '위층에서 하루의 발소리가 또박또박 내려온다 — 그런데 계단엔 먼지만 곱게 쌓여 있다. 이건… 진짜가 아니야.' }
  ],
  murks: [{ id: 'm_hall_up', patrol: [[2, 5], [6, 5], [6, 9], [2, 9]], speed: 38, sightTiles: 3.3, fovDeg: 90 }],
  echoes: [{ id: 'e_hall_low', patrol: [[6, 17], [12, 17], [12, 21], [6, 21]], speed: 36, hearTiles: 3.6 }],
  identityLabels: LBL,
  epiphany: [
    '한 칸 오를 때마다, 공기가 한 겹씩 무거워진다.',
    '이 위에 무엇이 있는지, 몸은 이미 알고 있는 것 같다.',
    '하루를 따라 수없이 올랐던 길. 그런데 발걸음이 자꾸 멈춘다.',
    '가지 말라고, 누군가 등 뒤에서 옷자락을 잡는 것만 같다.',
    '그래도 나는, 저 문을 향해 한 칸 더 오른다.'
  ]
};

// =============================================================================
// DATA.chapter4 — 「하루의 방」 (22×14). bgKey 'haru_room'. false 다수·정적 강조.
// =============================================================================
DATA.chapter4 = {
  tile: 16, cols: 22, rows: 14, scale: 4, bgKey: 'haru_room',
  title: '하루의 방', music: 'haru', ambient: 'dust', controls: CTRL,
  spawn: [10, 11], coresNeeded: 3,
  collision: [
    [0, 0, 22, 2], [0, 13, 22, 1], [0, 0, 1, 14], [21, 0, 1, 14],
    [3, 3, 4, 3],    // 하루의 침대(좌상)
    [16, 3, 4, 2],   // 책상(우상)
    [9, 7, 4, 2],    // 중앙 낮은 테이블
    [17, 9, 3, 3],   // 옷장(우하)
    [2, 10, 3, 2]    // 인형 선반(좌하)
  ],
  safeZones: [[2, 7, 2, 1]],
  door: { tile: [10, 1], requires: 'cores' },
  shards: [
    { id: 'c_haru_bed', type: 'core', tile: [5, 6], radius: 1.3, identitySlot: 1,
      recall: '이불이 한쪽으로 걷힌 채다. 누군가 급히 일어난 자리. 나는 매일 그 빈 쪽에 몸을 말고, 돌아올 온기를 기다렸다.' },
    { id: 'c_haru_clock', type: 'core', tile: [18, 5], radius: 1.3, identitySlot: 3,
      recall: '벽시계는 그날 새벽의 시각에서 멈춰 있다. 모든 게 그 아침에서 정지한 것처럼.' },
    { id: 'c_haru_bottle', type: 'core', tile: [3, 9], radius: 1.3, identitySlot: 2, obj: 'bottle',
      recall: '뚜껑도 닫지 못한 채 넘어진 약병 하나. 챙길 새도 없이, 하루는 그렇게 실려 갔다.' },
    { id: 'e_haru_sweater', type: 'echo', tile: [14, 11], radius: 1.2, hidden: true, identitySlot: null,
      recall: '의자에 걸린 하루의 스웨터. 코를 묻으면, 아직 옅게 하루의 냄새가 난다.' },
    { id: 'f_haru_wave', type: 'false', tile: [12, 5], radius: 1.3, identitySlot: null,
      recall: '하루가 침대에서 일어나 나를 안아 올린다 — 그런데 품에 온기가 없고, 무게도 느껴지지 않는다. 이건… 진짜가 아니야.' },
    { id: 'f_haru_call', type: 'false', tile: [15, 11], radius: 1.3, identitySlot: null,
      recall: '달력 너머로 하루가 "내일 보자"고 손짓한다 — 그런데 그 내일이 며칠인지, 자꾸 흐려진다. 이건… 진짜가 아니야.' }
  ],
  murks: [],
  echoes: [{ id: 'e_haru', patrol: [[8, 5], [13, 5], [13, 9], [8, 9]], speed: 34, hearTiles: 3.6 }],
  identityLabels: LBL,
  branch: { q: '급히 멈춘 이 방을 두고, 나는 어떻게 발을 떼야 할까.', options: [
    { label: '찾으러 가자', sub: '하루는 어딘가에 살아 있다. 멈춘 건 시계뿐이다.', feedback: '발끝에 다시 온기가 돈다 — 나는 문을 향한다.' },
    { label: '여기서 기다리자', sub: '떠난 자리는, 떠난 채로 두는 게 맞는지도 모른다.', feedback: '나는 빈 이불에 코를 묻는다. 조금만, 더.' } ] },
  epiphany: [
    '걷힌 이불, 멈춘 시계, 넘어진 약병.',
    '모든 게 어느 아침에서 급히 멈췄다.',
    '그날, 하루는 갑자기 아팠고 — 들것에 실려 떠났다.',
    '나는 영문도 모른 채, 빈자리에서 온기를 기다렸다.',
    '잘못된 게 아니었다. 하루는 아직, 돌아오지 않았을 뿐이다.'
  ]
};

// =============================================================================
// DATA.chapter5 — 「집 근처/마당」 (24×14, 경계 스크롤). bgKey 'yard'. Murk 2 + Echo 1.
// =============================================================================
DATA.chapter5 = {
  tile: 16, cols: 24, rows: 14, scale: 4, bgKey: 'yard',
  title: '집 근처', music: 'town', ambient: 'leaves', controls: CTRL,
  spawn: [12, 12], coresNeeded: 3,
  collision: [
    [0, 0, 24, 2], [0, 13, 24, 1], [0, 0, 1, 14], [23, 0, 1, 14],
    [2, 3, 3, 2],    // 나무 그늘(좌상)
    [18, 3, 4, 2],   // 창고(우상)
    [9, 6, 4, 2],    // 화단(중앙 커버)
    [5, 9, 3, 2],    // 평상(좌하)
    [16, 9, 4, 2]    // 담장 일부(우하)
  ],
  safeZones: [[2, 6, 2, 1], [19, 6, 2, 1]],
  door: { tile: [12, 1], requires: 'cores' },
  shards: [
    { id: 'c_yard_path', type: 'core', tile: [12, 8], radius: 1.3, identitySlot: 2,
      recall: '마당에 쏟아지는 햇빛. 따뜻한데 — 어쩐지 시리다. 이 빛을, 나는 하루 없이 처음 맞는다.' },
    { id: 'c_yard_shed', type: 'core', tile: [20, 6], radius: 1.3, identitySlot: 1,
      recall: '마당 끝 작은 문. 하루의 손이 매일 밀어 열던 문이, 오늘은 혼자 삐걱인다.' },
    { id: 'c_yard_tree', type: 'core', tile: [3, 7], radius: 1.3, identitySlot: 3,
      recall: '현관 문턱. 그날 아침, 하루는 들것에 실려 이 문턱을 넘어갔다 — 나를 한 번 돌아보며.' },
    { id: 'e_yard_bowl', type: 'echo', tile: [7, 11], radius: 1.2, identitySlot: null, obj: 'bowl',
      recall: '작은 물그릇 하나. 하루가 길고양이들을 위해 내놓던 것. 물은 말랐다.' },
    { id: 'e_yard_paw', type: 'echo', tile: [18, 11], radius: 1.2, hidden: true, identitySlot: null,
      recall: '마당 흙에 굳은 발자국 하나. 멀어지는 불빛을 따라, 대문까지 달렸던 자국.' },
    { id: 'f_yard', type: 'false', tile: [14, 11], radius: 1.3, identitySlot: null,
      recall: '대문 너머로 하루가 장을 보고 돌아온다 — 그런데 손엔 아무것도 없고, 발소리도 들리지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_yard_l', patrol: [[3, 7], [8, 7], [8, 11], [3, 11]], speed: 38, sightTiles: 3.3, fovDeg: 90 },
    { id: 'm_yard_r', patrol: [[14, 5], [21, 5], [21, 8], [14, 8]], speed: 38, sightTiles: 3.3, fovDeg: 90 }
  ],
  echoes: [{ id: 'e_yard', patrol: [[10, 10], [15, 10], [15, 12], [10, 12]], speed: 36, hearTiles: 3.6 }],
  identityLabels: LBL,
  epiphany: [
    '처음으로 집 밖에 선다. 햇빛은 아무 일 없었다는 듯 환하다.',
    '세상은 그대로 흐르는데, 하루만 여기 없다.',
    '그 무심함이 무섭다가도 — 문득 생각한다.',
    '멀리 어딘가에서, 하루도 이 햇빛 아래 있을까.'
  ]
};

// =============================================================================
// DATA.chapter6 — 「길거리」 (가로 스크롤 40×14). bgKey 'street'. Murk 2 + Echo 2. 징검다리 안전지대.
// =============================================================================
DATA.chapter6 = {
  tile: 16, cols: 40, rows: 14, scale: 4, bgKey: 'street',
  title: '길거리', music: 'dusk', ambient: 'leaves', controls: CTRL,
  spawn: [2, 7], coresNeeded: 3,
  collision: [
    [0, 0, 40, 2], [0, 13, 40, 1], [0, 0, 1, 14], [39, 0, 1, 14],
    [5, 3, 3, 2],    // 가로수1
    [5, 9, 3, 2],    // 벤치1
    [14, 4, 4, 2],   // 정류장
    [13, 9, 3, 2],   // 화단2
    [22, 3, 3, 2],   // 가로수2
    [23, 9, 4, 2],   // 주차 차량
    [31, 4, 4, 2],   // 가게 차양
    [32, 9, 3, 2]    // 가로수3
  ],
  safeZones: [[10, 6, 2, 1], [19, 6, 2, 1], [28, 6, 2, 1]],
  door: { tile: [38, 1], requires: 'cores' },
  shards: [
    { id: 'c_st_cross', type: 'core', tile: [11, 11], radius: 1.3, identitySlot: 2,
      recall: '횡단보도 앞. 하루는 늘 나를 한 발 뒤로 막아서며 기다렸다. 그 손의 그림자가, 아직 발밑에 어른거린다.' },
    { id: 'c_st_steps', type: 'core', tile: [16, 7], radius: 1.3, identitySlot: 1,
      recall: '보도블록 위, 두 줄의 발자국. 사람의 보폭과 나의 보폭이 나란히 찍혀 있다. 우리는 이 길을 함께 걸었다.' },
    { id: 'c_st_light', type: 'core', tile: [34, 11], radius: 1.3, identitySlot: 3,
      recall: '저녁 가로등. 불빛 아래에서 하루는 내 이름을 부르곤 했다 — 그 두 음절. 어딘가에서, 다시 불러주고 있을까.' },
    { id: 'e_st_bench', type: 'echo', tile: [6, 11], radius: 1.2, identitySlot: null,
      recall: '둘이 잠깐 앉아 숨을 고르던 시간의 기억. 그 온기가 한쪽에만, 아직 옅게 남아 있다.' },
    { id: 'e_st_glove', type: 'echo', tile: [25, 11], radius: 1.2, hidden: true, identitySlot: null,
      recall: '길가에 떨어진 한 짝의 장갑. 하루의 손을 닮은 온기가, 이제는 없다.' },
    { id: 'f_st', type: 'false', tile: [21, 4], radius: 1.3, identitySlot: null,
      recall: '저만치 앞에서 하루가 돌아보며 손짓한다 — 그런데 다가갈수록 멀어지고, 끝내 따라잡히지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_st_1', patrol: [[8, 6], [15, 6], [15, 8], [8, 8]], speed: 38, sightTiles: 3.3, fovDeg: 90 },
    { id: 'm_st_2', patrol: [[26, 6], [34, 6], [34, 8], [26, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  echoes: [
    { id: 'e_st_1', patrol: [[17, 11], [22, 11], [22, 12], [17, 12]], speed: 36, hearTiles: 3.6 },
    { id: 'e_st_2', patrol: [[28, 11], [35, 11], [35, 12], [28, 12]], speed: 36, hearTiles: 3.6 }
  ],
  identityLabels: LBL,
  branch: { q: '옆자리가 빈 이 길을, 나는 어떤 마음으로 걸을까.', options: [
    { label: '이 길 끝에 하루가 있다', sub: '발자국은 끊겨도, 길은 이어진다.', feedback: '한 줄이던 발자국 옆에, 다시 한 줄을 그리며 걷는다.' },
    { label: '이미 멀어진 길이다', sub: '따라잡지 못할 거리라면, 멈추는 것도 걸음이다.', feedback: '가로등 아래에서, 나는 잠시 발을 멈춘다.' } ] },
  epiphany: [
    '같은 길, 같은 모퉁이. 그런데 옆자리가 비어 있다.',
    '두 줄이던 발자국이, 어느 순간 한 줄이 됐다.',
    '길이 길수록, 그리움도 그만큼 길어진다.',
    '그래도 이 길 끝 어딘가에 하루가 있다면, 나는 계속 걷겠다.'
  ]
};

// =============================================================================
// DATA.chapter7 — 「근처 상가」 (24×16, 칸막이 미로). bgKey 'arcade'. Echo 3 + Murk 1. false 없음.
// =============================================================================
DATA.chapter7 = {
  tile: 16, cols: 24, rows: 16, scale: 4, bgKey: 'arcade',
  title: '근처 상가', music: 'room', ambient: 'dust', controls: CTRL,
  spawn: [11, 14], coresNeeded: 3,
  collision: [
    [0, 0, 24, 2], [0, 15, 24, 1], [0, 0, 1, 16], [23, 0, 1, 16],
    [4, 2, 1, 6],    // 좌측 칸막이
    [9, 2, 1, 5],    // 중앙 칸막이1
    [14, 4, 1, 7],   // 중앙 칸막이2
    [18, 2, 1, 6],   // 우측 칸막이
    [5, 8, 5, 1],    // 가로 진열대1
    [10, 11, 6, 1],  // 가로 진열대2
    [2, 12, 2, 2],   // 좌하 상자더미
    [19, 11, 3, 2]   // 우하 매대
  ],
  safeZones: [[2, 9, 2, 1], [20, 8, 2, 1]],
  door: { tile: [11, 1], requires: 'cores' },
  shards: [
    { id: 'c_arc_left', type: 'core', tile: [2, 5], radius: 1.3, identitySlot: 1,
      recall: '동물병원 진료대. 차가운 금속, 그런데 하루의 손이 늘 내 등을 받쳐주어 무섭지 않았다. “괜찮아, 지로.” 그 목소리.' },
    { id: 'c_arc_mid', type: 'core', tile: [11, 8], radius: 1.3, identitySlot: 2,
      recall: '단골 카페 창가 자리. 하루는 따뜻한 걸 마시고, 나는 그 무릎에서 졸았다. 점원이 늘 내 몫의 간식을 챙겨줬다.' },
    { id: 'c_arc_right', type: 'core', tile: [21, 5], radius: 1.3, identitySlot: 3, obj: 'treat',
      recall: '내가 제일 좋아하던 그 간식. 하루는 망설임 없이 늘 같은 걸 집었다 — 내가 뭘 좋아하는지, 다 알았다.' },
    { id: 'e_arc_chart', type: 'echo', tile: [7, 10], radius: 1.2, identitySlot: null, obj: 'chart',
      recall: '병원 진료 차트 한 장. 다음 검진 날짜에 작은 동그라미. 그날을, 우리는 함께 가지 못했다.' },
    { id: 'e_arc_collar', type: 'echo', tile: [16, 9], radius: 1.2, hidden: true, identitySlot: null,
      recall: '내 목걸이와 똑같은 것. 하루가 이걸 골라 내 목에 채워줬던 날의 손길.' },
    { id: 'e_arc_card', type: 'echo', tile: [12, 13], radius: 1.2, identitySlot: null, obj: 'card',
      recall: '카페 적립 카드 한 장. 도장 한 칸만 채우면 무료 음료. "다음에 같이 받자, 지로." 그 다음이, 아직 안 왔다.' }
  ],
  murks: [{ id: 'm_arc', patrol: [[10, 2], [13, 2], [13, 4], [10, 4]], speed: 38, sightTiles: 3.3, fovDeg: 90 }],
  echoes: [
    { id: 'e_arc_1', patrol: [[5, 4], [8, 4], [8, 7], [5, 7]], speed: 36, hearTiles: 3.6 },
    { id: 'e_arc_2', patrol: [[15, 5], [17, 5], [17, 9], [15, 9]], speed: 36, hearTiles: 3.6 },
    { id: 'e_arc_3', patrol: [[6, 12], [12, 12], [12, 13], [6, 13]], speed: 36, hearTiles: 3.6 }
  ],
  identityLabels: LBL,
  epiphany: [
    '간식의 맛, 진료대의 온기, 내 이름을 불러주던 점원들.',
    '이 거리의 모두가 우리를 ‘하루와 지로’로 기억한다.',
    '행복이 이렇게 또렷해서 — 비어버린 지금이 더 시리다.',
    '하지만 못 받은 도장 한 칸, 못 간 검진 하루 —',
    '전부, 다음을 위해 남겨둔 자리다.'
  ]
};

// =============================================================================
// DATA.chapter8 — 「공원 입구」 (22×16, 관문). bgKey 'park_gate'. Murk 2 + Echo 1. 게이트 통과.
// =============================================================================
DATA.chapter8 = {
  tile: 16, cols: 22, rows: 16, scale: 4, bgKey: 'park_gate',
  title: '공원 입구', music: 'park', ambient: 'leaves', controls: CTRL,
  spawn: [10, 14], coresNeeded: 3,
  collision: [
    [0, 0, 22, 2], [0, 15, 22, 1], [0, 0, 1, 16], [21, 0, 1, 16],
    [1, 5, 8, 1],    // 1차 게이트 벽 좌 (중앙 col9~11 통과)
    [12, 5, 9, 1],   // 1차 게이트 벽 우
    [1, 9, 7, 1],    // 2차 게이트 벽 좌 (중앙 col8~13 통과)
    [14, 9, 7, 1],   // 2차 게이트 벽 우
    [3, 2, 3, 2],    // 매표소(좌상)
    [16, 2, 4, 2],   // 안내판(우상)
    [9, 12, 4, 2]    // 분수 받침(하단 커버)
  ],
  safeZones: [[10, 7, 2, 1]],
  door: { tile: [10, 1], requires: 'cores' },
  shards: [
    { id: 'c_gate_ticket', type: 'core', tile: [4, 4], radius: 1.3, identitySlot: 2,
      recall: '공원 입구의 철문. 하루의 손이 매일 밀어 열던 문. 지금은 내 작은 몸으로 밀어야 한다 — 떨리는 발로.' },
    { id: 'c_gate_sign', type: 'core', tile: [18, 4], radius: 1.3, identitySlot: 3,
      recall: "입구의 낡은 안내판. '반려동물 동반 가능'. 하루가 손가락으로 이 글자를 짚으며 웃던 기억." },
    { id: 'c_gate_low', type: 'core', tile: [6, 12], radius: 1.3, identitySlot: 1,
      recall: '문 안쪽 첫 발자국. 여기서부터, 우리의 산책은 늘 시작됐다. 그리고 여기서, 나는 늘 가장 설렜다.' },
    { id: 'e_gate_lamp', type: 'echo', tile: [7, 11], radius: 1.2, identitySlot: null,
      recall: '어둑할 때 둘이 돌아오던 길을 비추던 불빛의 기억. 그 따스한 깜빡임이, 아직 눈에 선하다.' },
    { id: 'e_gate_leaf', type: 'echo', tile: [15, 11], radius: 1.2, hidden: true, identitySlot: null,
      recall: '문틈에 낀 마른 잎 한 장. 계절이 몇 번이나 바뀌도록, 아무도 치우지 않았다.' },
    { id: 'f_gate', type: 'false', tile: [6, 7], radius: 1.3, identitySlot: null,
      recall: '문 안쪽에서 하루가 “어서 와” 하고 기다린다 — 그런데 그 모습이 햇빛에 비치지 않고, 발밑에 그림자가 없다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_gate_1', patrol: [[9, 6], [12, 6], [12, 8], [9, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 },
    { id: 'm_gate_2', patrol: [[8, 10], [13, 10], [13, 11], [8, 11]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  echoes: [{ id: 'e_gate', patrol: [[3, 11], [7, 11], [7, 13], [3, 13]], speed: 36, hearTiles: 3.6 }],
  identityLabels: LBL,
  branch: { q: '이 문 너머의 답을, 나는 마주할 준비가 됐을까.', options: [
    { label: '문을 민다', sub: '답이 무엇이든, 모르는 채로는 둘 수 없다.', feedback: '떨리던 발에 힘이 들어간다. 문이 열린다.' },
    { label: '여기까지일지도', sub: '모르는 채로 두면, 아무것도 끝나지 않는다.', feedback: '문고리에 닿은 발이, 잠깐 머뭇거린다.' } ] },
  epiphany: [
    '이 문을 지나면, 더는 모르는 척할 수 없다.',
    '몸이 떨린다. 알고 싶지 않은 게 아니라 — 알아내고 싶어서.',
    '하루가 어디 있는지, 그 끝까지 가봐야 한다.',
    '무서워도 — 나는 문을 민다.'
  ]
};

// =============================================================================
// DATA.chapter9 — 「공원」 (28×16, 가로 약간 스크롤). bgKey 'park'. Murk 2 + Echo 2 합동. 최고 난이도.
//   이름이 또렷해진다(이름: 지로). 진실이 거의 다 드러나는 클라이맥스.
// =============================================================================
DATA.chapter9 = {
  tile: 16, cols: 28, rows: 16, scale: 4, bgKey: 'park',
  title: '공원', music: 'park', ambient: 'leaves', controls: CTRL,
  spawn: [14, 13], coresNeeded: 3,
  collision: [
    [0, 0, 28, 2], [0, 15, 28, 1], [0, 0, 1, 16], [27, 0, 1, 16],
    [3, 3, 2, 2],    // 나무1
    [10, 3, 3, 1],   // 벤치
    [22, 3, 3, 2],   // 나무2
    [12, 8, 4, 4],   // 중앙 분수(큰 커버)
    [4, 10, 2, 2],   // 나무3
    [23, 10, 3, 2],  // 덤불
    [7, 6, 3, 1]     // 산책로 화단
  ],
  safeZones: [[10, 6, 2, 1], [19, 12, 2, 1]],
  door: { tile: [14, 1], requires: 'cores' },
  shards: [
    { id: 'c_park_bench', type: 'core', tile: [11, 5], radius: 1.3, identitySlot: 4,
      recall: '벤치. 우리가 매일 함께 앉던 자리. 나는 여기서 하루를 기다렸다 — 그 아침 이후로, 오래오래.' },
    { id: 'c_park_walk', type: 'core', tile: [6, 12], radius: 1.3, identitySlot: 2,
      recall: '산책로에 남은 작은 발자국들. 하루의 옆에서, 나는 이 길을 수없이 걸었다.' },
    { id: 'c_park_last', type: 'core', tile: [25, 12], radius: 1.3, identitySlot: 3,
      recall: '마지막으로 함께한 날의 햇살. 하루는 평소보다 오래 나를 안았다 — "금방 올게, 지로." 그게, 갑자기 멀어질 줄은 몰랐다.' },
    { id: 'e_park_bell', type: 'echo', tile: [24, 7], radius: 1.2, identitySlot: null, obj: 'bell',
      recall: '낡은 목걸이 방울 하나. 흔들면, 아직 그날의 소리가 난다.' },
    { id: 'e_park_leaf', type: 'echo', tile: [8, 4], radius: 1.2, hidden: true, identitySlot: null,
      recall: '벤치 밑에 눌린 마른 잎 한 장. 계절이 몇 번 바뀌도록 이 자리를 지킨 건, 떠나지 못해서가 아니라 — 여기서 다시 만날 것 같아서였다.' },
    { id: 'f_park', type: 'false', tile: [17, 5], radius: 1.3, identitySlot: null,
      recall: '저 멀리 하루가 걸어온다 — 손을 흔들며. 그러나 다가갈수록 흐려지고, 끝내 닿지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_park_1', patrol: [[18, 5], [24, 5], [24, 8], [18, 8]], speed: 42, sightTiles: 3.5, fovDeg: 90 },
    { id: 'm_park_2', patrol: [[5, 12], [11, 12], [11, 14], [5, 14]], speed: 42, sightTiles: 3.5, fovDeg: 90 }
  ],
  echoes: [
    { id: 'e_park_1', patrol: [[8, 8], [11, 8], [11, 11], [8, 11]], speed: 38, hearTiles: 3.7 },
    { id: 'e_park_2', patrol: [[17, 9], [22, 9], [22, 12], [17, 12]], speed: 38, hearTiles: 3.7 }
  ],
  identityLabels: LBLN,
  epiphany: [
    '공원의 벤치. 우리가 매일 걷던 길의 끝.',
    '그 아침, 하루는 갑자기 사라졌고 — 나는 여기서 기다렸다.',
    '기억이 흐려진 건 잊어서가 아니라, 너무 오래 혼자 기다려서였다.',
    '하루는 떠난 게 아니다. 어쩌면 하루도, 지금 나를 찾고 있을지 모른다.',
    '이제, 그 텅 빈 자리(The Blank)를 마주할 차례다.'
  ]
};

// =============================================================================
// DATA.chapter10 — 「빈자리 (The Blank)」 (16×12, isFinal). bgKey 'blank'. 적 없음. 최종 선택/엔딩.
// =============================================================================
DATA.chapter10 = {
  tile: 16, cols: 16, rows: 12, scale: 4, bgKey: 'blank',
  title: '빈자리', music: 'blank', ambient: 'motes', isFinal: true,
  controls: [['이동', 'WASD/←↑↓→'], ['조사', 'E'], ['기억 일지', 'Tab']],
  spawn: [8, 9], coresNeeded: 3,
  collision: [
    [0, 0, 16, 2], [0, 11, 16, 1], [0, 0, 1, 12], [15, 0, 1, 12],
    [7, 5, 2, 2]     // 중앙 좌대(The Blank 자리)
  ],
  safeZones: [],
  door: { tile: [8, 1], requires: 'cores' },
  boss: { hp: 3, tile: [8, 5], waveR: 3.4 },   // 공백(The Blank) — idle에 Q로 타격(3회), charge→망각 파동(근접 피해) 회피
  shards: [
    { id: 'c_blank_name', type: 'core', tile: [4, 5], radius: 1.4, identitySlot: 4,
      recall: "비어 있던 이름표 위로, 글자가 천천히 떠오른다. '지로'. 하루가 처음 나를 안아 올리며 지어준, 세상에서 가장 따뜻한 두 음절." },
    { id: 'c_blank_promise', type: 'core', tile: [11, 5], radius: 1.4, identitySlot: 3,
      recall: '끊겼던 목소리가 이어진다. "…밥 잘 챙겨 먹고… 금방 올게." 아직 지켜지지 않았을 뿐인, 약속.' },
    { id: 'c_blank_void', type: 'core', tile: [8, 3], radius: 1.4, identitySlot: 4,
      recall: '그리고 텅 빈 자리. 이 공백은 슬픔이 아니라 — 아직 하루가 돌아오지 않은, 채워질 수 있는 빈칸이었다.' },
    { id: 'e_blank_pov', type: 'echo', tile: [12, 3], radius: 1.2, hidden: true, identitySlot: null,
      recall: '낯선 시점의 한 장면 — 멀리 어느 창가에서, 하루가 작은 검은 고양이를 떠올리고 있다. 어쩌면 하루도, 나를 찾고 있는지 모른다.' },
    { id: 'f_blank', type: 'false', tile: [8, 8], radius: 1.3, identitySlot: null,
      recall: '공백 속에서 하루가 손을 내민다, 이 모든 게 꿈이었다는 듯이 — 그러나 그 손을 잡으면 기다림은 처음으로 되감긴다. 이건… 진짜가 아니야.' }
  ],
  murks: [],
  echoes: [],
  identityLabels: LBLN,
  epiphany: [
    '마지막 조각이, 손끝에 닿는다.',
    '내 이름은 지로. 하루가 불러주던 그 이름.',
    '공백은 끝이 아니라, 아직 답을 받지 못한 물음이었다.',
    '끝까지 찾아 나설지, 새 온기 속에서 살아갈지 —',
    '이제, 내가 정한다.'
  ]
};

// =============================================================================
// 20스테이지 확장 — 신규 10챕터(기존 10챕터 사이에 인터리빙). 순서는 main.js CHAPTERS.
//   설계: docs/20_story_20stage.md(서사) · docs/20_level_balance_20stage.md(레벨/밸런스).
//   런타임 makeLayout 가 idx>=2 의 비고정 조각·순찰을 안전 타일로 재배치하므로
//   아래 좌표는 유효 시드(폴백). coresNeeded 전 챕터 3 유지.
// =============================================================================

// CH3 「현관」 — 집과 바깥의 경계. 두 짧은 갈래(신발장/우산꽂이) 미니 동선.
DATA.chapter_entry = {
  tile: 16, cols: 22, rows: 14, scale: 4, bgKey: 'entryway',
  title: '현관', music: 'house', ambient: 'dust', controls: CTRL,
  spawn: [11, 12], coresNeeded: 3,
  collision: [
    [0, 0, 22, 2], [0, 13, 22, 1], [0, 0, 1, 14], [21, 0, 1, 14],
    [2, 3, 4, 2], [16, 3, 4, 2], [9, 6, 4, 2], [2, 9, 3, 2], [17, 9, 3, 2]
  ],
  safeZones: [[2, 6, 2, 1], [18, 7, 2, 1]],
  door: { tile: [11, 1], requires: 'cores' },
  shards: [
    { id: 'c_ent_shoe', type: 'core', tile: [4, 6], radius: 1.3, identitySlot: 1, obj: 'shoe',
      recall: '현관에 가지런하던 신발 한 켤레. 하루가 매일 신고 나섰다 — 그날만, 짝이 흐트러진 채였다.' },
    { id: 'c_ent_leash', type: 'core', tile: [18, 6], radius: 1.3, identitySlot: 2, obj: 'leash',
      recall: '벽에 걸린 산책 줄. 내 것이다. 이게 짤랑이면, 꼬리가 먼저 일어섰다.' },
    { id: 'c_ent_mat', type: 'core', tile: [11, 9], radius: 1.3, identitySlot: 3,
      recall: '문 앞 매트. 하루의 발과 내 발이 나란히 닦이던 자리. 흙냄새 끝엔 늘 집냄새가 났다.' },
    { id: 'e_ent_umbrella', type: 'echo', tile: [15, 11], radius: 1.2, identitySlot: null, obj: 'umbrella',
      recall: '미처 마르지 못한 우산 하나. 급히 나서느라 편 채로 둔 것.' },
    { id: 'e_ent_key', type: 'echo', tile: [6, 11], radius: 1.2, hidden: true, identitySlot: null,
      recall: '바닥에 떨어진 열쇠고리. 하루의 손에서 미끄러진 듯, 아직 그 자리다.' },
    { id: 'f_ent', type: 'false', tile: [13, 4], radius: 1.3, identitySlot: null,
      recall: '현관문이 열리며 하루가 들어선다 — 그런데 신발 소리가 없고, 발밑에 그림자도 지지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [{ id: 'm_ent', patrol: [[8, 3], [13, 3], [13, 5], [8, 5]], speed: 38, sightTiles: 3.3, fovDeg: 90 }],
  echoes: [{ id: 'e_ent', patrol: [[13, 11], [18, 11], [18, 12], [13, 12]], speed: 36, hearTiles: 3.6 }],
  identityLabels: LBL, branch: null,
  epiphany: [
    '집과 바깥의 경계, 현관.',
    '하루는 늘 여기서 한 번 나를 돌아보고 나섰다.',
    '그날의 신발만, 짝이 어긋난 채였다.',
    '그 어긋남을 따라, 나는 처음 문 밖으로 발을 내민다.'
  ]
};

// CH7 「버스정류장」 — 함께 떠나던 출발점. 앉아 기다리는 척(정지)으로 통과.
DATA.chapter_busstop = {
  tile: 16, cols: 22, rows: 16, scale: 4, bgKey: 'busstop',
  title: '버스정류장', music: 'town', ambient: 'leaves', controls: CTRL,
  spawn: [11, 14], coresNeeded: 3,
  collision: [
    [0, 0, 22, 2], [0, 15, 22, 1], [0, 0, 1, 16], [21, 0, 1, 16],
    [3, 3, 5, 2], [14, 3, 5, 2], [9, 7, 4, 1], [3, 10, 3, 2], [16, 10, 3, 2]
  ],
  safeZones: [[9, 9, 2, 1], [18, 5, 2, 1]],
  door: { tile: [11, 1], requires: 'cores' },
  shards: [
    { id: 'c_bus_sign', type: 'core', tile: [16, 5], radius: 1.3, identitySlot: 2, obj: 'sign',
      recall: '정류장 노선도. 하루가 손가락으로 짚으며 "여기서 갈아타자" 하던 그 자리. 우리가 어딘가로 떠나던 출발점.' },
    { id: 'c_bus_bench', type: 'core', tile: [11, 9], radius: 1.3, identitySlot: 1,
      recall: '둘이 버스를 기다리던 벤치. 나는 늘 하루의 발치에 몸을 말고, 도착 안내를 같이 들었다.' },
    { id: 'c_bus_step', type: 'core', tile: [7, 12], radius: 1.3, identitySlot: 3,
      recall: '정류장 바닥의 작은 발자국. 차가 설 때마다 한 발 앞으로 나서던 버릇 — 떠나는 게 아니라, 함께 타려고.' },
    { id: 'e_bus_ticket', type: 'echo', tile: [7, 5], radius: 1.2, identitySlot: null, obj: 'ticket',
      recall: '구겨진 승차권 한 장. 하루의 외투 주머니에서 떨어진 것일까.' },
    { id: 'e_bus_glove', type: 'echo', tile: [15, 12], radius: 1.2, hidden: true, identitySlot: null,
      recall: '벤치 밑 장갑 한 짝. 추운 날, 하루가 한 손을 비워 나를 쓰다듬던 그 손의 것.' },
    { id: 'f_bus', type: 'false', tile: [12, 4], radius: 1.3, identitySlot: null,
      recall: '버스가 서고 하루가 손짓하며 내린다 — 그런데 문이 열리는 소리가 없고, 발이 보도에 닿지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [{ id: 'm_bus', patrol: [[14, 5], [18, 5], [18, 7], [14, 7]], speed: 38, sightTiles: 3.4, fovDeg: 90 }],
  echoes: [
    { id: 'e_bus_1', patrol: [[6, 8], [12, 8], [12, 10], [6, 10]], speed: 36, hearTiles: 3.6 },
    { id: 'e_bus_2', patrol: [[12, 12], [17, 12], [17, 13], [12, 13]], speed: 36, hearTiles: 3.6 }
  ],
  identityLabels: LBL, branch: null,
  epiphany: [
    '버스를 기다리던 정류장.',
    '함께 어딘가로 떠나던, 우리의 출발점이었다.',
    '이제 나 혼자, 같은 자리에 앉아 도착을 센다.',
    '그래도 어느 버스의 끝엔, 하루가 있을 것만 같다.'
  ]
};

// CH8 「큰길」 — 44칸 최장 가로 회랑. 4 징검다리로 달리고-숨기. 분기.
DATA.chapter_avenue = {
  tile: 16, cols: 44, rows: 14, scale: 4, bgKey: 'avenue',
  title: '큰길', music: 'dusk', ambient: 'leaves', controls: CTRL,
  spawn: [2, 7], coresNeeded: 3,
  collision: [
    [0, 0, 44, 2], [0, 13, 44, 1], [0, 0, 1, 14], [43, 0, 1, 14],
    [6, 3, 4, 2], [6, 9, 4, 2], [15, 4, 4, 2], [16, 9, 3, 2],
    [24, 3, 4, 2], [25, 9, 3, 2], [34, 4, 4, 2], [34, 9, 4, 2]
  ],
  safeZones: [[12, 6, 2, 1], [21, 6, 2, 1], [30, 6, 2, 1], [38, 6, 2, 1]],
  door: { tile: [42, 1], requires: 'cores' },
  shards: [
    { id: 'c_av_cross', type: 'core', tile: [10, 11], radius: 1.3, identitySlot: 2,
      recall: '넓은 횡단보도. 하루는 늘 한 팔로 내 앞을 막아 세우고 신호를 기다렸다. "지로, 잠깐." 그 팔이 없는 지금, 나는 처음 혼자 신호를 센다.' },
    { id: 'c_av_walk', type: 'core', tile: [22, 7], radius: 1.3, identitySlot: 1,
      recall: '대로에 남은 두 줄 발자국. 사람의 보폭과 나의 보폭이 끝까지 나란하다. 우리는 이 넓은 길도 함께 건넜다.' },
    { id: 'c_av_light', type: 'core', tile: [39, 11], radius: 1.3, identitySlot: 3,
      recall: '대로 끝 신호등. 파란불이 켜질 때마다, 하루는 내 이름을 부르며 발을 뗐다. 그 두 음절이 신호처럼 남아 있다.' },
    { id: 'e_av_bag', type: 'echo', tile: [18, 11], radius: 1.2, identitySlot: null, obj: 'bag',
      recall: '길에 떨어진 장바구니. 하루가 자주 들던 것 — 안엔 늘 내 간식이 한 봉지 있었다.' },
    { id: 'e_av_scarf', type: 'echo', tile: [31, 11], radius: 1.2, hidden: true, identitySlot: null,
      recall: '가로수에 걸린 목도리 한 장. 바람에 오래 흔들리며, 누군가의 온기를 붙잡고 있다.' },
    { id: 'f_av', type: 'false', tile: [29, 4], radius: 1.3, identitySlot: null,
      recall: '저 앞에서 하루가 손짓한다 — 그런데 다가갈수록 횡단보도가 끝없이 늘어나, 끝내 닿지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_av_1', patrol: [[9, 6], [16, 6], [16, 8], [9, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 },
    { id: 'm_av_2', patrol: [[28, 6], [37, 6], [37, 8], [28, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  echoes: [
    { id: 'e_av_1', patrol: [[18, 11], [24, 11], [24, 12], [18, 12]], speed: 36, hearTiles: 3.6 },
    { id: 'e_av_2', patrol: [[31, 11], [38, 11], [38, 12], [31, 12]], speed: 36, hearTiles: 3.6 }
  ],
  identityLabels: LBL,
  branch: { q: '끝이 보이지 않는 큰길. 나는 어떤 걸음으로 이 길을 건널까.', options: [
    { label: '끝까지 달린다', sub: '길이 길수록, 더 빨리.', feedback: '네 발에 바람이 붙는다 — 나는 대로를 가른다.' },
    { label: '그늘을 따라 간다', sub: '천천히, 들키지 않게 한 칸씩.', feedback: '가로수 그늘을 짚으며, 나는 숨을 죽인다.' } ] },
  epiphany: [
    '도시의 대로. 차도, 사람도 무심히 흐른다.',
    '그 흐름 속에서 옆자리만, 비어 있다.',
    '길이 아무리 넓어도, 함께 걷던 폭은 좁고 따뜻했다.',
    '이 끝 어딘가에 하루가 있다면 — 나는, 달리겠다.'
  ]
};

// CH10 「골목」 — 폭14 세로 미로. 느리지만 멀리 듣는 echo, 정지로 끊어 가기.
DATA.chapter_alley = {
  tile: 16, cols: 14, rows: 24, scale: 4, bgKey: 'alley',
  title: '골목', music: 'dusk', ambient: 'dust', controls: CTRL,
  spawn: [7, 22], coresNeeded: 3,
  collision: [
    [0, 0, 14, 2], [0, 23, 14, 1], [0, 0, 1, 24], [13, 0, 1, 24],
    [1, 4, 3, 2], [9, 5, 3, 2], [4, 9, 3, 2], [8, 12, 3, 2], [1, 16, 3, 2], [9, 17, 3, 2]
  ],
  safeZones: [[6, 8, 2, 1], [6, 15, 2, 1]],
  door: { tile: [7, 1], requires: 'cores' },
  shards: [
    { id: 'c_al_paw', type: 'core', tile: [7, 19], radius: 1.3, identitySlot: 2,
      recall: '좁은 골목 바닥의 발자국. 사람들은 모르는 지름길로, 하루의 뒤를 바짝 따라 걷던 길. 어둑해도 무섭지 않았다.' },
    { id: 'c_al_wall', type: 'core', tile: [6, 11], radius: 1.3, identitySlot: 3,
      recall: '담벼락 낮은 곳에 밴 내 냄새. 여긴 내 길이라고 매일 다시 적어 두던 자리. 나는 분명, 이 동네를 살았다.' },
    { id: 'c_al_light', type: 'core', tile: [7, 6], radius: 1.3, identitySlot: 1,
      recall: '골목 끝 작은 외등. 해가 지면 하루는 나를 안아 들고 이 불빛 아래를 빠르게 지났다 — 집까지, 따뜻한 품 안에서.' },
    { id: 'e_al_can', type: 'echo', tile: [3, 14], radius: 1.2, identitySlot: null, obj: 'can',
      recall: '발에 차여 굴러다니던 빈 깡통. 그 소리가 날 때마다 하루가 웃었다.' },
    { id: 'e_al_box', type: 'echo', tile: [11, 10], radius: 1.2, hidden: true, identitySlot: null,
      recall: '젖은 종이상자 한 칸. 비 오는 날 길고양이들이 몸을 누이던 자리 — 하루가 슬쩍 수건을 깔아둔 적이 있다.' },
    { id: 'f_al', type: 'false', tile: [7, 3], radius: 1.3, identitySlot: null,
      recall: '골목 끝에서 하루가 손짓한다 — 그런데 다가가면, 차가운 벽만 말없이 서 있다. 이건… 진짜가 아니야.' }
  ],
  murks: [{ id: 'm_al', patrol: [[5, 5], [8, 5], [8, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 }],
  echoes: [
    { id: 'e_al_1', patrol: [[4, 11], [4, 15]], speed: 34, hearTiles: 3.7 },
    { id: 'e_al_2', patrol: [[7, 14], [7, 19]], speed: 34, hearTiles: 3.7 }
  ],
  identityLabels: LBL, branch: null,
  epiphany: [
    '도시의 등 뒤, 둘만 알던 좁은 골목.',
    '혼자 들어서니, 아는 길이 미로처럼 낯설다.',
    '그래도 담벼락엔 내 냄새가, 길 끝엔 집으로 가는 불빛이 남아 있다.',
    '한 칸씩, 나는 그 불빛을 향해 오른다.'
  ]
};

// CH12 「병원 가는 길」 — 26행 세로 클라임. 계단참 체크포인트, 위에서 내려보는 murk.
DATA.chapter_toclinic = {
  tile: 16, cols: 22, rows: 26, scale: 4, bgKey: 'toclinic',
  title: '병원 가는 길', music: 'haru', ambient: 'leaves', controls: CTRL,
  spawn: [11, 24], coresNeeded: 3,
  collision: [
    [0, 0, 22, 2], [0, 25, 22, 1], [0, 0, 1, 26], [21, 0, 1, 26],
    [2, 4, 4, 2], [16, 4, 4, 2], [8, 7, 5, 2], [2, 11, 3, 2], [17, 11, 3, 2],
    [8, 15, 6, 2], [3, 19, 4, 2], [15, 19, 4, 2]
  ],
  safeZones: [[9, 9, 2, 1], [9, 17, 2, 1], [9, 22, 2, 1]],
  door: { tile: [11, 1], requires: 'cores' },
  shards: [
    { id: 'c_cl_path', type: 'core', tile: [11, 21], radius: 1.3, identitySlot: 2,
      recall: '병원으로 오르던 길. 그날 새벽, 구급차의 붉은 불빛이 이 오르막을 가득 적셨다. 나는 그 빛을 따라, 뒤늦게 오른다.' },
    { id: 'c_cl_rail', type: 'core', tile: [4, 13], radius: 1.3, identitySlot: 3,
      recall: '난간에 남은 다급한 손자국. 누군가 숨이 차도록 뛰어 오른 자리. 그 마음을, 나는 알 것 같다.' },
    { id: 'c_cl_sign', type: 'core', tile: [18, 6], radius: 1.3, identitySlot: 1, obj: 'sign',
      recall: '표지판: ←병원. 하루가 실려 간 방향을, 나는 작은 발로 한 칸씩 따라간다. 멀어도, 방향만은 안다.' },
    { id: 'e_cl_petal', type: 'echo', tile: [6, 11], radius: 1.2, identitySlot: null, obj: 'petal',
      recall: '길에 떨어진 꽃잎 몇 장. 누군가 면회 가며 들고 오른 꽃다발에서 진 것.' },
    { id: 'e_cl_button', type: 'echo', tile: [16, 15], radius: 1.2, hidden: true, identitySlot: null,
      recall: '계단참에 떨어진 단추 하나. 급히 오르던 외투에서 떨어진 듯, 아직 그 자리다.' },
    { id: 'f_cl', type: 'false', tile: [11, 4], radius: 1.3, identitySlot: null,
      recall: '길 위에서 하루가 멀쩡히 손을 흔든다 — 그런데 그 위로 구급차 소리가 자꾸 겹쳐 들린다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_cl_1', patrol: [[2, 2], [6, 2], [6, 3], [2, 3]], speed: 40, sightTiles: 3.4, fovDeg: 90 },
    { id: 'm_cl_2', patrol: [[15, 2], [19, 2], [19, 3], [15, 3]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  echoes: [{ id: 'e_cl', patrol: [[8, 13], [13, 13], [13, 14], [8, 14]], speed: 34, hearTiles: 3.7 }],
  identityLabels: LBL, branch: null,
  epiphany: [
    '병원으로 오르던 오르막.',
    '그날 이 길을, 붉은 불빛 하나가 가득 메우며 올라갔다.',
    '한 칸씩 오를수록, 그 아침이 또렷해진다.',
    '무서워도 — 나는 그 빛이 간 끝까지, 오른다.'
  ]
};

// CH13 「병원 앞」 — 오픈 플라자. 중앙 분수 축 360° 시선. 분기(들어갈지).
DATA.chapter_clinicfront = {
  tile: 16, cols: 26, rows: 16, scale: 4, bgKey: 'clinicfront',
  title: '병원 앞', music: 'haru', ambient: 'leaves', controls: CTRL,
  spawn: [13, 14], coresNeeded: 3,
  collision: [
    [0, 0, 26, 2], [0, 15, 26, 1], [0, 0, 1, 16], [25, 0, 1, 16],
    [3, 3, 4, 2], [19, 3, 4, 2], [11, 7, 4, 3], [4, 11, 3, 2], [19, 11, 3, 2], [10, 3, 2, 2]
  ],
  safeZones: [[5, 8, 2, 1], [20, 8, 2, 1]],
  door: { tile: [13, 1], requires: 'cores' },
  shards: [
    { id: 'c_cf_door', type: 'core', tile: [13, 5], radius: 1.3, identitySlot: 3,
      recall: '병원 정문. 그 아침, 하루는 이 큰 문 안으로 실려 들어갔다 — 나를 한 번 돌아보며. 유리에 비친 건, 기다리는 작은 나뿐이었다.' },
    { id: 'c_cf_bench', type: 'core', tile: [7, 12], radius: 1.3, identitySlot: 1,
      recall: '정문 앞 벤치. 나는 여기서 오래, 문이 다시 열리고 하루가 걸어 나오기를 기다렸다.' },
    { id: 'c_cf_fount', type: 'core', tile: [14, 10], radius: 1.3, identitySlot: 2,
      recall: '마른 분수. 물 대신 낙엽이 고였다. 내가 여기서 기다린 시간이, 그만큼 길었다는 뜻이다.' },
    { id: 'e_cf_card', type: 'echo', tile: [22, 12], radius: 1.2, identitySlot: null, obj: 'card',
      recall: '바닥에 남은 접수 번호표 한 장. 끝내 호명되지 못한 채.' },
    { id: 'e_cf_leaf', type: 'echo', tile: [8, 5], radius: 1.2, hidden: true, identitySlot: null,
      recall: '정문 틈에 낀 마른 잎. 아무도 치우지 않은 채, 계절이 몇 번 바뀌었다.' },
    { id: 'f_cf', type: 'false', tile: [18, 5], radius: 1.3, identitySlot: null,
      recall: '정문이 열리고 하루가 환한 빛을 등지고 걸어 나온다 — 그런데 다가갈수록 빛에 녹아, 형체가 남지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_cf_1', patrol: [[6, 5], [10, 5], [10, 8], [6, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 },
    { id: 'm_cf_2', patrol: [[16, 5], [21, 5], [21, 8], [16, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  echoes: [
    { id: 'e_cf_1', patrol: [[7, 10], [11, 10], [11, 12], [7, 12]], speed: 38, hearTiles: 3.7 },
    { id: 'e_cf_2', patrol: [[15, 9], [18, 9], [18, 12], [15, 12]], speed: 38, hearTiles: 3.7 }
  ],
  identityLabels: LBL,
  branch: { q: '저 문 안에, 차마 알고 싶지 않은 답이 있을지도 모른다.', options: [
    { label: '문 앞으로 간다', sub: '끝까지 확인하지 않으면, 아무것도 끝나지 않는다.', feedback: '발끝이 차가운 문턱에 닿는다.' },
    { label: '벤치에서 기다린다', sub: '하루가 나를 찾는다면, 우리가 함께였던 자리로 올 테니까.', feedback: '나는 다시 그 벤치에 몸을 만다 — 열리는 문마다, 눈을 들며.' } ] },
  epiphany: [
    '병원 앞 광장. 사방이 트여, 숨을 곳이 없다.',
    '이 문 안으로 하루가 사라졌고 — 작은 나는, 따라 들어갈 수 없었다.',
    '여기 답이 없다면, 답은 우리가 함께였던 자리에 있을 것이다.',
    '나는 문에 코를 한 번 대고, 우리의 자리로 발을 돌린다.'
  ]
};

// CH14 「옥상」 — 수직 탈출 + 입체 포위. 가장자리는 막다른 길.
DATA.chapter_rooftop = {
  tile: 16, cols: 20, rows: 22, scale: 4, bgKey: 'rooftop',
  title: '옥상', music: 'park', ambient: 'motes', controls: CTRL,
  spawn: [10, 20], coresNeeded: 3,
  collision: [
    [0, 0, 20, 2], [0, 21, 20, 1], [0, 0, 1, 22], [19, 0, 1, 22],
    [2, 4, 3, 3], [14, 4, 3, 3], [8, 8, 4, 2], [2, 12, 3, 2], [15, 12, 3, 2], [8, 15, 4, 2]
  ],
  safeZones: [[9, 11, 2, 1], [9, 18, 2, 1]],
  door: { tile: [10, 1], requires: 'cores' },
  shards: [
    { id: 'c_rf_sky', type: 'core', tile: [10, 13], radius: 1.3, identitySlot: 1,
      recall: '옥상에서 올려다본 하늘. 하루가 가끔 나를 안고 올라와 바람을 쐬어주던 곳. "여기선 멀리까지 보여, 지로."' },
    { id: 'c_rf_edge', type: 'core', tile: [5, 9], radius: 1.3, identitySlot: 3,
      recall: '난간 너머로 펼쳐진 도시. 하루가 사라진 방향을, 나는 여기서 오래 좇았다. 저 어딘가에, 하루가 있다.' },
    { id: 'c_rf_door', type: 'core', tile: [15, 9], radius: 1.3, identitySlot: 2,
      recall: '옥탑 문. 끼익 — 바람에 혼자 여닫힌다. 누군가 올라오기를 기다리는 것처럼, 자꾸만.' },
    { id: 'e_rf_dish', type: 'echo', tile: [16, 11], radius: 1.2, identitySlot: null, obj: 'dish',
      recall: '옥상 구석의 작은 밥그릇. 하루가 길 위의 다른 고양이들을 위해 올려둔 것.' },
    { id: 'e_rf_clip', type: 'echo', tile: [4, 15], radius: 1.2, hidden: true, identitySlot: null,
      recall: '빨랫줄에 남은 집게 하나. 바람에 오래 흔들리며, 빈 줄을 붙잡고 있다.' },
    { id: 'f_rf', type: 'false', tile: [10, 5], radius: 1.3, identitySlot: null,
      recall: '난간 끝에 하루가 서서 도시를 바라본다 — 그런데 바람이 부는데도, 옷자락이 조금도 흔들리지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_rf_1', patrol: [[5, 4], [7, 4], [7, 6], [5, 6]], speed: 40, sightTiles: 3.4, fovDeg: 90 },
    { id: 'm_rf_2', patrol: [[14, 8], [17, 8], [17, 11], [14, 11]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  echoes: [
    { id: 'e_rf_1', patrol: [[8, 12], [11, 12], [11, 14]], speed: 34, hearTiles: 3.7 },
    { id: 'e_rf_2', patrol: [[4, 16], [7, 16], [7, 18]], speed: 34, hearTiles: 3.7 }
  ],
  identityLabels: LBL, branch: null,
  epiphany: [
    '건물 꼭대기, 바람이 가득한 옥상.',
    '여기서 하루는 나를 안고, 도시를 함께 내려다봤다.',
    '이제 나 혼자, 하루가 간 방향을 좇는다.',
    '바람 끝에 하루의 냄새가, 아주 옅게 — 그래도 분명히, 남아 있다.'
  ]
};

// CH16 「분수 광장」 — 중앙 분수 순환 동선. 적이 시계/반시계로 갈려 협공.
DATA.chapter_plaza = {
  tile: 16, cols: 26, rows: 18, scale: 4, bgKey: 'plaza',
  title: '분수 광장', music: 'park', ambient: 'leaves', controls: CTRL,
  spawn: [13, 16], coresNeeded: 3,
  collision: [
    [0, 0, 26, 2], [0, 17, 26, 1], [0, 0, 1, 18], [25, 0, 1, 18],
    [11, 7, 4, 4], [3, 4, 3, 2], [20, 4, 3, 2], [3, 12, 3, 2], [20, 12, 3, 2], [11, 3, 4, 1], [11, 14, 4, 1]
  ],
  safeZones: [[6, 8, 2, 1], [18, 8, 2, 1]],
  door: { tile: [13, 1], requires: 'cores' },
  shards: [
    { id: 'c_pz_fount', type: 'core', tile: [13, 12], radius: 1.3, identitySlot: 2,
      recall: '광장 분수. 물소리 사이로, 하루가 내 이름을 부르던 메아리가 아직 남아 있다.' },
    { id: 'c_pz_arch', type: 'core', tile: [13, 5], radius: 1.3, identitySlot: 3,
      recall: '광장 아치문. 둘이 줄을 나란히 잡고 통과하던 문. 사람들 사이에서도, 우리는 한 쌍이었다.' },
    { id: 'c_pz_bench', type: 'core', tile: [8, 13], radius: 1.3, identitySlot: 1,
      recall: '분수 곁 벤치. 비둘기를 쫓다가도, 나는 늘 하루의 무릎으로 돌아왔다.' },
    { id: 'e_pz_coin', type: 'echo', tile: [18, 9], radius: 1.2, identitySlot: null, obj: 'coin',
      recall: '분수 바닥에 가라앉은 동전 하나. 하루는 무슨 소원을 빌었을까 — 어쩌면, 늘 같은 소원을.' },
    { id: 'e_pz_feather', type: 'echo', tile: [6, 6], radius: 1.2, hidden: true, identitySlot: null,
      recall: '비둘기 깃털 한 장. 내가 신나게 쫓던 그 무리의 것. 하루는 그런 나를 보며 웃었다.' },
    { id: 'f_pz', type: 'false', tile: [19, 6], radius: 1.3, identitySlot: null,
      recall: '분수 너머에서 하루가 손짓한다 — 그런데 물보라가 일 때마다, 그 모습이 자꾸 지워진다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_pz_1', patrol: [[6, 5], [10, 5], [10, 8], [6, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 },
    { id: 'm_pz_2', patrol: [[16, 9], [20, 9], [20, 11], [16, 11]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  echoes: [
    { id: 'e_pz_1', patrol: [[7, 10], [10, 10], [10, 13], [7, 13]], speed: 38, hearTiles: 3.7 },
    { id: 'e_pz_2', patrol: [[16, 5], [19, 5], [19, 8], [16, 8]], speed: 38, hearTiles: 3.7 }
  ],
  identityLabels: LBL, branch: null,
  epiphany: [
    '물소리가 가득한 광장.',
    '분수를 돌며 우리는 한 바퀴, 또 한 바퀴를 걸었다.',
    '지금은 그 동선을, 나 혼자 돈다.',
    '물소리 사이엔 아직, 하루의 목소리가 섞여 있다.'
  ]
};

// CH17 「가로등 길」 — 36칸 황혼 장거리. 빛(Q) 자원 트레이드오프.
DATA.chapter_lamplane = {
  tile: 16, cols: 36, rows: 14, scale: 4, bgKey: 'lamplane',
  title: '가로등 길', music: 'dusk', ambient: 'leaves', controls: CTRL,
  spawn: [2, 7], coresNeeded: 3,
  collision: [
    [0, 0, 36, 2], [0, 13, 36, 1], [0, 0, 1, 14], [35, 0, 1, 14],
    [5, 3, 3, 2], [5, 9, 3, 2], [13, 4, 3, 2], [13, 9, 3, 2],
    [21, 3, 3, 2], [21, 9, 3, 2], [29, 4, 3, 2], [29, 9, 3, 2]
  ],
  safeZones: [[10, 6, 2, 1], [18, 6, 2, 1], [26, 6, 2, 1]],
  door: { tile: [34, 1], requires: 'cores' },
  shards: [
    { id: 'c_ll_lamp', type: 'core', tile: [16, 7], radius: 1.3, identitySlot: 3,
      recall: '가로등 불빛. 해질녘마다 하루는 이 불빛 아래에서 내 이름을 불렀다. 어딘가에서, 다시 불러주고 있을까.' },
    { id: 'c_ll_walk', type: 'core', tile: [9, 11], radius: 1.3, identitySlot: 1,
      recall: '노을에 길어진 두 그림자. 사람의 것과 고양이의 것이, 보도 위에 나란히 누웠다.' },
    { id: 'c_ll_end', type: 'core', tile: [31, 11], radius: 1.3, identitySlot: 2,
      recall: '길 끝 모퉁이. 하루가 늘 먼저 돌아 사라지던 곳. 나는 종종거리며 그 모퉁이를 따라 돌았다.' },
    { id: 'e_ll_glove', type: 'echo', tile: [7, 11], radius: 1.2, identitySlot: null, obj: 'glove',
      recall: '벤치에 놓인 장갑 한 짝. 해질녘의 온기가 식어, 차게 식어 있다.' },
    { id: 'e_ll_leaf', type: 'echo', tile: [24, 5], radius: 1.2, hidden: true, identitySlot: null,
      recall: '가로등에 비친 낙엽 그림자. 바람에 천천히, 한 잎씩 진다.' },
    { id: 'f_ll', type: 'false', tile: [19, 4], radius: 1.3, identitySlot: null,
      recall: '가로등 아래 하루가 손짓한다 — 그런데 그 불빛이 하루의 몸을 그냥 통과해 버린다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_ll_1', patrol: [[8, 6], [15, 6], [15, 8], [8, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 },
    { id: 'm_ll_2', patrol: [[23, 6], [31, 6], [31, 8], [23, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  echoes: [
    { id: 'e_ll_1', patrol: [[15, 11], [20, 11], [20, 12], [15, 12]], speed: 38, hearTiles: 3.7 },
    { id: 'e_ll_2', patrol: [[26, 11], [32, 11], [32, 12], [26, 12]], speed: 38, hearTiles: 3.7 }
  ],
  identityLabels: LBL, branch: null,
  epiphany: [
    '해질녘, 가로등이 하나씩 켜진다.',
    '불빛 아래마다, 하루가 내 이름을 부르던 자리.',
    '노을에 길어진 두 그림자가, 이제 하나뿐이다.',
    '그래도 다음 불빛까지 — 나는, 걷는다.'
  ]
};

// CH19 「텅 빈 거리」 — 새벽 최난 피크. 엄폐 최소·murk 3 교차. 직후 ch20 해방.
DATA.chapter_emptystreet = {
  tile: 16, cols: 30, rows: 16, scale: 4, bgKey: 'emptystreet',
  title: '텅 빈 거리', music: 'park', ambient: 'motes', controls: CTRL,
  spawn: [15, 14], coresNeeded: 3,
  collision: [
    [0, 0, 30, 2], [0, 15, 30, 1], [0, 0, 1, 16], [29, 0, 1, 16],
    [4, 4, 3, 2], [23, 4, 3, 2], [13, 7, 4, 3], [4, 11, 3, 2], [23, 11, 3, 2], [11, 3, 2, 1]
  ],
  safeZones: [[7, 8, 2, 1], [15, 12, 2, 1], [21, 8, 2, 1]],
  door: { tile: [15, 1], requires: 'cores' },
  shards: [
    { id: 'c_es_signal', type: 'core', tile: [15, 11], radius: 1.3, identitySlot: 3,
      recall: '새벽 신호등. 아무도 없는 거리에서 혼자 깜빡인다 — 오지 않는 누군가를, 끝내 기다리듯이.' },
    { id: 'c_es_walk', type: 'core', tile: [6, 9], radius: 1.3, identitySlot: 2,
      recall: '텅 빈 횡단보도. 두 줄 발자국이 시작되던 자리. 이제 한 줄을, 내가 다시 긋는다 — 하루의 몫까지.' },
    { id: 'c_es_dawn', type: 'core', tile: [24, 9], radius: 1.3, identitySlot: 1,
      recall: '동트는 거리 끝. 그 빛 너머 어딘가에서, 하루도 같은 새벽을 보고 있을까. 같은 하늘 아래라면, 우린 아주 멀어진 게 아니다.' },
    { id: 'e_es_paper', type: 'echo', tile: [9, 5], radius: 1.2, identitySlot: null, obj: 'paper',
      recall: '바람에 날리는 신문 한 장. 멈춰버린 내 시간 위로, 새 날짜가 또렷이 적혀 있다.' },
    { id: 'e_es_bell', type: 'echo', tile: [20, 12], radius: 1.2, hidden: true, identitySlot: null,
      recall: '어딘가에서 들리는 작은 방울 소리. 내 목걸이의 그 소리를, 꼭 닮았다.' },
    { id: 'f_es', type: 'false', tile: [16, 5], radius: 1.3, identitySlot: null,
      recall: '텅 빈 거리 끝에서 하루가 걸어온다 — 그런데 발소리가 새벽 공기에 흩어져, 끝내 닿지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks: [
    { id: 'm_es_1', patrol: [[7, 5], [10, 5], [10, 8], [7, 8]], speed: 42, sightTiles: 3.5, fovDeg: 90 },
    { id: 'm_es_2', patrol: [[17, 5], [22, 5], [22, 8], [17, 8]], speed: 42, sightTiles: 3.5, fovDeg: 90 },
    { id: 'm_es_3', patrol: [[9, 10], [16, 10], [16, 12], [9, 12]], speed: 42, sightTiles: 3.5, fovDeg: 90 }
  ],
  echoes: [
    { id: 'e_es_1', patrol: [[7, 11], [11, 11], [11, 13], [7, 13]], speed: 38, hearTiles: 3.8 },
    { id: 'e_es_2', patrol: [[18, 11], [22, 11], [22, 13], [18, 13]], speed: 38, hearTiles: 3.8 }
  ],
  identityLabels: LBLN,
  branch: { q: '아무도 없는 새벽 거리. 이 끝에서 나는, 무엇을 마주하려는 걸까.', options: [
    { label: '끝까지 간다', sub: '여기서 멈추면, 아무것도 끝나지 않는다.', feedback: '네 발에 마지막 힘이 모인다.' },
    { label: '숨을 고른다', sub: '한 박자만, 마음을 가다듬고.', feedback: '새벽 공기를 깊이 들이쉰다 — 그리고, 다시 걷는다.' } ] },
  epiphany: [
    '아무도 없는 새벽 거리. 세상이 텅 빈 듯 조용하다.',
    '이 거리의 끝에, 마지막 빈자리가 나를 기다린다.',
    '내 이름은 지로. 더는 길 잃은 고양이가 아니다.',
    '두렵지만 — 나는 그 공백을 마주하러, 한 발을 더 뗀다.'
  ]
};

if (typeof window !== 'undefined') window.DATA = DATA;
if (typeof module !== 'undefined') module.exports = DATA;
