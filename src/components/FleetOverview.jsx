import { rsCompact, kmCompact, int, num } from '../lib/format.js';
import { SEVERITY_COLOR } from './ui.jsx';

/**
 * Fleet-wide headline strip. Summary before detail: this answers "is the fleet
 * healthy and is it paying for itself" before anyone drills into a vehicle.
 */
export default function FleetOverview({ totals }) {
  const statusCells = [
    { key: 'active', label: 'Moving', severity: 'good' },
    { key: 'idle', label: 'Idle', severity: 'warning' },
    { key: 'maintenance', label: 'Workshop', severity: 'serious' },
    { key: 'offline', label: 'Offline', severity: 'neutral' },
  ];

  return (
    <div className="kpi-strip">
      <div className="kpi">
        <span className="label">Fleet</span>
        <span className="kpi__val">{totals.total}</span>
        <div className="kpi__breakdown">
          {statusCells.map((c) => (
            <span key={c.key} title={c.label}>
              <i
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: SEVERITY_COLOR[c.severity], display: 'inline-block',
                }}
              />
              {totals[c.key]} {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="kpi">
        <span className="label">Utilisation</span>
        <span className="kpi__val">{num(totals.utilisationPct, 0)}%</span>
        <span className="kpi__sub">of fleet currently moving</span>
      </div>

      <div className="kpi">
        <span className="label">Fuel cost · 30d</span>
        <span className="kpi__val">{rsCompact(totals.fuelCost)}</span>
        <span className="kpi__sub">
          maintenance {rsCompact(totals.maintenanceCost)}
        </span>
      </div>

      <div className="kpi">
        <span className="label">Distance · 30d</span>
        <span className="kpi__val">{kmCompact(totals.distanceKm)}</span>
        <span className="kpi__sub">{int(totals.deliveries)} deliveries</span>
      </div>

      <div className="kpi">
        <span className="label">Cost per km</span>
        <span className="kpi__val">Rs {num(totals.costPerKm, 1)}</span>
        <span className="kpi__sub">all-in, fleet average</span>
      </div>

      <div className="kpi">
        <span className="label">Net contribution · 30d</span>
        <span
          className="kpi__val"
          style={{ color: totals.netContribution >= 0 ? 'var(--good)' : 'var(--critical)' }}
        >
          {rsCompact(totals.netContribution)}
        </span>
        <span className="kpi__sub">
          {rsCompact(totals.businessValue)} value − {rsCompact(totals.totalCost)} cost
        </span>
      </div>
    </div>
  );
}
