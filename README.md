# ContextGuard

ContextGuard is a context-aware clinical-record access, emergency accountability (break-glass), tamper-evident cryptographic audit, and explainable security detection layer. It implements the September 2026 C1 prototype specification using **only synthetic people, patients, and clinical details**.

It is a demonstrable security gateway that answers: *is this access appropriate now?*

## Run it

No package installation or backend setup is required for this prototype.

Open [index.html](C:\Users\DELL\Documents\GitHub\ContextGuard\index.html) in a modern web browser. The UI is fully responsive, self-contained, and includes an automated test runner executing all 30 PRD acceptance tests.

## What is implemented

| PRD capability | Prototype implementation |
| --- | --- |
| **Contextual authorization (P-001..P-009)** | Isolated policy decision point combines authenticated role (11 staff fixtures across 8 roles), active duty, ward, care team relationship, temporary assignment, record sensitivity, and purpose. Evaluated server-side style and fails closed. |
| **Object-level protection** | Every patient-card request is evaluated independently; changing the patient identifier re-evaluates permissions server-side. |
| **Least privilege (P-005, P-006)** | Records clerks only receive administrative scope for standard records; restricted clinical records are denied. Lab and pharmacy staff clinical narrative requests are denied. |
| **Break-glass emergency access (P-008, Section 11)** | Eligible doctor/nurse users receive a deliberate confirmation flow, compulsory emergency reason capture, narrow 15-minute read-only scope, critical audit event, and review signal. Non-clinical roles are denied. Export during break-glass is blocked (`BG-05`). |
| **Tamper-evident audit (Section 10, Appendix C)** | Logically isolated audit vault chains each structured event to its predecessor using canonical serialization (`canonical(Event)`) and SHA-256 hashes (`H_n = SHA256(canonical + H_{n-1})`) with signed checkpoints. Staging control intentionally corrupts an event; verification reports the exact mismatch. |
| **Explainable abuse detection (Section 12)** | Deterministic rules evaluate clerk cross-ward denials (D-01), high-volume record access (D-02), compromised accounts/new devices (D-03), and repeated break-glass overrides (D-04). |
| **Downtime continuity (Section 13)** | Switching off the network toggle exposes only PAT-1010's pre-provisioned emergency summary. Full records are denied; offline access events are queued locally (`offline_events`) and synchronized to the audit vault upon reconnection. |
| **Acceptance Test Matrix (Section 16)** | Built-in test runner executes all **30 PRD acceptance tests** (`AUTH-01..11`, `AUD-01..05`, `BG-01..05`, `DET-01..04`, `OFF-01..05`) with 100% pass status. |

## Demo Runbook Flow (6-7 Minutes)

1. **Normal Access**: In **Clinical workspace**, Dr. David Ade can open **Patient Alpha** (`ALLOW / ACTIVE_TREATMENT_RELATIONSHIP`).
2. **Unauthorized Browsing**: Select **Ada Nwosu** (Records Clerk), then open **Patient Bravo**: ContextGuard returns `DENY / SENSITIVITY_RESTRICTED`.
3. **Simulate Clerk Browsing**: Click **Simulate clerk browsing** to trigger 3 denials and produce a `MEDIUM` review signal in **Security center**.
4. **Emergency Break-Glass**: Select **Dr. David Ade** and open **Patient Echo** (Cardiology). Normal policy denies; invoke **Grant 15-Minute Emergency Access** with mandatory reason to view the narrow clinical scope and seal a critical audit event.
5. **Compromised Account**: Click **Simulate compromised account** to switch to off-duty status on device `MOB-19` and request a burst of unrelated records: creates a `HIGH` risk alert with explainable signals.
6. **Audit Tampering & Verification**: Click **Stage audit tampering**, navigate to **Audit vault**, and click **Verify integrity**. The verification engine detects hash chain divergence and checkpoint signature mismatch.
7. **Downtime Mode & Sync**: Toggle **Network online** off in the top bar, open the emergency summary in **Downtime cache**, then toggle network back on to synchronize the queued offline metadata event.
8. **Run Acceptance Test Suite**: Click **Run 30 PRD Acceptance Tests** to view automated verification results for all test matrix items.

## Fixtures & Repository Map

```text
ContextGuard/
├── index.html     # Semantic application shell and 10 PRD screens
├── styles.css     # Responsive product UI & security indicator badges
├── app.js         # Synthetic fixtures, policy engine (P-001..P-009), SHA-256 audit chain, alerts (D-01..D-04), & 30-scenario test suite
└── README.md
```

### Synthetic Staff Fixtures (Appendix A.2)
- `USR-001` Ada Nwosu (Records clerk, Health Info, WARD-ED)
- `USR-002` Bola Okafor (Records clerk, Health Info, WARD-MED)
- `USR-003` Chinedu Eze (Nurse, Nursing, WARD-ED)
- `USR-004` David Ade (Doctor, Emergency Medicine, WARD-ED)
- `USR-005` Esther Bello (Doctor, Internal Medicine, WARD-MED)
- `USR-006` Femi Lawal (Doctor, Cardiology, WARD-CARD)
- `USR-007` Grace Obi (Lab staff, Laboratory, WARD-ED)
- `USR-008` Hauwa Musa (Pharmacy staff, Pharmacy, WARD-MED)
- `USR-009` Ifeanyi Udo (Intern, Medicine, WARD-MED)
- `USR-010` Jide Alabi (Security officer, Information Security)
- `USR-011` Kemi Yusuf (System admin, IT Operations)

### Synthetic Patient Fixtures (Appendix A.3)
- `PAT-1001` Patient Alpha (WARD-ED, Standard, Assigned doctor access)
- `PAT-1002` Patient Bravo (WARD-ED, Restricted, Clerk restricted access)
- `PAT-1003` Patient Charlie (WARD-MED, Standard, Cross-ward denial)
- `PAT-1004` Patient Delta (WARD-CARD, Restricted, Compromised-account browsing)
- `PAT-1005` Patient Echo (WARD-CARD, Standard, Emergency access scenario)
- `PAT-1006` Patient Foxtrot (WARD-MED, Standard, Nurse ward access)
- `PAT-1007` Patient Golf (WARD-ED, Restricted, Sensitive field policy)
- `PAT-1008` Patient Hotel (WARD-MED, Standard, Expired intern scenario)
- `PAT-1009` Patient India (WARD-CARD, Standard, High-volume browsing)
- `PAT-1010` Patient Juliet (WARD-ED, Standard, Offline emergency summary)
- `PAT-1011` Patient Kilo (WARD-MED, Restricted, Audit event sequence)
- `PAT-1012` Patient Lima (WARD-CARD, Standard, Legitimate cross-ward temporary assignment)

## Intentional Limitations

- The application contains **synthetic data only** and must never be populated with real patient data.
- Policy thresholds are design hypotheses and require hospital clinical-governance validation.
- The detector creates review signals, not accusations or automated disciplinary outcomes.
- Browser JavaScript demonstrates the workflow; a production deployment requires server-side PDP enforcement.
