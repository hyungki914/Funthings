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
    """옆모습(왼쪽 보기) 고양이 — 이동 방향 표현용."""
    W, H = 32, 28
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    K = PAL['k']; DK = PAL['d']; BS = PAL['b']; C = PAL['C']; CH = PAL['h']
    G = PAL['G']; GD = PAL['g']; YH = PAL['Y']; WT = PAL['W']
    # 꼬리(뒤=오른쪽, 위로 컬)
    d.line([(24,18),(28,14),(29,8),(27,5)], fill=K, width=4)
    d.line([(24,18),(28,14),(29,8),(27,5)], fill=DK, width=2)
    d.ellipse((25,4,29,9), fill=C); d.ellipse((26,5,28,8), fill=CH)
    # 몸통
    d.ellipse((6,12,26,26), fill=K); d.ellipse((7,13,25,25), fill=DK); d.ellipse((9,15,18,23), fill=BS)
    # 다리(시안) — step 보행
    fo = 2 if step == 1 else 0
    for x in (9-0, 19-fo):
        d.rectangle((x,23,x+2,27), fill=K); d.rectangle((x,23,x+1,26), fill=C)
    for x in (13+fo, 22):
        d.rectangle((x,23,x+2,27), fill=K); d.rectangle((x,23,x+1,26), fill=C)
    # 머리(앞=왼쪽)
    d.ellipse((1,6,15,22), fill=K); d.ellipse((2,7,14,21), fill=DK); d.ellipse((3,9,9,16), fill=BS)
    # 귀
    d.polygon([(3,7),(5,0),(9,7)], fill=K); d.polygon([(4,6),(6,2),(8,6)], fill=DK); d.polygon([(5,6),(6,3),(7,6)], fill=C)
    d.polygon([(9,7),(12,1),(14,7)], fill=K); d.polygon([(10,6),(12,3),(13,6)], fill=DK)
    # 눈(앞쪽)
    d.ellipse((3,11,8,18), fill=K); d.ellipse((4,12,7,17), fill=GD); d.ellipse((4,12,7,16), fill=G); d.point((5,13), fill=YH)
    d.point((2,15), fill=C)  # 코
    return im


# ── 망각 존재 Murk (20x18, 뭉게지는 그림자) ──────────────────────────────────
def draw_murk():
    rows = [
        "......MMMMMM........",
        "....MMMMMMMMMM......",
        "...MMMMMMMMMMMM.....",
        "..MMMMMMMMMMMMMM....",
        "..MMMMMMMMMMMMMMM...",
        ".MMMMMMMMMMMMMMMM...",
        ".MMMMmmMMMMMMmmMM...",
        ".MMMmmmMMMMMMmmmM...",
        ".MMMMmMMMMMMMMmMM...",
        ".MMMMMMMMMMMMMMMM...",
        "..MMMMMMMMMMMMMMM...",
        "..MMM.MMMMMM.MMMM...",
        "...M...MMMM...MM....",
        "..M.....MM.....M....",
        "...................",
    ]
    return grid_img(rows, PAL)


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

def tile_grass(variant=0):
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, dk, lt = (28, 46, 30), (22, 38, 24), (36, 56, 36)
    for y in range(16):
        for x in range(16):
            px[x, y] = (*base, 255)
    blades = [(3, 4), (8, 2), (12, 6), (5, 11), (11, 13), (14, 9)] if not variant \
        else [(2, 7), (6, 5), (9, 10), (13, 3), (7, 13), (12, 12)]
    for (x, y) in blades:
        px[x, y] = (*lt, 255)
        if y + 1 < 16: px[x, y + 1] = (*dk, 255)
    return im

def tile_path():
    im = Image.new("RGBA", (16, 16)); px = im.load()
    base, dk, lt = (60, 54, 44), (48, 43, 35), (74, 67, 54)
    for y in range(16):
        for x in range(16):
            px[x, y] = (*base, 255)
    for x in range(16):
        px[x, 0] = (*lt, 255); px[x, 15] = (*dk, 255)
    for (x, y) in [(4, 5), (10, 9), (7, 12), (12, 3)]:
        px[x, y] = (*dk, 255)
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


# ── Echo (청각 감지 적) — 흩날리는 옅은 잔상 ─────────────────────────────────
def draw_echo():
    W, H = 22, 20
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((4, 3, 18, 17), fill=(118, 176, 182, 165))       # 반투명 본체
    d.ellipse((6, 5, 16, 14), fill=(178, 222, 226, 150))
    for x in (7, 11, 15):                                       # 흩어지는 아래 꼬리
        d.line((x, 14, x-1, 20), fill=(150, 210, 212, 150), width=2)
    d.ellipse((8, 8, 11, 12), fill=(52, 226, 226, 220))         # 눈(시안)
    d.ellipse((13, 8, 16, 12), fill=(52, 226, 226, 220))
    d.arc((-2, 1, 7, 19), 300, 60, fill=(154, 246, 246, 150), width=1)   # 소리 고리
    d.arc((-5, -1, 8, 21), 305, 55, fill=(154, 246, 246, 90), width=1)
    return im


def _b64(im):
    buf = io.BytesIO(); im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def export_game_assets():
    """game/assets.js — 배경+스프라이트를 base64 dataURI로 임베드(무서버 실행)."""
    bg = add_vignette(add_glow(build_room(with_entities=False)))     # 챕터1 방
    bg2 = add_vignette(add_glow(build_room2(with_entities=False)))   # 챕터2 집
    bg3 = add_vignette(add_glow(build_room3(with_entities=False)))   # 챕터3 공원
    assets = {
        "room1": _b64(bg), "room2": _b64(bg2), "room3": _b64(bg3),
        "ziro_d0": _b64(draw_cat(0)), "ziro_d1": _b64(draw_cat(1)), "ziro_d2": _b64(draw_cat(2)),
        "ziro_s0": _b64(draw_cat_side(0)), "ziro_s1": _b64(draw_cat_side(1)),
        "murk": _b64(draw_murk()), "echo": _b64(draw_echo()), "shard": _b64(draw_shard()),
    }
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
