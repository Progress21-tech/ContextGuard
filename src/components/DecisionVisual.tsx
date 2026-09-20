import React from 'react';
import { PolicyResult } from '../types';

interface DecisionVisualProps {
  result: PolicyResult | null;
  targetPatientId?: string;
}

export const DecisionVisual: React.FC<DecisionVisualProps> = ({ result, targetPatientId }) => {
  if (!result) {
    return (
      <div id="decisionVisual" className="decision-idle">
        <span>◌</span>
        <div>
          <h2>Select a patient record</h2>
          <p>The policy decision, reason code, and security evidence will be rendered here.</p>
        </div>
      </div>
    );
  }

  const tagClass = result.decision === 'allow' ? 'allow' : result.decision === 'deny' ? 'deny' : 'break';

  return (
    <div className={`decision-result ${tagClass}`}>
      <strong>{result.decision.toUpperCase().replace('_', ' ')}</strong>
      <p>{result.detail}</p>
      <div className="decision-meta" style={{ marginTop: '12px' }}>
        <span>{result.reasonCode}</span>
        <span>Target: {targetPatientId || 'N/A'}</span>
        <span>Policy P-2026.09</span>
      </div>
    </div>
  );
};
