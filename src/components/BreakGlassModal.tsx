import React, { useState } from 'react';
import { Patient } from '../types';

interface BreakGlassModalProps {
  patient: Patient;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const BreakGlassModal: React.FC<BreakGlassModalProps> = ({ patient, onClose, onConfirm }) => {
  const [reason, setReason] = useState('Immediate threat to life or severe deterioration');

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-card">
        <button className="modal-close" onClick={onClose}>×</button>
        <p className="eyebrow">EMERGENCY ACCESS OVERRIDE</p>
        <h2>Break-Glass Emergency Request</h2>
        <p>
          Normal policy denied access to <strong>{patient.name} ({patient.id})</strong>. As an authenticated clinician, you may invoke emergency break-glass access. This will grant a <strong>narrow 15-minute read-only scope</strong> (allergies, medications, critical history) and generate a <strong>critical sealed audit event</strong> for governance review.
        </p>

        <label style={{ display: 'block', fontWeight: 700, marginTop: '16px', fontSize: '11px' }}>
          Mandatory Emergency Reason
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ width: '100%', padding: '10px', marginTop: '6px', border: '1px solid #dce8e5', borderRadius: '6px' }}
          >
            <option value="Immediate threat to life or severe deterioration">Immediate threat to life or severe deterioration</option>
            <option value="Unconscious patient / no history available">Unconscious patient / no history available</option>
            <option value="Critical emergency transfer of care">Critical emergency transfer of care</option>
          </select>
        </label>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '24px' }}>
          <button className="ghost-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={() => onConfirm(reason)}>Grant 15-Minute Emergency Access</button>
        </div>
      </div>
    </div>
  );
};
