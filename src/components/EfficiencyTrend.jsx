import { useEffect, useRef, useState } from 'react';

/**
 * km/L across fill-ups against the vehicle's own baseline.
 *
 * One series, so no legend — the section title names it. The baseline is a
 * reference rule rather than a second series, points that fall well under it
 * are ringed red, and the endpoint is emphasised because "where are we now" is
 * the question being asked.
 */
export default function EfficiencyTrend({ rows, baseline, height = 170 }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(420);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const data = rows.filter((r) => r.kmpl !== null);

  if (data.length < 2) {
    return (
      <div ref={wrapRef}>
        <p className="empty">
          Two fill-ups are needed before fuel economy can be measured.
        </p>
      </div>
    );
  }

  const padL = 42;
  const padR = 14;
  const padT = 14;
  const padB = 30;
  const plotW = Math.max(60, width - padL - padR);
  const plotH = height - padT - padB;

  const values = data.map((r) => r.kmpl).concat([baseline]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const min = Math.max(0, lo - span * 0.3);
  const max = hi + span * 0.3;

  const xAt = (i) => padL + (i / (data.length - 1)) * plotW;
  const yAt = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  const line = data
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(r.kmpl).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${xAt(data.length - 1).toFixed(1)},${padT + plotH} L${xAt(0).toFixed(1)},${padT + plotH} Z`;

  const ticks = [min, (min + max) / 2, max];
  const last = data[data.length - 1];

  function move(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - padL) / plotW) * (data.length - 1));
    setHover(i >= 0 && i < data.length ? i : null);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Fuel economy across ${data.length} fill-ups. Latest ${last.kmpl.toFixed(2)} km per litre against a normal of ${baseline}.`}
        onMouseMove={move}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="effFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={padL + plotW} y1={yAt(t)} y2={yAt(t)} stroke="var(--border)" />
            <text
              x={padL - 8} y={yAt(t) + 4} textAnchor="end"
              fontSize="11" fill="var(--text-3)" fontFamily="var(--mono)"
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        <line
          x1={padL} x2={padL + plotW} y1={yAt(baseline)} y2={yAt(baseline)}
          stroke="var(--text-2)" strokeWidth="1.5" strokeDasharray="5 4"
        />
        <text
          x={padL + plotW} y={yAt(baseline) - 6} textAnchor="end"
          fontSize="11" fill="var(--text-2)" fontFamily="var(--mono)"
        >
          normal {baseline}
        </text>

        <path d={area} fill="url(#effFill)" />
        <path
          d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round"
        />

        {data.map((r, i) => {
          const bad = r.kmpl < baseline * 0.88;
          const isLast = i === data.length - 1;
          return (
            <g key={r.id}>
              <circle
                cx={xAt(i)} cy={yAt(r.kmpl)} r={isLast ? 5.5 : 4}
                fill={isLast ? 'var(--primary)' : 'var(--surface)'}
                stroke={bad ? 'var(--danger)' : 'var(--primary)'}
                strokeWidth="2.5"
              />
              <text
                x={xAt(i)} y={height - 9} textAnchor="middle"
                fontSize="11" fill="var(--text-3)" fontFamily="var(--mono)"
              >
                {r.date.slice(5)}
              </text>
            </g>
          );
        })}

        {hover !== null && (
          <line
            x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={padT + plotH}
            stroke="var(--text-3)" strokeDasharray="3 3"
          />
        )}
      </svg>

      {hover !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(xAt(hover) - 80, 0), Math.max(0, width - 168)),
            top: 4,
            width: 168,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-sm)',
            padding: '9px 11px',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 12,
          }}
        >
          <div className="n" style={{ fontWeight: 700, marginBottom: 2 }}>{data[hover].date}</div>
          <div className="n" style={{ fontSize: 15, fontWeight: 600 }}>
            {data[hover].kmpl.toFixed(2)} km/L
          </div>
          <div className="n faint">{data[hover].dist} km on {data[hover].litres} L</div>
          <div
            className="n"
            style={{
              color: data[hover].deviationPct < -12 ? 'var(--danger)' : 'var(--text-2)',
              marginTop: 2,
            }}
          >
            {data[hover].deviationPct > 0 ? '+' : ''}
            {data[hover].deviationPct.toFixed(1)}% vs normal
          </div>
        </div>
      )}
    </div>
  );
}
