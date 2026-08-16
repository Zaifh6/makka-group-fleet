# Makka Fleet Control

Prototype dashboard for the Makka Group fleet platform — **telematics + fuel management +
video telematics + maintenance + cost analytics**, all running against a simulated device
feed so it can be demoed and reviewed before any hardware is fitted.

Everything is client-side. There is no backend, no API keys, and no network calls.

---

## Run it

```bash
npm install
npm run dev
```

Opens on <http://localhost:5173>. Also works on a phone — open the network URL Vite prints.

```bash
npm run build     # production bundle into dist/
npm run preview   # serve the built bundle
```

Requires Node 18+ (developed on Node 24).

---

## What's in the dashboard

| Area | What it shows |
|---|---|
| **Fleet overview** | Vehicle counts by live state, utilisation, 30-day fuel and maintenance cost, distance, all-in cost per km, net contribution |
| **Live fleet map** | All vehicles moving in real coordinates across Peshawar and Mardan, drawn over geofenced business areas. Click any marker to select it. Selected vehicle draws its route trail |
| **Zone occupancy** | How many vehicles are inside each business area right now, plus how many are in transit between areas |
| **Fleet roster** | Every vehicle with live speed, current area, ownership and open-alert count |
| **Vehicle detail** | Five tabs — Overview, Fuel & efficiency, Maintenance, Economics, Video & clips |
| **Alerts & auto logs** | Standing conditions (fuel anomalies, overdue service, low tank) merged with the live event stream (harsh braking, overspeed, geofence transitions, unauthorised areas) |
| **Fleet economics** | Owned vs outsourced comparison and a net-contribution ranking across the fleet |

### Vehicle detail tabs

- **Overview** — live telemetry, driver and device assignment, live dashcam, and the raw
  device payload as JSON so the data contract is visible.
- **Fuel & efficiency** — km/L against the vehicle's own baseline, cost per km, trend chart
  across fill-ups, the full fill-up log with anomaly flags and risk scores, and a form to
  log a new fill-up (all downstream numbers recompute immediately).
- **Maintenance** — every scheduled item measured against the live odometer, with overdue
  and due-soon status, plus completed work history and cost.
- **Economics** — 30-day cost composition, business output, net contribution, value per
  rupee, and contract terms for outsourced vehicles.
- **Video & clips** — live multi-channel dashcam and the index of clips that events pushed
  to cloud storage.

---

## Simulated data feed

`src/sim/telemetryFeed.js` stands in for the real ingest path:

```
GPS tracker → 4G → MQTT broker → IoT gateway → backend → WebSocket → dashboard
```

It exposes the same interface a WebSocket client would, so replacing it is a one-file change:

```js
feed.subscribe(handler)  // returns an unsubscribe function
feed.start()
feed.stop()
feed.setTimeScale(n)
```

Each emitted frame matches the agreed device payload exactly:

```json
{
  "vehicle_id": "MK-TRUCK-023",
  "latitude": 34.0151,
  "longitude": 71.5249,
  "speed": 48,
  "heading": 92,
  "ignition": true,
  "engine_status": "RUNNING",
  "odometer": 128450,
  "fuel_level": 62,
  "timestamp": "2026-08-16T09:30:00.000Z"
}
```

Frames also carry server-side enrichment the backend would add — resolved zone, region,
compass heading, distance today, idle minutes, stop count and route trail.

**Physics.** Vehicles are integrated on a fixed 2-simulated-second sub-step, so acceleration,
braking and harsh-event thresholds behave realistically even though the wall clock is
compressed. Speed is clamped to the limit of whichever geofence the vehicle is physically
inside, which is what makes overspeed detection meaningful rather than arbitrary.

**Time controls.** The top bar runs the clock at 1×, 60× (default) or 300×, and pauses the
feed. At 60× one real second is one simulated minute.

---

## Detection logic

### Fuel anomalies — `src/lib/metrics.js`

Distance for a fill-up is the GPS/OBD odometer delta since the *previous* fill-up, so km/L
always describes the tank that was just burned. Each entry is scored:

| Rule | Trigger | Weight |
|---|---|---|
| `CAPACITY_EXCEEDED` | litres logged exceed the physical tank | 55 |
| `IMPLAUSIBLE_VOLUME` | large fill against under 100 km travelled | 45 |
| `EFFICIENCY_COLLAPSE` | 25%+ below the vehicle's baseline | 40 |
| `EFFICIENCY_DROP` | 12–25% below baseline | 25 |
| `PRICE_MISMATCH` | unit price more than 8% off market rate | 15 |

Weights sum into a 0–100 risk score. Three vehicles are seeded with deliberate anomalies:

- `MK-TRUCK-007` — efficiency drop to 4.61 km/L against a 5.4 baseline (**−14.7%**)
- `MK-TRUCK-052` — **128 L logged into a 110 L tank** (risk 95)
- `MK-VAN-063` — **64 L purchased after only 50 km** (risk 85)

### Maintenance

Next-due is `lastServiceKm + intervalKm`, compared against the live odometer on every frame.
`MK-TRUCK-023` is seeded so its oil change is **overdue by 450 km**.

### Geofencing — `src/sim/geofence.js`

Ray-casting point-in-polygon over the business-area polygons, emitting `ZONE_ENTERED` /
`ZONE_EXITED`. A vehicle entering an area outside its `authorizedZones`, or the restricted
cantonment polygon, raises `UNAUTHORIZED_ZONE`.

### Video

Only events flagged `triggersClip` produce an uploaded clip — the event-driven video
architecture, where continuous footage stays on the in-vehicle buffer and only incidents
reach cloud storage.

---

## Project layout

```
src/
├── data/                  seed records — swap for API calls
│   ├── vehicles.js        fleet roster: identity, driver, device, costs, business output
│   ├── geofences.js       business-area polygons + map bounds
│   ├── routes.js          route loops with stops, dwell times and cruise speeds
│   ├── fuel.js            fill-up logs (three seeded with anomalies)
│   └── maintenance.js     service schedules and completed-work history
├── sim/                   stands in for the backend
│   ├── telemetryFeed.js   the simulated device feed — replace with a WebSocket client
│   ├── geofence.js        zone resolution and occupancy
│   └── alerts.js          standing conditions + live event normalisation
├── lib/
│   ├── geo.js             haversine, bearing, route geometry, point-in-polygon
│   ├── metrics.js         efficiency, anomaly scoring, maintenance, cost-benefit
│   └── format.js          all number and currency display
├── hooks/
│   └── useFleetTelemetry.js   subscribes the UI to the feed
├── components/            one file per panel
└── styles.css             design tokens and component styles
```

---

## Wiring it to a real backend

1. Replace `src/sim/telemetryFeed.js` with a WebSocket client that keeps the same
   `subscribe / start / stop` interface. Nothing in the component tree changes.
2. Replace the `src/data/*.js` modules with fetches against the Vehicle, Fuel and
   Maintenance services.
3. Move `deriveFuelRows`, `maintenanceStatus` and the geofence test server-side once the
   volume justifies it — `metrics.js` is written as pure functions so the logic ports
   directly.
4. Swap the canvas map in `FleetMap.jsx` for Mapbox or OpenStreetMap. The projection and
   hit-testing already work in real lat/lng.

---

## Notes

- Money is PKR. Fuel is priced at Rs 280/L in `src/data/vehicles.js`.
- Adding a fill-up updates state in memory only — it resets on reload.
- The theme follows your OS by default; the top bar cycles Auto → Light → Dark.
- Typography uses system serif, sans and monospace stacks, so there are no font downloads
  and the app works fully offline.
