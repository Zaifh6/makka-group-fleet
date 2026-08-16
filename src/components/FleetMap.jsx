import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZONES } from '../data/geofences.js';
import { STATUS_COLOR, vehicleStatus } from './ui.jsx';
import { vehicleSvg } from './vehicleIcons.js';

/**
 * Real slippy map over OpenStreetMap data.
 *
 * Tiles come from CARTO's OSM basemaps — no API key, no billing account, and a
 * light/dark pair that matches the dashboard theme. Google Maps would need a
 * billed API key; the layer URL below is the only line that changes if you get
 * one (see README).
 *
 * Telemetry arrives once a second, but vehicles are drawn on a requestAnimation
 * Frame loop that interpolates between the last two fixes, so they glide along
 * the road at constant speed instead of teleporting each tick. Heading is
 * interpolated the short way round the compass so a vehicle turning past north
 * never spins backwards through 359°.
 */

const TILES = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

const ZONE_STYLE = {
  DISTRIBUTION: { color: '#2563eb', fillOpacity: 0.10 },
  DELIVERY:     { color: '#0891b2', fillOpacity: 0.09 },
  TRANSIT:      { color: '#64748b', fillOpacity: 0.06, dashArray: '6 5' },
  RESTRICTED:   { color: '#b91c1c', fillOpacity: 0.16, dashArray: '4 4' },
};

const ICON_SIZE = 48;

function isDark() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Shortest signed angular distance from a to b, in degrees. */
const angleDelta = (a, b) => ((b - a + 540) % 360) - 180;

function iconHtml(vehicle, color, selected, label) {
  return `<div class="vmarker${selected ? ' vmarker--selected' : ''}">
    <div class="vmarker__halo"></div>
    <div class="vmarker__rot">${vehicleSvg(vehicle, color)}</div>
    ${label ? `<div class="vmarker__label">${label}</div>` : ''}
  </div>`;
}

function popupHtml(vehicle, frame) {
  if (!frame) return `<div class="popup__id">${vehicle.id}</div>`;
  return `
    <div class="popup__id">${vehicle.id}</div>
    <div class="popup__row"><span>${vehicle.make} ${vehicle.model}</span></div>
    <div class="popup__row"><span>Speed</span><b>${frame.speed} km/h</b></div>
    <div class="popup__row"><span>Area</span><b>${frame.zoneName}</b></div>
    <div class="popup__row"><span>Driver</span><b>${vehicle.driver.name}</b></div>
    <div class="popup__row"><span>Odometer</span><b>${frame.odometer.toLocaleString()} km</b></div>
  `;
}

export default function FleetMap({ vehicles, framesById, selectedId, onSelect }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const trailRef = useRef(null);
  const themeRef = useRef(null);

  // id -> { marker, rotEl, signature }
  const markersRef = useRef(new Map());
  // id -> { fromLat, fromLng, toLat, toLng, fromHdg, toHdg, t0, dur }
  const animRef = useRef(new Map());
  const lastTickRef = useRef(0);

  const propsRef = useRef({ vehicles, framesById, selectedId, onSelect });
  propsRef.current = { vehicles, framesById, selectedId, onSelect };

  /* --- create the map once -------------------------------------------- */
  useEffect(() => {
    const map = L.map(nodeRef.current, {
      center: [34.12, 71.74],
      zoom: 10,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    const dark = isDark();
    themeRef.current = dark;
    tileRef.current = L.tileLayer(dark ? TILES.dark.url : TILES.light.url, {
      attribution: dark ? TILES.dark.attribution : TILES.light.attribution,
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    for (const zone of ZONES) {
      const style = ZONE_STYLE[zone.kind] || ZONE_STYLE.TRANSIT;
      L.polygon(zone.polygon, {
        color: style.color,
        weight: 1.5,
        fillColor: style.color,
        fillOpacity: style.fillOpacity,
        dashArray: style.dashArray,
        interactive: false,
      })
        .addTo(map)
        .bindTooltip(`${zone.name} · ${zone.region}`, { direction: 'center' });
    }

    map.fitBounds(L.latLngBounds(ZONES.flatMap((z) => z.polygon)), { padding: [28, 28] });

    /* --- the smoothing loop ------------------------------------------- */
    let raf = requestAnimationFrame(function step(now) {
      for (const [id, a] of animRef.current) {
        const entry = markersRef.current.get(id);
        if (!entry) continue;
        const t = a.dur > 0 ? Math.min(1, (now - a.t0) / a.dur) : 1;

        // Linear, deliberately: the vehicle covers ground at a constant speed
        // between fixes, so easing here would read as accelerating into a stop.
        entry.marker.setLatLng([
          a.fromLat + (a.toLat - a.fromLat) * t,
          a.fromLng + (a.toLng - a.fromLng) * t,
        ]);

        if (entry.rotEl) {
          const hdg = a.fromHdg + angleDelta(a.fromHdg, a.toHdg) * t;
          entry.rotEl.style.transform = `rotate(${hdg.toFixed(1)}deg)`;
        }
      }
      raf = requestAnimationFrame(step);
    });

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      animRef.current.clear();
    };
  }, []);

  /* --- follow the theme ------------------------------------------------ */
  useEffect(() => {
    const apply = () => {
      if (!tileRef.current) return;
      const dark = isDark();
      if (dark === themeRef.current) return;
      themeRef.current = dark;
      tileRef.current.setUrl(dark ? TILES.dark.url : TILES.light.url);
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', apply);
      observer.disconnect();
    };
  }, []);

  /* --- retarget the animation whenever telemetry lands ----------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const now = performance.now();
    // Measure the real gap between fixes so the glide always lasts exactly as
    // long as it takes the next one to arrive.
    const gap = lastTickRef.current ? now - lastTickRef.current : 1000;
    lastTickRef.current = now;
    const dur = Math.min(3000, Math.max(250, gap));

    for (const vehicle of vehicles) {
      const frame = framesById[vehicle.id];
      if (!frame) continue;

      const status = vehicleStatus(vehicle, frame);
      const color = STATUS_COLOR[status.tone];
      const selected = vehicle.id === selectedId;
      const label = selected ? `${vehicle.id} · ${frame.speed} km/h` : '';
      const signature = `${color}|${selected}|${label}`;

      let entry = markersRef.current.get(vehicle.id);

      if (!entry) {
        const marker = L.marker([frame.latitude, frame.longitude], {
          icon: L.divIcon({
            className: 'vmarker-wrap',
            html: iconHtml(vehicle, color, selected, label),
            iconSize: [ICON_SIZE, ICON_SIZE],
            iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
          }),
          title: vehicle.id,
          riseOnHover: true,
        }).addTo(map);

        marker.on('click', () => propsRef.current.onSelect(vehicle.id));
        // Function form stays current without rebinding on every frame.
        marker.bindPopup(() => popupHtml(vehicle, propsRef.current.framesById[vehicle.id]));

        entry = { marker, rotEl: null, signature };
        markersRef.current.set(vehicle.id, entry);

        animRef.current.set(vehicle.id, {
          fromLat: frame.latitude, fromLng: frame.longitude,
          toLat: frame.latitude, toLng: frame.longitude,
          fromHdg: frame.heading, toHdg: frame.heading,
          t0: now, dur,
        });
      } else if (entry.signature !== signature) {
        // Only touch the DOM when the icon actually changes — rebuilding it
        // every tick would throw away the rotation and kill the smoothing.
        entry.marker.setIcon(
          L.divIcon({
            className: 'vmarker-wrap',
            html: iconHtml(vehicle, color, selected, label),
            iconSize: [ICON_SIZE, ICON_SIZE],
            iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
          })
        );
        entry.signature = signature;
        entry.rotEl = null; // stale after setIcon replaces the element
      }

      const el = entry.marker.getElement();
      if (el && !entry.rotEl) entry.rotEl = el.querySelector('.vmarker__rot');

      // Start the next leg from wherever the marker is right now, not from the
      // previous target, so a mid-glide update doesn't snap.
      const current = entry.marker.getLatLng();
      const prev = animRef.current.get(vehicle.id);
      const prevHdg = prev
        ? prev.fromHdg + angleDelta(prev.fromHdg, prev.toHdg) *
            (prev.dur > 0 ? Math.min(1, (now - prev.t0) / prev.dur) : 1)
        : frame.heading;

      animRef.current.set(vehicle.id, {
        fromLat: current.lat, fromLng: current.lng,
        toLat: frame.latitude, toLng: frame.longitude,
        fromHdg: prevHdg, toHdg: frame.heading,
        t0: now, dur,
      });
    }

    // Trail of where the selected vehicle has actually been.
    const selFrame = framesById[selectedId];
    const points = selFrame?.trail?.map((p) => [p.lat, p.lng]) || [];
    if (points.length > 1) {
      if (!trailRef.current) {
        trailRef.current = L.polyline(points, {
          color: '#3b82f6', // legible on both the light and dark basemaps
          weight: 3.5,
          opacity: 0.85,
          lineJoin: 'round',
        }).addTo(map);
      } else {
        trailRef.current.setLatLngs(points);
      }
    } else if (trailRef.current) {
      trailRef.current.setLatLngs([]);
    }
  }, [vehicles, framesById, selectedId]);

  return <div ref={nodeRef} className="map" aria-label="Live fleet map" />;
}
