import React from 'react';

interface DowntimeCacheProps {
  online: boolean;
  queue: any[];
  onOpenSummary: () => void;
}

export const DowntimeCache: React.FC<DowntimeCacheProps> = ({ online, queue, onOpenSummary }) => {
  return (
    <section id="offline" className="view active">
      <div className="view-heading">
        <div>
          <p className="eyebrow">RESTRICTED CONTINUITY</p>
          <h1>Downtime cache</h1>
          <p>Preserves essential emergency continuity during network loss without copying full clinical records offline.</p>
        </div>
        <span className={`chip ${online ? 'safe' : 'warning'}`}>{online ? 'Network online' : 'Downtime mode active'}</span>
      </div>

      <div className="offline-layout">
        <section className="panel offline-card">
          <div className="offline-lock">⌁</div>
          <p className="eyebrow">PAT-1010 · PATIENT JULIET</p>
          <h2>Pre-provisioned Emergency Summary</h2>
          <dl>
            <div><dt>Allergies</dt><dd>Penicillin</dd></div>
            <div><dt>Critical medication</dt><dd>Insulin glargine</dd></div>
            <div><dt>Blood group</dt><dd>O positive</dd></div>
            <div><dt>Latest alert</dt><dd>Hypoglycaemia risk</dd></div>
          </dl>
          <p className="restricted-copy">Full clinical history, notes, export, and role changes are strictly denied while offline.</p>
          <button className="primary-button" onClick={onOpenSummary}>Open Emergency Summary</button>
        </section>

        <section className="panel queue-card">
          <p className="eyebrow">SYNC QUEUE</p>
          <h2>Offline Access Evidence</h2>
          <div id="offlineQueue">
            {queue.length ? (
              queue.map((q, idx) => (
                <div key={idx} className="queue-event">
                  <b>{q.eventId || 'QUEUED_EVENT'} · PAT-1010 (VIEW)</b>
                  <span>Status: QUEUED_LOCALLY · Metadata sync pending</span>
                </div>
              ))
            ) : (
              <div className="empty-state">No offline events waiting to sync.</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
};
