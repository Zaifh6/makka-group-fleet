import { useEffect, useRef } from 'react';
import { ZONES, MAP_BOUNDS } from '../data/geofences.js';
import { ROUTES } from '../data/routes.js';
import { SEVERITY_COLOR, vehicleStatus } from './ui.jsx';

/**
 * Canvas fleet map.
 *
 * Deliberately not a tile map — the pilot is about *business areas*, so the
 * geofence polygons are the basemap and roads are irrelevant. Swapping in
 * Mapbox later means replacing the draw calls; the projection and hit-testing
 * below already work in real lat/lng.
 */

const ASPECT = 0.70; // height / width, matched to the bounds' true ground ratio

function project(lat, lng, w, h) {
  const { minLat, maxLat, minLng, maxLng } = MAP_BOUNDS;
  return {
    x: ((lng - minLng) / (maxLng - minLng)) * w,
    y: ((maxLat - lat) / (maxLat - minLat)) * h,
  };
}

function unproject(x, y, w, h) {
  const { minLat, maxLat, minLng, maxLng } = MAP_BOUNDS;
  return {
    lng: minLng + (x / w) * (maxLng - minLng),
    lat: maxLat - (y / h) * (maxLat - minLat),
  };
}

const ZONE_TINT = {
  DISTRIBUTION: '--accent-soft',
  DELIVERY: '--info-soft',
  TRANSIT: '--surface-sunken',
  RESTRICTED: '--critical-soft',
};

export default function FleetMap({ vehicles, frames, framesById, selectedId, onSelect }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ vehicles, frames, framesById, selectedId });
  stateRef.current = { vehicles, frames, framesById, selectedId };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = 0;
    let height = 0;

    const cssVar = (name) =>
      getComputedStyle(canvas).getPropertyValue(name).trim() || '#888';

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = Math.round(rect.width * ASPECT);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.height = height + 'px';
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      const ctx = canvas.getContext('2d');
      if (!width || !height) return;
      const { vehicles: vs, framesById: byId, selectedId: sel } = stateRef.current;

      const ink = cssVar('--ink');
      const ink2 = cssVar('--ink-2');
      const ink3 = cssVar('--ink-3');
      const rule = cssVar('--rule');
      const accent = cssVar('--accent');
      const surface = cssVar('--surface-raised');

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = surface;
      ctx.fillRect(0, 0, width, height);

      // --- graticule -----------------------------------------------------
      ctx.strokeStyle = rule;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      for (let i = 1; i < 8; i++) {
        const x = (width / 8) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let i = 1; i < 6; i++) {
        const y = (height / 6) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // --- geofence zones -------------------------------------------------
      for (const zone of ZONES) {
        const pts = zone.polygon.map(([lat, lng]) => project(lat, lng, width, height));
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();

        ctx.fillStyle = cssVar(ZONE_TINT[zone.kind] || '--surface-sunken');
        ctx.fill();

        // Restricted areas get hatching so they read without relying on hue.
        if (zone.kind === 'RESTRICTED') {
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = cssVar('--critical');
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1;
          const minX = Math.min(...pts.map((p) => p.x));
          const maxX = Math.max(...pts.map((p) => p.x));
          const minY = Math.min(...pts.map((p) => p.y));
          const maxY = Math.max(...pts.map((p) => p.y));
          for (let d = minX - (maxY - minY); d < maxX; d += 6) {
            ctx.beginPath();
            ctx.moveTo(d, minY);
            ctx.lineTo(d + (maxY - minY), maxY);
            ctx.stroke();
          }
          ctx.restore();
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = zone.kind === 'RESTRICTED' ? cssVar('--critical') : cssVar('--rule-strong');
        ctx.lineWidth = zone.kind === 'RESTRICTED' ? 1.5 : 1;
        ctx.setLineDash(zone.kind === 'TRANSIT' ? [4, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        // label at the polygon centroid
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        ctx.fillStyle = ink2;
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(zone.name.toUpperCase(), cx, cy);
      }

      // --- routes ----------------------------------------------------------
      ctx.strokeStyle = ink3;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      for (const route of Object.values(ROUTES)) {
        ctx.beginPath();
        route.points.forEach((p, i) => {
          const q = project(p.lat, p.lng, width, height);
          i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
        });
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // --- selected vehicle's trail ----------------------------------------
      const selFrame = sel ? byId[sel] : null;
      if (selFrame && selFrame.trail && selFrame.trail.length > 1) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        selFrame.trail.forEach((p, i) => {
          const q = project(p.lat, p.lng, width, height);
          i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();
      }

      // --- vehicle markers --------------------------------------------------
      for (const v of vs) {
        const f = byId[v.id];
        if (!f) continue;
        const p = project(f.latitude, f.longitude, width, height);
        const status = vehicleStatus(v, f);
        const color = SEVERITY_COLOR[status.severity];
        const isSelected = v.id === sel;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Heading wedge for anything actually moving.
        if (f.speed > 1) {
          const rad = ((f.heading - 90) * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(rad) * 16, p.y + Math.sin(rad) * 16);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, isSelected ? 7 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = surface;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label the selected vehicle only — otherwise the map turns to soup.
        if (isSelected) {
          const text = `${v.id}  ${f.speed} km/h`;
          ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'left';
          const w = ctx.measureText(text).width;
          const lx = Math.min(p.x + 14, width - w - 10);
          const ly = Math.max(14, p.y - 12);
          ctx.fillStyle = surface;
          ctx.globalAlpha = 0.92;
          ctx.fillRect(lx - 4, ly - 10, w + 8, 15);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1;
          ctx.strokeRect(lx - 4, ly - 10, w + 8, 15);
          ctx.fillStyle = ink;
          ctx.fillText(text, lx, ly + 1);
        }
      }

      ctx.textAlign = 'left';
    }

    function handleClick(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { vehicles: vs, framesById: byId } = stateRef.current;

      let best = null;
      let bestDist = Infinity;
      for (const v of vs) {
        const f = byId[v.id];
        if (!f) continue;
        const p = project(f.latitude, f.longitude, rect.width, rect.width * ASPECT);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestDist) { bestDist = d; best = v.id; }
      }
      if (best && bestDist < 22) onSelect(best);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener('click', handleClick);
    resize();

    // Redraw whenever new telemetry lands.
    const id = setInterval(draw, 250);

    return () => {
      observer.disconnect();
      canvas.removeEventListener('click', handleClick);
      clearInterval(id);
    };
  }, [onSelect]);

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas"
      aria-label="Live fleet map showing vehicle positions across Peshawar and Mardan business areas"
    />
  );
}

export { project, unproject };
