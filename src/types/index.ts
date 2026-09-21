export interface User {
  id: string;
  name: string;
  role: 'records clerk' | 'nurse' | 'doctor' | 'lab staff' | 'pharmacy staff' | 'intern' | 'security officer' | 'system admin';
  department: string;
  ward: string | null;
  status: string;
  duty: boolean;
}

export interface Patient {
  id: string;
  name: string;
  dob: string;
  ward: string;
  sensitivity: 'standard' | 'restricted';
  purpose: string;
}

export interface PatientRecord {
  id: string;
  patientId: string;
  recordType: string;
  sensitivity: string;
  allergies: string[];
  activeMedications: string[];
  diagnoses: string[];
  clinicalNotes: string;
}

export interface AuditEvent {
  eventId: string;
  seq: number;
  timestamp: string;
  actor: { id: string; name: string; role: string };
  deviceId: string;
  patientId: string;
  action: string;
  resourceType: string;
  purpose: string;
  decision: 'ALLOW' | 'DENY' | 'BREAK_GLASS' | 'REVIEW';
  reasonCode: string;
  ward: string;
  policyVersion: string;
  correlationId: string;
  emergency: boolean;
  previousHash: string;
  currentHash: string;
}

export interface SecurityAlert {
  alertId: string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  actorId: string;
  actorName: string;
  signals: string[];
  openedAt: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'UNDER_REVIEW' | 'RESOLVED';
  relatedEvents: string[];
}

export interface PolicyResult {
  decision: 'allow' | 'deny' | 'break_glass_required' | 'review';
  reasonCode: string;
  detail: string;
  policyVersion?: string;
  requestId?: string;
}

export interface Checkpoint {
  seqStart: number;
  seqEnd: number;
  rootHash: string;
  signature: string;
}
