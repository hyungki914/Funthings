# 14. 환경 아트 리뷰 & 개선 스펙 — 『잊혀진 발자국 / Lost Pawprint』

대상: `art/pixelart.py` (PIL, 16px 타일, nearest 업스케일, `add_glow`/`add_vignette` 베이크).
원칙 유지: 제한 팔레트 ドット絵 + 네온 블룸 + 비네팅. 플레이어 시안/그린 글로우는 인터랙티브·광원에만.
모든 권고는 **빌드타임 PIL 베이크**로 구현 가능한 경량 기법만 사용 (런타임 셰이더 없음).

---

## A) 진단 — 왜 단조로운가 (이미지 근거)

| 씬 | 관찰된 문제 | 근본 원인 |
|---|---|---|
| **room1/room2 (실내)** | 바닥이 균일한 갈색 한 덩어리, 판자 이음새만 희미. 프롭(침대/책상/옷장)이 납작한 사각형 + 얇은 윗줄 + 바닥 타원 그림자뿐. "따뜻한 침실" 인데 차갑고 칙칙. | 바닥 1.5톤(베이스+이음새)뿐. `_draw_block`이 단색 body + 2px top만. 스테이지 컬러그레이드 없음 → 비네팅 때문에 전부 갈색-회색으로 수렴. |
| **haru_room (슬픔)** | room들과 색·구조 거의 동일, 멜랑콜리 안 읽힘. | carpet 타일도 거의 단색. 청회색 의도지만 그레이드 없어 다른 실내와 구분 약함. |
| **hall2f (무거운 계단)** | 세로로 긴데 깊이감 0, 위·아래가 똑같이 평면. | 원근/스카이라이트 없음. 바닥 wood가 room과 동일 타일 → "복도" 정체성 없음. |
| **arcade (형광등 상가)** | lino 격자는 그나마 낫지만 형광등 느낌 없음, 칸막이(pale 세로블록)가 그냥 회색 막대. | 광원 베이크 없음(차가운 형광 그레이드·천장 라이트 띠 부재). 칸막이에 입체 음영 없음. |
| **yard (아침 첫 외출)** | **하드 세로 경계선**이 화면을 둘로 쪼갬(path 타일 vs dirt 타일 색 점프). 아침 햇살 전무, 흙바닥이 노이즈 점만. 나무=납작한 원 4개 더미, 가로등 빛이 땅에 안 떨어짐. | 바닥/길 전이(blend edge) 없음. 그레이드 없음. `_draw_tree` 평면 ellipse, 방향성 그림자 없음. lamp halo가 바닥에 안 베이크됨. |
| **street (도시 황혼)** | 황혼색 0(전부 회청 아스팔트), 건물 파사드=상단 단색 띠+작은 창문, 깊이 없음. 나무/덤불 평면. | 황혼 블루/퍼플 그레이드 없음. `fence` 보더가 파사드를 1.5타일 띠로만 표현 → 도시감 없음. |
| **park_gate / park (시린 황금 클라이맥스)** | grass가 거의 단색 진녹색, "시린 황금빛" 전무. 분수만 시안으로 떠 있음. 나무 그림자·그늘 얼룩 없어 평면. | 골든 그레이드 없음. 잔디 다톤화 부족. 나무·덤불 방향성 긴 그림자 없음. |
| **blank (공백)** | 의도대로 비어 있음 — OK. 다만 바닥 void가 완전 균일해 살짝 죽어 보임. | 미세 노이즈/소실점 그라데이션 한 겹이면 "공백"이 더 의도적으로 읽힘. |

**공통 3대 원인**: ① 스테이지별 **컬러 그레이드 부재** → 실내·야외·시간대 구분 실패. ② **방향성 그림자 부재**(바닥 AO 타원만) → 깊이 0. ③ **바닥/프롭 다톤화·텍스처 부족** → 평면.

---

## B) 환경별 컬러 스크립트 (스테이지당 1 grade, 베이크)

구현: 씬 RGB 완성 후 `add_glow` **이전**에 그레이드 적용 → 그 다음 `add_glow` → `add_vignette` 순서.
(글로우 추출 임계치를 살리려면 그레이드를 글로우 앞에 둘 것. 단 `screen` 하이라이트 그레이드는 글로우 후가 더 자연스러우면 후처리 가능.)

```python
def grade(rgb, color, alpha, mode='multiply'):
    layer = Image.new('RGB', rgb.size, color)
    if mode == 'multiply': out = ImageChops.multiply(rgb, layer)
    elif mode == 'screen': out = ImageChops.screen(rgb, layer)
    elif mode == 'overlay': out = ImageChops.overlay(rgb, layer)
    return Image.blend(rgb, out, alpha)   # alpha=강도
```

| 스테이지 | 무드 | grade RGB | alpha | mode | 의도 |
|---|---|---|---|---|---|
| **room1** | 따뜻한 침실 | `(255, 196, 138)` | 0.30 | multiply | 앰버 텅스텐 전구, 갈색을 따뜻하게 |
| **room2** | 거실(중립 따뜻) | `(255, 214, 170)` | 0.22 | multiply | 생활감, 약한 웜 |
| **haru_room** | 멜랑콜리·슬픔 | `(120, 140, 196)` | 0.34 | multiply | 차가운 청보라 + 채도 down(아래 참고) |
| **hall2f** | 무거운 계단 | `(96, 104, 132)` | 0.40 | multiply | 무겁고 어두운 청회, 압박감 |
| **arcade** | 형광등 상가 | `(206, 222, 230)` | 0.30 | screen | 차갑고 균일한 형광 화이트, 약간 들뜸 |
| **yard** | 아침 첫 외출 | `(255, 206, 150)` | 0.30 | screen | 따뜻한 아침 앰버, 화면 들어올림 |
| **street** | 도시 황혼·그리움 | `(86, 78, 150)` | 0.42 | multiply | 황혼 블루/퍼플, 하단부만 앰버(아래) |
| **park_gate** | 관문 | `(168, 158, 110)` | 0.30 | overlay | 시린 골드 진입, 대비 살짝 ↑ |
| **park** | 클라이맥스·시린 황금 | `(214, 188, 120)` | 0.38 | overlay | 시린 황금빛, 빛-그림자 대비 강조 |
| **blank** | 텅 빈 공백 | `(40, 44, 58)` | 0.30 | multiply | 더 깊은 무채 공백(현 유지 + 미세 down) |

**보강 그레이드(권장 추가 1줄):**
- **haru_room**: multiply 후 `desaturate` — `g=rgb.convert('L').convert('RGB'); rgb=Image.blend(rgb,g,0.35)` 로 채도 35%↓ (슬픔 = 탈색).
- **street/park 수직 라이트 분리**: 상단=cool, 하단=warm 의 **세로 그라디언트 그레이드**(아래 E-1) 추가로 "황혼 하늘→따뜻한 가로등 지면" 분리.

---

## C) 타일 재설계 (16px, 픽셀 단위)

공통 규칙: 각 타일 **최소 3톤**(dk/base/lt) + 좌상 1px 라이트림 / 우하 1px 섀도림 → 16px 안에서도 입체.
variant는 패턴 위치만 바꿔 반복 티 제거(현 구조 유지).

| 타일 | 현재 | 재설계 (픽셀) |
|---|---|---|
| **grass** | base+점 6개 | 4톤(`#1c2e1e/#243a26/#2e4a2e/#3a5a38`). 2x2 디더 패치 3~4개(밝은 잔디 무리), 잔디날 픽셀에 **세로 2px**(상=lt, 하=dk)로 입체. variant마다 한 칸에 **꽃 1점**(노랑 `#e6d24a` 또는 흰 `#e8eef0`) 30% 확률 위치. |
| **dirt** | base+점 | 3톤 흙 + **자갈**: 2x2 밝은 회갈(`#9a8460`) 2개 + 그 우하 1px dk. 군데군데 1px 풀싹(`#3a5a38`). 좌우 타일 경계가 안 튀게 base를 grass와 중간톤으로. |
| **asphalt** | base+점 | 3톤 + **노면 디테일**: 미세 크랙 1px 라인(dk, 대각 3px), 균열 점. variant로 오일 얼룩(2x2 `#3a3c44`). 도로용 별도 `tile_asphalt_lane`: 중앙에 **점선 차선**(노랑 `#c9b24a`, 2px on / 2px off) 한 줄. |
| **cobble (신규)** | — | park_gate 산책로용. 5~6각 셀 패턴: 셀 base `#6a6052`, 셀 사이 grout 1px dk `#3c352b`, 각 셀 좌상 1px lt. 자연석 느낌으로 path 대체 추천. |
| **wood** | 2톤+이음새 | **널결(grain)** 추가: 판자 내부에 1px 가는 결 라인 2~3개(base±8), 옹이는 타원 2px(dk 코어+lt 림). 판자 폭 5px 유지하되 이음새를 dk+상단 lt 2픽셀로 깊게. 실내 따뜻 톤은 grade가 처리. |
| **carpet** | 단색+점 | 직물 텍스처: 2px 간격 미세 도트 디더(base/lt 교차)로 파일감. 가장자리 타일은 **베이스보드/굽도리**(상단 2px `#2a2630`)로 벽 접합 표현. haru는 청회 유지. |
| **lino** | 격자 OK | 셀 안에 **반사 하이라이트** 1px 대각선(`#9a9ca4`) → 매끈한 광택. grout는 현 유지. 형광 그레이드와 조합 시 상가다움 ↑. |
| **void** | 단색 | 미세 노이즈 1톤(`#0d0e14`↔`#0a0b10` 5% 디더) + 중앙→가장자리 아주 약한 라디얼 어둠. "의도된 공백". |

추가: **전이 타일(edge blend)** — 길/잔디, 흙/잔디 경계에 `tile_grass_edge`(한쪽 절반 grass, 반대쪽으로 2~3px 디더 침범)로 yard의 하드 세로선 제거. (E-4)

---

## D) 오브젝트 재설계 (레이어드 음영 + 방향성 긴 그림자)

전역: **광원을 좌상(NW)으로 통일** → 모든 프롭 우하단에 방향성 그림자, 좌상 하이라이트. 깊이 일관성.

### D-0. 방향성 긴 그림자 베이크 (핵심 기법, 모든 프롭 공통)
바닥 AO 타원 대신/추가로 **기울어진 캐스트 섀도**:
```python
def cast_shadow(sh_draw, x0, y1, w, dx=0.6, length=10):
    # 프롭 밑면(x0..x0+w, y1)에서 우하(South-East)로 평행사변형 그림자
    pts = [(x0, y1), (x0+w, y1),
           (x0+w+int(length*dx), y1+length), (x0+int(length*dx), y1+length)]
    sh_draw.polygon(pts, fill=(0,0,0,70))
# sh 레이어 전체 GaussianBlur(1.5) 후 alpha_composite → 부드러운 긴 그림자
```
야외(yard/street/park)는 `length=14~18`, 실내는 `length=8`로. 블러 1~2px로 픽셀 경계 살짝만 풀기.

| 프롭 | 현재 | 재설계 |
|---|---|---|
| **tree** | 평면 ellipse 4개 더미 | 잎 덩이를 **3톤 클러스터**: 하단 그림자엽(`#1e3a22`) → 베이스(`#2e6a36`) → 좌상 하이라이트엽(`#4a9a52`, NW 작은 원 2개). 줄기에 1px 세로 결 + 우측 1px dk. 땅에 **타원 그늘 얼룩**(아래 E-2) + cast_shadow length=16. |
| **bush** | 단색 ellipse 3겹 | 2톤(base+lt 상단 캡) + 하단 1px dk 라인. cast_shadow length=10. 가장자리에 잎 들쭉(1px 돌출 4~5개)으로 실루엣 깨기. |
| **fountain** | 외륜+시안 물 | 림: 외곽 dk → 림 base → 좌상 lt 1px(돌 입체). 물: 시안에 **동심 1px 링** 2개(`#3aa0b0`) + 중앙 글로우 하이라이트(현 유지). 림에 cast_shadow + 수면 위 흰 점 2~3개(반짝). |
| **lamp (가로등)** | 막대+밝은 원 | 기둥 3px(좌 lt/우 dk), 갓(1px 캡). 전구 글로우는 유지하되 **지면 헤일로**(E-3) 베이크 필수 — 지금은 빛이 공중에 뜸. |
| **building 파사드 (street fence)** | 상단 단색 띠+작은 창 | **다층 파사드**: 벽 base `#3a3c46` + 층 구분 1px 라인. 창문 = 프레임(dk) + 유리(`#4a5a70`) + 일부 창 **불 켜짐**(웜 `#d8b46a` 30%, 글로우 후보). 차양/간판 1~2개(웜/시안 작은 사각). 하단에 보도-벽 접합 그림자 2px. |
| **streetlight (도로변)** | lamp 재사용 | lamp와 동일하되 길이 긴 기둥(5px↑) + **원뿔형 지면 라이트풀**(E-3, 세로로 긴 타원 웜). |
| **flowerbed (신규, yard/park)** | — | 흙 base 위 꽃 점 클러스터(노랑/흰/연보라 1px, 6~8개) + 잎 dk. 작은 면적이라 가성비 높은 야외 디테일. |
| **bed/sofa/desk/fridge (실내 block)** | 단색+top 2px | `_draw_block` 강화: ① 좌상 1px 하이라이트 엣지 ② 우하 2px 섀도 엣지 ③ 종류별 디테일 1~2픽셀 — 침대=베개 줄무늬, 소파=쿠션 심, 냉장고=손잡이+문선(현 일부 존재, 표준화). |

---

## E) 야외 분위기 연출 (우선 — 가성비 순)

### E-1. 스카이라이트 세로 그라디언트 (야외 전 씬)
씬 위에 **세로 그라디언트 오버레이** 1장:
```python
def skylight(rgb, top, bot, alpha=0.5, mode='screen'):
    W,H=rgb.size; grad=Image.new('RGB',(1,H))
    for y in range(H):
        t=y/H
        grad.putpixel((0,y), tuple(int(top[i]*(1-t)+bot[i]*t) for i in range(3)))
    grad=grad.resize((W,H))
    blended = ImageChops.screen(rgb,grad) if mode=='screen' else ImageChops.multiply(rgb,grad)
    return Image.blend(rgb, blended, alpha)
```
- **yard**: top `(70,60,40)` → bot `(120,96,60)` screen — 위 그늘, 아래 아침 햇살 바닥.
- **street**: top `(60,54,110)` 황혼 보라 → bot `(120,90,70)` 웜 — 하늘→가로등 지면.
- **park**: top `(60,80,60)` → bot `(150,130,80)` 시린 골드 바닥 빛.

### E-2. 나무 그늘 얼룩 (dappled shade)
나무 잎 덩이 **바로 아래 지면**에 부드러운 어두운 타원 + 그 위 잎 사이 햇빛 점(라이트 디더):
```python
shade = Image.new('RGBA', size, (0,0,0,0)); sd=ImageDraw.Draw(shade)
sd.ellipse((cx-R, cy-R//2, cx+R, cy+R//2), fill=(10,20,12,90))  # 그늘
shade = shade.filter(GaussianBlur(2))
# 그 위 햇빛 얼룩: 밝은 1px 점 5~6개 (warm) 산포
```
park/yard/street 나무 전부 적용 → 평면 → 입체 전환의 핵심.

### E-3. 가로등 지면 헤일로 / 라이트풀
전구 아래 지면에 **웜 라디얼 글로우**를 baked (screen):
```python
halo = Image.new('RGB', size, (0,0,0)); hd=ImageDraw.Draw(halo)
hd.ellipse((lx-22, ly+6, lx+22, ly+40), fill=(120,120,60))  # 세로 타원 풀
halo = halo.filter(GaussianBlur(8)); rgb = ImageChops.screen(rgb, halo)
```
→ 빛이 땅에 닿아 "안전지대"가 시각적으로 읽힘. 색은 가로등은 웜, 분수/조각은 시안 유지.

### E-4. 길/잔디 가장자리 전이 (yard 하드선 제거)
path/grass 경계 타일을 **디더 전이**로: 경계 1열에 두 타일을 50/50 체커 디더, 그 안쪽 1열 25% 침범 → 부드러운 흙길 가장자리. cobble 도입 시 더 자연스러움.

### E-5. 낙엽 더미 / 산포 디테일 (park·street)
지면에 **낙엽 클러스터**: 웜(`#a8702c`/`#c98a3a`/`#8a5a24`) 1~2px 점 8~12개를 나무 주변·구석에 산포 + 작은 cast_shadow. 런타임 낙엽 파티클과 톤 매칭 → 정지·이동 모두 자연.

### E-6. 미세 안개/심도 (street·park 깊은 곳)
상단 1/3에 아주 옅은 안개 띠(씬색+`(40,46,70)` screen alpha 0.12) → 원경 후퇴감. 비네팅과 겹치지 않게 약하게.

---

## F) 우선순위 TOP 8 (임팩트/노력)

| # | 작업 | 임팩트 | 노력 | 적용 범위 |
|---|---|---|---|---|
| **1** | **스테이지별 컬러 그레이드**(B 표) — `grade()` 1함수 + export 시 stage→grade 매핑 | ★★★★★ | 저 | 전 씬 (실내외·시간대 즉시 분리) |
| **2** | **스카이라이트 세로 그라디언트**(E-1) | ★★★★★ | 저 | yard/street/park/park_gate |
| **3** | **방향성 긴 그림자 `cast_shadow`**(D-0) — AO 타원 대체 | ★★★★☆ | 저~중 | 전 프롭(특히 야외) |
| **4** | **가로등/광원 지면 헤일로**(E-3) | ★★★★☆ | 저 | lamp/fountain/shard 자리 |
| **5** | **나무·덤불 3톤 + 그늘 얼룩**(D tree/bush + E-2) | ★★★★☆ | 중 | yard/street/park |
| **6** | **바닥 타일 다톤화**(C: grass/dirt/asphalt/wood 3톤+텍스처) + **yard 전이 타일**(E-4) | ★★★★☆ | 중 | 전 씬 바닥 |
| **7** | **building 파사드 다층화 + 불 켜진 창**(D building) | ★★★☆☆ | 중 | street(도시감) |
| **8** | **`_draw_block` 입체화**(좌상 라이트/우하 섀도 엣지 + 종류별 1px 디테일) + haru 채도↓ | ★★★☆☆ | 저~중 | 실내 전반 |

권장 구현 순서: **1→2→3→4** 로 "분위기·깊이"의 80%를 저비용에 확보 → 이후 **5→6** 디테일 → **7→8** 마감.
주의: 그레이드/스카이라이트는 `add_glow` **앞**, 헤일로는 글로우 친화적이므로 글로우 전 screen, 최종 `add_vignette` 유지. 글로우 임계치(b·g>150 등)를 깨지 않도록 그레이드 alpha를 표 값 이내로 제한할 것.
