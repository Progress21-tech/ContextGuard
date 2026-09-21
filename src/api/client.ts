import { User, Patient, PatientRecord, AuditEvent, SecurityAlert, PolicyResult, Checkpoint } from '../types';

const API_BASE = '/api';

export async function fetchUsers(): Promise<User[]> {
  try {
    const res = await fetch(`${API_BASE}/users`);
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function fetchPatients(): Promise<Patient[]> {
  try {
    const res = await fetch(`${API_BASE}/patients`);
    const data = await res.json();
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      dob: p.dob,
      ward: p.current_ward_id || p.ward || 'WARD-ED',
      sensitivity: p.sensitivity_level || p.sensitivity || 'standard',
      purpose: p.purpose || 'Clinical care'
    }));
  } catch (err) {
    return [];
  }
}

export async function checkAccess(
  patientId: string,
  userId: string,
  duty: boolean,
  deviceId: string,
  emergency = false
): Promise<PolicyResult> {
  try {
    const res = await fetch(`${API_BASE}/access/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-duty-status': String(duty),
        'x-device-id': deviceId
      },
      body: JSON.stringify({ patientId, emergency })
    });
    return await res.json();
  } catch (err) {
    return {
      decision: 'deny',
      reasonCode: 'POLICY_UNAVAILABLE',
      detail: 'Fail-closed: Policy security service is unreachable.'
    };
  }
}

export async function fetchPatientRecord(
  patientId: string,
  userId: string,
  duty: boolean,
  deviceId: string
): Promise<{ success: boolean; record?: PatientRecord; error?: PolicyResult }> {
  try {
    const res = await fetch(`${API_BASE}/patients/${patientId}/records`, {
      headers: {
        'x-user-id': userId,
        'x-duty-status': String(duty),
        'x-device-id': deviceId
      }
    });

    if (res.status === 403) {
      const err = await res.json();
      return { success: false, error: err };
    }

    const record = await res.json();
    return { success: true, record };
  } catch (err) {
    return {
      success: false,
      error: {
        decision: 'deny',
        reasonCode: 'NETWORK_ERROR',
        detail: 'Network loss: Full patient record unavailable.'
      }
    };
  }
}

export async function invokeBreakGlass(patientId: string, reason: string, userId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/break-glass/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ patientId, reason })
  });
  return await res.json();
}

export async function endBreakGlass(patientId: string, userId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/break-glass/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ patientId })
  });
  return await res.json();
}

export async function fetchAuditEvents(): Promise<{ events: AuditEvent[]; checkpoint: Checkpoint }> {
  try {
    const res = await fetch(`${API_BASE}/audit/events`);
    return await res.json();
  } catch (err) {
    return { events: [], checkpoint: { seqStart: 0, seqEnd: 0, rootHash: 'GENESIS', signature: 'UNSIGNED' } };
  }
}

export async function verifyAuditVault(): Promise<{ valid: boolean; reason?: string; checkpoint?: Checkpoint; eventCount?: number }> {
  const res = await fetch(`${API_BASE}/audit/verify`, { method: 'POST' });
  return await res.json();
}

export async function stageAuditTampering(): Promise<any> {
  const res = await fetch(`${API_BASE}/audit/tamper`, { method: 'POST' });
  return await res.json();
}

export async function fetchSecurityAlerts(): Promise<SecurityAlert[]> {
  try {
    const res = await fetch(`${API_BASE}/security/alerts`);
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function updateAlertStatus(alertId: string, status: string, userId: string): Promise<SecurityAlert> {
  const res = await fetch(`${API_BASE}/security/alerts/${alertId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ status })
  });
  return await res.json();
}

export async function fetchDowntimeSummary(patientId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/downtime/patients/${patientId}`);
  if (!res.ok) {
    throw new Error('Downtime summary restricted');
  }
  return await res.json();
}

export async function syncOfflineQueue(queue: any[], userId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/downtime/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ queue })
  });
  return await res.json();
}
