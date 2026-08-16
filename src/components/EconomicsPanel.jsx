import { KV, Chip } from './ui.jsx';
import { rs, rsCompact, int, num } from '../lib/format.js';

/**
 * Cost composition uses a single-hue sequential ramp ordered by share, not a
 * categorical rainbow: the question a manager asks here is "what dominates
 * this vehicle's cost", which is a magnitude question. Every segment is
 * directly labelled below with its value and share, so identity never rests
 * on colour.
 */
const rampStep = (i, n) =>
  `color-mix(in oklab, var(--accent) ${Math.round(100 - (i / Math.max(1, n - 1)) * 62)}%, var(--surface-sunken))`;

export default function EconomicsPanel({ vehicle, econ }) {
  const b = vehicle.business30d;
  const total = econ.totalCost;

  return (
    <div className="stack">
      <div className="kv">
        <KV label="Total cost · 30d" value={rs(econ.totalCost)} size="lg" />
        <KV label="Business value · 30d" value={rs(econ.businessValue)} size="lg" />
        <div className="kv__cell">
          <span className="label">Net contribution</span>
          <span
            className="kv__val kv__val--lg"
            style={{ color: econ.netContribution >= 0 ? 'var(--good)' : 'var(--critical)' }}
          >
            {rs(econ.netContribution)}
          </span>
        </div>
        <KV label="Value per rupee spent" value={num(econ.valueRatio, 2)} unit="×" />
        <KV label="Margin" value={num(econ.marginPct, 1)} unit="%" />
        <KV label="Cost per km" value={`Rs ${num(econ.costPerKm, 2)}`} />
        <KV label="Revenue per km" value={`Rs ${num(econ.revenuePerKm, 2)}`} />
        <KV label="Cost per delivery" value={`Rs ${num(econ.costPerDelivery, 0)}`} />
      </div>

      <div>
        <div className="row row--between" style={{ marginBottom: 8 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Cost composition</span>
          <span className="panel__meta">{rs(total)} total</span>
        </div>

        <div className="costbar" role="img" aria-label="Cost composition by component">
          {econ.breakdown.map((c, i) => (
            <div
              key={c.key}
              className="costbar__seg"
              style={{
                width: `${(c.value / total) * 100}%`,
                background: rampStep(i, econ.breakdown.length),
              }}
              title={`${c.label}: ${rs(c.value)}`}
            />
          ))}
        </div>

        <div className="legend-rows">
          {econ.breakdown.map((c, i) => (
            <div className="legend-row" key={c.key}>
              <span
                className="legend-row__swatch"
                style={{ background: rampStep(i, econ.breakdown.length) }}
                aria-hidden="true"
              />
              <span>{c.label}</span>
              <span className="legend-row__val">{rs(c.value)}</span>
              <span className="legend-row__pct">{((c.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="divider" />

      <div>
        <div className="section-label">Business output · 30 days</div>
        <div className="kv">
          <KV label="Trips" value={int(b.trips)} />
          <KV label="Deliveries" value={int(b.deliveries)} />
          <KV label="Distance" value={int(b.distanceKm)} unit="km" />
          <KV label="Customers served" value={int(b.customers)} />
          <KV label="Revenue attributed" value={rsCompact(b.revenue)} />
          <KV label="Revenue per trip" value={`Rs ${num(econ.revenuePerTrip, 0)}`} />
        </div>
      </div>

      {vehicle.ownership === 'OUTSOURCED' && vehicle.contract && (
        <>
          <div className="divider" />
          <div>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="section-label" style={{ marginBottom: 0 }}>Contract terms</span>
              <Chip severity="info">Outsourced</Chip>
            </div>
            <div className="kv">
              <KV label="Contractor" value={vehicle.contract.contractor} mono={false} />
              <KV label="Term" value={`${vehicle.contract.start} → ${vehicle.contract.end}`} />
              <KV
                label="Monthly rate"
                value={vehicle.contract.monthlyRate ? rs(vehicle.contract.monthlyRate) : '—'}
              />
              <KV
                label="Per km rate"
                value={vehicle.contract.perKmRate ? `Rs ${vehicle.contract.perKmRate}` : '—'}
              />
              <KV
                label="Per trip rate"
                value={vehicle.contract.perTripRate ? `Rs ${vehicle.contract.perTripRate}` : '—'}
              />
              <KV label="Fuel borne by" value={vehicle.contract.fuelResponsibility} />
              <KV label="Maintenance borne by" value={vehicle.contract.maintenanceResponsibility} />
              <KV label="Driver borne by" value={vehicle.contract.driverResponsibility} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
