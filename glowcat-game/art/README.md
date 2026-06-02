# 인게임 픽셀아트 — 『잊혀진 발자국』

일본식 도트 그래픽(ドット絵) + HD-2D 네온 블룸. 아트 바이블: [../09_art_direction_pixel.md](../09_art_direction_pixel.md)

```bash
pip install pillow
python3 pixelart.py   # png/ 에 전체 에셋 생성 (재현 가능)
```

## 산출물 (`png/`)
| 파일 | 내용 |
|---|---|
| `comparison.png` | **BEFORE(벡터 목업) / AFTER(픽셀아트)** 비교 — 가장 먼저 볼 것 |
| `room_scene.png` | 방 씬 — 타일맵 + 가구 + 캐릭터 + 조각 + 적 + 글로우/비네팅 |
| `character_sheet.png` | 주인공 방향셋(아래/옆) + 보행 프레임 |
| `cat.png` / `cat_side.png` | 캐릭터 스프라이트(다운/옆), 32px |
| `murk.png` / `shard.png` | 망각존재 / 기억 조각 |
| `tiles.png` | 타일 샘플(바닥·벽·러그), 16px |
| `palette.png` | 팔레트 스트립(캐릭터 13 + 환경 12) |

> 코드(`pixelart.py`)가 원본 — 팔레트/도트를 버전 관리. PNG는 nearest-neighbor 업스케일.
> 양산 시 Aseprite로 디테일·애니 보강(05 외주). Godot 임포트: 텍스처 필터 Nearest, 타일 16px(04 §9).
