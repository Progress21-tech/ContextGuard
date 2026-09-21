-- ContextGuard Production SQL Schema (PRD Section 8 & Specification)
-- Safe Access to Patient Records - Database Model

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('records clerk','nurse','doctor','lab staff','pharmacy staff','intern','security officer','system admin')),
  department TEXT NOT NULL,
  ward_id TEXT,
  duty INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS wards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS duty_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  ward_id TEXT NOT NULL REFERENCES wards(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  current_ward_id TEXT REFERENCES wards(id),
  sensitivity_level TEXT NOT NULL DEFAULT 'standard',
  purpose TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  ward_id TEXT NOT NULL REFERENCES wards(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT
);

CREATE TABLE IF NOT EXISTS care_team (
  encounter_id TEXT NOT NULL REFERENCES encounters(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  relationship TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (encounter_id, user_id)
);

CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  encounter_id TEXT REFERENCES encounters(id),
  record_type TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'standard',
  content_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS break_glass_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  reason TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  device_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  encounter_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  purpose TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  ward TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT '1.0.0',
  correlation_id TEXT NOT NULL,
  emergency INTEGER NOT NULL DEFAULT 0,
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_checkpoints (
  id TEXT PRIMARY KEY,
  sequence_start INTEGER NOT NULL,
  sequence_end INTEGER NOT NULL,
  root_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_alerts (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  signals_json TEXT NOT NULL,
  related_events_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offline_events (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  local_sequence INTEGER NOT NULL,
  patient_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'QUEUED',
  created_at TEXT NOT NULL
);

-- Index Definitions
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_user ON duty_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_ward ON duty_assignments(ward_id);
CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_team_user ON care_team(user_id);
CREATE INDEX IF NOT EXISTS idx_records_patient ON records(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
