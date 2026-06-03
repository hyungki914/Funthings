#!/usr/bin/env python3
"""원화(키아트) 일러스트 — 스테이지 깨달음 시퀀스 + 엔딩용.

손그림 대신 PIL 합성 키아트: 무드 그라데이션(3층 레이어) + 실루엣 구도 +
부드러운 광원/햇살 + 네온 블룸(지로의 빛나는 눈·광원) + 비네팅.
pixelart.py 의 add_glow/add_vignette 파이프라인을 재사용한다.

사용: python3 illust.py           # png/ill_*.png 미리보기 + game/illust.js 생성
"""
import os, io, base64, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import pixelart as P

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "png"); os.makedirs(OUT, exist_ok=True)
W, H = 384, 216                                  # 16:9 원화 캔버스(네이티브)
EYE = (120, 240, 180)                            # 지로 눈빛(연두-청록, 블룸 트리거)

# ── 기본 합성 도구 ───────────────────────────────────────────────
def _lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def vgrad(stops):
    """세로 그라데이션. stops=[(pos0..1,(r,g,b)),...]"""
    col = Image.new("RGB", (1, H))
    for y in range(H):
        t = y/(H-1)
        c = stops[0][1]
        for i in range(len(stops)-1):
            p0, c0 = stops[i]; p1, c1 = stops[i+1]
            if p0 <= t <= p1:
                c = _lerp(c0, c1, (t-p0)/max(1e-6, p1-p0)); break
            if t > p1: c = c1
        col.putpixel((0, y), c)
    return col.resize((W, H)).convert("RGBA")

def glow(img, cx, cy, r, color, strength=1.0):
    """라디얼 광원 — 색을 마스크로 스크린 합성(부드러운 빛/블룸)."""
    m = Image.new("L", (W, H), 0); dm = ImageDraw.Draw(m)
    dm.ellipse((cx-r, cy-r, cx+r, cy+r), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(r*0.5)).point(lambda v: int(v*strength))
    colored = Image.composite(Image.new("RGB", (W, H), color), Image.new("RGB", (W, H), (0, 0, 0)), m)
    return ImageChops.screen(img.convert("RGB"), colored).convert("RGBA")

def rays(img, cx, cy, color, n=7, length=260, spread=2.2, strength=0.5):
    """광원에서 퍼지는 부드러운 빛줄기."""
    L = Image.new("RGB", (W, H), (0, 0, 0)); d = ImageDraw.Draw(L)
    for i in range(n):
        a = -math.pi/2 + (i-(n-1)/2)*(spread/n)
        ex, ey = cx+math.cos(a)*length, cy+math.sin(a)*length
        d.polygon([(cx, cy), (ex-10, ey), (ex+10, ey)], fill=color)
    L = L.filter(ImageFilter.GaussianBlur(9))
    return ImageChops.screen(img.convert("RGB"), ImageChops.multiply(L, Image.new("RGB", (W, H), tuple(int(c*strength) for c in (255, 255, 255))))).convert("RGBA")

def scrim_bottom(img, h=70, a=150):
    """하단 텍스트 가독용 어두운 스크림(자막이 얹힘)."""
    L = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    for y in range(H-h, H):
        d.line((0, y, W, y), fill=(4, 6, 10, int(a*(y-(H-h))/h)))
    return Image.alpha_composite(img, L)

def particles(img, n, color, kind="dust"):
    import random; random.seed(kind+str(n))
    L = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    for _ in range(n):
        x, y = random.randint(0, W), random.randint(0, H)
        r = random.uniform(0.8, 2.2); aa = random.randint(40, 120)
        d.ellipse((x-r, y-r, x+r, y+r), fill=color+(aa,))
    return Image.alpha_composite(img, L)

# ── 실루엣 요소 ──────────────────────────────────────────────────
def cat(d, cx, by, s=1.0, eye=EYE, col=(12, 14, 20), run=False):
    """지로 실루엣(앉음/달림) + 빛나는 눈. by=발 기준선."""
    w, h = int(28*s), int(30*s)
    if run:
        d.ellipse((cx-w//2-int(4*s), by-int(14*s), cx+w//2+int(4*s), by-int(2*s)), fill=col)   # 늘어난 몸
        d.line([(cx-w//2,by-int(8*s)),(cx-w//2-int(12*s),by-int(16*s))], fill=col, width=int(4*s))
        for lx in (-w//2+int(4*s), w//2-int(2*s)):                                              # 뻗은 다리
            d.line([(cx+lx, by-int(4*s)),(cx+lx-int(6*s), by+int(3*s))], fill=col, width=int(3*s))
        hx, hy, hr = cx+int(w*0.5), by-int(16*s), int(10*s)
    else:
        d.ellipse((cx-w//2, by-h, cx+w//2, by), fill=col)                                       # 몸
        d.line([(cx+w//2-2, by-int(6*s)), (cx+w//2+int(9*s), by-int(12*s)), (cx+w//2+int(11*s), by-int(2*s))], fill=col, width=int(4*s))  # 꼬리
        hx, hy, hr = cx, by-h+int(2*s), int(11*s)
    d.ellipse((hx-hr, hy-hr, hx+hr, hy+hr), fill=col)                                            # 머리
    d.polygon([(hx-hr+1, hy-hr+3), (hx-hr-int(3*s), hy-hr-int(8*s)), (hx-int(2*s), hy-hr)], fill=col)   # 귀
    d.polygon([(hx+hr-1, hy-hr+3), (hx+hr+int(3*s), hy-hr-int(8*s)), (hx+int(2*s), hy-hr)], fill=col)
    er = max(1, int(2.3*s))
    for ex in (hx-int(5*s), hx+int(5*s)):                                                        # 눈(블룸)
        d.ellipse((ex-er, hy-er-1, ex+er, hy+er+1), fill=eye)

def person_layer(cx, by, s=1.0, color=(46, 52, 70), alpha=210, blur=1.5, arms="down"):
    """하루(여자아이) 실루엣 — 어깨까지 오는 머리카락 + A라인 원피스 + 가는 다리 + 팔.
    arms: 'down'(차렷) / 'open'(두 팔 벌림, 재회용). by=발 기준선."""
    L = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    col = color + (alpha,); I = lambda v: int(v * s)
    poly = lambda p: d.polygon(p, fill=col)
    # 다리(가늘게, 둘)
    for lx in (-5, 5):
        d.rectangle((cx+I(lx)-I(2), by-I(16), cx+I(lx)+I(2), by), fill=col)
        d.ellipse((cx+I(lx)-I(3), by-I(2), cx+I(lx)+I(3), by+I(2)), fill=col)        # 신발
    # 원피스(A라인: 어깨 좁고 치맛단 넓게) + 치마 주름 헴
    poly([(cx-I(8), by-I(52)), (cx+I(8), by-I(52)), (cx+I(6), by-I(36)),
          (cx+I(18), by-I(15)), (cx-I(18), by-I(15)), (cx-I(6), by-I(36))])
    for hx in range(-14, 15, 7): d.polygon([(cx+I(hx)-I(2), by-I(16)), (cx+I(hx)+I(2), by-I(16)), (cx+I(hx), by-I(11))], fill=col)  # 치맛단 물결
    # 목
    d.rectangle((cx-I(2), by-I(56), cx+I(2), by-I(50)), fill=col)
    # 팔
    if arms == "open":                                                              # 두 팔 벌려 맞이함
        d.line([(cx-I(7), by-I(50)), (cx-I(20), by-I(40)), (cx-I(24), by-I(30))], fill=col, width=max(2, I(4)))
        d.line([(cx+I(7), by-I(50)), (cx+I(20), by-I(40)), (cx+I(24), by-I(30))], fill=col, width=max(2, I(4)))
        for hx in (-24, 24): d.ellipse((cx+I(hx)-I(3), by-I(33), cx+I(hx)+I(3), by-I(27)), fill=col)   # 손
    else:                                                                            # 차렷(몸 옆)
        d.line([(cx-I(8), by-I(50)), (cx-I(12), by-I(30))], fill=col, width=max(2, I(3)))
        d.line([(cx+I(8), by-I(50)), (cx+I(12), by-I(30))], fill=col, width=max(2, I(3)))
    # 머리카락(어깨까지) — 머리 뒤로 큰 덩어리 + 양옆 머리타래
    d.ellipse((cx-I(11), by-I(70), cx+I(11), by-I(48)), fill=col)
    poly([(cx-I(11), by-I(60)), (cx-I(13), by-I(44)), (cx-I(7), by-I(46)), (cx-I(8), by-I(60))])    # 좌 머리타래
    poly([(cx+I(11), by-I(60)), (cx+I(13), by-I(44)), (cx+I(7), by-I(46)), (cx+I(8), by-I(60))])    # 우 머리타래
    # 얼굴(머리카락보다 살짝 작게 — 실루엣이라 같은 색이지만 윤곽이 둥근 소녀로 읽힘)
    d.ellipse((cx-I(8), by-I(68), cx+I(8), by-I(52)), fill=col)
    return L.filter(ImageFilter.GaussianBlur(blur))

def tree(d, cx, base_y, s=1.0, col=(14, 18, 16)):
    d.rectangle((cx-int(4*s), base_y-int(40*s), cx+int(4*s), base_y), fill=col)
    for ox, oy, r in [(0,-46,30),(-22,-36,24),(22,-36,24),(0,-64,22)]:
        d.ellipse((cx+int(ox*s)-int(r*s), base_y+int(oy*s)-int(r*s), cx+int(ox*s)+int(r*s), base_y+int(oy*s)+int(r*s)), fill=col)

def window(d, x, y, w, h, frame=(20, 22, 30), light=(255, 214, 150)):
    d.rectangle((x-3, y-3, x+w+3, y+h+3), fill=frame)
    d.rectangle((x, y, x+w, y+h), fill=light)
    d.line((x+w//2, y, x+w//2, y+h), fill=frame, width=2); d.line((x, y+h//2, x+w, y+h//2), fill=frame, width=2)

def finish(img, glow_r=3.2, vig=0.5):
    return P.add_vignette(P.add_glow(img.convert("RGB"), radius=glow_r), strength=vig).convert("RGBA")

# ── 12장 원화 ────────────────────────────────────────────────────
def s1():   # 지로의 방 — 각성, 창가의 빛
    im = vgrad([(0, (46, 38, 56)), (1, (22, 18, 30))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 168, W, H), fill=(20, 16, 26))                       # 바닥
    window(d, 250, 36, 90, 78, light=(255, 216, 156))
    im = glow(im, 295, 75, 120, (255, 210, 150), 0.7); im = rays(im, 295, 75, (255, 226, 170), 6, 230, 1.6, 0.4)
    d = ImageDraw.Draw(im); cat(d, 150, 176, 1.5, look_up=False) if False else cat(d, 150, 176, 1.6)
    return particles(finish(im), 26, (255, 240, 200), "dust1")

def s2():   # 거실 — 함께한 일상, 빈 소파의 온기
    im = vgrad([(0, (52, 40, 44)), (1, (26, 20, 26))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 170, W, H), fill=(24, 18, 22))
    d.rounded_rectangle((40, 116, 200, 178), 10, fill=(40, 30, 36))       # 소파
    d.rounded_rectangle((150, 150, 168, 170), 4, fill=(150, 110, 70))     # 담요(온기)
    for bx in (236, 262): d.ellipse((bx, 168, bx+16, 178), fill=(30, 24, 26))   # 그릇 둘
    im = glow(im, 110, 150, 90, (255, 196, 140), 0.45)                    # 빈자리에 남은 온기
    d = ImageDraw.Draw(im); cat(d, 250, 176, 1.3)
    return particles(finish(im), 18, (255, 230, 190), "dust2")

def s3():   # 2층 계단 — 무거운 공기, 찬 문빛
    im = vgrad([(0, (28, 34, 52)), (1, (14, 18, 30))]); d = ImageDraw.Draw(im)
    for i in range(7):                                                    # 계단(원근, 위로)
        x0 = 120 + i*22; y0 = 150 - i*18
        d.rectangle((x0, y0, x0+90, y0+14), fill=_lerp((34,40,58),(20,24,38), i/6))
    window(d, 300, 20, 40, 44, frame=(18,22,32), light=(170, 196, 230))   # 위쪽 찬 문빛
    im = glow(im, 320, 42, 70, (150, 180, 220), 0.55)
    d = ImageDraw.Draw(im); cat(d, 96, 188, 1.1)                          # 아래에서 올려다봄
    return finish(im, vig=0.56)

def s4():   # 하루의 방 — 걷힌 이불, 멈춘 시계, 그날 아침
    im = vgrad([(0, (78, 86, 104)), (1, (40, 44, 58))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 170, W, H), fill=(36, 38, 50))
    d.rounded_rectangle((40, 120, 210, 178), 8, fill=(52, 56, 72))        # 침대
    d.polygon([(40, 120), (150, 120), (120, 150), (40, 150)], fill=(82, 88, 108))  # 걷힌 이불
    window(d, 250, 30, 90, 70, frame=(54,58,74), light=(214, 224, 240))   # 새벽 창
    d.ellipse((300, 120, 332, 152), outline=(70, 74, 92), width=3)        # 멈춘 시계
    d.line((316, 136, 316, 124), fill=(70,74,92), width=2); d.line((316, 136, 326, 138), fill=(70,74,92), width=2)
    im = glow(im, 295, 60, 110, (210, 224, 244), 0.5)
    d = ImageDraw.Draw(im); cat(d, 170, 176, 1.2)                         # 빈 쪽에
    return particles(finish(im, vig=0.5), 16, (220, 230, 245), "dust4")

def s5():   # 마당 — 첫 외출, 쏟아지는 햇살, 마른 물그릇
    im = vgrad([(0, (250, 226, 182)), (0.6, (206, 198, 168)), (1, (120, 140, 120))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 150, W, H), fill=(96, 116, 96))                       # 마당
    d.rectangle((0, 0, 64, H), fill=(28, 24, 26)); d.rectangle((46, 40, 64, 150), fill=(40, 34, 32))  # 현관(좌측 어둠)
    d.ellipse((250, 168, 270, 180), fill=(70, 60, 50))                    # 마른 물그릇
    im = glow(im, 300, 30, 150, (255, 244, 200), 0.7); im = rays(im, 300, 20, (255, 240, 200), 8, 320, 2.4, 0.5)
    d = ImageDraw.Draw(im); cat(d, 150, 168, 1.4)                         # 빛으로 나서는
    return particles(finish(im, vig=0.42), 14, (255, 250, 220), "dust5")

def s6():   # 길거리 — 두 줄→한 줄 발자국, 황혼 가로등
    im = vgrad([(0, (64, 58, 100)), (1, (28, 28, 48))]); d = ImageDraw.Draw(im)
    d.polygon([(150, 120), (234, 120), (320, H), (40, H)], fill=(34, 32, 50))   # 도로 원근
    for i in range(6):                                                   # 발자국(한 줄)
        d.ellipse((180+i*8, 150+i*9, 186+i*8, 156+i*9), fill=(70, 66, 92))
    d.rectangle((300, 70, 305, 150), fill=(24, 24, 36));
    im = glow(im, 302, 66, 64, (255, 222, 150), 0.7)                     # 가로등
    d = ImageDraw.Draw(im); cat(d, 150, 180, 1.2)
    return particles(finish(im, vig=0.52), 12, (200, 200, 230), "leaf6")

def s7():   # 상가 — 카페 창의 따뜻한 추억
    im = vgrad([(0, (58, 44, 40)), (1, (30, 24, 26))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 172, W, H), fill=(26, 22, 24))
    d.rectangle((150, 40, 360, 168), fill=(20, 18, 22))                  # 가게 벽
    window(d, 170, 60, 170, 92, frame=(40, 32, 30), light=(255, 206, 146))  # 카페 창(추억)
    pl = person_layer(230, 150, 0.9, (90, 70, 60), 180, 2.0); im = Image.alpha_composite(im, pl)  # 안쪽 흐릿한 사람
    d = ImageDraw.Draw(im); cat(d, 252, 150, 0.8, col=(30, 24, 22))      # 추억 속 작은 지로
    im = glow(im, 255, 100, 120, (255, 200, 140), 0.5)
    d = ImageDraw.Draw(im); cat(d, 96, 178, 1.3)                         # 창밖에서 바라보는 지로
    return particles(finish(im, vig=0.48), 14, (255, 224, 180), "dust7")

def s8():   # 공원 입구 — 문을 미는 결심, 문 너머 빛
    im = vgrad([(0, (214, 196, 146)), (1, (110, 120, 104))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 156, W, H), fill=(96, 104, 88))
    d.rectangle((60, 30, 150, 170), fill=(28, 30, 26)); d.rectangle((234, 30, 324, 170), fill=(28, 30, 26))  # 게이트 기둥
    d.rectangle((150, 24, 158, 170), fill=(34, 36, 30)); d.rectangle((226, 24, 234, 170), fill=(34, 36, 30))
    im = glow(im, 192, 96, 120, (255, 242, 196), 0.8); im = rays(im, 192, 80, (255, 240, 200), 7, 240, 1.4, 0.45)  # 문 너머 빛
    d = ImageDraw.Draw(im); cat(d, 192, 176, 1.3)                        # 문 앞 결심
    return finish(im, vig=0.46)

def s9():   # 공원 — 벤치, 기다림, 멀리 다가오는 흐릿한 형체
    im = vgrad([(0, (244, 202, 150)), (0.55, (196, 170, 150)), (1, (96, 100, 120))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 158, W, H), fill=(86, 96, 90))
    tree(d, 86, 158, 1.3)
    d.rectangle((150, 138, 250, 150), fill=(40, 30, 22)); d.rectangle((150, 126, 250, 138), fill=(52, 40, 28))  # 벤치
    for lx in (156, 240): d.rectangle((lx, 150, lx+4, 166), fill=(28, 20, 14))
    im = glow(im, 40, 40, 150, (255, 232, 176), 0.6); im = rays(im, 30, 30, (255, 234, 184), 7, 300, 1.8, 0.4)
    pl = person_layer(338, 150, 0.8, (150, 150, 160), 120, 3.5); im = Image.alpha_composite(im, pl)  # 멀리 흐린 형체
    d = ImageDraw.Draw(im); cat(d, 200, 138, 1.1)                        # 벤치 위에서 기다림
    return particles(finish(im, vig=0.5), 14, (240, 220, 180), "leaf9")

def s10():  # 빈자리 — 어둠 속 떠오르는 이름표 '지로', 빛으로 차오르는 공백
    im = vgrad([(0, (16, 18, 28)), (1, (8, 9, 14))]); d = ImageDraw.Draw(im)
    im = glow(im, W//2, 92, 130, (90, 200, 190), 0.7)                    # 중앙 떠오르는 빛
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((W//2-58, 66, W//2+58, 104), 8, outline=(120, 240, 210), width=2)   # 이름표
    try:
        d.text((W//2, 85), "지로", font=P._font(26), fill=(170, 250, 220), anchor="mm")
    except Exception:
        d.text((W//2-22, 74), "지로", font=P._font(26), fill=(170, 250, 220))
    cat(d, W//2, 188, 1.5, eye=(150, 250, 200))
    return finish(im, glow_r=4.0, vig=0.46)

def end_reunite():  # 재회 — 달려가 안기는 재회, 따뜻한 그린 빛
    im = vgrad([(0, (30, 42, 22)), (1, (10, 14, 8))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 170, W, H), fill=(20, 26, 14))
    # 빛/광선을 먼저(배경) → 그 위에 하루 실루엣을 그려 또렷이 읽히게(클라이맥스 임팩트)
    im = glow(im, 290, 120, 180, (150, 240, 120), 0.75); im = rays(im, 290, 104, (180, 255, 150), 9, 300, 2.6, 0.5)
    pl = person_layer(290, 184, 1.3, (34, 44, 26), 255, 0.5, arms="open")   # 하루 — 두 팔 벌린 소녀 실루엣(빛 위)
    im = Image.alpha_composite(im, pl)
    d = ImageDraw.Draw(im)
    d.ellipse((281, 106, 299, 124), outline=(210, 255, 180), width=1)    # 머리 역광 림라이트
    cat(d, 150, 184, 1.4, run=True, eye=(180, 255, 150))                 # 달려가는 지로
    return particles(finish(im, glow_r=3.4, vig=0.42), 20, (200, 255, 180), "spark")

def end_stray():    # 길고양이 — 새벽 골목, 물그릇, 다른 고양이들, 열린 하늘
    im = vgrad([(0, (150, 188, 196)), (0.5, (110, 150, 162)), (1, (60, 86, 96))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 150, W, H), fill=(54, 70, 76))                        # 골목 바닥
    d.rectangle((0, 90, 70, 150), fill=(40, 52, 58)); d.rectangle((320, 80, W, 150), fill=(40, 52, 58))  # 양옆 담
    d.ellipse((180, 168, 202, 180), fill=(70, 110, 120)); d.ellipse((184, 170, 198, 176), fill=(120, 210, 220))  # 물그릇
    im = glow(im, 300, 36, 150, (220, 240, 220), 0.55); im = rays(im, 300, 24, (220, 244, 226), 7, 280, 2.0, 0.35)  # 새벽 빛
    d = ImageDraw.Draw(im)
    cat(d, 120, 176, 1.4, eye=(90, 230, 200))                            # 지로
    cat(d, 232, 178, 0.8, col=(40, 50, 54), eye=(120, 210, 200))         # 다른 고양이
    cat(d, 260, 176, 0.7, col=(46, 56, 60), eye=(120, 210, 200))
    return particles(finish(im, vig=0.44), 16, (210, 235, 235), "dawn")

def title_art():   # 타이틀 — 서정적. 따뜻한 빛을 올려다보는 지로 + 빛나는 발자국 길
    im = vgrad([(0, (30, 26, 46)), (0.55, (24, 22, 38)), (1, (14, 14, 24))]); d = ImageDraw.Draw(im)
    d.rectangle((0, 176, W, H), fill=(16, 15, 26))                       # 바닥
    im = glow(im, 300, 40, 150, (255, 222, 160), 0.65)                  # 우상단 따뜻한 빛(창/달)
    im = rays(im, 300, 30, (255, 232, 180), 7, 280, 1.8, 0.4)
    d = ImageDraw.Draw(im)
    for i, (fx, fy) in enumerate([(120, 176), (150, 168), (182, 158), (214, 146), (244, 132), (272, 116)]):  # 빛나는 발자국 길
        a = 90 + i * 22
        d.ellipse((fx-3, fy-2, fx+3, fy+2), fill=(110, 230, 180))
        d.ellipse((fx-1, fy-4, fx+1, fy-2), fill=(150, 245, 200))
    cat(d, 110, 184, 1.7, eye=(140, 245, 190))                          # 올려다보는 지로
    return particles(finish(im, glow_r=3.6, vig=0.5), 26, (255, 240, 205), "title")

ILL = {"title": title_art,
       "s1": s1, "s2": s2, "s3": s3, "s4": s4, "s5": s5, "s6": s6, "s7": s7,
       "s8": s8, "s9": s9, "s10": s10, "reunite": end_reunite, "stray": end_stray}


def _b64(im):
    q = im.convert("RGB").quantize(colors=96, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    buf = io.BytesIO(); q.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def export_illustrations():
    game = os.path.join(HERE, "..", "game")
    lines = ["// 자동 생성 — art/illust.py export_illustrations(). 원화 키아트(스테이지 깨달음+엔딩).",
             "const ILL = {"]
    for k, fn in ILL.items():
        lines.append(f'  {k}: "{_b64(fn())}",')
    lines += ["};", "if (typeof module !== 'undefined') module.exports = ILL;"]
    path = os.path.join(game, "illust.js")
    with open(path, "w") as f: f.write("\n".join(lines) + "\n")
    print("exported", path, f"({os.path.getsize(path)//1024} KB)")


if __name__ == "__main__":
    for k, fn in ILL.items():
        fn().resize((W*2, H*2), Image.LANCZOS).save(f"{OUT}/ill_{k}.png")
    export_illustrations()
    print("illustrations rendered ->", OUT)
