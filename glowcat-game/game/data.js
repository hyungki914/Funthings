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
      tile: [16, 11],          // 우중앙 하단 floor (옷장17~19 옆, col16 FREE). 스폰[10,9]서 ~101px — 코어보다 멀게(첫 행동이 함정이 되지 않도록)
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
      recall: "식탁 밑에 붙은 작은 메모 — '약 먹는 시간'. 누구의 약이었을까." },
    { id: 'c2_false', type: 'false', tile: [16, 11], radius: 1.3, identitySlot: null,
      recall: '주방에서 하루가 부르는 목소리 — 그런데 불은 꺼졌고, 그릇엔 먼지가 앉았다. 이건… 진짜가 아니야.' }
  ],
  // 시각 감지(Murk) — 거실 좌측 순찰
  murks: [
    { id: 'murk_b', patrol: [[4, 6], [7, 6], [7, 8], [4, 8]], speed: 38, sightTiles: 3.3, fovDeg: 90 }
  ],
  // 청각 감지(Echo) — 주방/우측 순찰. hearTiles = 소리 들리는 반경(타일)
  echoes: [
    { id: 'echo_a', patrol: [[13, 6], [18, 6], [18, 8], [13, 8]], speed: 36, hearTiles: 3.6 }
  ],
  identityLabels: ['종: 고양이', '사는 곳: 하루의 집', '주인: 하루', '이름: ? (지로)', '왜 잊었나'],
  epiphany: [
    '거실, 주방, 무릎 위의 담요 — 우리는 분명, 함께였다.',
    '매일 같은 시간 같은 자리에서, 나는 하루를 기다렸다.',
    '그런데… 집은 어느 순간부터 너무 조용했다.',
    '불은 꺼졌고, 그릇엔 먼지가 앉았다. 하루는 — 언제부터 없었던 걸까.'
  ]
};

// =============================================================================
// DATA.chapter3 — 「공원」 (최종 챕터). 배경키 'room3'. Murk(시각) + Echo(청각) 공존.
//   우리가 매일 함께 걷던 길의 끝 — 하루를 기다리던 벤치. 마지막 진실(The Blank)이 드러난다.
//   가구(타일 c,r,w,h): 나무1(3,3,2,2) · 나무2(17,3,2,2) · 벤치(9,4,3,1)
//     · 분수(14,9,3,3) · 나무3(3,10,2,2). isFinal:true → 클리어 시 choice/ending.
// =============================================================================
DATA.chapter3 = {
  tile: 16, cols: 22, rows: 14, scale: 4, bgKey: 'room3',
  title: '공원',
  music: 'park',
  isFinal: true,
  controls: [['이동', 'WASD/←↑↓→'], ['조사', 'E'], ['발자국 추적', 'L'], ['기억 비추기', 'Q'], ['기억 일지', 'Tab']],
  spawn: [10, 11],                // 하단 산책로 floor (검산: FREE)
  coresNeeded: 3,
  collision: [
    [0, 0, 22, 2], [0, 13, 22, 1], [0, 0, 1, 14], [21, 0, 1, 14],   // 울타리/경계
    [3, 3, 2, 2],    // 나무1 (좌상)
    [17, 3, 2, 2],   // 나무2 (우상)
    [9, 4, 3, 1],    // 벤치   cols 9~11, row 4
    [14, 9, 3, 3],   // 분수   cols 14~16, rows 9~11
    [3, 10, 2, 2]    // 나무3 (좌하)
  ],
  safeZones: [[9, 6, 3, 1]],      // 벤치 앞 가로등 불빛 = 회복
  door: { tile: [10, 1], requires: 'cores' },
  shards: [
    { id: 'c3_bench', type: 'core', tile: [10, 6], radius: 1.3, identitySlot: 4,
      recall: '벤치. 우리가 매일 함께 앉던 자리. 하루는 여기서 내 등을 쓰다듬으며, 오래오래 이야기했다.' },
    { id: 'c3_leash', type: 'core', tile: [6, 11], radius: 1.3, identitySlot: 2,
      recall: '산책로에 남은 작은 발자국들. 하루의 옆에서, 나는 이 길을 수없이 걸었다.' },
    { id: 'c3_lastday', type: 'core', tile: [19, 11], radius: 1.3, identitySlot: 3,
      recall: "마지막 날의 햇살. 하루는 평소보다 오래 나를 안았다 — '기다리지 마, 지로.' 그 말의 뜻을, 그때는 몰랐다." },
    { id: 'c3_collar', type: 'echo', tile: [18, 7], radius: 1.2, identitySlot: null,
      recall: '풀숲에 떨어진 낡은 목걸이 방울. 흔들면, 아직 그날의 소리가 난다.' },
    { id: 'c3_leaf', type: 'echo', tile: [6, 4], radius: 1.2, hidden: true, identitySlot: null,
      recall: '벤치 밑에 눌린 마른 잎 한 장. 계절이 몇 번이나 바뀌도록, 나는 이 자리를 떠나지 못했다.' },
    { id: 'c3_false', type: 'false', tile: [13, 4], radius: 1.3, identitySlot: null,
      recall: '저 멀리 하루가 걸어온다 — 손을 흔들며. 그러나 다가갈수록 흐려지고, 끝내 닿지 않는다. 이건… 진짜가 아니야.' }
  ],
  // 시각 감지(Murk) — 우측 순찰 (나무2 rows3~4 · 분수 rows9~11 회피)
  murks: [
    { id: 'murk_c', patrol: [[14, 6], [19, 6], [19, 8], [14, 8]], speed: 40, sightTiles: 3.4, fovDeg: 90 }
  ],
  // 청각 감지(Echo) — 좌측 순찰 (나무3 rows10~11 · 벤치 row4 회피)
  echoes: [
    { id: 'echo_b', patrol: [[5, 6], [8, 6], [8, 9], [5, 9]], speed: 38, hearTiles: 3.6 }
  ],
  identityLabels: ['종: 고양이', '사는 곳: 하루의 집', '주인: 하루', '이름: 지로 (Ziro)', '왜 잊었나 — 너무 아파서, 스스로'],
  epiphany: [
    '공원의 벤치. 우리가 매일 함께 걷던 길의 끝.',
    '여기서 나는 하루를 기다렸다 — 하루가, 더는 오지 않게 된 뒤에도.',
    '기억이 흐려진 건 잊어서가 아니었다. 너무 아파서, 내가 스스로 지운 거였다.',
    '하루는 떠났다. 그리고 나는, 그 텅 빈 자리(The Blank)를 끌어안은 채 이 길을 맴돌고 있었다.',
    '이제 마지막 조각을 마주한다.'
  ]
};

if (typeof window !== 'undefined') window.DATA = DATA;
if (typeof module !== 'undefined') module.exports = DATA;
