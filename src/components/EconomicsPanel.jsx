import { Stat, Badge } from './ui.jsx';
import { rs, rsCompact, int, num } from '../lib/format.js';

/**
 * Cost composition is a single-hue ramp ordered by share, because the question
 * is "what dominates this vehicle's cost", which is a magnitude question. Every
 * segment is labelled with its value and share below, so nothing rests on hue.
 */
const rampStep = (i, n) =>
  `color-mix(in oklab, var(--primary) ${Math.round(92 - (i / Math.max(1, n - 1)) * 66)}%, var(--surface-3))`;

export default function EconomicsPanel({ vehicle, econ }) {
  const b = vehicle.business30d;
  const total = econ.totalCost;
  const profitable = econ.netContribution >= 0;

  return (
    <div className="stack">
      <div className="row">
        <Badge tone={profitable ? 'ok' : 'danger'} dot>
          {profitable
            ? `Earning ${rsCompact(econ.netContribution)} more than it costs`
            : `Costing ${rsCompact(Math.abs(econ.netContribution))} more than it earns`}
        </Badge>
        <span className="hint">rolling 30 days</span>
      </div>

      <div className="stats">
        <Stat label="Total cost" value={rs(econ.totalCost)} size="lg" />
        <Stat label="Business value earned" value={rs(econ.businessValue)} size="lg" />
        <Stat
          label="Net contribution"
          value={rs(econ.netContribution)}
          size="lg"
          tone={profitable ? 'ok' : 'danger'}
        />
        <Stat label="Earned per rupee spent" value={num(econ.valueRatio, 2)} unit="×" />
        <Stat label="Margin" value={num(econ.marginPct, 1)} unit="%" />
        <Stat label="Cost per km" value={`Rs ${num(econ.costPerKm, 2)}`} />
        <Stat label="Revenue per km" value={`Rs ${num(econ.revenuePerKm, 2)}`} />
        <Stat label="Cost per delivery" value={`Rs ${num(econ.costPerDelivery, 0)}`} />
      </div>

      <div className="divider" />

      <div>
        <div className="sectionhead" style={{ marginBottom: 10 }}>
          <span className="sectiontitle">Where the money goes</span>
          <span className="hint">{rs(total)} total</span>
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

        <div className="legendrows">
          {econ.breakdown.map((c, i) => (
            <div className="legendrow" key={c.key}>
              <i style={{ background: rampStep(i, econ.breakdown.length) }} aria-hidden="true" />
              <span>{c.label}</span>
              <b>{rs(c.value)}</b>
              <span>{((c.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="divider" />

      <div>
        <div className="sectiontitle" style={{ marginBottom: 10 }}>What it produced</div>
        <div className="stats">
          <Stat label="Trips" value={int(b.trips)} />
          <Stat label="Deliveries" value={int(b.deliveries)} />
          <Stat label="Distance" value={int(b.distanceKm)} unit="km" />
          <Stat label="Customers served" value={int(b.customers)} />
          <Stat label="Revenue attributed" value={rsCompact(b.revenue)} />
          <Stat label="Revenue per trip" value={`Rs ${num(econ.revenuePerTrip, 0)}`} />
        </div>
      </div>

      {vehicle.ownership === 'OUTSOURCED' && vehicle.contract && (
        <>
          <div className="divider" />
          <div>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="sectiontitle">Contract terms</span>
              <Badge tone="info">Outsourced</Badge>
            </div>
            <div className="stats">
              <Stat label="Contractor" value={vehicle.contract.contractor} text />
              <Stat label="Term" value={`${vehicle.contract.start} → ${vehicle.contract.end}`} />
              <Stat
                label="Monthly rate"
                value={vehicle.contract.monthlyRate ? rs(vehicle.contract.monthlyRate) : '—'}
              />
              <Stat
                label="Per km rate"
                value={vehicle.contract.perKmRate ? `Rs ${vehicle.contract.perKmRate}` : '—'}
              />
              <Stat
                label="Per trip rate"
                value={vehicle.contract.perTripRate ? `Rs ${vehicle.contract.perTripRate}` : '—'}
              />
              <Stat label="Fuel paid by" value={vehicle.contract.fuelResponsibility} text />
              <Stat label="Maintenance by" value={vehicle.contract.maintenanceResponsibility} text />
              <Stat label="Driver provided by" value={vehicle.contract.driverResponsibility} text />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
