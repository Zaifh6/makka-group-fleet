import { rsCompact, kmCompact, int, num } from '../lib/format.js';
import { STATUS_COLOR } from './ui.jsx';

/**
 * Headline row. Reads left to right as one sentence: how big the fleet is,
 * how much of it is working, what it costs, what it produced, and whether it
 * came out ahead.
 */
export default function FleetOverview({ totals }) {
  const states = [
    { key: 'active', label: 'moving', tone: 'ok' },
    { key: 'idle', label: 'idle', tone: 'warn' },
    { key: 'maintenance', label: 'workshop', tone: 'danger' },
    { key: 'offline', label: 'offline', tone: 'neutral' },
  ];

  const profitable = totals.netContribution >= 0;

  return (
    <div className="kpis">
      <div className="kpi">
        <span className="kpi__label">Fleet status</span>
        <span className="kpi__value">{totals.total}<small>vehicles</small></span>
        <div className="statusdots">
          {states.map((s) => (
            <span key={s.key}>
              <i style={{ background: STATUS_COLOR[s.tone] }} />
              <b>{totals[s.key]}</b> {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="kpi">
        <span className="kpi__label">In use right now</span>
        <span className="kpi__value">{num(totals.utilisationPct, 0)}<small>%</small></span>
        <span className="kpi__foot">
          {totals.active} of {totals.total} vehicles on the move
        </span>
      </div>

      <div className="kpi">
        <span className="kpi__label">Fuel spend · last 30 days</span>
        <span className="kpi__value">{rsCompact(totals.fuelCost)}</span>
        <span className="kpi__foot">
          plus {rsCompact(totals.maintenanceCost)} maintenance &amp; repairs
        </span>
      </div>

      <div className="kpi">
        <span className="kpi__label">Distance · last 30 days</span>
        <span className="kpi__value">{kmCompact(totals.distanceKm)}</span>
        <span className="kpi__foot">{int(totals.deliveries)} deliveries completed</span>
      </div>

      <div className="kpi">
        <span className="kpi__label">Cost per kilometre</span>
        <span className="kpi__value">Rs {num(totals.costPerKm, 1)}</span>
        <span className="kpi__foot">everything included, fleet average</span>
      </div>

      <div className="kpi">
        <span className="kpi__label">Net contribution · last 30 days</span>
        <span
          className="kpi__value"
          style={{ color: profitable ? 'var(--ok)' : 'var(--danger)' }}
        >
          {rsCompact(totals.netContribution)}
        </span>
        <span className="kpi__foot">
          {rsCompact(totals.businessValue)} earned − {rsCompact(totals.totalCost)} spent
        </span>
      </div>
    </div>
  );
}
