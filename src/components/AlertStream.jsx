import { SEVERITY_COLOR, Chip } from './ui.jsx';

/**
 * Combined alert stream — standing conditions first (they stay true until
 * someone acts), then live events newest-first.
 */
export default function AlertStream({ alerts, onSelectVehicle, selectedId, filter, onFilter }) {
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'vehicle', label: 'This vehicle' },
  ];

  const shown = alerts.filter((a) => {
    if (filter === 'critical') return a.severity === 'critical' || a.severity === 'serious';
    if (filter === 'vehicle') return a.vehicleId === selectedId;
    return true;
  });

  return (
    <>
      <div className="tabs" style={{ borderBottom: '1px solid var(--rule)' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            className="tab"
            aria-selected={filter === f.key}
            onClick={() => onFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="alerts">
        {shown.length === 0 && <p className="empty" style={{ padding: '14px' }}>Nothing flagged.</p>}

        {shown.map((a) => (
          <div className="alert" key={a.id}>
            <span
              className="alert__spine"
              style={{ background: SEVERITY_COLOR[a.severity] }}
              aria-hidden="true"
            />
            <div style={{ minWidth: 0 }}>
              <div className="alert__top">
                <Chip severity={a.severity}>{a.severity}</Chip>
                <span className="alert__title">{a.title}</span>
                <button
                  className="alert__veh"
                  onClick={() => onSelectVehicle(a.vehicleId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  {a.vehicleId}
                </button>
                {a.triggersClip && <span className="alert__clip">clip uploaded</span>}
              </div>
              <div className="alert__detail">{a.detail}</div>
              <div className="alert__time">
                {a.standing
                  ? (a.date ? `logged ${a.date}` : 'standing condition')
                  : `${new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${a.zoneName}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
