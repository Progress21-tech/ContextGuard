import React from 'react';
import { SecurityAlert } from '../types';

interface SecurityCenterProps {
  alerts: SecurityAlert[];
  onUpdateStatus?: (alertId: string, status: 'OPEN' | 'ACKNOWLEDGED' | 'UNDER_REVIEW' | 'RESOLVED') => void;
  onClear: () => void;
}

export const SecurityCenter: React.FC<SecurityCenterProps> = ({ alerts, onUpdateStatus, onClear }) => {
  return (
    <section id="security" className="view active">
      <div className="view-heading">
        <div>
          <p className="eyebrow">EXPLAINABLE DETECTION</p>
          <h1>Security center</h1>
          <p>Review signals highlight suspicious access patterns (D-01 to D-04) with clear human-readable explanations.</p>
        </div>
        <button className="ghost-button" onClick={onClear}>Clear demo alerts</button>
      </div>

      <div className="alert-list">
        {alerts.length ? (
          alerts.map(a => (
            <article key={a.alertId} className={`alert ${a.severity.toLowerCase()}`}>
              <div className="alert-icon">{a.severity === 'CRITICAL' ? '⚠️' : a.severity === 'HIGH' ? '🚨' : '◈'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h3 style={{ margin: 0 }}>{a.title}</h3>
                  <span className={`chip ${a.status === 'RESOLVED' ? 'safe' : a.status === 'UNDER_REVIEW' ? 'warning' : 'danger'}`}>
                    {a.status || 'OPEN'}
                  </span>
                </div>
                <p>{a.signals.join(' · ')}</p>
                {onUpdateStatus && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                    <button className="ghost-button" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => onUpdateStatus(a.alertId, 'ACKNOWLEDGED')}>Acknowledge</button>
                    <button className="ghost-button" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => onUpdateStatus(a.alertId, 'UNDER_REVIEW')}>Under Review</button>
                    <button className="primary-button" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => onUpdateStatus(a.alertId, 'RESOLVED')}>Resolve Alert</button>
                  </div>
                )}
              </div>
              <small>{a.openedAt}</small>
            </article>
          ))
        ) : (
          <div className="empty-state">No active security alerts. Evidence stream is clean.</div>
        )}
      </div>

      <div className="panel detection-note">
        <span>◈</span>
        <div>
          <h3>Explainable Detection Strategy</h3>
          <p>Deterministic rules evaluate clerk cross-ward browsing (D-01), high volume access (D-02), off-duty unrecognized devices (D-03), and repeated break-glass overrides (D-04). Legitimate temporary cross-ward assignments do not create false alerts (DET-04).</p>
        </div>
      </div>
    </section>
  );
};
