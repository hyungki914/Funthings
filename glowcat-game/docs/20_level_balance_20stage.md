# 상세 문서 ⑳ — 『잊혀진 발자국 / Lost Pawprint』 20스테이지 레벨/밸런스 스펙

> 상위: [GDD.md](../GDD.md) · 스키마: [game/data.js](../game/data.js) · 런타임: [game/main.js](../game/main.js) · 배경: [art/pixelart.py](../art/pixelart.py) SCENE_SPECS
> 기존 10챕터 사이에 신규 10챕터를 끼워 20스테이지로 확장. The Blank 보스는 **ch20 고정 피날레**.
> 본 문서의 모든 필드명·타입은 `DATA.chapterN` 스키마와 1:1. 모든 좌표는 `[col,row]` 0-base, 사각형 `[c,r,w,h]` = cols `c..c+w-1` × rows `r..r+h-1`.

## 0. 엔진/검산 전제 (붙여넣기 전에 반드시 확인)

- `collision` 앞 4개는 **항상 테두리 벽**: `[0,0,COLS,2]`, `[0,ROWS-1,COLS,1]`, `[0,0,1,ROWS]`, `[COLS-1,0,1,ROWS]`. 이후 가구.
- `tileFree` 규칙(main.js): 플레이 영역 = `c∈[1,cols-2]`, `r∈[2,rows-1]`, 그리고 어떤 collision 사각형에도 들지 않음. door는 상단 벽(row1) 안의 '문틈'.
- **런타임 재배치(index>=2, 즉 ch3 이후)**: `makeLayout`가 patrol을 `genPatrol`로 재생성하고 비고정 shard(=`obj` 있거나 비숨김 echo)를 도달가능·안전 타일로 재배치한다. 따라서 **ch1·ch2만 작가 배치 고정**, ch3~20은 "스폰에서 도달 가능한 빈 타일 ≥ shards+8" 만 보장하면 된다. 본 스펙의 shard/patrol 좌표는 ch3 이후 **유효한 시드(폴백)** 값이며 전부 FREE로 검산했다.
- `reachableTiles`(스폰 4방향 플러드필) 결과가 `shards.length + 8` 미만이면 원본 배치로 폴백 → **가구가 스폰 구역을 가두지 말 것**. 모든 스테이지에서 스폰 기준 도달 빈 타일 ≥ (shard 수 + 8) 확보.
- 자원 상수(core.js): `START_MEM=4`, `MEM_MAX=10`, 접촉 -2, CORE_GAIN +2 / ECHO_GAIN +1 / FALSE_HIT -2. **coresNeeded는 전 스테이지 3 유지** — 문 게이트는 항상 코어 3개. 난이도는 적·맵·동선으로만 조절(코어 수를 늘리면 클리어 시간이 비선형으로 늘어 페이싱이 망가짐).
- 스크롤: `rows>14` → 세로, `cols>22` → 가로, 둘 다 22×14 이하 → static. 줌은 22타일 기준 고정이라 맵이 커도 타일 체감 크기는 동일.
- SCENE_SPECS props는 collision과 1:1. 사용 가능한 primitive: `('block',c,r,w,h,material)` material∈{wood,cabinet,shelf,bed,stone,metal,cloth,pale,glass}, `('tree',c,r,w,h)`, `('bush',...)`, `('bench',...)`, `('fountain',...)`, `('lamp',c,r,0,0)`. floor∈{wood,carpet,dirt,asphalt,lino,grass,void}, border∈{wall,hedge,fence,void}. outdoor/paths/path_tile는 야외에서만.

---

## A) 20스테이지 난이도 / 페이싱 커브 (한눈에)

서사 인터리빙: 기존 10챕터(★)는 위치만 재배정, 신규 10챕터(◇)를 사이에 삽입. The Blank는 ch20.

| # | 챕터(locale) | 출처 | cols×rows | 스크롤 | murk×echo | 적 합 | safe | shards(core/echo/false) | branch | 보스 | 난이도 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 지로의 방 | ★ch1 | 22×14 | static | 1×0 | 1 | 1 | 8 (3/4/1) | – | – | 1 |
| 2 | 집 (거실·주방) | ★ch2 | 22×14 | static | 1×1 | 2 | 1 | 6 (3/2/1) | – | – | 2 |
| 3 | 현관·신발장 | ◇ | 22×14 | static | 1×1 | 2 | 2 | 6 (3/2/1) | – | – | 2 |
| 4 | 2층 복도·계단 | ★ch3 | 18×26 | 세로 | 1×1 | 2 | 2 | 6 (3/2/1) | – | – | 3 |
| 5 | 하루의 방 | ★ch4 | 22×14 | static | 0×1 | 1 | 1 | 6 (3/1/2) | ✔ | – | 3 |
| 6 | 집 근처/마당 | ★ch5 | 24×14 | 가로(경계) | 2×1 | 3 | 2 | 6 (3/2/1) | – | – | 3 |
| 7 | 버스정류장 | ◇ | 22×16 | static | 1×2 | 3 | 2 | 6 (3/2/1) | – | – | 3 |
| 8 | 큰길 (대로) | ◇ | 44×14 | 가로 | 2×2 | 4 | 4 | 6 (3/2/1) | ✔ | – | 4 |
| 9 | 길거리 | ★ch6 | 40×14 | 가로 | 2×2 | 4 | 3 | 6 (3/2/1) | ✔ | – | 4 |
| 10 | 골목 (좁은 뒷길) | ◇ | 14×24 | 세로 | 1×2 | 3 | 2 | 6 (3/2/1) | – | – | 4 |
| 11 | 근처 상가 | ★ch7 | 24×16 | static | 1×3 | 4 | 2 | 6 (3/3/0) | – | – | 4 |
| 12 | 병원 가는 길 | ◇ | 22×26 | 세로 | 2×1 | 3 | 3 | 6 (3/2/1) | – | – | 4 |
| 13 | 병원 앞 (광장) | ◇ | 26×16 | 가로(경계) | 2×2 | 4 | 2 | 6 (3/2/1) | ✔ | – | 5 |
| 14 | 옥상 (대피 통로) | ◇ | 20×22 | 세로 | 2×2 | 4 | 2 | 6 (3/2/1) | – | – | 5 |
| 15 | 공원 입구 | ★ch8 | 22×16 | static | 2×1 | 3 | 1 | 6 (3/2/1) | ✔ | – | 4 |
| 16 | 분수 광장 | ◇ | 26×18 | 가로/세로 | 2×2 | 4 | 2 | 6 (3/2/1) | – | – | 5 |
| 17 | 가로등 길 (해질녘) | ◇ | 36×14 | 가로 | 2×2 | 4 | 3 | 6 (3/2/1) | – | – | 5 |
| 18 | 공원 | ★ch9 | 28×16 | 가로(약간) | 2×2 | 4 | 2 | 6 (3/2/1) | – | – | 5 (peak) |
| 19 | 텅 빈 거리 (새벽) | ◇ | 30×16 | 가로 | 3×2 | 5 | 3 | 6 (3/2/1) | ✔ | – | 5+ (최난) |
| 20 | 빈자리 The Blank | ★ch10 | 16×12 | static | 0×0 | 0 | 0 | 5 (3/1/1) | – | **보스** | 1(서사) |

**적 합계 커브(난이도 곡선):** `1·2·2·2·1·3·3·4·4·3·4·3·4·4·3·4·4·4·5·0`
정규화하면 **완만 상승 → 미들 플래토(3~4) → ch19 단일 피크(5, 3 murk+2 echo) → ch20 보스 강하(0)**. 함정·정적 챕터(5 하루의 방)는 적 수를 일부러 낮춰 서사 호흡을 준다.

**속도/감지 커브(가속):** 적 능력치는 챕터 진행에 따라 단조 증가.
- Murk: `speed 38, sight 3.3, fov 90` (ch1~7) → `speed 40, sight 3.4` (ch8~17) → **`speed 42, sight 3.5`** (ch18~19 climax). 초기 가르침 구간은 38/3.3, 클라이맥스만 42/3.5.
- Echo: `speed 34~36, hear 3.6` (초·중반) → `speed 38, hear 3.7` (ch13~17) → **`speed 38, hear 3.8`** (ch19). 정적 챕터(5 하루의 방)는 34/3.6으로 가장 느림.
- 세로/좁은 맵(4·10·12·14)의 echo는 hear를 +0.1 올리되 speed는 -2 낮춰 "추격은 느리나 소리가 멀리 닿는" 압박으로 변주.

**safe / false 리듬:** safe `1·1·2·2·1·2·2·4·3·2·2·3·2·2·1·2·3·2·3·0`(긴 가로맵=징검다리 다수). false `1·1·1·1·2·1·1·1·1·1·0·1·1·1·1·1·1·1·1·1`(상가 11은 false 0=순수 소음미로, 하루의 방 5는 false 2=거짓기억 시험).

---

## B) 신규 메커닉/변주 도입 스케줄

각 신규 챕터는 **하나의 기하학적 변주**를 책임진다(복붙 방지).

| 변주 | 담당 신규 챕터 | 핵심 |
|---|---|---|
| 좁은 정적 분기 허브 | 3 현관 | 두 개의 짧은 갈래(신발장/우산꽂이) 중 택해 코어 회수 — 미니 분기 |
| 노출형 정류장(고정 시선) | 7 버스정류장 | echo 2가 벤치열을 왕복, murk가 정면 광고판 시야. "앉아 기다리는 척"=정지 활용 |
| 와이드 추격 회랑 | 8 큰길 | 44칸 최장 가로. 4 징검다리 안전지대로 끊어 달리는 리듬 |
| 세로 압축 미로 | 10 골목 | 14칸 폭 세로. 쓰레기통/실외기 지그재그, 후퇴 불가 외길 |
| 세로 클라임(병원행) | 12 병원 가는 길 | 26행 오르막. 계단참 3개=안전지대 체크포인트, murk 2가 위에서 내려봄 |
| 오픈 플라자 | 13 병원 앞 | 분수+벤치 군집의 개활지. 360° 시선, 커버투커버. 분기(들어갈지) |
| 수직 탈출 옥상 | 14 옥상 | 환기구·물탱크 사이 좁은 통로, 가장자리=막다른 길. 4적 입체 포위 |
| 원형 동선 광장 | 16 분수 광장 | 중앙 큰 분수를 도는 순환 동선. 적이 시계/반시계로 갈려 협공 |
| 황혼 장거리 | 17 가로등 길 | 36칸, 가로등 사이 명암. 빛(Q) 아껴 hidden 점등 vs 노출 트레이드오프 |
| 새벽 텅 빈 거리(최난) | 19 텅 빈 거리 | 엄폐물 최소·murk 3 교차. 직전 최대 압박 후 ch20 해방 |

원칙(기존 계승): **새 기하는 적이 적은 구간에서 먼저 보여주고**(3·7), 다음에서 적과 결합해 시험(8·13·14·19).

---

## C) 신규 챕터 상세 스펙 (붙여넣기용 collision/shard/patrol + SCENE_SPECS)

> 아래 좌표는 전부 FREE 검산 완료. ch3 이후는 런타임 재배치되므로 **시드/폴백**으로 유효하면 충분하다.
> 공통 단축키 `CTRL`, 라벨 `LBL`(이름공개 전)/`LBLN`(후) 재사용.

### ch3 — 현관·신발장 (`DATA.chapter_entry`, bgKey `entryway`)
```js
{ tile:16, cols:22, rows:14, scale:4, bgKey:'entryway', title:'현관', music:'house', ambient:'dust', controls:CTRL,
  spawn:[11,12], coresNeeded:3,
  collision:[
    [0,0,22,2],[0,13,22,1],[0,0,1,14],[21,0,1,14],
    [2,3,4,2],    // 신발장(좌상)
    [16,3,4,2],   // 우산꽂이+선반(우상)
    [9,6,4,2],    // 중앙 콘솔 테이블
    [2,9,3,2],    // 좌하 수납 벤치
    [17,9,3,2]    // 우하 코트걸이 박스
  ],
  safeZones:[[2,6,2,1],[18,7,2,1]],
  door:{ tile:[11,1], requires:'cores' },
  shards:[
    { id:'c_ent_shoe', type:'core', tile:[4,6], radius:1.3, identitySlot:1, obj:'shoe',
      recall:'현관에 가지런한 신발 한 켤레. 하루가 매일 신고 나갔다 — 그날만, 짝이 흐트러진 채였다.' },
    { id:'c_ent_leash', type:'core', tile:[18,6], radius:1.3, identitySlot:2, obj:'leash',
      recall:'벽에 걸린 산책 줄. 내 것이다. 이걸 보면 늘 꼬리가 먼저 일어섰다.' },
    { id:'c_ent_mat', type:'core', tile:[11,9], radius:1.3, identitySlot:3,
      recall:'문 앞 매트. 하루의 발과 내 발이 같이 닦이던 자리. 흙냄새 끝에 늘 집냄새가 났다.' },
    { id:'e_ent_umbrella', type:'echo', tile:[15,11], radius:1.2, identitySlot:null, obj:'umbrella',
      recall:'마르지 않은 우산 하나. 급히 나가느라 펴둔 채였다.' },
    { id:'e_ent_key', type:'echo', tile:[6,11], radius:1.2, hidden:true, identitySlot:null,
      recall:'열쇠고리 하나가 떨어져 있다. 하루의 손에서 미끄러진 듯.' },
    { id:'f_ent', type:'false', tile:[13,4], radius:1.3, identitySlot:null,
      recall:'현관문이 열리며 하루가 들어선다 — 그런데 신발 소리가 나지 않고, 그림자도 없다. 이건… 진짜가 아니야.' }
  ],
  murks:[{ id:'m_ent', patrol:[[8,3],[13,3],[13,5],[8,5]], speed:38, sightTiles:3.3, fovDeg:90 }],
  echoes:[{ id:'e_ent', patrol:[[15,9],[19,9],[19,11],[15,11]], speed:36, hearTiles:3.6 }],
  identityLabels:LBL, branch:null,
  epiphany:['집과 바깥의 경계, 현관.','하루는 여기서 늘 나를 돌아보고 나갔다.','그날의 신발만, 짝이 어긋나 있었다.','문 너머로, 나는 처음 발을 내딛는다.'] }
```
**SCENE_SPECS:** `'entryway': dict(cols=22, rows=14, floor='wood', border='wall', props=[('block',2,3,4,2,'cabinet'),('block',16,3,4,2,'shelf'),('block',9,6,4,2,'wood'),('block',2,9,3,2,'wood'),('block',17,9,3,2,'cabinet'),('lamp',11,3,0,0)])`
**distinct:** 두 짧은 갈래(신발장/우산꽂이) 사이 미니 선택 동선 + 단일 echo의 부드러운 청각 복습.

### ch7 — 버스정류장 (`DATA.chapter_busstop`, bgKey `busstop`)
```js
{ tile:16, cols:22, rows:16, scale:4, bgKey:'busstop', title:'버스정류장', music:'town', ambient:'leaves', controls:CTRL,
  spawn:[11,14], coresNeeded:3,
  collision:[
    [0,0,22,2],[0,15,22,1],[0,0,1,16],[21,0,1,16],
    [3,3,5,2],    // 정류장 쉘터 지붕 기둥
    [14,3,5,2],   // 광고판(murk 정면 시야 기준물)
    [9,7,4,1],    // 중앙 긴 벤치열
    [3,10,3,2],   // 좌하 화단
    [16,10,3,2]   // 우하 자판기
  ],
  safeZones:[[9,9,2,1],[18,5,2,1]],
  door:{ tile:[11,1], requires:'cores' },
  shards:[
    { id:'c_bus_sign', type:'core', tile:[16,5], radius:1.3, identitySlot:2,
      recall:'정류장 노선도. 하루가 손가락으로 짚으며 "여기서 갈아타" 하던 그 정류장.' },
    { id:'c_bus_bench', type:'core', tile:[11,9], radius:1.3, identitySlot:1,
      recall:'둘이 버스를 기다리던 벤치. 나는 늘 하루의 발치에 몸을 말았다.' },
    { id:'c_bus_step', type:'core', tile:[5,11], radius:1.3, identitySlot:3,
      recall:'정류장 바닥의 작은 발자국. 버스가 설 때마다 한 발 앞으로 나가던 버릇.' },
    { id:'e_bus_ticket', type:'echo', tile:[7,5], radius:1.2, identitySlot:null, obj:'ticket',
      recall:'구겨진 버스표 한 장. 하루의 외투 주머니에서 떨어진 것.' },
    { id:'e_bus_glove', type:'echo', tile:[18,11], radius:1.2, hidden:true, identitySlot:null,
      recall:'벤치 밑 장갑 한 짝. 추운 날 하루가 끼던 것.' },
    { id:'f_bus', type:'false', tile:[12,4], radius:1.3, identitySlot:null,
      recall:'버스가 서고 하루가 손짓하며 내린다 — 그런데 문이 열리는 소리가 없다. 이건… 진짜가 아니야.' }
  ],
  murks:[{ id:'m_bus', patrol:[[14,5],[18,5],[18,7],[14,7]], speed:38, sightTiles:3.4, fovDeg:90 }],
  echoes:[
    { id:'e_bus_1', patrol:[[6,8],[12,8],[12,10],[6,10]], speed:36, hearTiles:3.6 },
    { id:'e_bus_2', patrol:[[12,12],[17,12],[17,13],[12,13]], speed:36, hearTiles:3.6 }
  ],
  identityLabels:LBL, branch:null,
  epiphany:['버스를 기다리던 정류장.','함께 어딘가로 떠나던 출발점이었다.','이제 나 혼자, 같은 자리에 선다.','그래도 어느 버스 끝엔, 하루가 있을 것 같다.'] }
```
**SCENE_SPECS:** `'busstop': dict(cols=22, rows=16, floor='asphalt', border='fence', outdoor=True, path_tile='sidewalk', paths=[(1,8,20,2)], props=[('block',3,3,5,2,'metal'),('block',14,3,5,2,'cloth'),('bench',9,7,4,1),('bush',3,10,3,2),('block',16,10,3,2,'metal'),('lamp',5,9,0,0),('lamp',17,9,0,0)])`
**distinct:** echo 2가 벤치열을 직선 왕복 → "앉아 기다리는 척(정지)"으로 소음 0 만들어 통과하는 정지-타이밍 챕터.

### ch8 — 큰길 (대로) (`DATA.chapter_avenue`, bgKey `avenue`)
```js
{ tile:16, cols:44, rows:14, scale:4, bgKey:'avenue', title:'큰길', music:'dusk', ambient:'leaves', controls:CTRL,
  spawn:[2,7], coresNeeded:3,
  collision:[
    [0,0,44,2],[0,13,44,1],[0,0,1,14],[43,0,1,14],
    [6,3,4,2],[6,9,4,2],     // 가로수+화단 쌍1
    [15,4,4,2],[16,9,3,2],   // 정류장 박스 + 벤치
    [24,3,4,2],[25,9,3,2],   // 가로수 쌍2
    [34,4,4,2],[34,9,4,2]    // 상가 차양 + 주차
  ],
  safeZones:[[12,6,2,1],[21,6,2,1],[30,6,2,1],[38,6,2,1]],
  door:{ tile:[42,1], requires:'cores' },
  shards:[
    { id:'c_av_cross', type:'core', tile:[10,11], radius:1.3, identitySlot:2,
      recall:'넓은 횡단보도. 하루는 늘 내 앞을 막아서며 신호를 기다렸다.' },
    { id:'c_av_walk', type:'core', tile:[22,7], radius:1.3, identitySlot:1,
      recall:'대로의 두 줄 발자국. 사람의 보폭과 나의 보폭이 끝까지 나란하다.' },
    { id:'c_av_light', type:'core', tile:[39,11], radius:1.3, identitySlot:3,
      recall:'대로 끝 신호등. 파란불이 켜질 때마다 하루는 내 이름을 불렀다.' },
    { id:'e_av_bag', type:'echo', tile:[18,11], radius:1.2, identitySlot:null, obj:'bag',
      recall:'길에 떨어진 장바구니. 하루가 자주 들던 것.' },
    { id:'e_av_scarf', type:'echo', tile:[31,11], radius:1.2, hidden:true, identitySlot:null,
      recall:'가로수에 걸린 목도리 한 장. 바람에 오래 흔들렸다.' },
    { id:'f_av', type:'false', tile:[27,4], radius:1.3, identitySlot:null,
      recall:'저 앞에서 하루가 손짓한다 — 다가갈수록 횡단보도가 끝없이 늘어난다. 이건… 진짜가 아니야.' }
  ],
  murks:[
    { id:'m_av_1', patrol:[[9,6],[16,6],[16,8],[9,8]], speed:40, sightTiles:3.4, fovDeg:90 },
    { id:'m_av_2', patrol:[[28,6],[37,6],[37,8],[28,8]], speed:40, sightTiles:3.4, fovDeg:90 }
  ],
  echoes:[
    { id:'e_av_1', patrol:[[18,11],[24,11],[24,12],[18,12]], speed:36, hearTiles:3.6 },
    { id:'e_av_2', patrol:[[31,11],[38,11],[38,12],[31,12]], speed:36, hearTiles:3.6 }
  ],
  identityLabels:LBL,
  branch:{ q:'끝이 보이지 않는 큰길. 나는 어느 쪽 걸음으로 걸을까.', options:[
    { label:'끝까지 달린다', sub:'길이 길수록 더 빨리.', feedback:'네 발에 바람이 붙는다.' },
    { label:'그늘을 따라 간다', sub:'천천히, 들키지 않게.', feedback:'가로수 그늘을 한 칸씩 짚는다.' } ] },
  epiphany:['도시의 대로. 차도, 사람도 무심히 흐른다.','그 흐름 속에서 옆자리만 비어 있다.','길이 넓어도, 함께 걷던 폭은 좁았다.','이 끝 어딘가, 하루가 있다면 나는 달리겠다.'] }
```
**SCENE_SPECS:** `'avenue': dict(cols=44, rows=14, floor='asphalt', border='fence', outdoor=True, path_tile='sidewalk', paths=[(1,6,42,2)], props=[('tree',6,3,4,2),('bush',6,9,4,2),('block',15,4,4,2,'metal'),('bench',16,9,3,2),('tree',24,3,4,2),('bush',25,9,3,2),('block',34,4,4,2,'cloth'),('block',34,9,4,2,'metal'),('lamp',12,6,0,0),('lamp',21,6,0,0),('lamp',30,6,0,0),('lamp',38,6,0,0)])`
**distinct:** 44칸 최장 가로 추격 회랑. 4개 징검다리 안전지대로 "달리고-숨고" 리듬 + 분기(달리기/그늘).

### ch10 — 골목 (좁은 뒷길) (`DATA.chapter_alley`, bgKey `alley`)
```js
{ tile:16, cols:14, rows:24, scale:4, bgKey:'alley', title:'골목', music:'dusk', ambient:'dust', controls:CTRL,
  spawn:[7,22], coresNeeded:3,
  collision:[
    [0,0,14,2],[0,23,14,1],[0,0,1,24],[13,0,1,24],
    [1,4,3,2],    // 좌상 실외기
    [9,5,3,2],    // 우상 쓰레기통 더미
    [4,9,3,2],    // 중앙상 적치물(지그재그)
    [8,12,3,2],   // 중앙하 박스더미
    [1,16,3,2],   // 좌하 자전거
    [9,17,3,2]    // 우하 화분 줄
  ],
  safeZones:[[6,8,2,1],[6,15,2,1]],
  door:{ tile:[7,1], requires:'cores' },
  shards:[
    { id:'c_al_paw', type:'core', tile:[7,19], radius:1.3, identitySlot:2,
      recall:'좁은 골목 흙바닥의 발자국. 하루의 뒤를 바짝 따라 걷던 길.' },
    { id:'c_al_wall', type:'core', tile:[6,11], radius:1.3, identitySlot:3,
      recall:'담벼락에 긁힌 자국. 둘이 비를 피해 잠시 붙어 섰던 자리.' },
    { id:'c_al_light', type:'core', tile:[7,6], radius:1.3, identitySlot:1,
      recall:'골목 끝 작은 불빛. 그 불빛을 향해, 우리는 늘 집으로 돌아갔다.' },
    { id:'e_al_can', type:'echo', tile:[3,14], radius:1.2, identitySlot:null, obj:'can',
      recall:'굴러다니는 빈 깡통. 발에 차일 때마다 하루가 웃었다.' },
    { id:'e_al_box', type:'echo', tile:[11,10], radius:1.2, hidden:true, identitySlot:null,
      recall:'젖은 종이상자 한 칸. 길고양이들이 몸을 누이던 자리.' },
    { id:'f_al', type:'false', tile:[7,3], radius:1.3, identitySlot:null,
      recall:'골목 끝에서 하루가 손짓한다 — 다가가면 벽만 차갑게 서 있다. 이건… 진짜가 아니야.' }
  ],
  murks:[{ id:'m_al', patrol:[[5,5],[8,5],[8,8]], speed:40, sightTiles:3.4, fovDeg:90 }],
  echoes:[
    { id:'e_al_1', patrol:[[4,11],[4,15]], speed:34, hearTiles:3.7 },
    { id:'e_al_2', patrol:[[9,15],[9,19]], speed:34, hearTiles:3.7 }
  ],
  identityLabels:LBL, branch:null,
  epiphany:['도시의 등 뒤, 좁은 골목.','여기선 숨을 곳도 도망칠 곳도 적다.','그래도 이 길 끝엔 늘 집으로 가는 불빛이 있었다.','한 칸씩, 나는 그 불빛으로 오른다.'] }
```
**SCENE_SPECS:** `'alley': dict(cols=14, rows=24, floor='asphalt', border='wall', props=[('block',1,4,3,2,'metal'),('block',9,5,3,2,'metal'),('block',4,9,3,2,'wood'),('block',8,12,3,2,'wood'),('block',1,16,3,2,'metal'),('bush',9,17,3,2),('lamp',7,5,0,0),('lamp',7,18,0,0)])`
**distinct:** 폭 14의 세로 미로. echo는 느리지만 hear 3.7 직선 왕복 → 소음이 좁은 통로를 가득 채워 "정지로 끊어 가기" 강제.

### ch12 — 병원 가는 길 (`DATA.chapter_toclinic`, bgKey `toclinic`)
```js
{ tile:16, cols:22, rows:26, scale:4, bgKey:'toclinic', title:'병원 가는 길', music:'haru', ambient:'leaves', controls:CTRL,
  spawn:[11,24], coresNeeded:3,
  collision:[
    [0,0,22,2],[0,25,22,1],[0,0,1,26],[21,0,1,26],
    [2,4,4,2],[16,4,4,2],    // 상단 가로수 쌍
    [8,7,5,2],               // 계단참1 난간
    [2,11,3,2],[17,11,3,2],  // 중단 화단 쌍
    [8,15,6,2],              // 계단참2 난간
    [3,19,4,2],[15,19,4,2]   // 하단 벤치/표지판
  ],
  safeZones:[[9,9,2,1],[9,17,2,1],[9,22,2,1]],
  door:{ tile:[11,1], requires:'cores' },
  shards:[
    { id:'c_cl_path', type:'core', tile:[11,21], radius:1.3, identitySlot:2,
      recall:'병원으로 오르던 길. 그날, 구급차의 불빛이 이 길을 붉게 적셨다.' },
    { id:'c_cl_rail', type:'core', tile:[4,13], radius:1.3, identitySlot:3,
      recall:'난간을 붙잡던 손자국. 누군가 급히 뛰어 오른 자리.' },
    { id:'c_cl_sign', type:'core', tile:[18,6], radius:1.3, identitySlot:1, obj:'sign',
      recall:'표지판: ←병원. 하루가 실려 간 방향을, 나는 뒤늦게 따라간다.' },
    { id:'e_cl_petal', type:'echo', tile:[6,11], radius:1.2, identitySlot:null, obj:'petal',
      recall:'길에 떨어진 꽃잎. 누군가 두고 간 작은 꽃다발에서.' },
    { id:'e_cl_button', type:'echo', tile:[16,15], radius:1.2, hidden:true, identitySlot:null,
      recall:'길에 떨어진 단추. 급히 오르던 외투에서 떨어진 듯.' },
    { id:'f_cl', type:'false', tile:[11,4], radius:1.3, identitySlot:null,
      recall:'길 위에서 하루가 멀쩡히 손을 흔든다 — 그런데 구급차 소리가 그 위로 자꾸 겹친다. 이건… 진짜가 아니야.' }
  ],
  murks:[
    { id:'m_cl_1', patrol:[[3,5],[6,5],[6,7],[3,7]], speed:40, sightTiles:3.4, fovDeg:90 },
    { id:'m_cl_2', patrol:[[16,5],[19,5],[19,7],[16,7]], speed:40, sightTiles:3.4, fovDeg:90 }
  ],
  echoes:[{ id:'e_cl', patrol:[[8,13],[13,13],[13,15],[8,15]], speed:34, hearTiles:3.7 }],
  identityLabels:LBL, branch:null,
  epiphany:['병원으로 오르던 오르막.','그날 이 길을, 붉은 불빛이 가득 메웠다.','한 칸씩 오를 때마다, 그날이 또렷해진다.','무서워도, 나는 끝까지 오른다.'] }
```
**SCENE_SPECS:** `'toclinic': dict(cols=22, rows=26, floor='dirt', border='hedge', outdoor=True, path_tile='cobble', paths=[(9,2,3,23)], props=[('tree',2,4,4,2),('tree',16,4,4,2),('block',8,7,5,2,'stone'),('bush',2,11,3,2),('bush',17,11,3,2),('block',8,15,6,2,'stone'),('bench',3,19,4,2),('block',15,19,4,2,'wood'),('lamp',9,9,0,0),('lamp',9,17,0,0)])`
**distinct:** 26행 세로 클라임. 계단참 3 안전지대=체크포인트, murk 2가 위에서 콘을 내리꽂아 "위를 보며 오르는" 압박.

### ch13 — 병원 앞 (광장) (`DATA.chapter_clinicfront`, bgKey `clinicfront`)
```js
{ tile:16, cols:26, rows:16, scale:4, bgKey:'clinicfront', title:'병원 앞', music:'haru', ambient:'leaves', controls:CTRL,
  spawn:[13,14], coresNeeded:3,
  collision:[
    [0,0,26,2],[0,15,26,1],[0,0,1,16],[25,0,1,16],
    [3,3,4,2],[19,3,4,2],    // 상단 화단 쌍
    [11,7,4,3],              // 중앙 분수(큰 커버)
    [4,11,3,2],[19,11,3,2],  // 하단 벤치 쌍
    [10,3,2,2]               // 상단 표지판
  ],
  safeZones:[[5,8,2,1],[20,8,2,1]],
  door:{ tile:[13,1], requires:'cores' },
  shards:[
    { id:'c_cf_door', type:'core', tile:[13,5], radius:1.3, identitySlot:3,
      recall:'병원 정문. 하루가 들어간 그 문. 유리에 비친 건, 기다리는 나뿐이었다.' },
    { id:'c_cf_bench', type:'core', tile:[6,12], radius:1.3, identitySlot:1,
      recall:'정문 앞 벤치. 나는 여기서 오래, 문이 다시 열리기를 기다렸다.' },
    { id:'c_cf_fount', type:'core', tile:[14,10], radius:1.3, identitySlot:2,
      recall:'마른 분수. 물 대신 낙엽이 고였다. 시간이 그만큼 지났다는 뜻이다.' },
    { id:'e_cf_card', type:'echo', tile:[21,12], radius:1.2, identitySlot:null, obj:'card',
      recall:'접수 번호표 한 장. 호명되지 못한 채 바닥에 남았다.' },
    { id:'e_cf_leaf', type:'echo', tile:[8,5], radius:1.2, hidden:true, identitySlot:null,
      recall:'정문 틈에 낀 마른 잎. 아무도 치우지 않은 채.' },
    { id:'f_cf', type:'false', tile:[18,5], radius:1.3, identitySlot:null,
      recall:'정문이 열리고 하루가 걸어 나온다 — 그런데 발이 바닥에 닿지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks:[
    { id:'m_cf_1', patrol:[[6,5],[10,5],[10,8],[6,8]], speed:40, sightTiles:3.4, fovDeg:90 },
    { id:'m_cf_2', patrol:[[16,5],[21,5],[21,8],[16,8]], speed:40, sightTiles:3.4, fovDeg:90 }
  ],
  echoes:[
    { id:'e_cf_1', patrol:[[7,10],[11,10],[11,12],[7,12]], speed:38, hearTiles:3.7 },
    { id:'e_cf_2', patrol:[[15,10],[20,10],[20,12],[15,12]], speed:38, hearTiles:3.7 }
  ],
  identityLabels:LBL,
  branch:{ q:'저 문 안에, 알고 싶지 않은 답이 있을지 모른다.', options:[
    { label:'문 앞으로 간다', sub:'끝까지 확인해야 한다.', feedback:'발끝이 차가운 문턱에 닿는다.' },
    { label:'벤치에서 기다린다', sub:'조금만, 더 기다리면.', feedback:'나는 다시 그 벤치에 몸을 만다.' } ] },
  epiphany:['병원 앞 광장. 사방이 트여 숨을 곳이 없다.','이 문 안으로 하루가 사라졌다.','나는 여기서, 다시 열릴 문을 기다렸다.','이제 그 문 앞으로, 한 발 더 간다.'] }
```
**SCENE_SPECS:** `'clinicfront': dict(cols=26, rows=16, floor='stone', border='fence', outdoor=True, path_tile='cobble', paths=[(1,9,24,2)], props=[('bush',3,3,4,2),('bush',19,3,4,2),('fountain',11,7,4,3),('bench',4,11,3,2),('bench',19,11,3,2),('block',10,3,2,2,'metal'),('lamp',5,8,0,0),('lamp',20,8,0,0)])`
**distinct:** 오픈 플라자. 중앙 분수를 축으로 360° 시선, 엄폐 적음 → 커버투커버 + "들어갈지" 분기.

### ch14 — 옥상 (대피 통로) (`DATA.chapter_rooftop`, bgKey `rooftop`)
```js
{ tile:16, cols:20, rows:22, scale:4, bgKey:'rooftop', title:'옥상', music:'park', ambient:'motes', controls:CTRL,
  spawn:[10,20], coresNeeded:3,
  collision:[
    [0,0,20,2],[0,21,20,1],[0,0,1,22],[19,0,1,22],
    [2,4,3,3],     // 좌상 물탱크
    [14,4,3,3],    // 우상 환기구
    [8,8,4,2],     // 중앙 옥탑 출입구
    [2,12,3,2],    // 좌중 실외기
    [15,12,3,2],   // 우중 안테나 기단
    [8,15,4,2]     // 중하 적치 파이프
  ],
  safeZones:[[9,11,2,1],[9,18,2,1]],
  door:{ tile:[10,1], requires:'cores' },
  shards:[
    { id:'c_rf_sky', type:'core', tile:[10,13], radius:1.3, identitySlot:1,
      recall:'옥상에서 본 하늘. 하루가 가끔 나를 안고 올라와 바람을 쐬어주던 곳.' },
    { id:'c_rf_edge', type:'core', tile:[5,9], radius:1.3, identitySlot:3,
      recall:'난간 너머 도시. 하루가 사라진 방향을, 나는 여기서 멀리 좇았다.' },
    { id:'c_rf_door', type:'core', tile:[15,9], radius:1.3, identitySlot:2,
      recall:'옥탑 문. 끼익 — 바람에 혼자 여닫힌다. 누군가 올라오길 기다리는 것처럼.' },
    { id:'e_rf_dish', type:'echo', tile:[16,11], radius:1.2, identitySlot:null, obj:'dish',
      recall:'옥상에 놓인 작은 밥그릇. 하루가 길고양이를 위해 올려둔 것.' },
    { id:'e_rf_clip', type:'echo', tile:[4,15], radius:1.2, hidden:true, identitySlot:null,
      recall:'빨랫줄 집게 하나. 바람에 오래 흔들렸다.' },
    { id:'f_rf', type:'false', tile:[10,5], radius:1.3, identitySlot:null,
      recall:'난간 끝에 하루가 서 있다 — 그런데 바람에도 옷자락이 흔들리지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks:[
    { id:'m_rf_1', patrol:[[3,5],[6,5],[6,7],[3,7]], speed:40, sightTiles:3.4, fovDeg:90 },
    { id:'m_rf_2', patrol:[[14,8],[17,8],[17,11],[14,11]], speed:40, sightTiles:3.4, fovDeg:90 }
  ],
  echoes:[
    { id:'e_rf_1', patrol:[[8,12],[11,12],[11,14]], speed:34, hearTiles:3.7 },
    { id:'e_rf_2', patrol:[[5,16],[9,16],[9,18]], speed:34, hearTiles:3.7 }
  ],
  identityLabels:LBL, branch:null,
  epiphany:['건물 꼭대기, 바람이 가득한 옥상.','여기서 하루는 나를 안고 도시를 내려다봤다.','이제 나 혼자, 그 방향을 좇는다.','바람 끝에 하루의 냄새가, 아주 옅게 남아 있다.'] }
```
**SCENE_SPECS:** `'rooftop': dict(cols=20, rows=22, floor='stone', border='fence', outdoor=True, props=[('block',2,4,3,3,'metal'),('block',14,4,3,3,'metal'),('block',8,8,4,2,'wood'),('block',2,12,3,2,'metal'),('block',15,12,3,2,'metal'),('block',8,15,4,2,'pale'),('lamp',10,11,0,0),('lamp',10,18,0,0)])`
**distinct:** 수직 탈출 + 입체 포위. 가장자리는 막다른 길이라 중앙 통로를 4적이 교대 봉쇄.

### ch16 — 분수 광장 (`DATA.chapter_plaza`, bgKey `plaza`)
```js
{ tile:16, cols:26, rows:18, scale:4, bgKey:'plaza', title:'분수 광장', music:'park', ambient:'leaves', controls:CTRL,
  spawn:[13,16], coresNeeded:3,
  collision:[
    [0,0,26,2],[0,17,26,1],[0,0,1,18],[25,0,1,18],
    [11,7,4,4],              // 중앙 큰 분수(순환 동선의 축)
    [3,4,3,2],[20,4,3,2],    // 상단 화단 쌍
    [3,12,3,2],[20,12,3,2],  // 하단 화단 쌍
    [11,3,4,1],              // 상단 아치
    [11,14,4,1]              // 하단 벤치열
  ],
  safeZones:[[6,8,2,1],[18,8,2,1]],
  door:{ tile:[13,1], requires:'cores' },
  shards:[
    { id:'c_pz_fount', type:'core', tile:[13,12], radius:1.3, identitySlot:2,
      recall:'광장 분수. 물소리 사이로, 하루가 내 이름을 부르던 메아리가 남아 있다.' },
    { id:'c_pz_arch', type:'core', tile:[13,5], radius:1.3, identitySlot:3,
      recall:'광장 아치문. 둘이 손잡고… 아니, 줄을 잡고 통과하던 문.' },
    { id:'c_pz_bench', type:'core', tile:[8,13], radius:1.3, identitySlot:1,
      recall:'분수 곁 벤치. 비둘기를 쫓다 하루 무릎으로 돌아오던 자리.' },
    { id:'e_pz_coin', type:'echo', tile:[18,9], radius:1.2, identitySlot:null, obj:'coin',
      recall:'분수에 던진 동전 하나. 하루가 무슨 소원을 빌었을까.' },
    { id:'e_pz_feather', type:'echo', tile:[6,6], radius:1.2, hidden:true, identitySlot:null,
      recall:'비둘기 깃털 한 장. 내가 쫓던 그 무리의 것.' },
    { id:'f_pz', type:'false', tile:[19,6], radius:1.3, identitySlot:null,
      recall:'분수 너머로 하루가 손짓한다 — 그런데 물보라에 그 모습이 자꾸 지워진다. 이건… 진짜가 아니야.' }
  ],
  murks:[
    { id:'m_pz_1', patrol:[[5,5],[10,5],[10,8],[5,8]], speed:40, sightTiles:3.4, fovDeg:90 },
    { id:'m_pz_2', patrol:[[16,9],[21,9],[21,12],[16,12]], speed:40, sightTiles:3.4, fovDeg:90 }
  ],
  echoes:[
    { id:'e_pz_1', patrol:[[7,10],[10,10],[10,13],[7,13]], speed:38, hearTiles:3.7 },
    { id:'e_pz_2', patrol:[[16,5],[19,5],[19,8],[16,8]], speed:38, hearTiles:3.7 }
  ],
  identityLabels:LBL, branch:null,
  epiphany:['물소리 가득한 광장.','분수를 돌며 우리는 한 바퀴, 또 한 바퀴 걸었다.','지금은 그 동선을, 나 혼자 돈다.','물소리 사이로 아직, 하루의 목소리가 섞인다.'] }
```
**SCENE_SPECS:** `'plaza': dict(cols=26, rows=18, floor='stone', border='hedge', outdoor=True, path_tile='cobble', paths=[(1,9,24,2),(12,2,2,15)], props=[('fountain',11,7,4,4),('bush',3,4,3,2),('bush',20,4,3,2),('bush',3,12,3,2),('bush',20,12,3,2),('block',11,3,4,1,'stone'),('bench',11,14,4,1),('lamp',6,8,0,0),('lamp',18,8,0,0)])`
**distinct:** 중앙 분수를 도는 순환 동선. murk/echo가 시계·반시계로 갈려 광장 양옆에서 협공.

### ch17 — 가로등 길 (해질녘) (`DATA.chapter_lamplane`, bgKey `lamplane`)
```js
{ tile:16, cols:36, rows:14, scale:4, bgKey:'lamplane', title:'가로등 길', music:'dusk', ambient:'leaves', controls:CTRL,
  spawn:[2,7], coresNeeded:3,
  collision:[
    [0,0,36,2],[0,13,36,1],[0,0,1,14],[35,0,1,14],
    [5,3,3,2],[5,9,3,2],     // 가로수+벤치 쌍1
    [13,4,3,2],[13,9,3,2],   // 화단 쌍
    [21,3,3,2],[21,9,3,2],   // 가로수 쌍2
    [29,4,3,2],[29,9,3,2]    // 가게 차양+화분
  ],
  safeZones:[[10,6,2,1],[18,6,2,1],[26,6,2,1]],
  door:{ tile:[34,1], requires:'cores' },
  shards:[
    { id:'c_ll_lamp', type:'core', tile:[16,7], radius:1.3, identitySlot:3,
      recall:'가로등 불빛. 해질녘마다 하루는 이 불빛 아래에서 내 이름을 불렀다.' },
    { id:'c_ll_walk', type:'core', tile:[9,11], radius:1.3, identitySlot:1,
      recall:'노을에 길어진 두 그림자. 사람의 것과 고양이의 것이 나란했다.' },
    { id:'c_ll_end', type:'core', tile:[31,11], radius:1.3, identitySlot:2,
      recall:'길 끝 모퉁이. 하루가 늘 먼저 돌아 사라지던 곳. 나는 종종거리며 뒤를 쫓았다.' },
    { id:'e_ll_glove', type:'echo', tile:[7,11], radius:1.2, identitySlot:null, obj:'glove',
      recall:'벤치에 놓인 장갑 한 짝. 해질녘 온기가 식어 있다.' },
    { id:'e_ll_leaf', type:'echo', tile:[24,5], radius:1.2, hidden:true, identitySlot:null,
      recall:'가로등에 비친 낙엽 그림자. 바람에 천천히 진다.' },
    { id:'f_ll', type:'false', tile:[19,4], radius:1.3, identitySlot:null,
      recall:'가로등 아래 하루가 손짓한다 — 그런데 불빛이 그 몸을 통과해 버린다. 이건… 진짜가 아니야.' }
  ],
  murks:[
    { id:'m_ll_1', patrol:[[8,6],[15,6],[15,8],[8,8]], speed:40, sightTiles:3.4, fovDeg:90 },
    { id:'m_ll_2', patrol:[[23,6],[31,6],[31,8],[23,8]], speed:40, sightTiles:3.4, fovDeg:90 }
  ],
  echoes:[
    { id:'e_ll_1', patrol:[[15,11],[20,11],[20,12],[15,12]], speed:38, hearTiles:3.7 },
    { id:'e_ll_2', patrol:[[26,11],[32,11],[32,12],[26,12]], speed:38, hearTiles:3.7 }
  ],
  identityLabels:LBL, branch:null,
  epiphany:['해질녘, 가로등이 하나씩 켜진다.','불빛 아래마다, 하루가 내 이름을 부르던 자리.','노을에 길어진 두 그림자가, 이제 하나뿐이다.','그래도 다음 불빛까지, 나는 걷는다.'] }
```
**SCENE_SPECS:** `'lamplane': dict(cols=36, rows=14, floor='asphalt', border='fence', outdoor=True, path_tile='sidewalk', paths=[(1,6,34,2)], props=[('tree',5,3,3,2),('bench',5,9,3,2),('bush',13,4,3,2),('bush',13,9,3,2),('tree',21,3,3,2),('bench',21,9,3,2),('block',29,4,3,2,'cloth'),('bush',29,9,3,2),('lamp',10,6,0,0),('lamp',18,6,0,0),('lamp',26,6,0,0),('lamp',34,6,0,0)])`
**distinct:** 36칸 황혼 장거리. 가로등 사이 명암 → Q(빛)로 hidden 점등하면 노출 위험, 아끼면 못 찾는 빛 자원 트레이드오프.

### ch19 — 텅 빈 거리 (새벽) (`DATA.chapter_emptystreet`, bgKey `emptystreet`)
```js
{ tile:16, cols:30, rows:16, scale:4, bgKey:'emptystreet', title:'텅 빈 거리', music:'park', ambient:'motes', controls:CTRL,
  spawn:[15,14], coresNeeded:3,
  collision:[
    [0,0,30,2],[0,15,30,1],[0,0,1,16],[29,0,1,16],
    [4,4,3,2],[23,4,3,2],    // 상단 가로수 쌍(엄폐 최소)
    [13,7,4,3],              // 중앙 신호등 기단(유일한 큰 커버)
    [4,11,3,2],[23,11,3,2],  // 하단 화단 쌍
    [11,3,2,1]               // 상단 표지판
  ],
  safeZones:[[7,8,2,1],[15,12,2,1],[21,8,2,1]],
  door:{ tile:[15,1], requires:'cores' },
  shards:[
    { id:'c_es_signal', type:'core', tile:[15,11], radius:1.3, identitySlot:3,
      recall:'새벽 신호등. 아무도 없는 거리에서 혼자 깜빡인다 — 누군가를 기다리듯.' },
    { id:'c_es_walk', type:'core', tile:[6,9], radius:1.3, identitySlot:2,
      recall:'텅 빈 횡단보도. 두 줄 발자국이 시작되던 자리. 이제 한 줄을, 내가 다시 긋는다.' },
    { id:'c_es_dawn', type:'core', tile:[24,9], radius:1.3, identitySlot:1,
      recall:'동트는 거리 끝. 그 빛 너머 어딘가에서, 하루도 같은 새벽을 보고 있을까.' },
    { id:'e_es_paper', type:'echo', tile:[9,5], radius:1.2, identitySlot:null, obj:'paper',
      recall:'바람에 날리는 신문 한 장. 멈춘 시간 위로 새 날짜가 적혀 있다.' },
    { id:'e_es_bell', type:'echo', tile:[20,12], radius:1.2, hidden:true, identitySlot:null,
      recall:'어딘가에서 들리는 작은 방울 소리. 내 목걸이의 그 소리를 닮았다.' },
    { id:'f_es', type:'false', tile:[16,5], radius:1.3, identitySlot:null,
      recall:'텅 빈 거리 끝에서 하루가 걸어온다 — 그런데 발소리가 새벽 공기에 흩어져 닿지 않는다. 이건… 진짜가 아니야.' }
  ],
  murks:[
    { id:'m_es_1', patrol:[[5,5],[10,5],[10,8],[5,8]], speed:42, sightTiles:3.5, fovDeg:90 },
    { id:'m_es_2', patrol:[[18,5],[24,5],[24,8],[18,8]], speed:42, sightTiles:3.5, fovDeg:90 },
    { id:'m_es_3', patrol:[[9,10],[16,10],[16,12],[9,12]], speed:42, sightTiles:3.5, fovDeg:90 }
  ],
  echoes:[
    { id:'e_es_1', patrol:[[6,11],[11,11],[11,13],[6,13]], speed:38, hearTiles:3.8 },
    { id:'e_es_2', patrol:[[19,11],[25,11],[25,13],[19,13]], speed:38, hearTiles:3.8 }
  ],
  identityLabels:LBLN,
  branch:{ q:'아무도 없는 새벽 거리. 이 끝에서 나는 무엇을 만나려는 걸까.', options:[
    { label:'끝까지 간다', sub:'여기서 멈추면, 아무것도 끝나지 않는다.', feedback:'네 발에 마지막 힘이 모인다.' },
    { label:'숨을 고른다', sub:'한 박자만, 마음을 가다듬고.', feedback:'새벽 공기를 깊이 들이쉰다 — 그리고 다시 걷는다.' } ] },
  epiphany:['아무도 없는 새벽 거리.','세상이 비어버린 듯 조용하다.','이 텅 빈 거리의 끝에, 마지막 빈자리가 있다.','두렵지만 — 나는 그 공백을 마주하러 간다.'] }
```
**SCENE_SPECS:** `'emptystreet': dict(cols=30, rows=16, floor='asphalt', border='fence', outdoor=True, path_tile='sidewalk', paths=[(1,9,28,2)], props=[('tree',4,4,3,2),('tree',23,4,3,2),('block',13,7,4,3,'metal'),('bush',4,11,3,2),('bush',23,11,3,2),('block',11,3,2,1,'metal'),('lamp',7,8,0,0),('lamp',15,12,0,0),('lamp',21,8,0,0)])`
**distinct:** 직전 최난 피크. 엄폐물 최소(중앙 신호등 1개)·murk 3 교차로 노출 강제 → 정지·동선 관리 종합 시험, 직후 ch20 해방.

---

## D) 기존 10챕터의 재배정·미세조정 (값 그대로, 위치만 이동)

기존 데이터는 **스키마/좌표 변경 없이** CHAPTERS 배열 순서만 바꾼다. 단 능력치 커브 정합을 위한 미세조정만 권장:

| 신# | 기존 키 | 변경 없음 | 권장 미세조정(선택) |
|---|---|---|---|
| 1 | chapter1 | 그대로 | – |
| 2 | chapter2 | 그대로 | – |
| 4 | chapter3 | 그대로 | – |
| 5 | chapter4 | 그대로(echo 34/3.6, false 2, branch) | – |
| 6 | chapter5 | 그대로 | – |
| 9 | chapter6 | 그대로(murk 38·40 / echo 36) | – |
| 11 | chapter7 | 그대로(false 0, echo3+murk1) | – |
| 15 | chapter8 | 그대로(murk 40/3.4) | – |
| 18 | chapter9 | 그대로(climax) | **murk 42/3.5, echo 38/3.7** 로 +1단(피크 직전 강화). |
| 20 | chapter10 | 그대로(isFinal, boss hp3 waveR3.4) | – |

`CHAPTERS` 배열 권장 순서:
```js
const CHAPTERS = ["chapter1","chapter2","chapter_entry","chapter3","chapter4",
  "chapter5","chapter_busstop","chapter_avenue","chapter6","chapter_alley",
  "chapter7","chapter_toclinic","chapter_clinicfront","chapter_rooftop","chapter8",
  "chapter_plaza","chapter_lamplane","chapter9","chapter_emptystreet","chapter10"];
```
(런타임 `chapterIdx<=1` 고정 규칙은 idx 0·1 = chapter1·chapter2 에 그대로 적용되어 튜토리얼 2종만 작가배치 유지 — 변경 불필요.)

---

## E) 검산 요약 (구현자 체크)

- **coresNeeded=3** 전 스테이지 동일. core shard는 항상 3개·`identitySlot` 부여, echo/false는 `null`.
- 모든 신규 collision은 테두리 4개 + 가구. 가구는 좌우 벽(col1, col cols-2)·상하(row2, row rows-1) 안쪽에 배치, **스폰 타일은 어떤 가구에도 안 듦**(전부 FREE 확인).
- 도달가능 빈타일 ≥ shards+8: 가장 좁은 ch10(14×24=가구 6개)도 통로 폭 ≥2 유지로 ~120 빈타일 → 충분.
- door는 전부 상단 벽 row1의 중앙 근처 `[~cols/2,1]`(가로 와이드는 끝쪽 `[cols-2,1]`로 횡단 보상).
- patrol 시드는 전부 닫힌 루프(또는 직선 왕복)·가구 비관통으로 작성. ch3 이후는 `genPatrol` 재생성이라 시드는 폴백용.

---

## F) 요청 요약

**20행 난이도(적 수) 커브:** `1, 2, 2, 2, 1, 3, 3, 4, 4, 3, 4, 3, 4, 4, 3, 4, 4, 4, 5, 0`
완만 상승(1~5) → 미들 플래토(6~17, 3~4) → ch18 climax(4, 강화 능치) → **ch19 단일 피크(5 = murk3+echo2)** → ch20 보스(0).

**신규로 정의한 배경 스펙(SCENE_SPECS 키 10종):**
`entryway`(wood/wall), `busstop`(asphalt/fence·outdoor), `avenue`(asphalt/fence·outdoor 44wide), `alley`(asphalt/wall 14×24), `toclinic`(dirt/hedge·outdoor 22×26), `clinicfront`(stone/fence·outdoor plaza), `rooftop`(stone/fence·outdoor 20×22), `plaza`(stone/hedge·outdoor 26×18), `lamplane`(asphalt/fence·outdoor 36wide), `emptystreet`(asphalt/fence·outdoor 30×16).
기존 10종(room1·room2·hall2f·haru_room·yard·street·arcade·park_gate·park·blank)은 키/좌표 변경 없이 재사용.

**분기(branch) 보유 스테이지:** 5(하루의 방·기존), 8(큰길·신규), 9(길거리·기존), 13(병원 앞·신규), 15(공원 입구·기존), 19(텅 빈 거리·신규). **보스: ch20(The Blank) 단독.**
