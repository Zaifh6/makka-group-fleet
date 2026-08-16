/** Geospatial helpers. Distances in km, angles in degrees. */

const R_EARTH = 6371;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Great-circle distance between two {lat,lng} points, in km. */
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

/** Initial bearing from a to b, 0–360 where 0 is north. */
export function bearing(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Linear interpolation between two points. Fine at these distances. */
export function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Ray-casting point-in-polygon. `polygon` is an array of [lat, lng]. */
export function pointInPolygon(point, polygon) {
  const { lat, lng } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const intersects =
      lngI > lng !== lngJ > lng &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Compass label for a bearing, for human-readable headings. */
export function compass(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Precompute cumulative segment lengths for a closed route loop so a vehicle
 * can be placed by "distance travelled along the route" rather than by index.
 */
export function buildRouteGeometry(points) {
  const legs = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    const km = haversine(from, to);
    legs.push({ from, to, km, startKm: total, index: i });
    total += km;
  }
  return { legs, totalKm: total };
}

/** Resolve a distance-along-route into a position, heading and current leg. */
export function positionAt(geometry, distanceKm) {
  const { legs, totalKm } = geometry;
  let d = ((distanceKm % totalKm) + totalKm) % totalKm;
  for (const leg of legs) {
    if (d <= leg.startKm + leg.km || leg === legs[legs.length - 1]) {
      const t = leg.km === 0 ? 0 : (d - leg.startKm) / leg.km;
      return {
        position: interpolate(leg.from, leg.to, Math.min(1, Math.max(0, t))),
        heading: bearing(leg.from, leg.to),
        leg,
        legProgress: t,
      };
    }
  }
  const last = legs[legs.length - 1];
  return { position: last.to, heading: bearing(last.from, last.to), leg: last, legProgress: 1 };
}
