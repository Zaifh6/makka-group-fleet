/** Display formatting. Every number the dashboard shows goes through here. */

export const rs = (n) => 'Rs ' + Math.round(n).toLocaleString('en-PK');

/** Compact money for headline tiles: Rs 4.2M, Rs 318K. */
export function rsCompact(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return 'Rs ' + (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return 'Rs ' + Math.round(n / 1_000) + 'K';
  return 'Rs ' + Math.round(n);
}

export function kmCompact(n) {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K km';
  return Math.round(n) + ' km';
}

export const num = (n, d = 0) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : n.toFixed(d);

export const int = (n) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US');

export const pct = (n, d = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : (n > 0 ? '+' : '') + n.toFixed(d) + '%';

/** Wall-clock time from a simulated Date. */
export const clock = (date) =>
  date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const clockShort = (date) =>
  date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function relativeTime(then, now) {
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 60) return secs + 's ago';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

/** Duration in minutes → "1h 24m". */
export function durationMin(mins) {
  const m = Math.round(mins);
  if (m < 60) return m + 'm';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}
