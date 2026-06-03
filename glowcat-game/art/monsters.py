#!/usr/bin/env python3
"""몬스터 디자인 개선 시안 — Murk(응시하는 어둠) / Echo(속삭이는 잔상).
컨셉: 눈 있음=시각(Murk) / 눈 없음+파문=청각(Echo). 현재본과 비교 시트 출력.
"""
import os, math
from PIL import Image, ImageDraw
import pixelart as P

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "png")


def murk2(chase=False):
    """응시하는 어둠 — 보라 연기 덩어리 + 빛나는 눈 무리(3) + 흘러내리는 자락."""
    W, H = 22, 24
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    base, mid, rim = (28, 22, 48), (48, 36, 82), (78, 60, 128)
    eye = (255, 96, 96) if chase else (190, 156, 255)
    ehi = (255, 200, 200) if chase else (224, 210, 255)
    pup = (24, 18, 34)
    # 위로 피어오르는 연기 컬
    d.ellipse((4, -3, 10, 4), fill=base); d.ellipse((11, -2, 17, 4), fill=base)
    # 본체(둥근 위 → 아래로 퍼짐)
    d.ellipse((1, 1, 21, 19), fill=base)
    d.ellipse((3, 0, 19, 15), fill=mid)
    d.arc((3, 1, 19, 17), 190, 330, fill=rim, width=1)          # 좌상 림라이트
    # 아래로 흘러내리는 연기 자락(4가닥, 흔들림)
    for i, wx in enumerate((4, 9, 13, 18)):
        sway = int(math.sin(i * 1.7) * 1.5)
        d.polygon([(wx - 2, 15), (wx + 2, 15), (wx + sway, 24), (wx - 1 + sway, 24)], fill=base)
    # 눈 무리(중앙 큰 + 좌우 작은) — 빛남
    d.ellipse((8, 6, 14, 14), fill=eye); d.ellipse((9, 7, 13, 12), fill=ehi); d.point((11, 9), fill=pup)
    d.ellipse((4, 10, 8, 14), fill=eye); d.point((6, 12), fill=pup)
    d.ellipse((15, 10, 19, 14), fill=eye); d.point((17, 12), fill=pup)
    return im


def echo2(chase=False):
    """속삭이는 잔상 — 눈 없음. 창백한 형상이 잔상처럼 겹치고 둘레에 소리 파문."""
    W, H = 28, 24
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pale, mid, faint = (188, 224, 228, 210), (150, 200, 208, 170), (120, 170, 180, 90)
    ring = (255, 150, 120) if chase else (158, 246, 246)

    def ghost(cx, cy, col, s=1.0):                              # 물방울형 유령 실루엣(얼굴 없음)
        d.ellipse((cx - 7*s, cy - 8*s, cx + 7*s, cy + 6*s), fill=col)
        for wx in (-4, 0, 4):                                  # 아래 흩날리는 자락
            d.polygon([(cx + (wx-2)*s, cy + 4*s), (cx + (wx+2)*s, cy + 4*s), (cx + wx*s, cy + 11*s)], fill=col)
    ghost(15, 12, faint, 1.05)                                 # 뒤쪽 잔상(어긋남)
    ghost(13, 11, mid, 1.0)                                    # 중간 잔상
    ghost(12, 11, pale, 0.95)                                  # 본체
    d.ellipse((9, 8, 12, 12), fill=(232, 248, 250, 230))       # 윗면 옅은 광택
    # 소리 파문(왼쪽으로 퍼지는 호) — '듣는다'
    for i, r in enumerate((11, 15, 19)):
        a = 200 - i * 30
        col = (*ring, a)
        d.arc((12 - r, 12 - r, 12 + r, 12 + r), 120 + i*4, 240 - i*4, fill=col, width=1)
    return im


if __name__ == "__main__":
    rows = [
        ("현재", [("Murk", P.draw_murk()), ("Echo", P.draw_echo())]),
        ("개선", [("Murk · 응시(평시)", murk2(False)), ("Murk · 추격", murk2(True)),
                  ("Echo · 잔상(평시)", echo2(False)), ("Echo · 추격", echo2(True))]),
    ]
    S = 8; pad = 16; cell = 28 * S; labw = 90
    maxn = max(len(r[1]) for r in rows)
    W = labw + maxn * (cell + pad) + pad; Hh = pad + len(rows) * (cell + 26 + pad)
    sheet = Image.new("RGB", (W, Hh), (14, 16, 22)); dr = ImageDraw.Draw(sheet)
    for ri, (name, items) in enumerate(rows):
        y = pad + ri * (cell + 26 + pad)
        dr.text((10, y + cell // 2), name, fill="#bcd6d6", font=P._font(18))
        for ci, (cap, im) in enumerate(items):
            x = labw + ci * (cell + pad)
            dr.rectangle((x - 2, y - 2, x + cell + 1, y + cell + 1), fill=(8, 10, 14), outline=(40, 60, 64))
            big = P.add_glow(im.convert("RGB")).resize((im.width * S, im.height * S), Image.NEAREST)
            a = im.resize((im.width * S, im.height * S), Image.NEAREST)
            sheet.paste(big, (x + (cell - big.width) // 2, y + (cell - big.height) // 2), a)
            dr.text((x, y + cell + 4), cap, fill="#8aa7a9", font=P._font(12))
    sheet.save(f"{OUT}/monster_compare.png")
    print("monster compare ->", f"{OUT}/monster_compare.png")
