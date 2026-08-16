import { SEVERITY_COLOR, vehicleStatus, Chip } from './ui.jsx';

/** Selectable fleet list. Status reads from the colour bar *and* the chip. */
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
            className="roster__item"
            role="option"
            aria-selected={selected}
            aria-current={selected}
            onClick={() => onSelect(v.id)}
          >
            <span
              className="roster__bar"
              style={{ background: SEVERITY_COLOR[status.severity] }}
              aria-hidden="true"
            />

            <span style={{ minWidth: 0 }}>
              <span className="roster__id">{v.id}</span>
              <span className="roster__meta">
                <span>{v.registration}</span>
                <span>·</span>
                <span>{v.make} {v.model}</span>
                {v.ownership === 'OUTSOURCED' && <Chip severity="info">Outsourced</Chip>}
                {alerts > 0 && <Chip severity="critical">{alerts} alert{alerts > 1 ? 's' : ''}</Chip>}
              </span>
            </span>

            <span className="roster__right">
              <span className="roster__speed">
                {f ? f.speed : '—'}
                <span className="unit">km/h</span>
              </span>
              <span className="roster__zone">{f ? f.zoneName : status.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
