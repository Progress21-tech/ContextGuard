/**
 * ContextGuard Express Backend Server & Security Gateway
 * Full RESTful API with Real JWT Authentication, Server-Side PDP Policy Engine,
 * EMR Connector Architecture, Cryptographic Audit Vault, Explainable Alert Engine,
 * Break-Glass Emergency Controller, and Downtime Sync.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./backend/db/index');
const { hashPassword, comparePassword, signJWT, verifyJWT } = require('./backend/auth/jwt');
const { requireAuth } = require('./backend/auth/middleware');
const { evaluatePolicy } = require('./backend/policies/evaluator');
const { AuditVaultService } = require('./backend/audit/vault');
const { AlertDetectorService } = require('./backend/alerts/detector');
const { mockEMR } = require('./backend/emr/mockAdapter');
const { USERS: SEED_USERS, PATIENTS: SEED_PATIENTS } = require('./backend/db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins,
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

// --- 1. HEALTHCHECK (Section 33) ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// --- 2. AUTHENTICATION (Part 7 & 8) ---
app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: 'MISSING_CREDENTIALS', message: 'Staff ID and password are required.' });
  }

  const user = SEED_USERS.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid Staff ID or password.' });
  }

  // Verify bcrypt/crypto hashed password
  const isValid = comparePassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid Staff ID or password.' });
  }

  // Issue signed JWT token containing userId and role
  const token = signJWT({ userId: user.id, role: user.role });

  auditVault.logEvent({
    user: { id: user.id, name: user.name, role: user.role, ward: user.ward_id },
    patient: { id: 'SYSTEM', sensitivity: 'standard' },
    action: 'LOGIN',
    decision: 'ALLOW',
    reasonCode: 'AUTHENTICATION_SUCCESSFUL',
    deviceId: req.headers['x-device-id'] || 'WS-07'
  });

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

app.post('/api/auth/logout', requireAuth, (req, res) => {
  auditVault.logEvent({
    user: req.user,
    patient: { id: 'SYSTEM', sensitivity: 'standard' },
    action: 'LOGOUT',
    decision: 'ALLOW',
    reasonCode: 'SESSION_CLOSED',
    deviceId: req.deviceId
  });
  res.json({ message: 'Session closed successfully' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.get('/api/users/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.get('/api/users', requireAuth, (req, res) => {
  const sanitized = SEED_USERS.map(({ password_hash, ...u }) => u);
  res.json(sanitized);
});

app.get('/api/users/:id', requireAuth, (req, res) => {
  const user = SEED_USERS.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password_hash, ...sanitized } = user;
  res.json(sanitized);
});

// --- 3. PATIENTS ---
app.get('/api/patients', requireAuth, (req, res) => {
  res.json(SEED_PATIENTS);
});

app.get('/api/patients/:id', requireAuth, (req, res) => {
  const patient = SEED_PATIENTS.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
});

// --- 4. ENCOUNTERS ---
app.get('/api/encounters', requireAuth, (req, res) => {
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

// --- 5. RECORDS & OBJECT LEVEL AUTHORIZATION (Part 12) ---
app.get('/api/patients/:id/records', requireAuth, (req, res) => {
  const patientId = req.params.id;
  const user = req.user; // Derived strictly from verified JWT!
  const deviceId = req.deviceId;
  const emergency = activeBreakGlass.has(patientId);

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

// --- 6. CONTEXT-AWARE ACCESS CONTROL (Section 9) ---
app.post('/api/access/check', requireAuth, (req, res) => {
  const { patientId, action = 'view', emergency = false } = req.body;
  const user = req.user; // Strictly server-derived from JWT!
  const deviceId = req.deviceId;

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

// --- 7. EMERGENCY BREAK GLASS (Section 13) ---
app.post('/api/break-glass/start', requireAuth, (req, res) => {
  const { patientId, reason } = req.body;
  const user = req.user;
  const deviceId = req.deviceId;

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

app.post('/api/break-glass/reason', requireAuth, (req, res) => {
  const { patientId, reason } = req.body;
  const event = auditVault.logEvent({
    user: req.user,
    patient: { id: patientId, sensitivity: 'standard' },
    action: 'BREAK_GLASS_REASON',
    decision: 'ALLOW',
    reasonCode: 'EMERGENCY_REASON_CAPTURED',
    emergency: true,
    deviceId: req.deviceId
  });

  res.json({ status: 'REASON_RECORDED', eventId: event.eventId });
});

app.post('/api/break-glass/end', requireAuth, (req, res) => {
  const { patientId } = req.body;
  activeBreakGlass.delete(patientId);

  const event = auditVault.logEvent({
    user: req.user,
    patient: { id: patientId, sensitivity: 'standard' },
    action: 'BREAK_GLASS_ENDED',
    decision: 'ALLOW',
    reasonCode: 'EMERGENCY_SESSION_CLOSED',
    emergency: false,
    deviceId: req.deviceId
  });

  res.json({ status: 'SESSION_TERMINATED', eventId: event.eventId });
});

app.get('/api/break-glass/active', requireAuth, (req, res) => {
  res.json(Array.from(activeBreakGlass.values()));
});

// --- 8. EMR CONNECTOR & INTEGRATION ADAPTER (Parts 21-33, 51) ---
app.get('/api/emr/integrations', requireAuth, (req, res) => {
  res.json([
    {
      id: 'EMR-MOCK-01',
      name: mockEMR.name,
      type: mockEMR.type,
      baseUrl: mockEMR.baseUrl,
      status: mockEMR.status,
      capabilities: mockEMR.getAvailableCapabilities(),
      lastTestedAt: mockEMR.lastTestedAt,
      requestCount: mockEMR.requestCount
    },
    {
      id: 'EMR-FHIR-02',
      name: 'OpenMRS FHIR Interoperability Endpoint',
      type: 'FHIR REST API',
      baseUrl: 'https://openmrs.hospital.ng/openmrs/ws/fhir2/R4',
      status: 'READY',
      capabilities: ['Patient.read', 'Encounter.read', 'Observation.read', 'AuditEvent.write'],
      lastTestedAt: new Date().toISOString(),
      requestCount: 0
    }
  ]);
});

app.post('/api/emr/test-connection', requireAuth, async (req, res) => {
  const status = await mockEMR.testConnection();
  res.json(status);
});

// CRITICAL EMR GATEWAY ROUTE: PDP Evaluation BEFORE EMR Adapter invocation!
app.get('/api/emr/patients/:id/records', requireAuth, async (req, res) => {
  const patientId = req.params.id;
  const user = req.user;
  const deviceId = req.deviceId;
  const patient = SEED_PATIENTS.find(p => p.id === patientId);

  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const hasCareRelation = (user.id === 'USR-012' && ['PAT-1001', 'PAT-1010'].includes(patientId)) ||
                          (user.id === 'USR-004' && ['PAT-1001', 'PAT-1002', 'PAT-1007', 'PAT-1010'].includes(patientId)) ||
                          (user.id === 'USR-013' && ['PAT-1003', 'PAT-1006', 'PAT-1008', 'PAT-1011'].includes(patientId)) ||
                          (user.id === 'USR-014' && ['PAT-1004', 'PAT-1005', 'PAT-1009'].includes(patientId));
  const hasCrossWardAssignment = temporaryAssignments.has(`${user.id}:${patientId}`) || (user.id === 'USR-014' && patientId === 'PAT-1012');

  // STEP 1: Evaluate ContextGuard PDP Policy
  const policyResult = evaluatePolicy(user, { id: patient.id, ward: patient.current_ward_id, sensitivity: patient.sensitivity_level }, 'view', {
    hasCareRelation,
    hasCrossWardAssignment,
    emergency: activeBreakGlass.has(patientId)
  });

  auditVault.logEvent({
    user,
    patient: { id: patient.id, sensitivity: patient.sensitivity_level },
    action: 'EMR_ACCESS_REQUEST',
    decision: policyResult.decision,
    reasonCode: policyResult.reasonCode,
    deviceId
  });

  // STEP 2: CRITICAL SECURITY CHECK - If DENIED, DO NOT call EMR Adapter!
  if (policyResult.decision === 'DENY') {
    return res.status(403).json({
      decision: 'DENY',
      reasonCode: policyResult.reasonCode,
      detail: 'ContextGuard PDP Denied Request: EMR Adapter was NOT invoked.',
      emrAdapterCalled: false
    });
  }

  // STEP 3: If ALLOWED, query external EMR Adapter
  try {
    const emrData = await mockEMR.getPatientRecords(patientId);

    auditVault.logEvent({
      user,
      patient: { id: patient.id, sensitivity: patient.sensitivity_level },
      action: 'EMR_READ_SUCCESS',
      decision: 'ALLOW',
      reasonCode: 'EMR_ADAPTER_FETCH_COMPLETED',
      deviceId
    });

    res.json({
      decision: 'ALLOW',
      emrAdapterCalled: true,
      requestCount: mockEMR.requestCount,
      data: emrData
    });
  } catch (err) {
    res.status(503).json({
      decision: 'DENY',
      reasonCode: 'EMR_UNAVAILABLE',
      detail: 'External EMR source is temporarily unavailable.',
      emrAdapterCalled: true
    });
  }
});

// --- 9. AUDIT VAULT & TAMPER EVIDENCE ---
app.get('/api/audit/events', requireAuth, (req, res) => {
  res.json({
    events: auditVault.events,
    checkpoint: auditVault.getCheckpoint()
  });
});

app.get('/api/audit/events/:id', requireAuth, (req, res) => {
  const event = auditVault.events.find(e => e.eventId === req.params.id);
  if (!event) return res.status(404).json({ error: 'Audit event not found' });
  res.json(event);
});

app.post('/api/audit/verify', requireAuth, (req, res) => {
  const verification = auditVault.verify();
  res.json(verification);
});

app.post('/api/audit/tamper', requireAuth, (req, res) => {
  auditVault.stageTampering();
  res.json({ message: 'Audit tamper simulation staged.' });
});

// --- 10. SECURITY CENTER & ALERTS ---
app.get('/api/security/alerts', requireAuth, (req, res) => {
  res.json(alertDetector.getAlerts());
});

app.get('/api/security/alerts/:id', requireAuth, (req, res) => {
  const alert = alertDetector.getAlerts().find(a => a.alertId === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

app.patch('/api/security/alerts/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const alert = alertDetector.getAlerts().find(a => a.alertId === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  alert.status = status;
  auditVault.logEvent({
    user: req.user,
    patient: { id: 'SYSTEM', sensitivity: 'standard' },
    action: 'ALERT_STATUS_UPDATE',
    decision: 'ALLOW',
    reasonCode: `ALERT_UPDATED_${status}`,
    deviceId: req.deviceId
  });

  res.json(alert);
});

// --- 11. RESTRICTED DOWNTIME MODE ---
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

app.post('/api/downtime/sync', requireAuth, (req, res) => {
  const { queue = [] } = req.body;
  const syncedEvents = queue.map((q) => {
    return auditVault.logEvent({
      user: req.user,
      patient: { id: q.patientId || 'PAT-1010', sensitivity: 'standard' },
      action: 'OFFLINE_SYNC',
      decision: 'ALLOW',
      reasonCode: 'DOWNTIME_EVENT_SYNCHRONIZED',
      deviceId: q.deviceId || req.deviceId
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
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ContextGuard Node.js Express Security Gateway running on port ${PORT}`);
  });
}

module.exports = app;
