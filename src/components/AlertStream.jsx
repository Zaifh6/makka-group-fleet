import { Badge, toneFor } from './ui.jsx';

const TONE_CLASS = { danger: 'alert--danger', warn: 'alert--warn', ok: 'alert--info', info: 'alert--info', neutral: 'alert--info' };

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'action', label: 'Needs action' },
  { key: 'vehicle', label: 'This vehicle' },
];

/**
 * Standing conditions (still true, someone must act) sit above the live event
 * ticker (already history). "Needs action" is the default a manager wants.
 */
export default function AlertStream({ alerts, onSelectVehicle, selectedId, filter, onFilter }) {
  const shown = alerts.filter((a) => {
    if (filter === 'action') return a.severity === 'critical' || a.severity === 'serious';
    if (filter === 'vehicle') return a.vehicleId === selectedId;
    return true;
  });

  return (
    <>
      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            className="tab"
            aria-selected={filter === f.key}
            onClick={() => onFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="alerts">
        {shown.length === 0 && (
          <p className="empty" style={{ margin: 16 }}>
            Nothing to act on here.
          </p>
        )}

        {shown.map((a) => {
          const tone = toneFor(a.severity);
          return (
            <div className={`alert ${TONE_CLASS[tone]}`} key={a.id}>
              <div className="alert__body">
                <div className="alert__top">
                  <Badge tone={tone} dot>{a.title}</Badge>
                  <button
                    className="alert__vehicle"
                    onClick={() => onSelectVehicle(a.vehicleId)}
                  >
                    {a.vehicleId}
                  </button>
                  {a.triggersClip && (
                    <span className="hint" style={{ fontSize: 11 }}>video saved</span>
                  )}
                </div>
                <div className="alert__detail">{a.detail}</div>
                <div className="alert__time">
                  {a.standing
                    ? a.date
                      ? `from fill-up logged ${a.date}`
                      : 'ongoing — needs action'
                    : `${new Date(a.timestamp).toLocaleTimeString('en-GB', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })} · ${a.zoneName}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
