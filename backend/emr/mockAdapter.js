/**
 * ContextGuard EMR Adapter - Mock Hospital EMR Provider
 * Implements FHIR-aligned provider-neutral EMR integration layer.
 * Simulates external hospital EMR data source behind ContextGuard PDP control plane.
 */

class MockEMRAdapter {
  constructor() {
    this.name = 'Simulated Hospital HIS / FHIR Gateway (v4.0.1)';
    this.type = 'Mock EMR';
    this.baseUrl = 'https://mock-emr.internal.hospital.ng/fhir/r4';
    this.status = 'CONNECTED';
    this.requestCount = 0;
    this.lastTestedAt = new Date().toISOString();
  }

  async testConnection() {
    this.lastTestedAt = new Date().toISOString();
    return {
      success: true,
      emrName: this.name,
      type: this.type,
      baseUrl: this.baseUrl,
      status: 'CONNECTED',
      latencyMs: 38,
      capabilities: [
        'Patient.read',
        'Patient.search',
        'Encounter.read',
        'Observation.read',
        'MedicationRequest.read',
        'AllergyIntolerance.read',
        'AuditEvent.write'
      ],
      testedAt: this.lastTestedAt
    };
  }

  getAvailableCapabilities() {
    return [
      'Patient.read',
      'Patient.search',
      'Encounter.read',
      'Observation.read',
      'MedicationRequest.read',
      'AllergyIntolerance.read',
      'AuditEvent.write'
    ];
  }

  async getPatient(patientId) {
    this.requestCount++;
    return {
      resourceType: 'Patient',
      id: patientId,
      active: true,
      name: [{ use: 'official', text: `Patient ${patientId}` }],
      telecom: [{ system: 'phone', value: '+234-803-000-0000' }],
      gender: 'other',
      birthDate: '1988-05-15',
      address: [{ city: 'Lagos', country: 'Nigeria' }]
    };
  }

  async getPatientRecords(patientId) {
    this.requestCount++;
    return {
      resourceType: 'Bundle',
      type: 'collection',
      patientId: patientId,
      sourceSystem: this.name,
      entry: [
        {
          resourceType: 'AllergyIntolerance',
          clinicalStatus: 'active',
          code: { text: patientId === 'PAT-1010' ? 'Penicillin, Sulfa' : 'No known drug allergies' }
        },
        {
          resourceType: 'MedicationRequest',
          status: 'active',
          medicationCodeableConcept: { text: patientId === 'PAT-1010' ? 'Insulin glargine 10u' : 'Artemether/Lumefantrine 80/480mg' }
        },
        {
          resourceType: 'Observation',
          status: 'final',
          code: { text: 'Clinical Summary Observation' },
          valueString: 'External EMR Record retrieved through ContextGuard PDP Security Gateway.'
        }
      ]
    };
  }

  async searchPatients(query) {
    this.requestCount++;
    return [
      { id: 'PAT-1001', name: 'Patient Alpha (Kufre Udo)' },
      { id: 'PAT-1002', name: 'Patient Bravo (Aisha Bello)' },
      { id: 'PAT-1010', name: 'Patient Juliet (Yewande Alabi)' }
    ];
  }
}

const mockEMR = new MockEMRAdapter();
module.exports = { MockEMRAdapter, mockEMR };
