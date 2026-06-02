#!/usr/bin/env python3
"""잊혀진 발자국 — UI 목업 렌더/빌드 스크립트.

각 화면 SVG를 PNG로 변환하고, 5개를 합쳐 컨셉 보드(board.png)를 생성한다.

요구사항:
    pip install cairosvg pillow
    한글 폰트: Noto Sans CJK KR (아래 FONT 경로 참고)

사용법:
    python3 render.py            # 전체 렌더 + 보드 생성
"""
import os
import cairosvg
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PNG = os.path.join(HERE, "png")
os.makedirs(PNG, exist_ok=True)

W, H = 1280, 720
FONT = "/usr/share/fonts/truetype/notokr/NotoSansCJKkr-Bold.otf"

# (파일명, 보드 라벨, 라벨색)
SCREENS = [
    ("01_main_menu",            "① 메인 메뉴",                         "#8ef548"),
    ("02_gameplay_hud",         "② 게임플레이 HUD",                    "#8ef548"),
    ("03_identity_card",        "③ 정체성 카드",                       "#8ef548"),
    ("04_memory_cutscene",      "④ 기억 조각 회상 컷신",               "#8ef548"),
    ("05_low_memory_suspense",  "⑤ 기억 위험 — 서스펜스 (메모리 1칸)", "#ff5a5a"),
]


def render_all():
    for name, _, _ in SCREENS:
        cairosvg.svg2png(
            url=os.path.join(HERE, name + ".svg"),
            write_to=os.path.join(PNG, name + ".png"),
            output_width=W, output_height=H,
        )
        print("rendered", name)


def build_board():
    tw, th = 700, 394          # 썸네일 크기
    gap, mx, top = 40, 40, 130
    canvas_w = mx * 2 + tw * 2 + gap
    canvas_h = top + 3 * (th + 60)
    board = Image.new("RGB", (canvas_w, canvas_h), (6, 9, 13))
    d = ImageDraw.Draw(board)
    fb = lambda s: ImageFont.truetype(FONT, s)

    d.text((40, 28), "잊혀진 발자국 · UI / 컨셉 보드", font=fb(40), fill="#eafaff")
    d.text((44, 84), "LOST PAWPRINT — concept mockups v0.1", font=fb(18), fill="#34e2e2")

    positions = [
        (mx, top), (mx + tw + gap, top),
        (mx, top + th + 60), (mx + tw + gap, top + th + 60),
        ((canvas_w - tw) // 2, top + 2 * (th + 60)),
    ]
    for (name, label, color), (x, y) in zip(SCREENS, positions):
        img = Image.open(os.path.join(PNG, name + ".png")).resize((tw, th))
        d.text((x + 4, y - 30), label, font=fb(18), fill=color)
        board.paste(img, (x, y))

    out = os.path.join(PNG, "board.png")
    board.save(out)
    print("board.png built", board.size, "->", out)


if __name__ == "__main__":
    render_all()
    build_board()
