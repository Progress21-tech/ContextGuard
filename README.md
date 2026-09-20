# ContextGuard

**Context-Aware Clinical Access, Emergency Accountability and Tamper-Evident Audit**  
*Product Requirements Specification (PRD v1.0) — Track C1: Health & Medical Systems*

---

## 1. Executive Summary & Core Thesis

Hospital staff should not receive access to sensitive clinical records merely because their account possesses a static role. Access must be a **contextual decision**: *who is requesting it, which patient and data are involved, what action is being taken, why it is needed, and whether the current clinical context supports it right now.*

ContextGuard acts as a lightweight security gateway and accountability layer positioned between hospital staff and clinical record services. It evaluates requests using real-time context (identity, role, active duty status, assigned ward, care team relationship, record sensitivity, request purpose, device context, and emergency declaration). Every outcome produces a structured audit event sealed in a separate evidence vault linked by a cryptographic SHA-256 hash chain with signed checkpoints.

> **Prototype Boundary**: ContextGuard uses **synthetic data only** (fictional staff, synthetic patients, and synthetic clinical details). It is designed to demonstrate security architecture controls, not to replace an EMR, HIS, SIEM, or clinical decision support system.

---

## 2. Problem Definition & Nigerian Evidence Context

Digital health record adoption in Nigerian hospitals operates in an environment with uneven infrastructure, varying IT capacity, multiple staff roles, changing duty assignments, and growing cyber risks:

- **Uneven Infrastructure**: A published 2025 cross-sectional study of 293 physicians and nurses in Lagos General Hospitals (Babalola et al. [1]) reported substantial operational barriers:
  - Insufficient computers: **90.8%**
  - Inconsistent electric power: **87.0%**
  - Hardware/software failure: **85.5%**
  - Poor internet connectivity: **84.7%**
  *Implication*: Offline and downtime continuity is a first-class architectural requirement, not an edge case.
- **Cybersecurity & National Context**: On 27 August 2026, ngCERT issued a high-risk advisory on Medusa ransomware targeting critical infrastructure with double-extortion tactics [4].
- **Legal & Regulatory Obligations**:
  - Section 29 of the *Nigeria National Health Act 2014* requires strict control measures against unauthorized access, copying, and alteration [5].
  - *Nigeria Data Protection Act (NDPA) 2023* and 2025 *GAID* guidelines identify health status as sensitive personal data requiring privacy-by-design, least privilege, and tamper logging [6][7].
- **Novelty Boundary**: Role-based access (RBAC), fine-grained fields, break-glass, and audit events exist in platforms like OpenMRS [8], GNU Health [9], Medplum [17], and HL7 FHIR [10][11]. ContextGuard's novelty is the **focused combination and demonstration of these controls as a retrofit layer** for low-resource hospital workflows, featuring explainable misuse detection and constrained downtime resilience.

---

## 3. Product Architecture & Trust Boundaries

```text
 +-------------------------------------------------------+
 |                     Staff Browser                     |
 |                      (Untrusted)                      |
 +---------------------------+---------------------------+
                             | HTTPS / API Request
                             v
 +-------------------------------------------------------+
 |             Policy Enforcement Point (PEP)            |
 +---------------------------+---------------------------+
                             | Request Context
                             v
 +-------------------------------------------------------+
 |             Policy Decision Point (PDP)               |
 |              (Isolated Policy Evaluator)              |
 +---------------------------+---------------------------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
      ALLOW                DENY             BREAK-GLASS
         |                   |                   |
         +-------------------+-------------------+
                             |
                             v
 +-------------------------------------------------------+
 |                Clinical Record Service                |
 +---------------------------+---------------------------+
                             |
                             v
 +-------------------------------------------------------+
 |                  Patient DB (Store)                   |
 +-------------------------------------------------------+

All Outcomes -> Audit Collector -> Audit Store -> Hash Chain -> Checkpoint -> Verifier -> Security Dashboard
```

### Trust Boundaries
1. **Browser to API (Untrusted)**: Never accept client-provided allow/deny decisions; all authorization is evaluated server-side.
2. **API to Policy Engine (Trusted Service)**: Complete request context passed to the isolated PDP module; policy version logged.
3. **Policy Engine to Clinical Service (Trusted Decision)**: Clinical service strictly enforces the decision returned by the PDP.
4. **Clinical DB to Audit Store (Security Boundary)**: Ordinary application CRUD operations cannot modify or delete sealed audit evidence.
5. **Audit Store to Checkpoint Key (High-Trust Boundary)**: Signing keys remain server-side and are never exposed to the frontend.
6. **Offline Cache to Device (High-Risk Local Boundary)**: Offline data is minimized (emergency summary only), read-only, and bound to eligible devices.

---

## 4. Authorization Model & Executable Policy Specification

### 4.1 Authorization Request Object (Section 7.1)
```json
{
  "subject": {
    "id": "USR-004",
    "role": "doctor",
    "department": "emergency medicine",
    "assignedWard": "WARD-ED",
    "dutyActive": true
  },
  "resource": {
    "type": "patient_record",
    "patientId": "PAT-1042",
    "ward": "WARD-ED",
    "sensitivity": "restricted",
    "recordType": "allergy"
  },
  "action": "view",
  "context": {
    "purpose": "treatment",
    "activeEncounter": true,
    "deviceId": "WS-07",
    "timestamp": "2026-09-20T14:07:31Z",
    "emergency": false
  }
}
```

### 4.2 Decision Vocabulary
- `ALLOW`: Policy conditions satisfied -> Show permitted resource -> Log audit event.
- `DENY`: Policy conditions not satisfied -> Block access, show clear reason code -> Log audit event.
- `BREAK_GLASS_REQUIRED`: Policy denied but clinician emergency path applies -> Offer emergency override flow -> Log audit event.
- `REVIEW`: Action permitted according to policy, but creates an explainable advisory signal for security investigation -> Log audit event + raise alert.

### 4.3 Policy Rules (P-001 to P-009)
- **P-001 Authentication**: `authenticated == true`. Otherwise `DENY` (`AUTH_REQUIRED`).
- **P-002 Duty Assignment**: `duty == true`. Otherwise `DENY` (`NO_ACTIVE_DUTY`).
- **P-003 Patient Relationship**: Clinical access requires active care team relationship or explicit temporary cross-ward assignment. Otherwise `DENY` (`NO_PATIENT_RELATIONSHIP`).
- **P-004 Ward Matching**: User ward matches patient ward OR explicit cross-ward assignment exists. Otherwise `DENY` (`WARD_MISMATCH`).
- **P-005 Sensitivity Policy**: Restricted records denied for records clerks (`SENSITIVITY_RESTRICTED`) and intern trainees.
- **P-006 Action Authorization**: Actions must be explicitly permitted (`view` vs `export` vs `edit`). Lab staff denied clinical narrative (`ACTION_NOT_PERMITTED`); Pharmacy restricted to prescriptions/allergies; Administrative/security roles denied direct clinical records. Export during break-glass denied (`EXPORT_NOT_PERMITTED`).
- **P-007 Lifecycle & Expiry**: Off-duty or expired accounts denied (`NO_ACTIVE_DUTY`).
- **P-008 Emergency Break-Glass**: Authenticated clinician (`doctor` or `nurse`) + declared emergency + eligible resource -> `ALLOW` (`EMERGENCY_OVERRIDE`) + critical audit event. Non-clinicians denied (`EMERGENCY_NOT_ELIGIBLE`).
- **P-009 Fail Closed**: Missing context or policy error -> `DENY` (`POLICY_UNAVAILABLE`).

---

## 5. Synthetic Fixtures & Data Schema

### 5.1 Wards (Appendix A.1)
- `WARD-ED`: Emergency Department (Emergency Medicine)
- `WARD-MED`: Medical Ward (Internal Medicine)
- `WARD-CARD`: Cardiology Ward (Cardiology)

### 5.2 Staff Fixtures (Appendix A.2)
| ID | Name | Role | Department | Default Ward | Duty Status |
| --- | --- | --- | --- | --- | --- |
| `USR-001` | Ada Nwosu | records clerk | Health Information | WARD-ED | Active |
| `USR-002` | Bola Okafor | records clerk | Health Information | WARD-MED | Active |
| `USR-003` | Chinedu Eze | nurse | Nursing | WARD-ED | Active |
| `USR-004` | David Ade | doctor | Emergency Medicine | WARD-ED | Active |
| `USR-005` | Esther Bello | doctor | Internal Medicine | WARD-MED | Active |
| `USR-006` | Femi Lawal | doctor | Cardiology | WARD-CARD | Active |
| `USR-007` | Grace Obi | lab staff | Laboratory | WARD-ED | Active |
| `USR-008` | Hauwa Musa | pharmacy staff | Pharmacy | WARD-MED | Active |
| `USR-009` | Ifeanyi Udo | intern | Medicine | WARD-MED | Off duty |
| `USR-010` | Jide Alabi | security officer | Information Security | - | Active |
| `USR-011` | Kemi Yusuf | system admin | IT Operations | - | Active |

### 5.3 Patient Fixtures (Appendix A.3)
| ID | Name | Current Ward | Sensitivity | Purpose / Demo Scenario |
| --- | --- | --- | --- | --- |
| `PAT-1001` | Patient Alpha | WARD-ED | standard | Assigned doctor access (`AUTH-01`) |
| `PAT-1002` | Patient Bravo | WARD-ED | restricted | Clerk restricted access (`AUTH-06`) |
| `PAT-1003` | Patient Charlie | WARD-MED | standard | Cross-ward denial (`AUTH-02`) |
| `PAT-1004` | Patient Delta | WARD-CARD | restricted | Compromised account browsing scenario (`DET-03`) |
| `PAT-1005` | Patient Echo | WARD-CARD | standard | Emergency break-glass scenario (`BG-01`) |
| `PAT-1006` | Patient Foxtrot | WARD-MED | standard | Nurse ward access scenario (`AUTH-03`) |
| `PAT-1007` | Patient Golf | WARD-ED | restricted | Sensitive field policy test |
| `PAT-1008` | Patient Hotel | WARD-MED | standard | Expired intern assignment scenario (`AUTH-07`) |
| `PAT-1009` | Patient India | WARD-CARD | standard | High-volume browsing scenario (`DET-02`) |
| `PAT-1010` | Patient Juliet | WARD-ED | standard | Offline emergency summary (`OFF-01`) |
| `PAT-1011` | Patient Kilo | WARD-MED | restricted | Audit event sequence verification (`AUD-01`) |
| `PAT-1012` | Patient Lima | WARD-CARD | standard | Legitimate cross-ward temporary assignment (`DET-04`) |

---

## 6. Cryptographic Audit Vault & Tamper-Evidence Design

### 6.1 Event Schema & Canonical Serialization (Appendix C)
Every access attempt produces a structured event. Before hashing, the event is serialized into a deterministic pipe-delimited string:

```text
canonical(Event) = eventId | timestamp | actor.id | actor.role | deviceId | patientId | encounterId | action | resourceType | purpose | decision | reasonCode | ward | policyVersion | correlationId
```

*Example*:
`AUD-0007421|2026-09-20T14:07:31Z|USR-004|doctor|WS-07|PAT-1042|ENC-8331|VIEW|ALLERGY|TREATMENT|ALLOW|ACTIVE_TREATMENT_RELATIONSHIP|ED|1.0.0|REQ-9f11`

### 6.2 Hash-Chain Algorithm (Section 10.3)
- `H0 = "GENESIS_TRUST_ANCHOR_C1_CONTEXTGUARD"`
- `H_n = SHA256(canonical(Event_n) + "|" + H_{n-1})`

### 6.3 Signed Checkpoints & Verifier (Section 10.4)
Periodically or on request, a checkpoint object is created:
`Checkpoint = { sequenceStart, sequenceEnd, rootHash, timestamp, signature }`  
`signature = SHA256("CHECKPOINT:" + sequenceStart + ":" + sequenceEnd + ":" + rootHash + ":" + SECRET_KEY)`

The verification engine `verifyAuditChain()`:
1. Recomputes `canonical(Event_i)` for each event in sequence.
2. Recomputes `H_i = SHA256(canonical(Event_i) + "|" + H_{i-1})`.
3. Verifies `previousHash === prior event currentHash`.
4. Validates the checkpoint signature against the root hash.
5. Returns `TRUSTED` if all match; returns `INTEGRITY_FAILURE` with exact sequence index and event ID if tampered.

---

## 7. Controlled Break-Glass Emergency Access (Section 11)

- **Eligibility**: Restricted strictly to authenticated clinicians (`doctor`, `nurse`). Non-clinicians are denied (`BG-03`).
- **Flow**: Clinician declares emergency -> Selects mandatory reason (`Threat to life`, `Unconscious patient`, `Critical transfer`) -> System grants a **15-minute temporary narrow read-only scope** (`allergies`, `active_medications`, `critical_history`).
- **Accountability**: Generates a critical `AuditEvent`, places an advisory item in the Security Center review queue, and disables data exports (`BG-05`).
- **Abuse Threshold**: Repeated break-glass overrides (>= 3 in 24h) trigger a `CRITICAL_REVIEW` alert (`Rule D-04`).

---

## 8. Explainable Abuse Detection Engine (Section 12)

Advisory rules evaluate contextual risk signals without labeling users as malicious:

| Signal | Weight | Example |
| --- | --- | --- |
| Outside scheduled duty | +1 | Access at 03:14 AM when off-duty |
| Outside assigned ward | +2 | Doctor in Pediatrics accessing Cardiology patient |
| No patient relationship | +2 | No active encounter or care-team relationship |
| High record volume | +2 | 25 unrelated patients accessed in 10 minutes |
| Sensitive records | +3 | Repeated restricted-record access attempts |
| Repeated denied requests | +3 | 10 denial events in 5 minutes |
| New/unfamiliar device | +2 | Unrecognized workstation plus unusual activity |
| Repeated break-glass | +3 | Multiple emergency overrides without documented context |

### Detection Rules:
- **Rule D-01**: Clerk cross-ward denials >= 3 in 10 minutes -> Create `REVIEW` alert.
- **Rule D-02**: Clinician no patient relationship & >= 15 records in 10 minutes -> Create `HIGH_RISK` alert.
- **Rule D-03**: New device (`MOB-19`) + off duty + >= 10 unrelated records in 15 minutes -> Create `HIGH_RISK` alert.
- **Rule D-04**: Break-glass count >= 3 in 24h -> Create `CRITICAL_REVIEW` alert.
- **Legitimate Context Change (DET-04)**: Updating a user's temporary cross-ward assignment suppresses ward mismatch alerts.

---

## 9. Downtime Continuity & Sync Queue (Section 13)

- **Design Goal**: Preserve essential emergency clinical continuity without turning workstations into uncontrolled local copies of the hospital database.
- **Scope**: Search, full patient history, role changes, and exports are **DENIED** while offline.
- **Cached Summary**: Restricted pre-provisioned emergency summary for `PAT-1010` (allergies, active meds, blood group, critical alerts) remains readable on eligible workstations (`OFF-01`).
- **Offline Sync Queue**: Offline accesses write metadata-only records to `offline_events` (excluding full clinical bodies) (`OFF-03`).
- **Reconnection Sync**: When connectivity returns, state machine executes `SYNC_PENDING` -> `VERIFY` -> `UPLOAD` -> `ACKNOWLEDGED` -> `ONLINE`, importing queued events into the main audit vault (`OFF-04`).

---

## 10. Automated PRD Test Suite (30 Acceptance Tests)

ContextGuard includes a built-in automated test suite executing all 30 PRD acceptance criteria defined in Section 16:

```text
=== CONTEXTGUARD PRD ACCEPTANCE TEST SUITE ===

✓ [PASS] AUTH-01: Assigned doctor -> assigned patient (ALLOW / ACTIVE_TREATMENT_RELATIONSHIP)
✓ [PASS] AUTH-02: Doctor -> unrelated patient (DENY / WARD_MISMATCH)
✓ [PASS] AUTH-03: Nurse -> current ward patient (ALLOW / WARD_CONTEXT)
✓ [PASS] AUTH-04: Nurse -> unrelated ward patient (DENY / WARD_MISMATCH)
✓ [PASS] AUTH-05: Records clerk -> demographic data (ALLOW / ADMINISTRATIVE_SCOPE)
✓ [PASS] AUTH-06: Records clerk -> restricted clinical note (DENY / SENSITIVITY_RESTRICTED)
✓ [PASS] AUTH-07: Expired / off-duty intern -> any patient (DENY / NO_ACTIVE_DUTY)
✓ [PASS] AUTH-08: Client changes patient ID (Object-level auth server-side) (DENY)
✓ [PASS] AUTH-09: Unauthenticated request fail-closed (DENY / AUTH_REQUIRED)
✓ [PASS] AUTH-10: Authenticated clinician + emergency (ALLOW / EMERGENCY_OVERRIDE)
✓ [PASS] AUTH-11: Unauthenticated emergency request (DENY / AUTH_REQUIRED)
✓ [PASS] AUD-01: Create 100 sequential audit events with valid hash chain (TRUSTED)
✓ [PASS] AUD-02: Modify event 50 -> verification reports integrity failure (INTEGRITY_FAILURE)
✓ [PASS] AUD-03: Delete event 50 -> sequence gap detected (INTEGRITY_FAILURE)
✓ [PASS] AUD-04: Modify event + recompute hash without checkpoint -> failure (INTEGRITY_FAILURE)
✓ [PASS] AUD-05: View audit log as unauthorized role (DENY / ADMINISTRATIVE_ROLE)
✓ [PASS] BG-01: Eligible clinician emergency route (ALLOW / EMERGENCY_OVERRIDE)
✓ [PASS] BG-02: Emergency session expires (DENY)
✓ [PASS] BG-03: Non-clinical role invokes break-glass (DENY / EMERGENCY_NOT_ELIGIBLE)
✓ [PASS] BG-04: Repeated break-glass security signal (CRITICAL_REVIEW)
✓ [PASS] BG-05: Attempt export during break-glass (DENY / EXPORT_NOT_PERMITTED)
✓ [PASS] DET-01: Clerk 3 cross-ward denials REVIEW alert (REVIEW)
✓ [PASS] DET-02: Doctor 25 unrelated records HIGH_RISK alert (HIGH_RISK)
✓ [PASS] DET-03: New device + 03:14 + off-duty burst HIGH_RISK alert (HIGH_RISK)
✓ [PASS] DET-04: Temporary ward assignment mismatch suppression (ALLOW)
✓ [PASS] OFF-01: Network unavailable PAT-1010 emergency summary (ALLOW)
✓ [PASS] OFF-02: Offline user requests full history DENY (DENY)
✓ [PASS] OFF-03: Offline access local event queueing (QUEUED)
✓ [PASS] OFF-04: Network restored queued event synchronization (SYNCHRONIZED)
✓ [PASS] OFF-05: Offline device role change denial (DENY)

===================================
TOTAL PASSED: 30 / 30
TOTAL FAILED: 0
===================================
```

---

## 11. Demonstration Runbook (6-7 Minutes)

| Time | Beat | Demonstration Actions & What Judges See |
| --- | --- | --- |
| **0:00-0:40** | **Problem setup** | Show synthetic hospital, roles, and current duty status. State that access asks whether access makes sense *now*, not merely whether the user is a doctor. |
| **0:40-1:30** | **Normal access** | Dr. David Ade opens Patient Alpha (`PAT-1001`). Show `ALLOW` and `ACTIVE_TREATMENT_RELATIONSHIP` reason. |
| **1:30-2:30** | **Unauthorized browsing** | Select Ada Nwosu (Records Clerk), open Patient Bravo (`PAT-1002`). Show `DENY / SENSITIVITY_RESTRICTED`. Run **Simulate clerk browsing** to produce a `MEDIUM` review signal in Security Center. |
| **2:30-3:30** | **Compromised account** | Run **Simulate compromised account** (Dr. David Ade off duty on device `MOB-19` requesting burst access). Show explainable `HIGH-RISK` alert. |
| **3:30-4:30** | **Emergency break-glass** | Dr. David Ade opens Patient Echo (`PAT-1005`, Cardiology). Normal policy denies; invoke **Grant 15-Minute Emergency Access** with mandatory reason. Show narrow scope and sealed critical audit event. |
| **4:30-5:20** | **Tamper evidence** | Click **Stage audit tampering**, navigate to Audit Vault, and click **Verify integrity**. Show red `INTEGRITY FAILURE` banner with hash divergence and checkpoint mismatch. |
| **5:20-6:10** | **Downtime continuity** | Toggle **Network online** off. Open emergency summary for Patient Juliet (`PAT-1010`). Re-enable network to demonstrate queued event sync. |
| **6:10-6:40** | **Close & Test Suite** | Click **Run 30 PRD Acceptance Tests** to render the green 30/30 verification table. State closing line: *"ContextGuard adds a context-aware security and accountability layer that decides whether access makes sense now, provides controlled emergency exceptions, detects suspicious use, and preserves evidence of what happened."* |

---

## 12. Project Structure & Codebase Map

```text
ContextGuard/
├── package.json                        # Node.js project manifest & scripts
├── server.js                           # Express REST API backend server (Section 9)
├── backend/                            # Node.js Express Backend Service
│   ├── db/
│   │   └── schema.sql                  # PRD Section 8.3 SQL Schema
│   ├── policies/
│   │   └── evaluator.js                # Isolated Policy Decision Point (P-001..P-009)
│   ├── audit/
│   │   └── vault.js                    # SHA-256 Audit Vault & Checkpoint Verifier
│   └── alerts/
│       └── detector.js                 # Advisory Security Alerts Engine (D-01..D-04)
├── src/                                # React + TypeScript Frontend
│   ├── main.tsx                        # React DOM entrypoint
│   ├── App.tsx                         # React application shell & screen router
│   ├── api/
│   │   └── client.ts                   # REST API client module
│   ├── components/
│   │   ├── DecisionVisual.tsx          # Policy decision display component
│   │   ├── AuditVault.tsx              # SHA-256 evidence stream table & verifier UI
│   │   ├── SecurityCenter.tsx          # Security alerts review queue component
│   │   ├── DowntimeCache.tsx           # Offline summary card & local sync queue
│   │   ├── BreakGlassModal.tsx         # Clinician break-glass dialog
│   │   └── TestRunnerModal.tsx         # PRD 30-acceptance test runner modal
│   └── types/
│       └── index.ts                    # Strong TypeScript interfaces
├── tests/
│   └── acceptance.test.js              # Automated 30-scenario test suite
├── index.html                          # HTML mount point
└── README.md                           # Master PRD documentation
```

---

## 13. Standards & Research Sources Mapping (Section 19)

- **NIST SP 800-207**: Zero Trust Architecture; no implicit trust based on network location; separate PEP/PDP architecture [12].
- **OWASP Authorization Cheat Sheet**: Least privilege, deny by default, server-side authorization enforcement [13].
- **OWASP Logging Cheat Sheet**: Security logging, tamper detection, log minimization [15].
- **HL7 FHIR AuditEvent & Security Labels**: Audit event structure, REST actions, and break-glass security labels (`EXOPT`, `EMER`) [10][11].
- **HL7 FHIR R5 Encounter**: Participant roles, patient location, and care context [14].
- **Babalola et al. (2025)**: EMR barriers in Lagos General Hospitals [1].
- **ngCERT Medusa Ransomware Advisory (2026)**: Healthcare sector cyber-risk context [4].
- **Nigeria National Health Act 2014 & NDPA 2023 / GAID 2025**: Legal baseline for health record access, privacy, and accountability [5][6][7].

---

## 14. Definition of Done (Appendix D)

The project is complete and demo-ready when a judge can observe one uninterrupted scenario demonstrating:
1. Context-aware authorization decisions.
2. An unauthorized abuse attempt blocked and flagged with explainable signals.
3. An emergency exception granted, time-limited, and sealed in audit logs.
4. Staged audit tampering detected by cryptographic verification.
5. Restricted emergency continuity maintained during network loss with synchronization upon reconnection.
6. All 30 automated PRD acceptance test matrix items passing.
