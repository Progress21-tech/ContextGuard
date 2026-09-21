import React, { useState, useEffect } from 'react';

interface EMRIntegrationViewProps {
  onTestConnection: () => Promise<any>;
}

export const EMRIntegrationView: React.FC<EMRIntegrationViewProps> = ({ onTestConnection }) => {
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    const res = await onTestConnection();
    setTestResult(res);
    setTesting(false);
  };

  return (
    <section id="integrations" className="view active">
      <div className="view-heading">
        <div>
          <p className="eyebrow">EXISTING EMR CONNECTOR ARCHITECTURE</p>
          <h1>Connect Existing EMR / HIS</h1>
          <p>ContextGuard acts as a security and accountability control plane positioned over external hospital record systems.</p>
        </div>
        <button className="primary-button" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing Endpoint...' : 'Test Connection'}
        </button>
      </div>

      <div className="workspace-grid" style={{ marginTop: '24px' }}>
        <section className="panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p className="eyebrow">PRIMARY ADAPTER PROVIDER</p>
              <h2 style={{ margin: '4px 0', fontSize: '18px' }}>Simulated Hospital HIS / FHIR Gateway (v4.0.1)</h2>
              <span style={{ fontSize: '11px', color: '#617879' }}>Type: Mock EMR · Base URL: https://mock-emr.internal.hospital.ng/fhir/r4</span>
            </div>
            <span className="chip safe">CONNECTED</span>
          </div>

          <p style={{ fontSize: '12px', color: '#617879', lineHeight: 1.6 }}>
            The Mock EMR adapter models an external clinical repository. All incoming patient record requests pass through ContextGuard's Policy Decision Point (PDP) first. If authorization fails, the EMR adapter is <strong>never called</strong>.
          </p>

          <div style={{ marginTop: '18px', background: '#f8fbfa', padding: '14px', borderRadius: '8px', border: '1px solid #dce8e5' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#16745e' }}>FHIR Interoperability Capabilities</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="chip safe">Patient.read</span>
              <span className="chip safe">Patient.search</span>
              <span className="chip safe">Encounter.read</span>
              <span className="chip safe">Observation.read</span>
              <span className="chip safe">MedicationRequest.read</span>
              <span className="chip safe">AllergyIntolerance.read</span>
              <span className="chip safe">AuditEvent.write</span>
            </div>
          </div>

          {testResult && (
            <div style={{ marginTop: '18px', background: '#eaf8ef', border: '1px solid #b8efca', padding: '14px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 6px', color: '#16745e', fontSize: '13px' }}>✓ Connection Test Successful</h4>
              <p style={{ margin: '4px 0', fontSize: '11px', color: '#102a2b' }}><strong>Target:</strong> {testResult.emrName}</p>
              <p style={{ margin: '4px 0', fontSize: '11px', color: '#102a2b' }}><strong>Latency:</strong> {testResult.latencyMs} ms</p>
              <p style={{ margin: '4px 0', fontSize: '11px', color: '#102a2b' }}><strong>Status:</strong> {testResult.status} (Verified at {new Date(testResult.testedAt).toLocaleTimeString()})</p>
            </div>
          )}
        </section>

        <section className="panel" style={{ padding: '24px' }}>
          <p className="eyebrow">STANDARDS & SECURITY BOUNDARY</p>
          <h2 style={{ margin: '4px 0 12px', fontSize: '18px' }}>EMR Security Control Plane</h2>

          <div style={{ display: 'grid', gap: '12px', fontSize: '11px', color: '#617879' }}>
            <div style={{ padding: '10px', background: '#f7faf8', borderRadius: '6px', border: '1px solid #dce8e5' }}>
              <strong style={{ color: '#102a2b', display: 'block', marginBottom: '2px' }}>1. Pre-Query PDP Check</strong>
              Authorization PDP evaluates context before querying EMR. Unauthorized requests do not hit the external record database.
            </div>
            <div style={{ padding: '10px', background: '#f7faf8', borderRadius: '6px', border: '1px solid #dce8e5' }}>
              <strong style={{ color: '#102a2b', display: 'block', marginBottom: '2px' }}>2. Interoperable Audit Logging</strong>
              All EMR retrievals produce FHIR-aligned AuditEvent entries sealed in the SHA-256 hash chain.
            </div>
            <div style={{ padding: '10px', background: '#f7faf8', borderRadius: '6px', border: '1px solid #dce8e5' }}>
              <strong style={{ color: '#102a2b', display: 'block', marginBottom: '2px' }}>3. Field-Level Sensitivity Filtering</strong>
              Restricted fields (psychiatric notes, high-risk notes) are withheld on the security gateway based on subject role.
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};
