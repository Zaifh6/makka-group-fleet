/**
 * Top-down vehicle silhouettes for the map.
 *
 * Each SVG points north (0°) so the marker's rotation can be set straight from
 * the telemetry heading. Drawn on a 48×48 canvas with the body centred, which
 * keeps the shape inside its box at every rotation angle.
 */

const OUTLINE = '#ffffff';

function truck(color) {
  return `
<svg width="30" height="46" viewBox="0 0 22 40" xmlns="http://www.w3.org/2000/svg">
  <g stroke="${OUTLINE}" stroke-width="1.4" stroke-linejoin="round">
    <rect x="2.2" y="12" width="17.6" height="26" rx="2.4" fill="${color}"/>
    <rect x="3.2" y="1.6" width="15.6" height="11.4" rx="3" fill="${color}"/>
  </g>
  <rect x="5.6" y="3.4" width="10.8" height="3.6" rx="1.3" fill="${OUTLINE}" opacity="0.9"/>
  <line x1="3.4" y1="13" x2="18.6" y2="13" stroke="${OUTLINE}" stroke-width="1" opacity="0.75"/>
  <rect x="4.6" y="17" width="12.8" height="1.4" rx="0.7" fill="${OUTLINE}" opacity="0.35"/>
  <rect x="4.6" y="30" width="12.8" height="1.4" rx="0.7" fill="${OUTLINE}" opacity="0.35"/>
</svg>`;
}

function van(color) {
  return `
<svg width="26" height="40" viewBox="0 0 20 32" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="1.6" width="16" height="28.8" rx="5" fill="${color}"
        stroke="${OUTLINE}" stroke-width="1.4" stroke-linejoin="round"/>
  <rect x="4.6" y="4" width="10.8" height="4" rx="1.6" fill="${OUTLINE}" opacity="0.9"/>
  <rect x="4.6" y="23.4" width="10.8" height="3.4" rx="1.5" fill="${OUTLINE}" opacity="0.55"/>
  <rect x="4.4" y="12" width="11.2" height="1.3" rx="0.65" fill="${OUTLINE}" opacity="0.3"/>
</svg>`;
}

/**
 * Vans and pickups get the rounded body; everything else is a truck.
 *
 * Tested this way round on purpose — matching on "truck" would miss types like
 * "8-Ton Long Haul", which is the biggest truck in the fleet.
 */
export function vehicleSvg(vehicle, color) {
  return /\b(van|pickup|car)\b/i.test(vehicle.type) ? van(color) : truck(color);
}
