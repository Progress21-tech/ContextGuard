/**
 * ContextGuard Node.js + Express Backend Server
 * PRD v1.0 Compliant REST API Gateway & Policy Engine
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { evaluatePolicy } = require('./backend/policies/evaluator');
const { AuditVaultService } = require('./backend/audit/vault');
const { AlertDetectorService } = require('./backend/alerts/detector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- FIXTURES IN MEMORY DATASTORE ---
const USERS = [
  { id: 'USR-001', name: 'Ada Nwosu', role: 'records clerk', department: 'Health Information', ward: 'WARD-ED', duty: true },
  { id: 'USR-002', name: 'Bola Okafor', role: 'records clerk', department: 'Health Information', ward: 'WARD-MED', duty: true },
  { id: 'USR-003', name: 'Chinedu Eze', role: 'nurse', department: 'Nursing', ward: 'WARD-ED', duty: true },
  { id: 'USR-004', name: 'David Ade', role: 'doctor', department: 'Emergency Medicine', ward: 'WARD-ED', duty: true },
  { id: 'USR-005', name: 'Esther Bello', role: 'doctor', department: 'Internal Medicine', ward: 'WARD-MED', duty: true },
  { id: 'USR-006', name: 'Femi Lawal', role: 'doctor', department: 'Cardiology', ward: 'WARD-CARD', duty: true },
  { id: 'USR-007', name: 'Grace Obi', role: 'lab staff', department: 'Laboratory', ward: 'WARD-ED', duty: true },
  { id: 'USR-008', name: 'Hauwa Musa', role: 'pharmacy staff', department: 'Pharmacy', ward: 'WARD-MED', duty: true },
  { id: 'USR-009', name: 'Ifeanyi Udo', role: 'intern', department: 'Medicine', ward: 'WARD-MED', duty: false },
  { id: 'USR-010', name: 'Jide Alabi', role: 'security officer', department: 'Information Security', ward: null, duty: true },
  { id: 'USR-011', name: 'Kemi Yusuf', role: 'system admin', department: 'IT Operations', ward: null, duty: true }
];

const PATIENTS = [
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

const CARE_TEAM = [
  { userId: 'USR-004', patientId: 'PAT-1001' },
  { userId: 'USR-004', patientId: 'PAT-1010' },
  { userId: 'USR-003', patientId: 'PAT-1001' },
  { userId: 'USR-003', patientId: 'PAT-1002' },
  { userId: 'USR-003', patientId: 'PAT-1007' },
  { userId: 'USR-003', patientId: 'PAT-1010' },
  { userId: 'USR-005', patientId: 'PAT-1003' },
  { userId: 'USR-005', patientId: 'PAT-1006' },
  { userId: 'USR-005', patientId: 'PAT-1008' },
  { userId: 'USR-005', patientId: 'PAT-1011' },
  { userId: 'USR-006', patientId: 'PAT-1004' },
  { userId: 'USR-006', patientId: 'PAT-1005' },
  { userId: 'USR-006', patientId: 'PAT-1009' }
];

const auditVault = new AuditVaultService();
const alertDetector = new AlertDetectorService();

// Context helper
function resolveContext(req) {
  const userId = req.headers['x-user-id'] || req.body.userId || 'USR-004';
  const user = USERS.find(u => u.id === userId) || USERS[3];
  const duty = req.headers['x-duty-status'] !== undefined ? req.headers['x-duty-status'] === 'true' : (req.body.duty !== undefined ? req.body.duty : user.duty);
  const deviceId = req.headers['x-device-id'] || req.body.deviceId || 'WS-07';
  const emergency = req.body.emergency === true;
  return { user: { ...user, duty }, deviceId, emergency };
}

// --- API ENDPOINTS (PRD Section 9) ---

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { userId } = req.body;
  const user = USERS.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Invalid user ID' });
  res.json({ token: `JWT-SYNTHETIC-${user.id}`, user });
});

// GET /api/me
app.get('/api/me', (req, res) => {
  const { user } = resolveContext(req);
  res.json(user);
});

// GET /api/patients
app.get('/api/patients', (req, res) => {
  res.json(PATIENTS);
});

// GET /api/patients/:id
app.get('/api/patients/:id', (req, res) => {
  const patient = PATIENTS.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
});

// POST /api/access/check (Section 9.3)
app.post('/api/access/check', (req, res) => {
  const { patientId, action = 'view', emergency = false } = req.body;
  const { user, deviceId } = resolveContext(req);
  const patient = PATIENTS.find(p => p.id === patientId);

  if (!patient) return res.status(404).json({ decision: 'deny', reasonCode: 'INVALID_PATIENT' });

  const hasCareRelation = CARE_TEAM.some(c => c.userId === user.id && c.patientId === patient.id);
  const result = evaluatePolicy(user, patient, action, { hasCareRelation, emergency });

  const event = auditVault.logEvent({
    user,
    patient,
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

// POST /api/break-glass/start (Section 11)
app.post('/api/break-glass/start', (req, res) => {
  const { patientId, reason } = req.body;
  const { user, deviceId } = resolveContext(req);
  const patient = PATIENTS.find(p => p.id === patientId);

  const result = evaluatePolicy(user, patient, 'view', { emergency: true });

  const event = auditVault.logEvent({
    user,
    patient,
    action: 'BREAK_GLASS_START',
    decision: result.decision,
    reasonCode: result.reasonCode,
    emergency: true,
    deviceId
  });

  if (result.decision === 'ALLOW') {
    alertDetector.addAlert(
      'HIGH',
      'Emergency break-glass access invoked',
      user.id,
      user.name,
      [`Clinician ${user.name} declared break-glass for ${patientId}`, `Reason: "${reason || 'Emergency care'}"`]
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

// GET /api/audit/events
app.get('/api/audit/events', (req, res) => {
  res.json({ events: auditVault.events, checkpoint: auditVault.getCheckpoint() });
});

// POST /api/audit/verify (Section 10.4)
app.post('/api/audit/verify', (req, res) => {
  const verification = auditVault.verify();
  res.json(verification);
});

// GET /api/security/alerts
app.get('/api/security/alerts', (req, res) => {
  res.json(alertDetector.getAlerts());
});

// GET /api/downtime/patients/:id (Section 13)
app.get('/api/downtime/patients/:id', (req, res) => {
  if (req.params.id === 'PAT-1010') {
    return res.json({
      id: 'PAT-1010',
      name: 'Patient Juliet',
      allergies: ['Penicillin'],
      activeMedications: ['Insulin glargine'],
      bloodGroup: 'O positive',
      alert: 'Hypoglycaemia risk'
    });
  }
  res.status(403).json({ decision: 'deny', reasonCode: 'OFFLINE_SCOPE_RESTRICTED' });
});

// Catch-all route to serve index.html for root path and frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Server if invoked directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ContextGuard Node.js Express server running on port ${PORT}`);
  });
}

module.exports = app;
