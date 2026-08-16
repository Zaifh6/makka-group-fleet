/**
 * Maintenance lifecycle, keyed by vehicle id.
 *
 * `schedule` drives automatic alerting: next-due odometer is
 * `lastServiceKm + intervalKm`, compared against the live GPS/OBD odometer on
 * every telemetry frame. `history` is the completed-work record that feeds the
 * maintenance line of the cost-benefit analysis.
 */

export const MAINTENANCE = {
  'MK-TRUCK-023': {
    schedule: [
      { type: 'Oil change', lastServiceKm: 123000, intervalKm: 5000, lastServiceDate: '2026-06-28' },
      { type: 'Brake service', lastServiceKm: 119000, intervalKm: 20000, lastServiceDate: '2026-04-11' },
      { type: 'Tyre rotation', lastServiceKm: 121500, intervalKm: 15000, lastServiceDate: '2026-05-22' },
      { type: 'Air filter', lastServiceKm: 124000, intervalKm: 10000, lastServiceDate: '2026-07-02' },
      { type: 'Battery check', lastServiceKm: 118000, intervalKm: 30000, lastServiceDate: '2026-03-30' },
    ],
    history: [
      { id: 'M-2311', date: '2026-06-28', odo: 123000, type: 'Oil change', description: 'Engine oil + filter, 15W-40', partsCost: 18400, labourCost: 3500, vendor: 'Hayatabad Workshop' },
      { id: 'M-2310', date: '2026-05-22', odo: 121500, type: 'Tyre rotation', description: 'Five-wheel rotation, pressure reset', partsCost: 0, labourCost: 4200, vendor: 'Hayatabad Workshop' },
      { id: 'M-2309', date: '2026-04-11', odo: 119000, type: 'Brake service', description: 'Front pads replaced, rear drums skimmed', partsCost: 34500, labourCost: 11000, vendor: 'Peshawar Auto Care' },
    ],
  },

  'MK-TRUCK-018': {
    schedule: [
      { type: 'Oil change', lastServiceKm: 161000, intervalKm: 5000, lastServiceDate: '2026-07-24' },
      { type: 'Brake service', lastServiceKm: 152000, intervalKm: 20000, lastServiceDate: '2026-02-18' },
      { type: 'Tyre replacement', lastServiceKm: 156000, intervalKm: 40000, lastServiceDate: '2026-04-05' },
      { type: 'Suspension check', lastServiceKm: 158000, intervalKm: 25000, lastServiceDate: '2026-05-14' },
    ],
    history: [
      { id: 'M-1814', date: '2026-07-24', odo: 161000, type: 'Oil change', description: 'Engine oil + filter', partsCost: 15200, labourCost: 3000, vendor: 'Hayatabad Workshop' },
      { id: 'M-1813', date: '2026-05-14', odo: 158000, type: 'Suspension check', description: 'Leaf spring inspection, bushings greased', partsCost: 6800, labourCost: 7500, vendor: 'Hayatabad Workshop' },
    ],
  },

  'MK-VAN-041': {
    schedule: [
      { type: 'Oil change', lastValueNote: null, lastServiceKm: 58000, intervalKm: 5000, lastServiceDate: '2026-06-10' },
      { type: 'Brake service', lastServiceKm: 52000, intervalKm: 20000, lastServiceDate: '2026-02-02' },
      { type: 'AC service', lastServiceKm: 55000, intervalKm: 20000, lastServiceDate: '2026-04-19' },
    ],
    history: [
      { id: 'M-4108', date: '2026-06-10', odo: 58000, type: 'Oil change', description: 'Engine oil + filter, 10W-30', partsCost: 5600, labourCost: 1800, vendor: 'Kohat Rd Service' },
      { id: 'M-4107', date: '2026-04-19', odo: 55000, type: 'AC service', description: 'Gas top-up, cabin filter', partsCost: 4200, labourCost: 2500, vendor: 'Kohat Rd Service' },
    ],
  },

  'MK-TRUCK-007': {
    schedule: [
      { type: 'Oil change', lastServiceKm: 338000, intervalKm: 5000, lastServiceDate: '2026-07-26' },
      { type: 'Injector service', lastServiceKm: 320000, intervalKm: 25000, lastServiceDate: '2026-01-15' },
      { type: 'Brake service', lastServiceKm: 330000, intervalKm: 20000, lastServiceDate: '2026-04-28' },
      { type: 'Clutch assembly', lastServiceKm: 300000, intervalKm: 60000, lastServiceDate: '2025-08-09' },
      { type: 'Tyre replacement', lastServiceKm: 318000, intervalKm: 40000, lastServiceDate: '2025-12-20' },
    ],
    history: [
      { id: 'M-0721', date: '2026-07-26', odo: 338000, type: 'Oil change', description: 'Engine oil + filter, heavy duty', partsCost: 29800, labourCost: 5000, vendor: 'GT Road Diesel Centre' },
      { id: 'M-0720', date: '2026-04-28', odo: 330000, type: 'Brake service', description: 'Full brake overhaul, air dryer replaced', partsCost: 62000, labourCost: 22000, vendor: 'GT Road Diesel Centre' },
      { id: 'M-0719', date: '2026-01-15', odo: 320000, type: 'Injector service', description: 'Injectors cleaned and calibrated', partsCost: 48000, labourCost: 18000, vendor: 'Peshawar Diesel Tech' },
    ],
  },

  'MK-TRUCK-052': {
    schedule: [
      { type: 'Oil change', lastServiceKm: 94000, intervalKm: 5000, lastServiceDate: '2026-06-30' },
      { type: 'Brake service', lastServiceKm: 84000, intervalKm: 20000, lastServiceDate: '2026-02-11' },
      { type: 'Tyre rotation', lastServiceKm: 90000, intervalKm: 15000, lastServiceDate: '2026-05-08' },
    ],
    history: [
      { id: 'M-5206', date: '2026-06-30', odo: 94000, type: 'Oil change', description: 'Contractor-performed, invoice on file', partsCost: 0, labourCost: 0, vendor: 'Frontier Logistics' },
    ],
  },

  'MK-VAN-063': {
    schedule: [
      { type: 'Oil change', lastServiceKm: 208000, intervalKm: 5000, lastServiceDate: '2026-07-18' },
      { type: 'Brake service', lastServiceKm: 196000, intervalKm: 20000, lastServiceDate: '2026-01-27' },
      { type: 'Timing belt', lastServiceKm: 180000, intervalKm: 90000, lastServiceDate: '2025-03-14' },
    ],
    history: [
      { id: 'M-6309', date: '2026-07-18', odo: 208000, type: 'Oil change', description: 'Contractor-performed', partsCost: 0, labourCost: 0, vendor: 'Khyber Transport Services' },
    ],
  },

  'MK-TRUCK-031': {
    schedule: [
      { type: 'Engine overhaul', lastServiceKm: 227000, intervalKm: 60000, lastServiceDate: '2025-05-02' },
      { type: 'Oil change', lastServiceKm: 284000, intervalKm: 5000, lastServiceDate: '2026-07-08' },
      { type: 'Brake service', lastServiceKm: 272000, intervalKm: 20000, lastServiceDate: '2026-03-19' },
      { type: 'Gearbox service', lastServiceKm: 258000, intervalKm: 40000, lastServiceDate: '2025-11-11' },
    ],
    history: [
      { id: 'M-3118', date: '2026-08-12', odo: 287540, type: 'Engine repair', description: 'Head gasket failure — currently in workshop', partsCost: 148000, labourCost: 66000, vendor: 'Hayatabad Workshop' },
      { id: 'M-3117', date: '2026-07-08', odo: 284000, type: 'Oil change', description: 'Engine oil + filter', partsCost: 17600, labourCost: 3500, vendor: 'Hayatabad Workshop' },
    ],
  },

  'MK-VAN-077': {
    schedule: [
      { type: 'Oil change', lastServiceKm: 25000, intervalKm: 5000, lastServiceDate: '2026-06-04' },
      { type: 'Brake service', lastServiceKm: 20000, intervalKm: 20000, lastServiceDate: '2026-02-22' },
      { type: 'Tyre rotation', lastServiceKm: 24000, intervalKm: 15000, lastServiceDate: '2026-05-16' },
    ],
    history: [
      { id: 'M-7704', date: '2026-06-04', odo: 25000, type: 'Oil change', description: 'Engine oil + filter', partsCost: 4900, labourCost: 1600, vendor: 'Mardan Hub Yard' },
    ],
  },
};
