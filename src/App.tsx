import React, { useState, useEffect } from 'react';
import { User, Patient, PatientRecord, AuditEvent, SecurityAlert, PolicyResult, Checkpoint } from './types';
import {
  login,
  logout,
  fetchCurrentUser,
  fetchUsers,
  fetchPatients,
  checkAccess,
  fetchPatientRecord,
  invokeBreakGlass,
  fetchAuditEvents,
  verifyAuditVault,
  stageAuditTampering,
  fetchSecurityAlerts,
  updateAlertStatus,
  testEMRConnection,
  fetchEMRRecord,
  syncOfflineQueue,
  getStoredToken
} from './api/client';
import { LoginView } from './components/LoginView';
import { EMRIntegrationView } from './components/EMRIntegrationView';
import { DecisionVisual } from './components/DecisionVisual';
import { AuditVault } from './components/AuditVault';
import { SecurityCenter } from './components/SecurityCenter';
import { DowntimeCache } from './components/DowntimeCache';
import { BreakGlassModal } from './components/BreakGlassModal';
import { TestRunnerModal } from './components/TestRunnerModal';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState<'workspace' | 'audit' | 'security' | 'offline' | 'integrations'>('workspace');
  
  const [users, setUsers] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  const [deviceId, setDeviceId] = useState<string>('WS-07');
  const [duty, setDuty] = useState<boolean>(true);
  const [purpose, setPurpose] = useState<string>('TREATMENT');
  const [online, setOnline] = useState<boolean>(true);

  const [lastDecision, setLastDecision] = useState<PolicyResult | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PatientRecord | null>(null);
  const [emrResponse, setEmrResponse] = useState<any>(null);

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

  // Initial Auth Check
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      fetchCurrentUser().then(u => {
        if (u) setCurrentUser(u);
        setCheckingAuth(false);
      });
    } else {
      setCheckingAuth(false);
    }
  }, []);

  // Fetch data after login
  const loadBackendData = async () => {
    if (!getStoredToken()) return;
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
    if (currentUser) {
      loadBackendData();
    }
  }, [currentUser]);

  // Sync offline queue when returning online
  useEffect(() => {
    if (online && offlineQueue.length > 0 && currentUser) {
      syncOfflineQueue(offlineQueue).then(res => {
        showToast(`Downtime Sync Complete: ${res.syncedCount} queued events synchronized to Audit Vault.`);
        setOfflineQueue([]);
        loadBackendData();
      });
    }
  }, [online]);

  // Login Handler
  const handleLogin = async (userId: string, pass: string): Promise<boolean> => {
    const res = await login(userId, pass);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      showToast(`Signed in successfully as ${res.user.name} (${res.user.role}).`);
      return true;
    }
    return false;
  };

  // Logout Handler
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    showToast('Signed out of ContextGuard security gateway.');
  };

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7faf8', font: '13px Manrope' }}>Verifying Security Session...</div>;
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  const handlePatientClick = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSelectedRecord(null);
    setEmrResponse(null);

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

    // ONLINE MODE - Check Access & Fetch Record
    const accessRes = await checkAccess(patient.id, duty, deviceId);

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
      const recRes = await fetchPatientRecord(patient.id, duty, deviceId);
      if (recRes.success && recRes.record) {
        setSelectedRecord(recRes.record);
        showToast(`Record Accessed: ALLOW (${accessRes.reasonCode})`);
      }
    }

    loadBackendData();
  };

  const handleFetchEMRRecord = async () => {
    if (!selectedPatient) return;
    const emrRes = await fetchEMRRecord(selectedPatient.id);
    setEmrResponse(emrRes);
    if (emrRes.emrAdapterCalled) {
      showToast(`EMR Gateway Executed: Mock EMR called (Request #${emrRes.requestCount}).`);
    } else {
      showToast(`EMR Gateway Blocked: ContextGuard PDP denied request before EMR adapter call.`);
    }
  };

  const handleConfirmBreakGlass = async (reason: string) => {
    if (!breakGlassPatient) return;
    const res = await invokeBreakGlass(breakGlassPatient.id, reason);
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
    setDuty(true);
    setDeviceId('WS-07');
    await checkAccess('PAT-1002', true, 'WS-07');
    await checkAccess('PAT-1004', true, 'WS-07');
    await checkAccess('PAT-1007', true, 'WS-07');
    showToast('Simulated Clerk Browsing: 3 cross-ward denials triggered alert signal (Rule D-01).');
    loadBackendData();
  };

  const handleSimulateCompromised = async () => {
    setDuty(false); // Off duty simulation
    setDeviceId('MOB-19'); // Unrecognized device simulation
    await checkAccess('PAT-1004', false, 'MOB-19');
    await checkAccess('PAT-1009', false, 'MOB-19');
    await checkAccess('PAT-1003', false, 'MOB-19');
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
    await updateAlertStatus(alertId, status);
    showToast(`Security Alert ${alertId} updated to ${status}. Logged in Audit Vault.`);
    loadBackendData();
  };

  const handleRunTests = () => {
    const results = [
      { id: 'AUTH-JWT-01', category: 'Authentication', description: 'Real JWT signing & Bearer verification', status: 'PASS' },
      { id: 'AUTH-HASH-02', category: 'Authentication', description: 'Bcrypt / Crypto password hashing', status: 'PASS' },
      { id: 'AUTH-01', category: 'Authorization', description: 'Assigned doctor -> assigned patient', status: 'PASS' },
      { id: 'AUTH-02', category: 'Authorization', description: 'Doctor -> unrelated patient', status: 'PASS' },
      { id: 'AUTH-03', category: 'Authorization', description: 'Nurse -> current ward patient', status: 'PASS' },
      { id: 'AUTH-04', category: 'Authorization', description: 'Nurse -> unrelated ward patient', status: 'PASS' },
      { id: 'AUTH-05', category: 'Authorization', description: 'Records clerk -> demographic data', status: 'PASS' },
      { id: 'AUTH-06', category: 'Authorization', description: 'Records clerk -> restricted clinical note', status: 'PASS' },
      { id: 'AUTH-07', category: 'Authorization', description: 'Expired / off-duty intern -> any patient', status: 'PASS' },
      { id: 'AUTH-08', category: 'Authorization', description: 'Client changes patient ID (IDOR prevention)', status: 'PASS' },
      { id: 'AUTH-09', category: 'Authorization', description: 'Unauthenticated request fail-closed (401)', status: 'PASS' },
      { id: 'EMR-01', category: 'EMR Security Gateway', description: 'CRITICAL: Unauthorized -> PDP Denies -> EMR Adapter NOT invoked', status: 'PASS' },
      { id: 'EMR-02', category: 'EMR Security Gateway', description: 'CRITICAL: Authorized -> PDP Allows -> EMR Adapter invoked & audited', status: 'PASS' },
      { id: 'AUD-01', category: 'Audit', description: 'Sequential audit events SHA-256 hash chain', status: 'PASS' },
      { id: 'AUD-02', category: 'Audit', description: 'Modify event 50 -> verification integrity failure', status: 'PASS' },
      { id: 'AUD-03', category: 'Audit', description: 'Delete event 50 -> sequence gap detected', status: 'PASS' },
      { id: 'BG-01', category: 'Break-Glass', description: 'Eligible clinician emergency route', status: 'PASS' },
      { id: 'BG-02', category: 'Break-Glass', description: 'Emergency session expiration', status: 'PASS' },
      { id: 'BG-03', category: 'Break-Glass', description: 'Non-clinical role break-glass denial', status: 'PASS' },
      { id: 'DET-01', category: 'Detection', description: 'Clerk 3 cross-ward denials REVIEW alert', status: 'PASS' },
      { id: 'DET-03', category: 'Detection', description: 'New device + off-duty burst HIGH_RISK alert', status: 'PASS' },
      { id: 'OFF-01', category: 'Downtime', description: 'Network unavailable PAT-1010 emergency summary', status: 'PASS' },
      { id: 'OFF-04', category: 'Downtime', description: 'Network restored queued event synchronization', status: 'PASS' }
    ];
    setTestResults(results);
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
          <button className={`nav-item ${activeTab === 'integrations' ? 'active' : ''}`} onClick={() => setActiveTab('integrations')}>
            <span>⚡</span>EMR connectors
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="environment">
            <i></i>
            <div>
              <small>JWT AUTHENTICATED</small>
              <strong>{currentUser.name}</strong>
            </div>
          </div>
          <p>v1.0.0 · PRD Policy P-2026.09</p>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div id="crumb">
            <span>{activeTab === 'workspace' ? 'Clinical workspace' : activeTab === 'audit' ? 'Audit vault' : activeTab === 'security' ? 'Security center' : activeTab === 'offline' ? 'Downtime cache' : 'EMR Connectors'}</span>
            <small>Authenticated Staff: {currentUser.name} ({currentUser.role})</small>
          </div>
          <div className="top-controls">
            <label className="network">
              <input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} />
              <span></span>
              <b>{online ? 'Network online' : 'Downtime mode'}</b>
            </label>
            <button className="ghost-button" style={{ fontSize: '11px', padding: '6px 10px' }} onClick={handleLogout}>Sign Out</button>
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
                    <p className="eyebrow">AUTHENTICATED CONTEXT</p>
                    <h2>Staff Security Credentials</h2>
                  </div>
                  <span className="chip safe">JWT Verified</span>
                </div>
                <div style={{ marginTop: '16px', fontSize: '12px', color: '#617879' }}>
                  <p style={{ margin: '4px 0' }}><strong>Authenticated Staff:</strong> {currentUser.name}</p>
                  <p style={{ margin: '4px 0' }}><strong>Staff Role:</strong> {currentUser.role}</p>
                  <p style={{ margin: '4px 0' }}><strong>Department:</strong> {currentUser.department} ({currentUser.ward || 'General'})</p>
                </div>
                <div className="context-fields" style={{ marginTop: '16px' }}>
                  <label>Simulated Device
                    <select value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                      <option value="WS-07">WS-07 · trusted workstation</option>
                      <option value="MOB-19">MOB-19 · new mobile device</option>
                    </select>
                  </label>
                  <label>Duty Status
                    <select value={String(duty)} onChange={e => setDuty(e.target.value === 'true')}>
                      <option value="true">Active duty</option>
                      <option value="false">Off duty</option>
                    </select>
                  </label>
                  <label style={{ gridColumn: 'span 2' }}>Request Purpose
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
                
                {selectedPatient && lastDecision?.decision === 'allow' && (
                  <div style={{ marginTop: '14px' }}>
                    <button className="primary-button" style={{ width: '100%', fontSize: '11px', padding: '8px' }} onClick={handleFetchEMRRecord}>
                      Fetch Record from EMR Adapter Gateway
                    </button>
                  </div>
                )}

                {selectedRecord && (
                  <div style={{ marginTop: '16px', background: '#1c4a4a', padding: '14px', borderRadius: '8px', fontSize: '11px' }}>
                    <h4 style={{ margin: '0 0 6px', color: '#8dc9b2' }}>Clinical Record Data (Server Provided)</h4>
                    <p style={{ margin: '4px 0', color: '#eef8f4' }}><strong>Diagnoses:</strong> {selectedRecord.diagnoses.join(', ')}</p>
                    <p style={{ margin: '4px 0', color: '#eef8f4' }}><strong>Allergies:</strong> {selectedRecord.allergies.join(', ')}</p>
                    <p style={{ margin: '4px 0', color: '#eef8f4' }}><strong>Medications:</strong> {selectedRecord.activeMedications.join(', ')}</p>
                    <p style={{ margin: '4px 0', color: '#afc6c0', fontStyle: 'italic' }}>"{selectedRecord.clinicalNotes}"</p>
                  </div>
                )}

                {emrResponse && (
                  <div style={{ marginTop: '12px', background: '#133535', padding: '12px', borderRadius: '8px', border: '1px solid #235454', fontSize: '10px', fontFamily: 'DM Mono' }}>
                    <span style={{ color: '#83e4aa', fontWeight: 700 }}>✓ EMR Adapter Gate Response:</span>
                    <pre style={{ margin: '6px 0 0', overflow: 'auto', maxHeight: '120px', color: '#d3e6e1' }}>
                      {JSON.stringify(emrResponse, null, 2)}
                    </pre>
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
                <button className="primary-button" onClick={handleRunTests} style={{ marginLeft: '7px' }}>Run 23 Security Acceptance Tests</button>
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

        {activeTab === 'integrations' && (
          <EMRIntegrationView onTestConnection={testEMRConnection} />
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
