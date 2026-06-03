#!/usr/bin/env python3
"""잊혀진 발자국 — 픽셀아트(ドット絵) 에셋 생성 파이프라인.

일본식 도트 그래픽 원칙(제한 팔레트·색 램프·외곽선·디더링) + HD-2D식 네온 블룸으로
캐릭터 스프라이트 / 타일셋 / 방 씬을 코드로 생성한다. 네이티브 저해상도로 그린 뒤
nearest-neighbor 업스케일(픽셀 보존).

요구: pip install pillow
사용: python3 pixelart.py
"""
import os, io, base64
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

FONT = "/usr/share/fonts/truetype/notokr/NotoSansCJKkr-Bold.otf"
def _font(s):
    try:
        return ImageFont.truetype(FONT, s)
    except Exception:
        return ImageFont.load_default()

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "png"); os.makedirs(OUT, exist_ok=True)

# ── 팔레트 (제한 인덱스, 높은 채도 — ドット絵 원칙) ───────────────────────────
PAL = {
    '.': None, ' ': None,
    'k': (8, 10, 16),       # 외곽선
    'd': (22, 24, 34),      # 몸 어둠
    'b': (32, 37, 56),      # 몸 베이스
    'l': (52, 60, 88),      # 몸 림라이트
    'c': (24, 132, 150),    # 시안 그림자
    'C': (52, 226, 226),    # 시안
    'h': (158, 246, 246),   # 시안 하이라이트
    'g': (79, 158, 54),     # 눈 그림자
    'G': (147, 232, 74),    # 눈 그린
    'Y': (214, 255, 154),   # 눈 하이라이트
    'W': (240, 248, 248),   # 흰 광택
    'M': (26, 20, 40),      # 망각존재 몸
    'm': (138, 110, 224),   # 망각존재 눈
}
# 타일 팔레트
TPAL = {
    '0': (24, 18, 12), '1': (38, 28, 18), '2': (50, 38, 24), '3': (63, 48, 31), '4': (78, 60, 40),
    '5': (10, 13, 19), '6': (20, 26, 40), '7': (29, 37, 55), '8': (40, 52, 78),
    '9': (20, 64, 73), 'q': (30, 92, 104), 'Q': (44, 150, 160),
}
ALL = {**TPAL, **{k: v for k, v in PAL.items() if v}}


def grid_img(rows, pal=ALL):
    """문자 그리드 → RGBA 이미지."""
    h = len(rows); w = max(len(r) for r in rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in (' ', '.'):
                continue
            c = pal.get(ch)
            if c:
                px[x, y] = (c[0], c[1], c[2], 255)
    return im


def upscale(im, s):
    return im.resize((im.width * s, im.height * s), Image.NEAREST)


# ── 캐릭터 스프라이트 (32x34, 3/4 다운뷰) ─────────────────────────────────────
def draw_cat(step=0):
    """다운뷰 고양이. step 0=정지, 1/2=보행 프레임(발 교차)."""
    W, H = 32, 34
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    K = PAL['k']; DK = PAL['d']; BS = PAL['b']; LT = PAL['l']
    C = PAL['C']; CD = PAL['c']; CH = PAL['h']
    G = PAL['G']; GD = PAL['g']; YH = PAL['Y']; WT = PAL['W']

    def el(b, fill, outline=None, w=1):
        d.ellipse(b, fill=fill, outline=outline, width=w)
    def poly(p, fill, outline=None):
        d.polygon(p, fill=fill, outline=outline)

    # 꼬리 (오른쪽 컬, 시안 끝)
    poly([(22,26),(27,22),(31,24),(30,28),(26,30),(23,30)], fill=K)
    poly([(23,26),(27,23),(30,25),(29,28),(26,29),(24,29)], fill=DK)
    el((27,22,31,27), fill=C); el((28,23,30,26), fill=CH)
    # 몸
    el((7,22,25,34), fill=K)
    el((8,23,24,34), fill=DK)
    el((9,24,17,32), fill=BS)            # 가슴 밝은면
    # 발 (시안) — step에 따라 보행 오프셋
    lo, ro = (1, 0) if step == 1 else ((0, 1) if step == 2 else (0, 0))
    el((9,30-lo,15,34-lo), fill=K); el((10,30-lo,14,34-lo), fill=C); el((11,31-lo,13,33-lo), fill=CH)
    el((17,30-ro,23,34-ro), fill=K); el((18,30-ro,22,34-ro), fill=C); el((19,31-ro,21,33-ro), fill=CH)
    # 가슴 발바닥 마크
    for (x,y) in [(15,27),(13,25),(17,25)]:
        d.point((x,y), fill=C)
    d.ellipse((14,26,17,29), fill=C)
    # 귀 (검정+시안속)
    poly([(4,9),(7,0),(13,9)], fill=K); poly([(6,8),(8,2),(11,8)], fill=DK); poly([(7,7),(8,4),(10,7)], fill=C)
    poly([(28,9),(25,0),(19,9)], fill=K); poly([(26,8),(24,2),(21,8)], fill=DK); poly([(25,7),(24,4),(22,7)], fill=C)
    # 머리
    el((2,4,30,26), fill=K)
    el((3,5,29,25), fill=DK)
    el((5,6,18,16), fill=BS)             # 이마 밝은면(좌상 림)
    # 눈 (시안 링 + 그린 + 흰 광택)
    el((6,11,14,22), fill=K); el((7,12,13,21), fill=C); el((8,13,12,20), fill=GD); el((8,13,12,19), fill=G); el((8,14,10,17), fill=YH); d.point((9,14), fill=WT)
    el((18,11,26,22), fill=K); el((19,12,25,21), fill=C); el((20,13,24,20), fill=GD); el((20,13,24,19), fill=G); el((20,14,22,17), fill=YH); d.point((21,14), fill=WT)
    # 코 + ":3" 고양이 입 (3자 모양, ω)
    d.point((16,22), fill=CD)
    for p in [(14,24),(15,23),(16,24),(17,23),(18,24)]:
        d.point(p, fill=C)
    return im


def draw_cat_side(step=0):
    """옆모습(왼쪽 보기) 고양이 — 둥근 몸통 + 네 다리(발끝 시안 발바닥) + 위로 컬한 꼬리 + ':3' 옆얼굴.
    보행 2프레임(앞/뒤 다리 교차)."""
    W, H = 34, 28
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    K = PAL['k']; D = PAL['d']; B = PAL['b']; L = PAL['l']
    C = PAL['C']; Cd = PAL['c']; Ch = PAL['h']; G = PAL['G']; Y = PAL['Y']; Wt = PAL['W']
    el = lambda bb, f: d.ellipse(bb, fill=f)
    poly = lambda p, f: d.polygon(p, fill=f)

    def leg(lx, fwd):                                        # 다리 한 짝(앞으로 fwd 픽셀) + 발끝 시안
        x = lx + fwd
        d.rectangle((x, 18, x + 2, 24), fill=K); d.rectangle((x, 18, x + 1, 23), fill=D)
        el((x - 1, 23, x + 3, 26), K); el((x, 24, x + 2, 26), C)
    back, front = (2, -1) if step == 1 else ((-1, 2) if step == 2 else (1, 0))
    leg(23, back); leg(19, front)                           # 뒷다리
    # 꼬리(뒤=우측, 위로 컬)
    d.line([(24, 15), (29, 11), (30, 5), (27, 2)], fill=K, width=5)
    d.line([(24, 15), (29, 11), (30, 5), (27, 2)], fill=D, width=3)
    el((25, 1, 30, 6), C); el((26, 2, 29, 5), Ch)
    # 몸통(둥글게) + 등 윤곽 빛 + 배 밝은면
    el((6, 9, 28, 24), K); el((7, 10, 27, 23), D)
    d.arc((8, 9, 26, 22), 195, 345, fill=L, width=1)
    el((10, 15, 21, 22), B)
    leg(13, front); leg(8, back)                            # 앞다리
    # 목·머리(앞=좌) + 머리 위 빛
    el((1, 4, 16, 20), K); el((2, 5, 15, 19), D)
    d.arc((3, 4, 13, 13), 200, 340, fill=L, width=1)
    # 귀
    poly([(2, 5), (5, -3), (9, 5)], K); poly([(3, 4), (5, -1), (8, 4)], D); poly([(4, 3), (5, 0), (7, 3)], C)
    poly([(9, 5), (12, -2), (15, 5)], K); poly([(10, 4), (12, 0), (14, 4)], D)
    # 눈(옆, 아몬드 빛남) + 주둥이/코 + ':3' 입
    el((3, 10, 8, 17), K); el((4, 11, 7, 16), G); el((4, 11, 6, 14), Y); d.point((5, 12), fill=Wt)
    el((0, 12, 2, 15), K); d.point((0, 13), fill=Ch)
    for p in [(2, 15), (3, 16), (4, 15)]: d.point(p, fill=Cd)
    return im


# ── 망각 존재 Murk (20x18, 뭉게지는 그림자) ──────────────────────────────────
def draw_murk(chase=False):
    W, H = 22, 24
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    base, mid, rim = (28, 22, 48), (48, 36, 82), (78, 60, 128)
    eye = (255, 96, 96) if chase else (190, 156, 255)
    ehi = (255, 200, 200) if chase else (224, 210, 255); pup = (24, 18, 34)
    d.ellipse((4, -3, 10, 4), fill=base); d.ellipse((11, -2, 17, 4), fill=base)     # 피어오르는 연기
    d.ellipse((1, 1, 21, 19), fill=base); d.ellipse((3, 0, 19, 15), fill=mid)        # 본체
    d.arc((3, 1, 19, 17), 190, 330, fill=rim, width=1)                               # 좌상 림
    for wx, sway in [(4, 0), (9, 1), (13, -1), (18, 1)]:                             # 흘러내리는 자락
        d.polygon([(wx-2, 15), (wx+2, 15), (wx+sway, 24), (wx-1+sway, 24)], fill=base)
    d.ellipse((8, 6, 14, 14), fill=eye); d.ellipse((9, 7, 13, 12), fill=ehi); d.point((11, 9), fill=pup)   # 눈 무리
    d.ellipse((4, 10, 8, 14), fill=eye); d.point((6, 12), fill=pup)
    d.ellipse((15, 10, 19, 14), fill=eye); d.point((17, 12), fill=pup)
    return im


# ── 기억 조각 (12x16, 시안 다이아몬드) ───────────────────────────────────────
def draw_shard():
    rows = [
        "......WW......",
        ".....WHHW.....",
        "....WHCCHW....",
        "...WHCCCCHW...",
        "..WHCCCCCCHW..",
        ".WHCCCCCCCCHW.",
        "WHCCCCCCCCCCHW",
        ".WHCCCCCCCCHW.",
        "..WCCCCCCCCW..",
        "...WCCcccCW...",
        "....WCcccW....",
        ".....WccW.....",
        "......WW......",
    ]
    return grid_img(rows, PAL)


# ── 타일 (16x16) ─────────────────────────────────────────────────────────────
def tile_floor(variant=0):
    im = Image.new("RGBA", (16, 16)); px = im.load()
    for y in range(16):
        for x in range(16):
            px[x, y] = (*TPAL['2'], 255)
    for x in range(16):                      # 상단 하이라이트
        px[x, 0] = (*TPAL['3'], 255)
    for y in range(16):                      # 우측 음영
        px[15, y] = (*TPAL['1'], 255)
    for sy in (5, 11):                        # 판자 이음새
        for x in range(16):
            px[x, sy] = (*TPAL['1'], 255)
            px[x, sy-1] = (*TPAL['3'], 255) if sy-1 >= 0 else px[x, sy-1]
    if variant:                               # 옹이/결
        for (x, y) in [(4, 3), (10, 8), (6, 13)]:
            px[x, y] = (*TPAL['1'], 255)
    return im

def tile_wall():
    im = Image.new("RGBA", (16, 16)); px = im.load()
    for y in range(16):
        for x in range(16):
            px[x, y] = (*TPAL['6'], 255)
    for x in range(16):
        px[x, 0] = (*TPAL['8'], 255); px[x, 1] = (*TPAL['7'], 255); px[x, 15] = (*TPAL['5'], 255)
    for y in range(16):
        px[0, y] = (*TPAL['5'], 255); px[15, y] = (*TPAL['5'], 255)
    for (x, y) in [(4, 6), (9, 10), (12, 4)]:   # 벽돌 결
        px[x, y] = (*TPAL['5'], 255)
    return im

def tile_rug():
    im = Image.new("RGBA", (16, 16)); px = im.load()
    for y in range(16):
        for x in range(16):
            px[x, y] = (*TPAL['9'], 255)
    for x in range(16):
        px[x, 0] = px[x, 15] = (*TPAL['q'], 255)
    for y in range(16):
        px[0, y] = px[15, y] = (*TPAL['q'], 255)
    return im

def _fill_dither(px, base, dk, lt, a=6, b=7):
    """2-톤 디더로 평면 타일에 질감 — 단조로움 제거."""
    for y in range(16):
        for x in range(16):
            c = base
            if (x*2 + y) % a == 0: c = dk
            elif (x + y*2) % b == 0: c = lt
            px[x, y] = (*c, 255)

def tile_grass(variant=0):   # 잔디 — 다톤 디더 + 풀잎 + 가끔 들꽃
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, dk, lt = (34, 56, 34), (24, 42, 26), (48, 72, 44)
    _fill_dither(px, base, dk, lt, 5, 7)
    blades = [(3, 4), (8, 2), (12, 6), (5, 11), (11, 13), (14, 9)] if not variant \
        else [(2, 7), (6, 5), (9, 10), (13, 3), (7, 13), (12, 12)]
    for (x, y) in blades:
        px[x, y] = (*lt, 255)
        if y + 1 < 16: px[x, y + 1] = (*dk, 255)
    if variant:                                  # 작은 들꽃 한 송이(포인트)
        fx, fy = 10, 4
        for (dx, dy, col) in [(0, 0, (224, 198, 110)), (1, 0, (238, 226, 150)), (0, 1, (206, 152, 96)), (1, 1, (236, 120, 140))]:
            px[fx+dx, fy+dy] = (*col, 255)
    return im

def tile_path():     # 흙 산책로(베이스). 가장자리 음영 + 자갈.
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, dk, lt = (64, 56, 44), (50, 44, 34), (80, 71, 56)
    _fill_dither(px, base, dk, lt, 7, 9)
    for x in range(16): px[x, 0] = (*lt, 255); px[x, 15] = (*dk, 255)
    for (x, y) in [(4, 5), (10, 9), (7, 12), (12, 3)]: px[x, y] = (95, 88, 76, 255)   # 자갈
    return im

def tile_cobble():   # 공원/관문 산책로 — 둥근 돌 포석
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, dk, lt = (96, 92, 84), (66, 62, 56), (124, 120, 110)
    for y in range(16):
        for x in range(16): px[x, y] = (*base, 255)
    for (cx, cy) in [(4, 4), (12, 4), (4, 12), (12, 12), (8, 8)]:        # 돌 5개
        for yy in range(cy-3, cy+4):
            for xx in range(cx-3, cx+4):
                if 0 <= xx < 16 and 0 <= yy < 16 and (xx-cx)**2 + (yy-cy)**2 <= 9:
                    px[xx, yy] = (*(lt if (yy-cy) < 0 else base), 255)
    for x in range(16):                                                  # 줄눈
        for y in range(16):
            if px[x, y][:3] == base and ((x % 8 == 0) or (y % 8 == 0)): px[x, y] = (*dk, 255)
    return im

def tile_sidewalk(): # 길거리 보도 — 회색 콘크리트 슬래브 + 줄눈
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, seam, lt = (108, 110, 116), (84, 86, 92), (124, 126, 132)
    for y in range(16):
        for x in range(16): px[x, y] = (*base, 255)
    for x in range(16): px[x, 0] = (*lt, 255); px[x, 15] = (*seam, 255); px[x, 7] = (*seam, 255)
    for y in range(16): px[0, y] = (*seam, 255)
    return im

def tile_carpet():   # 하루의 방 — 슬픔의 청회 카펫(엮은 결)
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, dk, lt = (50, 46, 56), (40, 36, 46), (58, 54, 66)
    for y in range(16):
        for x in range(16):
            px[x, y] = (*(lt if (x + y) % 4 == 0 else base), 255)        # 직조 결
    for x in range(16): px[x, 15] = (*dk, 255)
    for (x, y) in [(3, 3), (12, 5), (5, 12), (14, 11)]: px[x, y] = (*dk, 255)
    return im

def tile_lino():     # 상가·주방 — 매끈한 격자 타일 + 하이라이트
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, grout, lt = (86, 88, 96), (62, 64, 70), (104, 106, 114)
    for y in range(16):
        for x in range(16): px[x, y] = (*base, 255)
    px[1, 1] = (*lt, 255); px[9, 1] = (*lt, 255)                          # 광택 점
    for x in range(16): px[x, 0] = (*grout, 255); px[x, 8] = (*grout, 255)
    for y in range(16): px[0, y] = (*grout, 255); px[8, y] = (*grout, 255)
    return im

def tile_asphalt():  # 길거리 차도 — 어두운 아스팔트 + 미세 균열
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, dk, lt = (46, 48, 54), (38, 40, 46), (56, 58, 64)
    _fill_dither(px, base, dk, lt, 5, 8)
    for (x, y) in [(2, 5), (9, 3), (13, 10), (6, 13)]: px[x, y] = (*dk, 255)
    return im

def tile_dirt():     # 마당 — 흙 + 잔돌 + 잡초
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, dk, lt = (74, 60, 44), (60, 48, 34), (90, 74, 52)
    _fill_dither(px, base, dk, lt, 6, 9)
    for (x, y) in [(3, 4), (12, 6), (8, 12)]: px[x, y] = (112, 106, 96, 255)   # 잔돌
    for (x, y) in [(6, 9), (14, 3)]: px[x, y] = (52, 84, 44, 255)              # 잡초
    return im

def tile_void():     # 빈자리 — 거의 검정(미세 명암)
    im = Image.new("RGBA", (16, 16)); px = im.load()
    for y in range(16):
        for x in range(16):
            px[x, y] = (12, 13, 19, 255) if (x*3 + y*5) % 11 == 0 else (9, 10, 15, 255)
    return im


# ── 방 씬 ────────────────────────────────────────────────────────────────────
def build_room(with_entities=True):
    TW = 16; cols, rows = 22, 14
    W, H = cols*TW, rows*TW
    scene = Image.new("RGBA", (W, H), (*TPAL['5'], 255))
    floor0, floor1, wall, rug = tile_floor(0), tile_floor(1), tile_wall(), tile_rug()

    def blit(img, tx, ty):
        scene.alpha_composite(img, (tx*TW, ty*TW))

    # 바닥
    for ty in range(rows):
        for tx in range(cols):
            blit(floor1 if (tx*3+ty*5) % 7 == 0 else floor0, tx, ty)
    # 벽 테두리 + 상단 두께
    for tx in range(cols):
        blit(wall, tx, 0); blit(wall, tx, 1)
        blit(wall, tx, rows-1)
    for ty in range(rows):
        blit(wall, 0, ty); blit(wall, cols-1, ty)

    d = ImageDraw.Draw(scene)
    def block(x0, y0, x1, y1, fill, outline, top=None):
        d.rectangle((x0, y0, x1, y1), fill=fill, outline=outline)
        if top:
            d.rectangle((x0, y0, x1, y0+2), fill=top)

    # 침대(좌하) — 안전지대
    bx, by = 2*TW, 8*TW
    block(bx, by, bx+4*TW, by+4*TW, (44, 33, 26), (24, 18, 12))     # 프레임
    block(bx+4, by+4, bx+4*TW-4, by+2*TW, (58, 70, 86), (30, 40, 54))  # 베개/이불
    d.rectangle((bx+6, by+6, bx+2*TW, by+TW), fill=(78, 96, 112))      # 베개
    # 책상+컴퓨터(우상)
    dx, dy = 15*TW, 3*TW
    block(dx, dy, dx+5*TW, dy+2*TW, (46, 35, 23), (24, 18, 12), top=(63, 48, 31))
    d.rectangle((dx+2*TW, dy+4, dx+3*TW+8, dy+TW+6), fill=(12, 16, 20), outline=(8, 10, 16))
    d.rectangle((dx+2*TW+3, dy+7, dx+3*TW+5, dy+TW+2), fill=(28, 132, 150))  # 모니터 시안
    # 게임기(중상)
    gx, gy = 9*TW, 3*TW
    block(gx, gy, gx+2*TW, gy+TW+6, (40, 28, 40), (20, 14, 22))
    d.ellipse((gx+TW-4, gy+10, gx+TW+4, gy+18), fill=(30, 140, 156))
    # 옷장(우하)
    wx, wy = 17*TW, 9*TW
    block(wx, wy, wx+3*TW, wy+3*TW, (40, 30, 20), (22, 16, 10))
    d.line((wx+int(1.5*TW), wy, wx+int(1.5*TW), wy+3*TW), fill=(24, 18, 12))

    # 러그(중앙) + 빛 웅덩이 자리
    rgx, rgy = 8, 7
    for ty in range(rgy, rgy+3):
        for tx in range(rgx, rgx+4):
            blit(rug, tx, ty)

    # 그림자(앰비언트 오클루전 느낌) — 가구 아래
    sh = Image.new("RGBA", scene.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    for (x0, y0, x1, y1) in [(bx, by+4*TW-6, bx+4*TW, by+4*TW+10),
                              (dx, dy+2*TW-4, dx+5*TW, dy+2*TW+10),
                              (wx, wy+3*TW-4, wx+3*TW, wy+3*TW+10)]:
        sd.ellipse((x0, y0, x1, y1), fill=(0, 0, 0, 90))
    scene.alpha_composite(sh)

    # 캐릭터/조각/적 배치 (정지 컷용; 게임 배경은 with_entities=False)
    if with_entities:
        cat = draw_cat(); murk = draw_murk(); shard = draw_shard()
        scene.alpha_composite(cat, (10*TW-4, 7*TW-2))      # 러그 위 고양이
        scene.alpha_composite(shard, (7*TW, 6*TW))         # 조각
        scene.alpha_composite(murk, (16*TW, 6*TW))         # 적

    return scene.convert("RGB")


# ── 챕터2 「집」 배경 (거실 + 주방) ───────────────────────────────────────────
def build_room2(with_entities=False):
    TW = 16; cols, rows = 22, 14
    scene = Image.new("RGBA", (cols*TW, rows*TW), (*TPAL['5'], 255))
    floor0, floor1, wall, rug = tile_floor(0), tile_floor(1), tile_wall(), tile_rug()
    def blit(img, tx, ty): scene.alpha_composite(img, (tx*TW, ty*TW))
    for ty in range(rows):
        for tx in range(cols):
            blit(floor1 if (tx*5 + ty*3) % 6 == 0 else floor0, tx, ty)
    for tx in range(cols): blit(wall, tx, 0); blit(wall, tx, 1); blit(wall, tx, rows-1)
    for ty in range(rows): blit(wall, 0, ty); blit(wall, cols-1, ty)
    d = ImageDraw.Draw(scene)
    def block(x0, y0, x1, y1, fill, outline, top=None):
        d.rectangle((x0, y0, x1, y1), fill=fill, outline=outline)
        if top: d.rectangle((x0, y0, x1, y0+2), fill=top)
    # 소파(좌상)
    sx, sy = 2*TW, 3*TW
    block(sx, sy, sx+4*TW, sy+2*TW, (64, 44, 52), (30, 20, 26))
    d.rectangle((sx+4, sy+4, sx+4*TW-4, sy+TW+2), fill=(96, 70, 84))
    for cxx in range(sx+6, sx+4*TW-10, 18): d.rectangle((cxx, sy+5, cxx+12, sy+TW), fill=(120, 92, 108))
    # TV 스탠드(좌하)
    tx2, ty2 = 2*TW, 9*TW
    block(tx2, ty2, tx2+3*TW, ty2+2*TW, (30, 26, 30), (16, 14, 18))
    d.rectangle((tx2+6, ty2+5, tx2+3*TW-6, ty2+TW+2), fill=(12, 16, 20), outline=(8, 10, 16))
    d.rectangle((tx2+10, ty2+8, tx2+3*TW-10, ty2+TW-2), fill=(26, 120, 130))
    # 주방 카운터(우상) + 싱크/수전
    kx, ky = 15*TW, 3*TW
    block(kx, ky, kx+5*TW, ky+2*TW, (70, 72, 78), (34, 36, 40), top=(96, 100, 108))
    d.rectangle((kx+2*TW, ky+6, kx+3*TW, ky+TW+2), fill=(40, 46, 52), outline=(20, 24, 28))
    d.line((kx+2*TW+8, ky+1, kx+2*TW+8, ky+8), fill=(120, 128, 136), width=2)
    # 냉장고(우하)
    fx, fy = 18*TW, 9*TW
    block(fx, fy, fx+2*TW, fy+3*TW, (150, 156, 162), (70, 74, 80))
    d.line((fx, fy+int(1.4*TW), fx+2*TW, fy+int(1.4*TW)), fill=(90, 96, 102), width=1)
    d.rectangle((fx+2*TW-8, fy+6, fx+2*TW-4, fy+int(1.2*TW)), fill=(90, 96, 102))
    # 식탁(중앙)
    dxx, dyy = 9*TW, 8*TW
    block(dxx, dyy, dxx+3*TW, dyy+2*TW, (58, 42, 28), (28, 20, 12), top=(78, 58, 38))
    # 러그(거실 중앙)
    for ty in range(5, 8):
        for txx in range(8, 12): blit(rug, txx, ty)
    # 화분(우하 모서리)
    d.ellipse((20*TW-2, 11*TW-6, 20*TW+8, 11*TW+6), fill=(40, 90, 52), outline=(20, 50, 28))
    # AO 그림자
    sh = Image.new("RGBA", scene.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    for (x0, y0, x1, y1) in [(sx, sy+2*TW-4, sx+4*TW, sy+2*TW+10), (tx2, ty2+2*TW-4, tx2+3*TW, ty2+2*TW+10),
                              (kx, ky+2*TW-4, kx+5*TW, ky+2*TW+10), (fx, fy+3*TW-4, fx+2*TW, fy+3*TW+10),
                              (dxx, dyy+2*TW-4, dxx+3*TW, dyy+2*TW+10)]:
        sd.ellipse((x0, y0, x1, y1), fill=(0, 0, 0, 90))
    scene.alpha_composite(sh)
    if with_entities:
        scene.alpha_composite(draw_cat(), (10*TW-4, 10*TW)); scene.alpha_composite(draw_echo(), (16*TW, 6*TW))
    return scene.convert("RGB")


# ── 챕터3 「공원」 배경 (산책로 + 벤치 + 분수 + 나무) ─────────────────────────
def build_room3(with_entities=False):
    TW = 16; cols, rows = 22, 14
    scene = Image.new("RGBA", (cols*TW, rows*TW), (20, 34, 22, 255))
    g0, g1, path = tile_grass(0), tile_grass(1), tile_path()
    def blit(img, tx, ty): scene.alpha_composite(img, (tx*TW, ty*TW))
    for ty in range(rows):
        for tx in range(cols):
            blit(g1 if (tx*3 + ty*5) % 7 == 0 else g0, tx, ty)
    # 산책로 — 중앙 세로(문→하단) + 하단 가로
    for ty in range(2, 13):
        for tx in range(9, 12): blit(path, tx, ty)
    for tx in range(1, 21):
        for ty in range(11, 13): blit(path, tx, ty)
    d = ImageDraw.Draw(scene)
    def hedge(x0, y0, x1, y1): d.rectangle((x0, y0, x1, y1), fill=(18, 40, 22), outline=(10, 24, 14))
    hedge(0, 0, cols*TW, 2*TW); hedge(0, (rows-1)*TW, cols*TW, rows*TW)        # 경계 헤지
    hedge(0, 0, TW, rows*TW); hedge((cols-1)*TW, 0, cols*TW, rows*TW)
    d.rectangle((10*TW-2, 0, 11*TW+2, 2*TW), fill=(44, 62, 44), outline=(20, 36, 22))   # 상단 게이트(문)
    def block(x0, y0, x1, y1, fill, outline, top=None):
        d.rectangle((x0, y0, x1, y1), fill=fill, outline=outline)
        if top: d.rectangle((x0, y0, x1, y0+2), fill=top)
    def tree(cx, cy):
        d.rectangle((cx+TW-3, cy+TW, cx+TW+3, cy+2*TW), fill=(58, 42, 28), outline=(28, 20, 12))   # 줄기
        for (ox, oy, r, col) in [(TW, TW-4, 16, (30, 70, 36)), (TW-8, TW, 13, (36, 84, 42)),
                                  (TW+8, TW, 13, (26, 62, 32)), (TW, TW+4, 12, (42, 96, 50))]:
            d.ellipse((cx+ox-r, cy+oy-r, cx+ox+r, cy+oy+r), fill=col)
    tree(3*TW, 3*TW); tree(17*TW, 3*TW); tree(3*TW, 10*TW)
    # 벤치 (cols9~11, row4) — 등받이 + 다리
    bx, by = 9*TW, 4*TW
    d.rectangle((bx, by-8, bx+3*TW, by-2), fill=(86, 64, 42), outline=(34, 24, 14))
    block(bx, by, bx+3*TW, by+TW, (74, 54, 34), (34, 24, 14), top=(96, 72, 46))
    for legx in (bx+4, bx+3*TW-7):
        d.rectangle((legx, by+TW, legx+3, by+TW+6), fill=(40, 28, 18))
    # 분수 (cols14~16, rows9~11)
    fx, fy = 14*TW, 9*TW
    d.ellipse((fx, fy, fx+3*TW, fy+3*TW), fill=(78, 84, 92), outline=(40, 44, 50))
    d.ellipse((fx+8, fy+8, fx+3*TW-8, fy+3*TW-8), fill=(26, 120, 130), outline=(40, 44, 50))
    d.ellipse((fx+int(1.1*TW), fy+int(1.0*TW), fx+int(1.9*TW), fy+int(1.8*TW)), fill=(52, 226, 226))
    # 가로등 (벤치 옆) — 안전지대 빛
    lx, ly = 12*TW+4, 5*TW
    d.rectangle((lx, ly, lx+3, ly+3*TW), fill=(40, 44, 50))
    d.ellipse((lx-6, ly-10, lx+9, ly+5), fill=(214, 255, 154), outline=(147, 232, 74))
    # AO 그림자
    sh = Image.new("RGBA", scene.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    for (x0, y0, x1, y1) in [(bx, by+TW-2, bx+3*TW, by+TW+10), (fx, fy+3*TW-6, fx+3*TW, fy+3*TW+8)]:
        sd.ellipse((x0, y0, x1, y1), fill=(0, 0, 0, 90))
    scene.alpha_composite(sh)
    if with_entities:
        scene.alpha_composite(draw_cat(), (10*TW-4, 11*TW))
        scene.alpha_composite(draw_murk(), (17*TW, 6*TW)); scene.alpha_composite(draw_echo(), (6*TW, 7*TW))
    return scene.convert("RGB")


# ── Echo (청각 감지 적) — '속삭이는 잔상' (눈 없음 · 잔상 겹침 · 소리 파문) ──────
def draw_echo(chase=False):
    W, H = 28, 24
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pale, mid, faint = (188, 224, 228, 210), (150, 200, 208, 170), (120, 170, 180, 90)
    ring = (255, 150, 120) if chase else (158, 246, 246)
    def ghost(cx, cy, col, s=1.0):                              # 물방울형 유령 실루엣(얼굴 없음)
        d.ellipse((int(cx-7*s), int(cy-8*s), int(cx+7*s), int(cy+6*s)), fill=col)
        for wx in (-4, 0, 4):                                  # 아래 흩날리는 자락
            d.polygon([(int(cx+(wx-2)*s), int(cy+4*s)), (int(cx+(wx+2)*s), int(cy+4*s)), (int(cx+wx*s), int(cy+11*s))], fill=col)
    ghost(15, 12, faint, 1.05)                                 # 뒤쪽 잔상(어긋남)
    ghost(13, 11, mid, 1.0)                                    # 중간 잔상
    ghost(12, 11, pale, 0.95)                                  # 본체
    d.ellipse((9, 8, 12, 12), fill=(232, 248, 250, 230))       # 윗면 옅은 광택
    for i, r in enumerate((11, 15, 19)):                       # 소리 파문(좌측으로 퍼짐) — '듣는다'
        d.arc((12-r, 12-r, 12+r, 12+r), 120+i*4, 240-i*4, fill=(*ring, 200-i*30), width=1)
    return im


# ── 범용 씬 빌더 (10스테이지 확장: 타일 바닥 + 테두리 + 프롭 디스패치) ───────────
PROP_COLORS = {
    'wood':    ((74, 54, 34),  (96, 72, 46)),
    'bed':     ((58, 70, 86),  (78, 96, 112)),
    'sofa':    ((64, 44, 52),  (96, 70, 84)),
    'metal':   ((70, 72, 78),  (96, 100, 108)),
    'fridge':  ((150, 156, 162),(180, 186, 192)),
    'dark':    ((30, 26, 30),  (46, 42, 48)),
    'stone':   ((78, 84, 92),  (100, 106, 114)),
    'green':   ((40, 90, 52),  (56, 120, 72)),
    'cloth':   ((86, 64, 42),  (108, 84, 56)),
    'cabinet': ((46, 38, 30),  (64, 52, 40)),
    'shelf':   ((58, 50, 40),  (80, 70, 56)),
    'glass':   ((26, 120, 130),(52, 226, 226)),
    'pale':    ((96, 98, 106), (120, 122, 130)),
}

def _shade(col, d):
    return (max(0, min(255, col[0]+d)), max(0, min(255, col[1]+d)), max(0, min(255, col[2]+d)))

def _draw_block(d, x0, y0, x1, y1, body, top):
    out = _shade(body, -20)
    d.rectangle((x0, y0, x1, y1), fill=body, outline=out)
    d.rectangle((x0, y0, x1, y0+2), fill=top)                       # 윗면 하이라이트
    d.line((x0+1, y0+3, x0+1, y1-1), fill=_shade(body, 10))         # 좌측 림(광원 좌상)
    d.line((x1-1, y0+3, x1-1, y1-1), fill=_shade(body, -14))        # 우측 음영

def _draw_tree(d, x0, y0, w, h, TW):
    cx, cy = x0 + w*TW//2, y0 + h*TW//2
    d.rectangle((cx-3, cy+2, cx+3, y0+h*TW), fill=(60, 44, 30), outline=(30, 22, 14))   # 줄기
    d.line((cx-2, cy+2, cx-2, y0+h*TW), fill=(78, 58, 38))                              # 줄기 좌측 하이라이트
    R = max(11, (min(w, h)*TW)//2 + 4)
    for (ox, oy, rr, col) in [(0, -4, R, (28, 62, 32)), (R//2, 3, R-3, (24, 54, 28)),   # 우/하 = 그늘
                              (-R//2, 1, R-3, (38, 88, 44)), (0, 4, R-5, (46, 100, 52))]:
        d.ellipse((cx+ox-rr, cy+oy-rr, cx+ox+rr, cy+oy+rr), fill=col)
    for (ox, oy, rr) in [(-R//2, -R//3, R//3), (-2, 2, R//4)]:                          # 좌상 햇빛 얼룩
        d.ellipse((cx+ox-rr, cy+oy-rr, cx+ox+rr, cy+oy+rr), fill=(64, 122, 66))
    for (ox, oy) in [(-R//2-1, -R//3-1), (-3, -1), (2, 3)]:                             # 잎 하이라이트 점
        d.ellipse((cx+ox-1, cy+oy-1, cx+ox+1, cy+oy+1), fill=(96, 150, 92))

def _draw_bench(d, x0, y0, x1, y1):
    body, top, leg = (78, 56, 36), (104, 78, 50), (44, 30, 18)
    d.rectangle((x0, y0-9, x1, y0-2), fill=body, outline=_shade(body, -22))             # 등받이
    d.line((x0+1, y0-7, x1-1, y0-7), fill=top); d.line((x0+1, y0-4, x1-1, y0-4), fill=_shade(body, -10))
    d.rectangle((x0, y0, x1, y1), fill=body, outline=_shade(body, -22))                 # 좌판
    for sx in range(x0+2, x1-1, 5): d.line((sx, y0+1, sx, y1-1), fill=top)              # 좌판 슬랫
    for lx in (x0+3, x1-5): d.rectangle((lx, y1, lx+2, y1+6), fill=leg)                 # 다리

def _draw_fountain(d, x0, y0, x1, y1):
    d.ellipse((x0, y0, x1, y1), fill=(86, 92, 100), outline=(44, 48, 54))               # 외곽 석재
    d.ellipse((x0+3, y0+3, x1-3, y1-3), fill=(64, 70, 78), outline=(40, 44, 50))        # 단차
    d.ellipse((x0+8, y0+8, x1-8, y1-8), fill=(24, 96, 116), outline=(40, 44, 50))       # 물
    cx, cy = (x0+x1)//2, (y0+y1)//2
    d.ellipse((cx-9, cy-9, cx+9, cy+9), fill=(40, 170, 186))
    d.ellipse((cx-5, cy-5, cx+5, cy+5), fill=(52, 226, 226))                            # 분출 하이라이트(글로우)
    for (ox, oy) in [(-6, -3), (5, -5), (3, 6)]: d.point((cx+ox, cy+oy), fill=(210, 250, 250))  # 물 반짝임

def _draw_bush(d, x0, y0, x1, y1):
    for (ox, oy) in [(0, 0), ((x1-x0)//3, 2), (-(x1-x0)//3, 2)]:
        d.ellipse((x0+ox, y0+oy, x1+ox-((x1-x0)//2), y1+oy), fill=(34, 80, 40), outline=(20, 50, 28))
    d.ellipse((x0, y0, x1, y1), fill=(42, 92, 50), outline=(22, 52, 30))
    d.ellipse((x0+2, y0+1, x0+(x1-x0)//2, y0+(y1-y0)//2), fill=(54, 110, 60))           # 좌상 하이라이트
    for (ox, oy, col) in [((x1-x0)//2, (y1-y0)//3, (236, 226, 150)), ((x1-x0)//3, (y1-y0)*2//3, (230, 130, 150))]:
        d.ellipse((x0+ox-1, y0+oy-1, x0+ox+1, y0+oy+1), fill=col)                        # 작은 꽃

def _draw_lamp(d, cx, cy):
    d.rectangle((cx, cy, cx+3, cy+28), fill=(38, 42, 48), outline=(22, 24, 28))         # 기둥
    d.ellipse((cx-9, cy-14, cx+12, cy+7), fill=(150, 140, 70))                          # 헤일로(은은)
    d.ellipse((cx-6, cy-11, cx+9, cy+4), fill=(220, 232, 150))                          # 갓
    d.ellipse((cx-3, cy-8, cx+6, cy+1), fill=(255, 252, 196))                           # 전구(글로우)

def _floor_pair(theme):
    if theme == 'grass':  return tile_grass(0), tile_grass(1)
    if theme == 'carpet': t = tile_carpet();  return t, t
    if theme == 'lino':   t = tile_lino();    return t, t
    if theme == 'asphalt':t = tile_asphalt(); return t, t
    if theme == 'dirt':   t = tile_dirt();    return t, t
    if theme == 'void':   t = tile_void();    return t, t
    return tile_floor(0), tile_floor(1)      # 'wood'

PATH_TILES = {'path': tile_path, 'cobble': tile_cobble, 'sidewalk': tile_sidewalk}

def _draw_border(d, scene, cols, rows, kind, blit):
    TW = 16
    if kind == 'wall':
        wall = tile_wall()
        for tx in range(cols): blit(wall, tx, 0); blit(wall, tx, 1); blit(wall, tx, rows-1)
        for ty in range(rows): blit(wall, 0, ty); blit(wall, cols-1, ty)
        d.line((0, 2*TW-1, cols*TW, 2*TW-1), fill=(20, 26, 40))                          # 상단 벽 그림자선
        d.line((0, 2*TW, cols*TW, 2*TW), fill=(48, 56, 78))                              # 베이스보드 하이라이트
    elif kind == 'hedge':
        for box in [(0, 0, cols*TW, 2*TW), (0, (rows-1)*TW, cols*TW, rows*TW),
                    (0, 0, TW, rows*TW), ((cols-1)*TW, 0, cols*TW, rows*TW)]:
            d.rectangle(box, fill=(22, 46, 26), outline=(10, 24, 14))
        for bx in range(0, cols*TW, 10):                                                 # 헤지 잎 질감
            d.point((bx+3, 6), fill=(34, 66, 36)); d.point((bx+7, 1*TW+4), fill=(34, 66, 36))
        d.line((0, 2*TW, cols*TW, 2*TW), fill=(40, 80, 44))                              # 햇빛 받는 윗면
    elif kind == 'fence':                                                                # 길거리: 건물 파사드 + 점등 창
        d.rectangle((0, 0, cols*TW, 2*TW), fill=(34, 36, 46), outline=(20, 22, 30))
        cols_b = [(46, 44, 56), (40, 46, 58), (52, 46, 50)]
        for i, bx in enumerate(range(TW, cols*TW-TW, 3*TW)):
            d.rectangle((bx-2, 2, bx+3*TW-6, 2*TW-3), fill=cols_b[i % 3], outline=(18, 20, 28))
            for wy in (5, 16):
                for wx in range(bx+3, bx+3*TW-10, 9):
                    lit = ((wx + wy) % 3 == 0)
                    d.rectangle((wx, wy, wx+5, wy+7), fill=(255, 224, 150) if lit else (60, 70, 90))  # 점등=글로우
        for box in [(0, (rows-1)*TW, cols*TW, rows*TW), (0, 0, TW, rows*TW), ((cols-1)*TW, 0, cols*TW, rows*TW)]:
            d.rectangle(box, fill=(34, 36, 42), outline=(20, 22, 26))
    elif kind == 'void':
        for box in [(0, 0, cols*TW, TW), (0, (rows-1)*TW, cols*TW, rows*TW),
                    (0, 0, TW, rows*TW), ((cols-1)*TW, 0, cols*TW, rows*TW)]:
            d.rectangle(box, fill=(5, 6, 10))

def build_scene(cols, rows, floor='wood', border='wall', props=(), paths=(), path_tile='path', outdoor=False):
    TW = 16
    scene = Image.new("RGBA", (cols*TW, rows*TW), (*TPAL['5'], 255))
    f0, f1 = _floor_pair(floor)
    def blit(img, tx, ty): scene.alpha_composite(img, (tx*TW, ty*TW))
    for ty in range(rows):
        for tx in range(cols):
            blit(f1 if (tx*3 + ty*5) % 7 == 0 else f0, tx, ty)
    if paths:
        pth = PATH_TILES.get(path_tile, tile_path)()
        for (c, r, w, h) in paths:
            for ty in range(r, r+h):
                for tx in range(c, c+w): blit(pth, tx, ty)
    d = ImageDraw.Draw(scene)
    _draw_border(d, scene, cols, rows, border, blit)
    # 그림자(프롭 아래) — 먼저 깔고 그 위에 프롭. 야외는 좌상 광원 → 우하 긴 그림자.
    sh = Image.new("RGBA", scene.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    for p in props:
        kind = p[0]; c, r, w, h = p[1], p[2], p[3], p[4]
        x0, y0, x1, y1 = c*TW, r*TW, (c+w)*TW, (r+h)*TW
        if kind == 'lamp': continue
        if outdoor:
            if kind == 'tree':
                sd.ellipse((x0+6, y1-TW+8, x1+18, y1+16), fill=(0, 0, 0, 66))
            else:
                sd.ellipse((x0+6, (y0+y1)//2+6, x1+14, y1+12), fill=(0, 0, 0, 56))
        else:
            sd.ellipse((x0, y1-6, x1, y1+8), fill=(0, 0, 0, 80))                          # 실내 AO
    scene.alpha_composite(sh)
    # 가로등 지면 헤일로 — 빛이 바닥에 닿는 따뜻한 웅덩이(프롭 아래)
    gl = Image.new("RGBA", scene.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    for p in props:
        if p[0] == 'lamp':
            bx, by = p[1]*TW+1, p[2]*TW+27
            for rr, aa in [(28, 26), (19, 38), (11, 54)]:
                gd.ellipse((bx-rr, by-rr//2, bx+rr, by+rr//2), fill=(255, 234, 168, aa))
    scene.alpha_composite(gl)
    # 프롭
    for p in props:
        kind = p[0]; c, r, w, h = p[1], p[2], p[3], p[4]
        x0, y0, x1, y1 = c*TW, r*TW, (c+w)*TW, (r+h)*TW
        if kind == 'tree':    _draw_tree(d, x0, y0, w, h, TW)
        elif kind == 'fountain': _draw_fountain(d, x0, y0, x1, y1)
        elif kind == 'bush':  _draw_bush(d, x0, y0, x1, y1)
        elif kind == 'bench': _draw_bench(d, x0, y0, x1-1, y1-1)
        elif kind == 'lamp':  _draw_lamp(d, x0, y0)
        else:
            ck = p[5] if len(p) > 5 else 'wood'
            body, top = PROP_COLORS.get(ck, PROP_COLORS['wood'])
            _draw_block(d, x0, y0, x1-1, y1-1, body, top)
    return scene.convert("RGB")


def _b64(im):
    buf = io.BytesIO(); im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# 10스테이지 배경 스펙 (bgKey → build_scene 파라미터). props/paths 좌표는 data.js collision과 정렬.
SCENE_SPECS = {
    # 3. 2층 복도·계단 (세로 스크롤)
    'hall2f': dict(cols=18, rows=26, floor='wood', border='wall', props=[
        ('block', 1, 4, 5, 1, 'wood'), ('block', 12, 4, 5, 1, 'wood'), ('block', 7, 7, 4, 2, 'cabinet'),
        ('block', 1, 11, 3, 2, 'shelf'), ('block', 14, 11, 3, 2, 'shelf'), ('block', 6, 15, 6, 2, 'wood'),
        ('block', 2, 19, 4, 2, 'cabinet'), ('bush', 13, 19, 3, 2), ('lamp', 2, 3, 0, 0), ('lamp', 15, 12, 0, 0)]),
    # 4. 하루의 방
    'haru_room': dict(cols=22, rows=14, floor='carpet', border='wall', props=[
        ('block', 3, 3, 4, 3, 'bed'), ('block', 16, 3, 4, 2, 'wood'), ('block', 9, 7, 4, 2, 'wood'),
        ('block', 17, 9, 3, 3, 'cabinet'), ('block', 2, 10, 3, 2, 'shelf'), ('lamp', 20, 2, 0, 0)]),
    # 5. 집 근처/마당
    'yard': dict(cols=24, rows=14, floor='dirt', border='hedge', outdoor=True, paths=[(11, 2, 3, 11)], props=[
        ('tree', 2, 3, 3, 2), ('block', 18, 3, 4, 2, 'wood'), ('bush', 9, 6, 4, 2),
        ('block', 5, 9, 3, 2, 'wood'), ('block', 16, 9, 4, 2, 'stone'), ('lamp', 3, 6, 0, 0), ('lamp', 20, 6, 0, 0)]),
    # 6. 길거리 (가로 스크롤)
    'street': dict(cols=40, rows=14, floor='asphalt', border='fence', outdoor=True, path_tile='sidewalk', paths=[(1, 6, 38, 2)], props=[
        ('tree', 5, 3, 3, 2), ('bench', 5, 9, 3, 2), ('block', 14, 4, 4, 2, 'metal'),
        ('bush', 13, 9, 3, 2), ('tree', 22, 3, 3, 2), ('block', 23, 9, 4, 2, 'metal'),
        ('block', 31, 4, 4, 2, 'cloth'), ('tree', 32, 9, 3, 2),
        ('lamp', 10, 6, 0, 0), ('lamp', 20, 6, 0, 0), ('lamp', 30, 6, 0, 0)]),
    # 7. 근처 상가 (칸막이 미로)
    'arcade': dict(cols=24, rows=16, floor='lino', border='wall', props=[
        ('block', 4, 2, 1, 6, 'pale'), ('block', 9, 2, 1, 5, 'pale'), ('block', 14, 4, 1, 7, 'pale'),
        ('block', 18, 2, 1, 6, 'pale'), ('block', 5, 8, 5, 1, 'shelf'), ('block', 10, 11, 6, 1, 'shelf'),
        ('block', 2, 12, 2, 2, 'wood'), ('block', 19, 11, 3, 2, 'shelf'),
        ('block', 6, 3, 1, 1, 'glass'), ('block', 21, 3, 1, 1, 'glass')]),
    # 8. 공원 입구 (관문)
    'park_gate': dict(cols=22, rows=16, floor='grass', border='hedge', outdoor=True, path_tile='cobble', paths=[(9, 2, 3, 14)], props=[
        ('block', 1, 5, 8, 1, 'stone'), ('block', 12, 5, 9, 1, 'stone'), ('block', 1, 9, 7, 1, 'stone'),
        ('block', 14, 9, 7, 1, 'stone'), ('block', 3, 2, 3, 2, 'wood'), ('block', 16, 2, 4, 2, 'wood'),
        ('fountain', 9, 12, 4, 2), ('lamp', 2, 9, 0, 0), ('lamp', 19, 9, 0, 0)]),
    # 9. 공원 (확장)
    'park': dict(cols=28, rows=16, floor='grass', border='hedge', outdoor=True, path_tile='cobble', paths=[(13, 2, 3, 13), (1, 12, 26, 2)], props=[
        ('tree', 3, 3, 2, 2), ('bench', 10, 3, 3, 1), ('tree', 22, 3, 3, 2),
        ('fountain', 12, 8, 4, 4), ('tree', 4, 10, 2, 2), ('bush', 23, 10, 3, 2), ('bush', 7, 6, 3, 1),
        ('lamp', 10, 5, 0, 0), ('lamp', 19, 11, 0, 0)]),
    # 10. 빈자리 The Blank
    'blank': dict(cols=16, rows=12, floor='void', border='void', props=[
        ('block', 7, 5, 2, 2, 'pale'), ('block', 8, 3, 1, 1, 'glass')]),
}

def export_game_assets():
    """game/assets.js — 10스테이지 배경+스프라이트를 base64 dataURI로 임베드(무서버 실행)."""
    assets = {
        "room1": _b64(finish(build_room(with_entities=False), SCENE_FX['room1'])),    # 챕터1 방
        "room2": _b64(finish(build_room2(with_entities=False), SCENE_FX['room2'])),   # 챕터2 집
    }
    for key, spec in SCENE_SPECS.items():                                            # 챕터3~10
        assets[key] = _b64(finish(build_scene(**spec), SCENE_FX.get(key)))
    assets.update({
        "ziro_d0": _b64(draw_cat(0)), "ziro_d1": _b64(draw_cat(1)), "ziro_d2": _b64(draw_cat(2)),
        "ziro_s0": _b64(draw_cat_side(0)), "ziro_s1": _b64(draw_cat_side(1)),
        "murk": _b64(draw_murk()), "murk_chase": _b64(draw_murk(True)),
        "echo": _b64(draw_echo()), "echo_chase": _b64(draw_echo(True)), "shard": _b64(draw_shard()),
    })
    game_dir = os.path.join(HERE, "..", "game"); os.makedirs(game_dir, exist_ok=True)
    lines = ["// 자동 생성 — art/pixelart.py export_game_assets(). 수정 금지.",
             "const ASSETS = {"]
    for k, v in assets.items():
        lines.append(f'  {k}: "{v}",')
    lines += ["};",
              "if (typeof module !== 'undefined') module.exports = ASSETS;"]
    path = os.path.join(game_dir, "assets.js")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("exported", path, f"({os.path.getsize(path)//1024} KB)")


def add_glow(rgb, radius=2.6):
    """밝은 시안/그린/흰 픽셀만 추출 → 블러 → 스크린 블렌드 (HD-2D 네온 블룸)."""
    px = rgb.load(); W, H = rgb.size
    glow = Image.new("RGB", (W, H), (0, 0, 0)); gp = glow.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            if (b > 150 and g > 150) or (g > 170 and b < 160 and r < 170) or (r > 210 and g > 210 and b > 210):
                gp[x, y] = (r, g, b)
    glow = glow.filter(ImageFilter.GaussianBlur(radius))
    return ImageChops.screen(rgb, glow)


def add_vignette(rgb, strength=0.55):
    W, H = rgb.size
    mask = Image.new("L", (W, H), 0); md = ImageDraw.Draw(mask)
    md.ellipse((-W*0.15, -H*0.15, W*1.15, H*1.15), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(min(W, H)*0.12))
    dark = Image.new("RGB", (W, H), (3, 5, 9))
    inv = ImageChops.invert(mask).point(lambda v: int(v*strength))
    return Image.composite(dark, rgb, inv)


# ── 컬러 그레이드 / 스카이라이트 / 채도 — 스테이지별 무드(시간대) 베이크 ────────
def apply_desat(rgb, amt):
    if not amt: return rgb
    return Image.blend(rgb, rgb.convert("L").convert("RGB"), amt)

def apply_grade(rgb, grade):
    """grade = (r,g,b,alpha,mode) — multiply(그늘 채색)/screen(빛 채색)/overlay(대비+채색)."""
    if not grade: return rgb
    r, g, b, a, mode = grade
    layer = Image.new("RGB", rgb.size, (r, g, b))
    if mode == "multiply":  bl = ImageChops.multiply(rgb, layer)
    elif mode == "screen":  bl = ImageChops.screen(rgb, layer)
    elif mode == "overlay": bl = ImageChops.overlay(rgb, layer)
    else:                   bl = layer
    return Image.blend(rgb, bl, a)

def apply_skylight(rgb, color=(255, 240, 200), strength=0.22):
    """야외 깊이감 — 상단이 밝은 세로 빛 그라디언트를 스크린으로(해가 위)."""
    W, H = rgb.size
    col = Image.new("L", (1, H))
    for y in range(H):
        col.putpixel((0, y), int(255 * (1 - y / H) ** 1.35))
    mask = col.resize((W, H))
    screened = ImageChops.screen(rgb, Image.new("RGB", (W, H), color))
    return Image.composite(screened, rgb, mask.point(lambda v: int(v * strength)))

# 스테이지별 후처리 무드(환경 아트 리뷰 docs/14 기준 그레이드 테이블).
SCENE_FX = {
    'room1':     {'grade': (255, 196, 138, 0.30, 'multiply')},
    'room2':     {'grade': (255, 214, 170, 0.22, 'multiply')},
    'hall2f':    {'grade': (96, 104, 132, 0.40, 'multiply')},
    'haru_room': {'grade': (120, 140, 196, 0.34, 'multiply'), 'desat': 0.35},
    'arcade':    {'grade': (206, 222, 230, 0.30, 'screen')},
    'yard':      {'grade': (255, 206, 150, 0.30, 'screen'),   'sky': {'color': (255, 240, 205), 'strength': 0.26}},
    'street':    {'grade': (86, 78, 150, 0.42, 'multiply'),   'sky': {'color': (150, 150, 210), 'strength': 0.13}},
    'park_gate': {'grade': (168, 158, 110, 0.30, 'overlay'),  'sky': {'color': (255, 236, 196), 'strength': 0.18}},
    'park':      {'grade': (214, 188, 120, 0.38, 'overlay'),  'sky': {'color': (255, 228, 170), 'strength': 0.22}},
    'blank':     {'grade': (40, 44, 58, 0.30, 'multiply'), 'vig': 0.62},
}

def finish(rgb, fx=None):
    """씬 → 채도 → 그레이드 → 스카이라이트 → 네온블룸 → 비네팅."""
    fx = fx or {}
    out = apply_desat(rgb, fx.get('desat', 0))
    out = apply_grade(out, fx.get('grade'))
    if fx.get('sky'): out = apply_skylight(out, **fx['sky'])
    out = add_glow(out)
    return add_vignette(out, fx.get('vig', 0.55))


def palette_strip():
    keys = ['k','d','b','l','c','C','h','g','G','Y','W','M','m']
    keys += ['0','1','2','3','4','5','6','7','8','9','q','Q']
    sw = 18
    im = Image.new("RGB", (sw*len(keys), sw), (6, 9, 13)); d = ImageDraw.Draw(im)
    for i, k in enumerate(keys):
        c = ALL[k]; d.rectangle((i*sw, 0, i*sw+sw-1, sw-1), fill=c)
    return im


def char_sheet():
    """캐릭터 방향셋 + 보행 프레임 시트."""
    S = 8; cell = 32*S; pad = 24; lblh = 30
    cols = [("아래 · idle", draw_cat(0)), ("아래 · walk A", draw_cat(1)),
            ("아래 · walk B", draw_cat(2)), ("옆 · idle", draw_cat_side(0)),
            ("옆 · walk", draw_cat_side(1))]
    W = pad + len(cols)*(cell+pad); Hh = lblh + cell + pad + 40
    im = Image.new("RGB", (W, Hh), (10, 13, 18)); d = ImageDraw.Draw(im)
    d.text((pad, 10), "캐릭터 스프라이트 — 32px · 다운/옆 방향 + 보행", font=_font(22), fill="#eafaff")
    for i, (lbl, spr) in enumerate(cols):
        x = pad + i*(cell+pad); y = lblh + 16
        d.rectangle((x-6, y-6, x+cell+6, y+cell+6), fill=(16, 20, 28), outline=(29, 50, 54))
        big = upscale(spr, S)
        im.paste(big, (x + (cell-big.width)//2, y + (cell-big.height)//2), big)
        d.text((x, y+cell+12), lbl, font=_font(15), fill="#8aa7a9")
    return im


def comparison():
    """기존 벡터 목업 vs 신규 픽셀아트 비교."""
    old_p = os.path.join(HERE, "..", "mockups", "png", "02_gameplay_hud.png")
    new = Image.open(f"{OUT}/room_scene.png").convert("RGB")
    tw = 1180
    def fit(im):
        return im.resize((tw, int(im.height*tw/im.width)))
    new_s = fit(new)
    panels = [("BEFORE · 벡터 목업 (프레젠테이션용)", "#8aa7a9")]
    imgs = []
    if os.path.exists(old_p):
        imgs.append(fit(Image.open(old_p).convert("RGB")))
    imgs.append(new_s)
    labels = ["BEFORE · 벡터 목업 (프레젠테이션용)", "AFTER · 픽셀아트 (인게임 실물 톤)"]
    colors = ["#8aa7a9", "#8ef548"]
    pad, lblh = 30, 40
    Hh = pad + sum(im.height + lblh + pad for im in imgs) + 20
    W = tw + pad*2
    board = Image.new("RGB", (W, Hh), (6, 9, 13)); d = ImageDraw.Draw(board)
    y = pad
    for im, lbl, col in zip(imgs, labels[-len(imgs):], colors[-len(imgs):]):
        d.text((pad, y), lbl, font=_font(22), fill=col); y += lblh
        board.paste(im, (pad, y)); d.rectangle((pad, y, pad+tw-1, y+im.height-1), outline=(29,50,54)); y += im.height + pad
    return board


if __name__ == "__main__":
    upscale(draw_cat(), 10).save(f"{OUT}/cat.png")
    upscale(draw_cat_side(), 10).save(f"{OUT}/cat_side.png")
    upscale(draw_murk(), 10).save(f"{OUT}/murk.png")
    upscale(draw_shard(), 10).save(f"{OUT}/shard.png")
    # 타일 샘플 시트
    ts = Image.new("RGBA", (16*4, 16), (0,0,0,0))
    ts.alpha_composite(tile_floor(0),(0,0)); ts.alpha_composite(tile_floor(1),(16,0))
    ts.alpha_composite(tile_wall(),(32,0)); ts.alpha_composite(tile_rug(),(48,0))
    upscale(ts, 8).save(f"{OUT}/tiles.png")
    upscale(palette_strip(), 8).save(f"{OUT}/palette.png")
    char_sheet().save(f"{OUT}/character_sheet.png")
    upscale(draw_echo(), 10).save(f"{OUT}/echo.png")
    # 방 씬 (글로우+비네팅) → x4
    upscale(add_vignette(add_glow(build_room(True))), 4).save(f"{OUT}/room_scene.png")
    upscale(add_vignette(add_glow(build_room2(True))), 4).save(f"{OUT}/room2_scene.png")
    upscale(add_vignette(add_glow(build_room3(True))), 4).save(f"{OUT}/room3_scene.png")
    comparison().save(f"{OUT}/comparison.png")
    export_game_assets()
    print("pixel art rendered ->", OUT)
