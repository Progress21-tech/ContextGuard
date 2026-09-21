# ContextGuard

ContextGuard is a context aware security and accountability layer for hospital record systems. Instead of treating access as a static role based permission, ContextGuard evaluates who is requesting access, which patient is involved, what action is being performed, the user's current clinical context, and whether an emergency exception applies.

[![Build & Verification Tests](https://img.shields.io/badge/Security_Tests-34%2F34_PASSED-237858?style=flat-square)](file:///c:/Users/DELL/Documents/GitHub/ContextGuard/tests/acceptance.test.js)
[![Node.js Engine](https://img.shields.io/badge/Node.js-v22%2B-16745e?style=flat-square)](file:///c:/Users/DELL/Documents/GitHub/ContextGuard/package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](file:///c:/Users/DELL/Documents/GitHub/ContextGuard/package.json)

---

## The Problem

Digital health record adoption in hospital environments introduces critical access control and security challenges:

- **Broad Access Permissions**: Static role based permissions often grant staff blanket access to patient files across all hospital wards, creating privacy risks.
- **Dynamic Staff Responsibilities**: Healthcare workers shift between wards, duties, and care teams throughout a shift.
- **Emergency Care Needs**: Life-threatening situations require immediate clinical record access without administrative delays.
- **Trustworthy Audit Evidence**: Hospitals require verifiable evidence streams to investigate unauthorized record access and account misuse.
- **Unreliable Infrastructure**: Power interruptions and internet downtime require constrained emergency continuity without creating uncontrolled local data dumps.

---

## The Solution

ContextGuard is designed as a security and accountability layer that sits between hospital staff and an existing clinical record system. It is not an EMR replacement.

### Core Security Controls

- **Context Aware Authorization**: Evaluates user identity, active duty status, assigned ward, care team relationship, purpose, record sensitivity, and requested action.
- **Controlled Emergency Break Glass**: Provides an audited, time-limited emergency override path for clinicians during acute emergencies.
- **Tamper Evident Audit Vault**: Seals every authorization decision in a SHA-256 hash-chained log with periodic signed checkpoints.
- **Explainable Security Monitoring**: Runs deterministic rules to flag suspicious browsing, off-duty access, and repeated break-glass usage.
- **Restricted Downtime Continuity**: Serves minimal, pre-provisioned emergency summaries during network loss and synchronizes offline event logs upon reconnection.
- **Existing EMR Connector Architecture**: Enforces a strict Policy Decision Point (PDP) pre-query gate over external hospital repositories and FHIR gateways.

---

## How It Works

```text
User Request
↓
Authentication (JWT Verification)
↓
Context Collection (Subject, Ward, Duty, Patient, Action)
↓
Policy Evaluation (Policy Decision Point)
↓
Allow / Deny / Break Glass Required
↓
Clinical Record Service / EMR Gateway
↓
Structured Audit Event
↓
SHA-256 Hash Chain Vault & Security Monitoring
```

---

## Technical Architecture

```text
User Browser (Untrusted Client Environment)
↓
Vercel Frontend (Vite + React SPA with Lucide Icons)
↓ HTTPS / REST API (Bearer JWT Authorization Header)
Render API Backend (Node.js + Express)
↓
requireAuth Middleware (Cryptographic Token & Identity Verification)
↓
Policy Decision Point Evaluator (Isolated Rules PDP Engine)
↓
EMR Security Control Gateway
↓
SQLite Store / Mock FHIR EMR Adapter (v4.0.1)
↓
Audit Collector
↓
Tamper Evident Audit Store (SHA-256 Hash Chain + Signed Checkpoints)
↓
Security Center & Alert Detector (Rules D-01 to D-04)
```

### Trust Boundaries and Security Enforcement

1. **Untrusted Client Environment**: The browser is treated as untrusted. Client-side identity headers and requested permissions are never accepted at face value.
2. **Backend Security Boundary**: Server-side middleware verifies cryptographic Bearer JWT tokens and extracts user identity directly from the signed payload.
3. **Pre-Query Authorization Boundary**: ContextGuard evaluates policy before calling the EMR adapter. Unauthorized requests are rejected immediately without querying the underlying record database.
4. **Log Separation Boundary**: Audit logs are stored in a dedicated vault isolated from regular application data modifications.

---

## Feature Documentation

### Context Aware Authorization

Access requests pass through an isolated Policy Decision Point (PDP) evaluating ten contextual dimensions:
- **Subject Role**: Doctor, Nurse, Records Clerk, Lab Staff, Pharmacy Staff, System Admin, Intern.
- **Department & Ward**: Current assigned ward (for example, WARD-ED vs WARD-MED).
- **Active Duty Status**: Verification that staff is currently on duty.
- **Patient Relationship**: Active care team assignment or documented encounter.
- **Record Sensitivity**: Standard vs Restricted records.
- **Requested Action**: View, edit, export, or search.
- **Purpose**: Treatment, administration, or emergency care.
- **Device Context**: Trusted workstation vs unfamiliar mobile device.
- **Emergency Context**: Declared emergency state.

### Controlled Emergency Break Glass

- **Clinician Eligibility**: Restricted strictly to authenticated doctors and nurses.
- **Override Flow**: Requires a declared emergency and documented reason (for example: threat to life, unconscious patient).
- **Narrow Temporary Scope**: Grants a 15-minute read-only window limited to essential emergency fields (allergies, active medications, critical history).
- **Accountability**: Generates critical audit log events, flags the session in the Security Center, and explicitly blocks data exports during break-glass mode.
- **Automatic Expiration**: Access expires automatically after 15 minutes.

### Tamper Evident Audit Vault

- **Structured Event Schema**: Captures event ID, timestamp, actor identity, patient ID, action, decision, reason code, ward, policy version, and correlation ID.
- **SHA-256 Hash Chaining**: Each event hash incorporates the SHA-256 digest of the preceding event, creating a continuous cryptographic dependency.
- **Signed Checkpoints**: Periodic signed checkpoint anchors validate log root hashes against a server-side key.
- **Verification Engine**: `verifyAuditChain()` recomputes canonical hashes sequentially, detecting single-event modifications, deletions, or sequence gaps.
- **Tamper Evident**: Demonstrates cryptographic evidence of modification rather than claiming absolute physical immutability.

### Explainable Security Detection Engine

Advisory rules highlight suspicious access patterns without complex black-box algorithms:
- **Rule D-01**: Records clerk cross-ward denial threshold (3 denials in 10 minutes) triggers a REVIEW alert.
- **Rule D-02**: Clinician high-volume access (15 unrelated records in 10 minutes) triggers a HIGH_RISK alert.
- **Rule D-03**: Off-duty access from an unfamiliar device (MOB-19) triggers a HIGH_RISK alert.
- **Rule D-04**: Repeated emergency break-glass usage (3 overrides in 24 hours) triggers a CRITICAL_REVIEW alert.
- **False Positive Control (DET-04)**: Valid temporary cross-ward care assignments suppress false ward mismatch alerts.

### Downtime Mode & Offline Sync

- **Minimal Emergency Summary**: Provides read-only cached emergency summaries for pre-provisioned emergency patients (PAT-1010) during network outages.
- **Restricted Scope**: Search, full history retrievals, role changes, and exports are strictly denied while offline.
- **Local Event Queue**: Offline access attempts write metadata-only records to an offline queue.
- **Reconnection Sync**: Automatically validates and imports queued offline audit records into the central audit vault when network connection is restored.

### EMR Connector Adapter Architecture

- **Control Plane Position**: ContextGuard operates as a security gateway over existing hospital record systems.
- **Mock EMR Adapter**: The hackathon prototype includes a mock FHIR R4 compatible adapter (`mockAdapter.js`).
- **Pre-Query Security Gate**: The Policy Decision Point evaluates access requests before invoking the EMR adapter. When ContextGuard denies access, the external EMR adapter is never called.

---

## Local Setup & Commands

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
git clone https://github.com/Progress21-tech/ContextGuard.git
cd ContextGuard
npm install
```

### Application Commands

- **Seed Database**: `npm run seed`
- **Start Backend Server**: `npm start`
- **Start Development Server**: `npm run dev`
- **Build Frontend Assets**: `npm run build`
- **Run Security Test Suite**: `npm test`

---

## Environment Variables

### Frontend Environment Variables (Vercel)

```env
VITE_API_URL=http://localhost:3000
```
*Production:*
```env
VITE_API_URL=https://contextguard-6lzv.onrender.com
```

### Backend Environment Variables (Render)

```env
PORT=10000
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret-key
CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

---

## Synthetic Demo Credentials

All accounts are pre-seeded with synthetic credentials for testing and evaluation.

- **Assigned ED Doctor**: `doctor.davidade@hospital.ng` | Password: `password123`
- **Assigned ED Nurse**: `nurse.chinedu@hospital.ng` | Password: `password123`
- **Medical Ward Doctor**: `doctor.estherbello@hospital.ng` | Password: `password123`
- **Records Clerk**: `clerk.adanwosu@hospital.ng` | Password: `password123`
- **System Admin**: `admin.kemiyusuf@hospital.ng` | Password: `password123`
- **Off-Duty Intern**: `intern.ifeanyi@hospital.ng` | Password: `password123`

---

## 16-Step Demo Flow

1. **Clinician Login**: Log in as Dr. David Ade (`doctor.davidade@hospital.ng`).
2. **Assigned Access**: Select patient PAT-1001 in Emergency Department. Observe immediate `ALLOW` decision.
3. **Cross-Ward Attempt**: Select patient PAT-1003 in Medical Ward. Observe `DENY` decision (`WARD_MISMATCH`).
4. **Clerk Scope Test**: Log in as Ada Nwosu (`clerk.adanwosu@hospital.ng`). Select demographic view (`ALLOW`) vs clinical narrative (`DENY`).
5. **Security Center Signal**: Generate repeated cross-ward denials to trigger Rule D-01 in the Security Center.
6. **Break Glass Emergency**: Select patient PAT-1005 under Emergency Care purpose. Select "Threat to life" and activate Break Glass.
7. **Scoped Emergency View**: Observe 15-minute emergency read access granted with data exports disabled.
8. **Audit Vault Verification**: Open Audit Vault and inspect recorded events.
9. **Tamper Detection Test**: Click "Verify integrity" to validate the SHA-256 hash chain and signed checkpoint.
10. **Stage Tampering**: Trigger staged audit modification and re-run verification to demonstrate hash mismatch detection.
11. **EMR Connector Inspection**: Navigate to EMR Connectors. Inspect Mock FHIR Adapter details and capabilities.
12. **Test EMR Endpoint**: Click "Test Connection" to perform a live gateway health check.
13. **Blocked EMR Query**: Attempt unauthorized record retrieval and confirm the EMR request count remains zero.
14. **Downtime Mode**: Toggle network to offline state in topbar.
15. **Offline Emergency Cache**: Select PAT-1010 to view cached emergency summary while offline.
16. **Reconnection & Sync**: Toggle network online and verify offline audit event synchronization.

---

## Known Limitations

- **SQLite Database**: Uses SQLite for prototype simplicity rather than an enterprise database cluster.
- **Mock EMR Adapter**: EMR integration is demonstrated through a mock FHIR adapter interface.
- **Rule Based Misuse Detection**: Security alerts use deterministic rules rather than machine learning models.
- **Constrained Offline Scope**: Offline continuity is limited to pre-provisioned emergency summaries.
- **Prototype Status**: Developed as a hackathon submission; not penetration tested or certified for clinical deployment.
- **Synthetic Data**: All staff, patient, and clinical records are completely synthetic.

---

## Security and Data Notice

ContextGuard uses synthetic data only. It is a hackathon prototype and is not intended for clinical use. It is not a replacement for an EMR, HIS, SIEM, or enterprise identity platform.

Production deployment would require:
- Enterprise identity provider integration (OAuth2 / SAML)
- Hardened key management services (KMS / HSM)
- Formally audited immutable log storage
- Comprehensive penetration testing and compliance assessments
- Field-level encryption for stored records

ContextGuard's architecture is informed by relevant privacy, health information, and security principles including NIST SP 800-207 Zero Trust Architecture and OWASP authorization standards.

---

## Documentation Links

- **Technical Architecture Writeup**: [walkthrough.md](file:///c:/Users/DELL/Documents/GitHub/ContextGuard/walkthrough.md)
- **Implementation Plan**: [implementation_plan.md](file:///c:/Users/DELL/Documents/GitHub/ContextGuard/implementation_plan.md)
- **Production Backend Endpoint**: [https://contextguard-6lzv.onrender.com](https://contextguard-6lzv.onrender.com)
- **GitHub Repository**: [https://github.com/Progress21-tech/ContextGuard](https://github.com/Progress21-tech/ContextGuard)

---

## Technical & Research Foundation

- **NIST SP 800-207**: Zero Trust Architecture standards (PEP / PDP separation).
- **OWASP Authorization & Logging Cheat Sheets**: Server-side access enforcement and audit log integrity.
- **HL7 FHIR R4 Standards**: AuditEvent resource structure and break-glass security labels.
- **Nigeria National Health Act 2014 & NDPA 2023**: Baseline principles for health data privacy and audit accountability.
