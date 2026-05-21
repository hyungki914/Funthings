# Mayo Clinic Platform_Accelerate — Multi-year Track 리서치 & 활용 방안

작성일: 2026-05-21
작성자: Hyungki Kim (CPO) 기준 내부 검토 자료
참고 자료: Accelerate Deck (2026), Adam Choe(Partner Relationship Manager, MCP_Accelerate) 이메일 스레드(2026-03 ~ 2026-05), 양식 `Mayo_Clinic_Platform_Accelerate_Application_Form_1.docx`

---

## 1. Multi-year 트랙이 휴이노에 맞는 이유 (결론 요약)

| 항목 | 30-week Cohort | Multiyear | 휴이노 적합성 |
|---|---|---|---|
| Cost (cash/equity/SAFE/Note) | $300K | **$700K** | Multi-year는 3개 제품(Care, Cue, PICASO) 분할 활용 시 제품당 $233K 수준으로 효율적 |
| 기간 (Data access term) | 20 weeks | **2 years** | 3개 제품 순차/병렬 validation + fine-tune에 30주는 절대적으로 부족 |
| Data set | Last 5 years MC patients (고정) | **Custom data set** | Care(원격모니터링/Holter), Cue(부정맥 AI), PICASO(General-ward 악화 예측)는 cohort 정의가 서로 달라 custom set 필수 |
| Mayo Cloud 환경 | Yes | Yes | 동일 |
| Advisor network | N/A | **50 credits** | FDA submission strategy, clinical reviewer 연결에 핵심 — 휴이노가 Biologics Consulting / MCRA / Mtech와 병행 중이므로 Mayo Advisor 코디는 Q-Sub/510(k) precedent 확보에 직접 기여 |
| Non-partner deployment | No | **Yes** | 향후 Mayo 외부에서의 추가 검증·배포 가능성 확보 |
| Model 호스팅 / Deployment infra | 별도 fee | **Expanded access 포함** | PICASO처럼 alerting/real-time 가까운 워크플로우 검증 시 인프라 필요 (단, Adam이 명확히 한 대로 Accelerate 내에서는 retrospective만 가능 — 향후 단계 옵션) |
| 갱신(Renewal) | N/A | **2년 후 renewal 가능** | 510(k) 후속 인디케이션 확장 대비 |
| Compute | MCP가 first $20K 부담, 초과분 pass-through | 전액 pass-through | 데이터 규모를 고려할 때 큰 차이는 아님 |

### 1.1 Adam 이메일에서 도출한 추가 근거 (직접 인용)

> "Accelerate is designed to support retrospective validation and evaluation of AI models using Mayo Clinic data in a governed, time-bound setting. Many companies join with a validation-focused scope first, and then reassess next steps based on what the results show. **If follow-on work (such as recalibration or further model refinement) becomes relevant, those discussions typically happen after initial findings are available** rather than being assumed at the outset."
>
> "From a practical standpoint, **all data-related work with Mayo Clinic Platform flows through Accelerate**, and the best way to determine fit is through the application and proposal review process."

해석:
- Mayo Clinic Platform의 데이터를 활용한 작업은 **무조건 Accelerate를 통과**해야 한다.
- 초기 validation 결과 후 **recalibration / fine-tune이 발생하는 시나리오는 명확히 인정됨**. 다만 outset에서 가정하지 말고, 결과를 보고 follow-on으로 가는 게 Mayo의 권장 패턴.
- 휴이노 입장에서 30-week는 "validation 1회"가 최대치이고, fine-tune까지 가려면 추가 cohort/contract가 또 필요 → Multi-year가 2년 동안 한 계약으로 validation → fine-tune → 재검증을 cover.

> "Within Accelerate, analyses are run using Mayo Clinic data assets available in the Platform environment. While Mayo Clinic has a multi-site footprint, work in Accelerate is not typically structured or guaranteed as a formally site-stratified study. That said, **underlying data does reflect care delivered across the Mayo system**, and we can explore cohort design and analysis approaches during proposal review based on feasibility and appropriateness."

해석:
- 공식 site-stratification은 보장 안 되지만 **MN/FL/AZ 통합 데이터가 사실상 multi-site 성격**.
- Custom data set 권한(Multi-year)으로 cohort 구성 시 지리적 다양성 요건(FDA expectation)을 충족 가능.

### 1.2 3-제품(Care, Cue, PICASO) × 30-week 시뮬레이션이 안 되는 이유

- 30-week 트랙 = 20-week data access. 한 제품당 cohort 빌드(데이터 요구사항 정의 → 추출 → cleaning) 후 validation까지 최소 12~16주 소요. 3개 제품을 순차 처리 시 60~75주 필요 → 30-week 안에 불가능.
- 병렬 처리 시에도 30-week 트랙의 "고정 dataset(Last 5 years MC patients)"으로 PICASO General Ward, Care(원격모니터링 long-term ECG), Cue(arrhythmia event detection) cohort를 동시에 분리 정의하기 어려움.
- 3개를 따로따로 30-week × 3 = $900K + 매번 contracting 3-6주 × 3 = 9~18주 추가 — Multi-year($700K, 2년) 대비 비효율.

### 1.3 잔여 리스크 / 유의사항

| 리스크 | 대응 |
|---|---|
| Adam이 권한 것은 "validation-focused proposal" — fine-tune을 outset에 강조하면 reject 가능성 | 제안서 본문에서는 **validation 1차 목표**로 framing, fine-tune은 "based on findings, recalibration may be considered as in-scope under Multi-year" 정도로 톤다운 |
| Accelerate가 FDA endorsement은 아님 (Adam이 명시) | "MCP outputs은 FDA submission의 supporting evidence로 활용, regulatory endorsement로 해석하지 않음"을 application 명시 |
| Multi-year cost $700K는 cash/equity/SAFE/Note 협상 — 휴이노 fundraising 상황과 연계 필요 | CFO·CEO와 사전 정렬, application "Fundraising" 섹션과 일관성 유지 |
| Application 마감(다음 cohort 기준): June 1 apply → July 1 proposal → Sep 15 contracting → October cohort start | 5월 21일 현재, **6월 1일 apply 마감에 맞춤** |

---

## 2. 2년간 활용 마스터 플랜 (3개 제품 × Validation → Fine-tune)

### 2.1 트랙 분할
| Phase | 기간 | 제품 | 핵심 산출물 |
|---|---|---|---|
| Phase 1 | M1–M6 | **PICASO** 우선 (이미 Adam과 가장 깊이 논의됨) | Mayo cohort 정의 확정 (Cardiac arrest, Hypoxia <94% SpO2, Hypotension <90 mmHg SBP) → Locked Korean model의 retrospective validation → AUROC / sensitivity / specificity / PPV / NPV per event |
| Phase 2 | M4–M10 | **Cue** (ECG arrhythmia) 병렬 시작 | Mayo의 ECG waveform(10M ECG) + AF/PVC label cohort → Cue 알고리즘 외부 validation |
| Phase 3 | M6–M14 | **Care** (continuous monitoring / Holter-equivalent) | Long-term ECG / waveform 분석 cohort, end-to-end Care workflow에 해당하는 retrospective 분석 |
| Phase 4 | M10–M20 | 결과 기반 **Fine-tune / Recalibration** 각 제품별 | Mayo U.S. cohort 일부를 train, 나머지 hold-out으로 평가 → re-locked model 산출 |
| Phase 5 | M18–M24 | **FDA Q-Sub용 evidence package 정리** | 3개 제품별 Q-Sub / 510(k) supporting document 패키징, Mayo 임상 advisor 의견서 |

### 2.2 Advisor Credit 50개 활용 계획 (Multi-year only)
- General Ward / Critical Care 전문의: PICASO 임상 정의 review (Christoph Nabzdyk 박사, Brian Pickering 박사 라인 연결 가능)
- Cardiology / Electrophysiology: Cue, Care arrhythmia label adjudication
- FDA Regulatory affairs (Mayo-side): Indication for Use wording, Q-Sub strategy

### 2.3 외부 파트너 정합성
- **Biologics Consulting (Kunal Jariwala)**: Pre-sub 우선순위 결정 단계 진행 중 (2026-05-12 미팅) → Mayo 결과가 indication prioritization의 정량 근거.
- **MCRA**: FDA Regulatory advisory 검토 중 → Mayo의 Mayo-data validation report를 leverage.
- **Mtech Group**: FDA Premarket Notification 컨설팅 → 510(k) 본 submission 단계 활용.
- **Johns Hopkins (SRA 체결, 2026-04)**: Cue/Care prospective 데이터 확보 — Mayo retrospective + JHU prospective = FDA가 선호하는 evidence 구성.

---

## 3. Mayo와의 다음 액션 시퀀스

1. **즉시(이번 주)**: 본 문서로 내부 의사결정 — Multi-year 지원 확정.
2. **5월 말까지**: 양식(`Application Form`) 모든 항목 fact-check (특히 fundraising, 매출, founder bio).
3. **6월 1일 이전**: `https://surveys.mayoclinic.org/jfe/form/SV_8e8cPm3bhdq5XrE` 제출.
4. **6월–7월**: Business interview (30분) → Data interview (30분) → Proposal 제출 (deadline July 1).
5. **9월 15일 이전**: Contracting 완료.
6. **10월 cohort 시작**.

> 참고: 양식에는 30-week 기본 가정이 들어가 있음(예: "20 weeks" 표현). Multi-year 의향은 **Goals / Anything else / Proposal 제출 단계**에서 명시적으로 표명. Adam에게도 application 제출 직후 별도 이메일로 "intended Multi-year track" 명시 권장.
