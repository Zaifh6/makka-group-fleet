/**
 * Alert engine.
 *
 * Two sources feed the alert stream:
 *
 *  1. LIVE events pushed up by the telemetry feed (harsh braking, overspeed,
 *     geofence transitions, unauthorised areas).
 *  2. STANDING conditions recomputed from records — fuel anomalies against the
 *     fill-up log, maintenance overdue against the live odometer, low tank.
 *
 * Events marked `triggersClip` are the ones that would cause the MDVR to push
 * footage to cloud storage, which is the event-driven video architecture — the
 * camera keeps everything locally and only uploads what matters.
 */

import { deriveFuelRows, maintenanceStatus, anomalyMeta } from '../lib/metrics.js';

export const EVENT_META = {
  HARSH_BRAKE: { label: 'Harsh brake', severity: 'serious', triggersClip: true },
  HARSH_ACCEL: { label: 'Harsh acceleration', severity: 'warning', triggersClip: true },
  OVERSPEED: { label: 'Overspeed', severity: 'warning', triggersClip: true },
  ZONE_ENTERED: { label: 'Zone entered', severity: 'info', triggersClip: false },
  ZONE_EXITED: { label: 'Zone exited', severity: 'info', triggersClip: false },
  UNAUTHORIZED_ZONE: { label: 'Unauthorised area', severity: 'critical', triggersClip: true },
  FUEL_ANOMALY: { label: 'Fuel anomaly', severity: 'critical', triggersClip: false },
  MAINTENANCE_DUE: { label: 'Maintenance', severity: 'warning', triggersClip: false },
  LOW_FUEL: { label: 'Low fuel', severity: 'warning', triggersClip: false },
};

export const SEVERITY_RANK = { critical: 0, serious: 1, warning: 2, info: 3 };

/**
 * Conditions that are true right now regardless of whether an event just
 * fired — recomputed whenever the underlying records or odometer change.
 */
export function standingAlerts({ vehicles, fuelLogs, maintenance, framesById }) {
  const alerts = [];

  for (const vehicle of vehicles) {
    const frame = framesById[vehicle.id];
    const odometer = frame ? frame.odometer : vehicle.odometer;

    // --- fuel anomalies -------------------------------------------------
    const rows = deriveFuelRows(fuelLogs[vehicle.id] || [], vehicle);
    for (const row of rows) {
      if (row.flags.length === 0) continue;
      const worst = row.flags
        .map((f) => ({ code: f, ...anomalyMeta(f) }))
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];

      alerts.push({
        id: `fuel-${row.id}`,
        type: 'FUEL_ANOMALY',
        vehicleId: vehicle.id,
        severity: worst.severity,
        title: worst.label,
        detail:
          `${row.litres} L logged for Rs ${row.cost.toLocaleString()} against ` +
          `${row.dist === null ? 'no prior reading' : row.dist + ' km'} — ` +
          `risk score ${row.riskScore}`,
        date: row.date,
        riskScore: row.riskScore,
        standing: true,
      });
    }

    // --- maintenance ----------------------------------------------------
    const sched = maintenanceStatus(maintenance[vehicle.id]?.schedule || [], odometer);
    for (const item of sched) {
      if (item.status === 'OK') continue;
      alerts.push({
        id: `maint-${vehicle.id}-${item.type}`,
        type: 'MAINTENANCE_DUE',
        vehicleId: vehicle.id,
        severity: item.status === 'OVERDUE' ? 'serious' : 'warning',
        title: item.status === 'OVERDUE' ? `${item.type} overdue` : `${item.type} due soon`,
        detail:
          item.status === 'OVERDUE'
            ? `Overdue by ${Math.abs(Math.round(item.remainingKm)).toLocaleString()} km (due at ${item.nextDueKm.toLocaleString()} km)`
            : `Due in ${Math.round(item.remainingKm).toLocaleString()} km at ${item.nextDueKm.toLocaleString()} km`,
        standing: true,
      });
    }

    // --- low fuel -------------------------------------------------------
    if (frame && !frame.parked && frame.fuel_level <= 15) {
      alerts.push({
        id: `lowfuel-${vehicle.id}`,
        type: 'LOW_FUEL',
        vehicleId: vehicle.id,
        severity: 'warning',
        title: 'Low fuel level',
        detail: `Tank at ${frame.fuel_level}% — approx ${Math.round((frame.fuel_level / 100) * vehicle.tankCapacityL)} L remaining`,
        standing: true,
      });
    }
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Normalise a raw feed event into the shape the alert list renders. */
export function toAlert(event, index) {
  const meta = EVENT_META[event.type] || { label: event.type, severity: 'info', triggersClip: false };
  return {
    id: `ev-${event.timestamp}-${event.vehicleId}-${event.type}-${index}`,
    type: event.type,
    vehicleId: event.vehicleId,
    severity: event.severity || meta.severity,
    title: meta.label,
    detail: event.detail,
    timestamp: event.timestamp,
    position: event.position,
    zoneName: event.zone ? event.zone.name : 'In transit',
    triggersClip: meta.triggersClip,
    standing: false,
  };
}

/**
 * Footage clips, derived from the events that would have triggered an upload.
 * Newest first, capped — this is the cloud-side clip index, not the local SD.
 */
export function clipsFromEvents(events, limit = 12) {
  return events
    .filter((e) => e.triggersClip)
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      vehicleId: e.vehicleId,
      reason: e.title,
      severity: e.severity,
      timestamp: e.timestamp,
      zoneName: e.zoneName,
      durationSec: e.type === 'UNAUTHORIZED_ZONE' ? 60 : 30,
      sizeMb: e.type === 'UNAUTHORIZED_ZONE' ? 44 : 22,
      channels: ['front', 'cabin'],
      uploadState: 'UPLOADED',
    }));
}
