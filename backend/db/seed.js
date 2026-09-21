/**
 * ContextGuard Deterministic Seed Engine
 * Seeds Wards, 24 Staff with hashed passwords (demo credential: "password123"),
 * 30 Synthetic Patients, Encounters, Care Teams, Clinical Records, and EMR Integrations.
 */

const db = require('./index');
const { runMigrations } = require('./migrate');
const { hashPassword } = require('../auth/jwt');

const DEFAULT_HASH = hashPassword('password123');

const WARDS = [
  { id: 'WARD-ED', name: 'Emergency Department', department: 'Emergency Medicine' },
  { id: 'WARD-MED', name: 'Medical Ward', department: 'Internal Medicine' },
  { id: 'WARD-MAT', name: 'Maternity Ward', department: 'Obstetrics & Gynaecology' }
];

const USERS = [
  // 3 Records Clerks
  { id: 'USR-001', name: 'Ada Nwosu', role: 'records clerk', department: 'Health Information', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-002', name: 'Bola Okafor', role: 'records clerk', department: 'Health Information', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-003', name: 'Chioma Egwu', role: 'records clerk', department: 'Health Information', ward_id: 'WARD-MAT', duty: 1, password_hash: DEFAULT_HASH },
  
  // 8 Nurses
  { id: 'USR-004', name: 'Nurse Chinedu Eze', role: 'nurse', department: 'Nursing', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-005', name: 'Nurse Mary Danjuma', role: 'nurse', department: 'Nursing', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-006', name: 'Nurse Blessing Idowu', role: 'nurse', department: 'Nursing', ward_id: 'WARD-MAT', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-007', name: 'Nurse Grace Akpan', role: 'nurse', department: 'Nursing', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-008', name: 'Nurse Halima Suleiman', role: 'nurse', department: 'Nursing', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-009', name: 'Nurse Funke Oshodi', role: 'nurse', department: 'Nursing', ward_id: 'WARD-MAT', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-010', name: 'Nurse Joy Eke', role: 'nurse', department: 'Nursing', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-011', name: 'Nurse Tariye Douye', role: 'nurse', department: 'Nursing', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },

  // 8 Doctors
  { id: 'USR-012', name: 'Dr. David Ade', role: 'doctor', department: 'Emergency Medicine', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-013', name: 'Dr. Esther Bello', role: 'doctor', department: 'Internal Medicine', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-014', name: 'Dr. Femi Lawal', role: 'doctor', department: 'Cardiology', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-015', name: 'Dr. Ngozi Okonjo', role: 'doctor', department: 'Obstetrics & Gynaecology', ward_id: 'WARD-MAT', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-016', name: 'Dr. Babatunde Alabi', role: 'doctor', department: 'Emergency Medicine', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-017', name: 'Dr. Amina Yusuf', role: 'doctor', department: 'Internal Medicine', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-018', name: 'Dr. Emeka Nnamani', role: 'doctor', department: 'Obstetrics & Gynaecology', ward_id: 'WARD-MAT', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-019', name: 'Dr. Tunde Bakare', role: 'doctor', department: 'Emergency Medicine', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH },

  // 2 Lab Staff
  { id: 'USR-020', name: 'Grace Obi', role: 'lab staff', department: 'Laboratory', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-021', name: 'Yakubu Mohammed', role: 'lab staff', department: 'Laboratory', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },

  // 2 Pharmacy Staff
  { id: 'USR-022', name: 'Hauwa Musa', role: 'pharmacy staff', department: 'Pharmacy', ward_id: 'WARD-MED', duty: 1, password_hash: DEFAULT_HASH },
  { id: 'USR-023', name: 'Kehinde Popoola', role: 'pharmacy staff', department: 'Pharmacy', ward_id: 'WARD-MAT', duty: 1, password_hash: DEFAULT_HASH },

  // 1 Admin
  { id: 'USR-024', name: 'Kemi Yusuf', role: 'system admin', department: 'IT Operations', ward_id: null, duty: 1, password_hash: DEFAULT_HASH },

  // 2 Interns (1 expired/off-duty)
  { id: 'USR-025', name: 'Ifeanyi Udo', role: 'intern', department: 'Medicine', ward_id: 'WARD-MED', duty: 0, password_hash: DEFAULT_HASH },
  { id: 'USR-026', name: 'Zainab Sani', role: 'intern', department: 'Emergency Medicine', ward_id: 'WARD-ED', duty: 1, password_hash: DEFAULT_HASH }
];

const PATIENTS = [
  { id: 'PAT-1001', name: 'Patient Alpha (Kufre Udo)', dob: '1985-04-12', current_ward_id: 'WARD-ED', sensitivity_level: 'standard', purpose: 'Assigned treatment relationship' },
  { id: 'PAT-1002', name: 'Patient Bravo (Aisha Bello)', dob: '1992-08-23', current_ward_id: 'WARD-ED', sensitivity_level: 'restricted', purpose: 'Clerk restricted access scenario' },
  { id: 'PAT-1003', name: 'Patient Charlie (Emeka Okafor)', dob: '1976-11-05', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Cross-ward policy test' },
  { id: 'PAT-1004', name: 'Patient Delta (Tunde Bakare)', dob: '1968-03-30', current_ward_id: 'WARD-MED', sensitivity_level: 'restricted', purpose: 'Compromised-account browsing test' },
  { id: 'PAT-1005', name: 'Patient Echo (Fatima Abubakar)', dob: '1999-01-15', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Emergency break-glass scenario' },
  { id: 'PAT-1006', name: 'Patient Foxtrot (Funmi Adebayo)', dob: '1980-07-22', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Nurse ward access scenario' },
  { id: 'PAT-1007', name: 'Patient Golf (Ibrahim Danjuma)', dob: '1995-09-18', current_ward_id: 'WARD-ED', sensitivity_level: 'restricted', purpose: 'Sensitive field policy test' },
  { id: 'PAT-1008', name: 'Patient Hotel (Nkechi Eze)', dob: '2001-05-14', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Expired intern assignment scenario' },
  { id: 'PAT-1009', name: 'Patient India (Oluwaseun Lawal)', dob: '1972-12-09', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'High-volume browsing scenario' },
  { id: 'PAT-1010', name: 'Patient Juliet (Yewande Alabi)', dob: '1988-02-28', current_ward_id: 'WARD-ED', sensitivity_level: 'standard', purpose: 'Offline emergency summary' },
  { id: 'PAT-1011', name: 'Patient Kilo (Bisi Akande)', dob: '1963-06-17', current_ward_id: 'WARD-MED', sensitivity_level: 'restricted', purpose: 'Audit sequence verification' },
  { id: 'PAT-1012', name: 'Patient Lima (Usman Garba)', dob: '1990-10-04', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Legitimate cross-ward temporary assignment' },
  { id: 'PAT-1013', name: 'Patient Mike (Blessing Okeke)', dob: '1994-03-19', current_ward_id: 'WARD-MAT', sensitivity_level: 'standard', purpose: 'Maternity antenatal care' },
  { id: 'PAT-1014', name: 'Patient November (Hauwa Sanusi)', dob: '1998-11-11', current_ward_id: 'WARD-MAT', sensitivity_level: 'restricted', purpose: 'High-risk obstetrics note' },
  { id: 'PAT-1015', name: 'Patient Oscar (Chidi Nnamani)', dob: '1982-05-08', current_ward_id: 'WARD-ED', sensitivity_level: 'standard', purpose: 'Acute trauma evaluation' },
  { id: 'PAT-1016', name: 'Patient Papa (Ralia Umar)', dob: '1979-09-30', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Hypertension management' },
  { id: 'PAT-1017', name: 'Patient Quebec (Khadijah Idris)', dob: '1996-01-24', current_ward_id: 'WARD-MAT', sensitivity_level: 'standard', purpose: 'Postnatal recovery' },
  { id: 'PAT-1018', name: 'Patient Romeo (Sunday Egwu)', dob: '1987-07-14', current_ward_id: 'WARD-ED', sensitivity_level: 'standard', purpose: 'Chest pain observation' },
  { id: 'PAT-1019', name: 'Patient Sierra (Zulaitu Mohammed)', dob: '1991-12-02', current_ward_id: 'WARD-MED', sensitivity_level: 'restricted', purpose: 'Restricted psychiatric consult' },
  { id: 'PAT-1020', name: 'Patient Tango (Victor Bassey)', dob: '1965-04-05', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Diabetic ketoacidosis stabilization' },
  { id: 'PAT-1021', name: 'Patient Uniform (Titilayo Oshodi)', dob: '2000-08-16', current_ward_id: 'WARD-MAT', sensitivity_level: 'standard', purpose: 'Obstetrics routine monitoring' },
  { id: 'PAT-1022', name: 'Patient Victor (Yakubu Gowon)', dob: '1959-10-20', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Geriatric medical care' },
  { id: 'PAT-1023', name: 'Patient Whiskey (Folake Solanke)', dob: '1984-06-25', current_ward_id: 'WARD-ED', sensitivity_level: 'standard', purpose: 'Laceration repair and tetanus' },
  { id: 'PAT-1024', name: 'Patient Xray (Damilola Ojo)', dob: '1993-02-14', current_ward_id: 'WARD-MAT', sensitivity_level: 'restricted', purpose: 'Confidential clinical history' },
  { id: 'PAT-1025', name: 'Patient Yankee (Tarila Clark)', dob: '1977-11-28', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Renal function workup' },
  { id: 'PAT-1026', name: 'Patient Zulu (Zakarie Yaro)', dob: '1970-08-09', current_ward_id: 'WARD-ED', sensitivity_level: 'standard', purpose: 'Acute asthma exacerbation' },
  { id: 'PAT-1027', name: 'Patient Abuja (Audu Ogbeh)', dob: '1986-05-17', current_ward_id: 'WARD-MED', sensitivity_level: 'standard', purpose: 'Malaria fever treatment' },
  { id: 'PAT-1028', name: 'Patient Lagos (Moremi Ajasin)', dob: '1995-10-31', current_ward_id: 'WARD-MAT', sensitivity_level: 'standard', purpose: 'Maternity labor triage' },
  { id: 'PAT-1029', name: 'Patient Kano (Aminu Kano)', dob: '1981-12-12', current_ward_id: 'WARD-ED', sensitivity_level: 'standard', purpose: 'Febrile illness assessment' },
  { id: 'PAT-1030', name: 'Patient Enugu (Nnamdi Azikiwe)', dob: '1975-01-01', current_ward_id: 'WARD-MED', sensitivity_level: 'restricted', purpose: 'Restricted oncology notes' }
];

const CARE_TEAM = [
  { encounter_id: 'ENC-1001', user_id: 'USR-012', relationship: 'attending' },
  { encounter_id: 'ENC-1001', user_id: 'USR-004', relationship: 'primary_nurse' },
  { encounter_id: 'ENC-1010', user_id: 'USR-012', relationship: 'attending' },
  { encounter_id: 'ENC-1010', user_id: 'USR-004', relationship: 'primary_nurse' },
  { encounter_id: 'ENC-1002', user_id: 'USR-004', relationship: 'primary_nurse' },
  { encounter_id: 'ENC-1007', user_id: 'USR-004', relationship: 'primary_nurse' },
  { encounter_id: 'ENC-1003', user_id: 'USR-013', relationship: 'attending' },
  { encounter_id: 'ENC-1006', user_id: 'USR-013', relationship: 'attending' },
  { encounter_id: 'ENC-1008', user_id: 'USR-013', relationship: 'attending' },
  { encounter_id: 'ENC-1011', user_id: 'USR-013', relationship: 'attending' },
  { encounter_id: 'ENC-1004', user_id: 'USR-014', relationship: 'attending' },
  { encounter_id: 'ENC-1005', user_id: 'USR-014', relationship: 'attending' },
  { encounter_id: 'ENC-1009', user_id: 'USR-014', relationship: 'attending' },
  { encounter_id: 'ENC-1013', user_id: 'USR-015', relationship: 'attending' },
  { encounter_id: 'ENC-1014', user_id: 'USR-015', relationship: 'attending' }
];

async function seed() {
  console.log('[SEED] Seeding ContextGuard database with synthetic hospital data & passwords...');
  await runMigrations();

  // Clear existing records
  await db.run('DELETE FROM emr_mappings');
  await db.run('DELETE FROM emr_integrations');
  await db.run('DELETE FROM care_team');
  await db.run('DELETE FROM encounters');
  await db.run('DELETE FROM records');
  await db.run('DELETE FROM patients');
  await db.run('DELETE FROM duty_assignments');
  await db.run('DELETE FROM users');
  await db.run('DELETE FROM wards');
  await db.run('DELETE FROM audit_events');
  await db.run('DELETE FROM security_alerts');

  // Insert Wards
  for (const w of WARDS) {
    await db.run('INSERT INTO wards (id, name, department) VALUES (?, ?, ?)', [w.id, w.name, w.department]);
  }

  // Insert Users with password hashes
  for (const u of USERS) {
    await db.run('INSERT INTO users (id, name, role, department, ward_id, duty, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [u.id, u.name, u.role, u.department, u.ward_id, u.duty, u.password_hash, 'active']);
  }

  // Insert Patients, Encounters, and Records
  for (const p of PATIENTS) {
    await db.run('INSERT INTO patients (id, name, dob, current_ward_id, sensitivity_level, purpose) VALUES (?, ?, ?, ?, ?, ?)',
      [p.id, p.name, p.dob, p.current_ward_id, p.sensitivity_level, p.purpose]);

    const encId = `ENC-${p.id.replace('PAT-', '')}`;
    await db.run('INSERT INTO encounters (id, patient_id, ward_id, type, status, start_at) VALUES (?, ?, ?, ?, ?, ?)',
      [encId, p.id, p.current_ward_id, 'INPATIENT', 'ACTIVE', '2026-09-01T08:00:00Z']);

    const recordId = `REC-${p.id.replace('PAT-', '')}`;
    const recordContent = JSON.stringify({
      allergies: p.id === 'PAT-1010' ? ['Penicillin', 'Sulfa'] : ['No known drug allergies'],
      activeMedications: p.id === 'PAT-1010' ? ['Insulin glargine 10u', 'Metformin 500mg'] : ['Artemether/Lumefantrine', 'Paracetamol 500mg'],
      diagnoses: [p.purpose],
      clinicalNotes: p.sensitivity_level === 'restricted' 
        ? 'RESTRICTED CLINICAL NOTE: Confidential psychiatric/sensitive history. Access strictly audited.' 
        : 'Standard clinical progress note. Patient stable on treatment regimen.',
      labResults: p.id === 'PAT-1010' ? { bloodGroup: 'O positive', bloodGlucose: '4.2 mmol/L' } : { bloodGroup: 'A positive', hb: '12.5 g/dL' }
    });

    await db.run('INSERT INTO records (id, patient_id, encounter_id, record_type, sensitivity, content_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [recordId, p.id, encId, 'CLINICAL_SUMMARY', p.sensitivity_level, recordContent, new Date().toISOString()]);
  }

  // Insert Care Team
  for (const c of CARE_TEAM) {
    await db.run('INSERT INTO care_team (encounter_id, user_id, relationship, active) VALUES (?, ?, ?, 1)',
      [c.encounter_id, c.user_id, c.relationship]);
  }

  // Insert EMR Integrations & Mappings
  await db.run(`INSERT INTO emr_integrations (id, name, type, base_url, status, capabilities_json, last_tested_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      'EMR-MOCK-01',
      'Simulated Hospital HIS / FHIR Gateway (v4.0.1)',
      'Mock EMR',
      'https://mock-emr.internal.hospital.ng/fhir/r4',
      'CONNECTED',
      JSON.stringify(['Patient.read', 'Patient.search', 'Encounter.read', 'Observation.read', 'MedicationRequest.read', 'AllergyIntolerance.read']),
      new Date().toISOString(),
      new Date().toISOString()
    ]);

  await db.run(`INSERT INTO emr_integrations (id, name, type, base_url, status, capabilities_json, last_tested_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      'EMR-FHIR-02',
      'OpenMRS FHIR Interoperability Endpoint',
      'FHIR REST API',
      'https://openmrs.hospital.ng/openmrs/ws/fhir2/R4',
      'READY',
      JSON.stringify(['Patient.read', 'Encounter.read', 'Observation.read', 'AuditEvent.write']),
      new Date().toISOString(),
      new Date().toISOString()
    ]);

  console.log(`[SEED] Seeding complete: 3 Wards, 24 Staff (with password hashes), 30 Patients, 30 Encounters, 2 EMR Integrations.`);
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SEED] Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seed, WARDS, USERS, PATIENTS };
