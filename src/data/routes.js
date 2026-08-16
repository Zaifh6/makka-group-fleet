/**
 * Route definitions. Each route is a closed loop of waypoints the simulator
 * walks a vehicle along. `stop: true` waypoints are customer/depot stops where
 * the vehicle dwells (ignition eventually off) before continuing.
 *
 * `cruise` is the target speed in km/h for the leg *leaving* that waypoint;
 * the simulator clamps it to the speed limit of whatever zone the vehicle is
 * physically inside, which is what makes overspeed alerts meaningful.
 */

export const ROUTES = {
  'RT-PSH-CITY': {
    id: 'RT-PSH-CITY',
    name: 'Peshawar City Distribution',
    region: 'Peshawar',
    points: [
      { lat: 33.9930, lng: 71.4290, name: 'Hayatabad Depot', stop: true, dwellMin: 14, cruise: 45 },
      { lat: 34.0120, lng: 71.4600, name: 'Hayatabad Ph-3', stop: true, dwellMin: 7, cruise: 42 },
      { lat: 34.0140, lng: 71.5080, name: 'University Town', stop: true, dwellMin: 9, cruise: 38 },
      { lat: 34.0130, lng: 71.5620, name: 'Saddar Market', stop: true, dwellMin: 11, cruise: 40 },
      { lat: 34.0480, lng: 71.5300, name: 'Ring Road N', cruise: 72 },
      { lat: 34.0500, lng: 71.4550, name: 'Ring Road W', cruise: 74 },
    ],
  },

  'RT-PSH-MDN': {
    id: 'RT-PSH-MDN',
    name: 'Peshawar → Mardan Trunk',
    region: 'Inter-city',
    points: [
      { lat: 33.9950, lng: 71.4340, name: 'Hayatabad Depot', stop: true, dwellMin: 18, cruise: 50 },
      { lat: 34.0460, lng: 71.5400, name: 'Ring Road Junction', cruise: 78 },
      { lat: 34.0900, lng: 71.7200, name: 'GT Road / Pabbi', cruise: 88 },
      { lat: 34.1500, lng: 71.9000, name: 'Nowshera Bypass', cruise: 90 },
      { lat: 34.1980, lng: 72.0450, name: 'Mardan Hub', stop: true, dwellMin: 22, cruise: 48 },
      { lat: 34.1400, lng: 71.8200, name: 'Return Leg', cruise: 86 },
    ],
  },

  'RT-MDN-RURAL': {
    id: 'RT-MDN-RURAL',
    name: 'Mardan Rural Circuit',
    region: 'Mardan',
    points: [
      { lat: 34.1980, lng: 72.0450, name: 'Mardan Hub', stop: true, dwellMin: 15, cruise: 46 },
      { lat: 34.2200, lng: 72.0300, name: 'Mardan North', stop: true, dwellMin: 6, cruise: 48 },
      { lat: 34.3050, lng: 71.9450, name: 'Takht Bhai Bazaar', stop: true, dwellMin: 12, cruise: 50 },
      { lat: 34.3700, lng: 72.0200, name: 'Katlang Depot', stop: true, dwellMin: 10, cruise: 52 },
      { lat: 34.2800, lng: 72.0600, name: 'Return via Rustam Rd', cruise: 58 },
    ],
  },

  'RT-PSH-RING': {
    id: 'RT-PSH-RING',
    name: 'Ring Road Shuttle',
    region: 'Peshawar',
    points: [
      { lat: 34.0350, lng: 71.4400, name: 'Ring Road SW', cruise: 76 },
      { lat: 34.0600, lng: 71.5000, name: 'Ring Road NW', cruise: 80 },
      { lat: 34.0620, lng: 71.5800, name: 'Ring Road NE', cruise: 82 },
      { lat: 34.0200, lng: 71.6050, name: 'Warehouse East', stop: true, dwellMin: 16, cruise: 44 },
      { lat: 34.0080, lng: 71.5450, name: 'Saddar Transit', cruise: 40 },
      { lat: 34.0000, lng: 71.4700, name: 'Hayatabad Transit', cruise: 46 },
    ],
  },

  'RT-PSH-WEST': {
    id: 'RT-PSH-WEST',
    name: 'West Peshawar Short Loop',
    region: 'Peshawar',
    points: [
      { lat: 33.9900, lng: 71.4150, name: 'Hayatabad Depot', stop: true, dwellMin: 12, cruise: 42 },
      { lat: 34.0050, lng: 71.4400, name: 'Hayatabad Ph-6', stop: true, dwellMin: 8, cruise: 40 },
      { lat: 34.0180, lng: 71.4900, name: 'Canal Road', cruise: 48 },
      { lat: 34.0060, lng: 71.5150, name: 'University Rd Retail', stop: true, dwellMin: 9, cruise: 38 },
      { lat: 33.9870, lng: 71.4600, name: 'Kohat Rd Turn', cruise: 46 },
    ],
  },

  'RT-LONGHAUL': {
    id: 'RT-LONGHAUL',
    name: 'Regional Long Haul',
    region: 'Inter-city',
    points: [
      { lat: 33.9950, lng: 71.4340, name: 'Hayatabad Depot', stop: true, dwellMin: 25, cruise: 55 },
      { lat: 34.0550, lng: 71.5600, name: 'Ring Road Exit', cruise: 80 },
      { lat: 34.1200, lng: 71.8400, name: 'GT Road Corridor', cruise: 92 },
      { lat: 34.2100, lng: 72.0500, name: 'Mardan Transfer', stop: true, dwellMin: 14, cruise: 50 },
      { lat: 34.3200, lng: 71.9500, name: 'Takht Bhai Drop', stop: true, dwellMin: 11, cruise: 52 },
      { lat: 34.1800, lng: 71.7000, name: 'Return Corridor', cruise: 88 },
    ],
  },
};
