/**
 * Fleet assistant — a rule-based question answerer.
 *
 * There is no model and no API key behind this. It matches the question
 * against a set of intents, pulls the relevant entity out of the text, and
 * then *computes the answer from live state* — the same telemetry frames,
 * fuel logs and maintenance records the panels are rendering. Ask "where is
 * MK-TRUCK-023" twice a minute apart and you get two different answers,
 * because it reads the current frame rather than a canned string.
 *
 * Swapping in a real LLM later means replacing `ask()` with a call that passes
 * this same context as tool results; the answer shape stays the same.
 */

import {
  deriveFuelRows, fuelSummary, maintenanceStatus, maintenanceHeadline,
  vehicleEconomics, anomalyMeta,
} from '../lib/metrics.js';
import { rs, rsCompact, num, int, pct, durationMin } from '../lib/format.js';
import { ZONES } from '../data/geofences.js';

/* ------------------------------------------------------------------ *
 * Entity extraction
 * ------------------------------------------------------------------ */

/** Pull a vehicle out of the question, falling back to whatever is selected. */
function findVehicle(q, ctx) {
  const text = q.toUpperCase();

  // Full id: MK-TRUCK-023
  const full = text.match(/MK[\s-]*(TRUCK|VAN)[\s-]*(\d{1,3})/);
  if (full) {
    const num3 = full[2].padStart(3, '0');
    const hit = ctx.vehicles.find((v) => v.id.endsWith(num3));
    if (hit) return { vehicle: hit, explicit: true };
  }

  // Registration plate
  const plate = ctx.vehicles.find((v) => text.includes(v.registration.toUpperCase()));
  if (plate) return { vehicle: plate, explicit: true };

  // Bare number: "023", "truck 7", "vehicle 41"
  const bare = text.match(/\b(\d{1,3})\b/);
  if (bare) {
    const num3 = bare[1].padStart(3, '0');
    const hit = ctx.vehicles.find((v) => v.id.endsWith(num3));
    if (hit) return { vehicle: hit, explicit: true };
  }

  // Driver name
  const byDriver = ctx.vehicles.find((v) =>
    v.driver.name.split(' ').some((part) => part.length > 3 && text.includes(part.toUpperCase()))
  );
  if (byDriver) return { vehicle: byDriver, explicit: true };

  const selected = ctx.vehicles.find((v) => v.id === ctx.selectedId) || ctx.vehicles[0];
  return { vehicle: selected, explicit: false };
}

function findRegion(q) {
  const t = q.toLowerCase();
  if (t.includes('peshawar')) return 'Peshawar';
  if (t.includes('mardan')) return 'Mardan';
  return null;
}

/* ------------------------------------------------------------------ *
 * Small helpers for building answers
 * ------------------------------------------------------------------ */

const scope = (v, explicit) => (explicit ? '' : ` (currently selected: ${v.id})`);

function vehicleFuel(v, ctx) {
  const rows = deriveFuelRows(ctx.fuelLogs[v.id] || [], v);
  return { rows, summary: fuelSummary(rows, v) };
}

function liveFrame(v, ctx) {
  return ctx.framesById[v.id];
}

/* ------------------------------------------------------------------ *
 * Intent handlers
 * ------------------------------------------------------------------ */

const INTENTS = [
  {
    id: 'help',
    keywords: ['help', 'what can you', 'what can i ask', 'commands', 'how do you work', 'who are you'],
    weight: 3,
    run: () => ({
      lead: "I read the live telemetry feed and the fuel, maintenance and cost records, then answer from whatever the numbers say right now.",
      facts: [
        { label: 'Live', value: 'position, speed, engine, area, distance today' },
        { label: 'Fuel', value: 'economy vs baseline, cost per km, anomalies' },
        { label: 'Service', value: 'what is due or overdue against the odometer' },
        { label: 'Money', value: 'what each vehicle costs and earns' },
      ],
      note: 'Ask about a vehicle by id, plate, or driver name — or just ask about the fleet.',
      followUps: ['What needs my attention?', 'Where is MK-TRUCK-023?', 'Is owning cheaper than outsourcing?'],
    }),
  },

  {
    id: 'greeting',
    keywords: ['hello', 'hi ', 'hey', 'salam', 'good morning', 'good afternoon'],
    weight: 2,
    run: (q, ctx) => ({
      lead: `Fleet is running. ${ctx.totals.active} of ${ctx.totals.total} vehicles are moving right now.`,
      facts: [
        { label: 'Needs action', value: `${ctx.actionAlerts.length} open`, tone: ctx.actionAlerts.length ? 'danger' : 'ok' },
        { label: 'Cost per km', value: `Rs ${num(ctx.totals.costPerKm, 1)}` },
      ],
      followUps: ['What needs my attention?', 'How is the fleet doing financially?'],
    }),
  },

  {
    id: 'attention',
    keywords: ['attention', 'urgent', 'problem', 'problems', 'issue', 'issues', 'wrong', 'action', 'worry', 'critical', 'brief', 'summary', 'today'],
    weight: 2,
    run: (q, ctx) => {
      const items = ctx.actionAlerts;
      if (!items.length) {
        return {
          lead: 'Nothing needs action right now — no fuel anomalies, no overdue services, no unauthorised area entries.',
          facts: [{ label: 'Fleet', value: `${ctx.totals.active} moving, ${ctx.totals.total} total`, tone: 'ok' }],
          followUps: ['How is the fleet doing financially?', 'Which vehicle performs best?'],
        };
      }
      const byVehicle = [...new Set(items.map((a) => a.vehicleId))];
      return {
        lead: `${items.length} thing${items.length > 1 ? 's need' : ' needs'} action across ${byVehicle.length} vehicle${byVehicle.length > 1 ? 's' : ''}.`,
        facts: items.slice(0, 5).map((a) => ({
          label: a.vehicleId,
          value: `${a.title} — ${a.detail}`,
          tone: a.severity === 'critical' ? 'danger' : 'warn',
        })),
        note: items.length > 5 ? `…and ${items.length - 5} more in the alerts panel.` : undefined,
        followUps: byVehicle.slice(0, 2).map((id) => `Tell me about ${id}`),
      };
    },
  },

  {
    id: 'fuel_anomalies',
    keywords: ['anomaly', 'anomalies', 'fraud', 'suspicious', 'theft', 'stealing', 'cheating', 'fake'],
    weight: 3,
    run: (q, ctx) => {
      const found = [];
      for (const v of ctx.vehicles) {
        const { rows } = vehicleFuel(v, ctx);
        for (const r of rows) {
          if (r.flags.length) found.push({ v, r });
        }
      }
      if (!found.length) {
        return { lead: 'No fuel entries are currently flagged.', facts: [] };
      }
      found.sort((a, b) => b.r.riskScore - a.r.riskScore);
      return {
        lead: `${found.length} fuel entr${found.length > 1 ? 'ies are' : 'y is'} flagged. The checks compare what was logged against GPS-confirmed distance and the physical tank size.`,
        facts: found.slice(0, 4).map(({ v, r }) => ({
          label: `${v.id} · ${r.date}`,
          value: `${r.litres} L for ${r.dist ?? '?'} km — ${r.flags.map((f) => anomalyMeta(f).label).join(', ')} (risk ${r.riskScore}/100)`,
          tone: r.riskScore >= 70 ? 'danger' : 'warn',
        })),
        followUps: found.slice(0, 2).map(({ v }) => `Why is ${v.id} flagged?`),
      };
    },
  },

  {
    id: 'fleet_status',
    keywords: ['how many', 'fleet status', 'active', 'moving', 'idle', 'offline', 'on the road', 'running now', 'utilisation', 'utilization'],
    weight: 2,
    run: (q, ctx) => ({
      lead: `${ctx.totals.active} of ${ctx.totals.total} vehicles are moving — ${num(ctx.totals.utilisationPct, 0)}% utilisation.`,
      facts: [
        { label: 'Moving', value: String(ctx.totals.active), tone: 'ok' },
        { label: 'Idle or stopped', value: String(ctx.totals.idle), tone: 'warn' },
        { label: 'In workshop', value: String(ctx.totals.maintenance), tone: 'danger' },
        { label: 'Offline', value: String(ctx.totals.offline), tone: 'neutral' },
      ],
      followUps: ['How many vehicles are in Mardan?', 'What needs my attention?'],
    }),
  },

  {
    id: 'zone_occupancy',
    keywords: ['area', 'areas', 'zone', 'zones', 'peshawar', 'mardan', 'hayatabad', 'saddar', 'takht bhai', 'katlang', 'university town', 'coverage'],
    weight: 2,
    placeScoped: true,
    run: (q, ctx) => {
      const region = findRegion(q);
      const rows = ZONES.filter((z) => !region || z.region === region).map((z) => ({
        zone: z,
        ids: ctx.occupancy.counts[z.id] || [],
      }));
      const total = rows.reduce((s, r) => s + r.ids.length, 0);
      return {
        lead: region
          ? `${total} vehicle${total === 1 ? '' : 's'} inside ${region} areas right now, plus ${ctx.occupancy.inTransit} in transit fleet-wide.`
          : `${total} vehicles are inside a business area; ${ctx.occupancy.inTransit} are between areas on the road.`,
        facts: rows
          .filter((r) => r.ids.length)
          .map((r) => ({
            label: `${r.zone.name} · ${r.zone.region}`,
            value: r.ids.join(', '),
            tone: r.zone.kind === 'RESTRICTED' ? 'danger' : 'ok',
          })),
        note: rows.every((r) => !r.ids.length) ? 'Every vehicle is between areas at the moment.' : undefined,
        followUps: ['Where is MK-TRUCK-052?', 'What needs my attention?'],
      };
    },
  },

  {
    id: 'ownership',
    keywords: ['outsource', 'outsourced', 'own', 'owned', 'cheaper', 'contractor', 'rent', 'lease', 'buy'],
    weight: 3,
    run: (q, ctx) => {
      const owned = ctx.comparison.find((g) => g.ownership === 'OWNED');
      const out = ctx.comparison.find((g) => g.ownership === 'OUTSOURCED');
      const cheaper = owned.costPerKm <= out.costPerKm ? owned : out;
      const other = cheaper === owned ? out : owned;
      const gap = ((other.costPerKm - cheaper.costPerKm) / other.costPerKm) * 100;
      return {
        lead: `${cheaper.ownership === 'OWNED' ? 'Owned' : 'Outsourced'} vehicles are cheaper per kilometre — Rs ${num(cheaper.costPerKm, 2)} against Rs ${num(other.costPerKm, 2)}, about ${num(gap, 0)}% less.`,
        facts: [
          { label: 'Owned', value: `${owned.count} vehicles · Rs ${num(owned.costPerKm, 2)}/km · ${num(owned.valueRatio, 2)}× earned per rupee` },
          { label: 'Outsourced', value: `${out.count} vehicles · Rs ${num(out.costPerKm, 2)}/km · ${num(out.valueRatio, 2)}× earned per rupee` },
          { label: 'Per delivery', value: `owned Rs ${num(owned.costPerDelivery, 0)} vs outsourced Rs ${num(out.costPerDelivery, 0)}` },
        ],
        note: 'Worth reading with care: the owned fleet carries depreciation and one vehicle stuck in the workshop, which drags its average up. Compare like-for-like vehicle types before acting.',
        followUps: ['Which vehicle is losing money?', 'Which vehicle performs best?'],
      };
    },
  },

  {
    id: 'worst_vehicle',
    keywords: ['losing money', 'worst', 'underperform', 'least productive', 'unprofitable', 'problem vehicle', 'bad'],
    weight: 3,
    run: (q, ctx) => {
      const last = ctx.ranking[ctx.ranking.length - 1];
      const v = last.vehicle;
      const e = last.econ;
      const negative = ctx.ranking.filter((r) => r.econ.netContribution < 0);
      return {
        lead: `${v.id} is the weakest — it ${e.netContribution < 0 ? `costs ${rsCompact(Math.abs(e.netContribution))} more than it earns` : `only contributes ${rsCompact(e.netContribution)}`} over the last 30 days.`,
        facts: [
          { label: 'Total cost', value: rs(e.totalCost) },
          { label: 'Business value', value: rs(e.businessValue) },
          { label: 'Net', value: rs(e.netContribution), tone: e.netContribution < 0 ? 'danger' : 'warn' },
          { label: 'Cost per km', value: `Rs ${num(e.costPerKm, 2)}`, tone: 'danger' },
          { label: 'Why', value: v.serviceState === 'MAINTENANCE' ? 'Sitting in the workshop, so it earned almost nothing while still costing money' : 'High running cost against low output' },
        ],
        note: negative.length > 1 ? `${negative.length} vehicles are net negative.` : undefined,
        focus: v.id,
        followUps: [`What is wrong with ${v.id}?`, 'Which vehicle performs best?'],
      };
    },
  },

  {
    id: 'best_vehicle',
    keywords: ['best', 'top', 'most productive', 'performing', 'strongest', 'most profitable'],
    weight: 3,
    run: (q, ctx) => {
      const first = ctx.ranking[0];
      const v = first.vehicle;
      const e = first.econ;
      return {
        lead: `${v.id} is the strongest performer — ${rsCompact(e.netContribution)} net contribution over 30 days, earning ${num(e.valueRatio, 2)}× what it costs.`,
        facts: [
          { label: 'Business value', value: rs(e.businessValue), tone: 'ok' },
          { label: 'Total cost', value: rs(e.totalCost) },
          { label: 'Deliveries', value: `${int(v.business30d.deliveries)} across ${int(v.business30d.trips)} trips` },
          { label: 'Cost per delivery', value: `Rs ${num(e.costPerDelivery, 0)}`, tone: 'ok' },
        ],
        focus: v.id,
        followUps: [`Tell me about ${v.id}`, 'Which vehicle is losing money?'],
      };
    },
  },

  {
    id: 'fleet_money',
    keywords: ['fuel cost', 'total cost', 'spend', 'spending', 'financially', 'profit', 'making money', 'bottom line', 'budget', 'expenses'],
    weight: 2,
    run: (q, ctx) => {
      const t = ctx.totals;
      return {
        lead: `Over the last 30 days the fleet spent ${rsCompact(t.totalCost)} and generated ${rsCompact(t.businessValue)} — a net contribution of ${rsCompact(t.netContribution)}.`,
        facts: [
          { label: 'Fuel', value: rsCompact(t.fuelCost) },
          { label: 'Maintenance & repairs', value: rsCompact(t.maintenanceCost) },
          { label: 'Distance', value: `${int(t.distanceKm)} km` },
          { label: 'Cost per km', value: `Rs ${num(t.costPerKm, 2)}` },
          { label: 'Net', value: rsCompact(t.netContribution), tone: t.netContribution >= 0 ? 'ok' : 'danger' },
        ],
        followUps: ['Is owning cheaper than outsourcing?', 'Which vehicle is losing money?'],
      };
    },
  },

  /* ---------------- vehicle-scoped ---------------- */

  {
    id: 'vehicle_location',
    keywords: ['where is', 'where are', 'location', 'position', 'right now', 'currently'],
    weight: 3,
    vehicleScoped: true,
    run: (q, ctx) => {
      const { vehicle: v, explicit } = findVehicle(q, ctx);
      const f = liveFrame(v, ctx);
      if (!f) return { lead: `No live fix for ${v.id} yet.`, facts: [] };
      if (v.serviceState !== 'IN_SERVICE') {
        return {
          lead: `${v.id} is not on the road — it is ${v.serviceState === 'MAINTENANCE' ? 'in the workshop' : 'offline'} at ${v.parkedAt?.label || v.homeDepot}.`,
          facts: [{ label: 'Last position', value: `${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}` }],
          focus: v.id,
        };
      }
      const inTransit = !f.zoneId;
      const where = inTransit ? 'on the road between areas' : `in ${f.zoneName}`;
      return {
        lead: `${v.id} is ${f.speed > 1 ? `moving at ${f.speed} km/h` : 'stopped'} ${where}${scope(v, explicit)}.`,
        facts: [
          { label: 'Area', value: inTransit ? 'Between business areas' : `${f.zoneName} · ${f.region}` },
          { label: 'Coordinates', value: `${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}` },
          { label: 'Heading', value: `${f.heading}° ${f.headingLabel}` },
          { label: 'Driven today', value: `${num(f.distanceToday, 1)} km across ${f.stops} stops` },
          { label: 'Driver', value: v.driver.name },
        ],
        focus: v.id,
        followUps: [`How is ${v.id} on fuel?`, `Does ${v.id} need service?`],
      };
    },
  },

  {
    id: 'vehicle_fuel',
    keywords: ['fuel', 'efficiency', 'economy', 'km/l', 'kmpl', 'mileage', 'consumption', 'consuming', 'average'],
    weight: 2,
    vehicleScoped: true,
    run: (q, ctx) => {
      const { vehicle: v, explicit } = findVehicle(q, ctx);
      const { rows, summary } = vehicleFuel(v, ctx);
      if (summary.currentKmpl === null) {
        return { lead: `${v.id} does not have enough fill-ups logged to measure economy yet.`, facts: [], focus: v.id };
      }
      const dev = summary.deviationPct;
      const bad = dev <= -12;
      const flagged = rows.filter((r) => r.flags.length);
      return {
        lead: bad
          ? `${v.id} is using noticeably more fuel than normal — ${num(summary.currentKmpl, 2)} km/L against its usual ${num(summary.baseline, 1)}, ${pct(dev)}${scope(v, explicit)}.`
          : `${v.id} is running normally at ${num(summary.currentKmpl, 2)} km/L, against a baseline of ${num(summary.baseline, 1)} (${pct(dev)})${scope(v, explicit)}.`,
        facts: [
          { label: 'Current', value: `${num(summary.currentKmpl, 2)} km/L`, tone: bad ? 'danger' : 'ok' },
          { label: 'Its normal', value: `${num(summary.baseline, 1)} km/L` },
          { label: 'Fuel cost per km', value: `Rs ${num(summary.costPerKm, 2)}` },
          { label: 'Logged', value: `${int(summary.totalDistance)} km on ${rs(summary.totalCost)} of fuel` },
          ...(flagged.length
            ? [{
                label: 'Flagged entries',
                value: flagged.map((r) => `${r.date}: ${r.flags.map((f) => anomalyMeta(f).label).join(', ')}`).join(' · '),
                tone: 'danger',
              }]
            : []),
        ],
        note: bad && !flagged.length
          ? 'Worth checking tyre pressure, load weight and route mix before assuming anything is wrong mechanically.'
          : undefined,
        focus: v.id,
        followUps: [`Does ${v.id} need service?`, `What is ${v.id} costing us?`],
      };
    },
  },

  {
    id: 'vehicle_maintenance',
    keywords: ['service', 'servicing', 'maintenance', 'oil', 'due', 'overdue', 'repair', 'workshop', 'garage', 'tyre', 'brake'],
    weight: 3,
    vehicleScoped: true,
    run: (q, ctx) => {
      const { vehicle: v, explicit } = findVehicle(q, ctx);
      const f = liveFrame(v, ctx);
      const odo = f ? f.odometer : v.odometer;
      const items = maintenanceStatus(ctx.maintenance[v.id]?.schedule || [], odo);
      const head = maintenanceHeadline(items);
      const bad = items.filter((i) => i.status !== 'OK');
      return {
        lead: bad.length
          ? `${v.id}: ${head.text}${scope(v, explicit)}.`
          : `${v.id} is on schedule for everything. Next up is ${head.text.toLowerCase()}.`,
        facts: (bad.length ? bad : items.slice(0, 3)).map((i) => ({
          label: i.type,
          value: i.remainingKm < 0
            ? `overdue by ${int(Math.abs(i.remainingKm))} km (was due at ${int(i.nextDueKm)} km)`
            : `due in ${int(i.remainingKm)} km at ${int(i.nextDueKm)} km`,
          tone: i.status === 'OVERDUE' ? 'danger' : i.status === 'DUE_SOON' ? 'warn' : 'ok',
        })),
        note: `Measured against the live odometer of ${int(odo)} km.`,
        focus: v.id,
        followUps: [`What is ${v.id} costing us?`, `How is ${v.id} on fuel?`],
      };
    },
  },

  {
    id: 'vehicle_cost',
    keywords: ['costing', 'cost of', 'worth', 'earning', 'earn', 'contribution', 'value', 'profitable', 'pay for itself'],
    weight: 2,
    vehicleScoped: true,
    run: (q, ctx) => {
      const { vehicle: v, explicit } = findVehicle(q, ctx);
      const e = vehicleEconomics(v);
      const good = e.netContribution >= 0;
      return {
        lead: good
          ? `${v.id} earns ${rsCompact(e.netContribution)} more than it costs over 30 days — ${num(e.valueRatio, 2)}× return on spend${scope(v, explicit)}.`
          : `${v.id} costs ${rsCompact(Math.abs(e.netContribution))} more than it earns over 30 days${scope(v, explicit)}.`,
        facts: [
          { label: 'Total cost', value: rs(e.totalCost) },
          { label: 'Business value', value: rs(e.businessValue) },
          { label: 'Net', value: rs(e.netContribution), tone: good ? 'ok' : 'danger' },
          { label: 'Cost per km', value: `Rs ${num(e.costPerKm, 2)}` },
          { label: 'Biggest cost', value: `${e.breakdown[0].label} at ${rs(e.breakdown[0].value)} (${((e.breakdown[0].value / e.totalCost) * 100).toFixed(0)}%)` },
          ...(v.ownership === 'OUTSOURCED'
            ? [{ label: 'Contract', value: `${v.contract.contractor}, expires ${v.contract.end}` }]
            : []),
        ],
        focus: v.id,
        followUps: [`How is ${v.id} on fuel?`, 'Which vehicle performs best?'],
      };
    },
  },

  {
    id: 'vehicle_driver',
    keywords: ['driver', 'driving', 'who is', 'behind the wheel', 'rating', 'behaviour', 'behavior'],
    weight: 3,
    vehicleScoped: true,
    run: (q, ctx) => {
      const { vehicle: v, explicit } = findVehicle(q, ctx);
      const events = ctx.alerts.filter(
        (a) => a.vehicleId === v.id && ['OVERSPEED', 'HARSH_BRAKE', 'HARSH_ACCEL'].includes(a.type)
      );
      return {
        lead: `${v.driver.name} is assigned to ${v.id}, rated ${num(v.driver.rating, 1)} out of 5${scope(v, explicit)}.`,
        facts: [
          { label: 'Phone', value: v.driver.phone },
          { label: 'Licence', value: v.driver.licence },
          { label: 'Driving events logged', value: events.length ? `${events.length} this session` : 'none this session', tone: events.length > 3 ? 'warn' : 'ok' },
          ...(events.slice(0, 2).map((e) => ({ label: e.title, value: e.detail, tone: 'warn' }))),
        ],
        focus: v.id,
        followUps: [`Where is ${v.id}?`, `What is wrong with ${v.id}?`],
      };
    },
  },

  {
    id: 'vehicle_problems',
    keywords: ['what is wrong', 'whats wrong', 'why is', 'flagged', 'any problem', 'trouble'],
    weight: 3,
    vehicleScoped: true,
    run: (q, ctx) => {
      const { vehicle: v } = findVehicle(q, ctx);
      const mine = ctx.alerts.filter(
        (a) => a.vehicleId === v.id && (a.severity === 'critical' || a.severity === 'serious')
      );
      if (!mine.length) {
        return {
          lead: `Nothing is flagged against ${v.id} right now.`,
          facts: [],
          focus: v.id,
          followUps: [`How is ${v.id} on fuel?`, `What is ${v.id} costing us?`],
        };
      }
      return {
        lead: `${mine.length} issue${mine.length > 1 ? 's' : ''} flagged against ${v.id}.`,
        facts: mine.map((a) => ({
          label: a.title,
          value: a.detail,
          tone: a.severity === 'critical' ? 'danger' : 'warn',
        })),
        focus: v.id,
        followUps: [`Does ${v.id} need service?`, `How is ${v.id} on fuel?`],
      };
    },
  },

  {
    id: 'vehicle_overview',
    // Deliberately no bare "how is" here — it is generic enough to swallow
    // "how is 007 on fuel", which belongs to the fuel intent. A vehicle named
    // with no other signal still falls through to this intent in ask().
    keywords: ['tell me about', 'info', 'details', 'status of', 'summary of', 'overview'],
    weight: 2,
    vehicleScoped: true,
    run: (q, ctx) => {
      const { vehicle: v, explicit } = findVehicle(q, ctx);
      const f = liveFrame(v, ctx);
      const { summary } = vehicleFuel(v, ctx);
      const e = vehicleEconomics(v);
      const items = maintenanceStatus(ctx.maintenance[v.id]?.schedule || [], f ? f.odometer : v.odometer);
      const head = maintenanceHeadline(items);
      const issues = ctx.alerts.filter(
        (a) => a.vehicleId === v.id && (a.severity === 'critical' || a.severity === 'serious')
      );
      return {
        lead: `${v.id} is a ${v.year} ${v.make} ${v.model} (${v.type}), ${v.ownership.toLowerCase()}, driven by ${v.driver.name}${scope(v, explicit)}.`,
        facts: [
          {
            label: 'Right now',
            value: f
              ? v.serviceState !== 'IN_SERVICE'
                ? `${v.serviceState === 'MAINTENANCE' ? 'In the workshop' : 'Offline'} at ${v.parkedAt?.label || v.homeDepot}`
                : `${f.speed > 1 ? `Moving at ${f.speed} km/h` : 'Stopped'} ${f.zoneId ? `in ${f.zoneName}` : 'between areas'} · ${num(f.distanceToday, 1)} km today`
              : 'No fix yet',
            tone: v.serviceState !== 'IN_SERVICE' ? 'warn' : 'ok',
          },
          { label: 'Odometer', value: `${int(f ? f.odometer : v.odometer)} km` },
          {
            label: 'Fuel economy',
            value: summary.currentKmpl === null
              ? 'not enough data'
              : `${num(summary.currentKmpl, 2)} km/L vs ${num(summary.baseline, 1)} normal (${pct(summary.deviationPct)})`,
            tone: summary.deviationPct !== null && summary.deviationPct <= -12 ? 'danger' : 'ok',
          },
          { label: 'Service', value: head.text, tone: head.severity === 'critical' ? 'danger' : head.severity === 'warning' ? 'warn' : 'ok' },
          { label: 'Money · 30d', value: `${rs(e.businessValue)} earned, ${rs(e.totalCost)} spent, net ${rs(e.netContribution)}`, tone: e.netContribution >= 0 ? 'ok' : 'danger' },
          { label: 'Open issues', value: issues.length ? issues.map((a) => a.title).join(', ') : 'none', tone: issues.length ? 'danger' : 'ok' },
        ],
        focus: v.id,
        followUps: [`Where is ${v.id}?`, `Does ${v.id} need service?`, `What is ${v.id} costing us?`],
      };
    },
  },
];

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

function scoreIntent(intent, q, mentionsVehicle, mentionsPlace) {
  let score = 0;
  for (const kw of intent.keywords) {
    if (q.includes(kw)) score += intent.weight * (kw.includes(' ') ? 1.6 : 1);
  }
  // A named vehicle nudges the vehicle-scoped readings ahead of fleet ones.
  if (score > 0 && intent.vehicleScoped && mentionsVehicle) score += 2.5;
  // Likewise a named area, so "how many vehicles are in Mardan" is a zone
  // question rather than a fleet-headcount question.
  if (score > 0 && intent.placeScoped && mentionsPlace) score += 3;
  return score;
}

export const SUGGESTIONS = [
  'What needs my attention?',
  'Where is MK-TRUCK-023?',
  'Show me fuel anomalies',
  'Is owning cheaper than outsourcing?',
  'Which vehicle is losing money?',
  'How many vehicles are in Mardan?',
  'Does MK-TRUCK-023 need service?',
  'Which vehicle performs best?',
];

/** Answer a question from live state. Pure — same context in, same answer out. */
export function ask(question, ctx) {
  const q = ` ${question.toLowerCase().trim()} `;
  const mentionsVehicle =
    /mk[\s-]*(truck|van)/i.test(question) ||
    /\b\d{2,3}\b/.test(question) ||
    ctx.vehicles.some((v) => question.toUpperCase().includes(v.registration.toUpperCase()));

  const mentionsPlace =
    /peshawar|mardan/i.test(question) ||
    ZONES.some((z) => q.includes(z.name.toLowerCase()));

  let best = null;
  let bestScore = 0;
  for (const intent of INTENTS) {
    const s = scoreIntent(intent, q, mentionsVehicle, mentionsPlace);
    if (s > bestScore) { bestScore = s; best = intent; }
  }

  if (!best) {
    // Naming a vehicle with no other signal reads as "tell me about it".
    if (mentionsVehicle) {
      return INTENTS.find((i) => i.id === 'vehicle_overview').run(question, ctx);
    }
    return {
      lead: "I couldn't match that to anything I track.",
      facts: [],
      note: 'I can answer on live position, fuel economy and anomalies, servicing, driver assignment, and what each vehicle costs versus earns.',
      followUps: ['What needs my attention?', 'How is the fleet doing financially?', 'Help'],
    };
  }

  return best.run(question, ctx);
}
