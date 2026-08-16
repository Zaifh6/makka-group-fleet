/** Shared primitives. One vocabulary of tones across every panel. */

/**
 * Four tones do all the work: ok / warn / danger for state, info for the
 * interactive primary, neutral for "nothing to say". Alert severities collapse
 * into these so a badge, a map marker and a table row always agree.
 */
export const STATUS_COLOR = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  info: 'var(--primary)',
  neutral: 'var(--text-3)',
};

const SEVERITY_TO_TONE = {
  good: 'ok',
  info: 'info',
  warning: 'warn',
  serious: 'danger',
  critical: 'danger',
  neutral: 'neutral',
};

export const toneFor = (severity) => SEVERITY_TO_TONE[severity] || 'neutral';

export function Panel({ title, subtitle, meta, children, flush = false, action }) {
  return (
    <section className="panel">
      {(title || meta || action) && (
        <header className="panel__head">
          <div>
            <h2 className="panel__title">{title}</h2>
            {subtitle && <div className="panel__sub">{subtitle}</div>}
          </div>
          {action || (meta && <span className="panel__meta">{meta}</span>)}
        </header>
      )}
      <div className={flush ? 'panel__body panel__body--flush' : 'panel__body'}>{children}</div>
    </section>
  );
}

export function Badge({ tone = 'neutral', dot = false, children }) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <i />}
      {children}
    </span>
  );
}

/** A labelled figure. `text` switches off the mono face for names and words. */
export function Stat({ label, value, unit, size, text = false, tone }) {
  const cls =
    'stat__value' +
    (size === 'lg' ? ' stat__value--lg' : '') +
    (text ? ' stat__value--text' : '');
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={cls} style={tone ? { color: STATUS_COLOR[tone] } : undefined}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  );
}

/** Current value against the vehicle's own historical baseline. */
export function Meter({ value, baseline, tone = 'ok' }) {
  const ceiling = Math.max(value, baseline) * 1.3 || 1;
  const at = (v) => Math.max(0, Math.min(100, (v / ceiling) * 100));
  return (
    <div>
      <div className="meter__track">
        <div
          className="meter__fill"
          style={{ width: `${at(value)}%`, background: STATUS_COLOR[tone] }}
        />
        <div className="meter__mark" style={{ left: `${at(baseline)}%` }} title="Baseline" />
      </div>
      <div className="meter__scale">
        <span>0</span>
        <span>baseline {baseline.toFixed(1)}</span>
        <span>{ceiling.toFixed(1)}</span>
      </div>
    </div>
  );
}

/** Live state, derived from the service flag plus telemetry. */
export function vehicleStatus(vehicle, frame) {
  if (vehicle.serviceState === 'MAINTENANCE') {
    return { key: 'MAINTENANCE', label: 'In workshop', tone: 'danger' };
  }
  if (vehicle.serviceState === 'OFFLINE') {
    return { key: 'OFFLINE', label: 'Offline', tone: 'neutral' };
  }
  if (!frame) return { key: 'PENDING', label: 'Awaiting fix', tone: 'neutral' };
  if (frame.speed > 1) return { key: 'ACTIVE', label: 'Moving', tone: 'ok' };
  if (frame.ignition) return { key: 'IDLING', label: 'Idling', tone: 'warn' };
  return { key: 'STOPPED', label: 'Stopped', tone: 'info' };
}
