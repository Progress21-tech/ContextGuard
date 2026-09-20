import React, { useState } from 'react';
import { AuditEvent, Checkpoint } from '../types';

interface AuditVaultProps {
  events: AuditEvent[];
  checkpoint: Checkpoint;
  tampered: boolean;
  onVerify: () => void;
  verifyStatus: { valid: boolean; reason?: string; checkpoint?: Checkpoint } | null;
}

export const AuditVault: React.FC<AuditVaultProps> = ({ events, checkpoint, tampered, onVerify, verifyStatus }) => {
  return (
    <section id="audit" className="view active">
      <div className="view-heading">
        <div>
          <p className="eyebrow">SEPARATE EVIDENCE STORE</p>
          <h1>Audit vault</h1>
          <p>Every decision produces a canonical SHA-256 hash-chained event with signed checkpoints for tamper evidence.</p>
        </div>
        <button className="primary-button" onClick={onVerify}>Verify integrity</button>
      </div>

      <div className="metrics">
        <div className="metric">
          <small>EVENTS CAPTURED</small>
          <strong>{events.length}</strong>
          <span>structured events</span>
        </div>
        <div className="metric">
          <small>CHAIN STATUS</small>
          <strong style={{ color: tampered ? '#a23c45' : '#237858' }}>{tampered ? 'CHECK REQUIRED' : 'SEALED'}</strong>
          <span>{tampered ? 'staged modification detected' : 'genesis anchor verified'}</span>
        </div>
        <div className="metric">
          <small>CHECKPOINT SIGNATURE</small>
          <strong style={{ fontSize: '13px', fontFamily: 'DM Mono' }}>{checkpoint.signature}</strong>
          <span>SHA-256 signed anchor</span>
        </div>
      </div>

      {verifyStatus && (
        <div className={`verification ${verifyStatus.valid ? 'ok' : 'fail'}`}>
          {verifyStatus.valid ? (
            <>
              <strong>✓ Cryptographic Integrity Verified</strong><br />
              Every event correctly links to its predecessor. Signed Checkpoint <code>{checkpoint.signature}</code> matches root hash across all {events.length} events.
            </>
          ) : (
            <>
              <strong>🚨 Cryptographic Integrity Failure Detected!</strong><br />
              {verifyStatus.reason}<br />
              Signed checkpoint verification failed. Preserve database snapshot for security investigation.
            </>
          )}
        </div>
      )}

      <section className="table-panel panel">
        <div className="table-head">
          <h2>Evidence stream</h2>
          <span>Audit vault · logically isolated from clinical store</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Seq</th>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Patient / Action</th>
                <th>Decision</th>
                <th>SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody>
              {events.length ? (
                [...events].reverse().map(e => (
                  <tr key={e.eventId}>
                    <td>#{e.seq}</td>
                    <td>{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td><strong>{e.actor.name}</strong> <small>({e.actor.role})</small></td>
                    <td>{e.patientId} · {e.action}</td>
                    <td><span className={`decision-tag tag-${e.decision}`}>{e.decision}</span></td>
                    <td className="hash" title={e.currentHash}>{e.currentHash.substring(0, 16)}…</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="empty-state">No audit events logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};
