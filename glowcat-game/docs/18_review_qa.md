# 18. QA + 기술 리드 리뷰 — 『잊혀진 발자국 / Lost Pawprint』

작성일: 2026-06-03 · 대상: `glowcat-game/game/` (core/data/audio/journal/assets/illust/main) + 검증 하니스 + 빌드 파이프라인
검토 방식: 하니스 4종 실제 실행 + 핵심 소스(main.js / core.js / audio.js / data.js / headless.mjs / build_standalone.py) 정독.

---

## 0. 실행 결과 (실측)

명령: `cd glowcat-game/game && node smoke.mjs; node --test core.test.mjs; node headless.mjs; node verify_standalone.mjs`
환경: Node v22.22.2

| 하니스 | 결과 | 핵심 출력 |
|---|---|---|
| `smoke.mjs` | PASS | `SMOKE OK — 핵심 규칙(수집/후퇴/시야) 정합.` / `전 10스테이지 정합. 조각 합계 61` (스크롤 맵 6종) |
| `core.test.mjs` | PASS | `tests 17 / pass 17 / fail 0` (duration ~296ms) |
| `headless.mjs` | PASS | INPUT/TOUCH/CHAPTER2/SCROLL/ENDING/BRANCH/BOSS/SELECT/RANDOM/HEADLESS 10개 시나리오 OK, `700 프레임 무예외`, `랜덤 100회 가구 관통 0건` |
| `verify_standalone.mjs` | PASS | `인라인 스크립트 7블록, 400프레임 무예외 구동(전역 공유 스코프)` |
| `build_standalone.py` | OK | `ziro_standalone.html (538 KB) | 남은 외부 src: 없음` — 재빌드 후 verify 재통과 |

**결론: 4종 전부 GREEN, 빌드 재현 가능.** 회귀 차단 범위가 넓다(입력·터치·카메라·엔딩 분기·보스·선택메뉴·랜덤배치).

---

## 1. 항목별 점수 (각 /10)

| 항목 | 점수 | 한 줄 평 |
|---|---|---|
| 코드 구조 / 모듈 경계 | **9** | `core.js`는 DOM 무의존 순수함수, 전역+CJS 듀얼 export로 브라우저/Node 양립이 깔끔하다. |
| 테스트 커버리지 | **7** | 규칙·스키마·통합 플로우는 탄탄하나 렌더 no-op·랜덤 "도달성/난이도 공정성"·오디오·저장 마이그레이션이 사각지대. |
| 런타임 견고성 | **9** | 프레임 루프 `try/catch`(main.js:1224), 오디오 전구간 try/catch + `ready()` 폴백, dt 상한 0.05로 탭복귀 폭주 차단. |
| 성능 | **8** | 라이브러리 0, 파티클 ≤24, 글로우는 근접/조건부, 매프레임 `createRadialGradient`은 펄스 중 1~2회뿐 — 캔버스 기준 양호. |
| 에셋 크기 / 로딩 | **6** | standalone 538KB(assets 240KB+illust 88KB base64)를 첫 바이트에 전부 동기 파싱 — 지연로딩/분리 없음. |
| 저장 시스템 안정성 | **7** | try/catch + 타입가드로 손상엔 강하나 버전키만 있고 마이그레이션 경로·손상 복구 로직 부재. |
| 빌드 파이프라인 | **8** | 단순·결정적·`</script>` 이스케이프 처리, 잔여 외부 src 경고까지 — 다만 무결성 해시/최소화 단계 없음. |

**종합: 7.8 / 10** — 출시 가능 수준의 완성도. 남은 리스크는 "치명적 버그"보다 "장기 유지보수·콘텐츠 확장·저사양 로딩" 영역.

---

## 2. 강점 (5)

1. **순수 규칙 모듈 분리**: `core.js`(195~210줄 export)가 Canvas/DOM에 전혀 의존하지 않아 단위 테스트가 쉽고, 동일 로직을 브라우저·Node·standalone 3경로에서 재사용한다.
2. **통합 회귀 하니스의 폭**: `headless.mjs`가 DOM/Image/rAF를 스텁해 main.js의 실제 루프를 돌리며 입력(IME 무관 `e.code`)·터치 조이스틱·가로 스크롤 카메라·엔딩 3분기·보스 해소·스테이지 선택까지 검증 — 브라우저 없이 통합 안정성을 잡는다.
3. **오디오 견고성**: `audio.js`는 `getCtor()`로 미지원 환경 감지, 전 함수 `ready()` 가드 + try/catch, `music()` 전환 시 기존 voice `teardownVoice`로 정리(1063~1068) — 무음 폴백이 throw를 절대 내지 않는다.
4. **랜덤 배치의 도달성 보장(구성 단계)**: `makeLayout`이 스폰 기준 4방향 플러드필(`reachableTiles`, main.js:106)로 만든 풀 위에만 조각을 배치 → 원리적으로 도달 불가 조각이 생기지 않으며, 좁은 맵은 원본 폴백(:118).
5. **결정적·자립형 빌드**: `build_standalone.py`가 7스크립트를 순서대로 인라인해 무서버 단일 HTML을 만들고, `verify_standalone.mjs`가 "브라우저와 동일한 전역 공유 스코프"로 재평가해 이름충돌까지 검출한다.

---

## 3. 약점 / 리스크 (7, 회귀·잠재버그 포함)

1. **랜덤 patrol이 통로를 봉쇄할 잠재성**: `genPatrol`(main.js:129)은 사각 루프의 모서리·변이 `tileFree`인지만 확인할 뿐, 그 루프가 조각/문으로 가는 길을 막는지(=배치 후 전역 도달성)를 재검증하지 않는다. 좁은 복도 맵에서 적이 외길을 영구 점거하면 "통과 불가 + 접촉 누적" 데드락 위험. 현재 어떤 테스트도 *배치 결과*의 도달성을 독립 검증하지 않음(`__layoutCheck`는 겹침만 확인, main.js:1234).
2. **난이도 공정성 자동검증 부재**: 적 밀도·시야콘 면적 대비 자유공간 비율, 안전지대까지의 최단거리 같은 "클리어 가능성/난도" 회귀가 없음. 콘텐츠(data.js) 수정 시 사람이 직접 플레이해야만 난도 폭주를 발견.
3. **저장 마이그레이션·손상 복구 미흡**: `SAVE_KEY="ziro_progress_v1"`(main.js:60)에 버전 문자열은 있으나, 스키마 변경 시 v1→v2 변환 로직이 없다. 손상 값(`clearedMax` 범위 밖, 예: 999)은 타입가드를 통과해 그대로 들어가 메뉴 인덱싱이 어긋날 수 있다(범위 clamp 부재, :61).
4. **거대 base64 동기 로딩**: standalone 538KB 전부를 첫 파싱에 올린다. 모바일·저사양에서 첫 페인트 지연 + 메모리 스파이크. illust(키아트 88KB)는 타이틀/엔딩에서만 쓰이므로 지연로딩 후보지만 현재는 즉시 디코드.
5. **렌더 = no-op 검증**: 두 통합 하니스 모두 ctx를 Proxy로 삼켜 "예외 없음"만 본다. 실제 그려진 픽셀·레이어 순서·글로우 누락·y정렬 역전 같은 시각 회귀는 전혀 못 잡는다(스냅샷/기준이미지 없음).
6. **오디오 스케줄러 누수 가능성**: `music()`의 룩어헤드 `setInterval`(audio.js:1037)은 voice teardown 시 정리되지만, 탭 비가시화(Page Visibility) 처리가 없어 백그라운드에서도 스케줄러가 돈다. 장시간 백그라운드 시 타이밍 드리프트·불필요 연산.
7. **`shake` 중 매프레임 `Math.random()` 카메라 흔들림**: draw 진입마다 `Math.random()` 2회(main.js:614)는 비용은 미미하나, 흔들림이 0일 때도 `Math.max(0,shake)` 계산을 항상 수행 — 핫패스 미세 낭비(가독성>성능 영역). 더 큰 문제는 성능 측정 훅(FPS/프레임타임 카운터)이 아예 없어 회귀를 수치로 못 본다.

---

## 4. 우선순위 개선안

### P0 (출시 전 권장 — 잠재 데드락·데이터 안정성·로딩)

**P0-1. 랜덤 배치 "전역 도달성" 자동검증 테스트 추가**
- 문제: `genPatrol`이 통로를 막아 조각·문이 도달 불가가 될 수 있으나 검증 없음.
- 근거: `makeLayout`/`genPatrol` (main.js:114~141), `__layoutCheck`는 겹침만 본다(main.js:1234).
- 수정/테스트: `__layoutCheck`를 확장해 *배치 후* 스폰→모든 코어 조각·door 까지 플러드필 도달성을 검사(적 patrol 점유 타일을 벽으로 간주하는 보수판 1개 + 무시판 1개). headless.mjs의 RANDOM 루프(1000회)에 `assert(reachAll === true)` 추가. 도달 불가 발생 시 makeLayout이 재시도 또는 원본 폴백하도록 `genPatrol` 결과를 도달성 통과까지 재생성.

**P0-2. 저장 마이그레이션 + 손상/범위 방어**
- 문제: v1 키만 있고 변환·clamp 없음 → 손상값·미래 스키마에서 메뉴 오작동.
- 근거: `loadProgress`/`saveProgress` (main.js:61~62), `SAVE_KEY` (main.js:60).
- 수정/테스트: 로드 시 `clearedMax`를 `[-1, CHAPTERS.length-1]`로 clamp, `version` 필드 도입 + `migrate(old)` 스텁. core 또는 별 모듈에 순수 함수 `parseSave(raw)`를 빼서 단위테스트(정상/JSON깨짐/범위초과/구버전) 4케이스를 `core.test.mjs`에 추가.

**P0-3. 큰 base64 분리 · illust 지연로딩**
- 문제: 538KB 동기 파싱(특히 88KB illust는 타이틀/엔딩 전용).
- 근거: `loadImages`(main.js:28~36)가 즉시 전체 디코드, build ORDER가 illust를 본문에 인라인(build_standalone.py:8).
- 수정/테스트: 비-standalone 배포는 assets/illust를 외부 파일로 두고 `loading`/지연 디코드. illust는 첫 진입(title/ending)에 lazy-load. standalone은 유지하되 illust 블록을 `<script type="application/json">`로 넣고 첫 사용 시 디코드. verify에 "illust 미로드 상태로도 play 400프레임 무예외" 케이스 추가(이미 main이 `ILL` 가드함을 검증).

### P1 (품질·유지보수)

**P1-1. 난이도/공정성 회귀 테스트** — 챕터별 (자유타일 수 / 적 시야콘 합산 면적), (스폰→가장 가까운 안전지대 거리), (코어 최소 이동거리) 지표를 smoke에서 임계로 assert. data.js 수정 시 난도 폭주를 CI에서 차단. 근거: data.js 챕터 정의 + core 규칙 상수(core.js:7~29).

**P1-2. 성능 측정 훅** — frame()에 EWMA 프레임타임/FPS 카운터를 디버그 플래그로 노출(`__perf()`), headless에서 700프레임 평균 update 시간을 기록해 회귀 추적. 근거: `frame`(main.js:1222~1225).

**P1-3. 오디오 Page Visibility 정지** — `document.hidden` 시 스케줄러 일시정지/재개. 근거: `setInterval` 스케줄러(audio.js:1037).

### P2 (선택)

**P2-1. 시각 회귀 스냅샷** — node-canvas로 대표 프레임 PNG 해시 비교(레이어 순서·글로우·y정렬). 현재 렌더 no-op 사각지대 보완.
**P2-2. 빌드 무결성** — build 산출물에 SHA256 + (선택)최소화 단계, `</script>` 외 `<!--` 등 추가 안전치환 점검.
**P2-3. draw 핫패스 정리** — `shake===0`일 때 흔들림 계산/`Math.random()` 스킵(main.js:614).

---

## 5. 총평

핵심 규칙은 순수 모듈로 분리돼 테스트가 견고하고, 통합 하니스가 입력·카메라·엔딩 분기·보스·메뉴까지 실루프로 회귀를 막고 있어 **출시 가능한 안정성(종합 7.8/10)**에 도달했다. 남은 리스크는 버그라기보다 (a) 랜덤 배치의 *결과* 도달성/난도가 코드 구성에만 의존하고 자동검증이 없다는 점, (b) 저장 마이그레이션·손상 방어, (c) 538KB 동기 로딩이다. 위 P0 3건을 처리하면 콘텐츠 확장과 저사양 환경까지 안전해진다.
