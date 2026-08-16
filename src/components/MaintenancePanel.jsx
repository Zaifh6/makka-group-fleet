import { Chip } from './ui.jsx';
import { int, rs } from '../lib/format.js';

const STATUS_SEVERITY = { OVERDUE: 'critical', DUE_SOON: 'warning', OK: 'good' };
const STATUS_LABEL = { OVERDUE: 'Overdue', DUE_SOON: 'Due soon', OK: 'Scheduled' };

export default function MaintenancePanel({ schedule, history, odometer }) {
  const spend = history.reduce((s, h) => s + h.partsCost + h.labourCost, 0);

  return (
    <div className="stack">
      <div className="row row--between">
        <span className="section-label" style={{ marginBottom: 0 }}>
          Service schedule vs live odometer
        </span>
        <span className="panel__meta">{int(odometer)} km</span>
      </div>

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Item</th>
              <th>Last service</th>
              <th>Interval</th>
              <th>Next due</th>
              <th>Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((item) => (
              <tr key={item.type}>
                <td>{item.type}</td>
                <td className="n derived">
                  {int(item.lastServiceKm)} km
                  <span className="faint"> · {item.lastServiceDate}</span>
                </td>
                <td className="n derived">{int(item.intervalKm)} km</td>
                <td className="n">{int(item.nextDueKm)} km</td>
                <td
                  className="n"
                  style={{ color: item.remainingKm < 0 ? 'var(--critical)' : item.status === 'DUE_SOON' ? 'var(--warning)' : 'var(--ink)' }}
                >
                  {item.remainingKm < 0 ? '−' : ''}{int(Math.abs(item.remainingKm))} km
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Chip severity={STATUS_SEVERITY[item.status]}>{STATUS_LABEL[item.status]}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divider" />

      <div className="row row--between">
        <span className="section-label" style={{ marginBottom: 0 }}>Work history</span>
        <span className="panel__meta">{rs(spend)} recorded</span>
      </div>

      {history.length === 0 ? (
        <p className="empty">No completed work on record.</p>
      ) : (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Work</th>
                <th>Odometer</th>
                <th>Parts</th>
                <th>Labour</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="n">{h.date}</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>
                    <strong style={{ fontWeight: 600 }}>{h.type}</strong>
                    <div className="faint" style={{ fontSize: 11 }}>{h.description} · {h.vendor}</div>
                  </td>
                  <td className="n derived">{int(h.odo)}</td>
                  <td className="n derived">{int(h.partsCost)}</td>
                  <td className="n derived">{int(h.labourCost)}</td>
                  <td className="n">{int(h.partsCost + h.labourCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
