# ext/ — 외부 원화(회화 일러스트) 드롭인

여기에 그림 파일을 넣으면, 픽셀/절차생성 키아트 **대신** 그 그림이 게임 컷에 들어갑니다.
회화 생성 AI(Midjourney·DALL·E·NanoBanana·SDXL 등)로 만든 일러스트를 코드 수정 없이 끼워 넣는 용도입니다.

## 사용법

1. 그림을 만들어 아래 파일명 중 하나로 이 폴더에 저장합니다.
   확장자는 `.png` / `.jpg` / `.jpeg` / `.webp` 모두 가능.
2. `python3 art/illust.py` 실행 → `game/illust.js` 재생성.
3. `python3 build_standalone.py` 로 단일 HTML 다시 빌드.

빌드 로그에 `[ext] reunite <- ext/reunite.png` 처럼 찍히면 적용된 것입니다.

## 파일명(= 컷 키)

| 파일명         | 들어가는 장면                |
|----------------|------------------------------|
| `title.*`      | 타이틀 키아트                |
| `s1.*`~`s10.*` | 1~10장 깨달음 컷             |
| `reunite.*`    | **재회 엔딩**(하루와 다시 만남) |
| `stray.*`      | 길고양이(중립) 엔딩          |

원하는 컷만 넣으면 됩니다. 없는 키는 기존 절차생성 그림이 그대로 쓰입니다.

## 권장 사양

- 비율 **16:9** (예: 1280×720, 1920×1080). 다른 비율은 중앙을 잘라 16:9로 맞춥니다.
- 임베드 시 가로 768px·JPEG(q86)로 다운스케일됩니다(용량 관리). 원본은 더 커도 됩니다.
- 게임 톤: 어둑한 네온/따뜻한 빛. 지로는 검은 고양이 + 연두-청록 눈빛.

## 프롬프트 예시 (재회 엔딩 `reunite`)

> A young girl gently hugging a small black cat over her shoulder, the cat's
> eyes glowing soft teal-green, warm window light, cozy melancholic storybook
> illustration, painterly, cinematic 16:9, soft bokeh, muted neon night palette.

> 어린 여자아이가 작은 검은 고양이를 어깨 너머로 꼬옥 안고 있는 모습,
> 고양이의 눈은 은은한 연두-청록빛, 따뜻한 창가 빛, 아늑하고 애틋한 동화풍
> 일러스트, 회화체, 시네마틱 16:9, 부드러운 보케, 차분한 네온 밤 색감.

## git 추적 규칙

기본적으로 `ext/*` 이미지는 추적하지 않습니다(실험용 그림이 커밋되지 않도록).
단, **게임에 실제로 채택된 최종본**은 빌드 재현을 위해 강제 추가해 둡니다:

- `title.webp` — 타이틀/오프닝 (창가의 지로)
- `reunite.webp` — 재회 엔딩 (하루가 지로를 안아줌)

새 그림을 채택하면 `git add -f ext/<파일>` 로 함께 커밋하세요. 그래야 깨끗한
클론에서 `illust.py` 를 다시 돌려도 같은 결과가 나옵니다.
