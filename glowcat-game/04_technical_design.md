# 04 · 테크니컬 설계서 — 『잊혀진 발자국 (Lost Pawprint)』

> **작성:** 시니어 테크니컬 디렉터 · **버전:** v1.0 (착수 기준선) · **기준일:** 2026-06-02
> **상위 문서(SSOT):** [00_design_review.md](./00_design_review.md) — 확정 결정 **D1~D9**. 본 문서의 모든 기술 결정은 D1~D9와 일치한다. 충돌 시 00 문서가 우선한다.
> **연계:** [GDD.md](./GDD.md) · [01_story_script.md](./01_story_script.md) · [02_level_design.md](./02_level_design.md) · [03_systems_enemies.md](./03_systems_enemies.md)
> **독자:** 엔지니어(받아서 바로 착수), 레벨 디자이너·작가(스키마=인터페이스 계약), 프로듀서(리스크·태스크).

---

## 0. 이 문서의 위치와 읽는 법

- 00 문서가 **무엇을·왜**(게임/사업 결정)를 확정했다면, 본 04 문서는 **어떻게 만드는가**를 확정한다.
- D5(엔진=Godot 4.x)·D6(기술 5대 기둥)이 본 문서의 척추다. 나머지 결정(D1 후퇴, D2 코어 동사, D7 속도/그리드, D9 접근성)은 기술 요구사항으로 번역되어 각 절에 박혀 있다.
- **스키마(§5)·세이브(§7)·인터페이스 계약(§12)** 은 코드가 아니라 **타 직군과의 계약**이다. 여기 정의된 JSON 형식이 곧 작가/레벨러의 작업 산출물 형식이다. 스키마를 바꾸려면 이 문서를 고치고 관련 직군에 통지한다.

---

## 1. 개요 · 목표 · 기술 원칙

### 1.1 기술 목표 (v1.0)
1. **버티컬 슬라이스를 빠르게 플레이어블로** — D3 MVP(챕터1 완성 + 챕터2 도입)를 데이터 주도로 빌드해 P0 검증 게이트(00 §4)를 통과시킨다.
2. **데이터와 코드의 분리** — 서사/레벨/밸런싱이 코드를 건드리지 않고 병렬로 굴러가게 한다(D6①). 엔지니어가 임의 결정 100개를 내리는 상황을 스키마로 차단.
3. **상태의 단일 진실 원천(SSOT)** — 정체성 진행도가 카드(3/5)와 HUD(1/5)에서 어긋나는 D9 버그를 구조적으로 불가능하게 만든다(GameState 싱글톤, §4).
4. **좌절 없는 실패** — D1의 후퇴(Setback)를 P0부터 정확히 구현한다. 틀린 단일 미터/하드리셋으로 검증하지 않는다.
5. **한/영 텍스트가 깨지지 않는다** — 텍스트가 주 서사 매체(01 문서)이므로 폰트 파이프라인이 1급 시민(§3).

### 1.2 기술 원칙 (불변 규칙)
| 원칙 | 내용 | 강제 수단 |
|---|---|---|
| **타입세이프 강제** (D5) | 모든 GDScript는 정적 타입(`var x: int`, `func f(a: String) -> void`). 추론 화살표 `:=`는 허용하되 `Variant` 누수 금지. | 에디터 설정 `debug/gdscript/warnings/untyped_declaration = Error`. CI에서 `--check-only` + `gdlint`로 게이트. |
| **데이터 주도** (D6①) | 룰/수치/콘텐츠는 코드가 아니라 데이터(JSON/Resource). 매직넘버 금지. | 밸런스 상수는 `BalanceConfig` Resource 1곳. 콘텐츠는 §5 스키마. |
| **SSOT** (D6④/D9) | 런타임 게임 상태는 `GameState` 한 곳에만. UI는 질의·시그널 구독만, 직접 보유 금지. | 코드리뷰 규칙 + `GameState`만 `set` 권한. |
| **시그널 우선(느슨한 결합)** | 시스템 간 직접 참조 대신 시그널/이벤트버스. AI·UI는 게임플레이를 폴링하지 않는다. | `EventBus` 오토로드 + 로컬 시그널. |
| **결정론 우선** | AI 인지/그리드 이동은 프레임레이트 비의존(고정 틱 또는 `delta` 정규화). 리플레이/디버그 재현성. | 인지 평가 10Hz 고정 틱(§6). |
| **셀 = 진실** (D7) | 위치의 진실은 픽셀이 아니라 **그리드 셀**. 픽셀은 표현. 02 타일 좌표 = 엔진 셀 좌표 1:1. | `GridService.cell_to_world()` 단일 변환점. |

---

## 2. 엔진 결정 근거 · 타깃 플랫폼

### 2.1 엔진 비교 (D5 재확인)

> 2026-06 기준 최신 안정판: **Godot 4.6.3** (4.6에서 Jolt 3D 물리 기본화·Modern 테마 등, 본 2D 프로젝트엔 영향 적음). 본 프로젝트는 **Godot 4.5.x LTS 성격의 안정 라인 또는 4.6.x** 중, 착수 시점 최신 안정 패치를 픽스해 진행(버전 핀 §11). 4.7은 베타이므로 v1.0 비대상.

| 평가축 (가중) | **Godot 4.x** | Unity 6 | Phaser 3 (HTML5) |
|---|---|---|---|
| 2D 탑다운·타일맵 (●●●) | ◎ TileMapLayer·Tile collision 머지(4.5) 내장 | ○ 2D는 보조 시민, Tilemap 외부 의존 | ○ 타일맵 OK, 충돌·씬은 수작업 |
| 그리드 A* (●●●) | ◎ `AStarGrid2D` 엔진 내장(대각/장애물/가중치) | △ 직접 구현/에셋 | △ 라이브러리 직접 |
| 입력 추상화 (●●) | ◎ `InputMap` 액션+키보드/패드/마우스 통합 | ◎ Input System(무겁고 학습곡선) | ○ 직접 추상화 |
| 데이터/세이브 내장 (●●) | ◎ `Resource`/`ResourceSaver`·`FileAccess`·`var_to_bytes` | ○ ScriptableObject + 직렬화 수작업 | △ localStorage/직접 | 
| 한/영 폰트 (●●●) | △ **CJK/HTML5 폰트 리스크 실재**(§3) — 데스크톱은 양호 | ◎ TMP 성숙 | △ 웹폰트 의존, CJK 무거움 |
| 라이선스·비용 (●●) | ◎ MIT 완전 무료·로열티 0 | △ 라이선스 변동 이력·런타임 정책 리스크 | ◎ MIT |
| 팀 적합(2인 인디·내러티브) (●●) | ◎ 경량·빠른 이터레이션·씬 단순 | △ 오버스펙·빌드 무거움 | ○ 웹 한정·서사툴 빈약 |
| 데스크톱 배포(Steam 우선 D3) (●●) | ◎ 단일 바이너리 export preset | ◎ 성숙 | △ 웹/래퍼(Electron) |

**결론(D5 준수):** **Godot 4.x 채택.** 2D·그리드·입력·세이브가 전부 엔진 내장이고 MIT 무료, 2인 인디 이터레이션에 최적. **유일한 실질 리스크는 한/영(CJK) 폰트와 HTML5 export 폰트 버그**(§3에서 스파이크로 선제 검증). PC-Steam 우선(D3)이라 HTML5 리스크는 v1.0 크리티컬패스에서 비켜 있으나, 데모 웹 배포를 위해 스파이크에 웹 케이스 포함. **스파이크 실패 시 웹 빌드만 Phaser+웹폰트로 폴백**(데스크톱은 Godot 유지).

### 2.2 타깃 플랫폼 / 해상도 / 카메라 / 화면비

| 항목 | v1.0 (D3) | 포스트런치 |
|---|---|---|
| 1차 플랫폼 | **PC (Windows/macOS/Linux) · Steam** | — |
| 입력 | 키보드 + 게임패드 + **마우스 포인트앤클릭**(D3/C3) | 순수 터치(모바일 포트) |
| 웹 데모 | HTML5(폰트 스파이크 통과 조건부, Next Fest 데모용) | — |
| 모바일 | (성능 측정 계획만 §9) | iOS/Android 포트 |

- **기준 내부 해상도:** `1920×1080` (16:9). `project.json` 스트레치 = `canvas_items`, aspect = `expand`. 타일 32px(02 문서) → 한 화면 약 **60×34 셀**(논리 카메라 줌으로 02 문서의 "한 화면 20×12타일" 체감 = 카메라 줌 ≈3.0).
- **카메라:** `Camera2D` 플레이어 추종(스무딩 on, `position_smoothing_speed≈8`). 셀 그리드에 픽셀 스냅(`snap_2d_transforms_to_pixel`)로 텍스트/픽셀아트 떨림 방지. 데드존 작게(탑다운 탐험에 화면 흔들림 최소화 — D9 광과민성).
- **화면비 대응:** 16:9 기준, 21:9/16:10은 가시영역 확장(레터박스 회피, 단 레벨러는 16:9 안전영역 안에 핵심 동선 배치 — §12 계약). 4:3/세로는 v1.0 비대상.
- **UI 스케일:** `content_scale_factor`로 텍스트 크기 옵션(D9) 연동. 터치 타깃 44px(D9)는 포스트런치 터치에서 강제, v1.0 마우스/패드 포커스 내비 기준.

---

## 3. 한/영 폰트 & 로컬라이즈 파이프라인 (D5 P0 최우선)

> **이 게임은 텍스트가 주 서사 매체다.** 폰트가 깨지면 게임이 깨진다. 따라서 **착수 직후 첫 스파이크**(00 §4 P0).

### 3.1 알려진 리스크 (명시)
2026-06 기준 Godot 4의 CJK/HTML5 폰트 관련 실측 이슈:
- **HTML5 export에서 유니코드 글리프 미표시** — 시스템 폴백이 웹에서 동작 안 하는 사례(godot#78921). 데스크톱은 정상인데 웹만 깨지는 패턴(forum 다수).
- **Web/macOS export에서 한글 입력(IME) 깨짐**(godot#85597) — v1.0은 텍스트 입력 UI가 금고 코드(숫자) 정도라 영향 작지만, 닉네임 등 확장 시 위험.
- **로케일 리매핑 + DynamicFont 시 한글 공백 렌더**(godot#17640) — 폰트를 로케일별로 자동 스왑할 때 한글이 빈칸으로.
- **3.x→4.x DynamicFont→FontFile 변환 깨짐**(godot#77285) — 본 프로젝트는 신규라 비해당이나, 외부 에셋 임포트 시 주의.
- **Han Unification** — CJK 통합 한자 글꼴 선택 이슈(godot-proposals#3766). 한/영만 쓰는 본작은 영향 낮음.

### 3.2 폰트 파이프라인 (확정)
- **본문 폰트:** `Noto Sans KR`(한글) + 라틴 글리프 동일 패밀리 사용으로 한/영 혼식 일관. OFL 라이선스(상업 배포 가능).
- **임포트:** Godot `FontFile`(구 DynamicFont)로 임포트. **멀티채널 미사용**, 힌팅·오버샘플링 기본. CJK는 글리프가 많으므로 **on-demand 글리프 캐시**(런타임 래스터) 사용 — 사전 베이크는 빌드 크기·로딩 트레이드오프라 데스크톱은 동적, **웹은 사용 글리프만 프리베이크**(아래 스파이크 결정사항).
- **폴백 체인:** `Theme` 기본 폰트 → Noto Sans KR → Noto Sans(라틴) → 이모지/기호 폰트. 단일 `Theme` 리소스에 폰트·크기 토큰(D9 디자인 토큰) 집중.
- **로컬라이즈:** **번역 키 방식**(§5⑤ i18n 스키마). UI/독백/회상 텍스트는 전부 `tr("KEY")`. `.csv`/`.po`를 `Translation` 리소스로 임포트, `TranslationServer.set_locale("ko"|"en")`. 폰트를 로케일별로 자동 스왑하지 않고(위 #17640 회피) **단일 폰트가 한/영 모두 커버**하도록 설계.
- **줄바꿈:** 한국어(공백 적음) 대비 `autowrap_mode = WORD_SMART`(단어 우선, 불가 시 글자) + 금칙 처리 확인. 영어는 단어 단위.

### 3.3 폰트 스파이크 계획 + 통과 기준 (P0 게이트)
**목적:** 본 프로젝트 텍스트(독백·회상·UI·정체성 카드)가 한/영 양쪽에서 **3개 타깃(데스크톱/웹/모바일)** 에 깨짐 없이 표시·갱신되는지 착수 전 증명.

**스파이크 산출물(`/spikes/font/` 소형 Godot 프로젝트):**
1. `Label`·`RichTextLabel`(독백 타자 효과)·`Button`·금고 코드 입력(`LineEdit`)에 한/영 장문 표시.
2. 01 문서의 깨진 글자 연출("나는… 나는 누… ?")·이모지(🐾)·특수문자(…—)·숫자(3142) 포함.
3. 런타임 `set_locale` 토글로 한↔영 즉시 스왑.
4. **export 3종**: Windows/macOS·HTML5·(가능 시 Android) 실기/브라우저 확인.

**통과 기준(전부 충족해야 P0 통과):**
- [ ] **글리프 완전성:** 한글 음절·자모·라틴·숫자·🐾/…/— 가 **모든 타깃에서** 누락(두부 □·빈칸) 없이 렌더.
- [ ] **웹 동등성:** HTML5 빌드가 데스크톱과 **동일 글리프**(godot#78921 회피 확인). 깨지면 → 사용 글리프 프리베이크 또는 웹 폴백(Phaser) 결정.
- [ ] **커서/입력:** `LineEdit`에 숫자 입력·커서 위치·선택 정상(IME 한글 입력은 v1.0 비요구, 확인만).
- [ ] **로케일 스왑:** 런타임 한↔영 전환 시 폰트/레이아웃 깨짐·재시작 요구 없음.
- [ ] **줄바꿈/오버플로:** 한/영 장문이 말풍선·HUD·카드 박스에서 잘림/넘침 없이 자동 줄바꿈.
- [ ] **성능:** 글리프 캐시 워밍 후 텍스트 다량 표시에서 프레임 드랍 없음(웹 포함).

**실패 시 폴백(D5):** 데스크톱은 Godot 유지, **HTML5 웹 데모만 Phaser+웹폰트(woff2 서브셋)**. 이 결정은 스파이크 리포트에 기록하고 §11 리스크 R-FONT 상태 갱신.

---

## 4. 아키텍처 — GameState 싱글톤(SSOT) + 시그널, 씬/노드, 디렉터리

### 4.1 오토로드(싱글톤) 레이어 (D6④)
모든 오토로드는 `Node` 기반, `project.json`에 등록. **런타임 상태의 유일한 보유자는 `GameState`.**

| 오토로드 | 책임 | 보유/노출 |
|---|---|---|
| **GameState** (SSOT) | 현재 런(run)의 모든 게임 상태: 메모리 미터(pt), 빛 자원, 정체성 진행(획득 코어 set), 현재 챕터/안전지대, 보유 아이템, 모드. **유일하게 상태를 `set`한다.** | `signal` 다수(아래). UI/AI는 질의·구독만. |
| **EventBus** | 직접 참조 없는 시스템 간 통신(특히 **소리 이벤트** §6, 상호작용, 컷신 요청). | `signal noise_emitted(event)`, `signal shard_collected(id)` 등. |
| **DataRegistry** | §5 스키마 로드·검증·인덱싱. 부팅 시 1회 로드, 이후 read-only 조회. | `get_shard(id)`, `get_archetype(id)`, `get_cutscene(id)` … |
| **SaveService** | 3계층 세이브/로드·마이그레이션(§7). `GameState`를 직렬화/복원. | `save_run()`, `load_slot(n)`, `commit_permanent()`. |
| **SettingsService** | 접근성/입력/오디오 옵션(D9). meta 세이브에 영속. | `signal setting_changed(key,val)`. |
| **GridService** | 현재 맵의 `AStarGrid2D` 보유·셀↔월드 변환·경로 질의(§8). | `request_path(from,to)`, `cell_to_world()`. |
| **AudioDirector** | 미터 임계 연출(드론/심박/채도)·BGM·SFX 라우팅. | `GameState` 시그널 구독. |
| **SceneRouter** | 챕터/씬 로딩·전환·페이드, 체크포인트 진입점. | `change_chapter(id, entry)`. |

**핵심 시그널(예시):**
```gdscript
# GameState.gd (정적 타입)
signal memory_changed(points: int, max_points: int, state: String) # state: "normal"|"low"|"critical"
signal light_changed(amount: int)
signal identity_progress_changed(filled: int, total: int)   # 카드·HUD가 동일 소스로 표기(D9 불일치 해소)
signal core_sealed(shard_id: String, cell: Vector2i)        # 후퇴 시 임시 봉인(D1)
signal setback_triggered(safe_zone_id: String)
signal mode_changed(mode: String)                            # "story"|"standard"|"suspense"
```
> **D9 표기 통일:** 정체성 진행을 카드와 HUD가 각자 세지 않고 둘 다 `identity_progress_changed`를 구독 → 3/5 vs 1/5 불일치 구조적 차단.

### 4.2 씬/노드 구조 (게임플레이 씬)
```
Main (SceneRouter가 로드)
└── World (현재 챕터 인스턴스: Chapter01.tscn …)
    ├── TileMapLayers (Ground / Walls / Furniture / Overlay)   # 02 문서 타일 = 셀
    ├── Navigation (AStarGrid2D 소스: 벽/가구 → solid)
    ├── Entities
    │   ├── Player (CharacterBody2D)
    │   │   ├── Sprite/AnimationTree (3/4 쿼터뷰, D4)
    │   │   ├── PawprintTrail (D2 발자국 추적·다이제틱 시그니처)
    │   │   ├── MemoryProjector (D2 기억 비추기·Light2D + 마스크)
    │   │   └── InteractionProbe (Area2D, 인접 상호작용 후보)
    │   ├── Enemies (Murk*, Echo*  ← EnemyArchetype 데이터로 스폰)
    │   └── Interactables (Shard*, Lock*, SafeZone*, LightPool*)
    ├── FX (셰이더 레이어: 왜곡/노이즈/비네팅 — §9)
    └── Camera2D
HUD (CanvasLayer, World 위 — GameState 구독)
└── MeterWidget / IdentityCard / Toasts / Journal / PauseMenu …
```
- **Player는 입력을 직접 읽지 않는다.** `InputController`가 Intent를 만들고(§8) Player는 Intent를 소비 → 키보드/패드/마우스/터치/접근성토글 분기를 한 곳에 격리.
- **적 스폰은 하드코딩 금지.** `MapSpawns` 데이터(§5④)를 `World`가 읽어 `EnemyArchetype`로 인스턴스화.

### 4.3 디렉터리 레이아웃
```
/glowcat/                      # Godot 프로젝트 루트
├─ project.json
├─ autoload/                  # GameState, EventBus, DataRegistry, SaveService, GridService ...
├─ core/
│  ├─ input/                  # InputController, Intent 정의(§8)
│  ├─ grid/                   # GridService, pathfinding 래퍼
│  ├─ save/                   # SaveService, migrations/
│  └─ data/                   # 스키마 로더·검증기, Resource 래퍼(§5)
├─ entities/
│  ├─ player/                 # Player.tscn/.gd, MemoryProjector, PawprintTrail
│  └─ enemies/                # base FSM, states/, Murk.tscn, Echo.tscn, Boss/
├─ world/
│  ├─ chapters/               # Chapter01.tscn ... (씬), spawns 데이터 바인딩
│  └─ interactables/          # Shard, Lock, SafeZone, LightPool
├─ ui/                        # HUD, Journal/추리보드, Settings, 후퇴화면, 컴포넌트/
├─ fx/                        # 셰이더(.gdshader): distort, noise, vignette
├─ data/                      # ★ 콘텐츠 데이터(작가/레벨러 소유) — §5
│  ├─ shards/  cutscenes/  enemies/  spawns/  i18n/  balance/
├─ assets/                    # art, audio, fonts(Noto Sans KR)
├─ theme/                     # 디자인 토큰 Theme(D9), 색/타이포/스페이싱
├─ tests/                     # GUT 단위테스트(스키마·세이브·인지·A*)
└─ spikes/font/               # §3 폰트 스파이크
```

---

## 5. 데이터 주도 설계 — 스키마 5종 (D6①) · 작가/레벨러와의 계약

> **형식 결정:** 콘텐츠는 **사람이 편집하는 JSON**(작가/레벨러 친화·diff·외부 툴) → 부팅 시 `DataRegistry`가 로드·검증·인덱싱. (성능 임계 자산만 후처리로 `.tres`로 베이크 가능.)
> **모든 ID는 안정적·불변.** 세이브와 i18n이 ID로 참조하므로(§7), 발급 후 변경 금지(변경 시 마이그레이션 필요).
> 5종: **① MemoryShard ② Cutscene ③ EnemyArchetype ④ Map-Spawns ⑤ i18n**

### 5.1 ① MemoryShard (`data/shards/*.json`)
01·02 문서의 코어/에코/거짓 조각을 데이터화.
```json
{
  "schema_version": 1,
  "id": "C1-1",
  "type": "core",                       // "core" | "echo" | "false"
  "chapter": 1,
  "name_key": "shard.C1-1.name",        // i18n 키 → §5⑤
  "object_key": "shard.C1-1.object",    // "이름표 목걸이"
  "cutscene_id": "cut.C1-1",            // §5② 참조 (없으면 null)
  "identity_unlock": {                  // D9: GameState.identity_progress 갱신
    "card_slot": "species",             // species|name|home|owner|why  (정체성 카드 5칸)
    "reveal_key": "identity.C1-1.reveal"
  },
  "meter_delta_pt": 100,                // 코어 +100, 에코 +30, 거짓 -100 (03 §1-1)
  "light_delta": 0,
  "discovery": {                        // D2: 글로우 OFF·3단 발견
    "glow_default_on": false,
    "requires_projection": null,        // 특정 코어 렌즈 필요 시 그 shard_id (기억 비추기)
    "requires_trail": false,            // 발자국 추적으로만 드러나는지
    "interaction": "pickup"             // pickup|drawer|under|push
  },
  "false_clue": {                       // type=="false"일 때만 (D8: 거짓=부정 단계)
    "contradiction_journal_id": null,   // 모순 단서(일지) 참조
    "trail_behavior": "cold_or_broken"  // 발자국이 차갑거나 끊김(D2 추리 결합)
  }
}
```
> **거짓 조각(D8/C2):** 진엔딩 게이트 아님(거짓 0개 가산점 무효화 — D8). 기능은 미터 압박 + 환각 강화뿐. `false_clue`는 추리 보조용 메타.

### 5.2 ② Cutscene (`data/cutscenes/*.json`)
회상 컷신 = "재해석 재생"(01 §0-3, D8) 지원. 같은 컷신을 후반에 다른 variant로 재생.
```json
{
  "schema_version": 1,
  "id": "cut.C3-3",
  "variant": "base",                    // "base" | "reinterpret" (재해석 재생: 따뜻함→진실)
  "trigger": "on_shard_pickup",         // 또는 "on_event:reveal_midlayer"
  "palette": "warm",                    // warm(과거) | cold(현재) | desaturate(왜곡)
  "skippable_if_known": true,           // D1: 코어 영구보존 → 재시작 시 스킵 가능
  "steps": [
    { "kind": "monologue", "text_key": "cut.C3-3.l1", "typing_ms_per_char": 45 },
    { "kind": "fx", "shader": "distort", "intensity": 0.6, "duration_s": 2.0,
      "respect_accessibility": true },           // D9: '화면흔들림 감소'/'색수차 끄기' 토글 존중
    { "kind": "image", "asset": "cut/c3-3_2.webp", "palette": "cold" },
    { "kind": "monologue", "text_key": "cut.C3-3.l2" },
    { "kind": "signal", "emit": "identity_progress_changed" }
  ],
  "budget_tag": "ch3"                    // D8 독백 예산제(챕터당 상한) 집계용
}
```

### 5.3 ③ EnemyArchetype (`data/enemies/*.json`)
03 문서의 Murk/Echo/Boss 수치를 데이터화. **모드 배율(03 §5)은 BalanceConfig에서 곱함.**
```json
{
  "schema_version": 1,
  "id": "murk",
  "display_key": "enemy.murk.name",
  "sense": "sight",                     // "sight"(Murk) | "hearing"(Echo) | "boss"
  "speed_patrol": 1.8,                  // 타일/s (03 §2-1)
  "speed_chase": 2.6,                   // < 플레이어 보행 3.2 보장(D7) — 로더가 검증
  "sight": { "radius": 3.5, "fov_deg": 90, "los_required": true },   // §6 시각 3단 게이트
  "hearing": { "loss_silence_s": 2.0 }, // Echo용(없으면 무시)
  "give_up_s": 4.0,
  "contact_meter_pt": -100,             // Murk -100 / Echo -150 (03 §1-1)
  "iframe_s": 1.5,
  "blocked_by": ["light_pool", "safe_zone"],   // 03 §2 공통: 빛/안전지대 진입 불가
  "fsm": "murk_fsm",                    // §6 상태 노드 세트 키
  "narrative_state": "default"          // D8: PASSIVE 상태(집 안 안 덤비는 Murk) 지원
}
```
Echo 예시 차이: `"sense":"hearing"`, `speed_chase: 3.0`(< 3.2), `fsm:"echo_fsm"`, 소음 반경표는 §6 청각 모델(플레이어 행동별)에서 산출.

### 5.4 ④ Map-Spawns (`data/spawns/*.json`)
02 문서의 좌표 마킹을 데이터화. **타일 좌표(행,열) = 엔진 셀(Vector2i(x=열,y=행)).** 레벨러의 산출물.
```json
{
  "schema_version": 1,
  "map_id": "chapter1_room",
  "grid_size": [10, 9],                 // 02 §1: 10열×9행
  "tileset_ref": "world/chapters/Chapter01.tscn",
  "player_start": { "cell": [4, 7] },   // 02: @(7,4) → (열4,행7)
  "shards": [
    { "shard_id": "C1-1", "cell": [7, 6] },   // ★(6,7) 이름표 게임기 밑
    { "shard_id": "C1-2", "cell": [7, 2] },
    { "shard_id": "C1-3", "cell": [4, 5] },
    { "shard_id": "C1-4", "cell": [3, 3] }
  ],
  "enemies": [],                        // 챕터1 적 없음(02 §1)
  "safe_zones": [ { "id": "sz_window", "cell": [1, 5], "kind": "sunlight" } ],  // ☼(5,1)
  "light_pools": [ { "cell": [1, 5], "radius": 1.5 } ],
  "locks": [],
  "doors": [ { "id": "d_hall", "cell": [5, 0], "unlock": { "type": "core_count", "n": 4 } } ],
  "hints": [],
  "checkpoint": { "safe_zone_id": "sz_window" }   // §7 체크포인트=안전지대
}
```
> **락-키 도달성(D7④):** 로더가 BFS로 player_start→모든 shard/lock/door 도달성 검증. 챕터2 금고(03/02) 코드 `3142`는 lock 데이터의 `solution`으로(아래).
```json
{ "id": "safe_kitchen", "cell": [4, 4], "type": "code", "solution": "3142",
  "grants_shard": "C2-2", "hint_journal_id": "clue.calendar.3142" }
```

### 5.5 ⑤ i18n (`data/i18n/strings.{ko,en}.csv` 또는 `.po`)
모든 표시 텍스트의 키-값. Godot `Translation`으로 임포트. **작가의 1차 산출물.**
```csv
keys,ko,en
shard.C1-1.object,"이름표 목걸이","Name Tag Collar"
identity.C1-1.reveal,"나는… 고양이다.","I am… a cat."
cut.C3-3.l1,"내 청록빛 무늬가 처음 빛났던 순간.","The moment my cyan markings first glowed."
ui.meter.low,"기억이 흐려진다","Memory is fading"
ending.A.card,"기억은 무게가 있다. 그래도, 너를 기억하기로 했다.","Memories have weight. Still, I choose to remember you."
```
> 코드/데이터는 **키만** 참조. 신파 방지·독백 예산(D8)은 작가가 CSV에서 관리, 컷신 `budget_tag`로 집계.

### 5.6 로더 검증 스텝 (부팅 시 `DataRegistry`, fail-fast)
1. **스키마 유효성:** 필수 필드·타입·`schema_version` 일치. 실패 시 명확한 에러(파일·필드).
2. **ID 유일성·참조 무결성:** `cutscene_id`/`requires_projection`/`grants_shard`/i18n 키가 실재하는지 dangling 검사.
3. **수치 불변식(D7):** 모든 `speed_chase < 3.2`(보행)·Echo 추격 `< 3.2`·은신 `1.9` 참조. 빛웅덩이 도달 `≤4타일`(스폰 검증). 위반 시 에러.
4. **도달성(BFS):** player_start에서 셀 그리드로 전 shard/door/lock 도달성. 락 뒤 키가 락 안쪽에 갇혔는지(데드락) 검출.
5. **밸런스 정합:** `BalanceConfig`(모드 배율 03 §5)와 archetype 곱연산 결과가 D7 불변식 깨지 않는지(예: suspense 1.2× 후에도 추격 < 보행) 경고/에러.
6. **i18n 커버리지:** 코드/데이터가 참조하는 모든 키가 ko·en 양쪽에 존재(누락 시 빌드 경고, 릴리스 빌드는 에러).
- 검증은 **`tests/`의 GUT 테스트로도** 실행(CI 게이트). 에디터 부팅 시 `--validate-data` 커스텀 모드 제공.

---

## 6. 적 AI (D6⑤)

### 6.1 시각 인지 3단 게이트 (Murk · 시각 감지형)
매 인지 틱(**10Hz 고정**, 프레임 비의존)마다 순서대로 평가, **하나라도 실패하면 미감지**(저비용 우선 배치):

1. **거리(Distance) 게이트** — `dist_cells(enemy, player) ≤ sight.radius`(Murk 3.5, 모드 배율 적용). 은신 시 **반경 ×0.6**(03 §2-1 "60% 축소"… 정확히는 0.4 축소→0.6배; 03 본문 "60% 축소" 표기를 0.6배로 해석, §11 확인항목). 가장 싸므로 1순위.
   `effective_radius = base_radius * mode_mul * (0.6 if player.is_stealth else 1.0)`
2. **각도(Angle) 게이트** — 적 전방 기준 플레이어 방위각이 `fov_deg/2` 이내:
   `cos(angle) = dot(forward, normalize(player - enemy)); pass if cos(angle) ≥ cos(deg2rad(fov_deg/2))`
3. **시야선(LoS) 게이트** — `PhysicsDirectSpaceState2D.intersect_ray`(또는 셀 그리드 supercover line)로 적→플레이어 사이 **벽/가구(`Walls`,`Furniture`) 차단 없음**. 빛 웅덩이 뒤로 돌면 즉시 차단(03 §2-1 "빛 뒤=시야 차단"): 빛 웅덩이 셀도 LoS 차단 마스크에 포함.

세 게이트 통과 시 `PATROL→CHASE`. 미통과 후 `give_up_s`(4s) 지나면 `RETURN`(마지막 목격 셀 수색)→`PATROL`.

### 6.2 청각 인지 — Echo (소리 이벤트 발신·구독 모델, D6⑤)
시각이 아니라 **소리 이벤트**에 반응(03 §2-2). **발신자(플레이어/상호작용)와 구독자(Echo)를 EventBus로 분리.**

**소리 이벤트 스키마(`EventBus.noise_emitted`):**
```gdscript
# NoiseEvent (정적 타입 자료구조)
class_name NoiseEvent
var origin_cell: Vector2i
var radius_cells: float          # 소음 반경(아래 표)
var loudness: float              # 0~1 (감쇠/우선순위)
var surface: String              # "dry" | "wet"(≈ 젖은 바닥)
var source: String               # "footstep" | "pickup" | "decoy" | "drawer"
var timestamp_ms: int
```
**소음 반경 모델(03 §2-2, 플레이어 행동→반경):**
| 행동 | 반경(셀) |
|---|---|
| 은신 이동(Shift / StealthIntent) | 1.0 |
| 일반 이동 | 2.5 |
| 젖은 바닥(≈) 일반 이동 | 4.5 |
| 줍기/서랍 | 순간 3.0 (0.5s) |
| 정지 | 0 (이벤트 미발신) |

- **발신:** Player 이동/상호작용이 `EventBus.noise_emitted.emit(NoiseEvent)`. 젖은 바닥 판정은 타일 메타(`Ground` 레이어 custom data `surface=wet`).
- **구독:** 각 Echo가 구독, `dist_cells(self, ev.origin_cell) ≤ ev.radius_cells`면 반응. **폴링 없음**(성능·결정론).
- **소리 미끼(아이템):** 던진 셀에서 `source="decoy"` NoiseEvent 발신 → Echo 유인(03 §4, 능동 공략).

### 6.3 FSM 구현 패턴 — 상태 노드 (State Pattern)
- 적 = `CharacterBody2D` + 자식 `StateMachine`(Node) + 상태별 자식 노드(`PatrolState`,`ChaseState`,…). 각 상태는 `enter()/physics_update(delta)/exit()` + 전이 조건 반환. 데이터(`fsm` 키)로 상태셋 선택.
- **Murk FSM**(03 §2-1):
```
PATROL ──(시각 3단 게이트 통과 & 비은신)──▶ CHASE
PATROL ──(빛/안전지대 접근)──▶ PATROL(우회: 경로재계산, blocked_by 회피)
CHASE  ──(접촉 & not iframe)──▶ 미터-1 → 플레이어 1.5s 무적 → COOLDOWN(2s)
CHASE  ──(시야상실 give_up_s=4)──▶ RETURN(마지막 목격 셀) ──▶ PATROL
COOLDOWN ──(2s)──▶ PATROL
```
- **Echo FSM**(03 §2-2):
```
WANDER ──(반경 내 NoiseEvent)──▶ INVESTIGATE(소리 셀로 경로)
INVESTIGATE ──(2s내 추가 소음)──▶ CHASE
INVESTIGATE ──(무소음 3s)──▶ WANDER
CHASE ──(포획)──▶ 미터-1.5 → 0.8s 속박 → COOLDOWN
CHASE ──(플레이어 정지 & 무소음 2s)──▶ LOSE ──▶ WANDER
```
- 이동은 전부 `GridService` 경로(§8). 추격도 그리드 A*로 셀 경로 산출 후 보간(벽 끼임 방지).
- **D8 PASSIVE:** `narrative_state="passive"`인 Murk(집 안, 반전 복선)는 CHASE 진입을 막고 FOLLOW만(따라다니되 공격 안 함) — 데이터 토글로 서사-기계 일치.

### 6.4 보스 — The Blank (D3: v1.0 **1페이즈**, 3페이즈=포스트런치)
03 §2-3 / 02 §5 / 01 §6-2 기반. v1.0은 1페이즈 단순화.
- **메커닉:** 데미지 대신 **그랩**(예고선 1s → 직선 돌진, 회피 가능 — 공정성 규칙). 코어 조각의 빛을 **비추기(MemoryProjection)** 로 약화.
- **1페이즈(v1.0):** 환각(거짓) 다수 소환 + 코어 ★ 주변 안개. 진짜 코어 획득 후 보스에게 비추기 → 약화 → 정지 → 실루엣이 고양이와 포개짐("…너는 나였구나") → `FINAL_CHOICE` 트리거(A 진엔딩/B 루프엔딩).
- **데이터:** `EnemyArchetype(sense="boss")` + `BossPhase` 데이터(페이즈별 그랩 쿨/안전코너 생성). 그랩 적중 시 미터 -2(03 §1-1, 페이즈당 1회). **안전코너 1곳 페이즈마다 일시 생성**(완전 무자비 방지).
- **C4 연계:** 최종장 안전지대 부재(02 §5)는 D1 후퇴와 충돌 → **C4 해소: "이동 안전지대"**(고양이가 비춘 빛=일시 웅덩이)로 후퇴 귀환점 확보(§7).

---

## 7. 세이브 / 로드 — 3계층 (D6② / D1)

### 7.1 3계층 구조
| 계층 | 파일 | 내용 | 쓰기 시점 |
|---|---|---|---|
| **meta** | `user://meta.save` | 기기/계정 단위: 설정·접근성(D9)·언어·해금(엔딩 본 적/뉴게임+)·통계. 슬롯 무관. | 설정 변경·해금 시 |
| **permanent** | `user://slots/{n}/permanent.save` | 슬롯 단위 **영구 진행**: 획득한 **코어 조각(D1 영구보존)**·정체성 카드·일지(추리보드)·본 컷신 set. **후퇴해도 유지.** | 코어 획득·반전 해금 시 commit |
| **run** | `user://slots/{n}/run.save` | 현재 세션: 위치(셀)·메모리 미터 pt·빛 자원·적 상태·임시 봉인된 코어·열린 문·현재 안전지대. | 체크포인트·수동 저장 |

> **경계 규칙(00 C1 "영구/세션 상태 경계 위험" 해소):** 코어 기억은 **permanent**, 위치/미터/봉인은 **run**. 후퇴는 run만 되돌리고 permanent는 불변 → "코어 영구보존 + 위치/적만 초기화"(03 §1-2)가 구조적으로 성립.

### 7.2 스키마 (JSON, 직렬화)
```json
// permanent.save
{
  "save_version": 3,
  "slot": 1,
  "chapter": 2,
  "core_shards": ["C1-1","C1-2","C1-3","C1-4","C2-1"],   // D1 영구보존
  "identity_card": { "species": true, "name": "N___", "home": true, "owner": "하루", "why": false },
  "journal": { "entries": ["clue.calendar.3142"], "deductions": ["d_owner_left"] },
  "seen_cutscenes": ["cut.C1-1","cut.C2-2"],
  "echo_shards": ["E1-1"]
}
```
```json
// run.save
{
  "save_version": 3,
  "slot": 1,
  "mode": "standard",                  // story|standard|suspense
  "map_id": "chapter2_house",
  "player_cell": [4, 1],
  "meter_pt": 250,                     // 0~1000 (10칸×100)
  "light": 3,
  "sealed_core": { "shard_id": "C2-1", "cell": [3, 1] },   // D1 임시 봉인(재획득 위치)
  "doors_open": ["d_hall"],
  "enemies": [ { "id":"murk", "spawn_idx":0, "state":"PATROL", "cell":[4,2] } ],
  "current_safe_zone": "safe_kitchen",
  "checkpoint_cell": [4, 1]
}
```
```json
// meta.save
{
  "save_version": 3,
  "language": "ko",
  "settings": { "reduce_shake": true, "reduce_flash": true, "chromatic_off": true,
                "text_size": 1.2, "enemy_speed_mul": 1.0, "auto_stealth": false,
                "one_click_mode": false, "puzzle_auto_after_fail": 3 },   // D9
  "unlocks": { "seen_ending_A": false, "seen_ending_B": true, "newgame_plus": true },
  "stats": { "playtime_s": 7200, "setbacks": 2 }
}
```

### 7.3 `save_version` 마이그레이션
- 매 세이브에 `save_version: int`. 로드 시 `SaveService`가 현재 버전 미만이면 `migrations/`의 단계별 함수 체인 실행(`v1→v2→v3`). 각 마이그레이션은 **순수 함수**(입력 dict→출력 dict)·테스트 보유(`tests/`).
- 알 수 없는 상위 버전 → "더 최신 빌드에서 만든 세이브" 안전 거부(손상 방지).
- 손상/파싱 실패 → 백업(`*.bak`) 복구 시도 후 사용자 통지. 저장은 **원자적 쓰기**(임시파일→rename).

### 7.4 모드별 0칸 동작 (D1 / 03 §5 / GDD 9)
| 모드 | 0칸(메모리 미터=0) 동작 |
|---|---|
| **스토리** | **무리셋.** 가장 가까운 안전지대로 강제 귀환 + 적 일시 후퇴(03 §1-2). |
| **표준(기본)** | **후퇴(Setback) — D1.** 마지막 안전지대 체크포인트로 귀환 + **가장 최근 코어 1개 임시 봉인**(같은 자리 재획득, 위치 표시) + 30초 최대 왜곡 연출 + 오프닝 독백 재생. **코어 기억 영구보존**(다시 안 잃음). 빛/힌트로는 미터 안 깎임. |
| **서스펜스(옵트인·포스트런치)** | **하드 리셋.** 게임 처음으로(run·permanent의 진행 일부 초기화 정책은 포스트런치 확정). |

- **후퇴 시퀀스(표준):** `GameState.memory_pt==0` → `setback_triggered` → (1) 가장 최근 코어를 `sealed_core`로 이동(permanent의 core_shards에서 빼지 않고 run에 봉인 플래그) (2) `current_safe_zone`로 텔레포트 (3) 왜곡 FX 30s 페이드(D9 토글 시 강도 축소) (4) 오프닝 독백(`tr`) (5) 적 리스폰/run 부분 롤백. **하드리셋 코드패스는 표준에서 절대 호출되지 않음**(모드 가드).
- **체크포인트 = 안전지대(S/☼).** 자동 저장은 안전지대 진입 시 run.save 기록(02 §6 "쉼-위험-쉼" 리듬). 수동 저장은 메뉴.
- **최종장(C4):** 안전지대 0 → "이동 안전지대"(비춘 빛 일시 웅덩이)를 후퇴 귀환점으로(02 §5 / D7 C4).

---

## 8. 입력 추상화 (Intent 레이어) + 그리드 A* (D6③ / D7)

### 8.1 Intent 레이어
**원리:** 디바이스(키보드/패드/마우스/터치/접근성토글) → `InputController`가 **Intent**로 정규화 → Player/시스템은 Intent만 소비. 디바이스 추가가 게임플레이 코드를 안 건드림(D3 포스트런치 터치 대비).

```gdscript
# core/input/intents.gd (정적 타입)
class_name Intent
# 4종 (요구사항)
class MoveIntent     extends Intent: var dir: Vector2          # WASD/패드 스틱 (연속 방향)
class MoveToIntent   extends Intent: var target_cell: Vector2i # 마우스/탭 포인트앤클릭 → 목표 셀
class StealthIntent  extends Intent: var active: bool          # Shift 홀드 / 🐾 / 자동은신 토글
class InteractIntent extends Intent: var target: NodePath      # E/Space / 직접 탭 (하이라이트 후보)
```
- **MoveIntent**(보행 3.2 / 은신 1.9 타일/s — D7): 키보드/패드. 8방향 정규화.
- **MoveToIntent**(포인트앤클릭 — D3): 마우스 클릭/터치 탭 → 클릭 월드좌표를 `GridService.world_to_cell()` → **A* 경로 추적**(§8.2). 도착·재클릭·MoveIntent 입력 시 취소.
- **StealthIntent**: 홀드 또는 `auto_stealth` 토글(D9 "이동 시 항상 은신"). 활성 시 속도 1.9·소음 1.0셀(§6.2)·시야 ×0.6.
- **InteractIntent**: `InteractionProbe`(Area2D)가 인접 상호작용 후보 하이라이트 → 확정.
- **접근성 연동(D9):** `one_click_mode`/`auto_stealth`/`enemy_speed_mul`은 `SettingsService`→Intent/AI 파라미터에 주입. 한 손/원클릭은 MoveToIntent+InteractIntent 중심으로 완주 가능.

### 8.2 그리드 A* (`AStarGrid2D` — D6③)
- `GridService`가 현재 맵 크기로 `AStarGrid2D` 생성. `Walls`/`Furniture` 타일 → `set_point_solid(cell, true)`. 빛 웅덩이/안전지대는 **적에게만** solid 가중(blocked_by) — 플레이어 통행 자유.
- **대각 이동:** `diagonal_mode = DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES`(모서리 끼임 방지). 통로폭 ≥6셀(D7③)이라 대각 여유.
- **MoveToIntent 흐름:** target_cell → `astar.get_id_path(from, to)` → 셀 경로 → CharacterBody2D가 셀 중심 순차 보간(속도=보행/은신). 경로 막힘(동적 적/문) 시 재계산.
- **적 추격:** 동일 `AStarGrid2D` 사용, 적 가중치 레이어(빛/안전지대 회피)만 추가. 결정론 위해 동률 경로 타이브레이크 고정.
- **타일↔엔진 좌표 계약(00 §2-4 / D7):** 02 문서 `(행,열)` = `Vector2i(x=열, y=행)`. 변환은 `GridService` 단일 지점에서만. 레벨러 좌표가 곧 셀(스폰 §5④).

### 8.3 동시 활성 / 충돌 규칙 (D3/C3: 키보드+패드+마우스 항상 활성)
우선순위(높음→낮음), 충돌 시 상위가 하위를 즉시 취소:
1. **InteractIntent** (확정 상호작용은 이동에 우선)
2. **MoveIntent**(직접 방향 입력) — 들어오면 진행 중 **MoveToIntent(자동 경로) 즉시 취소**(플레이어가 손으로 잡으면 자동이동 중단; 표준 UX).
3. **MoveToIntent**(클릭 경로 추적)
4. **StealthIntent**는 직교 모디파이어 — 이동 종류와 무관하게 동시 적용(속도/소음/시야에만 영향).
- 동일 프레임 다중 디바이스 입력: 마지막 능동 입력 디바이스를 "활성"으로 표시(HUD 프롬프트 아이콘 스왑), 단 우선순위 규칙은 불변.

### 8.4 터치 UX 디테일 (포스트런치 모바일 — D3)
v1.0 비대상이나 Intent 레이어가 흡수하도록 미리 설계:
- 탭 = MoveToIntent / 오브젝트 직접 탭 = InteractIntent / 화면 하단 **🐾 홀드 = StealthIntent**(03 §3, GDD 4-2).
- 터치 타깃 ≥44px(D9). 더블탭=달리기(옵션), 길게 누르기=조사 프롬프트. 좌하단 가상 D-Pad는 옵션(MoveIntent 매핑).
- 손가락 가림 회피: 캐릭터를 탭 지점에서 살짝 오프셋, 상호작용 후보는 라디얼 메뉴.

---

## 9. 성능 / 셰이더 예산 · 모바일 측정 · 접근성 연동

### 9.1 프레임/셰이더 예산
- **목표 프레임:** 데스크톱 60fps, (포스트런치 모바일) 중급기 30fps.
- **풀스크린 포스트 셰이더 3종(GDD 8·03 §1-2 임계 연출):**
  | 셰이더 | 용도 | 예산/규칙 |
  |---|---|---|
  | **distort**(왜곡) | 미터 1칸·후퇴·회상 왜곡 | 텍스처 룩업 1회, 강도 `intensity` 균일. **광과민성 가드(D9): 플리커 <3Hz, 적색 고채도 번쩍 회피.** |
  | **noise**(노이즈) | 저미터 그레인 | 시간기반 1패스. 모바일 해상도 하향 가능. |
  | **vignette**(비네팅) | 가장자리 흑백(4칸↓ 03 §1-2) | 마스크 곱. 채도 감소와 결합(2칸↓ 채도 급감). |
- FX는 단일 `FX` CanvasLayer에 합성(패스 최소화). 미사용 시 셰이더 disable(상시 ON 금지 — GPU·발열).

### 9.2 접근성 토글 연동 (D9 — 셰이더가 토글을 존중)
- `reduce_shake` → 카메라 흔들림·distort 위치 변위 0/축소. `reduce_flash` → 플래시·번쩍임 비활성, 임계 전이 페이드로 대체. `chromatic_off` → 색수차/RGB 분리 비활성.
- 컷신 step의 `respect_accessibility:true`(§5②) FX는 위 토글을 **반드시** 적용. `SettingsService.setting_changed` 구독 → FX 머티리얼 uniform 즉시 반영.
- **색+형태 이중 인코딩(D9):** 적 식별은 색이 아니라 실루엣/모션(Murk=뭉게짐, Echo=흩날림) — 셰이더가 아니라 스프라이트/파티클. 미터 4상태(empty/half/full/danger)는 형태(반쪽 발바닥·금/흩어짐)로(UI).

### 9.3 모바일 측정 계획 (포스트런치 대비, 측정만 v1.0)
- 폰트 스파이크(§3)에 Android 케이스 포함 시 글리프·텍스트 성능 동시 측정.
- 측정 지표: 평균/1%로우 fps, 글리프 캐시 워밍 시간, 셰이더 3종 ON/OFF 델타, 배터리/발열(장시간). 중급기(예: 3~4년 전 미드레인지) 기준선.
- 그리드/AI는 셀 기반·10Hz 인지라 모바일 CPU 여유 큼(병목은 셰이더·폰트로 예측).

---

## 10. 코어 동사 기술 구현 개요 (D2 — 글로우 OFF·3단 발견)

> D2: "걷기+줍기"에 **기억 비추기·발자국 추적** 추가. 글로우 기본 OFF. 발견 = "환경 단서 → 상호작용 → 회상" 3단.

### 10.1 기억 비추기 (Memory Projection)
- **개념:** 장착한 코어 기억(렌즈)의 빛을 환경에 비추면 그 기억과 연관된 숨은 오브젝트/통로가 드러남("어떤 렌즈를 들까" 의사결정).
- **구현:** `MemoryProjector`(Player 자식) = `Light2D`(또는 마스크 텍스처) + 활성 렌즈 `shard_id`. 숨은 오브젝트는 `requires_projection`(§5① discovery)에 자기 렌즈 ID 보유 → 비추는 렌즈와 매칭 시 `visible/collidable` 활성. 입력: 홀드(렌즈 선택은 일지/휠).
- **데이터 계약:** 레벨러는 숨은 오브젝트 스폰에 `requires_projection: "C2-2"` 식으로 어떤 렌즈가 필요한지 명시(§12).

### 10.2 발자국 추적 (Pawprint Trail — 시그니처, 제목 직결)
- **개념:** 홀드 시 시안색 흔적/냄새 잔향이 떠올라 조각의 출처를 추적. 거짓 조각은 흔적이 **끊기거나 차갑다**(추리 단서 결합).
- **구현:** `PawprintTrail`(Player 자식, `Line2D`/파티클). 홀드 시 가장 가까운 미발견 코어로 향하는 셀 경로(A*)를 시안 점선으로 페이드 표출(직접 위치 노출 아님 — 방향·궤적만). 거짓 조각은 `trail_behavior:"cold_or_broken"`(§5①) → 트레일 색 차갑게/중간 끊김(추리 단서).
- **다이제틱 시그니처(D4 연계):** 이동 시 상시 바닥 시안 발자국 트레일(눈 안 보이는 쿼터뷰 보완) + 머리 위 떠다니는 발바닥. 추적 동사와 시각언어 공유.
- **빛 자원/미터 관계(D1):** 추적/비추기는 **빛 자원**으로 운용(필요 시 비용), **메모리 미터를 깎지 않음**(D1: 도움 시스템이 죽지 않도록). 정확한 비용은 BalanceConfig 튜닝.

---

## 11. 기술 리스크 레지스터 + P0/P1/P2 태스크

### 11.1 리스크 레지스터
| ID | 리스크 | 영향 | 가능성 | 대응/완화 | 트리거(언제 폴백) |
|---|---|---|---|---|---|
| **R-FONT** | Godot CJK/HTML5 폰트 깨짐(§3) | 높음(텍스트=서사) | 중 | **폰트 스파이크 P0**(통과 기준 §3.3). 웹만 Phaser 폴백(D5). | 스파이크 웹 동등성 실패 |
| **R-VER** | Godot 버전 회귀(4.6/4.7 변동) | 중 | 중 | **버전 핀**(착수 시 최신 안정 패치 고정, `project.json`·README 명시). 마이너 업그레이드는 브랜치 검증 후. | CI 회귀 |
| **R-SAVE** | 세이브 손상·경계 누수(C1) | 높음 | 중 | 3계층 경계(§7.1)·원자적 쓰기·`*.bak`·마이그레이션 테스트. | 파싱 실패율↑ |
| **R-VERB** | 코어 동사가 재미없음(P0 게이트) | 치명(00 결론) | 중 | 글로우 OFF+동사 2개 **P0 우선 검증**(테스터 좌절률<15%). | P0 게이트 미달 |
| **R-SETBACK** | 후퇴가 "긴장"이 아니라 "분노"(C1) | 높음 | 중 | 후퇴 설문 ≥70% 게이트(00 §4). 봉인 위치 명확·재획득 마찰 최소. | 설문<70% |
| **R-PATHPERF** | 동적 적 다수 A* 재계산 비용 | 중 | 낮 | 셀 기반·인지 10Hz·경로 캐시·적 수 상한(02 난이도 곡선). | 프로파일 스파이크 |
| **R-DATADRIFT** | 스키마-콘텐츠 드리프트(작가/레벨러 산출 불일치) | 중 | 중 | 로더 검증(§5.6)+CI 게이트, `schema_version` 강제, 본 문서=계약(§12). | 검증 에러 |
| **R-SCOPE** | 셰이더/연출 과다로 모바일 발열 | 중(포스트런치) | 중 | 셰이더 예산(§9.1)·토글·해상도 하향. | 모바일 측정 미달 |
| **R-STEALTHGEO** | 시야 vs 통로폭 기하 미성립(스텔스 붕괴) | 높음 | 중 | 로더 D7 불변식 검증(§5.6 #3-5)+02↔03 오버레이. | 도달성/불변식 위반 |

> **확인 항목(§6.1):** 03 §2-1 "은신 시 시야 60% 축소"의 정확한 의미(반경 0.6배 vs 0.4배). 본 문서는 **0.6배**로 구현하되 레벨/시스템과 합동 검증 후 확정.

### 11.2 기술 태스크 (00 §4 백로그를 기술로 구체화)
**P0 — 수직 슬라이스 게이트 (착수/검증 전 필수)**
- [P0-1] **폰트 스파이크**(§3) — 통과 기준 충족(최우선, D5).
- [P0-2] Godot 4 프로젝트 셋업: 버전 핀·타입세이프 강제·디렉터리(§4.3)·CI(gdlint/GUT/data 검증).
- [P0-3] **GameState SSOT + EventBus + 시그널**(§4.1) — 미터/빛/정체성 단일 소스(D9 불일치 해소).
- [P0-4] **데이터 스키마 v1 5종 + DataRegistry 로더·검증**(§5) — 챕터1 데이터로 가동.
- [P0-5] **3계층 세이브 v1 + 체크포인트(안전지대) + 표준 후퇴**(§7, D1) — 하드리셋 코드패스 금지.
- [P0-6] **입력 Intent 4종 + AStarGrid2D**(§8) — 키보드/패드/마우스 포인트앤클릭. 보행3.2/은신1.9.
- [P0-7] **Murk 시각 3단 게이트 + FSM**(§6.1/6.3) + 빛 웅덩이 회피.
- [P0-8] **코어 동사 ≥1**(발자국 추적 또는 기억 비추기) + **글로우 OFF 3단 발견**(D2, §10).
- [P0-9] 메모리 미터 4상태 위젯·광과민성 가드·대비·설정/접근성 화면 골격(D9, §9.2).
- [P0-10] 챕터1 '내 방' 데이터 주도 수직 슬라이스(02 §1) → **P0 게이트 측정**(좌절률<15%, 후퇴 설문≥70%).

**P1 — 코어 루프 완성 (챕터1~2 버티컬 슬라이스)**
- [P1-1] **Echo 청각 인지 + NoiseEvent 발신·구독**(§6.2) + 소리 미끼.
- [P1-2] 회상 컷신 플레이어 + **재해석 재생(variant)**(§5②, D8) + 독백 예산 집계.
- [P1-3] 자물쇠/금고 데이터화(§5④ lock, 코드 3142) + 추리보드/일지(D9).
- [P1-4] **세이브 마이그레이션 골격**(§7.3) + 테스트.
- [P1-5] 02↔03 **오버레이 검증** 자동화(시야콘/청각원/순찰선 실측, D7⑥) + 도달성 BFS.
- [P1-6] 두 번째 코어 동사 + 정체성 카드 패시브화 + 거짓 조각(챕터로 당김, D8).
- [P1-7] 회복-감소 재밸런스(D7⑤, BalanceConfig) + HUD/게임뷰 겹침 정리·포커스 내비.

**P2 — 확장·폴리시·포스트런치**
- [P2-1] 보스 3페이즈 복원(§6.4), 챕터(압축분 복원), 엔딩 2종 연출.
- [P2-2] **서스펜스 모드(하드리셋)** + 뉴게임+(D1/D8).
- [P2-3] **순수 터치 + 모바일 포트**(§8.4) + 모바일 성능 최적화(§9.3).
- [P2-4] 로컬라이즈 확장, export preset + CI 배포, 셰이더/접근성 추가 항목.

---

## 12. 타 직군 인터페이스 계약 (스키마 = 계약)

> **원칙(D6①):** 스키마가 곧 작가·레벨러·아트와 엔지니어의 계약이다. 산출물 형식이 본 문서에 고정되어 있으므로, 합의 없이 형식을 바꾸지 않는다.

| 직군 | 산출물(소유) | 형식/위치 | 엔지니어가 보장 | 검증 |
|---|---|---|---|---|
| **작가(내러티브)** | 독백·회상·정체성·엔딩 텍스트, 컷신 step 구성 | `data/i18n/*.csv`(키-값), `data/cutscenes/*.json` | `tr(key)` 렌더, 재해석 variant 재생, 독백 예산 집계, 깨진 글자 연출 | i18n 커버리지·컷신 참조 무결성(§5.6) |
| **레벨 디자이너** | 맵 타일, **스폰/좌표/안전지대/락-키/문**, 순찰 웨이포인트 | `data/spawns/*.json`(셀=`(열,행)`), 타일맵 씬 | 좌표=셀 1:1, A* 통행, 도달성 보장, 속도/시야 불변식 | BFS 도달성·D7 불변식(§5.6 #3-5) |
| **시스템/밸런스** | 적 수치, 모드 배율, 미터/회복 | `data/enemies/*.json`, `BalanceConfig` | 데이터→런타임 반영(매직넘버 없음), 모드 배율 곱 | 불변식·정합(§5.6 #5) |
| **아트/UX** | 디자인 토큰(색/타이포/스페이싱/글로우), 미터 4상태·컴포넌트, 쿼터뷰 스프라이트(D4) | `theme/`(Theme), `assets/`, 컴포넌트 씬 | 토큰 단일 소스, 4상태 형태 인코딩, 적 실루엣/모션 식별(D9) | 대비 3:1/4.5:1 체크 |
| **사운드** | BGM/SFX, 임계 연출 오디오 | `assets/audio/`, AudioDirector 매핑 | 미터 시그널 구독 트리거(드론/심박/채임) | — |

**불변 약속(전 직군):**
1. **ID는 불변.** 발급 후 변경은 마이그레이션 동반(§7.3).
2. **셀이 진실**(D7). 좌표 = `Vector2i(x=열,y=행)`, 변환은 `GridService`만.
3. **상태는 GameState만**(D6④). UI/연출은 시그널 구독, 직접 보유 금지.
4. **D7 불변식**(추격<보행, 빛웅덩이≤4, 통로≥6)은 데이터가 깨면 빌드가 막힌다(§5.6).
5. 스키마 변경 = 본 문서(04) PR + 관련 직군 통지.

---

## 부록 A. 결정 추적 (D1~D9 → 본 문서 매핑)
| 결정 | 본 문서 반영 |
|---|---|
| D1 후퇴/2게이지/모드별 0칸 | §1.1, §7.4, §10.2(빛 자원 분리), §11(R-SETBACK) |
| D2 코어 동사/글로우 OFF/3단 | §4.2, §5.1(discovery), §10 전체 |
| D3 스코프(3챕터/적2/PC우선/보스1페이즈/터치 포스트런치) | §2.2, §6.4, §8.4, §11.2 |
| D4 쿼터뷰+초상 치비 | §4.2(AnimationTree), §10.2(트레일 보완), §12(아트) |
| D5 Godot4/타입세이프/폰트 스파이크 | §1.2, §2.1, §3 전체, §11(R-VER) |
| D6 5대 기둥 | ①§5 ②§7 ③§8 ④§4.1 ⑤§6 |
| D7 속도/그리드/정량화 | §1.2(셀=진실), §6.1, §8.2, §5.6 검증, §11(R-STEALTHGEO) |
| D8 내러티브 정련(PASSIVE/재해석/거짓 비게이트) | §5.1·§5.2, §6.3(PASSIVE) |
| D9 UX/접근성 | §4.1(표기 통일), §7.2(meta), §9.2, §12(토큰) |

## 부록 B. 참고(2026-06 검증)
- 최신 안정판 Godot 4.6.3, 4.6 릴리스 노트, AStarGrid2D·정적 타이핑 문서(2.1·§8.2 근거).
- CJK/HTML5 폰트 이슈: godot#78921(웹 유니코드 미표시), #85597(한글 입력), #17640(로케일 폰트 공백), #77285(폰트 변환), godot-proposals#3766(Han Unification) — §3.1 근거.

---
> 본 문서의 변경은 PR로 관리하고, 확정 결정 변경은 [00_design_review.md](./00_design_review.md)의 의사결정 로그에 append한다.
