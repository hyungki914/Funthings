#!/usr/bin/env python3
"""잊혀진 발자국 — UI 목업 렌더/빌드 스크립트 (v2).

각 화면 SVG를 네이티브 크기 PNG로 변환하고, 전체를 합쳐 컨셉 보드(board.png)를 생성한다.
보드는 화면비를 보존하며 셀에 레터박스 배치(다양한 캔버스 크기 혼용 대응).

요구사항:
    pip install cairosvg pillow
    한글 폰트: Noto Sans CJK KR (아래 FONT 경로)
사용법:
    python3 render.py
"""
import os
import cairosvg
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PNG = os.path.join(HERE, "png")
os.makedirs(PNG, exist_ok=True)
FONT = "/usr/share/fonts/truetype/notokr/NotoSansCJKkr-Bold.otf"

# (파일명, 보드 라벨, 라벨색)
SCREENS = [
    ("01_main_menu",            "① 메인 메뉴",                         "#8ef548"),
    ("02_gameplay_hud",         "② 게임플레이 HUD",                    "#8ef548"),
    ("03_identity_card",        "③ 정체성 카드",                       "#8ef548"),
    ("04_memory_cutscene",      "④ 기억 조각 회상 컷신",               "#8ef548"),
    ("05_low_memory_suspense",  "⑤ 기억 위험 — 서스펜스 (메모리 1칸)", "#ff5a5a"),
    ("06_design_system",        "⑥ 디자인 시스템 · 메모리 미터 4상태",  "#34e2e2"),
    ("07_journal_clueboard",    "⑦ 기억 일지 · 추리 보드",             "#34e2e2"),
    ("08_settings_accessibility","⑧ 설정 · 접근성",                    "#34e2e2"),
]


def render_all():
    for name, _, _ in SCREENS:
        # output 크기 미지정 → SVG 네이티브 크기 사용(06은 1280x1040 등 혼용 대응)
        cairosvg.svg2png(
            url=os.path.join(HERE, name + ".svg"),
            write_to=os.path.join(PNG, name + ".png"),
        )
        print("rendered", name)


def _fit(img, cell_w, cell_h, bg=(8, 11, 14)):
    """화면비 보존 + 레터박스로 셀에 맞춘다."""
    scale = min(cell_w / img.width, cell_h / img.height)
    new = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))))
    canvas = Image.new("RGB", (cell_w, cell_h), bg)
    canvas.paste(new, ((cell_w - new.width) // 2, (cell_h - new.height) // 2))
    return canvas


def build_board():
    tw, th = 700, 394           # 셀(16:9)
    gap, mx, top, label_h = 40, 40, 130, 60
    cols = 2
    rows = (len(SCREENS) + cols - 1) // cols
    canvas_w = mx * 2 + tw * cols + gap
    canvas_h = top + rows * (th + label_h)
    board = Image.new("RGB", (canvas_w, canvas_h), (6, 9, 13))
    d = ImageDraw.Draw(board)
    fb = lambda s: ImageFont.truetype(FONT, s)

    d.text((40, 26), "잊혀진 발자국 · UI / 컨셉 보드 v2", font=fb(40), fill="#eafaff")
    d.text((44, 84), "LOST PAWPRINT — concept mockups v2 (D9 반영: 디자인시스템·일지·설정 추가)",
           font=fb(17), fill="#34e2e2")

    for i, (name, label, color) in enumerate(SCREENS):
        r, c = divmod(i, cols)
        x = mx + c * (tw + gap)
        y = top + r * (th + label_h)
        img = Image.open(os.path.join(PNG, name + ".png"))
        d.text((x + 4, y - 30), label, font=fb(18), fill=color)
        board.paste(_fit(img, tw, th), (x, y))

    out = os.path.join(PNG, "board.png")
    board.save(out)
    print("board.png built", board.size, "->", out)


if __name__ == "__main__":
    render_all()
    build_board()
