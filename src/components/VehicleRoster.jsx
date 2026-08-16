import { Badge, vehicleStatus } from './ui.jsx';

/** Selectable fleet list. Status is a labelled badge, never colour alone. */
export default function VehicleRoster({ vehicles, framesById, selectedId, onSelect, alertCounts }) {
  return (
    <div className="roster" role="listbox" aria-label="Fleet roster">
      {vehicles.map((v) => {
        const f = framesById[v.id];
        const status = vehicleStatus(v, f);
        const alerts = alertCounts[v.id] || 0;
        const selected = v.id === selectedId;

        return (
          <button
            key={v.id}
            className="rosteritem"
            role="option"
            aria-selected={selected}
            aria-current={selected}
            onClick={() => onSelect(v.id)}
          >
            <span className="rosteritem__main">
              <span className="rosteritem__top">
                <span className="rosteritem__id">{v.id}</span>
                <Badge tone={status.tone} dot>{status.label}</Badge>
                {alerts > 0 && (
                  <Badge tone="danger">{alerts} alert{alerts > 1 ? 's' : ''}</Badge>
                )}
              </span>
              <span className="rosteritem__sub">
                {v.make} {v.model} · {v.registration}
                {v.ownership === 'OUTSOURCED' && ' · outsourced'}
              </span>
            </span>

            <span className="rosteritem__right">
              <span className="rosteritem__speed">
                {f ? f.speed : '—'}
                <small> km/h</small>
              </span>
              <div className="rosteritem__zone">{f ? f.zoneName : '—'}</div>
            </span>
          </button>
        );
      })}
    </div>
  );
}
