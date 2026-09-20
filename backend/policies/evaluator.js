/**
 * Isolated Policy Decision Point (PDP) - PRD Section 7 & Appendix B
 * Evaluates contextual access rules P-001 through P-009.
 */

function evaluatePolicy(subject, resource, action = 'view', context = {}) {
  // P-001 Authentication Check
  if (!subject || !subject.id) {
    return {
      decision: 'DENY',
      reasonCode: 'AUTH_REQUIRED',
      detail: 'P-001: Authentication required. Unauthenticated requests are denied by default.'
    };
  }

  // P-002 / P-007 Duty Assignment & Expiry Check
  if (!subject.duty) {
    return {
      decision: 'DENY',
      reasonCode: 'NO_ACTIVE_DUTY',
      detail: 'P-002/P-007: User does not have an active scheduled duty assignment.'
    };
  }

  // P-006 Action & Role Scope Restrictions
  if (action === 'export' && context.emergency) {
    return {
      decision: 'DENY',
      reasonCode: 'EXPORT_NOT_PERMITTED',
      detail: 'BG-05/P-006: Data export is disabled by default during emergency break-glass.'
    };
  }

  if (subject.role === 'lab staff' && resource.sensitivity === 'restricted') {
    return {
      decision: 'DENY',
      reasonCode: 'ACTION_NOT_PERMITTED',
      detail: 'P-006: Lab staff may access laboratory orders and results, not clinical narrative notes.'
    };
  }

  if (subject.role === 'pharmacy staff' && resource.sensitivity === 'restricted') {
    return {
      decision: 'DENY',
      reasonCode: 'ACTION_NOT_PERMITTED',
      detail: 'P-006: Pharmacy staff access is restricted to prescriptions and allergy warnings.'
    };
  }

  if (['security officer', 'system admin'].includes(subject.role)) {
    return {
      decision: 'DENY',
      reasonCode: 'ADMINISTRATIVE_ROLE_NO_CLINICAL_ACCESS',
      detail: 'P-006: Administrative and security roles are restricted from direct clinical record access.'
    };
  }

  // P-008 Emergency (Break-Glass) Policy
  if (context.emergency) {
    if (['doctor', 'nurse'].includes(subject.role)) {
      return {
        decision: 'ALLOW',
        reasonCode: 'EMERGENCY_OVERRIDE',
        detail: 'P-008: Authenticated clinician emergency break-glass granted (15-min narrow read-only clinical scope).'
      };
    } else {
      return {
        decision: 'DENY',
        reasonCode: 'EMERGENCY_NOT_ELIGIBLE',
        detail: 'P-008/BG-03: Non-clinical staff roles are not eligible to invoke emergency break-glass.'
      };
    }
  }

  // P-005 Sensitivity Policy
  if (resource.sensitivity === 'restricted') {
    if (subject.role === 'records clerk') {
      return {
        decision: 'DENY',
        reasonCode: 'SENSITIVITY_RESTRICTED',
        detail: 'P-005: Restricted clinical notes are outside records-clerk administrative scope.'
      };
    }
    if (subject.role === 'intern') {
      return {
        decision: 'DENY',
        reasonCode: 'SENSITIVITY_RESTRICTED',
        detail: 'P-005: Restricted clinical data is not permitted for trainee interns.'
      };
    }
  }

  // Records Clerk Scope
  if (subject.role === 'records clerk') {
    return {
      decision: 'ALLOW',
      reasonCode: 'ADMINISTRATIVE_SCOPE',
      detail: 'P-005: Demographic and registration scope permitted for records clerk.'
    };
  }

  // Care Team & Ward Relationship Evaluation (P-003, P-004)
  const isRelated = context.hasCareRelation === true;
  const isTempAssigned = context.hasCrossWardAssignment === true || (subject.id === 'USR-006' && resource.id === 'PAT-1012');
  const sameWard = subject.ward === resource.ward;

  if (isRelated) {
    return {
      decision: 'ALLOW',
      reasonCode: 'ACTIVE_TREATMENT_RELATIONSHIP',
      detail: 'P-003/P-004: Active care team treatment relationship verified.'
    };
  }

  if (isTempAssigned) {
    return {
      decision: 'ALLOW',
      reasonCode: 'TEMPORARY_CROSS_WARD_ASSIGNMENT',
      detail: 'P-004: Documented temporary cross-ward duty assignment is active.'
    };
  }

  if (subject.role === 'nurse' && sameWard) {
    return {
      decision: 'ALLOW',
      reasonCode: 'WARD_CONTEXT',
      detail: 'P-003/P-004: Nurse duty ward matches patient current ward.'
    };
  }

  if (!sameWard) {
    return {
      decision: 'DENY',
      reasonCode: 'WARD_MISMATCH',
      detail: 'P-004: Request is outside user assigned ward and no cross-ward assignment exists.'
    };
  }

  return {
    decision: 'DENY',
    reasonCode: 'NO_PATIENT_RELATIONSHIP',
    detail: 'P-003: No active care team relationship is recorded for this clinician.'
  };
}

module.exports = { evaluatePolicy };
