import React from 'react';
import { SecurityAlert } from '../types';

interface SecurityCenterProps {
  alerts: SecurityAlert[];
  onClear: () => void;
}

export const SecurityCenter: React.FC<SecurityCenterProps> = ({ alerts, onClear }) => {
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
              <div>
                <h3>{a.title} <small style={{ float: 'right', font: '10px "DM Mono"', fontWeight: 700 }}>[{a.severity}]</small></h3>
                <p>{a.signals.join(' · ')}</p>
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
