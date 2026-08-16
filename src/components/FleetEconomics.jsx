import { Badge } from './ui.jsx';
import { rsCompact, int, num } from '../lib/format.js';

/**
 * The strategic view: is owning cheaper than outsourcing, and which vehicles
 * earn their keep. Ranking bars are green/red around zero because losing money
 * and making money are opposite states, not two sizes of the same thing.
 */
export default function FleetEconomics({ comparison, ranking, onSelectVehicle, selectedId }) {
  const maxAbs = Math.max(...ranking.map((r) => Math.abs(r.econ.netContribution)), 1);
  const cheaper = [...comparison].sort((a, b) => a.costPerKm - b.costPerKm)[0];

  return (
    <div className="stack">
      <div className="row">
        <Badge tone="info" dot>
          {cheaper.ownership === 'OWNED' ? 'Owned' : 'Outsourced'} vehicles are cheaper per km
        </Badge>
        <span className="hint">
          Rs {num(cheaper.costPerKm, 2)}/km versus Rs{' '}
          {num(comparison.find((g) => g !== cheaper)?.costPerKm, 2)}/km
        </span>
      </div>

      <div className="compare">
        {comparison.map((g) => (
          <div className="comparecard" key={g.ownership}>
            <div className="comparecard__head">
              <span className="comparecard__title">
                {g.ownership === 'OWNED' ? 'Owned fleet' : 'Outsourced fleet'}
              </span>
              <Badge tone={g.ownership === 'OWNED' ? 'neutral' : 'info'}>
                {g.count} vehicle{g.count > 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="stat__label">Cost per km</span>
                <span className="stat__value stat__value--lg">Rs {num(g.costPerKm, 2)}</span>
              </div>
              <div className="stat">
                <span className="stat__label">Cost per delivery</span>
                <span className="stat__value stat__value--lg">Rs {num(g.costPerDelivery, 0)}</span>
              </div>
            </div>

            <div className="legendrows">
              {[
                ['Total cost', rsCompact(g.totalCost), null],
                ['Business value', rsCompact(g.businessValue), null],
                ['Net contribution', rsCompact(g.netContribution), g.netContribution >= 0 ? 'var(--ok)' : 'var(--danger)'],
                ['Earned per rupee', `${num(g.valueRatio, 2)}×`, null],
                ['Distance · deliveries', `${int(g.distanceKm)} km · ${int(g.deliveries)}`, null],
              ].map(([label, value, color]) => (
                <div className="legendrow" key={label} style={{ gridTemplateColumns: '1fr auto' }}>
                  <span className="faint">{label}</span>
                  <b style={color ? { color } : undefined}>{value}</b>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div className="sectionhead" style={{ marginBottom: 6 }}>
        <span className="sectiontitle">Which vehicles pay for themselves</span>
        <span className="hint">net contribution over the last 30 days · click to inspect</span>
      </div>

      <div className="rank">
        {ranking.map((r, i) => {
          const positive = r.econ.netContribution >= 0;
          return (
            <div
              className={`rankrow${r.vehicle.id === selectedId ? ' rankrow--selected' : ''}`}
              key={r.vehicle.id}
              onClick={() => onSelectVehicle(r.vehicle.id)}
            >
              <span className="rankrow__pos">{String(i + 1).padStart(2, '0')}</span>
              <span style={{ minWidth: 0 }}>
                <div className="rankrow__id">{r.vehicle.id}</div>
                <div className="rankrow__sub">
                  {r.vehicle.ownership === 'OUTSOURCED' ? 'outsourced' : 'owned'} · {r.vehicle.type}
                </div>
              </span>
              <span className="rankrow__track">
                <span
                  className="rankrow__fill"
                  style={{
                    width: `${(Math.abs(r.econ.netContribution) / maxAbs) * 100}%`,
                    background: positive ? 'var(--ok)' : 'var(--danger)',
                  }}
                />
              </span>
              <span
                className="rankrow__val"
                style={{ color: positive ? 'var(--ok)' : 'var(--danger)' }}
              >
                {rsCompact(r.econ.netContribution)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
