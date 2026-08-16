/** Small shared primitives so panels stay consistent across the dashboard. */

export const SEVERITY_COLOR = {
  good: 'var(--good)',
  info: 'var(--info)',
  warning: 'var(--warning)',
  serious: 'var(--serious)',
  critical: 'var(--critical)',
  neutral: 'var(--ink-3)',
};

export function Panel({ title, meta, children, flush = false, headExtra }) {
  return (
    <section className="panel">
      {(title || meta || headExtra) && (
        <header className="panel__head">
          <h2 className="panel__title">{title}</h2>
          {headExtra || (meta && <span className="panel__meta">{meta}</span>)}
        </header>
      )}
      <div className={flush ? 'panel__body panel__body--flush' : 'panel__body'}>{children}</div>
    </section>
  );
}

export function Chip({ severity = 'neutral', children }) {
  return <span className={`chip chip--${severity}`}>{children}</span>;
}

export function KV({ label, value, unit, size, mono = true }) {
  const cls =
    'kv__val' +
    (size === 'lg' ? ' kv__val--lg' : '') +
    (mono ? '' : ' kv__val--serif');
  return (
    <div className="kv__cell">
      <span className="label">{label}</span>
      <span className={cls}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
    </div>
  );
}

/**
 * Efficiency meter — current value against the vehicle's own historical
 * baseline, which is the comparison that actually means something.
 */
export function Meter({ value, baseline, max, color }) {
  const ceiling = max ?? Math.max(value, baseline) * 1.35;
  const pctOf = (v) => Math.max(0, Math.min(100, (v / ceiling) * 100));
  return (
    <div className="meter">
      <div className="meter__track">
        <div className="meter__fill" style={{ width: `${pctOf(value)}%`, background: color }} />
        <div className="meter__baseline" style={{ left: `${pctOf(baseline)}%` }} title="Baseline" />
      </div>
      <div className="meter__scale">
        <span>0</span>
        <span>baseline {baseline.toFixed(1)}</span>
        <span>{ceiling.toFixed(1)}</span>
      </div>
    </div>
  );
}

/** Status of a vehicle derived from its service flag plus live telemetry. */
export function vehicleStatus(vehicle, frame) {
  if (vehicle.serviceState === 'MAINTENANCE') {
    return { key: 'MAINTENANCE', label: 'In workshop', severity: 'serious' };
  }
  if (vehicle.serviceState === 'OFFLINE') {
    return { key: 'OFFLINE', label: 'Offline', severity: 'neutral' };
  }
  if (!frame) return { key: 'PENDING', label: 'Awaiting fix', severity: 'neutral' };
  if (frame.speed > 1) return { key: 'ACTIVE', label: 'Moving', severity: 'good' };
  if (frame.ignition) return { key: 'IDLING', label: 'Idling', severity: 'warning' };
  return { key: 'STOPPED', label: 'Stopped', severity: 'info' };
}
