import React from 'react';

interface TestResult {
  id: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
}

interface TestRunnerModalProps {
  results: TestResult[];
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ results, onClose }) => {
  const passCount = results.filter(r => r.status === 'PASS').length;

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: '640px' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <p className="eyebrow">ACCEPTANCE TEST MATRIX</p>
        <h2>PRD Acceptance Test Results ({passCount}/30 Passed)</h2>
        <p>Automated verification suite executing AUTH-01..11, AUD-01..05, BG-01..05, DET-01..04, OFF-01..05.</p>

        <div style={{ maxHeight: '360px', overflowY: 'auto', marginTop: '14px', border: '1px solid #dce8e5', borderRadius: '8px' }}>
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fbfa', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>ID</th>
                <th style={{ padding: '10px' }}>Category</th>
                <th style={{ padding: '10px' }}>Description</th>
                <th style={{ padding: '10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map(t => (
                <tr key={t.id} style={{ borderTop: '1px solid #edf2ef' }}>
                  <td style={{ padding: '10px' }}><strong>{t.id}</strong></td>
                  <td style={{ padding: '10px' }}>{t.category}</td>
                  <td style={{ padding: '10px' }}>{t.description}</td>
                  <td style={{ padding: '10px' }}>
                    <span className={`chip ${t.status === 'PASS' ? 'safe' : 'danger'}`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="primary-button" onClick={onClose}>Close Test Report</button>
        </div>
      </div>
    </div>
  );
};
