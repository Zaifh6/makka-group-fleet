import { useState } from 'react';
import EfficiencyTrend from './EfficiencyTrend.jsx';
import { Chip, KV, Meter } from './ui.jsx';
import { anomalyMeta, riskBand } from '../lib/metrics.js';
import { int, num, pct, rs } from '../lib/format.js';
import { FUEL_PRICE_PER_L } from '../data/vehicles.js';

const SEVERITY_COLOR_VAR = {
  good: 'var(--good)', warning: 'var(--warning)',
  serious: 'var(--serious)', critical: 'var(--critical)',
};

export default function FuelPanel({ vehicle, rows, summary, onAddFillUp }) {
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const date = form.get('date');
    const litres = parseFloat(form.get('litres'));
    const cost = parseFloat(form.get('cost'));
    const odo = parseFloat(form.get('odo'));

    const lastOdo = rows.length ? rows[rows.length - 1].odo : vehicle.odometer;

    if (!date || !Number.isFinite(litres) || !Number.isFinite(cost) || !Number.isFinite(odo)) {
      setError('Fill in date, litres, cost and odometer.');
      setOk('');
      return;
    }
    if (odo <= lastOdo) {
      setError(`Odometer must be higher than the last logged reading (${int(lastOdo)} km).`);
      setOk('');
      return;
    }
    if (litres <= 0 || cost <= 0) {
      setError('Litres and cost must be greater than zero.');
      setOk('');
      return;
    }

    const entry = {
      id: `F-${vehicle.id.slice(-3)}${Date.now().toString().slice(-5)}`,
      date, litres, cost, odo,
      station: 'Manual entry',
      loggedBy: 'Dispatch',
    };
    onAddFillUp(vehicle.id, entry);

    const dist = odo - lastOdo;
    setError('');
    setOk(`Logged — ${dist} km on ${litres} L = ${(dist / litres).toFixed(2)} km/L.`);
    e.currentTarget.reset();
  }

  const dev = summary.deviationPct;
  const devColor =
    dev === null ? 'var(--ink)' : dev <= -25 ? 'var(--critical)' : dev <= -12 ? 'var(--serious)' : dev < 0 ? 'var(--warning)' : 'var(--good)';

  return (
    <div className="stack">
      <div className="kv">
        <KV
          label="Current efficiency"
          value={summary.currentKmpl === null ? '—' : num(summary.currentKmpl, 2)}
          unit="km/L"
          size="lg"
        />
        <KV label="Baseline" value={num(summary.baseline, 1)} unit="km/L" />
        <div className="kv__cell">
          <span className="label">Deviation</span>
          <span className="kv__val" style={{ color: devColor }}>{pct(dev)}</span>
        </div>
        <KV label="Fuel cost per km" value={summary.costPerKm === null ? '—' : `Rs ${num(summary.costPerKm, 2)}`} />
        <KV label="Logged distance" value={int(summary.totalDistance)} unit="km" />
        <KV label="Fuel spend" value={rs(summary.totalCost)} />
      </div>

      {summary.currentKmpl !== null && (
        <div>
          <div className="section-label">Current vs baseline</div>
          <Meter
            value={summary.currentKmpl}
            baseline={summary.baseline}
            color={devColor}
          />
        </div>
      )}

      <div>
        <div className="section-label">Efficiency across fill-ups (km/L)</div>
        <EfficiencyTrend rows={rows} baseline={vehicle.baselineKmPerL} />
      </div>

      <div>
        <div className="row row--between" style={{ marginBottom: 8 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Fill-up log</span>
          <span className="panel__meta">
            tank {vehicle.tankCapacityL} L · market rate Rs {FUEL_PRICE_PER_L}/L
          </span>
        </div>

        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Litres</th>
                <th>Cost</th>
                <th>Rs/L</th>
                <th>Odometer</th>
                <th>Distance</th>
                <th>km/L</th>
                <th>Rs/km</th>
                <th>Deviation</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.flags.length ? 'is-flagged' : ''}>
                  <td className="n">{r.date}</td>
                  <td className="n">{num(r.litres, 1)}</td>
                  <td className="n">{int(r.cost)}</td>
                  <td className="n derived">{num(r.unitPrice, 0)}</td>
                  <td className="n">{int(r.odo)}</td>
                  <td className="n derived">{r.dist === null ? '—' : int(r.dist)}</td>
                  <td className="n">{r.kmpl === null ? '—' : num(r.kmpl, 2)}</td>
                  <td className="n derived">{r.cpk === null ? '—' : num(r.cpk, 2)}</td>
                  <td
                    className="n"
                    style={{ color: r.deviationPct !== null && r.deviationPct <= -12 ? 'var(--critical)' : 'var(--ink-2)' }}
                  >
                    {pct(r.deviationPct)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.flags.length === 0 ? (
                      <span className="faint">—</span>
                    ) : (
                      <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                        {r.flags.map((f) => (
                          <Chip key={f} severity={anomalyMeta(f).severity}>
                            {anomalyMeta(f).label}
                          </Chip>
                        ))}
                        <span
                          className="n"
                          style={{ fontSize: 10, color: SEVERITY_COLOR_VAR[riskBand(r.riskScore)] }}
                        >
                          risk {r.riskScore}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="fuel-date">Date</label>
            <input id="fuel-date" name="date" type="date" defaultValue="2026-08-16" required />
          </div>
          <div className="field">
            <label className="label" htmlFor="fuel-litres">Litres</label>
            <input id="fuel-litres" name="litres" type="number" step="0.1" min="0.1" placeholder="0.0" required />
          </div>
          <div className="field">
            <label className="label" htmlFor="fuel-cost">Cost (Rs)</label>
            <input id="fuel-cost" name="cost" type="number" step="1" min="1" placeholder="0" required />
          </div>
          <div className="field">
            <label className="label" htmlFor="fuel-odo">Odometer (km)</label>
            <input id="fuel-odo" name="odo" type="number" step="1" min="0" placeholder="0" required />
          </div>
          <button className="btn btn--solid" type="submit">Log fill-up</button>

          {error && <p className="form__msg form__msg--error">{error}</p>}
          {ok && !error && <p className="form__msg form__msg--ok">{ok}</p>}
        </form>
      </div>
    </div>
  );
}
