/**
 * Geofence evaluation.
 *
 * In production this is a PostGIS `ST_Contains` run on the ingest path. The
 * contract is identical: given a position, which business area is it inside?
 */

import { ZONES } from '../data/geofences.js';
import { pointInPolygon } from '../lib/geo.js';

/** The zone containing a point, or null if it is between areas (in transit). */
export function zoneAt(point) {
  for (const zone of ZONES) {
    if (pointInPolygon(point, zone.polygon)) return zone;
  }
  return null;
}

/** Speed limit that applies at a position. Open road outside any zone. */
export function speedLimitAt(point) {
  const zone = zoneAt(point);
  return zone ? zone.speedLimit : 90;
}

/** How many vehicles are currently in each business area. */
export function zoneOccupancy(frames) {
  const counts = Object.fromEntries(ZONES.map((z) => [z.id, []]));
  let inTransit = 0;
  for (const f of frames) {
    if (f.zoneId && counts[f.zoneId]) counts[f.zoneId].push(f.vehicle_id);
    else inTransit += 1;
  }
  return { counts, inTransit };
}
