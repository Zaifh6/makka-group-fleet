/**
 * Business areas as geofence polygons.
 *
 * In production these live in PostGIS (`GEOGRAPHY(POLYGON, 4326)`) and the
 * enter/exit test runs server-side on ingest. Here the same polygons are
 * evaluated client-side by `src/sim/geofence.js` so the behaviour is identical.
 *
 * Coordinates are [lat, lng] and approximate real districts of Khyber
 * Pakhtunkhwa so the map reads as a real service territory.
 */

export const REGIONS = ['Peshawar', 'Mardan'];

export const ZONES = [
  {
    id: 'PSH-HYT',
    name: 'Hayatabad',
    region: 'Peshawar',
    kind: 'DISTRIBUTION',
    speedLimit: 50,
    polygon: [
      [33.9780, 71.4000],
      [34.0150, 71.4080],
      [34.0210, 71.4720],
      [33.9860, 71.4650],
    ],
  },
  {
    id: 'PSH-UNI',
    name: 'University Town',
    region: 'Peshawar',
    kind: 'DELIVERY',
    speedLimit: 40,
    polygon: [
      [33.9950, 71.4830],
      [34.0250, 71.4870],
      [34.0290, 71.5350],
      [33.9990, 71.5300],
    ],
  },
  {
    id: 'PSH-SDR',
    name: 'Saddar',
    region: 'Peshawar',
    kind: 'DELIVERY',
    speedLimit: 40,
    polygon: [
      [33.9970, 71.5400],
      [34.0250, 71.5430],
      [34.0280, 71.5880],
      [34.0000, 71.5850],
    ],
  },
  {
    id: 'PSH-RNG',
    name: 'Ring Road Corridor',
    region: 'Peshawar',
    kind: 'TRANSIT',
    speedLimit: 80,
    polygon: [
      [34.0300, 71.4300],
      [34.0640, 71.4400],
      [34.0700, 71.6100],
      [34.0360, 71.6000],
    ],
  },
  {
    id: 'MDN-CTY',
    name: 'Mardan City',
    region: 'Mardan',
    kind: 'DISTRIBUTION',
    speedLimit: 50,
    polygon: [
      [34.1700, 72.0050],
      [34.2250, 72.0120],
      [34.2300, 72.0850],
      [34.1750, 72.0780],
    ],
  },
  {
    id: 'MDN-TKB',
    name: 'Takht Bhai',
    region: 'Mardan',
    kind: 'DELIVERY',
    speedLimit: 50,
    polygon: [
      [34.2800, 71.9100],
      [34.3250, 71.9180],
      [34.3300, 71.9800],
      [34.2850, 71.9720],
    ],
  },
  {
    id: 'MDN-KTL',
    name: 'Katlang',
    region: 'Mardan',
    kind: 'DELIVERY',
    speedLimit: 50,
    polygon: [
      [34.3450, 71.9900],
      [34.3900, 71.9980],
      [34.3950, 72.0560],
      [34.3500, 72.0480],
    ],
  },
  {
    id: 'RSTR-CANT',
    name: 'Cantonment (Restricted)',
    region: 'Peshawar',
    kind: 'RESTRICTED',
    speedLimit: 30,
    polygon: [
      [34.0050, 71.5950],
      [34.0270, 71.5980],
      [34.0290, 71.6280],
      [34.0070, 71.6250],
    ],
  },
];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));

/** Map viewport — chosen so the two regions fill the canvas at ~0.69 h/w. */
export const MAP_BOUNDS = {
  minLat: 33.94,
  maxLat: 34.42,
  minLng: 71.34,
  maxLng: 72.16,
};
