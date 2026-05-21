# Mayo Clinic Platform_Accelerate — Application Draft (Huinno)

작성일: 2026-05-21
제출 트랙 의향: **Multiyear (2-year engagement)**
제출 마감 (다음 cohort): **2026-06-01** (apply) → 2026-07-01 (proposal) → 2026-09-15 (contracting) → 2026-10 (cohort start)
온라인 제출 URL: https://surveys.mayoclinic.org/jfe/form/SV_8e8cPm3bhdq5XrE

> 표기 규칙
> - `[CONFIRM]` = 내부 fact-check 필요 (CEO/CFO/HR 확인)
> - `[TBD]` = 결정/숫자 미정
> - 일반 본문 = 이메일·기존 자료 기반 초안 (그대로 사용 가능)

---

## A. Contact Information

| Field | Draft |
|---|---|
| Primary Contact Name (required) | Hyungki Kim |
| Primary Contact Email (required) | hyungki@huinno.com |
| Primary Contact Phone Number (required) | +82 10 4811 0436 |
| Other cofounder emails (>=10% equity) | kyzoon@huinno.com (Yeongjoon Gil, CEO/Founder), shjung@huinno.com (Sunghoon Jung, CTO) `[CONFIRM 지분율 ≥10%]` |
| Country of incorporation (required) | Republic of Korea |
| Team members in other countries | `[CONFIRM]` — 미국 사업개발/임상 파트너십 인력 여부 표기. 현재 본사는 서울(South Korea), 협력 기관(JHU, Mayo) 미국 소재. |

---

## B. Company Overview

**Company Name (required):** Huinno Co., Ltd. (휴이노)

**Please describe your company briefly (required):**
Huinno is a Korean medical AI company that develops AI-powered cardiovascular and clinical-deterioration decision-support solutions. Our portfolio combines a wearable biosignal device (MEMO Patch) and three AI software products: **MEMO Care** (continuous cardiac monitoring & care orchestration), **MEMO Cue** (AI arrhythmia detection and ECG interpretation), and **Vital‑PICASO** (AI clinical decision support that predicts cardiac arrest, hypoxia, and hypotension in adult general-ward patients from six vital signs). Huinno is preparing each product for U.S. FDA clearance and is actively building U.S. clinical evidence through collaborations with Johns Hopkins University and Mayo Clinic Platform.

**Company Website URL (required):** https://huinno.com/

**Intro video / demo link:** `[TBD — PICASO demo video URL 또는 Mayo용 시연 영상(5/26 시연 후 활용)]`

**Company Crunchbase URL:** `[CONFIRM — Crunchbase 등록 확인]`

**LinkedIn URL:** `[CONFIRM — https://www.linkedin.com/company/huinno 등 공식 페이지]`

**Most Recent Investor Deck:** `[FILE UPLOAD — 최신 IR 덱 / Huinno_Intro 덱 사용 가능 (Adam에 4월 송부한 PDF)]`

**Company Stage (check all that apply, required):**
- [x] MVP Developed
- [x] In Pilots or Clinical Trials
- [x] In Market `[CONFIRM — 국내 시판 상태에 따라]`
- [x] Revenue Positive `[CONFIRM]`

---

## C. Founders (Table)

| Name | Clinical | Technical | Business | Brief Bio (≤500 chars) |
|---|---|---|---|---|
| **Yeongjoon Gil, Ph.D.** (CEO & Founder) | ☐ | ☑ | ☑ | Founded Huinno after Ph.D. in biomedical/electrical engineering; led development of MEMO Patch & MEMO Cue, the first Korean MFDS-cleared AI-based ECG monitoring solution. Drives global expansion, Mayo Clinic and JHU partnerships, and overall regulatory strategy across the Care/Cue/PICASO portfolio. `[CONFIRM 학위·경력 정확도]` |
| **Sunghoon Jung, Ph.D.** (CTO) | ☐ | ☑ | ☐ | Ph.D. in electrical/biomedical engineering. Architect of Huinno's signal-processing and AI inference stack, leading the technical roadmap for MEMO Cue's arrhythmia AI and Vital‑PICASO's deterioration model. `[CONFIRM]` |
| **Hyungki Kim** (CPO) | ☐ | ☑ | ☑ | Leads product strategy across MEMO Care/Cue and Vital‑PICASO, including U.S. regulatory readiness, clinical validation design, and partnerships with Mayo Clinic Platform, JHU, MCRA, and Biologics Consulting. `[CONFIRM 경력]` |
| **Kwang Jae (Caleb) Choo, Ph.D.** (CRIO) | ☐ | ☑ | ☑ | Leads research and innovation, including regulatory affairs engagement with U.S. consultants (MCRA, Biologics, Mtech). Drives clinical research design across the portfolio. `[CONFIRM]` |
| `[ADD]` Clinical advisor / Medical director (있다면) | ☑ | ☐ | ☐ | `[CONFIRM]` |

**Are any members from underrepresented groups?** All founders are of Korean nationality (Asian). `[CONFIRM 회사가 표기를 원하는 수준]`

**Noncompete / IP overlap (required):** None of the listed founders are bound by noncompete or IP agreements that conflict with Huinno's products. The pending litigation matter handled by Kim & Chang relates to product IP and does not impose any noncompete or assignment overlap with this project. `[CONFIRM]`

---

## D. Product / Idea

**Long-term vision (required):**
Huinno's long-term vision is to become the global standard for AI-driven cardiovascular and acute-deterioration decision support. We are building a unified clinical-AI portfolio that spans the continuum of care — from continuous outpatient cardiac monitoring (MEMO Care) to high-acuity arrhythmia interpretation (MEMO Cue) to in-hospital general-ward deterioration prediction (Vital‑PICASO). Within five years, we aim to operate all three products in the U.S. and major global markets under FDA-cleared status, supported by multi-site clinical evidence including Mayo Clinic and Johns Hopkins datasets.

**Please describe your product, its users, and what it does (required):**

Huinno is submitting this application with a portfolio scope of three AI software products. We propose to use the Multiyear engagement to support **individual FDA-clearance preparation** for each product, through Mayo Clinic Platform cohort construction, retrospective validation, and — based on findings — limited recalibration / fine-tuning.

1. **MEMO Care** — A continuous cardiac monitoring and care-orchestration platform for outpatient and post-discharge patients. Users: cardiologists, general practitioners, and care coordinators managing patients on remote ECG monitoring. Function: ingests long-duration ECG/biosignals from MEMO Patch, surfaces clinically meaningful events, and supports follow-up workflow.
2. **MEMO Cue** — AI-based arrhythmia detection and ECG interpretation engine. Users: cardiologists and electrophysiologists reviewing ECG recordings. Function: classifies arrhythmias (e.g., AF, PVC, AV block) on ECG segments and produces a clinician-facing report; serves as an interpretation aid.
3. **Vital‑PICASO** — Clinical decision support for adult general-ward patients. Users: rapid response teams, hospitalists, and ward nurses. Function: analyzes six vital signs (SBP, DBP, HR, RR, body temperature, SpO₂) streamed from the EMR and generates 24-hour risk scores for cardiac arrest, hypoxia, and hypotension; when a score exceeds a predefined threshold, the system generates an alert. Currently trained on data from a single Korean hospital; Mayo Clinic Platform engagement is the primary path to U.S. external validation.

**What is new / distinctive (required):**
- **Portfolio-level coherence**: Care + Cue + PICASO span outpatient → inpatient cardiac and deterioration AI under one company, allowing shared infrastructure, shared signal processing, and aligned regulatory strategy.
- **Locked-model retrospective validation discipline**: Each product enters Mayo validation with a frozen Korean-data model, enabling clean external-validation evidence (a pattern explicitly favored by FDA).
- **Hardware-software vertical integration**: MEMO Patch hardware feeds Cue/Care, enabling end-to-end data quality control rare among software-only competitors.
- **Multi-geography evidence stack**: Korea (MFDS-cleared, real-world deployment) + Johns Hopkins (signed SRA, 2026-04) + Mayo Clinic Platform (this engagement) — addresses FDA's expectation for geographically diverse validation.

**Competitors / Who do you fear most (required):**

| Product | Direct competitors |
|---|---|
| MEMO Cue | iRhythm (Zio), Bardy Diagnostics/Hillrom, Vivalink, AliveCor (KardiaMobile/AI), Apple Watch ECG ecosystem |
| MEMO Care | iRhythm Zio Service, Preventice/Boston Sci, BioTel/Philips |
| Vital‑PICASO | Epic Deterioration Index, Bayesian Health, Dascena (Insight), Etiometry, PhysIQ, Edwards Acumen |

Most strategic concern: **Bayesian Health and Epic Deterioration Index** for PICASO (US-incumbent advantage in EMR integration), and **iRhythm** for Cue/Care (incumbent in continuous ECG monitoring market). Our differentiator is portfolio coherence and FDA-grade Korean RWD volume.

**Does the FDA regulate your technology/product? (required):**
- [x] **Yes, Software as a Medical Device (SaMD)** — All three products (Care, Cue, PICASO) are SaMD; Cue and Care also integrate with a Class II wearable (MEMO Patch).
- [x] Yes, Med Device (other) — MEMO Patch (bio-signal wearable) `[CONFIRM 분류]`

---

## E. Technical

**Do you have a technical expert / data scientist (SQL + Python or R)? (required):** **Yes.** Huinno's R&D organization includes a dedicated Data Science & AI team led by the CTO. The team is proficient in SQL (cohort extraction from clinical data warehouses), Python (PyTorch/TensorFlow for AI model training and validation), and R (statistical analysis for clinical evidence generation).

**Who writes code? Any non-founder? (required):**
The majority of code is written by Huinno's full-time engineering team, which includes both founders (CTO Sunghoon Jung) and non-founder engineers across signal processing, AI/ML, full-stack (MEMO Care platform), and DevOps. Code review, CI/CD, and regulatory documentation processes are in place. Non-founder engineers contribute under standard employment agreements with IP assignment clauses.

**Retrospective data types needed (check all that apply, required):**
- [x] Demographics and Patient Provided Information
- [x] Cardiology and Electrophysiology — for Cue & Care (ECG waveforms, arrhythmia event labels, AF/PVC/AV block annotations)
- [x] Surgical and Procedural Data — for context (e.g., post-operative ward patients in PICASO)
- [x] Medical History (Diagnoses, Family History, Orders, Immunizations) — for PICASO event labeling (e.g., cardiac arrest diagnosis, CPR events)
- [x] Visits, Appointments, and Hospitalizations — admission/discharge/ward context for PICASO
- [x] Laboratory and Testing Data — supporting features for PICASO (optional)
- [x] Other — **continuous vital-sign time series** (SBP, DBP, HR, RR, body temperature, SpO₂) with timestamps for PICASO

**If Medical Images:** Not required for this scope.

**If Other, what other data do you need?**
- Time-stamped continuous vital-sign data (SBP, DBP, HR, RR, temperature, SpO₂) for adult general-ward patients (PICASO).
- Time-stamped event/outcome labels with ward context:
  - **Cardiac arrest**: occurrence + event time + ward location; equivalent to either an EMR diagnosis of cardiac arrest or a documented CPR/code-blue event.
  - **Hypoxia**: SpO₂ < 94%; if available, oxygen therapy initiation, flow rate, delivery method, and timestamp.
  - **Hypotension**: SBP < 90 mmHg with timestamp and ward context.
- **ECG waveforms** (raw or vendor-format) with paired arrhythmia annotations / Holter or telemetry reports — for MEMO Cue and MEMO Care validation cohorts.

> Note (per Adam Choe, 2026-04-28): Mayo's event-labeling conventions need not exactly match Huinno's, provided they are clinically meaningful; Huinno is open to definition harmonization during the feasibility / proposal phase.

---

## F. Top 3 Goals (required)

**Goal 1 — Cohort construction & feasibility confirmation across the Care/Cue/PICASO portfolio.**
Within the first six months of the engagement, define cohorts in Mayo Clinic Platform for each of the three products (PICASO general-ward deterioration cohort; Cue arrhythmia cohort; Care continuous-monitoring cohort) and confirm cohort feasibility with Mayo data — including event volume by indication and feature completeness.

**Goal 2 — Retrospective external validation of three locked AI models on Mayo Clinic data, generating FDA-supporting evidence for each product's individual 510(k) / SaMD pathway.**
Run external validation of the three locked models (PICASO first, Cue & Care in subsequent phases) on Mayo cohorts; report AUROC, sensitivity, specificity, PPV, NPV, calibration, and subgroup performance. Output is positioned as supporting evidence for each product's individual FDA submission, not as a regulatory endorsement.

**Goal 3 — Targeted fine-tuning / recalibration on Mayo cohorts where validation reveals U.S.-specific performance gaps, followed by a re-locked, FDA-ready model per product.**
If validation surfaces performance degradation attributable to U.S. population, monitoring practice, or EHR-documentation differences, leverage the Multiyear engagement's custom-data and advisor resources to recalibrate / fine-tune each model on a designated Mayo training subset, hold out an independent validation subset, and present the improved model in re-locked form for FDA submission.

> Framing note: per Adam's guidance, the proposal is positioned as **validation-first**; fine-tuning is described as a contingent follow-on consistent with the Multiyear "reassess after initial findings" pattern.

---

## G. Traction

**Year of legal formation (required):** `[CONFIRM — 2017 추정, 실제 법인 설립연도 입력]`

**Top 3 milestones (required):**

| # | Milestone | Time-to-achieve |
|---|---|---|
| 1 | **Korean MFDS clearance for MEMO Patch + MEMO Cue (AI-based ECG monitoring)**, including real-world clinical deployment across Korean hospitals | `[CONFIRM]` |
| 2 | **Vital‑PICASO model development & lock** on Korean adult general-ward data with prediction of cardiac arrest, hypoxia, and hypotension at 24-hour horizon; FDA Q-Sub preparation initiated with Biologics Consulting (2026) | `[CONFIRM]` |
| 3 | **Strategic U.S. clinical-evidence partnerships**: Signed Sponsored Research Agreement with Johns Hopkins University (2026-04), kick-off ceremony completed; engaged Mayo Clinic Platform_Accelerate process (in-process) | 2026 in progress |

**Forms of traction (check all that apply, required):**
- [x] Generating revenue `[CONFIRM]`
- [x] Pilot or clinical trial in progress or completed `[CONFIRM]`
- [x] Published results in peer-reviewed journal `[CONFIRM 출판 목록]`
- [x] Earned a grant `[CONFIRM]`
- [x] Active users `[CONFIRM — Korean deployment user count]`
- [x] Patent application filed or granted `[CONFIRM — 국내/PCT 출원 건수]`
- [ ] Participated in another accelerator or incubator `[CONFIRM]`

**Total revenue to date (business, not fundraising):** `[CONFIRM — CFO 박문규]`

**Active users to date:** `[CONFIRM]`

**Other accelerator(s):** `[CONFIRM]`

**Additional traction info:** Litigation matter (handled by Kim & Chang) currently in process and does not impair operating or commercial activities; included here in the interest of full disclosure.  `[CONFIRM 공개 수준]`

---

## H. Fundraising

**Have you raised money? (required):** Yes.

**How much have you raised? (required):** `[CONFIRM — 누적 투자유치 금액 USD/KRW]`

**Funding mechanisms used (required):**
- [x] Grants `[CONFIRM]`
- [x] Seed Round `[CONFIRM]`
- [x] Series A `[CONFIRM]`
- [x] Series B `[CONFIRM]`
- [ ] Self Funded / Friends & Family / Other

**Actively fundraising / next-12-month plans (required):**
- [x] Yes, planning to fundraise in the next year `[CONFIRM — 현재 라운드 상태]`

---

## I. Other Information

**Legal counsel for contracting? (required):**
- [x] **Yes** — Huinno retains Kim & Chang (김·장 법률사무소) for general corporate counsel and IP litigation, and is also working with U.S. regulatory counsel via Biologics Consulting and MCRA. Counsel for international platform/data-use agreements can be engaged through the existing Kim & Chang relationship.

**Do you know any members of the Mayo Clinic community?**
Yes. Through CEO Yeongjoon Gil's on-site visit to Mayo Clinic in April 2026, Huinno has direct engagement with:
- **Dr. Christoph Nabzdyk** (Department of Anesthesiology and Perioperative Medicine)
- **Dr. Brian Pickering** (Critical Care / Clinical Informatics)
- **Kyle Eisenzimmer** (Partner Enablement Executive, Mayo Clinic Platform) — multiple meetings since March 2026, in-person at KIMES Seoul (March 2026)
- **Adam Choe** (Partner Relationship Manager, MCP_Accelerate) — direct engagement since March 2026 (email thread on Vital‑PICASO scoping; this application is the recommended next step)

**How did you hear about MCP_Accelerate? (required):**
- [x] **Personal Referral** — introduced by Kyle Eisenzimmer, Mayo Clinic Platform Partner Enablement Executive, following an initial introductory call in March 2026 and an in-person meeting at the KIMES conference in Seoul.

**Anything else you would like to tell us?**

We are applying with explicit intent to pursue the **Multiyear engagement track** rather than the 30-week cohort. The two-year horizon, custom-dataset access, advisor-network credits, and renewal option align with our portfolio-level plan to bring three independent SaMD products (MEMO Care, MEMO Cue, Vital‑PICASO) to FDA clearance through Mayo Clinic Platform-supported evidence. Per Adam Choe's earlier guidance, our primary near-term scope is locked-model **retrospective external validation**; any model fine-tuning would be activated only after initial validation findings indicate U.S.-specific performance gaps, and any outputs would be used as supporting evidence rather than as regulatory endorsement.

We also see strong synergy with Huinno's parallel U.S. evidence work — a signed Sponsored Research Agreement with Johns Hopkins University (April 2026), ongoing FDA regulatory advisory engagements with Biologics Consulting and MCRA, and a planned PICASO demonstration with Mayo clinicians in late May 2026. Mayo Clinic Platform_Accelerate would serve as the central, multi-year platform anchoring this evidence stack.

We look forward to the business and data interviews to refine scope, cohort definitions, and Multiyear program terms.

---

## J. Submission Checklist (내부 진행용)

- [ ] CEO/CFO 사인오프 (지원 트랙: Multiyear, 예상 cost $700K cash/equity/SAFE/Note 협상 범위 확정)
- [ ] `[CONFIRM]` 표시 항목 fact-check (founder bio, 매출, 펀딩 금액, 특허 수, 법인 설립연도)
- [ ] Investor deck 최신본 업로드 (PDF)
- [ ] Intro/demo video URL 확보 (선택)
- [ ] LinkedIn / Crunchbase 공식 URL 확인
- [ ] 온라인 폼(https://surveys.mayoclinic.org/jfe/form/SV_8e8cPm3bhdq5XrE) 제출 — **마감 2026-06-01**
- [ ] 제출 직후 Adam Choe에게 follow-up 메일 ("Multi-year track intent" 명시, 제출 사실 통지)
- [ ] Business interview (30분) 일정 조율
- [ ] Data interview (30분) 일정 조율 — Sunghoon Jung CTO + Huinno DS team 배석
- [ ] Project proposal 작성 (마감 2026-07-01) — Phase 1~5 세부 계획 (`01_multi_year_program_analysis.md` §2.1 기반)
- [ ] Contracting (마감 2026-09-15) — Kim & Chang 협조
- [ ] Cohort start (2026-10)
