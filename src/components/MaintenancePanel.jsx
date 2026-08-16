import { Badge } from './ui.jsx';
import { int, rs } from '../lib/format.js';

const STATUS = {
  OVERDUE:  { tone: 'danger', label: 'Overdue' },
  DUE_SOON: { tone: 'warn', label: 'Due soon' },
  OK:       { tone: 'ok', label: 'On schedule' },
};

export default function MaintenancePanel({ schedule, history, odometer }) {
  const spend = history.reduce((s, h) => s + h.partsCost + h.labourCost, 0);
  const overdue = schedule.filter((i) => i.status === 'OVERDUE').length;
  const soon = schedule.filter((i) => i.status === 'DUE_SOON').length;

  return (
    <div className="stack">
      <div className="row">
        {overdue > 0 && <Badge tone="danger" dot>{overdue} item{overdue > 1 ? 's' : ''} overdue</Badge>}
        {soon > 0 && <Badge tone="warn" dot>{soon} due soon</Badge>}
        {overdue === 0 && soon === 0 && <Badge tone="ok" dot>All services on schedule</Badge>}
        <span className="hint">measured against the live odometer of {int(odometer)} km</span>
      </div>

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Service item</th>
              <th>Last done</th>
              <th>Every</th>
              <th>Next due at</th>
              <th>Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((item) => {
              const s = STATUS[item.status];
              return (
                <tr key={item.type}>
                  <td style={{ fontWeight: 550 }}>{item.type}</td>
                  <td className="n dim">
                    {int(item.lastServiceKm)} km
                    <span className="faint"> · {item.lastServiceDate}</span>
                  </td>
                  <td className="n dim">{int(item.intervalKm)} km</td>
                  <td className="n">{int(item.nextDueKm)} km</td>
                  <td
                    className="n"
                    style={{
                      color:
                        item.status === 'OVERDUE' ? 'var(--danger)'
                        : item.status === 'DUE_SOON' ? 'var(--warn)'
                        : 'var(--text)',
                      fontWeight: 600,
                    }}
                  >
                    {item.remainingKm < 0
                      ? `${int(Math.abs(item.remainingKm))} km over`
                      : `${int(item.remainingKm)} km`}
                  </td>
                  <td><Badge tone={s.tone}>{s.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divider" />

      <div className="sectionhead">
        <span className="sectiontitle">Completed work</span>
        <span className="hint">{rs(spend)} recorded</span>
      </div>

      {history.length === 0 ? (
        <p className="empty">No completed work on record for this vehicle.</p>
      ) : (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Work done</th>
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
                  <td style={{ whiteSpace: 'normal' }}>
                    <div style={{ fontWeight: 550 }}>{h.type}</div>
                    <div className="hint">{h.description} · {h.vendor}</div>
                  </td>
                  <td className="n dim">{int(h.odo)}</td>
                  <td className="n dim">{int(h.partsCost)}</td>
                  <td className="n dim">{int(h.labourCost)}</td>
                  <td className="n" style={{ fontWeight: 600 }}>{int(h.partsCost + h.labourCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
