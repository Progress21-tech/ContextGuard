import { User, Patient, AuditEvent, SecurityAlert, PolicyResult, Checkpoint } from '../types';

const API_BASE = '/api';

export async function checkAccess(patientId: string, userId: string, duty: boolean, deviceId: string, emergency = false): Promise<PolicyResult> {
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
      detail: 'Fail-closed: Policy service unreachable or network error.'
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

export async function fetchAuditEvents(): Promise<{ events: AuditEvent[]; checkpoint: Checkpoint }> {
  const res = await fetch(`${API_BASE}/audit/events`);
  return await res.json();
}

export async function verifyAuditVault(): Promise<{ valid: boolean; reason?: string; checkpoint?: Checkpoint; eventCount?: number }> {
  const res = await fetch(`${API_BASE}/audit/verify`, { method: 'POST' });
  return await res.json();
}

export async function fetchSecurityAlerts(): Promise<SecurityAlert[]> {
  const res = await fetch(`${API_BASE}/security/alerts`);
  return await res.json();
}
