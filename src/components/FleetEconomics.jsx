import { Chip } from './ui.jsx';
import { rsCompact, int, num } from '../lib/format.js';

/**
 * The strategic view: is owning cheaper than outsourcing, and which vehicles
 * actually earn their keep. Ranking bars are diverging around zero because
 * "loses money" and "makes money" are opposite states, not small and large
 * amounts of the same thing.
 */
export default function FleetEconomics({ comparison, ranking, onSelectVehicle, selectedId }) {
  const maxAbs = Math.max(...ranking.map((r) => Math.abs(r.econ.netContribution)), 1);

  return (
    <div className="stack">
      <div className="compare">
        {comparison.map((g) => (
          <div className="compare__card" key={g.ownership}>
            <div className="compare__head">
              <span className="compare__title">
                {g.ownership === 'OWNED' ? 'Owned fleet' : 'Outsourced fleet'}
              </span>
              <Chip severity={g.ownership === 'OWNED' ? 'neutral' : 'info'}>
                {g.count} vehicle{g.count > 1 ? 's' : ''}
              </Chip>
            </div>

            <div className="kv" style={{ border: 'none', background: 'transparent', gap: 8 }}>
              <div className="kv__cell" style={{ background: 'transparent', padding: 0 }}>
                <span className="label">Cost per km</span>
                <span className="kv__val kv__val--lg">Rs {num(g.costPerKm, 2)}</span>
              </div>
              <div className="kv__cell" style={{ background: 'transparent', padding: 0 }}>
                <span className="label">Cost per delivery</span>
                <span className="kv__val kv__val--lg">Rs {num(g.costPerDelivery, 0)}</span>
              </div>
            </div>

            <div className="legend-rows">
              <div className="legend-row" style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="faint">Total cost · 30d</span>
                <span className="legend-row__val">{rsCompact(g.totalCost)}</span>
              </div>
              <div className="legend-row" style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="faint">Business value</span>
                <span className="legend-row__val">{rsCompact(g.businessValue)}</span>
              </div>
              <div className="legend-row" style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="faint">Net contribution</span>
                <span
                  className="legend-row__val"
                  style={{ color: g.netContribution >= 0 ? 'var(--good)' : 'var(--critical)' }}
                >
                  {rsCompact(g.netContribution)}
                </span>
              </div>
              <div className="legend-row" style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="faint">Value per rupee</span>
                <span className="legend-row__val">{num(g.valueRatio, 2)}×</span>
              </div>
              <div className="legend-row" style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="faint">Distance · deliveries</span>
                <span className="legend-row__val">
                  {int(g.distanceKm)} km · {int(g.deliveries)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div className="section-label">Net contribution by vehicle · 30 days</div>
      <div className="rank">
        {ranking.map((r, i) => {
          const positive = r.econ.netContribution >= 0;
          return (
            <div
              className="rank__row"
              key={r.vehicle.id}
              style={{
                cursor: 'pointer',
                background: r.vehicle.id === selectedId ? 'var(--accent-soft)' : 'transparent',
              }}
              onClick={() => onSelectVehicle(r.vehicle.id)}
            >
              <span className="rank__pos">{String(i + 1).padStart(2, '0')}</span>
              <span style={{ minWidth: 0 }}>
                <span className="rank__id">{r.vehicle.id}</span>{' '}
                <span className="faint" style={{ fontSize: 10.5 }}>
                  {r.vehicle.ownership === 'OUTSOURCED' ? 'outsourced' : 'owned'} · {r.vehicle.type}
                </span>
              </span>
              <span className="rank__track">
                <span
                  className="rank__fill"
                  style={{
                    width: `${(Math.abs(r.econ.netContribution) / maxAbs) * 100}%`,
                    background: positive ? 'var(--good)' : 'var(--critical)',
                  }}
                />
              </span>
              <span
                className="rank__val"
                style={{ color: positive ? 'var(--good)' : 'var(--critical)' }}
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
