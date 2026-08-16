import { useEffect, useRef, useState } from 'react';

/**
 * km/L across fill-ups, against the vehicle's own baseline.
 *
 * One series, so no legend box — the title names it. The baseline is a
 * reference rule rather than a second series, points below it are marked, and
 * the endpoint is emphasised because "where are we now" is the question.
 */
export default function EfficiencyTrend({ rows, baseline, height = 132 }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const measured = rows.filter((r) => r.kmpl !== null);
  if (measured.length < 2) {
    return (
      <div ref={wrapRef}>
        <p className="empty">Two fill-ups are needed before efficiency can be measured.</p>
      </div>
    );
  }

  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = Math.max(40, width - padL - padR);
  const plotH = height - padT - padB;

  const values = measured.map((r) => r.kmpl).concat([baseline]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = max - min || 1;
  min = Math.max(0, min - span * 0.25);
  max = max + span * 0.25;

  const xAt = (i) => padL + (i / (measured.length - 1)) * plotW;
  const yAt = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  const linePath = measured
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(r.kmpl).toFixed(1)}`)
    .join(' ');

  const areaPath =
    `${linePath} L${xAt(measured.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} ` +
    `L${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  const ticks = [min, (min + max) / 2, max];

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - padL) / plotW) * (measured.length - 1));
    setHover(i >= 0 && i < measured.length ? i : null);
  }

  const last = measured[measured.length - 1];

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Fuel efficiency across ${measured.length} fill-ups, latest ${last.kmpl.toFixed(2)} kilometres per litre against a baseline of ${baseline}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* y grid */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL} x2={padL + plotW} y1={yAt(t)} y2={yAt(t)}
              stroke="var(--rule)" strokeWidth="1"
            />
            <text
              x={padL - 6} y={yAt(t) + 3} textAnchor="end"
              fontSize="9" fill="var(--ink-3)" fontFamily="var(--mono)"
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* baseline reference */}
        <line
          x1={padL} x2={padL + plotW} y1={yAt(baseline)} y2={yAt(baseline)}
          stroke="var(--ink-2)" strokeWidth="1.5" strokeDasharray="4 3"
        />
        <text
          x={padL + plotW} y={yAt(baseline) - 4} textAnchor="end"
          fontSize="9" fill="var(--ink-2)" fontFamily="var(--mono)"
        >
          baseline {baseline}
        </text>

        <path d={areaPath} fill="var(--accent)" opacity="0.09" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {measured.map((r, i) => {
          const below = r.kmpl < baseline * 0.88;
          const isLast = i === measured.length - 1;
          return (
            <g key={r.id}>
              <circle
                cx={xAt(i)} cy={yAt(r.kmpl)} r={isLast ? 4.5 : 3.5}
                fill={isLast ? 'var(--accent)' : 'var(--surface)'}
                stroke={below ? 'var(--critical)' : 'var(--accent)'}
                strokeWidth="2"
              />
              {/* generous invisible hit target */}
              <rect
                x={xAt(i) - plotW / (measured.length * 2)} y={padT}
                width={plotW / measured.length} height={plotH}
                fill="transparent"
              />
              <text
                x={xAt(i)} y={height - 6} textAnchor="middle"
                fontSize="9" fill="var(--ink-3)" fontFamily="var(--mono)"
              >
                {r.date.slice(5)}
              </text>
            </g>
          );
        })}

        {hover !== null && (
          <line
            x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={padT + plotH}
            stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 2"
          />
        )}
      </svg>

      {hover !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(xAt(hover) - 70, 0), Math.max(0, width - 148)),
            top: 0,
            width: 148,
            background: 'var(--surface-raised)',
            border: '1px solid var(--rule-strong)',
            borderRadius: 3,
            padding: '7px 9px',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow)',
            fontSize: 11,
          }}
        >
          <div className="n" style={{ fontWeight: 700 }}>{measured[hover].date}</div>
          <div className="n">{measured[hover].kmpl.toFixed(2)} km/L</div>
          <div className="n faint">{measured[hover].dist} km · {measured[hover].litres} L</div>
          <div
            className="n"
            style={{ color: measured[hover].deviationPct < -12 ? 'var(--critical)' : 'var(--ink-2)' }}
          >
            {measured[hover].deviationPct > 0 ? '+' : ''}
            {measured[hover].deviationPct.toFixed(1)}% vs baseline
          </div>
        </div>
      )}
    </div>
  );
}
