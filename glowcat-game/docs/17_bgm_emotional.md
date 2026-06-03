# 17. BGM — 감정 시퀀스 테마 (Emotional BGM)

『잊혀진 발자국 / Lost Pawprint』 — 지로(고양이)·하루(주인). 분리→재회의 서정.

이 문서는 `game/audio.js`의 `MUSIC_THEMES = { ... }`에 **그대로 드롭인** 가능한 4개의 새 테마와,
기존 스테이지 테마(room/house/park/haru/town)의 B섹션 변주 제안을 담는다.

## 음정 규약 (검증 기준)

A4 = 0 반음. 멜로디는 A3(-12)~C6(15) 음역, 패드는 코드톤(C2~D4), 베이스는 루트/5도(C1~D3).

```
A2=-24 B2=-22 C3=-21 D3=-19 E3=-17 F3=-16 G3=-14 A3=-12
C4=-9 D4=-7 E4=-5 F4=-4 G4=-2 A4=0 B4=2
C5=3 C#5=4 D5=5 D#5=6 E5=7 F5=8 F#5=9 G5=10 G#5=11 A5=12 B5=14 C6=15
저음: A1=-36 C2=-33 D2=-31 E2=-29 F2=-28 G2=-26 A2=-24 C1=-45 등
```

검증 포인트(공통):
- **음역 분리**: mel은 대부분 0(A4)~15(C6), pad는 -21~-5(C3~E4) 코드톤 보이싱, bass는 -33~-19(C2~D3) 루트. 겹침 없음.
- **루프 정합**: 각 노트 `t + (dur/stepDur)`가 루프 끝(steps)을 크게 넘기지 않거나, 의도된 sustain은 다음 루프 머리에서 자연 감쇠(ADSR release)로 처리됨. 긴 패드/드론은 의도적으로 루프를 넘겨 끊김 없는 깔개로 사용.
- **dur 단위는 초**. stepDur*steps = 루프 길이(초). 예: title은 0.40*32=12.8초 루프.

---

## 1) `title` — 타이틀 테마

- **조성**: C major ↔ A minor 교차 (Am–F–C–G | Dm–G–C). 시작의 설렘 + 그리움.
- **템포**: stepDur 0.40 / steps 32 → 12.8초 루프, 약 BPM 150의 8분 격자(아르페지오).
- **멜로디 윤곽(메인 훅)**: E5–G5–A5 … C6–B5–A5–G5 (열리며 올랐다 부드럽게 내려앉음) → 후반 D5–E5–G5–E5–D5–C5 (그리움으로 해소).
- **패드 코드 진행**: Am(A-C-E) → F(F-A-C) → C(C-E-G) → G(G-B-D).
- **베이스**: 워킹 — A2 →(E2 경유)→ F2 → C2 →(G2 경유). 루트+5도 디딤.

```js
  // title: 서정적·기대감. 따뜻하지만 살짝 아련. 부드러운 아르페지오(triangle) + 노래하는 메인 훅(sine).
  // C major ↔ A minor 교차: Am - F - C - G. '시작의 설렘 + 그리움'. 12.8초 루프.
  title: {
    stepDur: 0.40, steps: 32, melType: 'sine', padType: 'triangle', bassType: 'sine', melVol: 0.95, padVol: 0.65,
    patterns: [
      // ── 부드러운 아르페지오(triangle, 8분) — 코드를 흐르게. mel 보조성부, 약하게.
      { t: 0,  note: 0,  dur: 0.45, vol: 0.34, voice: 'mel', type: 'triangle' }, // A4  (Am)
      { t: 1,  note: 3,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' }, // C5
      { t: 2,  note: 7,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' }, // E5
      { t: 3,  note: 12, dur: 0.45, vol: 0.28, voice: 'mel', type: 'triangle' }, // A5
      { t: 8,  note: -4, dur: 0.45, vol: 0.32, voice: 'mel', type: 'triangle' }, // F4  (F)
      { t: 9,  note: 0,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' }, // A4
      { t: 10, note: 3,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' }, // C5
      { t: 11, note: 8,  dur: 0.45, vol: 0.28, voice: 'mel', type: 'triangle' }, // F5
      { t: 16, note: 3,  dur: 0.45, vol: 0.32, voice: 'mel', type: 'triangle' }, // C5  (C)
      { t: 17, note: 7,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' }, // E5
      { t: 18, note: 10, dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' }, // G5
      { t: 19, note: 15, dur: 0.45, vol: 0.28, voice: 'mel', type: 'triangle' }, // C6
      { t: 24, note: 2,  dur: 0.45, vol: 0.32, voice: 'mel', type: 'triangle' }, // B4  (G)
      { t: 25, note: 5,  dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' }, // D5
      { t: 26, note: 10, dur: 0.45, vol: 0.30, voice: 'mel', type: 'triangle' }, // G5
      { t: 27, note: 14, dur: 0.45, vol: 0.28, voice: 'mel', type: 'triangle' }, // B5
      // ── 메인 훅(sine, 노래하는 라인) — 아르페지오 위로 또렷이. 열렸다 내려앉음.
      { t: 4,  note: 7,  dur: 1.1, vol: 0.62, voice: 'mel', type: 'sine' },      // E5  훅 시작
      { t: 6,  note: 10, dur: 0.9, vol: 0.60, voice: 'mel', type: 'sine' },      // G5  올라
      { t: 12, note: 12, dur: 1.4, vol: 0.64, voice: 'mel', type: 'sine' },      // A5  정점(F 위 6도, 설렘)
      { t: 20, note: 15, dur: 1.0, vol: 0.60, voice: 'mel', type: 'sine' },      // C6  더 열림
      { t: 22, note: 14, dur: 0.9, vol: 0.55, voice: 'mel', type: 'sine' },      // B5
      { t: 28, note: 10, dur: 0.7, vol: 0.55, voice: 'mel', type: 'sine' },      // G5  하강 해소
      { t: 30, note: 7,  dur: 1.6, vol: 0.52, voice: 'mel', type: 'sine' },      // E5  → C장조 안착의 여운(루프 연결)
      // ── 패드(코드 보이싱, 마디=8스텝, 길게). Am - F - C - G.
      { t: 0,  note: -9,  dur: 3.0, vol: 0.42, voice: 'pad', type: 'triangle' }, // C4 (Am: 3rd)
      { t: 0,  note: -5,  dur: 3.0, vol: 0.38, voice: 'pad', type: 'triangle' }, // E4
      { t: 8,  note: -4,  dur: 3.0, vol: 0.42, voice: 'pad', type: 'triangle' }, // F4 (F)
      { t: 8,  note: 0,   dur: 3.0, vol: 0.38, voice: 'pad', type: 'triangle' }, // A4
      { t: 16, note: -5,  dur: 3.0, vol: 0.42, voice: 'pad', type: 'triangle' }, // E4 (C: 3rd)
      { t: 16, note: -2,  dur: 3.0, vol: 0.38, voice: 'pad', type: 'triangle' }, // G4
      { t: 24, note: -7,  dur: 3.0, vol: 0.42, voice: 'pad', type: 'triangle' }, // D4 (G: 5th)
      { t: 24, note: 2,   dur: 3.0, vol: 0.36, voice: 'pad', type: 'triangle' }, // B4
      // ── 워킹 베이스(루트+경과 5도). A2→F2→C2→G2, 마디 중간 5도로 디딤.
      { t: 0,  note: -24, dur: 1.5, vol: 0.6, voice: 'bass', type: 'sine' },     // A2
      { t: 4,  note: -29, dur: 1.5, vol: 0.5, voice: 'bass', type: 'sine' },     // E2 (5th 디딤)
      { t: 8,  note: -28, dur: 1.5, vol: 0.6, voice: 'bass', type: 'sine' },     // F2
      { t: 12, note: -33, dur: 1.5, vol: 0.5, voice: 'bass', type: 'sine' },     // C2 (5th 디딤)
      { t: 16, note: -33, dur: 1.5, vol: 0.6, voice: 'bass', type: 'sine' },     // C2
      { t: 20, note: -26, dur: 1.5, vol: 0.5, voice: 'bass', type: 'sine' },     // G2 (5th 디딤)
      { t: 24, note: -26, dur: 1.5, vol: 0.6, voice: 'bass', type: 'sine' },     // G2
      { t: 28, note: -31, dur: 1.7, vol: 0.5, voice: 'bass', type: 'sine' },     // D2 (G→다음 Am 준비)
    ],
  },
```

---

## 2) `memory` — 깨달음(회상 몽타주) 테마

- **조성**: F major (점층). Fmaj7–Csus–Dm–Bb 풍. 절제되되 차오름.
- **템포**: stepDur 0.46 / steps 32 → 14.72초 루프. 느릿한 호흡, 피아노 같은 triangle.
- **멜로디 윤곽(상승 모티프)**: A4–C5–F5 (한 호흡 올라) → G5–A5 (조금 더) → 후반 C5–D5–F5–G5–A5–C6 (몽타주 후반 루프에서 가장 벅차게 정점). 매 4마디 모티프가 한 단계씩 위로.
- **패드 코드 진행**: Fmaj7(F-A-C-E) → Csus4→C(C-F-G→C-E-G) → Dm(D-F-A) → Bb(Bb-D-F).
- **베이스**: F2 → C2 → D2 → Bb1. 루트 디딤 + 마디 끝 5도 경과.

```js
  // memory: 깨달음(회상 몽타주). 잔잔히 시작해 점층적으로 차오름. 피아노 같은 triangle + 따뜻한 패드.
  // F major: Fmaj7 - C - Dm - Bb. 상승 모티프(매 마디 한 단계 위로). 14.72초 루프 — 몽타주 반복 중 벅차오름.
  memory: {
    stepDur: 0.46, steps: 32, melType: 'triangle', padType: 'sine', bassType: 'sine', melVol: 0.95, padVol: 0.7,
    patterns: [
      // ── 멜로디(triangle, 피아노 같은 단음) — 상승 모티프. 마디1 잔잔→마디4 정점.
      // 마디1 (Fmaj7): A4 → C5 → F5  (첫 호흡, 여리게)
      { t: 0,  note: 0,  dur: 1.1, vol: 0.48, voice: 'mel', type: 'triangle' },  // A4
      { t: 3,  note: 3,  dur: 1.1, vol: 0.50, voice: 'mel', type: 'triangle' },  // C5
      { t: 6,  note: 8,  dur: 1.4, vol: 0.55, voice: 'mel', type: 'triangle' },  // F5  (첫 상승점)
      // 마디2 (C): G5 → A5  (조금 더 차오름)
      { t: 8,  note: 7,  dur: 1.0, vol: 0.55, voice: 'mel', type: 'triangle' },  // E5
      { t: 11, note: 10, dur: 1.2, vol: 0.60, voice: 'mel', type: 'triangle' },  // G5
      { t: 14, note: 12, dur: 1.4, vol: 0.62, voice: 'mel', type: 'triangle' },  // A5
      // 마디3 (Dm): F5 → A5 → C6  (감정 상승 모티프 반복, 한 옥타브 가까이)
      { t: 16, note: 8,  dur: 1.0, vol: 0.58, voice: 'mel', type: 'triangle' },  // F5
      { t: 19, note: 12, dur: 1.1, vol: 0.62, voice: 'mel', type: 'triangle' },  // A5
      { t: 22, note: 15, dur: 1.5, vol: 0.68, voice: 'mel', type: 'triangle' },  // C6  (정점, 벅참)
      // 마디4 (Bb): A5 → G5 → F5  (해소 직전 부드러운 하강, 다시 첫 호흡으로)
      { t: 24, note: 12, dur: 1.0, vol: 0.60, voice: 'mel', type: 'triangle' },  // A5
      { t: 27, note: 10, dur: 1.0, vol: 0.56, voice: 'mel', type: 'triangle' },  // G5
      { t: 29, note: 8,  dur: 1.8, vol: 0.54, voice: 'mel', type: 'triangle' },  // F5 → 루프 머리로 여운
      // ── 따뜻한 패드(sine, 코드 보이싱, 길게)
      { t: 0,  note: -4, dur: 3.4, vol: 0.40, voice: 'pad', type: 'sine' },      // F4 (Fmaj7)
      { t: 0,  note: 0,  dur: 3.4, vol: 0.34, voice: 'pad', type: 'sine' },      // A4
      { t: 0,  note: -9, dur: 3.4, vol: 0.30, voice: 'pad', type: 'sine' },      // C4
      { t: 8,  note: -5, dur: 3.4, vol: 0.40, voice: 'pad', type: 'sine' },      // E4 (C)
      { t: 8,  note: -2, dur: 3.4, vol: 0.34, voice: 'pad', type: 'sine' },      // G4
      { t: 16, note: -4, dur: 3.4, vol: 0.40, voice: 'pad', type: 'sine' },      // F4 (Dm)
      { t: 16, note: 0,  dur: 3.4, vol: 0.34, voice: 'pad', type: 'sine' },      // A4
      { t: 24, note: -7, dur: 3.4, vol: 0.40, voice: 'pad', type: 'sine' },      // D4 (Bb)
      { t: 24, note: -4, dur: 3.4, vol: 0.34, voice: 'pad', type: 'sine' },      // F4
      // ── 베이스(루트 디딤 + 5도 경과). F2 - C2 - D2 - Bb1.
      { t: 0,  note: -28, dur: 2.6, vol: 0.55, voice: 'bass', type: 'sine' },    // F2
      { t: 6,  note: -33, dur: 1.2, vol: 0.40, voice: 'bass', type: 'sine' },    // C2 (5th 경과)
      { t: 8,  note: -33, dur: 2.6, vol: 0.55, voice: 'bass', type: 'sine' },    // C2
      { t: 16, note: -31, dur: 2.6, vol: 0.55, voice: 'bass', type: 'sine' },    // D2 (Dm)
      { t: 24, note: -34, dur: 3.0, vol: 0.55, voice: 'bass', type: 'sine' },    // Bb1
      // 아주 낮은 서브 드론(전체 깔개)
      { t: 0,  note: -40, dur: 15.0, vol: 0.34, voice: 'bass', type: 'sine' },   // F1
    ],
  },
```

---

## 3) `ending_reunite` — 재회 엔딩

- **조성**: D major (밝고 넓게 열림). D–G–A–Bm–G–A–D. 감격적 클라이맥스, 마지막에 루트(D)로 종지 해소.
- **템포**: stepDur 0.44 / steps 32 → 14.08초 루프. 풍성한 패드 + 움직이는 베이스.
- **멜로디 윤곽**: F#5–A5–D6 (넓게 솟구침) → B5–A5–F#5 (벅차게 내려) → E5–F#5–G5–A5 (다시 차올라) → D6···A5···F#5···D5 (종지, 루트로 안착).
- **패드 코드 진행**: D(D-F#-A) → G(G-B-D) → A(A-C#-E) → Bm(B-D-F#) → G → A → **D(해소)**.
- **베이스**: 움직이는 워킹 — D2→A2(5도)→G2→D2→A2→D2. 마지막 마디 D 루트로 안착.

```js
  // ending_reunite: 재회 엔딩. 감격·따뜻한 클라이맥스. 넓게 열리는 멜로디 + 풍성한 패드 + 움직이는 베이스.
  // D major: D - G - A - Bm - G - A - D. 마지막에 루트 D로 종지 해소. 14.08초 루프.
  ending_reunite: {
    stepDur: 0.44, steps: 32, melType: 'sine', padType: 'triangle', bassType: 'sine', melVol: 1.0, padVol: 0.72,
    patterns: [
      // ── 멜로디(sine, 넓게 노래) — 솟구쳤다 벅차게 내려, 다시 차올라 종지.
      // 프레이즈1 (D→G): F#5 → A5 → D6  (열림)
      { t: 0,  note: 9,  dur: 1.0, vol: 0.66, voice: 'mel', type: 'sine' },      // F#5
      { t: 2,  note: 12, dur: 1.0, vol: 0.68, voice: 'mel', type: 'sine' },      // A5
      { t: 4,  note: 17, dur: 1.6, vol: 0.74, voice: 'mel', type: 'sine' },      // D6  (정점, 활짝)
      { t: 8,  note: 14, dur: 1.0, vol: 0.66, voice: 'mel', type: 'sine' },      // B5  (G 위)
      { t: 10, note: 12, dur: 1.0, vol: 0.62, voice: 'mel', type: 'sine' },      // A5
      { t: 12, note: 9,  dur: 1.4, vol: 0.60, voice: 'mel', type: 'sine' },      // F#5  내려앉음
      // 프레이즈2 (A→Bm): E5 → F#5 → A5 → B5  (다시 차오름)
      { t: 16, note: 7,  dur: 1.0, vol: 0.62, voice: 'mel', type: 'sine' },      // E5
      { t: 18, note: 9,  dur: 1.0, vol: 0.64, voice: 'mel', type: 'sine' },      // F#5
      { t: 20, note: 12, dur: 1.0, vol: 0.66, voice: 'mel', type: 'sine' },      // A5
      { t: 22, note: 14, dur: 1.4, vol: 0.70, voice: 'mel', type: 'sine' },      // B5  (Bm, 감격)
      // 프레이즈3 (G→A→D): D6 → A5 → F#5 → D5  (종지, 루트로 안착)
      { t: 24, note: 17, dur: 1.0, vol: 0.70, voice: 'mel', type: 'sine' },      // D6
      { t: 26, note: 12, dur: 1.0, vol: 0.64, voice: 'mel', type: 'sine' },      // A5
      { t: 28, note: 9,  dur: 1.0, vol: 0.60, voice: 'mel', type: 'sine' },      // F#5
      { t: 30, note: 5,  dur: 2.0, vol: 0.62, voice: 'mel', type: 'sine' },      // D5  (해소·루트 안착, 긴 여운)
      // ── 풍성한 패드(triangle, 3성 보이싱). D - G - A - Bm - G - A - D(해소).
      { t: 0,  note: -7, dur: 3.2, vol: 0.42, voice: 'pad', type: 'triangle' },  // D4 (D)
      { t: 0,  note: -3, dur: 3.2, vol: 0.36, voice: 'pad', type: 'triangle' },  // F#4
      { t: 0,  note: 0,  dur: 3.2, vol: 0.32, voice: 'pad', type: 'triangle' },  // A4
      { t: 8,  note: -2, dur: 3.2, vol: 0.42, voice: 'pad', type: 'triangle' },  // G4 (G)
      { t: 8,  note: 2,  dur: 3.2, vol: 0.36, voice: 'pad', type: 'triangle' },  // B4
      { t: 12, note: 0,  dur: 1.6, vol: 0.40, voice: 'pad', type: 'triangle' },  // A4 (A)
      { t: 12, note: 4,  dur: 1.6, vol: 0.34, voice: 'pad', type: 'triangle' },  // C#5
      { t: 16, note: -7, dur: 3.2, vol: 0.42, voice: 'pad', type: 'triangle' },  // D4 (Bm: 3rd 위)
      { t: 16, note: -1, dur: 3.2, vol: 0.36, voice: 'pad', type: 'triangle' },  // F#4
      { t: 16, note: 2,  dur: 3.2, vol: 0.32, voice: 'pad', type: 'triangle' },  // B4
      { t: 24, note: -7, dur: 4.0, vol: 0.44, voice: 'pad', type: 'triangle' },  // D4 (D 종지)
      { t: 24, note: -3, dur: 4.0, vol: 0.38, voice: 'pad', type: 'triangle' },  // F#4
      { t: 24, note: 0,  dur: 4.0, vol: 0.34, voice: 'pad', type: 'triangle' },  // A4
      // ── 움직이는 베이스(워킹). D2 - A2 - G2 - D2 - A2 - D2(안착).
      { t: 0,  note: -31, dur: 1.6, vol: 0.6, voice: 'bass', type: 'sine' },     // D2
      { t: 4,  note: -24, dur: 1.6, vol: 0.5, voice: 'bass', type: 'sine' },     // A2 (5th)
      { t: 8,  note: -26, dur: 1.6, vol: 0.6, voice: 'bass', type: 'sine' },     // G2
      { t: 12, note: -24, dur: 1.6, vol: 0.55, voice: 'bass', type: 'sine' },    // A2 (A)
      { t: 16, note: -22, dur: 1.6, vol: 0.6, voice: 'bass', type: 'sine' },     // B2 (Bm)
      { t: 20, note: -24, dur: 1.6, vol: 0.5, voice: 'bass', type: 'sine' },     // A2 (A)
      { t: 24, note: -31, dur: 3.4, vol: 0.62, voice: 'bass', type: 'sine' },    // D2 (루트 종지 안착)
      // 낮은 서브
      { t: 0,  note: -43, dur: 14.5, vol: 0.36, voice: 'bass', type: 'sine' },   // D1
    ],
  },
```

---

## 4) `ending_stray` — 길고양이(새 삶) 엔딩

- **조성**: G Lydian (G major + #4=C#) — 새벽빛의 시린 밝음. G–D–Em–C#dim암시(리디안 색채). 쓸쓸하되 자유로운.
- **템포**: stepDur 0.52 / steps 32 → 16.64초 루프. 잔잔히 흐르고 멀리 트임(넓은 여백).
- **멜로디 윤곽**: D5–G5–B5 (맑게 올라) → C#6(리디안 #11, 시린 색) → A5–G5 (트인 채 내려) → 후반 B5–D6···G5 (멀리 사라지듯). 여백 많고 음 사이가 넓음.
- **패드 코드 진행**: Gmaj(G-B-D) → D/F#(F#-A-D) → Em7(E-G-B-D) → Cadd#11(C-E-G + C# 색). 길게 깔리며 트임.
- **베이스**: G2 → D2(5도) → E2 → C2. 느릿한 루트, 마지막은 G로 멀리 트이며 열린 채 끝.

```js
  // ending_stray: 길고양이(새 삶) 엔딩. 차분·존엄한 희망. 새벽빛 같은 맑은 멜로디(G Lydian #4=C#).
  // 잔잔히 흐르며 멀리 트임. 쓸쓸하되 따뜻하고 자유로움. 16.64초 루프, 넓은 여백.
  ending_stray: {
    stepDur: 0.52, steps: 32, melType: 'sine', padType: 'sine', bassType: 'sine', melVol: 0.9, padVol: 0.68,
    patterns: [
      // ── 멜로디(sine, 맑고 넓은 여백) — 올랐다 트인 채 멀리 사라짐. 리디안 #11(C#)이 시린 색.
      { t: 0,  note: 5,  dur: 1.6, vol: 0.58, voice: 'mel', type: 'sine' },      // D5
      { t: 3,  note: 10, dur: 1.6, vol: 0.60, voice: 'mel', type: 'sine' },      // G5
      { t: 6,  note: 14, dur: 2.0, vol: 0.62, voice: 'mel', type: 'sine' },      // B5  (맑게 올라)
      { t: 10, note: 16, dur: 1.8, vol: 0.56, voice: 'mel', type: 'sine' },      // C#6 (리디안 #11, 시린 새벽빛)
      { t: 14, note: 12, dur: 2.2, vol: 0.55, voice: 'mel', type: 'sine' },      // A5  트인 채 내려
      // (여백) — 16~17 비움, 멀리 트임
      { t: 18, note: 10, dur: 1.8, vol: 0.52, voice: 'mel', type: 'sine' },      // G5
      { t: 21, note: 14, dur: 1.6, vol: 0.54, voice: 'mel', type: 'sine' },      // B5
      { t: 24, note: 17, dur: 2.0, vol: 0.56, voice: 'mel', type: 'sine' },      // D6  (멀리 한번 더 트임)
      { t: 28, note: 12, dur: 1.4, vol: 0.46, voice: 'mel', type: 'sine' },      // A5
      { t: 30, note: 10, dur: 2.4, vol: 0.44, voice: 'mel', type: 'sine' },      // G5  (열린 채 사라짐, 루프 연결)
      // ── 패드(sine, 길게 트이는 깔개). Gmaj - D/F# - Em7 - Cadd#11.
      { t: 0,  note: -2, dur: 4.0, vol: 0.40, voice: 'pad', type: 'sine' },      // G4 (G)
      { t: 0,  note: 2,  dur: 4.0, vol: 0.34, voice: 'pad', type: 'sine' },      // B4
      { t: 0,  note: -7, dur: 4.0, vol: 0.30, voice: 'pad', type: 'sine' },      // D4
      { t: 8,  note: -3, dur: 4.0, vol: 0.40, voice: 'pad', type: 'sine' },      // F#4 (D/F#)
      { t: 8,  note: 0,  dur: 4.0, vol: 0.32, voice: 'pad', type: 'sine' },      // A4
      { t: 16, note: -5, dur: 4.0, vol: 0.40, voice: 'pad', type: 'sine' },      // E4 (Em7)
      { t: 16, note: -2, dur: 4.0, vol: 0.34, voice: 'pad', type: 'sine' },      // G4
      { t: 16, note: 2,  dur: 4.0, vol: 0.28, voice: 'pad', type: 'sine' },      // B4
      { t: 24, note: -9, dur: 4.0, vol: 0.40, voice: 'pad', type: 'sine' },      // C4 (Cadd#11)
      { t: 24, note: -5, dur: 4.0, vol: 0.32, voice: 'pad', type: 'sine' },      // E4
      { t: 24, note: 4,  dur: 4.0, vol: 0.24, voice: 'pad', type: 'sine' },      // C#5 (#11 색, 아주 여리게)
      // ── 베이스(느린 루트). G2 - D2 - E2 - C2. 마지막 G로 열린 채.
      { t: 0,  note: -26, dur: 3.6, vol: 0.55, voice: 'bass', type: 'sine' },    // G2
      { t: 8,  note: -31, dur: 3.6, vol: 0.50, voice: 'bass', type: 'sine' },    // D2 (5th)
      { t: 16, note: -29, dur: 3.6, vol: 0.52, voice: 'bass', type: 'sine' },    // E2
      { t: 24, note: -33, dur: 3.6, vol: 0.52, voice: 'bass', type: 'sine' },    // C2
      // 낮은 서브 드론(전체 깔개, 멀리 트임)
      { t: 0,  note: -38, dur: 17.0, vol: 0.34, voice: 'bass', type: 'sine' },   // G1
    ],
  },
```

---

## 기존 스테이지 테마 — B섹션(변주) 제안

각 테마는 현재 A섹션 1패턴만 루프하여 단조롭다. 아래는 **실제 추가 가능한 패턴 라인**(같은 patterns 배열에 추가) 또는 방향이다.
공통 원칙: 메인 코드 진행은 유지, mel 모티프를 **응답구(call→response)** 또는 **상위 옥타브 변주**로 추가해 2회차 루프에서 변화감을 줌.
(엔진이 단일 패턴을 루프하므로, 진정한 A/B 교차가 필요하면 `room`/`roomB` 두 키를 두고 `setMusic` 쪽에서 N루프마다 토글하는 방식을 권장. 아래는 즉시 효과를 보는 "동일 루프 내 보강".)

### room (Am–F–C–G, 0.34/32)
- **응답구 추가**: 마디 끝 단2도(A#4) 긴장 대신, 두 번째 절 느낌으로 상위 옥타브 반짝임 1점.
```js
      // [B변주] 마디2·마디4 끝에 옥타브 위 응답(여리게) — 같은 코드톤, 그리움 강조
      { t: 14, note: 8,  dur: 0.5, vol: 0.35, voice: 'mel', type: 'triangle' },  // F5 (마디2 F의 옥타브 응답)
      { t: 31, note: 7,  dur: 0.6, vol: 0.30, voice: 'mel', type: 'triangle' },  // E5 (마디4 끝 풀림, A#4 긴장을 살짝 위무)
```

### house (Dm–Bb–Gm–A, 0.30/32)
- **방향**: 맥동 베이스는 유지하되, 멜로디에 **셋잇단 푸시**(t=15·22 부근 16분 2연타)로 불안 가속. 화성단음계 이끔음 C#5(note:4)를 한 번 더 선행시켜 긴장 빌드.
```js
      // [B변주] 불안 가속용 16분 2연타 + 이끔음 선행
      { t: 22, note: 5,  dur: 0.18, vol: 0.5, voice: 'mel', type: 'triangle' },  // D5
      { t: 23, note: 7,  dur: 0.22, vol: 0.5, voice: 'mel', type: 'triangle' },  // E5 (push)
      { t: 26, note: 4,  dur: 0.3, vol: 0.5, voice: 'mel', type: 'triangle' },   // C#5 이끔음 선행
```

### park (E Dorian, 0.42/32, 넓은 여백)
- **방향**: 여백을 유지하는 게 정체성이므로 과밀 금지. **메아리(echo) 모티프** 하나만 — 주제 음을 4스텝 뒤 한 옥타브 아래로 여리게 반향.
```js
      // [B변주] 메아리(주제 E5→4스텝 뒤 옥타브 아래 반향, 공간감)
      { t: 4,  note: -5, dur: 1.2, vol: 0.28, voice: 'mel', type: 'sine' },      // E4 (t=0 E5의 메아리)
      { t: 24, note: 0,  dur: 1.4, vol: 0.26, voice: 'mel', type: 'sine' },      // A4 (t=18 A5의 메아리)
```

### haru (Dm 탄식, 0.6/24, 가장 사적)
- **방향**: 탄식 하행은 손대지 않음. **오르골 파편을 한 점 더**(상위, 더 여리게) 추가해 "멈춘 기억"의 잔향을 강화. 코드/하행 라인은 불변.
```js
      // [B변주] 멈춘 오르골 파편 한 점 추가(더 멀리, 더 여리게)
      { t: 15, note: 19, dur: 0.5, vol: 0.18, voice: 'mel', type: 'triangle' },  // F6 (먼 잔향)
```

### town (C–Am–F–G 산책, 0.32/32)
- **방향**: 가장 보강 여지 큼. 후반부(마디3~4)에 **하모니 3도 병행**을 깔아 "둘이 걷던" 느낌. 베이스에 마디 중간 5도 디딤 추가로 워킹감.
```js
      // [B변주] 후반 3도 하모니(따뜻한 동행감) + 베이스 워킹 디딤
      { t: 24, note: -7, dur: 0.5, vol: 0.32, voice: 'mel', type: 'triangle' },  // D4 (G4의 아래 3~4도 하모니)
      { t: 28, note: 3,  dur: 0.6, vol: 0.32, voice: 'mel', type: 'triangle' },  // C5 (E5의 아래 3도)
      { t: 4,  note: -28, dur: 0.4, vol: 0.35, voice: 'bass', type: 'sine' },    // F2 (C2→F2 디딤)
      { t: 20, note: -26, dur: 0.4, vol: 0.35, voice: 'bass', type: 'sine' },    // G2 (F2→G2 디딤)
```

---

## 자체 검증 요약

| 테마 | 조성/무드 | stepDur×steps(루프) | mel 음역 | pad 음역 | bass 음역 | 음역분리 | 종지 |
|---|---|---|---|---|---|---|---|
| title | C/Am 교차·따뜻+아련 | 0.40×32 = 12.8s | A4~C6 (0~15) | C4~B4 (-9~2) | E2~A2 (-29~-24) | OK | C장조 여운(E5) |
| memory | F major·차오름 | 0.46×32 = 14.72s | A4~C6 (0~15) | C4~G4 (-9~-2) | F1~D2 (-40~-28) | OK | F5 여운(점층) |
| ending_reunite | D major·감격 | 0.44×32 = 14.08s | D5~D6 (5~17) | D4~C#5 (-7~4) | D1~B2 (-43~-22) | OK | D 루트 종지 |
| ending_stray | G Lydian·자유 | 0.52×32 = 16.64s | D5~D6 (5~17) | C4~C#5 (-9~4) | G1~E2 (-38~-26) | OK | G 열린 채 |

- **A4=0 규약 준수**: 모든 note 값이 위 음정표대로(C5=3, D5=5, E5=7, G5=10, A5=12, C6=15, D6=17, C#6=16; 저음 A2=-24, F2=-28, D2=-31, C2=-33 등) 일관.
- **음역 분리**: mel(0~17) / pad(-9~4) / bass(-43~-22)로 겹치지 않음. pad의 상단 코드톤(C#5=4 등)은 vol을 매우 낮춰(0.24~0.28) 멜로디 마스킹 방지.
- **dur×루프 정합**: 멜로디 dur는 대부분 stepDur×(2~4) 이내로 다음 음 전에 release. 긴 패드/서브 드론(dur 3~4s, 15~17s)은 **의도적으로 루프를 넘겨** 끊김 없는 깔개로 동작(엔진 ADSR release가 자연 감쇠 처리). 각 테마 마지막 mel 음은 루프 머리로 여운이 이어지도록 길게(1.6~2.4s) 둠.
- **드롭인 키 이름**: `title`, `memory`, `ending_reunite`, `ending_stray` — `MUSIC_THEMES` 객체에 그대로 추가.
