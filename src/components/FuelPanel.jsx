import { useState } from 'react';
import EfficiencyTrend from './EfficiencyTrend.jsx';
import { Badge, Stat, Meter, toneFor } from './ui.jsx';
import { anomalyMeta, riskBand } from '../lib/metrics.js';
import { int, num, pct, rs } from '../lib/format.js';
import { FUEL_PRICE_PER_L } from '../data/vehicles.js';

/** Plain-language read on how the vehicle is doing versus its own history. */
function verdict(dev) {
  if (dev === null) return { tone: 'neutral', text: 'Not enough fill-ups yet' };
  if (dev <= -25) return { tone: 'danger', text: 'Burning far more fuel than normal' };
  if (dev <= -12) return { tone: 'danger', text: 'Using noticeably more fuel than normal' };
  if (dev < -4) return { tone: 'warn', text: 'Slightly below its usual economy' };
  if (dev > 4) return { tone: 'ok', text: 'Running better than its usual economy' };
  return { tone: 'ok', text: 'Running normally' };
}

export default function FuelPanel({ vehicle, rows, summary, onAddFillUp }) {
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const date = data.get('date');
    const litres = parseFloat(data.get('litres'));
    const cost = parseFloat(data.get('cost'));
    const odo = parseFloat(data.get('odo'));
    const lastOdo = rows.length ? rows[rows.length - 1].odo : vehicle.odometer;

    if (!date || ![litres, cost, odo].every(Number.isFinite)) {
      setError('Fill in date, litres, cost and odometer.');
      setOk('');
      return;
    }
    if (odo <= lastOdo) {
      setError(`Odometer must be higher than the last reading of ${int(lastOdo)} km.`);
      setOk('');
      return;
    }
    if (litres <= 0 || cost <= 0) {
      setError('Litres and cost must be greater than zero.');
      setOk('');
      return;
    }

    onAddFillUp(vehicle.id, {
      id: `F-${vehicle.id.slice(-3)}${Date.now().toString().slice(-5)}`,
      date, litres, cost, odo,
      station: 'Manual entry',
      loggedBy: 'Dispatch',
    });

    const dist = odo - lastOdo;
    setError('');
    setOk(`Saved. ${dist} km on ${litres} L works out to ${(dist / litres).toFixed(2)} km/L.`);
    form.reset();
  }

  const v = verdict(summary.deviationPct);

  return (
    <div className="stack">
      {/* headline read */}
      <div className="stats">
        <Stat
          label="Fuel economy now"
          value={summary.currentKmpl === null ? '—' : num(summary.currentKmpl, 2)}
          unit="km/L"
          size="lg"
        />
        <Stat label="Its normal economy" value={num(summary.baseline, 1)} unit="km/L" />
        <Stat
          label="Difference"
          value={pct(summary.deviationPct)}
          tone={v.tone}
          size="lg"
        />
        <Stat
          label="Fuel cost per km"
          value={summary.costPerKm === null ? '—' : `Rs ${num(summary.costPerKm, 2)}`}
        />
        <Stat label="Distance covered" value={int(summary.totalDistance)} unit="km" />
        <Stat label="Total fuel spend" value={rs(summary.totalCost)} />
      </div>

      <div className="row">
        <Badge tone={v.tone} dot>{v.text}</Badge>
        <span className="hint">
          Compared against this vehicle's own historical average, not the fleet's.
        </span>
      </div>

      {summary.currentKmpl !== null && (
        <Meter value={summary.currentKmpl} baseline={summary.baseline} tone={v.tone} />
      )}

      <div className="divider" />

      <div>
        <div className="sectionhead" style={{ marginBottom: 10 }}>
          <span className="sectiontitle">Economy across fill-ups</span>
          <span className="hint">dashed line is this vehicle's normal</span>
        </div>
        <EfficiencyTrend rows={rows} baseline={vehicle.baselineKmPerL} />
      </div>

      <div className="divider" />

      <div>
        <div className="sectionhead" style={{ marginBottom: 10 }}>
          <span className="sectiontitle">Fill-up history</span>
          <span className="hint">
            tank holds {vehicle.tankCapacityL} L · diesel at Rs {FUEL_PRICE_PER_L}/L
          </span>
        </div>

        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Litres</th>
                <th>Cost</th>
                <th>Odometer</th>
                <th>Distance</th>
                <th>km/L</th>
                <th>Rs/km</th>
                <th>vs normal</th>
                <th>Problem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.flags.length ? 'flagged' : ''}>
                  <td className="n">{r.date}</td>
                  <td className="n">{num(r.litres, 1)}</td>
                  <td className="n">{int(r.cost)}</td>
                  <td className="n">{int(r.odo)}</td>
                  <td className="n dim">{r.dist === null ? '—' : int(r.dist)}</td>
                  <td className="n">{r.kmpl === null ? '—' : num(r.kmpl, 2)}</td>
                  <td className="n dim">{r.cpk === null ? '—' : num(r.cpk, 2)}</td>
                  <td
                    className="n"
                    style={{
                      color:
                        r.deviationPct !== null && r.deviationPct <= -12
                          ? 'var(--danger)'
                          : 'var(--text-2)',
                    }}
                  >
                    {pct(r.deviationPct)}
                  </td>
                  <td>
                    {r.flags.length === 0 ? (
                      <span className="faint">—</span>
                    ) : (
                      <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        {r.flags.map((f) => (
                          <Badge key={f} tone={toneFor(anomalyMeta(f).severity)}>
                            {anomalyMeta(f).label}
                          </Badge>
                        ))}
                        <span
                          className="n"
                          style={{ fontSize: 11, color: `var(--${riskBand(r.riskScore) === 'good' ? 'ok' : riskBand(r.riskScore) === 'warning' ? 'warn' : 'danger'})` }}
                        >
                          risk {r.riskScore}/100
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
            <label htmlFor="fuel-date">Date</label>
            <input id="fuel-date" name="date" type="date" defaultValue="2026-08-16" required />
          </div>
          <div className="field">
            <label htmlFor="fuel-litres">Litres</label>
            <input id="fuel-litres" name="litres" type="number" step="0.1" min="0.1" placeholder="0.0" required />
          </div>
          <div className="field">
            <label htmlFor="fuel-cost">Cost (Rs)</label>
            <input id="fuel-cost" name="cost" type="number" step="1" min="1" placeholder="0" required />
          </div>
          <div className="field">
            <label htmlFor="fuel-odo">Odometer (km)</label>
            <input id="fuel-odo" name="odo" type="number" step="1" min="0" placeholder="0" required />
          </div>
          <button className="btn btn--primary" type="submit">Add fill-up</button>

          {error && <p className="form__msg form__msg--error">{error}</p>}
          {ok && !error && <p className="form__msg form__msg--ok">{ok}</p>}
        </form>
      </div>
    </div>
  );
}
