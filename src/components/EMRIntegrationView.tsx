import React, { useState } from 'react';
import {
  Plug,
  Database,
  Server,
  Workflow,
  CircleCheck,
  CircleX,
  RefreshCw,
  Shield,
  Activity,
  ExternalLink,
  FileText,
} from './icons';

interface EMRIntegrationViewProps {
  onTestConnection: () => Promise<any>;
}

export const EMRIntegrationView: React.FC<EMRIntegrationViewProps> = ({ onTestConnection }) => {
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string>('Not tested this session');

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await onTestConnection();
      setTestResult(res);
      setIsConnected(true);
      setLastTestedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setTestResult({ status: 'ERROR', message: 'Failed to reach EMR adapter' });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleConnect = () => {
    setIsConnected((prev) => !prev);
    if (isConnected) {
      setTestResult(null);
    }
  };

  return (
    <section id="integrations" className="view active">
      <div className="view-heading">
        <div>
          <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plug size={14} aria-hidden="true" />
            EXISTING EMR CONNECTOR ARCHITECTURE
          </p>
          <h1>Connect Existing EMR / HIS</h1>
          <p>ContextGuard acts as a security and accountability control plane positioned over external hospital record systems.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="secondary-button"
            onClick={() => setShowDetails((prev) => !prev)}
            aria-label={showDetails ? 'Hide Adapter Details' : 'View Adapter Details'}
          >
            <FileText size={15} style={{ marginRight: '6px' }} aria-hidden="true" />
            {showDetails ? 'Hide Details' : 'View Details'}
          </button>
          <button
            className="primary-button"
            onClick={handleTest}
            disabled={testing || !isConnected}
            aria-label="Test Connection to Mock EMR Endpoint"
          >
            <RefreshCw size={15} className={testing ? 'animate-spin' : ''} style={{ marginRight: '6px' }} aria-hidden="true" />
            {testing ? 'Testing Endpoint...' : 'Test Connection'}
          </button>
        </div>
      </div>

      <div className="workspace-grid" style={{ marginTop: '24px' }}>
        <section className="panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={14} aria-hidden="true" />
                PRIMARY ADAPTER PROVIDER
              </p>
              <h2 style={{ margin: '4px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Mock Hospital EMR / FHIR Gateway v4.0.1
              </h2>
              <span style={{ fontSize: '11px', color: '#617879', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Database size={13} aria-hidden="true" />
                Type: Mock FHIR Compatible Adapter
                <span style={{ margin: '0 4px' }}>·</span>
                <ExternalLink size={13} aria-hidden="true" />
                Endpoint: https://mock-emr.internal.hospital.ng/fhir/r4
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <span className={`chip ${isConnected ? 'safe' : 'danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                {isConnected ? (
                  <>
                    <CircleCheck size={13} aria-hidden="true" />
                    CONNECTED
                  </>
                ) : (
                  <>
                    <CircleX size={13} aria-hidden="true" />
                    DISCONNECTED
                  </>
                )}
              </span>
              <button
                onClick={handleToggleConnect}
                style={{
                  fontSize: '11px',
                  background: 'transparent',
                  border: '1px solid #c8d8d5',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  color: isConnected ? '#a83232' : '#16745e'
                }}
              >
                {isConnected ? 'Disconnect' : 'Reconnect'}
              </button>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#617879', lineHeight: 1.6 }}>
            The Mock EMR adapter models an external clinical repository. All incoming patient record requests pass through ContextGuard's Policy Decision Point (PDP) first. If authorization fails, the EMR adapter is <strong>never called</strong>.
          </p>

          <div style={{ marginTop: '16px', fontSize: '11px', color: '#617879' }}>
            <strong>Last Tested Status:</strong> {lastTestedAt}
          </div>

          <div style={{ marginTop: '18px', background: '#f8fbfa', padding: '14px', borderRadius: '8px', border: '1px solid #dce8e5' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#16745e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Workflow size={14} aria-hidden="true" />
              Supported Interoperability Capabilities
            </h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="chip safe">Patient</span>
              <span className="chip safe">Encounter</span>
              <span className="chip safe">Clinical Record</span>
              <span className="chip safe">Medication</span>
              <span className="chip safe">Allergy</span>
            </div>
          </div>

          {testResult && (
            <div style={{ marginTop: '18px', background: '#eaf8ef', border: '1px solid #b8efca', padding: '14px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 6px', color: '#16745e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CircleCheck size={16} color="#16745e" aria-hidden="true" />
                Connection Test Verified
              </h4>
              <p style={{ margin: '4px 0', fontSize: '11px', color: '#102a2b' }}><strong>Target EMR:</strong> {testResult.emrName}</p>
              <p style={{ margin: '4px 0', fontSize: '11px', color: '#102a2b' }}><strong>Adapter Latency:</strong> {testResult.latencyMs} ms</p>
              <p style={{ margin: '4px 0', fontSize: '11px', color: '#102a2b' }}><strong>Verified Status:</strong> {testResult.status} at {new Date(testResult.testedAt).toLocaleTimeString()}</p>
            </div>
          )}

          {showDetails && (
            <div style={{ marginTop: '18px', background: '#f0f5f4', padding: '14px', borderRadius: '8px', border: '1px solid #cbe0dc' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '12px', color: '#102a2b' }}>Adapter Schema & Gateway Configuration</h4>
              <pre style={{ fontSize: '11px', background: '#102a2b', color: '#83e4aa', padding: '10px', borderRadius: '6px', overflowX: 'auto' }}>
{JSON.stringify(
  {
    adapterId: 'EMR-ADAPTER-MOCK-01',
    fhirVersion: '4.0.1',
    preQueryPDPCheck: true,
    securityHeader: 'Bearer [CONFIGURED_JWT_TOKEN]',
    capabilities: ['Patient.read', 'Encounter.read', 'Observation.read', 'MedicationRequest.read', 'AllergyIntolerance.read'],
    sanitizationMode: 'STRICT_SENSITIVITY_FILTER'
  },
  null,
  2
)}
              </pre>
            </div>
          )}
        </section>

        <section className="panel" style={{ padding: '24px' }}>
          <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} aria-hidden="true" />
            STANDARDS & SECURITY BOUNDARY
          </p>
          <h2 style={{ margin: '4px 0 12px', fontSize: '18px' }}>EMR Security Control Plane</h2>

          <div style={{ display: 'grid', gap: '12px', fontSize: '11px', color: '#617879' }}>
            <div style={{ padding: '10px', background: '#f7faf8', borderRadius: '6px', border: '1px solid #dce8e5' }}>
              <strong style={{ color: '#102a2b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <Shield size={14} color="#16745e" aria-hidden="true" />
                1. Pre-Query PDP Check
              </strong>
              Authorization PDP evaluates context before querying EMR. Unauthorized requests do not hit the external record database.
            </div>
            <div style={{ padding: '10px', background: '#f7faf8', borderRadius: '6px', border: '1px solid #dce8e5' }}>
              <strong style={{ color: '#102a2b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <Activity size={14} color="#16745e" aria-hidden="true" />
                2. Interoperable Audit Logging
              </strong>
              All EMR retrievals produce FHIR-aligned AuditEvent entries sealed in the SHA-256 hash chain.
            </div>
            <div style={{ padding: '10px', background: '#f7faf8', borderRadius: '6px', border: '1px solid #dce8e5' }}>
              <strong style={{ color: '#102a2b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <FileText size={14} color="#16745e" aria-hidden="true" />
                3. Field-Level Sensitivity Filtering
              </strong>
              Restricted fields (psychiatric notes, high-risk notes) are withheld on the security gateway based on subject role.
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};
