/**
 * The analytics layer. Everything management sees as a "number" is derived
 * here from raw records — nothing pre-computed is stored in the data files.
 */

import { FUEL_PRICE_PER_L } from '../data/vehicles.js';

/* ------------------------------------------------------------------ *
 * Fuel efficiency + anomaly detection
 * ------------------------------------------------------------------ */

const ANOMALY_RULES = {
  CAPACITY_EXCEEDED: {
    weight: 55,
    severity: 'critical',
    label: 'Volume exceeds tank capacity',
  },
  IMPLAUSIBLE_VOLUME: {
    weight: 45,
    severity: 'critical',
    label: 'Large fill against minimal distance',
  },
  EFFICIENCY_COLLAPSE: {
    weight: 40,
    severity: 'serious',
    label: 'Efficiency far below baseline',
  },
  EFFICIENCY_DROP: {
    weight: 25,
    severity: 'warning',
    label: 'Efficiency below baseline',
  },
  PRICE_MISMATCH: {
    weight: 15,
    severity: 'warning',
    label: 'Unit price off market rate',
  },
};

export const anomalyMeta = (code) => ANOMALY_RULES[code];

/**
 * Turn a vehicle's raw fill-up log into analysed rows.
 *
 * Distance for a fill-up is the GPS/OBD odometer delta since the *previous*
 * fill-up, so km/L always describes the tank that was just burned — not the
 * one just purchased.
 */
export function deriveFuelRows(logs, vehicle) {
  const baseline = vehicle.baselineKmPerL;
  const tank = vehicle.tankCapacityL;

  return logs.map((entry, i) => {
    const prev = i > 0 ? logs[i - 1] : null;
    const dist = prev ? entry.odo - prev.odo : null;
    const kmpl = dist && dist > 0 ? dist / entry.litres : null;
    const cpk = dist && dist > 0 ? entry.cost / dist : null;
    const deviationPct = kmpl !== null ? ((kmpl - baseline) / baseline) * 100 : null;
    const unitPrice = entry.litres > 0 ? entry.cost / entry.litres : null;

    const flags = [];
    if (entry.litres > tank * 1.02) flags.push('CAPACITY_EXCEEDED');
    if (dist !== null && dist < 100 && entry.litres > tank * 0.5) flags.push('IMPLAUSIBLE_VOLUME');
    if (deviationPct !== null) {
      if (deviationPct <= -25) flags.push('EFFICIENCY_COLLAPSE');
      else if (deviationPct <= -12) flags.push('EFFICIENCY_DROP');
    }
    if (unitPrice !== null && Math.abs(unitPrice - FUEL_PRICE_PER_L) / FUEL_PRICE_PER_L > 0.08) {
      flags.push('PRICE_MISMATCH');
    }

    const riskScore = Math.min(
      100,
      flags.reduce((sum, f) => sum + ANOMALY_RULES[f].weight, 0)
    );

    return { ...entry, dist, kmpl, cpk, deviationPct, unitPrice, flags, riskScore };
  });
}

export function riskBand(score) {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'serious';
  if (score >= 15) return 'warning';
  return 'good';
}

/** Headline fuel picture for one vehicle. */
export function fuelSummary(rows, vehicle) {
  const measured = rows.filter((r) => r.kmpl !== null);
  if (measured.length === 0) {
    return {
      currentKmpl: null, prevKmpl: null, baseline: vehicle.baselineKmPerL,
      deviationPct: null, costPerKm: null, totalLitres: 0, totalCost: 0,
      totalDistance: 0, flagged: 0, maxRisk: 0,
    };
  }
  const last = measured[measured.length - 1];
  const prev = measured.length > 1 ? measured[measured.length - 2] : null;
  const totalDistance = measured.reduce((s, r) => s + r.dist, 0);
  const totalLitres = measured.reduce((s, r) => s + r.litres, 0);
  const totalCost = measured.reduce((s, r) => s + r.cost, 0);

  return {
    currentKmpl: last.kmpl,
    prevKmpl: prev ? prev.kmpl : null,
    baseline: vehicle.baselineKmPerL,
    deviationPct: last.deviationPct,
    costPerKm: last.cpk,
    lifetimeKmpl: totalLitres > 0 ? totalDistance / totalLitres : null,
    totalLitres,
    totalCost,
    totalDistance,
    flagged: rows.filter((r) => r.flags.length > 0).length,
    maxRisk: rows.reduce((m, r) => Math.max(m, r.riskScore), 0),
  };
}

/* ------------------------------------------------------------------ *
 * Maintenance
 * ------------------------------------------------------------------ */

const DUE_SOON_KM = 800;

/** Compare each scheduled item against the live odometer. */
export function maintenanceStatus(schedule, odometer) {
  return schedule
    .map((item) => {
      const nextDueKm = item.lastServiceKm + item.intervalKm;
      const remainingKm = nextDueKm - odometer;
      let status = 'OK';
      if (remainingKm < 0) status = 'OVERDUE';
      else if (remainingKm <= DUE_SOON_KM) status = 'DUE_SOON';
      return { ...item, nextDueKm, remainingKm, status };
    })
    .sort((a, b) => a.remainingKm - b.remainingKm);
}

export function maintenanceHeadline(items) {
  const overdue = items.filter((i) => i.status === 'OVERDUE');
  const dueSoon = items.filter((i) => i.status === 'DUE_SOON');
  if (overdue.length) {
    const worst = overdue[0];
    return {
      severity: 'critical',
      text: `${worst.type} overdue by ${Math.abs(Math.round(worst.remainingKm)).toLocaleString()} km`,
      count: overdue.length,
    };
  }
  if (dueSoon.length) {
    const next = dueSoon[0];
    return {
      severity: 'warning',
      text: `${next.type} due in ${Math.round(next.remainingKm).toLocaleString()} km`,
      count: dueSoon.length,
    };
  }
  const next = items[0];
  return {
    severity: 'good',
    text: next ? `${next.type} due in ${Math.round(next.remainingKm).toLocaleString()} km` : 'No schedule',
    count: 0,
  };
}

/* ------------------------------------------------------------------ *
 * Cost-benefit analysis
 * ------------------------------------------------------------------ */

export const COST_COMPONENTS = [
  { key: 'fuel', label: 'Fuel' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'repairs', label: 'Repairs' },
  { key: 'driver', label: 'Driver' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'registration', label: 'Registration' },
  { key: 'depreciation', label: 'Depreciation' },
  { key: 'outsourcing', label: 'Outsourcing' },
  { key: 'other', label: 'Other' },
];

/** Rolling-30-day economics for one vehicle. */
export function vehicleEconomics(vehicle) {
  const c = vehicle.costs30d;
  const b = vehicle.business30d;
  const totalCost = COST_COMPONENTS.reduce((s, { key }) => s + (c[key] || 0), 0);
  const businessValue = b.revenue;
  const netContribution = businessValue - totalCost;

  return {
    totalCost,
    businessValue,
    netContribution,
    valueRatio: totalCost > 0 ? businessValue / totalCost : null,
    marginPct: businessValue > 0 ? (netContribution / businessValue) * 100 : null,
    costPerKm: b.distanceKm > 0 ? totalCost / b.distanceKm : null,
    revenuePerKm: b.distanceKm > 0 ? businessValue / b.distanceKm : null,
    costPerDelivery: b.deliveries > 0 ? totalCost / b.deliveries : null,
    revenuePerTrip: b.trips > 0 ? businessValue / b.trips : null,
    breakdown: COST_COMPONENTS
      .map(({ key, label }) => ({ key, label, value: c[key] || 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b2) => b2.value - a.value),
  };
}

/** Fleet-wide rollup for the overview strip. */
export function fleetTotals(vehicles, liveByVehicle) {
  const totals = {
    total: vehicles.length,
    active: 0,
    idle: 0,
    maintenance: 0,
    offline: 0,
    fuelCost: 0,
    maintenanceCost: 0,
    totalCost: 0,
    businessValue: 0,
    distanceKm: 0,
    deliveries: 0,
  };

  for (const v of vehicles) {
    const econ = vehicleEconomics(v);
    totals.fuelCost += v.costs30d.fuel;
    totals.maintenanceCost += v.costs30d.maintenance + v.costs30d.repairs;
    totals.totalCost += econ.totalCost;
    totals.businessValue += econ.businessValue;
    totals.distanceKm += v.business30d.distanceKm;
    totals.deliveries += v.business30d.deliveries;

    const live = liveByVehicle?.[v.id];
    if (v.serviceState === 'MAINTENANCE') totals.maintenance += 1;
    else if (v.serviceState === 'OFFLINE') totals.offline += 1;
    else if (live && live.speed > 1) totals.active += 1;
    else totals.idle += 1;
  }

  totals.netContribution = totals.businessValue - totals.totalCost;
  totals.costPerKm = totals.distanceKm > 0 ? totals.totalCost / totals.distanceKm : null;
  totals.utilisationPct = totals.total > 0 ? (totals.active / totals.total) * 100 : 0;
  return totals;
}

/**
 * Owned vs outsourced comparison — the strategic question of whether Makka
 * Group should be running its own metal at all.
 */
export function ownershipComparison(vehicles) {
  const groups = { OWNED: [], OUTSOURCED: [] };
  for (const v of vehicles) groups[v.ownership].push(v);

  return Object.entries(groups).map(([ownership, list]) => {
    const cost = list.reduce((s, v) => s + vehicleEconomics(v).totalCost, 0);
    const value = list.reduce((s, v) => s + v.business30d.revenue, 0);
    const km = list.reduce((s, v) => s + v.business30d.distanceKm, 0);
    const deliveries = list.reduce((s, v) => s + v.business30d.deliveries, 0);
    return {
      ownership,
      count: list.length,
      totalCost: cost,
      businessValue: value,
      netContribution: value - cost,
      distanceKm: km,
      deliveries,
      costPerKm: km > 0 ? cost / km : null,
      costPerDelivery: deliveries > 0 ? cost / deliveries : null,
      valueRatio: cost > 0 ? value / cost : null,
    };
  });
}

/** Rank vehicles by contribution so under-performers surface on their own. */
export function performanceRanking(vehicles) {
  return vehicles
    .map((v) => ({ vehicle: v, econ: vehicleEconomics(v) }))
    .sort((a, b) => b.econ.netContribution - a.econ.netContribution);
}
