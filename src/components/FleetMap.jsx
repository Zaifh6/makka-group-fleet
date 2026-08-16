import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZONES } from '../data/geofences.js';
import { STATUS_COLOR, vehicleStatus } from './ui.jsx';

/**
 * Real slippy map over OpenStreetMap data.
 *
 * Tiles come from CARTO's OSM basemaps — no API key, no billing account, and a
 * light/dark pair that matches the dashboard theme. Google Maps would need a
 * billed API key; the layer URL below is the only line that changes if you get
 * one (see README).
 *
 * Everything is drawn in true WGS-84 lat/lng, so this is real geography: the
 * geofence polygons sit on the actual districts and the vehicles drive real
 * roads around Peshawar and Mardan.
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

function isDark() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function markerHtml(vehicle, frame, color, selected) {
  const label = selected
    ? `<span class="vmarker__label">${vehicle.id} · ${frame.speed} km/h</span>`
    : '';
  return `<div class="vmarker ${selected ? 'vmarker--selected' : ''}">
    ${label}<span class="vmarker__dot" style="background:${color}"></span>
  </div>`;
}

function popupHtml(vehicle, frame) {
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
  const markersRef = useRef(new Map());
  const trailRef = useRef(null);
  const themeRef = useRef(null);

  // Latest props for callbacks that must not re-bind the whole map.
  const propsRef = useRef({ vehicles, framesById, selectedId, onSelect });
  propsRef.current = { vehicles, framesById, selectedId, onSelect };

  /* --- create the map once ------------------------------------------- */
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

    // Business areas
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
        .bindTooltip(`${zone.name} · ${zone.region}`, {
          permanent: false,
          direction: 'center',
          className: 'zone-tooltip',
        });
    }

    // Fit to the whole service territory.
    const bounds = L.latLngBounds(ZONES.flatMap((z) => z.polygon));
    map.fitBounds(bounds, { padding: [28, 28] });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  /* --- follow the theme ------------------------------------------------ */
  useEffect(() => {
    const apply = () => {
      const map = mapRef.current;
      if (!map || !tileRef.current) return;
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

  /* --- sync markers + trail on every telemetry frame ------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const vehicle of vehicles) {
      const frame = framesById[vehicle.id];
      if (!frame) continue;

      const status = vehicleStatus(vehicle, frame);
      const color = STATUS_COLOR[status.tone];
      const selected = vehicle.id === selectedId;
      const pos = [frame.latitude, frame.longitude];

      let marker = markersRef.current.get(vehicle.id);
      if (!marker) {
        marker = L.marker(pos, {
          icon: L.divIcon({
            className: 'vmarker-wrap',
            html: markerHtml(vehicle, frame, color, selected),
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
          title: vehicle.id,
          riseOnHover: true,
        }).addTo(map);
        marker.on('click', () => propsRef.current.onSelect(vehicle.id));
        markersRef.current.set(vehicle.id, marker);
      } else {
        marker.setLatLng(pos);
        marker.setIcon(
          L.divIcon({
            className: 'vmarker-wrap',
            html: markerHtml(vehicle, frame, color, selected),
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })
        );
      }
      marker.bindPopup(popupHtml(vehicle, frame));
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
