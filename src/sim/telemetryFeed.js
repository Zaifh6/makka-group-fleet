/**
 * Simulated telemetry feed.
 *
 * This module stands in for the real ingest path — GPS tracker → 4G → MQTT
 * broker → gateway → WebSocket. It exposes the same shape a WebSocket client
 * would: `subscribe(handler)` returning an unsubscribe function, plus
 * `start()` / `stop()`. Swapping in the real feed means replacing this file
 * and nothing else.
 *
 * Each emitted frame matches the agreed device payload:
 *
 *   {
 *     vehicle_id, latitude, longitude, speed, heading,
 *     ignition, engine_status, odometer, fuel_level, timestamp
 *   }
 *
 * Physics are integrated on a fixed 2-simulated-second sub-step so that
 * acceleration, braking and harsh-event thresholds behave realistically even
 * when the wall-clock tick is compressed 60×.
 */

import { ROUTES } from '../data/routes.js';
import { ZONES } from '../data/geofences.js';
import { buildRouteGeometry, positionAt, compass } from '../lib/geo.js';
import { zoneAt } from './geofence.js';

const ZONE_LOOKUP = Object.fromEntries(ZONES.map((z) => [z.id, z]));

const SUB_STEP_S = 2;          // simulated seconds per physics sub-step
const MAX_ACCEL = 1.1;         // m/s²  normal acceleration
const NORMAL_DECEL = 2.0;      // m/s²  normal braking
const HARSH_DECEL = 4.2;       // m/s²  triggers a harsh-brake flag
const HARSH_BRAKE_THRESHOLD = 3.5;
const HARSH_ACCEL_THRESHOLD = 2.8;
const TRAIL_LIMIT = 500;

const kmhToMs = (v) => v / 3.6;
const msToKmh = (v) => v * 3.6;

/** Seeded so a reload reproduces the same shift rather than a new random one. */
function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function initVehicleState(vehicle, rand) {
  const base = {
    id: vehicle.id,
    odometer: vehicle.odometer,
    fuelLevel: vehicle.fuelLevelPct,
    speed: 0,
    heading: 0,
    ignition: false,
    trail: [],
    distanceToday: 0,
    idleSeconds: 0,
    movingSeconds: 0,
    stopCount: 0,
    zoneId: null,
    zoneEnteredAt: null,
    overspeedActive: false,
    dwellRemaining: 0,
    dwellTotal: 0,
    speedingUntil: 0,
    brakeUntil: 0,
    brakeTarget: 0,
    // Lower-rated drivers speed and brake harder — makes per-driver
    // behaviour visible in the event log rather than uniform noise.
    aggression: Math.max(0, (4.8 - vehicle.driver.rating) / 1.2),
  };

  if (vehicle.serviceState !== 'IN_SERVICE') {
    return { ...base, parked: true, position: vehicle.parkedAt };
  }

  const route = ROUTES[vehicle.routeId];
  const geometry = buildRouteGeometry(route.points);
  // Stagger vehicles around their loops so the fleet isn't nose-to-tail.
  const distAlong = rand() * geometry.totalKm;
  const { position, heading } = positionAt(geometry, distAlong);

  return {
    ...base,
    parked: false,
    route,
    geometry,
    distAlong,
    position,
    heading,
    // Seed a plausible amount already driven before the dashboard opened.
    distanceToday: 40 + rand() * 90,
  };
}

export function createTelemetryFeed({ vehicles, tickMs = 1000, timeScale = 60, seed = 20260816 }) {
  const rand = makeRandom(seed);
  const states = new Map();
  for (const v of vehicles) states.set(v.id, initVehicleState(v, rand));

  const vehicleById = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  // Start the shift mid-morning so the dashboard opens on an active fleet.
  const simTime = new Date();
  simTime.setHours(9, 12, 0, 0);

  let scale = timeScale;
  let timer = null;
  const subscribers = new Set();
  let lastPayload = null;

  function stepVehicle(vehicle, st, dt, events) {
    if (st.parked) {
      st.speed = 0;
      st.ignition = false;
      st.idleSeconds += dt;
      return;
    }

    const prevSpeed = st.speed;
    const zone = zoneAt(st.position);
    const limit = zone ? zone.speedLimit : 90;
    const total = st.geometry.totalKm;
    const leg = positionAt(st.geometry, st.distAlong).leg;
    const legEndKm = leg.startKm + leg.km;

    // ---- decide target speed -------------------------------------------
    let target;
    if (st.dwellRemaining > 0) {
      target = 0;
    } else {
      target = Math.min(leg.from.cruise ?? 50, limit);

      // Occasional speeding episode, weighted by driver aggression.
      if (st.speedingUntil > 0) {
        target = limit * (1.18 + 0.18 * st.aggression);
      } else if (rand() < 0.004 * (0.4 + st.aggression) * dt) {
        st.speedingUntil = 40 + rand() * 90;
        target = limit * (1.18 + 0.18 * st.aggression);
      }

      // Ease off approaching a stop, but keep a floor so the vehicle actually
      // reaches the waypoint instead of asymptotically crawling at it.
      const distToEnd = legEndKm - (((st.distAlong % total) + total) % total);
      if (leg.to.stop && distToEnd < 0.5) {
        target = Math.max(8, target * (distToEnd / 0.5));
      }
    }

    if (st.speedingUntil > 0) st.speedingUntil = Math.max(0, st.speedingUntil - dt);

    // ---- harsh braking episode -------------------------------------------
    // A harsh brake has to be a real speed collapse, not just a steeper
    // approach to a target the vehicle was already near.
    if (st.brakeUntil > 0) {
      st.brakeUntil = Math.max(0, st.brakeUntil - dt);
      target = Math.min(target, st.brakeTarget);
    } else if (
      st.dwellRemaining === 0 &&
      st.speed > 28 &&
      rand() < 0.0009 * (0.5 + st.aggression) * dt
    ) {
      st.brakeTarget = st.speed * 0.25;
      st.brakeUntil = 6;
      target = st.brakeTarget;
    }

    // ---- integrate speed -------------------------------------------------
    const targetMs = kmhToMs(target);
    const currentMs = kmhToMs(st.speed);
    let accel;
    if (targetMs > currentMs) {
      accel = Math.min(MAX_ACCEL, (targetMs - currentMs) / dt);
    } else {
      const maxDecel = st.brakeUntil > 0 ? HARSH_DECEL : NORMAL_DECEL;
      accel = -Math.min(maxDecel, (currentMs - targetMs) / dt);
    }

    const newMs = Math.max(0, currentMs + accel * dt);
    st.speed = msToKmh(newMs);
    // Reading taken before the dwell clamp below, so arriving at a scheduled
    // stop is never mistaken for a harsh brake.
    const integratedSpeed = st.speed;

    // ---- advance position -----------------------------------------------
    const distBefore = st.distAlong;
    const km = (st.speed / 3600) * dt;
    if (km > 0) {
      st.distAlong += km;
      st.odometer += km;
      st.distanceToday += km;

      const consumed = km / vehicle.baselineKmPerL;
      st.fuelLevel = Math.max(0, st.fuelLevel - (consumed / vehicle.tankCapacityL) * 100);
      if (st.fuelLevel < 8) st.fuelLevel = 92; // refuelled at a station

      const p = positionAt(st.geometry, st.distAlong);
      st.position = p.position;
      st.heading = p.heading;
      st.movingSeconds += dt;
    } else {
      st.idleSeconds += dt;
    }

    st.ignition = st.speed > 0.5 || (st.dwellRemaining > 0 && st.dwellRemaining < 60);

    // ---- dwell at stops ---------------------------------------------------
    // Triggered by *crossing* the waypoint, not by reaching zero speed — a
    // speed test deadlocks, because the approach ramp never quite gets there.
    if (st.dwellRemaining > 0) {
      st.dwellRemaining = Math.max(0, st.dwellRemaining - dt);
    } else if (km > 0 && leg.to.stop) {
      const prevMod = ((distBefore % total) + total) % total;
      const nextMod = ((st.distAlong % total) + total) % total;
      const wrapped = nextMod < prevMod;
      const crossed = wrapped || (prevMod < legEndKm && nextMod >= legEndKm);

      if (crossed) {
        const overshoot = wrapped ? nextMod + (total - legEndKm) : nextMod - legEndKm;
        st.distAlong -= overshoot - 0.002; // park just past the waypoint
        st.speed = 0;
        st.dwellTotal = (leg.to.dwellMin || 8) * 60;
        st.dwellRemaining = st.dwellTotal;
        st.stopCount += 1;
        const p = positionAt(st.geometry, st.distAlong);
        st.position = p.position;
      }
    }

    // ---- event detection --------------------------------------------------
    const decelMs2 = (kmhToMs(prevSpeed) - kmhToMs(integratedSpeed)) / dt;
    if (decelMs2 >= HARSH_BRAKE_THRESHOLD && prevSpeed > 20) {
      events.push({
        type: 'HARSH_BRAKE',
        vehicleId: vehicle.id,
        severity: 'serious',
        detail: `${Math.round(prevSpeed)} → ${Math.round(integratedSpeed)} km/h at ${decelMs2.toFixed(1)} m/s²`,
        position: { ...st.position },
        zone,
      });
    }
    if (-decelMs2 >= HARSH_ACCEL_THRESHOLD && integratedSpeed > 25) {
      events.push({
        type: 'HARSH_ACCEL',
        vehicleId: vehicle.id,
        severity: 'warning',
        detail: `${Math.round(prevSpeed)} → ${Math.round(integratedSpeed)} km/h`,
        position: { ...st.position },
        zone,
      });
    }

    const over = st.speed > limit + 5;
    if (over && !st.overspeedActive) {
      st.overspeedActive = true;
      events.push({
        type: 'OVERSPEED',
        vehicleId: vehicle.id,
        severity: 'warning',
        detail: `${Math.round(st.speed)} km/h in a ${limit} km/h ${zone ? zone.name : 'open road'} limit`,
        position: { ...st.position },
        zone,
      });
    } else if (!over && st.speed < limit) {
      st.overspeedActive = false;
    }

    // ---- geofence transitions --------------------------------------------
    const newZoneId = zone ? zone.id : null;
    if (newZoneId !== st.zoneId) {
      if (st.zoneId) {
        const dwellMin = st.zoneEnteredAt ? (st.zoneEnteredAt / 60) : 0;
        events.push({
          type: 'ZONE_EXITED',
          vehicleId: vehicle.id,
          severity: 'info',
          detail: `Left ${zoneName(st.zoneId)} after ${Math.round(dwellMin)} min`,
          position: { ...st.position },
          zone: null,
        });
      }
      if (newZoneId) {
        events.push({
          type: 'ZONE_ENTERED',
          vehicleId: vehicle.id,
          severity: 'info',
          detail: `Entered ${zone.name} (${zone.region})`,
          position: { ...st.position },
          zone,
        });
        if (zone.kind === 'RESTRICTED' || !vehicle.authorizedZones.includes(zone.id)) {
          events.push({
            type: 'UNAUTHORIZED_ZONE',
            vehicleId: vehicle.id,
            severity: 'critical',
            detail: `${zone.name} is outside this vehicle's authorised areas`,
            position: { ...st.position },
            zone,
          });
        }
      }
      st.zoneId = newZoneId;
      st.zoneEnteredAt = 0;
    } else if (st.zoneId) {
      st.zoneEnteredAt = (st.zoneEnteredAt || 0) + dt;
    }
  }

  function zoneName(id) {
    return ZONE_LOOKUP[id] ? ZONE_LOOKUP[id].name : id;
  }

  function tick() {
    const dtSim = (tickMs / 1000) * scale;
    const substeps = Math.max(1, Math.round(dtSim / SUB_STEP_S));
    const dt = dtSim / substeps;
    const events = [];

    for (const vehicle of vehicles) {
      const st = states.get(vehicle.id);
      for (let i = 0; i < substeps; i++) stepVehicle(vehicle, st, dt, events);

      st.trail.push({ ...st.position });
      if (st.trail.length > TRAIL_LIMIT) st.trail.shift();
    }

    simTime.setTime(simTime.getTime() + dtSim * 1000);
    const timestamp = simTime.toISOString();

    const frames = vehicles.map((v) => {
      const st = states.get(v.id);
      const zone = st.parked ? zoneAt(st.position) : (st.zoneId ? ZONE_LOOKUP[st.zoneId] : null);
      return {
        // ---- device payload (matches the agreed tracker schema) ----
        vehicle_id: v.id,
        latitude: +st.position.lat.toFixed(6),
        longitude: +st.position.lng.toFixed(6),
        speed: Math.round(st.speed),
        heading: Math.round(st.heading),
        ignition: st.ignition,
        engine_status: st.ignition ? 'RUNNING' : 'OFF',
        odometer: Math.round(st.odometer),
        fuel_level: Math.round(st.fuelLevel),
        timestamp,
        // ---- server-side enrichment ----
        zoneId: zone ? zone.id : null,
        zoneName: zone ? zone.name : 'In transit',
        region: zone ? zone.region : '—',
        headingLabel: compass(st.heading),
        distanceToday: st.distanceToday,
        idleMinutes: st.idleSeconds / 60,
        movingMinutes: st.movingSeconds / 60,
        stops: st.stopCount,
        trail: st.trail,
        parked: st.parked,
        serviceState: v.serviceState,
      };
    });

    for (const e of events) e.timestamp = timestamp;

    lastPayload = { frames, events, simTime: new Date(simTime) };
    for (const fn of subscribers) fn(lastPayload);
  }

  return {
    subscribe(fn) {
      subscribers.add(fn);
      if (lastPayload) fn(lastPayload);
      return () => subscribers.delete(fn);
    },
    start() {
      if (timer) return;
      tick();
      timer = setInterval(tick, tickMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    setTimeScale(next) {
      scale = next;
    },
    getTimeScale: () => scale,
    isRunning: () => timer !== null,
    getSnapshot: () => lastPayload,
  };
}
