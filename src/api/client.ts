import { User, Patient, PatientRecord, AuditEvent, SecurityAlert, PolicyResult, Checkpoint } from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;

export function getStoredToken(): string | null {
  return localStorage.getItem('cg_token');
}

export function setStoredToken(token: string) {
  localStorage.setItem('cg_token', token);
}

export function clearStoredToken() {
  localStorage.removeItem('cg_token');
}

// Centralized authenticated request helper (Part 6)
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  try {
    const res = await fetch(url, { ...options, headers });
    return res;
  } catch (err) {
    console.error('API Fetch Network Failure:', path, err);
    throw new Error('NETWORK_UNAVAILABLE');
  }
}

// --- AUTHENTICATION ---
export async function login(userId: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId, password })
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.message || 'Invalid Staff ID or password.' };
    }

    const data = await res.json();
    setStoredToken(data.token);
    return { success: true, token: data.token, user: data.user };
  } catch (err) {
    return { success: false, error: 'Security service unreachable.' };
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignore error on logout
  }
  clearStoredToken();
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const res = await apiFetch('/auth/me');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

// --- USERS & PATIENTS ---
export async function fetchUsers(): Promise<User[]> {
  try {
    const res = await apiFetch('/users');
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function fetchPatients(): Promise<Patient[]> {
  try {
    const res = await apiFetch('/patients');
    if (!res.ok) return [];
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

// --- ACCESS CONTROL & RECORDS ---
export async function checkAccess(
  patientId: string,
  duty: boolean,
  deviceId: string,
  emergency = false
): Promise<PolicyResult> {
  try {
    const res = await apiFetch('/access/check', {
      method: 'POST',
      headers: {
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
      detail: 'Fail-closed: Security policy engine unreachable.'
    };
  }
}

export async function fetchPatientRecord(
  patientId: string,
  duty: boolean,
  deviceId: string
): Promise<{ success: boolean; record?: PatientRecord; error?: PolicyResult }> {
  try {
    const res = await apiFetch(`/patients/${patientId}/records`, {
      headers: {
        'x-duty-status': String(duty),
        'x-device-id': deviceId
      }
    });

    if (res.status === 403) {
      const err = await res.json();
      return { success: false, error: err };
    }

    if (!res.ok) {
      return { success: false, error: { decision: 'deny', reasonCode: 'NOT_FOUND', detail: 'Patient record not found.' } };
    }

    const record = await res.json();
    return { success: true, record };
  } catch (err) {
    return {
      success: false,
      error: {
        decision: 'deny',
        reasonCode: 'NETWORK_ERROR',
        detail: 'Network loss: Full patient record history is unavailable offline.'
      }
    };
  }
}

// --- BREAK GLASS ---
export async function invokeBreakGlass(patientId: string, reason: string): Promise<any> {
  const res = await apiFetch('/break-glass/start', {
    method: 'POST',
    body: JSON.stringify({ patientId, reason })
  });
  return await res.json();
}

export async function endBreakGlass(patientId: string): Promise<any> {
  const res = await apiFetch('/break-glass/end', {
    method: 'POST',
    body: JSON.stringify({ patientId })
  });
  return await res.json();
}

// --- AUDIT & SECURITY ALERTS ---
export async function fetchAuditEvents(): Promise<{ events: AuditEvent[]; checkpoint: Checkpoint }> {
  try {
    const res = await apiFetch('/audit/events');
    if (!res.ok) return { events: [], checkpoint: { seqStart: 0, seqEnd: 0, rootHash: 'GENESIS', signature: 'UNSIGNED' } };
    return await res.json();
  } catch (err) {
    return { events: [], checkpoint: { seqStart: 0, seqEnd: 0, rootHash: 'GENESIS', signature: 'UNSIGNED' } };
  }
}

export async function verifyAuditVault(): Promise<{ valid: boolean; reason?: string; checkpoint?: Checkpoint; eventCount?: number }> {
  const res = await apiFetch('/audit/verify', { method: 'POST' });
  return await res.json();
}

export async function stageAuditTampering(): Promise<any> {
  const res = await apiFetch('/audit/tamper', { method: 'POST' });
  return await res.json();
}

export async function fetchSecurityAlerts(): Promise<SecurityAlert[]> {
  try {
    const res = await apiFetch('/security/alerts');
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function updateAlertStatus(alertId: string, status: string): Promise<SecurityAlert> {
  const res = await apiFetch(`/security/alerts/${alertId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  return await res.json();
}

// --- EMR CONNECTOR ---
export async function fetchEMRIntegrations(): Promise<any[]> {
  try {
    const res = await apiFetch('/emr/integrations');
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function testEMRConnection(): Promise<any> {
  const res = await apiFetch('/emr/test-connection', { method: 'POST' });
  return await res.json();
}

export async function fetchEMRRecord(patientId: string): Promise<any> {
  const res = await apiFetch(`/emr/patients/${patientId}/records`);
  return await res.json();
}

// --- DOWNTIME SYNC ---
export async function syncOfflineQueue(queue: any[]): Promise<any> {
  const res = await apiFetch('/downtime/sync', {
    method: 'POST',
    body: JSON.stringify({ queue })
  });
  return await res.json();
}
