#!/usr/bin/env python3
"""지로 스프라이트 정교화(원본 스타일 유지) — 형태/음영/옆모습 개선 시안.
원본 draw_cat / draw_cat_side 와 나란히 비교 시트 출력.
"""
import os
from PIL import Image, ImageDraw
import pixelart as P

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "png")
PAL = P.PAL
K, D, B, L = PAL['k'], PAL['d'], PAL['b'], PAL['l']
C, Cd, Ch = PAL['C'], PAL['c'], PAL['h']
G, Gd, Y, Wt = PAL['G'], PAL['g'], PAL['Y'], PAL['W']


def cat2(step=0):
    """다운뷰 v2 — 상단 림라이트(볼륨) · 또렷한 아몬드 눈/하안검 그림자 · 깔끔한 ':3' · 수염."""
    W, H = 32, 34
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    el = lambda bb, f, o=None, w=1: d.ellipse(bb, fill=f, outline=o, width=w)
    poly = lambda p, f: d.polygon(p, fill=f)
    # 꼬리(우측 컬 + 시안 끝)
    poly([(21, 25), (27, 20), (31, 23), (30, 28), (25, 30), (22, 29)], K)
    poly([(22, 26), (27, 22), (29, 24), (28, 27), (25, 29), (23, 28)], D)
    el((27, 20, 31, 25), C); el((28, 21, 30, 24), Ch)
    # 몸통 + 상단 림 + 가슴
    el((6, 21, 26, 34), K); el((7, 22, 25, 34), D)
    el((8, 22, 24, 26), L)                                   # 등 상단 빛
    el((11, 24, 19, 32), B)                                  # 가슴 밝은면
    # 앞발(시안 발) + 보행 오프셋
    lo, ro = (1, 0) if step == 1 else ((0, 1) if step == 2 else (0, 0))
    for px, off in [(9, lo), (17, ro)]:
        el((px, 30 - off, px + 6, 34 - off), K)
        el((px + 1, 31 - off, px + 5, 34 - off), C); el((px + 2, 31 - off, px + 4, 33 - off), Ch)
    # 가슴 발바닥 마크
    d.ellipse((14, 26, 17, 29), fill=C)
    for x, y in [(13, 25), (17, 25), (15, 28)]: d.point((x, y), fill=Cd)
    # 귀(검정 + 음영 + 시안 속)
    poly([(4, 8), (8, -1), (13, 8)], K); poly([(6, 7), (8, 2), (11, 7)], D); poly([(7, 6), (8, 4), (10, 6)], C)
    poly([(28, 8), (24, -1), (19, 8)], K); poly([(26, 7), (24, 2), (21, 7)], D); poly([(25, 6), (24, 4), (22, 6)], C)
    # 머리 + 이마 림
    el((2, 3, 30, 25), K); el((3, 4, 29, 24), D); el((5, 5, 27, 11), L)
    # 눈(아몬드, 약간 작게) + 하안검 그림자 + 흰 광택
    for ex in (7, 18):
        el((ex, 11, ex + 7, 20), K); el((ex + 1, 12, ex + 6, 19), C)
        el((ex + 1, 12, ex + 6, 18), G); el((ex + 1, 13, ex + 4, 16), Y); d.point((ex + 2, 13), fill=Wt)
        d.line((ex + 1, 19, ex + 6, 19), fill=Gd)            # 아래 눈꺼풀 음영
    # 코 + 깔끔한 ':3' 입
    d.point((16, 21), fill=Ch); d.point((15, 21), fill=C); d.point((17, 21), fill=C)
    for p in [(13, 23), (14, 24), (15, 23), (16, 24), (17, 23), (18, 24), (19, 23)]: d.point(p, fill=Cd)
    # 수염(아주 옅게)
    for wy in (20, 22):
        d.point((1, wy), fill=Cd); d.point((30, wy), fill=Cd)
    return im


def cat_side2(step=0):
    """옆모습 v2 — 둥근 몸통 + 네 다리(발끝 시안) + 위로 컬한 꼬리 + 옆얼굴. 보행 2프레임."""
    W, H = 34, 28
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    el = lambda bb, f: d.ellipse(bb, fill=f)
    poly = lambda p, f: d.polygon(p, fill=f)

    def leg(lx, fwd):                                       # 다리 한 짝(앞으로 fwd 픽셀)
        x = lx + fwd
        d.rectangle((x, 18, x + 2, 24), fill=K); d.rectangle((x, 18, x + 1, 23), fill=D)
        el((x - 1, 23, x + 3, 26), K); el((x, 24, x + 2, 26), C)                  # 발 + 발끝 시안
    back, front = (2, -1) if step == 1 else ((-1, 2) if step == 2 else (1, 0))
    leg(23, back); leg(19, front)                          # 뒷다리(먼 쪽 어둡게 이미 K)
    # 꼬리(뒤=우측, 위로 컬)
    d.line([(24, 15), (29, 11), (30, 5), (27, 2)], fill=K, width=5)
    d.line([(24, 15), (29, 11), (30, 5), (27, 2)], fill=D, width=3)
    el((25, 1, 30, 6), C); el((26, 2, 29, 5), Ch)
    # 몸통(둥글게) + 등 상단 빛 + 배 밝은면
    el((6, 9, 28, 24), K); el((7, 10, 27, 23), D)
    d.arc((8, 9, 26, 22), 195, 345, fill=L, width=1)                              # 등 윤곽 빛(밴드 아님)
    el((10, 15, 21, 22), B)
    leg(13, front); leg(8, back)                           # 앞다리
    # 목·머리(앞=좌) + 림
    el((1, 4, 16, 20), K); el((2, 5, 15, 19), D)
    d.arc((3, 4, 13, 13), 200, 340, fill=L, width=1)                              # 머리 위 빛
    # 귀
    poly([(2, 5), (5, -3), (9, 5)], K); poly([(3, 4), (5, -1), (8, 4)], D); poly([(4, 3), (5, 0), (7, 3)], C)
    poly([(9, 5), (12, -2), (15, 5)], K); poly([(10, 4), (12, 0), (14, 4)], D)
    # 눈(옆, 아몬드 빛남) + 코 + 입
    el((3, 10, 8, 17), K); el((4, 11, 7, 16), G); el((4, 11, 6, 14), Y); d.point((5, 12), fill=Wt)
    el((0, 12, 2, 15), K); d.point((0, 13), fill=Ch)                              # 주둥이/코
    for p in [(2, 15), (3, 16), (4, 15)]: d.point(p, fill=Cd)                     # 입
    return im


if __name__ == "__main__":
    rows = [("현재", [P.draw_cat(0), P.draw_cat(1), P.draw_cat(2), P.draw_cat_side(0), P.draw_cat_side(1)]),
            ("개선(옆모습)", [P.draw_cat(0), P.draw_cat(1), P.draw_cat(2), cat_side2(0), cat_side2(1)])]
    S = 7; pad = 14; cellw = 36 * S; cellh = 36 * S; labw = 150
    W = labw + 5 * (cellw + pad) + pad; Hh = pad + len(rows) * (cellh + pad)
    sheet = Image.new("RGB", (W, Hh), (16, 18, 24)); dr = ImageDraw.Draw(sheet)
    for ri, (name, ims) in enumerate(rows):
        y = pad + ri * (cellh + pad)
        dr.text((10, y + cellh // 2 - 8), name, fill="#bcd6d6", font=P._font(18))
        for ci, im in enumerate(ims):
            big = P.add_glow(im.convert("RGB")).resize((im.width * S, im.height * S), Image.NEAREST)
            x = labw + ci * (cellw + pad)
            dr.rectangle((x - 2, y - 2, x + cellw + 1, y + cellh + 1), fill=(10, 12, 16), outline=(40, 60, 64))
            a = im.resize((im.width * S, im.height * S), Image.NEAREST)
            sheet.paste(big, (x + (cellw - big.width) // 2, y + (cellh - big.height) // 2), a)
    sheet.save(f"{OUT}/cat_compare.png")
    print("compare ->", f"{OUT}/cat_compare.png")
