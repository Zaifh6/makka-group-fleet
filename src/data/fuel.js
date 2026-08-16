/**
 * Manually-logged fuel fill-ups, keyed by vehicle id, oldest first.
 *
 * Litres/cost/odometer are what the driver or dispatcher submits. Everything
 * derived — distance, km/L, Rs/km, deviation from baseline, anomaly flags —
 * is computed in `src/lib/metrics.js` against GPS-confirmed odometer, which is
 * exactly what makes the fraud checks possible.
 *
 * Three vehicles are seeded with deliberate anomalies so the detection logic
 * has something to catch:
 *   MK-TRUCK-007  efficiency collapse (-14.6% vs baseline)
 *   MK-TRUCK-052  fill volume exceeds physical tank capacity
 *   MK-VAN-063    large fill against implausibly small distance
 */

export const FUEL_LOGS = {
  'MK-TRUCK-023': [
    { id: 'F-2301', date: '2026-07-19', litres: 118, cost: 33040, odo: 125100, station: 'PSO Ring Road', loggedBy: 'Imran Khattak' },
    { id: 'F-2302', date: '2026-07-26', litres: 116, cost: 32480, odo: 125940, station: 'PSO Ring Road', loggedBy: 'Imran Khattak' },
    { id: 'F-2303', date: '2026-08-02', litres: 118, cost: 33040, odo: 126790, station: 'Shell Hayatabad', loggedBy: 'Imran Khattak' },
    { id: 'F-2304', date: '2026-08-09', litres: 119, cost: 33320, odo: 127650, station: 'PSO Ring Road', loggedBy: 'Dispatch' },
    { id: 'F-2305', date: '2026-08-14', litres: 92, cost: 25760, odo: 128300, station: 'Attock Mardan Rd', loggedBy: 'Imran Khattak' },
  ],

  'MK-TRUCK-018': [
    { id: 'F-1801', date: '2026-07-20', litres: 95, cost: 26600, odo: 161200, station: 'Shell Hayatabad', loggedBy: 'Waqar Ahmad' },
    { id: 'F-1802', date: '2026-07-27', litres: 100, cost: 28000, odo: 161990, station: 'Shell Hayatabad', loggedBy: 'Waqar Ahmad' },
    { id: 'F-1803', date: '2026-08-03', litres: 98, cost: 27440, odo: 162760, station: 'PSO University Rd', loggedBy: 'Waqar Ahmad' },
    { id: 'F-1804', date: '2026-08-10', litres: 99, cost: 27720, odo: 163540, station: 'Shell Hayatabad', loggedBy: 'Dispatch' },
    { id: 'F-1805', date: '2026-08-15', litres: 72, cost: 20160, odo: 164100, station: 'PSO University Rd', loggedBy: 'Waqar Ahmad' },
  ],

  'MK-VAN-041': [
    { id: 'F-4101', date: '2026-07-22', litres: 34, cost: 9520, odo: 60350, station: 'PSO Kohat Rd', loggedBy: 'Sami Ullah' },
    { id: 'F-4102', date: '2026-07-30', litres: 33, cost: 9240, odo: 60760, station: 'PSO Kohat Rd', loggedBy: 'Sami Ullah' },
    { id: 'F-4103', date: '2026-08-06', litres: 34, cost: 9520, odo: 61180, station: 'Shell Hayatabad', loggedBy: 'Sami Ullah' },
    { id: 'F-4104', date: '2026-08-13', litres: 34, cost: 9520, odo: 61600, station: 'PSO Kohat Rd', loggedBy: 'Dispatch' },
  ],

  // Gradual efficiency collapse — the classic "something is wrong mechanically
  // or fuel is leaving the tank" signature.
  'MK-TRUCK-007': [
    { id: 'F-0701', date: '2026-07-18', litres: 190, cost: 53200, odo: 337200, station: 'PSO GT Road', loggedBy: 'Gul Rehman' },
    { id: 'F-0702', date: '2026-07-25', litres: 192, cost: 53760, odo: 338240, station: 'PSO GT Road', loggedBy: 'Gul Rehman' },
    { id: 'F-0703', date: '2026-08-01', litres: 193, cost: 54040, odo: 339280, station: 'Attock Nowshera', loggedBy: 'Gul Rehman' },
    { id: 'F-0704', date: '2026-08-08', litres: 195, cost: 54600, odo: 340300, station: 'PSO GT Road', loggedBy: 'Gul Rehman' },
    { id: 'F-0705', date: '2026-08-14', litres: 191, cost: 53480, odo: 341180, station: 'PSO GT Road', loggedBy: 'Gul Rehman' },
  ],

  // 128 L logged into a 110 L tank — physically impossible.
  'MK-TRUCK-052': [
    { id: 'F-5201', date: '2026-07-21', litres: 104, cost: 29120, odo: 95900, station: 'PSO Mardan', loggedBy: 'Shahid Iqbal' },
    { id: 'F-5202', date: '2026-07-28', litres: 105, cost: 29400, odo: 96620, station: 'PSO Mardan', loggedBy: 'Shahid Iqbal' },
    { id: 'F-5203', date: '2026-08-04', litres: 106, cost: 29680, odo: 97350, station: 'Hascol Takht Bhai', loggedBy: 'Shahid Iqbal' },
    { id: 'F-5204', date: '2026-08-11', litres: 106, cost: 29680, odo: 98080, station: 'PSO Mardan', loggedBy: 'Shahid Iqbal' },
    { id: 'F-5205', date: '2026-08-15', litres: 128, cost: 35840, odo: 98380, station: 'Hascol Katlang', loggedBy: 'Shahid Iqbal' },
  ],

  // 64 L purchased after only 50 GPS-confirmed km.
  'MK-VAN-063': [
    { id: 'F-6301', date: '2026-07-23', litres: 66, cost: 18480, odo: 208300, station: 'PSO Ring Road', loggedBy: 'Naveed Anwar' },
    { id: 'F-6302', date: '2026-07-31', litres: 65, cost: 18200, odo: 208930, station: 'PSO Ring Road', loggedBy: 'Naveed Anwar' },
    { id: 'F-6303', date: '2026-08-07', litres: 67, cost: 18760, odo: 209570, station: 'Shell Saddar', loggedBy: 'Naveed Anwar' },
    { id: 'F-6304', date: '2026-08-14', litres: 68, cost: 19040, odo: 210230, station: 'PSO Ring Road', loggedBy: 'Naveed Anwar' },
    { id: 'F-6305', date: '2026-08-16', litres: 64, cost: 17920, odo: 210280, station: 'Shell Saddar', loggedBy: 'Naveed Anwar' },
  ],

  'MK-TRUCK-031': [
    { id: 'F-3101', date: '2026-07-15', litres: 132, cost: 36960, odo: 285900, station: 'PSO Ring Road', loggedBy: 'Fayaz Gul' },
    { id: 'F-3102', date: '2026-07-24', litres: 131, cost: 36680, odo: 286700, station: 'PSO Ring Road', loggedBy: 'Fayaz Gul' },
    { id: 'F-3103', date: '2026-08-02', litres: 130, cost: 36400, odo: 287400, station: 'Shell Hayatabad', loggedBy: 'Fayaz Gul' },
  ],

  'MK-VAN-077': [
    { id: 'F-7701', date: '2026-07-20', litres: 30, cost: 8400, odo: 27600, station: 'PSO Mardan', loggedBy: 'Adnan Shah' },
    { id: 'F-7702', date: '2026-07-29', litres: 30, cost: 8400, odo: 27990, station: 'PSO Mardan', loggedBy: 'Adnan Shah' },
    { id: 'F-7703', date: '2026-08-08', litres: 30, cost: 8400, odo: 28380, station: 'PSO Mardan', loggedBy: 'Adnan Shah' },
    { id: 'F-7704', date: '2026-08-15', litres: 32, cost: 8960, odo: 28800, station: 'Hascol Takht Bhai', loggedBy: 'Dispatch' },
  ],
};
