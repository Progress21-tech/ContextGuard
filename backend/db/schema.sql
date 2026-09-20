-- ContextGuard Representative SQL Schema (PRD Section 8.3)
-- Prototype Synthetic Database Setup

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('records','nurse','doctor','lab','pharmacy','intern','security','admin')),
  department TEXT NOT NULL,
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
  sensitivity_level TEXT NOT NULL DEFAULT 'standard'
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

-- Audit tables are isolated from clinical schema
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  action TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason_code TEXT NOT NULL,
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
  actor_id TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  explanation_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offline_events (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  local_sequence INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'QUEUED',
  created_at TEXT NOT NULL
);
