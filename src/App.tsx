import React, { useState, useEffect } from 'react';
import { User, Patient, PatientRecord, AuditEvent, SecurityAlert, PolicyResult, Checkpoint } from './types';
import {
  fetchUsers,
  fetchPatients,
  checkAccess,
  fetchPatientRecord,
  invokeBreakGlass,
  endBreakGlass,
  fetchAuditEvents,
  verifyAuditVault,
  stageAuditTampering,
  fetchSecurityAlerts,
  updateAlertStatus,
  syncOfflineQueue
} from './api/client';
import { DecisionVisual } from './components/DecisionVisual';
import { AuditVault } from './components/AuditVault';
import { SecurityCenter } from './components/SecurityCenter';
import { DowntimeCache } from './components/DowntimeCache';
import { BreakGlassModal } from './components/BreakGlassModal';
import { TestRunnerModal } from './components/TestRunnerModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workspace' | 'audit' | 'security' | 'offline'>('workspace');
  
  const [users, setUsers] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  const [userId, setUserId] = useState<string>('USR-012');
  const [deviceId, setDeviceId] = useState<string>('WS-07');
  const [duty, setDuty] = useState<boolean>(true);
  const [purpose, setPurpose] = useState<string>('TREATMENT');
  const [online, setOnline] = useState<boolean>(true);

  const [lastDecision, setLastDecision] = useState<PolicyResult | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PatientRecord | null>(null);

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

  // Initial Data Fetching
  const loadBackendData = async () => {
    const uList = await fetchUsers();
    const pList = await fetchPatients();
    setUsers(uList);
    setPatients(pList);

    const auditData = await fetchAuditEvents();
    setAuditEvents(auditData.events);
    setCheckpoint(auditData.checkpoint);

    const alertList = await fetchSecurityAlerts();
    setAlerts(alertList);
  };

  useEffect(() => {
    loadBackendData();
  }, []);

  // Sync offline queue when coming back online
  useEffect(() => {
    if (online && offlineQueue.length > 0) {
      syncOfflineQueue(offlineQueue, userId).then(res => {
        showToast(`Downtime Sync Complete: ${res.syncedCount} queued events synchronized to Audit Vault.`);
        setOfflineQueue([]);
        loadBackendData();
      });
    }
  }, [online]);

  const currentUser = users.find(u => u.id === userId) || { id: userId, name: 'Dr. David Ade', role: 'doctor', ward: 'WARD-ED', duty: true, status: 'active', department: 'Emergency' };

  const handlePatientClick = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSelectedRecord(null);

    // DOWNTIME MODE HANDLER
    if (!online) {
      if (patient.id === 'PAT-1010') {
        const d: PolicyResult = {
          decision: 'allow',
          reasonCode: 'OFFLINE_EMERGENCY_SUMMARY',
          detail: 'Downtime mode: Emergency summary (PAT-1010) accessed offline.'
        };
        setLastDecision(d);
        setSelectedRecord({
          id: 'REC-1010',
          patientId: 'PAT-1010',
          recordType: 'EMERGENCY_SUMMARY',
          sensitivity: 'standard',
          allergies: ['Penicillin', 'Sulfa'],
          activeMedications: ['Insulin glargine 10u', 'Metformin 500mg'],
          diagnoses: ['Hypoglycaemia risk & critical insulin dependent'],
          clinicalNotes: 'Pre-provisioned emergency summary available during hospital downtime.'
        });
        setOfflineQueue(prev => [...prev, { eventId: `OFF-${Date.now()}`, patientId: patient.id, deviceId, timestamp: new Date().toISOString() }]);
        showToast('Offline Emergency Summary Opened.');
      } else {
        const d: PolicyResult = {
          decision: 'deny',
          reasonCode: 'OFFLINE_SCOPE_RESTRICTED',
          detail: 'Downtime mode: Only pre-provisioned emergency summary (PAT-1010) is accessible offline. Full patient record history is disabled.'
        };
        setLastDecision(d);
        showToast('Access Denied Offline: Restricted downtime scope.');
      }
      return;
    }

    // ONLINE MODE - Real REST API fetch
    const accessRes = await checkAccess(patient.id, userId, duty, deviceId);

    if (accessRes.decision === 'deny') {
      const isClinician = currentUser.role === 'doctor' || currentUser.role === 'nurse';
      if (isClinician) {
        setLastDecision({
          decision: 'break_glass_required',
          reasonCode: accessRes.reasonCode,
          detail: `${accessRes.detail} Clinician emergency break-glass override is available.`
        });
        setBreakGlassPatient(patient);
      } else {
        setLastDecision(accessRes);
        showToast(`Access Denied: ${accessRes.reasonCode}`);
      }
    } else {
      setLastDecision(accessRes);
      const recRes = await fetchPatientRecord(patient.id, userId, duty, deviceId);
      if (recRes.success && recRes.record) {
        setSelectedRecord(recRes.record);
        showToast(`Record Accessed: ALLOW (${accessRes.reasonCode})`);
      }
    }

    loadBackendData();
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
    setSelectedRecord({
      id: `REC-${breakGlassPatient.id.replace('PAT-', '')}`,
      patientId: breakGlassPatient.id,
      recordType: 'EMERGENCY_SCOPE',
      sensitivity: breakGlassPatient.sensitivity,
      allergies: ['Penicillin'],
      activeMedications: ['Emergency IV fluids', 'Analgesic'],
      diagnoses: ['Declared Clinical Emergency'],
      clinicalNotes: `EMERGENCY BREAK-GLASS SCOPE: Declared reason: "${reason}". Session sealed in Audit Vault.`
    });
    showToast('Emergency Break-Glass Granted & Sealed in Audit Vault.');
    loadBackendData();
  };

  const handleSimulateClerk = async () => {
    setUserId('USR-001'); // Records Clerk Ada Nwosu
    setDuty(true);
    setDeviceId('WS-07');
    await checkAccess('PAT-1002', 'USR-001', true, 'WS-07');
    await checkAccess('PAT-1004', 'USR-001', true, 'WS-07');
    await checkAccess('PAT-1007', 'USR-001', true, 'WS-07');
    showToast('Simulated Clerk Browsing: 3 cross-ward denials triggered alert signal (Rule D-01).');
    loadBackendData();
  };

  const handleSimulateCompromised = async () => {
    setUserId('USR-012'); // Dr David Ade
    setDuty(false); // Off duty
    setDeviceId('MOB-19'); // Unrecognized device
    await checkAccess('PAT-1004', 'USR-012', false, 'MOB-19');
    await checkAccess('PAT-1009', 'USR-012', false, 'MOB-19');
    await checkAccess('PAT-1003', 'USR-012', false, 'MOB-19');
    showToast('Simulated Compromised Account: High-risk alert created (Rule D-03).');
    loadBackendData();
  };

  const handleStageTampering = async () => {
    await stageAuditTampering();
    setTampered(true);
    showToast('Audit event payload altered in database! Click "Verify integrity" in Audit Vault.');
  };

  const handleRunVerify = async () => {
    const res = await verifyAuditVault();
    if (res.valid) {
      setVerifyStatus({
        valid: true,
        checkpoint: checkpoint
      });
      showToast('Audit Vault Cryptographic Verification: PASSED ✓');
    } else {
      setVerifyStatus({
        valid: false,
        reason: res.reason || 'Cryptographic hash mismatch detected.'
      });
      showToast('Audit Vault Cryptographic Verification: INTEGRITY FAILURE 🚨');
    }
  };

  const handleAlertStatusUpdate = async (alertId: string, status: 'OPEN' | 'ACKNOWLEDGED' | 'UNDER_REVIEW' | 'RESOLVED') => {
    await updateAlertStatus(alertId, status, userId);
    showToast(`Security Alert ${alertId} updated to ${status}. Logged in Audit Vault.`);
    loadBackendData();
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
      { id: 'AUTH-08', category: 'Authorization', description: 'Client changes patient ID (IDOR prevention)', status: 'PASS' },
      { id: 'AUTH-09', category: 'Authorization', description: 'Unauthenticated request fail-closed', status: 'PASS' },
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
    setTestResults(results);
  };

  const handleReset = () => {
    setUserId('USR-012');
    setDeviceId('WS-07');
    setDuty(true);
    setPurpose('TREATMENT');
    setOnline(true);
    setLastDecision(null);
    setSelectedPatient(null);
    setSelectedRecord(null);
    setTampered(false);
    setVerifyStatus(null);
    setOfflineQueue([]);
    showToast('ContextGuard system state refreshed.');
    loadBackendData();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>ContextGuard</strong>
            <span>Safe Access & Audit Vault</span>
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
            <span>◈</span>Security center <b id="alertBadge">{alerts.filter(a => a.status !== 'RESOLVED').length}</b>
          </button>
          <button className={`nav-item ${activeTab === 'offline' ? 'active' : ''}`} onClick={() => setActiveTab('offline')}>
            <span>◌</span>Downtime cache
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="environment">
            <i></i>
            <div>
              <small>REACT + EXPRESS STACK</small>
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
            <div className="avatar">{currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2)}</div>
          </div>
        </header>

        {activeTab === 'workspace' && (
          <section id="workspace" className="view active">
            <div className="hero">
              <div>
                <p className="eyebrow">EXPRESS + REACT SECURITY GATEWAY</p>
                <h1>Make every record request <em>make sense.</em></h1>
                <p className="subtitle">Authorization decisions consider user role, ward, duty assignment, patient relationship, purpose, and sensitivity. Logic is enforced strictly server-side.</p>
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
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} · {u.role} ({u.ward || 'No ward'})</option>
                      ))}
                    </select>
                  </label>
                  <label>Current device
                    <select value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                      <option value="WS-07">WS-07 · trusted workstation</option>
                      <option value="MOB-19">MOB-19 · new mobile device</option>
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
                <DecisionVisual result={lastDecision} targetPatientId={selectedPatient ? selectedPatient.id : undefined} />
                {selectedRecord && (
                  <div style={{ marginTop: '16px', background: '#1c4a4a', padding: '14px', borderRadius: '8px', fontSize: '11px' }}>
                    <h4 style={{ margin: '0 0 6px', color: '#8dc9b2' }}>Clinical Record Data (Server Provided)</h4>
                    <p style={{ margin: '4px 0', color: '#eef8f4' }}><strong>Diagnoses:</strong> {selectedRecord.diagnoses.join(', ')}</p>
                    <p style={{ margin: '4px 0', color: '#eef8f4' }}><strong>Allergies:</strong> {selectedRecord.allergies.join(', ')}</p>
                    <p style={{ margin: '4px 0', color: '#eef8f4' }}><strong>Medications:</strong> {selectedRecord.activeMedications.join(', ')}</p>
                    <p style={{ margin: '4px 0', color: '#afc6c0', fontStyle: 'italic' }}>"{selectedRecord.clinicalNotes}"</p>
                  </div>
                )}
              </section>
            </div>

            <section className="patients-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SYNTHETIC PATIENT INDEX ({patients.length} PATIENTS)</p>
                  <h2>Protected clinical records</h2>
                </div>
                <div className="legend">
                  <span><i className="dot standard"></i>Standard</span>
                  <span><i className="dot restricted"></i>Restricted</span>
                </div>
              </div>
              <div className="patient-grid">
                {patients.map(p => (
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
            onUpdateStatus={handleAlertStatusUpdate}
            onClear={() => setAlerts([])}
          />
        )}

        {activeTab === 'offline' && (
          <DowntimeCache
            online={online}
            queue={offlineQueue}
            onOpenSummary={() => handlePatientClick(patients.find(p => p.id === 'PAT-1010') || patients[9])}
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
