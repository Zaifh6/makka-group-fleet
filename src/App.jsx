import { useMemo, useState, useCallback } from 'react';

import { VEHICLES } from './data/vehicles.js';
import { FUEL_LOGS } from './data/fuel.js';
import { MAINTENANCE } from './data/maintenance.js';

import { useFleetTelemetry } from './hooks/useFleetTelemetry.js';
import { standingAlerts, clipsFromEvents } from './sim/alerts.js';
import { zoneOccupancy } from './sim/geofence.js';
import {
  deriveFuelRows, fuelSummary, maintenanceStatus,
  vehicleEconomics, fleetTotals, ownershipComparison, performanceRanking,
} from './lib/metrics.js';

import TopBar from './components/TopBar.jsx';
import FleetOverview from './components/FleetOverview.jsx';
import FleetMap from './components/FleetMap.jsx';
import ZoneOccupancy from './components/ZoneOccupancy.jsx';
import VehicleRoster from './components/VehicleRoster.jsx';
import AlertStream from './components/AlertStream.jsx';
import VehicleDetail from './components/VehicleDetail.jsx';
import FleetEconomics from './components/FleetEconomics.jsx';
import { Panel, STATUS_COLOR } from './components/ui.jsx';

export default function App() {
  const [selectedId, setSelectedId] = useState(VEHICLES[0].id);
  const [fuelLogs, setFuelLogs] = useState(FUEL_LOGS);
  const [alertFilter, setAlertFilter] = useState('action');

  const {
    frames, framesById, eventLog, simTime,
    running, timeScale, toggleRunning, changeTimeScale,
  } = useFleetTelemetry(VEHICLES);

  const selectVehicle = useCallback((id) => setSelectedId(id), []);

  const addFillUp = useCallback((vehicleId, entry) => {
    setFuelLogs((prev) => ({
      ...prev,
      [vehicleId]: [...(prev[vehicleId] || []), entry].sort((a, b) => a.odo - b.odo),
    }));
  }, []);

  /* ---------------------------------------------------------- derived --- */

  const totals = useMemo(() => fleetTotals(VEHICLES, framesById), [framesById]);

  const occupancy = useMemo(() => zoneOccupancy(frames), [frames]);

  const standing = useMemo(
    () => standingAlerts({
      vehicles: VEHICLES,
      fuelLogs,
      maintenance: MAINTENANCE,
      framesById,
    }),
    [fuelLogs, framesById]
  );

  // Standing conditions sit above the live ticker: they stay true until
  // somebody acts on them, whereas events are already history.
  const allAlerts = useMemo(() => [...standing, ...eventLog], [standing, eventLog]);

  const alertCounts = useMemo(() => {
    const counts = {};
    for (const a of allAlerts) {
      if (a.severity === 'critical' || a.severity === 'serious') {
        counts[a.vehicleId] = (counts[a.vehicleId] || 0) + 1;
      }
    }
    return counts;
  }, [allAlerts]);

  const clips = useMemo(() => clipsFromEvents(eventLog, 40), [eventLog]);

  const comparison = useMemo(() => ownershipComparison(VEHICLES), []);
  const ranking = useMemo(() => performanceRanking(VEHICLES), []);

  /* ------------------------------------------- selected vehicle bundle --- */

  const selected = VEHICLES.find((v) => v.id === selectedId) || VEHICLES[0];
  const selectedFrame = framesById[selected.id];

  const selectedRows = useMemo(
    () => deriveFuelRows(fuelLogs[selected.id] || [], selected),
    [fuelLogs, selected]
  );
  const selectedSummary = useMemo(
    () => fuelSummary(selectedRows, selected),
    [selectedRows, selected]
  );
  const selectedSchedule = useMemo(
    () => maintenanceStatus(
      MAINTENANCE[selected.id]?.schedule || [],
      selectedFrame ? selectedFrame.odometer : selected.odometer
    ),
    [selected, selectedFrame]
  );
  const selectedEcon = useMemo(() => vehicleEconomics(selected), [selected]);
  const selectedClips = useMemo(
    () => clips.filter((c) => c.vehicleId === selected.id),
    [clips, selected]
  );
  const selectedAlerts = useMemo(
    () => allAlerts.filter((a) => a.vehicleId === selected.id),
    [allAlerts, selected]
  );

  /* ------------------------------------------------------------ render --- */

  return (
    <div className="app">
      <TopBar
        simTime={simTime}
        running={running}
        timeScale={timeScale}
        onToggleRunning={toggleRunning}
        onChangeScale={changeTimeScale}
      />

      <FleetOverview totals={totals} />

      <div className="layout">
        <section className="panel">
          <header className="panel__head">
            <div>
              <h2 className="panel__title">Where the fleet is</h2>
              <div className="panel__sub">
                Peshawar &amp; Mardan · shaded areas are delivery zones · click a vehicle
              </div>
            </div>
            <span className="panel__meta">{frames.length} units reporting</span>
          </header>

          <FleetMap
            vehicles={VEHICLES}
            framesById={framesById}
            selectedId={selectedId}
            onSelect={selectVehicle}
          />

          <div className="map-legend">
            {[
              ['ok', 'Moving'],
              ['warn', 'Idling'],
              ['info', 'Stopped'],
              ['danger', 'In workshop'],
              ['neutral', 'Offline'],
            ].map(([tone, label]) => (
              <span key={tone}>
                <i style={{ background: STATUS_COLOR[tone] }} />
                {label}
              </span>
            ))}
            <span>
              <i style={{ background: '#3b82f6', borderRadius: 2, width: 16, height: 3 }} />
              Today's route for the selected vehicle
            </span>
          </div>
        </section>

        <section className="panel">
          <header className="panel__head">
            <div>
              <h2 className="panel__title">Vehicles</h2>
              <div className="panel__sub">Click one to see its full record below</div>
            </div>
            <span className="panel__meta">{VEHICLES.length} total</span>
          </header>
          <VehicleRoster
            vehicles={VEHICLES}
            framesById={framesById}
            selectedId={selectedId}
            onSelect={selectVehicle}
            alertCounts={alertCounts}
          />
        </section>
      </div>

      <Panel
        title="Vehicles by area"
        subtitle="How many units are inside each business area right now"
      >
        <ZoneOccupancy occupancy={occupancy} onSelectVehicle={selectVehicle} />
      </Panel>

      <div className="layout">
        <VehicleDetail
          vehicle={selected}
          frame={selectedFrame}
          fuelRows={selectedRows}
          fuelSummary={selectedSummary}
          schedule={selectedSchedule}
          history={MAINTENANCE[selected.id]?.history || []}
          econ={selectedEcon}
          clips={selectedClips}
          vehicleAlerts={selectedAlerts}
          onAddFillUp={addFillUp}
        />

        <section className="panel">
          <header className="panel__head">
            <div>
              <h2 className="panel__title">Alerts</h2>
              <div className="panel__sub">Logged automatically from telemetry and records</div>
            </div>
            <span className="panel__meta">{allAlerts.length} open</span>
          </header>
          <AlertStream
            alerts={allAlerts}
            onSelectVehicle={selectVehicle}
            selectedId={selectedId}
            filter={alertFilter}
            onFilter={setAlertFilter}
          />
        </section>
      </div>

      <Panel
        title="Is the fleet paying for itself?"
        subtitle="Owned versus outsourced, and every vehicle ranked by what it contributes"
      >
        <FleetEconomics
          comparison={comparison}
          ranking={ranking}
          onSelectVehicle={selectVehicle}
          selectedId={selectedId}
        />
      </Panel>

      <footer className="faint" style={{ fontSize: 11, textAlign: 'center', paddingTop: 8 }}>
        Prototype · all telemetry is simulated client-side. Swap{' '}
        <code style={{ fontFamily: 'var(--mono)' }}>src/sim/telemetryFeed.js</code> for a
        WebSocket client to run against real devices.
      </footer>
    </div>
  );
}
