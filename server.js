/**
 * ContextGuard Express Backend Server & Security Gateway
 * Full RESTful API with Server-Side PDP Policy Engine, Cryptographic Audit Vault,
 * Explainable Abuse Detection Engine, Break-Glass Emergency Controller, and Downtime Sync.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./backend/db/index');
const { evaluatePolicy } = require('./backend/policies/evaluator');
const { AuditVaultService } = require('./backend/audit/vault');
const { AlertDetectorService } = require('./backend/alerts/detector');
const { USERS: SEED_USERS, PATIENTS: SEED_PATIENTS } = require('./backend/db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-duty-status', 'x-device-id']
}));
app.use(express.json());

// Serve static frontend build files if present
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.use(express.static(path.join(__dirname)));

const auditVault = new AuditVaultService();
const alertDetector = new AlertDetectorService();

// State for active break-glass emergency sessions
const activeBreakGlass = new Map(); // patientId -> session object
const temporaryAssignments = new Set(); // set of `${userId}:${patientId}`

// --- HELPER: Server-Side Context Resolution ---
function resolveContext(req) {
  const userId = req.headers['x-user-id'] || req.body.userId || 'USR-012';
  const user = SEED_USERS.find(u => u.id === userId) || SEED_USERS[11];
  const duty = req.headers['x-duty-status'] !== undefined 
    ? req.headers['x-duty-status'] === 'true' 
    : (req.body.duty !== undefined ? req.body.duty : Boolean(user.duty));
  const deviceId = req.headers['x-device-id'] || req.body.deviceId || 'WS-07';
  const emergency = req.body.emergency === true || activeBreakGlass.has(req.body.patientId || req.params.id);

  return { user: { ...user, duty }, deviceId, emergency };
}

// --- 1. HEALTHCHECK (Section 33) ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// --- 2. AUTHENTICATION (Section 5) ---
app.post('/api/auth/login', (req, res) => {
  const { userId } = req.body;
  const user = SEED_USERS.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Invalid staff credential identifier' });

  const token = `JWT-SYNTHETIC-SIG-${user.id}-${Date.now()}`;
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
      ward: user.ward_id,
      duty: Boolean(user.duty)
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Session closed successfully' });
});

app.get('/api/auth/me', (req, res) => {
  const { user } = resolveContext(req);
  res.json(user);
});

app.post('/api/auth/refresh', (req, res) => {
  const { user } = resolveContext(req);
  res.json({ token: `JWT-SYNTHETIC-REFRESH-${user.id}-${Date.now()}`, user });
});

// --- 3. USERS ---
app.get('/api/users/me', (req, res) => {
  const { user } = resolveContext(req);
  res.json(user);
});

app.get('/api/users', (req, res) => {
  res.json(SEED_USERS);
});

app.get('/api/users/:id', (req, res) => {
  const user = SEED_USERS.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// --- 4. PATIENTS ---
app.get('/api/patients', (req, res) => {
  res.json(SEED_PATIENTS);
});

app.get('/api/patients/:id', (req, res) => {
  const patient = SEED_PATIENTS.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
});

// --- 5. ENCOUNTERS ---
app.get('/api/encounters', (req, res) => {
  const encounters = SEED_PATIENTS.map(p => ({
    id: `ENC-${p.id.replace('PAT-', '')}`,
    patientId: p.id,
    ward: p.current_ward_id,
    type: 'INPATIENT',
    status: 'ACTIVE',
    startAt: '2026-09-01T08:00:00Z'
  }));
  res.json(encounters);
});

app.get('/api/encounters/:id', (req, res) => {
  const enc = SEED_PATIENTS.find(p => `ENC-${p.id.replace('PAT-', '')}` === req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });
  res.json({
    id: `ENC-${enc.id.replace('PAT-', '')}`,
    patientId: enc.id,
    ward: enc.current_ward_id,
    type: 'INPATIENT',
    status: 'ACTIVE'
  });
});

// --- 6. RECORDS ---
app.get('/api/patients/:id/records', (req, res) => {
  const patientId = req.params.id;
  const { user, deviceId, emergency } = resolveContext(req);
  const patient = SEED_PATIENTS.find(p => p.id === patientId);

  if (!patient) return res.status(404).json({ error: 'Patient record not found' });

  const hasCareRelation = (user.id === 'USR-012' && ['PAT-1001', 'PAT-1010'].includes(patientId)) ||
                          (user.id === 'USR-004' && ['PAT-1001', 'PAT-1002', 'PAT-1007', 'PAT-1010'].includes(patientId)) ||
                          (user.id === 'USR-013' && ['PAT-1003', 'PAT-1006', 'PAT-1008', 'PAT-1011'].includes(patientId)) ||
                          (user.id === 'USR-014' && ['PAT-1004', 'PAT-1005', 'PAT-1009'].includes(patientId));
  const hasCrossWardAssignment = temporaryAssignments.has(`${user.id}:${patientId}`) || (user.id === 'USR-014' && patientId === 'PAT-1012');

  const policyResult = evaluatePolicy(user, { ...patient, ward: patient.current_ward_id, sensitivity: patient.sensitivity_level }, 'view', {
    hasCareRelation,
    hasCrossWardAssignment,
    emergency
  });

  auditVault.logEvent({
    user,
    patient: { id: patient.id, sensitivity: patient.sensitivity_level },
    action: 'RECORD_VIEW',
    decision: policyResult.decision,
    reasonCode: policyResult.reasonCode,
    emergency,
    deviceId
  });

  alertDetector.evaluate(user, auditVault.events, deviceId, user.duty);

  if (policyResult.decision === 'DENY') {
    return res.status(403).json({
      decision: 'DENY',
      reasonCode: policyResult.reasonCode,
      detail: policyResult.detail
    });
  }

  res.json({
    id: `REC-${patient.id.replace('PAT-', '')}`,
    patientId: patient.id,
    recordType: 'CLINICAL_SUMMARY',
    sensitivity: patient.sensitivity_level,
    allergies: patient.id === 'PAT-1010' ? ['Penicillin', 'Sulfa'] : ['No known drug allergies'],
    activeMedications: patient.id === 'PAT-1010' ? ['Insulin glargine 10u', 'Metformin 500mg'] : ['Artemether/Lumefantrine', 'Paracetamol 500mg'],
    diagnoses: [patient.purpose],
    clinicalNotes: patient.sensitivity_level === 'restricted'
      ? 'RESTRICTED CLINICAL NOTE: Confidential psychiatric/sensitive history. Access strictly audited.'
      : 'Standard clinical progress note. Patient stable on treatment regimen.'
  });
});

// --- 7. CONTEXT-AWARE ACCESS CONTROL (Section 9) ---
app.post('/api/access/check', (req, res) => {
  const { patientId, action = 'view', emergency = false } = req.body;
  const { user, deviceId } = resolveContext(req);
  const patient = SEED_PATIENTS.find(p => p.id === patientId);

  if (!patient) {
    return res.status(404).json({ decision: 'deny', reasonCode: 'INVALID_PATIENT', detail: 'Requested patient ID does not exist.' });
  }

  const formattedPatient = {
    id: patient.id,
    name: patient.name,
    ward: patient.current_ward_id,
    sensitivity: patient.sensitivity_level
  };

  const hasCareRelation = (user.id === 'USR-012' && ['PAT-1001', 'PAT-1010'].includes(patientId)) ||
                          (user.id === 'USR-004' && ['PAT-1001', 'PAT-1002', 'PAT-1007', 'PAT-1010'].includes(patientId)) ||
                          (user.id === 'USR-013' && ['PAT-1003', 'PAT-1006', 'PAT-1008', 'PAT-1011'].includes(patientId)) ||
                          (user.id === 'USR-014' && ['PAT-1004', 'PAT-1005', 'PAT-1009'].includes(patientId));
  const hasCrossWardAssignment = temporaryAssignments.has(`${user.id}:${patientId}`) || (user.id === 'USR-014' && patientId === 'PAT-1012');

  const result = evaluatePolicy(user, formattedPatient, action, {
    hasCareRelation,
    hasCrossWardAssignment,
    emergency
  });

  const event = auditVault.logEvent({
    user,
    patient: formattedPatient,
    action: action.toUpperCase(),
    decision: result.decision,
    reasonCode: result.reasonCode,
    emergency,
    deviceId
  });

  alertDetector.evaluate(user, auditVault.events, deviceId, user.duty);

  res.json({
    decision: result.decision.toLowerCase(),
    reasonCode: result.reasonCode,
    detail: result.detail,
    policyVersion: '1.0.0',
    requestId: event.correlationId
  });
});

// --- 8. EMERGENCY BREAK GLASS (Section 13) ---
app.post('/api/break-glass/start', (req, res) => {
  const { patientId, reason } = req.body;
  const { user, deviceId } = resolveContext(req);
  const patient = SEED_PATIENTS.find(p => p.id === patientId);

  if (!patient) return res.status(404).json({ decision: 'deny', reasonCode: 'INVALID_PATIENT' });

  const result = evaluatePolicy(user, { id: patient.id, ward: patient.current_ward_id, sensitivity: patient.sensitivity_level }, 'view', { emergency: true });

  const event = auditVault.logEvent({
    user,
    patient: { id: patient.id, sensitivity: patient.sensitivity_level },
    action: 'BREAK_GLASS_START',
    decision: result.decision,
    reasonCode: result.reasonCode,
    emergency: true,
    deviceId
  });

  if (result.decision === 'ALLOW') {
    const session = {
      sessionId: `BG-SESS-${Date.now()}`,
      userId: user.id,
      patientId: patient.id,
      reason: reason || 'Emergency care required',
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
    activeBreakGlass.set(patient.id, session);

    alertDetector.addAlert(
      'HIGH',
      'Emergency break-glass access invoked',
      user.id,
      user.name,
      [
        `Clinician ${user.name} declared break-glass for ${patient.name} (${patientId})`,
        `Declared reason: "${reason || 'Emergency clinical care'}"`
      ],
      [event.eventId]
    );
  }

  res.json({
    decision: result.decision.toLowerCase(),
    reasonCode: result.reasonCode,
    scope: ['allergies', 'active_medications', 'critical_history'],
    expiresInMinutes: 15,
    eventId: event.eventId
  });
});

app.post('/api/break-glass/reason', (req, res) => {
  const { patientId, reason } = req.body;
  const { user, deviceId } = resolveContext(req);

  const event = auditVault.logEvent({
    user,
    patient: { id: patientId, sensitivity: 'standard' },
    action: 'BREAK_GLASS_REASON',
    decision: 'ALLOW',
    reasonCode: 'EMERGENCY_REASON_CAPTURED',
    emergency: true,
    deviceId
  });

  res.json({ status: 'REASON_RECORDED', eventId: event.eventId });
});

app.post('/api/break-glass/end', (req, res) => {
  const { patientId } = req.body;
  const { user, deviceId } = resolveContext(req);

  activeBreakGlass.delete(patientId);

  const event = auditVault.logEvent({
    user,
    patient: { id: patientId, sensitivity: 'standard' },
    action: 'BREAK_GLASS_ENDED',
    decision: 'ALLOW',
    reasonCode: 'EMERGENCY_SESSION_CLOSED',
    emergency: false,
    deviceId
  });

  res.json({ status: 'SESSION_TERMINATED', eventId: event.eventId });
});

app.get('/api/break-glass/active', (req, res) => {
  res.json(Array.from(activeBreakGlass.values()));
});

// --- 9. AUDIT VAULT & TAMPER EVIDENCE (Section 15 & 16) ---
app.get('/api/audit/events', (req, res) => {
  res.json({
    events: auditVault.events,
    checkpoint: auditVault.getCheckpoint()
  });
});

app.get('/api/audit/events/:id', (req, res) => {
  const event = auditVault.events.find(e => e.eventId === req.params.id);
  if (!event) return res.status(404).json({ error: 'Audit event not found' });
  res.json(event);
});

app.post('/api/audit/verify', (req, res) => {
  const verification = auditVault.verify();
  res.json(verification);
});

app.post('/api/audit/tamper', (req, res) => {
  auditVault.stageTampering();
  res.json({ message: 'Audit tamper simulation staged.' });
});

// --- 10. SECURITY CENTER & ALERTS (Section 18) ---
app.get('/api/security/alerts', (req, res) => {
  res.json(alertDetector.getAlerts());
});

app.get('/api/security/alerts/:id', (req, res) => {
  const alert = alertDetector.getAlerts().find(a => a.alertId === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

app.patch('/api/security/alerts/:id', (req, res) => {
  const { status } = req.body; // OPEN | ACKNOWLEDGED | UNDER_REVIEW | RESOLVED
  const alert = alertDetector.getAlerts().find(a => a.alertId === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  alert.status = status;
  const { user, deviceId } = resolveContext(req);
  auditVault.logEvent({
    user,
    patient: { id: 'SYSTEM', sensitivity: 'standard' },
    action: 'ROLE_CHANGE',
    decision: 'ALLOW',
    reasonCode: `ALERT_STATUS_UPDATED_${status}`,
    deviceId
  });

  res.json(alert);
});

// --- 11. RESTRICTED DOWNTIME MODE (Section 20) ---
app.get('/api/downtime/status', (req, res) => {
  res.json({
    downtimeActive: false,
    emergencyCacheAvailable: true,
    cachePatientId: 'PAT-1010'
  });
});

app.get('/api/downtime/patients/:id', (req, res) => {
  if (req.params.id === 'PAT-1010') {
    return res.json({
      id: 'PAT-1010',
      name: 'Patient Juliet (Yewande Alabi)',
      allergies: ['Penicillin', 'Sulfa'],
      activeMedications: ['Insulin glargine 10u bedtime', 'Metformin 500mg BD'],
      bloodGroup: 'O positive',
      alert: 'Hypoglycaemia risk & critical insulin dependent'
    });
  }
  res.status(403).json({ decision: 'deny', reasonCode: 'OFFLINE_SCOPE_RESTRICTED', detail: 'Downtime mode restricts cached offline summaries to pre-provisioned emergency patient records.' });
});

app.post('/api/downtime/events', (req, res) => {
  res.json({ status: 'QUEUED', localId: req.body.localId || `OFF-${Date.now()}` });
});

app.post('/api/downtime/sync', (req, res) => {
  const { queue = [] } = req.body;
  const { user, deviceId } = resolveContext(req);

  const syncedEvents = queue.map((q, idx) => {
    return auditVault.logEvent({
      user,
      patient: { id: q.patientId || 'PAT-1010', sensitivity: 'standard' },
      action: 'OFFLINE_SYNC',
      decision: 'ALLOW',
      reasonCode: 'DOWNTIME_EVENT_SYNCHRONIZED',
      deviceId: q.deviceId || deviceId
    });
  });

  res.json({
    status: 'SYNC_COMPLETE',
    syncedCount: syncedEvents.length,
    events: syncedEvents
  });
});

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'index.html'));
    }
  });
});

// Start Express Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ContextGuard Node.js Express Security Gateway running on port ${PORT}`);
  });
}

module.exports = app;
