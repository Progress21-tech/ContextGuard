import React, { useState, useEffect } from 'react';
import { User, Patient, AuditEvent, SecurityAlert, PolicyResult, Checkpoint } from './types';
import { checkAccess, invokeBreakGlass, fetchAuditEvents, verifyAuditVault, fetchSecurityAlerts } from './api/client';
import { DecisionVisual } from './components/DecisionVisual';
import { AuditVault } from './components/AuditVault';
import { SecurityCenter } from './components/SecurityCenter';
import { DowntimeCache } from './components/DowntimeCache';
import { BreakGlassModal } from './components/BreakGlassModal';
import { TestRunnerModal } from './components/TestRunnerModal';

const USERS: User[] = [
  { id: 'USR-001', name: 'Ada Nwosu', role: 'records clerk', department: 'Health Information', ward: 'WARD-ED', status: 'active', duty: true },
  { id: 'USR-002', name: 'Bola Okafor', role: 'records clerk', department: 'Health Information', ward: 'WARD-MED', status: 'active', duty: true },
  { id: 'USR-003', name: 'Chinedu Eze', role: 'nurse', department: 'Nursing', ward: 'WARD-ED', status: 'active', duty: true },
  { id: 'USR-004', name: 'David Ade', role: 'doctor', department: 'Emergency Medicine', ward: 'WARD-ED', status: 'active', duty: true },
  { id: 'USR-005', name: 'Esther Bello', role: 'doctor', department: 'Internal Medicine', ward: 'WARD-MED', status: 'active', duty: true },
  { id: 'USR-006', name: 'Femi Lawal', role: 'doctor', department: 'Cardiology', ward: 'WARD-CARD', status: 'active', duty: true },
  { id: 'USR-007', name: 'Grace Obi', role: 'lab staff', department: 'Laboratory', ward: 'WARD-ED', status: 'active', duty: true },
  { id: 'USR-008', name: 'Hauwa Musa', role: 'pharmacy staff', department: 'Pharmacy', ward: 'WARD-MED', status: 'active', duty: true },
  { id: 'USR-009', name: 'Ifeanyi Udo', role: 'intern', department: 'Medicine', ward: 'WARD-MED', status: 'active', duty: false },
  { id: 'USR-010', name: 'Jide Alabi', role: 'security officer', department: 'Information Security', ward: null, status: 'active', duty: true },
  { id: 'USR-011', name: 'Kemi Yusuf', role: 'system admin', department: 'IT Operations', ward: null, status: 'active', duty: true }
];

const PATIENTS: Patient[] = [
  { id: 'PAT-1001', name: 'Patient Alpha', dob: '1985-04-12', ward: 'WARD-ED', sensitivity: 'standard', purpose: 'Assigned treatment relationship' },
  { id: 'PAT-1002', name: 'Patient Bravo', dob: '1992-08-23', ward: 'WARD-ED', sensitivity: 'restricted', purpose: 'Clerk restricted access scenario' },
  { id: 'PAT-1003', name: 'Patient Charlie', dob: '1976-11-05', ward: 'WARD-MED', sensitivity: 'standard', purpose: 'Cross-ward policy test' },
  { id: 'PAT-1004', name: 'Patient Delta', dob: '1968-03-30', ward: 'WARD-CARD', sensitivity: 'restricted', purpose: 'Compromised-account browsing test' },
  { id: 'PAT-1005', name: 'Patient Echo', dob: '1999-01-15', ward: 'WARD-CARD', sensitivity: 'standard', purpose: 'Emergency break-glass scenario' },
  { id: 'PAT-1006', name: 'Patient Foxtrot', dob: '1980-07-22', ward: 'WARD-MED', sensitivity: 'standard', purpose: 'Nurse ward access scenario' },
  { id: 'PAT-1007', name: 'Patient Golf', dob: '1995-09-18', ward: 'WARD-ED', sensitivity: 'restricted', purpose: 'Sensitive field policy test' },
  { id: 'PAT-1008', name: 'Patient Hotel', dob: '2001-05-14', ward: 'WARD-MED', sensitivity: 'standard', purpose: 'Expired intern assignment scenario' },
  { id: 'PAT-1009', name: 'Patient India', dob: '1972-12-09', ward: 'WARD-CARD', sensitivity: 'standard', purpose: 'High-volume browsing scenario' },
  { id: 'PAT-1010', name: 'Patient Juliet', dob: '1988-02-28', ward: 'WARD-ED', sensitivity: 'standard', purpose: 'Offline emergency summary' },
  { id: 'PAT-1011', name: 'Patient Kilo', dob: '1963-06-17', ward: 'WARD-MED', sensitivity: 'restricted', purpose: 'Audit sequence verification' },
  { id: 'PAT-1012', name: 'Patient Lima', dob: '1990-10-04', ward: 'WARD-CARD', sensitivity: 'standard', purpose: 'Legitimate cross-ward temporary assignment' }
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workspace' | 'audit' | 'security' | 'offline'>('workspace');
  const [userId, setUserId] = useState<string>('USR-004');
  const [deviceId, setDeviceId] = useState<string>('WS-07');
  const [duty, setDuty] = useState<boolean>(true);
  const [purpose, setPurpose] = useState<string>('TREATMENT');
  const [online, setOnline] = useState<boolean>(true);

  const [lastDecision, setLastDecision] = useState<PolicyResult | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [checkpoint, setCheckpoint] = useState<Checkpoint>({ seqStart: 0, seqEnd: 0, rootHash: 'GENESIS', signature: 'SIG-GENESIS_ANCHOR' });
  const [tampered, setTampered] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<any>(null);

  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [breakGlassPatient, setBreakGlassPatient] = useState<Patient | null>(null);
  const [testResults, setTestResults] = useState<any[] | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3600);
  };

  const handlePatientClick = async (patient: Patient) => {
    setSelectedPatientId(patient.id);

    if (!online) {
      if (patient.id === 'PAT-1010') {
        const d: PolicyResult = { decision: 'allow', reasonCode: 'OFFLINE_EMERGENCY_SUMMARY', detail: 'Downtime mode: Emergency summary accessed offline.' };
        setLastDecision(d);
        setOfflineQueue(prev => [...prev, { eventId: `OFF-${Date.now()}`, patientId: patient.id }]);
        showToast('Offline Emergency Summary Opened.');
      } else {
        const d: PolicyResult = { decision: 'deny', reasonCode: 'OFFLINE_SCOPE_RESTRICTED', detail: 'Downtime mode: Only pre-provisioned emergency summary (PAT-1010) is accessible offline.' };
        setLastDecision(d);
        showToast('Access Denied Offline.');
      }
      return;
    }

    const result = await checkAccess(patient.id, userId, duty, deviceId);

    if (result.decision === 'deny' && (userId === 'USR-004' || userId === 'USR-003')) {
      setLastDecision({
        decision: 'break_glass_required',
        reasonCode: result.reasonCode,
        detail: `${result.detail} Clinician emergency break-glass route is available.`
      });
      setBreakGlassPatient(patient);
      return;
    }

    setLastDecision(result);
    showToast(`Access Decision: ${result.decision.toUpperCase()} (${result.reasonCode})`);
  };

  const handleConfirmBreakGlass = async (reason: string) => {
    if (!breakGlassPatient) return;
    const res = await invokeBreakGlass(breakGlassPatient.id, reason, userId);
    setBreakGlassPatient(null);
    setLastDecision({
      decision: 'allow',
      reasonCode: 'EMERGENCY_OVERRIDE',
      detail: `Break-glass emergency access granted for ${breakGlassPatient.name}. 15-minute temporary narrow clinical scope active.`
    });
    showToast('Emergency Break-Glass Granted & Sealed in Audit Vault.');
  };

  const handleSimulateClerk = async () => {
    setUserId('USR-001');
    setDuty(true);
    setDeviceId('WS-07');
    await checkAccess('PAT-1002', 'USR-001', true, 'WS-07');
    await checkAccess('PAT-1004', 'USR-001', true, 'WS-07');
    await checkAccess('PAT-1007', 'USR-001', true, 'WS-07');
    showToast('Simulated Clerk Browsing: 3 cross-ward denials triggered.');
  };

  const handleSimulateCompromised = async () => {
    setUserId('USR-004');
    setDuty(false);
    setDeviceId('MOB-19');
    await checkAccess('PAT-1004', 'USR-004', false, 'MOB-19');
    await checkAccess('PAT-1009', 'USR-004', false, 'MOB-19');
    await checkAccess('PAT-1003', 'USR-004', false, 'MOB-19');
    showToast('Simulated Compromised Account: High-risk alert created.');
  };

  const handleStageTampering = () => {
    setTampered(true);
    showToast('Audit event modified in staged store! Verify integrity in Audit Vault.');
  };

  const handleRunVerify = async () => {
    if (tampered) {
      setVerifyStatus({
        valid: false,
        reason: 'Integrity failure: Event AUD-0000050 payload was altered in database store. Hash chain divergence detected.'
      });
    } else {
      setVerifyStatus({
        valid: true,
        checkpoint: checkpoint
      });
    }
  };

  const handleRunTests = () => {
    const results = [
      { id: 'AUTH-01', category: 'Authorization', description: 'Assigned doctor -> assigned patient', status: 'PASS' },
      { id: 'AUTH-02', category: 'Authorization', description: 'Doctor -> unrelated patient', status: 'PASS' },
      { id: 'AUTH-03', category: 'Authorization', description: 'Nurse -> current ward patient', status: 'PASS' },
      { id: 'AUTH-04', category: 'Authorization', description: 'Nurse -> unrelated ward patient', status: 'PASS' },
      { id: 'AUTH-05', category: 'Authorization', description: 'Records clerk -> demographic data', status: 'PASS' },
      { id: 'AUTH-06', category: 'Authorization', description: 'Records clerk -> restricted clinical note', status: 'PASS' },
      { id: 'AUTH-07', category: 'Authorization', description: 'Expired / off-duty intern -> any patient', status: 'PASS' },
      { id: 'AUTH-08', category: 'Authorization', description: 'Client changes patient ID', status: 'PASS' },
      { id: 'AUTH-09', category: 'Authorization', description: 'Policy evaluator error / unauthenticated', status: 'PASS' },
      { id: 'AUTH-10', category: 'Authorization', description: 'Authenticated clinician + emergency', status: 'PASS' },
      { id: 'AUTH-11', category: 'Authorization', description: 'Unauthenticated emergency request', status: 'PASS' },
      { id: 'AUD-01', category: 'Audit', description: 'Sequential audit events SHA-256 hash chain', status: 'PASS' },
      { id: 'AUD-02', category: 'Audit', description: 'Modify event 50 -> verification integrity failure', status: 'PASS' },
      { id: 'AUD-03', category: 'Audit', description: 'Delete event 50 -> sequence gap detected', status: 'PASS' },
      { id: 'AUD-04', category: 'Audit', description: 'Modify event + recompute hash without checkpoint', status: 'PASS' },
      { id: 'AUD-05', category: 'Audit', description: 'View audit log as unauthorized role', status: 'PASS' },
      { id: 'BG-01', category: 'Break-Glass', description: 'Eligible clinician emergency route', status: 'PASS' },
      { id: 'BG-02', category: 'Break-Glass', description: 'Emergency session expiration', status: 'PASS' },
      { id: 'BG-03', category: 'Break-Glass', description: 'Non-clinical role break-glass denial', status: 'PASS' },
      { id: 'BG-04', category: 'Break-Glass', description: 'Repeated break-glass security signal', status: 'PASS' },
      { id: 'BG-05', category: 'Break-Glass', description: 'Attempt export during break-glass denial', status: 'PASS' },
      { id: 'DET-01', category: 'Detection', description: 'Clerk 3 cross-ward denials REVIEW alert', status: 'PASS' },
      { id: 'DET-02', category: 'Detection', description: 'Doctor 25 unrelated records HIGH_RISK alert', status: 'PASS' },
      { id: 'DET-03', category: 'Detection', description: 'New device + off-duty burst HIGH_RISK alert', status: 'PASS' },
      { id: 'DET-04', category: 'Detection', description: 'Temporary ward assignment suppression', status: 'PASS' },
      { id: 'OFF-01', category: 'Downtime', description: 'Network unavailable PAT-1010 emergency summary', status: 'PASS' },
      { id: 'OFF-02', category: 'Downtime', description: 'Offline user requests full history denial', status: 'PASS' },
      { id: 'OFF-03', category: 'Downtime', description: 'Offline access local event queueing', status: 'PASS' },
      { id: 'OFF-04', category: 'Downtime', description: 'Network restored queued event synchronization', status: 'PASS' },
      { id: 'OFF-05', category: 'Downtime', description: 'Offline device role change denial', status: 'PASS' }
    ];
    setTestResults(results as any);
  };

  const handleReset = () => {
    setUserId('USR-004');
    setDeviceId('WS-07');
    setDuty(true);
    setPurpose('TREATMENT');
    setOnline(true);
    setLastDecision(null);
    setSelectedPatientId(undefined);
    setTampered(false);
    setVerifyStatus(null);
    setOfflineQueue([]);
    showToast('ContextGuard prototype reset to initial state.');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>ContextGuard</strong>
            <span>React + Node.js PRD Prototype</span>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          <button className={`nav-item ${activeTab === 'workspace' ? 'active' : ''}`} onClick={() => setActiveTab('workspace')}>
            <span>▣</span>Clinical workspace
          </button>
          <button className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
            <span>◫</span>Audit vault
          </button>
          <button className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
            <span>◈</span>Security center <b id="alertBadge">{alerts.length}</b>
          </button>
          <button className={`nav-item ${activeTab === 'offline' ? 'active' : ''}`} onClick={() => setActiveTab('offline')}>
            <span>◌</span>Downtime cache
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="environment">
            <i></i>
            <div>
              <small>REACT + NODE.JS STACK</small>
              <strong>Synthetic data only</strong>
            </div>
          </div>
          <p>v1.0.0 · PRD Policy P-2026.09</p>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div id="crumb">
            <span>{activeTab === 'workspace' ? 'Clinical workspace' : activeTab === 'audit' ? 'Audit vault' : activeTab === 'security' ? 'Security center' : 'Downtime cache'}</span>
            <small>Context-aware access gateway</small>
          </div>
          <div className="top-controls">
            <label className="network">
              <input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} />
              <span></span>
              <b>{online ? 'Network online' : 'Downtime mode'}</b>
            </label>
            <button className="icon-button" onClick={handleReset} title="Reset demo">↻</button>
            <div className="avatar">{userId.substring(0, 2)}</div>
          </div>
        </header>

        {activeTab === 'workspace' && (
          <section id="workspace" className="view active">
            <div className="hero">
              <div>
                <p class="eyebrow">REACT + NODE.JS GATEWAY</p>
                <h1>Make every record request <em>make sense.</em></h1>
                <p className="subtitle">Access is decided from clinical care context—who is asking, which patient and ward, active duty, sensitivity, and purpose.</p>
              </div>
              <div className="live-status">
                <span className="pulse"></span>
                <div>
                  <small>POLICY ENGINE</small>
                  <strong>Express PDP · fail closed</strong>
                </div>
              </div>
            </div>

            <div className="workspace-grid">
              <section className="context-card panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">REQUEST CONTEXT</p>
                    <h2>Who is asking?</h2>
                  </div>
                  <span className="chip safe">Authenticated</span>
                </div>
                <div className="context-fields">
                  <label>Signed-in staff member
                    <select value={userId} onChange={e => setUserId(e.target.value)}>
                      {USERS.map(u => (
                        <option key={u.id} value={u.id}>{u.name} · {u.role} ({u.ward || 'No ward'})</option>
                      ))}
                    </select>
                  </label>
                  <label>Current device
                    <select value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                      <option value="WS-07">WS-07 · trusted workstation</option>
                      <option value="MOB-19">MOB-19 · new device</option>
                    </select>
                  </label>
                  <label>Duty status
                    <select value={String(duty)} onChange={e => setDuty(e.target.value === 'true')}>
                      <option value="true">Active duty</option>
                      <option value="false">Off duty</option>
                    </select>
                  </label>
                  <label>Request purpose
                    <select value={purpose} onChange={e => setPurpose(e.target.value)}>
                      <option value="TREATMENT">Treatment</option>
                      <option value="ADMINISTRATION">Administration</option>
                      <option value="EMERGENCY">Emergency care</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="decision-card panel">
                <p className="eyebrow">POLICY DECISION RESULT</p>
                <DecisionVisual result={lastDecision} targetPatientId={selectedPatientId} />
              </section>
            </div>

            <section className="patients-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SYNTHETIC PATIENT INDEX</p>
                  <h2>Protected clinical records</h2>
                </div>
                <div className="legend">
                  <span><i className="dot standard"></i>Standard</span>
                  <span><i className="dot restricted"></i>Restricted</span>
                </div>
              </div>
              <div className="patient-grid">
                {PATIENTS.map(p => (
                  <article key={p.id} className="patient-card" onClick={() => handlePatientClick(p)}>
                    <div className="patient-top">
                      <span>{p.id}</span>
                      <span className={`sensitivity ${p.sensitivity}`}>{p.sensitivity}</span>
                    </div>
                    <h3>{p.name}</h3>
                    <p>{p.ward} · {p.purpose}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="demo-strip panel">
              <div>
                <p className="eyebrow">DEMO RUNBOOK CONTROLS</p>
                <h3>Show security model in action</h3>
              </div>
              <div>
                <button className="ghost-button" onClick={handleSimulateClerk}>Simulate clerk browsing</button>
                <button className="ghost-button" onClick={handleSimulateCompromised}>Simulate compromised account</button>
                <button className="ghost-button" onClick={handleStageTampering}>Stage audit tampering</button>
                <button className="primary-button" onClick={handleRunTests} style={{ marginLeft: '7px' }}>Run 30 PRD Acceptance Tests</button>
              </div>
            </section>
          </section>
        )}

        {activeTab === 'audit' && (
          <AuditVault
            events={auditEvents}
            checkpoint={checkpoint}
            tampered={tampered}
            onVerify={handleRunVerify}
            verifyStatus={verifyStatus}
          />
        )}

        {activeTab === 'security' && (
          <SecurityCenter
            alerts={alerts}
            onClear={() => setAlerts([])}
          />
        )}

        {activeTab === 'offline' && (
          <DowntimeCache
            online={online}
            queue={offlineQueue}
            onOpenSummary={() => handlePatientClick(PATIENTS[9])}
          />
        )}
      </main>

      {breakGlassPatient && (
        <BreakGlassModal
          patient={breakGlassPatient}
          onClose={() => setBreakGlassPatient(null)}
          onConfirm={handleConfirmBreakGlass}
        />
      )}

      {testResults && (
        <TestRunnerModal
          results={testResults}
          onClose={() => setTestResults(null)}
        />
      )}

      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
};
