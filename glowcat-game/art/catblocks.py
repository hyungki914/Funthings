#!/usr/bin/env python3
"""블럭(나노블럭/복셀) 스타일 고양이 스프라이트 샘플 — 참고 사진(삼색 블럭 고양이) 기반.

각 셀을 '스터드 블럭'(윗면 하이라이트 + 음영 베벨 + 둥근 스터드)으로 렌더해
레고/나노블럭 장난감 같은 입체 도트 질감을 만든다. 매끈한 고양이 실루엣을
저해상 그리드로 스냅 → 블럭으로 재렌더.
"""
import os, io, base64, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import pixelart as P

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "png"); os.makedirs(OUT, exist_ok=True)

# ── 색 스킴 ───────────────────────────────────────────────────
ZIRO = {  # 네온-누아르: 검은 몸 + 청록 림 + 빛나는 연두 눈
    'K': (30, 33, 44), 'W': (66, 74, 90), 'E': (150, 246, 130),
    'P': (210, 120, 140), 'I': (44, 48, 62), 'T': (24, 26, 36),
}
CALICO = {  # 참고 사진(삼색): 흰/주황/검정 + 분홍
    'K': (40, 38, 42), 'W': (238, 238, 234), 'O': (226, 150, 58),
    'E': (40, 40, 44), 'P': (236, 150, 170), 'I': (236, 150, 170), 'T': (226, 150, 58),
}

def _shift(c, f, add=0):
    return tuple(max(0, min(255, int(v * f + add))) for v in c)

def stud_block(d, x, y, B, col, gap=1):
    """한 칸을 스터드 블럭으로: 베벨(윗·좌 밝게 / 아래·우 어둡게) + 둥근 스터드."""
    x0, y0, x1, y1 = x + gap, y + gap, x + B - 1, y + B - 1
    lite, dark = _shift(col, 1.16, 14), _shift(col, 0.62)
    d.rectangle((x0, y0, x1, y1), fill=col)
    d.line((x0, y0, x1, y0), fill=lite); d.line((x0, y0, x0, y1), fill=lite)        # 윗·좌
    d.line((x0, y1, x1, y1), fill=dark); d.line((x1, y0, x1, y1), fill=dark)        # 아래·우
    r = max(2, int(B * 0.30)); cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    d.ellipse((cx - r, cy - r - 1, cx + r, cy + r - 1), fill=_shift(col, 1.08, 6), outline=dark)
    d.ellipse((cx - r + 1, cy - r, cx + 1, cy), fill=lite)                          # 스터드 하이라이트

# ── 매끈한 청키 고양이(평면 색) → 그리드 샘플 ──────────────────
def draw_cat_hi(cols, rows, SS, sch, pose="sit"):
    W, H = cols * SS, rows * SS
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    def el(cx, cy, rx, ry, c): d.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=c)
    def tri(pts, c): d.polygon(pts, fill=c)
    K, Wc, E, Pc, I, T = sch['K'], sch['W'], sch['E'], sch['P'], sch['I'], sch['T']
    O = sch.get('O', sch['K'])
    if pose == "side":
        el(0.74*W, 0.86*H, 0.06*W, 0.10*H, K)                                       # 꼬리 밑동
        d.line([(0.80*W,0.80*H),(0.92*W,0.55*H),(0.86*W,0.40*H)], fill=K, width=int(0.10*W))
        el(0.50*W, 0.66*H, 0.30*W, 0.22*H, K)                                        # 몸통
        el(0.40*W, 0.70*H, 0.15*W, 0.16*H, Wc)                                       # 가슴/배 밝게
        for fx in (0.34, 0.56): d.rectangle((fx*W-0.04*W, 0.80*H, fx*W+0.04*W, 0.96*H), fill=K)
        for fx in (0.34, 0.56): d.rectangle((fx*W-0.04*W, 0.90*H, fx*W+0.04*W, 0.96*H), fill=Wc)
        el(0.26*W, 0.42*H, 0.18*W, 0.18*H, K)                                        # 머리
        tri([(0.14*W,0.30*H),(0.20*W,0.10*H),(0.30*W,0.28*H)], K)
        tri([(0.30*W,0.28*H),(0.36*W,0.10*H),(0.40*W,0.30*H)], K)
        el(0.18*W, 0.30*H, 0.04*W, 0.02*H, I); el(0.30*W, 0.30*H, 0.04*W, 0.02*H, I)
        el(0.22*W, 0.44*H, 0.045*W, 0.06*H, E)                                       # 눈(옆)
        el(0.11*W, 0.46*H, 0.02*W, 0.02*H, Pc)                                       # 코
        return im, cols, rows
    # sit (정면, 청키)
    el(0.79*W, 0.64*H, 0.065*W, 0.15*H, K)                                           # 꼬리(우측 컬)
    el(0.50*W, 0.73*H, 0.30*W, 0.23*H, K)                                            # 몸통
    el(0.50*W, 0.77*H, 0.13*W, 0.17*H, Wc)                                           # 가슴(흰)
    if 'O' in sch: el(0.33*W, 0.62*H, 0.10*W, 0.10*H, O); el(0.67*W, 0.66*H, 0.085*W, 0.085*H, O)  # 삼색 무늬
    for fx in (0.40, 0.60): el(fx*W, 0.93*H, 0.065*W, 0.05*H, Wc)                     # 앞발(흰)
    el(0.50*W, 0.38*H, 0.29*W, 0.27*H, K)                                            # 머리(큼)
    if 'O' in sch:                                                                    # 삼색 머리 패치
        tri([(0.52*W,0.14*H),(0.68*W,0.18*H),(0.56*W,0.40*H)], O)
        el(0.35*W, 0.32*H, 0.09*W, 0.11*H, O)
    tri([(0.24*W,0.22*H),(0.31*W,0.03*H),(0.41*W,0.21*H)], K)                        # 귀(작고 또렷)
    tri([(0.76*W,0.22*H),(0.69*W,0.03*H),(0.59*W,0.21*H)], K)
    tri([(0.29*W,0.18*H),(0.32*W,0.08*H),(0.37*W,0.18*H)], I)                        # 귀 안
    tri([(0.71*W,0.18*H),(0.68*W,0.08*H),(0.63*W,0.18*H)], I)
    el(0.35*W, 0.35*H, 0.055*W, 0.085*H, E); el(0.65*W, 0.35*H, 0.055*W, 0.085*H, E) # 눈(아몬드, 넓게)
    tri([(0.475*W,0.46*H),(0.525*W,0.46*H),(0.50*W,0.51*H)], Pc)                     # 코
    d.line([(0.50*W,0.51*H),(0.43*W,0.55*H)], fill=I, width=max(2,int(0.02*W)))      # ":3" 입
    d.line([(0.50*W,0.51*H),(0.57*W,0.55*H)], fill=I, width=max(2,int(0.02*W)))
    return im, cols, rows

def to_grid(im, cols, rows, SS):
    px = im.load(); grid = [[None]*cols for _ in range(rows)]
    for gy in range(rows):
        for gx in range(cols):
            r, g, b, a = px[min(im.width-1, gx*SS+SS//2), min(im.height-1, gy*SS+SS//2)]
            if a >= 128: grid[gy][gx] = (r, g, b)
    return grid

def render_blocks(grid, B=18, glow=True):
    rows, cols = len(grid), len(grid[0])
    im = Image.new("RGBA", (cols*B, rows*B), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for gy in range(rows):
        for gx in range(cols):
            c = grid[gy][gx]
            if c: stud_block(d, gx*B, gy*B, B, c)
    rgb = Image.new("RGB", im.size, (10, 12, 16)); rgb.paste(im, (0, 0), im)
    if glow: rgb = P.add_glow(rgb, radius=2.2)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.paste(rgb, (0, 0)); out.putalpha(im.split()[3])
    return out

def cat_block(sch, pose="sit", cols=20, rows=19, B=18):
    hi, c, r = draw_cat_hi(cols, rows, 8, sch, pose)
    return render_blocks(to_grid(hi, c, r, 8), B)


if __name__ == "__main__":
    # 개별 샘플
    cat_block(ZIRO, "sit").save(f"{OUT}/blk_ziro_sit.png")
    cat_block(ZIRO, "side").save(f"{OUT}/blk_ziro_side.png")
    cat_block(CALICO, "sit").save(f"{OUT}/blk_calico_sit.png")
    cat_block(CALICO, "side").save(f"{OUT}/blk_calico_side.png")
    # 비교 시트
    tiles = [("지로 (블럭) · 정면", cat_block(ZIRO, "sit")), ("지로 · 옆모습", cat_block(ZIRO, "side")),
             ("삼색 변형 · 정면", cat_block(CALICO, "sit")), ("삼색 변형 · 옆모습", cat_block(CALICO, "side"))]
    pad, lab, cols2 = 24, 30, 2
    tw = max(t[1].width for t in tiles); th = max(t[1].height for t in tiles)
    W = pad + cols2*(tw+pad); Hh = pad + 2*(th+lab+pad)
    sheet = Image.new("RGB", (W, Hh), (16, 18, 24)); d = ImageDraw.Draw(sheet)
    for i, (name, img) in enumerate(tiles):
        cx = pad + (i % cols2)*(tw+pad); cy = pad + (i//cols2)*(th+lab+pad)
        sheet.paste(img.convert("RGB"), (cx + (tw-img.width)//2, cy), img)
        d.rectangle((cx, cy, cx+tw-1, cy+th-1), outline=(40, 60, 64))
        d.text((cx+4, cy+th+8), name, fill="#bcd6d6", font=P._font(16))
    sheet.save(f"{OUT}/blk_sheet.png")
    # 인게임 스케일 목업 — 큰 블럭 캐릭터를 게임 크기로 축소해 배경 위에 배치(스터드는 큰 화면/포트레이트용)
    bg = P.add_vignette(P.add_glow(P.build_room(False))).convert("RGBA")
    mock = bg.resize((bg.width*3, bg.height*3), Image.NEAREST)
    cat = cat_block(ZIRO, "sit"); h = 64; small = cat.resize((int(cat.width*h/cat.height), h), Image.LANCZOS)
    cside = cat_block(ZIRO, "side"); sside = cside.resize((int(cside.width*h/cside.height), h), Image.LANCZOS)
    mock.alpha_composite(small, (int(mock.width*0.32), int(mock.height*0.52)))
    mock.alpha_composite(sside, (int(mock.width*0.58), int(mock.height*0.40)))
    d2 = ImageDraw.Draw(mock); d2.text((16, 12), "인게임 스케일 목업 (블럭 캐릭터 축소 배치)", fill="#bcd6d6", font=P._font(20))
    mock.convert("RGB").save(f"{OUT}/blk_ingame.png")
    print("block cat samples ->", OUT)
