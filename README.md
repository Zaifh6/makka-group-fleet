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
| **Live fleet map** | A real OpenStreetMap slippy map of Peshawar and Mardan. Trucks and vans move smoothly along actual roads as top-down icons rotated to their heading, with geofenced business areas shaded underneath. Click any vehicle to select it; the selected one draws today's route trail |
| **Zone occupancy** | How many vehicles are inside each business area right now, plus how many are in transit between areas |
| **Fleet roster** | Every vehicle with live speed, current area, ownership and open-alert count |
| **Vehicle detail** | Five tabs — Overview, Fuel & efficiency, Maintenance, Economics, Video & clips |
| **Alerts & auto logs** | Standing conditions (fuel anomalies, overdue service, low tank) merged with the live event stream (harsh braking, overspeed, geofence transitions, unauthorised areas) |
| **Ask the fleet** | A chat assistant you can question in plain English about any vehicle, driver, area or cost. Answers are computed from live state, not canned |
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

**Time controls.** The top bar runs the clock at 1× (real time), 10× (default), 60× or 300×,
and pauses the feed. 10× is a gentle drift that reads as driving; 300× fast-forwards a whole
shift in a couple of minutes.

**Smooth motion.** Fixes land once a second, but the map draws vehicles on a
`requestAnimationFrame` loop that interpolates between the last two positions, so they glide
rather than teleport. Heading is interpolated the short way round the compass, so a vehicle
turning past north never spins backwards through 359°. Each vehicle is a top-down car or
truck silhouette rotated to its actual heading.

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
4. If you want Google Maps specifically, see below — the map is already real, so this is
   a basemap swap rather than a rewrite.

---

## The map

`src/components/FleetMap.jsx` uses **Leaflet with real OpenStreetMap data**, served through
CARTO's basemap CDN. Real streets, real districts, real coordinates — and it works the
moment you `npm run dev` with **no API key and no billing account**. There is a light and a
dark basemap, and the map follows the dashboard theme automatically.

**Why not Google Maps.** The Google Maps JavaScript API requires an API key attached to a
billing-enabled Google Cloud project; without one it renders a watermarked "development
only" map or fails outright. That would have meant handing you something that doesn't run.
If you want Google specifically, get a key and swap the tile layer:

```js
// src/components/FleetMap.jsx — replace the TILES entry
const TILES = {
  light: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=YOUR_KEY',
    attribution: '&copy; Google',
  },
  // ...
};
```

For a production deployment prefer the official `@googlemaps/js-api-loader` with a properly
restricted key, or Mapbox GL if you want vector tiles. Markers, polygons, popups and the
trail are all standard lat/lng geometry, so they port to any of these.

## The assistant

`src/sim/assistant.js` answers questions in plain English. **There is no model and no API
key** — it matches the question against a set of intents, extracts the entity, and then
*computes the answer from live state*: the same telemetry frames, fuel logs and maintenance
records the panels render.

That distinction matters for the demo. Ask "where is MK-TRUCK-023" twice a minute apart and
you get two different answers, because it reads the current frame rather than replaying a
canned string. Ask about fuel and it recalculates the deviation against that vehicle's own
baseline. Log a new fill-up and the next answer reflects it.

It resolves a vehicle from an id (`MK-TRUCK-023`), a loose number (`truck 52`, `007`), a
registration plate (`LES-4471`) or a driver's name (`Gul Rehman`) — and falls back to
whichever vehicle is currently selected. Naming a vehicle in an answer also selects it on
the map.

What it covers:

| Ask about | Example |
|---|---|
| Priorities | *What needs my attention?* |
| Live position | *Where is MK-TRUCK-052?* |
| Fuel & economy | *How is 007 on fuel?* |
| Fraud checks | *Show me fuel anomalies* |
| Servicing | *Does LES-4471 need service?* |
| Cost & value | *What is MK-TRUCK-031 costing us?* |
| Strategy | *Is owning cheaper than outsourcing?* |
| Areas | *How many vehicles are in Mardan?* |
| Drivers | *Who is driving MK-TRUCK-018?* |

Suggested questions appear as chips, and each answer offers contextual follow-ups.
Unrecognised input gets an honest "I couldn't match that" rather than a guess.

**Swapping in a real LLM** means replacing `ask()` with a call that passes this same context
object as tool results. The answer shape — `{ lead, facts, note, focus, followUps }` — and
the whole UI stay as they are.

## Dashcam footage

There is no camera hardware yet, so `src/data/footage.js` points at real driving clips from
**Pexels** (free licence, hotlinking allowed, no key). They stream from the CDN and are
overlaid with the HUD an actual MDVR burns into the frame — channel, timestamp, unit id, GPS
fix and speed.

Playback rate follows the vehicle's reported speed, and the video pauses when the vehicle
stops, so the picture always agrees with the telemetry. If a clip can't load the panel shows
a "stream unavailable" card rather than a black box.

**This needs a network connection.** To run fully offline, drop your own `.mp4` files into
`public/footage/` and point `CLIPS` at `/footage/yourfile.mp4`. Swapping in real HLS or
WebRTC stream URLs per channel is the same one-line change.

## Notes

- Money is PKR. Fuel is priced at Rs 280/L in `src/data/vehicles.js`.
- Adding a fill-up updates state in memory only — it resets on reload.
- The theme follows your OS by default; the top bar cycles Auto → Light → Dark.
- Fonts are **Inter** (interface) and **JetBrains Mono** (every number), self-hosted via
  `@fontsource`, so there are no Google Fonts requests and text renders identically offline.
