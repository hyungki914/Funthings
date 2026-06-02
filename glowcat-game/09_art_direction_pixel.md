# 09 · 아트 디렉션 — 픽셀아트(ドット絵) 스타일

> 상위: [GDD.md](./GDD.md) · 결정: [00 §D4](./00_design_review.md) · 기술 연계: [04 테크니컬 §2·§9](./04_technical_design.md)
> 목적: "벡터 목업 → 일본식 도트 그래픽"으로 그래픽 수준을 끌어올리는 아트 바이블. 실제 에셋은 [`art/pixelart.py`](./art/pixelart.py)로 생성(재현 가능).

---

## 0. 한 줄 디렉션

> **"Chrono Trigger·Sea of Stars의 탑다운 JRPG 픽셀 + Octopath의 HD-2D 네온 블룸 + Tails Noir의 느와르 분위기 — 를 검정·시안·네온그린 팔레트로."**

기존 SVG 목업은 **UI 스펙(레이아웃·정보위계)** 용이고, 인게임 실물 비주얼은 본 문서의 **픽셀아트**가 정본이다. (`art/png/comparison.png`의 BEFORE/AFTER 참고.)

---

## 1. 리서치 — 일본 도트 그래픽 원칙 (적용)

| ドット絵 원칙 | 본작 적용 |
|---|---|
| **제한 인덱스 팔레트 + 높은 채도** (서양 픽셀보다 채도↑) | 13색 캐릭터 팔레트 + 12색 환경 팔레트. 시안·네온그린을 고채도 액센트로 |
| **색 램프(base→shadow→highlight)** + 대각선 1px 광택 | 몸 `d/b/l`, 시안 `c/C/h`, 눈 `g/G/Y` 3단 램프. 이마·가슴에 밝은 면(`b`)으로 입체 |
| **의도적 외곽선(k)** | 모든 스프라이트에 근(近)검정 1px 외곽선 → 어두운 배경에서 실루엣 분리 |
| **디더링/제한 그라데이션** | 글로우는 픽셀 디더 대신 HD-2D 블룸 레이어로 처리(아래 §4) |
| **쿼터뷰 + 타일 기반** | 16px 그리드 타일맵 + 3/4 다운뷰 캐릭터(D4) |
| **HD-2D**(Octopath) — 픽셀 스프라이트 + 동적 조명/피사계심도 | 시안/그린 픽셀만 추출→가우시안 블러→스크린 블렌드 = 네온 블룸 + 비네팅 + 가구 AO 그림자 |
| **네온·느와르 분위기**(Tails Noir/World of Horror) | 어두운 실내에 시안 네온이 번지는 미스터리 톤 |

레퍼런스 계보: **Cave Story**(1인 인디 도트의 원형) · **Chrono Trigger / Sea of Stars**(탑다운 JRPG 타일+스프라이트) · **Octopath Traveler II**(HD-2D) · **Tails Noir**(네온 느와르).

---

## 2. 팔레트 스펙 (`art/png/palette.png`)

**캐릭터(13):**
```
k 외곽선 #08080F   d 몸어둠 #161622   b 몸베이스 #202538   l 림라이트 #343C58
c 시안그림자 #1884 96  C 시안 #34E2E2   h 시안하이라이트 #9EF6F6
g 눈그림자 #4F9E36   G 눈그린 #93E84A   Y 눈하이라이트 #D6FF9A   W 흰광택 #F0F8F8
M 망각존재몸 #1A1428  m 망각존재눈 #8A6EE0
```
**환경(12):** 바닥 `0~4`(#18120C→#4E3C28 우드 램프), 벽 `5~8`(#0A0D13→#28324E), 러그/빛 `9·q·Q`(#14404 9→#2C96A0 시안).

> 규칙(D9): **시안 = 중립 UI/상호작용, 네온그린 = 정체성/생명**으로 역할 고정. 적록색약 수렴을 피하려 두 색은 한 화면에서 다른 의미로 겹치지 않게.

---

## 3. 에셋 스펙

| 에셋 | 해상도 | 비고 |
|---|---|---|
| **타일** | **16×16px** | 바닥(판자·이음새·옹이) / 벽(상단 두께+벽돌결) / 러그. 챕터별 타일셋(방·집·공원) |
| **주인공** | **32px** 프레임 | 3/4 **다운뷰**(idle + walk A/B) + **옆뷰**(idle + walk). 추가: 업뷰, 은신 포즈, 회상 트리거 |
| **망각존재 Murk** | 20×18 | 뭉게지는 그림자 실루엣 + 보라 눈(색 아닌 **형태/모션**으로 식별, D9) |
| **기억 조각** | 12×16 | 시안 다이아몬드 + 흰 외곽 글로우. 거짓 조각은 *차가운* 변형 |
| **가구** | 멀티타일 | 침대(안전지대)·책상+모니터·게임기·옷장 |

캐릭터 시그니처(D4): 눈이 안 보이는 각도는 **이동 시 바닥 시안 발자국 트레일** + 등·귀·꼬리 글로우로 보완.

애니메이션 계획: 4방향 × (idle 2f + walk 4f) + 은신 + 피격 + 회상. 12fps 기준, 셀 수 최소화(ドット絵 절제미).

---

## 4. HD-2D 레이어 (분위기의 핵심)

벡터 목업과 결정적으로 다른 부분. 네이티브 저해상도 씬 위에:
1. **네온 블룸** — 밝은 시안/그린/흰 픽셀만 추출 → GaussianBlur → 스크린 블렌드. 기억 조각·러그(빛 웅덩이)·모니터가 은은히 번짐.
2. **비네팅** — 가장자리를 어둡게(미스터리 톤). 저(低)기억 시 강화(단 **광과민성 가드**: 플리커<3Hz, 흔들림/색수차 토글 — D9).
3. **가구 AO 그림자** — 오브젝트 하단 반투명 타원 → 평면 타일에 깊이감.

> 저기억 연출(흑백·왜곡)은 미터가 아니라 별도 '기억 안정도' 값에 연동(03 개정 D1)해 *감상 가능*하게.

---

## 5. 파이프라인 (재현 가능)

```bash
pip install pillow
python3 art/pixelart.py     # png/ 에 스프라이트·타일·씬·시트·비교 생성
```
- **코드 기반**(PIL): 팔레트 dict + 문자 그리드/프리미티브로 저해상도 생성 → **nearest-neighbor 업스케일**(픽셀 보존). 색·도트를 코드로 버전 관리.
- **Godot 임포트(04 §2·§9 연계):** 텍스처 필터 **Nearest**, 밉맵 끄기, **픽셀 스냅** 카메라, 타일 16px ↔ 셀 1:1. 블룸/비네팅은 `WorldEnvironment` + 포스트 셰이더(접근성 토글로 강도 조절).
- 산출물: `cat/cat_side/character_sheet`(스프라이트), `tiles/palette`, `room_scene`(글로우+비네팅 합성), `murk/shard`, `comparison`(BEFORE/AFTER).

---

## 6. 프로덕션 노트

- 본 코드 에셋은 **프로토타입/스타일 타깃(블록아웃)**. 양산은 **Aseprite**로 도트 디테일·애니 프레임을 다듬어 대체(외주 포인트 — 05 팀/외주).
- 챕터별 타일셋(방→집→공원)과 회상용 따뜻한 색 팔레트 변형을 추가.
- 캐릭터 모델시트(방향·포즈) 확정 후 애니 발주 — 시점이 잠겼으므로(D4) 재작업 리스크 해소.

---

### 참고 자료 (리서치 출처)
- [ピクセルアートとは？特徴・配色 — webclips](https://webclips.jp/design/pixel-art/)
- [Pixel Art Tutorial: Basics — Derek Yu](https://www.derekyu.com/makegames/pixelart.html)
- [ドット絵 — Wikipedia(JP)](https://ja.wikipedia.org/wiki/%E3%83%89%E3%83%83%E3%83%88%E7%B5%B5)
- [Anime pixel art — the JRPG tradition — Sprite-AI](https://www.sprite-ai.art/blog/anime-pixel-art)
- [The Most Beautiful Pixel Art JRPGs Ever Made — GameRant](https://gamerant.com/best-pixel-art-jrpgs-beautiful-games/)
- [Top 30 Pixel Art Games of All Time — Soulbound](https://soulbound.game/blog/top-30-pixel-art-games-of-all-time/)
