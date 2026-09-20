/**
 * Explainable Security Alerts Engine (PRD Section 12)
 * Evaluates rules D-01 through D-04 and creates advisory review signals.
 */

class AlertDetectorService {
  constructor() {
    this.alerts = [];
  }

  evaluate(user, events, deviceId, dutyStatus) {
    // Rule D-01: Clerk cross-ward denials >= 3 in 10 minutes
    if (user.role === 'records clerk') {
      const denials = events.filter(e => e.actor.id === user.id && e.decision === 'DENY');
      if (denials.length >= 3 && !this.alerts.some(a => a.title.includes('Cross-ward browsing'))) {
        this.addAlert(
          'MEDIUM',
          'Cross-ward browsing review signal (Rule D-01)',
          user.id,
          user.name,
          [
            `Records clerk ${user.name} triggered ${denials.length} policy denials`,
            'Requests involved restricted clinical records and cross-ward patients',
            'Explainable signal: review administrative context before drawing conclusions'
          ],
          denials.slice(-3).map(e => e.eventId)
        );
      }
    }

    // Rule D-03: Off-duty + New Device + Burst access
    const userEvents = events.filter(e => e.actor.id === user.id);
    if (deviceId === 'MOB-19' && !dutyStatus && userEvents.length >= 3) {
      if (!this.alerts.some(a => a.title.includes('Compromised account'))) {
        this.addAlert(
          'HIGH',
          'High-risk compromised account activity (Rule D-03)',
          user.id,
          user.name,
          [
            `Unrecognized device MOB-19 logged in as ${user.name}`,
            'Access attempted outside active scheduled duty hours',
            `Burst access pattern: ${userEvents.length} unrelated patient records requested`,
            'Simulated 03:14 AM access time without active care relationship'
          ],
          userEvents.map(e => e.eventId)
        );
      }
    }

    // Rule D-04: Repeated break-glass overrides >= 3
    const breakGlassEvents = events.filter(e => e.actor.id === user.id && e.emergency);
    if (breakGlassEvents.length >= 3 && !this.alerts.some(a => a.title.includes('Repeated break-glass'))) {
      this.addAlert(
        'CRITICAL',
        'Repeated emergency break-glass overrides (Rule D-04)',
        user.id,
        user.name,
        [
          `Clinician ${user.name} invoked emergency break-glass ${breakGlassEvents.length} times in 24h`,
          'High-priority governance review mandatory',
          'Verify emergency clinical justification and post-event records'
        ],
        breakGlassEvents.map(e => e.eventId)
      );
    }
  }

  addAlert(severity, title, actorId, actorName, signals, relatedEvents = []) {
    const alertId = `ALT-${String(this.alerts.length + 1).padStart(5, '0')}`;
    const alert = {
      alertId,
      severity, // 'MEDIUM' | 'HIGH' | 'CRITICAL'
      title,
      actorId,
      actorName,
      signals,
      openedAt: new Date().toLocaleTimeString(),
      status: 'OPEN',
      relatedEvents
    };
    this.alerts.unshift(alert);
    return alert;
  }

  getAlerts() {
    return this.alerts;
  }

  clear() {
    this.alerts = [];
  }
}

module.exports = { AlertDetectorService };
