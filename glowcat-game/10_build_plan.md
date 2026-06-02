# 10 · 개발 프로젝트 플랜 & 멀티에이전트 실행 (지로 Ziro)

> 상위: [GDD](./GDD.md) · 결정 [00](./00_design_review.md) · 기술 [04](./04_technical_design.md) · 프로덕션 [05](./05_production_plan.md) · 아트 [09](./09_art_direction_pixel.md)
> 주인공: **지로 (Ziro)** · `:3` 입 · 검정+시안+네온그린

---

## 0. 이번 세션의 목표 (실제로 완성하는 것)

전체 게임(1.5~3시간, 05의 M0~M4)은 다년 작업이므로, **지금 실제로 만들어 완성하는 단위**는:

> **🎯 "챕터1 「지로의 방」 플레이 가능한 버티컬 슬라이스(Web)"** — 05 마일스톤의 **M0→M1 진입점**.

이게 완성되면 P0 검증 게이트(코어 동사가 재미있나 / 후퇴가 긴장인가)를 실제로 돌려볼 수 있다. 이후 단계(챕터2·3, 적 2종, 보스…)는 §6 로드맵으로 이어간다.

### VS 수용 기준 (이게 되면 "완성")
- [ ] 탑다운으로 지로를 이동(키보드/마우스), 방을 자유 탐험 (픽셀아트 + 글로우)
- [ ] **3단 발견**: 환경 접근 → `E` 상호작용 → **회상 팝업** → 정체성/기억/빛 상승
- [ ] **2게이지**: 메모리 미터(생명) + 빛 자원(재화), HUD 표시
- [ ] **후퇴(Setback)**: 메모리 0 → 안전지대 귀환 + 최근 코어 1개 임시봉인(영구손실 X)
- [ ] **Murk** 1체 순찰·시야 감지·접촉 시 메모리 감소(무적 프레임)
- [ ] **안전지대(침대)** 회복, **빛 자원**으로 직감 힌트
- [ ] 코어 조각 N개 수집 → **문 개방 → 챕터 클리어**
- [ ] 정체성 카드(? → 또렷) 진행, 지로 이름은 최종 보상으로 예고
- [ ] 무설치·오프라인(브라우저로 `game/index.html` 더블클릭) 실행

---

## 1. 기술 스택 (이 세션)

- **HTML5 Canvas + 바닐라 JS** (빌드툴 0, 오프라인). 04의 "웹 폴백" 경로를 VS 검증용으로 채택. 본편은 추후 Godot 이식 가능(로직을 순수 모듈로 분리해 이식성 확보).
- **에셋:** `art/pixelart.py`가 생성한 픽셀아트를 **base64로 `game/assets.js`에 임베드**(무서버 실행). 텍스처는 nearest(픽셀 보존).
- **로직 순수성:** 규칙(미터·후퇴·시야·발견)을 DOM 없는 `core.js`로 분리 → **Node 단위 테스트**로 검증(브라우저 없이도 정합 확인).

---

## 2. 모듈 아키텍처 & 인터페이스 계약 (에이전트 공유 규약)

파일을 분리해 **동시 작업 충돌을 차단**한다. 각 모듈의 공개 API는 아래 계약을 따른다.

```
game/
  index.html     (스캐폴딩: 캔버스 + 스크립트 로드 순서)   [LEAD]
  assets.js      (base64 스프라이트/배경 — pixelart.py 생성)  [LEAD]
  data.js        (챕터1 콘텐츠: 맵·충돌·조각·Murk·대사)       [AGENT-CONTENT]
  core.js        (순수 규칙: 미터/후퇴/시야/발견/정체성)       [AGENT-GAMEPLAY]
  core.test.mjs  (Node 테스트)                                [AGENT-GAMEPLAY]
  audio.js       (WebAudio: 앰비언트·차임·드론·심장박동)        [AGENT-AUDIO]
  main.js        (렌더·입력·루프·HUD — core/data/assets 사용)  [LEAD]
```

### 2-1. `core.js` 공개 API (전역 `Core`)
```js
Core.C = { MEM_MAX:10, LIGHT_MAX:6, START_MEM:4, START_LIGHT:2,
           CONTACT:-2, CORE_GAIN:+2, ECHO_GAIN:+1, FALSE_HIT:-2,
           HINT_COST:1, REST_PER_S:1.0, DECAY_PER_S:0.2, IFRAME_S:1.2,
           PLAYER_SPEED:64, STEALTH_SPEED:38 }           // px/s (16px타일*4스케일 기준 보정)
Core.newState(data) -> state            // {mem,light,iframe,coresNeeded,collected:Set,sealed,identity,...}
Core.collect(state, shard) -> {ok, recallText, gainMem, gainLight, identitySlot}
Core.contact(state) -> bool             // 무적 아니면 mem += CONTACT, iframe 셋
Core.tick(state, dt, {inSafe,inDanger,moving}) // 회복/감소/iframe 감소
Core.useHint(state) -> {ok, dirTо?}     // light>=HINT_COST면 차감
Core.setbackIfDead(state) -> bool       // mem<=0 → 최근 코어 봉인+안전지대 복귀 신호
Core.murkSees(murk, px, py) -> bool      // 거리<=sight && |angle|<=fov/2  (LoS는 main에서 보강)
Core.identityState(state) -> {unlocked:Int(0..5), portrait:'q'|'silhouette'|'eyes'|'face'|'name', label}
Core.chapterClear(state) -> bool        // collected(core) >= coresNeeded
```

### 2-2. `data.js` 스키마 (전역 `DATA`)
```js
DATA.chapter1 = {
  tile:16, cols:22, rows:14, scale:4,
  bgKey:'room1',                          // assets.js 배경 키
  spawn:[10,9],                           // 타일좌표
  coresNeeded:3,
  collision:[ [c,r,w,h], ... ],           // 막힌 사각형(타일단위): 벽테두리+가구
  safeZones:[ [c,r,w,h] ],                // 침대=회복
  door:{ tile:[ , ], requires:'cores' },
  shards:[ { id, type:'core'|'echo'|'false', tile:[c,r], radius:1.2,
             recall:'…자막…', identitySlot:0..4, gainMem, gainLight } ],
  murks:[ { id, patrol:[[c,r],...], speed, sightTiles, fovDeg } ],
  identityLabels:['종: 고양이','사는 곳','주인: 하루','이름: ? (지로)','왜 잊었나'],
}
```

### 2-3. `assets.js` (전역 `ASSETS`)
```js
ASSETS = { room1:"data:image/png;base64,…",
           ziro_d0,ziro_d1,ziro_d2, ziro_s0,ziro_s1, murk, shard }   // 모두 dataURI
```

### 2-4. `audio.js` (전역 `Audio2`)
```js
Audio2.init(); Audio2.ambient(on); Audio2.chime(); Audio2.drone(level); Audio2.heartbeat(bpm)
```
(WebAudio 합성만, 외부 파일 0. 접근성: 음소거 토글.)

---

## 3. 멀티에이전트 개발팀 & 분담

| 역할 | 담당 | 산출물 | 의존 |
|---|---|---|---|
| **테크리드/통합** | (오케스트레이터) | `index.html`·`assets.js`(생성)·`main.js`·통합·QA | 전체 |
| **게임플레이 프로그래머** | Agent-GP | `core.js` + `core.test.mjs` | §2-1 계약 |
| **콘텐츠/내러티브 엔지니어** | Agent-CT | `data.js` (챕터1, 지로/하루 서사·조각 7개) | §2-2 계약, [01] |
| **오디오 프로그래머** | Agent-AU | `audio.js` (WebAudio) | §2-4 계약 |

- 파일이 **서로 겹치지 않으므로 병렬 안전.** 계약(§2)이 인터페이스. 통합은 리드가 수행하고 어긋나면 어댑터로 보정.
- 통합 순서(DAG): `assets.js` & `core.js` & `data.js`(병렬) → `main.js`(통합) → `audio.js` 결합 → QA.

---

## 4. 실행 단계 (이 세션)

1. **A. 에셋 파이프라인** — `pixelart.py`에 `export_game_assets()` 추가 → `game/assets.js` 생성(배경+스프라이트 base64).  [리드]
2. **B. 코어/콘텐츠/오디오 병렬** — Agent-GP/CT/AU 동시 착수(§3).
3. **C. 통합** — `index.html`+`main.js`로 렌더·입력·루프·HUD 결합, core/data/assets 연결.  [리드]
4. **D. 검증** — `node --check` 전 스크립트 + `node core.test.mjs`(규칙 단위테스트) 통과.
5. **E. QA 패스** — 수용 기준(§0) 체크, 버그 수정, 커밋·푸시.

---

## 5. 검증/품질 게이트

- **단위 테스트(Node):** 미터 증감·후퇴 봉인·시야 감지·정체성 단계·클리어 조건.
- **정적 검사:** `node --check` 모든 JS.
- **수용 기준 체크리스트(§0)** 전부 충족.
- **P0 플레이 게이트(설계):** 글로우 OFF로 코어 3개를 힌트 없이 찾는 데 막힘<15% / 후퇴가 "긴장>분노".

---

## 6. VS 이후 → 완성까지 로드맵 (05 연동)

| 단계 | 내용 |
|---|---|
| **VS+ (이 세션 직후)** | 사운드 결합, 발자국 트레일·기억 비추기 동사, 정체성 카드 화면 |
| **M1 버티컬 슬라이스 확장** | 챕터2 도입, Echo(청각) 적, 일지/추리 보드, 데모 품질 |
| **M2 알파** | 챕터1~3 콘텐츠, 적 2종, 보스 1페이즈, 2엔딩 — 기능완성 |
| **M3 베타** | 밸런싱·접근성·로컬라이징(한/영)·세이브 마이그레이션 |
| **M4 출시** | Godot 이식(또는 웹 정식) · 스토어 · 위시 1.5만 |

> 본 세션은 **VS 완성**까지 진행. 각 단계는 동일한 멀티에이전트 분담(모듈 분리 + 계약)으로 확장한다.
